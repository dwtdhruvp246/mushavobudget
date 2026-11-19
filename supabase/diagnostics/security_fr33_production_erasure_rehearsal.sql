-- Production database rehearsal scoped to two new synthetic accounts.
-- The whole test, including the processor settings, is rolled back.
BEGIN;
SET LOCAL lock_timeout='3s';
DO $fr33_fixture$
DECLARE
  departing uuid := gen_random_uuid();
  staying uuid := gen_random_uuid();
  closing_family uuid;
  closing_household uuid;
  closing_business uuid;
  surviving_family uuid;
  surviving_household uuid;
  payer uuid;
  bill uuid;
  payment uuid;
  ticket uuid;
  deletion_request uuid;
  confirmation text;
  result jsonb;
  reason text;
BEGIN
  IF mushavo_account_deletion.process_confirmed_requests()->>'status' IS DISTINCT FROM 'disabled'
    OR EXISTS (SELECT 1 FROM mushavo_account_deletion.requests WHERE cancelled_at IS NULL AND completed_at IS NULL)
  THEN RAISE EXCEPTION 'FR33_REHEARSAL_REQUIRES_DISABLED_EMPTY_QUEUE'; END IF;
  INSERT INTO auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    VALUES
    (departing,'authenticated','authenticated','fr33-departing-'||departing::text||'@example.invalid',now(),
      '{"provider":"email","providers":["email"]}','{"full_name":"Disposable Payer"}',now(),now()),
    (staying,'authenticated','authenticated','fr33-staying-'||staying::text||'@example.invalid',now(),
      '{"provider":"email","providers":["email"]}','{"full_name":"Disposable Owner"}',now(),now());
  IF (SELECT count(*) FROM public.profiles WHERE id IN (departing,staying))<>2
  THEN RAISE EXCEPTION 'FR33_REHEARSAL_PROFILE_CREATION_FAILED'; END IF;

  INSERT INTO public.families(owner_id,name) VALUES(departing,'Disposable closing Family') RETURNING id INTO closing_family;
  SELECT id INTO closing_household FROM public.budget_workspaces WHERE legacy_family_id=closing_family;
  IF closing_household IS NULL THEN
    INSERT INTO public.budget_workspaces(owner_id,legacy_family_id,workspace_type,name)
      VALUES(departing,closing_family,'household','Disposable closing Family') RETURNING id INTO closing_household;
  END IF;
  -- Use the normal transaction-bound provisioning permit for this new fixture.
  closing_business := gen_random_uuid();
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',departing)::text,true);
  INSERT INTO public.business_public_provision_permits(transaction_id,workspace_id,owner_id,actor_id)
    VALUES(txid_current(),closing_business,departing,departing);
  INSERT INTO public.budget_workspaces(id,owner_id,workspace_type,name)
    VALUES(closing_business,departing,'business','Disposable closing Business');
  DELETE FROM public.business_public_provision_permits
    WHERE transaction_id=txid_current() AND workspace_id=closing_business AND owner_id=departing;
  PERFORM set_config('request.jwt.claims','{}',true);
  INSERT INTO public.families(owner_id,name) VALUES(staying,'Disposable surviving Family') RETURNING id INTO surviving_family;
  SELECT id INTO surviving_household FROM public.budget_workspaces WHERE legacy_family_id=surviving_family;
  IF surviving_household IS NULL THEN
    INSERT INTO public.budget_workspaces(owner_id,legacy_family_id,workspace_type,name)
      VALUES(staying,surviving_family,'household','Disposable surviving Family') RETURNING id INTO surviving_household;
  END IF;

  INSERT INTO public.workspace_members(workspace_id,user_id,role)
    VALUES(surviving_household,departing,'family_member') ON CONFLICT (workspace_id,user_id) DO NOTHING;
  INSERT INTO public.workspace_subscriptions(workspace_id,plan_id,status,paid_through_at)
    SELECT surviving_household,id,'active',now()+interval '30 days' FROM public.plans WHERE code='household'
    ON CONFLICT (workspace_id) DO UPDATE
    SET plan_id=excluded.plan_id,status=excluded.status,paid_through_at=excluded.paid_through_at;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',departing)::text,true);
  INSERT INTO public.family_members(family_id,user_id,created_by,name,role)
    VALUES(surviving_family,departing,staying,'Disposable Payer','Adult') RETURNING id INTO payer;
  INSERT INTO public.payment_items(family_id,created_by,name,amount,owner_id,visibility,workspace_id)
    VALUES(surviving_family,departing,'Disposable retained item',10,staying,'family',surviving_household) RETURNING id INTO bill;
  INSERT INTO public.payment_records(family_id,payment_item_id,period_start,due_date,paid_by_member_id,
    amount,payment_date,recorded_by,owner_id,visibility,workspace_id)
    VALUES(surviving_family,bill,date_trunc('month',current_date)::date,current_date,payer,10,current_date,
      departing,staying,'family',surviving_household) RETURNING id INTO payment;
  INSERT INTO public.support_tickets(customer_id,created_by,subject,description)
    VALUES(departing,departing,'Disposable support case','Synthetic rehearsal') RETURNING id INTO ticket;

  PERFORM set_config('request.jwt.claims','{}',true);
  SELECT mushavo_account_deletion.owned_workspace_impact(departing)->>'impact_token' INTO STRICT confirmation;
  INSERT INTO mushavo_account_deletion.requests(subject_id,workspace_impact_token,workspace_impact_confirmed_at)
    VALUES(departing,confirmation,statement_timestamp()) RETURNING id INTO deletion_request;
  UPDATE mushavo_account_deletion.processor_control SET confirmed_since=statement_timestamp()-interval '1 minute',
    fixture_request_id=deletion_request WHERE singleton;
  IF NOT FOUND THEN RAISE EXCEPTION 'FR33_REHEARSAL_CONTROL_MISSING'; END IF;
  result := mushavo_account_deletion.process_confirmed_requests();
  IF result->>'completed' IS DISTINCT FROM '1' THEN
    SELECT review_code INTO reason FROM mushavo_account_deletion.processor_attempts WHERE request_id=deletion_request;
    RAISE EXCEPTION 'FR33_REHEARSAL_WORKER_%', coalesce(reason,'UNEXPECTED');
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id=departing)
    OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id=staying)
    OR EXISTS (SELECT 1 FROM public.families WHERE id=closing_family)
    OR EXISTS (SELECT 1 FROM public.budget_workspaces WHERE id IN (closing_household,closing_business))
    OR NOT EXISTS (SELECT 1 FROM public.budget_workspaces WHERE id=surviving_household)
    OR NOT EXISTS (SELECT 1 FROM public.payment_records WHERE id=payment AND recorded_by IS NULL AND amount=10)
    OR NOT EXISTS (SELECT 1 FROM public.fr33_family_payment_names
      WHERE payment_id=payment AND payer_name='Disposable Payer' AND recorder_name='Disposable Payer')
    OR NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.retained_support_records WHERE record_type='ticket' AND record_id=ticket)
    OR NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.requests WHERE id=deletion_request AND subject_id IS NULL AND completed_at IS NOT NULL)
  THEN RAISE EXCEPTION 'FR33_REHEARSAL_OUTCOME_MISMATCH'; END IF;
  PERFORM set_config('mushavo_fr33.erasure_rehearsal','PASS',true);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('mushavo_fr33.erasure_rehearsal',
    jsonb_build_object('state',SQLSTATE,'error',SQLERRM)::text,true);
END;
$fr33_fixture$;
SELECT current_setting('mushavo_fr33.erasure_rehearsal') AS outcome;
ROLLBACK;
