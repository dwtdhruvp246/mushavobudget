-- Install the staged FR.3.3 request tables and functions with no client access.
-- The release that wires the executor and schedule will grant only the supported
-- status, impact, confirmed submission and cancellation entry points.
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

-- Operator-only inventory for an open deletion request. No application RPC is exposed.
CREATE FUNCTION mushavo_account_deletion.review_dependencies(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO pg_catalog
SET row_security TO off
AS $$
DECLARE
  subject uuid;
  reference record;
  matching_rows bigint;
  inspected_references integer := 0;
  unsupported_references integer := 0;
  restrictive_references integer := 0;
  cascading_references integer := 0;
  dependencies jsonb := '[]'::jsonb;
  storage_objects bigint;
  ambiguous_ownership bigint;
  ordinary_uploads bigint;
  personal_subscription_uploads bigint;
  business_uploads bigint;
BEGIN
  SELECT r.subject_id INTO subject
  FROM mushavo_account_deletion.requests r
  JOIN auth.users u ON u.id = r.subject_id
  WHERE r.id = p_request_id AND r.cancelled_at IS NULL;

  IF subject IS NULL THEN
    RETURN jsonb_build_object('status', 'REQUEST_UNAVAILABLE');
  END IF;

  FOR reference IN
    SELECT n.nspname AS schema_name, t.relname AS relation_name, a.attname AS column_name,
      c.conname AS constraint_name, c.confdeltype AS delete_action,
      cardinality(c.conkey) = 1 AND root.attname = 'id'
        AND a.atttypid = 'uuid'::regtype AND t.relkind IN ('r', 'p') AS supported
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.conkey[1]
    LEFT JOIN pg_attribute root ON root.attrelid = c.confrelid AND root.attnum = c.confkey[1]
    WHERE c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND c.conparentid = 0
    ORDER BY n.nspname, t.relname, c.conname
  LOOP
    IF reference.supported IS DISTINCT FROM true THEN
      unsupported_references := unsupported_references + 1;
      CONTINUE;
    END IF;

    inspected_references := inspected_references + 1;
    EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I = $1',
      reference.schema_name, reference.relation_name, reference.column_name)
      INTO matching_rows USING subject;
    IF matching_rows = 0 THEN
      CONTINUE;
    END IF;

    IF reference.delete_action IN ('a', 'r') THEN
      restrictive_references := restrictive_references + 1;
    ELSIF reference.delete_action = 'c' THEN
      cascading_references := cascading_references + 1;
    END IF;

    dependencies := dependencies || jsonb_build_array(jsonb_build_object(
      'schema', reference.schema_name,
      'relation', reference.relation_name,
      'column', reference.column_name,
      'constraint', reference.constraint_name,
      'on_delete', CASE reference.delete_action
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
      END,
      'matching_rows', matching_rows
    ));
  END LOOP;

  -- owner_id is authoritative for current Storage entries. Include legacy owner
  -- matches and identify conflicting metadata for separate review.
  SELECT count(*), count(*) FILTER (
    WHERE o.owner_id IS NOT NULL AND o.owner IS NOT NULL AND o.owner_id <> o.owner::text
  ) INTO storage_objects, ambiguous_ownership
  FROM storage.objects o
  WHERE o.owner_id = subject::text OR o.owner = subject;

  -- Service-created uploads may lack user ownership on the Storage row. Counts
  -- are kept per ledger because a ledger entry may match a Storage object above.
  SELECT count(*) INTO ordinary_uploads
  FROM mushavo_file_ingest.ordinary_uploads u WHERE u.actor_id = subject;
  SELECT count(*) INTO personal_subscription_uploads
  FROM mushavo_file_ingest.subscription_uploads u WHERE u.uploader_id = subject;
  SELECT count(*) INTO business_uploads
  FROM mushavo_file_ingest.business_uploads u WHERE u.uploader_id = subject;

  RETURN jsonb_build_object(
    'status', CASE WHEN unsupported_references > 0 THEN 'INCOMPLETE_DIRECT_INVENTORY' ELSE 'REVIEW_ONLY' END,
    'direct_references_inspected', inspected_references,
    'unsupported_direct_references', unsupported_references,
    'restrictive_references_with_rows', restrictive_references,
    'cascading_references_with_rows', cascading_references,
    'direct_dependencies', dependencies,
    'storage', jsonb_build_object(
      'objects_with_subject_owner', storage_objects,
      'conflicting_owner_metadata', ambiguous_ownership,
      'ordinary_upload_ledger_rows', ordinary_uploads,
      'subscription_upload_ledger_rows', personal_subscription_uploads,
      'business_upload_ledger_rows', business_uploads
    ),
    'separate_review_required', jsonb_build_array(
      'TRANSITIVE_DATABASE_ROWS', 'COPIED_IDENTITY_FIELDS', 'FILE_BYTES_AND_SHARED_OWNERSHIP',
      'PROCESSORS_AND_BACKUPS', 'ADOPTED_RETENTION_AND_WORKSPACE_DECISIONS'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.review_dependencies(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

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

NOTIFY pgrst, 'reload schema';
