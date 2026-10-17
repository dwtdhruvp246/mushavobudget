-- Select STAGING dczlddwbtgvfdujgcitb. Read-only; no archive or cleanup call.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
SET LOCAL TIME ZONE 'UTC';
DO $guard$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'ARCHIVE_REVIEW_REQUIRES_PRIVILEGED_SQL_EDITOR';END IF;
END;
$guard$;
WITH workspaces AS (
 SELECT w.*,u.email AS owner_email FROM public.budget_workspaces w
 JOIN auth.users u ON u.id=w.owner_id
 WHERE w.workspace_type='business'
   AND w.name IN ('AUDIT-S332-BUSINESS-PRIMARY','AUDIT-S332-BUSINESS-SECONDARY')
), primary_scope AS (
 SELECT * FROM workspaces WHERE name='AUDIT-S332-BUSINESS-PRIMARY'
 AND lower(owner_email)='audit.owner@example.com'
), target_roles AS (
 SELECT r.* FROM public.business_roles r JOIN primary_scope w ON w.id=r.workspace_id
 WHERE NOT r.is_system AND r.name IN ('AUDIT-S333-ROLE','AUDIT-S333-ROLE-EDITED')
), target_audit AS (
 SELECT a.* FROM public.business_audit_events a JOIN target_roles r ON r.workspace_id=a.workspace_id
 WHERE a.action IN ('business.role_saved','business.role_archived')
 AND (a.before_summary->>'code'=r.code OR a.after_summary->>'code'=r.code)
), routines AS (
 SELECT p.*,replace(p.prosrc,chr(13)||chr(10),chr(10)) AS lf_body
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='archive_business_role'
)
SELECT jsonb_build_object(
 'stage_step','FR.2.3_BUSINESS_ARCHIVE_STATE_REVIEW',
 'scope','READ_ONLY_POST_FAILED_BATCH_ROLE_STATE_AND_ROUTINE_METADATA',
 'target_project','dczlddwbtgvfdujgcitb','checked_UTC',clock_timestamp(),
 'transaction_read_only',current_setting('transaction_read_only'),
 'matched_fixture_workspaces',(SELECT count(*) FROM workspaces),
 'matched_primary_owner_scope',(SELECT count(*) FROM primary_scope),
 'target_custom_roles',(SELECT count(*) FROM target_roles),
 'target_role_details',coalesce((
   SELECT jsonb_agg(jsonb_build_object(
     'name',r.name,'status',r.status,'version',r.version,'is_system',r.is_system,
     'scope_mode',r.scope_mode,'description_matches_audit',r.description='Synthetic audit',
     'code_has_expected_custom_shape',r.code ~ '^custom_[0-9a-f]{32}$',
     'role_row_sha256',encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex'),
     'enabled_permission_codes',coalesce((SELECT jsonb_agg(p.permission_code ORDER BY p.permission_code)
       FROM public.business_role_permissions p WHERE p.workspace_id=r.workspace_id AND p.role=r.code AND p.enabled),'[]'::jsonb),
     'permission_rows',(SELECT count(*) FROM public.business_role_permissions p WHERE p.workspace_id=r.workspace_id AND p.role=r.code),
     'permission_rows_sha256',(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.permission_code),'[]'::jsonb)::text,'UTF8')),'hex')
       FROM public.business_role_permissions p WHERE p.workspace_id=r.workspace_id AND p.role=r.code),
     'active_members_using_role',(SELECT count(*) FROM public.workspace_members m WHERE m.workspace_id=r.workspace_id AND m.role=r.code AND m.status='active'),
     'pending_valid_invitations_using_role',(SELECT count(*) FROM public.workspace_invitations i WHERE i.workspace_id=r.workspace_id AND i.role=r.code AND i.status='pending' AND i.expires_at>now())
   ) ORDER BY r.name) FROM (SELECT * FROM target_roles ORDER BY name LIMIT 5) r
 ),'[]'::jsonb),
 'role_details_truncated',(SELECT count(*)>5 FROM target_roles),
 'role_saved_audit_events',(SELECT count(*) FROM target_audit WHERE action='business.role_saved'),
 'role_archived_audit_events',(SELECT count(*) FROM target_audit WHERE action='business.role_archived'),
 'target_audit_actor_matches_primary_owner',NOT EXISTS(SELECT 1 FROM target_audit a JOIN primary_scope w ON w.id=a.workspace_id WHERE a.actor_id IS DISTINCT FROM w.owner_id),
 'target_audit_rows_sha256',(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(a) ORDER BY id),'[]'::jsonb)::text,'UTF8')),'hex') FROM target_audit a),
 'primary_builtin_roles',(SELECT count(*) FROM public.business_roles r JOIN primary_scope w ON w.id=r.workspace_id WHERE r.is_system AND r.status='active'),
 'primary_active_members',(SELECT count(*) FROM public.workspace_members m JOIN primary_scope w ON w.id=m.workspace_id WHERE m.status='active'),
 'primary_invitation_rows',(SELECT count(*) FROM public.workspace_invitations i JOIN primary_scope w ON w.id=i.workspace_id),
 'routine_metadata',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'name',p.proname,'identity_arguments',pg_get_function_identity_arguments(p.oid),
   'result_type',pg_get_function_result(p.oid),'security_definer',p.prosecdef,
   'owner',pg_get_userbyid(p.proowner),'settings',p.proconfig,
   'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
   'lf_body_md5',md5(p.lf_body),
   'lf_body_sha256',encode(sha256(convert_to(p.lf_body,'UTF8')),'hex'),
   'matches_reviewed_archive_body',md5(p.lf_body)='a1415e0f07d24b1a6532f053380ab781'
     AND encode(sha256(convert_to(p.lf_body,'UTF8')),'hex')='61a3083e57759d6e8a868deca5b3911348bf5ee1d13d49e8d393e431b842655c'
 ) ORDER BY p.oid) FROM routines p),'[]'::jsonb),
 'payment_records_total',(SELECT count(*) FROM public.payment_records),
 'payment_record_conversions_total',(SELECT count(*) FROM public.payment_conversions WHERE entity_type='payment_record'),
 'old_checker_HTTP_status_was_not_recorded',true,
 'read_only_state_does_not_independently_prove_HTTP_status',true,
 'application_routines_invoked',0,'archive_retried_or_rows_cleaned',false,
 'rows_identifiers_emails_credentials_or_function_bodies_printed',false,
 'rows_functions_roles_grants_or_settings_changed',false,
 'project_selection_independently_verified',false,
 'hosted_acceptance',false,'findings_closed','[]'::jsonb
) AS business_archive_state_review;
ROLLBACK;
