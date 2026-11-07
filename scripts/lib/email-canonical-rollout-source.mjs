// Deterministic dormant migration bridge. No provider connection or activation CLI.
import {createHash} from 'node:crypto';
import {componentBody,renderAtomicInstaller,hookGuard} from './email-atomic-source.mjs';
import {renderStagingRollout,stagingProject} from './email-staging-rollout-source.mjs';
export const canonicalMigration='20261022000000_email_staging_registration_bridge.sql';
export const registrationBundle='supabase/candidates/security_fr_2_4_email_canonical_registration.sql';
const sha=s=>createHash('sha256').update(s).digest('hex');
function once(source,before,after){if(source.split(before).length!==2)throw Error('EMAIL_CANONICAL_SOURCE_ANCHOR_CHANGED');return source.replace(before,()=>after);}
const privileged=`IF current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('session_replication_role')<>'origin'
 OR coalesce(current_setting('role',true),'none') NOT IN ('none','postgres')
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'EMAIL_CANONICAL_PRIVILEGED_ORIGIN_REQUIRED'; END IF;`;
const disabledBody=`
BEGIN
 ${privileged}
 RAISE EXCEPTION 'EMAIL_CANONICAL_STAGING_REGISTRATION_REQUIRED';
END;
`;
function namespaceGuard(expectedHash,functions){
 const functionGuard=(name,bodyHash)=>`EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 JOIN pg_roles r ON r.oid=p.proowner JOIN pg_language l ON l.oid=p.prolang
 WHERE n.nspname='mushavo_email_install' AND p.proname='${name}' AND p.pronargs=0
 AND p.prokind='f' AND p.prorettype='jsonb'::regtype AND l.lanname='plpgsql'
 AND r.rolname='postgres' AND NOT p.prosecdef AND NOT p.proisstrict AND NOT p.proleakproof
 AND p.provolatile='v' AND p.proparallel='u' AND p.pronargdefaults=0
 AND p.proconfig=ARRAY['search_path=pg_catalog','lock_timeout=3s']::text[]
 AND p.proacl::text='{postgres=X/postgres}'
 ${bodyHash?"AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='"+bodyHash+"'":''})`;
 return `IF NOT EXISTS(SELECT 1 FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner
 WHERE n.nspname='mushavo_email_install' AND r.rolname='postgres' AND n.nspacl::text='{postgres=UC/postgres}')
 OR (SELECT count(*) FROM pg_proc WHERE pronamespace=to_regnamespace('mushavo_email_install'))<>${functions}
 OR NOT ${functionGuard('activate',expectedHash)}
 ${functions===2?'OR NOT '+functionGuard('register_staging',null):'-- Migration56 requires the single original activation function.'}
 OR EXISTS(SELECT 1 FROM pg_class WHERE relnamespace=to_regnamespace('mushavo_email_install'))
 OR EXISTS(SELECT 1 FROM pg_type WHERE typnamespace=to_regnamespace('mushavo_email_install'))
 OR EXISTS(SELECT 1 FROM pg_operator WHERE oprnamespace=to_regnamespace('mushavo_email_install'))
 OR EXISTS(SELECT 1 FROM pg_opclass WHERE opcnamespace=to_regnamespace('mushavo_email_install'))
 OR EXISTS(SELECT 1 FROM pg_opfamily WHERE opfnamespace=to_regnamespace('mushavo_email_install'))
 OR EXISTS(SELECT 1 FROM pg_collation WHERE collnamespace=to_regnamespace('mushavo_email_install'))
 OR EXISTS(SELECT 1 FROM pg_conversion WHERE connamespace=to_regnamespace('mushavo_email_install'))
 OR EXISTS(SELECT 1 FROM pg_ts_config WHERE cfgnamespace=to_regnamespace('mushavo_email_install'))
 OR EXISTS(SELECT 1 FROM pg_ts_dict WHERE dictnamespace=to_regnamespace('mushavo_email_install'))
 OR EXISTS(SELECT 1 FROM pg_ts_parser WHERE prsnamespace=to_regnamespace('mushavo_email_install'))
 OR EXISTS(SELECT 1 FROM pg_ts_template WHERE tmplnamespace=to_regnamespace('mushavo_email_install'))
 OR to_regnamespace('mushavo_email_auth') IS NOT NULL
 THEN RAISE EXCEPTION 'EMAIL_CANONICAL_DORMANT_INSTALLER_IDENTITY_REQUIRED'; END IF;`;
}
export function renderCanonicalBridge(components,baseline){
 const legacy=renderAtomicInstaller(components),match=/AS \$email_activate\$([\s\S]*)\$email_activate\$;/.exec(legacy);
 if(!match)throw Error('EMAIL_CANONICAL_LEGACY_BODY_REQUIRED');
 let registration=componentBody(renderStagingRollout(components,baseline));
 registration=once(registration,"to_regnamespace('mushavo_email_install') IS NULL","to_regnamespace('mushavo_email_install') IS NOT NULL");
 registration=once(registration,"IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='mushavo_email_install')\n THEN RAISE EXCEPTION 'EMAIL_ATOMIC_INSTALLER_NAMESPACE_EXISTS'; END IF;",'-- The bridge verified the exact dormant private namespace before this block.');
 registration=once(registration,'CREATE SCHEMA mushavo_email_install;','-- Reuse the exact previously verified private namespace.');
 registration=once(registration,'CREATE FUNCTION mushavo_email_install.activate()','CREATE OR REPLACE FUNCTION mushavo_email_install.activate()');
 for(const delimiter of ['$canonical_register$','$canonical_registration_payload$','$canonical_disabled$'])if(registration.includes(delimiter))throw Error('EMAIL_CANONICAL_DELIMITER_COLLISION');
 return `-- FR.2.4.E5.18: dormant canonical staging-registration bridge, no application activation.
-- Appends migration56; the original55 source files remain unchanged.
-- Explicit staging registration follows separately, after independent target review.
BEGIN;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
DO $canonical_upgrade$
BEGIN
 ${privileged}
 ${hookGuard}
 ${namespaceGuard(sha(match[1]),1)}
END;
$canonical_upgrade$;
-- Disable the old offline activation path before introducing the only registration entry.
CREATE OR REPLACE FUNCTION mushavo_email_install.activate() RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog SET lock_timeout='3s'
AS $canonical_disabled$${disabledBody}$canonical_disabled$;
REVOKE ALL ON FUNCTION mushavo_email_install.activate() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION mushavo_email_install.register_staging() RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog SET lock_timeout='3s'
AS $canonical_register$
BEGIN
 ${privileged}
 ${namespaceGuard(sha(disabledBody),2)}
 ${hookGuard}
 -- The unchanged staging prerequisite/target/action guards execute before control DDL.
 PERFORM pg_advisory_xact_lock(20261017,2411);
 EXECUTE $canonical_registration_payload$
${registration}$canonical_registration_payload$;
 RETURN jsonb_build_object('result','CANONICAL_STAGING_EMAIL_REGISTERED','mode','REGISTERED',
   'application_guards_installed',false,'target_independently_verified',false,'hosted_acceptance',false);
END;
$canonical_register$;
REVOKE ALL ON FUNCTION mushavo_email_install.register_staging() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
`;
}
export function renderCanonicalRegistration(components,baseline){
 const legacy=renderAtomicInstaller(components),bridge=renderCanonicalBridge(components,baseline);
 // The baseline is the previously reviewed absent-installer selected catalog.
 const start=baseline.indexOf('WITH routines AS ('),end=baseline.indexOf('\nSELECT jsonb_build_object(',start);
 if(start<0||end<0||baseline.indexOf('WITH routines AS (',start+1)>=0)throw Error('EMAIL_CANONICAL_BASELINE_REQUIRED');
 return `-- FR.2.4.E5.18 offline-reviewed registration bundle for an existing54 baseline.
-- Not a live handoff. Independent privileged staging target verification remains required.
-- One transaction registers migration55, migration56 and staging controls; no activation.
BEGIN;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
DO $canonical_existing54$
BEGIN
 ${privileged}
 IF current_setting('mushavo.email_rollout_project',true) IS DISTINCT FROM '${stagingProject}'
 THEN RAISE EXCEPTION 'EMAIL_STAGING_TARGET_ACK_REQUIRED'; END IF;
 IF current_setting('mushavo.email_rollout_action',true) IS DISTINCT FROM 'REGISTER_STAGING_EMAIL'
 THEN RAISE EXCEPTION 'EMAIL_STAGING_ACTION_ACK_REQUIRED'; END IF;
 IF (${baseline.slice(start,end)}
 SELECT bool_and(value::text::boolean) FROM checks c,jsonb_each(to_jsonb(c))) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'EMAIL_STAGING_BASELINE_REVIEW_REQUIRED'; END IF;
END;
$canonical_existing54$;
${componentBody(legacy)}
${componentBody(bridge)}
SELECT mushavo_email_install.register_staging() AS canonical_registration_result;
COMMIT;
`;
}
