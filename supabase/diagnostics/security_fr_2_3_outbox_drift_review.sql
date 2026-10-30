-- Select STAGING dczlddwbtgvfdujgcitb first. Catalog metadata only.
-- No function invocation, Business fixtures, job execution or body text output.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
SET LOCAL search_path = pg_catalog, public;
SET LOCAL TIME ZONE 'UTC';
DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = current_user AND (rolsuper OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'OUTBOX_REVIEW_REQUIRES_PRIVILEGED_SQL_EDITOR';
  END IF;
END;
$guard$;

WITH selected_function AS (
  SELECT p.*, l.lanname, r.rolname AS function_owner,
    replace(p.prosrc, E'\r\n', E'\n') AS lf_body
  FROM pg_proc p
  JOIN pg_language l ON l.oid = p.prolang
  JOIN pg_roles r ON r.oid = p.proowner
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname = 'set_payment_outbox_workspace_context'
    AND p.pronargs = 0 AND p.prokind = 'f'
), body_lines AS (
  SELECT p.oid, x.line_number, octet_length(x.line) AS bytes,
    encode(sha256(convert_to(x.line, 'UTF8')), 'hex') AS line_sha256
  FROM selected_function p
  CROSS JOIN LATERAL unnest(
    CASE WHEN octet_length(p.lf_body) <= 8192
      THEN string_to_array(p.lf_body, E'\n')
      ELSE ARRAY[]::text[] END
  ) WITH ORDINALITY AS x(line, line_number)
), function_metadata AS (
  SELECT p.proname AS name, p.function_owner,
    p.lanname AS language,
    p.prorettype::regtype::text AS result_type,
    pg_get_function_identity_arguments(p.oid) AS identity_arguments,
    p.prosecdef AS security_definer,
    p.provolatile::text AS volatility,
    p.proparallel::text AS parallel_mode,
    p.proisstrict AS strict,
    p.proleakproof AS leakproof,
    ARRAY(
      SELECT setting FROM unnest(p.proconfig) setting
      WHERE setting LIKE 'search_path=%'
    ) AS search_path_settings,
    octet_length(p.prosrc) AS raw_body_bytes,
    octet_length(p.lf_body) AS lf_body_bytes,
    md5(p.lf_body) AS lf_body_md5,
    encode(sha256(convert_to(p.lf_body, 'UTF8')), 'hex') AS lf_body_sha256,
    md5(p.lf_body) = '85794a38ffbe61b56bab8aff4b0a3319'
      AS matches_canonical_schema_body,
    md5(p.lf_body) = '097128330dee61398b475cf244293e30'
      AS matches_historical_migration_body,
    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE')
      AS authenticated_execute,
    has_function_privilege('service_role', p.oid, 'EXECUTE')
      AS service_role_execute,
    cardinality(string_to_array(p.lf_body, E'\n')) AS lf_line_count,
    octet_length(p.lf_body) > 8192
      OR cardinality(string_to_array(p.lf_body, E'\n')) > 120
      AS line_details_truncated,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY line_number)
      FROM (
        SELECT line_number, bytes, line_sha256
        FROM body_lines b WHERE b.oid = p.oid
        ORDER BY line_number LIMIT 120
      ) x
    ), '[]'::jsonb) AS exact_line_fingerprints
  FROM selected_function p
), trigger_bindings AS (
  SELECT c.relname AS relation_name, t.tgname AS trigger_name,
    t.tgenabled::text AS enabled_mode,
    t.tgtype::integer AS event_bits,
    n.nspname AS function_schema, p.proname AS function_name,
    t.tgisinternal AS internal,
    t.tgnargs AS argument_count,
    t.tgqual IS NOT NULL AS when_clause_present,
    t.tgoldtable IS NOT NULL OR t.tgnewtable IS NOT NULL
      AS transition_tables_present,
    ARRAY(
      SELECT a.attname::text
      FROM unnest(t.tgattr::smallint[]) WITH ORDINALITY k(num, ord)
      JOIN pg_attribute a ON a.attrelid = t.tgrelid AND a.attnum = k.num
      ORDER BY k.ord
    ) AS update_columns
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_proc p ON p.oid = t.tgfoid
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE t.tgfoid IN (SELECT oid FROM selected_function)
    OR (
      t.tgrelid = to_regclass('public.notification_outbox')
      AND t.tgname = 'set_payment_outbox_workspace_context_trigger'
    )
)
SELECT jsonb_build_object(
  'stage_step', 'FR.2.3_OUTBOX_DRIFT_REVIEW',
  'scope', 'READ_ONLY_EXACT_FUNCTION_LINE_HASHES_AND_TRIGGER_METADATA',
  'target_project', 'dczlddwbtgvfdujgcitb',
  'checked_UTC', clock_timestamp(),
  'transaction_read_only', current_setting('transaction_read_only'),
  'project_selection_independently_verified', false,
  'zero_argument_function_count', (SELECT count(*) FROM selected_function),
  'all_function_overloads_count', (
    SELECT count(*) FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'set_payment_outbox_workspace_context'
  ),
  'selected_function_metadata', COALESCE((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY name) FROM function_metadata x
  ), '[]'::jsonb),
  'trigger_binding_count', (SELECT count(*) FROM trigger_bindings),
  'trigger_bindings', COALESCE((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY relation_name, trigger_name)
    FROM (
      SELECT * FROM trigger_bindings
      ORDER BY relation_name, trigger_name LIMIT 20
    ) x
  ), '[]'::jsonb),
  'trigger_details_truncated', (SELECT count(*) > 20 FROM trigger_bindings),
  'line_normalization', 'CRLF_TO_LF_ONLY_NO_WHITESPACE_STRIPPING',
  'function_bodies_rows_identifiers_or_credentials_printed', false,
  'application_routines_invoked', 0,
  'business_fixture_rows_created', 0,
  'dispatch_jobs_or_provider_calls_run', 0,
  'triggers_functions_roles_grants_or_settings_changed', false,
  'semantic_equivalence_or_safe_replacement_verified', false,
  'hosted_acceptance', false,
  'findings_closed', '[]'::jsonb
) AS outbox_drift_review;
ROLLBACK;
