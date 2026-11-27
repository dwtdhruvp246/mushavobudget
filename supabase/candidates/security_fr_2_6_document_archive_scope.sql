begin;
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
commit;
