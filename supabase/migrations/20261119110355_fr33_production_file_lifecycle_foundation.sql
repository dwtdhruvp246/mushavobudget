SET LOCAL lock_timeout='3s';
-- Install the upload and cleanup ledgers for FR.3.3. Client routes, triggers,
-- Storage policies and worker grants are installed by later cutovers.
-- Reused from staging 20261115074322 security_fr_3_2_business_ingestion_lifecycle_trial; excludes the staging rollout.
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

-- Reused from staging 20261115152310 security_fr_3_2_logo_replacement_cleanup_staging; excludes the staging rollout.
create table mushavo_file_ingest.logo_cleanup_settings (
  workspace_id uuid primary key references public.budget_workspaces(id),
  enabled boolean not null default false,
  delay_seconds integer not null default 3600 check(delay_seconds between 10 and 86400)
);
create table mushavo_file_ingest.logo_replacements (
  object_name text primary key,
  workspace_id uuid not null references mushavo_file_ingest.logo_cleanup_settings(workspace_id),
  due_at timestamptz not null,
  state text not null check(state in ('queued','claimed','removed')),
  token uuid,
  lease_until timestamptz,
  attempts integer not null default 0,
  check(split_part(object_name,'/',1)=workspace_id::text),
  check(object_name ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}/[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}/[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}[.](png|jpg|webp)$')
);
create index logo_replacement_next_due on mushavo_file_ingest.logo_replacements(due_at) where state<>'removed';
create table mushavo_file_ingest.logo_cleanup_dispatch (
  nonce uuid primary key,
  issued_at timestamptz not null
);
alter table mushavo_file_ingest.logo_cleanup_settings enable row level security;
alter table mushavo_file_ingest.logo_replacements enable row level security;
alter table mushavo_file_ingest.logo_cleanup_dispatch enable row level security;
alter table mushavo_file_ingest.logo_cleanup_settings force row level security;
alter table mushavo_file_ingest.logo_replacements force row level security;
alter table mushavo_file_ingest.logo_cleanup_dispatch force row level security;
revoke all on mushavo_file_ingest.logo_cleanup_settings,mushavo_file_ingest.logo_replacements,mushavo_file_ingest.logo_cleanup_dispatch
  from public,anon,authenticated,service_role;

create function mushavo_file_ingest.record_logo_replacement()
returns trigger language plpgsql security definer set search_path=pg_catalog as $body$
declare
  v_delay integer;
  v_state text;
begin
  if new.logo_storage_path is not distinct from old.logo_storage_path then return new; end if;
  select delay_seconds into v_delay from mushavo_file_ingest.logo_cleanup_settings where workspace_id=new.workspace_id and enabled;

  -- A cleanup lease permanently retires the path. Lock any earlier queue entry
  -- so a concurrent scheduled claim cannot delete a logo being selected again.
  if new.logo_storage_path is not null then
    select state into v_state from mushavo_file_ingest.logo_replacements where object_name=new.logo_storage_path for update;
    if v_state in ('claimed','removed') then raise exception 'BUSINESS_LOGO_PATH_RETIRED'; end if;
    if v_state='queued' then
      delete from mushavo_file_ingest.logo_replacements where object_name=new.logo_storage_path;
    end if;
  end if;

  if v_delay is not null and old.logo_storage_path is not null then
    insert into mushavo_file_ingest.logo_replacements(object_name,workspace_id,due_at,state)
      values(old.logo_storage_path,new.workspace_id,clock_timestamp()+make_interval(secs=>v_delay),'queued');
  end if;
  return new;
end;
$body$;
revoke all on function mushavo_file_ingest.record_logo_replacement() from public,anon,authenticated,service_role;

