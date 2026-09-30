// Optional Stage 9 integration checks against a disposable PostgreSQL engine.
// Install @electric-sql/pglite or set MUSHAVO_PGLITE_MODULE to its module path.
const { PGlite } = require(process.env.MUSHAVO_PGLITE_MODULE || '@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const read = (name) => readFileSync(path.join(root, 'supabase/migrations', name), 'utf8');
const foundation = read('20260928070000_business_stage_2_security_foundation.sql');
const stage5 = read('20260928200000_business_stage_5_expense_claims.sql');
const stage6 = read('20260928213000_business_stage_6_bills.sql');
function fn(source, name) {
  const match = new RegExp(`create(?: or replace)? function public\\.${name}\\(`).exec(source);
  assert.ok(match, `Missing function ${name}`);
  return source.slice(match.index, source.indexOf('$$;', match.index) + 3);
}
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const ws=id(1), ws2=id(2), owner=id(10), finance=id(11), staff=id(12), manager=id(13), outsider=id(14);
const category=id(20), project=id(30), otherProject=id(31), supplier=id(40);
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated; create role anon; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('fixture.uid',true),'')::uuid$$;
      create table public.profiles(id uuid primary key,full_name text not null);
      create table public.budget_workspaces(id uuid primary key,owner_id uuid,workspace_type text,status text);
      create table public.workspace_members(id uuid primary key,workspace_id uuid,user_id uuid,role text,status text,unique(workspace_id,id));
      create table public.workspace_subscriptions(workspace_id uuid primary key,status text,paid_through_at timestamptz);
      create table public.workspace_settings(workspace_id uuid primary key,reporting_currency text,enabled_currencies text[],timezone text);
      create table public.business_profiles(workspace_id uuid primary key,period_start_day integer);
      create table public.business_categories(id uuid primary key,workspace_id uuid,category_type text,status text,name text,unique(workspace_id,id));
      create table public.business_dimensions(id uuid primary key,workspace_id uuid,status text,name text,unique(workspace_id,id));
      create table public.business_permission_definitions(permission_code text primary key);
      create table public.business_role_permissions(workspace_id uuid,role text,permission_code text,enabled boolean,granted_by uuid,primary key(workspace_id,role,permission_code));
      create table public.business_member_permissions(workspace_id uuid,member_id uuid,permission_code text,effect text,granted_by uuid,primary key(workspace_id,member_id,permission_code));
      create table public.business_member_scopes(workspace_id uuid,member_id uuid,dimension_id uuid);
      create table public.business_audit_events(id uuid primary key default gen_random_uuid(),workspace_id uuid,actor_id uuid,action text,target_type text,target_id uuid,
        before_summary jsonb,after_summary jsonb,reason text,request_id uuid,created_at timestamptz default now());
      create unique index fixture_audit_request on public.business_audit_events(workspace_id,request_id,action) where request_id is not null;
      create table public.notifications(user_id uuid,created_by uuid,type text,title text,body text);
      create function public.my_account_suspended() returns boolean language sql stable as $$ select coalesce(current_setting('fixture.suspended',true),'false')='true' $$;
      create function public.guard_suspended_account_write() returns trigger language plpgsql as $$begin if public.my_account_suspended() then raise exception 'ACCOUNT_SUSPENDED'; end if; return new; end$$;
      create function public.latest_exchange_rate(text,text,timestamptz) returns table(exchange_rate numeric,rate_effective_at timestamptz,provider text)
        language sql stable as $$select case when $1=$2 then 1::numeric else 2::numeric end,$3,case when $1=$2 then 'identity' else 'currencyapi' end$$;
      grant usage on schema public,auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    `);
    await db.exec(stage5.slice(stage5.indexOf('create table public.business_expense_claims'),stage5.indexOf('create function public.lock_business_claim_reporting_currency')));
    await db.exec(stage6.slice(stage6.indexOf('create table public.business_suppliers'),stage6.indexOf('create function public.business_can_view_bill')));
    for (const name of ['is_business_workspace_member','business_has_permission','business_record_audit_event','set_business_role_permission']) await db.exec(fn(foundation,name));
    for (const name of ['business_claims_active','business_claim_in_scope','business_can_view_claim','create_business_claim','save_business_claim_draft','record_business_claim_payment']) await db.exec(fn(stage5,name));
    for (const name of ['business_can_view_bill','create_business_bill','record_business_bill_payment','cancel_business_bill']) await db.exec(fn(stage6,name));
    await db.exec(read('20260929193000_business_stage_7_transactions.sql'));
    await db.exec(read('20260930060000_business_stage_8_budgets_approvals.sql'));
    await db.exec(`insert into auth.users values('${owner}'),('${finance}'),('${staff}'),('${manager}'),('${outsider}');
      insert into profiles values('${owner}','Owner'),('${finance}','Finance'),('${staff}','Staff'),('${manager}','Manager');
      insert into budget_workspaces values('${ws}','${owner}','business','active'),('${ws2}','${outsider}','business','active');
      insert into workspace_members values('${id(100)}','${ws}','${owner}','business_owner','active'),('${id(101)}','${ws}','${finance}','finance_manager','active'),
        ('${id(102)}','${ws}','${staff}','staff','active'),('${id(103)}','${ws}','${manager}','team_manager','active'),('${id(104)}','${ws2}','${outsider}','business_owner','active');
      insert into workspace_settings values('${ws}','USD',array['USD','ZAR'],'Africa/Johannesburg'),('${ws2}','USD',array['USD'],'UTC');
      insert into workspace_subscriptions values('${ws}','active',now()+interval '1 year'),('${ws2}','active',now()+interval '1 year');
      insert into business_profiles values('${ws}',20),('${ws2}',1);
      insert into business_categories values('${category}','${ws}','expense','active','Supplies'),('${id(21)}','${ws2}','expense','active','Other company');
      insert into business_dimensions values('${project}','${ws}','active','Branch A'),('${otherProject}','${ws}','active','Branch B');
      insert into business_member_scopes values('${ws}','${id(103)}','${project}');
      insert into business_suppliers(id,workspace_id,name,created_by) values('${supplier}','${ws}','Supplier','${owner}');
      insert into business_permission_definitions values('finance.view_all'),('finance.create'),('finance.record_payment'),('approvals.view'),('approvals.review'),('budgets.view'),('budgets.manage');
      insert into business_role_permissions(workspace_id,role,permission_code,enabled) select '${ws}',r,p,true
        from unnest(array['finance_manager']) r cross join unnest(array['finance.view_all','finance.create','finance.record_payment','approvals.view','approvals.review','budgets.view','budgets.manage']) p;
      insert into business_role_permissions values('${ws}','staff','finance.create',true,null),('${ws}','team_manager','approvals.view',true,null),
        ('${ws}','team_manager','approvals.review',true,null),('${ws}','team_manager','budgets.view',true,null),('${ws}','team_manager','budgets.manage',true,null);
    `);
    const asUser = async (uid) => db.query(`select set_config('fixture.uid',$1,false)`,[uid]);
    const rpc = async (name,args) => (await db.query(`select to_jsonb(public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})) as value`,args)).rows[0].value;
    const denied = async (name,args,error) => assert.rejects(rpc(name,args),new RegExp(error));

    await db.exec(`alter table budget_workspaces add column name text; update budget_workspaces set name='Fixture business'; create table business_documents(id uuid primary key default gen_random_uuid(),workspace_id uuid,parent_type text,parent_id uuid,status text);`);
    await db.exec(read('20260930073000_business_stage_9_reports.sql'));
    await db.exec(`insert into business_permission_definitions values('reports.view'),('reports.export');
      insert into business_role_permissions values('${ws}','finance_manager','reports.view',true,null),('${ws}','finance_manager','reports.export',true,null),
        ('${ws}','team_manager','reports.view',true,null),('${ws}','viewer','reports.view',true,null);
      insert into business_categories values('${id(22)}','${ws}','income','active','Sales');`);
    const incomeCategory=id(22);
    await asUser(owner);
    const received=async(n,title,amount,currency,dimension,date='2026-09-25')=>rpc('record_business_income',[ws,id(n),title,'Customer','receipt-'+n,'',incomeCategory,dimension,amount,currency,date,'cash']);
    await received(500,'Main sales',1000,'USD',project);
    await received(501,'Foreign sales',100,'ZAR',project);
    await received(502,'Branch B sales',500,'USD',otherProject);
    await received(503,'Untagged sale',50,'USD',null);
    const voided=await received(504,'Voided sale',999,'USD',project);
    await rpc('void_business_income',[ws,voided.id,'Recorded in error']);
    const claim=async(n,kind,amount,currency,status,dimension,expenseDate,paidAt,hasReceipt=false)=>{
      await db.query(`insert into business_expense_claims(id,workspace_id,kind,submitted_by,title,description,category_id,dimension_id,amount,currency,
        reporting_currency,reporting_amount,exchange_rate,rate_effective_at,rate_provider,expense_date,status,paid_by,paid_at,employee_payment_source,payment_source)
        values($1,$2,$3,$4,$5,'Fixture claim',$6,$7,$8,$9,'USD',$10,$11,'2026-09-20T00:00:00Z',$12,$13,$14,$15,$16,'cash','bank_transfer')`,
        [id(n),ws,kind,kind==='reimbursement'?staff:owner,'Claim '+n,category,dimension,amount,currency,amount*(currency==='USD'?1:2),currency==='USD'?1:2,
          currency==='USD'?'identity':'currencyapi',expenseDate,status,paidAt?owner:null,paidAt]);
      if(hasReceipt)await db.query(`insert into business_documents(workspace_id,parent_type,parent_id,status) values($1,'expense_claim',$2,'active')`,[ws,id(n)]);
    };
    await claim(600,'company_expense',30,'USD','paid',project,'2026-09-23','2026-09-25T09:00:00Z');
    await claim(601,'reimbursement',20,'ZAR','paid',project,'2026-09-22','2026-09-26T09:00:00Z',true);
    await claim(602,'reimbursement',15,'USD','approved',project,'2026-09-28',null);
    await claim(603,'reimbursement',10,'USD','submitted',project,'2026-09-28',null);
    await claim(604,'reimbursement',5,'USD','rejected',project,'2026-09-28',null);
    await claim(605,'company_expense',75,'USD','paid',otherProject,'2026-09-28','2026-09-28T09:00:00Z');
    await claim(606,'company_expense',90,'USD','approved',project,'2026-09-25',null);
    let bill=await rpc('create_business_bill',[ws,supplier,'Partly paid supplier','partial',category,project,100,'ZAR','2026-09-29',3,null,false]);
    await rpc('record_business_bill_payment_with_source',[ws,bill.id,id(700),40,'2026-09-27T22:30:00Z','partial payment','cash']);
    await db.query(`insert into business_documents(workspace_id,parent_type,parent_id,status) values($1,'business_bill',$2,'active')`,[ws,bill.id]);
    let linked=await rpc('save_business_spending_request',[ws,id(300),null,'Approved order','Needed for Branch A',category,project,50,'ZAR','2026-09-30']);
    linked=await rpc('transition_business_request',[ws,linked.id,linked.version,'submit',null]);
    let unlinked=await rpc('save_business_spending_request',[ws,id(301),null,'Unlinked request','Small Branch A purchase',category,project,25,'USD','2026-09-30']);
    unlinked=await rpc('transition_business_request',[ws,unlinked.id,unlinked.version,'submit',null]);
    await asUser(finance);
    linked=await rpc('transition_business_request',[ws,linked.id,linked.version,'approved',null]);
    await rpc('transition_business_request',[ws,unlinked.id,unlinked.version,'approved',null]);
    await rpc('create_business_bill_from_request',[ws,linked.id,supplier,'linked-request','2026-10-02',3]);
    await rpc('create_business_bill',[ws,supplier,'Linked company claim','linked-claim',category,project,90,'USD','2026-09-27',3,id(606),false]);
    const paidBill=await rpc('create_business_bill',[ws,supplier,'Fully paid supplier','fully-paid',category,project,20,'USD','2026-09-25',3,null,false]);
    await rpc('record_business_bill_payment_with_source',[ws,paidBill.id,id(701),20,'2026-09-25T09:00:00Z','fully paid','card']);
    await db.query(`insert into business_documents(workspace_id,parent_type,parent_id,status) values($1,'business_bill_payment',$2,'active')`,[ws,id(701)]);
    await rpc('create_business_bill',[ws,supplier,'Branch B bill','branch-b',category,otherProject,200,'USD','2026-09-25',3,null,false]);
    await asUser(owner);
    const companyBudget=id(200), branchBudget=id(201);
    await rpc('save_business_budget',[ws,companyBudget,null,'Whole workspace',null,null,'2026-09-20','2026-10-19','monthly',1000]);
    await rpc('transition_business_budget',[ws,companyBudget,1,'active',null]);
    await rpc('save_business_budget',[ws,branchBudget,null,'Branch A',category,project,'2026-09-20','2026-10-19','monthly',500]);
    await rpc('transition_business_budget',[ws,branchBudget,1,'active',null]);
    const filters=['2026-09-20','2026-10-19','reporting','',null,null];
    const report=(args=filters)=>rpc('business_report_summary',[ws,...args]);
    const sources=(r,section,extra=[])=>rpc('business_report_records',[ws,section,r.fingerprint,...filters,...extra]);
    const exportReport=(r,section='ledger',format='csv',args=filters,extra=[])=>rpc('business_report_export',[ws,section,r.fingerprint,id(900),'csv'===format?'csv':'print',...args,...extra]);
    let r=await report();
    assert.equal(Number(r.summary.income),1750);assert.equal(Number(r.summary.paid),245);assert.equal(Number(r.summary.committed),550);
    const billDates=['2026-09-29','2026-10-02','2026-09-27','2026-09-25'];
    assert.equal(r.summary.overdue_count,billDates.filter(date=>date<r.metadata.today).length);
    assert.equal(r.summary.due_count,billDates.filter(date=>date>=r.metadata.today).length);assert.equal(r.summary.missing_count,9);
    assert.equal(r.summary.claim_count,4);assert.equal(Number(r.summary.claimed),70);assert.equal(Number(r.summary.reimbursed),40);
    assert.equal(Number(r.summary.approved_reimbursements),15);
    assert.equal(r.budgets.length,2);assert.equal(Number(r.budgets.find(b=>b.id===branchBudget).paid),170);
    assert.equal(Number(r.budgets.find(b=>b.id===branchBudget).committed),350);
    const ledger=await sources(r,'ledger');assert.equal(ledger.total_count,15);
    assert.equal(ledger.items.some(row=>row.entry_key==='request:'+linked.id),false);
    assert.equal(ledger.items.some(row=>row.record_id===id(606)),false);
    const missing=await sources(r,'missing');assert.equal(missing.total_count,9);
    assert.ok(missing.items.some(row=>row.record_type==='bill_invoice' && row.record_id===paidBill.id));
    assert.ok(missing.items.some(row=>row.record_type==='bill_payment' && row.record_id===id(700)));
    const original=await report(['2026-09-20','2026-10-19','original','ZAR',null,null]);
    assert.equal(original.metadata.currency,'ZAR');assert.equal(Number(original.summary.income),100);
    assert.equal(Number(original.summary.paid),60);assert.equal(Number(original.summary.committed),110);assert.deepEqual(original.budgets,[]);
    await denied('business_report_summary',[ws,...['2026-09-20','2026-10-19','original','',null,null]],'INVALID_BUSINESS_REPORT_FILTER');
    const boundary=await report(['2026-09-28','2026-09-28','reporting','',null,null]);
    assert.equal(Number(boundary.summary.paid),155);assert.equal(Number(boundary.summary.committed),15);
    assert.equal(Number(boundary.budgets.find(b=>b.id===branchBudget).paid),80);
    const scopedSources=await sources(r,'paid',['dimension',project,null,0,1]);
    assert.equal(scopedSources.total_count,4);assert.equal(scopedSources.items.length,1);assert.equal(Number(scopedSources.totals.paid),170);
    const noTag=await sources(r,'income',['dimension',null,null,0,50]);assert.equal(noTag.total_count,1);assert.equal(Number(noTag.totals.income),50);
    const budgetSources=await sources(r,'budget_activity',['',null,branchBudget]);
    assert.equal(Number(budgetSources.totals.paid),170);assert.equal(Number(budgetSources.totals.committed),350);
    const plan=await sources(r,'budget_plan',['',null,branchBudget]);assert.equal(plan.items.length,1);assert.equal(Number(plan.items[0].original_amount),500);
    const exported=await exportReport(r);assert.equal(exported.total_count,15);assert.equal(exported.csv.split('\r\n').length,17);
    const printed=await exportReport(r,'ledger','print');assert.equal(printed.items.length,15);assert.equal(printed.summary.paid,r.summary.paid);
    assert.equal((await db.query(`select count(*)::int as count from business_audit_events where action='report.exported' and request_id=$1`,[id(900)])).rows[0].count,1);
    await db.exec(`create or replace function public.latest_exchange_rate(text,text,timestamptz)
      returns table(exchange_rate numeric,rate_effective_at timestamptz,provider text) language sql stable as $$select 7::numeric,$3,'currencyapi'::text$$;`);
    assert.equal((await report()).fingerprint,r.fingerprint);
    await db.query('update business_income_receipts set title=$1 where id=$2',[' =HYPERLINK("evil","click"),\nQuoted',id(500)]);
    await denied('business_report_records',[ws,'income',r.fingerprint,...filters],'BUSINESS_REPORT_CHANGED');
    await denied('business_report_export',[ws,'ledger',r.fingerprint,id(901),'csv',...filters],'BUSINESS_REPORT_CHANGED');
    r=await report();const csv=(await exportReport(r)).csv;
    assert.ok(csv.includes('"\' =HYPERLINK(""evil"",""click""),\nQuoted"'));
    const cell=(await db.query(`select business_report_csv_cell($1) as value`,['\t=SUM(A1)'])).rows[0].value;
    assert.equal(cell,'"\'\t=SUM(A1)"');
    await asUser(manager);r=await report();assert.equal(r.metadata.access,'assigned_scopes');
    assert.equal(Number(r.summary.income),1200);assert.equal(Number(r.summary.paid),170);assert.equal(Number(r.summary.committed),350);
    assert.equal(r.summary.missing_count,7);assert.deepEqual(r.budgets.map(b=>b.id),[branchBudget]);
    assert.equal((await sources(r,'income')).items.every(row=>row.dimension_id===project),true);
    assert.equal((await sources(r,'income')).items.every(row=>!row.can_open),true);
    await denied('business_report_export',[ws,'ledger',r.fingerprint,id(901),'csv',...filters],'BUSINESS_REPORT_EXPORT_REQUIRED');
    await asUser(owner);await db.query('delete from business_member_scopes where workspace_id=$1 and member_id=$2',[ws,id(103)]);
    await asUser(manager);await denied('business_report_records',[ws,'income',r.fingerprint,...filters],'BUSINESS_REPORT_CHANGED');
    assert.equal(Number((await report()).summary.income),0);
    await asUser(staff);await denied('business_report_summary',[ws,...filters],'BUSINESS_REPORT_ACCESS_REQUIRED');
    await asUser(owner);await rpc('set_business_workflow_permission',[ws,'staff','reports.view',true]);
    await rpc('set_business_workflow_permission',[ws,'staff','budgets.view',true]);
    await db.exec(`insert into business_member_scopes values('${ws}','${id(102)}','${project}');
      insert into business_member_permissions values('${ws}','${id(102)}','finance.view_all','allow',null);`);
    await asUser(staff);r=await report();assert.equal(r.metadata.access,'own_records');
    assert.equal(Number(r.summary.income),0);assert.equal(Number(r.summary.paid),40);assert.equal(Number(r.summary.committed),15);
    assert.equal((await sources(r,'ledger')).items.every(row=>['reimbursement'].includes(row.record_type)),true);
    assert.deepEqual(r.budgets,[]);
    await denied('set_business_workflow_permission',[ws,'staff','reports.export',true],'BUSINESS_OWNER_REQUIRED');
    await asUser(outsider);await denied('business_report_summary',[ws,...filters],'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED');
    await asUser(owner);r=await report();
    await db.exec(`select set_config('fixture.suspended','true',false)`);
    await denied('business_report_export',[ws,'ledger',r.fingerprint,id(901),'csv',...filters],'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED');
    await db.exec(`select set_config('fixture.suspended','false',false);update workspace_subscriptions set paid_through_at=now()-interval '1 day' where workspace_id='${ws}'`);
    await denied('business_report_records',[ws,'paid',r.fingerprint,...filters],'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED');
    await db.exec(`update workspace_subscriptions set paid_through_at=now()+interval '1 year' where workspace_id='${ws}';set role authenticated;`);
    await denied('business_report_rows',[ws,...filters],'permission denied');await denied('business_report_data',[ws,...filters],'permission denied');
    await denied('business_report_selection',[{},'ledger','',null,null],'permission denied');
    await db.exec('reset role');
    const pageFilters=['2025-01-01','2025-01-01','reporting','',null,null];
    const bulkIncome=async count=>db.query(`insert into business_income_receipts
      (id,workspace_id,title,reference,category_id,amount,currency,reporting_currency,reporting_amount,exchange_rate,rate_effective_at,rate_provider,received_on,payment_source,recorded_by)
      select gen_random_uuid(),$1,'Pagination '||n,'page-'||n,$2,2,'USD','USD',2,1,'2025-01-01'::timestamptz,'identity','2025-01-01'::date,'cash',$3
      from generate_series(1,$4::integer) n`,[ws,incomeCategory,owner,count]);
    await bulkIncome(70);r=await report(pageFilters);
    const paged=await rpc('business_report_records',[ws,'income',r.fingerprint,...pageFilters,'',null,null,50,50]);
    assert.equal(paged.items.length,20);assert.equal(paged.total_count,70);assert.equal(Number(paged.totals.income),140);
    const allPages=await exportReport(r,'income','csv',pageFilters);assert.equal(allPages.total_count,70);assert.equal(allPages.csv.split('\r\n').length,72);
    await bulkIncome(10001);r=await report(pageFilters);
    await denied('business_report_export',[ws,'income',r.fingerprint,id(902),'csv',...pageFilters],'BUSINESS_REPORT_EXPORT_TOO_LARGE');
    await db.exec(`create function public.product_customer_purchase_enabled(text) returns boolean language sql as $$select false$$;
      create function public.product_customer_workspace_creation_enabled(text) returns boolean language sql as $$select false$$;
      create table public.plans(workspace_type text,available_for_purchase boolean);`);
    const diagnostic=await db.query(readFileSync(path.join(root,'supabase/diagnostics/business_stage_9_reports_diagnostic.sql'),'utf8'));
    assert.equal(diagnostic.rows.length,20);assert.deepEqual(diagnostic.rows.filter(row=>row.status!=='PASS'),[]);
    console.log('PASS: Stage 9 actual SQL: mixed currencies, income/paid/commitments, linked exclusions, partial bills, timezone dates, budget targets, receipt checks, exact sources, groups/null tags, CSV/print snapshots, formula escaping, export audits, role/scope/Staff privacy, stale data, expiry/suspension and internal RPC restrictions.');
  } finally { await db.close(); }
})().catch(error=>{ console.error(error.message,error.detail||'',error.hint||'');process.exitCode=1; });
