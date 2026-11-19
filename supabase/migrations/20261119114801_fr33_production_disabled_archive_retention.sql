SET LOCAL lock_timeout='3s';
-- Staging source 20261118124452 fr33_expire_closed_support_and_erasure_receipts.
-- The owner-approved schedule applies to closed archived support and completed erasure receipts.
-- The executor is private, initially disabled, and is not scheduled by this migration.
CREATE TABLE mushavo_account_deletion.retention_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  fixture_support_ids uuid[],
  fixture_request_ids uuid[],
  CHECK ((fixture_support_ids IS NULL) = (fixture_request_ids IS NULL))
);
INSERT INTO mushavo_account_deletion.retention_control DEFAULT VALUES;

CREATE TABLE mushavo_account_deletion.retention_holds (
  record_kind text NOT NULL CHECK (record_kind IN ('support_case','erasure_receipt','billing_invoice')),
  record_id uuid NOT NULL,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  review_at timestamptz NOT NULL CHECK (review_at > recorded_at),
  PRIMARY KEY (record_kind,record_id)
);

CREATE TABLE mushavo_account_deletion.anonymous_support_totals (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  ticket_count bigint NOT NULL DEFAULT 0 CHECK (ticket_count >= 0),
  message_count bigint NOT NULL DEFAULT 0 CHECK (message_count >= 0)
);
INSERT INTO mushavo_account_deletion.anonymous_support_totals DEFAULT VALUES;

ALTER TABLE mushavo_account_deletion.retention_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE mushavo_account_deletion.retention_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE mushavo_account_deletion.anonymous_support_totals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.retention_control, mushavo_account_deletion.retention_holds,
  mushavo_account_deletion.anonymous_support_totals FROM PUBLIC,anon,authenticated,service_role;

CREATE INDEX fr33_archive_support_closed_candidates
  ON mushavo_account_deletion.retained_support_records (archived_at,ticket_id)
  WHERE record_type = 'ticket' AND record->>'status' = 'closed';

CREATE INDEX fr33_completed_erasure_candidates
  ON mushavo_account_deletion.requests (completed_at,id) WHERE completed_at IS NOT NULL;

CREATE FUNCTION mushavo_account_deletion.support_archive_closed_at(p_record jsonb)
RETURNS timestamptz LANGUAGE plpgsql STABLE
SET search_path TO 'pg_catalog'
SET timezone TO 'UTC'
AS $$
DECLARE
  closed_at timestamptz;
  created_at timestamptz;
