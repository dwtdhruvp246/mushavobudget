-- Staging only. Exercise signed scheduler requests and download budgets for two synthetic documents.
begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
set local statement_timeout='18s';
select pg_advisory_xact_lock(20261017,2411);
do $preflight$
begin
 if not exists(select 1 from mushavo_email_install.rollout_control where singleton and mode='ACTIVE'
   and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='701b195780b6b7ac2c4b8b88f214ed049f5d7353688782364304c3488261fc3e' and catalog_sha256=mushavo_email_install.catalog_identity())
 or not exists(select 1 from public.budget_workspaces w join public.workspace_subscriptions sub on sub.workspace_id=w.id
   where w.id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and w.owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and w.name='audit-fr3-logo-ingestion-20261112' and w.status='suspended'
   and w.business_support_version=46 and sub.status='active' and sub.version=1 and sub.member_limit=1
   and sub.paid_through_at='2026-11-14 00:00:00+00')
 or not exists(select 1 from mushavo_file_ingest.workspace_limits where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and not enabled
   and max_files=1 and max_bytes=2097152 and max_in_flight=1 and reservation_ttl_seconds=40)
 or exists(select 1 from public.business_documents where id in ('a83a436a-a324-45a3-b321-17084d2d5062','32ea8cbf-0a6c-43cc-a21a-42dfe989b424') or workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and status='active')
 or exists(select 1 from storage.objects where bucket_id='business-documents' and name like 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/%')
 or (select jsonb_object_agg(p.proname,md5(p.prosrc)) from pg_proc p where p.oid in
   ('public.fr3_lifecycle_trial_ready()'::regprocedure,'public.fr3_reserve_lifecycle_trial(uuid,text,integer)'::regprocedure,
    'public.fr3_verify_lifecycle_trial(text)'::regprocedure,'public.fr3_finish_lifecycle_trial(text,uuid)'::regprocedure))
   is distinct from '{"fr3_lifecycle_trial_ready":"bc623d2660a9a51863b9ab7cf6d030b3","fr3_finish_lifecycle_trial":"41df2df5b35de84a41fc09a51aed619f","fr3_verify_lifecycle_trial":"180955405636610128b73008cbf77213","fr3_reserve_lifecycle_trial":"2004fa561a294eeea14e150c0e5d9625"}'::jsonb
 then raise exception 'EXACT_SCHEDULED_LIFECYCLE_BASELINE_REQUIRED'; end if;
end;
$preflight$;

alter policy fr3_lifecycle_trial_server_insert on storage.objects with check (bucket_id <> 'business-documents' or not (starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a1a26ceb-d569-43ae-93f7-496fe0927ebc/') or starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/c48c3db5-8eb6-4614-9b2e-784a5502a662/') or starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a83a436a-a324-45a3-b321-17084d2d5062/') or starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/32ea8cbf-0a6c-43cc-a21a-42dfe989b424/')));
alter policy fr3_lifecycle_trial_server_update on storage.objects using (bucket_id <> 'business-documents' or not (starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a1a26ceb-d569-43ae-93f7-496fe0927ebc/') or starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/c48c3db5-8eb6-4614-9b2e-784a5502a662/') or starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a83a436a-a324-45a3-b321-17084d2d5062/') or starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/32ea8cbf-0a6c-43cc-a21a-42dfe989b424/'))) with check (bucket_id <> 'business-documents' or not (starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a1a26ceb-d569-43ae-93f7-496fe0927ebc/') or starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/c48c3db5-8eb6-4614-9b2e-784a5502a662/') or starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a83a436a-a324-45a3-b321-17084d2d5062/') or starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/32ea8cbf-0a6c-43cc-a21a-42dfe989b424/')));

-- Retain old manifest rows and exclude archived files that have already been
-- independently removed from the new trial's capacity calculation.
update mushavo_file_ingest.business_uploads u set state='removed'
 where u.workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and u.document_id='c48c3db5-8eb6-4614-9b2e-784a5502a662' and u.state='registered'
 and exists(select 1 from public.business_documents d where d.id=u.document_id and d.storage_path=u.object_name and d.status='archived')
 and not exists(select 1 from storage.objects o where o.bucket_id='business-documents' and o.name=u.object_name);
update mushavo_file_ingest.workspace_limits set enabled=true where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and not enabled;
update public.workspace_subscriptions set paid_through_at='2026-11-15 10:03:29.879358+00'::timestamptz
 where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and version=1 and paid_through_at='2026-11-14 00:00:00+00';

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
        and w.status='active' and w.business_support_version=47 and s.status='active' and s.paid_through_at>now()
        and l.enabled and l.max_files=1 and l.max_bytes=2097152 and l.max_in_flight=1 and l.reservation_ttl_seconds=40)
    and (select count(*)=2 from pg_policy p
      cross join (values ($policy$((bucket_id <> 'business-documents'::text) OR (NOT (starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a1a26ceb-d569-43ae-93f7-496fe0927ebc/'::text) OR starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/c48c3db5-8eb6-4614-9b2e-784a5502a662/'::text) OR starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a83a436a-a324-45a3-b321-17084d2d5062/'::text) OR starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/32ea8cbf-0a6c-43cc-a21a-42dfe989b424/'::text))))$policy$)) v(expr)
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
  if not public.fr3_lifecycle_trial_ready() or p_document is null or p_document not in ('a83a436a-a324-45a3-b321-17084d2d5062','32ea8cbf-0a6c-43cc-a21a-42dfe989b424') then return false; end if;
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
    or not (starts_with(p_object,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a83a436a-a324-45a3-b321-17084d2d5062/') or starts_with(p_object,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/32ea8cbf-0a6c-43cc-a21a-42dfe989b424/')) then return false; end if;
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
    or not (starts_with(p_object,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a83a436a-a324-45a3-b321-17084d2d5062/') or starts_with(p_object,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/32ea8cbf-0a6c-43cc-a21a-42dfe989b424/')) then return false; end if;
  return mushavo_file_ingest.finish_business_cleanup(p_object,p_token);
