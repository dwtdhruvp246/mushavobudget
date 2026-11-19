CREATE TABLE mushavo_account_deletion.retained_bill_proofs (
  document_id uuid PRIMARY KEY REFERENCES public.business_documents(id) ON DELETE CASCADE,
  storage_object_id uuid NOT NULL
);
ALTER TABLE mushavo_account_deletion.retained_bill_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.retained_bill_proofs FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.business_documents ALTER COLUMN uploaded_by DROP NOT NULL;

CREATE FUNCTION mushavo_account_deletion.require_bill_proof_uploader()
RETURNS trigger
LANGUAGE plpgsql SET search_path TO pg_catalog
AS $require_uploader$
BEGIN
  IF NEW.uploaded_by IS NULL AND (TG_OP = 'INSERT'
    OR NEW.parent_type IS DISTINCT FROM 'business_bill_payment'
    OR (to_jsonb(NEW) - 'uploaded_by') IS DISTINCT FROM (to_jsonb(OLD) - 'uploaded_by')
    OR NOT EXISTS (
      SELECT 1 FROM mushavo_account_deletion.retained_bill_proofs retained
      JOIN storage.objects object ON object.id = retained.storage_object_id
      WHERE retained.document_id = NEW.id AND object.bucket_id = 'business-documents'
        AND object.name = NEW.storage_path AND object.owner_id IS NULL AND object.owner IS NULL
    )) THEN
    RAISE EXCEPTION USING ERRCODE = '23502', MESSAGE = 'FR33_BILL_PROOF_UPLOADER_REQUIRED';
  END IF;
  RETURN NEW;
END;
$require_uploader$;

CREATE TRIGGER fr33_bill_proof_uploader_required
BEFORE INSERT OR UPDATE OF id, uploaded_by ON public.business_documents
FOR EACH ROW EXECUTE FUNCTION mushavo_account_deletion.require_bill_proof_uploader();

