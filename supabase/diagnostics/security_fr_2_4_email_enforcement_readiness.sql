-- Select STAGING dczlddwbtgvfdujgcitb. Metadata only; no installation.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
SET LOCAL search_path = pg_catalog;
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'EMAIL_READINESS_REQUIRES_PRIVILEGED_SQL_EDITOR';
  END IF;
END;
$guard$;
WITH routines AS (
  SELECT p.proname::text AS name, pg_get_function_identity_arguments(p.oid) AS arguments,
    p.prosecdef AS definer, p.prorettype='pg_catalog.trigger'::regtype AS returns_trigger,
    md5(replace(p.prosrc,E'\r\n',E'\n')) AS body_md5, p.proconfig AS settings,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
    has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prokind='f'
), relations AS (
  SELECT n.nspname::text AS schema_name,c.relname::text AS name,c.relkind::text AS kind,
    c.relrowsecurity AS rls,c.relforcerowsecurity AS force_rls,c.reloptions AS options
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','storage') AND c.relkind IN ('r','p','v','m','f')
), policies AS (
  SELECT n.nspname::text AS schema_name,c.relname::text AS relation_name,
    p.polname::text AS name,p.polcmd::text AS command,p.polpermissive AS permissive,
    md5(coalesce(pg_get_expr(p.polqual,p.polrelid),'')) AS using_md5,
    md5(coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')) AS check_md5
  FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','storage')
)
SELECT jsonb_build_object(
  'stage_step','FR.2.4.E4.1_ENFORCEMENT_BASELINE',
  'scope','READ_ONLY_CATALOG_COUNTS_AND_FINGERPRINTS_NOT_APP_ROWS_OR_GUARD_INSTALLATION',
  'intended_project','dczlddwbtgvfdujgcitb',
  'checked_UTC',clock_timestamp(),
  'transaction_read_only',current_setting('transaction_read_only'),
  'public_routines',jsonb_build_object(
    'total',(SELECT count(*) FROM routines),
    'authenticated_executable',(SELECT count(*) FROM routines WHERE authenticated_execute),
    'authenticated_executable_definers',(SELECT count(*) FROM routines WHERE authenticated_execute AND definer),
    'authenticated_executable_trigger_functions',(SELECT count(*) FROM routines WHERE authenticated_execute AND returns_trigger),
    'anonymous_executable',(SELECT count(*) FROM routines WHERE anon_execute),
    'metadata_md5',(SELECT md5(coalesce(jsonb_agg(to_jsonb(r) ORDER BY name,arguments)::text,'[]')) FROM routines r)
  ),
  'relation_counts',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY schema_name) FROM (
    SELECT schema_name,count(*) AS total,
      count(*) FILTER(WHERE kind IN ('r','p')) AS tables,
      count(*) FILTER(WHERE kind IN ('r','p') AND NOT rls) AS tables_without_rls,
      count(*) FILTER(WHERE kind IN ('v','m')) AS views
    FROM relations GROUP BY schema_name
  ) x),'[]'::jsonb),
  'view_metadata',COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY schema_name,name)
    FROM relations v WHERE kind IN ('v','m')),'[]'::jsonb),
  'policies',jsonb_build_object(
    'total',(SELECT count(*) FROM policies),
    'restrictive',(SELECT count(*) FROM policies WHERE NOT permissive),
    'metadata_md5',(SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY schema_name,relation_name,name)::text,'[]')) FROM policies p)
  ),
  'email_backend_schema_present',EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='mushavo_email_auth'),
  'email_gate_public_function_count',(SELECT count(*) FROM routines WHERE left(name,11)='email_gate_'),
  'Auth_session_table_present',to_regclass('auth.sessions') IS NOT NULL,
  'Auth_session_required_columns_present',(SELECT count(*)=3 FROM pg_attribute
    WHERE attrelid=to_regclass('auth.sessions') AND attname IN ('id','user_id','not_after') AND NOT attisdropped),
  'Auth_user_required_columns_present',(SELECT count(*)=4 FROM pg_attribute
    WHERE attrelid=to_regclass('auth.users') AND attname IN ('id','email_confirmed_at','encrypted_password','banned_until') AND NOT attisdropped),
  'application_rows_or_function_bodies_printed',false,
  'application_routines_invoked',0,
  'functions_policies_grants_accounts_factors_or_settings_changed',false,
  'project_selection_independently_verified',false,
  'email_enforcement_installed_by_this_script',false,
  'hosted_acceptance',false,
  'findings_closed','[]'::jsonb
) AS email_enforcement_baseline;
ROLLBACK;
