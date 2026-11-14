# Recipient preparation passed; one recovery account window next

Stage 3/10 | FR.2/8 | Batch W/Z. 27 October 2026, FRE245.

Window source pin: `2c2befd448de7b0737fe651f7f457c913144e0ea`. Candidate SHA256: `600082e01d6eef21a1a36f1c7b57e9ee853c0dab1552bf7e957773bae97a2d2c`.

[Owner receipt](security-fr-2-batch-w-owner-recipient-addition-and-redeploy.json): source3/Windows DPAPI/new encrypted packet/readback/original unchanged/recipient-only clipboard/exact accepted ZIP all passed, combined exit0. Two retained recipients became three. The preparer made no hosted request or setting/SQL/password change. Owner subsequently supplied https://cf533a08.mushavo-budget-staging.pages.dev/. The same accepted trusted-browser ZIP is intentional. The explicit report that the one secret was saved in both staging environments before this deployment is still requested; local preparation and a deployment URL alone cannot prove it.

[Automated selected public readback](security-fr-2-batch-w-recipient-redeploy-public-readback.json) was blocked: eight selected GET attempts plus one diagnostic GET, the latter HTTP403 with Cloudflare error1010. The web reader also could not access the URL. Do not call these source mismatches or infer an owner browser outage. No runtime parity, live secret equality or mail delivery is credited. Prior accepted public16 remains at its original deployment/pin. No private Worker source, Auth request, SQL or email was read or executed.

The next [SQL candidate](../../supabase/candidates/security_fr_2_5_recovery_test_window.sql) uses the existing private controllers for exactly one confirmed active recovery account, at most1800 seconds. It checks privileged origin, the original advisory lock, fixed project, current catalog and canonical bounded session predicate. A quarantined installation opens only that actor; an unexpired exact same-actor window is reused without extending it; an unexpired other/multiple-actor window is refused. An expired valid active window is quarantined and reopened through the original controllers in one transaction. Unexpected state or drift refuses. It performs no DDL, proof/device/account/password write or email request. Requiring the old fresh-signup window's signup-link approval would be inappropriate for this established recovery account; the real proof gate remains necessary after opening.

[Contract](security-fr-2-batch-w-recovery-window-contract.json), [source manifest](security-fr-2-batch-w-recovery-window-source-manifest.json), [12/12 local checks](security-fr-2-batch-w-recovery-window-local-checks.json). Tests run the actual candidate and original controller against offline modeled Auth/control/catalog state, including proof absence, expiry, existing-window preservation, drift, privileges and transactional rollback. Two test-fixture errors were corrected before final12/12; candidate unchanged between runs. No previous suites rerun. These tests add no AU cases and do not prove the hosted database or recovery session.

Owner handoff:

1. Confirm locally that the prepared three-address ZOHO_TEST_RECIPIENTS_JSON secret was saved in both deployment environments of **mushavo-budget-staging** before the new deployment. If it was not, complete the existing one-setting handoff before opening the timed SQL window. No SQL sidecar reinstall or new ZIP build.
2. Independently select Supabase staging project **dczlddwbtgvfdujgcitb**. In SQL Editor, run the complete candidate supplied in chat, with only the recovery email placeholder replaced by the exact account already verified in the retained recovery form. No private email is published here.
3. Expected safe result: **RECOVERY_SINGLE_ACCOUNT_WINDOW_READY**, allowed_actor_count1, maximum_seconds1800, an expiry timestamp, and a transition classification. A reused window keeps its original deadline. On an error, return that error without changing state manually.
4. Return the result and whether the recipient secret was saved in both staging environments. Keep the genuine recovery form open and unchanged. Stop before matching-password save, code request or continuation. Do not paste a password, code, recovery link, clipboard list or encrypted packet.

Current account/session freshness and actual password-save/provider failure/retry/security invalidation remain for the separate AU04.05 handoff. Both deferred UI improvements remain deferred. V Admin MFA stays on hold; full W/FR.2/Stage3/release and all findings remain open. Production/native unchanged; APK deferred.

Complete SQL template:

