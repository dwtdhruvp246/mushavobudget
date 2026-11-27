-- Staging only. Preserve legacy rows while protecting the managed upload namespace.
begin;
set local search_path=pg_catalog;
set local lock_timeout='5s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(20261017,2411);

do $guard$
begin
  if not exists(select 1 from mushavo_email_install.rollout_control where singleton and mode='ACTIVE'
    and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='eeb72286f341c7e5028c0071aefa99abc612a7a4863c48968e73ba52b8a6dbe0'
    and catalog_sha256=mushavo_email_install.catalog_identity())
   or (select count(*) from storage.buckets where id in ('payment-proofs','subscription-proofs','business-documents','business-logos') and not public)<>4
   or exists(select 1 from storage.objects where bucket_id='business-logos' and split_part(name,'/',3) like 'f3320000-%')
  then raise exception 'EXACT_ORDINARY_UPLOAD_STAGING_BASELINE_REQUIRED'; end if;
end;
$guard$;

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
grant execute on function public.fr32_is_managed_ordinary_upload(text,text) to anon,authenticated,service_role;

create policy fr32_ordinary_upload_client_insert on storage.objects as restrictive for insert to anon,authenticated
with check (not public.fr32_is_managed_ordinary_upload(bucket_id,name));
create policy fr32_ordinary_upload_client_update on storage.objects as restrictive for update to anon,authenticated
using (not public.fr32_is_managed_ordinary_upload(bucket_id,name))
with check (not public.fr32_is_managed_ordinary_upload(bucket_id,name));
create policy fr32_ordinary_upload_client_delete on storage.objects as restrictive for delete to anon,authenticated
using (not public.fr32_is_managed_ordinary_upload(bucket_id,name));

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
grant execute on function public.fr32_ordinary_upload_scope(text,uuid,uuid,text,uuid) to authenticated;

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
grant execute on function public.fr32_record_ordinary_upload(text,text,uuid,uuid,uuid,text,uuid,text,integer,boolean) to service_role;

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
create trigger zz_fr32_bind_ordinary_upload before insert or update on public.payment_records
for each row execute function mushavo_file_ingest.bind_ordinary_upload();
create trigger zz_fr32_bind_ordinary_upload before insert or update on public.business_documents
for each row execute function mushavo_file_ingest.bind_ordinary_upload();
create trigger zz_fr32_bind_ordinary_upload before insert or update on public.business_profiles
for each row execute function mushavo_file_ingest.bind_ordinary_upload();

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
create trigger zz_fr32_retire_ordinary_upload after delete on public.payment_records
for each row execute function mushavo_file_ingest.retire_ordinary_upload();
create trigger zz_fr32_retire_ordinary_upload after delete on public.business_documents
for each row execute function mushavo_file_ingest.retire_ordinary_upload();

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
grant execute on function public.fr32_ordinary_cleanup_due() to service_role;

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
grant execute on function public.fr32_claim_ordinary_cleanup(uuid,bigint,integer) to service_role;

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
grant execute on function public.fr32_finish_ordinary_cleanup(text,text,uuid) to service_role;

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

update mushavo_email_install.rollout_control set catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
where singleton and catalog_sha256='eeb72286f341c7e5028c0071aefa99abc612a7a4863c48968e73ba52b8a6dbe0' and mode='ACTIVE' and target_project='dczlddwbtgvfdujgcitb';
notify pgrst,'reload schema';
commit;
