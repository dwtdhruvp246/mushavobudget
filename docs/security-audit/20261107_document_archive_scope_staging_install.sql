-- Staging only: exact prior catalog and archive definition are required.
begin;
do $guard$
begin
  if not exists(select 1 from mushavo_email_install.rollout_control
    where singleton and target_project='dczlddwbtgvfdujgcitb' and mode='ACTIVE'
      and catalog_sha256='897dcb81876542b9012fbc90dd25df79e21f2a212422f2bab15b5396c8368be1'
      and catalog_sha256=mushavo_email_install.catalog_identity() for update) then
    raise exception 'REVIEWED_STAGING_CATALOG_REQUIRED';
  end if;
  if (select md5(pg_get_functiondef(p.oid)) from pg_proc p where p.oid='public.archive_business_document(uuid,uuid,text)'::regprocedure)
    is distinct from '908cd7f08ae4acc574029f1a10c8d140' then
    raise exception 'REVIEWED_ARCHIVE_FUNCTION_REQUIRED';
  end if;
end;
$guard$;
-- Apply the same claim/bill scope boundary used by private document reads.
CREATE OR REPLACE FUNCTION public.archive_business_document(p_workspace_id uuid, p_document_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM mushavo_email_auth.require_application_session();

declare v_document public.business_documents%rowtype;
begin
  if not public.business_claims_active(p_workspace_id)
    or not public.business_has_permission(p_workspace_id, 'documents.manage')
    then raise exception 'BUSINESS_DOCUMENT_MANAGE_REQUIRED'; end if;
  select * into v_document from public.business_documents
    where id = p_document_id and workspace_id = p_workspace_id and status = 'active'
    for update;
  if not found then raise exception 'BUSINESS_DOCUMENT_NOT_FOUND'; end if;
  if (v_document.parent_type='expense_claim'
      and public.business_can_view_claim(p_workspace_id,v_document.parent_id) is not true)
    or (v_document.parent_type in ('business_bill','business_bill_payment')
      and public.business_can_view_bill_document(p_workspace_id,v_document.parent_type,v_document.parent_id) is not true) then
    raise exception 'BUSINESS_DOCUMENT_SCOPE_REQUIRED';
  end if;
  if v_document.parent_type = 'expense_claim' and exists (
    select 1 from public.business_expense_claims
    where workspace_id = p_workspace_id and id = v_document.parent_id
      and status not in ('draft', 'changes_requested')
  ) then raise exception 'BUSINESS_SUBMITTED_RECEIPT_LOCKED'; end if;
  update public.business_documents
    set status = 'archived', archived_at = now(), archived_by = auth.uid()
    where id = p_document_id;
  perform public.business_record_audit_event(p_workspace_id,
    'business.document_archived', 'business_document', p_document_id,
    jsonb_build_object('status', 'active'), jsonb_build_object('status', 'archived'), p_reason);
  return v_document.storage_path;
end;

END;
$function$;

notify pgrst, 'reload schema';
do $stamp$
declare v_rows integer;
begin
  update mushavo_email_install.rollout_control
    set catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=now()
    where singleton and target_project='dczlddwbtgvfdujgcitb' and mode='ACTIVE'
      and catalog_sha256='897dcb81876542b9012fbc90dd25df79e21f2a212422f2bab15b5396c8368be1';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'EXACT_STAGING_STAMP_UPDATE_REQUIRED';end if;
end;
$stamp$;
commit;
