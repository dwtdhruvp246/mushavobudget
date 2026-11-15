CREATE SCHEMA mushavo_account_deletion;
REVOKE ALL ON SCHEMA mushavo_account_deletion FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE mushavo_account_deletion.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  cancelled_at timestamptz,
  CONSTRAINT deletion_cancel_after_request CHECK (cancelled_at >= created_at)
);
CREATE UNIQUE INDEX account_deletion_one_open_request
  ON mushavo_account_deletion.requests (subject_id) WHERE cancelled_at IS NULL;
ALTER TABLE mushavo_account_deletion.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE mushavo_account_deletion.requests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE mushavo_account_deletion.requests FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION mushavo_account_deletion.response(p_subject uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog
AS $$
  SELECT jsonb_build_object(
    'request_id', request.id,
    'requested_at', request.created_at,
    'status', CASE
      WHEN request.id IS NULL THEN 'none'
      WHEN EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = p_subject)
        THEN 'staff_review'
      WHEN EXISTS (
        SELECT 1 FROM public.budget_workspaces w
        WHERE w.owner_id = p_subject AND w.workspace_type IS DISTINCT FROM 'personal'
      ) OR EXISTS (
        SELECT 1 FROM public.family_heads h WHERE h.user_id = p_subject
      ) THEN 'ownership_review'
      WHEN EXISTS (
        SELECT 1
        FROM public.workspace_members m
        JOIN public.budget_workspaces w ON w.id = m.workspace_id
        WHERE m.user_id = p_subject AND (
          w.workspace_type IS DISTINCT FROM 'personal' OR w.owner_id <> p_subject
        )
      ) OR EXISTS (
        SELECT 1 FROM public.family_members m WHERE m.user_id = p_subject
      ) THEN 'shared_records_review'
      ELSE 'retention_review'
    END
  )
  FROM (VALUES (p_subject)) AS subject(id)
  LEFT JOIN mushavo_account_deletion.requests request
    ON request.subject_id = subject.id AND request.cancelled_at IS NULL;
$$;
REVOKE ALL ON FUNCTION mushavo_account_deletion.response(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.fr33_account_deletion_status()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog
AS $$
DECLARE
  subject uuid := auth.uid();
BEGIN
  IF subject IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'ACCOUNT_DELETION_SIGN_IN_REQUIRED';
  END IF;
  PERFORM mushavo_email_auth.require_application_session();
  RETURN mushavo_account_deletion.response(subject);
END;
$$;

CREATE FUNCTION public.fr33_request_account_deletion()
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog
AS $$
DECLARE
  subject uuid := auth.uid();
  current_session uuid := nullif(auth.jwt()->>'session_id', '')::uuid;
  verification_cutoff timestamptz := statement_timestamp() - interval '10 minutes';
BEGIN
  IF subject IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'ACCOUNT_DELETION_SIGN_IN_REQUIRED';
  END IF;
  PERFORM mushavo_email_auth.require_application_session();

  -- Use the Auth session and password event. Token refresh does not renew either.
  IF NOT EXISTS (
    SELECT 1 FROM auth.sessions s
    JOIN auth.mfa_amr_claims a ON a.session_id = s.id
    WHERE s.id = current_session AND s.user_id = subject
      AND s.created_at BETWEEN verification_cutoff AND statement_timestamp()
      AND a.authentication_method = 'password'
      AND a.created_at BETWEEN verification_cutoff AND statement_timestamp()
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'ACCOUNT_DELETION_FRESH_PASSWORD_REQUIRED';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('fr33-account-deletion:' || subject::text, 0));
  INSERT INTO mushavo_account_deletion.requests (subject_id)
    VALUES (subject)
    ON CONFLICT (subject_id) WHERE cancelled_at IS NULL DO NOTHING;
  RETURN mushavo_account_deletion.response(subject);
END;
$$;

CREATE FUNCTION public.fr33_cancel_account_deletion()
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog
AS $$
DECLARE
  subject uuid := auth.uid();
BEGIN
  IF subject IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'ACCOUNT_DELETION_SIGN_IN_REQUIRED';
  END IF;
  PERFORM mushavo_email_auth.require_application_session();

  PERFORM pg_advisory_xact_lock(hashtextextended('fr33-account-deletion:' || subject::text, 0));
  UPDATE mushavo_account_deletion.requests
    SET cancelled_at = greatest(statement_timestamp(), created_at)
    WHERE subject_id = subject AND cancelled_at IS NULL;
  RETURN mushavo_account_deletion.response(subject);
END;
$$;

REVOKE ALL ON FUNCTION public.fr33_account_deletion_status(),
  public.fr33_request_account_deletion(), public.fr33_cancel_account_deletion()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fr33_account_deletion_status(),
  public.fr33_request_account_deletion(), public.fr33_cancel_account_deletion()
  TO authenticated;
