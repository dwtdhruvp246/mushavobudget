-- Select STAGING dczlddwbtgvfdujgcitb. Metadata only; no MFA/role changes.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='3s';
SET LOCAL TIME ZONE 'UTC';
SET LOCAL search_path=pg_catalog,public,pg_temp;
DO $guard$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'ADMIN_READINESS_REQUIRES_PRIVILEGED_SQL_EDITOR'; END IF;
END;
$guard$;
WITH selected_routines(name) AS (
 SELECT unnest(ARRAY[
  'admin_analytics_foundation','admin_analytics_page','admin_business_billing_settings','admin_business_set_status','admin_business_subscription_payment_detail','admin_business_support_snapshot',
  'admin_business_transfer_owner','admin_cancel_scheduled_plan_price','admin_grant_manual_subscription','admin_plan_calculation_preview','admin_plan_workbench_snapshot','admin_save_plan_workbench',
  'admin_subscription_monitor','backfill_currency_conversions','business_admin_test_permit','business_subscription_proof_access','enqueue_admin_event_notification','exchange_rate_status',
  'guard_account_status_change','is_active_family_participant','is_app_admin','is_platform_staff','is_workspace_member','is_workspace_owner',
  'reserve_admin_user_invitation','review_subscription_payment','review_subscription_payment_before_business_public','review_subscription_payment_before_business_stage10','save_admin_finance_currency_settings','save_business_billing_settings',
  'save_manual_payment_conversion','save_plan_definition','save_plan_price','set_user_account_status','transfer_business_ownership','workspace_member_usage'
 ])
), routine_rows AS (
 SELECT p.proname::text AS name,
  jsonb_build_object('args',pg_get_function_identity_arguments(p.oid),
   'result',pg_get_function_result(p.oid),'owner',pg_get_userbyid(p.proowner),
   'language',l.lanname,'security_definer',p.prosecdef,'settings',p.proconfig,
   'volatility',p.provolatile::text,'strict',p.proisstrict,'leakproof',p.proleakproof,
   'parallel',p.proparallel::text,'arguments_with_defaults',pg_get_function_arguments(p.oid),
   'lf_body_md5',md5(replace(p.prosrc,chr(13)||chr(10),chr(10))),
   'lf_body_bytes',octet_length(replace(p.prosrc,chr(13)||chr(10),chr(10))),
   'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
   'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
   'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE')) AS metadata
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 JOIN pg_language l ON l.oid=p.prolang
 WHERE n.nspname='public' AND p.proname IN (SELECT name FROM selected_routines)
), routine_checks AS (
 SELECT e.name,count(r.name) AS overloads,
  encode(sha256(convert_to(coalesce(jsonb_agg(r.metadata ORDER BY r.metadata->>'args') FILTER(WHERE r.name IS NOT NULL),'[]'::jsonb)::text,'UTF8')),'hex') AS observed_sha256
 FROM selected_routines e LEFT JOIN routine_rows r ON r.name=e.name GROUP BY e.name
), selected_policies AS (
 SELECT v.schema_name,v.relation_name,unnest(v.names) AS name
 FROM (VALUES
  ('public','admin_audit_logs',ARRAY['Admins can manage audit logs']),
  ('public','admin_finance_settings',ARRAY['Finance staff can read admin currency settings']),
  ('public','admin_subscription_grants',ARRAY['Super admins can read manual grants']),
  ('public','admin_support_notes',ARRAY['Admins can manage support notes']),
  ('public','admin_user_invitation_audit',ARRAY['Authorized admins can read user invitation audit']),
  ('public','admin_user_invitations',ARRAY['Authorized admins can read user invitations']),
  ('public','category_budgets',ARRAY['Owners and admins can create category budgets','Owners and admins can delete category budgets','Owners and admins can read category budgets','Owners and admins can update category budgets']),
  ('public','countries',ARRAY['Staff can read countries']),
  ('public','enquiries',ARRAY['Staff can read enquiries','Staff can update enquiries']),
  ('public','exchange_rate_sync_runs',ARRAY['Finance staff can read rate sync diagnostics']),
  ('public','expenses',ARRAY['Approved heads and admins can create expenses','Approved heads and admins can delete expenses','Approved heads and admins can read expenses','Approved heads and admins can update expenses']),
  ('public','families',ARRAY['Approved heads and admins can update families','Owners and admins can delete families']),
  ('public','family_heads',ARRAY['Admins and matching heads can read head approvals','Admins can create head approvals','Admins can delete head approvals','Admins can update head approvals']),
  ('public','family_invitations',ARRAY['Invitation participants can read invitations']),
  ('public','family_members',ARRAY['Approved heads and admins can delete family members','Approved heads and admins can update family members']),
  ('public','notifications',ARRAY['Users can create relevant notifications']),
  ('public','payment_conversions',ARRAY['Authorized users can read payment conversions']),
  ('public','payment_items',ARRAY['Household owners can delete payment items','Household owners can update payment items']),
  ('public','payment_records',ARRAY['Household owners can delete payment records','Household owners can update payment records']),
  ('public','payments',ARRAY['Admins can create payments','Admins can delete payments','Admins can read payments','Admins can update payments']),
  ('public','plan_prices',ARRAY['Authenticated users can read active plan prices']),
  ('public','plans',ARRAY['Authenticated users can read active plans']),
  ('public','profiles',ARRAY['Users and admins can read profiles']),
  ('public','public_enquiry_events',ARRAY['Support staff can read public enquiry events']),
  ('public','subscription_audit_events',ARRAY['business_subscription_audit_owner_guard']),
  ('public','subscription_entitlement_history',ARRAY['business_entitlement_history_owner_guard']),
  ('public','subscription_invoices',ARRAY['Owners can read subscription invoices']),
  ('public','subscription_payment_proofs',ARRAY['Owners can read subscription proofs']),
  ('public','subscription_payment_reviews',ARRAY['Finance staff can read reviews']),
  ('public','subscription_payments',ARRAY['Owners can read subscription payments']),
  ('public','subscription_renewal_requests',ARRAY['Owners can read renewal requests']),
  ('public','support_ticket_messages',ARRAY['Customers and support staff can add ticket messages','Customers and support staff can read ticket messages']),
  ('public','support_tickets',ARRAY['Administrators can delete tickets','Customers and support staff can create tickets','Customers and support staff can read tickets','Support staff can update tickets']),
  ('public','supported_currencies',ARRAY['Authenticated users can read supported currencies']),
  ('storage','objects',ARRAY['Owners and finance staff can read subscription proofs','Owners can delete payment proofs','Users can read permitted payment proofs'])
 ) v(schema_name,relation_name,names)
), policy_checks AS (
 SELECT e.schema_name,e.relation_name,e.name,p.oid IS NOT NULL AS present,
  encode(sha256(convert_to(jsonb_build_object('command',p.polcmd::text,'permissive',p.polpermissive,
   'roles',coalesce((SELECT jsonb_agg(CASE WHEN x=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x)::text END
    ORDER BY CASE WHEN x=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x)::text END) FROM unnest(p.polroles) x),'[]'::jsonb),
   'using_md5',md5(coalesce(pg_get_expr(p.polqual,p.polrelid),'')),
   'check_md5',md5(coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')))::text,'UTF8')),'hex') AS observed_sha256
 FROM selected_policies e LEFT JOIN pg_policy p ON p.polrelid=to_regclass(e.schema_name||'.'||e.relation_name) AND p.polname=e.name
), staff_counts AS (
 SELECT role,count(*) AS n FROM public.app_admins GROUP BY role
), operators AS (
 SELECT count(DISTINCT a.user_id) AS n FROM public.app_admins a
 JOIN public.profiles p ON p.id=a.user_id JOIN auth.mfa_factors f ON f.user_id=a.user_id
 WHERE a.role='super_admin' AND p.account_status='active' AND f.factor_type='totp' AND f.status='verified'
)
SELECT jsonb_build_object(
 'stage_step','FR.2.4_ADMIN_READINESS',
 'scope','READ_ONLY_SELECTED_SOURCE_FINGERPRINTS_EFFECTIVE_EXECUTE_AND_OPERATOR_COUNTS',
 'checked_UTC',clock_timestamp(),'target_project','dczlddwbtgvfdujgcitb',
 'server_version',current_setting('server_version'),
 'transaction_read_only',current_setting('transaction_read_only'),
 'selected_routine_names',(SELECT count(*) FROM selected_routines),
 'observed_selected_routine_overloads',(SELECT count(*) FROM routine_rows),
 'routine_fingerprints',(SELECT jsonb_agg(jsonb_build_object('name',name,'overloads',overloads,
  'sha256',observed_sha256) ORDER BY name) FROM routine_checks),
 'selected_anonymous_executable_routines',(SELECT count(*) FROM routine_rows WHERE (metadata->>'anon_execute')::boolean),
 'selected_authenticated_executable_routines',(SELECT count(*) FROM routine_rows WHERE (metadata->>'authenticated_execute')::boolean),
 'selected_policies',(SELECT count(*) FROM selected_policies),
 'observed_selected_policies',(SELECT count(*) FROM policy_checks WHERE present),
 'policy_fingerprints',(SELECT jsonb_agg(jsonb_build_object('relation',schema_name||'.'||relation_name,
  'name',name,'present',present,'sha256',observed_sha256)
  ORDER BY schema_name,relation_name,name) FROM policy_checks),
 'candidate_helper_overloads',(SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace
  AND proname IN ('admin_mfa_satisfied','platform_admin_authorized','admin_mfa_status')),
 'platform_role_counts',(SELECT coalesce(jsonb_object_agg(role,n),'{}'::jsonb) FROM staff_counts),
 'active_super_users_with_verified_totp',(SELECT n FROM operators),
 'shared_audit_actors_with_platform_role',(SELECT count(*) FROM public.app_admins a JOIN auth.users u ON u.id=a.user_id
  WHERE u.email IN ('audit.owner@example.com','audit.outsider@example.com')),
 'readiness',CASE WHEN (SELECT n FROM operators)=0 THEN 'BLOCKED_NO_VERIFIED_SUPER_OPERATOR'
  ELSE 'VERIFIED_SUPER_EXISTS_CONTROL_AND_RECOVERY_UNVERIFIED' END,
 'fingerprint_match_is_authorization_acceptance',false,
 'operator_control_or_independent_recovery_verified',false,'Auth_settings_verified',false,
 'genuine_AAL1_AAL2_or_recovery_cases_run',0,'application_routines_invoked',0,
 'project_selection_independently_verified',false,'roles_factors_rows_or_settings_changed',false,
 'raw_rows_function_bodies_actor_identifiers_or_credentials_printed',false,
 'hosted_acceptance',false,'findings_closed','[]'::jsonb
) AS admin_readiness;
ROLLBACK;
