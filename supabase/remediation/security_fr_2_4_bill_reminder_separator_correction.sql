-- STAGING dczlddwbtgvfdujgcitb only. ASCII transport; no scheduler invocation.
-- Correct only the fingerprinted notification separator literal.
BEGIN;
SET LOCAL statement_timeout='20s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
DO $repair$
DECLARE
  v_oid oid; v_raw text; v_fixed text; v_definition text; v_catalog text;
  v_before jsonb; v_after jsonb;
BEGIN
  IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
     OR current_setting('session_replication_role')<>'origin' THEN
    RAISE EXCEPTION 'BILL_SEPARATOR_REQUIRES_POSTGRES_ORIGIN_SQL_EDITOR';
  END IF;
  IF EXISTS(
    SELECT 1 FROM pg_event_trigger e
    WHERE e.evtenabled IN ('O','A')
      AND (e.evttags IS NULL OR 'CREATE FUNCTION'=ANY(e.evttags))
      AND NOT EXISTS(
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid=p.pronamespace
        JOIN pg_language l ON l.oid=p.prolang
        JOIN pg_roles er ON er.oid=e.evtowner
        JOIN pg_roles pr ON pr.oid=p.proowner
        JOIN (VALUES
          ('pgrst_ddl_watch','ddl_command_end','de987df746eb39647098459e7993bd8595e592969b0cd647828a3d13d37cffe0'),
          ('pgrst_drop_watch','sql_drop','791b41f0632fc86e0fc86a303ec0fd710c4e2ecf947a23422dae2b7a2c122f1d')
        ) reviewed(name,event,body_sha256)
          ON e.evtname=reviewed.name AND e.evtevent=reviewed.event
        WHERE p.oid=e.evtfoid AND e.evtenabled='O' AND e.evttags IS NULL
          AND n.nspname='extensions' AND p.proname=reviewed.name
          AND er.rolname='supabase_admin' AND pr.rolname='supabase_admin'
          AND p.prokind='f' AND p.pronargs=0 AND p.pronargdefaults=0
          AND p.prorettype='event_trigger'::regtype AND l.lanname='plpgsql'
          AND NOT p.prosecdef AND NOT p.proisstrict AND NOT p.proleakproof
          AND p.provolatile='v' AND p.proparallel='u' AND p.prosupport=0
          AND p.proconfig=ARRAY['search_path=""']::text[]
          AND encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')=reviewed.body_sha256
      )
  ) THEN RAISE EXCEPTION 'UNREVIEWED_FUNCTION_DDL_EVENT_HOOK'; END IF;
  IF (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace
      AND proname='enqueue_due_business_bill_reminders')<>1 THEN
    RAISE EXCEPTION 'UNREVIEWED_BILL_REMINDER_OVERLOADS';
  END IF;
  SELECT p.oid,p.prosrc INTO v_oid,v_raw FROM pg_proc p
    JOIN pg_language l ON l.oid=p.prolang JOIN pg_roles o ON o.oid=p.proowner
    WHERE p.oid=to_regprocedure('public.enqueue_due_business_bill_reminders(timestamp with time zone)')
      AND p.prokind='f' AND p.pronargs=1 AND p.pronargdefaults=1 AND p.provariadic=0
      AND p.prorettype='integer'::regtype AND NOT p.proretset AND l.lanname='plpgsql'
      AND p.prosecdef AND NOT p.proisstrict AND NOT p.proleakproof
      AND p.provolatile='v' AND p.proparallel='u' AND p.prosupport=0 AND o.rolname='postgres'
      AND p.proconfig=ARRAY['search_path=public, pg_temp']::text[]
      AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
      AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
      AND has_function_privilege('service_role',p.oid,'EXECUTE');
  IF v_oid IS NULL OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgfoid=v_oid) THEN
    RAISE EXCEPTION 'UNREVIEWED_BILL_REMINDER_METADATA';
  END IF;
  WITH r AS (
    SELECT p.proname::text AS name,pg_get_function_identity_arguments(p.oid) AS arguments,
      p.prosecdef AS definer,p.prorettype='trigger'::regtype AS returns_trigger,
      md5(replace(p.prosrc,E'\r\n',E'\n')) AS body_md5,p.proconfig AS settings,
      has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
      has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
      has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
    FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind='f'
      AND p.prorettype<>'event_trigger'::regtype
  ) SELECT md5(coalesce(jsonb_agg(to_jsonb(r) ORDER BY name,arguments)::text,'[]')) INTO v_catalog FROM r;
  IF v_catalog NOT IN ('1cdb447a3d442a4dfcf87459dea1a63f','c4f0854e34bb2f8ba4c3a9b79d700fe7') THEN
    RAISE EXCEPTION 'BILL_SEPARATOR_UNREVIEWED_PUBLIC_FUNCTION_BASELINE';
  END IF;
  IF encode(sha256(convert_to(replace(v_raw,E'\r\n',E'\n'),'UTF8')),'hex')
      NOT IN ('74ed421080439cca6616ba92e398b17f66d9eff661e8b5191597b9dd646b16c2','1366f72eeb32ffd7eb06fb306d32e8fc8d33e608c3ff9fb0709a89a168c95145') THEN
    RAISE EXCEPTION 'BILL_SEPARATOR_UNREVIEWED_FULL_BODY';
  END IF;
  SELECT jsonb_build_object(
    'functions',(SELECT jsonb_agg(to_jsonb(p)-CASE WHEN p.oid=v_oid THEN 'prosrc' ELSE '__none__' END ORDER BY p.oid)
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','storage','extensions')),
    'relations',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.relowner,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity,c.reloptions) ORDER BY c.oid)
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','storage')),
    'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.schemaname,p.tablename,p.policyname)
      FROM pg_policies p WHERE p.schemaname IN ('public','storage')),
    'triggers',(SELECT jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY t.tgrelid,t.tgname)
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('public','storage') AND NOT t.tgisinternal),
    'event_hooks',(SELECT jsonb_agg(to_jsonb(e) ORDER BY e.evtname) FROM pg_event_trigger e)
  ) INTO v_before;
  IF encode(sha256(convert_to(replace(v_raw,E'\r\n',E'\n'),'UTF8')),'hex')='74ed421080439cca6616ba92e398b17f66d9eff661e8b5191597b9dd646b16c2' THEN
    v_fixed:=replace(v_raw,chr(9516)||chr(9558),chr(183));
    IF encode(sha256(convert_to(replace(v_fixed,E'\r\n',E'\n'),'UTF8')),'hex')<>'1366f72eeb32ffd7eb06fb306d32e8fc8d33e608c3ff9fb0709a89a168c95145' THEN
      RAISE EXCEPTION 'BILL_SEPARATOR_REPLACEMENT_NOT_EXACT';
    END IF;
    v_definition:=pg_get_functiondef(v_oid);
    IF length(v_definition)-length(replace(v_definition,v_raw,''))<>length(v_raw) THEN
      RAISE EXCEPTION 'BILL_SEPARATOR_DEFINITION_NOT_UNIQUE';
    END IF;
    EXECUTE replace(v_definition,v_raw,v_fixed);
  END IF;
  SELECT jsonb_build_object(
    'functions',(SELECT jsonb_agg(to_jsonb(p)-CASE WHEN p.oid=v_oid THEN 'prosrc' ELSE '__none__' END ORDER BY p.oid)
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','storage','extensions')),
    'relations',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.relowner,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity,c.reloptions) ORDER BY c.oid)
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','storage')),
    'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.schemaname,p.tablename,p.policyname)
      FROM pg_policies p WHERE p.schemaname IN ('public','storage')),
    'triggers',(SELECT jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY t.tgrelid,t.tgname)
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('public','storage') AND NOT t.tgisinternal),
    'event_hooks',(SELECT jsonb_agg(to_jsonb(e) ORDER BY e.evtname) FROM pg_event_trigger e)
  ) INTO v_after;
  WITH r AS (
    SELECT p.proname::text AS name,pg_get_function_identity_arguments(p.oid) AS arguments,
      p.prosecdef AS definer,p.prorettype='trigger'::regtype AS returns_trigger,
      md5(replace(p.prosrc,E'\r\n',E'\n')) AS body_md5,p.proconfig AS settings,
      has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
      has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
      has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
    FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind='f'
      AND p.prorettype<>'event_trigger'::regtype
  ) SELECT md5(coalesce(jsonb_agg(to_jsonb(r) ORDER BY name,arguments)::text,'[]')) INTO v_catalog FROM r;
  IF v_after IS DISTINCT FROM v_before OR v_catalog<>'c4f0854e34bb2f8ba4c3a9b79d700fe7'
    OR encode(sha256(convert_to(replace((SELECT prosrc FROM pg_proc WHERE oid=v_oid),E'\r\n',E'\n'),'UTF8')),'hex')<>'1366f72eeb32ffd7eb06fb306d32e8fc8d33e608c3ff9fb0709a89a168c95145' THEN
    RAISE EXCEPTION 'BILL_SEPARATOR_PROTECTED_METADATA_OR_BODY_CHANGED';
  END IF;
END;
$repair$;
COMMIT;
SELECT jsonb_build_object(
  'stage_step','FR.2.4.E4.1_BILL_REMINDER_SEPARATOR_CORRECTION',
  'result','BILL_REMINDER_SEPARATOR_ALIGNED_COMMITTED_NOT_SCHEDULER_ACCEPTANCE',
  'target_project','dczlddwbtgvfdujgcitb',
  'checked_UTC',clock_timestamp(),
  'target_LF_body_md5','cb3b123fa3eb25aed3d2cb0ef3a025db',
  'source_non_event_catalog_matches_under_assertion',true,
  'only_exact_separator_literal_change_permitted',true,
  'function_metadata_grants_policies_relations_triggers_and_event_hooks_compared_unchanged',true,
  'existing_body_line_endings_preserved',true,
  'application_rows_read_or_written_by_script',false,
  'scheduler_function_or_provider_dispatch_invoked',false,
  'project_selection_independently_verified',false,
  'email_enforcement_installed',false,
  'hosted_acceptance',false,'findings_closed','[]'::jsonb,
  'production_or_native_changed',false
) AS bill_reminder_separator_correction;
