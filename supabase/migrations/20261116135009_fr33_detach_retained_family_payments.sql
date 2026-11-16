-- A permit exists only in the erasure transaction and matches one exact change.
CREATE TABLE mushavo_account_deletion.family_payment_update_permits (
  transaction_id xid8 NOT NULL,
  relation_id oid NOT NULL,
  row_id uuid NOT NULL,
  before_hash bytea NOT NULL,
  after_hash bytea NOT NULL,
  PRIMARY KEY (transaction_id, relation_id, row_id)
);
ALTER TABLE mushavo_account_deletion.family_payment_update_permits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.family_payment_update_permits FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION mushavo_account_deletion.matches_family_payment_detachment(p_relation oid, p_before jsonb, p_after jsonb)
RETURNS boolean
LANGUAGE sql STABLE SET search_path TO pg_catalog SET row_security TO 'off'
AS $match$
  SELECT EXISTS (
    SELECT 1 FROM mushavo_account_deletion.family_payment_update_permits permitted
    WHERE permitted.transaction_id = pg_current_xact_id_if_assigned()
      AND permitted.relation_id = p_relation AND permitted.row_id = (p_before->>'id')::uuid
      AND permitted.before_hash = sha256(convert_to(p_before::text,'UTF8'))
      AND permitted.after_hash = sha256(convert_to(p_after::text,'UTF8'))
  );
$match$;

ALTER TABLE public.payment_records ALTER COLUMN recorded_by DROP NOT NULL;
ALTER TABLE public.payment_items ALTER COLUMN created_by DROP NOT NULL;

CREATE FUNCTION mushavo_account_deletion.require_family_payment_actor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog
AS $require$
BEGIN
  IF (to_jsonb(NEW)->>TG_ARGV[0]) IS NULL THEN
    IF TG_OP = 'INSERT' OR ((to_jsonb(OLD)->>TG_ARGV[0]) IS NOT NULL
      AND NOT mushavo_account_deletion.matches_family_payment_detachment(TG_RELID,to_jsonb(OLD),to_jsonb(NEW))) THEN
      RAISE EXCEPTION USING ERRCODE = '23502', MESSAGE = 'FR33_FAMILY_PAYMENT_ACTOR_REQUIRED';
    END IF;
  END IF;
  RETURN NEW;
END;
$require$;

CREATE TRIGGER fr33_family_payment_record_actor_required
BEFORE INSERT OR UPDATE OF recorded_by ON public.payment_records
FOR EACH ROW EXECUTE FUNCTION mushavo_account_deletion.require_family_payment_actor('recorded_by');

CREATE TRIGGER fr33_family_payment_item_actor_required
BEFORE INSERT OR UPDATE OF created_by ON public.payment_items
FOR EACH ROW EXECUTE FUNCTION mushavo_account_deletion.require_family_payment_actor('created_by');

-- Preserve the installed guards for every operation outside the exact permitted update.
DO $extend_guards$
DECLARE
  guard regprocedure;
  definition text;
  anchor text := E'\nbegin\n';
  guarded_body text := E'\nbegin\n  if tg_op = ''UPDATE'' and tg_relid in (''public.payment_items''::regclass, ''public.payment_records''::regclass)\n    and mushavo_account_deletion.matches_family_payment_detachment(tg_relid,to_jsonb(old),to_jsonb(new)) then\n    return new;\n  end if;\n';
BEGIN
  FOREACH guard IN ARRAY ARRAY['public.guard_workspace_finance_write()'::regprocedure,
      'mushavo_file_ingest.bind_ordinary_upload()'::regprocedure] LOOP
    definition := replace(pg_get_functiondef(guard), E'\r\n', E'\n');
    IF (length(definition) - length(replace(definition,anchor,''))) <> length(anchor) THEN
      RAISE EXCEPTION 'FR33_EXPECTED_FINANCE_GUARD_BODY';
    END IF;
    EXECUTE replace(definition,anchor,guarded_body);
  END LOOP;
END;
$extend_guards$;

