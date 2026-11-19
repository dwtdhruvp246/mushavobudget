-- Rehearse expiry using disposable closed archives. Roll back all rows and control changes.
BEGIN;
DO $fixture$
DECLARE
  workspace uuid:=gen_random_uuid();
  invoice uuid:=gen_random_uuid();
  renewal uuid:=gen_random_uuid();
  payment uuid:=gen_random_uuid();
  neighbor uuid:=gen_random_uuid();
  neighbor_invoice uuid:=gen_random_uuid();
  totals_before record;
  review jsonb;
  result jsonb;
BEGIN
  IF public.fr33_billing_archive_expiry_step() IS NOT NULL
  THEN RAISE EXCEPTION 'FR33_BILLING_EXPIRY_REHEARSAL_NEEDS_DISABLED_PROCESSOR'; END IF;

  SELECT * INTO STRICT totals_before FROM mushavo_account_deletion.anonymous_billing_totals WHERE singleton;
  INSERT INTO mushavo_account_deletion.retained_billing_records(record_type,record_id,workspace_id,record) VALUES
    ('invoice',invoice,workspace,jsonb_build_object('id',invoice,'workspace_id',workspace,'status','paid','customer','Synthetic customer')),
    ('renewal',renewal,workspace,jsonb_build_object('id',renewal,'invoice_id',invoice,'status','approved')),
    ('payment',payment,workspace,jsonb_build_object('id',payment,'renewal_request_id',renewal,'status','approved')),
    ('invoice',neighbor_invoice,neighbor,jsonb_build_object('id',neighbor_invoice,'workspace_id',neighbor,'status','paid'));
  review := jsonb_build_array(jsonb_build_object('invoice_id',invoice,'booked_on','2018-05-15',
    'fiscal_year_start','2018-01-01','fiscal_year_end','2018-12-31','last_accounting_entry_on','2019-02-05',
    'vat_record_kind','non_book','vat_reference_on','2019-02-07'));
  BEGIN
    PERFORM mushavo_account_deletion.prepare_billing_archive_expiry(workspace,'2025-02-01','[]');
    RAISE EXCEPTION 'FR33_BILLING_EXPIRY_ACCEPTED_UNREVIEWED_INVOICE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'FR33_BILLING_EXPIRY_INVOICE_COVERAGE_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM mushavo_account_deletion.prepare_billing_archive_expiry(workspace,'2025-02-01',
      jsonb_build_array((review->0)-'fiscal_year_start'-'fiscal_year_end'));
    RAISE EXCEPTION 'FR33_BILLING_EXPIRY_ACCEPTED_ASSUMED_DATES';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'FR33_BILLING_EXPIRY_DATE_EVIDENCE_REQUIRED' THEN RAISE; END IF;
  END;
  IF mushavo_account_deletion.prepare_billing_archive_expiry(workspace,'2025-02-01',review) <> DATE '2025-02-08'
  THEN RAISE EXCEPTION 'FR33_BILLING_EXPIRY_DID_NOT_RESPECT_LATEST_DATE'; END IF;

  UPDATE mushavo_account_deletion.billing_expiry_control SET enabled=true,fixture_workspace_id=workspace WHERE singleton;
  INSERT INTO mushavo_account_deletion.retention_holds(record_kind,record_id,reason,review_at)
    VALUES ('billing_invoice',invoice,'Synthetic active dispute',clock_timestamp()+interval '1 week');
  IF public.fr33_billing_archive_expiry_step() IS NOT NULL
  THEN RAISE EXCEPTION 'FR33_BILLING_EXPIRY_IGNORED_HOLD'; END IF;
  DELETE FROM mushavo_account_deletion.retention_holds WHERE record_kind='billing_invoice' AND record_id=invoice;

  UPDATE mushavo_account_deletion.retained_billing_records row SET record=row.record||'{"status":"rejected"}'::jsonb
    WHERE row.record_type='invoice' AND row.record_id=invoice;
  IF public.fr33_billing_archive_expiry_step()->>'status' IS DISTINCT FROM 'review_required'
  THEN RAISE EXCEPTION 'FR33_BILLING_EXPIRY_IGNORED_CHANGED_ARCHIVE'; END IF;

  PERFORM mushavo_account_deletion.prepare_billing_archive_expiry(workspace,'2200-01-01',review);
  IF public.fr33_billing_archive_expiry_step() IS NOT NULL
  THEN RAISE EXCEPTION 'FR33_BILLING_EXPIRY_IGNORED_WORKSPACE_DATE'; END IF;
  PERFORM mushavo_account_deletion.prepare_billing_archive_expiry(workspace,'2025-02-01',review);
  result := public.fr33_billing_archive_expiry_step();

  IF result IS DISTINCT FROM '{"status":"completed","invoices":1,"payments":1,"proofs":0}'::jsonb
    OR EXISTS (SELECT 1 FROM mushavo_account_deletion.retained_billing_records row WHERE row.workspace_id=workspace)
    OR NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.retained_billing_records row WHERE row.workspace_id=neighbor)
    OR EXISTS (SELECT 1 FROM mushavo_account_deletion.billing_expiry_cases task WHERE task.workspace_id=workspace)
    OR NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.anonymous_billing_totals totals WHERE singleton
      AND totals.invoice_count=totals_before.invoice_count+1 AND totals.payment_count=totals_before.payment_count+1
      AND totals.proof_count=totals_before.proof_count)
    OR public.fr33_billing_archive_expiry_step() IS NOT NULL
  THEN RAISE EXCEPTION 'FR33_BILLING_EXPIRY_SCOPE_OR_AGGREGATE_FAILED %',result; END IF;
END;
$fixture$;
SELECT 'PASS' AS verified_dates_and_invoice_coverage,'PASS' AS legal_hold_and_changed_archive_preserved,
  'PASS' AS scoped_expiry_anonymous_counts_and_idempotent_retry;
ROLLBACK;
