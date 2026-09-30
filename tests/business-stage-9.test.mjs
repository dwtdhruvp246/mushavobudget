import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read = name => readFileSync(new URL('../'+name, import.meta.url),'utf8');
const app=read('business.js'),sql=read('supabase/migrations/20260930073000_business_stage_9_reports.sql');
const extract=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));

test('report periods follow business dates across years, leap years and financial boundaries',()=>{
  const context=vm.createContext({});
  vm.runInContext(extract('function monthBudgetDates','\nfunction budgetNumbers')+'\n'+extract('function businessReportDates','\nfunction renderReportPeriod'),context);
  for(const [preset,today,day,month,expected] of [
    ['current','2026-09-19',20,1,['2026-08-20','2026-09-19']],
    ['current','2026-09-20',20,1,['2026-09-20','2026-10-19']],
    ['previous','2026-01-01',1,1,['2025-12-01','2025-12-31']],
    ['current','2028-02-12',1,1,['2028-02-01','2028-02-29']],
    ['financial_year','2026-04-19',20,4,['2025-04-20','2026-04-19']],
    ['financial_year','2026-04-20',20,4,['2026-04-20','2027-04-19']]
  ])assert.deepEqual(Array.from(context.businessReportDates(preset,today,day,month)),expected);
});
test('report controls read their own filters without changing Activity filters',()=>{
  const nodes={reportFrom:{value:'2026-09-20'},reportTo:{value:'2026-10-19'},reportCurrencyMode:{value:'original'},reportOriginalCurrency:{value:'ZAR'},reportCategory:{value:''},reportDimension:{value:'branch-a'}};
  const context=vm.createContext({$:selector=>nodes[selector.slice(1)]});
  vm.runInContext(extract('function readBusinessReportFilters','\nfunction renderReportAccess'),context);
  let result=context.readBusinessReportFilters();
  assert.equal(result.p_from,'2026-09-20');assert.equal(result.p_currency,'ZAR');assert.equal(result.p_category_id,null);assert.equal(result.p_dimension_id,'branch-a');
  nodes.reportFrom.disabled=true;nodes.reportTo.disabled=true;result=context.readBusinessReportFilters();assert.equal(result.p_from,null);assert.equal(result.p_to,null);
});
test('public report RPCs and private helpers retain the database permission boundary',()=>{
  assert.ok(read('supabase/schema.sql').endsWith(sql));
  assert.match(sql,/BUSINESS_REPORT_ACCESS_REQUIRED/);assert.match(sql,/BUSINESS_REPORT_EXPORT_REQUIRED/);
  assert.match(sql,/role in \('staff','contributor'\)/);assert.match(sql,/role not in \('staff','contributor'\)/);
  assert.match(sql,/revoke all on function public.business_report_rows/);
  assert.match(sql,/revoke all on function public.business_report_data/);
  assert.match(sql,/grant execute on function %s to authenticated/);
  assert.match(sql,/'public.business_report_export\(uuid,text,text,uuid,text,date,date,text,text,uuid,uuid,text,uuid,uuid\)'/);
  assert.match(sql,/business_claims_active/);
});
test('exports and drill-downs verify the full snapshot and never truncate larger exports',()=>{
  assert.equal((sql.match(/raise exception 'BUSINESS_REPORT_CHANGED'/g)||[]).length,2);
  assert.match(sql,/v_count>10000/);assert.match(sql,/BUSINESS_REPORT_EXPORT_TOO_LARGE/);
  assert.match(sql,/report.exported/);assert.match(sql,/string_agg/);
  assert.match(sql,/v_metadata-'generated_at'/);
  assert.match(app,/state.reportSnapshot!==snapshot/);assert.match(app,/request!==reportSequence/);
  assert.match(app,/request!==reportSourceSequence/);
});
test('report totals retain recorded conversions and distinguish proofs and linked commitments',()=>{
  assert.doesNotMatch(sql,/latest_exchange_rate/);
  for(const pattern of [/i.status='received'/,/b.amount-b.paid_amount/,/b.source_claim_id=c.id/,/b.source_request_id=r.id/,/timezone\(s.timezone,p.paid_at\)::date/,/d.parent_type='expense_claim'/,/d.parent_type='business_bill_payment'/,/d.parent_type='business_bill'/])assert.match(sql,pattern);
  assert.match(sql,/business_can_view_budget/);assert.match(sql,/p_mode='reporting'/);
});
test('print output treats record text as text and exposes browser Save PDF',()=>{
  const print=extract('function renderBusinessReportPrint','\nasync function refreshClaims');
  assert.doesNotMatch(print,/innerHTML|document.write|insertAdjacentHTML/);
  assert.match(print,/item.textContent=text/);assert.match(print,/popup.print\(\)/);
  assert.match(print,/Save as PDF/);assert.match(print,/Snapshot/);
});
