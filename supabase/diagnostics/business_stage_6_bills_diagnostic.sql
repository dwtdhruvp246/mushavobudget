-- Read-only Stage 6 checks. Run after both Stage 6 migrations.
-- One result table ensures Supabase shows every check together.
with table_checks as (
  select 'Table: ' || e.name as check_name,
    case when c.oid is not null and c.relrowsecurity and c.relforcerowsecurity
      and has_table_privilege('authenticated','public.'||e.name,'SELECT')
      and not has_table_privilege('authenticated','public.'||e.name,'INSERT,UPDATE,DELETE')
      then 'PASS' else 'FAIL' end as status
  from (values ('business_suppliers'),('business_bill_schedules'),
    ('business_bills'),('business_bill_payments')) e(name)
  left join pg_class c on c.oid=to_regclass('public.'||e.name)
), rpc_checks as (
  select 'RPC: ' || e.signature as check_name,
    case when to_regprocedure('public.'||e.signature) is not null
      and has_function_privilege('authenticated','public.'||e.signature,'EXECUTE')
      then 'PASS' else 'FAIL' end as status
  from (values
    ('save_business_supplier(uuid,uuid,text,text,text,integer)'),
    ('create_business_bill(uuid,uuid,text,text,uuid,uuid,numeric,text,date,integer,uuid,boolean)'),
    ('create_business_bill_schedule(uuid,uuid,text,uuid,uuid,numeric,text,text,integer,date,date,integer)'),
    ('stop_business_bill_schedule(uuid,uuid)'),('cancel_business_bill(uuid,uuid)'),
    ('record_business_bill_payment(uuid,uuid,uuid,numeric,timestamptz,text)'),
    ('business_bill_summary(uuid)')) e(signature)
), fixed_checks as (
  select * from (values
    ('Service-only generators and reminder validation', case when
      not has_function_privilege('authenticated','public.generate_business_bill_occurrences(date,uuid)','EXECUTE')
      and not has_function_privilege('authenticated','public.enqueue_due_business_bill_reminders(timestamptz)','EXECUTE')
      and not has_function_privilege('authenticated','public.business_bill_reminder_allowed(uuid,uuid)','EXECUTE')
      then 'PASS' else 'FAIL' end),
    ('Anchored month ends: Jan 31 to Feb 28 to Mar 31', case when
      public.business_bill_occurrence_date(date '2026-01-31','monthly',1,1)=date '2026-02-28'
      and public.business_bill_occurrence_date(date '2026-01-31','monthly',1,2)=date '2026-03-31'
      and public.business_bill_occurrence_date(date '2024-02-29','yearly',1,1)=date '2025-02-28'
      then 'PASS' else 'FAIL' end),
    ('Bill and payment workspace foreign keys', case when
      (select count(*) from pg_constraint where connamespace='public'::regnamespace
        and conname in ('business_bill_supplier_fk','business_bill_schedule_fk',
          'business_bill_category_fk','business_bill_dimension_fk','business_bill_claim_fk',
          'business_bill_payment_bill_fk'))=6 then 'PASS' else 'FAIL' end),
    ('Bill proof and reminder constraints', case when
      exists(select 1 from pg_constraint where conname='business_documents_parent_type_check'
        and pg_get_constraintdef(oid) like '%business_bill_payment%')
      and exists(select 1 from pg_constraint where conname='notification_outbox_target_url_check'
        and pg_get_constraintdef(oid) like '%payment_item%' and pg_get_constraintdef(oid) like '%business%')
      and exists(select 1 from pg_trigger where tgname='guard_linked_claim_payment_trigger' and not tgisinternal)
      and exists(select 1 from pg_trigger where tgname='guard_business_bill_proof_archive_trigger' and not tgisinternal)
      then 'PASS' else 'FAIL' end),
    ('Business customer checkout and workspace creation remain closed', case when
      not public.product_customer_purchase_enabled('business')
      and not public.product_customer_workspace_creation_enabled('business')
      and not exists(select 1 from public.plans
        where workspace_type='business' and available_for_purchase=true)
      then 'PASS' else 'FAIL' end)
  ) checks(check_name,status)
)
select check_name,status from table_checks
union all select check_name,status from rpc_checks
union all select check_name,status from fixed_checks
order by check_name;
