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
