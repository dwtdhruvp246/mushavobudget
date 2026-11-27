-- 3.2.2 STAGING ONLY dczlddwbtgvfdujgcitb.
-- Manually verify the Dashboard URL before running the whole script once.
-- Creates two synthetic Family fixtures, not a product migration or payment.
BEGIN;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '5s';
CREATE TEMP TABLE mushavo_s322_receipt (created_families integer, dispatch_guard boolean) ON COMMIT DROP;
DO $fixture$
DECLARE
  v_users uuid[];
  v_emails text[] := ARRAY['audit.owner@example.com', 'audit.outsider@example.com'];
  v_names text[] := ARRAY['AUDIT-S322-FAMILY-PRIMARY', 'AUDIT-S322-FAMILY-SECONDARY'];
  v_family uuid;
  v_workspace uuid;
  v_member uuid;
  v_item uuid;
  v_plan uuid;
  v_jobs boolean := false;
  i integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('mushavo-stage-3-family-fixture'));
  IF (SELECT count(*) FROM auth.users) <> 2
    OR (SELECT count(*) FROM auth.users WHERE lower(email) = ANY(v_emails)) <> 2 THEN
    RAISE EXCEPTION 'EXPECTED_TWO_SYNTHETIC_STAGING_AUTH_USERS';
  END IF;
  SELECT ARRAY[
    (SELECT id FROM auth.users WHERE lower(email) = v_emails[1]),
    (SELECT id FROM auth.users WHERE lower(email) = v_emails[2])
  ] INTO v_users;
  IF (SELECT count(*) FROM public.profiles p JOIN auth.users u ON u.id=p.id
      WHERE p.id = ANY(v_users) AND lower(p.email)=lower(u.email) AND p.account_status = 'active') <> 2
    OR EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = ANY(v_users)) THEN
    RAISE EXCEPTION 'EXPECTED_ORDINARY_ACTIVE_SYNTHETIC_PROFILES';
  END IF;
  IF EXISTS (SELECT 1 FROM public.families) THEN
    RAISE EXCEPTION 'STAGING_FAMILY_FIXTURE_REQUIRES_NO_EXISTING_FAMILIES';
  END IF;
  IF EXISTS (SELECT 1 FROM public.push_subscriptions) THEN
    RAISE EXCEPTION 'STAGING_PUSH_SUBSCRIPTIONS_MUST_BE_EMPTY';
  END IF;
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM cron.job WHERE active)' INTO v_jobs;
  END IF;
  IF v_jobs THEN RAISE EXCEPTION 'ACTIVE_STAGING_CRON_REQUIRES_REVIEW'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.notifications'::regclass AND NOT tgisinternal AND tgenabled <> 'D'
      AND NOT (
        (tgname = 'set_notification_workspace_context_trigger'
         AND tgfoid = 'public.set_notification_workspace_context()'::regprocedure)
        OR (tgname = 'guard_suspended_account_write_trigger'
         AND tgfoid = 'public.guard_suspended_account_write()'::regprocedure)
        OR (tgname = 'guard_business_invitation_notification_trigger'
         AND tgfoid = 'public.guard_business_invitation_notification()'::regprocedure)
      )
  ) THEN RAISE EXCEPTION 'UNREVIEWED_NOTIFICATION_TRIGGER'; END IF;
  SELECT id INTO v_plan FROM public.plans
    WHERE code = 'household' AND workspace_type = 'household' AND is_active;
  IF v_plan IS NULL THEN RAISE EXCEPTION 'HOUSEHOLD_PLAN_REQUIRED'; END IF;
  FOR i IN 1..2 LOOP
    -- Transaction-local claims supply the known fixture owner to existing guards.
    -- They do not create an Auth session, change a role or persist project settings.
    PERFORM set_config('request.jwt.claim.sub', v_users[i]::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object(
      'sub', v_users[i], 'email', v_emails[i], 'role', 'authenticated')::text, true);
    INSERT INTO public.families(owner_id, owner_email, name, monthly_budget, currency)
      VALUES (v_users[i], v_emails[i], v_names[i], 0, 'USD') RETURNING id INTO v_family;
    SELECT id INTO v_workspace FROM public.budget_workspaces
      WHERE legacy_family_id = v_family AND owner_id = v_users[i] AND workspace_type = 'household';
    IF v_workspace IS NULL THEN RAISE EXCEPTION 'FAMILY_WORKSPACE_SYNC_FAILED'; END IF;
    UPDATE public.workspace_subscriptions SET plan_id = v_plan, status = 'active',
      member_limit = 4, paid_through_at = now() + interval '7 days', billing_period = 'monthly'
      WHERE workspace_id = v_workspace;
    IF NOT FOUND THEN RAISE EXCEPTION 'FAMILY_SUBSCRIPTION_SYNC_FAILED'; END IF;
    UPDATE public.workspace_settings SET reminder_enabled = false, conversion_enabled = false,
      default_payment_currency = 'USD', reporting_currency = 'USD', enabled_currencies = ARRAY['USD']
      WHERE workspace_id = v_workspace;
    IF NOT FOUND THEN RAISE EXCEPTION 'FAMILY_SETTINGS_SYNC_FAILED'; END IF;
    INSERT INTO public.family_members(family_id, user_id, created_by, name, role, email, status)
      VALUES (v_family, v_users[i], v_users[i], 'Synthetic audit family head', 'Owner', v_emails[i], 'active')
      RETURNING id INTO v_member;
    INSERT INTO public.payment_items(family_id, owner_id, visibility, responsible_member_id,
      created_by, name, amount, currency, recurrence_type, start_date, status, notes)
      VALUES (v_family, v_users[i], 'family', v_member, v_users[i], v_names[i] || '-PAYMENT',
        1, 'USD', 'once', current_date, 'inactive', 'Synthetic Family audit fixture') RETURNING id INTO v_item;
    INSERT INTO public.payment_records(family_id, owner_id, visibility, payment_item_id,
      period_start, due_date, paid_by_member_id, amount, currency, payment_date, payment_method, recorded_by, notes)
      VALUES (v_family, v_users[i], 'family', v_item, current_date, current_date, v_member,
        1, 'USD', current_date, 'Other', v_users[i], 'Synthetic Family audit fixture');
  END LOOP;
  IF (SELECT count(*) FROM public.families WHERE name = ANY(v_names)) <> 2
    OR (SELECT count(*) FROM public.workspace_members m JOIN public.budget_workspaces w ON w.id=m.workspace_id
      JOIN public.families f ON f.id=w.legacy_family_id WHERE f.name=ANY(v_names)
      AND m.user_id=w.owner_id AND m.status='active' AND m.role='family_head') <> 2
    OR (SELECT count(*) FROM public.payment_records r JOIN public.payment_items p ON p.id=r.payment_item_id
      JOIN public.families f ON f.id=r.family_id WHERE f.name=ANY(v_names) AND r.workspace_id=p.workspace_id
      AND r.owner_id=f.owner_id AND r.recorded_by=f.owner_id AND r.amount=1 AND r.currency='USD') <> 2 THEN
    RAISE EXCEPTION 'FAMILY_FIXTURE_FINAL_SCOPE_CHECK_FAILED';
  END IF;
  INSERT INTO mushavo_s322_receipt VALUES (2, true);
