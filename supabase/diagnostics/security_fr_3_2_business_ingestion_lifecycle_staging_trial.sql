-- Staging only. Compose the reviewed lifecycle candidate with these two exact document paths.
begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
set local statement_timeout='20s';
select pg_advisory_xact_lock(20261017,2411);
do $trial$
begin
  if to_regnamespace('mushavo_file_ingest') is not null
    or not exists(select 1 from mushavo_email_install.rollout_control where singleton and mode='ACTIVE'
      and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='f83f228aae8623200b4fcf90aa9d5b695f39d37b1f29d729d66bc6c8b36c5797' and catalog_sha256=mushavo_email_install.catalog_identity())
    or not exists(select 1 from public.budget_workspaces w join public.workspace_subscriptions s on s.workspace_id=w.id
       where w.id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and w.owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and w.name='audit-fr3-logo-ingestion-20261112' and w.workspace_type='business'
       and w.status='suspended' and w.business_support_version=44 and s.plan_id='0ccf35bb-43c7-4c1b-9148-0f352b85bd2a'
       and s.version=1 and s.member_limit=1 and s.status='active' and s.paid_through_at='2026-11-14T00:00:00+00:00'
       and s.updated_at='2026-11-12T18:32:58.996201+00:00')
    or exists(select 1 from public.business_documents where id in ('a1a26ceb-d569-43ae-93f7-496fe0927ebc','c48c3db5-8eb6-4614-9b2e-784a5502a662') or workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and status='active')
    or exists(select 1 from storage.objects where bucket_id='business-documents' and name like 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/%')
  then raise exception 'EXACT_LIFECYCLE_TRIAL_BASELINE_REQUIRED'; end if;
end;
$trial$;

create schema mushavo_file_ingest;
revoke all on schema mushavo_file_ingest from public, anon, authenticated;
grant usage on schema mushavo_file_ingest to service_role;

create table mushavo_file_ingest.workspace_limits (
  workspace_id uuid primary key,
  max_files integer not null check (max_files between 1 and 10000),
  max_bytes bigint not null check (max_bytes > 0),
  max_in_flight integer not null check (max_in_flight between 1 and max_files),
  enabled boolean not null default true,
  reservation_ttl_seconds integer not null default 1800 check (reservation_ttl_seconds between 30 and 1800),
  reservation_revision bigint not null default 0
);

create table mushavo_file_ingest.business_uploads (
  workspace_id uuid not null references mushavo_file_ingest.workspace_limits(workspace_id),
  uploader_id uuid not null,
  document_id uuid not null unique,
  object_name text primary key,
  mime_type text not null check (mime_type in (
    'image/png', 'application/pdf', 'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )),
  num_bytes integer not null check (num_bytes between 1 and 2097152),
  state text not null default 'reserved'
    check (state in ('reserved', 'verified', 'registered', 'removing', 'removed')),
  expires_at timestamptz not null,
  cleanup_token uuid,
  cleanup_attempts integer not null default 0,
  cleanup_lease_until timestamptz,
  check ((state = 'removing') = (cleanup_token is not null and cleanup_lease_until is not null))
);
create index business_uploads_workspace_live
  on mushavo_file_ingest.business_uploads(workspace_id)
  where state <> 'removed';
create index business_uploads_cleanup
  on mushavo_file_ingest.business_uploads(expires_at, object_name)
  where state in ('reserved', 'verified', 'removing', 'removed');

alter table mushavo_file_ingest.workspace_limits enable row level security;
alter table mushavo_file_ingest.business_uploads enable row level security;
revoke all on all tables in schema mushavo_file_ingest from public, anon, authenticated;

-- The caller must have authenticated the uploader and derived the authorized workspace.
-- Allocation runs before writing any object to the reserved prefix.
create function mushavo_file_ingest.reserve_business_upload(
  p_workspace uuid, p_uploader uuid, p_document uuid, p_object text,
  p_mime text, p_bytes integer
)
returns boolean language plpgsql security definer set search_path = pg_catalog
as $$
declare
  limits mushavo_file_ingest.workspace_limits%rowtype;
  existing mushavo_file_ingest.business_uploads%rowtype;
  live_count integer;
  live_bytes bigint;
  in_flight integer;
begin
  if p_workspace is null or p_uploader is null or p_document is null or p_object is null
    or p_bytes is null or p_bytes not between 1 and 2097152
    or p_mime is null or
    (case p_mime
      when 'image/png' then right(p_object,4) <> '.png'
      when 'application/pdf' then right(p_object,4) <> '.pdf'
      when 'text/csv' then right(p_object,4) <> '.csv'
      when 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' then right(p_object,5) <> '.xlsx'
      else true
    end)
    or p_object !~ ('^workspaces/' || p_workspace::text || '/' || p_uploader::text || '/'
      || p_document::text || '/[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}[.](pdf|png|csv|xlsx)$')
  then return false; end if;

  select * into limits from mushavo_file_ingest.workspace_limits
    where workspace_id = p_workspace and enabled for update;
  if not found then return false; end if;

  select * into existing from mushavo_file_ingest.business_uploads
    where document_id = p_document;
  if found then
    return existing.workspace_id = p_workspace and existing.uploader_id = p_uploader
      and existing.object_name = p_object and existing.mime_type = p_mime and existing.num_bytes = p_bytes
      and existing.state in ('reserved','verified') and existing.expires_at > clock_timestamp();
  end if;

  select count(*), coalesce(sum(num_bytes),0), count(*) filter (where state in ('reserved','verified'))
    into live_count, live_bytes, in_flight
    from mushavo_file_ingest.business_uploads where workspace_id = p_workspace and state <> 'removed';
  if live_count >= limits.max_files or live_bytes > limits.max_bytes - p_bytes
     or in_flight >= limits.max_in_flight then return false; end if;

  insert into mushavo_file_ingest.business_uploads
    (workspace_id,uploader_id,document_id,object_name,mime_type,num_bytes,expires_at)
    values (p_workspace,p_uploader,p_document,p_object,p_mime,p_bytes,clock_timestamp()+make_interval(secs => limits.reservation_ttl_seconds))
    on conflict do nothing;
  if not found then return false; end if;

  -- Change the row used for locking so repeatable-read callers with an older
  -- snapshot receive a serialization error instead of allocating from stale totals.
  update mushavo_file_ingest.workspace_limits
    set reservation_revision=reservation_revision+1 where workspace_id=p_workspace;
  return true;
end;
$$;

-- The validator calls this after its byte-for-byte Storage readback.
create function mushavo_file_ingest.verify_business_upload(p_object text)
returns boolean language plpgsql security definer set search_path = pg_catalog
as $$
begin
  update mushavo_file_ingest.business_uploads u set state='verified'
    where u.object_name=p_object and u.state in ('reserved','verified') and u.expires_at>clock_timestamp()
      and exists (select 1 from storage.objects o where o.bucket_id='business-documents' and o.name=u.object_name
        and o.metadata->>'mimetype'=u.mime_type
        and coalesce(o.metadata->>'size',o.metadata->>'contentLength')=u.num_bytes::text);
  return found;
end;
$$;

-- Run in the registration transaction with values derived by the registration RPC.
-- The row lock serializes registration with cleanup. On false, registration must roll back.
create function mushavo_file_ingest.link_business_upload(
  p_workspace uuid, p_uploader uuid, p_document uuid, p_object text, p_mime text, p_bytes integer
)
returns boolean language plpgsql security definer set search_path = pg_catalog
as $$
begin
  update mushavo_file_ingest.business_uploads set state='registered'
    where workspace_id=p_workspace and uploader_id=p_uploader and document_id=p_document
      and object_name=p_object and mime_type=p_mime and num_bytes=p_bytes
      and state in ('verified','registered')
      and (state='registered' or expires_at>clock_timestamp());
  return found;
end;
$$;

-- Enable the binding for explicitly configured workspaces. The existing
-- business document RPC still enforces user, parent and Storage authorization.
create function mushavo_file_ingest.bind_business_document()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
begin
  if exists (select 1 from mushavo_file_ingest.workspace_limits where workspace_id=new.workspace_id and enabled)
    and not mushavo_file_ingest.link_business_upload(new.workspace_id, new.uploaded_by, new.id,
      new.storage_path, new.mime_type, new.size_bytes::integer)
  then raise exception 'VERIFIED_BUSINESS_UPLOAD_REQUIRED'; end if;
  return new;
end;
$$;

create trigger require_verified_business_ingestion
  before insert on public.business_documents
  for each row execute function mushavo_file_ingest.bind_business_document();

create function mushavo_file_ingest.claim_business_cleanup(p_workspace uuid, p_limit integer)
returns table (object_name text, cleanup_token uuid)
language sql security definer set search_path = pg_catalog
as $$
  with due as (
    select u.object_name
      from mushavo_file_ingest.business_uploads u
      where u.workspace_id=p_workspace
        and ((u.state in ('reserved','verified') and u.expires_at<=clock_timestamp())
          or (u.state='removing' and u.cleanup_lease_until<=clock_timestamp())
          or (u.state='removed' and exists (select 1 from storage.objects o
            where o.bucket_id='business-documents' and o.name=u.object_name)))
        and not exists (select 1 from public.business_documents d where d.storage_path=u.object_name)
      order by u.expires_at,u.object_name
      limit greatest(0,least(coalesce(p_limit,0),20)) for update of u skip locked
  ), claimed as (
    update mushavo_file_ingest.business_uploads u
      set state='removing',cleanup_token=gen_random_uuid(),cleanup_lease_until=clock_timestamp()+interval '5 minutes',
          cleanup_attempts=cleanup_attempts+1
      from due
      where u.object_name=due.object_name
        and not exists (select 1 from public.business_documents d where d.storage_path=u.object_name)
      returning u.object_name,u.cleanup_token
  )
  select * from claimed;
$$;

-- After a successful Storage API removal, confirm absence in Storage metadata.
-- A failed call keeps the lease and capacity reservation for a later retry.
create function mushavo_file_ingest.finish_business_cleanup(p_object text, p_token uuid)
returns boolean language plpgsql security definer set search_path = pg_catalog
as $$
begin
  update mushavo_file_ingest.business_uploads u
    set state='removed',cleanup_token=null,cleanup_lease_until=null
    where u.object_name=p_object and u.state='removing' and u.cleanup_token=p_token
      and u.cleanup_lease_until>clock_timestamp()
      and not exists (select 1 from storage.objects o where o.bucket_id='business-documents' and o.name=p_object)
      and not exists (select 1 from public.business_documents d where d.storage_path=p_object);
  return found;
end;
$$;

revoke execute on all functions in schema mushavo_file_ingest from public, anon, authenticated;
grant execute on all functions in schema mushavo_file_ingest to service_role;

create policy fr3_lifecycle_trial_server_insert on storage.objects as restrictive for insert to authenticated, anon with check (bucket_id <> 'business-documents' or not (starts_with(name,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a1a26ceb-d569-43ae-93f7-496fe0927ebc/') or starts_with(name,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/c48c3db5-8eb6-4614-9b2e-784a5502a662/')));
create policy fr3_lifecycle_trial_server_update on storage.objects as restrictive for update to authenticated, anon using (bucket_id <> 'business-documents' or not (starts_with(name,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a1a26ceb-d569-43ae-93f7-496fe0927ebc/') or starts_with(name,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/c48c3db5-8eb6-4614-9b2e-784a5502a662/'))) with check (bucket_id <> 'business-documents' or not (starts_with(name,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a1a26ceb-d569-43ae-93f7-496fe0927ebc/') or starts_with(name,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/c48c3db5-8eb6-4614-9b2e-784a5502a662/')));
insert into mushavo_file_ingest.workspace_limits(workspace_id,max_files,max_bytes,max_in_flight,reservation_ttl_seconds)
values('8d9307e6-aada-4c9a-a8f5-43c57e0865e2',1,2097152,1,40);

create function public.fr3_lifecycle_trial_ready()
returns boolean language sql stable security definer set search_path=pg_catalog
as $$
  select (select relrowsecurity from pg_class where oid='storage.objects'::regclass)
    and exists(select 1 from public.budget_workspaces w join public.workspace_subscriptions s on s.workspace_id=w.id
      join mushavo_file_ingest.workspace_limits l on l.workspace_id=w.id
      where w.id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and w.owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and w.name='audit-fr3-logo-ingestion-20261112'
        and w.status='active' and w.business_support_version=45 and s.status='active' and s.paid_through_at>now()
        and l.enabled and l.max_files=1 and l.max_bytes=2097152 and l.max_in_flight=1 and l.reservation_ttl_seconds=40)
    and (select count(*)=2 from pg_policy p
      cross join (values ($policy$((bucket_id <> 'business-documents'::text) OR (NOT (starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a1a26ceb-d569-43ae-93f7-496fe0927ebc/'::text) OR starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/c48c3db5-8eb6-4614-9b2e-784a5502a662/'::text))))$policy$)) v(expr)
      where p.polrelid='storage.objects'::regclass and not p.polpermissive
      and p.polroles @> array[to_regrole('anon')::oid,to_regrole('authenticated')::oid]
      and pg_get_expr(p.polwithcheck,p.polrelid)=v.expr
      and ((p.polname='fr3_lifecycle_trial_server_insert' and p.polcmd='a' and p.polqual is null)
        or (p.polname='fr3_lifecycle_trial_server_update' and p.polcmd='w' and pg_get_expr(p.polqual,p.polrelid)=v.expr)));
$$;
create function public.fr3_reserve_lifecycle_trial(p_document uuid,p_object text,p_size integer)
returns boolean language plpgsql security invoker set search_path=pg_catalog
as $$
begin
  if not public.fr3_lifecycle_trial_ready() or p_document is null or p_document not in ('a1a26ceb-d569-43ae-93f7-496fe0927ebc','c48c3db5-8eb6-4614-9b2e-784a5502a662') then return false; end if;
  return mushavo_file_ingest.reserve_business_upload('8d9307e6-aada-4c9a-a8f5-43c57e0865e2','ca7bdcf2-e69d-42e2-8ae8-79cac6de2184',p_document,p_object,'application/pdf',p_size);
end;
$$;
create function public.fr3_verify_lifecycle_trial(p_object text)
returns boolean language plpgsql security invoker set search_path=pg_catalog
as $$
begin
  if not public.fr3_lifecycle_trial_ready() or p_object is null
    or not (starts_with(p_object,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a1a26ceb-d569-43ae-93f7-496fe0927ebc/') or starts_with(p_object,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/c48c3db5-8eb6-4614-9b2e-784a5502a662/')) then return false; end if;
  return mushavo_file_ingest.verify_business_upload(p_object);
end;
$$;
create function public.fr3_claim_lifecycle_trial(p_limit integer)
returns table(object_name text,cleanup_token uuid) language plpgsql security invoker set search_path=pg_catalog
as $$
begin
  if not public.fr3_lifecycle_trial_ready() then return; end if;
  return query select x.object_name,x.cleanup_token from mushavo_file_ingest.claim_business_cleanup('8d9307e6-aada-4c9a-a8f5-43c57e0865e2',p_limit) x;
end;
$$;
create function public.fr3_finish_lifecycle_trial(p_object text,p_token uuid)
returns boolean language plpgsql security invoker set search_path=pg_catalog
as $$
begin
  if not public.fr3_lifecycle_trial_ready() or p_object is null
    or not (starts_with(p_object,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/a1a26ceb-d569-43ae-93f7-496fe0927ebc/') or starts_with(p_object,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/c48c3db5-8eb6-4614-9b2e-784a5502a662/')) then return false; end if;
  return mushavo_file_ingest.finish_business_cleanup(p_object,p_token);
end;
$$;
revoke all on function public.fr3_lifecycle_trial_ready() from public, anon, authenticated;
grant execute on function public.fr3_lifecycle_trial_ready() to service_role;
revoke all on function public.fr3_reserve_lifecycle_trial(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.fr3_reserve_lifecycle_trial(uuid,text,integer) to service_role;
revoke all on function public.fr3_verify_lifecycle_trial(text) from public, anon, authenticated;
grant execute on function public.fr3_verify_lifecycle_trial(text) to service_role;
revoke all on function public.fr3_claim_lifecycle_trial(integer) from public, anon, authenticated;
grant execute on function public.fr3_claim_lifecycle_trial(integer) to service_role;
revoke all on function public.fr3_finish_lifecycle_trial(text,uuid) from public, anon, authenticated;
grant execute on function public.fr3_finish_lifecycle_trial(text,uuid) to service_role;
update public.workspace_subscriptions set paid_through_at='2026-11-15 09:09:16.597707+00'::timestamptz
 where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and plan_id='0ccf35bb-43c7-4c1b-9148-0f352b85bd2a' and version=1 and paid_through_at='2026-11-14T00:00:00+00:00';
update mushavo_email_install.rollout_control set catalog_sha256=mushavo_email_install.catalog_identity(), changed_at=clock_timestamp()
where singleton and mode='ACTIVE' and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='f83f228aae8623200b4fcf90aa9d5b695f39d37b1f29d729d66bc6c8b36c5797';
notify pgrst,'reload schema';
commit;
