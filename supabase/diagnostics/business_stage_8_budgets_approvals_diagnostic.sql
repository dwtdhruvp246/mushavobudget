-- Read-only. Run after the Stage 8 migration. Expect all 26 rows to be PASS.
with rpc_checks as (
  select 'RPC: '||e.signature as check_name,
    case when p.oid is not null and p.prosecdef
      and p.proconfig @> array['search_path=public, pg_temp']
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not has_function_privilege('anon',p.oid,'EXECUTE')
      then 'PASS' else 'FAIL' end as status
  from (values
    ('business_budget_scope(uuid,uuid)'),('business_can_view_budget(uuid,uuid)'),
    ('business_can_view_request(uuid,uuid)'),
    ('save_business_budget(uuid,uuid,integer,text,uuid,uuid,date,date,text,numeric)'),
    ('transition_business_budget(uuid,uuid,integer,text,text)'),
    ('save_business_spending_request(uuid,uuid,integer,text,text,uuid,uuid,numeric,text,date)'),
    ('transition_business_request(uuid,uuid,integer,text,text)'),
    ('create_business_bill_from_request(uuid,uuid,uuid,text,date,integer)'),
    ('business_request_feed(uuid,text,text,integer,integer)'),('business_request_detail(uuid,uuid)'),
    ('business_budget_feed(uuid,text,integer,integer)'),('business_budget_detail(uuid,uuid,integer,integer)'),
    ('set_business_workflow_permission(uuid,text,text,boolean)')
  ) e(signature) left join pg_proc p on p.oid=to_regprocedure('public.'||e.signature)
), fixed_checks as (
  select * from (values
    ('Budget table: forced RLS and read-only client access', case when exists(select 1 from pg_class c
      where c.oid=to_regclass('public.business_budgets') and c.relrowsecurity and c.relforcerowsecurity
        and has_table_privilege('authenticated',c.oid,'SELECT')
        and not has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE')
        and not has_table_privilege('anon',c.oid,'SELECT')) then 'PASS' else 'FAIL' end),
    ('Request table: forced RLS and read-only client access', case when exists(select 1 from pg_class c
      where c.oid=to_regclass('public.business_spending_requests') and c.relrowsecurity and c.relforcerowsecurity
        and has_table_privilege('authenticated',c.oid,'SELECT')
        and not has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE')
        and not has_table_privilege('anon',c.oid,'SELECT')) then 'PASS' else 'FAIL' end),
    ('Category, tag and bill links stay within the workspace', case when
      (select count(*) from pg_constraint where connamespace='public'::regnamespace and contype='f'
        and conname in ('business_budget_category_fk','business_budget_dimension_fk',
          'business_request_category_fk','business_request_dimension_fk','business_bill_request_fk'))=5
      then 'PASS' else 'FAIL' end),
    ('Both planning tables have suspended-account write guards', case when
      (select count(*) from pg_trigger where tgrelid in (to_regclass('public.business_budgets'),to_regclass('public.business_spending_requests'))
        and tgname='guard_suspended_account_write_trigger' and not tgisinternal)=2
      then 'PASS' else 'FAIL' end),
    ('Read policies use scoped budget and request permission checks', case when
      (select count(*) from pg_policies where schemaname='public' and
        ((tablename='business_budgets' and qual like '%business_can_view_budget%')
          or (tablename='business_spending_requests' and qual like '%business_can_view_request%')))=2
      then 'PASS' else 'FAIL' end),
    ('One non-cancelled bill per request', case when exists(select 1 from pg_index i
      where i.indexrelid=to_regclass('public.business_bill_request_active_idx') and i.indisunique
        and pg_get_expr(i.indpred,i.indrelid) like '%source_request_id IS NOT NULL%'
        and pg_get_expr(i.indpred,i.indrelid) like '%cancelled%') then 'PASS' else 'FAIL' end),
    ('A bill cannot link to both a claim and a request', case when exists(select 1 from pg_constraint
      where conrelid=to_regclass('public.business_bills') and conname='business_bill_single_source' and contype='c')
      then 'PASS' else 'FAIL' end),
    ('Bill link validation and request state synchronization triggers exist', case when
      (select count(*) from pg_trigger where tgrelid=to_regclass('public.business_bills') and not tgisinternal
        and tgname in ('guard_business_request_bill_link_trigger','sync_business_request_bill_state_trigger'))=2
      then 'PASS' else 'FAIL' end),
    ('Review requires another authorized member and a decision reason', case when exists(select 1 from pg_proc
      where oid=to_regprocedure('public.transition_business_request(uuid,uuid,integer,text,text)')
        and prosrc like '%BUSINESS_SELF_APPROVAL_FORBIDDEN%' and prosrc like '%approvals.review%'
        and prosrc like '%BUSINESS_DECISION_REASON_REQUIRED%' and prosrc like '%business_claim_in_scope%')
      then 'PASS' else 'FAIL' end),
    ('Linked bill preserves the approved request conversion snapshot', case when exists(select 1 from pg_proc
      where oid=to_regprocedure('public.create_business_bill_from_request(uuid,uuid,uuid,text,date,integer)')
        and prosrc like '%exchange_rate=v_request.exchange_rate%'
        and prosrc like '%reporting_amount=v_request.reporting_amount%'
        and prosrc like '%rate_effective_at=v_request.rate_effective_at%') then 'PASS' else 'FAIL' end),
    ('Internal budget and transaction rows are not callable by clients', case when
      (select count(*) from pg_proc where oid in (to_regprocedure('public.business_budget_rows(uuid,uuid)'),
        to_regprocedure('public.business_budget_totals(uuid,uuid)'),to_regprocedure('public.business_transaction_rows(uuid)'))
        and not has_function_privilege('authenticated',oid,'EXECUTE')
        and not has_function_privilege('anon',oid,'EXECUTE'))=3 then 'PASS' else 'FAIL' end),
    ('Reporting currency lock includes budgets and requests', case when exists(select 1 from pg_proc
      where oid=to_regprocedure('public.lock_business_claim_reporting_currency()')
        and prosrc like '%business_budgets%' and prosrc like '%business_spending_requests%')
      then 'PASS' else 'FAIL' end),
    ('Business customer purchase remains closed', case when
      not public.product_customer_purchase_enabled('business')
      and not public.product_customer_workspace_creation_enabled('business')
      and not exists(select 1 from public.plans where workspace_type='business' and available_for_purchase=true)
      then 'PASS' else 'FAIL' end)
  ) checks(check_name,status)
)
select * from rpc_checks union all select * from fixed_checks order by check_name;
