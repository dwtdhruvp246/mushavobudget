-- FR.2.3 STAGING ONLY dczlddwbtgvfdujgcitb.
-- Creates two controlled Business fixtures; preserve prior audit rows.
BEGIN;
SET LOCAL statement_timeout='45s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
SET LOCAL TIME ZONE 'UTC';
DO $fixture$
DECLARE
 v_review jsonb;v_metadata jsonb;v_before_metadata jsonb;
 v_before jsonb:='{}';v_rows jsonb;v_auth_before jsonb;v_auth_after jsonb;
 v_relation text;v_filter text;v_workspace uuid;v_plan uuid;v_dim uuid;v_category uuid;
 v_users uuid[];v_new_workspaces uuid[]:='{}';v_jobs boolean:=false;i integer;j integer;
 v_emails text[]:=ARRAY['audit.owner@example.com','audit.outsider@example.com'];
 v_names text[]:=ARRAY['AUDIT-S332-BUSINESS-PRIMARY','AUDIT-S332-BUSINESS-SECONDARY'];
 v_preserve text[]:=ARRAY['admin_notification_outbox','app_admins','budget_workspaces','business_audit_events','business_bill_payments','business_bill_schedules','business_bills','business_budgets','business_categories','business_change_signals','business_dimensions','business_documents','business_expense_claims','business_invitation_scopes','business_member_permissions','business_member_scopes','business_profiles','business_public_provision_permits','business_role_permissions','business_roles','business_spending_requests','business_team_operation_permits','families','family_heads','family_invitations','family_members','notification_outbox','notifications','payment_conversions','payment_items','payment_records','plans','product_release_controls','profiles','push_subscriptions','workspace_invitations','workspace_members','workspace_settings','workspace_subscriptions'];
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'FIXTURE_REQUIRES_PRIVILEGED_SQL_EDITOR';END IF;
 IF current_setting('session_replication_role')<>'origin'
 THEN RAISE EXCEPTION 'FIXTURE_REQUIRES_ORIGIN';END IF;
 IF (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace)>1000
 OR (SELECT coalesce(sum(octet_length(prosrc)),0) FROM pg_proc WHERE pronamespace='public'::regnamespace)>5000000
 THEN RAISE EXCEPTION 'FIXTURE_CATALOG_BOUND_EXCEEDED';END IF;
 PERFORM pg_advisory_xact_lock(hashtext('mushavo-stage-3-business-fixture'));
 LOCK TABLE public.admin_notification_outbox,public.app_admins,public.budget_workspaces,public.business_audit_events,public.business_bill_payments,public.business_bill_schedules,public.business_bills,public.business_budgets,public.business_categories,public.business_change_signals,public.business_dimensions,public.business_documents,public.business_expense_claims,public.business_invitation_scopes,public.business_member_permissions,public.business_member_scopes,public.business_profiles,public.business_public_provision_permits,public.business_role_permissions,public.business_roles,public.business_spending_requests,public.business_team_operation_permits,public.families,public.family_heads,public.family_invitations,public.family_members,public.notification_outbox,public.notifications,public.payment_conversions,public.payment_items,public.payment_records,public.plans,public.product_release_controls,public.profiles,public.push_subscriptions,public.workspace_invitations,public.workspace_members,public.workspace_settings,public.workspace_subscriptions IN SHARE ROW EXCLUSIVE MODE;
 IF to_regclass('cron.job') IS NOT NULL THEN
   EXECUTE 'SELECT EXISTS(SELECT 1 FROM cron.job WHERE active)' INTO v_jobs;
 END IF;
 IF v_jobs THEN RAISE EXCEPTION 'ACTIVE_STAGING_CRON_REQUIRES_REVIEW';END IF;
