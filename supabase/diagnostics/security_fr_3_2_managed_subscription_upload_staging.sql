-- Install managed ordinary subscription proof uploads on the exact staging catalog.
begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(20261017,2411);
do $preflight$
begin
  if not exists (select 1 from mushavo_email_install.rollout_control where singleton and mode='ACTIVE'
    and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='757155d4b82e51fab557a5990348a5ca64ad953eee7d2b1fc2a483f87e0aa6e0'
    and catalog_sha256=mushavo_email_install.catalog_identity())
    or not exists(select 1 from storage.buckets where id='subscription-proofs' and not public)
  then raise exception 'EXACT_MANAGED_UPLOAD_STAGING_BASELINE_REQUIRED'; end if;
end;
$preflight$;

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

create policy managed_subscription_no_client_insert on storage.objects as restrictive for insert to anon,authenticated
with check (bucket_id<>'subscription-proofs' or split_part(name,'/',4)<>'managed-proof-v1');
create policy managed_subscription_no_client_update on storage.objects as restrictive for update to anon,authenticated
using (bucket_id<>'subscription-proofs' or split_part(name,'/',4)<>'managed-proof-v1')
with check (bucket_id<>'subscription-proofs' or split_part(name,'/',4)<>'managed-proof-v1');
create policy managed_subscription_no_client_delete on storage.objects as restrictive for delete to anon,authenticated
using (bucket_id<>'subscription-proofs' or split_part(name,'/',4)<>'managed-proof-v1');

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
grant execute on function public.record_managed_subscription_upload(text,text,integer,boolean) to service_role;

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
create trigger z_fr32_bind_managed_subscription_upload before insert or update
  on public.subscription_payment_proofs for each row execute function mushavo_file_ingest.bind_managed_subscription_upload();

create function public.managed_subscription_cleanup_due()
returns boolean language sql stable security definer set search_path=pg_catalog as $function$
  select exists(select 1 from mushavo_file_ingest.subscription_uploads where expires_at<=statement_timestamp()
    and (state in ('reserved','ready') or (state='claimed' and lease_until<statement_timestamp())))
$function$;
revoke all on function public.managed_subscription_cleanup_due() from public,anon,authenticated;
grant execute on function public.managed_subscription_cleanup_due() to service_role;

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
grant execute on function public.claim_managed_subscription_cleanup(uuid,bigint,integer) to service_role;

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
grant execute on function public.finish_managed_subscription_cleanup(text,uuid) to service_role;

update mushavo_email_install.rollout_control set catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
where singleton and catalog_sha256='757155d4b82e51fab557a5990348a5ca64ad953eee7d2b1fc2a483f87e0aa6e0' and mode='ACTIVE' and target_project='dczlddwbtgvfdujgcitb';
notify pgrst,'reload schema';
commit;
