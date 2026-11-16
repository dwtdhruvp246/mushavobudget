ALTER TABLE mushavo_account_deletion.retained_bill_proofs ADD COLUMN detach_transaction xid8;

-- The download broker resolves the Business workspace from the path and document.
-- Clearing only the uploader on an ownerless object leaves that access path intact.
CREATE FUNCTION mushavo_account_deletion.matches_managed_bill_proof_detachment(p_before jsonb, p_after jsonb)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO pg_catalog SET row_security TO 'off'
AS $match$
  SELECT p_before->>'uploaded_by' IS NOT NULL AND p_after->>'uploaded_by' IS NULL
    AND p_before - 'uploaded_by' = p_after - 'uploaded_by'
    AND p_before->>'parent_type' = 'business_bill_payment'
    AND EXISTS (
      SELECT 1 FROM mushavo_account_deletion.retained_bill_proofs retained
      JOIN storage.objects object ON object.id = retained.storage_object_id
      WHERE retained.document_id = (p_before->>'id')::uuid
        AND retained.detach_transaction = pg_current_xact_id_if_assigned()
        AND object.bucket_id = 'business-documents' AND object.name = p_before->>'storage_path'
        AND object.owner_id IS NULL AND object.owner IS NULL
    );
$match$;

DO $restrict_detachment$
DECLARE
  binder text := replace(pg_get_functiondef('mushavo_file_ingest.bind_ordinary_upload()'::regprocedure), E'\r\n', E'\n');
  detach text := replace(pg_get_functiondef('mushavo_account_deletion.detach_retained_business_bill_recorders(uuid)'::regprocedure), E'\r\n', E'\n');
  binder_anchor text := E'  case tg_table_name\n';
  managed_block text := E'      -- Paths that still depend on an uploader for authorization need a separate migration.\n      IF public.fr32_is_managed_ordinary_upload(''business-documents'', proof.storage_path) THEN\n        RAISE EXCEPTION ''FR33_BILL_PROOF_INGESTION_HANDOFF_REQUIRED'';\n      END IF;\n';
  marker_values text := E'INSERT INTO mushavo_account_deletion.retained_bill_proofs (document_id, storage_object_id)\n      SELECT proof.id, object.id FROM storage.objects object';
  marker_upsert text := 'ON CONFLICT (document_id) DO UPDATE SET storage_object_id = EXCLUDED.storage_object_id;';
  return_anchor text := '  RETURN jsonb_build_object(''business_bill_payments_detached''';
BEGIN
  IF (length(binder) - length(replace(binder,binder_anchor,''))) <> length(binder_anchor)
    OR strpos(detach,managed_block) = 0 OR strpos(detach,marker_values) = 0
    OR strpos(detach,marker_upsert) = 0 OR strpos(detach,return_anchor) = 0 THEN
    RAISE EXCEPTION 'FR33_EXPECTED_BUSINESS_PROOF_GUARDS';
  END IF;
  EXECUTE replace(binder,binder_anchor,
    E'  if tg_op = ''UPDATE'' and tg_relid = ''public.business_documents''::regclass\n    and mushavo_account_deletion.matches_managed_bill_proof_detachment(old_row,j) then\n    return new;\n  end if;\n' || binder_anchor);
  detach := replace(detach,managed_block,'');
  detach := replace(detach,marker_values,
    E'INSERT INTO mushavo_account_deletion.retained_bill_proofs (document_id, storage_object_id, detach_transaction)\n      SELECT proof.id, object.id, pg_current_xact_id() FROM storage.objects object');
  detach := replace(detach,marker_upsert,
    'ON CONFLICT (document_id) DO UPDATE SET storage_object_id = EXCLUDED.storage_object_id, detach_transaction = EXCLUDED.detach_transaction;');
  EXECUTE replace(detach,return_anchor,
    E'  UPDATE mushavo_account_deletion.retained_bill_proofs SET detach_transaction = NULL\n    WHERE detach_transaction = pg_current_xact_id_if_assigned();\n\n' || return_anchor);
END;
$restrict_detachment$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.matches_managed_bill_proof_detachment(jsonb,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
