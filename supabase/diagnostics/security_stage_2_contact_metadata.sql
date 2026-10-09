-- 2.2.1: STAGING metadata only. Owner must verify Dashboard project dczlddwbtgvfdujgcitb.
-- Production kttkospkblwvguuwnhjj is not the execution target for this handoff.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';

WITH target AS (
  SELECT c.oid, c.relname, c.relkind, c.relowner, c.relrowsecurity, c.relforcerowsecurity
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'enquiries'
), role_set AS (
  SELECT oid, rolname
  FROM pg_catalog.pg_roles
  WHERE rolname IN ('anon', 'authenticated', 'service_role')
), columns AS (
  SELECT a.attnum, a.attname
  FROM pg_catalog.pg_attribute a JOIN target t ON a.attrelid = t.oid
  WHERE a.attnum > 0 AND NOT a.attisdropped
), checks AS (
  SELECT '01 Read-only target context'::text AS check_name, 'INFO'::text AS status,
    jsonb_build_object(
      'checked_at', transaction_timestamp(),
      'database', current_database(),
      'server_version', current_setting('server_version'),
      'transaction_read_only', current_setting('transaction_read_only'),
      'intended_staging_reference', 'dczlddwbtgvfdujgcitb',
      'production_reference_to_avoid', 'kttkospkblwvguuwnhjj',
      'hosted_identity_proven_by_sql', false
    ) AS details
  UNION ALL
  SELECT '02 Enquiries table and RLS metadata', 'REVIEW',
    jsonb_build_object(
      'table_present', EXISTS (SELECT 1 FROM target),
      'selected_table_count', (SELECT count(*) FROM target),
      'roles_found', (SELECT COALESCE(jsonb_agg(rolname ORDER BY rolname), '[]'::jsonb) FROM role_set),
      'table', (SELECT jsonb_build_object(
        'name', relname, 'kind', relkind,
        'owner', pg_catalog.pg_get_userbyid(relowner),
        'rls_enabled', relrowsecurity, 'rls_forced', relforcerowsecurity
      ) FROM target),
      'scope', 'Metadata only; flags do not prove policy behavior.'
    )
  UNION ALL
  SELECT '03 Effective table and column privileges', 'REVIEW',
    jsonb_build_object(
      'table_privileges', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'role', r.rolname,
          'select', pg_catalog.has_table_privilege(r.oid, t.oid, 'SELECT'),
          'insert', pg_catalog.has_table_privilege(r.oid, t.oid, 'INSERT'),
          'update', pg_catalog.has_table_privilege(r.oid, t.oid, 'UPDATE'),
          'delete', pg_catalog.has_table_privilege(r.oid, t.oid, 'DELETE')
        ) ORDER BY r.rolname), '[]'::jsonb)
        FROM role_set r CROSS JOIN target t
      ),
      'column_privileges', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'role', r.rolname, 'column', a.attname,
          'select', pg_catalog.has_column_privilege(r.oid, t.oid, a.attnum, 'SELECT'),
          'insert', pg_catalog.has_column_privilege(r.oid, t.oid, a.attnum, 'INSERT'),
          'update', pg_catalog.has_column_privilege(r.oid, t.oid, a.attnum, 'UPDATE')
        ) ORDER BY r.rolname, a.attnum), '[]'::jsonb)
        FROM role_set r CROSS JOIN target t CROSS JOIN columns a
      ),
      'scope', 'Effective privileges include inherited/PUBLIC and table-level grants; RLS/runtime behavior is separate.'
    )
  UNION ALL
  SELECT '04 Policies constraints and trigger metadata', 'REVIEW',
    jsonb_build_object(
      'policies', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'name', po.polname, 'command', po.polcmd,
          'permissive', po.polpermissive,
          'roles', (SELECT jsonb_agg(
            CASE WHEN x.role_oid = 0 THEN 'PUBLIC'
                 ELSE pg_catalog.pg_get_userbyid(x.role_oid) END
            ORDER BY x.role_oid
          ) FROM unnest(po.polroles) AS x(role_oid)),
          'using_expression_present', po.polqual IS NOT NULL,
          'with_check_expression_present', po.polwithcheck IS NOT NULL
        ) ORDER BY po.polname), '[]'::jsonb)
        FROM pg_catalog.pg_policy po JOIN target t ON po.polrelid = t.oid
      ),
      'constraints', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'name', co.conname, 'type', co.contype, 'validated', co.convalidated
        ) ORDER BY co.conname), '[]'::jsonb)
        FROM pg_catalog.pg_constraint co JOIN target t ON co.conrelid = t.oid
      ),
      'triggers', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'name', tr.tgname, 'enabled', tr.tgenabled,
          'routine', tr.tgfoid::regprocedure::text
        ) ORDER BY tr.tgname), '[]'::jsonb)
        FROM pg_catalog.pg_trigger tr JOIN target t ON tr.tgrelid = t.oid
        WHERE NOT tr.tgisinternal
      ),
      'expressions_and_function_bodies_returned', false,
      'runtime_validation_challenge_and_quota_enforcement_proven', false
    )
  UNION ALL
  SELECT '05 Name-based contact routine and boundary inventory', 'REVIEW',
    jsonb_build_object(
      'routines', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'signature', pr.oid::regprocedure::text,
          'security_definer', pr.prosecdef,
          'owner', pg_catalog.pg_get_userbyid(pr.proowner)
        ) ORDER BY pr.oid::regprocedure::text), '[]'::jsonb)
        FROM pg_catalog.pg_proc pr
        JOIN pg_catalog.pg_namespace ns ON ns.oid = pr.pronamespace
        WHERE ns.nspname = 'public' AND pr.proname ~* '(enquir|contact|captcha|turnstile)'
      ),
      'scope', 'Name-based inventory only; no complete reachable-path, challenge or rate-limit behavior proof.',
      'customer_rows_or_function_bodies_returned', false,
      'schema_or_data_changed', false,
      'enquiry_email_push_or_edge_request_sent', false
    )
)
SELECT check_name, status, details FROM checks ORDER BY check_name;
ROLLBACK;
