import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20260923100000_complete_admin_user_invitations.sql", import.meta.url), "utf8");
const schema = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const signup = await readFile(new URL("../signup.html", import.meta.url), "utf8");
const appPage = await readFile(new URL("../app.html", import.meta.url), "utf8");
const application = await readFile(new URL("../app.js", import.meta.url), "utf8");

test("only the authenticated invited identity can read or complete its invitation", () => {
  assert.match(migration, /invitations\.auth_user_id = v_user_id/);
  assert.match(migration, /lower\(invitations\.email\) = v_user_email/);
  assert.match(migration, /v_invitation\.auth_user_id <> v_user_id/);
  assert.match(migration, /v_profile_invitation_id is distinct from v_invitation\.id/);
  assert.match(migration, /revoke all on function public\.get_my_admin_user_invitation\(uuid\)[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.complete_admin_user_invitation\(uuid, text\[\], text\)[\s\S]*to authenticated/);
  assert.doesNotMatch(migration, /grant execute on function public\.complete_admin_user_invitation[\s\S]*to anon/);
});

test("completion is locked, idempotent, and provisions related records transactionally", () => {
  assert.match(migration, /^begin;/m);
  assert.match(migration, /for update;/);
  assert.match(migration, /status = 'provisioned' and v_invitation\.provisioned_workspace_id is not null[\s\S]*return v_invitation\.provisioned_workspace_id/);
  assert.match(migration, /insert into public\.budget_workspaces/);
  assert.match(migration, /insert into public\.workspace_subscriptions/);
  assert.match(migration, /insert into public\.subscription_entitlement_history/);
  assert.match(migration, /insert into public\.subscription_invoices/);
  assert.match(migration, /insert into public\.subscription_payments/);
  assert.match(migration, /set status = 'provisioned'/);
  assert.match(migration, /commit;\s*$/);
});

test("currency choices are server-validated and saved to workspace settings", () => {
  assert.match(migration, /cardinality\(coalesce\(p_enabled_currencies/);
  assert.match(migration, /join public\.supported_currencies/);
  assert.match(migration, /DEFAULT_CURRENCY_MUST_BE_ENABLED/);
  assert.match(migration, /default_payment_currency, enabled_currencies, reporting_currency/);
});

test("the invite setup page verifies the server session before accepting a password", () => {
  assert.match(signup, /meta name="referrer" content="no-referrer"/);
  assert.match(signup, /detectSessionInUrl: true/);
  assert.match(signup, /supabase\.auth\.getUser\(\)/);
  assert.match(signup, /supabase\.rpc\("get_my_admin_user_invitation"/);
  assert.match(signup, /nameInput\.readOnly = true/);
  assert.match(signup, /emailInput\.readOnly = true/);
  assert.match(signup, /supabase\.auth\.updateUser\(/);
  assert.match(signup, /supabase\.rpc\("complete_admin_user_invitation"/);
  assert.match(signup, /sanitizeInviteUrl\(\)/);
  assert.doesNotMatch(signup, /service_role/i);
});

test("admin messaging and app completion confirmation describe the live flow", () => {
  assert.match(appPage, /workspace, plan, and any recorded payment are provisioned/);
  assert.doesNotMatch(appPage, /after the Stage 5 setup flow is implemented/);
  assert.match(application, /Your account, workspace, and subscription are ready/);
  assert.match(schema, /Complete an admin-created user invitation only after Supabase Auth has/);
});
