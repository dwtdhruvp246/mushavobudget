import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const migration = readFileSync(new URL("../supabase/migrations/20260928090000_admin_manual_subscription_grants.sql", import.meta.url), "utf8");
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const html = readFileSync(new URL("../app.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("admin migration precedes Stage 3 while retaining the scoped Business launch exception", () => {
  assert.ok(schema.includes(migration));
  assert.match(migration, /create or replace function public\.enforce_business_workspace_launch_control/);
  assert.match(migration, /create or replace function public\.enforce_business_member_provision_launch_control/);
});

test("Business exception is limited to the super admin, exact owner and workspace, and current transaction", () => {
  assert.match(migration, /not public\.is_platform_staff\(array\['super_admin'\]\)/);
  assert.match(migration, /public\.my_account_suspended\(\)/);
  assert.match(migration, /permits\.workspace_id = p_workspace_id/);
  assert.match(migration, /permits\.owner_id = p_owner_id/);
  assert.match(migration, /permits\.admin_id = auth\.uid\(\)/);
  assert.match(migration, /permits\.transaction_id = txid_current\(\)/);
  assert.match(migration, /tg_op = 'INSERT'[\s\S]*?public\.business_admin_test_permit\(new\.id, new\.owner_id\)/);
  assert.match(migration, /new\.role = 'business_owner'/);
  assert.match(migration, /delete from public\.business_admin_test_provisioning/);
  assert.match(migration, /revoke all on function public\.business_admin_test_permit/);
  assert.doesNotMatch(migration, /available_for_purchase\s*=\s*true/);
});

test("grant validates existing account and matching ownership, records audit without charging", () => {
  assert.match(migration, /v_owner\.account_status <> 'active'/);
  assert.match(migration, /status = 'provisioned'/);
  assert.match(migration, /v_workspace\.owner_id <> p_owner_id/);
  assert.match(migration, /v_workspace\.workspace_type <> v_plan\.workspace_type/);
  assert.match(migration, /status = 'pending_review'/);
  assert.match(migration, /p_ends_on > p_starts_on \+ 366/);
  assert.match(migration, /insert into public\.admin_subscription_grants/);
  assert.match(migration, /insert into public\.subscription_entitlement_history/);
  assert.match(migration, /insert into public\.subscription_audit_events/);
  assert.doesNotMatch(migration, /insert into public\.(subscription_payments|subscription_invoices|payments)/);
  assert.match(migration, /revoke all on public\.admin_subscription_grants/);
});

test("admin Users form offers Business testing only to super admins and confirms the replacement", () => {
  assert.match(html, /id="adminManualGrantPanel" class="admin-disclosure hidden"/);
  assert.match(html, /id="adminManualGrantReason"/);
  assert.match(app, /panel\.classList\.toggle\("hidden", state\.adminRole !== "super_admin"\)/);
  assert.match(app, /state\.adminRole === "super_admin"[\s\S]*?admin_subscription_grants/);
  assert.match(app, /plan\.is_active && plan\.code !== "free" && plan\.workspace_type === workspaceType/);
  assert.match(app, /window\.confirm\(`Grant /);
  assert.match(app, /supabase\.rpc\("admin_grant_manual_subscription"/);
  assert.match(app, /data-manual-grant-user/);
});

test("default inclusive expiry respects month-end and leap-year anniversaries", () => {
  const start = app.indexOf("function manualGrantDateAfter(");
  const end = app.indexOf("function refreshAdminManualGrantPlans()", start);
  const calculate = runInNewContext(
    `${app.slice(start, end)}; manualGrantDateAfter`,
    { Date, Number, Math }
  );
  assert.equal(calculate("2026-01-31", "monthly"), "2026-02-27");
  assert.equal(calculate("2026-05-20", "monthly"), "2026-06-19");
  assert.equal(calculate("2024-02-29", "annual"), "2025-02-27");
});