BEGIN
  IF jsonb_typeof(p_record) IS DISTINCT FROM 'object' THEN RETURN NULL; END IF;
  IF p_record->>'status' IS DISTINCT FROM 'closed'
    OR (p_record - ARRAY['id','customer_id','workspace_id','created_by','assigned_admin_id','subject',
      'description','category','priority','status','created_at','updated_at','resolved_at']) <> '{}'::jsonb
    OR coalesce(p_record->>'resolved_at','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
    OR coalesce(p_record->>'created_at','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
    OR NOT pg_input_is_valid(p_record->>'resolved_at','timestamp with time zone')
    OR NOT pg_input_is_valid(p_record->>'created_at','timestamp with time zone')
  THEN RETURN NULL; END IF;
  closed_at := (p_record->>'resolved_at')::timestamptz;
  created_at := (p_record->>'created_at')::timestamptz;
  IF closed_at < created_at THEN RETURN NULL; END IF;
  RETURN closed_at;
END;
$$;

CREATE FUNCTION mushavo_account_deletion.process_retention_batch(p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
SET lock_timeout TO '2s'
SET timezone TO 'UTC'
AS $$
DECLARE
  control mushavo_account_deletion.retention_control%ROWTYPE;
  cutoff timestamptz := statement_timestamp();
  removed_tickets bigint;
  removed_messages bigint;
  telemetry_count bigint;
  receipt_count bigint;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'FR33_RETENTION_INVALID_BATCH_SIZE';
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtextextended('fr33-retention-processor',0)) THEN
    RETURN jsonb_build_object('status','busy');
  END IF;
  SELECT * INTO STRICT control FROM mushavo_account_deletion.retention_control WHERE singleton FOR SHARE;
  IF NOT control.enabled THEN RETURN jsonb_build_object('status','disabled'); END IF;
  LOCK TABLE mushavo_account_deletion.retention_holds IN SHARE MODE;

  -- A closed case is processed as one unit. A later message, unknown payload or active hold keeps it in review.
  WITH eligible AS MATERIALIZED (
    SELECT ticket.ticket_id
    FROM mushavo_account_deletion.retained_support_records ticket
    WHERE ticket.record_type='ticket' AND ticket.record_id=ticket.ticket_id AND ticket.record->>'status'='closed'
      AND ticket.record->>'id'=ticket.ticket_id::text
      AND NOT EXISTS (SELECT 1 FROM public.support_tickets live WHERE live.id=ticket.ticket_id)
      AND (control.fixture_support_ids IS NULL OR ticket.ticket_id=ANY(control.fixture_support_ids))
      AND mushavo_account_deletion.support_archive_closed_at(ticket.record) + interval '24 months' <= cutoff
      AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.retention_holds hold
        WHERE hold.record_kind='support_case' AND hold.record_id=ticket.ticket_id)
      AND NOT EXISTS (
        SELECT 1 FROM mushavo_account_deletion.retained_support_records message
        WHERE message.ticket_id=ticket.ticket_id AND message.record_type='message'
          AND CASE WHEN jsonb_typeof(message.record) IS DISTINCT FROM 'object' THEN true
            WHEN (message.record - ARRAY['id','ticket_id','author_id','body','is_internal','created_at']) <> '{}'::jsonb
             OR message.record->>'id' IS DISTINCT FROM message.record_id::text
             OR message.record->>'ticket_id' IS DISTINCT FROM ticket.ticket_id::text
             OR coalesce(message.record->>'created_at','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
             OR NOT pg_input_is_valid(message.record->>'created_at','timestamp with time zone')
            THEN true ELSE (message.record->>'created_at')::timestamptz > mushavo_account_deletion.support_archive_closed_at(ticket.record) END
      )
    ORDER BY ticket.archived_at,ticket.ticket_id LIMIT p_limit FOR UPDATE OF ticket SKIP LOCKED
  ), removed AS (
    DELETE FROM mushavo_account_deletion.retained_support_records archived
    USING eligible WHERE archived.ticket_id=eligible.ticket_id
    RETURNING archived.record_type
  )
  SELECT count(*) FILTER (WHERE record_type='ticket'), count(*) FILTER (WHERE record_type='message')
  INTO removed_tickets,removed_messages FROM removed;

  UPDATE mushavo_account_deletion.anonymous_support_totals totals
  SET ticket_count=totals.ticket_count+removed_tickets,
      message_count=totals.message_count+removed_messages
  WHERE totals.singleton AND (removed_tickets>0 OR removed_messages>0);

  -- An unresolved erasure can still need its retry record. Preserve it until it completes.
  WITH eligible AS (
    SELECT attempt.request_id
    FROM mushavo_account_deletion.processor_attempts attempt
    JOIN mushavo_account_deletion.requests request ON request.id=attempt.request_id
    WHERE request.completed_at IS NOT NULL AND request.subject_id IS NULL
      AND attempt.attempted_at <= cutoff - interval '90 days'
      AND (control.fixture_request_ids IS NULL OR request.id=ANY(control.fixture_request_ids))
      AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.retention_holds hold
        WHERE hold.record_kind='erasure_receipt' AND hold.record_id=request.id)
    ORDER BY attempt.attempted_at,attempt.request_id LIMIT p_limit FOR UPDATE OF attempt SKIP LOCKED
  )
  DELETE FROM mushavo_account_deletion.processor_attempts attempt USING eligible
  WHERE attempt.request_id=eligible.request_id;
  GET DIAGNOSTICS telemetry_count = ROW_COUNT;

  WITH eligible AS (
    SELECT request.id FROM mushavo_account_deletion.requests request
    WHERE request.completed_at <= cutoff - interval '12 months' AND request.subject_id IS NULL
      AND request.cancelled_at IS NULL AND request.workspace_impact_token IS NULL
      AND request.workspace_impact_confirmed_at IS NULL AND request.storage_before_auth_at IS NULL
      AND (control.fixture_request_ids IS NULL OR request.id=ANY(control.fixture_request_ids))
      AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.retention_holds hold
        WHERE hold.record_kind='erasure_receipt' AND hold.record_id=request.id)
      AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.file_cleanup_targets target WHERE target.request_id=request.id)
      AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.shared_proof_handoffs handoff WHERE handoff.request_id=request.id)
      AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.processor_control deletion WHERE deletion.fixture_request_id=request.id)
      AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.processor_attempts attempt
        WHERE attempt.request_id=request.id AND attempt.attempted_at > cutoff - interval '90 days')
    ORDER BY request.completed_at,request.id LIMIT p_limit FOR UPDATE OF request SKIP LOCKED
  )
  DELETE FROM mushavo_account_deletion.requests request USING eligible WHERE request.id=eligible.id;
  GET DIAGNOSTICS receipt_count = ROW_COUNT;

  RETURN jsonb_build_object('status','processed','support_tickets',removed_tickets,'support_messages',removed_messages,
    'deletion_processing_logs',telemetry_count,'deletion_receipts',receipt_count);
