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
