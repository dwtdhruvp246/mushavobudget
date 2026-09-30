import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read = name => readFileSync(new URL('../'+name, import.meta.url), 'utf8');
const sql = read('supabase/migrations/20260930060000_business_stage_8_budgets_approvals.sql');
const app = read('business.js'), html = read('business.html');
const extract = (start,end) => app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));

test('Stage 8 migration is mirrored and client writes are RPC-only behind forced RLS',()=>{
  assert.ok(read('supabase/schema.sql').endsWith(sql));
  assert.match(sql,/force row level security/);
  assert.match(sql,/revoke all on public\.%I from public,anon,authenticated/);
  assert.match(sql,/grant select on public\.%I to authenticated/);
  assert.match(sql,/business_can_view_budget\(workspace_id,id\)/);
  assert.match(sql,/business_can_view_request\(workspace_id,id\)/);
  assert.match(sql,/guard_suspended_account_write/);
  assert.match(sql,/business_budget_category_fk/);
  assert.match(sql,/business_request_dimension_fk/);
  assert.match(sql,/business_bill_request_fk/);
});
test('monthly dates follow the configured period start and handle leap years and December',()=>{
  const code=extract('function monthBudgetDates','\nfunction budgetNumbers');
  const context=vm.createContext({});vm.runInContext(code,context);
  for(const [month,day,expected] of [
    ['2026-09',20,['2026-09-20','2026-10-19']],['2028-02',1,['2028-02-01','2028-02-29']],
    ['2026-02',1,['2026-02-01','2026-02-28']],['2026-12',28,['2026-12-28','2027-01-27']]
  ])assert.deepEqual(Array.from(context.monthBudgetDates(month,day)),expected);
  assert.match(sql,/p_ends_on<>\(p_starts_on\+interval '1 month'\)::date-1/);
});
test('paid, committed and available remain separate, including negative availability',()=>{
  const context=vm.createContext({});vm.runInContext(extract('function budgetNumbers','\nfunction scopedOptions'),context);
  const values=context.budgetNumbers({planned_amount:'1000'},{paid:'500',committed:'650'});
  assert.equal(values.remaining,-150);assert.equal(values.paidRemaining,500);assert.ok(Math.abs(values.percent-115)<0.000001);
  assert.equal(context.budgetNumbers({planned_amount:1000},null).remaining,1000);
  assert.match(sql,/planned_amount\*0\.8/);
  assert.match(app,/values\.remaining < 0/);
  assert.match(html,/Targets do not block payments/);
});
test('budget activation is serialized, rejects identical overlapping scopes and locks active targets',()=>{
  assert.match(sql,/pg_advisory_xact_lock\(hashtextextended\('business-budget:'\|\|p_workspace_id::text,0\)\)/);
  assert.match(sql,/b\.category_id is not distinct from v_budget\.category_id/);
  assert.match(sql,/b\.dimension_id is not distinct from v_budget\.dimension_id/);
  assert.match(sql,/b\.starts_on<=v_budget\.ends_on and b\.ends_on>=v_budget\.starts_on/);
  assert.match(sql,/v_budget\.status<>'draft'/);
  assert.match(sql,/BUSINESS_BUDGET_SCOPE_INACTIVE/);
});
test('non-finance budget access requires an explicitly assigned tag, never company-wide figures',()=>{
  const scope=sql.slice(sql.indexOf('create function public.business_budget_scope'),sql.indexOf('create function public.business_can_view_budget'));
  assert.match(scope,/business_claims_active/);assert.match(scope,/business_claim_in_scope/);
  assert.match(scope,/p_dimension_id is not null and exists/);assert.match(scope,/business_member_scopes/);
  assert.match(scope,/finance.view_all/);
  const context=vm.createContext({state:{memberScopes:[],businessDimensions:[{id:'a',status:'active',name:'A'}]},claimPermission:()=>false,
    Option:function(text,value){this.text=text;this.value=value}});
  vm.runInContext(extract('function scopedOptions','\nfunction pagination'),context);
  const select={replaceChildren(...children){this.options=children}};context.scopedOptions(select,false,true);
  assert.equal(select.options.length,1);assert.equal(select.required,true);
  context.state.memberScopes=[{dimension_id:'a'}];context.scopedOptions(select,false,true);
  assert.equal(select.options.length,2);assert.equal(select.options[1].value,'a');
});
test('request submission, decisions and cancellation enforce scope, version, authorship and reasons',()=>{
  const decision=sql.slice(sql.indexOf('create function public.transition_business_request'),sql.indexOf('-- Consistent lock order'));
  for(const value of ['business_can_view_request','p_expected_version','for update','approvals.review','business_claim_in_scope',
    'v_request.submitted_by=auth.uid()','BUSINESS_SELF_APPROVAL_FORBIDDEN','BUSINESS_DECISION_REASON_REQUIRED',
    'BUSINESS_REQUEST_LINKED_TO_BILL','business_record_audit_event','public.notifications'])assert.ok(decision.includes(value));
  assert.match(app,/if \(!own && item.status === 'submitted' && claimPermission\('approvals.review'\)\)/);
  assert.match(html,/id="requestDecisionReason" minlength="2" maxlength="1000" required/);
});
test('approved requests produce one bill and carry original amounts and conversion snapshots unchanged',()=>{
  const link=sql.slice(sql.indexOf('create function public.create_business_bill_from_request'),sql.indexOf('create function public.business_request_feed'));
  assert.match(link,/if found then return v_bill/);assert.match(link,/v_request.status<>'approved'/);
  assert.match(link,/pg_advisory_xact_lock/);
  for(const field of ['reporting_currency','reporting_amount','exchange_rate','rate_effective_at','rate_provider'])
    assert.ok(link.includes(`${field}=v_request.${field}`));
  assert.match(sql,/where source_request_id is not null and status<>'cancelled'/);
  assert.match(sql,/source_request_id is null or source_claim_id is null/);
  assert.match(sql,/when new.status='paid' then 'fulfilled' when new.status='cancelled' then 'approved' else 'committed'/);
});
test('budget sources exclude linked requests and claims and use actual payment dates in workspace timezone',()=>{
  const sources=sql.slice(sql.indexOf('create function public.business_budget_rows'),sql.indexOf('create function public.business_budget_totals'));
  assert.match(sources,/r.status='approved'/);
  assert.match(sources,/b.source_request_id=r.id and b.status<>'cancelled'/);
  assert.match(sources,/b.source_claim_id=c.id and b.status<>'cancelled'/);
  assert.match(sources,/timezone\(s.timezone,p.paid_at\)::date/);
  assert.match(sources,/r.event_date between b.starts_on and b.ends_on/);
  assert.match(sources,/b.category_id is null or r.category_id=b.category_id/);
  assert.match(sources,/b.dimension_id is null or r.dimension_id=b.dimension_id/);
  assert.match(sources,/b.amount-b.paid_amount/);
});
test('all-source totals precede pagination and internal aggregators are denied to clients',()=>{
  assert.match(sql,/public.business_budget_totals\(p_workspace_id,p_budget_id\)/);
  assert.match(sql,/offset p_offset limit p_limit/);
  assert.match(sql,/p_limit not between 1 and 100/);
  for(const helper of ['business_budget_rows','business_budget_totals','business_transaction_rows'])
    assert.ok(sql.includes(`revoke all on function public.${helper}`));
  assert.match(sql,/where status='submitted' and submitted_by<>auth.uid\(\)/);
});
test('Owner role settings are limited to workflow permissions and still require an active subscription',()=>{
  const settings=sql.slice(sql.indexOf('create function public.set_business_workflow_permission'),sql.indexOf('-- Extend Stage 7'));
  assert.match(settings,/business_claims_active/);
  assert.match(settings,/'approvals.view','approvals.review','budgets.view','budgets.manage'/);
  assert.match(settings,/perform public.set_business_role_permission/);
  assert.match(app,/workflowPermissionsLoaded/);
  assert.match(app,/sequence !== workspaceLoadSequence \|\| request !== planningSequence/);
});
test('workspace clearing removes planning models, details, rendered records and Owner permissions',()=>{
  const clear=extract('function clearBusinessWorkspaceState()','\nasync function');
  for(const value of ['state.requests = []','state.budgets = []','openedRequest = null','openedBudget = null',
    'planningSequence += 1','state.workflowPermissionsLoaded = false',"'#businessRequestList'","'#businessBudgetList'","dialog[open]"])
    assert.ok(clear.includes(value),value);
});
