SET LOCAL lock_timeout='3s';
-- 20261116122201 fr33_protect_payment_history
-- Preserve payment history when an Auth account is removed. Workspace and
-- payment-item deletion keep their existing cascades. The erasure process must
-- resolve account links before removing the login.
DO $protect_payment_history$
DECLARE
  reviewed integer;
  cascading integer;
  restrictive integer;
BEGIN
  SET LOCAL lock_timeout = '3s';
  LOCK TABLE public.payment_items, public.payment_records IN ACCESS EXCLUSIVE MODE;

  SELECT count(*), count(*) FILTER (WHERE fk.confdeltype = 'c'),
    count(*) FILTER (WHERE fk.confdeltype = 'r')
  INTO reviewed, cascading, restrictive
  FROM (VALUES
    ('public.payment_items'::regclass, 'payment_items_owner_id_fkey', 'owner_id'),
    ('public.payment_items'::regclass, 'payment_items_created_by_fkey', 'created_by'),
    ('public.payment_records'::regclass, 'payment_records_owner_id_fkey', 'owner_id'),
    ('public.payment_records'::regclass, 'payment_records_recorded_by_fkey', 'recorded_by')
  ) AS expected(relation, constraint_name, column_name)
  JOIN pg_catalog.pg_constraint fk
    ON fk.conrelid = expected.relation AND fk.conname = expected.constraint_name
  JOIN pg_catalog.pg_attribute actor
    ON actor.attrelid = fk.conrelid AND actor.attname = expected.column_name
  JOIN pg_catalog.pg_attribute account
    ON account.attrelid = fk.confrelid AND account.attname = 'id'
  WHERE fk.contype = 'f' AND fk.confrelid = 'auth.users'::regclass
    AND fk.conkey = ARRAY[actor.attnum] AND fk.confkey = ARRAY[account.attnum]
    AND fk.convalidated AND NOT fk.condeferrable AND fk.confupdtype = 'a'
    AND actor.attnotnull AND fk.confmatchtype = 's';

  IF reviewed = 4 AND restrictive = 4 THEN
    RETURN;
  END IF;
  IF reviewed <> 4 OR cascading <> 4 THEN
    RAISE EXCEPTION 'FR33_UNEXPECTED_PAYMENT_ACCOUNT_LINKS';
  END IF;

  ALTER TABLE public.payment_items
    DROP CONSTRAINT payment_items_owner_id_fkey,
    DROP CONSTRAINT payment_items_created_by_fkey,
    ADD CONSTRAINT payment_items_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT,
    ADD CONSTRAINT payment_items_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;

  ALTER TABLE public.payment_records
    DROP CONSTRAINT payment_records_owner_id_fkey,
    DROP CONSTRAINT payment_records_recorded_by_fkey,
    ADD CONSTRAINT payment_records_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT,
    ADD CONSTRAINT payment_records_recorded_by_fkey
      FOREIGN KEY (recorded_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
END;
$protect_payment_history$;


-- 20261116124345 fr33_retained_payment_names
CREATE TABLE public.fr33_family_payment_names (
  payment_id uuid PRIMARY KEY REFERENCES public.payment_records(id) ON DELETE CASCADE,
  payer_name text,
  recorder_name text,
  CONSTRAINT fr33_family_payment_has_name CHECK (payer_name IS NOT NULL OR recorder_name IS NOT NULL)
);

CREATE TABLE public.fr33_bill_payment_names (
  payment_id uuid PRIMARY KEY REFERENCES public.business_bill_payments(id) ON DELETE CASCADE,
  recorder_name text NOT NULL
);

ALTER TABLE public.fr33_family_payment_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fr33_bill_payment_names ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fr33_family_payment_names, public.fr33_bill_payment_names
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.fr33_family_payment_names, public.fr33_bill_payment_names TO authenticated;

-- The existing payment policies also apply when a client reads its name row.
CREATE POLICY fr33_family_payment_name_read ON public.fr33_family_payment_names
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.payment_records payment WHERE payment.id = fr33_family_payment_names.payment_id
  ));
CREATE POLICY fr33_bill_payment_name_read ON public.fr33_bill_payment_names
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.business_bill_payments payment WHERE payment.id = fr33_bill_payment_names.payment_id
  ));

-- Call from the erasure transaction before removing account or membership links.
CREATE FUNCTION mushavo_account_deletion.capture_retained_payment_names(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path TO pg_catalog SET row_security TO 'off'
AS $capture$
DECLARE
  subject uuid;
  confirmed_token text;
  account_email text;
  profile_name text;
  family_payment record;
  captured_payer text;
  captured_recorder text;
  family_count integer := 0;
  bill_count integer;
BEGIN
  SELECT subject_id INTO subject
  FROM mushavo_account_deletion.requests WHERE id = p_request_id AND cancelled_at IS NULL;
  IF subject IS NULL THEN
    RAISE EXCEPTION 'FR33_CONFIRMED_REQUEST_REQUIRED';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('fr33-account-deletion:' || subject::text, 0));
  SELECT r.workspace_impact_token INTO confirmed_token
  FROM mushavo_account_deletion.requests r
  WHERE r.id = p_request_id AND r.subject_id = subject AND r.cancelled_at IS NULL
    AND r.workspace_impact_confirmed_at IS NOT NULL
  FOR UPDATE;
  IF confirmed_token IS NULL OR confirmed_token IS DISTINCT FROM
    mushavo_account_deletion.owned_workspace_impact(subject)->>'impact_token' THEN
    RAISE EXCEPTION 'FR33_CONFIRMED_REQUEST_REQUIRED';
  END IF;

  SELECT lower(btrim(account.email)), nullif(btrim(profile.full_name), '')
  INTO account_email, profile_name
  FROM auth.users account LEFT JOIN public.profiles profile ON profile.id = account.id
  WHERE account.id = subject;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FR33_ACCOUNT_REQUIRED';
  END IF;
  IF lower(profile_name) = account_email THEN
    profile_name := NULL;
  END IF;

  FOR family_payment IN
    SELECT p.id, p.recorded_by = subject AS captured_recording,
      payer.user_id = subject AS captured_payment,
      CASE WHEN lower(btrim(payer.name)) IS DISTINCT FROM lower(btrim(payer.email))
        AND lower(btrim(payer.name)) IS DISTINCT FROM account_email THEN nullif(btrim(payer.name), '') END AS payer_name,
      recorder.name AS recorder_name
    FROM public.payment_records p JOIN public.families family ON family.id = p.family_id
    LEFT JOIN public.family_members payer ON payer.id = p.paid_by_member_id AND payer.family_id = family.id
    LEFT JOIN LATERAL (
      SELECT nullif(btrim(member.name), '') AS name
      FROM public.family_members member
      WHERE member.family_id = family.id AND member.user_id = subject
        AND nullif(btrim(member.name), '') IS NOT NULL
        AND lower(btrim(member.name)) IS DISTINCT FROM lower(btrim(member.email))
        AND lower(btrim(member.name)) IS DISTINCT FROM account_email
      ORDER BY (member.status = 'active') DESC, member.id LIMIT 1
    ) recorder ON p.recorded_by = subject
    WHERE p.visibility = 'family' AND family.owner_id IS DISTINCT FROM subject
      AND (p.recorded_by = subject OR payer.user_id = subject)
    ORDER BY p.id FOR SHARE OF p
  LOOP
    captured_payer := CASE WHEN family_payment.captured_payment THEN coalesce(family_payment.payer_name, profile_name) END;
    captured_recorder := CASE WHEN family_payment.captured_recording THEN coalesce(family_payment.recorder_name, profile_name) END;
    IF (family_payment.captured_payment AND captured_payer IS NULL)
      OR (family_payment.captured_recording AND captured_recorder IS NULL) THEN
      RAISE EXCEPTION 'FR33_RETAINED_PAYMENT_NAME_REQUIRED';
    END IF;
    INSERT INTO public.fr33_family_payment_names AS retained (payment_id, payer_name, recorder_name)
    VALUES (family_payment.id, captured_payer, captured_recorder)
    ON CONFLICT (payment_id) DO UPDATE SET
      payer_name = coalesce(EXCLUDED.payer_name, retained.payer_name),
      recorder_name = coalesce(EXCLUDED.recorder_name, retained.recorder_name);
    family_count := family_count + 1;
  END LOOP;

  IF profile_name IS NULL AND EXISTS (
    SELECT 1 FROM public.business_bill_payments payment
    JOIN public.budget_workspaces workspace ON workspace.id = payment.workspace_id
    WHERE workspace.workspace_type = 'business' AND workspace.owner_id IS DISTINCT FROM subject
      AND payment.recorded_by = subject
  ) THEN
    RAISE EXCEPTION 'FR33_RETAINED_PAYMENT_NAME_REQUIRED';
  END IF;
  INSERT INTO public.fr33_bill_payment_names (payment_id, recorder_name)
  SELECT payment.id, profile_name FROM public.business_bill_payments payment
  JOIN public.budget_workspaces workspace ON workspace.id = payment.workspace_id
  WHERE workspace.workspace_type = 'business' AND workspace.owner_id IS DISTINCT FROM subject
    AND payment.recorded_by = subject
  ORDER BY payment.id FOR SHARE OF payment
  ON CONFLICT (payment_id) DO UPDATE SET recorder_name = EXCLUDED.recorder_name;
  GET DIAGNOSTICS bill_count = ROW_COUNT;

  RETURN jsonb_build_object('family_payments', family_count, 'business_bill_payments', bill_count);
