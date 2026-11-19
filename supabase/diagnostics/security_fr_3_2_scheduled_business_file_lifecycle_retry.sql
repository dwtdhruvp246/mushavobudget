-- Reserve a new synthetic orphan after the first run closed without a scheduler invocation.
begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
set local statement_timeout='15s';
select pg_advisory_xact_lock(20261017,2411);
do $preflight$
declare touched integer;
begin
 if not exists(select 1 from mushavo_email_install.rollout_control where singleton and mode='ACTIVE'
   and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='c06956b73f8f42cd8ef06bc25219875788e15c91ff9a9039d1fe04cd17a5e222' and catalog_sha256=mushavo_email_install.catalog_identity())
 or (select md5(prosrc) from pg_proc where oid='public.fr3_lifecycle_trial_ready()'::regprocedure) is distinct from 'c762747d8f7dac1eee56a48099a50d65'
 or not exists(select 1 from public.budget_workspaces where id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and status='suspended' and business_support_version=50)
 or exists(select 1 from public.business_documents where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and status='active' and id<>'ef6fb184-5e10-44b8-9d8a-a4ed532733c7')
 or not exists(select 1 from public.business_documents d join storage.objects o on o.bucket_id='business-documents' and o.name=d.storage_path
    where d.workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and d.id='ef6fb184-5e10-44b8-9d8a-a4ed532733c7' and d.status='active' and d.parent_id='89fd5fb1-d177-4c3a-ad7a-3ba4ec34a120')
 or exists(select 1 from storage.objects where bucket_id='business-documents' and name like 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/%' and not starts_with(name,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/ef6fb184-5e10-44b8-9d8a-a4ed532733c7/'))
 or exists(select 1 from mushavo_file_ingest.business_uploads where document_id in ('bc7a31b7-62a4-4fb7-aa5b-3d169bb33568','32ea8cbf-0a6c-43cc-a21a-42dfe989b424'))
 or exists(select 1 from mushavo_file_ingest.cleanup_dispatch where removed>0)
 then raise exception 'EXACT_SCHEDULER_RETRY_BASELINE_REQUIRED'; end if;
 update mushavo_file_ingest.business_uploads u set state='removed' where u.document_id='a83a436a-a324-45a3-b321-17084d2d5062' and u.workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and u.state='verified'
    and u.expires_at<clock_timestamp() and not exists(select 1 from storage.objects o where o.bucket_id='business-documents' and o.name=u.object_name)
    and not exists(select 1 from public.business_documents d where d.storage_path=u.object_name);
 get diagnostics touched=row_count;
 if touched<>1 then raise exception 'EXACT_PREVIOUS_ORPHAN_CLOSE_REQUIRED'; end if;
 update mushavo_file_ingest.workspace_limits set enabled=true where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and not enabled;
 get diagnostics touched=row_count;
 if touched<>1 then raise exception 'EXACT_RETRY_LIMITS_REQUIRED'; end if;
 update public.workspace_subscriptions set paid_through_at='2026-11-15 10:17:50.773535+00'
   where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and version=1 and member_limit=1 and paid_through_at='2026-11-14 00:00:00+00';
 get diagnostics touched=row_count;
 if touched<>1 then raise exception 'EXACT_RETRY_TERM_REQUIRED'; end if;
