// Review candidate only. No connection, credential handling or hosted activation.
import {renderAtomicInstaller, hookGuard} from './email-atomic-source.mjs';

export const stagingProject = 'dczlddwbtgvfdujgcitb';
export const stagingCandidate = 'supabase/candidates/security_fr_2_4_email_staging_rollout.sql';
const privileged = `IF current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('session_replication_role')<>'origin'
 OR coalesce(current_setting('role',true),'none') NOT IN ('none','postgres')
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'EMAIL_STAGING_PRIVILEGED_ORIGIN_REQUIRED'; END IF;`;
const target = `IF current_setting('mushavo.email_rollout_project',true) IS DISTINCT FROM '${stagingProject}'
 THEN RAISE EXCEPTION 'EMAIL_STAGING_TARGET_ACK_REQUIRED'; END IF;`;
const acknowledge = action => `${privileged}
 ${target}
 IF current_setting('mushavo.email_rollout_action',true) IS DISTINCT FROM '${action}'
 THEN RAISE EXCEPTION 'EMAIL_STAGING_ACTION_ACK_REQUIRED'; END IF;`;

// Each edit must match exactly once; source drift never silently weakens a guard.
function replaceOne(source, before, after) {
  if (!before || source.split(before).length !== 2) throw new Error('EMAIL_STAGING_SOURCE_ANCHOR_CHANGED');
  return source.replace(before, () => after);
}

function controlDDL() {
  return `CREATE TABLE mushavo_email_install.rollout_control (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 target_project text NOT NULL CHECK(target_project='${stagingProject}'),
 mode text NOT NULL CHECK(mode IN ('REGISTERED','QUARANTINED','ACTIVE')),
 catalog_sha256 text CHECK(catalog_sha256 ~ '^[0-9a-f]{64}$'),
 changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((mode='REGISTERED')=(catalog_sha256 IS NULL))
);
ALTER TABLE mushavo_email_install.rollout_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE mushavo_email_install.rollout_control FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE mushavo_email_install.rollout_control FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO mushavo_email_install.rollout_control(singleton,target_project,mode)
 VALUES(true,'${stagingProject}','REGISTERED');

-- Selected security catalog identity, not application contents or secret values.
CREATE FUNCTION mushavo_email_install.catalog_identity() RETURNS text
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $catalog$
 SELECT encode(sha256(convert_to(jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_array(n.nspname,p.proname,
   pg_get_function_identity_arguments(p.oid),pg_get_functiondef(p.oid),r.rolname,p.proacl::text,
   has_function_privilege('anon',p.oid,'EXECUTE'),
   has_function_privilege('authenticated',p.oid,'EXECUTE'),
   has_function_privilege('service_role',p.oid,'EXECUTE'))
   ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
   WHERE n.nspname IN ('public','storage','mushavo_email_auth','mushavo_email_install') AND p.prokind='f'),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname)
   FROM pg_policies p WHERE schemaname IN ('public','storage','mushavo_email_auth','mushavo_email_install')),
 'relations',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relkind,r.rolname,
   c.relrowsecurity,c.relforcerowsecurity,c.relacl::text,c.reloptions) ORDER BY n.nspname,c.relname)
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner
   WHERE n.nspname IN ('public','storage','mushavo_email_auth','mushavo_email_install') AND c.relkind IN ('r','p','v','m','f','S')),
 'schemas',(SELECT jsonb_agg(jsonb_build_array(n.nspname,r.rolname,n.nspacl::text,
   has_schema_privilege('anon',n.oid,'USAGE'),has_schema_privilege('authenticated',n.oid,'USAGE'),
   has_schema_privilege('service_role',n.oid,'USAGE')) ORDER BY n.nspname)
   FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner
   WHERE n.nspname IN ('public','storage','mushavo_email_auth','mushavo_email_install')),
 'columns',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,a.attname,
   a.atttypid::regtype::text,a.atttypmod,a.attnotnull,a.attidentity,a.attgenerated,
   pg_get_expr(d.adbin,d.adrelid)) ORDER BY n.nspname,c.relname,a.attnum)
   FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
   WHERE a.attnum>0 AND NOT a.attisdropped AND c.relkind IN ('r','p','v','m','f')
   AND n.nspname IN ('public','auth','storage','mushavo_email_auth','mushavo_email_install')),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,k.conname,
   pg_get_constraintdef(k.oid),k.convalidated) ORDER BY n.nspname,c.relname,k.conname)
   FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname IN ('public','auth','storage','mushavo_email_auth','mushavo_email_install')),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid))
   ORDER BY n.nspname,c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
   JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE NOT t.tgisinternal AND n.nspname IN ('public','auth','storage','mushavo_email_auth','mushavo_email_install')),
 'hooks',(SELECT jsonb_agg(jsonb_build_array(e.evtname,e.evtevent,e.evtenabled,e.evttags,
   er.rolname,pg_get_functiondef(p.oid),pr.rolname,p.proacl::text) ORDER BY e.evtname)
   FROM pg_event_trigger e JOIN pg_proc p ON p.oid=e.evtfoid
   JOIN pg_roles er ON er.oid=e.evtowner JOIN pg_roles pr ON pr.oid=p.proowner)
 )::text,'UTF8')),'hex');
$catalog$;
REVOKE ALL ON FUNCTION mushavo_email_install.catalog_identity() FROM PUBLIC,anon,authenticated,service_role;
`;
}