CREATE OR REPLACE FUNCTION mushavo_account_deletion.detach_retained_business_bill_recorders(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path TO pg_catalog SET row_security TO 'off'
AS $detach$
DECLARE
  subject uuid;
  captured jsonb;
  detached integer;
  proof_count integer;
  proof_updates integer;
  proof record;
BEGIN
  SELECT subject_id INTO subject FROM mushavo_account_deletion.requests
  WHERE id = p_request_id AND cancelled_at IS NULL AND workspace_impact_confirmed_at IS NOT NULL;
  IF subject IS NULL THEN RAISE EXCEPTION 'FR33_CONFIRMED_REQUEST_REQUIRED'; END IF;

  -- Serialize against proof registration and lock any workspace in which the account has either role.
  LOCK TABLE public.business_documents IN SHARE ROW EXCLUSIVE MODE;
  PERFORM workspace.id FROM public.budget_workspaces workspace
  WHERE workspace.workspace_type = 'business' AND EXISTS (
    SELECT 1 FROM public.business_bill_payments payment
    WHERE payment.workspace_id = workspace.id AND (payment.recorded_by = subject OR EXISTS (
      SELECT 1 FROM public.business_documents document
      WHERE document.workspace_id = workspace.id AND document.parent_type = 'business_bill_payment'
        AND document.parent_id = payment.id AND document.uploaded_by = subject
    ))
  ) ORDER BY workspace.id FOR SHARE OF workspace;

  -- Validates confirmation, saves the names, and locks the request against cancellation.
  captured := mushavo_account_deletion.capture_retained_payment_names(p_request_id);

  FOR proof IN
    SELECT document.id, document.uploaded_by, document.storage_path
    FROM public.business_documents document
    JOIN public.business_bill_payments payment ON payment.id = document.parent_id AND payment.workspace_id = document.workspace_id
    JOIN public.budget_workspaces workspace ON workspace.id = payment.workspace_id
    WHERE document.parent_type = 'business_bill_payment' AND workspace.workspace_type = 'business'
      AND workspace.owner_id IS DISTINCT FROM subject AND (payment.recorded_by = subject OR document.uploaded_by = subject)
    ORDER BY document.id
  LOOP
    IF NOT EXISTS (SELECT 1 FROM storage.objects object WHERE object.bucket_id = 'business-documents'
       AND object.name = proof.storage_path AND object.owner_id IS DISTINCT FROM subject::text
       AND object.owner IS DISTINCT FROM subject) THEN
      RAISE EXCEPTION 'FR33_BILL_PROOF_STORAGE_HANDOFF_REQUIRED';
    END IF;
    IF proof.uploaded_by = subject THEN
      -- Paths that still depend on an uploader for authorization need a separate migration.
      IF public.fr32_is_managed_ordinary_upload('business-documents', proof.storage_path) THEN
        RAISE EXCEPTION 'FR33_BILL_PROOF_INGESTION_HANDOFF_REQUIRED';
      END IF;
      INSERT INTO mushavo_account_deletion.retained_bill_proofs (document_id, storage_object_id)
      SELECT proof.id, object.id FROM storage.objects object
      WHERE object.bucket_id = 'business-documents' AND object.name = proof.storage_path
        AND object.owner_id IS NULL AND object.owner IS NULL
      FOR SHARE OF object
      ON CONFLICT (document_id) DO UPDATE SET storage_object_id = EXCLUDED.storage_object_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'FR33_BILL_PROOF_STORAGE_HANDOFF_REQUIRED'; END IF;
    END IF;
  END LOOP;

  SELECT count(*) INTO proof_count FROM public.business_documents document
  JOIN public.business_bill_payments payment ON payment.id = document.parent_id AND payment.workspace_id = document.workspace_id
  JOIN public.budget_workspaces workspace ON workspace.id = payment.workspace_id
  WHERE document.parent_type = 'business_bill_payment' AND workspace.workspace_type = 'business'
    AND workspace.owner_id IS DISTINCT FROM subject AND document.uploaded_by = subject;

  UPDATE public.business_documents document SET uploaded_by = NULL
  FROM public.business_bill_payments payment, public.budget_workspaces workspace,
       mushavo_account_deletion.retained_bill_proofs retained
  WHERE retained.document_id = document.id AND document.parent_type = 'business_bill_payment'
    AND payment.id = document.parent_id AND payment.workspace_id = document.workspace_id
    AND workspace.id = payment.workspace_id AND workspace.workspace_type = 'business'
    AND workspace.owner_id IS DISTINCT FROM subject AND document.uploaded_by = subject;
  GET DIAGNOSTICS proof_updates = ROW_COUNT;
  IF proof_updates <> proof_count THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'FR33_BILL_PAYMENT_SCOPE_CHANGED';
  END IF;

  UPDATE public.business_bill_payments payment SET recorded_by = NULL
  FROM public.budget_workspaces workspace, public.fr33_bill_payment_names retained
  WHERE workspace.id = payment.workspace_id AND retained.payment_id = payment.id
    AND workspace.workspace_type = 'business' AND workspace.owner_id IS DISTINCT FROM subject
    AND payment.recorded_by = subject;
  GET DIAGNOSTICS detached = ROW_COUNT;
  IF detached <> (captured->>'business_bill_payments')::int OR EXISTS (
    SELECT 1 FROM public.business_bill_payments payment
    JOIN public.budget_workspaces workspace ON workspace.id = payment.workspace_id
    WHERE workspace.workspace_type = 'business' AND workspace.owner_id IS DISTINCT FROM subject
      AND payment.recorded_by = subject
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'FR33_BILL_PAYMENT_SCOPE_CHANGED';
  END IF;

  RETURN jsonb_build_object('business_bill_payments_detached', detached, 'business_bill_proofs_retained', proof_updates);
END;
$detach$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.require_bill_proof_uploader(),
  mushavo_account_deletion.detach_retained_business_bill_recorders(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
