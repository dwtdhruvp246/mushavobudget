// Staging upgrade only. Rendering performs no network or database writes.
import {hookGuard} from './email-atomic-source.mjs';
export const project='dczlddwbtgvfdujgcitb';
export const action='INSTALL_PERSISTENT_STAGING_BROWSER_TRUST';
export const componentPath='supabase/candidates/security_fr_2_5_persistent_device_component.sql';
export const upgradePath='supabase/candidates/security_fr_2_5_persistent_device_upgrade.sql';
export const handoffPath='supabase/candidates/security_fr_2_5_persistent_device_handoff.sql';
export const predicateHashes=['1a9deca016cde542c78d89dae6a5d7e8b4cd2950a1bd6567c229421b3b36d302','404376091f90e14420daf1fd995fd8da0fcb614db75694824a4cca274625798e'];
// Snapshot every existing routine except the three deliberately upgraded bodies.
// Preserve all policies, triggers, authority/ACLs, rollout functions and window contents.
const protectedCatalog=`SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),
 pg_get_functiondef(p.oid),r.rolname,p.proacl::text) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
 WHERE n.nspname IN ('public','storage','mushavo_email_auth','mushavo_email_install') AND p.prokind='f'
 AND p.oid NOT IN ('public.email_gate_verify_challenge(uuid,uuid,uuid,text,text)'::regprocedure,
 'public.email_gate_restore_device(uuid,uuid,text)'::regprocedure,'mushavo_email_auth.invalidate_user(uuid)'::regprocedure)
 AND NOT (n.nspname='public' AND p.proname='email_gate_register_link_device')),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname) FROM pg_policies p
 WHERE schemaname IN ('public','storage','mushavo_email_auth','mushavo_email_install')),
 'relations',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,r.rolname,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text)
 ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner
 WHERE n.nspname IN ('public','storage','mushavo_email_auth','mushavo_email_install') AND c.relkind IN ('r','p','v','m','f','S')),
 'schemas',(SELECT jsonb_agg(jsonb_build_array(n.nspname,n.nspowner,n.nspacl::text) ORDER BY n.nspname)
 FROM pg_namespace n WHERE n.nspname IN ('public','storage','mushavo_email_auth','mushavo_email_install')),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid))
 ORDER BY n.nspname,c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE NOT t.tgisinternal AND n.nspname IN ('public','auth','storage','mushavo_email_auth','mushavo_email_install')),
 'window',(SELECT jsonb_agg(to_jsonb(w)) FROM mushavo_email_install.acceptance_window w),
 'control',(SELECT jsonb_agg(jsonb_build_array(singleton,target_project,mode)) FROM mushavo_email_install.rollout_control))`;
