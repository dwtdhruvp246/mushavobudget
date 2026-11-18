CREATE TABLE mushavo_account_deletion.retained_support_records (
  record_type text NOT NULL CHECK (record_type IN ('ticket', 'message')),
  record_id uuid NOT NULL,
  ticket_id uuid NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  record jsonb NOT NULL,
  PRIMARY KEY (record_type, record_id)
);

CREATE INDEX retained_support_records_ticket_idx
  ON mushavo_account_deletion.retained_support_records (ticket_id);

ALTER TABLE mushavo_account_deletion.retained_support_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.retained_support_records
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION mushavo_account_deletion.archive_deleted_customer_support(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
DECLARE
  deleting_customer_id uuid;
  tickets uuid[];
  copied bigint;
  removed bigint;
BEGIN
  SELECT request.subject_id INTO STRICT deleting_customer_id
  FROM mushavo_account_deletion.requests request
  WHERE request.id = p_request_id AND request.subject_id IS NOT NULL
    AND request.cancelled_at IS NULL AND request.workspace_impact_confirmed_at IS NOT NULL;

  -- These locks also prevent a new message from attaching to a ticket being archived.
  SELECT ARRAY(
    SELECT ticket.id FROM public.support_tickets ticket
    WHERE ticket.customer_id = deleting_customer_id ORDER BY ticket.id FOR UPDATE
  ) INTO tickets;
  IF cardinality(tickets) = 0 THEN RETURN; END IF;

  -- Review any new ticket or message dependencies before allowing the cascade.
  IF EXISTS (
    SELECT 1 FROM pg_constraint fk
    WHERE fk.contype = 'f' AND fk.conparentid = 0
      AND fk.confrelid IN ('public.support_tickets'::regclass, 'public.support_ticket_messages'::regclass)
      AND (
        fk.confrelid = 'public.support_tickets'::regclass
        AND fk.conrelid = 'public.support_ticket_messages'::regclass
        AND fk.confdeltype = 'c'
        AND fk.conkey = ARRAY[(SELECT attnum FROM pg_attribute
          WHERE attrelid = fk.conrelid AND attname = 'ticket_id')]
        AND fk.confkey = ARRAY[(SELECT attnum FROM pg_attribute
          WHERE attrelid = fk.confrelid AND attname = 'id')]
      ) IS DISTINCT FROM true
  ) THEN RAISE EXCEPTION 'FR33_SUPPORT_HISTORY_DEPENDENCY_REVIEW_REQUIRED'; END IF;

  PERFORM message.id FROM public.support_ticket_messages message
  WHERE message.ticket_id = ANY(tickets) ORDER BY message.id FOR UPDATE;

  INSERT INTO mushavo_account_deletion.retained_support_records
    (record_type, record_id, ticket_id, record)
  SELECT 'ticket', ticket.id, ticket.id, to_jsonb(ticket)
  FROM public.support_tickets ticket WHERE ticket.id = ANY(tickets)
  UNION ALL
  SELECT 'message', message.id, message.ticket_id, to_jsonb(message)
  FROM public.support_ticket_messages message WHERE message.ticket_id = ANY(tickets);
  GET DIAGNOSTICS copied = ROW_COUNT;

  IF copied <> cardinality(tickets) + (
    SELECT count(*) FROM public.support_ticket_messages WHERE ticket_id = ANY(tickets)
  ) THEN RAISE EXCEPTION 'FR33_SUPPORT_HISTORY_ARCHIVE_INCOMPLETE'; END IF;

  DELETE FROM public.support_tickets WHERE id = ANY(tickets) AND customer_id = deleting_customer_id;
  GET DIAGNOSTICS removed = ROW_COUNT;
  IF removed <> cardinality(tickets) OR EXISTS (
    SELECT 1 FROM public.support_ticket_messages WHERE ticket_id = ANY(tickets)
  ) THEN RAISE EXCEPTION 'FR33_SUPPORT_HISTORY_ARCHIVE_INCOMPLETE'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.archive_deleted_customer_support(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

DO $migration$
DECLARE
  executor text := pg_get_functiondef('mushavo_account_deletion.execute_confirmed_request(uuid)'::regprocedure);
  anchor text := '  PERFORM mushavo_account_deletion.require_owned_workspace_cascades(''public.families''::regclass,family_ids);';
BEGIN
  IF cardinality(string_to_array(executor, anchor)) <> 2
  THEN RAISE EXCEPTION 'FR33_SUPPORT_ERASURE_ANCHOR_CHANGED'; END IF;
  EXECUTE replace(executor, anchor,
    '  PERFORM mushavo_account_deletion.archive_deleted_customer_support(p_request_id);' || E'\n' || anchor);
END;
$migration$;
