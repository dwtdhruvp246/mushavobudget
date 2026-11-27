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
