import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../app.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260927140000_dashboard_completed_payments.sql", import.meta.url), "utf8");
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

test("Personal and Family dashboards offer two explained payment paths", () => {
  assert.match(html, /data-open-dashboard-payment>Add payment/);
  assert.match(html, /data-payment-entry-choice="scheduled"[\s\S]*Schedule a payment[\s\S]*schedule it and remind you/);
  assert.match(html, /data-payment-entry-choice="completed"[\s\S]*Record a payment already made[\s\S]*completed one-time purchase/);
  assert.match(app, /function openDashboardPaymentChoice\(/);
  assert.match(app, /paymentEntryChoice === "scheduled"\) openPaymentItemDialog\(\)/);
  assert.match(app, /paymentEntryChoice === "completed"\) openCompletedPaymentDialog\(\)/);
  assert.match(styles, /\.payment-choice-grid/);
});

test("a completed payment captures history details and Family payer attribution", () => {
  for (const id of [
    "completedPaymentName", "completedPaymentAmount", "completedPaymentCurrency",
    "completedPaymentCategory", "completedPaymentPaidBy", "completedPaymentDate",
    "completedPaymentMethod", "completedPaymentReference", "completedPaymentNotes",
    "completedPaymentProof"
  ]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /currentFamilyMember\(\)\?\.id \|\| familyOwnerMember\(\)\?\.id \|\| activeMembers\(\)\[0\]\?\.id/);
  assert.match(app, /p_paid_by_member_id: paidByMemberId \|\| null/);
  assert.match(app, /state\.members\.filter\(\(member\) => member\.status === "active"\)/);
});

test("the server creates the once-off item and paid record in one protected transaction", () => {
  assert.match(migration, /create or replace function public\.create_completed_one_time_payment/);
  assert.match(migration, /security definer/);
  assert.match(migration, /public\.my_account_suspended\(\)/);
  assert.match(migration, /public\.effective_workspace_entitlement\(p_workspace_id\)/);
  assert.match(migration, /workspace_type in \('personal', 'household'\)/);
  assert.match(migration, /members\.status = 'active'/);
  assert.match(migration, /insert into public\.payment_items[\s\S]*recurrence_type[\s\S]*reminder_days_before/);
  assert.match(migration, /v_currency, 'once', 1,[\s\S]*p_payment_date, 0, 'active'/);
  assert.match(migration, /insert into public\.payment_records[\s\S]*date_trunc\('month', p_payment_date\)::date/);
  assert.match(migration, /grant execute on function public\.create_completed_one_time_payment/);
  assert.match(schema, /Release 4\.9\.13: atomically record a completed one-time payment/);
});

test("completed Personal payments remain available to the Cashbook paid-payment picker", () => {
  assert.match(app, /record\.visibility === "personal" && !linked\.has\(record\.id\)/);
  assert.match(html, /Paid payment<select id="cashbookPaymentRecord"/);
  assert.doesNotMatch(html, /Cash Out source/);
});