END;
$capture$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.capture_retained_payment_names(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';


-- 20261116130629 fr33_detach_bill_payment_recorders
-- A retained payment keeps its name when the account reference is cleared.
-- The existing RESTRICT foreign key still protects recorders until that step.
ALTER TABLE public.business_bill_payments ALTER COLUMN recorded_by DROP NOT NULL;

CREATE FUNCTION mushavo_account_deletion.require_retained_bill_recorder_name()
RETURNS trigger
LANGUAGE plpgsql SET search_path TO pg_catalog
AS $require_name$
BEGIN
  IF NEW.recorded_by IS NULL AND (TG_OP = 'INSERT' OR NOT EXISTS (
    SELECT 1 FROM public.fr33_bill_payment_names retained WHERE retained.payment_id = NEW.id
  )) THEN
    RAISE EXCEPTION USING ERRCODE = '23502', MESSAGE = 'FR33_BILL_PAYMENT_RECORDER_REQUIRED';
  END IF;
  RETURN NEW;
END;
$require_name$;

CREATE TRIGGER fr33_bill_payment_recorder_required
BEFORE INSERT OR UPDATE OF id, recorded_by ON public.business_bill_payments
FOR EACH ROW EXECUTE FUNCTION mushavo_account_deletion.require_retained_bill_recorder_name();

-- Intended to run in the erasure transaction, with the remaining data cleanup.
CREATE FUNCTION mushavo_account_deletion.detach_retained_business_bill_recorders(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path TO pg_catalog SET row_security TO 'off'
AS $detach$
DECLARE
  subject uuid;
  captured jsonb;
  detached integer;
BEGIN
  SELECT subject_id INTO subject FROM mushavo_account_deletion.requests
  WHERE id = p_request_id AND cancelled_at IS NULL AND workspace_impact_confirmed_at IS NOT NULL;
  IF subject IS NULL THEN
    RAISE EXCEPTION 'FR33_CONFIRMED_REQUEST_REQUIRED';
  END IF;

  -- Hold the ownership used to distinguish surviving workspaces from owned ones.
  PERFORM workspace.id FROM public.budget_workspaces workspace
  WHERE workspace.workspace_type = 'business' AND EXISTS (
    SELECT 1 FROM public.business_bill_payments payment
    WHERE payment.workspace_id = workspace.id AND payment.recorded_by = subject
  )
  ORDER BY workspace.id FOR SHARE OF workspace;

  -- Validates confirmation and locks the request against cancellation.
  captured := mushavo_account_deletion.capture_retained_payment_names(p_request_id);
  IF (captured->>'business_bill_payments')::int = 0 THEN
    RETURN jsonb_build_object('business_bill_payments_detached', 0);
  END IF;

  -- Keep the document inventory stable until detachment and account cleanup finish.
  LOCK TABLE public.business_documents IN SHARE MODE;
  IF EXISTS (
    SELECT 1 FROM public.business_bill_payments payment
    JOIN public.budget_workspaces workspace ON workspace.id = payment.workspace_id
    JOIN public.business_documents document ON document.workspace_id = workspace.id
      AND document.parent_type = 'business_bill_payment' AND document.parent_id = payment.id
    WHERE workspace.workspace_type = 'business' AND workspace.owner_id IS DISTINCT FROM subject
      AND payment.recorded_by = subject
  ) THEN
    RAISE EXCEPTION 'FR33_BILL_PAYMENT_PROOF_REQUIRES_RETENTION_DECISION';
  END IF;

  UPDATE public.business_bill_payments payment SET recorded_by = NULL
  FROM public.budget_workspaces workspace, public.fr33_bill_payment_names retained
  WHERE workspace.id = payment.workspace_id AND retained.payment_id = payment.id
    AND workspace.workspace_type = 'business' AND workspace.owner_id IS DISTINCT FROM subject
    AND payment.recorded_by = subject;
  GET DIAGNOSTICS detached = ROW_COUNT;
  IF detached <> (captured->>'business_bill_payments')::int OR EXISTS (
    SELECT 1 FROM public.business_bill_payments payment
    JOIN public.budget_workspaces workspace ON workspace.id = payment.workspace_id
    WHERE workspace.workspace_type = 'business' AND workspace.owner_id IS DISTINCT FROM subject
      AND payment.recorded_by = subject
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'FR33_BILL_PAYMENT_SCOPE_CHANGED';
  END IF;

  RETURN jsonb_build_object('business_bill_payments_detached', detached);
END;
$detach$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.require_retained_bill_recorder_name(),
  mushavo_account_deletion.detach_retained_business_bill_recorders(uuid)
  FROM PUBLIC, anon, authenticated, service_role;


-- 20261116133213 fr33_retain_business_bill_proofs
CREATE TABLE mushavo_account_deletion.retained_bill_proofs (
  document_id uuid PRIMARY KEY REFERENCES public.business_documents(id) ON DELETE CASCADE,
  storage_object_id uuid NOT NULL
);
ALTER TABLE mushavo_account_deletion.retained_bill_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.retained_bill_proofs FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.business_documents ALTER COLUMN uploaded_by DROP NOT NULL;

CREATE FUNCTION mushavo_account_deletion.require_bill_proof_uploader()
RETURNS trigger
LANGUAGE plpgsql SET search_path TO pg_catalog
AS $require_uploader$
BEGIN
  IF NEW.uploaded_by IS NULL AND (TG_OP = 'INSERT'
    OR NEW.parent_type IS DISTINCT FROM 'business_bill_payment'
    OR (to_jsonb(NEW) - 'uploaded_by') IS DISTINCT FROM (to_jsonb(OLD) - 'uploaded_by')
    OR NOT EXISTS (
      SELECT 1 FROM mushavo_account_deletion.retained_bill_proofs retained
      JOIN storage.objects object ON object.id = retained.storage_object_id
      WHERE retained.document_id = NEW.id AND object.bucket_id = 'business-documents'
        AND object.name = NEW.storage_path AND object.owner_id IS NULL AND object.owner IS NULL
    )) THEN
    RAISE EXCEPTION USING ERRCODE = '23502', MESSAGE = 'FR33_BILL_PROOF_UPLOADER_REQUIRED';
  END IF;
  RETURN NEW;
END;
$require_uploader$;

CREATE TRIGGER fr33_bill_proof_uploader_required
BEFORE INSERT OR UPDATE OF id, uploaded_by ON public.business_documents
FOR EACH ROW EXECUTE FUNCTION mushavo_account_deletion.require_bill_proof_uploader();

CREATE OR REPLACE FUNCTION mushavo_account_deletion.detach_retained_business_bill_recorders(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path TO pg_catalog SET row_security TO 'off'
AS $detach$
DECLARE
  subject uuid;
  captured jsonb;
  detached integer;
  proof_count integer;
  proof_updates integer;
  proof record;
BEGIN
  SELECT subject_id INTO subject FROM mushavo_account_deletion.requests
  WHERE id = p_request_id AND cancelled_at IS NULL AND workspace_impact_confirmed_at IS NOT NULL;
  IF subject IS NULL THEN RAISE EXCEPTION 'FR33_CONFIRMED_REQUEST_REQUIRED'; END IF;

  -- Serialize against proof registration and lock any workspace in which the account has either role.
  LOCK TABLE public.business_documents IN SHARE ROW EXCLUSIVE MODE;
  PERFORM workspace.id FROM public.budget_workspaces workspace
  WHERE workspace.workspace_type = 'business' AND EXISTS (
    SELECT 1 FROM public.business_bill_payments payment
    WHERE payment.workspace_id = workspace.id AND (payment.recorded_by = subject OR EXISTS (
      SELECT 1 FROM public.business_documents document
      WHERE document.workspace_id = workspace.id AND document.parent_type = 'business_bill_payment'
        AND document.parent_id = payment.id AND document.uploaded_by = subject
    ))
  ) ORDER BY workspace.id FOR SHARE OF workspace;

  -- Validates confirmation, saves the names, and locks the request against cancellation.
  captured := mushavo_account_deletion.capture_retained_payment_names(p_request_id);

  FOR proof IN
    SELECT document.id, document.uploaded_by, document.storage_path
    FROM public.business_documents document
    JOIN public.business_bill_payments payment ON payment.id = document.parent_id AND payment.workspace_id = document.workspace_id
    JOIN public.budget_workspaces workspace ON workspace.id = payment.workspace_id
    WHERE document.parent_type = 'business_bill_payment' AND workspace.workspace_type = 'business'
      AND workspace.owner_id IS DISTINCT FROM subject AND (payment.recorded_by = subject OR document.uploaded_by = subject)
    ORDER BY document.id
  LOOP
    IF NOT EXISTS (SELECT 1 FROM storage.objects object WHERE object.bucket_id = 'business-documents'
       AND object.name = proof.storage_path AND object.owner_id IS DISTINCT FROM subject::text
       AND object.owner IS DISTINCT FROM subject) THEN
      RAISE EXCEPTION 'FR33_BILL_PROOF_STORAGE_HANDOFF_REQUIRED';
    END IF;
    IF proof.uploaded_by = subject THEN
      -- Paths that still depend on an uploader for authorization need a separate migration.
      IF public.fr32_is_managed_ordinary_upload('business-documents', proof.storage_path) THEN
        RAISE EXCEPTION 'FR33_BILL_PROOF_INGESTION_HANDOFF_REQUIRED';
      END IF;
      INSERT INTO mushavo_account_deletion.retained_bill_proofs (document_id, storage_object_id)
      SELECT proof.id, object.id FROM storage.objects object
      WHERE object.bucket_id = 'business-documents' AND object.name = proof.storage_path
        AND object.owner_id IS NULL AND object.owner IS NULL
      FOR SHARE OF object
      ON CONFLICT (document_id) DO UPDATE SET storage_object_id = EXCLUDED.storage_object_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'FR33_BILL_PROOF_STORAGE_HANDOFF_REQUIRED'; END IF;
    END IF;
  END LOOP;

  SELECT count(*) INTO proof_count FROM public.business_documents document
  JOIN public.business_bill_payments payment ON payment.id = document.parent_id AND payment.workspace_id = document.workspace_id
  JOIN public.budget_workspaces workspace ON workspace.id = payment.workspace_id
  WHERE document.parent_type = 'business_bill_payment' AND workspace.workspace_type = 'business'
    AND workspace.owner_id IS DISTINCT FROM subject AND document.uploaded_by = subject;

  UPDATE public.business_documents document SET uploaded_by = NULL
  FROM public.business_bill_payments payment, public.budget_workspaces workspace,
       mushavo_account_deletion.retained_bill_proofs retained
  WHERE retained.document_id = document.id AND document.parent_type = 'business_bill_payment'
    AND payment.id = document.parent_id AND payment.workspace_id = document.workspace_id
    AND workspace.id = payment.workspace_id AND workspace.workspace_type = 'business'
    AND workspace.owner_id IS DISTINCT FROM subject AND document.uploaded_by = subject;
  GET DIAGNOSTICS proof_updates = ROW_COUNT;
  IF proof_updates <> proof_count THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'FR33_BILL_PAYMENT_SCOPE_CHANGED';
  END IF;

  UPDATE public.business_bill_payments payment SET recorded_by = NULL
  FROM public.budget_workspaces workspace, public.fr33_bill_payment_names retained
  WHERE workspace.id = payment.workspace_id AND retained.payment_id = payment.id
    AND workspace.workspace_type = 'business' AND workspace.owner_id IS DISTINCT FROM subject
    AND payment.recorded_by = subject;
  GET DIAGNOSTICS detached = ROW_COUNT;
  IF detached <> (captured->>'business_bill_payments')::int OR EXISTS (
    SELECT 1 FROM public.business_bill_payments payment
    JOIN public.budget_workspaces workspace ON workspace.id = payment.workspace_id
    WHERE workspace.workspace_type = 'business' AND workspace.owner_id IS DISTINCT FROM subject
      AND payment.recorded_by = subject
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'FR33_BILL_PAYMENT_SCOPE_CHANGED';
  END IF;

  RETURN jsonb_build_object('business_bill_payments_detached', detached, 'business_bill_proofs_retained', proof_updates);
END;
$detach$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.require_bill_proof_uploader(),
  mushavo_account_deletion.detach_retained_business_bill_recorders(uuid)
  FROM PUBLIC, anon, authenticated, service_role;


-- 20261116135009 fr33_detach_retained_family_payments
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


-- 20261116135504 fr33_detach_retained_family_memberships
CREATE FUNCTION mushavo_account_deletion.detach_retained_family_memberships(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path TO pg_catalog SET row_security TO 'off'
AS $detach_family_memberships$
DECLARE
  subject uuid;
  payment_result jsonb;
  historical_members integer;
  remaining_members integer;
  access_rows integer;
BEGIN
  SELECT subject_id INTO subject FROM mushavo_account_deletion.requests
  WHERE id = p_request_id AND cancelled_at IS NULL AND workspace_impact_confirmed_at IS NOT NULL;
  IF subject IS NULL THEN RAISE EXCEPTION 'FR33_CONFIRMED_REQUEST_REQUIRED'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('fr33-account-deletion:' || subject::text, 0));
  -- Hold the Auth row through erasure so concurrent foreign-key inserts cannot restore access.
  PERFORM 1 FROM auth.users WHERE id = subject FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FR33_DELETION_SUBJECT_MISSING'; END IF;
  payment_result := mushavo_account_deletion.detach_retained_family_payment_actors(p_request_id);

  -- Lock the surviving family's owner mapping before transferring creator references.
  PERFORM workspace.id FROM public.budget_workspaces workspace
  JOIN public.families family ON family.id = workspace.legacy_family_id AND family.owner_id = workspace.owner_id
  WHERE workspace.workspace_type IN ('family','household') AND workspace.owner_id <> subject
    AND (EXISTS (
      SELECT 1 FROM public.family_members member
      WHERE member.family_id = family.id AND (member.user_id = subject OR member.created_by = subject)
    ) OR EXISTS (
      SELECT 1 FROM public.workspace_members member
      WHERE member.workspace_id = workspace.id AND member.user_id = subject
    ))
  ORDER BY workspace.id FOR SHARE OF workspace,family;

  IF EXISTS (
    SELECT 1 FROM public.family_members member
    JOIN public.families family ON family.id = member.family_id
    WHERE family.owner_id <> subject AND (member.user_id = subject OR member.created_by = subject)
      AND (NOT EXISTS (
        SELECT 1 FROM public.budget_workspaces workspace WHERE workspace.legacy_family_id = family.id
          AND workspace.owner_id = family.owner_id AND workspace.workspace_type IN ('family','household')
      ) OR (member.user_id = subject AND member.role = 'Owner'))
  ) OR EXISTS (
    SELECT 1 FROM public.workspace_members member JOIN public.budget_workspaces workspace ON workspace.id = member.workspace_id
    WHERE member.user_id = subject AND workspace.owner_id <> subject AND workspace.workspace_type IN ('family','household')
      AND (member.role <> 'family_member' OR NOT EXISTS (
        SELECT 1 FROM public.families family WHERE family.id = workspace.legacy_family_id AND family.owner_id = workspace.owner_id
      ))
  ) THEN
    RAISE EXCEPTION 'FR33_FAMILY_MEMBERSHIP_SCOPE_REVIEW_REQUIRED';
  END IF;

  -- Preserve IDs referenced by payment history and clear contact information for this account.
  UPDATE public.family_members member SET user_id = NULL, status = 'inactive', email = NULL, phone = NULL,
    created_by = CASE WHEN member.created_by = subject THEN family.owner_id ELSE member.created_by END
  FROM public.families family
  JOIN public.budget_workspaces workspace ON workspace.legacy_family_id = family.id AND workspace.owner_id = family.owner_id
  WHERE member.family_id = family.id AND workspace.workspace_type IN ('family','household')
    AND family.owner_id <> subject AND member.user_id = subject AND member.role <> 'Owner';
  GET DIAGNOSTICS historical_members = ROW_COUNT;

  -- These rows belong to other people and would otherwise cascade when the inviter is deleted.
  UPDATE public.family_members member SET created_by = family.owner_id
  FROM public.families family
  JOIN public.budget_workspaces workspace ON workspace.legacy_family_id = family.id AND workspace.owner_id = family.owner_id
  WHERE member.family_id = family.id AND workspace.workspace_type IN ('family','household')
    AND family.owner_id <> subject AND member.created_by = subject;
  GET DIAGNOSTICS remaining_members = ROW_COUNT;

  DELETE FROM public.workspace_members member USING public.budget_workspaces workspace, public.families family
  WHERE member.workspace_id = workspace.id AND workspace.legacy_family_id = family.id
    AND workspace.owner_id = family.owner_id AND workspace.workspace_type IN ('family','household')
    AND family.owner_id <> subject AND member.user_id = subject AND member.role = 'family_member';
  GET DIAGNOSTICS access_rows = ROW_COUNT;

  RETURN payment_result || jsonb_build_object('family_memberships_detached',historical_members,
    'family_member_creators_transferred',remaining_members,'family_access_rows_removed',access_rows);
END;
$detach_family_memberships$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.detach_retained_family_memberships(uuid)
  FROM PUBLIC, anon, authenticated, service_role;


-- 20261116135850 fr33_retain_managed_bill_proofs
ALTER TABLE mushavo_account_deletion.retained_bill_proofs ADD COLUMN detach_transaction xid8;

-- The download broker resolves the Business workspace from the path and document.
-- Clearing only the uploader on an ownerless object leaves that access path intact.
CREATE FUNCTION mushavo_account_deletion.matches_managed_bill_proof_detachment(p_before jsonb, p_after jsonb)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO pg_catalog SET row_security TO 'off'
AS $match$
  SELECT p_before->>'uploaded_by' IS NOT NULL AND p_after->>'uploaded_by' IS NULL
    AND p_before - 'uploaded_by' = p_after - 'uploaded_by'
    AND p_before->>'parent_type' = 'business_bill_payment'
    AND EXISTS (
      SELECT 1 FROM mushavo_account_deletion.retained_bill_proofs retained
      JOIN storage.objects object ON object.id = retained.storage_object_id
      WHERE retained.document_id = (p_before->>'id')::uuid
        AND retained.detach_transaction = pg_current_xact_id_if_assigned()
        AND object.bucket_id = 'business-documents' AND object.name = p_before->>'storage_path'
        AND object.owner_id IS NULL AND object.owner IS NULL
    );
$match$;

DO $restrict_detachment$
DECLARE
  binder text := replace(pg_get_functiondef('mushavo_file_ingest.bind_ordinary_upload()'::regprocedure), E'\r\n', E'\n');
  detach text := replace(pg_get_functiondef('mushavo_account_deletion.detach_retained_business_bill_recorders(uuid)'::regprocedure), E'\r\n', E'\n');
  binder_anchor text := E'  case tg_table_name\n';
  managed_block text := E'      -- Paths that still depend on an uploader for authorization need a separate migration.\n      IF public.fr32_is_managed_ordinary_upload(''business-documents'', proof.storage_path) THEN\n        RAISE EXCEPTION ''FR33_BILL_PROOF_INGESTION_HANDOFF_REQUIRED'';\n      END IF;\n';
  marker_values text := E'INSERT INTO mushavo_account_deletion.retained_bill_proofs (document_id, storage_object_id)\n      SELECT proof.id, object.id FROM storage.objects object';
  marker_upsert text := 'ON CONFLICT (document_id) DO UPDATE SET storage_object_id = EXCLUDED.storage_object_id;';
  return_anchor text := '  RETURN jsonb_build_object(''business_bill_payments_detached''';
BEGIN
  IF (length(binder) - length(replace(binder,binder_anchor,''))) <> length(binder_anchor)
    OR strpos(detach,managed_block) = 0 OR strpos(detach,marker_values) = 0
    OR strpos(detach,marker_upsert) = 0 OR strpos(detach,return_anchor) = 0 THEN
    RAISE EXCEPTION 'FR33_EXPECTED_BUSINESS_PROOF_GUARDS';
  END IF;
  EXECUTE replace(binder,binder_anchor,
    E'  if tg_op = ''UPDATE'' and tg_relid = ''public.business_documents''::regclass\n    and mushavo_account_deletion.matches_managed_bill_proof_detachment(old_row,j) then\n    return new;\n  end if;\n' || binder_anchor);
  detach := replace(detach,managed_block,'');
  detach := replace(detach,marker_values,
    E'INSERT INTO mushavo_account_deletion.retained_bill_proofs (document_id, storage_object_id, detach_transaction)\n      SELECT proof.id, object.id, pg_current_xact_id() FROM storage.objects object');
  detach := replace(detach,marker_upsert,
    'ON CONFLICT (document_id) DO UPDATE SET storage_object_id = EXCLUDED.storage_object_id, detach_transaction = EXCLUDED.detach_transaction;');
  EXECUTE replace(detach,return_anchor,
    E'  UPDATE mushavo_account_deletion.retained_bill_proofs SET detach_transaction = NULL\n    WHERE detach_transaction = pg_current_xact_id_if_assigned();\n\n' || return_anchor);
END;
$restrict_detachment$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.matches_managed_bill_proof_detachment(jsonb,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;


-- 20261116142531 fr33_execute_confirmed_deletion
ALTER TABLE mushavo_account_deletion.requests ADD COLUMN completed_at timestamptz,
  ADD CONSTRAINT deletion_completion_consistent CHECK (
    completed_at IS NULL OR (subject_id IS NULL AND cancelled_at IS NULL
      AND workspace_impact_token IS NULL AND workspace_impact_confirmed_at IS NULL
      AND completed_at >= created_at)
  );

-- Only the erasure transaction can authorize payment deletion in its owned workspaces.
CREATE TABLE mushavo_account_deletion.owned_payment_delete_permits (
  transaction_id xid8 NOT NULL,
  workspace_id uuid NOT NULL,
  PRIMARY KEY (transaction_id, workspace_id)
);
ALTER TABLE mushavo_account_deletion.owned_payment_delete_permits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.owned_payment_delete_permits FROM PUBLIC, anon, authenticated, service_role;

DO $extend_finance_guard$
DECLARE
  definition text := replace(pg_get_functiondef('public.guard_workspace_finance_write()'::regprocedure), E'\r\n', E'\n');
  anchor text := E'  if public.my_account_suspended()';
BEGIN
  IF (length(definition) - length(replace(definition,anchor,''))) <> length(anchor) THEN
    RAISE EXCEPTION 'FR33_EXPECTED_FINANCE_DELETE_GUARD';
  END IF;
  EXECUTE replace(definition,anchor,
    E'  if tg_op = ''DELETE'' and tg_relid in (''public.payment_items''::regclass, ''public.payment_records''::regclass)\n'
    || E'    and exists (select 1 from mushavo_account_deletion.owned_payment_delete_permits permit\n'
    || E'      where permit.transaction_id = pg_current_xact_id_if_assigned() and permit.workspace_id = old.workspace_id) then\n'
    || E'    return old;\n  end if;\n' || anchor);
END;
$extend_finance_guard$;

-- Only reviewed ownership cascades may run. Unknown references are read for
-- detection, while every delete below names a specific root and owner.
CREATE FUNCTION mushavo_account_deletion.require_owned_workspace_cascades(p_root regclass, p_ids uuid[])
RETURNS void LANGUAGE plpgsql STABLE SET search_path TO pg_catalog SET row_security TO 'off'
AS $owned_refs$
DECLARE
  reference record;
  has_rows boolean;
  reviewed_columns text[];
BEGIN
  reviewed_columns := CASE p_root
    WHEN 'public.families'::regclass THEN ARRAY[
      'budget_workspaces.legacy_family_id','category_budgets.family_id','expenses.family_id',
      'family_invitations.family_id','family_members.family_id','notifications.family_id',
      'payment_items.family_id','payment_records.family_id'
    ]
    WHEN 'public.budget_workspaces'::regclass THEN ARRAY[
      'business_bill_schedules.workspace_id','business_categories.workspace_id','business_change_signals.workspace_id',
      'business_dimensions.workspace_id','business_documents.workspace_id','business_invitation_scopes.workspace_id',
      'business_member_permissions.workspace_id','business_member_scopes.workspace_id','business_profiles.workspace_id',
      'business_role_permissions.workspace_id','business_roles.workspace_id','business_setup_drafts.workspace_id',
      'business_suppliers.workspace_id','business_support_permits.workspace_id','business_team_operation_permits.workspace_id',
      'cashbook_accounts.workspace_id','cashbook_entries.workspace_id','notification_outbox.workspace_id',
      'payment_conversions.workspace_id','payment_items.workspace_id','payment_records.workspace_id',
      'subscription_entitlement_history.workspace_id','workspace_invitations.workspace_id',
      'workspace_members.workspace_id','workspace_settings.workspace_id','workspace_subscriptions.workspace_id'
    ]
  END;
  IF reviewed_columns IS NULL THEN RAISE EXCEPTION 'FR33_UNSUPPORTED_WORKSPACE_ROOT'; END IF;
  IF cardinality(p_ids) = 0 THEN RETURN; END IF;

  FOR reference IN
    SELECT n.nspname AS schema_name, child.relname AS relation_name, a.attname AS column_name,
      c.confdeltype AS delete_action, cardinality(c.conkey) = 1 AND cardinality(c.confkey) = 1
        AND root.attname = 'id' AND a.atttypid = 'uuid'::regtype AS supported
    FROM pg_constraint c JOIN pg_class child ON child.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = child.relnamespace
    LEFT JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    LEFT JOIN pg_attribute root ON root.attrelid = c.confrelid AND root.attnum = c.confkey[1]
    WHERE c.contype = 'f' AND c.conparentid = 0 AND c.confrelid = p_root
    ORDER BY n.nspname, child.relname, a.attname
  LOOP
    IF reference.supported IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'FR33_OWNED_WORKSPACE_REFERENCE_UNSUPPORTED';
    END IF;
    IF reference.schema_name = 'public' AND reference.delete_action = 'c'
      AND (reference.relation_name || '.' || reference.column_name) = ANY(reviewed_columns) THEN
      CONTINUE;
    END IF;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I = ANY($1))',
      reference.schema_name, reference.relation_name, reference.column_name) INTO has_rows USING p_ids;
    IF has_rows THEN
      RAISE EXCEPTION 'FR33_OWNED_WORKSPACE_DEPENDENCY_REVIEW_REQUIRED'
        USING DETAIL = format('%I.%I.%I',reference.schema_name,reference.relation_name,reference.column_name);
    END IF;
  END LOOP;
END;
$owned_refs$;

CREATE FUNCTION mushavo_account_deletion.execute_confirmed_request(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SET search_path TO pg_catalog SET row_security TO 'off'
AS $execute$
DECLARE
  request mushavo_account_deletion.requests%ROWTYPE;
  subject uuid;
  subject_email text;
  workspace_ids uuid[];
  family_ids uuid[];
  dependencies jsonb;
  completed timestamptz;
BEGIN
  SELECT * INTO request FROM mushavo_account_deletion.requests WHERE id = p_request_id;
  IF request.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object('status','completed','completed_at',request.completed_at);
  END IF;
  subject := request.subject_id;
  IF subject IS NULL THEN RAISE EXCEPTION 'FR33_CONFIRMED_REQUEST_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('fr33-account-deletion:' || subject::text, 0));
  SELECT * INTO STRICT request FROM mushavo_account_deletion.requests WHERE id = p_request_id FOR UPDATE;
  IF request.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object('status','completed','completed_at',request.completed_at);
  END IF;
  IF request.subject_id IS DISTINCT FROM subject OR request.cancelled_at IS NOT NULL
    OR request.workspace_impact_confirmed_at IS NULL THEN RAISE EXCEPTION 'FR33_CONFIRMED_REQUEST_REQUIRED'; END IF;
  SELECT account.email INTO subject_email FROM auth.users account WHERE id = subject FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FR33_DELETION_SUBJECT_MISSING'; END IF;
  IF EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = subject) THEN RAISE EXCEPTION 'FR33_STAFF_REVIEW_REQUIRED'; END IF;

  PERFORM id FROM public.families WHERE owner_id = subject ORDER BY id FOR UPDATE;
  SELECT ARRAY(SELECT id FROM public.families WHERE owner_id = subject ORDER BY id) INTO family_ids;
  PERFORM id FROM public.budget_workspaces WHERE owner_id = subject ORDER BY id FOR UPDATE;
  SELECT ARRAY(SELECT id FROM public.budget_workspaces WHERE owner_id = subject ORDER BY id) INTO workspace_ids;

  IF request.workspace_impact_token IS DISTINCT FROM
    mushavo_account_deletion.owned_workspace_impact(subject)->>'impact_token' THEN
    RAISE EXCEPTION 'FR33_WORKSPACE_IMPACT_CHANGED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.budget_workspaces workspace
    WHERE (workspace.legacy_family_id = ANY(family_ids) AND workspace.owner_id <> subject)
      OR (workspace.id = ANY(workspace_ids) AND (
        workspace.workspace_type NOT IN ('personal','family','household','business')
        OR (workspace.legacy_family_id IS NOT NULL AND NOT workspace.legacy_family_id = ANY(family_ids))
      ))
  ) OR EXISTS (SELECT 1 FROM public.family_heads head WHERE head.user_id = subject
      OR (subject_email IS NOT NULL AND lower(head.email) = lower(subject_email))) THEN
    RAISE EXCEPTION 'FR33_OWNED_WORKSPACE_SCOPE_REVIEW_REQUIRED';
  END IF;

  -- A legacy record attached to another workspace's item must never be erased by cascade.
  IF EXISTS (
    SELECT 1 FROM public.payment_records payment
    JOIN public.payment_items item ON item.id = payment.payment_item_id
    WHERE (payment.workspace_id = ANY(workspace_ids) OR payment.family_id = ANY(family_ids)
        OR item.workspace_id = ANY(workspace_ids) OR item.family_id = ANY(family_ids))
      AND (payment.workspace_id,payment.family_id) IS DISTINCT FROM (item.workspace_id,item.family_id)
  ) OR EXISTS (
    SELECT 1 FROM public.payment_records payment
    JOIN public.payment_conversions conversion ON conversion.payment_record_ref = payment.id
    WHERE (payment.workspace_id = ANY(workspace_ids) OR payment.family_id = ANY(family_ids))
      AND conversion.workspace_id IS DISTINCT FROM payment.workspace_id
  ) THEN RAISE EXCEPTION 'FR33_PAYMENT_WORKSPACE_SCOPE_REVIEW_REQUIRED'; END IF;

  IF EXISTS (SELECT 1 FROM public.payment_records WHERE proof_path IS NOT NULL
      AND (workspace_id = ANY(workspace_ids) OR family_id = ANY(family_ids)))
    OR EXISTS (SELECT 1 FROM public.business_documents WHERE workspace_id = ANY(workspace_ids))
    OR EXISTS (SELECT 1 FROM storage.objects object
      WHERE object.owner_id = subject::text OR object.owner = subject
        OR (object.bucket_id = 'payment-proofs' AND (
          (split_part(object.name,'/',1) = 'personal' AND split_part(object.name,'/',2) = subject::text)
          OR (split_part(object.name,'/',1) = 'families' AND split_part(object.name,'/',2) = ANY(family_ids::text[]))
        )) OR (object.bucket_id IN ('business-documents','business-logos','subscription-proofs')
          AND split_part(object.name,'/',1) = 'workspaces' AND split_part(object.name,'/',2) = ANY(workspace_ids::text[])))
    OR EXISTS (SELECT 1 FROM mushavo_file_ingest.ordinary_uploads WHERE workspace_id = ANY(workspace_ids) OR actor_id = subject)
    OR EXISTS (SELECT 1 FROM mushavo_file_ingest.subscription_uploads WHERE workspace_id = ANY(workspace_ids) OR uploader_id = subject)
    OR EXISTS (SELECT 1 FROM mushavo_file_ingest.business_uploads WHERE workspace_id = ANY(workspace_ids) OR uploader_id = subject)
  THEN RAISE EXCEPTION 'FR33_STORAGE_HANDOFF_REQUIRED'; END IF;

  PERFORM mushavo_account_deletion.require_owned_workspace_cascades('public.families'::regclass,family_ids);
  PERFORM mushavo_account_deletion.require_owned_workspace_cascades('public.budget_workspaces'::regclass,workspace_ids);
  PERFORM mushavo_account_deletion.detach_retained_family_memberships(p_request_id);
  IF EXISTS (SELECT 1 FROM public.business_bill_payments WHERE recorded_by = subject)
    OR EXISTS (SELECT 1 FROM public.business_documents WHERE uploaded_by = subject AND parent_type = 'business_bill_payment')
  THEN PERFORM mushavo_account_deletion.detach_retained_business_bill_recorders(p_request_id); END IF;

  DELETE FROM public.workspace_members member USING public.budget_workspaces workspace
  WHERE member.workspace_id = workspace.id AND workspace.workspace_type = 'business'
    AND workspace.owner_id <> subject AND member.user_id = subject AND member.role <> 'business_owner';

  INSERT INTO mushavo_account_deletion.owned_payment_delete_permits
    SELECT pg_current_xact_id(), unnest(workspace_ids);
  DELETE FROM public.families WHERE id = ANY(family_ids) AND owner_id = subject;
  DELETE FROM public.budget_workspaces WHERE id = ANY(workspace_ids) AND owner_id = subject;
  DELETE FROM mushavo_account_deletion.owned_payment_delete_permits WHERE transaction_id = pg_current_xact_id();

  dependencies := mushavo_account_deletion.review_dependencies(p_request_id);
  IF dependencies->>'status' IS DISTINCT FROM 'REVIEW_ONLY' OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(dependencies->'direct_dependencies') dep
    WHERE (
      (dep->>'schema' = 'auth' AND dep->>'column' = 'user_id' AND dep->>'on_delete' = 'CASCADE'
       AND dep->>'relation' IN ('identities','mfa_factors','mfa_recovery_code_sets','oauth_authorizations',
         'oauth_consents','one_time_tokens','sessions','webauthn_challenges','webauthn_credentials'))
      OR (dep->>'schema' = 'public' AND dep->>'on_delete' = 'CASCADE'
        AND ((dep->>'relation') || '.' || (dep->>'column')) IN ('profiles.id','notifications.user_id',
          'notification_outbox.user_id','push_subscriptions.user_id','push_test_rate_limits.user_id'))
      OR (dep->>'schema' = 'mushavo_email_auth' AND dep->>'relation' = 'account_state'
        AND dep->>'column' = 'user_id' AND dep->>'on_delete' = 'CASCADE')
      OR (dep->>'schema' = 'mushavo_file_ingest' AND dep->>'relation' = 'private_download_usage'
        AND dep->>'column' = 'user_id' AND dep->>'on_delete' = 'CASCADE')
      OR (dep->>'schema' = 'mushavo_account_deletion' AND dep->>'relation' = 'requests'
        AND dep->>'column' = 'subject_id' AND dep->>'on_delete' = 'SET NULL')
      OR (dep->>'schema' = 'public' AND dep->>'relation' = 'workspace_members'
        AND dep->>'column' = 'invited_by' AND dep->>'on_delete' = 'SET NULL')
    ) IS DISTINCT FROM true
  ) THEN RAISE EXCEPTION 'FR33_ACCOUNT_DEPENDENCY_REVIEW_REQUIRED'; END IF;

  UPDATE mushavo_account_deletion.requests
    SET workspace_impact_token = NULL, workspace_impact_confirmed_at = NULL
    WHERE subject_id = subject AND id <> p_request_id;
  DELETE FROM auth.users WHERE id = subject;
  IF NOT FOUND THEN RAISE EXCEPTION 'FR33_DELETION_SUBJECT_MISSING'; END IF;
  IF EXISTS (SELECT 1 FROM auth.sessions WHERE user_id = subject)
    OR EXISTS (SELECT 1 FROM auth.refresh_tokens WHERE user_id = subject::text)
  THEN RAISE EXCEPTION 'FR33_AUTH_SESSION_CLEANUP_REQUIRED'; END IF;

  UPDATE mushavo_account_deletion.requests
  SET completed_at = clock_timestamp(), workspace_impact_token = NULL, workspace_impact_confirmed_at = NULL
  WHERE id = p_request_id AND subject_id IS NULL AND cancelled_at IS NULL
  RETURNING completed_at INTO completed;
  IF NOT FOUND THEN RAISE EXCEPTION 'FR33_COMPLETION_RECEIPT_REQUIRED'; END IF;
  RETURN jsonb_build_object('status','completed','completed_at',completed);
END;
$execute$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.require_owned_workspace_cascades(regclass,uuid[]),
  mushavo_account_deletion.execute_confirmed_request(uuid) FROM PUBLIC, anon, authenticated, service_role;


-- 20261116144517 fr33_erase_owned_business
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


-- 20261116144751 fr33_protect_closed_business_audit
CREATE TRIGGER closed_business_audit_events_immutable
BEFORE UPDATE OR DELETE ON mushavo_account_deletion.closed_business_audit_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_business_audit_mutation();


-- 20261116183515 fr33_retain_business_payment_attribution
-- Historical names follow the original row's Business access policy.
ALTER TABLE public.business_expense_claims
  ADD COLUMN retained_submitter_name text,
  ADD COLUMN retained_payer_name text,
  ADD COLUMN retained_reviewer_name text,
  ALTER COLUMN submitted_by DROP NOT NULL,
  ADD CONSTRAINT fr33_claim_retained_actor CHECK (
    (submitted_by IS NOT NULL OR retained_submitter_name IS NOT NULL)
    AND (retained_submitter_name IS NULL OR (status = 'paid' AND submitted_by IS NULL))
    AND (retained_payer_name IS NULL OR (status = 'paid' AND paid_by IS NULL))
    AND (retained_reviewer_name IS NULL OR (status = 'paid' AND reviewed_by IS NULL))
  );

ALTER TABLE public.business_income_receipts
  ADD COLUMN retained_recorder_name text,
  ADD COLUMN retained_voider_name text,
  ALTER COLUMN recorded_by DROP NOT NULL,
  ADD CONSTRAINT fr33_income_retained_actor CHECK (
    (recorded_by IS NOT NULL OR retained_recorder_name IS NOT NULL)
    AND (retained_recorder_name IS NULL OR recorded_by IS NULL)
    AND (retained_voider_name IS NULL OR (status = 'voided' AND voided_by IS NULL))
  ),
  DROP CONSTRAINT business_income_void_state,
  ADD CONSTRAINT business_income_void_state CHECK (
    (status = 'received' AND voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL)
    OR (status = 'voided' AND voided_at IS NOT NULL AND void_reason IS NOT NULL
      AND (voided_by IS NOT NULL OR retained_voider_name IS NOT NULL))
  );

CREATE TABLE mushavo_account_deletion.business_attribution_permits (
  transaction_id xid8 NOT NULL,
  relation_id oid NOT NULL,
  row_id uuid NOT NULL,
  before_hash bytea NOT NULL,
  after_hash bytea NOT NULL,
  PRIMARY KEY (transaction_id, relation_id, row_id)
);
ALTER TABLE mushavo_account_deletion.business_attribution_permits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.business_attribution_permits FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION mushavo_account_deletion.guard_retained_business_names()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog
AS $guard$
DECLARE
  before_row jsonb := to_jsonb(OLD);
  after_row jsonb := to_jsonb(NEW);
  field text;
BEGIN
  FOREACH field IN ARRAY TG_ARGV LOOP
    IF (TG_OP = 'INSERT' AND after_row->>field IS NOT NULL)
      OR (TG_OP = 'UPDATE' AND before_row->>field IS DISTINCT FROM after_row->>field)
    THEN
      -- Ordinary writes may populate live actor fields. Paid-claim and income
      -- actors can be cleared only together with their historical name.
      IF field IN ('submitted_by','paid_by','reviewed_by','recorded_by','voided_by') AND (
        after_row->>field IS NOT NULL OR (TG_RELID = 'public.business_expense_claims'::regclass
          AND field IN ('paid_by','reviewed_by') AND before_row->>'status' IS DISTINCT FROM 'paid')
      ) THEN CONTINUE; END IF;
      IF TG_OP = 'UPDATE' AND EXISTS (
        SELECT 1 FROM mushavo_account_deletion.business_attribution_permits permit
        WHERE permit.transaction_id = pg_current_xact_id_if_assigned()
          AND permit.relation_id = TG_RELID AND permit.row_id = OLD.id
          AND permit.before_hash = sha256(convert_to(before_row::text,'UTF8'))
          AND permit.after_hash = sha256(convert_to(after_row::text,'UTF8'))
      ) THEN RETURN NEW; END IF;
      RAISE EXCEPTION 'FR33_BUSINESS_HISTORY_ATTRIBUTION_IMMUTABLE';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$guard$;

CREATE TRIGGER fr33_business_claim_attribution_guard
BEFORE INSERT OR UPDATE ON public.business_expense_claims FOR EACH ROW
EXECUTE FUNCTION mushavo_account_deletion.guard_retained_business_names(
  'submitted_by','paid_by','reviewed_by','retained_submitter_name','retained_payer_name','retained_reviewer_name');

CREATE TRIGGER fr33_business_income_attribution_guard
BEFORE INSERT OR UPDATE ON public.business_income_receipts FOR EACH ROW
EXECUTE FUNCTION mushavo_account_deletion.guard_retained_business_names(
  'recorded_by','voided_by','retained_recorder_name','retained_voider_name');

CREATE FUNCTION mushavo_account_deletion.detach_retained_business_claim_and_income_actors(p_request_id uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SET search_path TO pg_catalog SET row_security TO 'off'
AS $detach$
DECLARE
  subject uuid;
  confirmation text;
  display_name text;
  affected record;
  expected jsonb;
  txn xid8 := pg_current_xact_id();
BEGIN
  SELECT subject_id INTO subject FROM mushavo_account_deletion.requests WHERE id = p_request_id AND cancelled_at IS NULL;
  IF subject IS NULL THEN RAISE EXCEPTION 'FR33_CONFIRMED_REQUEST_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('fr33-account-deletion:' || subject::text, 0));
  SELECT workspace_impact_token INTO confirmation FROM mushavo_account_deletion.requests
  WHERE id = p_request_id AND subject_id = subject AND cancelled_at IS NULL
    AND workspace_impact_confirmed_at IS NOT NULL FOR UPDATE;
  IF confirmation IS NULL OR confirmation IS DISTINCT FROM
    mushavo_account_deletion.owned_workspace_impact(subject)->>'impact_token'
  THEN RAISE EXCEPTION 'FR33_WORKSPACE_IMPACT_CHANGED'; END IF;

  SELECT nullif(btrim(profile.full_name),'') INTO display_name
  FROM auth.users account JOIN public.profiles profile ON profile.id = account.id
  WHERE account.id = subject AND lower(btrim(profile.full_name)) IS DISTINCT FROM lower(btrim(account.email));

  FOR affected IN
    SELECT claim.id, to_jsonb(claim) AS before_row, claim.submitted_by, claim.paid_by, claim.reviewed_by,
      claim.retained_submitter_name, claim.retained_payer_name, claim.retained_reviewer_name
    FROM public.business_expense_claims claim JOIN public.budget_workspaces workspace ON workspace.id = claim.workspace_id
    WHERE workspace.workspace_type = 'business' AND workspace.owner_id IS DISTINCT FROM subject AND claim.status = 'paid'
      AND (claim.submitted_by = subject OR claim.paid_by = subject OR claim.reviewed_by = subject)
    ORDER BY claim.id FOR UPDATE OF claim FOR SHARE OF workspace
  LOOP
    IF display_name IS NULL THEN RAISE EXCEPTION 'FR33_RETAINED_PAYMENT_NAME_REQUIRED'; END IF;
    expected := affected.before_row || jsonb_build_object(
      'submitted_by',nullif(affected.submitted_by,subject),'paid_by',nullif(affected.paid_by,subject),
      'reviewed_by',nullif(affected.reviewed_by,subject),
      'retained_submitter_name',CASE WHEN affected.submitted_by = subject THEN display_name ELSE affected.retained_submitter_name END,
      'retained_payer_name',CASE WHEN affected.paid_by = subject THEN display_name ELSE affected.retained_payer_name END,
      'retained_reviewer_name',CASE WHEN affected.reviewed_by = subject THEN display_name ELSE affected.retained_reviewer_name END
    );
    INSERT INTO mushavo_account_deletion.business_attribution_permits VALUES (
      txn,'public.business_expense_claims'::regclass,affected.id,
      sha256(convert_to(affected.before_row::text,'UTF8')),sha256(convert_to(expected::text,'UTF8'))
    );
    UPDATE public.business_expense_claims SET
      submitted_by = (expected->>'submitted_by')::uuid, paid_by = (expected->>'paid_by')::uuid,
      reviewed_by = (expected->>'reviewed_by')::uuid, retained_submitter_name = expected->>'retained_submitter_name',
      retained_payer_name = expected->>'retained_payer_name', retained_reviewer_name = expected->>'retained_reviewer_name'
    WHERE id = affected.id;
  END LOOP;

  FOR affected IN
    SELECT income.id, to_jsonb(income) AS before_row, income.recorded_by, income.voided_by,
      income.retained_recorder_name, income.retained_voider_name
    FROM public.business_income_receipts income JOIN public.budget_workspaces workspace ON workspace.id = income.workspace_id
    WHERE workspace.workspace_type = 'business' AND workspace.owner_id IS DISTINCT FROM subject
      AND (income.recorded_by = subject OR income.voided_by = subject)
    ORDER BY income.id FOR UPDATE OF income FOR SHARE OF workspace
  LOOP
    IF display_name IS NULL THEN RAISE EXCEPTION 'FR33_RETAINED_PAYMENT_NAME_REQUIRED'; END IF;
    expected := affected.before_row || jsonb_build_object(
      'recorded_by',nullif(affected.recorded_by,subject),'voided_by',nullif(affected.voided_by,subject),
      'retained_recorder_name',CASE WHEN affected.recorded_by = subject THEN display_name ELSE affected.retained_recorder_name END,
      'retained_voider_name',CASE WHEN affected.voided_by = subject THEN display_name ELSE affected.retained_voider_name END
    );
    INSERT INTO mushavo_account_deletion.business_attribution_permits VALUES (
      txn,'public.business_income_receipts'::regclass,affected.id,
      sha256(convert_to(affected.before_row::text,'UTF8')),sha256(convert_to(expected::text,'UTF8'))
    );
    UPDATE public.business_income_receipts SET
      recorded_by = (expected->>'recorded_by')::uuid, voided_by = (expected->>'voided_by')::uuid,
      retained_recorder_name = expected->>'retained_recorder_name', retained_voider_name = expected->>'retained_voider_name'
    WHERE id = affected.id;
  END LOOP;
  DELETE FROM mushavo_account_deletion.business_attribution_permits WHERE transaction_id = txn;
END;
$detach$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.guard_retained_business_names(),
  mushavo_account_deletion.detach_retained_business_claim_and_income_actors(uuid) FROM PUBLIC, anon, authenticated, service_role;

DO $extend_executor$
DECLARE
  body text := pg_get_functiondef('mushavo_account_deletion.execute_confirmed_request(uuid)'::regprocedure);
  anchor text := E'  PERFORM mushavo_account_deletion.detach_retained_family_memberships(p_request_id);';
BEGIN
  IF (length(body) - length(replace(body,anchor,''))) <> length(anchor) THEN
    RAISE EXCEPTION 'FR33_EXPECTED_SHARED_WORKSPACE_RETENTION_STEP';
  END IF;
  EXECUTE replace(body,anchor, anchor
    || E'\n  PERFORM mushavo_account_deletion.detach_retained_business_claim_and_income_actors(p_request_id);');
END;
$extend_executor$;

NOTIFY pgrst, 'reload schema';


-- 20261116190818 fr33_retain_shared_proof_files
-- A verified shared file can outlive its original upload actor. The cleanup
-- worker still finds it by bucket and path when its last reference is retired.
ALTER TABLE mushavo_file_ingest.ordinary_uploads ALTER COLUMN actor_id DROP NOT NULL;

CREATE TABLE mushavo_account_deletion.retained_paid_claim_proofs (
  document_id uuid PRIMARY KEY REFERENCES public.business_documents(id) ON DELETE CASCADE,
  storage_object_id uuid NOT NULL,
  detach_transaction xid8 NOT NULL
);
ALTER TABLE mushavo_account_deletion.retained_paid_claim_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.retained_paid_claim_proofs FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION mushavo_account_deletion.matches_retained_paid_claim_proof(p_before jsonb, p_after jsonb)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO pg_catalog SET row_security TO 'off'
AS $match$
  SELECT p_before->>'parent_type' = 'expense_claim'
    AND p_before->>'uploaded_by' IS NOT NULL AND p_after->>'uploaded_by' IS NULL
    AND p_before - 'uploaded_by' = p_after - 'uploaded_by'
    AND EXISTS (
      SELECT 1 FROM mushavo_account_deletion.retained_paid_claim_proofs retained
      JOIN storage.objects object ON object.id = retained.storage_object_id
      WHERE retained.document_id = (p_before->>'id')::uuid
        AND retained.detach_transaction = pg_current_xact_id_if_assigned()
        AND object.bucket_id = 'business-documents' AND object.name = p_before->>'storage_path'
        AND object.owner_id IS NULL AND object.owner IS NULL
    );
$match$;

DO $proof_guards$
DECLARE
  binder text := replace(pg_get_functiondef('mushavo_file_ingest.bind_ordinary_upload()'::regprocedure), E'\r\n', E'\n');
  required_uploader text := replace(pg_get_functiondef('mushavo_account_deletion.require_bill_proof_uploader()'::regprocedure), E'\r\n', E'\n');
  binder_anchor text := E'    and mushavo_account_deletion.matches_managed_bill_proof_detachment(old_row,j) then';
  uploader_anchor text := E'\nBEGIN\n  IF NEW.uploaded_by IS NULL';
BEGIN
  IF (length(binder) - length(replace(binder,binder_anchor,''))) <> length(binder_anchor)
    OR (length(required_uploader) - length(replace(required_uploader,uploader_anchor,''))) <> length(uploader_anchor)
  THEN RAISE EXCEPTION 'FR33_EXPECTED_PROOF_UPLOAD_GUARDS'; END IF;
  EXECUTE replace(binder,binder_anchor,
    E'    and (mushavo_account_deletion.matches_managed_bill_proof_detachment(old_row,j)\n'
    || E'      or mushavo_account_deletion.matches_retained_paid_claim_proof(old_row,j)) then');
  EXECUTE replace(required_uploader,uploader_anchor,
    E'\nBEGIN\n  IF TG_OP = ''UPDATE'' AND OLD.parent_type = ''expense_claim'' AND NEW.uploaded_by IS NULL\n'
    || E'    AND mushavo_account_deletion.matches_retained_paid_claim_proof(to_jsonb(OLD),to_jsonb(NEW)) THEN RETURN NEW; END IF;\n'
    || E'  IF NEW.uploaded_by IS NULL');
END;
$proof_guards$;

CREATE FUNCTION mushavo_account_deletion.prepare_shared_proof_retention(p_request_id uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SET search_path TO pg_catalog SET row_security TO 'off'
AS $prepare$
DECLARE
  subject uuid;
  confirmation text;
  upload mushavo_file_ingest.ordinary_uploads%ROWTYPE;
  file_id uuid;
  document record;
  txn xid8 := pg_current_xact_id();
BEGIN
  SELECT subject_id INTO subject FROM mushavo_account_deletion.requests
  WHERE id = p_request_id AND cancelled_at IS NULL AND workspace_impact_confirmed_at IS NOT NULL;
  IF subject IS NULL THEN RAISE EXCEPTION 'FR33_CONFIRMED_REQUEST_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('fr33-account-deletion:' || subject::text, 0));
  SELECT workspace_impact_token INTO confirmation FROM mushavo_account_deletion.requests
  WHERE id = p_request_id AND subject_id = subject AND cancelled_at IS NULL
    AND workspace_impact_confirmed_at IS NOT NULL FOR UPDATE;
  IF confirmation IS NULL OR confirmation IS DISTINCT FROM
    mushavo_account_deletion.owned_workspace_impact(subject)->>'impact_token'
  THEN RAISE EXCEPTION 'FR33_WORKSPACE_IMPACT_CHANGED'; END IF;

  FOR upload IN
    SELECT item.* FROM mushavo_file_ingest.ordinary_uploads item
    LEFT JOIN public.budget_workspaces workspace ON workspace.id = item.workspace_id
    WHERE item.actor_id = subject OR workspace.owner_id = subject
    ORDER BY item.bucket_id,item.path FOR UPDATE OF item
  LOOP
    IF upload.state = 'removed' AND upload.token IS NULL AND upload.lease_until IS NULL
      AND NOT mushavo_file_ingest.ordinary_upload_has_reference(upload.bucket_id,upload.path)
      AND NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = upload.bucket_id AND name = upload.path)
    THEN
      DELETE FROM mushavo_file_ingest.ordinary_uploads WHERE bucket_id = upload.bucket_id AND path = upload.path;
      CONTINUE;
    END IF;

    IF upload.state <> 'linked' OR upload.token IS NOT NULL OR upload.lease_until IS NOT NULL
      OR upload.actor_id IS DISTINCT FROM subject THEN CONTINUE; END IF;
    IF upload.bucket_id = 'payment-proofs' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.payment_records payment JOIN public.budget_workspaces workspace ON workspace.id = payment.workspace_id
        JOIN public.families family ON family.id = payment.family_id AND family.id = workspace.legacy_family_id
          AND family.owner_id = workspace.owner_id
        WHERE payment.proof_path = upload.path AND payment.workspace_id = upload.workspace_id
          AND payment.visibility = 'family' AND workspace.workspace_type IN ('family','household') AND workspace.owner_id <> subject
          AND payment.recorded_by = subject AND payment.proof_mime_type = upload.mime_type AND payment.proof_size_bytes = upload.byte_count
          AND split_part(upload.path,'/',1) = 'families' AND split_part(upload.path,'/',2) = family.id::text
        FOR SHARE OF payment,workspace,family
      ) THEN CONTINUE; END IF;
    ELSIF upload.bucket_id = 'business-documents' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.business_documents proof JOIN public.budget_workspaces workspace ON workspace.id = proof.workspace_id
        WHERE proof.id = upload.attachment_id AND proof.workspace_id = upload.workspace_id
          AND proof.storage_path = upload.path AND proof.status = 'active' AND proof.uploaded_by = subject
          AND proof.parent_type = upload.parent_type AND proof.parent_id = upload.parent_id
          AND proof.mime_type = upload.mime_type AND proof.size_bytes = upload.byte_count
          AND workspace.workspace_type = 'business' AND workspace.owner_id <> subject
          AND public.business_storage_workspace_id(upload.path) = workspace.id
          AND (
            (proof.parent_type = 'business_bill_payment' AND EXISTS (
              SELECT 1 FROM public.business_bill_payments payment
              WHERE payment.id = proof.parent_id AND payment.workspace_id = proof.workspace_id
            ))
            OR (proof.parent_type = 'expense_claim' AND EXISTS (
              SELECT 1 FROM public.business_expense_claims claim
              WHERE claim.id = proof.parent_id AND claim.workspace_id = proof.workspace_id AND claim.status = 'paid'
            ))
          )
        FOR SHARE OF proof,workspace
      ) THEN CONTINUE; END IF;
    ELSE
      CONTINUE;
    END IF;

    SELECT object.id INTO file_id FROM storage.objects object
    WHERE object.bucket_id = upload.bucket_id AND object.name = upload.path
      AND object.owner_id IS NULL AND object.owner IS NULL
      AND object.metadata->>'mimetype' = upload.mime_type
      AND COALESCE(object.metadata->>'size',object.metadata->>'contentLength') = upload.byte_count::text
    FOR SHARE;
    IF file_id IS NULL THEN CONTINUE; END IF;
    UPDATE mushavo_file_ingest.ordinary_uploads SET actor_id = NULL
    WHERE bucket_id = upload.bucket_id AND path = upload.path;
  END LOOP;

  -- Handle existing claim proofs with or without a managed upload entry.
  FOR document IN
    SELECT proof.id, proof.storage_path, proof.mime_type, proof.size_bytes, proof.workspace_id
    FROM public.business_documents proof
    JOIN public.business_expense_claims claim ON claim.id = proof.parent_id AND claim.workspace_id = proof.workspace_id
    JOIN public.budget_workspaces workspace ON workspace.id = claim.workspace_id
    WHERE proof.parent_type = 'expense_claim' AND claim.status = 'paid' AND proof.status = 'active'
      AND workspace.workspace_type = 'business' AND workspace.owner_id <> subject AND proof.uploaded_by = subject
    ORDER BY proof.id FOR UPDATE OF proof FOR SHARE OF claim,workspace
  LOOP
    SELECT object.id INTO file_id FROM storage.objects object
    WHERE object.bucket_id = 'business-documents' AND object.name = document.storage_path
      AND object.owner_id IS NULL AND object.owner IS NULL
      AND public.business_storage_workspace_id(object.name) = document.workspace_id
      AND object.metadata->>'mimetype' = document.mime_type
      AND COALESCE(object.metadata->>'size',object.metadata->>'contentLength') = document.size_bytes::text
    FOR SHARE;
    IF file_id IS NULL THEN RAISE EXCEPTION 'FR33_CLAIM_PROOF_STORAGE_HANDOFF_REQUIRED'; END IF;
    INSERT INTO mushavo_account_deletion.retained_paid_claim_proofs VALUES (document.id,file_id,txn);
    UPDATE public.business_documents SET uploaded_by = NULL WHERE id = document.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'FR33_CLAIM_PROOF_SCOPE_CHANGED'; END IF;
    DELETE FROM mushavo_account_deletion.retained_paid_claim_proofs WHERE document_id = document.id;
  END LOOP;
END;
$prepare$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.prepare_shared_proof_retention(uuid),
  mushavo_account_deletion.matches_retained_paid_claim_proof(jsonb,jsonb) FROM PUBLIC, anon, authenticated, service_role;

DO $extend_executor$
DECLARE
  body text := pg_get_functiondef('mushavo_account_deletion.execute_confirmed_request(uuid)'::regprocedure);
  anchor text := E'  IF EXISTS (SELECT 1 FROM public.payment_records WHERE proof_path IS NOT NULL';
BEGIN
  IF (length(body) - length(replace(body,anchor,''))) <> length(anchor) THEN
    RAISE EXCEPTION 'FR33_EXPECTED_STORAGE_PREFLIGHT';
  END IF;
  EXECUTE replace(body,anchor,E'  PERFORM mushavo_account_deletion.prepare_shared_proof_retention(p_request_id);\n' || anchor);
END;
$extend_executor$;


-- 20261117080454 fr33_keep_recipient_notifications
-- Keep another user's notice when its creator deletes their account.
-- The existing FK clears only created_by. Other notification links retain
-- their original review rules.
DO $allow_notification_creator_detachment$
DECLARE
  body text := pg_get_functiondef('mushavo_account_deletion.execute_confirmed_request(uuid)'::regprocedure);
  anchor text := E'      OR (dep->>''schema'' = ''public'' AND dep->>''relation'' = ''workspace_members''';
BEGIN
  IF (length(body) - length(replace(body,anchor,''))) <> length(anchor) THEN
    RAISE EXCEPTION 'FR33_EXPECTED_ACCOUNT_DEPENDENCY_ALLOWLIST';
  END IF;
  EXECUTE replace(body,anchor,
    E'      OR (dep->>''schema'' = ''public'' AND dep->>''relation'' = ''notifications''\n'
    || E'        AND dep->>''column'' = ''created_by'' AND dep->>''on_delete'' = ''SET NULL'')\n' || anchor);
END;
$allow_notification_creator_detachment$;


-- 20261117083345 fr33_owned_workspace_file_cleanup
-- Managed proofs and documents from confirmed workspace closures use the
-- existing leased Storage cleanup worker. Completion requires its readback.
ALTER TABLE mushavo_account_deletion.requests
  ADD COLUMN erasure_committed_at timestamptz,
  ADD CONSTRAINT requests_erasure_receipt_scope CHECK (
    erasure_committed_at IS NULL OR (
      subject_id IS NULL AND cancelled_at IS NULL AND workspace_impact_token IS NULL
      AND workspace_impact_confirmed_at IS NULL AND erasure_committed_at >= created_at
      AND (completed_at IS NULL OR completed_at >= erasure_committed_at)
    )
  );

CREATE TABLE mushavo_account_deletion.file_cleanup_targets (
  bucket_id text NOT NULL CHECK (bucket_id IN ('payment-proofs','business-documents')),
  path text NOT NULL CHECK (public.fr32_is_managed_ordinary_upload(bucket_id,path)),
  request_id uuid NOT NULL REFERENCES mushavo_account_deletion.requests(id) ON DELETE RESTRICT,
  PRIMARY KEY (bucket_id,path)
);
CREATE INDEX file_cleanup_targets_request_idx
  ON mushavo_account_deletion.file_cleanup_targets(request_id);
ALTER TABLE mushavo_account_deletion.file_cleanup_targets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.file_cleanup_targets FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION mushavo_account_deletion.prepare_owned_file_cleanup(
  p_request_id uuid, p_subject uuid, p_workspace_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
DECLARE
  upload mushavo_file_ingest.ordinary_uploads%ROWTYPE;
BEGIN
  FOR upload IN
    SELECT candidate.* FROM mushavo_file_ingest.ordinary_uploads candidate
    WHERE candidate.workspace_id = ANY(p_workspace_ids)
      AND candidate.bucket_id IN ('payment-proofs','business-documents')
      AND candidate.state = 'linked' AND candidate.token IS NULL AND candidate.lease_until IS NULL
    ORDER BY candidate.bucket_id,candidate.path FOR UPDATE
  LOOP
    IF upload.bucket_id = 'payment-proofs' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.payment_records payment
        JOIN public.budget_workspaces workspace ON workspace.id = payment.workspace_id
        WHERE payment.proof_path = upload.path AND workspace.id = upload.workspace_id
          AND workspace.owner_id = p_subject AND payment.recorded_by IS NOT DISTINCT FROM upload.actor_id
          AND payment.proof_mime_type = upload.mime_type AND payment.proof_size_bytes = upload.byte_count
          AND (
            (workspace.workspace_type = 'personal' AND workspace.legacy_family_id IS NULL
              AND payment.visibility = 'personal' AND payment.family_id IS NULL
              AND payment.owner_id = p_subject AND split_part(upload.path,'/',1) = 'personal'
              AND split_part(upload.path,'/',2) = p_subject::text)
            OR (workspace.workspace_type IN ('family','household') AND payment.visibility = 'family'
              AND payment.family_id = workspace.legacy_family_id AND split_part(upload.path,'/',1) = 'families'
              AND split_part(upload.path,'/',2) = workspace.legacy_family_id::text)
          )
          AND NOT EXISTS (SELECT 1 FROM public.payment_records duplicate
            WHERE duplicate.proof_path = upload.path AND duplicate.id <> payment.id)
        FOR SHARE OF payment
      ) THEN CONTINUE; END IF;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.business_documents document
        JOIN public.budget_workspaces workspace ON workspace.id = document.workspace_id
        WHERE document.id = upload.attachment_id AND document.storage_path = upload.path
          AND workspace.id = upload.workspace_id AND workspace.workspace_type = 'business'
          AND workspace.owner_id = p_subject AND public.business_storage_workspace_id(upload.path) = workspace.id
          AND document.uploaded_by IS NOT DISTINCT FROM upload.actor_id
          AND document.parent_id = upload.parent_id AND document.parent_type = upload.parent_type
          AND document.mime_type = upload.mime_type AND document.size_bytes = upload.byte_count
          AND NOT EXISTS (SELECT 1 FROM public.business_documents duplicate
            WHERE duplicate.storage_path = upload.path AND duplicate.id <> document.id)
        FOR SHARE OF document
      ) THEN CONTINUE; END IF;
    END IF;

    PERFORM 1 FROM storage.objects object
    WHERE object.bucket_id = upload.bucket_id AND object.name = upload.path
      AND object.owner_id IS NULL AND object.owner IS NULL
      AND object.metadata->>'mimetype' = upload.mime_type
      AND COALESCE(object.metadata->>'size',object.metadata->>'contentLength') = upload.byte_count::text
    FOR SHARE;
    IF NOT FOUND THEN CONTINUE; END IF;

    INSERT INTO mushavo_account_deletion.file_cleanup_targets (bucket_id,path,request_id)
    VALUES (upload.bucket_id,upload.path,p_request_id);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION mushavo_account_deletion.prepare_owned_file_cleanup(uuid,uuid,uuid[])
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fr32_finish_ordinary_cleanup(p_bucket text,p_path text,p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $$
DECLARE
  target_request uuid;
BEGIN
  UPDATE mushavo_file_ingest.ordinary_uploads upload
  SET state = 'removed', token = NULL, lease_until = NULL
  WHERE upload.bucket_id = p_bucket AND upload.path = p_path
    AND upload.state = 'claimed' AND upload.token = p_token
    AND NOT mushavo_file_ingest.ordinary_upload_has_reference(p_bucket,p_path)
    AND NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = p_bucket AND name = p_path);
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT request_id INTO target_request FROM mushavo_account_deletion.file_cleanup_targets
  WHERE bucket_id = p_bucket AND path = p_path;
  IF NOT FOUND THEN RETURN true; END IF;

  -- Serialize acknowledgements of paths belonging to the same request.
  PERFORM 1 FROM mushavo_account_deletion.requests
  WHERE id = target_request AND erasure_committed_at IS NOT NULL AND completed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FR33_FILE_CLEANUP_RECEIPT_REQUIRED'; END IF;
  DELETE FROM mushavo_account_deletion.file_cleanup_targets
  WHERE bucket_id = p_bucket AND path = p_path AND request_id = target_request;
  DELETE FROM mushavo_file_ingest.ordinary_uploads WHERE bucket_id = p_bucket AND path = p_path;
  UPDATE mushavo_account_deletion.requests
  SET completed_at = CASE WHEN NOT EXISTS (
    SELECT 1 FROM mushavo_account_deletion.file_cleanup_targets WHERE request_id = target_request
  ) THEN greatest(clock_timestamp(),erasure_committed_at) END
  WHERE id = target_request;
  RETURN true;
