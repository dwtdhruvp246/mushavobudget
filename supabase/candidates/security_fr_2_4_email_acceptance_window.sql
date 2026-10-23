-- Batch K staging-only candidate: install CLOSED acceptance controls; never open a window.
-- No hosted execution entry point is supplied in this offline checkpoint.
BEGIN;
SET LOCAL statement_timeout='35s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
DO $window_guard$ BEGIN
 IF NOT ((jsonb_build_object('privileged_origin',current_user='postgres' AND session_user='postgres'
 AND current_setting('session_replication_role')='origin'
 AND coalesce(current_setting('role',true),'none') IN ('none','postgres')
 AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)),
 'transaction_read_only',current_setting('transaction_read_only')))->>'privileged_origin')::boolean
 THEN RAISE EXCEPTION 'EMAIL_WINDOW_PRIVILEGED_ORIGIN_REQUIRED'; END IF;
 IF current_setting('mushavo.email_rollout_project',true) IS DISTINCT FROM 'dczlddwbtgvfdujgcitb'
 OR current_setting('mushavo.email_rollout_action',true) IS DISTINCT FROM 'INSTALL_CLOSED_STAGING_ACCEPTANCE_CONTROLS'
 THEN RAISE EXCEPTION 'EMAIL_WINDOW_TARGET_ACTION_REQUIRED'; END IF;
 IF EXISTS (
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
) THEN RAISE EXCEPTION 'EMAIL_ATOMIC_UNREVIEWED_DDL_HOOK'; END IF;
 PERFORM pg_advisory_xact_lock(20261017,2411);
 IF (jsonb_build_object(
 'schemas',(SELECT jsonb_agg(jsonb_build_array(n.nspname,r.rolname,n.nspacl::text) ORDER BY n.nspname)
 FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner WHERE n.nspname='mushavo_email_install'),
 'functions',(SELECT jsonb_agg(jsonb_build_array(p.proname,pg_get_function_identity_arguments(p.oid),
 p.prorettype::regtype::text,l.lanname,r.rolname,p.prokind,p.prosecdef,p.proisstrict,p.proleakproof,
 p.provolatile,p.proparallel,p.pronargdefaults,p.proconfig,p.proacl::text,
 encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),
 has_function_privilege('anon',p.oid,'EXECUTE'),has_function_privilege('authenticated',p.oid,'EXECUTE'),has_function_privilege('service_role',p.oid,'EXECUTE'))
 ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
 JOIN pg_language l ON l.oid=p.prolang WHERE p.pronamespace=to_regnamespace('mushavo_email_install')),
 'relations',(SELECT jsonb_agg(jsonb_build_array(c.relname,c.relkind,r.rolname,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text,c.reloptions)
 ORDER BY c.relname) FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner WHERE c.relnamespace=to_regnamespace('mushavo_email_install')),
 'columns',(SELECT jsonb_agg(jsonb_build_array(c.relname,a.attname,a.atttypid::regtype::text,a.atttypmod,a.attnotnull,
 a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) ORDER BY c.relname,a.attnum)
 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE c.relnamespace=to_regnamespace('mushavo_email_install') AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.relname,k.conname,pg_get_constraintdef(k.oid),k.convalidated) ORDER BY c.relname,k.conname)
 FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid WHERE c.relnamespace=to_regnamespace('mushavo_email_install')),
 'indexes',(SELECT jsonb_agg(jsonb_build_array(indexname,indexdef) ORDER BY indexname) FROM pg_indexes WHERE schemaname='mushavo_email_install'),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_policies p WHERE schemaname='mushavo_email_install'),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid)) ORDER BY c.relname,t.tgname)
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace=to_regnamespace('mushavo_email_install') AND NOT t.tgisinternal),
 'schema_api_access',(SELECT jsonb_agg(jsonb_build_array(x,has_schema_privilege(x,n.oid,'USAGE'),has_schema_privilege(x,n.oid,'CREATE')) ORDER BY x)
 FROM pg_namespace n CROSS JOIN unnest(ARRAY['anon','authenticated','service_role']) x WHERE n.nspname='mushavo_email_install'),
 'table_api_access',(SELECT jsonb_agg(jsonb_build_array(x,c.relname,has_table_privilege(x,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) ORDER BY x,c.relname)
 FROM pg_class c CROSS JOIN unnest(ARRAY['anon','authenticated','service_role']) x WHERE c.relnamespace=to_regnamespace('mushavo_email_install') AND c.relkind='r'))) IS DISTINCT FROM ('{"15":{"columns":[["rollout_control","singleton","boolean",-1,true,"","","true"],["rollout_control","target_project","text",-1,true,"","",null],["rollout_control","mode","text",-1,true,"","",null],["rollout_control","catalog_sha256","text",-1,false,"","",null],["rollout_control","changed_at","timestamp with time zone",-1,true,"","","clock_timestamp()"]],"indexes":[["rollout_control_pkey","CREATE UNIQUE INDEX rollout_control_pkey ON mushavo_email_install.rollout_control USING btree (singleton)"]],"schemas":[["mushavo_email_install","postgres","{postgres=UC/postgres}"]],"policies":null,"triggers":null,"functions":[["activate","","jsonb","plpgsql","postgres","f",false,false,false,"v","u",0,["search_path=pg_catalog","lock_timeout=3s"],"{postgres=X/postgres}","fe59f9e7bec7a5f8c06c128d139ff02e940deb263907d3ecc188a946825a2fce",false,false,false],["catalog_identity","","text","sql","postgres","f",false,false,false,"s","u",0,["search_path=pg_catalog"],"{postgres=X/postgres}","9f43bff7c6c0209b28da2943a63509caf977cff2d024ce7151770eceec26fdc0",false,false,false],["quarantine","","jsonb","plpgsql","postgres","f",false,false,false,"v","u",0,["search_path=pg_catalog","lock_timeout=3s"],"{postgres=X/postgres}","0fe61c34f3c57747b1c2399d6e0644e40bb9425b2012e224d3aaa4061d7bd603",false,false,false],["register_staging","","jsonb","plpgsql","postgres","f",false,false,false,"v","u",0,["search_path=pg_catalog","lock_timeout=3s"],"{postgres=X/postgres}","b03879099fa1866dd7c5e4298326423d0946799f36050b88399c66815a446203",false,false,false],["resume","","jsonb","plpgsql","postgres","f",false,false,false,"v","u",0,["search_path=pg_catalog","lock_timeout=3s"],"{postgres=X/postgres}","131cf5f5f7df1e4f511d7aae875e93e7f9f5f15acb9b538911ff8de611c71866",false,false,false]],"relations":[["rollout_control","r","postgres",true,true,"{postgres=arwdDxt/postgres}",null],["rollout_control_pkey","i","postgres",false,false,null,null]],"constraints":[["rollout_control","rollout_control_catalog_sha256_check","CHECK ((catalog_sha256 ~ ''^[0-9a-f]{64}$''::text))",true],["rollout_control","rollout_control_check","CHECK (((mode = ''REGISTERED''::text) = (catalog_sha256 IS NULL)))",true],["rollout_control","rollout_control_mode_check","CHECK ((mode = ANY (ARRAY[''REGISTERED''::text, ''QUARANTINED''::text, ''ACTIVE''::text])))",true],["rollout_control","rollout_control_pkey","PRIMARY KEY (singleton)",true],["rollout_control","rollout_control_singleton_check","CHECK (singleton)",true],["rollout_control","rollout_control_target_project_check","CHECK ((target_project = ''dczlddwbtgvfdujgcitb''::text))",true]],"table_api_access":[["anon","rollout_control",false],["authenticated","rollout_control",false],["service_role","rollout_control",false]],"schema_api_access":[["anon",false,false],["authenticated",false,false],["service_role",false,false]]},"16":{"columns":[["rollout_control","singleton","boolean",-1,true,"","","true"],["rollout_control","target_project","text",-1,true,"","",null],["rollout_control","mode","text",-1,true,"","",null],["rollout_control","catalog_sha256","text",-1,false,"","",null],["rollout_control","changed_at","timestamp with time zone",-1,true,"","","clock_timestamp()"]],"indexes":[["rollout_control_pkey","CREATE UNIQUE INDEX rollout_control_pkey ON mushavo_email_install.rollout_control USING btree (singleton)"]],"schemas":[["mushavo_email_install","postgres","{postgres=UC/postgres}"]],"policies":null,"triggers":null,"functions":[["activate","","jsonb","plpgsql","postgres","f",false,false,false,"v","u",0,["search_path=pg_catalog","lock_timeout=3s"],"{postgres=X/postgres}","fe59f9e7bec7a5f8c06c128d139ff02e940deb263907d3ecc188a946825a2fce",false,false,false],["catalog_identity","","text","sql","postgres","f",false,false,false,"s","u",0,["search_path=pg_catalog"],"{postgres=X/postgres}","9f43bff7c6c0209b28da2943a63509caf977cff2d024ce7151770eceec26fdc0",false,false,false],["quarantine","","jsonb","plpgsql","postgres","f",false,false,false,"v","u",0,["search_path=pg_catalog","lock_timeout=3s"],"{postgres=X/postgres}","0fe61c34f3c57747b1c2399d6e0644e40bb9425b2012e224d3aaa4061d7bd603",false,false,false],["register_staging","","jsonb","plpgsql","postgres","f",false,false,false,"v","u",0,["search_path=pg_catalog","lock_timeout=3s"],"{postgres=X/postgres}","b03879099fa1866dd7c5e4298326423d0946799f36050b88399c66815a446203",false,false,false],["resume","","jsonb","plpgsql","postgres","f",false,false,false,"v","u",0,["search_path=pg_catalog","lock_timeout=3s"],"{postgres=X/postgres}","131cf5f5f7df1e4f511d7aae875e93e7f9f5f15acb9b538911ff8de611c71866",false,false,false]],"relations":[["rollout_control","r","postgres",true,true,"{postgres=arwdDxt/postgres}",null],["rollout_control_pkey","i","postgres",false,false,null,null]],"constraints":[["rollout_control","rollout_control_catalog_sha256_check","CHECK ((catalog_sha256 ~ ''^[0-9a-f]{64}$''::text))",true],["rollout_control","rollout_control_check","CHECK (((mode = ''REGISTERED''::text) = (catalog_sha256 IS NULL)))",true],["rollout_control","rollout_control_mode_check","CHECK ((mode = ANY (ARRAY[''REGISTERED''::text, ''QUARANTINED''::text, ''ACTIVE''::text])))",true],["rollout_control","rollout_control_pkey","PRIMARY KEY (singleton)",true],["rollout_control","rollout_control_singleton_check","CHECK (singleton)",true],["rollout_control","rollout_control_target_project_check","CHECK ((target_project = ''dczlddwbtgvfdujgcitb''::text))",true]],"table_api_access":[["anon","rollout_control",false],["authenticated","rollout_control",false],["service_role","rollout_control",false]],"schema_api_access":[["anon",false,false],["authenticated",false,false],["service_role",false,false]]},"17":{"columns":[["rollout_control","singleton","boolean",-1,true,"","","true"],["rollout_control","target_project","text",-1,true,"","",null],["rollout_control","mode","text",-1,true,"","",null],["rollout_control","catalog_sha256","text",-1,false,"","",null],["rollout_control","changed_at","timestamp with time zone",-1,true,"","","clock_timestamp()"]],"indexes":[["rollout_control_pkey","CREATE UNIQUE INDEX rollout_control_pkey ON mushavo_email_install.rollout_control USING btree (singleton)"]],"schemas":[["mushavo_email_install","postgres","{postgres=UC/postgres}"]],"policies":null,"triggers":null,"functions":[["activate","","jsonb","plpgsql","postgres","f",false,false,false,"v","u",0,["search_path=pg_catalog","lock_timeout=3s"],"{postgres=X/postgres}","fe59f9e7bec7a5f8c06c128d139ff02e940deb263907d3ecc188a946825a2fce",false,false,false],["catalog_identity","","text","sql","postgres","f",false,false,false,"s","u",0,["search_path=pg_catalog"],"{postgres=X/postgres}","9f43bff7c6c0209b28da2943a63509caf977cff2d024ce7151770eceec26fdc0",false,false,false],["quarantine","","jsonb","plpgsql","postgres","f",false,false,false,"v","u",0,["search_path=pg_catalog","lock_timeout=3s"],"{postgres=X/postgres}","0fe61c34f3c57747b1c2399d6e0644e40bb9425b2012e224d3aaa4061d7bd603",false,false,false],["register_staging","","jsonb","plpgsql","postgres","f",false,false,false,"v","u",0,["search_path=pg_catalog","lock_timeout=3s"],"{postgres=X/postgres}","b03879099fa1866dd7c5e4298326423d0946799f36050b88399c66815a446203",false,false,false],["resume","","jsonb","plpgsql","postgres","f",false,false,false,"v","u",0,["search_path=pg_catalog","lock_timeout=3s"],"{postgres=X/postgres}","131cf5f5f7df1e4f511d7aae875e93e7f9f5f15acb9b538911ff8de611c71866",false,false,false]],"relations":[["rollout_control","r","postgres",true,true,"{postgres=arwdDxtm/postgres}",null],["rollout_control_pkey","i","postgres",false,false,null,null]],"constraints":[["rollout_control","rollout_control_catalog_sha256_check","CHECK ((catalog_sha256 ~ ''^[0-9a-f]{64}$''::text))",true],["rollout_control","rollout_control_check","CHECK (((mode = ''REGISTERED''::text) = (catalog_sha256 IS NULL)))",true],["rollout_control","rollout_control_mode_check","CHECK ((mode = ANY (ARRAY[''REGISTERED''::text, ''QUARANTINED''::text, ''ACTIVE''::text])))",true],["rollout_control","rollout_control_pkey","PRIMARY KEY (singleton)",true],["rollout_control","rollout_control_singleton_check","CHECK (singleton)",true],["rollout_control","rollout_control_target_project_check","CHECK ((target_project = ''dczlddwbtgvfdujgcitb''::text))",true]],"table_api_access":[["anon","rollout_control",false],["authenticated","rollout_control",false],["service_role","rollout_control",false]],"schema_api_access":[["anon",false,false],["authenticated",false,false],["service_role",false,false]]},"18":{"columns":[["rollout_control","singleton","boolean",-1,true,"","","true"],["rollout_control","target_project","text",-1,true,"","",null],["rollout_control","mode","text",-1,true,"","",null],["rollout_control","catalog_sha256","text",-1,false,"","",null],["rollout_control","changed_at","timestamp with time zone",-1,true,"","","clock_timestamp()"]],"indexes":[["rollout_control_pkey","CREATE UNIQUE INDEX rollout_control_pkey ON mushavo_email_install.rollout_control USING btree (singleton)"]],"schemas":[["mushavo_email_install","postgres","{postgres=UC/postgres}"]],"policies":null,"triggers":null,"functions":[["activate","","jsonb","plpgsql","postgres","f",false,false,false,"v","u",0,["search_path=pg_catalog","lock_timeout=3s"],"{postgres=X/postgres}","fe59f9e7bec7a5f8c06c128d139ff02e940deb263907d3ecc188a946825a2fce",false,false,false],["catalog_identity","","text","sql","postgres","f",false,false,false,"s","u",0,["search_path=pg_catalog"],"{postgres=X/postgres}","9f43bff7c6c0209b28da2943a63509caf977cff2d024ce7151770eceec26fdc0",false,false,false],["quarantine","","jsonb","plpgsql","postgres","f",false,false,false,"v","u",0,["search_path=pg_catalog","lock_timeout=3s"],"{postgres=X/postgres}","0fe61c34f3c57747b1c2399d6e0644e40bb9425b2012e224d3aaa4061d7bd603",false,false,false],["register_staging","","jsonb","plpgsql","postgres","f",false,false,false,"v","u",0,["search_path=pg_catalog","lock_timeout=3s"],"{postgres=X/postgres}","b03879099fa1866dd7c5e4298326423d0946799f36050b88399c66815a446203",false,false,false],["resume","","jsonb","plpgsql","postgres","f",false,false,false,"v","u",0,["search_path=pg_catalog","lock_timeout=3s"],"{postgres=X/postgres}","131cf5f5f7df1e4f511d7aae875e93e7f9f5f15acb9b538911ff8de611c71866",false,false,false]],"relations":[["rollout_control","r","postgres",true,true,"{postgres=arwdDxtm/postgres}",null],["rollout_control_pkey","i","postgres",false,false,null,null]],"constraints":[["rollout_control","rollout_control_catalog_sha256_check","CHECK ((catalog_sha256 ~ ''^[0-9a-f]{64}$''::text))",true],["rollout_control","rollout_control_changed_at_not_null","NOT NULL changed_at",true],["rollout_control","rollout_control_check","CHECK (((mode = ''REGISTERED''::text) = (catalog_sha256 IS NULL)))",true],["rollout_control","rollout_control_mode_check","CHECK ((mode = ANY (ARRAY[''REGISTERED''::text, ''QUARANTINED''::text, ''ACTIVE''::text])))",true],["rollout_control","rollout_control_mode_not_null","NOT NULL mode",true],["rollout_control","rollout_control_pkey","PRIMARY KEY (singleton)",true],["rollout_control","rollout_control_singleton_check","CHECK (singleton)",true],["rollout_control","rollout_control_singleton_not_null","NOT NULL singleton",true],["rollout_control","rollout_control_target_project_check","CHECK ((target_project = ''dczlddwbtgvfdujgcitb''::text))",true],["rollout_control","rollout_control_target_project_not_null","NOT NULL target_project",true]],"table_api_access":[["anon","rollout_control",false],["authenticated","rollout_control",false],["service_role","rollout_control",false]],"schema_api_access":[["anon",false,false],["authenticated",false,false],["service_role",false,false]]}}'::jsonb -> (current_setting('server_version_num')::integer/10000)::text)
 THEN RAISE EXCEPTION 'EMAIL_WINDOW_ORIGINAL_INSTALLER_REQUIRED'; END IF;
 PERFORM 1 FROM mushavo_email_install.rollout_control WHERE singleton AND target_project='dczlddwbtgvfdujgcitb'
 AND mode='QUARANTINED' AND catalog_sha256=mushavo_email_install.catalog_identity() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'EMAIL_WINDOW_QUARANTINED_CATALOG_REQUIRED'; END IF;
 IF NOT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner JOIN pg_language l ON l.oid=p.prolang
 WHERE p.oid=to_regprocedure('mushavo_email_auth.session_valid(uuid,uuid)')
 AND r.rolname='postgres' AND l.lanname='sql' AND p.prosecdef AND p.provolatile='s'
 AND NOT p.proisstrict AND NOT p.proleakproof AND p.proparallel='u' AND p.pronargdefaults=0
 AND p.prorettype='boolean'::regtype AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
 AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
 AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
 AND NOT has_function_privilege('service_role',p.oid,'EXECUTE')
 AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='c06901581dcbaa7ae5bd148f14a2f84961b797a8025159a4b310077d5e3a3307')) THEN RAISE EXCEPTION 'EMAIL_WINDOW_ORIGINAL_PREDICATE_REQUIRED'; END IF;
 IF to_regclass('mushavo_email_install.acceptance_window') IS NOT NULL
 THEN RAISE EXCEPTION 'EMAIL_WINDOW_ALREADY_INSTALLED_INSPECT_STATE'; END IF;
