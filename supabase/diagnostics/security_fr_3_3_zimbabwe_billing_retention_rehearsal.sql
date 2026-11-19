-- Staging-only rehearsal. The invoice, proof and holds are disposable and rolled back.
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

  result:=mushavo_account_deletion.preview_zw_invoice_retention(invoice,'2025-05-15');
  IF result->>'status' IS DISTINCT FROM 'statutory_record_dates_required'
    OR result->>'fiscal_year_end' IS DISTINCT FROM '2025-12-31'
    OR result ? 'eligible_from'
  THEN RAISE EXCEPTION 'FR33_ZW_MISSING_EVIDENCE_REVIEW_FAILED %',result; END IF;

  result:=mushavo_account_deletion.preview_zw_invoice_retention(invoice,'2025-05-15',
    p_last_accounting_entry_on:='2026-02-10',p_vat_record_kind:='not_applicable');
  IF result->>'status' IS DISTINCT FROM 'accounting_period_confirmation_required'
    OR result->>'fiscal_period_source' IS DISTINCT FROM 'calendar_year_preview'
    OR result->>'income_tax_last_day' IS DISTINCT FROM '2032-02-10'
    OR result ? 'eligible_from'
  THEN RAISE EXCEPTION 'FR33_ZW_PREVIEW_TREATED_AS_CONFIRMED %',result; END IF;

  result:=mushavo_account_deletion.preview_zw_invoice_retention(invoice,'2025-05-15',
    '2024-07-01','2025-06-30','2025-10-04','book','2025-12-02');
  IF result->>'status' IS DISTINCT FROM 'within_retention_window'
    OR result->>'baseline_last_day' IS DISTINCT FROM '2031-06-30'
    OR result->>'income_tax_last_day' IS DISTINCT FROM '2031-10-04'
    OR result->>'vat_last_day' IS DISTINCT FROM '2031-12-02'
    OR result->>'eligible_from' IS DISTINCT FROM '2031-12-03'
  THEN RAISE EXCEPTION 'FR33_ZW_STATUTORY_MINIMUM_CUT_SHORT %',result; END IF;

  result:=mushavo_account_deletion.preview_zw_invoice_retention(invoice,'2020-05-15',
    '2019-07-01','2020-06-30','2020-05-16','non_book','2020-08-15','2027-10-12');
  IF result->>'approved_last_day' IS DISTINCT FROM '2027-10-12'
    OR result->>'eligible_from' IS DISTINCT FROM '2027-10-13'
  THEN RAISE EXCEPTION 'FR33_ZW_ADDITIONAL_RETENTION_IGNORED %',result; END IF;

  result:=mushavo_account_deletion.preview_zw_invoice_retention(invoice,'2020-05-15',
    '2019-07-01','2020-06-30','2020-05-16','non_book','2020-08-15','2025-10-12');
  IF result->>'vat_last_day' IS DISTINCT FROM '2026-08-15'
    OR result->>'approved_last_day' IS DISTINCT FROM '2026-08-15'
  THEN RAISE EXCEPTION 'FR33_ZW_EXTRA_DATE_REDUCED_STATUTORY_FLOOR %',result; END IF;

  result:=mushavo_account_deletion.preview_zw_invoice_retention(invoice,'2018-01-05',
    '2018-01-01','2018-12-31','2018-01-06','not_applicable');
  IF result->>'status' IS DISTINCT FROM 'ready_for_expiry_review'
    OR result->>'approved_last_day' IS DISTINCT FROM '2024-12-31'
  THEN RAISE EXCEPTION 'FR33_ZW_POLICY_WINDOW_DROPPED %',result; END IF;

  BEGIN
    PERFORM mushavo_account_deletion.preview_zw_invoice_retention(invoice,'2025-05-15','2025-01-01',NULL);
    RAISE EXCEPTION 'FR33_ZW_PARTIAL_PERIOD_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'FR33_ZW_RETENTION_INPUT_INVALID' THEN RAISE; END IF;
  END;

  INSERT INTO mushavo_account_deletion.retained_billing_records(record_type,record_id,workspace_id,record)
    VALUES ('proof',proof,workspace,jsonb_build_object('id',proof,'payment_id',payment,'storage_path','synthetic-missing.png'));
  result:=mushavo_account_deletion.preview_zw_invoice_retention(invoice,'2018-01-05',
    '2018-01-01','2018-12-31','2018-01-06','not_applicable');
  IF result->>'status' IS DISTINCT FROM 'review_required' OR result ? 'eligible_from'
  THEN RAISE EXCEPTION 'FR33_ZW_MISSING_PROOF_REVIEW_BYPASSED %',result; END IF;

  INSERT INTO mushavo_account_deletion.retention_holds(record_kind,record_id,reason,review_at)
    VALUES ('billing_invoice',invoice,'Synthetic dispute',clock_timestamp()+interval '1 week');
  result:=mushavo_account_deletion.preview_zw_invoice_retention(invoice,'2018-01-05',
    '2018-01-01','2018-12-31','2018-01-06','not_applicable');
  IF result->>'status' IS DISTINCT FROM 'held' OR result ? 'eligible_from'
    OR (SELECT count(*) FROM mushavo_account_deletion.retained_billing_records row WHERE row.workspace_id=workspace) <> 4
  THEN RAISE EXCEPTION 'FR33_ZW_HOLD_OR_READ_ONLY_PREVIEW_FAILED %',result; END IF;
END;
$fixture$;
SELECT 'PASS' AS calendar_preview_without_live_eligibility, 'PASS' AS accounting_and_vat_last_days,
  'PASS' AS shorter_override_rejected_and_longer_hold_preserved, 'PASS' AS missing_proofs_held_and_archive_preserved;
ROLLBACK;
