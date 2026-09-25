import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../app.html", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260925090000_expiry_and_account_suspension.sql", import.meta.url), "utf8");
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const dispatcher = readFileSync(new URL("../supabase/functions/dispatch-push-reminders/index.ts", import.meta.url), "utf8");

test("expiry pauses excess Personal payments deterministically and restores them on renewal", () => {
  assert.match(migration, /row_number\(\) over \(order by i\.keep_on_free desc, i\.created_at, i\.id\)/);
  assert.match(migration, /free_mode and place > free_limit/);
  assert.match(migration, /s\.paid_through_at < now\(\)/);
  assert.match(migration, /create or replace function public\.set_personal_free_payment_selection/);
  assert.match(migration, /count\(distinct id\)/);
  assert.match(migration, /owner_id = auth\.uid\(\)/);
  assert.match(schema, /Release 4\.9\.8: subscription expiry/);
});

test("paused payments disappear from active occurrences and cannot be edited or recorded", () => {
  const accessHelpers = app.slice(app.indexOf("function isPlanPaused("), app.indexOf("async function loadPaymentRecords("));
  const context = { state: { personalPlanAccess: [{ payment_item_id: "sixth", plan_paused: true }] } };
  vm.runInNewContext(`${accessHelpers}\nglobalThis.check = { isPlanPaused, isPaymentActive };`, context);
  assert.equal(context.check.isPaymentActive({ id: "sixth", status: "active", visibility: "personal" }), false);
  assert.equal(context.check.isPaymentActive({ id: "first", status: "active", visibility: "personal" }), true);
  assert.equal(context.check.isPaymentActive({ id: "first", status: "inactive", visibility: "personal" }), false);
  assert.match(app, /\.filter\(isPaymentActive\)/);
  assert.match(app, /workspaceReadOnly \|\| planPaused \? "disabled" : ""}>Edit/);
  assert.match(app, /data-delete-obligation="\$\{item\.id\}" \$\{workspaceReadOnly \? "disabled" : ""\}/);
  assert.match(migration, /tg_op = 'DELETE' then return old/);
  assert.match(migration, /PAYMENT_PAUSED_BY_PLAN/);
  assert.match(html, /id="freePaymentSelection"/);
});

test("queued and dispatched reminders are both rechecked against the plan and account", () => {
  assert.match(migration, /where items\.status = 'active'\s+and public\.payment_reminder_allowed\(items\.id\)/);
  assert.match(migration, /recipient_profiles\.account_status = 'active'/);
  assert.match(dispatcher, /"payment_reminder_allowed"/);
  assert.match(dispatcher, /recipient\.account_status !== "active"/);
});

test("admin account suspension has a dedicated screen and blocks direct table access", () => {
  assert.match(migration, /create or replace function public\.set_user_account_status/);
  assert.match(migration, /p_user_id = auth\.uid\(\)/);
  assert.match(migration, /as restrictive for all to authenticated using \(not public\.my_account_suspended\(\)\)/);
  assert.match(app, /setView\("suspended"\)/);
  assert.match(html, /Your account is suspended/);
});
