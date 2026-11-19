-- A verified shared file can outlive its original upload actor. The cleanup
-- worker still finds it by bucket and path when its last reference is retired.
ALTER TABLE mushavo_file_ingest.ordinary_uploads ALTER COLUMN actor_id DROP NOT NULL;

CREATE TABLE mushavo_account_deletion.retained_paid_claim_proofs (
  document_id uuid PRIMARY KEY REFERENCES public.business_documents(id) ON DELETE CASCADE,
  storage_object_id uuid NOT NULL,
  detach_transaction xid8 NOT NULL
);
ALTER TABLE mushavo_account_deletion.retained_paid_claim_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.retained_paid_claim_proofs FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION mushavo_account_deletion.matches_retained_paid_claim_proof(p_before jsonb, p_after jsonb)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO pg_catalog SET row_security TO 'off'
AS $match$
  SELECT p_before->>'parent_type' = 'expense_claim'
    AND p_before->>'uploaded_by' IS NOT NULL AND p_after->>'uploaded_by' IS NULL
    AND p_before - 'uploaded_by' = p_after - 'uploaded_by'
    AND EXISTS (
      SELECT 1 FROM mushavo_account_deletion.retained_paid_claim_proofs retained
      JOIN storage.objects object ON object.id = retained.storage_object_id
      WHERE retained.document_id = (p_before->>'id')::uuid
        AND retained.detach_transaction = pg_current_xact_id_if_assigned()
        AND object.bucket_id = 'business-documents' AND object.name = p_before->>'storage_path'
        AND object.owner_id IS NULL AND object.owner IS NULL
    );
$match$;

DO $proof_guards$
DECLARE
  binder text := replace(pg_get_functiondef('mushavo_file_ingest.bind_ordinary_upload()'::regprocedure), E'\r\n', E'\n');
  required_uploader text := replace(pg_get_functiondef('mushavo_account_deletion.require_bill_proof_uploader()'::regprocedure), E'\r\n', E'\n');
  binder_anchor text := E'    and mushavo_account_deletion.matches_managed_bill_proof_detachment(old_row,j) then';
  uploader_anchor text := E'\nBEGIN\n  IF NEW.uploaded_by IS NULL';
BEGIN
  IF (length(binder) - length(replace(binder,binder_anchor,''))) <> length(binder_anchor)
    OR (length(required_uploader) - length(replace(required_uploader,uploader_anchor,''))) <> length(uploader_anchor)
  THEN RAISE EXCEPTION 'FR33_EXPECTED_PROOF_UPLOAD_GUARDS'; END IF;
  EXECUTE replace(binder,binder_anchor,
    E'    and (mushavo_account_deletion.matches_managed_bill_proof_detachment(old_row,j)\n'
    || E'      or mushavo_account_deletion.matches_retained_paid_claim_proof(old_row,j)) then');
  EXECUTE replace(required_uploader,uploader_anchor,
    E'\nBEGIN\n  IF TG_OP = ''UPDATE'' AND OLD.parent_type = ''expense_claim'' AND NEW.uploaded_by IS NULL\n'
    || E'    AND mushavo_account_deletion.matches_retained_paid_claim_proof(to_jsonb(OLD),to_jsonb(NEW)) THEN RETURN NEW; END IF;\n'
    || E'  IF NEW.uploaded_by IS NULL');
END;
$proof_guards$;

