-- Read-only Stage 6 checks. Run in Supabase SQL Editor after the migration.
with expected(name) as (values
  ('business_suppliers'),('business_bill_schedules'),('business_bills'),('business_bill_payments')
), actual as (
  select e.name,c.oid,c.relrowsecurity,c.relforcerowsecurity
  from expected e left join pg_class c on c.oid=to_regclass('public.'||e.name)
)
select name,case when oid is not null and relrowsecurity and relforcerowsecurity
  and has_table_privilege('authenticated','public.'||name,'SELECT')
  and not has_table_privilege('authenticated','public.'||name,'INSERT,UPDATE,DELETE')
  then 'PASS' else 'FAIL' end as status
from actual;

with expected(signature) as (values
  ('save_business_supplier(uuid,uuid,text,text,text,integer)'),
  ('create_business_bill(uuid,uuid,text,text,uuid,uuid,numeric,text,date,integer,uuid,boolean)'),
  ('create_business_bill_schedule(uuid,uuid,text,uuid,uuid,numeric,text,text,integer,date,date,integer)'),
  ('stop_business_bill_schedule(uuid,uuid)'),('cancel_business_bill(uuid,uuid)'),
  ('record_business_bill_payment(uuid,uuid,uuid,numeric,timestamptz,text)'),
  ('business_bill_summary(uuid)')
)
select signature,case when to_regprocedure('public.'||signature) is not null
  and has_function_privilege('authenticated','public.'||signature,'EXECUTE')
  then 'PASS' else 'FAIL' end as status from expected;

select 'Service-only generators and reminder validation' as check_name,
  case when not has_function_privilege('authenticated',
    'public.generate_business_bill_occurrences(date,uuid)','EXECUTE')
    and not has_function_privilege('authenticated',
    'public.enqueue_due_business_bill_reminders(timestamptz)','EXECUTE')
    and not has_function_privilege('authenticated',
    'public.business_bill_reminder_allowed(uuid,uuid)','EXECUTE')
    then 'PASS' else 'FAIL' end as status;

select 'Anchored month ends: Jan 31 to Feb 28 to Mar 31' as check_name,
  case when public.business_bill_occurrence_date(date '2026-01-31','monthly',1,1)=date '2026-02-28'
    and public.business_bill_occurrence_date(date '2026-01-31','monthly',1,2)=date '2026-03-31'
    and public.business_bill_occurrence_date(date '2024-02-29','yearly',1,1)=date '2025-02-28'
    then 'PASS' else 'FAIL' end as status;

select 'Bill and payment workspace foreign keys' as check_name,
  case when (select count(*) from pg_constraint where connamespace='public'::regnamespace
    and conname in ('business_bill_supplier_fk','business_bill_schedule_fk',
      'business_bill_category_fk','business_bill_dimension_fk','business_bill_claim_fk',
      'business_bill_payment_bill_fk'))=6
    then 'PASS' else 'FAIL' end as status;

select 'Bill proof and reminder constraints' as check_name,
  case when exists(select 1 from pg_constraint where conname='business_documents_parent_type_check'
    and pg_get_constraintdef(oid) like '%business_bill_payment%')
    and exists(select 1 from pg_constraint where conname='notification_outbox_target_url_check'
      and pg_get_constraintdef(oid) like '%business%')
    and exists(select 1 from pg_trigger where tgname='guard_linked_claim_payment_trigger'
      and not tgisinternal)
    and exists(select 1 from pg_trigger where tgname='guard_business_bill_proof_archive_trigger'
      and not tgisinternal)
    then 'PASS' else 'FAIL' end as status;

select 'Billing still closed to public checkout' as check_name,
  case when not exists(select 1 from public.plans where code like 'business%'
    and is_public=true) then 'PASS' else 'REVIEW' end as status;
