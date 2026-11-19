-- Run on staging after the retained billing and automatic retry migrations.
BEGIN;
DO $fixture$
#variable_conflict use_variable
DECLARE
  subject uuid := gen_random_uuid();
  owner_id uuid := gen_random_uuid();
  workspace_id uuid;
  invoice_id uuid := gen_random_uuid();
  renewal_id uuid := gen_random_uuid();
  payment_id uuid := gen_random_uuid();
  request_id uuid := gen_random_uuid();
  review_id uuid := gen_random_uuid();
  audit_id uuid := gen_random_uuid();
  proof_id uuid := gen_random_uuid();
  other_invoice_id uuid := gen_random_uuid();
  plan_id uuid;
  proof_path text;
  billing_result jsonb;
BEGIN
  SELECT id INTO STRICT plan_id FROM public.plans WHERE code = 'personal';
  INSERT INTO auth.users(id,email,aud,role,raw_user_meta_data) VALUES
    (subject,'fr33-billing-'||subject||'@example.invalid','authenticated','authenticated','{"full_name":"FR33 Former Account"}'),
    (owner_id,'fr33-billing-'||owner_id||'@example.invalid','authenticated','authenticated','{"full_name":"FR33 Workspace Owner"}');
  SELECT workspace.id INTO STRICT workspace_id FROM public.budget_workspaces workspace
    WHERE workspace.owner_id = owner_id AND workspace.workspace_type = 'personal';
  proof_path := 'workspaces/' || workspace_id || '/' || subject || '/erasure-fixture/' || proof_id || '.png';
  INSERT INTO public.subscription_invoices
    (id,workspace_id,invoice_number,plan_code,plan_name,billing_period,currency,base_amount,total_amount,status,created_by)
    VALUES
    (invoice_id,workspace_id,'FR33-'||invoice_id,'personal','Personal','monthly','USD',11,11,'rejected',subject),
    (other_invoice_id,workspace_id,'FR33-'||other_invoice_id,'personal','Personal','monthly','USD',2,2,'pending',owner_id);
  INSERT INTO public.subscription_renewal_requests(id,workspace_id,invoice_id,requested_plan_id,requested_by,reviewed_by,status)
    VALUES (renewal_id,workspace_id,invoice_id,plan_id,subject,subject,'rejected');
  INSERT INTO public.subscription_payments
    (id,renewal_request_id,workspace_id,submitted_by,amount,currency,payment_method,payment_date,reference_number,status)
    VALUES (payment_id,renewal_id,workspace_id,subject,11,'USD','bank_transfer',current_date,'FR33 synthetic payment','rejected');
  INSERT INTO public.subscription_payment_reviews(id,payment_id,reviewer_id,decision)
    VALUES (review_id,payment_id,subject,'rejected');
  INSERT INTO public.subscription_audit_events(id,workspace_id,actor_id,action,target_type)
    VALUES (audit_id,workspace_id,subject,'synthetic','invoice');
  INSERT INTO mushavo_account_deletion.requests(id,subject_id,workspace_impact_confirmed_at,workspace_impact_token)
    VALUES (request_id,subject,clock_timestamp(),mushavo_account_deletion.owned_workspace_impact(subject)->>'impact_token');

  BEGIN
    UPDATE public.subscription_invoices invoices SET created_by = NULL WHERE invoices.id = invoice_id;
    RAISE EXCEPTION 'UNAUTHORIZED_BILLING_DETACH_PASSED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'FR33_BILLING_ACTOR_IMMUTABLE' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.subscription_payment_reviews(payment_id,reviewer_id,decision) VALUES (payment_id,NULL,'rejected');
    RAISE EXCEPTION 'NULL_BILLING_ACTOR_ACCEPTED';
  EXCEPTION WHEN not_null_violation THEN
    NULL;
  END;

  BEGIN
    UPDATE public.subscription_invoices invoices SET status = 'pending' WHERE invoices.id = invoice_id;
    PERFORM mushavo_account_deletion.execute_confirmed_request(request_id);
    RAISE EXCEPTION 'IN_FLIGHT_BILLING_WAS_DETACHED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'FR33_SURVIVING_BILLING_REVIEW_REQUIRED' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO public.subscription_payment_proofs(id,payment_id,storage_path,original_name,mime_type,size_bytes,uploaded_by)
      VALUES (proof_id,payment_id,proof_path,'synthetic.png','image/png',75,subject);
    PERFORM mushavo_account_deletion.execute_confirmed_request(request_id);
    RAISE EXCEPTION 'MISSING_PROOF_ALLOWED_ERASURE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'FR33_SURVIVING_BILLING_PROOF_HANDOFF_REQUIRED' THEN RAISE; END IF;
  END;
  IF NOT EXISTS (SELECT 1 FROM auth.users account WHERE account.id = subject)
    OR NOT EXISTS (SELECT 1 FROM public.subscription_invoices invoices WHERE invoices.id = invoice_id AND invoices.created_by = subject)
    OR EXISTS (SELECT 1 FROM mushavo_account_deletion.retained_billing_actors retained WHERE retained.actor_id = subject)
  THEN RAISE EXCEPTION 'REFUSED_ERASURE_DID_NOT_ROLL_BACK'; END IF;

  IF NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.processor_control WHERE singleton
    AND fixture_request_id IS NULL AND confirmed_since IS NULL)
  THEN RAISE EXCEPTION 'FR33_TEST_PROCESSOR_SCOPE_UNAVAILABLE'; END IF;
  UPDATE mushavo_account_deletion.processor_control SET fixture_request_id=request_id,confirmed_since=now()-interval '5 minutes' WHERE singleton;
  UPDATE public.subscription_payments payment SET status='pending_review' WHERE payment.id=payment_id;
  PERFORM mushavo_account_deletion.process_confirmed_requests();
  IF NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.processor_attempts attempt WHERE attempt.request_id=request_id
    AND attempt.review_code='FR33_BILLING_IN_REVIEW' AND attempt.retry_at >= now()+interval '23 hours')
    OR NOT EXISTS (SELECT 1 FROM auth.users account WHERE account.id=subject)
  THEN RAISE EXCEPTION 'FR33_PENDING_REVIEW_RETRY_MISSING'; END IF;

  UPDATE public.subscription_payments payment SET status='rejected' WHERE payment.id=payment_id;
  INSERT INTO public.subscription_payment_proofs(id,payment_id,storage_path,original_name,mime_type,size_bytes,uploaded_by)
    VALUES (proof_id,payment_id,proof_path,'synthetic.png','image/png',75,subject);
  UPDATE mushavo_account_deletion.processor_attempts attempt SET retry_at=now(),attempted_at=now()-interval '1 minute' WHERE attempt.request_id=request_id;
  PERFORM mushavo_account_deletion.process_confirmed_requests();
  IF NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.processor_attempts attempt WHERE attempt.request_id=request_id
    AND attempt.review_code='FR33_SURVIVING_BILLING_PROOF_HANDOFF_REQUIRED' AND attempt.retry_at >= now()+interval '23 hours')
    OR NOT EXISTS (SELECT 1 FROM auth.users account WHERE account.id=subject)
  THEN RAISE EXCEPTION 'FR33_MISSING_PROOF_RETRY_MISSING'; END IF;

  -- Undo this rehearsal's synthetic missing-proof row to mimic a resolved hold.
  DELETE FROM public.subscription_payment_proofs proof WHERE proof.id=proof_id;
  UPDATE mushavo_account_deletion.processor_attempts attempt SET retry_at=now(),attempted_at=now()-interval '1 minute' WHERE attempt.request_id=request_id;
  PERFORM mushavo_account_deletion.process_confirmed_requests();
  IF NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.processor_attempts attempt WHERE attempt.request_id=request_id
    AND attempt.review_code IS NULL AND attempt.retry_at IS NULL)
  THEN RAISE EXCEPTION 'FR33_REVIEW_DID_NOT_RESUME'; END IF;

  billing_result := mushavo_account_deletion.execute_confirmed_request(request_id);
  IF billing_result->>'status' IS DISTINCT FROM 'completed' THEN RAISE EXCEPTION 'ERASURE_INCOMPLETE: %',billing_result; END IF;
  IF EXISTS (SELECT 1 FROM auth.users account WHERE account.id = subject)
    OR NOT EXISTS (SELECT 1 FROM public.budget_workspaces workspace WHERE workspace.id = workspace_id)
    OR NOT EXISTS (SELECT 1 FROM public.subscription_invoices invoices
      WHERE invoices.id = invoice_id AND invoices.total_amount = 11 AND invoices.status = 'rejected' AND invoices.created_by IS NULL)
    OR NOT EXISTS (SELECT 1 FROM public.subscription_invoices invoices WHERE invoices.id = other_invoice_id AND invoices.created_by = owner_id)
    OR NOT EXISTS (SELECT 1 FROM public.subscription_renewal_requests renewal
      WHERE renewal.id = renewal_id AND renewal.requested_by IS NULL AND renewal.reviewed_by IS NULL AND renewal.status = 'rejected')
    OR NOT EXISTS (SELECT 1 FROM public.subscription_payments payment
      WHERE payment.id = payment_id AND payment.amount = 11 AND payment.submitted_by IS NULL)
    OR NOT EXISTS (SELECT 1 FROM public.subscription_payment_reviews review
      WHERE review.id = review_id AND review.reviewer_id IS NULL AND review.decision = 'rejected')
    OR NOT EXISTS (SELECT 1 FROM public.subscription_audit_events audit WHERE audit.id = audit_id AND audit.actor_id IS NULL)
    OR (SELECT count(*) FROM mushavo_account_deletion.retained_billing_actors retained
      WHERE retained.actor_id = subject AND retained.workspace_id = workspace_id AND retained.detach_transaction IS NULL) <> 4
    OR mushavo_account_deletion.execute_confirmed_request(request_id)->>'status' IS DISTINCT FROM 'completed'
  THEN RAISE EXCEPTION 'RETAINED_BILLING_RESULT_MISMATCH'; END IF;

  BEGIN
    UPDATE public.subscription_payments payment SET submitted_by = owner_id WHERE payment.id = payment_id;
    RAISE EXCEPTION 'HISTORICAL_BILLING_ACTOR_REPLACED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'FR33_BILLING_ACTOR_IMMUTABLE' THEN RAISE; END IF;
  END;
END;
$fixture$;
SELECT 'PASS' AS surviving_billing_account_erasure, 'PASS' AS unsafe_changes_and_missing_proof_refused, 'PASS' AS billing_and_proof_holds_resume;
ROLLBACK;
