-- Staging only. Close the scheduled/egress test window and restore the original term.
begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
select pg_advisory_xact_lock(20261017,2411);
do $restore$
declare touched integer;
begin
 if not exists(select 1 from mushavo_email_install.rollout_control where singleton and mode='ACTIVE'
  and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='93d03fb064a2954fd717e26f78c9d36c1a5fd9628c33fb63586b09413619cad6' and catalog_sha256=mushavo_email_install.catalog_identity())
 or not exists(select 1 from public.budget_workspaces w where w.id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and w.owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'
  and w.name='audit-fr3-logo-ingestion-20261112' and w.status='suspended' and w.business_support_version in (46,48))
 or exists(select 1 from public.business_documents where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and status='active')
 or exists(select 1 from storage.objects where bucket_id='business-documents' and name like 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/%')
 or public.fr3_lifecycle_trial_ready() then raise exception 'EXACT_SCHEDULED_TRIAL_RESTORE_REQUIRED'; end if;
 update mushavo_file_ingest.workspace_limits set enabled=false where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and enabled;
 get diagnostics touched=row_count;
 if touched<>1 then raise exception 'EXACT_SCHEDULED_LIMITS_RESTORE_REQUIRED'; end if;
 update public.workspace_subscriptions set paid_through_at='2026-11-14 00:00:00+00'::timestamptz
 where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and status='active' and version=1 and member_limit=1 and paid_through_at='2026-11-15 10:03:29.879358+00';
 get diagnostics touched=row_count;
 if touched<>1 then raise exception 'EXACT_SCHEDULED_TERM_RESTORE_REQUIRED'; end if;
end;
$restore$;
commit;
