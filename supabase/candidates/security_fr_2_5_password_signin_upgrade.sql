-- Owner-selected staging policy: email/password sign-in for every role, including Admin.
-- This removes custom sign-in email proof, device approval and temporary acceptance-window dependency.
-- It retains confirmed/active/non-banned users, live matching Auth sessions, JWT validation and all role/RLS/RPC guards.
-- Select staging project dczlddwbtgvfdujgcitb. This acknowledgement is not independent host identity proof.
BEGIN;
SET LOCAL statement_timeout='35s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
SET LOCAL mushavo.email_rollout_project='dczlddwbtgvfdujgcitb';
SET LOCAL mushavo.email_rollout_action='ENABLE_PASSWORD_SIGNIN_ALL_USERS';
DO $password_policy$
DECLARE expected text; previous_source text; before_catalog jsonb; signature text;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_setting('session_replication_role')<>'origin'
 OR coalesce(current_setting('role',true),'none') NOT IN ('none','postgres')
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'PASSWORD_SIGNIN_PRIVILEGED_ORIGIN_REQUIRED'; END IF;
 IF current_setting('mushavo.email_rollout_project',true) IS DISTINCT FROM 'dczlddwbtgvfdujgcitb'
 OR current_setting('mushavo.email_rollout_action',true) IS DISTINCT FROM 'ENABLE_PASSWORD_SIGNIN_ALL_USERS'
 THEN RAISE EXCEPTION 'PASSWORD_SIGNIN_TARGET_ACTION_REQUIRED'; END IF;
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
 SELECT catalog_sha256 INTO expected FROM mushavo_email_install.rollout_control
 WHERE singleton AND target_project='dczlddwbtgvfdujgcitb' AND mode IN ('ACTIVE','QUARANTINED') FOR UPDATE;
 IF expected IS NULL OR expected IS DISTINCT FROM mushavo_email_install.catalog_identity()
 THEN RAISE EXCEPTION 'PASSWORD_SIGNIN_CURRENT_CATALOG_REQUIRED'; END IF;
 IF to_regclass('mushavo_email_install.password_signin_policy') IS NOT NULL
 OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='app_session_status')
 THEN RAISE EXCEPTION 'PASSWORD_SIGNIN_ALREADY_INSTALLED'; END IF;
 SELECT prosrc INTO previous_source FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner JOIN pg_language l ON l.oid=p.prolang
 WHERE p.oid=to_regprocedure('mushavo_email_auth.session_valid(uuid,uuid)') AND r.rolname='postgres' AND l.lanname='sql'
 AND p.prosecdef AND p.provolatile='s' AND NOT p.proisstrict AND NOT p.proleakproof AND p.proparallel='u'
 AND p.proconfig=ARRAY['search_path=pg_catalog']::text[] AND p.prorettype='boolean'::regtype
 AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
 AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
 AND NOT has_function_privilege('service_role',p.oid,'EXECUTE');
 IF previous_source IS NULL OR encode(sha256(convert_to(previous_source,'UTF8')),'hex') NOT IN ('1a9deca016cde542c78d89dae6a5d7e8b4cd2950a1bd6567c229421b3b36d302','404376091f90e14420daf1fd995fd8da0fcb614db75694824a4cca274625798e')
 THEN RAISE EXCEPTION 'PASSWORD_SIGNIN_PREVIOUS_PREDICATE_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('mushavo_email_auth.current_session_verified()')
 AND encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='79be76a18949eeba04b8db0bfe69dc199e556b5bc3e72b8cdb4a2efac6e63132')
 OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.email_gate_admin_status()')
 AND encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='c915e5f4177b500fdd54d2e0ea642e92e6deced8bc4eae3b8ede084cfa74257b')
 THEN RAISE EXCEPTION 'PASSWORD_SIGNIN_IDENTITY_ROLE_WRAPPERS_REQUIRED'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE policyname='Email verified session required')<>82
 OR (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace
 AND position('PERFORM mushavo_email_auth.require_application_session();' in prosrc)>0)<>148
 THEN RAISE EXCEPTION 'PASSWORD_SIGNIN_GUARD_INVENTORY_REQUIRED'; END IF;
 FOREACH signature IN ARRAY ARRAY['public.email_gate_begin_challenge(uuid,uuid,uuid,text,text,boolean)','public.email_gate_set_delivery(uuid,uuid,uuid,boolean)','public.email_gate_challenge_context(uuid,uuid,uuid)','public.email_gate_verify_challenge(uuid,uuid,uuid,text,text)','public.email_gate_restore_device(uuid,uuid,text)','public.email_gate_revoke_device(uuid,uuid,text)','public.email_gate_revoke_all(uuid,uuid)','public.email_gate_register_link_device(uuid,uuid,text,timestamptz,boolean)']::text[] LOOP
  IF to_regprocedure(signature) IS NULL
  OR NOT has_function_privilege('service_role',to_regprocedure(signature),'EXECUTE')
  OR has_function_privilege('anon',to_regprocedure(signature),'EXECUTE')
  OR has_function_privilege('authenticated',to_regprocedure(signature),'EXECUTE')
  THEN RAISE EXCEPTION 'PASSWORD_SIGNIN_LEGACY_SERVICE_ACL_REQUIRED'; END IF;
 END LOOP;
 before_catalog:=(SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(
  CASE WHEN p.oid=ANY(ARRAY(SELECT to_regprocedure(x)::oid FROM unnest(ARRAY['public.email_gate_begin_challenge(uuid,uuid,uuid,text,text,boolean)','public.email_gate_set_delivery(uuid,uuid,uuid,boolean)','public.email_gate_challenge_context(uuid,uuid,uuid)','public.email_gate_verify_challenge(uuid,uuid,uuid,text,text)','public.email_gate_restore_device(uuid,uuid,text)','public.email_gate_revoke_device(uuid,uuid,text)','public.email_gate_revoke_all(uuid,uuid)','public.email_gate_register_link_device(uuid,uuid,text,timestamptz,boolean)']::text[]) x))
   THEN to_jsonb(p)-'proacl' ELSE to_jsonb(p) END ORDER BY p.oid)
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('public','storage','mushavo_email_auth','mushavo_email_install') AND p.prokind='f'
  AND p.oid<>'mushavo_email_auth.session_valid(uuid,uuid)'::regprocedure
  AND NOT(n.nspname='public' AND p.proname='app_session_status')),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname)
  FROM pg_policies p WHERE schemaname IN ('public','storage','mushavo_email_auth','mushavo_email_install')
  AND NOT(schemaname='mushavo_email_install' AND tablename='password_signin_policy')),
 'relations',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relkind,c.relowner,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text,c.reloptions) ORDER BY c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','storage','mushavo_email_auth','mushavo_email_install') AND c.relkind IN ('r','p','v','m','f','S')
  AND NOT(n.nspname='mushavo_email_install' AND c.relname='password_signin_policy')),
 'schemas',(SELECT jsonb_agg(to_jsonb(n) ORDER BY n.oid) FROM pg_namespace n
  WHERE n.nspname IN ('public','storage','mushavo_email_auth','mushavo_email_install')),
 'columns',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,a.attname,a.atttypid::regtype::text,
  a.atttypmod,a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) ORDER BY n.nspname,c.relname,a.attnum)
  FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
  WHERE a.attnum>0 AND NOT a.attisdropped AND c.relkind IN ('r','p','v','m','f')
  AND n.nspname IN ('public','auth','storage','mushavo_email_auth','mushavo_email_install')
  AND NOT(n.nspname='mushavo_email_install' AND c.relname='password_signin_policy')),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,k.conname,pg_get_constraintdef(k.oid),k.convalidated)
  ORDER BY n.nspname,c.relname,k.conname) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth','storage','mushavo_email_auth','mushavo_email_install')
  AND NOT(n.nspname='mushavo_email_install' AND c.relname='password_signin_policy')),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname IN ('public','auth','storage','mushavo_email_auth','mushavo_email_install')),
 'window',(SELECT jsonb_agg(to_jsonb(w)) FROM mushavo_email_install.acceptance_window w)
));
 UPDATE mushavo_email_install.rollout_control SET mode='QUARANTINED' WHERE singleton;
 CREATE TABLE mushavo_email_install.password_signin_policy(
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  policy text NOT NULL CHECK(policy='PASSWORD_ONLY_ALL_USERS'),
  previous_prosrc text NOT NULL,
  previous_catalog_sha256 text NOT NULL CHECK(previous_catalog_sha256~'^[a-f0-9]{64}$'),
  installed_at timestamptz NOT NULL DEFAULT clock_timestamp()
 );
 ALTER TABLE mushavo_email_install.password_signin_policy ENABLE ROW LEVEL SECURITY;
 ALTER TABLE mushavo_email_install.password_signin_policy FORCE ROW LEVEL SECURITY;
 REVOKE ALL ON TABLE mushavo_email_install.password_signin_policy FROM PUBLIC,anon,authenticated,service_role;
 INSERT INTO mushavo_email_install.password_signin_policy(singleton,policy,previous_prosrc,previous_catalog_sha256)
 VALUES(true,'PASSWORD_ONLY_ALL_USERS',previous_source,expected);
 EXECUTE $password_component$
