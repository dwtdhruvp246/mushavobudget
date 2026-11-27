-- Staging only. Disable the isolated trial and restore its original subscription.
begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
select pg_advisory_xact_lock(20261017,2411);
do $close$
declare touched integer;
begin
 if not exists(select 1 from mushavo_email_install.rollout_control where singleton and mode='ACTIVE'
   and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='701b195780b6b7ac2c4b8b88f214ed049f5d7353688782364304c3488261fc3e' and catalog_sha256=mushavo_email_install.catalog_identity())
   or not exists(select 1 from public.budget_workspaces where id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'
     and name='audit-fr3-logo-ingestion-20261112' and status='suspended' and business_support_version in (44,46))
   or exists(select 1 from public.business_documents where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and status='active')
   or exists(select 1 from storage.objects where bucket_id='business-documents' and name like 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/%')
   or public.fr3_lifecycle_trial_ready()
 then raise exception 'EXACT_LIFECYCLE_TRIAL_CLOSED_STATE_REQUIRED'; end if;

 update mushavo_file_ingest.workspace_limits set enabled=false
 where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and enabled and max_files=1 and max_bytes=2097152 and max_in_flight=1 and reservation_ttl_seconds=40;
 get diagnostics touched=row_count;
 if touched<>1 then raise exception 'EXACT_LIFECYCLE_LIMIT_RESTORE_REQUIRED'; end if;

 update public.workspace_subscriptions set paid_through_at='2026-11-14T00:00:00+00:00'::timestamptz
 where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and plan_id='0ccf35bb-43c7-4c1b-9148-0f352b85bd2a' and version=1 and member_limit=1 and status='active'
   and paid_through_at='2026-11-15 09:09:16.597707+00'::timestamptz and updated_at='2026-11-12T18:32:58.996201+00:00';
 get diagnostics touched=row_count;
 if touched<>1 then raise exception 'EXACT_LIFECYCLE_TERM_RESTORE_REQUIRED'; end if;
end;
$close$;
commit;