end;
$function$;

create table mushavo_file_ingest.cleanup_dispatch (
  nonce uuid primary key, queued_at timestamptz not null, consumed_at timestamptz not null,
  finished_at timestamptz, claimed integer, removed integer, retry integer
);
alter table mushavo_file_ingest.cleanup_dispatch enable row level security;
revoke all on mushavo_file_ingest.cleanup_dispatch from public, anon, authenticated;

create function public.fr3_consume_cleanup_dispatch(p_nonce uuid,p_epoch bigint)
returns boolean language plpgsql security definer set search_path=pg_catalog
as $$
declare current_epoch bigint := extract(epoch from clock_timestamp())::bigint;
begin
 if p_nonce is null or p_epoch is null or p_epoch not between current_epoch-120 and current_epoch+120
    or not public.fr3_lifecycle_trial_ready() then return false; end if;
 insert into mushavo_file_ingest.cleanup_dispatch(nonce,queued_at,consumed_at)
   values(p_nonce,to_timestamp(p_epoch),clock_timestamp()) on conflict(nonce) do nothing;
 return found;
end;
$$;
create function public.fr3_finish_cleanup_dispatch(p_nonce uuid,p_claimed integer,p_removed integer,p_retry integer)
returns boolean language plpgsql security definer set search_path=pg_catalog
as $$
begin
 if p_nonce is null or p_claimed is null or p_removed is null or p_retry is null
   or p_claimed not between 0 and 20 or p_removed<0 or p_retry<0 or p_claimed<>p_removed+p_retry
 then return false; end if;
 update mushavo_file_ingest.cleanup_dispatch set finished_at=clock_timestamp(),claimed=p_claimed,removed=p_removed,retry=p_retry
 where nonce=p_nonce and finished_at is null and consumed_at>clock_timestamp()-interval '5 minutes';
 return found;
end;
$$;

create table mushavo_file_ingest.trial_download_usage (
  user_id uuid primary key, window_started timestamptz not null,
  requests integer not null check (requests between 1 and 2),
  byte_count integer not null check (byte_count between 1 and 4096)
);
alter table mushavo_file_ingest.trial_download_usage enable row level security;
revoke all on mushavo_file_ingest.trial_download_usage from public, anon, authenticated;

create function public.fr3_reserve_trial_download(p_user uuid,p_path text,p_size integer)
returns boolean language plpgsql security definer set search_path=pg_catalog
as $$
declare checked_at timestamptz := clock_timestamp();
begin
 if p_user is distinct from 'ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'::uuid or p_path is null or not starts_with(p_path,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/32ea8cbf-0a6c-43cc-a21a-42dfe989b424/')
   or p_size is null or p_size not between 1 and 4096 or not public.fr3_lifecycle_trial_ready()
   or not exists(select 1 from public.business_documents d where d.id='32ea8cbf-0a6c-43cc-a21a-42dfe989b424' and d.workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2'
     and d.uploaded_by=p_user and d.storage_path=p_path and d.size_bytes=p_size and d.status='active')
 then return false; end if;

 insert into mushavo_file_ingest.trial_download_usage as u(user_id,window_started,requests,byte_count)
 values(p_user,checked_at,1,p_size)
 on conflict(user_id) do update
 set window_started=case when u.window_started<=checked_at-interval '2 minutes' then checked_at else u.window_started end,
   requests=case when u.window_started<=checked_at-interval '2 minutes' then 1 else u.requests+1 end,
   byte_count=case when u.window_started<=checked_at-interval '2 minutes' then p_size else u.byte_count+p_size end
 where u.window_started<=checked_at-interval '2 minutes' or (u.requests<2 and u.byte_count<=4096-p_size);
 return found;
end;
$$;
revoke all on function public.fr3_consume_cleanup_dispatch(uuid,bigint) from public, anon, authenticated;
grant execute on function public.fr3_consume_cleanup_dispatch(uuid,bigint) to service_role;
revoke all on function public.fr3_finish_cleanup_dispatch(uuid,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.fr3_finish_cleanup_dispatch(uuid,integer,integer,integer) to service_role;
revoke all on function public.fr3_reserve_trial_download(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.fr3_reserve_trial_download(uuid,text,integer) to service_role;

create function public.fr3_scheduled_cleanup_witness()
returns boolean language sql stable security definer set search_path=pg_catalog
as $$
 select public.fr3_lifecycle_trial_ready()
   and exists(select 1 from mushavo_file_ingest.business_uploads u
      where u.workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and u.document_id='a83a436a-a324-45a3-b321-17084d2d5062' and u.state='removed' and u.cleanup_attempts=1
        and not exists(select 1 from storage.objects o where o.bucket_id='business-documents' and o.name=u.object_name))
   and exists(select 1 from mushavo_file_ingest.cleanup_dispatch d where d.finished_at is not null
     and d.claimed=1 and d.removed=1 and d.retry=0);
$$;
revoke all on function public.fr3_scheduled_cleanup_witness() from public, anon, authenticated;
grant execute on function public.fr3_scheduled_cleanup_witness() to service_role;

update mushavo_email_install.rollout_control set catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
where singleton and mode='ACTIVE' and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='701b195780b6b7ac2c4b8b88f214ed049f5d7353688782364304c3488261fc3e';
notify pgrst,'reload schema';
commit;
