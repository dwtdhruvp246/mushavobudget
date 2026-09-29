import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const migration = readFileSync(new URL("../supabase/migrations/20260928213000_business_stage_6_bills.sql", import.meta.url), "utf8");
const compatibility = readFileSync(new URL("../supabase/migrations/20260928222000_stage_6_reminder_url_compatibility.sql", import.meta.url), "utf8");
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const diagnostic = readFileSync(new URL("../supabase/diagnostics/business_stage_6_bills_diagnostic.sql", import.meta.url), "utf8");
const app = readFileSync(new URL("../business.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../business.html", import.meta.url), "utf8");
const dispatcher = readFileSync(new URL("../supabase/functions/dispatch-push-reminders/index.ts", import.meta.url), "utf8");
const worker = readFileSync(new URL("../sw.js", import.meta.url), "utf8");

test("Stage 6 has scoped, read-only tables with guarded writes and payment history", () => {
  assert.ok(schema.includes(migration));
  assert.ok(schema.includes(compatibility));
  for (const table of ["business_suppliers", "business_bill_schedules", "business_bills", "business_bill_payments"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} force row level security`));
    assert.match(migration, new RegExp(`grant select on public\\.%I to authenticated`));
  }
  assert.match(migration, /business_can_view_bill\(workspace_id, bill_id\)/);
  assert.match(migration, /constraint business_bill_payment_bill_fk foreign key \(workspace_id, bill_id\)/);
  assert.match(migration, /p_payment_id uuid[\s\S]*?if found then return v_payment; end if/);
  assert.match(migration, /p_amount > v_bill\.amount-v_bill\.paid_amount/);
  assert.match(migration, /BUSINESS_BILL_CLAIM_LINK_INVALID/);
  assert.match(migration, /guard_linked_claim_payment_trigger/);
  assert.match(migration, /not exists\(select 1 from public\.business_bills b[\s\S]*b\.source_claim_id=c\.id/);
  assert.match(diagnostic, /Anchored month ends/);
});

test("supplier bills are usable from desktop and phone, with one request ID per payment retry", () => {
  for (const id of ["businessSupplierForm", "businessBillForm", "businessBillDetailDialog", "billPaymentForm", "billProofParent"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /data-open-bill/);
  assert.match(app, /await refreshBills\(\)/);
  assert.match(app, /dataset\.requestId \|\| crypto\.randomUUID\(\)/);
  assert.match(app, /business_bill_payment/);
  assert.match(app, /cancel_business_bill/);
  assert.match(app, /stop_business_bill_schedule/);
  assert.match(migration, /paid_amount=0 and due_on>current_date/);
});

test("report combines actual bill payments with claims while linked claims are excluded in SQL", () => {
  const code = app.slice(app.indexOf("function renderFinanceSummary() {"), app.indexOf("\nfunction renderTransactions()"));
  const nodes = new Map();
  const $ = (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, { textContent: "", replaceChildren() {} });
    return nodes.get(selector);
  };
  const state = {
    claims: [], session: { user: { id: "owner" } },
    claimSummary: { finance_visible: true, reporting_currency: "USD", paid_amount: 20, committed_amount: 40, paid_count: 1, pending_count: 0, review_count: 0 },
    billSummary: { paid_amount: 15, outstanding: 25 },
    financeSummary: { finance_visible: true, reporting_currency: 'USD', income: 10, paid: 35, committed: 65, paid_count: 2 }
  };
  vm.runInNewContext(`${code}\nrenderFinanceSummary();`, {
    state, $, $$: () => [], claimPermission: () => true,
    money: (amount) => `$${amount}`, claimNode: () => ({})
  });
  assert.equal($("#businessPaidTotal").textContent, "$35");
  assert.equal($("#businessCommitmentTotal").textContent, "$65");
});

test("bill reminders use the protected outbox, current bill state, and Business deep link", () => {
  assert.match(migration, /source=push&workspace=\[0-9a-fA-F-\]\{36\}&payment_item=/);
  assert.match(migration, /revoke all on function public\.enqueue_due_business_bill_reminders\(timestamptz\) from public,anon,authenticated/);
  assert.match(migration, /business_bill_reminder_allowed/);
  assert.match(migration, /on conflict\(idempotency_key\) do nothing/);
  assert.match(dispatcher, /validateBusinessBillJob/);
  assert.match(dispatcher, /bill\.status !== "open"/);
  assert.match(dispatcher, /enqueue_due_business_bill_reminders/);
  assert.match(worker, /requested\.hash !== "#business\/bills"/);
  assert.match(compatibility, /workspace=\[0-9a-fA-F-\]\{36\}&payment_item=/);
  assert.match(compatibility, /business\[\.\]html/);
});
