-- FR.2.4.E4.5 offline contract candidate; not a hosted installer.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
DO $guard$
BEGIN
  IF current_setting('mushavo.email_admin_review',true) IS DISTINCT FROM 'OFFLINE_SOURCE_CANDIDATE'
    THEN RAISE EXCEPTION 'EMAIL_ADMIN_OFFLINE_REVIEW_ACK_REQUIRED'; END IF;
  IF current_user<>'postgres' OR current_setting('session_replication_role')<>'origin'
    THEN RAISE EXCEPTION 'EMAIL_ADMIN_POSTGRES_ORIGIN_REQUIRED'; END IF;
  IF to_regprocedure('mushavo_email_auth.require_application_session()') IS NULL
    OR to_regprocedure('public.email_gate_current_session_verified()') IS NULL
    THEN RAISE EXCEPTION 'EMAIL_ADMIN_DATABASE_GUARDS_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='email_gate_admin_status')
    THEN RAISE EXCEPTION 'EMAIL_ADMIN_STATUS_ALREADY_PRESENT'; END IF;
END;
$guard$;
CREATE FUNCTION public.email_gate_admin_status() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE
  assigned_role text;
BEGIN
  -- No account/role information is read or returned before real session proof.
  IF NOT mushavo_email_auth.current_session_verified() THEN
    RETURN jsonb_build_object('contract',1,'verified',false,'authorized',false,'role',NULL);
  END IF;
  SELECT a.role INTO assigned_role
  FROM public.app_admins a JOIN public.profiles p ON p.id=a.user_id
  WHERE a.user_id=auth.uid() AND p.account_status='active'
    AND a.role IN ('super_admin','admin_staff','finance_staff','support_staff');
  RETURN jsonb_build_object('contract',1,'verified',true,
    'authorized',assigned_role IS NOT NULL,'role',assigned_role);
END;
$body$;
REVOKE ALL ON FUNCTION public.email_gate_admin_status() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.email_gate_admin_status() TO authenticated;
COMMIT;