END;
$$;

DO $migration$
DECLARE
  body text := pg_get_functiondef('mushavo_account_deletion.execute_confirmed_request(uuid)'::regprocedure);
  old_storage_gate text := $old$
  IF EXISTS (SELECT 1 FROM public.payment_records WHERE proof_path IS NOT NULL
      AND (workspace_id = ANY(workspace_ids) OR family_id = ANY(family_ids)))
    OR EXISTS (SELECT 1 FROM public.business_documents WHERE workspace_id = ANY(workspace_ids))
    OR EXISTS (SELECT 1 FROM storage.objects object
      WHERE object.owner_id = subject::text OR object.owner = subject
        OR (object.bucket_id = 'payment-proofs' AND (
          (split_part(object.name,'/',1) = 'personal' AND split_part(object.name,'/',2) = subject::text)
          OR (split_part(object.name,'/',1) = 'families' AND split_part(object.name,'/',2) = ANY(family_ids::text[]))
        )) OR (object.bucket_id IN ('business-documents','business-logos','subscription-proofs')
          AND split_part(object.name,'/',1) = 'workspaces' AND split_part(object.name,'/',2) = ANY(workspace_ids::text[])))
    OR EXISTS (SELECT 1 FROM mushavo_file_ingest.ordinary_uploads WHERE workspace_id = ANY(workspace_ids) OR actor_id = subject)
