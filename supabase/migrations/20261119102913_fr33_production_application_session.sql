-- Production session status for FR.3.3. This is additive and does not install
-- a pre-request hook, replace an existing caller, or change Auth settings.
-- Password freshness for account deletion is checked by its own request RPC.
CREATE SCHEMA mushavo_email_auth;
REVOKE ALL ON SCHEMA mushavo_email_auth FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION mushavo_email_auth.session_valid(p_user uuid, p_session uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users account
    JOIN auth.sessions session ON session.user_id=account.id
    JOIN public.profiles profile ON profile.id=account.id
    WHERE account.id=p_user AND session.id=p_session
      AND account.email_confirmed_at IS NOT NULL
      AND account.deleted_at IS NULL
      AND account.is_anonymous IS FALSE
      AND (account.banned_until IS NULL OR account.banned_until<=statement_timestamp())
      AND (session.not_after IS NULL OR session.not_after>statement_timestamp())
      AND profile.account_status='active'
  );
$$;

CREATE FUNCTION mushavo_email_auth.current_session_verified()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  claims jsonb;
  actor uuid;
  auth_actor uuid;
  session_ref uuid;
BEGIN
  BEGIN
    claims:=auth.jwt();
    IF current_setting('role',true) IS DISTINCT FROM 'authenticated'
      OR jsonb_typeof(claims) IS DISTINCT FROM 'object'
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
$function$;

CREATE FUNCTION mushavo_email_auth.require_application_session()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE active_role text:=current_setting('role',true);
BEGIN
  -- The actual SET ROLE context survives nested SECURITY DEFINER calls.
  -- A JWT claim alone never grants the service/internal bypass.
  IF active_role='authenticated' OR auth.role()='authenticated' THEN
    IF active_role='anon' THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='EMAIL_VERIFICATION_REQUIRED';
    END IF;
    IF NOT mushavo_email_auth.current_session_verified() THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='EMAIL_VERIFICATION_REQUIRED';
    END IF;
    RETURN;
  END IF;
  IF active_role='service_role' AND auth.role()='service_role' THEN RETURN; END IF;
  -- Preserve existing Auth middleware trigger callbacks, not app Admin logins.
  IF coalesce(active_role,'none')='none' AND session_user='supabase_auth_admin'
    AND pg_trigger_depth()>0 THEN RETURN; END IF;
  IF coalesce(active_role,'none')='none' AND EXISTS(
    SELECT 1 FROM pg_roles WHERE rolname=session_user
      AND rolname<>'authenticator' AND (rolsuper OR rolbypassrls)
  ) THEN RETURN; END IF;
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='EMAIL_VERIFICATION_REQUIRED';
END;
$function$;

CREATE FUNCTION public.app_session_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE valid boolean; assigned_role text;
BEGIN
 valid:=mushavo_email_auth.current_session_verified();
 IF valid THEN
  SELECT a.role INTO assigned_role FROM public.app_admins a
  JOIN public.profiles p ON p.id=a.user_id
  WHERE a.user_id=auth.uid() AND p.account_status='active'
  AND a.role IN ('super_admin','admin_staff','finance_staff','support_staff');
 END IF;
 RETURN jsonb_build_object('contract',1,'policy','ACTIVE_SUPABASE_SESSION',
 'session_valid',valid,'admin_authorized',valid AND assigned_role IS NOT NULL,'role',assigned_role);
END;
$function$;

REVOKE ALL ON FUNCTION mushavo_email_auth.session_valid(uuid,uuid),
  mushavo_email_auth.current_session_verified(),
  mushavo_email_auth.require_application_session(),public.app_session_status()
FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.app_session_status() TO authenticated;
NOTIFY pgrst, 'reload schema';