end;
$preflight$;
alter policy fr3_lifecycle_trial_server_insert on storage.objects with check (bucket_id <> 'business-documents' or not (starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a1a26ceb-d569-43ae-93f7-496fe0927ebc/') or starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/c48c3db5-8eb6-4614-9b2e-784a5502a662/') or starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a83a436a-a324-45a3-b321-17084d2d5062/') or starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/32ea8cbf-0a6c-43cc-a21a-42dfe989b424/') or starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/bc7a31b7-62a4-4fb7-aa5b-3d169bb33568/')));
alter policy fr3_lifecycle_trial_server_update on storage.objects using (bucket_id <> 'business-documents' or not (starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a1a26ceb-d569-43ae-93f7-496fe0927ebc/') or starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/c48c3db5-8eb6-4614-9b2e-784a5502a662/') or starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a83a436a-a324-45a3-b321-17084d2d5062/') or starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/32ea8cbf-0a6c-43cc-a21a-42dfe989b424/') or starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/bc7a31b7-62a4-4fb7-aa5b-3d169bb33568/'))) with check (bucket_id <> 'business-documents' or not (starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a1a26ceb-d569-43ae-93f7-496fe0927ebc/') or starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/c48c3db5-8eb6-4614-9b2e-784a5502a662/') or starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a83a436a-a324-45a3-b321-17084d2d5062/') or starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/32ea8cbf-0a6c-43cc-a21a-42dfe989b424/') or starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/bc7a31b7-62a4-4fb7-aa5b-3d169bb33568/')));
CREATE OR REPLACE FUNCTION public.fr3_lifecycle_trial_ready()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  select (select relrowsecurity from pg_class where oid='storage.objects'::regclass)
    and exists(select 1 from public.budget_workspaces w join public.workspace_subscriptions s on s.workspace_id=w.id
      join mushavo_file_ingest.workspace_limits l on l.workspace_id=w.id
      where w.id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and w.owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and w.name='audit-fr3-logo-ingestion-20261112'
        and w.status='active' and w.business_support_version=51 and s.status='active' and s.paid_through_at>now()
        and l.enabled and l.max_files=1 and l.max_bytes=2097152 and l.max_in_flight=1 and l.reservation_ttl_seconds=40)
    and (select count(*)=2 from pg_policy p
      cross join (values ($policy$((bucket_id <> 'business-documents'::text) OR (NOT (starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a1a26ceb-d569-43ae-93f7-496fe0927ebc/'::text) OR starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/c48c3db5-8eb6-4614-9b2e-784a5502a662/'::text) OR starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a83a436a-a324-45a3-b321-17084d2d5062/'::text) OR starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/32ea8cbf-0a6c-43cc-a21a-42dfe989b424/'::text) OR starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/bc7a31b7-62a4-4fb7-aa5b-3d169bb33568/'::text))))$policy$)) v(expr)
      where p.polrelid='storage.objects'::regclass and not p.polpermissive
      and p.polroles @> array[to_regrole('anon')::oid,to_regrole('authenticated')::oid]
      and pg_get_expr(p.polwithcheck,p.polrelid)=v.expr
      and ((p.polname='fr3_lifecycle_trial_server_insert' and p.polcmd='a' and p.polqual is null)
        or (p.polname='fr3_lifecycle_trial_server_update' and p.polcmd='w' and pg_get_expr(p.polqual,p.polrelid)=v.expr)));
$function$;
CREATE OR REPLACE FUNCTION public.fr3_reserve_lifecycle_trial(p_document uuid, p_object text, p_size integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
begin
  if not public.fr3_lifecycle_trial_ready() or p_document is null or p_document not in ('bc7a31b7-62a4-4fb7-aa5b-3d169bb33568','32ea8cbf-0a6c-43cc-a21a-42dfe989b424') then return false; end if;
  return mushavo_file_ingest.reserve_business_upload('8d9307e6-aada-4c9a-a8f5-43c57e0865e2','ca7bdcf2-e69d-42e2-8ae8-79cac6de2184',p_document,p_object,'application/pdf',p_size);
end;
$function$;
CREATE OR REPLACE FUNCTION public.fr3_verify_lifecycle_trial(p_object text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
begin
  if not public.fr3_lifecycle_trial_ready() or p_object is null
    or not (starts_with(p_object,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/bc7a31b7-62a4-4fb7-aa5b-3d169bb33568/') or starts_with(p_object,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/32ea8cbf-0a6c-43cc-a21a-42dfe989b424/')) then return false; end if;
  return mushavo_file_ingest.verify_business_upload(p_object);
end;
$function$;
CREATE OR REPLACE FUNCTION public.fr3_finish_lifecycle_trial(p_object text, p_token uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
begin
  if not public.fr3_lifecycle_trial_ready() or p_object is null
    or not (starts_with(p_object,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/bc7a31b7-62a4-4fb7-aa5b-3d169bb33568/') or starts_with(p_object,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/32ea8cbf-0a6c-43cc-a21a-42dfe989b424/')) then return false; end if;
  return mushavo_file_ingest.finish_business_cleanup(p_object,p_token);
end;
$function$;
CREATE OR REPLACE FUNCTION public.fr3_scheduled_cleanup_witness()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
 select public.fr3_lifecycle_trial_ready()
   and exists(select 1 from mushavo_file_ingest.business_uploads u
      where u.workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and u.document_id='bc7a31b7-62a4-4fb7-aa5b-3d169bb33568' and u.state='removed' and u.cleanup_attempts=1
        and not exists(select 1 from storage.objects o where o.bucket_id='business-documents' and o.name=u.object_name))
   and exists(select 1 from mushavo_file_ingest.cleanup_dispatch d where d.finished_at is not null
     and d.claimed=1 and d.removed=1 and d.retry=0);
$function$;
update mushavo_email_install.rollout_control set catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
where singleton and mode='ACTIVE' and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='c06956b73f8f42cd8ef06bc25219875788e15c91ff9a9039d1fe04cd17a5e222';
notify pgrst,'reload schema';
commit;
