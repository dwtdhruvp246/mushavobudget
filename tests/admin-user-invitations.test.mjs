import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20260922113000_admin_user_invitations.sql", import.meta.url), "utf8");
const schema = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const edgeFunction = await readFile(new URL("../supabase/functions/invite-admin-user/index.ts", import.meta.url), "utf8");
const edgeConfig = await readFile(new URL("../supabase/config.toml", import.meta.url), "utf8");
const application = await readFile(new URL("../app.js", import.meta.url), "utf8");
const applicationPage = await readFile(new URL("../app.html", import.meta.url), "utf8");

test("invitation records preserve the requested plan, currencies, payment, and audit history", () => {
  assert.match(migration, /create table if not exists public\.admin_user_invitations/);
  assert.match(migration, /plan_id uuid not null references public\.plans/);
  assert.match(migration, /enabled_currencies text\[\]/);
  assert.match(migration, /payment_received boolean/);
  assert.match(migration, /raise exception 'PLAN_PRICE_NOT_CONFIGURED'/);
  assert.match(migration, /create table if not exists public\.admin_user_invitation_audit/);
  assert.match(migration, /create unique index if not exists admin_user_invitations_active_email_idx/);
  assert.match(schema, /Admin-created user invitation foundation/);
});

test("browser roles cannot write invitations or call the protected reservation functions", () => {
  assert.match(migration, /force row level security/);
  assert.match(migration, /revoke all on table public\.admin_user_invitations from public, anon, authenticated/);
  assert.match(migration, /revoke all on function public\.reserve_admin_user_invitation[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.reserve_admin_user_invitation[\s\S]*to service_role/);
  assert.doesNotMatch(application, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("invited Auth users are not provisioned before Stage 5 acceptance", () => {
  const trigger = migration.slice(migration.indexOf("create or replace function public.handle_new_user_profile"), migration.indexOf("create or replace function public.reserve_admin_user_invitation"));
  assert.match(trigger, /if v_signup_source <> 'admin_invitation' then\s+perform public\.provision_budget_user/);
  assert.match(edgeFunction, /signup_source:\s*"admin_invitation"/);
  assert.match(edgeFunction, /admin_invitation_id:\s*invitationId/);
  assert.doesNotMatch(edgeFunction, /workspace_subscriptions|subscription_payments|subscription_invoices/);
});

test("the invitation Edge Function verifies the caller, role, origin, and server-only data", () => {
  assert.match(edgeFunction, /userClient\.auth\.getUser\(\)/);
  assert.match(edgeFunction, /ADMIN_ROLES\.has\(administrator\.role\)/);
  assert.match(edgeFunction, /requestOrigin !== appOrigin/);
  assert.match(edgeFunction, /serviceClient\.auth\.admin\.inviteUserByEmail/);
  assert.match(edgeFunction, /reserve_admin_user_invitation/);
  assert.match(edgeFunction, /record_admin_user_invitation_delivery/);
  assert.doesNotMatch(edgeFunction.slice(edgeFunction.indexOf("data: {"), edgeFunction.indexOf("},\n  });", edgeFunction.indexOf("data: {"))), /payment_|plan_id|paid_through/);
  assert.doesNotMatch(edgeConfig, /\[functions\.invite-admin-user\][\s\S]*verify_jwt = false/);
});

test("the admin UI captures subscription and payment choices and calls only the protected function", () => {
  assert.match(applicationPage, /id="adminInvitationForm"/);
  assert.match(applicationPage, /id="adminInvitePlan"/);
  assert.match(applicationPage, /id="adminInviteEnabledCurrencies" multiple/);
  assert.match(applicationPage, /id="adminInvitePaymentReceived"/);
  assert.match(application, /supabase\.functions\.invoke\("invite-admin-user"/);
  assert.match(application, /refreshSessionForProtectedFunction\(\)/);
  assert.match(application, /\["super_admin", "admin_staff"\]\.includes\(state\.adminRole\)/);
  assert.doesNotMatch(application, /from\("admin_user_invitations"\)\.insert/);
});
