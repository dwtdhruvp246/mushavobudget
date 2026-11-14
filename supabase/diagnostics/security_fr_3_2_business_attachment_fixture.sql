-- Staging only. Seed reversible draft and unpaid bill fixtures before browser acceptance.
begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
set local statement_timeout='20s';
select pg_advisory_xact_lock(20261017,2411);
do $fixture$
declare touched integer;
begin
 if not exists(select 1 from mushavo_email_install.rollout_control where singleton and mode='ACTIVE'
      and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='7b73854582a28b5f71739dddc1266c14e74a2e1abcf4c95ca22267949ebedae8' and catalog_sha256=mushavo_email_install.catalog_identity())
    or not exists(select 1 from public.budget_workspaces where id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'
      and name='audit-fr3-logo-ingestion-20261112' and status='suspended' and business_support_version=30)
    or exists(select 1 from public.business_expense_claims where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2')
    or exists(select 1 from public.business_bills where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2')
    or exists(select 1 from public.business_suppliers where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2')
    or exists(select 1 from public.business_documents where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and status='active')
    or exists(select 1 from storage.objects where bucket_id='business-documents' and name like 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/%')
 then raise exception 'EXACT_BROWSER_FIXTURE_BASELINE_REQUIRED'; end if;
 update public.workspace_subscriptions set paid_through_at='2026-11-14 16:23:55.969909+00'::timestamptz
 where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and plan_id='0ccf35bb-43c7-4c1b-9148-0f352b85bd2a' and status='active' and version=1 and member_limit=1
   and paid_through_at='2026-11-14T00:00:00+00:00'::timestamptz and updated_at='2026-11-12T18:32:58.996201+00:00'::timestamptz;
 get diagnostics touched=row_count;
 if touched<>1 then raise exception 'EXACT_BROWSER_FIXTURE_TERM_REQUIRED'; end if;
 insert into public.business_suppliers(id,workspace_id,name,created_by)
 values('ae0dbe86-b43f-47ef-b5a4-fe5267c22bb5','8d9307e6-aada-4c9a-a8f5-43c57e0865e2','FR3 synthetic attachment supplier','ca7bdcf2-e69d-42e2-8ae8-79cac6de2184');
 insert into public.business_expense_claims(id,workspace_id,submitted_by,kind,title,category_id,amount,currency,
    reporting_currency,reporting_amount,exchange_rate,rate_effective_at,rate_provider,expense_date)
 values('454e6059-4b4c-4998-aa9d-ea932b15ca50','8d9307e6-aada-4c9a-a8f5-43c57e0865e2','ca7bdcf2-e69d-42e2-8ae8-79cac6de2184','company_expense','FR3 synthetic claim receipt','30e26d05-6db0-4e24-a009-bde0db05a7fb',
    1,'USD','USD',1,1,clock_timestamp(),'identity',current_date);
 insert into public.business_bills(id,workspace_id,supplier_id,title,category_id,amount,currency,reporting_currency,
    reporting_amount,exchange_rate,rate_effective_at,rate_provider,due_on,remind_days_before,created_by)
 values('ac975ebd-b138-40c4-a082-c6e62670a98a','8d9307e6-aada-4c9a-a8f5-43c57e0865e2','ae0dbe86-b43f-47ef-b5a4-fe5267c22bb5','FR3 synthetic unpaid bill proof','30e26d05-6db0-4e24-a009-bde0db05a7fb',
    1,'USD','USD',1,1,clock_timestamp(),'identity',current_date+21,0,'ca7bdcf2-e69d-42e2-8ae8-79cac6de2184');
end;
$fixture$;
commit;
