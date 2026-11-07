-- Select STAGING dczlddwbtgvfdujgcitb first. Read-only metadata; no installation.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
SET LOCAL search_path = pg_catalog;
SET LOCAL TIME ZONE 'UTC';
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'EMAIL_PREACTIVATION_REQUIRES_PRIVILEGED_SQL_EDITOR';
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
), relations AS (
  SELECT n.nspname::text AS schema_name,c.relname::text AS name,
    c.relkind::text AS kind,c.relrowsecurity AS rls,c.reloptions AS options
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
), policy_summary AS (
  SELECT count(*) AS total,count(*) FILTER(WHERE NOT permissive) AS restrictive,
    md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY schema_name,relation_name,name)::text,'[]')) AS metadata_md5
  FROM policies p
), hooks AS (
  SELECT NOT (EXISTS (
 SELECT 1 FROM pg_event_trigger e
 WHERE e.evtenabled IN ('O','A')
 AND (e.evttags IS NULL OR e.evttags && ARRAY['CREATE SCHEMA','CREATE TABLE','ALTER TABLE','CREATE INDEX','CREATE FUNCTION','ALTER FUNCTION','CREATE TRIGGER','CREATE POLICY','GRANT','REVOKE']::text[])
 AND NOT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  JOIN pg_language l ON l.oid=p.prolang JOIN pg_roles er ON er.oid=e.evtowner JOIN pg_roles pr ON pr.oid=p.proowner
  JOIN (VALUES
   ('pgrst_ddl_watch','ddl_command_end','de987df746eb39647098459e7993bd8595e592969b0cd647828a3d13d37cffe0'),
   ('pgrst_drop_watch','sql_drop','791b41f0632fc86e0fc86a303ec0fd710c4e2ecf947a23422dae2b7a2c122f1d')
  ) reviewed(name,event,body_sha256) ON e.evtname=reviewed.name AND e.evtevent=reviewed.event
  WHERE p.oid=e.evtfoid AND e.evtenabled='O' AND e.evttags IS NULL
  AND n.nspname='extensions' AND p.proname=reviewed.name
  AND er.rolname='supabase_admin' AND pr.rolname='supabase_admin'
  AND p.prokind='f' AND p.pronargs=0 AND p.pronargdefaults=0 AND p.prorettype='event_trigger'::regtype
  AND l.lanname='plpgsql' AND NOT p.prosecdef AND NOT p.proisstrict AND NOT p.proleakproof
  AND p.provolatile='v' AND p.proparallel='u' AND p.prosupport=0 AND p.proconfig=ARRAY['search_path=""']::text[]
  AND encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')=reviewed.body_sha256
 )
 AND NOT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  JOIN pg_language l ON l.oid=p.prolang JOIN pg_roles er ON er.oid=e.evtowner JOIN pg_roles pr ON pr.oid=p.proowner
  WHERE p.oid=e.evtfoid AND e.evtname='ensure_rls' AND e.evtevent='ddl_command_end' AND e.evtenabled='O'
  AND ARRAY(SELECT unnest(e.evttags) ORDER BY 1)=ARRAY['CREATE TABLE','CREATE TABLE AS','SELECT INTO']::text[]
  AND n.nspname='public' AND p.proname='rls_auto_enable' AND er.rolname='postgres' AND pr.rolname='postgres'
  AND p.prokind='f' AND p.pronargs=0 AND p.pronargdefaults=0 AND p.prorettype='event_trigger'::regtype
  AND l.lanname='plpgsql' AND p.prosecdef AND NOT p.proisstrict AND NOT p.proleakproof
  AND p.provolatile='v' AND p.proparallel='u' AND p.prosupport=0 AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
  AND (SELECT count(*) FROM pg_event_trigger WHERE evtfoid=p.oid)=1
  AND (SELECT count(*) FROM pg_proc WHERE pronamespace=p.pronamespace AND proname=p.proname)=1
  AND has_function_privilege('anon',p.oid,'EXECUTE') AND has_function_privilege('authenticated',p.oid,'EXECUTE')
  AND has_function_privilege('service_role',p.oid,'EXECUTE')
  AND octet_length(replace(p.prosrc,E'\r\n',E'\n'))=953
  AND encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='2782e98b348aca7d6f6f73c420fd78d2e094957dd7a52b0483d4c34f29d2a7a1'
 )
)) AS relevant_bindings_match
), required_columns(relation_name,column_name,type_name) AS (
  VALUES ('auth.users','id','uuid'),('auth.users','email_confirmed_at','timestamptz'),
    ('auth.users','encrypted_password','text'),('auth.users','banned_until','timestamptz'),
    ('auth.sessions','id','uuid'),('auth.sessions','user_id','uuid'),
    ('auth.sessions','not_after','timestamptz'),
    ('public.profiles','id','uuid'),('public.profiles','account_status','text')
), checks AS (
  SELECT
    (SELECT count=278 AND metadata_md5='c4f0854e34bb2f8ba4c3a9b79d700fe7' FROM summary)
      AS selected_278_routine_fingerprint_matches,
    (SELECT total=166 AND restrictive=50 AND metadata_md5='c4d08b3911e268d7e133a8ed3d3d330e' FROM policy_summary)
      AS selected_166_policy_fingerprint_matches,
    (SELECT count(*)=81 AND bool_and(rls) FROM relations WHERE schema_name='public' AND kind IN ('r','p'))
      AS public_table_count_and_RLS_match,
    (SELECT count(*)=1 AND bool_and(name='cashbook_account_balances' AND coalesce(options @> ARRAY['security_invoker=true']::text[],false))
      FROM relations WHERE schema_name='public' AND kind IN ('v','m'))
      AS public_view_invoker_metadata_matches,
    (SELECT coalesce(bool_and(rls),false) FROM relations WHERE schema_name='storage' AND kind IN ('r','p'))
      AND EXISTS(SELECT 1 FROM relations WHERE schema_name='storage' AND name='objects' AND kind='r')
      AS observed_storage_tables_have_RLS,
    (SELECT count(*)=9 FROM required_columns x JOIN pg_attribute a
      ON a.attrelid=to_regclass(x.relation_name) AND a.attname=x.column_name
      AND a.attnum>0 AND NOT a.attisdropped AND a.atttypid=to_regtype(x.type_name))
      AS required_Auth_and_profile_column_types_present,
    (SELECT relevant_bindings_match FROM hooks)
      AND (SELECT count(*)=3 FROM pg_event_trigger WHERE evtname IN ('ensure_rls','pgrst_ddl_watch','pgrst_drop_watch') AND evtenabled='O')
      AND (SELECT count(*)=7 FROM pg_event_trigger)
      AS reviewed_event_hook_metadata_matches,
    to_regnamespace('mushavo_email_auth') IS NULL
      AND to_regnamespace('mushavo_email_install') IS NULL
      AND NOT EXISTS(SELECT 1 FROM routines WHERE left(name,11)='email_gate_')
      AND NOT EXISTS(SELECT 1 FROM pg_policy WHERE polname='Email verified session required')
      AS email_backend_installer_and_guards_absent,
    current_user='postgres' AND session_user='postgres'
      AND current_setting('session_replication_role')='origin'
      AND coalesce(current_setting('role',true),'none') IN ('none','postgres')
      AS privileged_origin_matches_installer_context
)
SELECT jsonb_build_object(
  'stage_step','FR.2.4.E4.15_STAGING_METADATA_REFRESH',
  'scope','READ_ONLY_SELECTED_CATALOG_PREREQUISITES_NOT_INSTALLATION_OR_ACTIVATION_APPROVAL',
  'target_project','dczlddwbtgvfdujgcitb',
  'checked_UTC',clock_timestamp(),
  'result',CASE WHEN (SELECT bool_and(value::text::boolean) FROM jsonb_each(to_jsonb(c)))
    THEN 'SELECTED_METADATA_PREREQUISITES_MATCH_NOT_ACTIVATION_APPROVAL'
    ELSE 'SELECTED_STAGING_METADATA_REVIEW_REQUIRED' END,
  'checks',to_jsonb(c),
  'non_event_routines',(SELECT to_jsonb(s) FROM summary s),
  'policies',(SELECT to_jsonb(p) FROM policy_summary p),
  'relation_counts',(SELECT jsonb_agg(to_jsonb(x) ORDER BY schema_name) FROM (
    SELECT schema_name,count(*) FILTER(WHERE kind IN ('r','p')) AS tables,
      count(*) FILTER(WHERE kind IN ('r','p') AND NOT rls) AS tables_without_RLS,
      count(*) FILTER(WHERE kind IN ('v','m')) AS views
    FROM relations GROUP BY schema_name
  ) x),
  'event_hook_count',(SELECT count(*) FROM pg_event_trigger),
  'private_installer_namespace_present',to_regnamespace('mushavo_email_install') IS NOT NULL,
  'email_backend_namespace_present',to_regnamespace('mushavo_email_auth') IS NOT NULL,
  'transaction_read_only',current_setting('transaction_read_only'),
  'application_rows_or_function_bodies_printed',false,
  'application_rows_read',false,
  'application_or_hook_functions_invoked',0,
  'installer_registered_or_invoked',false,
  'rows_roles_grants_Auth_hooks_or_settings_persistently_changed',false,
  'project_selection_independently_verified',false,
  'provider_Auth_gateway_browser_or_email_delivery_verified',false,
  'live_activation_approved',false,
  'hosted_acceptance',false,
  'findings_closed','[]'::jsonb
) AS email_pre_activation_baseline
FROM checks c;
ROLLBACK;
