-- Operator read-only report for one confirmed account-deletion request.
-- Counts are scoped to the server-derived owner. This report does not authorize erasure.
CREATE OR REPLACE FUNCTION mushavo_account_deletion.review_owned_workspace_dependencies(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $function$
DECLARE
  subject uuid;
  confirmed_token text;
  confirmed_at timestamptz;
  impact jsonb;
  workspace_ids uuid[];
  family_ids uuid[];
  root_ids uuid[];
  reference record;
  matching_rows bigint;
  inspected_references integer := 0;
  unsupported_references integer := 0;
  dependencies jsonb := '[]'::jsonb;
  shared_family_payments bigint;
  shared_family_proofs bigint;
BEGIN
  SELECT r.subject_id, r.workspace_impact_token, r.workspace_impact_confirmed_at
  INTO subject, confirmed_token, confirmed_at
  FROM mushavo_account_deletion.requests r
  JOIN auth.users u ON u.id = r.subject_id
  WHERE r.id = p_request_id AND r.cancelled_at IS NULL;

  IF subject IS NULL THEN
    RETURN jsonb_build_object('status', 'REQUEST_UNAVAILABLE');
  END IF;
  IF confirmed_token IS NULL OR confirmed_at IS NULL THEN
    RETURN jsonb_build_object('status', 'WORKSPACE_IMPACT_NOT_CONFIRMED');
  END IF;

  impact := mushavo_account_deletion.owned_workspace_impact(subject);
  IF impact->>'impact_token' IS DISTINCT FROM confirmed_token THEN
    RETURN jsonb_build_object('status', 'WORKSPACE_IMPACT_CHANGED');
  END IF;

  SELECT coalesce(array_agg(w.id ORDER BY w.id), ARRAY[]::uuid[]) INTO workspace_ids
  FROM public.budget_workspaces w
  WHERE w.owner_id = subject AND w.workspace_type IN ('personal', 'household', 'family', 'business');
  SELECT coalesce(array_agg(f.id ORDER BY f.id), ARRAY[]::uuid[]) INTO family_ids
  FROM public.families f WHERE f.owner_id = subject;

  -- A linked row with a different owner is outside the confirmed owner scope.
  IF EXISTS (
    SELECT 1 FROM public.budget_workspaces w
    WHERE (w.owner_id = subject AND w.workspace_type NOT IN ('personal', 'household', 'family', 'business'))
       OR (w.legacy_family_id = ANY(family_ids) AND w.owner_id IS DISTINCT FROM subject)
       OR (w.id = ANY(workspace_ids) AND w.legacy_family_id IS NOT NULL AND NOT (w.legacy_family_id = ANY(family_ids)))
  ) THEN
    RETURN jsonb_build_object('status', 'WORKSPACE_SCOPE_REVIEW_REQUIRED');
  END IF;

  FOR reference IN
    SELECT n.nspname AS schema_name, child.relname AS relation_name, a.attname AS column_name,
      c.conname AS constraint_name, c.confdeltype AS delete_action, c.confrelid AS root_relation,
      cardinality(c.conkey) = 1 AND cardinality(c.confkey) = 1 AND root.attname = 'id'
        AND a.atttypid = 'uuid'::regtype AND child.relkind IN ('r', 'p') AS supported
    FROM pg_constraint c
    JOIN pg_class child ON child.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = child.relnamespace
    LEFT JOIN pg_attribute a ON a.attrelid = child.oid AND a.attnum = c.conkey[1]
    LEFT JOIN pg_attribute root ON root.attrelid = c.confrelid AND root.attnum = c.confkey[1]
    WHERE c.contype = 'f' AND c.conparentid = 0
      AND c.confrelid IN ('public.budget_workspaces'::regclass, 'public.families'::regclass)
    ORDER BY c.confrelid, n.nspname, child.relname, c.conname
  LOOP
    root_ids := CASE WHEN reference.root_relation = 'public.families'::regclass THEN family_ids ELSE workspace_ids END;
    IF cardinality(root_ids) = 0 THEN
      CONTINUE;
    END IF;
    IF reference.supported IS DISTINCT FROM true THEN
      unsupported_references := unsupported_references + 1;
      CONTINUE;
    END IF;

    inspected_references := inspected_references + 1;
    EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I = ANY($1)',
      reference.schema_name, reference.relation_name, reference.column_name)
      INTO matching_rows USING root_ids;

    IF matching_rows > 0 THEN
      dependencies := dependencies || jsonb_build_array(jsonb_build_object(
        'schema', reference.schema_name,
        'relation', reference.relation_name,
        'column', reference.column_name,
        'constraint', reference.constraint_name,
        'root', CASE WHEN reference.root_relation = 'public.families'::regclass THEN 'families' ELSE 'budget_workspaces' END,
        'on_delete', CASE reference.delete_action
          WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE'
          WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END,
        'matching_rows', matching_rows
      ));
    END IF;
  END LOOP;

  -- Account deletion can affect a payment through its recorder, its payment
  -- item or the linked payer. Count each payment once in the surviving Family.
  SELECT count(*), count(*) FILTER (WHERE p.proof_path IS NOT NULL)
  INTO shared_family_payments, shared_family_proofs
  FROM public.payment_records p
  JOIN public.families f ON f.id = p.family_id
  JOIN public.payment_items i ON i.id = p.payment_item_id
  LEFT JOIN public.family_members payer ON payer.id = p.paid_by_member_id
  WHERE f.owner_id IS DISTINCT FROM subject
    AND (p.owner_id = subject OR p.recorded_by = subject OR i.owner_id = subject
      OR i.created_by = subject OR payer.user_id = subject OR payer.created_by = subject);

  RETURN jsonb_build_object(
    'status', CASE WHEN unsupported_references > 0 THEN 'INCOMPLETE_DIRECT_INVENTORY' ELSE 'REVIEW_ONLY' END,
    'owned_workspaces', cardinality(workspace_ids),
    'owned_legacy_families', cardinality(family_ids),
    'direct_references_inspected', inspected_references,
    'unsupported_direct_references', unsupported_references,
    'direct_dependencies', dependencies,
    'memberships_in_other_workspaces', (
      SELECT count(*) FROM public.workspace_members m
      JOIN public.budget_workspaces w ON w.id = m.workspace_id
      WHERE m.user_id = subject AND w.owner_id IS DISTINCT FROM subject
    ),
    'payments_in_other_workspaces', jsonb_build_object(
      'family_payments', shared_family_payments,
      'family_payments_with_linked_proof', shared_family_proofs,
      'business_bill_payments', (
        SELECT count(*) FROM public.business_bill_payments p
        JOIN public.budget_workspaces w ON w.id = p.workspace_id
        WHERE w.workspace_type = 'business' AND w.owner_id IS DISTINCT FROM subject
          AND p.recorded_by = subject
      ),
      'business_income_receipts', (
        SELECT count(*) FROM public.business_income_receipts r
        JOIN public.budget_workspaces w ON w.id = r.workspace_id
        WHERE w.workspace_type = 'business' AND w.owner_id IS DISTINCT FROM subject
          AND (r.recorded_by = subject OR r.voided_by = subject)
      ),
      'business_paid_claims', (
        SELECT count(*) FROM public.business_expense_claims c
        JOIN public.budget_workspaces w ON w.id = c.workspace_id
        WHERE w.workspace_type = 'business' AND w.owner_id IS DISTINCT FROM subject
          AND c.status = 'paid' AND (c.submitted_by = subject OR c.paid_by = subject OR c.reviewed_by = subject)
      )
    ),
    'file_ledger_rows', jsonb_build_object(
      'ordinary', (SELECT count(*) FROM mushavo_file_ingest.ordinary_uploads u WHERE u.workspace_id = ANY(workspace_ids)),
      'subscription', (SELECT count(*) FROM mushavo_file_ingest.subscription_uploads u WHERE u.workspace_id = ANY(workspace_ids)),
      'business', (SELECT count(*) FROM mushavo_file_ingest.business_uploads u WHERE u.workspace_id = ANY(workspace_ids))
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.review_owned_workspace_dependencies(uuid)
FROM PUBLIC, anon, authenticated, service_role;