CREATE FUNCTION mushavo_account_deletion.detach_retained_family_payment_actors(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path TO pg_catalog SET row_security TO 'off'
AS $detach_family$
DECLARE
  subject uuid;
  txn xid8 := pg_current_xact_id();
  affected record;
  after_row jsonb;
  proof_object uuid;
  items integer := 0;
  payments integer := 0;
BEGIN
  SELECT subject_id INTO subject FROM mushavo_account_deletion.requests
  WHERE id = p_request_id AND cancelled_at IS NULL AND workspace_impact_confirmed_at IS NOT NULL;
  IF subject IS NULL THEN RAISE EXCEPTION 'FR33_CONFIRMED_REQUEST_REQUIRED'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('fr33-account-deletion:' || subject::text, 0));
  PERFORM mushavo_account_deletion.capture_retained_payment_names(p_request_id);

  -- All changed actors belong to the deleting account and all recipient owners are derived from the workspace.
  FOR affected IN
    SELECT p.id, p.owner_id, p.recorded_by, p.proof_path, to_jsonb(p) AS row_before, workspace.owner_id AS workspace_owner
    FROM public.payment_records p JOIN public.families family ON family.id = p.family_id
    JOIN public.budget_workspaces workspace ON workspace.id = p.workspace_id
      AND workspace.legacy_family_id = family.id AND workspace.owner_id = family.owner_id
    WHERE p.visibility = 'family' AND workspace.workspace_type IN ('family','household')
      AND workspace.owner_id IS DISTINCT FROM subject AND (p.owner_id = subject OR p.recorded_by = subject)
    ORDER BY p.id FOR UPDATE OF p FOR SHARE OF workspace,family
  LOOP
    IF affected.proof_path IS NOT NULL THEN
      SELECT object.id INTO proof_object FROM storage.objects object
      WHERE object.bucket_id = 'payment-proofs' AND object.name = affected.proof_path
        AND object.owner_id IS DISTINCT FROM subject::text AND object.owner IS DISTINCT FROM subject
      FOR SHARE;
      IF proof_object IS NULL THEN RAISE EXCEPTION 'FR33_FAMILY_PROOF_STORAGE_HANDOFF_REQUIRED'; END IF;
    END IF;
    IF affected.recorded_by = subject AND NOT EXISTS (
      SELECT 1 FROM public.fr33_family_payment_names name WHERE name.payment_id = affected.id AND name.recorder_name IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'FR33_RETAINED_PAYMENT_NAME_REQUIRED';
    END IF;
    after_row := affected.row_before || jsonb_build_object(
      'owner_id', CASE WHEN affected.owner_id = subject THEN affected.workspace_owner ELSE affected.owner_id END,
      'recorded_by', CASE WHEN affected.recorded_by = subject THEN NULL::uuid ELSE affected.recorded_by END
    );
    INSERT INTO mushavo_account_deletion.family_payment_update_permits VALUES (
      txn,'public.payment_records'::regclass,affected.id,sha256(convert_to(affected.row_before::text,'UTF8')),
      sha256(convert_to(after_row::text,'UTF8'))
    );
    UPDATE public.payment_records SET owner_id = (after_row->>'owner_id')::uuid,
      recorded_by = (after_row->>'recorded_by')::uuid WHERE id = affected.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'FR33_FAMILY_PAYMENT_SCOPE_CHANGED'; END IF;
    DELETE FROM mushavo_account_deletion.family_payment_update_permits
      WHERE transaction_id = txn AND relation_id = 'public.payment_records'::regclass AND row_id = affected.id;
    payments := payments + 1;
  END LOOP;

  FOR affected IN
    SELECT item.id,item.owner_id,item.created_by,to_jsonb(item) AS row_before,workspace.owner_id AS workspace_owner
    FROM public.payment_items item JOIN public.families family ON family.id = item.family_id
    JOIN public.budget_workspaces workspace ON workspace.id = item.workspace_id
      AND workspace.legacy_family_id = family.id AND workspace.owner_id = family.owner_id
    WHERE item.visibility = 'family' AND workspace.workspace_type IN ('family','household')
      AND workspace.owner_id IS DISTINCT FROM subject AND (item.owner_id = subject OR item.created_by = subject)
    ORDER BY item.id FOR UPDATE OF item FOR SHARE OF workspace,family
  LOOP
    after_row := affected.row_before || jsonb_build_object(
      'owner_id', CASE WHEN affected.owner_id = subject THEN affected.workspace_owner ELSE affected.owner_id END,
      'created_by', CASE WHEN affected.created_by = subject THEN NULL::uuid ELSE affected.created_by END
    );
    INSERT INTO mushavo_account_deletion.family_payment_update_permits VALUES (
      txn,'public.payment_items'::regclass,affected.id,sha256(convert_to(affected.row_before::text,'UTF8')),
      sha256(convert_to(after_row::text,'UTF8'))
    );
    UPDATE public.payment_items SET owner_id = (after_row->>'owner_id')::uuid,
      created_by = (after_row->>'created_by')::uuid WHERE id = affected.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'FR33_FAMILY_PAYMENT_SCOPE_CHANGED'; END IF;
    DELETE FROM mushavo_account_deletion.family_payment_update_permits
      WHERE transaction_id = txn AND relation_id = 'public.payment_items'::regclass AND row_id = affected.id;
    items := items + 1;
  END LOOP;

  RETURN jsonb_build_object('family_payment_items_detached',items,'family_payments_detached',payments);
END;
$detach_family$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.matches_family_payment_detachment(oid,jsonb,jsonb),
  mushavo_account_deletion.require_family_payment_actor(),
  mushavo_account_deletion.detach_retained_family_payment_actors(uuid) FROM PUBLIC, anon, authenticated, service_role;
