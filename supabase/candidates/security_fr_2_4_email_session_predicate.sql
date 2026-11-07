-- FR.2.4.E4.2 OFFLINE SOURCE CANDIDATE ONLY; not a hosted installation.
-- Apply after the E2 backend in an isolated review database.
-- Does not attach policies or alter existing application entry points.
BEGIN;
SET LOCAL statement_timeout='20s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
DO $guard$
BEGIN
  IF current_setting('mushavo.email_session_review',true)
      IS DISTINCT FROM 'OFFLINE_SOURCE_CANDIDATE' THEN
    RAISE EXCEPTION 'EMAIL_SESSION_OFFLINE_REVIEW_ACK_REQUIRED';
  END IF;
  IF current_user<>'postgres' OR NOT EXISTS(
    SELECT 1 FROM pg_roles
    WHERE rolname=current_user AND (rolsuper OR rolbypassrls)
  ) THEN RAISE EXCEPTION 'EMAIL_SESSION_PRIVILEGED_REVIEW_REQUIRED'; END IF;
  IF to_regprocedure('mushavo_email_auth.session_valid(uuid,uuid)') IS NULL
    OR to_regclass('mushavo_email_auth.session_proofs') IS NULL THEN
    RAISE EXCEPTION 'EMAIL_SESSION_BACKEND_REQUIRED';
  END IF;
  IF EXISTS(
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE (n.nspname='mushavo_email_auth' AND p.proname='current_session_verified')
      OR (n.nspname='public' AND p.proname IN (
        'email_gate_current_session_verified','email_gate_require_current_session'
      ))
  ) THEN RAISE EXCEPTION 'EMAIL_SESSION_ENTRYPOINT_ALREADY_EXISTS'; END IF;
END;
$guard$;

-- PostgREST must authenticate the JWT before setting request claims. Reading
-- these claims in SQL is not independent signature validation. There are no
-- caller-supplied actor/session parameters and no trust in client proof flags.
CREATE FUNCTION mushavo_email_auth.current_session_verified() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE
  claims jsonb;
  actor uuid;
  auth_actor uuid;
  session_ref uuid;
BEGIN
  BEGIN
    claims:=auth.jwt();
    IF jsonb_typeof(claims) IS DISTINCT FROM 'object'
      OR jsonb_typeof(claims->'sub') IS DISTINCT FROM 'string'
      OR jsonb_typeof(claims->'session_id') IS DISTINCT FROM 'string'
      OR claims->>'role' IS DISTINCT FROM 'authenticated'
      OR auth.role() IS DISTINCT FROM 'authenticated'
      OR jsonb_typeof(claims->'exp') IS DISTINCT FROM 'number'
      OR (claims->>'exp') !~ '^[0-9]{1,12}$'
      OR (claims->>'sub') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR (claims->>'session_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN RETURN false; END IF;
    IF (claims->>'exp')::numeric<=extract(epoch FROM statement_timestamp())
    THEN RETURN false; END IF;
    actor:=(claims->>'sub')::uuid;
    session_ref:=(claims->>'session_id')::uuid;
    auth_actor:=auth.uid();
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN false;
  END;
  IF auth_actor IS DISTINCT FROM actor THEN RETURN false; END IF;
  RETURN mushavo_email_auth.session_valid(actor,session_ref);
END;
$body$;
REVOKE ALL ON FUNCTION mushavo_email_auth.current_session_verified()
  FROM PUBLIC,anon,authenticated,service_role;

-- No-argument wrappers expose only the caller's boolean or a fixed denial.
-- SECURITY DEFINER lets them use the private predicate without schema access.
CREATE FUNCTION public.email_gate_current_session_verified() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
  SELECT mushavo_email_auth.current_session_verified();
$body$;
CREATE FUNCTION public.email_gate_require_current_session() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
BEGIN
  IF NOT mushavo_email_auth.current_session_verified() THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='EMAIL_VERIFICATION_REQUIRED';
  END IF;
END;
$body$;
REVOKE ALL ON FUNCTION public.email_gate_current_session_verified()
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.email_gate_require_current_session()
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.email_gate_current_session_verified()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.email_gate_require_current_session()
  TO authenticated;
COMMIT;
