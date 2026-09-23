import { createClient } from "npm:@supabase/supabase-js@2.110.9";

const ADMIN_ROLES = new Set(["super_admin", "admin_staff"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

type InvitePayload = {
  full_name?: unknown;
  email?: unknown;
  country_code?: unknown;
  plan_id?: unknown;
  billing_period?: unknown;
  subscription_currency?: unknown;
  entitlement_start_date?: unknown;
  paid_through_date?: unknown;
  enabled_currencies?: unknown;
  default_currency?: unknown;
  family_limit?: unknown;
  can_add_members?: unknown;
  payment_received?: unknown;
  payment_amount?: unknown;
  payment_currency?: unknown;
  payment_date?: unknown;
  payment_method?: unknown;
  payment_reference?: unknown;
  payment_notes?: unknown;
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

function json(body: Record<string, unknown>, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get("Authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

function cleanText(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function nullableText(value: unknown, maximum: number): string | null {
  return cleanText(value, maximum) || null;
}

function errorCode(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback;
  const candidate = error as { message?: unknown; code?: unknown; status?: unknown };
  const message = typeof candidate.message === "string" ? candidate.message : "";
  const known = [
    "ADMIN_USER_INVITATION_ACCESS_REQUIRED", "INVALID_INVITATION_EMAIL", "INVALID_INVITATION_NAME",
    "INVALID_COUNTRY_CODE", "INVALID_BILLING_PERIOD", "INVALID_WORKSPACE_NAME", "INVALID_FAMILY_LIMIT",
    "PLAN_NOT_AVAILABLE", "UNSUPPORTED_CURRENCY", "INVALID_ENABLED_CURRENCIES", "TOO_MANY_ENABLED_CURRENCIES",
    "DEFAULT_CURRENCY_MUST_BE_ENABLED", "SUBSCRIPTION_EXPIRY_REQUIRED", "INVALID_SUBSCRIPTION_DATE_RANGE",
    "INCOMPLETE_INVITATION_PAYMENT", "USER_ALREADY_REGISTERED", "ADMIN_INVITATION_DELIVERY_IN_PROGRESS",
    "ADMIN_INVITATION_RATE_LIMITED", "FREE_PLAN_REQUIRES_NO_PAYMENT",
  ].find((code) => message.includes(code));
  return known || (typeof candidate.code === "string" && candidate.code.length <= 100 ? candidate.code : fallback);
}

function inviteDeliveryError(error: unknown): { code: string; status: number } {
  const candidate = (error && typeof error === "object" ? error : {}) as { message?: unknown; status?: unknown; code?: unknown };
  const status = Number(candidate.status || 0);
  const message = `${candidate.message || ""}`.toLowerCase();
  if (status === 429 || message.includes("rate limit")) return { code: "INVITATION_EMAIL_RATE_LIMITED", status: 429 };
  if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
    return { code: "USER_ALREADY_REGISTERED", status: 409 };
  }
  return { code: "INVITATION_EMAIL_SEND_FAILED", status: 502 };
}

Deno.serve(async (request) => {
  const appOrigin = (Deno.env.get("APP_ORIGIN") || "").replace(/\/$/, "");
  const requestOrigin = (request.headers.get("Origin") || "").replace(/\/$/, "");
  const responseOrigin = requestOrigin && requestOrigin === appOrigin ? requestOrigin : appOrigin;

  if (!appOrigin) return json({ error: "INVITATION_SERVER_CONFIGURATION_INCOMPLETE" }, 500, "null");
  if (requestOrigin && requestOrigin !== appOrigin) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403, appOrigin);
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(responseOrigin) });
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405, responseOrigin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "INVITATION_SERVER_CONFIGURATION_INCOMPLETE" }, 500, responseOrigin);
  }

  const token = bearerToken(request);
  if (!token) return json({ error: "EDGE_FUNCTION_AUTHENTICATION_REQUIRED" }, 401, responseOrigin);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "EDGE_FUNCTION_AUTHENTICATION_FAILED" }, 401, responseOrigin);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: administrator, error: administratorError } = await serviceClient
    .from("app_admins")
    .select("role")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (administratorError) {
    console.error("Admin invitation role lookup failed", administratorError.code || "database_error");
    return json({ error: "ADMIN_INVITATION_ROLE_LOOKUP_FAILED" }, 500, responseOrigin);
  }
  if (!administrator || !ADMIN_ROLES.has(administrator.role)) {
    return json({ error: "ADMIN_USER_INVITATION_ACCESS_REQUIRED" }, 403, responseOrigin);
  }

  let body: InvitePayload;
  try {
    body = await request.json();
  } catch (_error) {
    return json({ error: "INVALID_INVITATION_REQUEST" }, 400, responseOrigin);
  }

  const fullName = cleanText(body.full_name, 120);
  const email = cleanText(body.email, 320).toLowerCase();
  const countryCode = cleanText(body.country_code, 2).toUpperCase() || null;
  const planId = cleanText(body.plan_id, 36);
  // This is a proposed name only. The workspace is created by the completion
  // RPC after the invited user sets their password and confirms currencies.
  const workspaceName = `${fullName.slice(0, 88)}'s workspace`;
  const billingPeriod = cleanText(body.billing_period, 10);
  const subscriptionCurrency = cleanText(body.subscription_currency, 3).toUpperCase();
  const entitlementStartDate = cleanText(body.entitlement_start_date, 10);
  const paidThroughDate = nullableText(body.paid_through_date, 10);
  const enabledCurrencies = Array.isArray(body.enabled_currencies)
    ? [...new Set(body.enabled_currencies.map((value) => cleanText(value, 3).toUpperCase()).filter(Boolean))]
    : [];
  const defaultCurrency = cleanText(body.default_currency, 3).toUpperCase() || null;
  const familyLimit = Number(body.family_limit ?? 0);
  const canAddMembers = body.can_add_members === true;
  const paymentReceived = body.payment_received === true;
  const paymentAmount = paymentReceived ? Number(body.payment_amount) : null;
  const paymentCurrency = paymentReceived ? cleanText(body.payment_currency, 3).toUpperCase() : null;
  const paymentDate = paymentReceived ? nullableText(body.payment_date, 10) : null;
  const paymentMethod = paymentReceived ? nullableText(body.payment_method, 80) : null;
  const paymentReference = paymentReceived ? nullableText(body.payment_reference, 120) : null;
  const paymentNotes = paymentReceived ? nullableText(body.payment_notes, 500) : null;

  if (!fullName || !EMAIL_PATTERN.test(email) || !UUID_PATTERN.test(planId) || !workspaceName) {
    return json({ error: "INVALID_INVITATION_REQUEST" }, 400, responseOrigin);
  }
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) return json({ error: "INVALID_COUNTRY_CODE" }, 400, responseOrigin);
  if (!['monthly', 'annual'].includes(billingPeriod)) return json({ error: "INVALID_BILLING_PERIOD" }, 400, responseOrigin);
  if (!CURRENCY_PATTERN.test(subscriptionCurrency) || enabledCurrencies.some((code) => !CURRENCY_PATTERN.test(code))) {
    return json({ error: "UNSUPPORTED_CURRENCY" }, 400, responseOrigin);
  }
  if (!DATE_PATTERN.test(entitlementStartDate) || (paidThroughDate && !DATE_PATTERN.test(paidThroughDate))) {
    return json({ error: "INVALID_SUBSCRIPTION_DATE_RANGE" }, 400, responseOrigin);
  }
  if (!Number.isInteger(familyLimit) || familyLimit < 0 || familyLimit > 100 || enabledCurrencies.length > 20) {
    return json({ error: "INVALID_INVITATION_REQUEST" }, 400, responseOrigin);
  }
  if ((enabledCurrencies.length === 0 && defaultCurrency) || (enabledCurrencies.length > 0 && !enabledCurrencies.includes(defaultCurrency || ""))) {
    return json({ error: "DEFAULT_CURRENCY_MUST_BE_ENABLED" }, 400, responseOrigin);
  }
  if (paymentReceived && (!(paymentAmount && paymentAmount > 0) || !paymentCurrency || !paymentDate || !paymentMethod)) {
    return json({ error: "INCOMPLETE_INVITATION_PAYMENT" }, 400, responseOrigin);
  }

  const { data: invitationId, error: reserveError } = await serviceClient.rpc("reserve_admin_user_invitation", {
    p_actor_id: userData.user.id,
    p_email: email,
    p_full_name: fullName,
    p_country_code: countryCode,
    p_plan_id: planId,
    p_workspace_name: workspaceName,
    p_billing_period: billingPeriod,
    p_subscription_currency: subscriptionCurrency,
    p_entitlement_start_date: entitlementStartDate,
    p_paid_through_date: paidThroughDate,
    p_enabled_currencies: enabledCurrencies,
    p_default_currency: defaultCurrency,
    p_family_limit: familyLimit,
    p_can_add_members: canAddMembers,
    p_payment_received: paymentReceived,
    p_payment_amount: paymentAmount,
    p_payment_currency: paymentCurrency,
    p_payment_date: paymentDate,
    p_payment_method: paymentMethod,
    p_payment_reference: paymentReference,
    p_payment_notes: paymentNotes,
  });
  if (reserveError || typeof invitationId !== "string") {
    const code = errorCode(reserveError, "ADMIN_INVITATION_RESERVATION_FAILED");
    const status = code === "ADMIN_USER_INVITATION_ACCESS_REQUIRED" ? 403 : code.includes("RATE_LIMITED") ? 429 : 400;
    return json({ error: code }, status, responseOrigin);
  }

  const redirectTo = `${appOrigin}/signup.html?mode=admin-invite&invitation=${encodeURIComponent(invitationId)}`;
  const { data: reservation, error: lookupError } = await serviceClient.from("admin_user_invitations")
    .select("auth_user_id").eq("id", invitationId).single();
  if (lookupError || !reservation) return json({ error: "ADMIN_INVITATION_RESERVATION_FAILED" }, 500, responseOrigin);

  const metadata = {
    full_name: fullName,
    country_code: countryCode,
    signup_source: "admin_invitation",
    admin_invitation_id: invitationId,
    enabled_currencies: enabledCurrencies,
    default_currency: defaultCurrency,
  };
  let invitedUserId: string | null = null;
  let inviteError: unknown = null;
  if (reservation.auth_user_id) {
    // A confirmed Auth identity can no longer receive a new Supabase invite.
    // A magic link signs the same unfinished identity into the new invitation.
    const { error: metadataError } = await serviceClient.auth.admin.updateUserById(
      reservation.auth_user_id, { user_metadata: metadata }
    );
    if (metadataError) {
      inviteError = metadataError;
    } else {
      const mailClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: mailError } = await mailClient.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
      });
      inviteError = mailError;
      invitedUserId = reservation.auth_user_id;
    }
  } else {
    const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(email, {
      redirectTo, data: metadata,
    });
    inviteError = error;
    invitedUserId = data?.user?.id || null;
  }

  if (inviteError || !invitedUserId) {
    const delivery = inviteDeliveryError(inviteError);
    const { error: recordError } = await serviceClient.rpc("record_admin_user_invitation_delivery", {
      p_invitation_id: invitationId,
      p_auth_user_id: null,
      p_succeeded: false,
      p_error_code: delivery.code,
    });
    if (recordError) console.error("Admin invitation failure audit failed", recordError.code || "database_error");
    console.warn("Admin invitation email failed", delivery.code);
    return json({ error: delivery.code }, delivery.status, responseOrigin);
  }

  const { error: recordError } = await serviceClient.rpc("record_admin_user_invitation_delivery", {
    p_invitation_id: invitationId,
    p_auth_user_id: invitedUserId,
    p_succeeded: true,
    p_error_code: null,
  });
  if (recordError) {
    console.error("Admin invitation delivery audit failed", recordError.code || "database_error");
    return json({ error: "ADMIN_INVITATION_DELIVERY_RECORD_FAILED" }, 500, responseOrigin);
  }

  return json({ status: reservation.auth_user_id ? "replaced" : "sent", invitation_id: invitationId, email }, 200, responseOrigin);
});
