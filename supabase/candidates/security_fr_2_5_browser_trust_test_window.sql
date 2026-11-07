-- One controlled staging identity, using the existing bounded acceptance controller.
-- Replace only the email placeholder. Independently select staging project dczlddwbtgvfdujgcitb.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
SET LOCAL mushavo.email_rollout_project='dczlddwbtgvfdujgcitb';
SET LOCAL mushavo.email_rollout_action='OPEN_STAGING_ACCEPTANCE_WINDOW';
SET LOCAL mushavo.browser_test_email='OWNER_CONTROLLED_FRESH_SIGNUP_EMAIL';
DO $browser_window$
DECLARE actor uuid; actors uuid[]; outcome jsonb;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('session_replication_role')<>'origin'
 OR coalesce(current_setting('role',true),'none') NOT IN ('none','postgres')
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'BROWSER_WINDOW_PRIVILEGED_ORIGIN_REQUIRED'; END IF;
 SELECT array_agg(id) INTO actors FROM auth.users
 WHERE lower(email)=lower(current_setting('mushavo.browser_test_email',true));
 IF coalesce(cardinality(actors),0)<>1
 THEN RAISE EXCEPTION 'EXACTLY_ONE_TEST_ACCOUNT_REQUIRED'; END IF;
 actor:=actors[1];
 IF NOT EXISTS(SELECT 1 FROM auth.users u JOIN public.profiles p ON p.id=u.id
 WHERE u.id=actor AND u.email_confirmed_at IS NOT NULL AND p.account_status='active'
 AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp()))
 THEN RAISE EXCEPTION 'CONFIRMED_ACTIVE_TEST_ACCOUNT_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM mushavo_email_auth.devices d
 JOIN mushavo_email_auth.account_state a ON a.user_id=d.user_id
 WHERE d.user_id=actor AND d.enrollment_method='signup_link' AND d.origin_link_session IS NOT NULL
 AND d.security_version=a.security_version AND d.revoked_at IS NULL AND d.expires_at='infinity'::timestamptz)
 THEN RAISE EXCEPTION 'SAVED_SIGNUP_BROWSER_APPROVAL_REQUIRED'; END IF;
 outcome:=mushavo_email_install.open_acceptance_window(ARRAY[actor],1800);
 IF outcome->>'result' IS DISTINCT FROM 'STAGING_BOUNDED_ACCEPTANCE_WINDOW_OPEN'
 OR outcome->>'allowed_actor_count' IS DISTINCT FROM '1'
 OR outcome->>'maximum_seconds' IS DISTINCT FROM '1800'
 THEN RAISE EXCEPTION 'BOUNDED_SINGLE_ACCOUNT_WINDOW_REQUIRED'; END IF;
 PERFORM set_config('mushavo.browser_window_result',(outcome||jsonb_build_object(
 'saved_signup_browser_approval',true,'application_proof_created_by_this_SQL',false,
 'expires_at',(SELECT expires_at FROM mushavo_email_install.acceptance_window WHERE singleton)))::text,true);
END;
$browser_window$;
SELECT current_setting('mushavo.browser_window_result')::jsonb AS result;
COMMIT;
