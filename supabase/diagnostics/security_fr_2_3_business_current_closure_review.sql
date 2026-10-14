-- Select STAGING dczlddwbtgvfdujgcitb. Read catalog metadata only.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '3s';
SET LOCAL search_path = pg_catalog;
SET LOCAL TIME ZONE 'UTC';
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user
                 AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'BUSINESS_REVIEW_REQUIRES_PRIVILEGED_SQL_EDITOR';
  END IF;
  IF current_setting('session_replication_role') <> 'origin' THEN
    RAISE EXCEPTION 'BUSINESS_REVIEW_REQUIRES_ORIGIN';
  END IF;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n
      ON n.oid=p.pronamespace WHERE n.nspname='public') > 1000
     OR (SELECT coalesce(sum(octet_length(p.prosrc)),0) FROM pg_proc p
         JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public') > 5000000 THEN
    RAISE EXCEPTION 'BUSINESS_REVIEW_CATALOG_BOUND_EXCEEDED';
  END IF;
END;
$guard$;
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
    md5(coalesce(pg_get_expr(t.tgqual,t.tgrelid),'')) AS when_clause_md5,
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
) AS business_current_closure_review;
ROLLBACK;