$old$;
  new_storage_gate text := $new$
  PERFORM mushavo_account_deletion.prepare_owned_file_cleanup(p_request_id, subject, workspace_ids);
  IF EXISTS (SELECT 1 FROM public.payment_records payment WHERE payment.proof_path IS NOT NULL
      AND (payment.workspace_id = ANY(workspace_ids) OR payment.family_id = ANY(family_ids))
      AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.file_cleanup_targets target
        WHERE target.request_id = p_request_id AND target.bucket_id = 'payment-proofs' AND target.path = payment.proof_path))
    OR EXISTS (SELECT 1 FROM public.business_documents document WHERE document.workspace_id = ANY(workspace_ids)
      AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.file_cleanup_targets target
        WHERE target.request_id = p_request_id AND target.bucket_id = 'business-documents' AND target.path = document.storage_path))
    OR EXISTS (SELECT 1 FROM storage.objects object
      WHERE object.owner_id = subject::text OR object.owner = subject
        OR (((object.bucket_id = 'payment-proofs' AND (
          (split_part(object.name,'/',1) = 'personal' AND split_part(object.name,'/',2) = subject::text)
          OR (split_part(object.name,'/',1) = 'families' AND split_part(object.name,'/',2) = ANY(family_ids::text[]))
        )) OR (object.bucket_id IN ('business-documents','business-logos','subscription-proofs')
          AND split_part(object.name,'/',1) = 'workspaces' AND split_part(object.name,'/',2) = ANY(workspace_ids::text[])))
          AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.file_cleanup_targets target
            WHERE target.request_id = p_request_id AND target.bucket_id = object.bucket_id AND target.path = object.name)))
    OR EXISTS (SELECT 1 FROM mushavo_file_ingest.ordinary_uploads upload
      WHERE (upload.workspace_id = ANY(workspace_ids) OR upload.actor_id = subject)
        AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.file_cleanup_targets target
          WHERE target.request_id = p_request_id AND target.bucket_id = upload.bucket_id AND target.path = upload.path))