function recoveryDDL() {
  return `
-- Committed recovery contains access; it never restores password-only access.
CREATE FUNCTION mushavo_email_install.quarantine() RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog SET lock_timeout='3s' AS $quarantine$
BEGIN
 ${acknowledge('QUARANTINE_STAGING_EMAIL')}
 PERFORM pg_advisory_xact_lock(20261017,2411);
 UPDATE mushavo_email_install.rollout_control SET mode='QUARANTINED',changed_at=clock_timestamp()
 WHERE singleton AND target_project='${stagingProject}' AND mode IN ('ACTIVE','QUARANTINED')
 AND catalog_sha256 IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'EMAIL_STAGING_ACTIVE_INSTALLATION_REQUIRED'; END IF;
 RETURN jsonb_build_object('result','STAGING_EMAIL_QUARANTINED','guards_retained',true,
   'proofs_and_application_data_retained',true,'hosted_acceptance',false);
END;
$quarantine$;
REVOKE ALL ON FUNCTION mushavo_email_install.quarantine() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION mushavo_email_install.resume() RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog SET lock_timeout='3s' AS $resume$
DECLARE expected text;
BEGIN
 ${acknowledge('RESUME_STAGING_EMAIL')}
 ${hookGuard}
 PERFORM pg_advisory_xact_lock(20261017,2411);
 SELECT catalog_sha256 INTO expected FROM mushavo_email_install.rollout_control
 WHERE singleton AND target_project='${stagingProject}' AND mode='QUARANTINED' FOR UPDATE;
 IF expected IS NULL THEN RAISE EXCEPTION 'EMAIL_STAGING_QUARANTINED_INSTALLATION_REQUIRED'; END IF;
 IF mushavo_email_install.catalog_identity() IS DISTINCT FROM expected
 THEN RAISE EXCEPTION 'EMAIL_STAGING_CATALOG_DRIFT_REVIEW_REQUIRED'; END IF;
 UPDATE mushavo_email_install.rollout_control SET mode='ACTIVE',changed_at=clock_timestamp() WHERE singleton;
 RETURN jsonb_build_object('result','STAGING_EMAIL_ACTIVE','catalog_identity_matched',true,
   'target_independently_verified',false,'hosted_acceptance',false);
END;
$resume$;
REVOKE ALL ON FUNCTION mushavo_email_install.resume() FROM PUBLIC,anon,authenticated,service_role;
`;
}

