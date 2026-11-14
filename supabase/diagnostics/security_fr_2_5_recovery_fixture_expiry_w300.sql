BEGIN;
DO $fixture$
DECLARE v_id uuid; v_count integer;
BEGIN
 SELECT id INTO STRICT v_id FROM auth.users WHERE email='stilldhruvp246+w300-mw3dwzsv-m9siryb@gmail.com'
   AND raw_user_meta_data->>'mushavo_recovery_fixture'='w300-mw3dwzsv-m9siry'
   AND created_at>now()-interval '1 day' AND email_confirmed_at IS NOT NULL
   AND recovery_sent_at>now()-interval '15 minutes';
 IF EXISTS(SELECT 1 FROM public.app_admins WHERE user_id=v_id) THEN RAISE EXCEPTION 'RECOVERY_FIXTURE_ROLE_REFUSED'; END IF;
 UPDATE auth.users SET recovery_sent_at=now()-interval '2 hours' WHERE id=v_id;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>1 THEN RAISE EXCEPTION 'RECOVERY_FIXTURE_EXACT_USER_REQUIRED'; END IF;
 UPDATE auth.one_time_tokens SET expires_at=now()-interval '1 hour'
 WHERE user_id=v_id AND token_type='recovery_token';
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>1 THEN RAISE EXCEPTION 'RECOVERY_FIXTURE_EXACT_RECOVERY_TOKEN_REQUIRED'; END IF;
END;
$fixture$;
SELECT jsonb_build_object('result','EXACT_NEW_RECOVERY_FIXTURE_BACKDATED','fixture_only',true,
 'global_Auth_policy_changed',false,'natural_hour_long_expiry_observed',false,
 'token_values_returned',false) AS safe_result;
COMMIT;
