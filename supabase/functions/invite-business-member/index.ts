import { createClient } from "npm:@supabase/supabase-js@2.110.9";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = new Set(["business_admin", "finance_manager", "team_manager", "staff", "contributor", "viewer"]);

function cors(origin: string): Record<string, string> {
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store", "Vary": "Origin" };
}
function json(body: Record<string, unknown>, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });
}
function token(request: Request): string {
  const value = request.headers.get("Authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}
function code(error: unknown, fallback: string): string {
  const message = String((error as { message?: unknown })?.message || "");
  return ["BUSINESS_TEAM_ACCESS_REQUIRED", "INVALID_INVITATION_EMAIL", "INVALID_BUSINESS_ROLE", "INVALID_BUSINESS_SCOPE", "CANNOT_INVITE_YOURSELF", "ALREADY_BUSINESS_MEMBER", "INVITATION_ALREADY_PENDING", "BUSINESS_SEAT_LIMIT_REACHED", "ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED", "BUSINESS_INVITATION_NOT_AVAILABLE", "BUSINESS_INVITATION_RATE_LIMITED"].find((item) => message.includes(item)) || fallback;
}

Deno.serve(async (request) => {
  const appOrigin = (Deno.env.get("APP_ORIGIN") || "").replace(/\/$/, "");
  const requestOrigin = (request.headers.get("Origin") || "").replace(/\/$/, "");
  const responseOrigin = requestOrigin && requestOrigin === appOrigin ? requestOrigin : appOrigin;
  if (!appOrigin) return json({ error: "BUSINESS_INVITATION_SERVER_CONFIGURATION_INCOMPLETE" }, 500, "null");
  if (requestOrigin && requestOrigin !== appOrigin) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403, appOrigin);
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors(responseOrigin) });
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405, responseOrigin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "BUSINESS_INVITATION_SERVER_CONFIGURATION_INCOMPLETE" }, 500, responseOrigin);
  const bearer = token(request);
  if (!bearer) return json({ error: "EDGE_FUNCTION_AUTHENTICATION_REQUIRED" }, 401, responseOrigin);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${bearer}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "EDGE_FUNCTION_AUTHENTICATION_FAILED" }, 401, responseOrigin);

  let body: { action?: unknown; workspace_id?: unknown; email?: unknown; role?: unknown; scope_ids?: unknown; invitation_id?: unknown };
  try { body = await request.json(); } catch { return json({ error: "INVALID_BUSINESS_INVITATION_REQUEST" }, 400, responseOrigin); }
  const action = body.action === "resend" ? "resend" : "create";
  let reservation: { invitation_id?: string; email?: string; invitee_user_id?: string | null; existing_user?: boolean } | null = null;
  let reserveError: unknown = null;
  if (action === "resend") {
    const result = await userClient.rpc("prepare_business_invitation_resend", { p_invitation_id: String(body.invitation_id || "") });
    reservation = result.data; reserveError = result.error;
  } else {
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "");
    const workspaceId = String(body.workspace_id || "");
    const scopeIds = Array.isArray(body.scope_ids) ? [...new Set(body.scope_ids.map(String))].slice(0, 20) : [];
    if (!EMAIL_PATTERN.test(email) || !ROLES.has(role) || !workspaceId) return json({ error: "INVALID_BUSINESS_INVITATION_REQUEST" }, 400, responseOrigin);
    const result = await userClient.rpc("create_business_invitation", { p_workspace_id: workspaceId, p_email: email, p_role: role, p_scope_ids: scopeIds });
    reservation = result.data; reserveError = result.error;
  }
  if (reserveError || !reservation?.invitation_id || !reservation.email) {
    const error = code(reserveError, "BUSINESS_INVITATION_RESERVATION_FAILED");
    return json({ error }, error.includes("ACCESS") ? 403 : error.includes("RATE_LIMITED") ? 429 : 400, responseOrigin);
  }

  const serviceClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const redirectTo = `${appOrigin}/business.html?invitation=${encodeURIComponent(reservation.invitation_id)}#business/team`;
  let invitedUserId = reservation.invitee_user_id || null;
  let mailError: unknown = null;
  if (invitedUserId) {
    const mailClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const result = await mailClient.auth.signInWithOtp({ email: reservation.email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } });
    mailError = result.error;
  } else {
    const result = await serviceClient.auth.admin.inviteUserByEmail(reservation.email, {
      redirectTo,
      data: { signup_source: "business_invitation", business_invitation_id: reservation.invitation_id },
    });
    mailError = result.error;
    invitedUserId = result.data?.user?.id || null;
  }
  const succeeded = !mailError && Boolean(invitedUserId);
  const errorCode = succeeded ? null : String((mailError as { status?: unknown })?.status || "BUSINESS_INVITATION_EMAIL_FAILED").slice(0, 100);
  const { error: recordError } = await serviceClient.rpc("record_business_invitation_delivery", {
    p_invitation_id: reservation.invitation_id,
    p_invitee_user_id: invitedUserId,
    p_succeeded: succeeded,
    p_error_code: errorCode,
  });
  if (recordError) return json({ error: "BUSINESS_INVITATION_DELIVERY_RECORD_FAILED" }, 500, responseOrigin);
  if (!succeeded) return json({ error: "BUSINESS_INVITATION_EMAIL_FAILED", invitation_id: reservation.invitation_id }, 502, responseOrigin);
  return json({ status: action === "resend" ? "resent" : "sent", invitation_id: reservation.invitation_id, email: reservation.email }, 200, responseOrigin);
});