CREATE FUNCTION mushavo_account_deletion.prepare_shared_proof_retention(p_request_id uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SET search_path TO pg_catalog SET row_security TO 'off'
AS $prepare$
DECLARE
  subject uuid;
  confirmation text;
  upload mushavo_file_ingest.ordinary_uploads%ROWTYPE;
  file_id uuid;
  document record;
  txn xid8 := pg_current_xact_id();
BEGIN
  SELECT subject_id INTO subject FROM mushavo_account_deletion.requests
  WHERE id = p_request_id AND cancelled_at IS NULL AND workspace_impact_confirmed_at IS NOT NULL;
  IF subject IS NULL THEN RAISE EXCEPTION 'FR33_CONFIRMED_REQUEST_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('fr33-account-deletion:' || subject::text, 0));
  SELECT workspace_impact_token INTO confirmation FROM mushavo_account_deletion.requests
  WHERE id = p_request_id AND subject_id = subject AND cancelled_at IS NULL
    AND workspace_impact_confirmed_at IS NOT NULL FOR UPDATE;
  IF confirmation IS NULL OR confirmation IS DISTINCT FROM
    mushavo_account_deletion.owned_workspace_impact(subject)->>'impact_token'
  THEN RAISE EXCEPTION 'FR33_WORKSPACE_IMPACT_CHANGED'; END IF;

  FOR upload IN
    SELECT item.* FROM mushavo_file_ingest.ordinary_uploads item
    LEFT JOIN public.budget_workspaces workspace ON workspace.id = item.workspace_id
    WHERE item.actor_id = subject OR workspace.owner_id = subject
    ORDER BY item.bucket_id,item.path FOR UPDATE OF item
  LOOP
    IF upload.state = 'removed' AND upload.token IS NULL AND upload.lease_until IS NULL
      AND NOT mushavo_file_ingest.ordinary_upload_has_reference(upload.bucket_id,upload.path)
      AND NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = upload.bucket_id AND name = upload.path)
    THEN
      DELETE FROM mushavo_file_ingest.ordinary_uploads WHERE bucket_id = upload.bucket_id AND path = upload.path;
      CONTINUE;
    END IF;

    IF upload.state <> 'linked' OR upload.token IS NOT NULL OR upload.lease_until IS NOT NULL
      OR upload.actor_id IS DISTINCT FROM subject THEN CONTINUE; END IF;
    IF upload.bucket_id = 'payment-proofs' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.payment_records payment JOIN public.budget_workspaces workspace ON workspace.id = payment.workspace_id
        JOIN public.families family ON family.id = payment.family_id AND family.id = workspace.legacy_family_id
          AND family.owner_id = workspace.owner_id
        WHERE payment.proof_path = upload.path AND payment.workspace_id = upload.workspace_id
          AND payment.visibility = 'family' AND workspace.workspace_type IN ('family','household') AND workspace.owner_id <> subject
          AND payment.recorded_by = subject AND payment.proof_mime_type = upload.mime_type AND payment.proof_size_bytes = upload.byte_count
          AND split_part(upload.path,'/',1) = 'families' AND split_part(upload.path,'/',2) = family.id::text
        FOR SHARE OF payment,workspace,family
      ) THEN CONTINUE; END IF;
    ELSIF upload.bucket_id = 'business-documents' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.business_documents proof JOIN public.budget_workspaces workspace ON workspace.id = proof.workspace_id
        WHERE proof.id = upload.attachment_id AND proof.workspace_id = upload.workspace_id
          AND proof.storage_path = upload.path AND proof.status = 'active' AND proof.uploaded_by = subject
          AND proof.parent_type = upload.parent_type AND proof.parent_id = upload.parent_id
          AND proof.mime_type = upload.mime_type AND proof.size_bytes = upload.byte_count
          AND workspace.workspace_type = 'business' AND workspace.owner_id <> subject
          AND public.business_storage_workspace_id(upload.path) = workspace.id
          AND (
            (proof.parent_type = 'business_bill_payment' AND EXISTS (
              SELECT 1 FROM public.business_bill_payments payment
              WHERE payment.id = proof.parent_id AND payment.workspace_id = proof.workspace_id
            ))
            OR (proof.parent_type = 'expense_claim' AND EXISTS (
              SELECT 1 FROM public.business_expense_claims claim
              WHERE claim.id = proof.parent_id AND claim.workspace_id = proof.workspace_id AND claim.status = 'paid'
            ))
          )
        FOR SHARE OF proof,workspace
      ) THEN CONTINUE; END IF;
    ELSE
      CONTINUE;
    END IF;

    SELECT object.id INTO file_id FROM storage.objects object
    WHERE object.bucket_id = upload.bucket_id AND object.name = upload.path
      AND object.owner_id IS NULL AND object.owner IS NULL
      AND object.metadata->>'mimetype' = upload.mime_type
      AND COALESCE(object.metadata->>'size',object.metadata->>'contentLength') = upload.byte_count::text
    FOR SHARE;
    IF file_id IS NULL THEN CONTINUE; END IF;
    UPDATE mushavo_file_ingest.ordinary_uploads SET actor_id = NULL
    WHERE bucket_id = upload.bucket_id AND path = upload.path;
  END LOOP;

  -- Handle existing claim proofs with or without a managed upload entry.
  FOR document IN
    SELECT proof.id, proof.storage_path, proof.mime_type, proof.size_bytes, proof.workspace_id
    FROM public.business_documents proof
    JOIN public.business_expense_claims claim ON claim.id = proof.parent_id AND claim.workspace_id = proof.workspace_id
    JOIN public.budget_workspaces workspace ON workspace.id = claim.workspace_id
    WHERE proof.parent_type = 'expense_claim' AND claim.status = 'paid' AND proof.status = 'active'
      AND workspace.workspace_type = 'business' AND workspace.owner_id <> subject AND proof.uploaded_by = subject
    ORDER BY proof.id FOR UPDATE OF proof FOR SHARE OF claim,workspace
  LOOP
    SELECT object.id INTO file_id FROM storage.objects object
    WHERE object.bucket_id = 'business-documents' AND object.name = document.storage_path
      AND object.owner_id IS NULL AND object.owner IS NULL
      AND public.business_storage_workspace_id(object.name) = document.workspace_id
      AND object.metadata->>'mimetype' = document.mime_type
      AND COALESCE(object.metadata->>'size',object.metadata->>'contentLength') = document.size_bytes::text
    FOR SHARE;
    IF file_id IS NULL THEN RAISE EXCEPTION 'FR33_CLAIM_PROOF_STORAGE_HANDOFF_REQUIRED'; END IF;
    INSERT INTO mushavo_account_deletion.retained_paid_claim_proofs VALUES (document.id,file_id,txn);
    UPDATE public.business_documents SET uploaded_by = NULL WHERE id = document.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'FR33_CLAIM_PROOF_SCOPE_CHANGED'; END IF;
    DELETE FROM mushavo_account_deletion.retained_paid_claim_proofs WHERE document_id = document.id;
  END LOOP;
END;
$prepare$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.prepare_shared_proof_retention(uuid),
  mushavo_account_deletion.matches_retained_paid_claim_proof(jsonb,jsonb) FROM PUBLIC, anon, authenticated, service_role;

DO $extend_executor$
DECLARE
  body text := pg_get_functiondef('mushavo_account_deletion.execute_confirmed_request(uuid)'::regprocedure);
  anchor text := E'  IF EXISTS (SELECT 1 FROM public.payment_records WHERE proof_path IS NOT NULL';
BEGIN
  IF (length(body) - length(replace(body,anchor,''))) <> length(anchor) THEN
    RAISE EXCEPTION 'FR33_EXPECTED_STORAGE_PREFLIGHT';
  END IF;
  EXECUTE replace(body,anchor,E'  PERFORM mushavo_account_deletion.prepare_shared_proof_retention(p_request_id);\n' || anchor);
END;
$extend_executor$;