```sql
-- Stage 3/10 | FR.2/8 | Batch W/Z: one confirmed recovery account, at most 30 minutes.
-- Select staging project dczlddwbtgvfdujgcitb independently. Replace only the email placeholder.
-- This uses installed controllers; it does not install a migration, create proof or save a password.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
SET LOCAL mushavo.email_rollout_project='dczlddwbtgvfdujgcitb';
SET LOCAL mushavo.email_rollout_action='OPEN_STAGING_ACCEPTANCE_WINDOW';
SET LOCAL mushavo.recovery_test_email='OWNER_CONTROLLED_RECOVERY_EMAIL';
DO $recovery_window$
DECLARE actor uuid; actors uuid[]; control_row record; window_row record;
 window_present boolean; outcome jsonb; transition text; deadline timestamptz;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('session_replication_role')<>'origin'
 OR coalesce(current_setting('role',true),'none') NOT IN ('none','postgres')
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'RECOVERY_WINDOW_PRIVILEGED_ORIGIN_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(20261017,2411);
 SELECT array_agg(id) INTO actors FROM auth.users
 WHERE lower(email)=lower(btrim(current_setting('mushavo.recovery_test_email',true)));
 IF coalesce(cardinality(actors),0)<>1
 THEN RAISE EXCEPTION 'EXACTLY_ONE_RECOVERY_ACCOUNT_REQUIRED'; END IF;
 actor:=actors[1];
 IF NOT EXISTS(SELECT 1 FROM auth.users u JOIN public.profiles p ON p.id=u.id
 WHERE u.id=actor AND u.email_confirmed_at IS NOT NULL AND p.account_status='active'
 AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp()))
 THEN RAISE EXCEPTION 'CONFIRMED_ACTIVE_RECOVERY_ACCOUNT_REQUIRED'; END IF;
 SELECT * INTO control_row FROM mushavo_email_install.rollout_control WHERE singleton FOR UPDATE;
 IF NOT FOUND OR control_row.target_project IS DISTINCT FROM 'dczlddwbtgvfdujgcitb'
 OR control_row.mode IS NULL OR control_row.mode NOT IN ('ACTIVE','QUARANTINED')
 OR control_row.catalog_sha256 IS NULL
 OR control_row.catalog_sha256 IS DISTINCT FROM mushavo_email_install.catalog_identity()
 THEN RAISE EXCEPTION 'RECOVERY_WINDOW_CURRENT_CATALOG_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
 JOIN pg_language l ON l.oid=p.prolang
 WHERE p.oid=to_regprocedure('mushavo_email_auth.session_valid(uuid,uuid)')
 AND r.rolname='postgres' AND l.lanname='sql' AND p.prosecdef AND p.provolatile='s'
 AND NOT p.proisstrict AND NOT p.proleakproof AND p.proparallel='u' AND p.pronargdefaults=0
 AND p.prorettype='boolean'::regtype AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
 AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
 AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
 AND NOT has_function_privilege('service_role',p.oid,'EXECUTE')
 AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='1a9deca016cde542c78d89dae6a5d7e8b4cd2950a1bd6567c229421b3b36d302')
 THEN RAISE EXCEPTION 'RECOVERY_WINDOW_CANONICAL_PREDICATE_REQUIRED'; END IF;
 SELECT * INTO window_row FROM mushavo_email_install.acceptance_window WHERE singleton FOR UPDATE;
 window_present:=FOUND;
 IF control_row.mode='ACTIVE' THEN
  IF NOT window_present OR window_row.target_project IS DISTINCT FROM 'dczlddwbtgvfdujgcitb'
  OR window_row.opened_at IS NULL OR window_row.opened_at>clock_timestamp()
  OR window_row.expires_at IS NULL OR window_row.expires_at<=window_row.opened_at
  OR window_row.expires_at>window_row.opened_at+interval '30 minutes'
  OR window_row.allowed_users IS NULL OR cardinality(window_row.allowed_users) NOT BETWEEN 1 AND 4
  OR array_ndims(window_row.allowed_users) IS DISTINCT FROM 1
  OR array_position(window_row.allowed_users,NULL) IS NOT NULL
  OR (SELECT count(DISTINCT u) FROM unnest(window_row.allowed_users) u)<>cardinality(window_row.allowed_users)
  THEN RAISE EXCEPTION 'RECOVERY_WINDOW_VALID_EXISTING_BOUND_REQUIRED'; END IF;
  IF window_row.expires_at>clock_timestamp() THEN
   IF window_row.allowed_users IS DISTINCT FROM ARRAY[actor]
   THEN RAISE EXCEPTION 'RECOVERY_WINDOW_OTHER_ACTIVE_ACTORS_RETAINED'; END IF;
   transition:='REUSED_WITHOUT_EXTENSION';
  ELSE
   PERFORM set_config('mushavo.email_rollout_action','QUARANTINE_STAGING_EMAIL',true);
   outcome:=mushavo_email_install.quarantine();
   IF outcome->>'result' IS DISTINCT FROM 'STAGING_EMAIL_QUARANTINED'
   THEN RAISE EXCEPTION 'RECOVERY_WINDOW_QUARANTINE_REQUIRED'; END IF;
   transition:='REOPENED_EXPIRED_WINDOW';
  END IF;
 ELSE transition:='OPENED_FROM_QUARANTINE';
 END IF;
 IF transition<>'REUSED_WITHOUT_EXTENSION' THEN
  PERFORM set_config('mushavo.email_rollout_action','OPEN_STAGING_ACCEPTANCE_WINDOW',true);
  outcome:=mushavo_email_install.open_acceptance_window(ARRAY[actor],1800);
  IF outcome->>'result' IS DISTINCT FROM 'STAGING_BOUNDED_ACCEPTANCE_WINDOW_OPEN'
  OR outcome->>'allowed_actor_count' IS DISTINCT FROM '1'
  OR outcome->>'maximum_seconds' IS DISTINCT FROM '1800'
  THEN RAISE EXCEPTION 'RECOVERY_WINDOW_SINGLE_ACCOUNT_REQUIRED'; END IF;
 END IF;
 SELECT expires_at INTO deadline FROM mushavo_email_install.acceptance_window
 WHERE singleton AND target_project='dczlddwbtgvfdujgcitb' AND allowed_users=ARRAY[actor]
 AND opened_at<=clock_timestamp() AND expires_at>clock_timestamp();
 IF deadline IS NULL OR NOT EXISTS(SELECT 1 FROM mushavo_email_install.rollout_control
 WHERE singleton AND target_project='dczlddwbtgvfdujgcitb' AND mode='ACTIVE'
 AND catalog_sha256=mushavo_email_install.catalog_identity())
 THEN RAISE EXCEPTION 'RECOVERY_WINDOW_FINAL_STATE_REQUIRED'; END IF;
 PERFORM set_config('mushavo.recovery_window_result',jsonb_build_object(
 'result','RECOVERY_SINGLE_ACCOUNT_WINDOW_READY','window_action',transition,
 'allowed_actor_count',1,'maximum_seconds',1800,'expires_at',deadline,
 'confirmed_active_account',true,'application_proof_created_by_this_SQL',false,
 'password_or_email_requested_by_this_SQL',false,'browser_approval_changed_by_this_SQL',false,
 'hosted_acceptance',false)::text,true);
END;
$recovery_window$;
SELECT current_setting('mushavo.recovery_window_result')::jsonb AS result;
COMMIT;
```
