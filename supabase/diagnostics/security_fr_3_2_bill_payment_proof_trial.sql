-- Staging only. Keep the original unpaid bill and create an isolated paid bill to test the ordinary immutable proof route.
begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
set local statement_timeout='20s';
select pg_advisory_xact_lock(20261017,2411);
do $preflight$
declare touched integer;
begin
 if not exists(select 1 from mushavo_email_install.rollout_control where singleton and mode='ACTIVE'
   and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='93d03fb064a2954fd717e26f78c9d36c1a5fd9628c33fb63586b09413619cad6' and catalog_sha256=mushavo_email_install.catalog_identity())
  or (select md5(prosrc) from pg_proc where oid='public.register_business_document(uuid,uuid,text,uuid,text,text,text,bigint,text)'::regprocedure) is distinct from '0ea51265182201880e9e7deb0a74aa29'
  or not exists(select 1 from public.budget_workspaces w where w.id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and w.owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'
    and w.name='audit-fr3-logo-ingestion-20261112' and w.status='suspended' and w.business_support_version=48)
  or not exists(select 1 from public.business_bills where id='ac975ebd-b138-40c4-a082-c6e62670a98a' and workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2'
    and supplier_id='ae0dbe86-b43f-47ef-b5a4-fe5267c22bb5' and category_id='30e26d05-6db0-4e24-a009-bde0db05a7fb' and status='open' and paid_amount=0)
  or exists(select 1 from public.business_documents where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and status='active' or id='ef6fb184-5e10-44b8-9d8a-a4ed532733c7')
  or exists(select 1 from public.business_bills where id='509ea1cd-6182-404c-bf52-46d33ea05a3c')
  or exists(select 1 from public.business_bill_payments where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' or id='89fd5fb1-d177-4c3a-ad7a-3ba4ec34a120')
  or exists(select 1 from storage.objects where bucket_id='business-documents' and name like 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/%')
  or exists(select 1 from mushavo_file_ingest.workspace_limits where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and enabled)
  or public.fr3_lifecycle_trial_ready()
 then raise exception 'EXACT_PAID_PROOF_FIXTURE_REQUIRED'; end if;
 update public.business_profiles set onboarding_status='complete' where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2'
   and onboarding_status='in_progress' and version=21 and updated_at='2026-11-14 14:51:12.698067+00';
 get diagnostics touched=row_count;
 if touched<>1 then raise exception 'EXACT_BILL_PAYMENT_ONBOARDING_REQUIRED'; end if;
 update public.workspace_subscriptions set paid_through_at='2026-11-15 10:09:41.784914+00'
   where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and status='active' and version=1 and member_limit=1 and paid_through_at='2026-11-14 00:00:00+00';
 get diagnostics touched=row_count;
 if touched<>1 then raise exception 'EXACT_BILL_PAYMENT_TERM_REQUIRED'; end if;
 insert into public.business_bills(id,workspace_id,supplier_id,title,category_id,amount,currency,reporting_currency,reporting_amount,
  exchange_rate,rate_effective_at,rate_provider,paid_amount,status,due_on,remind_days_before,created_by)
 values('509ea1cd-6182-404c-bf52-46d33ea05a3c','8d9307e6-aada-4c9a-a8f5-43c57e0865e2','ae0dbe86-b43f-47ef-b5a4-fe5267c22bb5','FR3 synthetic paid bill attachment','30e26d05-6db0-4e24-a009-bde0db05a7fb',
   1,'USD','USD',1,1,clock_timestamp(),'identity',1,'paid',current_date,0,'ca7bdcf2-e69d-42e2-8ae8-79cac6de2184');
 insert into public.business_bill_payments(id,workspace_id,bill_id,amount,currency,reporting_amount,reporting_currency,exchange_rate,
  rate_effective_at,rate_provider,paid_at,reference,recorded_by)
 values('89fd5fb1-d177-4c3a-ad7a-3ba4ec34a120','8d9307e6-aada-4c9a-a8f5-43c57e0865e2','509ea1cd-6182-404c-bf52-46d33ea05a3c',1,'USD',1,'USD',1,clock_timestamp(),'identity',clock_timestamp(),
   'FR3 isolated test payment','ca7bdcf2-e69d-42e2-8ae8-79cac6de2184');
end;
$preflight$;

CREATE OR REPLACE FUNCTION public.register_business_document(p_document_id uuid, p_workspace_id uuid, p_parent_type text, p_parent_id uuid, p_storage_path text, p_original_name text, p_mime_type text, p_size_bytes bigint, p_checksum_sha256 text DEFAULT NULL::text)
 RETURNS public.business_documents
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'storage', 'pg_temp'
AS $function$
BEGIN
  PERFORM mushavo_email_auth.require_application_session();

declare
  v_result public.business_documents%rowtype;
  v_object_mime text;
  v_object_size bigint;
begin
  if not public.business_claims_active(p_workspace_id)
    or not public.business_has_permission(p_workspace_id, 'documents.create')
    then raise exception 'BUSINESS_DOCUMENT_ACCESS_REQUIRED'; end if;
  if p_parent_type = 'expense_claim' and not exists (
    select 1 from public.business_expense_claims
    where id = p_parent_id and workspace_id = p_workspace_id
      and submitted_by = auth.uid() and status in ('draft', 'changes_requested')
  ) then raise exception 'BUSINESS_CLAIM_RECEIPT_ACCESS_REQUIRED'; end if;
  if p_document_id is null or p_storage_path is null or p_storage_path like '%..%'
    or p_storage_path not like ('workspaces/' || p_workspace_id::text || '/'
      || auth.uid()::text || '/' || p_document_id::text || '/%')
    then raise exception 'INVALID_BUSINESS_DOCUMENT_PATH'; end if;
  if (p_document_id = '75e6c01e-e490-4e83-9774-618867654b24' or starts_with(p_storage_path, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/75e6c01e-e490-4e83-9774-618867654b24/'))
    and (p_document_id is distinct from '75e6c01e-e490-4e83-9774-618867654b24'::uuid or p_workspace_id is distinct from '8d9307e6-aada-4c9a-a8f5-43c57e0865e2'::uuid
      or auth.uid() is distinct from 'ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'::uuid or p_parent_type is distinct from 'workspace'
      or p_parent_id is distinct from '8d9307e6-aada-4c9a-a8f5-43c57e0865e2'::uuid or not starts_with(p_storage_path, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/75e6c01e-e490-4e83-9774-618867654b24/')
      or substring(p_storage_path from length('workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/75e6c01e-e490-4e83-9774-618867654b24/') + 1) !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}[.](png|pdf)$'
      or p_mime_type is distinct from (case when right(p_storage_path,4)='.pdf' then 'application/pdf' else 'image/png' end)
      or p_size_bytes is null or p_size_bytes not between 1 and 2097152)
  then raise exception 'EXACT_BUSINESS_DOCUMENT_FIXTURE_PATH_REQUIRED'; end if;
  if exists (
    select 1 from (values
        ('90545cd6-af7c-464f-8864-45fb905f7f92'::uuid, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/90545cd6-af7c-464f-8864-45fb905f7f92/', 'csv', 'text/csv'),
        ('90d83c56-a450-4fb2-9d45-bf4dc652b357'::uuid, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/90d83c56-a450-4fb2-9d45-bf4dc652b357/', 'xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    ) v(document_id, prefix, extension, mime_type)
    where (p_document_id = v.document_id or starts_with(p_storage_path, v.prefix))
      and (p_document_id is distinct from v.document_id or p_workspace_id is distinct from '8d9307e6-aada-4c9a-a8f5-43c57e0865e2'::uuid
        or auth.uid() is distinct from 'ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'::uuid or p_parent_type is distinct from 'workspace'
        or p_parent_id is distinct from '8d9307e6-aada-4c9a-a8f5-43c57e0865e2'::uuid or not starts_with(p_storage_path, v.prefix)
        or substring(p_storage_path from length(v.prefix) + 1) !~ ('^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}[.]' || v.extension || '$')
        or p_mime_type is distinct from v.mime_type or p_size_bytes is null or p_size_bytes not between 1 and 2097152)
  ) then raise exception 'EXACT_BUSINESS_TABLE_FIXTURE_PATH_REQUIRED'; end if;
  if exists (
    select 1 from (values ('7d488239-ba6e-440e-8be1-5e255b2ead79'::uuid, '454e6059-4b4c-4998-aa9d-ea932b15ca50'::uuid, 'expense_claim', 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/7d488239-ba6e-440e-8be1-5e255b2ead79/'),
      ('c877b770-3bb6-4e0c-aae3-a6a10f3234f6'::uuid, 'ac975ebd-b138-40c4-a082-c6e62670a98a'::uuid, 'business_bill', 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/c877b770-3bb6-4e0c-aae3-a6a10f3234f6/'),
      ('7b7e5da1-ff93-44a0-91e0-2dd6a400cac3'::uuid, '454e6059-4b4c-4998-aa9d-ea932b15ca50'::uuid, 'expense_claim', 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/7b7e5da1-ff93-44a0-91e0-2dd6a400cac3/')) v(document_id, parent_id, parent_type, prefix)
    where (p_document_id=v.document_id or starts_with(p_storage_path,v.prefix))
    and (p_document_id is distinct from v.document_id or p_parent_type is distinct from v.parent_type
      or p_parent_id is distinct from v.parent_id or p_workspace_id is distinct from '8d9307e6-aada-4c9a-a8f5-43c57e0865e2'::uuid
      or auth.uid() is distinct from 'ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'::uuid or not starts_with(p_storage_path,v.prefix)
      or substring(p_storage_path from length(v.prefix) + 1) !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}[.](png|pdf)$'
      or p_mime_type is distinct from (case when right(p_storage_path,4)='.pdf' then 'application/pdf' else 'image/png' end)
      or p_size_bytes is null or p_size_bytes not between 1 and 2097152)
  ) then raise exception 'EXACT_BUSINESS_ATTACHMENT_FIXTURE_PATH_REQUIRED'; end if;
  if (p_document_id='ef6fb184-5e10-44b8-9d8a-a4ed532733c7'::uuid or starts_with(p_storage_path,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/ef6fb184-5e10-44b8-9d8a-a4ed532733c7/'))
    and (p_document_id is distinct from 'ef6fb184-5e10-44b8-9d8a-a4ed532733c7'::uuid or p_workspace_id is distinct from '8d9307e6-aada-4c9a-a8f5-43c57e0865e2'::uuid
      or auth.uid() is distinct from 'ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'::uuid or p_parent_type is distinct from 'business_bill_payment'
      or p_parent_id is distinct from '89fd5fb1-d177-4c3a-ad7a-3ba4ec34a120'::uuid or not starts_with(p_storage_path,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/ef6fb184-5e10-44b8-9d8a-a4ed532733c7/')
      or substring(p_storage_path from length('workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/ef6fb184-5e10-44b8-9d8a-a4ed532733c7/')+1) !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}[.]pdf$'
      or p_mime_type is distinct from 'application/pdf' or p_size_bytes is null or p_size_bytes not between 1 and 2097152)
  then raise exception 'EXACT_BILL_PAYMENT_PROOF_PATH_REQUIRED'; end if;
  select o.metadata->>'mimetype', case
      when coalesce(o.metadata->>'size',o.metadata->>'contentLength') ~ '^[0-9]{1,8}$'
      then coalesce(o.metadata->>'size',o.metadata->>'contentLength')::bigint
    end into v_object_mime, v_object_size
    from storage.objects o
    where o.bucket_id = 'business-documents' and o.name = p_storage_path for share;
  if not found then raise exception 'BUSINESS_DOCUMENT_UPLOAD_NOT_FOUND'; end if;
  if v_object_mime is null or v_object_mime is distinct from p_mime_type
    or v_object_size is null or v_object_size not between 1 and 10485760
    or v_object_size is distinct from p_size_bytes
    then raise exception 'BUSINESS_DOCUMENT_METADATA_MISMATCH'; end if;
  insert into public.business_documents (
    id, workspace_id, parent_type, parent_id, storage_path, original_name,
    mime_type, size_bytes, checksum_sha256, uploaded_by
  ) values (
    p_document_id, p_workspace_id, p_parent_type, p_parent_id, p_storage_path,
    btrim(p_original_name), p_mime_type, p_size_bytes,
    nullif(lower(btrim(p_checksum_sha256)), ''), auth.uid()
  ) returning * into v_result;
  perform public.business_record_audit_event(
    p_workspace_id, 'business.document_registered', 'business_document', v_result.id,
    '{}'::jsonb, jsonb_build_object('parent_type', v_result.parent_type,
      'parent_id', v_result.parent_id, 'mime_type', v_result.mime_type,
      'size_bytes', v_result.size_bytes)
  );
  return v_result;
end;

END;
$function$;
create policy fr3_bill_payment_proof_server_insert on storage.objects as restrictive
 for insert to authenticated, anon with check (bucket_id <> 'business-documents' or not starts_with(name,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/ef6fb184-5e10-44b8-9d8a-a4ed532733c7/'));
create policy fr3_bill_payment_proof_server_update on storage.objects as restrictive
 for update to authenticated, anon using (bucket_id <> 'business-documents' or not starts_with(name,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/ef6fb184-5e10-44b8-9d8a-a4ed532733c7/')) with check (bucket_id <> 'business-documents' or not starts_with(name,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/ef6fb184-5e10-44b8-9d8a-a4ed532733c7/'));
create function public.fr3_bill_payment_proof_gate_ready()
returns boolean language sql stable security invoker set search_path=pg_catalog
as $$
 select (select relrowsecurity from pg_class where oid='storage.objects'::regclass)
   and exists(select 1 from public.budget_workspaces w join public.workspace_subscriptions sub on sub.workspace_id=w.id
     join public.business_bill_payments p on p.workspace_id=w.id
     where w.id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and w.owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and w.status='active' and w.business_support_version=49
       and sub.status='active' and sub.paid_through_at>now() and p.id='89fd5fb1-d177-4c3a-ad7a-3ba4ec34a120' and p.bill_id='509ea1cd-6182-404c-bf52-46d33ea05a3c' and p.recorded_by='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184')
   and (select count(*)=2 from pg_policy p cross join (values($policy$((bucket_id <> 'business-documents'::text) OR (NOT starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/ef6fb184-5e10-44b8-9d8a-a4ed532733c7/'::text)))$policy$)) v(expr)
       where p.polrelid='storage.objects'::regclass and not p.polpermissive
       and p.polroles @> array[to_regrole('anon')::oid,to_regrole('authenticated')::oid]
       and pg_get_expr(p.polwithcheck,p.polrelid)=v.expr
       and ((p.polname='fr3_bill_payment_proof_server_insert' and p.polcmd='a' and p.polqual is null)
       or (p.polname='fr3_bill_payment_proof_server_update' and p.polcmd='w' and pg_get_expr(p.polqual,p.polrelid)=v.expr)));
$$;
revoke all on function public.fr3_bill_payment_proof_gate_ready() from public,anon,authenticated;
grant execute on function public.fr3_bill_payment_proof_gate_ready() to service_role;
CREATE OR REPLACE FUNCTION public.fr3_reserve_trial_download(p_user uuid, p_path text, p_size integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare checked_at timestamptz := clock_timestamp();
begin
 if p_user is distinct from 'ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'::uuid or p_path is null or (not starts_with(p_path,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/32ea8cbf-0a6c-43cc-a21a-42dfe989b424/') and not starts_with(p_path,'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/ef6fb184-5e10-44b8-9d8a-a4ed532733c7/'))
   or p_size is null or p_size not between 1 and 4096 or (not public.fr3_lifecycle_trial_ready() and not public.fr3_bill_payment_proof_gate_ready())
   or not exists(select 1 from public.business_documents d where d.id in ('32ea8cbf-0a6c-43cc-a21a-42dfe989b424','ef6fb184-5e10-44b8-9d8a-a4ed532733c7') and d.workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2'
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
$function$;
update mushavo_email_install.rollout_control set catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
where singleton and mode='ACTIVE' and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='93d03fb064a2954fd717e26f78c9d36c1a5fd9628c33fb63586b09413619cad6';
notify pgrst,'reload schema';
commit;
