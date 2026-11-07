-- FR.2.2: select STAGING dczlddwbtgvfdujgcitb in the SQL Editor first.
-- End any failed installer transaction; this does not install the rollback candidate.
ROLLBACK;
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';

WITH hooks AS (
  SELECT e.evtname AS name, e.evtevent AS event,
         e.evtenabled::text AS enabled_mode, e.evttags AS tags,
         er.rolname AS hook_owner, pr.rolname AS function_owner,
         n.nspname AS function_schema, p.proname AS function_name,
         pg_get_function_identity_arguments(p.oid) AS identity_arguments,
         pg_get_function_result(p.oid) AS result_type,
         l.lanname AS language, p.prosecdef AS security_definer,
         ARRAY(SELECT s FROM unnest(p.proconfig) AS s
               WHERE s LIKE 'search_path=%' ORDER BY s) AS search_path_settings,
         md5(replace(p.prosrc, E'\r\n', E'\n')) AS lf_body_md5,
         octet_length(p.prosrc) AS body_bytes,
         (e.evtenabled IN ('O', 'A') AND
          (e.evttags IS NULL OR 'CREATE TRIGGER' = ANY(e.evttags)))
           AS matches_current_installer_guard
  FROM pg_event_trigger e
  JOIN pg_proc p ON p.oid = e.evtfoid
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  JOIN pg_roles er ON er.oid = e.evtowner
  JOIN pg_roles pr ON pr.oid = p.proowner
), binding AS (
  SELECT t.tgname AS name, t.tgenabled::text AS enabled_mode,
         t.tgtype::integer AS event_bits,
         n.nspname AS function_schema, p.proname AS function_name,
         ARRAY(SELECT a.attname::text
               FROM unnest(t.tgattr::smallint[]) WITH ORDINALITY AS x(num, ord)
               JOIN pg_attribute a ON a.attrelid = t.tgrelid AND a.attnum = x.num
               ORDER BY x.ord) AS update_columns
  FROM pg_trigger t
  JOIN pg_proc p ON p.oid = t.tgfoid
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE t.tgrelid = to_regclass('public.payment_records')
    AND t.tgname = 'sync_payment_record_workspace_trigger'
    AND NOT t.tgisinternal
)
SELECT jsonb_build_object(
  'stage_step', 'FR.2.2_EVENT_HOOK_REVIEW',
  'scope', 'READ_ONLY_EVENT_HOOK_AND_BINDING_TRIGGER_METADATA',
  'checked_UTC', clock_timestamp(),
  'intended_project', 'dczlddwbtgvfdujgcitb',
  'project_selection_independently_verified', false,
  'current_role', current_user,
  'transaction_read_only', current_setting('transaction_read_only'),
  'session_replication_role', current_setting('session_replication_role'),
  'event_hooks', COALESCE((SELECT jsonb_agg(to_jsonb(h) ORDER BY name) FROM hooks h), '[]'::jsonb),
  'hooks_matching_current_installer_guard', (SELECT count(*) FROM hooks WHERE matches_current_installer_guard),
  'binding_trigger', COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM binding b), '[]'::jsonb),
  'function_bodies_or_application_rows_printed', false,
  'application_routines_invoked', 0,
  'hooks_disabled_or_trigger_replaced', false,
  'hosted_authorization_acceptance', false
) AS event_hook_review;

ROLLBACK;
