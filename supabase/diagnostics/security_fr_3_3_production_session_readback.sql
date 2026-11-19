-- Operator-only readback. Uses existing Auth rows inside the transaction.
-- The output contains aggregate outcomes only.
BEGIN READ ONLY;
DO $verify$
DECLARE
  stored record;
  session_status jsonb;
  expected_role text;
  evaluated integer := 0;
  valid integer := 0;
  staff integer := 0;
  email_code integer := 0;
  expiry bigint := extract(epoch FROM statement_timestamp())::bigint + 300;
BEGIN
  FOR stored IN
    SELECT s.id AS session_id,u.id AS user_id,
      u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND u.is_anonymous IS FALSE
        AND (u.banned_until IS NULL OR u.banned_until<=statement_timestamp())
        AND (s.not_after IS NULL OR s.not_after>statement_timestamp())
        AND coalesce(p.account_status='active',false) AS eligible,
      a.role AS admin_role,
      EXISTS(SELECT 1 FROM auth.mfa_amr_claims method
        WHERE method.session_id=s.id AND method.authentication_method='otp') AS used_email_code
    FROM auth.sessions s
    JOIN auth.users u ON u.id=s.user_id
    LEFT JOIN public.profiles p ON p.id=u.id
    LEFT JOIN public.app_admins a ON a.user_id=u.id
      AND a.role IN ('super_admin','admin_staff','finance_staff','support_staff')
    ORDER BY s.id
  LOOP
    PERFORM set_config('request.jwt.claims',jsonb_build_object(
      'role','authenticated','sub',stored.user_id,'session_id',stored.session_id,'exp',expiry)::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    session_status := public.app_session_status();
    EXECUTE 'RESET ROLE';
    expected_role := CASE WHEN stored.eligible THEN stored.admin_role ELSE NULL END;
    IF session_status IS DISTINCT FROM jsonb_build_object(
      'contract',1,'policy','ACTIVE_SUPABASE_SESSION','session_valid',stored.eligible,
      'admin_authorized',expected_role IS NOT NULL,'role',expected_role)
    THEN RAISE EXCEPTION 'FR33_PRODUCTION_SESSION_READBACK_MISMATCH'; END IF;
    evaluated := evaluated + 1;
    IF stored.eligible THEN valid := valid + 1; END IF;
    IF expected_role IS NOT NULL THEN staff := staff + 1; END IF;
    IF stored.eligible AND stored.used_email_code THEN email_code := email_code + 1; END IF;
  END LOOP;

  PERFORM set_config('request.jwt.claims',jsonb_build_object(
    'role','authenticated','sub','00000000-0000-4000-8000-000000000000',
    'session_id','00000000-0000-4000-8000-000000000000','exp',expiry)::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  session_status := public.app_session_status();
  EXECUTE 'RESET ROLE';
  IF session_status->'session_valid' IS DISTINCT FROM 'false'::jsonb
    OR session_status->'admin_authorized' IS DISTINCT FROM 'false'::jsonb
  THEN RAISE EXCEPTION 'FR33_UNKNOWN_SESSION_ACCEPTED'; END IF;

  PERFORM set_config('mushavo_fr33.session_readback',jsonb_build_object(
    'current_sessions_evaluated',evaluated,'eligible_sessions_recognized',valid,
    'eligible_email_code_sessions',email_code,'authorized_staff_sessions',staff,
    'unknown_session_denied',true)::text,true);
END;
$verify$;

SELECT current_setting('mushavo_fr33.session_readback')::jsonb AS session_readback,
  has_function_privilege('authenticated','public.app_session_status()','execute') AS authenticated_status_access,
  NOT has_function_privilege('anon','public.app_session_status()','execute') AS anonymous_denied,
  NOT has_function_privilege('service_role','public.app_session_status()','execute') AS service_role_status_denied,
  NOT has_schema_privilege('authenticated','mushavo_email_auth','usage') AS private_schema_hidden,
  (SELECT count(*) FROM pg_policy WHERE coalesce(pg_get_expr(polqual,polrelid),'') ~ 'require_application_session|app_session_status'
    OR coalesce(pg_get_expr(polwithcheck,polrelid),'') ~ 'require_application_session|app_session_status') AS live_policies_changed;
ROLLBACK;