END $window_guard$;
CREATE TABLE mushavo_email_install.acceptance_window (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 target_project text NOT NULL CHECK(target_project='dczlddwbtgvfdujgcitb'),
 allowed_users uuid[] NOT NULL CHECK(cardinality(allowed_users) BETWEEN 1 AND 4 AND array_ndims(allowed_users)=1 AND array_position(allowed_users,NULL) IS NULL),
 opened_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL CHECK(expires_at>opened_at AND expires_at<=opened_at+interval '30 minutes')
);
ALTER TABLE mushavo_email_install.acceptance_window ENABLE ROW LEVEL SECURITY;
ALTER TABLE mushavo_email_install.acceptance_window FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE mushavo_email_install.acceptance_window FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION mushavo_email_auth.session_valid(p_user uuid,p_session uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
 SELECT EXISTS(SELECT 1 FROM mushavo_email_auth.session_proofs proof
  JOIN mushavo_email_auth.account_state a ON a.user_id=proof.user_id
  JOIN auth.users u ON u.id=proof.user_id
  JOIN auth.sessions s ON s.id=proof.session_id AND s.user_id=u.id
  JOIN public.profiles p ON p.id=u.id
  WHERE proof.user_id=p_user AND proof.session_id=p_session
  AND proof.security_version=a.security_version AND u.email_confirmed_at IS NOT NULL
  AND p.account_status='active' AND (u.banned_until IS NULL OR u.banned_until<=statement_timestamp())
  AND (s.not_after IS NULL OR s.not_after>statement_timestamp()))
 AND EXISTS(SELECT 1 FROM mushavo_email_install.rollout_control
   WHERE singleton AND target_project='dczlddwbtgvfdujgcitb' AND mode='ACTIVE')
 AND EXISTS(SELECT 1 FROM mushavo_email_install.acceptance_window w
   WHERE w.singleton AND w.target_project='dczlddwbtgvfdujgcitb' AND p_user=ANY(w.allowed_users)
   AND w.opened_at<=clock_timestamp() AND w.expires_at>clock_timestamp());
$body$;
-- An old global-resume call must not bypass the acceptance deadline or actor list.
CREATE OR REPLACE FUNCTION mushavo_email_install.resume() RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog SET lock_timeout='3s' AS $resume$
BEGIN
 IF NOT ((jsonb_build_object('privileged_origin',current_user='postgres' AND session_user='postgres'
 AND current_setting('session_replication_role')='origin'
 AND coalesce(current_setting('role',true),'none') IN ('none','postgres')
 AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)),
 'transaction_read_only',current_setting('transaction_read_only')))->>'privileged_origin')::boolean
 THEN RAISE EXCEPTION 'EMAIL_WINDOW_PRIVILEGED_ORIGIN_REQUIRED'; END IF;
 RAISE EXCEPTION 'EMAIL_WINDOW_EXPLICIT_BOUNDED_OPEN_REQUIRED';
