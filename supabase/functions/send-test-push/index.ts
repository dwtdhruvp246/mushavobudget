import { createClient } from "npm:@supabase/supabase-js@2.110.9";
// @ts-types="npm:@types/web-push@3.6.4"
import webpush from "npm:web-push@3.6.7";

const TEST_COOLDOWN_SECONDS = 60;
const TEST_PAYLOAD = JSON.stringify({
  type: "test",
  title: "Mushavo Budget",
  body: "Your payment reminder notifications are connected.",
  tag: "mushavo-budget-test-push",
});

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
};

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function json(
  body: Record<string, unknown>,
  status: number,
  origin: string,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return "";
  return authorization.slice("Bearer ".length).trim();
}

function deliveryStatus(error: unknown): number {
  if (!error || typeof error !== "object") return 0;
  const candidate = error as { statusCode?: unknown };
  return Number(candidate.statusCode || 0);
}

Deno.serve(async (request) => {
  const appOrigin = (Deno.env.get("APP_ORIGIN") || "").replace(/\/$/, "");
  const requestOrigin = (request.headers.get("Origin") || "").replace(/\/$/, "");
  const responseOrigin = requestOrigin && requestOrigin === appOrigin ? requestOrigin : appOrigin;

  if (!appOrigin) return json({ error: "PUSH_SERVER_CONFIGURATION_INCOMPLETE" }, 500, "null");
  if (requestOrigin && requestOrigin !== appOrigin) {
    return json({ error: "ORIGIN_NOT_ALLOWED" }, 403, appOrigin);
  }
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(responseOrigin) });
  }
  if (request.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405, responseOrigin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return json({ error: "PUSH_SERVER_CONFIGURATION_INCOMPLETE" }, 500, responseOrigin);
  }

  const token = bearerToken(request);
  if (!token) {
    return json({ error: "EDGE_FUNCTION_AUTHENTICATION_REQUIRED" }, 401, responseOrigin);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: "EDGE_FUNCTION_AUTHENTICATION_FAILED" }, 401, responseOrigin);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (_error) {
    console.error("Test push VAPID configuration is invalid");
    return json({ error: "PUSH_SERVER_CONFIGURATION_INVALID" }, 500, responseOrigin);
  }
  const { data: subscriptions, error: subscriptionError } = await serviceClient
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, failure_count")
    .eq("user_id", userData.user.id)
    .is("disabled_at", null);
  if (subscriptionError) {
    console.error("Test push subscription lookup failed", subscriptionError.code || "database_error");
    return json({ error: "PUSH_SUBSCRIPTION_LOOKUP_FAILED" }, 500, responseOrigin);
  }
  if (!subscriptions?.length) {
    return json({ error: "PUSH_SUBSCRIPTION_REQUIRED" }, 409, responseOrigin);
  }

  const { data: rateLimitClaimed, error: rateLimitError } = await serviceClient.rpc(
    "claim_push_test_rate_limit",
    {
      p_user_id: userData.user.id,
      p_cooldown_seconds: TEST_COOLDOWN_SECONDS,
    },
  );
  if (rateLimitError) {
    console.error("Test push rate-limit claim failed", rateLimitError.code || "database_error");
    return json({ error: "PUSH_TEST_RATE_LIMIT_CHECK_FAILED" }, 500, responseOrigin);
  }
  if (!rateLimitClaimed) {
    return json(
      { error: "PUSH_TEST_RATE_LIMITED", retry_after_seconds: TEST_COOLDOWN_SECONDS },
      429,
      responseOrigin,
    );
  }

  const sentAt = new Date().toISOString();
  let delivered = 0;
  let failed = 0;
  let disabled = 0;

  for (const subscription of subscriptions as PushSubscriptionRow[]) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        TEST_PAYLOAD,
        { TTL: 60 },
      );
      delivered += 1;
      await serviceClient.from("push_subscriptions").update({
        last_success_at: sentAt,
        failure_count: 0,
      }).eq("id", subscription.id).eq("user_id", userData.user.id);
    } catch (error) {
      failed += 1;
      const statusCode = deliveryStatus(error);
      const permanentlyGone = statusCode === 404 || statusCode === 410;
      if (permanentlyGone) disabled += 1;
      await serviceClient.from("push_subscriptions").update({
        failure_count: Number(subscription.failure_count || 0) + 1,
        disabled_at: permanentlyGone ? sentAt : null,
      }).eq("id", subscription.id).eq("user_id", userData.user.id);
      console.warn("Test push delivery failed", { statusCode, permanentlyGone });
    }
  }

  if (!delivered) {
    return json(
      { error: "PUSH_TEST_DELIVERY_FAILED", delivered, failed, disabled },
      502,
      responseOrigin,
    );
  }
  return json({ status: "sent", delivered, failed, disabled }, 200, responseOrigin);
});
