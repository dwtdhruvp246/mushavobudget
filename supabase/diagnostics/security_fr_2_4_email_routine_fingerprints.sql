-- Select STAGING dczlddwbtgvfdujgcitb. Metadata only; no changes.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
SET LOCAL search_path = pg_catalog;
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'EMAIL_FINGERPRINT_REQUIRES_PRIVILEGED_SQL_EDITOR';
  END IF;
END;
$guard$;
WITH routines AS (
  SELECT p.proname::text AS name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    p.prosecdef AS definer,
    p.prorettype='pg_catalog.trigger'::regtype AS returns_trigger,
    md5(replace(p.prosrc,E'\r\n',E'\n')) AS body_md5,
    p.proconfig AS settings,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
    has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prokind='f'
    AND p.prorettype<>'pg_catalog.event_trigger'::regtype
), encoded AS (
  SELECT md5(jsonb_build_array(name,arguments)::text) AS signature_id,
    body_md5,
    md5(coalesce(to_jsonb(settings)::text,'null')) AS settings_md5,
    (CASE WHEN definer THEN '1' ELSE '0' END)||
    (CASE WHEN returns_trigger THEN '1' ELSE '0' END)||
    (CASE WHEN anon_execute THEN '1' ELSE '0' END)||
    (CASE WHEN authenticated_execute THEN '1' ELSE '0' END)||
    (CASE WHEN service_execute THEN '1' ELSE '0' END) AS flags
  FROM routines
), bounded AS (
  SELECT * FROM encoded ORDER BY signature_id LIMIT 500
)
SELECT jsonb_build_object(
  'stage_step','FR.2.4.E4.1_ROUTINE_FINGERPRINTS',
  'scope','READ_ONLY_PER_FUNCTION_METADATA_FINGERPRINTS_NOT_BODIES_OR_APP_ROWS',
  'intended_project','dczlddwbtgvfdujgcitb',
  'checked_UTC',clock_timestamp(),
  'transaction_read_only',current_setting('transaction_read_only'),
  'routine_count',(SELECT count(*) FROM routines),
  'fingerprint_rows',(SELECT count(*) FROM bounded),
  'truncated',(SELECT count(*)>500 FROM routines),
  'signature_hash_collision',(SELECT count(*)<>count(DISTINCT signature_id) FROM encoded),
  'catalog_metadata_md5',(
    SELECT md5(coalesce(jsonb_agg(to_jsonb(r) ORDER BY name,arguments)::text,'[]'))
    FROM routines r
  ),
  'format','SIGNATURE_MD5:BODY_LF_MD5:SETTINGS_MD5:DTAUS;...',
  'flag_order','DEFINER,TRIGGER_RETURN,ANON_EXECUTE,AUTHENTICATED_EXECUTE,SERVICE_EXECUTE',
  'fingerprints',COALESCE((
    SELECT string_agg(signature_id||':'||body_md5||':'||settings_md5||':'||flags,';' ORDER BY signature_id)
    FROM bounded
  ),''),
  'function_bodies_settings_values_or_application_rows_printed',false,
  'application_routines_invoked',0,
  'functions_hooks_policies_grants_accounts_or_settings_changed',false,
  'project_selection_independently_verified',false,
  'hosted_acceptance',false,
  'findings_closed','[]'::jsonb
) AS email_routine_fingerprints;
ROLLBACK;
