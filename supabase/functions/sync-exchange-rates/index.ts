import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.9";
import {
  normalizeCurrencyApiPayload,
  PROVIDER_BASE_CURRENCY,
  PROVIDER_NAME,
  safeProviderError,
} from "../_shared/currencyapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function authorizeRequest(
  request: Request,
  serviceClient: ReturnType<typeof createClient>,
  supabaseUrl: string,
  anonKey: string,
  cronSecret: string,
): Promise<{ source: "scheduled" | "admin_manual"; requestedBy: string | null }> {
  const suppliedCronSecret = request.headers.get("x-cron-secret") || "";
  if (cronSecret && suppliedCronSecret && suppliedCronSecret === cronSecret) {
    return { source: "scheduled", requestedBy: null };
  }

  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("EDGE_FUNCTION_AUTHENTICATION_REQUIRED");
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) throw new Error("EDGE_FUNCTION_AUTHENTICATION_FAILED");

  const { data: admin, error: adminError } = await serviceClient
    .from("app_admins")
    .select("role")
    .eq("user_id", userData.user.id)
    .in("role", ["super_admin", "admin_staff", "finance_staff"])
    .maybeSingle();
  if (adminError || !admin) throw new Error("FINANCE_CURRENCY_ACCESS_REQUIRED");
  return { source: "admin_manual", requestedBy: userData.user.id };
}

async function fetchCurrencyApiSnapshot(
  providerKey: string,
  currencies: string[],
  historicalDate: string | null = null,
) {
  const endpoint = historicalDate ? "historical" : "latest";
  const providerUrl = new URL(`https://api.currencyapi.com/v3/${endpoint}`);
  providerUrl.searchParams.set("base_currency", PROVIDER_BASE_CURRENCY);
  providerUrl.searchParams.set("type", "fiat");
  if (historicalDate) providerUrl.searchParams.set("date", historicalDate);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(providerUrl, {
      method: "GET",
      headers: { apikey: providerKey, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Provider rejected the ${endpoint} request with status ${response.status}.`);
    return normalizeCurrencyApiPayload(await response.json(), currencies, { allowMissing: true });
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const providerKey = Deno.env.get("CURRENCYAPI_API_KEY") || "";
  const cronSecret = Deno.env.get("CURRENCY_SYNC_SECRET") || "";
  if (!supabaseUrl || !serviceRoleKey || !anonKey || !providerKey || !cronSecret) {
    return json({ error: "SERVER_CONFIGURATION_INCOMPLETE" }, 500);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let runId: string | null = null;

  try {
    const authorization = await authorizeRequest(request, serviceClient, supabaseUrl, anonKey, cronSecret);
    if (authorization.source === "admin_manual") {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recent } = await serviceClient
        .from("exchange_rate_sync_runs")
        .select("id")
        .eq("trigger_source", "admin_manual")
        .gte("started_at", cutoff)
        .limit(1);
      if (recent?.length) return json({ error: "RATE_SYNC_RATE_LIMITED" }, 429);
    }

    const staleRunningCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await serviceClient
      .from("exchange_rate_sync_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        safe_error_summary: "A previous sync stopped before completion and its stale lock was released.",
      })
      .eq("status", "running")
      .lt("started_at", staleRunningCutoff);

    const { data: run, error: runError } = await serviceClient
      .from("exchange_rate_sync_runs")
      .insert({
        provider: PROVIDER_NAME,
        requested_base_currency: PROVIDER_BASE_CURRENCY,
        trigger_source: authorization.source,
        requested_by: authorization.requestedBy,
      })
      .select("id")
      .single();
    if (runError?.code === "23505") return json({ status: "already_running" }, 409);
    if (runError || !run) throw new Error("SYNC_RUN_CREATE_FAILED");
    runId = run.id;

    const { data: supported, error: currencyError } = await serviceClient
      .from("supported_currencies")
      .select("code")
      .eq("is_active", true)
      .order("code");
    if (currencyError || !supported?.length) throw new Error("SUPPORTED_CURRENCY_LOAD_FAILED");
    const currencies = supported.map((row) => row.code);

    const normalized = await fetchCurrencyApiSnapshot(providerKey, currencies);
    const rows = normalized.rates.map((rate) => ({ ...rate, sync_run_id: runId }));
    let ratesStored = rows.length;
    const partialMessages: string[] = [];
    if (normalized.missingCurrencies.length) {
      partialMessages.push(
        `${normalized.missingCurrencies.length} configured currencies are not currently returned by CurrencyAPI: ${normalized.missingCurrencies.join(", ")}.`,
      );
    }

    const { error: rateError } = await serviceClient
      .from("exchange_rate_snapshots")
      .upsert(rows, { onConflict: "provider,base_currency,quote_currency,provider_effective_at", ignoreDuplicates: true });
    if (rateError) throw new Error("RATE_SNAPSHOT_STORE_FAILED");

    const { data: missingDates, error: missingDateError } = await serviceClient.rpc(
      "currency_conversion_backfill_dates",
      { p_limit: 7 },
    );
    if (missingDateError) partialMessages.push("Historical backfill dates could not be loaded.");
    for (const item of missingDates || []) {
      try {
        const historical = await fetchCurrencyApiSnapshot(providerKey, currencies, item.payment_date);
        const historicalRows = historical.rates.map((rate) => ({ ...rate, sync_run_id: runId }));
        const { error: historicalError } = await serviceClient
          .from("exchange_rate_snapshots")
          .upsert(historicalRows, {
            onConflict: "provider,base_currency,quote_currency,provider_effective_at",
            ignoreDuplicates: true,
          });
        if (historicalError) throw new Error("HISTORICAL_RATE_SNAPSHOT_STORE_FAILED");
        ratesStored += historicalRows.length;
      } catch (_error) {
        partialMessages.push(`Historical rates for ${item.payment_date} remain pending.`);
      }
    }

    const { error: conversionError } = await serviceClient.rpc("backfill_currency_conversions");
    if (conversionError) partialMessages.push("Some historical conversions could not be backfilled.");
    const finalStatus = partialMessages.length ? "partial_failure" : "success";
    const { error: completeError } = await serviceClient
      .from("exchange_rate_sync_runs")
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        provider_effective_at: normalized.effectiveAt,
        rates_stored: ratesStored,
        safe_error_summary: partialMessages.length ? partialMessages.join(" ").slice(0, 500) : null,
      })
      .eq("id", runId);
    if (completeError) throw new Error("SYNC_RUN_COMPLETE_FAILED");
    return json({ status: finalStatus, rates_stored: ratesStored });
  } catch (error) {
    const safeError = safeProviderError(error);
    if (runId) {
      await serviceClient.from("exchange_rate_sync_runs").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        safe_error_summary: safeError,
      }).eq("id", runId);
    }
    const authFailure = safeError.includes("AUTHENTICATION") || safeError.includes("ACCESS_REQUIRED");
    return json({ error: safeError }, authFailure ? 401 : 502);
  }
});