create function public.fr32_claim_logo_replacements(p_nonce uuid,p_epoch bigint,p_limit integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $body$
declare
  v_now timestamptz := clock_timestamp();
  v_batch jsonb;
begin
  if p_nonce is null or p_epoch not between extract(epoch from v_now)::bigint-90 and extract(epoch from v_now)::bigint+30
    or p_epoch is null or p_limit is null or p_limit not between 1 and 20 then return null; end if;

  -- Dispatch records remain for longer than the maximum signature age.
  delete from mushavo_file_ingest.logo_cleanup_dispatch where issued_at<v_now-interval '1 day';
  insert into mushavo_file_ingest.logo_cleanup_dispatch(nonce,issued_at) values(p_nonce,v_now) on conflict do nothing;
  if not found then return null; end if;

  with due as (
    select r.object_name from mushavo_file_ingest.logo_replacements r
    join mushavo_file_ingest.logo_cleanup_settings l on l.workspace_id=r.workspace_id and l.enabled
    where r.due_at<=v_now and (r.state='queued' or (r.state='claimed' and r.lease_until<v_now))
      and not exists(select 1 from public.business_profiles p where p.logo_storage_path=r.object_name)
    order by r.due_at,r.object_name limit p_limit for update of r skip locked
  ), taken as (
    update mushavo_file_ingest.logo_replacements r
      set state='claimed', token=gen_random_uuid(), lease_until=v_now+interval '1 minute', attempts=attempts+1
    from due where r.object_name=due.object_name
    returning r.object_name,r.token
  ) select coalesce(jsonb_agg(jsonb_build_object('object_name',object_name,'cleanup_token',token)),'[]'::jsonb) into v_batch from taken;
  return v_batch;
end;
$body$;
revoke all on function public.fr32_claim_logo_replacements(uuid,bigint,integer) from public,anon,authenticated;

create function public.fr32_finish_logo_replacement(p_object text,p_token uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog as $body$
begin
  update mushavo_file_ingest.logo_replacements r
    set state='removed', token=null, lease_until=null
    where r.object_name=p_object and r.state='claimed' and r.token=p_token
      and not exists(select 1 from public.business_profiles p where p.logo_storage_path=r.object_name)
      and not exists(select 1 from storage.objects o where o.bucket_id='business-logos' and o.name=r.object_name);
  return found;
end;
$body$;
revoke all on function public.fr32_finish_logo_replacement(text,uuid) from public,anon,authenticated;

create function public.fr32_logo_replacement_mode()
returns boolean language sql stable security definer set search_path=pg_catalog as $body$
  select exists(select 1 from mushavo_file_ingest.logo_cleanup_settings where enabled)
$body$;
revoke all on function public.fr32_logo_replacement_mode() from public,anon,authenticated;

-- Reused from staging 20261115161705 security_fr_3_2_managed_subscription_upload_staging; excludes the staging rollout.
create table mushavo_file_ingest.subscription_uploads (
  path text primary key,
  workspace_id uuid not null,
  uploader_id uuid not null,
  mime_type text not null check (mime_type in ('application/pdf','image/png')),
  byte_count integer not null check (byte_count between 1 and 10485760),
  state text not null check (state in ('reserved','ready','linked','claimed','removed')),
  expires_at timestamptz not null,
  cleanup_token uuid,
  lease_until timestamptz,
  check (path ~ '^workspaces/[a-f0-9-]{36}/[a-f0-9-]{36}/managed-proof-v1/[a-f0-9-]{36}/[a-f0-9-]{36}[.](pdf|png)$'),
  check (split_part(path,'/',2)=workspace_id::text and split_part(path,'/',3)=uploader_id::text)
);
create index subscription_uploads_pending on mushavo_file_ingest.subscription_uploads
  (workspace_id,uploader_id) where state in ('reserved','ready','claimed');
create index subscription_uploads_due on mushavo_file_ingest.subscription_uploads
  (expires_at) where state in ('reserved','ready','claimed');
create table mushavo_file_ingest.subscription_cleanup_dispatch (
  nonce uuid primary key, issued_at timestamptz not null
);
alter table mushavo_file_ingest.subscription_uploads enable row level security;
alter table mushavo_file_ingest.subscription_uploads force row level security;
alter table mushavo_file_ingest.subscription_cleanup_dispatch enable row level security;
alter table mushavo_file_ingest.subscription_cleanup_dispatch force row level security;
revoke all on mushavo_file_ingest.subscription_uploads,mushavo_file_ingest.subscription_cleanup_dispatch
from public,anon,authenticated,service_role;


create function public.record_managed_subscription_upload(p_path text,p_mime text,p_size integer,p_verify boolean)
returns boolean language plpgsql security definer set search_path=pg_catalog as $function$
declare
  workspace uuid;
  uploader uuid;
  existing mushavo_file_ingest.subscription_uploads%rowtype;
  files bigint;
  bytes bigint;
begin
  if p_path is null or p_path !~ ('^workspaces/[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}/[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}'
    ||'/managed-proof-v1/[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}/[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}[.](pdf|png)$')
    or p_mime is distinct from (case when right(p_path,4)='.pdf' then 'application/pdf' else 'image/png' end)
    or p_size is null or p_size not between 1 and (case when p_mime='application/pdf' then 10485760 else 2097152 end)
    or p_verify is null
  then return false; end if;
  workspace:=split_part(p_path,'/',2)::uuid;
  uploader:=split_part(p_path,'/',3)::uuid;

  if not exists(select 1 from public.budget_workspaces w join public.profiles pr on pr.id=w.owner_id
    where w.id=workspace and w.owner_id=uploader and w.status='active' and pr.account_status='active')
  then return false; end if;

  perform pg_advisory_xact_lock(hashtextextended('managed-subscription:'||workspace||':'||uploader,0));
  select * into existing from mushavo_file_ingest.subscription_uploads where path=p_path for update;
  if found then
    if existing.state not in ('reserved','ready') or existing.expires_at<=clock_timestamp()
      or existing.byte_count<>p_size or existing.mime_type<>p_mime
    then return false; end if;

    if not p_verify then return true; end if;
    if not exists(select 1 from storage.objects where bucket_id='subscription-proofs' and name=p_path
      and metadata->>'mimetype'=p_mime and coalesce(metadata->>'size',metadata->>'contentLength')=p_size::text)
    then return false; end if;
    update mushavo_file_ingest.subscription_uploads set state='ready',
      expires_at=case when state='reserved' then clock_timestamp()+interval '30 minutes' else expires_at end
    where path=p_path;
    return true;
  end if;
  if p_verify then return false; end if;

  select count(*),coalesce(sum(byte_count),0) into files,bytes from mushavo_file_ingest.subscription_uploads
    where workspace_id=workspace and uploader_id=uploader and state in ('reserved','ready','claimed');
  if files>=8 or bytes+p_size>33554432 then return false; end if;

  insert into mushavo_file_ingest.subscription_uploads(path,workspace_id,uploader_id,mime_type,byte_count,state,expires_at)
    values(p_path,workspace,uploader,p_mime,p_size,'reserved',clock_timestamp()+interval '5 minutes');
  return true;
end;
$function$;
revoke all on function public.record_managed_subscription_upload(text,text,integer,boolean) from public,anon,authenticated;

create function mushavo_file_ingest.bind_managed_subscription_upload()
returns trigger language plpgsql security definer set search_path=pg_catalog as $function$
declare
  parent public.subscription_payments%rowtype;
begin
  if tg_op='UPDATE' and split_part(old.storage_path,'/',4)='managed-proof-v1' then
    if (new.payment_id,new.storage_path,new.mime_type,new.size_bytes,new.uploaded_by) is distinct from
       (old.payment_id,old.storage_path,old.mime_type,old.size_bytes,old.uploaded_by)
    then raise exception 'MANAGED_SUBSCRIPTION_PROOF_IMMUTABLE'; end if;
    return new;
  end if;
  if split_part(new.storage_path,'/',4) is distinct from 'managed-proof-v1' then return new; end if;
  select * into parent from public.subscription_payments where id=new.payment_id;
  if not found or auth.uid() is null or parent.submitted_by is distinct from auth.uid()
    or new.uploaded_by is distinct from auth.uid()
  then raise exception 'MANAGED_SUBSCRIPTION_PROOF_OWNER_REQUIRED'; end if;
  update mushavo_file_ingest.subscription_uploads set state='linked'
    where path=new.storage_path and workspace_id=parent.workspace_id and uploader_id=new.uploaded_by
      and mime_type=new.mime_type and byte_count=new.size_bytes and state='ready' and expires_at>clock_timestamp();
  if not found then raise exception 'MANAGED_SUBSCRIPTION_PROOF_NOT_READY'; end if;
  return new;
end;
$function$;
revoke all on function mushavo_file_ingest.bind_managed_subscription_upload() from public,anon,authenticated,service_role;

create function public.managed_subscription_cleanup_due()
returns boolean language sql stable security definer set search_path=pg_catalog as $function$
  select exists(select 1 from mushavo_file_ingest.subscription_uploads where expires_at<=statement_timestamp()
    and (state in ('reserved','ready') or (state='claimed' and lease_until<statement_timestamp())))
$function$;
revoke all on function public.managed_subscription_cleanup_due() from public,anon,authenticated;

create function public.claim_managed_subscription_cleanup(p_nonce uuid,p_epoch bigint,p_limit integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $function$
declare
  checked_at timestamptz:=clock_timestamp();
  batch jsonb;
begin
  if p_nonce is null or p_epoch is null or p_epoch not between extract(epoch from checked_at)::bigint-90
    and extract(epoch from checked_at)::bigint+30 or p_limit is null or p_limit not between 1 and 5
  then return null; end if;
  insert into mushavo_file_ingest.subscription_cleanup_dispatch values(p_nonce,checked_at) on conflict do nothing;
  if not found then return null; end if;

  with due as (
    select u.path from mushavo_file_ingest.subscription_uploads u where u.expires_at<=checked_at
      and (u.state in ('reserved','ready') or (u.state='claimed' and u.lease_until<checked_at))
      and not exists(select 1 from public.subscription_payment_proofs pr where pr.storage_path=u.path)
    order by u.expires_at,u.path limit p_limit for update of u skip locked
  ), claimed as (
    update mushavo_file_ingest.subscription_uploads u set state='claimed',cleanup_token=gen_random_uuid(),
      lease_until=checked_at+interval '1 minute' from due where u.path=due.path returning u.path,u.cleanup_token
  ) select coalesce(jsonb_agg(jsonb_build_object('object_name',path,'cleanup_token',cleanup_token)),'[]'::jsonb)
    into batch from claimed;
  return batch;
end;
$function$;
revoke all on function public.claim_managed_subscription_cleanup(uuid,bigint,integer) from public,anon,authenticated;

create function public.finish_managed_subscription_cleanup(p_path text,p_token uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog as $function$
begin
  update mushavo_file_ingest.subscription_uploads u set state='removed',cleanup_token=null,lease_until=null
    where u.path=p_path and u.state='claimed' and u.cleanup_token=p_token
      and not exists(select 1 from public.subscription_payment_proofs pr where pr.storage_path=u.path)
      and not exists(select 1 from storage.objects o where o.bucket_id='subscription-proofs' and o.name=u.path);
  return found;
end;
$function$;
revoke all on function public.finish_managed_subscription_cleanup(text,uuid) from public,anon,authenticated;

-- Reused from staging 20261115163641 security_fr_3_2_ordinary_uploads_staging; excludes the staging rollout.
create function public.fr32_is_managed_ordinary_upload(p_bucket text,p_path text)
returns boolean language sql immutable set search_path=pg_catalog as $body$
  select coalesce(case p_bucket
    when 'payment-proofs' then
      (split_part(p_path,'/',1)='personal' and split_part(p_path,'/',3)='managed-upload-v1')
      or (split_part(p_path,'/',1)='families' and split_part(p_path,'/',5)='managed-upload-v1')
    when 'business-documents' then split_part(p_path,'/',5)='managed-upload-v1'
    when 'business-logos' then split_part(p_path,'/',3) like 'f3320000-%'
    else false end,false)
$body$;
revoke all on function public.fr32_is_managed_ordinary_upload(text,text) from public;


create table mushavo_file_ingest.ordinary_uploads (
  bucket_id text not null check(bucket_id in ('payment-proofs','business-documents','business-logos')),
  path text not null check(length(path)<=512),
  workspace_id uuid not null,
  actor_id uuid not null,
  attachment_id uuid not null,
  parent_type text,
  parent_id uuid,
  mime_type text not null,
  byte_count integer not null check(byte_count between 1 and 10485760),
  state text not null check(state in ('reserved','ready','linked','claimed','removed')),
  expires_at timestamptz not null,
  lease_until timestamptz,
  token uuid,
  primary key(bucket_id,path),
  check(public.fr32_is_managed_ordinary_upload(bucket_id,path))
);
create index ordinary_upload_pending on mushavo_file_ingest.ordinary_uploads(workspace_id,actor_id)
where state in ('reserved','ready','claimed');
create index ordinary_upload_due on mushavo_file_ingest.ordinary_uploads(expires_at)
where state in ('reserved','ready','claimed');
create table mushavo_file_ingest.ordinary_cleanup_dispatch(nonce uuid primary key,issued_at timestamptz not null);
alter table mushavo_file_ingest.ordinary_uploads enable row level security;
alter table mushavo_file_ingest.ordinary_uploads force row level security;
alter table mushavo_file_ingest.ordinary_cleanup_dispatch enable row level security;
alter table mushavo_file_ingest.ordinary_cleanup_dispatch force row level security;
revoke all on mushavo_file_ingest.ordinary_uploads,mushavo_file_ingest.ordinary_cleanup_dispatch from public,anon,authenticated,service_role;

-- This RPC runs with the browser's authenticated identity, before any privileged write.
create function public.fr32_ordinary_upload_scope(p_bucket text,p_workspace uuid,p_attachment uuid,p_parent_type text,p_parent uuid)
returns text language plpgsql stable security definer set search_path=pg_catalog as $body$
declare
  actor uuid := auth.uid();
  w public.budget_workspaces%rowtype;
  family_owner uuid;
  parent_allowed boolean;
begin
  perform mushavo_email_auth.require_application_session();
  if actor is null or p_attachment is null or public.my_account_suspended() then return null; end if;
  select * into w from public.budget_workspaces where id=p_workspace and status='active';
  if not found then return null; end if;
  if p_bucket='payment-proofs' then
    if p_parent_type is not null or p_parent is not null or not exists(
      select 1 from public.effective_workspace_entitlement(p_workspace) e where e.workspace_id=p_workspace and not e.read_only
    ) then return null; end if;
    if w.workspace_type='personal' and w.owner_id=actor then
      return 'personal/'||actor||'/managed-upload-v1/'||p_attachment||'/';
    end if;
    if w.workspace_type='household' and public.is_active_family_participant(w.legacy_family_id) then
      select owner_id into family_owner from public.families where id=w.legacy_family_id;
      if found then return 'families/'||w.legacy_family_id||'/'||family_owner||'/'||actor||'/managed-upload-v1/'||p_attachment||'/'; end if;
    end if;
    return null;
  end if;
  if w.workspace_type<>'business' then return null; end if;
  if p_bucket='business-logos' then
    if p_parent_type is not null or p_parent is not null or left(p_attachment::text,8)<>'f3320000'
      or not public.business_logo_owner(p_workspace||'/'||actor||'/'||p_attachment||'.png')
    then return null; end if;
    return p_workspace||'/'||actor||'/';
  end if;
  if p_bucket<>'business-documents' or p_parent is null or not public.business_has_permission(p_workspace,'documents.create')
  then return null; end if;
  parent_allowed := case p_parent_type
    when 'workspace' then p_parent=p_workspace
    when 'profile' then p_parent=p_workspace
    when 'expense_claim' then exists(select 1 from public.business_expense_claims
      where id=p_parent and workspace_id=p_workspace and submitted_by=actor and status in ('draft','changes_requested'))
    when 'business_bill' then public.business_can_view_bill_document(p_workspace,p_parent_type,p_parent)
    when 'business_bill_payment' then public.business_can_view_bill_document(p_workspace,p_parent_type,p_parent)
    when 'dimension' then exists(select 1 from public.business_dimensions where id=p_parent and workspace_id=p_workspace)
    when 'category' then exists(select 1 from public.business_categories where id=p_parent and workspace_id=p_workspace)
    else false end;
  if parent_allowed is not true then return null; end if;
  return 'workspaces/'||p_workspace||'/'||actor||'/'||p_attachment||'/managed-upload-v1/';
end;
$body$;
revoke all on function public.fr32_ordinary_upload_scope(text,uuid,uuid,text,uuid) from public,anon,service_role;

create function public.fr32_record_ordinary_upload(p_bucket text,p_path text,p_workspace uuid,p_actor uuid,
  p_attachment uuid,p_parent_type text,p_parent uuid,p_mime text,p_size integer,p_verify boolean)
returns boolean language plpgsql security definer set search_path=pg_catalog as $body$
declare
  existing mushavo_file_ingest.ordinary_uploads%rowtype;
  extension text;
  files bigint;
  bytes bigint;
begin
  extension:=case p_mime when 'application/pdf' then 'pdf' when 'image/png' then 'png' when 'text/csv' then 'csv'
    when 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' then 'xlsx' end;
  if extension is null or p_size is null or p_verify is null or p_workspace is null or p_actor is null or p_attachment is null
    or p_size not between 1 and 10485760 or not public.fr32_is_managed_ordinary_upload(p_bucket,p_path)
    or length(p_path)>512 or right(p_path,length(extension)+1)<>('.'||extension)
    or (p_bucket='business-logos' and (p_size>2097152 or p_mime<>'image/png'
      or p_path<>(p_workspace||'/'||p_actor||'/'||p_attachment||'.png')))
    or (p_bucket='payment-proofs' and p_mime not in ('application/pdf','image/png'))
    or (extension in ('csv','xlsx') and (p_bucket<>'business-documents' or p_size>2097152))
  then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('ordinary-upload:'||p_workspace||':'||p_actor,0));
  select * into existing from mushavo_file_ingest.ordinary_uploads where bucket_id=p_bucket and path=p_path for update;
  if found then
    if existing.state not in ('reserved','ready') or existing.expires_at<=clock_timestamp()
      or (existing.workspace_id,existing.actor_id,existing.attachment_id,existing.parent_type,existing.parent_id,existing.mime_type,existing.byte_count)
      is distinct from (p_workspace,p_actor,p_attachment,p_parent_type,p_parent,p_mime,p_size)
    then return false; end if;
    if not p_verify then return true; end if;
    if not exists(select 1 from storage.objects where bucket_id=p_bucket and name=p_path
      and metadata->>'mimetype'=p_mime and coalesce(metadata->>'size',metadata->>'contentLength')=p_size::text)
    then return false; end if;
    update mushavo_file_ingest.ordinary_uploads set state='ready',
      expires_at=case when state='reserved' then clock_timestamp()+interval '30 minutes' else expires_at end
      where bucket_id=p_bucket and path=p_path;
    return true;
  end if;
  if p_verify then return false; end if;
  select count(*),coalesce(sum(byte_count),0) into files,bytes from mushavo_file_ingest.ordinary_uploads
    where workspace_id=p_workspace and actor_id=p_actor and state in ('reserved','ready','claimed');
  if files>=8 or bytes+p_size>33554432 then return false; end if;
  insert into mushavo_file_ingest.ordinary_uploads(bucket_id,path,workspace_id,actor_id,attachment_id,parent_type,parent_id,mime_type,byte_count,state,expires_at)
  values(p_bucket,p_path,p_workspace,p_actor,p_attachment,p_parent_type,p_parent,p_mime,p_size,'reserved',clock_timestamp()+interval '5 minutes');
  return true;
end;
$body$;
revoke all on function public.fr32_record_ordinary_upload(text,text,uuid,uuid,uuid,text,uuid,text,integer,boolean) from public,anon,authenticated;

create function mushavo_file_ingest.bind_ordinary_upload()
returns trigger language plpgsql security definer set search_path=pg_catalog as $body$
declare
  j jsonb:=to_jsonb(new);
  old_row jsonb:=to_jsonb(old);
  bucket text;
  path_field text;
  file_path text;
  mime text;
  size_bytes bigint;
  actor uuid:=auth.uid();
  workspace uuid;
begin
  case tg_table_name
    when 'payment_records' then bucket:='payment-proofs'; path_field:='proof_path';
      mime:=j->>'proof_mime_type'; size_bytes:=(j->>'proof_size_bytes')::bigint;
    when 'business_documents' then bucket:='business-documents'; path_field:='storage_path';
      mime:=j->>'mime_type'; size_bytes:=(j->>'size_bytes')::bigint;
    when 'business_profiles' then bucket:='business-logos'; path_field:='logo_storage_path';
    else raise exception 'MANAGED_UPLOAD_UNEXPECTED_TABLE';
  end case;
  file_path:=j->>path_field;
  workspace:=(j->>'workspace_id')::uuid;
  if tg_op='UPDATE' and public.fr32_is_managed_ordinary_upload(bucket,old_row->>path_field) then
    if bucket<>'business-logos' and (
      j->path_field,j->'workspace_id',j->'owner_id',j->'family_id',j->'recorded_by',j->'payment_item_id',
      j->'proof_mime_type',j->'proof_size_bytes',j->'uploaded_by',j->'parent_id',j->'parent_type',j->'mime_type',j->'size_bytes'
    ) is distinct from (
      old_row->path_field,old_row->'workspace_id',old_row->'owner_id',old_row->'family_id',old_row->'recorded_by',old_row->'payment_item_id',
      old_row->'proof_mime_type',old_row->'proof_size_bytes',old_row->'uploaded_by',old_row->'parent_id',old_row->'parent_type',old_row->'mime_type',old_row->'size_bytes'
    ) then raise exception 'MANAGED_UPLOAD_REFERENCE_IMMUTABLE'; end if;
    if (j->>path_field) is not distinct from (old_row->>path_field) then return new; end if;
  end if;
  if not public.fr32_is_managed_ordinary_upload(bucket,file_path) then return new; end if;
  update mushavo_file_ingest.ordinary_uploads u set state='linked'
    where u.bucket_id=bucket and u.path=file_path and u.workspace_id=workspace and u.actor_id=actor
      and u.state='ready' and u.expires_at>clock_timestamp()
      and (bucket='business-logos' or (u.mime_type=mime and u.byte_count=size_bytes))
      and (bucket<>'payment-proofs' or (j->>'recorded_by')::uuid=actor)
      and (bucket<>'business-documents' or ((j->>'uploaded_by')::uuid=actor
        and (j->>'id')::uuid=u.attachment_id and (j->>'parent_id')::uuid=u.parent_id and j->>'parent_type'=u.parent_type));
  if not found then raise exception 'MANAGED_UPLOAD_NOT_READY_FOR_THIS_RECORD'; end if;
  return new;
end;
$body$;
revoke all on function mushavo_file_ingest.bind_ordinary_upload() from public,anon,authenticated,service_role;

create function mushavo_file_ingest.retire_ordinary_upload()
returns trigger language plpgsql security definer set search_path=pg_catalog as $body$
declare
  j jsonb:=to_jsonb(old);
  bucket text:=case tg_table_name when 'payment_records' then 'payment-proofs' else 'business-documents' end;
  old_path text;
begin
  old_path:=case bucket when 'payment-proofs' then j->>'proof_path' else j->>'storage_path' end;
  if public.fr32_is_managed_ordinary_upload(bucket,old_path) then
    update mushavo_file_ingest.ordinary_uploads set state='ready',expires_at=clock_timestamp()
      where bucket_id=bucket and path=old_path and state='linked';
  end if;
  return old;
end;
$body$;
revoke all on function mushavo_file_ingest.retire_ordinary_upload() from public,anon,authenticated,service_role;

create function mushavo_file_ingest.ordinary_upload_has_reference(p_bucket text,p_path text)
returns boolean language sql stable set search_path=pg_catalog as $body$
  select case p_bucket
    when 'payment-proofs' then exists(select 1 from public.payment_records where proof_path=p_path)
    when 'business-documents' then exists(select 1 from public.business_documents where storage_path=p_path)
    when 'business-logos' then exists(select 1 from public.business_profiles where logo_storage_path=p_path)
    else true end
$body$;
revoke all on function mushavo_file_ingest.ordinary_upload_has_reference(text,text) from public,anon,authenticated,service_role;

create function public.fr32_ordinary_cleanup_due()
returns boolean language sql stable security definer set search_path=pg_catalog as $body$
  select exists(select 1 from mushavo_file_ingest.ordinary_uploads where expires_at<=statement_timestamp()
    and (state in ('reserved','ready') or (state='claimed' and lease_until<statement_timestamp())))
$body$;
revoke all on function public.fr32_ordinary_cleanup_due() from public,anon,authenticated;

create function public.fr32_claim_ordinary_cleanup(p_nonce uuid,p_epoch bigint,p_limit integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $body$
declare
  checked_at timestamptz:=clock_timestamp();
  batch jsonb;
begin
  if p_nonce is null or p_epoch is null or p_epoch not between extract(epoch from checked_at)::bigint-90
    and extract(epoch from checked_at)::bigint+30 or p_limit is null or p_limit not between 1 and 5
  then return null; end if;
  insert into mushavo_file_ingest.ordinary_cleanup_dispatch values(p_nonce,checked_at) on conflict do nothing;
  if not found then return null; end if;
  with eligible as (
    select u.bucket_id,u.path from mushavo_file_ingest.ordinary_uploads u where u.expires_at<=checked_at
    and (u.state in ('reserved','ready') or (u.state='claimed' and u.lease_until<checked_at))
    and not mushavo_file_ingest.ordinary_upload_has_reference(u.bucket_id,u.path)
    order by u.expires_at,u.bucket_id,u.path limit p_limit for update of u skip locked
  ), claimed as (
    update mushavo_file_ingest.ordinary_uploads u set state='claimed',token=gen_random_uuid(),
      lease_until=checked_at+interval '1 minute' from eligible e
      where u.bucket_id=e.bucket_id and u.path=e.path returning u.bucket_id,u.path,u.token
  ) select coalesce(jsonb_agg(jsonb_build_object('bucket_id',bucket_id,'object_name',path,'cleanup_token',token)),'[]'::jsonb)
    into batch from claimed;
  return batch;
end;
$body$;
revoke all on function public.fr32_claim_ordinary_cleanup(uuid,bigint,integer) from public,anon,authenticated;

create function public.fr32_finish_ordinary_cleanup(p_bucket text,p_path text,p_token uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog as $body$
begin
  update mushavo_file_ingest.ordinary_uploads u set state='removed',token=null,lease_until=null
    where u.bucket_id=p_bucket and u.path=p_path and u.state='claimed' and u.token=p_token
      and not mushavo_file_ingest.ordinary_upload_has_reference(u.bucket_id,u.path)
      and not exists(select 1 from storage.objects where bucket_id=p_bucket and name=p_path);
  return found;
end;
$body$;
revoke all on function public.fr32_finish_ordinary_cleanup(text,text,uuid) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.record_managed_subscription_upload(p_path text, p_mime text, p_size integer, p_verify boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  workspace uuid;
  uploader uuid;
  existing mushavo_file_ingest.subscription_uploads%rowtype;
  files bigint;
  bytes bigint;
begin
  if p_path is null or p_path !~ ('^workspaces/[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}/[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}'
    ||'/managed-proof-v1/[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}/[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}[.](pdf|png)$')
    or p_mime is distinct from (case when right(p_path,4)='.pdf' then 'application/pdf' else 'image/png' end)
    or p_size is null or p_size not between 1 and 10485760
    or p_verify is null
  then return false; end if;
  workspace:=split_part(p_path,'/',2)::uuid;
  uploader:=split_part(p_path,'/',3)::uuid;

  if not exists(select 1 from public.budget_workspaces w join public.profiles pr on pr.id=w.owner_id
    where w.id=workspace and w.owner_id=uploader and w.status='active' and pr.account_status='active')
  then return false; end if;

  perform pg_advisory_xact_lock(hashtextextended('managed-subscription:'||workspace||':'||uploader,0));
  select * into existing from mushavo_file_ingest.subscription_uploads where path=p_path for update;
  if found then
    if existing.state not in ('reserved','ready') or existing.expires_at<=clock_timestamp()
      or existing.byte_count<>p_size or existing.mime_type<>p_mime
    then return false; end if;

    if not p_verify then return true; end if;
    if not exists(select 1 from storage.objects where bucket_id='subscription-proofs' and name=p_path
      and metadata->>'mimetype'=p_mime and coalesce(metadata->>'size',metadata->>'contentLength')=p_size::text)
    then return false; end if;
    update mushavo_file_ingest.subscription_uploads set state='ready',
      expires_at=case when state='reserved' then clock_timestamp()+interval '30 minutes' else expires_at end
    where path=p_path;
    return true;
  end if;
  if p_verify then return false; end if;

  select count(*),coalesce(sum(byte_count),0) into files,bytes from mushavo_file_ingest.subscription_uploads
    where workspace_id=workspace and uploader_id=uploader and state in ('reserved','ready','claimed');
  if files>=8 or bytes+p_size>33554432 then return false; end if;

  insert into mushavo_file_ingest.subscription_uploads(path,workspace_id,uploader_id,mime_type,byte_count,state,expires_at)
    values(p_path,workspace,uploader,p_mime,p_size,'reserved',clock_timestamp()+interval '5 minutes');
  return true;
end;
$function$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mushavo_file_ingest FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION
  public.claim_managed_subscription_cleanup(uuid,bigint,integer),
  public.finish_managed_subscription_cleanup(text,uuid),
  public.fr32_claim_logo_replacements(uuid,bigint,integer),
  public.fr32_claim_ordinary_cleanup(uuid,bigint,integer),
  public.fr32_finish_logo_replacement(text,uuid),
  public.fr32_finish_ordinary_cleanup(text,text,uuid),
  public.fr32_is_managed_ordinary_upload(text,text),
  public.fr32_logo_replacement_mode(),
  public.fr32_ordinary_cleanup_due(),
  public.fr32_ordinary_upload_scope(text,uuid,uuid,text,uuid),
  public.fr32_record_ordinary_upload(text,text,uuid,uuid,uuid,text,uuid,text,integer,boolean),
  public.managed_subscription_cleanup_due(),
  public.record_managed_subscription_upload(text,text,integer,boolean)
  FROM PUBLIC,anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