END;
$$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.support_archive_closed_at(jsonb),
  mushavo_account_deletion.process_retention_batch(integer) FROM PUBLIC,anon,authenticated,service_role;


-- Staging source 20261118125022 fr33_scope_archived_support_access_and_closure.
-- The live support trigger preserves resolved_at when a resolved case is later closed.
-- Use the final update as a conservative closure anchor for existing archived cases.
DO $migration$
DECLARE
  definition text := pg_get_functiondef('mushavo_account_deletion.support_archive_closed_at(jsonb)'::regprocedure);
  anchor text := '  closed_at := (p_record->>''resolved_at'')::timestamptz;';
BEGIN
  IF cardinality(string_to_array(definition,anchor)) <> 2 THEN
    RAISE EXCEPTION 'FR33_SUPPORT_CLOSURE_ANCHOR_CHANGED';
  END IF;
  EXECUTE replace(definition,anchor,$closure$  IF coalesce(p_record->>'updated_at','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
    OR NOT pg_input_is_valid(p_record->>'updated_at','timestamp with time zone')
  THEN RETURN NULL; END IF;
  closed_at := greatest((p_record->>'resolved_at')::timestamptz,(p_record->>'updated_at')::timestamptz);$closure$);
END;
$migration$;

CREATE FUNCTION public.fr33_assigned_support_archive(p_ticket_id uuid,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
DECLARE
  actor uuid := auth.uid();
  ticket jsonb;
  messages jsonb;
BEGIN
  PERFORM mushavo_email_auth.require_application_session();
  IF actor IS NULL OR NOT public.is_platform_staff(ARRAY['super_admin','admin_staff','support_staff']) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FR33_SUPPORT_ARCHIVE_STAFF_REQUIRED';
  END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN RAISE EXCEPTION 'FR33_SUPPORT_ARCHIVE_OFFSET_INVALID'; END IF;

  SELECT archived.record INTO ticket
  FROM mushavo_account_deletion.retained_support_records archived
  WHERE archived.record_type='ticket' AND archived.record_id=p_ticket_id AND archived.ticket_id=p_ticket_id
    AND archived.record->>'assigned_admin_id'=actor::text;
  IF ticket IS NULL THEN RETURN NULL; END IF;

  SELECT coalesce(jsonb_agg(page.record ORDER BY page.created_at,page.record_id),'[]'::jsonb) INTO messages
  FROM (
    SELECT message.record,message.record->>'created_at' AS created_at,message.record_id
    FROM mushavo_account_deletion.retained_support_records message
    WHERE message.ticket_id=p_ticket_id AND message.record_type='message'
    ORDER BY message.record->>'created_at',message.record_id LIMIT 100 OFFSET p_offset
  ) page;
  RETURN jsonb_build_object('ticket',ticket,'messages',messages);
END;
$$;

CREATE FUNCTION public.fr33_assign_support_archive(p_ticket_id uuid,p_assignee uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
BEGIN
  PERFORM mushavo_email_auth.require_application_session();
  IF auth.uid() IS NULL OR NOT public.is_platform_staff(ARRAY['super_admin','admin_staff']) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FR33_SUPPORT_ARCHIVE_MANAGER_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.app_admins admin JOIN public.profiles profile ON profile.id=admin.user_id
    WHERE admin.user_id=p_assignee AND admin.role IN ('super_admin','admin_staff','support_staff')
      AND profile.account_status='active')
  THEN RETURN false; END IF;

  UPDATE mushavo_account_deletion.retained_support_records archived
  SET record=jsonb_set(archived.record,'{assigned_admin_id}',to_jsonb(p_assignee),true)
  WHERE archived.record_type='ticket' AND archived.record_id=p_ticket_id AND archived.ticket_id=p_ticket_id
    AND jsonb_typeof(archived.record)='object';
  RETURN FOUND;
END;
$$;

CREATE FUNCTION public.fr33_close_support_archive(p_ticket_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
DECLARE
  actor uuid := auth.uid();
  closed_at timestamptz := statement_timestamp();
BEGIN
  PERFORM mushavo_email_auth.require_application_session();
  IF actor IS NULL OR NOT public.is_platform_staff(ARRAY['super_admin','admin_staff','support_staff']) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FR33_SUPPORT_ARCHIVE_STAFF_REQUIRED';
  END IF;

  UPDATE mushavo_account_deletion.retained_support_records archived
  SET record=archived.record || jsonb_build_object('status','closed','updated_at',closed_at,'resolved_at',closed_at)
  WHERE archived.record_type='ticket' AND archived.record_id=p_ticket_id AND archived.ticket_id=p_ticket_id
    AND archived.record->>'assigned_admin_id'=actor::text
    AND archived.record->>'status' IN ('open','in_progress','waiting_customer','resolved');
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.fr33_assigned_support_archive(uuid,integer),public.fr33_assign_support_archive(uuid,uuid),
  public.fr33_close_support_archive(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.fr33_assigned_support_archive(uuid,integer),public.fr33_assign_support_archive(uuid,uuid),
  public.fr33_close_support_archive(uuid) TO authenticated;


-- Staging source 20261118125157 fr33_preview_financial_archive_retention.
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


-- Staging source 20261119072928 fr33_preview_zimbabwe_billing_retention.
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


-- Staging source 20261119083316 fr33_expire_reviewed_billing_archives.
-- An operator reviews one closed workspace archive at a time. The signed worker processes only queued cases.
CREATE TABLE mushavo_account_deletion.billing_expiry_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  fixture_workspace_id uuid
);
INSERT INTO mushavo_account_deletion.billing_expiry_control DEFAULT VALUES;

CREATE TABLE mushavo_account_deletion.billing_expiry_cases (
  workspace_id uuid PRIMARY KEY,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  eligible_from date NOT NULL CHECK (isfinite(eligible_from)),
  retry_after timestamptz,
  committed_at timestamptz,
  lease_id uuid,
  lease_path text,
  lease_until timestamptz,
  CHECK ((lease_id IS NULL AND lease_path IS NULL AND lease_until IS NULL)
    OR (lease_id IS NOT NULL AND lease_path IS NOT NULL AND lease_until IS NOT NULL AND committed_at IS NOT NULL))
);
CREATE INDEX fr33_billing_expiry_due ON mushavo_account_deletion.billing_expiry_cases (eligible_from,workspace_id);

CREATE TABLE mushavo_account_deletion.anonymous_billing_totals (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  invoice_count bigint NOT NULL DEFAULT 0 CHECK (invoice_count >= 0),
  payment_count bigint NOT NULL DEFAULT 0 CHECK (payment_count >= 0),
  proof_count bigint NOT NULL DEFAULT 0 CHECK (proof_count >= 0)
);
INSERT INTO mushavo_account_deletion.anonymous_billing_totals DEFAULT VALUES;

ALTER TABLE mushavo_account_deletion.billing_expiry_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE mushavo_account_deletion.billing_expiry_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE mushavo_account_deletion.anonymous_billing_totals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.billing_expiry_control, mushavo_account_deletion.billing_expiry_cases,
  mushavo_account_deletion.anonymous_billing_totals FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE mushavo_account_deletion.retention_holds DROP CONSTRAINT retention_holds_record_kind_check,
  ADD CONSTRAINT retention_holds_record_kind_check
    CHECK (record_kind IN ('support_case','erasure_receipt','billing_invoice','billing_workspace'));

CREATE FUNCTION mushavo_account_deletion.guard_committed_billing_expiry_hold()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
DECLARE
  workspace uuid;
BEGIN
  IF NEW.record_kind NOT IN ('billing_workspace','billing_invoice') THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('fr33-billing-archive-expiry',0));
  IF NEW.record_kind = 'billing_workspace' THEN
    workspace := NEW.record_id;
  ELSE
    SELECT archived.workspace_id INTO workspace FROM mushavo_account_deletion.retained_billing_records archived
    WHERE archived.record_type='invoice' AND archived.record_id=NEW.record_id;
  END IF;
  IF EXISTS (SELECT 1 FROM mushavo_account_deletion.billing_expiry_cases queued
    WHERE queued.workspace_id=workspace AND queued.committed_at IS NOT NULL)
  THEN RAISE EXCEPTION 'FR33_BILLING_EXPIRY_ALREADY_COMMITTED'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER fr33_billing_hold_before_expiry BEFORE INSERT OR UPDATE OF record_kind,record_id
  ON mushavo_account_deletion.retention_holds FOR EACH ROW
  EXECUTE FUNCTION mushavo_account_deletion.guard_committed_billing_expiry_hold();

CREATE FUNCTION mushavo_account_deletion.billing_expiry_is_held(p_workspace uuid)
RETURNS boolean LANGUAGE sql STABLE
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM mushavo_account_deletion.retention_holds hold
    WHERE (hold.record_kind='billing_workspace' AND hold.record_id=p_workspace)
      OR (hold.record_kind='billing_invoice' AND EXISTS (
        SELECT 1 FROM mushavo_account_deletion.retained_billing_records invoice
        WHERE invoice.workspace_id=p_workspace AND invoice.record_type='invoice' AND invoice.record_id=hold.record_id
      ))
  );
$$;

CREATE FUNCTION mushavo_account_deletion.billing_expiry_fingerprint(p_workspace uuid)
RETURNS text LANGUAGE sql STABLE
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
  SELECT encode(sha256(convert_to(jsonb_build_array(
    (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.record_type,row.record_id)
      FROM mushavo_account_deletion.retained_billing_records row WHERE row.workspace_id=p_workspace),
    (SELECT jsonb_agg(to_jsonb(actor) ORDER BY actor.relation_name,actor.record_id,actor.field_name)
      FROM mushavo_account_deletion.retained_billing_actors actor WHERE actor.workspace_id=p_workspace),
    (SELECT jsonb_agg(to_jsonb(proof) ORDER BY proof.path)
      FROM mushavo_account_deletion.retained_subscription_proofs proof WHERE proof.workspace_id=p_workspace)
  )::text,'UTF8')),'hex');