export function renderStagingRollout(components, reviewedBaseline) {
  if (typeof reviewedBaseline !== 'string') throw new Error('EMAIL_STAGING_BASELINE_REQUIRED');
  const start = reviewedBaseline.indexOf('WITH routines AS (');
  const end = reviewedBaseline.indexOf('\nSELECT jsonb_build_object(', start);
  if (start < 0 || end < 0 || reviewedBaseline.indexOf('WITH routines AS (', start + 1) >= 0)
    throw new Error('EMAIL_STAGING_BASELINE_ANCHOR_CHANGED');
  const baseline = `DO $staging_baseline$
DECLARE matches boolean;
BEGIN
 ${acknowledge('REGISTER_STAGING_EMAIL')}
 ${reviewedBaseline.slice(start, end)}
 SELECT bool_and(value::text::boolean) INTO matches FROM checks c, jsonb_each(to_jsonb(c));
 IF matches IS DISTINCT FROM true THEN RAISE EXCEPTION 'EMAIL_STAGING_BASELINE_REVIEW_REQUIRED'; END IF;
END;
$staging_baseline$;\n`;
  const activationBaseline = replaceOne(reviewedBaseline.slice(start, end),
    "to_regnamespace('mushavo_email_install') IS NULL",
    "to_regnamespace('mushavo_email_install') IS NOT NULL");
  let source = renderAtomicInstaller(components);
  source = replaceOne(source,
    '-- This source phase permits OFFLINE_ATOMIC_REHEARSAL only. No live activation handoff.',
    `-- E5.8 separate staging candidate; not an approved hosted handoff or migration.
-- Target GUC is an operator acknowledgement, NOT independent server identity.
-- Registration/activation/resume are separate. Activation starts QUARANTINED.
-- Cross-service deployment, trusted target attestation and hosted acceptance remain pending.`);
  source = replaceOne(source, 'DO $registration$', baseline + 'DO $registration$');
  source = replaceOne(source, 'CREATE FUNCTION mushavo_email_install.activate()',
    controlDDL() + recoveryDDL() + '\nCREATE FUNCTION mushavo_email_install.activate()');
  source = replaceOne(source,
    `IF current_setting('mushavo.email_atomic_review',true) IS DISTINCT FROM 'OFFLINE_ATOMIC_REHEARSAL'
 THEN RAISE EXCEPTION 'EMAIL_ATOMIC_OFFLINE_REHEARSAL_ACK_REQUIRED'; END IF;`,
    `${acknowledge('ACTIVATE_STAGING_EMAIL_QUARANTINED')}
 -- Refresh the same nine selected prerequisites at activation, allowing only
 -- the intentionally dormant installer namespace from the separate registration.
 IF (${activationBaseline}
 SELECT bool_and(value::text::boolean) FROM checks c,jsonb_each(to_jsonb(c))) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'EMAIL_STAGING_BASELINE_REVIEW_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM mushavo_email_install.rollout_control
   WHERE singleton AND target_project='${stagingProject}' AND mode='REGISTERED' AND catalog_sha256 IS NULL)
 THEN RAISE EXCEPTION 'EMAIL_STAGING_DORMANT_REGISTRATION_REQUIRED'; END IF;`);

  // Reuse the reviewed predicate unchanged, adding a fail-closed rollout condition
  // only AFTER the original four components and their catalog checks complete.
  const body = components.verification_backend;
  const first = body.indexOf('CREATE FUNCTION mushavo_email_auth.session_valid(');
  const last = body.indexOf('\n$body$;', first);
  if (first < 0 || last < 0 || body.slice(first, last).includes('$rollout_predicate$'))
    throw new Error('EMAIL_STAGING_PREDICATE_ANCHOR_CHANGED');
  let predicate = body.slice(first, last + '\n$body$;'.length);
  predicate = replaceOne(predicate, 'CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION');
  predicate = replaceOne(predicate,
    'AND (s.not_after IS NULL OR s.not_after>statement_timestamp()));',
    `AND (s.not_after IS NULL OR s.not_after>statement_timestamp()))
 AND EXISTS(SELECT 1 FROM mushavo_email_install.rollout_control
   WHERE singleton AND target_project='${stagingProject}' AND mode='ACTIVE');`);
  source = replaceOne(source,
    " RETURN jsonb_build_object('result','ATOMIC_EMAIL_SOURCE_REHEARSAL_INSTALLED',",
    ` -- FR_STAGING_AFTER_COMPONENTS
 EXECUTE $rollout_predicate$${predicate}$rollout_predicate$;
 UPDATE mushavo_email_install.rollout_control
 SET mode='QUARANTINED',catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
 WHERE singleton AND mode='REGISTERED';
 IF NOT FOUND THEN RAISE EXCEPTION 'EMAIL_STAGING_CONTROL_ROW_REQUIRED'; END IF;
 RETURN jsonb_build_object('result','STAGING_EMAIL_INSTALLED_QUARANTINED',
   'target_independently_verified',false,`);
  return source;
}
