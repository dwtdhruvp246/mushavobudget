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