$$;

CREATE FUNCTION mushavo_account_deletion.billing_expiry_scope_valid(p_workspace uuid,p_allow_absent_objects boolean)
RETURNS boolean LANGUAGE sql STABLE
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
  WITH records AS MATERIALIZED (
    SELECT record_type,record_id,record FROM mushavo_account_deletion.retained_billing_records
    WHERE workspace_id=p_workspace
  ), proofs AS MATERIALIZED (
    SELECT * FROM mushavo_account_deletion.retained_subscription_proofs WHERE workspace_id=p_workspace
  )
  SELECT NOT EXISTS (SELECT 1 FROM public.budget_workspaces WHERE id=p_workspace)
    AND EXISTS (SELECT 1 FROM records WHERE record_type='invoice')
    AND NOT mushavo_account_deletion.billing_expiry_is_held(p_workspace)
    AND NOT EXISTS (SELECT 1 FROM public.subscription_invoices WHERE workspace_id=p_workspace)
    AND NOT EXISTS (SELECT 1 FROM public.subscription_renewal_requests WHERE workspace_id=p_workspace OR provisioned_workspace_id=p_workspace)
    AND NOT EXISTS (SELECT 1 FROM public.subscription_payments WHERE workspace_id=p_workspace)
    AND NOT EXISTS (SELECT 1 FROM public.workspace_subscriptions WHERE workspace_id=p_workspace)
    AND NOT EXISTS (SELECT 1 FROM public.admin_subscription_grants WHERE workspace_id=p_workspace)
    AND NOT EXISTS (SELECT 1 FROM public.subscription_entitlement_history WHERE workspace_id=p_workspace)
    AND NOT EXISTS (SELECT 1 FROM public.subscription_audit_events WHERE workspace_id=p_workspace)
    AND NOT EXISTS (SELECT 1 FROM public.payment_conversions conversion WHERE conversion.entity_type='subscription_payment'
      AND (conversion.workspace_id=p_workspace OR EXISTS (SELECT 1 FROM records payment
        WHERE payment.record_type='payment' AND payment.record_id=conversion.entity_id)))
    AND NOT EXISTS (SELECT 1 FROM public.business_subscription_quotes WHERE workspace_id=p_workspace)
    AND NOT EXISTS (SELECT 1 FROM public.business_public_purchases WHERE source_workspace_id=p_workspace OR provisioned_workspace_id=p_workspace)
    AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.shared_proof_handoffs WHERE workspace_id=p_workspace)
    AND NOT EXISTS (
      SELECT 1 FROM mushavo_account_deletion.retained_billing_records other
      JOIN records linked ON linked.record_id::text IN (other.record->>'invoice_id',
        other.record->>'renewal_request_id',other.record->>'payment_id',other.record->>'subscription_id',
        other.record->>'business_quote_id',other.record->>'request_id',other.record->>'entity_id',other.record->>'target_id')
      WHERE other.workspace_id<>p_workspace
    )
    AND NOT EXISTS (
      SELECT 1 FROM records child
      WHERE child.record_type IN ('renewal','payment','proof','review','conversion')
        AND NOT EXISTS (SELECT 1 FROM records parent
          WHERE parent.record_type=CASE child.record_type WHEN 'renewal' THEN 'invoice' WHEN 'payment' THEN 'renewal' ELSE 'payment' END
            AND parent.record_id::text=CASE child.record_type WHEN 'renewal' THEN child.record->>'invoice_id'
              WHEN 'payment' THEN child.record->>'renewal_request_id' WHEN 'conversion' THEN child.record->>'entity_id'
              ELSE child.record->>'payment_id' END)
    )
    AND NOT EXISTS (
      SELECT 1 FROM records row
      WHERE row.record_type='proof' AND NOT EXISTS (
        SELECT 1 FROM proofs proof WHERE proof.proof_id=row.record_id AND proof.path=row.record->>'storage_path'
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM proofs proof
      LEFT JOIN records row ON row.record_type='proof' AND row.record_id=proof.proof_id
      LEFT JOIN storage.objects object ON object.bucket_id='subscription-proofs' AND object.name=proof.path
      WHERE row.record_id IS NULL OR row.record->>'storage_path' IS DISTINCT FROM proof.path
        OR NOT starts_with(proof.path,'workspaces/'||p_workspace::text||'/')
        OR NOT mushavo_account_deletion.subscription_proof_shape(
          proof.path,row.record->>'mime_type',CASE WHEN pg_input_is_valid(row.record->>'size_bytes','bigint')
            THEN (row.record->>'size_bytes')::bigint END)
        OR EXISTS (SELECT 1 FROM public.subscription_payment_proofs live WHERE live.id=proof.proof_id OR live.storage_path=proof.path)
        OR EXISTS (SELECT 1 FROM mushavo_file_ingest.subscription_uploads upload WHERE upload.path=proof.path)
        OR (object.id IS NULL AND NOT p_allow_absent_objects)
        OR (object.id IS NOT NULL AND (
          (object.id,object.version) IS DISTINCT FROM (proof.storage_object_id,proof.storage_object_version)
          OR object.owner IS NOT NULL OR object.owner_id IS NOT NULL OR object.archived_at IS NOT NULL
          OR object.is_delete_marker IS DISTINCT FROM false
          OR object.metadata->>'mimetype' IS DISTINCT FROM row.record->>'mime_type'
          OR coalesce(object.metadata->>'size',object.metadata->>'contentLength') IS DISTINCT FROM row.record->>'size_bytes'
        ))
    )
    AND (
      NOT EXISTS (SELECT 1 FROM proofs)
      OR EXISTS (SELECT 1 FROM storage.buckets bucket WHERE bucket.id='subscription-proofs'
        AND bucket.public IS FALSE AND bucket.versioning_status='DISABLED' AND bucket.lifecycle_configuration IS NULL)
    );
$$;

CREATE FUNCTION mushavo_account_deletion.prepare_billing_archive_expiry(
  p_workspace uuid,p_reviewed_archive_retain_through date,p_invoice_dates jsonb
)
RETURNS date LANGUAGE plpgsql
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
SET timezone TO 'UTC'
AS $$
DECLARE
  item record;
  preview jsonb;
  reviewed_count bigint;
  eligible date := p_reviewed_archive_retain_through + 1;
BEGIN
  IF p_workspace IS NULL OR p_reviewed_archive_retain_through IS NULL
    OR NOT isfinite(p_reviewed_archive_retain_through)
    OR jsonb_typeof(p_invoice_dates) IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'FR33_BILLING_EXPIRY_REVIEW_REQUIRED'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('fr33-billing-archive-expiry',0));
  IF EXISTS (SELECT 1 FROM mushavo_account_deletion.billing_expiry_cases queued
    WHERE queued.workspace_id=p_workspace AND queued.committed_at IS NOT NULL)
  THEN RAISE EXCEPTION 'FR33_BILLING_EXPIRY_ALREADY_COMMITTED'; END IF;
  IF NOT mushavo_account_deletion.billing_expiry_scope_valid(p_workspace,false)
  THEN RAISE EXCEPTION 'FR33_BILLING_EXPIRY_SCOPE_REVIEW_REQUIRED'; END IF;

  SELECT count(DISTINCT invoice_id) INTO reviewed_count
  FROM jsonb_to_recordset(p_invoice_dates) AS item(invoice_id uuid);
  IF reviewed_count <> jsonb_array_length(p_invoice_dates)
    OR reviewed_count <> (SELECT count(*) FROM mushavo_account_deletion.retained_billing_records row
      WHERE row.workspace_id=p_workspace AND row.record_type='invoice')
  THEN RAISE EXCEPTION 'FR33_BILLING_EXPIRY_INVOICE_COVERAGE_REQUIRED'; END IF;

  FOR item IN SELECT * FROM jsonb_to_recordset(p_invoice_dates) AS invoice(
    invoice_id uuid, booked_on date, fiscal_year_start date, fiscal_year_end date,
    last_accounting_entry_on date, vat_record_kind text, vat_reference_on date, additional_required_until date)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.retained_billing_records row
      WHERE row.workspace_id=p_workspace AND row.record_type='invoice' AND row.record_id=item.invoice_id)
    THEN RAISE EXCEPTION 'FR33_BILLING_EXPIRY_INVOICE_SCOPE_CHANGED'; END IF;
    preview := mushavo_account_deletion.preview_zw_invoice_retention(
      item.invoice_id,item.booked_on,item.fiscal_year_start,item.fiscal_year_end,item.last_accounting_entry_on,
      item.vat_record_kind,item.vat_reference_on,item.additional_required_until);
    IF preview->>'status' NOT IN ('ready_for_expiry_review','within_retention_window')
      OR preview->>'eligible_from' IS NULL
    THEN RAISE EXCEPTION 'FR33_BILLING_EXPIRY_DATE_EVIDENCE_REQUIRED'; END IF;
    eligible := greatest(eligible,(preview->>'eligible_from')::date);
  END LOOP;

  INSERT INTO mushavo_account_deletion.billing_expiry_cases(workspace_id,fingerprint,eligible_from)
  VALUES(p_workspace,mushavo_account_deletion.billing_expiry_fingerprint(p_workspace),eligible)
  ON CONFLICT (workspace_id) DO UPDATE
    SET fingerprint=excluded.fingerprint,eligible_from=excluded.eligible_from,retry_after=NULL;
  RETURN eligible;
