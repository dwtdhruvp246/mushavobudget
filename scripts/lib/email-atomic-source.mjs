// Deterministic registration source. Components keep their original review guards.
export const installerMigration='20261017000000_email_verification_atomic_installer.sql';
export const componentNames=['verification_backend','session_predicate','data_guards','admin_status'];
export function componentBody(source){
  if(typeof source!=='string')throw new Error('EMAIL_COMPONENT_REQUIRED');
  const sql=source.replace(/\r\n/g,'\n'),marker='BEGIN;\n',start=sql.indexOf(marker);
  if(start<0||!sql.endsWith('COMMIT;\n')||sql.slice(0,start).split('\n').some(x=>x.trim()&&!x.trimStart().startsWith('--')))throw new Error('EMAIL_COMPONENT_FRAME_INVALID');
  const body=sql.slice(start+marker.length,-'COMMIT;\n'.length);
  const frame=/^SET LOCAL statement_timeout='(?:15|20|30)s';\nSET LOCAL lock_timeout='3s';\nSET LOCAL search_path=pg_catalog;\n/;
  if(!frame.test(body))throw new Error('EMAIL_COMPONENT_SETTINGS_INVALID');
  return body.replace(frame,'');
}
// These two provider hooks were already source-reviewed for prior FR installers.
// CREATE TABLE hooks (including ensure_rls) require a separate review before live use.
export const hookGuard=`IF EXISTS (
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
  AND encode(sha256(convert_to(replace(p.prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex')=reviewed.body_sha256
 )
) THEN RAISE EXCEPTION 'EMAIL_ATOMIC_UNREVIEWED_DDL_HOOK'; END IF;`;
const privilegeGuard=`IF current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('session_replication_role')<>'origin'
 OR coalesce(current_setting('role',true),'none') NOT IN ('none','postgres')
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'EMAIL_ATOMIC_PRIVILEGED_ORIGIN_REQUIRED'; END IF;`;
export function renderAtomicInstaller(components){
  if(!components||Object.keys(components).sort().join(',')!==[...componentNames].sort().join(','))throw new Error('EMAIL_COMPONENT_SET_INVALID');
  const chunks=componentNames.map((name,i)=>{
    const body=componentBody(components[name]),tag='$email_component_'+i+'$';
    if(body.includes(tag)||body.includes('$email_activate$'))throw new Error('EMAIL_COMPONENT_DELIMITER_INVALID');
    return '  -- COMPONENT '+name+'\n  EXECUTE '+tag+'\n'+body+tag+';';
  }).join('\n');
  return `-- FR.2.4.E4.11: register a private atomic installer; do not activate application guards.
-- This source phase permits OFFLINE_ATOMIC_REHEARSAL only. No live activation handoff.
BEGIN;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
DO $registration$
BEGIN
 ${privilegeGuard}
 ${hookGuard}
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='mushavo_email_install')
 THEN RAISE EXCEPTION 'EMAIL_ATOMIC_INSTALLER_NAMESPACE_EXISTS'; END IF;
END;
$registration$;
CREATE SCHEMA mushavo_email_install;
REVOKE ALL ON SCHEMA mushavo_email_install FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION mushavo_email_install.activate() RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog SET lock_timeout='3s'
AS $email_activate$
DECLARE
 previous_backend text:=coalesce(current_setting('mushavo.email_backend_review',true),'');
 previous_session text:=coalesce(current_setting('mushavo.email_session_review',true),'');
 previous_data text:=coalesce(current_setting('mushavo.email_data_guard_review',true),'');
 previous_admin text:=coalesce(current_setting('mushavo.email_admin_review',true),'');
BEGIN
 ${privilegeGuard}
 IF current_setting('mushavo.email_atomic_review',true) IS DISTINCT FROM 'OFFLINE_ATOMIC_REHEARSAL'
 THEN RAISE EXCEPTION 'EMAIL_ATOMIC_OFFLINE_REHEARSAL_ACK_REQUIRED'; END IF;
 ${hookGuard}
 -- This lock serializes cooperative installer calls, not arbitrary application transactions.
 PERFORM pg_advisory_xact_lock(20261017,2411);
 PERFORM set_config('mushavo.email_backend_review','OFFLINE_SOURCE_CANDIDATE',true);
 PERFORM set_config('mushavo.email_session_review','OFFLINE_SOURCE_CANDIDATE',true);
 PERFORM set_config('mushavo.email_data_guard_review','OFFLINE_SOURCE_CANDIDATE',true);
 PERFORM set_config('mushavo.email_admin_review','OFFLINE_SOURCE_CANDIDATE',true);
${chunks}
 -- FR_ATOMIC_FINAL_ASSERTIONS
 IF (SELECT count(*) FROM pg_policies WHERE policyname='Email verified session required')<>82
 OR (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace
     AND position('PERFORM mushavo_email_auth.require_application_session();' in prosrc)>0)<>148
 OR to_regprocedure('public.email_gate_admin_status()') IS NULL
 THEN RAISE EXCEPTION 'EMAIL_ATOMIC_FINAL_INVENTORY_MISMATCH'; END IF;
 PERFORM set_config('mushavo.email_backend_review',previous_backend,true);
 PERFORM set_config('mushavo.email_session_review',previous_session,true);
 PERFORM set_config('mushavo.email_data_guard_review',previous_data,true);
 PERFORM set_config('mushavo.email_admin_review',previous_admin,true);
 RETURN jsonb_build_object('result','ATOMIC_EMAIL_SOURCE_REHEARSAL_INSTALLED',
   'guarded_RPCs',148,'restrictive_policies',82,'hosted_acceptance',false);
END;
$email_activate$;
REVOKE ALL ON FUNCTION mushavo_email_install.activate() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
`;
}
