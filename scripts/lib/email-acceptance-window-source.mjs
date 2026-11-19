// Staging-only review candidate. Rendering never connects, executes SQL or opens access.
import {createHash} from 'node:crypto';
import {loadStagingInputs} from '../check-fr-2-email-staging-rollout-source.mjs';
import {renderStagingRollout} from './email-staging-rollout-source.mjs';
import {installationSQL} from '../install-fr-2-email-batch-h.mjs';
import {privateCatalogSQL,contextSQL,stagingRef} from './email-registration-handoff-sql.mjs';
import {versionReference} from './email-registration-catalog-versions.mjs';
import {hookGuard} from './email-atomic-source.mjs';
export const windowStage='FR.2.4.E5.24_BATCH_K_BOUNDED_ACCEPTANCE_WINDOW_CONTROLS';
export const candidatePath='supabase/candidates/security_fr_2_4_email_acceptance_window.sql';
export const maximumWindowSeconds=1800;
const quote=x=>"'"+String(x).replaceAll("'","''")+"'";
const privileged=`IF NOT ((${contextSQL})->>'privileged_origin')::boolean
 THEN RAISE EXCEPTION 'EMAIL_WINDOW_PRIVILEGED_ORIGIN_REQUIRED'; END IF;`;
const acknowledge=action=>`${privileged}
 IF current_setting('mushavo.email_rollout_project',true) IS DISTINCT FROM '${stagingRef}'
 OR current_setting('mushavo.email_rollout_action',true) IS DISTINCT FROM '${action}'
 THEN RAISE EXCEPTION 'EMAIL_WINDOW_TARGET_ACTION_REQUIRED'; END IF;`;
