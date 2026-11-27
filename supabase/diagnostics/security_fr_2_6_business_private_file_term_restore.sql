begin;
set local search_path=pg_catalog;
set local lock_timeout='1500ms';
set local statement_timeout='20s';
do $restore$
declare v_workspace uuid;
begin
 if not exists(select 1 from mushavo_email_install.rollout_control where singleton and target_project='dczlddwbtgvfdujgcitb'
 and mode='ACTIVE' and catalog_sha256='cc122f36b6cc70e4fa88fe12a765cc83f24a586d495dfd3084f26edc2134e84f' and catalog_sha256=mushavo_email_install.catalog_identity()) then raise exception 'EXACT_STAGING_CATALOG_REQUIRED';end if;
 select id into strict v_workspace from public.budget_workspaces where id='dcf3d122-e99f-4fe5-bbd1-03c3547629df' and name='audit-batch-x-receipt-d7be160c2026'
 and workspace_type='business' and status='suspended' and business_support_version=20;
 if exists(select 1 from auth.sessions where user_agent like 'Mushavo-Staging-Runner/%')
 or exists(select 1 from storage.objects where bucket_id in('business-documents','business-logos'))
 or exists(select 1 from public.workspace_invitations where workspace_id=v_workspace and status='pending')
 or (select count(*) from public.workspace_members where workspace_id=v_workspace and status='active')<>1
 or not exists(select 1 from public.workspace_members where workspace_id=v_workspace and user_id='660a1463-6589-4c4d-ab6c-8ee50161038f' and status='inactive' and role='finance_manager')
 or not exists(select 1 from public.business_profiles where workspace_id=v_workspace and version=3 and logo_storage_path is null)
 then raise exception 'EXACT_SUCCESSFUL_HTTP_CLEANUP_REQUIRED';end if;
 update public.workspace_subscriptions set paid_through_at='2026-11-08T00:00:00Z',version=version+1,updated_at=now()
 where workspace_id=v_workspace and status='active' and member_limit=1 and version=18 and paid_through_at='2026-11-09T00:00:00Z'
 and entitlement_start_at='2026-11-06T00:00:00Z';
 if not found then raise exception 'EXACT_TEMPORARY_TERM_AFTER_CLEANUP_REQUIRED';end if;
end;$restore$;
select jsonb_build_object('original_expired_term_restored',true,'subscription_version',19,'Auth_rows_changed',0,'financial_ledger_rows_changed',0) safe_result;
commit;