$new$;
  completed_return text := $old$    RETURN jsonb_build_object('status','completed','completed_at',request.completed_at);
  END IF;$old$;
  pending_return text := $new$
  IF request.erasure_committed_at IS NOT NULL THEN
    RETURN jsonb_build_object('status','files_pending');
  END IF;$new$;
  review_start text := $old$  dependencies := mushavo_account_deletion.review_dependencies(p_request_id);$old$;
  files_ready text := $new$  IF EXISTS (
    SELECT 1 FROM mushavo_account_deletion.file_cleanup_targets target
    LEFT JOIN mushavo_file_ingest.ordinary_uploads upload
      ON (upload.bucket_id,upload.path) = (target.bucket_id,target.path)
    WHERE target.request_id = p_request_id AND (
      upload.state IS DISTINCT FROM 'ready' OR upload.token IS NOT NULL OR upload.lease_until IS NOT NULL
      OR upload.expires_at > clock_timestamp()
      OR mushavo_file_ingest.ordinary_upload_has_reference(target.bucket_id,target.path)
    )
  ) THEN RAISE EXCEPTION 'FR33_OWNED_FILE_CLEANUP_NOT_READY'; END IF;

  UPDATE mushavo_file_ingest.ordinary_uploads upload SET actor_id = NULL
  FROM mushavo_account_deletion.file_cleanup_targets target
  WHERE target.request_id = p_request_id AND (upload.bucket_id,upload.path) = (target.bucket_id,target.path);

