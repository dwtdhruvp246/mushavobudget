import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const sql = read('supabase/migrations/20260929193000_business_stage_7_transactions.sql');
const app = read('business.js'), html = read('business.html');
const extract = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));

test('Stage 7 is mirrored with forced RLS, isolated category/tag foreign keys and RPC-only writes', () => {
  assert.ok(read('supabase/schema.sql').endsWith(sql));
  assert.match(sql, /business_income_receipts force row level security/);
  assert.match(sql, /revoke all on public.business_income_receipts from public,anon,authenticated/);
  assert.match(sql, /grant select on public.business_income_receipts to authenticated/);
  assert.match(sql, /foreign key\(workspace_id,category_id\)/);
  assert.match(sql, /foreign key\(workspace_id,dimension_id\)/);
  assert.match(sql, /my_account_suspended/);
  assert.match(sql, /guard_suspended_account_write/);
  assert.match(sql, /revoke all on function public.business_transaction_rows\(uuid\) from public,anon,authenticated/);
});
test('income requires active scoped finance access and snapshots the conversion', () => {
  const record = sql.slice(sql.indexOf('create function public.record_business_income'), sql.indexOf('create function public.void_business_income'));
  for (const gate of ['business_claims_active', 'finance.view_all', 'finance.create', 'business_claim_in_scope']) assert.ok(record.includes(gate));
  assert.match(record, /p_received_on>timezone\(v_settings.timezone,now\(\)\)::date/);
  assert.match(record, /category_type in \('income','both'\)/);
  assert.match(record, /latest_exchange_rate\(v_currency,v_settings.reporting_currency,now\(\)\)/);
  assert.match(record, /round\(p_amount\*v_rate.exchange_rate,4\)/);
  assert.match(record, /for share/);
  assert.match(sql, /BUSINESS_REPORTING_CURRENCY_LOCKED/);
  assert.match(sql, /business_income_void_state/);
  assert.match(sql, /BUSINESS_VOID_REASON_REQUIRED/);
});
test('income retry is serialized and bill payment retry preserves the original source', () => {
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(p_income_id::text,0\)\)/);
  assert.match(sql, /if found then[\s\S]*return v_income;[\s\S]*insert into public.business_income_receipts/);
  const bill = sql.slice(sql.indexOf('create function public.record_business_bill_payment_with_source'), sql.indexOf('-- This internal feed'));
  assert.ok(bill.indexOf('business_can_view_bill') < bill.indexOf('for update'));
  assert.ok(bill.indexOf('then return public.record_business_bill_payment') < bill.indexOf('update public.business_bill_payments'));
  assert.match(app, /p_income_id: \$\('#businessIncomeForm'\).dataset.requestId/);
  assert.match(app, /p_payment_source: \$\('#billPaymentSource'\).value/);
});
test('ledger actuals exclude voided income, unpaid employee costs and linked claims', () => {
  assert.match(sql, /case when i.status='received' then i.reporting_amount else 0 end/);
  assert.match(sql, /case when c.status='paid' then c.reporting_amount else 0 end/);
  assert.match(sql, /case when c.status='approved' then c.reporting_amount else 0 end/);
  assert.match(sql, /not exists\(select 1 from public.business_bills b where b.workspace_id=p_workspace_id and b.source_claim_id=c.id and b.status<>'cancelled'\)/);
  assert.match(sql, /'bill_payment'.*p.id,p.bill_id/s);
  assert.match(sql, /p.reporting_amount,0::numeric,p.created_at/);
});
test('server filtering is inclusive, literal, bounded, paginated and totals precede pagination', () => {
  assert.match(sql, /strpos\(lower\(r.title/);
  assert.match(sql, /r.event_date>=p_from.*r.event_date<=p_to/);
  assert.match(sql, /p_limit not between 1 and 100/);
  assert.match(sql, /matched as materialized/);
  assert.match(sql, /offset p_offset limit p_limit/);
  assert.match(sql, /sum\(paid_value\).*from matched/);
  assert.match(sql, /'paid',case when v_finance.*else null end/);
  assert.match(sql, /public.business_can_view_income\(p_workspace_id,i.id\)/);
  assert.match(sql, /public.business_can_view_claim\(p_workspace_id,c.id\)/);
  assert.match(sql, /public.business_can_view_bill\(p_workspace_id,p.bill_id\)/);
});
test('overview uses unfiltered server actuals and staff company totals are private', () => {
  const code = extract('function renderFinanceSummary()', '\nfunction renderTransactions()');
  const nodes = new Map();
  const $ = (key) => { if (!nodes.has(key)) nodes.set(key, {}); return nodes.get(key); };
  const state = { financeSummary: { finance_visible: true, income: 100, paid: 30, committed: 15, paid_count: 2, reporting_currency: 'USD' }, activitySummary: { income: 999 } };
  const context = vm.createContext({ state, $, money: (n) => `$${n}`, claimPermission: () => true });
  vm.runInContext(`${code}\nrenderFinanceSummary();`, context);
  assert.equal($('#businessIncomeTotal').textContent, '$100');
  assert.equal($('#businessPaidTotal').textContent, '$30');
  assert.equal($('#businessCommitmentTotal').textContent, '$15');
  state.financeSummary.finance_visible = false;
  vm.runInContext('renderFinanceSummary();', context);
  assert.equal($('#businessIncomeTotal').textContent, 'Private');
  assert.equal($('#businessPaidCount').textContent, '—');
});
test('slow activity responses cannot replace a later filter or workspace', async () => {
  assert.match(app, /\['#businessOverviewClaims', '#businessClaimActivity'\].*replaceChildren\(\)/);
  const code = extract('async function refreshTransactions(', '\nfunction openIncomeForm()');
  const pending = [];
  const state = { workspace: { id: 'one' }, locked: false, transactions: [] };
  let renderCount = 0;
  const context = vm.createContext({ state, query: (_label, promise) => promise,
    supabase: { rpc: () => new Promise((resolve) => pending.push(resolve)) },
    setClaimMessage() {}, friendlyMessage: (e) => e.message, renderTransactions: () => renderCount++ });
  vm.runInContext(`let workspaceLoadSequence=1, activitySequence=0, activityOffset=0, activityFilters={};\n${code}`, context);
  const first = vm.runInContext('refreshTransactions(false)', context);
  const second = vm.runInContext('refreshTransactions(false)', context);
  pending[1]({ items: [{ title: 'New' }] }); await second;
  pending[0]({ items: [{ title: 'Old' }] }); await first;
  assert.equal(state.transactions[0].title, 'New'); assert.equal(renderCount, 1);
  const third = vm.runInContext('refreshTransactions(false)', context);
  vm.runInContext('workspaceLoadSequence++; state.workspace={id:"two"}; state.transactions=[];', context);
  pending[2]({ items: [{ title: 'Other workspace' }] }); await third;
  assert.equal(state.transactions.length, 0);
});
test('income, payment source and activity controls exist with scrollable mobile dialogs', () => {
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
  for (const match of app.matchAll(/\$\(['"]#([A-Za-z][A-Za-z0-9]*)['"]\)/g)) assert.ok(ids.has(match[1]), `Missing #${match[1]}`);
  assert.equal(ids.size, [...html.matchAll(/id="([^"]+)"/g)].length, 'No duplicate IDs');
  for (const id of ['businessIncomeForm', 'incomeVoidForm', 'businessActivityFilters', 'billPaymentSource', 'businessEmployeeSource']) assert.ok(ids.has(id));
  assert.match(read('business.css'), /claim-detail-dialog.*overflow-y: auto/);
  assert.match(read('business.css'), /activity-filters.*minmax\(min\(100%, 180px\)/);
  assert.match(read('supabase/diagnostics/business_stage_7_transactions_diagnostic.sql'), /union all select check_name,status from fixed_checks/);
  assert.match(read('docs/BUSINESS_STAGE_7_TRANSACTIONS.md'), /purchase.*remain closed/);
});
