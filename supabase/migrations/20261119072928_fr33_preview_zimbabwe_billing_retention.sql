-- Zimbabwe planning for Mushavo's own accounting archive. This is an operator-only preview.
-- Keep each independently applicable period. A planning assumption never yields an expiry-ready result.
CREATE FUNCTION mushavo_account_deletion.preview_zw_invoice_retention(
  p_invoice uuid,
  p_booked_on date,
  p_fiscal_year_start date DEFAULT NULL,
  p_fiscal_year_end date DEFAULT NULL,
  p_last_accounting_entry_on date DEFAULT NULL,
  p_vat_record_kind text DEFAULT NULL,
  p_vat_reference_on date DEFAULT NULL,
  p_additional_required_until date DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
DECLARE
  use_calendar_preview boolean := p_fiscal_year_end IS NULL;
  period_start date;
  period_end date;
  income_tax_last_day date;
  vat_last_day date;
  retain_through date;
  preview jsonb;
BEGIN
  IF (p_fiscal_year_start IS NULL) <> (p_fiscal_year_end IS NULL)
    OR (p_booked_on IS NOT NULL AND NOT isfinite(p_booked_on))
    OR (p_last_accounting_entry_on IS NOT NULL AND
        (NOT isfinite(p_last_accounting_entry_on) OR p_last_accounting_entry_on < p_booked_on))
    OR (p_vat_record_kind IS NOT NULL AND p_vat_record_kind NOT IN ('not_applicable','book','non_book'))
    OR (p_vat_reference_on IS NOT NULL AND
        (NOT isfinite(p_vat_reference_on) OR p_vat_record_kind IS NULL OR p_vat_record_kind='not_applicable'))
    OR (p_additional_required_until IS NOT NULL AND NOT isfinite(p_additional_required_until))
  THEN RAISE EXCEPTION 'FR33_ZW_RETENTION_INPUT_INVALID'; END IF;

  IF NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.retained_billing_records invoice
    WHERE invoice.record_type='invoice' AND invoice.record_id=p_invoice)
  THEN RETURN jsonb_build_object('status','archive_invoice_unavailable'); END IF;
  IF p_booked_on IS NULL THEN RETURN jsonb_build_object('status','booking_date_required'); END IF;

  period_start := CASE WHEN use_calendar_preview THEN date_trunc('year',p_booked_on::timestamp)::date
    ELSE p_fiscal_year_start END;
  period_end := CASE WHEN use_calendar_preview THEN (period_start + interval '1 year')::date - 1
    ELSE p_fiscal_year_end END;

  IF NOT isfinite(period_start) OR NOT isfinite(period_end) OR p_booked_on NOT BETWEEN period_start AND period_end
  THEN RAISE EXCEPTION 'FR33_BILLING_RETENTION_PERIOD_INVALID'; END IF;

  IF p_last_accounting_entry_on IS NULL OR p_vat_record_kind IS NULL
    OR (p_vat_record_kind IN ('book','non_book') AND p_vat_reference_on IS NULL)
  THEN
    RETURN jsonb_build_object('status','statutory_record_dates_required',
      'fiscal_period_source',CASE WHEN use_calendar_preview THEN 'calendar_year_preview' ELSE 'operator_supplied' END,
      'fiscal_year_end',period_end);
  END IF;

  income_tax_last_day := (p_last_accounting_entry_on + interval '6 years')::date;
  IF p_vat_record_kind IN ('book','non_book') THEN
    vat_last_day := (p_vat_reference_on + interval '6 years')::date;
  END IF;
  retain_through := greatest((period_end + interval '6 years')::date,
    income_tax_last_day,vat_last_day,p_additional_required_until);

  preview := mushavo_account_deletion.preview_archived_invoice_retention(
    p_invoice,p_booked_on,period_start,period_end,retain_through);
  IF use_calendar_preview AND preview->>'status' IN ('within_retention_window','ready_for_expiry_review') THEN
    preview := (preview - 'eligible_from') || jsonb_build_object('status','accounting_period_confirmation_required');
  END IF;
  -- Holds, unmatched proof and live references remain explicit throughout the preview.
  IF preview->>'status' IN ('held','review_required') THEN preview := preview - 'eligible_from'; END IF;
  RETURN preview || jsonb_build_object(
    'fiscal_period_source',CASE WHEN use_calendar_preview THEN 'calendar_year_preview' ELSE 'operator_supplied' END,
    'fiscal_year_end',period_end,'income_tax_last_day',income_tax_last_day,'vat_last_day',vat_last_day);
END;
$$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.preview_zw_invoice_retention(uuid,date,date,date,date,text,date,date)
  FROM PUBLIC,anon,authenticated,service_role;
