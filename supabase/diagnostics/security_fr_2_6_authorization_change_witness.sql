-- Replace __RUN_ID__ with the exact numeric GitHub run ID before execution.
-- SQL claims are modeled using a real ordinary session; no JWT signature check is inferred.
begin isolation level read committed read only;
set local search_path=pg_catalog;
set local statement_timeout='50s';
set local lock_timeout='1500ms';
do $before$
declare
 v_owner uuid; v_session uuid; v_exp bigint; v_status jsonb; v_allowed boolean;
begin
 if not exists(select 1 from mushavo_email_install.rollout_control where singleton
  and target_project='dczlddwbtgvfdujgcitb' and mode='ACTIVE'
  and catalog_sha256=mushavo_email_install.catalog_identity()) then raise exception 'CURRENT_STAGING_REQUIRED';end if;
 select owner_id into strict v_owner from public.budget_workspaces
  where id='dcf3d122-e99f-4fe5-bbd1-03c3547629df' and name='audit-batch-x-receipt-d7be160c2026'
   and workspace_type='business' and status='active' and business_support_version=17;
 select s.id,(extract(epoch from s.created_at)+120)::bigint into strict v_session,v_exp
  from auth.sessions s where s.user_id=v_owner
   and s.user_agent='Mushavo-Staging-Runner/__RUN_ID__/1'
   and s.created_at>clock_timestamp()-interval '15 seconds';
 perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',v_owner,
  'session_id',v_session,'exp',v_exp,'aal','aal1')::text,true);
 perform set_config('mushavo.authorization_witness.session',v_session::text,true);
 execute 'set local role authenticated';
 select public.app_session_status() into v_status;
 select public.business_has_permission('dcf3d122-e99f-4fe5-bbd1-03c3547629df','workspace.view') into v_allowed;
 execute 'reset role';
 if v_status->>'session_valid'<>'true' or v_status->>'admin_authorized'<>'false' or v_allowed is distinct from true
  then raise exception 'ORDINARY_SESSION_AND_PERMISSION_BASELINE_REQUIRED';end if;
 perform set_config('mushavo.authorization_witness.before',jsonb_build_object(
  'observed_at',clock_timestamp(),'backend_fingerprint',md5(pg_backend_pid()::text||':authorization-witness'),
  'session_fingerprint',md5(v_session::text),'session_valid',true,'platform_Admin',false,
  'business_permission',v_allowed,'workspace_status','active','support_version',17)::text,true);
end;
$before$;
select pg_sleep(40);
do $after$
declare v_status jsonb; v_allowed boolean; v_workspace record; v_before jsonb;
begin
 execute 'set local role authenticated';
 select public.app_session_status() into v_status;
 select public.business_has_permission('dcf3d122-e99f-4fe5-bbd1-03c3547629df','workspace.view') into v_allowed;
 execute 'reset role';
 select status,business_support_version into strict v_workspace from public.budget_workspaces
  where id='dcf3d122-e99f-4fe5-bbd1-03c3547629df';
 if v_workspace.status<>'suspended' or v_workspace.business_support_version<>18
  or v_status->>'session_valid'<>'true' or v_status->>'admin_authorized'<>'false' or v_allowed is distinct from false
  then raise exception 'COMMITTED_REVOCATION_WITH_SAME_VALID_SESSION_REQUIRED';end if;
 v_before:=current_setting('mushavo.authorization_witness.before')::jsonb;
 perform set_config('mushavo.authorization_witness.result',jsonb_build_object(
  'project','dczlddwbtgvfdujgcitb','before',v_before,
  'after',jsonb_build_object('observed_at',clock_timestamp(),
   'backend_fingerprint',md5(pg_backend_pid()::text||':authorization-witness'),
   'session_fingerprint',md5(current_setting('mushavo.authorization_witness.session')),
   'session_valid',true,'platform_Admin',false,'business_permission',v_allowed,
   'workspace_status',v_workspace.status,'support_version',v_workspace.business_support_version),
  'same_backend',v_before->>'backend_fingerprint'=md5(pg_backend_pid()::text||':authorization-witness'),
  'same_real_session',v_before->>'session_fingerprint'=md5(current_setting('mushavo.authorization_witness.session')),
  'transaction_isolation',current_setting('transaction_isolation'),
  'transaction_read_only',current_setting('transaction_read_only'),
  'claims','MODELED_WITH_REAL_CURRENT_ORDINARY_AUTH_SESSION_AND_CONSERVATIVE_EXPIRY',
  'concurrent_mutation','SEPARATE_GENUINE_ADMIN_HTTP_REQUEST',
  'committed_witness_writes',0,'provider_requests',0,'exit_code',0)::text,true);
end;
$after$;
select current_setting('mushavo.authorization_witness.result')::jsonb as safe_result;
rollback;
