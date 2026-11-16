-- A retained payment keeps its name when the account reference is cleared.
-- The existing RESTRICT foreign key still protects recorders until that step.
ALTER TABLE public.business_bill_payments ALTER COLUMN recorded_by DROP NOT NULL;

CREATE FUNCTION mushavo_account_deletion.require_retained_bill_recorder_name()
RETURNS trigger
LANGUAGE plpgsql SET search_path TO pg_catalog
AS $require_name$
BEGIN
  IF NEW.recorded_by IS NULL AND (TG_OP = 'INSERT' OR NOT EXISTS (
    SELECT 1 FROM public.fr33_bill_payment_names retained WHERE retained.payment_id = NEW.id
  )) THEN
    RAISE EXCEPTION USING ERRCODE = '23502', MESSAGE = 'FR33_BILL_PAYMENT_RECORDER_REQUIRED';
  END IF;
  RETURN NEW;
END;
$require_name$;

CREATE TRIGGER fr33_bill_payment_recorder_required
BEFORE INSERT OR UPDATE OF id, recorded_by ON public.business_bill_payments
FOR EACH ROW EXECUTE FUNCTION mushavo_account_deletion.require_retained_bill_recorder_name();

-- Intended to run in the erasure transaction, with the remaining data cleanup.
CREATE FUNCTION mushavo_account_deletion.detach_retained_business_bill_recorders(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path TO pg_catalog SET row_security TO 'off'
AS $detach$
DECLARE
  subject uuid;
  captured jsonb;
  detached integer;
BEGIN
  SELECT subject_id INTO subject FROM mushavo_account_deletion.requests
  WHERE id = p_request_id AND cancelled_at IS NULL AND workspace_impact_confirmed_at IS NOT NULL;
  IF subject IS NULL THEN
    RAISE EXCEPTION 'FR33_CONFIRMED_REQUEST_REQUIRED';
  END IF;

  -- Hold the ownership used to distinguish surviving workspaces from owned ones.
  PERFORM workspace.id FROM public.budget_workspaces workspace
  WHERE workspace.workspace_type = 'business' AND EXISTS (
    SELECT 1 FROM public.business_bill_payments payment
    WHERE payment.workspace_id = workspace.id AND payment.recorded_by = subject
  )
  ORDER BY workspace.id FOR SHARE OF workspace;

  -- Validates confirmation and locks the request against cancellation.
  captured := mushavo_account_deletion.capture_retained_payment_names(p_request_id);
  IF (captured->>'business_bill_payments')::int = 0 THEN
    RETURN jsonb_build_object('business_bill_payments_detached', 0);
  END IF;

  -- Keep the document inventory stable until detachment and account cleanup finish.
  LOCK TABLE public.business_documents IN SHARE MODE;
  IF EXISTS (
    SELECT 1 FROM public.business_bill_payments payment
    JOIN public.budget_workspaces workspace ON workspace.id = payment.workspace_id
    JOIN public.business_documents document ON document.workspace_id = workspace.id
      AND document.parent_type = 'business_bill_payment' AND document.parent_id = payment.id
    WHERE workspace.workspace_type = 'business' AND workspace.owner_id IS DISTINCT FROM subject
      AND payment.recorded_by = subject
  ) THEN
    RAISE EXCEPTION 'FR33_BILL_PAYMENT_PROOF_REQUIRES_RETENTION_DECISION';
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

  RETURN jsonb_build_object('business_bill_payments_detached', detached);
END;
$detach$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.require_retained_bill_recorder_name(),
  mushavo_account_deletion.detach_retained_business_bill_recorders(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
