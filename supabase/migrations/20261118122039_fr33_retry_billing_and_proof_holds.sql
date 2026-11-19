ALTER TABLE mushavo_account_deletion.processor_attempts DROP CONSTRAINT processor_attempts_check,
  ADD CONSTRAINT processor_attempts_check CHECK (
    retry_at IS NULL OR (retry_at > attempted_at AND
      (review_code IS NULL OR review_code IN ('FR33_BILLING_IN_REVIEW','FR33_SURVIVING_BILLING_PROOF_HANDOFF_REQUIRED','FR33_BILLING_PROOF_RETENTION_UNVERIFIED')))
  );

-- Preserve open billing decisions and retry confirmed erasure after review or proof repair.
CREATE FUNCTION mushavo_account_deletion.has_unfinished_subject_billing(p_subject uuid,p_owned_workspaces uuid[])
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'pg_catalog' SET row_security TO 'off' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscription_renewal_requests renewal
    JOIN public.subscription_invoices invoice ON invoice.id=renewal.invoice_id AND invoice.workspace_id=renewal.workspace_id
    LEFT JOIN public.subscription_payments payment ON payment.renewal_request_id=renewal.id AND payment.workspace_id=renewal.workspace_id
    WHERE (renewal.status='pending_review' OR payment.status='pending_review')
      AND (renewal.workspace_id=ANY(p_owned_workspaces) OR renewal.requested_by=p_subject OR invoice.created_by=p_subject
        OR payment.submitted_by=p_subject OR EXISTS (
          SELECT 1 FROM public.subscription_payment_proofs proof WHERE proof.payment_id=payment.id AND proof.uploaded_by=p_subject
        ))
  );
$$;
REVOKE ALL ON FUNCTION mushavo_account_deletion.has_unfinished_subject_billing(uuid,uuid[]) FROM PUBLIC,anon,authenticated,service_role;

DO $migration$
DECLARE
  executor text := pg_get_functiondef('mushavo_account_deletion.execute_confirmed_request(uuid)'::regprocedure);
  processor text := pg_get_functiondef('mushavo_account_deletion.process_confirmed_requests()'::regprocedure);
  anchor text := '  IF mushavo_account_deletion.queue_shared_proof_handoffs(p_request_id,subject) THEN';
BEGIN
  IF cardinality(string_to_array(executor,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_BILLING_HOLD_EXECUTOR_ANCHOR_CHANGED'; END IF;
  EXECUTE replace(executor,anchor,
    E'  IF mushavo_account_deletion.has_unfinished_subject_billing(subject,workspace_ids) THEN\n' ||
    E'    RAISE EXCEPTION ''FR33_BILLING_IN_REVIEW'';\n  END IF;\n\n' || anchor);

  anchor := '    IF review_code IS NOT NULL THEN review := review+1; END IF;';
  IF cardinality(string_to_array(processor,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_BILLING_HOLD_PROCESSOR_ANCHOR_CHANGED'; END IF;
  EXECUTE replace(processor,anchor,anchor || E'\n' || $retry$
    IF review_code IN ('FR33_BILLING_IN_REVIEW','FR33_SURVIVING_BILLING_PROOF_HANDOFF_REQUIRED','FR33_BILLING_PROOF_RETENTION_UNVERIFIED') THEN
      retry_at := attempt_time+interval '1 day';
    END IF;$retry$);
END;
$migration$;
