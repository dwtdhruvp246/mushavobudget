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