$new$;
  receipt_update text := $old$  UPDATE mushavo_account_deletion.requests
  SET completed_at = clock_timestamp(), workspace_impact_token = NULL, workspace_impact_confirmed_at = NULL$old$;
  pending_receipt text := $new$  IF EXISTS (SELECT 1 FROM mushavo_account_deletion.file_cleanup_targets WHERE request_id = p_request_id) THEN
    UPDATE mushavo_account_deletion.requests
    SET erasure_committed_at = clock_timestamp(), workspace_impact_token = NULL, workspace_impact_confirmed_at = NULL
    WHERE id = p_request_id AND subject_id IS NULL AND completed_at IS NULL AND cancelled_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'FR33_COMPLETION_RECEIPT_REQUIRED'; END IF;
    RETURN jsonb_build_object('status','files_pending');
  END IF;

$new$;
BEGIN
  IF cardinality(string_to_array(body,old_storage_gate)) <> 2
    OR cardinality(string_to_array(body,completed_return)) <> 3
    OR cardinality(string_to_array(body,review_start)) <> 2
    OR cardinality(string_to_array(body,receipt_update)) <> 2
  THEN RAISE EXCEPTION 'FR33_UNEXPECTED_OWNED_FILE_EXECUTOR_BASE'; END IF;
  body := replace(body,old_storage_gate,new_storage_gate);
  body := replace(body,completed_return,completed_return || pending_return);
  body := replace(body,review_start,files_ready || review_start);
  body := replace(body,receipt_update,pending_receipt || receipt_update);
  EXECUTE body;
