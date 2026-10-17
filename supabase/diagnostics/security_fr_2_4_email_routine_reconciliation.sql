-- Select STAGING dczlddwbtgvfdujgcitb. Metadata only; no changes.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
SET LOCAL search_path = pg_catalog;
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'EMAIL_RECONCILIATION_REQUIRES_PRIVILEGED_SQL_EDITOR';
  END IF;
END;
$guard$;
WITH routines AS (
  SELECT p.oid,p.proname::text AS name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    p.prosecdef AS definer,
    p.prorettype='pg_catalog.trigger'::regtype AS returns_trigger,
    p.prorettype='pg_catalog.event_trigger'::regtype AS returns_event_trigger,
    md5(replace(p.prosrc,E'\r\n',E'\n')) AS body_md5,
    p.proconfig AS settings,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
    has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prokind='f'
), comparable AS (
  SELECT name,arguments,definer,returns_trigger,body_md5,settings,
    anon_execute,authenticated_execute,service_execute
  FROM routines WHERE NOT returns_event_trigger
), summary AS (
  SELECT count(*) AS count,
    md5(coalesce(jsonb_agg(to_jsonb(c) ORDER BY name,arguments)::text,'[]')) AS metadata_md5
  FROM comparable c
)
SELECT jsonb_build_object(
  'stage_step','FR.2.4.E4.1_ROUTINE_RECONCILIATION',
  'scope','READ_ONLY_FUNCTION_AND_EVENT_HOOK_METADATA_NOT_GUARD_INSTALLATION',
  'intended_project','dczlddwbtgvfdujgcitb',
  'checked_UTC',clock_timestamp(),
  'transaction_read_only',current_setting('transaction_read_only'),
  'public_function_count',(SELECT count(*) FROM routines),
  'event_trigger_function_count',(SELECT count(*) FROM routines WHERE returns_event_trigger),
  'non_event_trigger_functions',(SELECT to_jsonb(s) FROM summary s),
  'expected_source_non_event_function_count',278,
  'expected_source_non_event_metadata_md5','c4f0854e34bb2f8ba4c3a9b79d700fe7',
  'source_matches_excluding_event_trigger_functions',(
    SELECT count=278 AND metadata_md5='c4f0854e34bb2f8ba4c3a9b79d700fe7' FROM summary
  ),
  'event_trigger_function_details',COALESCE((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY name,arguments)
    FROM (
      SELECT name,arguments,definer,body_md5,settings,
        anon_execute,authenticated_execute,service_execute,
        (SELECT count(*) FROM pg_event_trigger e WHERE e.evtfoid=r.oid) AS bound_event_hooks
      FROM routines r WHERE returns_event_trigger
      ORDER BY name,arguments LIMIT 20
    ) x
  ),'[]'::jsonb),
  'event_trigger_details_truncated',(
    SELECT count(*)>20 FROM routines WHERE returns_event_trigger
  ),
  'application_rows_or_function_bodies_printed',false,
  'application_routines_invoked',0,
  'functions_hooks_policies_grants_accounts_or_settings_changed',false,
  'project_selection_independently_verified',false,
  'hosted_acceptance',false,
  'findings_closed','[]'::jsonb
) AS email_routine_reconciliation;
ROLLBACK;