END;
$resume$;
CREATE FUNCTION mushavo_email_install.open_acceptance_window(p_users uuid[],p_seconds integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog SET lock_timeout='3s' AS $window$
DECLARE started timestamptz; expected text;
BEGIN
 IF NOT ((jsonb_build_object('privileged_origin',current_user='postgres' AND session_user='postgres'
 AND current_setting('session_replication_role')='origin'
 AND coalesce(current_setting('role',true),'none') IN ('none','postgres')
 AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)),
 'transaction_read_only',current_setting('transaction_read_only')))->>'privileged_origin')::boolean
 THEN RAISE EXCEPTION 'EMAIL_WINDOW_PRIVILEGED_ORIGIN_REQUIRED'; END IF;
 IF current_setting('mushavo.email_rollout_project',true) IS DISTINCT FROM 'dczlddwbtgvfdujgcitb'
 OR current_setting('mushavo.email_rollout_action',true) IS DISTINCT FROM 'OPEN_STAGING_ACCEPTANCE_WINDOW'
 THEN RAISE EXCEPTION 'EMAIL_WINDOW_TARGET_ACTION_REQUIRED'; END IF;
 IF EXISTS (
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
) THEN RAISE EXCEPTION 'EMAIL_ATOMIC_UNREVIEWED_DDL_HOOK'; END IF;
 PERFORM pg_advisory_xact_lock(20261017,2411);
 IF p_users IS NULL OR p_seconds IS NULL OR p_seconds<30 OR p_seconds>1800
 OR cardinality(p_users) NOT BETWEEN 1 AND 4 OR array_ndims(p_users)<>1 OR array_position(p_users,NULL) IS NOT NULL
 OR (SELECT count(DISTINCT u) FROM unnest(p_users) u)<>cardinality(p_users)
 THEN RAISE EXCEPTION 'EMAIL_WINDOW_BOUNDED_ACTORS_DURATION_REQUIRED'; END IF;
 IF (SELECT count(*) FROM auth.users u JOIN public.profiles p ON p.id=u.id
 WHERE u.id=ANY(p_users) AND u.email_confirmed_at IS NOT NULL AND p.account_status='active'
 AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp()))<>cardinality(p_users)
 THEN RAISE EXCEPTION 'EMAIL_WINDOW_ACTIVE_CONFIRMED_ACTORS_REQUIRED'; END IF;
 SELECT catalog_sha256 INTO expected FROM mushavo_email_install.rollout_control
 WHERE singleton AND target_project='dczlddwbtgvfdujgcitb' AND mode='QUARANTINED' FOR UPDATE;
 IF expected IS NULL OR expected IS DISTINCT FROM mushavo_email_install.catalog_identity()
 THEN RAISE EXCEPTION 'EMAIL_WINDOW_QUARANTINED_CATALOG_REQUIRED'; END IF;
 IF NOT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner JOIN pg_language l ON l.oid=p.prolang
 WHERE p.oid=to_regprocedure('mushavo_email_auth.session_valid(uuid,uuid)')
 AND r.rolname='postgres' AND l.lanname='sql' AND p.prosecdef AND p.provolatile='s'
 AND NOT p.proisstrict AND NOT p.proleakproof AND p.proparallel='u' AND p.pronargdefaults=0
 AND p.prorettype='boolean'::regtype AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
 AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
 AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
 AND NOT has_function_privilege('service_role',p.oid,'EXECUTE')
 AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='1a9deca016cde542c78d89dae6a5d7e8b4cd2950a1bd6567c229421b3b36d302')) THEN RAISE EXCEPTION 'EMAIL_WINDOW_PREDICATE_DRIFT_REQUIRED'; END IF;
 started:=clock_timestamp();
 INSERT INTO mushavo_email_install.acceptance_window(singleton,target_project,allowed_users,opened_at,expires_at)
 VALUES(true,'dczlddwbtgvfdujgcitb',p_users,started,started+make_interval(secs=>p_seconds))
 ON CONFLICT(singleton) DO UPDATE SET allowed_users=EXCLUDED.allowed_users,opened_at=EXCLUDED.opened_at,expires_at=EXCLUDED.expires_at;
 UPDATE mushavo_email_install.rollout_control SET mode='ACTIVE',changed_at=started WHERE singleton;
 RETURN jsonb_build_object('result','STAGING_BOUNDED_ACCEPTANCE_WINDOW_OPEN',
 'allowed_actor_count',cardinality(p_users),'maximum_seconds',p_seconds,'hosted_acceptance',false);