END;
$migration$;


-- 20261117085504 fr33_schedule_account_erasure
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE TABLE mushavo_account_deletion.processor_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  confirmed_since timestamptz,
  fixture_request_id uuid REFERENCES mushavo_account_deletion.requests(id) ON DELETE RESTRICT,
  CHECK (fixture_request_id IS NULL OR confirmed_since IS NOT NULL)
);
INSERT INTO mushavo_account_deletion.processor_control DEFAULT VALUES;
ALTER TABLE mushavo_account_deletion.processor_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.processor_control FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE mushavo_account_deletion.processor_attempts (
  request_id uuid PRIMARY KEY REFERENCES mushavo_account_deletion.requests(id) ON DELETE CASCADE,
  confirmed_at timestamptz NOT NULL,
  attempted_at timestamptz NOT NULL,
  attempt_count integer NOT NULL CHECK (attempt_count > 0),
  retry_at timestamptz,
  review_code text CHECK (review_code ~ '^FR33_[A-Z_]+$'),
  CHECK (retry_at IS NULL OR (review_code IS NULL AND retry_at > attempted_at))
);
ALTER TABLE mushavo_account_deletion.processor_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.processor_attempts FROM PUBLIC, anon, authenticated, service_role;

CREATE INDEX fr33_confirmed_deletion_queue_idx
  ON mushavo_account_deletion.requests(workspace_impact_confirmed_at,id)
  WHERE subject_id IS NOT NULL AND cancelled_at IS NULL AND completed_at IS NULL
    AND erasure_committed_at IS NULL AND workspace_impact_confirmed_at IS NOT NULL;