export async function windowSources(){
 const {components,baseline}=await loadStagingInputs();
 const rollout=renderStagingRollout(components,baseline);
 const marker='EXECUTE $rollout_predicate$',start=rollout.indexOf(marker),end=rollout.indexOf('$rollout_predicate$;',start+marker.length);
 if(start<0||end<0||rollout.indexOf(marker,start+1)>=0)throw Error('WINDOW_PREDICATE_SOURCE_REQUIRED');
 const original=rollout.slice(start+marker.length,end);
 const anchor="AND mode='ACTIVE');";
 if(original.split(anchor).length!==2)throw Error('WINDOW_PREDICATE_ANCHOR_REQUIRED');
 const predicate=original.replace(anchor,`AND mode='ACTIVE')
 AND EXISTS(SELECT 1 FROM mushavo_email_install.acceptance_window w
   WHERE w.singleton AND w.target_project='${stagingRef}' AND p_user=ANY(w.allowed_users)
   AND w.opened_at<=clock_timestamp() AND w.expires_at>clock_timestamp());`);
 const body=x=>{const a=x.indexOf('AS $body$'),b=x.lastIndexOf('$body$;');if(a<0||b<a)throw Error('WINDOW_BODY_REQUIRED');return x.slice(a+'AS $body$'.length,b);};
 const oldHash=createHash('sha256').update(body(original)).digest('hex');
 const newHash=createHash('sha256').update(body(predicate)).digest('hex');
 const {base}=await installationSQL();
 const refs=Object.fromEntries([15,16,17,18].map(n=>[String(n),versionReference(base,n*10000)]));
 const installer=privateCatalogSQL.replace("n.nspname IN ('mushavo_email_install','mushavo_email_auth')","n.nspname='mushavo_email_install'");
 const predicateMatches=hash=>`EXISTS(SELECT 1 FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner JOIN pg_language l ON l.oid=p.prolang
 WHERE p.oid=to_regprocedure('mushavo_email_auth.session_valid(uuid,uuid)')
 AND r.rolname='postgres' AND l.lanname='sql' AND p.prosecdef AND p.provolatile='s'
 AND NOT p.proisstrict AND NOT p.proleakproof AND p.proparallel='u' AND p.pronargdefaults=0
 AND p.prorettype='boolean'::regtype AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
 AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
 AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
 AND NOT has_function_privilege('service_role',p.oid,'EXECUTE')
 AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=${quote(hash)})`;
 const upgrade=`-- Batch K staging-only candidate: install CLOSED acceptance controls; never open a window.
-- No hosted execution entry point is supplied in this offline checkpoint.
BEGIN;
SET LOCAL statement_timeout='35s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
DO $window_guard$ BEGIN
 ${acknowledge('INSTALL_CLOSED_STAGING_ACCEPTANCE_CONTROLS')}
 ${hookGuard}
 PERFORM pg_advisory_xact_lock(20261017,2411);
 IF (${installer}) IS DISTINCT FROM (${quote(JSON.stringify(refs))}::jsonb -> (current_setting('server_version_num')::integer/10000)::text)
 THEN RAISE EXCEPTION 'EMAIL_WINDOW_ORIGINAL_INSTALLER_REQUIRED'; END IF;
 PERFORM 1 FROM mushavo_email_install.rollout_control WHERE singleton AND target_project='${stagingRef}'
 AND mode='QUARANTINED' AND catalog_sha256=mushavo_email_install.catalog_identity() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'EMAIL_WINDOW_QUARANTINED_CATALOG_REQUIRED'; END IF;
 IF NOT (${predicateMatches(oldHash)}) THEN RAISE EXCEPTION 'EMAIL_WINDOW_ORIGINAL_PREDICATE_REQUIRED'; END IF;
 IF to_regclass('mushavo_email_install.acceptance_window') IS NOT NULL
 THEN RAISE EXCEPTION 'EMAIL_WINDOW_ALREADY_INSTALLED_INSPECT_STATE'; END IF;
END $window_guard$;
CREATE TABLE mushavo_email_install.acceptance_window (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 target_project text NOT NULL CHECK(target_project='${stagingRef}'),
 allowed_users uuid[] NOT NULL CHECK(cardinality(allowed_users) BETWEEN 1 AND 4 AND array_ndims(allowed_users)=1 AND array_position(allowed_users,NULL) IS NULL),
 opened_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL CHECK(expires_at>opened_at AND expires_at<=opened_at+interval '30 minutes')
);
ALTER TABLE mushavo_email_install.acceptance_window ENABLE ROW LEVEL SECURITY;
ALTER TABLE mushavo_email_install.acceptance_window FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE mushavo_email_install.acceptance_window FROM PUBLIC,anon,authenticated,service_role;
${predicate}
-- An old global-resume call must not bypass the acceptance deadline or actor list.
CREATE OR REPLACE FUNCTION mushavo_email_install.resume() RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog SET lock_timeout='3s' AS $resume$
BEGIN
 ${privileged}
 RAISE EXCEPTION 'EMAIL_WINDOW_EXPLICIT_BOUNDED_OPEN_REQUIRED';
END;
$resume$;
CREATE FUNCTION mushavo_email_install.open_acceptance_window(p_users uuid[],p_seconds integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog SET lock_timeout='3s' AS $window$
DECLARE started timestamptz; expected text;
BEGIN
 ${acknowledge('OPEN_STAGING_ACCEPTANCE_WINDOW')}
 ${hookGuard}
 PERFORM pg_advisory_xact_lock(20261017,2411);
 IF p_users IS NULL OR p_seconds IS NULL OR p_seconds<30 OR p_seconds>${maximumWindowSeconds}
 OR cardinality(p_users) NOT BETWEEN 1 AND 4 OR array_ndims(p_users)<>1 OR array_position(p_users,NULL) IS NOT NULL
 OR (SELECT count(DISTINCT u) FROM unnest(p_users) u)<>cardinality(p_users)
 THEN RAISE EXCEPTION 'EMAIL_WINDOW_BOUNDED_ACTORS_DURATION_REQUIRED'; END IF;
 IF (SELECT count(*) FROM auth.users u JOIN public.profiles p ON p.id=u.id
 WHERE u.id=ANY(p_users) AND u.email_confirmed_at IS NOT NULL AND p.account_status='active'
 AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp()))<>cardinality(p_users)
 THEN RAISE EXCEPTION 'EMAIL_WINDOW_ACTIVE_CONFIRMED_ACTORS_REQUIRED'; END IF;
 SELECT catalog_sha256 INTO expected FROM mushavo_email_install.rollout_control
 WHERE singleton AND target_project='${stagingRef}' AND mode='QUARANTINED' FOR UPDATE;
 IF expected IS NULL OR expected IS DISTINCT FROM mushavo_email_install.catalog_identity()
 THEN RAISE EXCEPTION 'EMAIL_WINDOW_QUARANTINED_CATALOG_REQUIRED'; END IF;
 IF NOT (${predicateMatches(newHash)}) THEN RAISE EXCEPTION 'EMAIL_WINDOW_PREDICATE_DRIFT_REQUIRED'; END IF;
 started:=clock_timestamp();
 INSERT INTO mushavo_email_install.acceptance_window(singleton,target_project,allowed_users,opened_at,expires_at)
 VALUES(true,'${stagingRef}',p_users,started,started+make_interval(secs=>p_seconds))
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
 OR NOT (${predicateMatches(newHash)})
 OR EXISTS(SELECT 1 FROM pg_class c CROSS JOIN unnest(ARRAY['anon','authenticated','service_role']) r
 WHERE c.oid='mushavo_email_install.acceptance_window'::regclass AND
 (NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR has_table_privilege(r,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')))
 THEN RAISE EXCEPTION 'EMAIL_WINDOW_CLOSED_POSTCONDITION_REQUIRED'; END IF;
END $window_post$;
COMMIT;
`;
 return {upgrade,original,predicate,oldHash,newHash};
}
