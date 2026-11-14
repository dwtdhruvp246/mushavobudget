-- Staging only. Restore authorization and subscription while retaining the isolated draft records for review.
begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
select pg_advisory_xact_lock(20261017,2411);
do $restore$
declare touched integer;
begin
 if not exists(select 1 from mushavo_email_install.rollout_control where singleton and mode='ACTIVE'
      and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='f83f228aae8623200b4fcf90aa9d5b695f39d37b1f29d729d66bc6c8b36c5797' and catalog_sha256=mushavo_email_install.catalog_identity())
    or not exists(select 1 from public.budget_workspaces where id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'
      and name='audit-fr3-logo-ingestion-20261112' and status='suspended' and business_support_version in (42,44))
    or exists(select 1 from public.business_documents where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and status='active')
    or not exists(select 1 from public.business_documents where id='7d488239-ba6e-440e-8be1-5e255b2ead79' and workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and status='archived')
    or exists(select 1 from storage.objects where bucket_id='business-documents' and name like 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/%')
    or exists(select 1 from public.business_bill_payments where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2')
 then raise exception 'EXACT_BROWSER_FIXTURE_RESTORE_REQUIRED'; end if;
 update public.business_profiles set onboarding_status='in_progress'
  where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and trading_name='audit-fr3-logo-ingestion-20261112'
    and onboarding_status='complete' and version=20;
 get diagnostics touched=row_count;
 if touched<>1 then raise exception 'EXACT_BROWSER_ONBOARDING_RESTORE_REQUIRED'; end if;
 update public.workspace_subscriptions set paid_through_at='2026-11-14T00:00:00+00:00'::timestamptz
  where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and plan_id='0ccf35bb-43c7-4c1b-9148-0f352b85bd2a' and status='active' and version=1 and member_limit=1
    and paid_through_at='2026-11-14 16:22:12.821429+00'::timestamptz and updated_at='2026-11-12T18:32:58.996201+00:00'::timestamptz;
 get diagnostics touched=row_count;
 if touched<>1 then raise exception 'EXACT_BROWSER_TERM_RESTORE_REQUIRED'; end if;
end;
$restore$;
commit;