END $fixture$;
SELECT check_name, status, details FROM (
  SELECT 1 AS ordering, '01 Intended staging fixture target' AS check_name, 'INFO' AS status,
    jsonb_build_object('stage_step','3.2.2','intended_staging_reference','dczlddwbtgvfdujgcitb',
      'project_identity','Owner verifies Dashboard URL; SQL labels do not prove hosted identity') AS details
  UNION ALL
  SELECT 2, '02 Synthetic Family fixtures created', 'PASS',
    jsonb_build_object('families',created_families,'head_members',2,'household_workspaces',2,
      'inactive_USD_1_items',2,'paid_records',2,'synthetic_entitlement_days',7,'seats_per_family',4)
    FROM mushavo_s322_receipt
  UNION ALL
  SELECT 3, '03 Dispatch and existing-data boundaries', 'INFO',
    jsonb_build_object('staging_push_subscriptions_empty',dispatch_guard,'active_cron_jobs_absent',dispatch_guard,
      'selected_notification_trigger_inventory_reviewed',dispatch_guard,
      'frontend_edge_webhook_or_transitive_trigger_dispatch_independently_verified',false,
      'fixture_reminders_enabled',false,'fixture_conversions_enabled',false,
      'existing_personal_fixtures_targeted',false,'product_permissions_or_Auth_settings_changed',false)
    FROM mushavo_s322_receipt
  UNION ALL
  SELECT 4, '04 Family authorization acceptance pending', 'REVIEW',
    jsonb_build_object('fixture_creation_is_authorization_proof',false,'API_batch_required',true,
      'raw_ids_passwords_or_customer_rows_returned',false,'production_or_native_changes_requested',false)
) AS results ORDER BY ordering;
COMMIT;
