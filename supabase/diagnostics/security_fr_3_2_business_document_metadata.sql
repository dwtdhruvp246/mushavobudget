-- Staging only. Require Storage metadata before registering a Business document.
begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
set local statement_timeout='20s';
select pg_advisory_xact_lock(20261017,2411);
do $preflight$
begin
  if not exists (select 1 from mushavo_email_install.rollout_control where singleton and mode='ACTIVE'
    and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='56f6f3ede94013d0c51903e98f793b0969466d7968b0f6360487126b42eb6449'
    and catalog_sha256=mushavo_email_install.catalog_identity())
    or (select md5(prosrc) from pg_proc where oid=
      'public.register_business_document(uuid,uuid,text,uuid,text,text,text,bigint,text)'::regprocedure) is distinct from 'e55af2d44a296ed19361fd5aa06073e7'
  then raise exception 'EXACT_BUSINESS_DOCUMENT_STAGING_BASELINE_REQUIRED'; end if;
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
create policy fr3_business_document_server_insert on storage.objects as restrictive for insert to authenticated, anon with check (bucket_id <> 'business-documents' or not starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/75e6c01e-e490-4e83-9774-618867654b24/'));
create policy fr3_business_document_server_update on storage.objects as restrictive for update to authenticated, anon using (bucket_id <> 'business-documents' or not starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/75e6c01e-e490-4e83-9774-618867654b24/')) with check (bucket_id <> 'business-documents' or not starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/75e6c01e-e490-4e83-9774-618867654b24/'));
create function public.fr3_business_document_gate_ready()
returns boolean language sql stable security invoker set search_path=pg_catalog
as $ready$
  select (select relrowsecurity from pg_class where oid='storage.objects'::regclass)
    and exists (select 1 from public.budget_workspaces w join public.workspace_subscriptions s on s.workspace_id=w.id
      where w.id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and w.owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and w.name='audit-fr3-logo-ingestion-20261112'
      and w.status='active' and w.business_support_version=23 and s.status='active' and s.paid_through_at>now())
    and (select count(*)=2 from pg_policy p
      cross join (values ('((bucket_id <> ''business-documents''::text) OR (NOT starts_with(name, ''workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/75e6c01e-e490-4e83-9774-618867654b24/''::text)))')) v(expr)
      where p.polrelid='storage.objects'::regclass and not p.polpermissive
      and p.polroles @> array[to_regrole('anon')::oid,to_regrole('authenticated')::oid]
      and pg_get_expr(p.polwithcheck,p.polrelid)=v.expr
      and ((p.polname='fr3_business_document_server_insert' and p.polcmd='a' and p.polqual is null)
        or (p.polname='fr3_business_document_server_update' and p.polcmd='w' and pg_get_expr(p.polqual,p.polrelid)=v.expr)));
$ready$;
revoke all on function public.fr3_business_document_gate_ready() from public, anon, authenticated;
grant execute on function public.fr3_business_document_gate_ready() to service_role;
update mushavo_email_install.rollout_control
set catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
where singleton and mode='ACTIVE' and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='56f6f3ede94013d0c51903e98f793b0969466d7968b0f6360487126b42eb6449';
notify pgrst,'reload schema';
commit;
