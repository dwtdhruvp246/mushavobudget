-- Staging only. Refuses any unreviewed catalog or rollout target.
begin;
do $guard$
begin
  if not exists (
    select 1 from mushavo_email_install.rollout_control
    where singleton and target_project = 'dczlddwbtgvfdujgcitb' and mode = 'ACTIVE'
      and catalog_sha256 = 'c6eeedf37ae17212f4a9dca90e70b2cbbd4f46fccb5a3cce186b86361a56ff26'
      and catalog_sha256 = mushavo_email_install.catalog_identity()
    for update
  ) then raise exception 'REVIEWED_STAGING_CATALOG_REQUIRED'; end if;
  if to_regprocedure('public.business_storage_delete_authorized(text)') is not null then
    raise exception 'STORAGE_DELETE_HELPER_ALREADY_PRESENT';
  end if;
end;
$guard$;

-- Storage deletion needs SELECT as well as DELETE. Archived document rows are
-- deliberately hidden by their ordinary SELECT policy, so authorize deletion
-- from authoritative metadata rather than an RLS-filtered NOT EXISTS query.
create function public.business_storage_delete_authorized(p_name text)
returns boolean
language plpgsql stable security definer
set search_path = pg_catalog
as $$
declare
  v_workspace uuid;
  v_document public.business_documents%rowtype;
begin
  perform mushavo_email_auth.require_application_session();
  v_workspace := public.business_storage_workspace_id(p_name);
  if v_workspace is null or not public.business_claims_active(v_workspace) then
    return false;
  end if;

  select * into v_document from public.business_documents
    where storage_path = p_name;
  if found then
    if v_document.workspace_id <> v_workspace or v_document.status <> 'archived'
      or not public.business_has_permission(v_workspace, 'documents.manage') then
      return false;
    end if;
    return case
      when v_document.parent_type = 'expense_claim' then
        public.business_can_view_claim(v_workspace, v_document.parent_id)
      when v_document.parent_type in ('business_bill', 'business_bill_payment') then
        public.business_can_view_bill_document(v_workspace, v_document.parent_type, v_document.parent_id)
      else true
    end;
  end if;

  -- Preserve cleanup of an upload that was never registered. A creator can
  -- remove only their own upload; a document manager can remove workspace orphans.
  return public.business_has_permission(v_workspace, 'documents.manage')
    or ((storage.foldername(p_name))[3] = auth.uid()::text
      and public.business_has_permission(v_workspace, 'documents.create'));
end;
$$;

revoke all on function public.business_storage_delete_authorized(text) from public, anon;
grant execute on function public.business_storage_delete_authorized(text) to authenticated, service_role;

drop policy "Business members can delete archived or unregistered private documents" on storage.objects;
create policy "Business members can delete archived or unregistered private documents"
on storage.objects for delete to authenticated
using (bucket_id = 'business-documents' and public.business_storage_delete_authorized(name));

-- This SELECT grant applies only while the Storage server executes a deletion.
-- It grants no archived download, signed URL, listing, copy or move access.
create policy business_documents_delete_selection
on storage.objects for select to authenticated
using (
  bucket_id = 'business-documents'
  and storage.allow_any_operation(array['object.delete', 'object.delete_many'])
  and public.business_storage_delete_authorized(name)
);

notify pgrst, 'reload schema';
-- Refresh only the already-matched staging stamp for this reviewed DDL delta.
do $stamp$
declare v_rows integer;
begin
  update mushavo_email_install.rollout_control
    set catalog_sha256 = mushavo_email_install.catalog_identity(), changed_at = now()
    where singleton and target_project = 'dczlddwbtgvfdujgcitb' and mode = 'ACTIVE'
      and catalog_sha256 = 'c6eeedf37ae17212f4a9dca90e70b2cbbd4f46fccb5a3cce186b86361a56ff26';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'EXACT_STAGING_STAMP_UPDATE_REQUIRED'; end if;
end;
$stamp$;
commit;
