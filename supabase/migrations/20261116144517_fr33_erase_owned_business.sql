-- Archive the existing audit evidence privately before removing its workspace FK.
CREATE TABLE mushavo_account_deletion.closed_business_audit_events (
  event_id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  event jsonb NOT NULL CHECK (jsonb_typeof(event) = 'object'),
  archived_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
CREATE INDEX closed_business_audit_events_workspace_idx
  ON mushavo_account_deletion.closed_business_audit_events (workspace_id);
ALTER TABLE mushavo_account_deletion.closed_business_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.closed_business_audit_events FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE mushavo_account_deletion.business_audit_erasure_permits (
  transaction_id xid8 PRIMARY KEY,
  subject_id uuid NOT NULL
);
ALTER TABLE mushavo_account_deletion.business_audit_erasure_permits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.business_audit_erasure_permits FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.prevent_business_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog
AS $audit_guard$
DECLARE
  subject uuid;
BEGIN
  -- Other tables that use this guard remain immutable.
  IF TG_RELID = 'public.business_audit_events'::regclass
    AND pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = TG_RELID), 'USAGE')
  THEN
    SELECT permit.subject_id INTO subject FROM mushavo_account_deletion.business_audit_erasure_permits permit
    WHERE permit.transaction_id = pg_current_xact_id_if_assigned();

    IF subject IS NOT NULL THEN
      IF TG_OP = 'DELETE' AND EXISTS (
        SELECT 1 FROM mushavo_account_deletion.closed_business_audit_events archived
        JOIN public.budget_workspaces workspace ON workspace.id = archived.workspace_id
        WHERE archived.event_id = OLD.id AND archived.workspace_id = OLD.workspace_id
          AND archived.event = to_jsonb(OLD)
          AND workspace.workspace_type = 'business' AND workspace.owner_id = subject
      ) THEN RETURN OLD; END IF;
      IF TG_OP = 'UPDATE' AND OLD.actor_id = subject AND NEW.actor_id IS NULL
        AND (to_jsonb(OLD) - 'actor_id') = (to_jsonb(NEW) - 'actor_id')
      THEN RETURN NEW; END IF;
    END IF;
  END IF;
  RAISE EXCEPTION 'BUSINESS_AUDIT_IMMUTABLE';
END;
$audit_guard$;

CREATE FUNCTION mushavo_account_deletion.prepare_business_workspace_erasure(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE
SET search_path TO pg_catalog
SET row_security TO 'off'
AS $prepare$
DECLARE
  subject uuid;
  impact_token text;
  business_ids uuid[];
  copied bigint;
  removed bigint;
BEGIN
  SELECT r.subject_id INTO subject FROM mushavo_account_deletion.requests r
  WHERE r.id = p_request_id AND r.cancelled_at IS NULL AND r.workspace_impact_confirmed_at IS NOT NULL;
  IF subject IS NULL THEN RAISE EXCEPTION 'FR33_CONFIRMED_REQUEST_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('fr33-account-deletion:' || subject::text, 0));
  PERFORM 1 FROM auth.users WHERE id = subject FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FR33_DELETION_SUBJECT_MISSING'; END IF;
  SELECT r.workspace_impact_token INTO impact_token FROM mushavo_account_deletion.requests r
  WHERE r.id = p_request_id AND r.subject_id = subject AND r.cancelled_at IS NULL
    AND r.workspace_impact_confirmed_at IS NOT NULL FOR UPDATE;
  IF impact_token IS NULL OR impact_token IS DISTINCT FROM
    mushavo_account_deletion.owned_workspace_impact(subject)->>'impact_token'
  THEN RAISE EXCEPTION 'FR33_WORKSPACE_IMPACT_CHANGED'; END IF;

  SELECT ARRAY(
    SELECT id FROM public.budget_workspaces WHERE owner_id = subject AND workspace_type = 'business'
    ORDER BY id FOR UPDATE
  ) INTO business_ids;
  IF cardinality(business_ids) = 0 AND NOT EXISTS (
    SELECT 1 FROM public.business_audit_events WHERE actor_id = subject
  ) THEN RETURN; END IF;

  INSERT INTO mushavo_account_deletion.business_audit_erasure_permits VALUES (pg_current_xact_id(), subject);

  INSERT INTO mushavo_account_deletion.closed_business_audit_events (event_id,workspace_id,event)
    SELECT audit.id,audit.workspace_id,to_jsonb(audit) FROM public.business_audit_events audit
    WHERE audit.workspace_id = ANY(business_ids);
  GET DIAGNOSTICS copied = ROW_COUNT;
  DELETE FROM public.business_audit_events WHERE workspace_id = ANY(business_ids);
  GET DIAGNOSTICS removed = ROW_COUNT;
  IF copied <> removed THEN RAISE EXCEPTION 'FR33_BUSINESS_AUDIT_ARCHIVE_MISMATCH'; END IF;

  -- Keep audit events in surviving workspaces. Remove only the account FK.
  UPDATE public.business_audit_events SET actor_id = NULL WHERE actor_id = subject;
  DELETE FROM mushavo_account_deletion.business_audit_erasure_permits
    WHERE transaction_id = pg_current_xact_id();

  -- The payment FK includes workspace_id, which pins these child rows to this scope.
  DELETE FROM public.business_bill_payments WHERE workspace_id = ANY(business_ids);
  DELETE FROM public.business_bills WHERE workspace_id = ANY(business_ids);
  DELETE FROM public.business_bill_schedules WHERE workspace_id = ANY(business_ids);
  DELETE FROM public.business_expense_claims WHERE workspace_id = ANY(business_ids);
  DELETE FROM public.business_spending_requests WHERE workspace_id = ANY(business_ids);
  DELETE FROM public.business_income_receipts WHERE workspace_id = ANY(business_ids);
  DELETE FROM public.business_budgets WHERE workspace_id = ANY(business_ids);
END;
$prepare$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.prepare_business_workspace_erasure(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

DO $extend_executor$
DECLARE
  body text := pg_get_functiondef('mushavo_account_deletion.execute_confirmed_request(uuid)'::regprocedure);
  anchor text := E'  PERFORM mushavo_account_deletion.require_owned_workspace_cascades(''public.budget_workspaces''::regclass,workspace_ids);';
BEGIN
  IF (length(body) - length(replace(body,anchor,''))) <> length(anchor) THEN
    RAISE EXCEPTION 'FR33_EXPECTED_OWNED_WORKSPACE_PREFLIGHT';
  END IF;
  -- Run only after the executor's account, ownership, and Storage checks.
  EXECUTE replace(body,anchor,
    E'  PERFORM mushavo_account_deletion.prepare_business_workspace_erasure(p_request_id);\n' || anchor);
END;
$extend_executor$;
