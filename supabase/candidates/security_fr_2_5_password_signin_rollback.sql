-- Emergency staging rollback: restore the previous proof predicate and leave app access QUARANTINED.
-- Restore the retained previous frontend ZIP separately after reviewing the failure.
BEGIN;
SET LOCAL statement_timeout='35s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
SET LOCAL mushavo.email_rollout_project='dczlddwbtgvfdujgcitb';
SET LOCAL mushavo.email_rollout_action='ROLLBACK_PASSWORD_SIGNIN_ALL_USERS';
DO $password_rollback$
DECLARE previous_source text; previous_catalog text; expected text; signature text;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_setting('session_replication_role')<>'origin'
 OR coalesce(current_setting('role',true),'none') NOT IN ('none','postgres')
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'PASSWORD_SIGNIN_PRIVILEGED_ORIGIN_REQUIRED'; END IF;
 IF current_setting('mushavo.email_rollout_project',true) IS DISTINCT FROM 'dczlddwbtgvfdujgcitb'
 OR current_setting('mushavo.email_rollout_action',true) IS DISTINCT FROM 'ROLLBACK_PASSWORD_SIGNIN_ALL_USERS'
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
 SELECT previous_prosrc,previous_catalog_sha256 INTO previous_source,previous_catalog
 FROM mushavo_email_install.password_signin_policy WHERE singleton AND policy='PASSWORD_ONLY_ALL_USERS';
 IF previous_source IS NULL OR encode(sha256(convert_to(previous_source,'UTF8')),'hex') NOT IN ('1a9deca016cde542c78d89dae6a5d7e8b4cd2950a1bd6567c229421b3b36d302','404376091f90e14420daf1fd995fd8da0fcb614db75694824a4cca274625798e')
 OR encode(sha256(convert_to((SELECT prosrc FROM pg_proc WHERE oid='mushavo_email_auth.session_valid(uuid,uuid)'::regprocedure),'UTF8')),'hex')<>'98509f5718de15bc64e2af5e4375e0bfa08d9b56026613797873352ea4818da4'
 THEN RAISE EXCEPTION 'PASSWORD_SIGNIN_ROLLBACK_BASELINE_REQUIRED'; END IF;
 UPDATE mushavo_email_install.rollout_control SET mode='QUARANTINED' WHERE singleton;
 EXECUTE 'CREATE OR REPLACE FUNCTION mushavo_email_auth.session_valid(p_user uuid,p_session uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS '||quote_literal(previous_source);
 FOREACH signature IN ARRAY ARRAY['public.email_gate_begin_challenge(uuid,uuid,uuid,text,text,boolean)','public.email_gate_set_delivery(uuid,uuid,uuid,boolean)','public.email_gate_challenge_context(uuid,uuid,uuid)','public.email_gate_verify_challenge(uuid,uuid,uuid,text,text)','public.email_gate_restore_device(uuid,uuid,text)','public.email_gate_revoke_device(uuid,uuid,text)','public.email_gate_revoke_all(uuid,uuid)','public.email_gate_register_link_device(uuid,uuid,text,timestamptz,boolean)']::text[] LOOP
  EXECUTE 'GRANT EXECUTE ON FUNCTION '||signature||' TO service_role';
 END LOOP;
 DROP FUNCTION public.app_session_status();
 DROP TABLE mushavo_email_install.password_signin_policy;
 IF mushavo_email_install.catalog_identity() IS DISTINCT FROM previous_catalog
 THEN RAISE EXCEPTION 'PASSWORD_SIGNIN_ROLLBACK_CATALOG_REQUIRED'; END IF;
 UPDATE mushavo_email_install.rollout_control SET mode='QUARANTINED',
 catalog_sha256=previous_catalog,changed_at=clock_timestamp() WHERE singleton;
END;
$password_rollback$;
NOTIFY pgrst,'reload schema';
SELECT jsonb_build_object('result','PASSWORD_SIGNIN_ROLLED_BACK_QUARANTINED',
 'application_access_opened',false,'hosted_acceptance',false) AS result;
COMMIT;
