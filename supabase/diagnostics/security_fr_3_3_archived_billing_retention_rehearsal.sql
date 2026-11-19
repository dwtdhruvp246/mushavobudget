-- Staging-only billing date and scope checks. No original records are expired.
BEGIN;
DO $fixture$
DECLARE
  workspace uuid:=gen_random_uuid();
  invoice uuid:=gen_random_uuid();
  renewal uuid:=gen_random_uuid();
  payment uuid:=gen_random_uuid();
  proof uuid:=gen_random_uuid();
  result jsonb;
BEGIN
  INSERT INTO mushavo_account_deletion.retained_billing_records(record_type,record_id,workspace_id,record) VALUES
    ('invoice',invoice,workspace,jsonb_build_object('id',invoice,'workspace_id',workspace,'status','paid')),
    ('renewal',renewal,workspace,jsonb_build_object('id',renewal,'invoice_id',invoice,'status','approved')),
    ('payment',payment,workspace,jsonb_build_object('id',payment,'renewal_request_id',renewal,'status','approved'));
  IF mushavo_account_deletion.preview_archived_invoice_retention(invoice)->>'status' <> 'accounting_period_required'
  THEN RAISE EXCEPTION 'FR33_BILLING_RETENTION_ASSUMED_UNKNOWN_PERIOD'; END IF;
  result:=mushavo_account_deletion.preview_archived_invoice_retention(invoice,'2018-03-15','2018-01-01','2018-12-31');
  IF result->>'status' <> 'ready_for_expiry_review' OR result->>'eligible_from' <> '2025-01-01'
    OR result->>'payments' <> '1'
  THEN RAISE EXCEPTION 'FR33_BILLING_RETENTION_DATE_OR_SCOPE_INCORRECT %',result; END IF;

  result:=mushavo_account_deletion.preview_archived_invoice_retention(
    invoice,'2018-03-15','2018-01-01','2018-12-31',(statement_timestamp() + interval '1 year')::date);
  IF result->>'status' <> 'within_retention_window' OR result->>'baseline_last_day' <> '2024-12-31'
  THEN RAISE EXCEPTION 'FR33_BILLING_RETENTION_APPROVED_EXCEPTION_FAILED %',result; END IF;

  INSERT INTO mushavo_account_deletion.retained_billing_records(record_type,record_id,workspace_id,record)
    VALUES ('proof',proof,workspace,jsonb_build_object('id',proof,'payment_id',payment,'storage_path','synthetic-missing.png'));
  result:=mushavo_account_deletion.preview_archived_invoice_retention(invoice,'2018-03-15','2018-01-01','2018-12-31');
  IF result->>'status' <> 'review_required' OR result->>'proofs' <> '1' OR result->>'verified_proof_objects' <> '0'
  THEN RAISE EXCEPTION 'FR33_BILLING_MISSING_PROOF_IGNORED %',result; END IF;

  INSERT INTO mushavo_account_deletion.retention_holds(record_kind,record_id,reason,review_at)
    VALUES ('billing_invoice',invoice,'Synthetic hold',clock_timestamp()+interval '1 week');
  IF mushavo_account_deletion.preview_archived_invoice_retention(invoice,'2018-03-15','2018-01-01','2018-12-31')->>'status' <> 'held'
    OR (SELECT count(*) FROM mushavo_account_deletion.retained_billing_records row WHERE row.workspace_id=workspace) <> 4
  THEN RAISE EXCEPTION 'FR33_BILLING_HOLD_OR_READ_ONLY_PREVIEW_FAILED'; END IF;
END;
$fixture$;
SELECT 'PASS' AS verified_accounting_period_required, 'PASS' AS six_year_window_and_approved_exception,
  'PASS' AS holds_and_missing_proofs_flagged, 'PASS' AS archive_preserved;
ROLLBACK;