CREATE OR REPLACE FUNCTION mushavo_email_auth.session_valid(p_user uuid,p_session uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
 SELECT EXISTS(SELECT 1 FROM auth.users u
 JOIN auth.sessions s ON s.user_id=u.id
 JOIN public.profiles p ON p.id=u.id
 WHERE u.id=p_user AND s.id=p_session
 AND u.email_confirmed_at IS NOT NULL AND p.account_status='active'
 AND (u.banned_until IS NULL OR u.banned_until<=statement_timestamp())
 AND (s.not_after IS NULL OR s.not_after>statement_timestamp()))
 AND EXISTS(SELECT 1 FROM mushavo_email_install.rollout_control
 WHERE singleton AND target_project='dczlddwbtgvfdujgcitb' AND mode='ACTIVE')
 AND EXISTS(SELECT 1 FROM mushavo_email_install.password_signin_policy
 WHERE singleton AND policy='PASSWORD_ONLY_ALL_USERS');
$body$;
CREATE FUNCTION public.app_session_status() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE valid boolean; assigned_role text;
BEGIN
 valid:=mushavo_email_auth.current_session_verified();
 IF valid THEN
  SELECT a.role INTO assigned_role FROM public.app_admins a
  JOIN public.profiles p ON p.id=a.user_id
  WHERE a.user_id=auth.uid() AND p.account_status='active'
  AND a.role IN ('super_admin','admin_staff','finance_staff','support_staff');
 END IF;
 RETURN jsonb_build_object('contract',1,'policy','PASSWORD_ONLY_ALL_USERS',
 'session_valid',valid,'admin_authorized',valid AND assigned_role IS NOT NULL,'role',assigned_role);
END;
$body$;
REVOKE ALL ON FUNCTION public.app_session_status() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.app_session_status() TO authenticated;
REVOKE ALL ON FUNCTION public.email_gate_begin_challenge(uuid,uuid,uuid,text,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.email_gate_set_delivery(uuid,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.email_gate_challenge_context(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.email_gate_verify_challenge(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.email_gate_restore_device(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.email_gate_revoke_device(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.email_gate_revoke_all(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.email_gate_register_link_device(uuid,uuid,text,timestamptz,boolean) FROM PUBLIC,anon,authenticated,service_role;
$password_component$;
 IF before_catalog IS DISTINCT FROM (SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(
  CASE WHEN p.oid=ANY(ARRAY(SELECT to_regprocedure(x)::oid FROM unnest(ARRAY['public.email_gate_begin_challenge(uuid,uuid,uuid,text,text,boolean)','public.email_gate_set_delivery(uuid,uuid,uuid,boolean)','public.email_gate_challenge_context(uuid,uuid,uuid)','public.email_gate_verify_challenge(uuid,uuid,uuid,text,text)','public.email_gate_restore_device(uuid,uuid,text)','public.email_gate_revoke_device(uuid,uuid,text)','public.email_gate_revoke_all(uuid,uuid)','public.email_gate_register_link_device(uuid,uuid,text,timestamptz,boolean)']::text[]) x))
   THEN to_jsonb(p)-'proacl' ELSE to_jsonb(p) END ORDER BY p.oid)
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('public','storage','mushavo_email_auth','mushavo_email_install') AND p.prokind='f'
  AND p.oid<>'mushavo_email_auth.session_valid(uuid,uuid)'::regprocedure
  AND NOT(n.nspname='public' AND p.proname='app_session_status')),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname)
  FROM pg_policies p WHERE schemaname IN ('public','storage','mushavo_email_auth','mushavo_email_install')
  AND NOT(schemaname='mushavo_email_install' AND tablename='password_signin_policy')),
 'relations',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relkind,c.relowner,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text,c.reloptions) ORDER BY c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','storage','mushavo_email_auth','mushavo_email_install') AND c.relkind IN ('r','p','v','m','f','S')
  AND NOT(n.nspname='mushavo_email_install' AND c.relname='password_signin_policy')),
 'schemas',(SELECT jsonb_agg(to_jsonb(n) ORDER BY n.oid) FROM pg_namespace n
  WHERE n.nspname IN ('public','storage','mushavo_email_auth','mushavo_email_install')),
 'columns',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,a.attname,a.atttypid::regtype::text,
  a.atttypmod,a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) ORDER BY n.nspname,c.relname,a.attnum)
  FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
  WHERE a.attnum>0 AND NOT a.attisdropped AND c.relkind IN ('r','p','v','m','f')
  AND n.nspname IN ('public','auth','storage','mushavo_email_auth','mushavo_email_install')
  AND NOT(n.nspname='mushavo_email_install' AND c.relname='password_signin_policy')),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,k.conname,pg_get_constraintdef(k.oid),k.convalidated)
  ORDER BY n.nspname,c.relname,k.conname) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth','storage','mushavo_email_auth','mushavo_email_install')
  AND NOT(n.nspname='mushavo_email_install' AND c.relname='password_signin_policy')),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname IN ('public','auth','storage','mushavo_email_auth','mushavo_email_install')),
 'window',(SELECT jsonb_agg(to_jsonb(w)) FROM mushavo_email_install.acceptance_window w)
))
 THEN RAISE EXCEPTION 'PASSWORD_SIGNIN_PROTECTED_CATALOG_CHANGED'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE policyname='Email verified session required')<>82
 OR (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace
 AND position('PERFORM mushavo_email_auth.require_application_session();' in prosrc)>0)<>148
 THEN RAISE EXCEPTION 'PASSWORD_SIGNIN_GUARD_INVENTORY_REQUIRED'; END IF;
 IF encode(sha256(convert_to((SELECT prosrc FROM pg_proc WHERE oid='mushavo_email_auth.session_valid(uuid,uuid)'::regprocedure),'UTF8')),'hex')<>'98509f5718de15bc64e2af5e4375e0bfa08d9b56026613797873352ea4818da4'
 OR has_function_privilege('anon','public.app_session_status()','EXECUTE')
 OR has_function_privilege('service_role','public.app_session_status()','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.app_session_status()','EXECUTE')
 OR EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role']) x
 WHERE has_table_privilege(x,'mushavo_email_install.password_signin_policy','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
 THEN RAISE EXCEPTION 'PASSWORD_SIGNIN_NEW_AUTHORITY_REQUIRED'; END IF;
 FOREACH signature IN ARRAY ARRAY['public.email_gate_begin_challenge(uuid,uuid,uuid,text,text,boolean)','public.email_gate_set_delivery(uuid,uuid,uuid,boolean)','public.email_gate_challenge_context(uuid,uuid,uuid)','public.email_gate_verify_challenge(uuid,uuid,uuid,text,text)','public.email_gate_restore_device(uuid,uuid,text)','public.email_gate_revoke_device(uuid,uuid,text)','public.email_gate_revoke_all(uuid,uuid)','public.email_gate_register_link_device(uuid,uuid,text,timestamptz,boolean)']::text[] LOOP
  IF has_function_privilege('service_role',to_regprocedure(signature),'EXECUTE')
  THEN RAISE EXCEPTION 'PASSWORD_SIGNIN_LEGACY_DISPATCH_RETIRED_REQUIRED'; END IF;
 END LOOP;
 UPDATE mushavo_email_install.rollout_control SET mode='ACTIVE',
 catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
 WHERE singleton AND target_project='dczlddwbtgvfdujgcitb';
END;
$password_policy$;
NOTIFY pgrst,'reload schema';
SELECT jsonb_build_object('result','PASSWORD_SIGNIN_ALL_USERS_ENABLED_STAGING',
 'includes_Admin',true,'signup_email_confirmation_required',true,
 'custom_signin_code_required',false,'trusted_browser_required',false,
 'guarded_RPCs',148,'restrictive_policies',82,'legacy_dispatch_RPCs_retired',8,
 'role_permissions_preserved',true,'hosted_acceptance',false,
 'catalog_identity_matched',catalog_sha256=mushavo_email_install.catalog_identity()) AS result
FROM mushavo_email_install.rollout_control WHERE singleton AND target_project='dczlddwbtgvfdujgcitb';
COMMIT;
