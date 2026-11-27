-- Close the isolated scheduled test and preserve the existing bill-payment proof.
begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
select pg_advisory_xact_lock(20261017,2411);
do $restore$
declare touched integer;
begin
 if not exists(select 1 from mushavo_email_install.rollout_control where singleton and mode='ACTIVE'
  and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='116c02342531453cc20286196121730dbb8ce9e64c70396f28192ad5c90f447d' and catalog_sha256=mushavo_email_install.catalog_identity())
 or not exists(select 1 from public.budget_workspaces where id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'
  and status='suspended' and business_support_version in (50,52))
 or not exists(select 1 from public.business_documents d join storage.objects o on o.name=d.storage_path and o.bucket_id='business-documents'
   where d.id='ef6fb184-5e10-44b8-9d8a-a4ed532733c7' and d.workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and d.parent_id='89fd5fb1-d177-4c3a-ad7a-3ba4ec34a120' and d.status='active')
 or exists(select 1 from storage.objects where bucket_id='business-documents'
   and name like 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/%' and not starts_with(name,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/ef6fb184-5e10-44b8-9d8a-a4ed532733c7/'))
 or public.fr3_lifecycle_trial_ready()
 then raise exception 'EXACT_SCHEDULER_RETRY_RESTORE_REQUIRED'; end if;
 update mushavo_file_ingest.workspace_limits set enabled=false where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and enabled;
 get diagnostics touched=row_count;
 if touched<>1 then raise exception 'EXACT_RETRY_DISABLE_REQUIRED'; end if;
 update public.workspace_subscriptions set paid_through_at='2026-11-14 00:00:00+00'
   where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and status='active' and version=1 and member_limit=1 and paid_through_at='2026-11-15 10:17:50.773535+00'::timestamptz;
 get diagnostics touched=row_count;
 if touched<>1 then raise exception 'EXACT_RETRY_TERM_RESTORE_REQUIRED'; end if;
end;
$restore$;
commit;
