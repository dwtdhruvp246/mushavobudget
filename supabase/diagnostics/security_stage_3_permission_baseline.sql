-- 3.1.1: catalog-only baseline. Run the ENTIRE script in STAGING.
-- Owner must verify Dashboard project dczlddwbtgvfdujgcitb first.
-- Production kttkospkblwvguuwnhjj is not the target for this handoff.
-- Eight rows in ONE result set. No application routine is called.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';

WITH api_roles AS (
  SELECT wanted.name, r.oid, r.rolsuper, r.rolbypassrls
  FROM (VALUES ('anon'), ('authenticated'), ('service_role')) AS wanted(name)
  LEFT JOIN pg_catalog.pg_roles r ON r.rolname = wanted.name
), selected_tables(name) AS (
  VALUES ('profiles'), ('app_admins'), ('families'), ('family_members'),
    ('family_invitations'), ('payment_items'), ('payment_records'),
    ('payments'), ('budget_workspaces'), ('workspace_members'),
    ('workspace_invitations'), ('workspace_settings'), ('workspace_subscriptions'),
    ('payment_conversions'), ('business_roles'), ('business_role_permissions'),
    ('business_member_permissions'), ('business_member_scopes'),
    ('business_expense_claims'), ('business_bills'), ('business_budgets'),
    ('business_documents'), ('notifications'), ('admin_user_invitations')
), table_metadata AS (
  SELECT wanted.name, c.oid, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
    (SELECT count(*) FROM pg_catalog.pg_policy p WHERE p.polrelid = c.oid) AS policies,
    (SELECT count(*) FROM pg_catalog.pg_policy p WHERE p.polrelid = c.oid AND NOT p.polpermissive) AS restrictive_policies,
    (SELECT count(*) FROM pg_catalog.pg_trigger t WHERE t.tgrelid = c.oid AND NOT t.tgisinternal AND t.tgenabled <> 'D') AS enabled_user_triggers,
    (SELECT jsonb_object_agg(r.name, jsonb_build_object(
       'select_any_column', pg_catalog.has_any_column_privilege(r.oid, c.oid, 'SELECT'),
       'insert_any_column', pg_catalog.has_any_column_privilege(r.oid, c.oid, 'INSERT'),
       'update_any_column', pg_catalog.has_any_column_privilege(r.oid, c.oid, 'UPDATE'),
       'delete', pg_catalog.has_table_privilege(r.oid, c.oid, 'DELETE')) ORDER BY r.name)
     FROM api_roles r WHERE r.name IN ('anon', 'authenticated')) AS effective_grants
  FROM selected_tables wanted
  LEFT JOIN pg_catalog.pg_class c ON c.oid = pg_catalog.to_regclass('public.' || wanted.name)
), all_public_relations AS (
  SELECT c.* FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
    AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_depend d
      WHERE d.classid = 'pg_catalog.pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e')
), selected_routines(category, signature) AS (
  VALUES
    ('membership', 'is_workspace_member(uuid)'),
    ('membership', 'is_workspace_owner(uuid)'),
    ('family', 'is_active_family_participant(uuid)'),
    ('family', 'can_manage_family_members(uuid)'),
    ('family', 'respond_to_family_invitation(uuid,boolean)'),
    ('family', 'remove_family_member(uuid,uuid)'),
    ('business', 'business_has_permission(uuid,text)'),
    ('business', 'business_claim_in_scope(uuid,uuid)'),
    ('business', 'business_check_role_assignment(uuid,text,uuid[],uuid)'),
    ('business', 'respond_business_invitation(uuid,boolean)'),
    ('business', 'update_business_member_role_access(uuid,uuid,text,uuid[],jsonb)'),
    ('business', 'remove_business_member(uuid,uuid)'),
    ('business', 'save_business_role(uuid,text,text,text,text,text[],integer)'),
    ('platform', 'is_app_admin()'),
    ('platform', 'is_platform_staff(text[])'),
    ('account', 'my_account_suspended()'),
    ('currency', 'save_workspace_currency_settings(uuid,text,text[],text,boolean)'),
    ('currency', 'save_manual_payment_conversion(text,uuid,text,numeric,numeric)'),
    ('public_lookup', 'get_public_signup_currencies()'),
    ('public_lookup', 'get_public_plan_catalogue(text)')
), routine_metadata AS (
  SELECT wanted.category, wanted.signature, p.oid, p.prosecdef,
    EXISTS (SELECT 1 FROM unnest(p.proconfig) setting WHERE setting LIKE 'search_path=%') AS search_path_setting_present,
    (SELECT jsonb_object_agg(r.name, pg_catalog.has_function_privilege(r.oid, p.oid, 'EXECUTE') ORDER BY r.name)
       FROM api_roles r) AS effective_execute
  FROM selected_routines wanted
  LEFT JOIN pg_catalog.pg_proc p ON p.oid = pg_catalog.to_regprocedure('public.' || wanted.signature)
), helper_signatures(signature) AS (
  VALUES ('store_api_payment_conversion(text,uuid,uuid,numeric,text,text,timestamp with time zone)'),
         ('currency_conversion_backfill_dates(integer)')
), helpers AS (
  SELECT wanted.signature, p.oid, p.prosecdef,
    COALESCE('search_path=public, pg_temp' = ANY(p.proconfig), false) AS expected_search_path,
    (SELECT pg_catalog.has_function_privilege(r.oid, p.oid, 'EXECUTE') FROM api_roles r WHERE r.name = 'anon') AS anon_execute,
    (SELECT pg_catalog.has_function_privilege(r.oid, p.oid, 'EXECUTE') FROM api_roles r WHERE r.name = 'authenticated') AS authenticated_execute,
    (SELECT pg_catalog.has_function_privilege(r.oid, p.oid, 'EXECUTE') FROM api_roles r WHERE r.name = 'service_role') AS service_execute
  FROM helper_signatures wanted
  LEFT JOIN pg_catalog.pg_proc p ON p.oid = pg_catalog.to_regprocedure('public.' || wanted.signature)
), public_definers AS (
  SELECT p.oid, p.prorettype,
    pg_catalog.format('%I.%I(%s)', n.nspname, p.proname, pg_catalog.oidvectortypes(p.proargtypes)) AS signature,
    EXISTS (SELECT 1 FROM unnest(p.proconfig) setting WHERE setting LIKE 'search_path=%') AS search_path_setting_present,
    (SELECT pg_catalog.has_function_privilege(r.oid, p.oid, 'EXECUTE') FROM api_roles r WHERE r.name = 'anon') AS anon_execute
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind IN ('f', 'p')
    AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_depend d
      WHERE d.classid = 'pg_catalog.pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')
), private_read_guards AS (
  SELECT * FROM table_metadata WHERE name IN ('app_admins', 'payment_records',
    'payments', 'profiles', 'workspace_invitations', 'workspace_members', 'workspace_subscriptions')
), results AS (
  SELECT 1 AS position, '01 Read-only STAGING baseline context' AS check_name, 'INFO' AS status,
    jsonb_build_object('stage_step', '3.1.1', 'checked_at', transaction_timestamp(),
      'intended_staging_reference', 'dczlddwbtgvfdujgcitb',
      'production_reference_to_avoid', 'kttkospkblwvguuwnhjj',
      'project_identity', 'Owner verifies Dashboard URL; SQL labels do not establish hosted identity',
      'current_database', current_database(), 'server_version', current_setting('server_version'),
      'transaction_read_only', current_setting('transaction_read_only'),
      'transaction_isolation', current_setting('transaction_isolation')) AS details
  UNION ALL
  SELECT 2, '02 API roles and public schema access',
    CASE WHEN count(oid) = 3 THEN 'INFO' ELSE 'REVIEW' END,
    jsonb_build_object('roles', jsonb_agg(jsonb_build_object('name', name, 'present', oid IS NOT NULL,
      'superuser', rolsuper, 'bypass_rls', rolbypassrls,
      'public_schema_usage', pg_catalog.has_schema_privilege(oid, pg_catalog.to_regnamespace('public'), 'USAGE'),
      'public_schema_create', pg_catalog.has_schema_privilege(oid, pg_catalog.to_regnamespace('public'), 'CREATE')) ORDER BY name),
      'scope', 'Database API role flags only; these are not customer roles or authorization tests') FROM api_roles
  UNION ALL
  SELECT 3, '03 Application relations and selected RLS metadata', 'REVIEW',
    jsonb_build_object(
      'all_public_nonextension_tables', (SELECT count(*) FROM all_public_relations WHERE relkind IN ('r', 'p')),
      'tables_without_rls', (SELECT COALESCE(jsonb_agg(relname ORDER BY relname), '[]'::jsonb)
         FROM all_public_relations WHERE relkind IN ('r', 'p') AND NOT relrowsecurity),
      'view_like_relations', (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', relname, 'kind', relkind,
         'security_invoker_option', COALESCE('security_invoker=true' = ANY(reloptions), false)) ORDER BY relname), '[]'::jsonb)
         FROM all_public_relations WHERE relkind IN ('v', 'm', 'f')),
      'selected_count', count(*),
      'selected_relations', jsonb_agg(jsonb_build_object('name', name, 'present', oid IS NOT NULL,
        'kind', relkind, 'rls_enabled', relrowsecurity, 'rls_forced', relforcerowsecurity,
        'policy_count', policies, 'restrictive_policy_count', restrictive_policies,
        'enabled_user_trigger_count', enabled_user_triggers, 'effective_grants', effective_grants) ORDER BY name),
      'scope', 'Effective grants include PUBLIC/inheritance and column grants. RLS flags/counts do not prove policy behavior; views and foreign tables require separate review')
    FROM table_metadata
  UNION ALL
  SELECT 4, '04 Prior seven-table anonymous read restriction',
    CASE WHEN count(*) = 7 AND bool_and(COALESCE(oid IS NOT NULL AND relkind IN ('r', 'p') AND relrowsecurity
      AND (effective_grants #>> '{anon,select_any_column}')::boolean = false, false)) THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('expected_tables', 7,
      'records', jsonb_agg(jsonb_build_object('table', name, 'present', oid IS NOT NULL,
        'rls_enabled', relrowsecurity, 'anon_select_any_column', effective_grants #> '{anon,select_any_column}') ORDER BY name),
      'scope', 'Only installed table/RLS and effective anonymous SELECT metadata; no signed-in or cross-workspace authorization proof')
    FROM private_read_guards
  UNION ALL
  SELECT 5, '05 Selected application entrypoint metadata', 'REVIEW',
    jsonb_build_object('selected_count', count(*),
      'records', jsonb_agg(jsonb_build_object('category', category, 'signature', signature, 'present', oid IS NOT NULL,
        'security_definer', prosecdef, 'search_path_setting_present', search_path_setting_present,
        'effective_execute', effective_execute) ORDER BY category, signature),
      'scope', 'No function bodies or setting values returned and no application function invoked. A search-path setting being present is not proof it is safe. EXECUTE is not role/body authorization')
    FROM routine_metadata
  UNION ALL
  SELECT 6, '06 Protected currency-helper grant baseline',
    CASE WHEN count(*) = 2 AND bool_and(COALESCE(oid IS NOT NULL AND prosecdef AND expected_search_path
      AND anon_execute = false AND authenticated_execute = false AND service_execute = true, false))
      THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('expected_helpers', 2,
      'records', jsonb_agg(jsonb_build_object('signature', signature, 'present', oid IS NOT NULL,
        'security_definer', prosecdef, 'expected_search_path_metadata', expected_search_path,
        'anon_execute', anon_execute, 'authenticated_execute', authenticated_execute, 'service_execute', service_execute) ORDER BY signature),
      'scope', 'Metadata only; legitimate protected callers, conversions, history and scheduled execution still need controlled behavior checks')
    FROM helpers
  UNION ALL
  SELECT 7, '07 Remaining anonymous SECURITY DEFINER inventory', 'REVIEW',
    jsonb_build_object('all_public_nonextension_security_definers', count(*),
      'anon_executable_count', count(*) FILTER (WHERE anon_execute),
      'anon_executable_trigger_or_event_trigger_count', count(*) FILTER (WHERE anon_execute
        AND prorettype IN ('pg_catalog.trigger'::regtype, 'pg_catalog.event_trigger'::regtype)),
      'anon_executable_without_search_path_setting', count(*) FILTER (WHERE anon_execute AND NOT search_path_setting_present),
      'anon_executable_signatures', COALESCE(jsonb_agg(signature ORDER BY signature) FILTER (WHERE anon_execute), '[]'::jsonb),
      'scope', 'Inventory for classification. Trigger functions, public lookups and body-authorized functions are distinct; no blanket revokes or safety/HTTP exposure proof')
    FROM public_definers
  UNION ALL
  SELECT 8, '08 Baseline review boundary and next tests', 'INFO',
    jsonb_build_object('schema_or_application_rows_modified', false, 'application_routines_invoked', false,
      'function_bodies_policy_expressions_or_setting_values_returned', false,
      'customer_rows_tokens_keys_or_private_identifiers_returned', false,
      'mfa_or_auth_settings_changed', false, 'allowed_denied_api_workflows_verified', false,
      'production_or_native_changed', false,
      'next', 'Reconcile this staging metadata with the permission map; controlled synthetic Personal/Family, Business and privileged/Auth batches follow in 3.2-3.5')
)
SELECT check_name, status, details FROM results ORDER BY position;
ROLLBACK;
