ALTER TABLE mushavo_account_deletion.requests
  ADD COLUMN workspace_impact_token text,
  ADD COLUMN workspace_impact_confirmed_at timestamptz,
  ADD CONSTRAINT workspace_impact_confirmation_complete CHECK (
    (workspace_impact_token IS NULL AND workspace_impact_confirmed_at IS NULL)
    OR (workspace_impact_token IS NOT NULL AND workspace_impact_token ~ '^[0-9a-f]{64}$'
      AND workspace_impact_confirmed_at IS NOT NULL)
  );

CREATE FUNCTION mushavo_account_deletion.owned_workspace_impact(p_subject uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path TO pg_catalog
AS $$
DECLARE
  owned jsonb;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.budget_workspaces w JOIN public.families f ON f.id = w.legacy_family_id
    WHERE w.workspace_type IN ('household', 'family')
      AND (w.owner_id = p_subject OR f.owner_id = p_subject)
      AND w.owner_id IS DISTINCT FROM f.owner_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'ACCOUNT_DELETION_OWNERSHIP_REVIEW_REQUIRED';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'kind', item.kind, 'id', item.id, 'legacy_family_id', item.legacy_family_id,
    'name', item.name, 'status', item.status
  ) ORDER BY item.kind, item.id), '[]'::jsonb) INTO owned
  FROM (
    SELECT CASE WHEN w.workspace_type = 'business' THEN 'business' ELSE 'family' END AS kind,
      w.id, w.legacy_family_id,
      coalesce(nullif(btrim(w.name), ''), CASE WHEN w.workspace_type = 'business'
        THEN 'Business workspace' ELSE 'Family workspace' END) AS name, w.status
    FROM public.budget_workspaces w
    WHERE w.owner_id = p_subject AND w.workspace_type IN ('household', 'family', 'business')
    UNION ALL
    SELECT 'family', f.id, f.id, coalesce(nullif(btrim(f.name), ''), 'Family workspace'), 'active'
    FROM public.families f
    WHERE f.owner_id = p_subject AND NOT EXISTS (
      SELECT 1 FROM public.budget_workspaces w
      WHERE w.legacy_family_id = f.id AND w.workspace_type IN ('household', 'family')
    )
  ) item;
  RETURN jsonb_build_object(
    'workspaces', owned,
    'impact_token', encode(sha256(convert_to(
      jsonb_build_array('owned-workspace-deletion-v1', p_subject, owned)::text, 'UTF8'
    )), 'hex')
  );
END;
$$;

CREATE FUNCTION public.fr33_account_deletion_impact()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog
AS $$
DECLARE
  subject uuid := auth.uid();
  impact jsonb;
BEGIN
  IF subject IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'ACCOUNT_DELETION_SIGN_IN_REQUIRED';
  END IF;
  PERFORM mushavo_email_auth.require_application_session();
  impact := mushavo_account_deletion.owned_workspace_impact(subject);
  RETURN jsonb_build_object(
    'impact_token', impact->>'impact_token',
    'workspaces', coalesce((
      SELECT jsonb_agg((item - 'id') - 'legacy_family_id' ORDER BY position)
      FROM jsonb_array_elements(impact->'workspaces') WITH ORDINALITY AS entries(item, position)
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.fr33_submit_account_deletion(p_impact_token text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog
AS $$
DECLARE
  subject uuid := auth.uid();
  request jsonb;
BEGIN
  IF subject IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'ACCOUNT_DELETION_SIGN_IN_REQUIRED';
  END IF;
  PERFORM mushavo_email_auth.require_application_session();

  IF p_impact_token IS NULL OR p_impact_token !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ACCOUNT_DELETION_IMPACT_CONFIRMATION_REQUIRED';
  END IF;

  -- Reuse fresh password verification, same-subject locking and request creation.
  -- If the inventory changed, the exception rolls back any new request.
  request := public.fr33_request_account_deletion();
  UPDATE mushavo_account_deletion.requests r
    SET workspace_impact_confirmed_at = CASE WHEN r.workspace_impact_token = p_impact_token
          THEN r.workspace_impact_confirmed_at ELSE statement_timestamp() END,
        workspace_impact_token = p_impact_token
    WHERE r.id = (request->>'request_id')::uuid AND r.subject_id = subject AND r.cancelled_at IS NULL
      AND mushavo_account_deletion.owned_workspace_impact(subject)->>'impact_token' = p_impact_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'ACCOUNT_DELETION_IMPACT_CHANGED';
  END IF;

  RETURN request;
END;
$$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.owned_workspace_impact(uuid),
  public.fr33_account_deletion_impact(), public.fr33_submit_account_deletion(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fr33_account_deletion_impact(), public.fr33_submit_account_deletion(text)
  TO authenticated;