END;
$window$;
REVOKE ALL ON FUNCTION mushavo_email_install.open_acceptance_window(uuid[],integer) FROM PUBLIC,anon,authenticated,service_role;
-- Existing private quarantine() remains byte-for-byte unchanged and independently usable.
UPDATE mushavo_email_install.rollout_control SET catalog_sha256=mushavo_email_install.catalog_identity() WHERE singleton AND mode='QUARANTINED';
DO $window_post$ BEGIN
 IF EXISTS(SELECT 1 FROM mushavo_email_install.acceptance_window)
 OR NOT EXISTS(SELECT 1 FROM mushavo_email_install.rollout_control WHERE singleton AND mode='QUARANTINED'
 AND catalog_sha256=mushavo_email_install.catalog_identity())
 OR NOT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner JOIN pg_language l ON l.oid=p.prolang
 WHERE p.oid=to_regprocedure('mushavo_email_auth.session_valid(uuid,uuid)')
 AND r.rolname='postgres' AND l.lanname='sql' AND p.prosecdef AND p.provolatile='s'
 AND NOT p.proisstrict AND NOT p.proleakproof AND p.proparallel='u' AND p.pronargdefaults=0
 AND p.prorettype='boolean'::regtype AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
 AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
 AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
 AND NOT has_function_privilege('service_role',p.oid,'EXECUTE')
 AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='1a9deca016cde542c78d89dae6a5d7e8b4cd2950a1bd6567c229421b3b36d302'))
 OR EXISTS(SELECT 1 FROM pg_class c CROSS JOIN unnest(ARRAY['anon','authenticated','service_role']) r
 WHERE c.oid='mushavo_email_install.acceptance_window'::regclass AND
 (NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR has_table_privilege(r,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')))
 THEN RAISE EXCEPTION 'EMAIL_WINDOW_CLOSED_POSTCONDITION_REQUIRED'; END IF;
END $window_post$;
COMMIT;