END;
$$;

-- With no arguments the signed worker claims the next job. With a lease it acknowledges physical deletion.
CREATE FUNCTION public.fr33_billing_archive_expiry_step(p_workspace uuid DEFAULT NULL,p_lease uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
SET lock_timeout TO '2s'
SET timezone TO 'UTC'
AS $$
DECLARE
  control mushavo_account_deletion.billing_expiry_control%ROWTYPE;
  queued mushavo_account_deletion.billing_expiry_cases%ROWTYPE;
  next_proof record;
  lease uuid;
  invoices bigint;
  payments bigint;
  proofs bigint;
  now_at timestamptz := statement_timestamp();
BEGIN
  IF (p_workspace IS NULL) <> (p_lease IS NULL)
    OR NOT pg_try_advisory_xact_lock(hashtextextended('fr33-billing-archive-expiry',0))
  THEN RETURN NULL; END IF;

  SELECT * INTO STRICT control FROM mushavo_account_deletion.billing_expiry_control WHERE singleton FOR SHARE;
  IF NOT control.enabled THEN RETURN NULL; END IF;

  SELECT * INTO queued FROM mushavo_account_deletion.billing_expiry_cases task
  WHERE (control.fixture_workspace_id IS NULL OR task.workspace_id=control.fixture_workspace_id)
    AND task.eligible_from<=now_at::date
    AND ((p_workspace IS NULL AND coalesce(task.retry_after,'-infinity')<=now_at
        AND coalesce(task.lease_until,'-infinity')<=now_at
        AND NOT mushavo_account_deletion.billing_expiry_is_held(task.workspace_id))
      OR (task.workspace_id=p_workspace AND task.lease_id=p_lease AND task.lease_until>now_at))
  ORDER BY task.eligible_from,task.workspace_id LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF mushavo_account_deletion.billing_expiry_fingerprint(queued.workspace_id) IS DISTINCT FROM queued.fingerprint
    OR NOT mushavo_account_deletion.billing_expiry_scope_valid(queued.workspace_id,queued.committed_at IS NOT NULL)
  THEN
    UPDATE mushavo_account_deletion.billing_expiry_cases SET retry_after=now_at+interval '1 day'
    WHERE workspace_id=queued.workspace_id;
    RETURN jsonb_build_object('status','review_required');
  END IF;

  IF p_workspace IS NOT NULL AND EXISTS (SELECT 1 FROM storage.objects object
    WHERE object.bucket_id='subscription-proofs' AND object.name=queued.lease_path)
  THEN RETURN jsonb_build_object('status','proof_still_present'); END IF;

  SELECT proof.path,proof.storage_object_id AS object_id INTO next_proof
  FROM mushavo_account_deletion.retained_subscription_proofs proof JOIN storage.objects object
    ON object.bucket_id='subscription-proofs' AND object.name=proof.path
    AND object.id=proof.storage_object_id AND object.version=proof.storage_object_version
  WHERE proof.workspace_id=queued.workspace_id ORDER BY proof.path LIMIT 1;
  IF FOUND THEN
    IF p_workspace IS NOT NULL THEN
      UPDATE mushavo_account_deletion.billing_expiry_cases SET lease_id=NULL,lease_path=NULL,lease_until=NULL,retry_after=NULL
      WHERE workspace_id=queued.workspace_id;
      RETURN jsonb_build_object('status','proof_confirmed');
    END IF;

    lease := gen_random_uuid();
    UPDATE mushavo_account_deletion.billing_expiry_cases SET committed_at=coalesce(committed_at,now_at),
      lease_id=lease,lease_path=next_proof.path,lease_until=now_at+interval '2 minutes'
    WHERE workspace_id=queued.workspace_id;
    RETURN jsonb_build_object('status','remove_proof','workspace_id',queued.workspace_id,
      'lease_id',lease,'object_id',next_proof.object_id,'path',next_proof.path);
  END IF;

  -- Any object surviving at a reviewed path prevents raw-record retirement.
  IF EXISTS (SELECT 1 FROM mushavo_account_deletion.retained_subscription_proofs proof JOIN storage.objects object
      ON object.bucket_id='subscription-proofs' AND object.name=proof.path WHERE proof.workspace_id=queued.workspace_id)
  THEN RETURN jsonb_build_object('status','review_required'); END IF;

  DELETE FROM mushavo_account_deletion.retained_subscription_proofs WHERE workspace_id=queued.workspace_id;
  DELETE FROM mushavo_account_deletion.retained_billing_actors WHERE workspace_id=queued.workspace_id;
  WITH removed AS (
    DELETE FROM mushavo_account_deletion.retained_billing_records WHERE workspace_id=queued.workspace_id
    RETURNING record_type
  )
  SELECT count(*) FILTER (WHERE record_type='invoice'),count(*) FILTER (WHERE record_type='payment'),
    count(*) FILTER (WHERE record_type='proof') INTO invoices,payments,proofs FROM removed;
  UPDATE mushavo_account_deletion.anonymous_billing_totals SET invoice_count=invoice_count+invoices,
    payment_count=payment_count+payments,proof_count=proof_count+proofs WHERE singleton;
  DELETE FROM mushavo_account_deletion.billing_expiry_cases WHERE workspace_id=queued.workspace_id;
  RETURN jsonb_build_object('status','completed','invoices',invoices,'payments',payments,'proofs',proofs);
END;
$$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.guard_committed_billing_expiry_hold(),
  mushavo_account_deletion.billing_expiry_is_held(uuid),mushavo_account_deletion.billing_expiry_fingerprint(uuid),
  mushavo_account_deletion.billing_expiry_scope_valid(uuid,boolean),
  mushavo_account_deletion.prepare_billing_archive_expiry(uuid,date,jsonb),
  public.fr33_billing_archive_expiry_step(uuid,uuid)
FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.fr33_billing_archive_expiry_step(uuid,uuid) TO service_role;


-- Staging source 20261119085608 fr33_list_assigned_support_archive.
-- List only the archived cases assigned to the current authorized staff member.
CREATE FUNCTION public.fr33_list_assigned_support_archive(p_after uuid DEFAULT NULL)
RETURNS TABLE (ticket_id uuid, subject text, status text, archived_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  PERFORM mushavo_email_auth.require_application_session();
  IF actor IS NULL OR NOT public.is_platform_staff(ARRAY['super_admin','admin_staff','support_staff']) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='FR33_SUPPORT_ARCHIVE_STAFF_REQUIRED';
  END IF;

  -- Return one extra row so clients can show a next-page control without a total.
  RETURN QUERY
  SELECT archived.ticket_id, archived.record->>'subject', archived.record->>'status', archived.archived_at
  FROM mushavo_account_deletion.retained_support_records archived
  WHERE archived.record_type='ticket' AND archived.record_id=archived.ticket_id
    AND archived.record->>'assigned_admin_id'=actor::text
    AND (p_after IS NULL OR archived.record_id > p_after)
  ORDER BY archived.record_id
  LIMIT 21;
END;
$$;

REVOKE ALL ON FUNCTION public.fr33_list_assigned_support_archive(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fr33_list_assigned_support_archive(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.fr33_list_assigned_support_archive(uuid),public.fr33_assigned_support_archive(uuid,integer),
 public.fr33_assign_support_archive(uuid,uuid),public.fr33_close_support_archive(uuid),public.fr33_billing_archive_expiry_step(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