const inventory=`IF (SELECT count(*) FROM pg_policies WHERE policyname='Email verified session required')<>82
 OR (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace
 AND position('PERFORM mushavo_email_auth.require_application_session();' in prosrc)>0)<>148
 OR (SELECT count(*) FROM pg_class WHERE relnamespace='mushavo_email_auth'::regnamespace AND relkind='r'
 AND relrowsecurity AND relforcerowsecurity AND relname IN ('account_state','send_events','challenges','devices','session_proofs'))<>5
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_GUARD_INVENTORY_REQUIRED'; END IF;`;
export function renderPersistentDeviceUpgrade(component){
 if(typeof component!=='string'||!component.startsWith('-- Internal reviewed component.')||component.includes('$persistent_component$')
 ||/^(?:BEGIN|COMMIT|ROLLBACK);/m.test(component))throw Error('PERSISTENT_COMPONENT_SOURCE_REQUIRED');
 return `-- Staging only: permanent browser approval; keep application access QUARANTINED.
-- Select project ${project} in SQL Editor. The GUC below acknowledges the target; it is not independent identity proof.
BEGIN;
SET LOCAL statement_timeout='35s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
SET LOCAL mushavo.email_rollout_project='${project}';
SET LOCAL mushavo.email_rollout_action='${action}';
DO $persistent_upgrade$
DECLARE expected text; before_catalog jsonb; previous_ack text:=coalesce(current_setting('mushavo.persistent_device_component',true),'');
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_setting('session_replication_role')<>'origin'
 OR coalesce(current_setting('role',true),'none') NOT IN ('none','postgres')
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_PRIVILEGED_ORIGIN_REQUIRED'; END IF;
 IF current_setting('mushavo.email_rollout_project',true) IS DISTINCT FROM '${project}'
 OR current_setting('mushavo.email_rollout_action',true) IS DISTINCT FROM '${action}'
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_TARGET_ACTION_REQUIRED'; END IF;
 ${hookGuard}
 PERFORM pg_advisory_xact_lock(20261017,2411);
 IF to_regclass('mushavo_email_install.rollout_control') IS NULL OR to_regclass('mushavo_email_install.acceptance_window') IS NULL
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_INSTALLED_STAGING_REQUIRED'; END IF;
 SELECT catalog_sha256 INTO expected FROM mushavo_email_install.rollout_control
 WHERE singleton AND target_project='${project}' AND mode='QUARANTINED' FOR UPDATE;
 IF expected IS NULL OR expected IS DISTINCT FROM mushavo_email_install.catalog_identity()
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_QUARANTINED_CATALOG_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM mushavo_email_install.acceptance_window WHERE expires_at>clock_timestamp())
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_CLOSED_WINDOW_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner JOIN pg_language l ON l.oid=p.prolang
 WHERE p.oid=to_regprocedure('mushavo_email_auth.session_valid(uuid,uuid)') AND r.rolname='postgres' AND l.lanname='sql'
 AND p.prosecdef AND p.provolatile='s' AND NOT p.proisstrict AND NOT p.proleakproof AND p.proparallel='u'
 AND p.proconfig=ARRAY['search_path=pg_catalog']::text[] AND p.prorettype='boolean'::regtype
 AND NOT has_function_privilege('anon',p.oid,'EXECUTE') AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
 AND NOT has_function_privilege('service_role',p.oid,'EXECUTE')
 AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') IN ('${predicateHashes.join("','")}'))
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_BOUNDED_PREDICATE_REQUIRED'; END IF;
 ${inventory}
 before_catalog:=(${protectedCatalog});
 PERFORM set_config('mushavo.persistent_device_component','VERIFIED_INSTALLER_OR_OFFLINE_REVIEW',true);
 EXECUTE $persistent_component$
${component}$persistent_component$;
 PERFORM set_config('mushavo.persistent_device_component',previous_ack,true);
 ${inventory}
 IF before_catalog IS DISTINCT FROM (${protectedCatalog})
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_PROTECTED_CATALOG_CHANGED'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c CROSS JOIN unnest(ARRAY['anon','authenticated','service_role']) r
 WHERE c.relnamespace='mushavo_email_auth'::regnamespace AND c.relkind='r'
 AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity
 OR has_table_privilege(r,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')))
 OR has_function_privilege('anon','public.email_gate_register_link_device(uuid,uuid,text,timestamptz,boolean)','EXECUTE')
 OR has_function_privilege('authenticated','public.email_gate_register_link_device(uuid,uuid,text,timestamptz,boolean)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.email_gate_register_link_device(uuid,uuid,text,timestamptz,boolean)','EXECUTE')
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_PRIVATE_AUTHORITY_REQUIRED'; END IF;
 UPDATE mushavo_email_install.rollout_control SET catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
 WHERE singleton AND target_project='${project}' AND mode='QUARANTINED';
 IF NOT FOUND THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_QUARANTINE_LOST'; END IF;
END;
$persistent_upgrade$;
NOTIFY pgrst,'reload schema';
SELECT jsonb_build_object('result','PERSISTENT_BROWSER_TRUST_INSTALLED_QUARANTINED',
 'guarded_RPCs',148,'restrictive_policies',82,'application_access_opened',false,'hosted_acceptance',false,
 'catalog_identity_matched',catalog_sha256=mushavo_email_install.catalog_identity()) AS result
 FROM mushavo_email_install.rollout_control WHERE singleton AND mode='QUARANTINED';
COMMIT;
`;
}
// Commit containment before upgrading. A later failed upgrade leaves access quarantined.
// Only the bounded acceptance-window row is removed; application rows/proofs are retained.
export const quarantineSQL=`-- Staging maintenance boundary for the browser-trust upgrade.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
SET LOCAL mushavo.email_rollout_project='${project}';
SET LOCAL mushavo.email_rollout_action='QUARANTINE_STAGING_EMAIL';
DO $trust_quarantine$
DECLARE expected text;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_setting('session_replication_role')<>'origin'
 OR coalesce(current_setting('role',true),'none') NOT IN ('none','postgres')
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_PRIVILEGED_ORIGIN_REQUIRED'; END IF;
 ${hookGuard}
 PERFORM pg_advisory_xact_lock(20261017,2411);
 SELECT catalog_sha256 INTO expected FROM mushavo_email_install.rollout_control
 WHERE singleton AND target_project='${project}' AND mode IN ('QUARANTINED','ACTIVE') FOR UPDATE;
 IF expected IS NULL OR expected IS DISTINCT FROM mushavo_email_install.catalog_identity()
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_KNOWN_STAGING_CATALOG_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='mushavo_email_auth.devices'::regclass AND attname='enrollment_method' AND NOT attisdropped)
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_ALREADY_INSTALLED'; END IF;
 PERFORM mushavo_email_install.quarantine();
 DELETE FROM mushavo_email_install.acceptance_window WHERE singleton AND target_project='${project}';
END;
$trust_quarantine$;
COMMIT;
`;
export const renderPersistentDeviceHandoff=component=>quarantineSQL+'\n'+renderPersistentDeviceUpgrade(component);
