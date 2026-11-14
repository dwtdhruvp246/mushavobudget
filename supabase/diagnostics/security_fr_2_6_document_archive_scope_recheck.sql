begin;
set local search_path=pg_catalog;
set local lock_timeout='1500ms';
set local statement_timeout='25s';
do $audit$
declare
  v_workspace uuid;
  v_owner uuid;
  v_other uuid;
  v_admin uuid;
  v_other_email text;
  v_version integer;
  v_sub_version integer;
  v_scope_a uuid;
  v_scope_b uuid;
  v_category uuid;
  v_invitation jsonb;
  v_claim public.business_expense_claims%rowtype;
  v_owner_session uuid:=gen_random_uuid();
  v_other_session uuid:=gen_random_uuid();
  v_admin_session uuid:=gen_random_uuid();
  v_owner_doc uuid:=gen_random_uuid();
  v_other_doc uuid:=gen_random_uuid();
  v_owner_path text;
  v_other_path text;
  v_claims_owner jsonb;
  v_claims_other jsonb;
  v_claims_admin jsonb;
  v_result text;
  v_status text;
  v_visible integer;
  v_checks jsonb:='{}'::jsonb;
begin
  if not exists(select 1 from mushavo_email_install.rollout_control r
    where r.singleton and r.target_project='dczlddwbtgvfdujgcitb' and r.mode='ACTIVE'
      and r.catalog_sha256=mushavo_email_install.catalog_identity()) then
    raise exception 'EXACT_REVIEWED_STAGING_CATALOG_REQUIRED';
  end if;
  select id,owner_id,business_support_version into strict v_workspace,v_owner,v_version
    from public.budget_workspaces where name='audit-batch-x-receipt-d7be160c2026' and status='suspended';
  select id,email into strict v_other,v_other_email from auth.users
    where encode(sha256(convert_to(lower(email),'UTF8')),'hex')='e8afd004e7935fea5c2244534828c287c5d38854f21c10061b9d7f2faf071c71';
  select user_id into strict v_admin from public.app_admins where role='super_admin';
  select version into strict v_sub_version from public.workspace_subscriptions where workspace_id=v_workspace and member_limit=1;
  if exists(select 1 from public.workspace_members where workspace_id=v_workspace and user_id=v_other and status='active') then
    raise exception 'PREVIOUSLY_REMOVED_TEST_MEMBER_REQUIRED';
  end if;
  insert into auth.sessions(id,user_id,created_at,updated_at,aal,not_after,user_agent)
    values(v_owner_session,v_owner,now(),now(),'aal1',now()+interval '1 hour','Mushavo-Archive-Scope-Rehearsal/owner'),
      (v_other_session,v_other,now(),now(),'aal1',now()+interval '1 hour','Mushavo-Archive-Scope-Rehearsal/scoped'),
      (v_admin_session,v_admin,now(),now(),'aal1',now()+interval '1 hour','Mushavo-Archive-Scope-Rehearsal/admin');
  v_claims_owner:=jsonb_build_object('role','authenticated','sub',v_owner::text,'session_id',v_owner_session::text,'aal','aal1','exp',floor(extract(epoch from now()+interval '1 hour'))::bigint);
  v_claims_other:=jsonb_build_object('role','authenticated','sub',v_other::text,'session_id',v_other_session::text,'aal','aal1','exp',floor(extract(epoch from now()+interval '1 hour'))::bigint);
  v_claims_admin:=jsonb_build_object('role','authenticated','sub',v_admin::text,'session_id',v_admin_session::text,'aal','aal1','exp',floor(extract(epoch from now()+interval '1 hour'))::bigint);
  perform set_config('request.jwt.claims',v_claims_admin::text,true);
  execute 'set local role authenticated';
  perform public.admin_business_set_status(v_workspace,'active',v_version,'audit-batch-x-receipt-d7be160c2026','Rolled-back document archive scope audit',gen_random_uuid());
  perform public.admin_set_business_seats(v_workspace,2,v_sub_version,'audit-batch-x-receipt-d7be160c2026','Rolled-back document archive scope audit');
  execute 'reset role';
  perform set_config('request.jwt.claims',v_claims_owner::text,true);
  execute 'set local role authenticated';
  v_checks:=v_checks||jsonb_build_object('owner_modeled_session_valid',public.email_gate_current_session_verified());
  select id into strict v_scope_a from public.business_dimensions where workspace_id=v_workspace and name='Synthetic audit team' and status='active';
  select id into strict v_category from public.business_categories where workspace_id=v_workspace and name='Synthetic audit expense' and status='active';
  select id into v_scope_b from public.save_business_dimension(v_workspace,null,'team','Archive scope audit second team','','',null,'active',null);
  v_invitation:=public.create_business_invitation(v_workspace,v_other_email,'finance_manager',array[v_scope_b]);
  select * into v_claim from public.create_business_claim(v_workspace,'company_expense','Synthetic archive scope claim','Rolled-back metadata fixture',v_category,v_scope_a,1,'USD',current_date);
  execute 'reset role';
  v_owner_path:=format('workspaces/%s/%s/%s/synthetic-archive-owner.png',v_workspace,v_owner,v_owner_doc);
  v_other_path:=format('workspaces/%s/%s/%s/synthetic-archive-scoped.png',v_workspace,v_owner,v_other_doc);
  -- Authoritative metadata fixtures only. No physical Storage rows/files are
  -- created, and this transaction is always rolled back.
  insert into public.business_documents(id,workspace_id,parent_type,parent_id,storage_path,original_name,mime_type,size_bytes,uploaded_by)
    values(v_owner_doc,v_workspace,'expense_claim',v_claim.id,v_owner_path,'synthetic-archive-owner.png','image/png',68,v_owner),
      (v_other_doc,v_workspace,'expense_claim',v_claim.id,v_other_path,'synthetic-archive-scoped.png','image/png',68,v_owner);
  perform set_config('request.jwt.claims',v_claims_owner::text,true);
  execute 'set local role authenticated';
  v_result:=public.archive_business_document(v_workspace,v_owner_doc,'Rolled-back owner positive control');
  v_checks:=v_checks||jsonb_build_object('owner_may_archive_own_scoped_claim_receipt',v_result=v_owner_path);
  execute 'reset role';
  perform set_config('request.jwt.claims',v_claims_other::text,true);
  execute 'set local role authenticated';
  perform public.respond_business_invitation((v_invitation->>'invitation_id')::uuid,true);
  v_checks:=v_checks||jsonb_build_object('scoped_modeled_session_valid',public.email_gate_current_session_verified(),
    'scoped_manager_has_document_management',public.business_has_permission(v_workspace,'documents.manage'),
    'scoped_manager_cannot_view_parent',not public.business_can_view_claim(v_workspace,v_claim.id));
  select count(*) into v_visible from public.business_documents where id=v_other_doc;
  v_checks:=v_checks||jsonb_build_object('foreign_scope_receipt_hidden_by_RLS',v_visible=0);
  begin
    v_result:=public.archive_business_document(v_workspace,v_other_doc,'Rolled-back foreign-scope denial check');
    v_checks:=v_checks||jsonb_build_object('foreign_scope_archive_denied',false);
  exception when raise_exception or insufficient_privilege then
    if sqlerrm not in ('BUSINESS_DOCUMENT_ACCESS_REQUIRED','BUSINESS_DOCUMENT_SCOPE_REQUIRED') then raise; end if;
    v_checks:=v_checks||jsonb_build_object('foreign_scope_archive_denied',true);
  end;
  execute 'reset role';
  select status into v_status from public.business_documents where id=v_other_doc;
  v_checks:=v_checks||jsonb_build_object('foreign_scope_document_preserved_active',v_status='active');
  perform set_config('mushavo.archive_scope.safe_result',jsonb_build_object('project','dczlddwbtgvfdujgcitb',
    'checks',v_checks,'foreign_document_status',v_status,'auth_claims','MODELED_TRANSACTION_ONLY',
    'committed_fixture_writes',0,'physical_Storage_uploads',0,'external_email_requests',0,
    'provider_requests',0,'rollback_required',true)::text,true);
end;
$audit$;
select current_setting('mushavo.archive_scope.safe_result')::jsonb as safe_result;
rollback;
