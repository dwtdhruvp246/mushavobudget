import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../app.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260927103000_personal_cashbook_private_test.sql", import.meta.url), "utf8");
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const pwa = readFileSync(new URL("../pwa.js", import.meta.url), "utf8");

test("Cashbook is a published Personal-only navigation route", () => {
  assert.match(app, /familyTabs = new Set\([^)]*"cashbook"/);
  assert.match(app, /tab === "cashbook" && area !== "personal" \? "dashboard" : tab/);
  assert.match(app, /requestedArea === "personal"/);
  assert.match(app, /rawTab\?\.replace\(\/\\\.\+\$\/, ""\)/);
  assert.match(html, /data-family-panel="cashbook"/);
  assert.match(html, /data-family-tab="cashbook" data-personal-only/);
  assert.match(app, /element\.hidden = !personalWorkspace/);
  assert.match(pwa, /const RELEASE = "4\.9\.27"/);
  assert.match(html, /app\.js\?v=107/);
  assert.match(html, /styles\.css\?v=74/);
});

test("Cashbook tables and reads are isolated to an active Personal owner", () => {
  assert.match(migration, /create table if not exists public\.cashbook_accounts/);
  assert.match(migration, /create table if not exists public\.cashbook_entries/);
  assert.match(migration, /workspaces\.workspace_type = 'personal'/);
  assert.match(migration, /workspaces\.owner_id = auth\.uid\(\)/);
  assert.match(migration, /and not public\.my_account_suspended\(\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.cashbook_accounts from public, anon, authenticated/);
  assert.doesNotMatch(migration, /grant (insert|update|delete) on table public\.cashbook_/i);
});

test("a paid-history event is copied exactly once without changing Payments", () => {
  assert.match(migration, /amount numeric\(18, 4\)/);
  assert.match(migration, /cashbook_entries_active_payment_link_unique_idx[\s\S]*linked_payment_record_id is not null and reversed_at is null/);
  assert.match(migration, /where id = p_payment_record_id and workspace_id = p_workspace_id[\s\S]*visibility = 'personal'/);
  assert.match(migration, /v_record\.amount, v_record\.currency,[\s\S]*v_record\.payment_date, v_item\.name/);
  assert.doesNotMatch(migration, /update public\.payment_records/);
  assert.doesNotMatch(migration, /linked_payment_record_id uuid references public\.payment_records/);
  assert.match(migration, /Converted to linked paid payment/);
  assert.match(app, /p_replace_manual_entry_id/);
  assert.match(app, /Linked payment history is no longer available/);
});

test("transfers, balances, reports, and reversals preserve accounting rules", () => {
  assert.match(migration, /SAME_CURRENCY_TRANSFER_AMOUNTS_MUST_MATCH/);
  assert.match(migration, /'transfer_out'[\s\S]*'transfer_in'/);
  assert.match(migration, /entries\.transaction_date <= current_date/);
  assert.match(migration, /entries\.entry_type = 'cash_in'[\s\S]*entries\.entry_type = 'cash_out'[\s\S]*entries\.entry_type = 'transfer_in'[\s\S]*entries\.entry_type = 'transfer_out'/);
  assert.match(migration, /v_entry\.transfer_group_id is not null and transfer_group_id = v_entry\.transfer_group_id/);
  assert.doesNotMatch(migration, /delete from public\.cashbook_entries/i);
});

test("Cashbook provides responsive accounts, entries, reports, and reversal controls", () => {
  for (const id of ["cashbookBalanceSummary", "cashbookEntriesList", "cashbookAccountsList", "cashbookReportSummary", "cashbookReverseDialog"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /data-cashbook-period="daily"/);
  assert.match(html, /data-cashbook-direction="cash_in"/);
  assert.match(styles, /\.cashbook-ledger-head/);
  assert.match(styles, /@media \(max-width: 480px\)[\s\S]*\.cashbook-ledger-entry/);
  assert.match(app, /function renderCashbook\(/);
  assert.match(app, /function renderCashbookLedger\(/);
  assert.match(app, /function cashbookBalanceAfterEntry\(/);
  assert.match(app, /function runCashbookReport\(/);
  assert.match(app, /function openCashbookReversal\(/);
  assert.doesNotMatch(html, /Manual entry/);
  assert.match(app, /const linked = \$\("#cashbookEntryDirection"\)\.value === "cash_out"/);
});

test("the consolidated schema includes the Personal Cashbook foundation", () => {
  assert.match(schema, /Personal Cashbook foundation/);
  assert.match(schema, /create or replace function public\.create_cashbook_payment_entry/);
  assert.match(schema, /notify pgrst, 'reload schema';\s*commit;\s*$/);
});
