import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const migration = readFileSync(new URL("../supabase/migrations/20260928200000_business_stage_5_expense_claims.sql", import.meta.url), "utf8");
const diagnostic = readFileSync(new URL("../supabase/diagnostics/business_stage_5_expense_claims_diagnostic.sql", import.meta.url), "utf8");
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const app = readFileSync(new URL("../business.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../business.html", import.meta.url), "utf8");

test("Stage 5 migration is mirrored and claims are protected by RLS and atomic RPCs", () => {
  assert.ok(schema.endsWith(migration));
  assert.match(migration, /business_expense_claims force row level security/);
  assert.match(migration, /revoke all on public\.business_expense_claims from public, anon, authenticated/);
  assert.match(migration, /grant select on public\.business_expense_claims to authenticated/);
  assert.match(migration, /constraint business_claim_category_fk foreign key \(workspace_id, category_id\)/);
  assert.match(migration, /constraint business_claim_dimension_fk foreign key \(workspace_id, dimension_id\)/);
  for (const rpc of ["create_business_claim", "save_business_claim_draft", "submit_business_claim", "review_business_claim", "record_business_claim_payment"]) {
    assert.match(migration, new RegExp(`create function public\\.${rpc}\\(`));
    assert.match(app, new RegExp(`supabase\\.rpc\\("${rpc}"`));
  }
});

test("draft submission requires a receipt and review forbids self approval", () => {
  assert.match(migration, /BUSINESS_RECEIPT_REQUIRED/);
  assert.match(migration, /v_claim\.submitted_by = auth\.uid\(\).*BUSINESS_SELF_APPROVAL_FORBIDDEN/s);
  assert.match(migration, /status <> 'submitted' or v_claim\.version <> p_expected_version/);
  assert.match(migration, /status <> 'approved' or v_claim\.version <> p_expected_version/);
  assert.match(migration, /business_claim_in_scope\(p_workspace_id, v_claim\.dimension_id\)/);
  assert.match(migration, /status not in \('draft', 'changes_requested'\)[\s\S]*BUSINESS_SUBMITTED_RECEIPT_LOCKED/);
});

test("receipt registration, storage reads and claim history use claim visibility", () => {
  assert.match(migration, /parent_type <> 'expense_claim' or public\.business_can_view_claim\(workspace_id, parent_id\)/);
  assert.match(migration, /d\.parent_type <> 'expense_claim' or public\.business_can_view_claim\(d\.workspace_id, d\.parent_id\)/);
  assert.match(migration, /BUSINESS_CLAIM_RECEIPT_ACCESS_REQUIRED/);
  assert.match(migration, /public\.business_can_view_claim\(p_workspace_id, p_claim_id\)/);
  assert.match(diagnostic, /Private receipt reads are not tied to claim visibility/);
  assert.match(html, /claimReceiptFile/);
});

test("locked conversion and status-specific reporting count paid claims once", () => {
  assert.match(migration, /latest_exchange_rate\(v_currency, v_reporting, now\(\)\)/);
  assert.match(migration, /round\(p_amount \* v_rate\.exchange_rate, 4\)/);
  assert.match(migration, /sum\(c\.reporting_amount\) filter \(where c\.status = 'paid'\)/);
  assert.match(migration, /sum\(c\.reporting_amount\) filter \(where c\.status = 'approved'\)/);
  assert.match(migration, /lock_business_claim_reporting_currency_trigger/);
  const code = app.slice(app.indexOf("function renderClaims() {"), app.indexOf("\nasync function refreshClaims()"));
  const elements = new Map();
  const state = {
    claims: [
      { id: "paid", created_at: "2026-09-28", status: "paid", reporting_amount: 100, submitted_by: "other" },
      { id: "approved", created_at: "2026-09-27", status: "approved", reporting_amount: 50, submitted_by: "other" },
      { id: "submitted", created_at: "2026-09-26", status: "submitted", reporting_amount: 200, submitted_by: "other" },
      { id: "draft", created_at: "2026-09-25", status: "draft", reporting_amount: 300, submitted_by: "me" }
    ],
    session: { user: { id: "me" } },
    workspaceSettings: { reporting_currency: "USD" },
    claimSummary: { reporting_currency: "USD", finance_visible: true, paid_amount: 100, committed_amount: 50, paid_count: 1, pending_count: 1, review_count: 1 }
  };
  const $ = (selector) => {
    if (!elements.has(selector)) elements.set(selector, { textContent: "", replaceChildren(...nodes) { this.children = nodes; } });
    return elements.get(selector);
  };
  vm.runInNewContext(`${code}\nrenderClaims();`, {
    state, $, $$: () => [], claimPermission: (code) => code === "finance.view_all" || code === "approvals.review",
    money: (value) => `$${value}`, claimCard: (item) => item,
    claimNode: (_tag, _className, text) => ({ textContent: text })
  });
  assert.equal($("#businessPaidTotal").textContent, "$100");
  assert.equal($("#businessCommitmentTotal").textContent, "$50");
  assert.equal($("#businessReportPending").textContent, "1");
  assert.equal($("#businessReviewCount").textContent, "1");
  assert.equal($("#businessClaimActivity").children.length, 4);
});