WITH RECURSIVE
api_roots(name) AS (SELECT unnest(ARRAY['archive_business_role','business_effective_permissions','business_has_permission','business_public_provision_permit','business_report_export','business_report_records','business_report_summary','business_roles_snapshot','business_team_permit','business_team_snapshot','cancel_business_invitation','create_business_claim','create_business_invitation','edit_business_invitation','is_platform_staff','my_account_suspended','record_business_claim_payment','remove_business_member','respond_business_invitation','review_business_claim','save_business_budget','save_business_claim_draft','save_business_role','set_business_member_permission','submit_business_claim','update_business_member_access']::text[])),
relation_names(name) AS (SELECT unnest(ARRAY['budget_workspaces','workspace_subscriptions','workspace_settings','workspace_members','business_profiles','business_roles','business_role_permissions','business_member_permissions','business_member_scopes','workspace_invitations','business_invitation_scopes','business_categories','business_dimensions','business_expense_claims','business_budgets','business_spending_requests','business_bills','business_bill_schedules','business_bill_payments','business_documents','business_audit_events','business_change_signals','notifications','notification_outbox','admin_notification_outbox','business_public_provision_permits','business_team_operation_permits']::text[])),
selected AS (
  SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN relation_names r ON r.name=c.relname WHERE n.nspname='public'
),
functions AS (
  SELECT p.*, replace(p.prosrc,chr(13)||chr(10),chr(10)) AS lf_body
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
),
selected_triggers AS (
  SELECT t.*, c.relname AS relation_name FROM pg_trigger t
  JOIN selected c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal
),
policy_roots AS (
  SELECT DISTINCT d.refobjid AS oid FROM pg_policy p
  JOIN selected c ON c.oid=p.polrelid JOIN pg_depend d
    ON d.classid='pg_policy'::regclass AND d.objid=p.oid
   AND d.refclassid='pg_proc'::regclass
  JOIN functions f ON f.oid=d.refobjid
),
literal_calls AS (
  SELECT DISTINCT f.oid AS caller, lower(m.parts[1]) AS callee_name
  FROM functions f CROSS JOIN LATERAL regexp_matches(f.lf_body,
    'public[.]([a-z_][a-z0-9_]*)[[:space:]]*[(]', 'gi') AS m(parts)
),
edges AS (
  SELECT l.caller, f.oid AS callee FROM literal_calls l
  JOIN functions f ON f.proname=l.callee_name
  UNION
  SELECT d.objid, d.refobjid FROM pg_depend d
  JOIN functions a ON a.oid=d.objid JOIN functions b ON b.oid=d.refobjid
  WHERE d.classid='pg_proc'::regclass AND d.refclassid='pg_proc'::regclass
),
seeds AS (
  SELECT f.oid FROM functions f JOIN api_roots a ON a.name=f.proname
  UNION SELECT f.oid FROM selected_triggers t JOIN functions f ON f.oid=t.tgfoid
  UNION SELECT oid FROM policy_roots
),
reachable(oid) AS (
  SELECT oid FROM seeds UNION
  SELECT e.callee FROM edges e JOIN reachable r ON r.oid=e.caller
),
function_metadata AS (
  SELECT f.proname AS name,
    pg_get_function_identity_arguments(f.oid) AS identity_arguments,
    pg_get_function_result(f.oid) AS result_type,
    pg_get_userbyid(f.proowner) AS owner, l.lanname AS language,
    f.prokind::text AS kind, f.prosecdef AS security_definer,
    f.provolatile::text AS volatility, f.proparallel::text AS parallel_mode,
    f.proisstrict AS strict, f.proleakproof AS leakproof,
    f.proconfig AS settings, f.proretset AS returns_set,
    f.prosupport::regproc::text AS planner_support,
    f.pronargdefaults AS default_argument_count,
    md5(coalesce(pg_get_expr(f.proargdefaults,0),'')) AS argument_defaults_md5,
    f.proargmodes AS argument_modes,
    md5(f.lf_body) AS lf_body_md5,
    encode(sha256(convert_to(f.lf_body,'UTF8')),'hex') AS lf_body_sha256,
    octet_length(f.prosrc) AS raw_body_bytes,
    octet_length(f.lf_body) AS lf_body_bytes,
    has_function_privilege('anon',f.oid,'EXECUTE') AS anon_execute,
    has_function_privilege('authenticated',f.oid,'EXECUTE') AS authenticated_execute,
    has_function_privilege('service_role',f.oid,'EXECUTE') AS service_role_execute,
    f.lf_body ~* '(^|[^a-z_])execute([[:space:]]|$)' AS dynamic_SQL_marker,
    f.lf_body ~* '(net[.]|http_(get|post|request)[[:space:]]*[(]|dblink|copy[[:space:]].*program)' AS outbound_marker,
    f.lf_body ~* '(pg_notify[[:space:]]*[(]|(^|[^a-z_])notify[[:space:]])' AS notify_marker
  FROM reachable r JOIN functions f ON f.oid=r.oid
  JOIN pg_language l ON l.oid=f.prolang
),
trigger_metadata AS (
  SELECT t.relation_name,t.tgname AS name,t.tgenabled::text AS enabled_mode,
    t.tgtype::integer AS event_bits,n.nspname AS function_schema,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS identity_arguments,
    t.tgnargs AS argument_count, md5(encode(t.tgargs,'hex')) AS arguments_hex_md5,
    ARRAY(SELECT a.attname::text FROM unnest(t.tgattr::smallint[])
      WITH ORDINALITY k(num,ord) JOIN pg_attribute a
      ON a.attrelid=t.tgrelid AND a.attnum=k.num ORDER BY k.ord) AS update_columns,
    t.tgqual IS NOT NULL AS when_clause_present,
    md5(coalesce(t.tgqual::text,'')) AS when_clause_md5,
    t.tgoldtable IS NOT NULL OR t.tgnewtable IS NOT NULL AS transition_tables_present
  FROM selected_triggers t JOIN pg_proc p ON p.oid=t.tgfoid
  JOIN pg_namespace n ON n.oid=p.pronamespace
)
SELECT jsonb_build_object(
  'stage_step','FR.2.3_BUSINESS_CURRENT_CLOSURE_REVIEW',
  'scope','READ_ONLY_CATALOG_INVENTORY_FOR_SOURCE_COMPARISON_NOT_FIXTURE_OR_API_ACCEPTANCE',
  'target_project','dczlddwbtgvfdujgcitb',
  'checked_UTC',clock_timestamp(),
  'transaction_read_only',current_setting('transaction_read_only'),
  'line_normalization','CRLF_TO_LF_ONLY_NO_WHITESPACE_STRIPPING',
  'selected_relations',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'name',c.relname,'kind',c.relkind::text,'RLS',c.relrowsecurity,
    'force_RLS',c.relforcerowsecurity,'owner',pg_get_userbyid(c.relowner),
    'rewrite_rules',(SELECT count(*) FROM pg_rewrite WHERE ev_class=c.oid)
  ) ORDER BY c.relname) FROM selected c),'[]'::jsonb),
  'missing_selected_relations',ARRAY(SELECT name FROM relation_names
    WHERE name NOT IN (SELECT relname FROM selected) ORDER BY name),
  'API_roots',ARRAY(SELECT name FROM api_roots ORDER BY name),
  'missing_API_roots',ARRAY(SELECT name FROM api_roots
    WHERE name NOT IN (SELECT proname FROM functions) ORDER BY name),
  'selected_user_trigger_count',(SELECT count(*) FROM trigger_metadata),
  'trigger_metadata',coalesce((SELECT jsonb_agg(to_jsonb(x)
    ORDER BY relation_name,name) FROM (SELECT * FROM trigger_metadata
    ORDER BY relation_name,name LIMIT 200) x),'[]'::jsonb),
  'trigger_details_truncated',(SELECT count(*)>200 FROM trigger_metadata),
  'policy_dependency_root_count',(SELECT count(*) FROM policy_roots),
  'reachable_public_function_count',(SELECT count(*) FROM function_metadata),
  'function_metadata',coalesce((SELECT jsonb_agg(to_jsonb(x)
    ORDER BY name,identity_arguments) FROM (SELECT * FROM function_metadata
    ORDER BY name,identity_arguments LIMIT 300) x),'[]'::jsonb),
  'function_details_truncated',(SELECT count(*)>300 FROM function_metadata),
  'unresolved_qualified_call_candidates',ARRAY(SELECT DISTINCT l.callee_name
    FROM literal_calls l JOIN reachable r ON r.oid=l.caller
    WHERE NOT EXISTS(SELECT 1 FROM functions f WHERE f.proname=l.callee_name)
      AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n
        ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=l.callee_name)
      AND NOT EXISTS(SELECT 1 FROM pg_type t JOIN pg_namespace n
        ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname=l.callee_name)
    ORDER BY l.callee_name),
  'static_edge_count',(SELECT count(*) FROM edges e JOIN reachable r ON r.oid=e.caller),
  'dynamic_SQL_or_outbound_markers_require_manual_review',
    EXISTS(SELECT 1 FROM function_metadata WHERE dynamic_SQL_marker OR outbound_marker),
  'static_graph_complete_for_dynamic_unqualified_or_external_calls',false,
  'function_bodies_application_rows_identifiers_or_credentials_printed',false,
  'application_routines_invoked',0,'Business_fixture_rows_created',0,
  'dispatch_jobs_or_provider_calls_run',0,
  'project_selection_independently_verified',false,
  'rows_functions_triggers_policies_roles_grants_or_settings_changed',false,
  'hosted_acceptance',false,'findings_closed','[]'::jsonb
) INTO v_review;
 SELECT jsonb_agg(value-'raw_body_bytes' ORDER BY value->>'name',value->>'identity_arguments')
 INTO v_rows FROM jsonb_array_elements(v_review->'function_metadata');
 IF encode(sha256(convert_to(v_rows::text,'UTF8')),'hex')<>'cce64c2f461378841804d67177c33ad16566057d48ebdeffb5f95529a99a6aa1'
 OR encode(sha256(convert_to((v_review->'trigger_metadata')::text,'UTF8')),'hex')<>'cd4f4b43dd7a2d6828f380fbc6638edea966b03c8c30f087a6cc237db5a5c708'
 OR encode(sha256(convert_to((v_review->'selected_relations')::text,'UTF8')),'hex')<>'10cdd0151452051c3abe89a57b6f701946801fed871cf8a1c115dc71cd7b7af0'
 OR v_review->>'selected_user_trigger_count'<>'78'
 OR v_review->>'reachable_public_function_count'<>'93'
 OR v_review->>'policy_dependency_root_count'<>'13'
 OR v_review->>'static_edge_count'<>'147'
 OR v_review->'missing_selected_relations'<>'[]'::jsonb
 OR v_review->'missing_API_roots'<>'[]'::jsonb
 OR v_review->'unresolved_qualified_call_candidates'<>'[]'::jsonb
 OR (v_review->>'trigger_details_truncated')::boolean
 OR (v_review->>'function_details_truncated')::boolean
 OR (v_review->>'dynamic_SQL_or_outbound_markers_require_manual_review')::boolean
 THEN RAISE EXCEPTION 'CURRENT_BUSINESS_CATALOG_DIFFERS_FROM_REVIEWED_SOURCE';END IF;
 IF EXISTS(
  SELECT 1 FROM pg_depend d JOIN pg_proc p ON p.oid=d.refobjid
  WHERE d.refclassid='pg_proc'::regclass AND p.pronamespace='public'::regnamespace
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_review->'function_metadata') f
      WHERE f->>'name'=p.proname AND f->>'identity_arguments'=pg_get_function_identity_arguments(p.oid))
    AND (EXISTS(SELECT 1 FROM pg_constraint c WHERE d.classid='pg_constraint'::regclass
          AND d.objid=c.oid AND c.conrelid IN (SELECT format('public.%I',x->>'name')::regclass FROM jsonb_array_elements(v_review->'selected_relations') x))
      OR EXISTS(SELECT 1 FROM pg_attrdef a WHERE d.classid='pg_attrdef'::regclass
          AND d.objid=a.oid AND a.adrelid IN (SELECT format('public.%I',x->>'name')::regclass FROM jsonb_array_elements(v_review->'selected_relations') x)))
 ) THEN RAISE EXCEPTION 'UNREVIEWED_PUBLIC_CONSTRAINT_OR_DEFAULT_FUNCTION';END IF;
 SELECT jsonb_build_object(
   'functions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_proc p WHERE pronamespace='public'::regnamespace),
   'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal),
   'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace),
   'tables',(SELECT jsonb_agg(jsonb_build_object('oid',oid,'owner',relowner,'ACL',relacl,'RLS',relrowsecurity,'force_RLS',relforcerowsecurity) ORDER BY oid) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r')
 ) INTO v_before_metadata;
 SELECT jsonb_build_object(
   'users',(SELECT jsonb_agg(jsonb_build_object('id',id,'email',email) ORDER BY id) FROM auth.users),
   'factors',(SELECT jsonb_agg(jsonb_build_object('id',id,'user_id',user_id,'status',status,'factor_type',factor_type) ORDER BY id) FROM auth.mfa_factors)
 ) INTO v_auth_before;
 FOREACH v_relation IN ARRAY v_preserve LOOP
   EXECUTE format('SELECT count(*)>1000 FROM public.%I',v_relation) INTO v_jobs;
   IF v_jobs THEN RAISE EXCEPTION 'PRIOR_ROW_BASELINE_BOUND_EXCEEDED';END IF;
   EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),''[]''::jsonb) FROM public.%I t',v_relation) INTO v_rows;
   v_before:=v_before||jsonb_build_object(v_relation,v_rows);
 END LOOP;

 IF (SELECT count(*) FROM auth.users)<>2 OR (SELECT count(*) FROM auth.users WHERE lower(email)=ANY(v_emails))<>2
 THEN RAISE EXCEPTION 'EXPECTED_TWO_SYNTHETIC_STAGING_AUTH_USERS';END IF;
 SELECT ARRAY[(SELECT id FROM auth.users WHERE lower(email)=v_emails[1]),(SELECT id FROM auth.users WHERE lower(email)=v_emails[2])] INTO v_users;
 IF (SELECT count(*) FROM public.profiles WHERE id=ANY(v_users) AND account_status='active')<>2
 OR EXISTS(SELECT 1 FROM public.app_admins WHERE user_id=ANY(v_users)) THEN RAISE EXCEPTION 'ORDINARY_ACTIVE_STAGING_ACCOUNTS_REQUIRED';END IF;
 IF EXISTS(SELECT 1 FROM public.budget_workspaces WHERE workspace_type='business') THEN RAISE EXCEPTION 'BUSINESS_FIXTURE_REQUIRES_NO_EXISTING_BUSINESSES';END IF;
 IF EXISTS(SELECT 1 FROM public.push_subscriptions) THEN RAISE EXCEPTION 'STAGING_PUSH_SUBSCRIPTIONS_MUST_BE_EMPTY';END IF;
 SELECT id INTO v_plan FROM public.plans WHERE code='business' AND workspace_type='business' AND is_active;
 IF v_plan IS NULL THEN RAISE EXCEPTION 'ACTIVE_BUSINESS_PLAN_REQUIRED';END IF;
 FOR i IN 1..2 LOOP
  PERFORM set_config('request.jwt.claim.sub',v_users[i]::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_users[i],'email',v_emails[i],'role','authenticated')::text,true);
  v_workspace:=gen_random_uuid();
  v_new_workspaces:=array_append(v_new_workspaces,v_workspace);
  -- Use the existing exact workspace/owner/actor/current-transaction permit.
  -- No Auth/staff elevation, launch switch, sale, approval or new backend function.
  INSERT INTO public.business_public_provision_permits(transaction_id,workspace_id,owner_id,actor_id)
   VALUES(txid_current(),v_workspace,v_users[i],v_users[i]);
  INSERT INTO public.budget_workspaces(id,owner_id,workspace_type,name,status)
   VALUES(v_workspace,v_users[i],'business',v_names[i],'active');
  INSERT INTO public.workspace_members(workspace_id,user_id,role,status)
   VALUES(v_workspace,v_users[i],'business_owner','active');
  DELETE FROM public.business_public_provision_permits WHERE transaction_id=txid_current() AND workspace_id=v_workspace;
  INSERT INTO public.workspace_subscriptions(workspace_id,plan_id,status,paid_through_at,member_limit,billing_period)
   VALUES(v_workspace,v_plan,'active',now()+interval '7 days',4,'monthly');
  INSERT INTO public.workspace_settings(workspace_id,reminder_enabled,conversion_enabled,
   base_currency,reporting_currency,default_payment_currency,enabled_currencies)
   VALUES(v_workspace,false,false,'USD','USD','USD',ARRAY['USD']);
  INSERT INTO public.business_categories(workspace_id,name,category_type,created_by)
   VALUES(v_workspace,'AUDIT-S332-EXPENSE','expense',v_users[i]) RETURNING id INTO v_category;
  FOR j IN 1..2 LOOP
   INSERT INTO public.business_dimensions(workspace_id,dimension_type,name,created_by)
    VALUES(v_workspace,'team','AUDIT-S332-TEAM-'||j,v_users[i]) RETURNING id INTO v_dim;
   INSERT INTO public.business_expense_claims(workspace_id,submitted_by,kind,title,category_id,dimension_id,
    amount,currency,reporting_currency,reporting_amount,exchange_rate,rate_effective_at,rate_provider,expense_date,status)
    VALUES(v_workspace,v_users[i],'company_expense','AUDIT-S332-OWNER-CLAIM-'||j,v_category,v_dim,
     1,'USD','USD',1,1,now(),'identity',current_date,'approved');
  END LOOP;
 END LOOP;
 IF (SELECT count(*) FROM public.budget_workspaces WHERE name=ANY(v_names) AND workspace_type='business')<>2
 OR (SELECT count(*) FROM public.workspace_members m JOIN public.budget_workspaces w ON w.id=m.workspace_id
  WHERE w.name=ANY(v_names) AND m.user_id=w.owner_id AND m.role='business_owner' AND m.status='active')<>2
 OR (SELECT count(*) FROM public.business_roles r JOIN public.budget_workspaces w ON w.id=r.workspace_id
  WHERE w.name=ANY(v_names) AND r.is_system AND r.status='active')<>12
 THEN RAISE EXCEPTION 'BUSINESS_FIXTURE_FINAL_CHECK_FAILED';END IF;


 FOREACH v_relation IN ARRAY v_preserve LOOP
   v_filter:='';
   IF v_relation='budget_workspaces' THEN v_filter:=' WHERE NOT (t.id=ANY($1))';
   ELSIF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=format('public.%I',v_relation)::regclass
                AND attname='workspace_id' AND NOT attisdropped)
   THEN v_filter:=' WHERE t.workspace_id IS NULL OR NOT (t.workspace_id=ANY($1))';END IF;
   EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),''[]''::jsonb) FROM public.%I t',v_relation)||v_filter
   INTO v_rows USING v_new_workspaces;
   IF v_rows IS DISTINCT FROM v_before->v_relation
   THEN RAISE EXCEPTION 'PREEXISTING_AUDIT_ROWS_CHANGED';END IF;
 END LOOP;
 SELECT jsonb_build_object(
   'users',(SELECT jsonb_agg(jsonb_build_object('id',id,'email',email) ORDER BY id) FROM auth.users),
   'factors',(SELECT jsonb_agg(jsonb_build_object('id',id,'user_id',user_id,'status',status,'factor_type',factor_type) ORDER BY id) FROM auth.mfa_factors)
 ) INTO v_auth_after;
 IF v_auth_after IS DISTINCT FROM v_auth_before THEN RAISE EXCEPTION 'AUTH_IDENTITIES_OR_FACTORS_CHANGED';END IF;
 SELECT jsonb_build_object(
   'functions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_proc p WHERE pronamespace='public'::regnamespace),
   'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal),
   'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace),
   'tables',(SELECT jsonb_agg(jsonb_build_object('oid',oid,'owner',relowner,'ACL',relacl,'RLS',relrowsecurity,'force_RLS',relforcerowsecurity) ORDER BY oid) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r')
 ) INTO v_metadata;
 IF v_metadata IS DISTINCT FROM v_before_metadata THEN RAISE EXCEPTION 'PUBLIC_CATALOG_CONTROLS_CHANGED';END IF;
 IF EXISTS(SELECT 1 FROM public.business_public_provision_permits WHERE transaction_id=txid_current() AND workspace_id=ANY(v_new_workspaces))
 THEN RAISE EXCEPTION 'NEW_PROVISION_PERMIT_REMAINS';END IF;
END;
$fixture$;
SELECT jsonb_build_object(
 'stage_step','FR.2.3_BUSINESS_FIXTURE_PREPARATION',
 'result','TWO_CONTROLLED_BUSINESS_FIXTURES_COMMITTED_NOT_API_ACCEPTANCE',
 'target_project','dczlddwbtgvfdujgcitb','checked_UTC',clock_timestamp(),
 'synthetic_businesses',2,'synthetic_USD1_claims',4,'active_dimensions',4,
 'synthetic_entitlement_days',7,'seats_per_business',4,
 'reminders_enabled',false,'automatic_conversion_enabled',false,
 'reviewed_catalog_guard_passed',true,
 'previous_rows_Auth_identity_metadata_and_factors_compared_unchanged',true,
 'public_functions_triggers_policies_grants_and_RLS_compared_unchanged',true,
 'payment_records_total',(SELECT count(*) FROM public.payment_records),
 'payment_record_conversions_total',(SELECT count(*) FROM public.payment_conversions WHERE entity_type='payment_record'),
 'application_trigger_callbacks_invoked_for_new_fixtures',true,
 'claims_context_transaction_local_not_genuine_Auth_acceptance',true,
 'email_Edge_provider_payment_or_scheduler_invoked',false,
 'product_launch_switch_changed',false,
 'project_selection_independently_verified',false,
 'hosted_Business_API_checks_run',0,'hosted_acceptance',false,
 'production_or_native_changed',false,'APK_update_deferred',true,
 'rows_identifiers_emails_or_credentials_printed',false,
 'findings_closed','[]'::jsonb
) AS business_fixture_preparation;
COMMIT;