CREATE FUNCTION mushavo_account_deletion.process_confirmed_requests()
RETURNS jsonb LANGUAGE plpgsql
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
SET lock_timeout TO '2s'
AS $$
DECLARE
  control mushavo_account_deletion.processor_control%ROWTYPE;
  candidate record;
  outcome text;
  attempt_time timestamptz;
  retry_at timestamptz;
  review_code text;
  finished integer := 0;
  files_pending integer := 0;
  deferred integer := 0;
  review integer := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtextextended('fr33-confirmed-deletion-processor',0)) THEN
    RETURN jsonb_build_object('status','busy');
  END IF;
  SELECT * INTO STRICT control FROM mushavo_account_deletion.processor_control WHERE singleton FOR SHARE;
  IF control.confirmed_since IS NULL THEN
    RETURN jsonb_build_object('status','disabled');
  END IF;

  FOR candidate IN
    SELECT request.id, request.workspace_impact_confirmed_at AS confirmed_at,
      COALESCE(attempt.attempt_count,0)+1 AS attempt_count
    FROM mushavo_account_deletion.requests request
    LEFT JOIN mushavo_account_deletion.processor_attempts attempt
      ON attempt.request_id = request.id AND attempt.confirmed_at = request.workspace_impact_confirmed_at
    WHERE request.subject_id IS NOT NULL AND request.cancelled_at IS NULL AND request.completed_at IS NULL
      AND request.erasure_committed_at IS NULL AND request.workspace_impact_confirmed_at >= control.confirmed_since
      AND (control.fixture_request_id IS NULL OR request.id = control.fixture_request_id)
      AND (attempt.request_id IS NULL OR attempt.retry_at <= statement_timestamp())
    ORDER BY request.workspace_impact_confirmed_at,request.id
    LIMIT 3
  LOOP
    attempt_time := clock_timestamp();
    retry_at := NULL;
    review_code := NULL;
    BEGIN
      outcome := mushavo_account_deletion.execute_confirmed_request(candidate.id)->>'status';
      CASE outcome
        WHEN 'completed' THEN finished := finished+1;
        WHEN 'files_pending' THEN files_pending := files_pending+1;
        ELSE RAISE EXCEPTION 'FR33_UNEXPECTED_PROCESSOR_RESULT';
      END CASE;
    EXCEPTION
      WHEN lock_not_available OR serialization_failure OR deadlock_detected THEN
        IF candidate.attempt_count < 3 THEN
          retry_at := attempt_time+make_interval(mins => candidate.attempt_count);
          deferred := deferred+1;
        ELSE
          review_code := 'FR33_RETRY_LIMIT_REACHED';
        END IF;
      WHEN OTHERS THEN
        review_code := CASE WHEN SQLERRM ~ '^FR33_[A-Z_]{3,80}$' THEN SQLERRM ELSE 'FR33_PROCESSOR_REVIEW_REQUIRED' END;
    END;
    IF review_code IS NOT NULL THEN review := review+1; END IF;
    INSERT INTO mushavo_account_deletion.processor_attempts
      (request_id,confirmed_at,attempted_at,attempt_count,retry_at,review_code)
    VALUES (candidate.id,candidate.confirmed_at,attempt_time,candidate.attempt_count,retry_at,review_code)
    ON CONFLICT (request_id) DO UPDATE
    SET confirmed_at = excluded.confirmed_at, attempted_at = excluded.attempted_at,
        attempt_count = excluded.attempt_count, retry_at = excluded.retry_at, review_code = excluded.review_code;
  END LOOP;

  RETURN jsonb_build_object('status','processed','completed',finished,'files_pending',files_pending,
    'deferred',deferred,'review',review);
END;
$$;
REVOKE ALL ON FUNCTION mushavo_account_deletion.process_confirmed_requests()
  FROM PUBLIC, anon, authenticated, service_role;

DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT cron.schedule(
    'mushavo-fr33-account-erasure', '* * * * *',
    'SELECT mushavo_account_deletion.process_confirmed_requests()'
  ) INTO job_id;
  PERFORM cron.alter_job(job_id,active := false);
END;
$$;

NOTIFY pgrst,'reload schema';
