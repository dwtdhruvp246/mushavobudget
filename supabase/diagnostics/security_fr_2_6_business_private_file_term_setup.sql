begin;
set local search_path=pg_catalog;
set local lock_timeout='1500ms';
set local statement_timeout='20s';
do $setup$
declare v_workspace uuid;
begin
 if not exists(select 1 from mushavo_email_install.rollout_control where singleton and target_project='dczlddwbtgvfdujgcitb'
 and mode='ACTIVE' and catalog_sha256='cc122f36b6cc70e4fa88fe12a765cc83f24a586d495dfd3084f26edc2134e84f' and catalog_sha256=mushavo_email_install.catalog_identity()) then raise exception 'EXACT_STAGING_CATALOG_REQUIRED';end if;
 select w.id into strict v_workspace from public.budget_workspaces w join auth.users u on u.id=w.owner_id
 where w.id='dcf3d122-e99f-4fe5-bbd1-03c3547629df' and w.name='audit-batch-x-receipt-d7be160c2026' and w.workspace_type='business'
 and w.status='suspended' and w.business_support_version=18
 and encode(sha256(convert_to(lower(u.email),'UTF8')),'hex')='78517e097a62a504568d89ea98e37c754446634cd03663e9edb9a6d5be5bab5d';
 perform 1 from public.workspace_subscriptions where workspace_id=v_workspace for update;
 if not exists(select 1 from public.workspace_subscriptions s where s.workspace_id=v_workspace and s.status='active'
 and s.version=15 and s.member_limit=1 and s.paid_through_at='2026-11-08T00:00:00Z' and s.entitlement_start_at='2026-11-06T00:00:00Z'
 and encode(sha256(convert_to((to_jsonb(s)-array['version','updated_at'])::text,'UTF8')),'hex')='b8b683a9f3a2172de0932c6cf5ec4d3e4cba836b2ef9526cf0e868e7012838a0')
 then raise exception 'EXACT_ORIGINAL_EXPIRED_SUBSCRIPTION_REQUIRED';end if;
 if not exists(select 1 from public.business_profiles p where p.workspace_id=v_workspace and p.version=1 and p.logo_storage_path is null
 and encode(sha256(convert_to((to_jsonb(p)-array['version','updated_at'])::text,'UTF8')),'hex')='8245f339c1b3ef017c92a4b3a5871973eee59ebfbef2cbcb777fbca6d1a6fb7d')
 or not exists(select 1 from public.business_bills b where b.id='c88a0a8c-fae6-4452-bdf0-b9ce7bf71b45' and b.workspace_id=v_workspace
 and encode(sha256(convert_to(to_jsonb(b)::text,'UTF8')),'hex')='f55eef182e5f7e153e93362a51a90c881357149bf17745808d914dc0e9809a87') then raise exception 'ORIGINAL_PROFILE_AND_BILL_REQUIRED';end if;
 if (select count(*) from public.workspace_members where workspace_id=v_workspace)<>3
 or (select count(*) from public.workspace_members where workspace_id=v_workspace and status='active' and role='business_owner')<>1
 or not exists(select 1 from public.workspace_members where workspace_id=v_workspace and user_id='660a1463-6589-4c4d-ab6c-8ee50161038f' and status='inactive' and role='finance_manager')
 or not exists(select 1 from public.workspace_members where workspace_id=v_workspace and user_id='8495c114-23c6-4d85-a643-fcb7a4781d74' and status='inactive' and role='staff')
 or exists(select 1 from public.workspace_invitations where workspace_id=v_workspace and status='pending')
 or exists(select 1 from public.business_member_scopes where workspace_id=v_workspace)
 or exists(select 1 from public.business_member_permissions where workspace_id=v_workspace)
 or exists(select 1 from storage.objects where bucket_id in('payment-proofs','subscription-proofs','business-documents','business-logos'))
 or exists(select 1 from auth.sessions where user_agent like 'Mushavo-Staging-Runner/%') then raise exception 'EXACT_CLEAN_ISOLATED_FIXTURE_REQUIRED';end if;
 update public.workspace_subscriptions set paid_through_at='2026-11-09T00:00:00Z',version=version+1,updated_at=now()
 where workspace_id=v_workspace and version=15 and member_limit=1 and paid_through_at='2026-11-08T00:00:00Z';
 if not found then raise exception 'EXACT_TERM_UPDATE_REQUIRED';end if;
end;$setup$;
select jsonb_build_object('setup',true,'subscription_version',16,'only_test_term_extended',true,'Auth_rows_changed',0,'financial_ledger_rows_changed',0) safe_result;
commit;
