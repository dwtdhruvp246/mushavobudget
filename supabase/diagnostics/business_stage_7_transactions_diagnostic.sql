-- Read-only: run after the Stage 7 migration. Expect every row to be PASS.
with rpc_checks as (
  select 'RPC: '||e.signature as check_name,
    case when p.oid is not null and p.prosecdef
      and p.proconfig @> array['search_path=public, pg_temp']
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not has_function_privilege('anon',p.oid,'EXECUTE')
      then 'PASS' else 'FAIL' end as status
  from (values
    ('record_business_income(uuid,uuid,text,text,text,text,uuid,uuid,numeric,text,date,text)'),
    ('void_business_income(uuid,uuid,text)'),
    ('save_business_expense_entry(uuid,uuid,integer,text,text,text,uuid,uuid,numeric,text,date,text)'),
    ('record_business_claim_payment_with_source(uuid,uuid,integer,timestamptz,text,text)'),
    ('record_business_bill_payment_with_source(uuid,uuid,uuid,numeric,timestamptz,text,text)'),
    ('business_transaction_feed(uuid,text,text,text,text,uuid,uuid,date,date,text,integer,integer)')
  ) e(signature) left join pg_proc p on p.oid=to_regprocedure('public.'||e.signature)
), fixed_checks as (
  select * from (values
    ('Income table: forced RLS and read-only client access', case when exists(
      select 1 from pg_class c where c.oid=to_regclass('public.business_income_receipts')
        and c.relrowsecurity and c.relforcerowsecurity
        and has_table_privilege('authenticated',c.oid,'SELECT')
        and not has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE')
        and not has_table_privilege('anon',c.oid,'SELECT')) then 'PASS' else 'FAIL' end),
    ('Income workspace foreign keys and void reason', case when
      (select count(*) from pg_constraint where conrelid=to_regclass('public.business_income_receipts')
        and conname in ('business_income_category_fk','business_income_dimension_fk','business_income_void_state'))=3
      then 'PASS' else 'FAIL' end),
    ('Income suspended-account write guard', case when exists(select 1 from pg_trigger
      where tgrelid=to_regclass('public.business_income_receipts')
        and tgname='guard_suspended_account_write_trigger' and not tgisinternal)
      then 'PASS' else 'FAIL' end),
    ('Income read policy follows scoped permissions', case when exists(select 1 from pg_policies
      where schemaname='public' and tablename='business_income_receipts'
        and qual like '%business_can_view_income%') then 'PASS' else 'FAIL' end),
    ('Funding columns: claims and bill payments', case when (select count(*) from information_schema.columns
      where table_schema='public' and ((table_name='business_expense_claims' and column_name in ('employee_payment_source','payment_source'))
        or (table_name='business_bill_payments' and column_name='payment_source')) and is_nullable='NO')=3
      then 'PASS' else 'FAIL' end),
    ('Internal ledger is not callable by clients', case when exists(select 1 from pg_proc
      where oid=to_regprocedure('public.business_transaction_rows(uuid)')
        and not has_function_privilege('authenticated',oid,'EXECUTE')
        and not has_function_privilege('anon',oid,'EXECUTE')) then 'PASS' else 'FAIL' end),
    ('Reporting currency lock includes income and bills', case when exists(select 1 from pg_proc
      where oid=to_regprocedure('public.lock_business_claim_reporting_currency()')
        and prosrc like '%business_income_receipts%' and prosrc like '%business_bills%'
        and prosrc like '%business_bill_schedules%') then 'PASS' else 'FAIL' end),
    ('Ledger excludes linked claims and voided actuals', case when exists(select 1 from pg_proc
      where oid=to_regprocedure('public.business_transaction_rows(uuid)')
        and prosrc like '%source_claim_id=c.id%' and prosrc like '%status=''received''%'
        and prosrc like '%status=''paid''%') then 'PASS' else 'FAIL' end),
    ('Staff totals are hidden by the server', case when exists(select 1 from pg_proc
      where oid=to_regprocedure('public.business_transaction_feed(uuid,text,text,text,text,uuid,uuid,date,date,text,integer,integer)')
        and prosrc like '%finance.view_all%' and prosrc like '%else null end%') then 'PASS' else 'FAIL' end),
    ('Business customer purchase remains closed', case when
      not public.product_customer_purchase_enabled('business')
      and not public.product_customer_workspace_creation_enabled('business')
      and not exists(select 1 from public.plans where workspace_type='business' and available_for_purchase=true)
      then 'PASS' else 'FAIL' end)
  ) checks(check_name,status)
)
select check_name,status from rpc_checks union all select check_name,status from fixed_checks order by check_name;
