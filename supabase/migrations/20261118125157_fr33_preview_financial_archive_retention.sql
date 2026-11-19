-- Preview the approved billing window using an accounting period verified by Mushavo.
-- This operator-only function never alters billing records or Storage.
CREATE FUNCTION mushavo_account_deletion.preview_archived_invoice_retention(
  p_invoice uuid,
  p_booked_on date DEFAULT NULL,
  p_fiscal_year_start date DEFAULT NULL,
  p_fiscal_year_end date DEFAULT NULL,
  p_approved_expiry date DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
SET timezone TO 'UTC'
AS $$
DECLARE
  invoice mushavo_account_deletion.retained_billing_records%ROWTYPE;
  baseline_end date;
  actual_end date;
  counts record;
  result text;
BEGIN
  SELECT * INTO invoice FROM mushavo_account_deletion.retained_billing_records row
  WHERE row.record_type='invoice' AND row.record_id=p_invoice;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','archive_invoice_unavailable'); END IF;

  IF p_booked_on IS NULL OR p_fiscal_year_start IS NULL OR p_fiscal_year_end IS NULL THEN
    RETURN jsonb_build_object('status','accounting_period_required');
  END IF;
  IF NOT isfinite(p_booked_on) OR NOT isfinite(p_fiscal_year_start) OR NOT isfinite(p_fiscal_year_end)
    OR p_fiscal_year_end < p_fiscal_year_start OR p_booked_on NOT BETWEEN p_fiscal_year_start AND p_fiscal_year_end
    OR (p_approved_expiry IS NOT NULL AND (NOT isfinite(p_approved_expiry) OR p_approved_expiry < p_fiscal_year_end))
  THEN RAISE EXCEPTION 'FR33_BILLING_RETENTION_PERIOD_INVALID'; END IF;

  baseline_end := (p_fiscal_year_end + interval '6 years')::date;
  actual_end := coalesce(p_approved_expiry,baseline_end);

  WITH renewals AS MATERIALIZED (
    SELECT row.record_id,row.workspace_id,row.record
    FROM mushavo_account_deletion.retained_billing_records row
    WHERE row.record_type='renewal' AND row.record->>'invoice_id'=invoice.record_id::text
  ), payments AS MATERIALIZED (
    SELECT row.record_id,row.workspace_id,row.record
    FROM mushavo_account_deletion.retained_billing_records row JOIN renewals renewal
      ON row.record->>'renewal_request_id'=renewal.record_id::text
    WHERE row.record_type='payment'
  ), proofs AS MATERIALIZED (
    SELECT row.record_id,row.workspace_id,row.record
    FROM mushavo_account_deletion.retained_billing_records row JOIN payments payment
      ON row.record->>'payment_id'=payment.record_id::text
    WHERE row.record_type='proof'
  ), matching_files AS (
    SELECT archive.proof_id FROM proofs proof
    JOIN mushavo_account_deletion.retained_subscription_proofs archive ON archive.proof_id=proof.record_id
      AND archive.workspace_id=proof.workspace_id AND archive.path=proof.record->>'storage_path'
    JOIN storage.objects object ON object.id=archive.storage_object_id AND object.version=archive.storage_object_version
      AND object.bucket_id='subscription-proofs' AND object.name=archive.path
      AND object.owner_id IS NULL AND object.owner IS NULL AND object.archived_at IS NULL AND NOT object.is_delete_marker
    JOIN storage.buckets bucket ON bucket.id=object.bucket_id AND bucket.public IS FALSE
      AND bucket.versioning_status='DISABLED' AND bucket.lifecycle_configuration IS NULL
    WHERE object.metadata->>'mimetype'=proof.record->>'mime_type'
      AND coalesce(object.metadata->>'size',object.metadata->>'contentLength')=proof.record->>'size_bytes'
  )
  SELECT
    (SELECT count(*) FROM renewals) AS renewals,
    (SELECT count(*) FROM payments) AS payments,
    (SELECT count(*) FROM proofs) AS proofs,
    (SELECT count(*) FROM matching_files) AS matching_files,
    EXISTS (SELECT 1 FROM renewals WHERE workspace_id<>invoice.workspace_id
      OR record->>'status' IS NULL OR record->>'status' NOT IN ('approved','rejected','cancelled'))
      OR EXISTS (SELECT 1 FROM payments WHERE workspace_id<>invoice.workspace_id
        OR record->>'status' IS NULL OR record->>'status' NOT IN ('approved','rejected'))
      OR EXISTS (SELECT 1 FROM proofs WHERE workspace_id<>invoice.workspace_id)
      OR EXISTS (SELECT 1 FROM public.subscription_invoices live WHERE live.id=invoice.record_id)
      OR EXISTS (SELECT 1 FROM public.subscription_renewal_requests live JOIN renewals archived ON archived.record_id=live.id)
      OR EXISTS (SELECT 1 FROM public.subscription_payments live JOIN payments archived ON archived.record_id=live.id)
      OR EXISTS (SELECT 1 FROM public.subscription_payment_proofs live JOIN proofs archived
        ON archived.record_id=live.id OR archived.record->>'storage_path'=live.storage_path)
      AS scope_requires_review
  INTO counts;

  result := CASE
    WHEN EXISTS (SELECT 1 FROM mushavo_account_deletion.retention_holds hold
      WHERE hold.record_kind='billing_invoice' AND hold.record_id=p_invoice) THEN 'held'
    WHEN invoice.record->>'id' IS DISTINCT FROM p_invoice::text
      OR invoice.record->>'workspace_id' IS DISTINCT FROM invoice.workspace_id::text
      OR invoice.record->>'status' IS NULL OR invoice.record->>'status' NOT IN ('paid','rejected','cancelled')
      OR counts.scope_requires_review OR counts.proofs<>counts.matching_files THEN 'review_required'
    WHEN actual_end >= statement_timestamp()::date THEN 'within_retention_window'
    ELSE 'ready_for_expiry_review'
  END;
  RETURN jsonb_build_object('status',result,'baseline_last_day',baseline_end,
    'approved_last_day',actual_end,'eligible_from',actual_end+1,'renewals',counts.renewals,
    'payments',counts.payments,'proofs',counts.proofs,'verified_proof_objects',counts.matching_files);
END;
$$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.preview_archived_invoice_retention(uuid,date,date,date,date)
  FROM PUBLIC,anon,authenticated,service_role;
