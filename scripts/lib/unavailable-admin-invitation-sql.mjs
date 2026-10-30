const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function unavailableInvitationSQL({ actorId, adminId, invitationId }) {
  if (![actorId, adminId, invitationId].every(value => typeof value === 'string' && UUID.test(value))
      || new Set([actorId, adminId, invitationId]).size !== 3) throw Error('DISTINCT_UUID4_BINDINGS_REQUIRED');
  const marker = 'AU02.04 temporary fixture ' + invitationId;
  const prefix = `-- STAGING ONLY: dczlddwbtgvfdujgcitb. Generated for one temporary AU02.04 fixture.
-- No password, token, email dispatch, profile change, settings change or DDL.
BEGIN;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
SET LOCAL search_path = pg_catalog;
DO $fixture$
DECLARE
  v public.admin_user_invitations%rowtype;
  v_plan public.plans%rowtype;
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres'
     OR current_setting('session_replication_role') <> 'origin'
     OR coalesce(current_setting('role', true), 'none') NOT IN ('none', 'postgres')
  THEN RAISE EXCEPTION 'FIXTURE_PRIVILEGED_ORIGIN_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM mushavo_email_install.rollout_control
    WHERE singleton AND target_project = 'dczlddwbtgvfdujgcitb'
  ) THEN RAISE EXCEPTION 'FIXTURE_STAGING_REGISTRATION_REQUIRED'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE NOT t.tgisinternal AND t.tgenabled IN ('O', 'A')
      AND t.tgrelid IN ('public.admin_user_invitations'::regclass, 'public.admin_user_invitation_audit'::regclass)
      AND NOT (
        t.tgrelid = 'public.admin_user_invitations'::regclass
        AND (
          (t.tgname = 'admin_user_invitations_touch_updated_at'
           AND t.tgfoid = 'public.touch_admin_user_invitation_updated_at()'::regprocedure)
          OR (t.tgname = 'snapshot_admin_user_invitation_price_trigger'
              AND t.tgfoid = 'public.snapshot_admin_user_invitation_price()'::regprocedure)
        )
      )
  ) THEN RAISE EXCEPTION 'FIXTURE_UNREVIEWED_INVITATION_TRIGGER'; END IF;
`;
  const currentPolicy = `  IF NOT EXISTS (
    SELECT 1 FROM mushavo_email_install.rollout_control
    WHERE singleton AND target_project = 'dczlddwbtgvfdujgcitb' AND mode = 'ACTIVE'
      AND catalog_sha256 = mushavo_email_install.catalog_identity()
  ) OR to_regclass('mushavo_email_install.password_signin_policy') IS NULL
  THEN RAISE EXCEPTION 'FIXTURE_CURRENT_PASSWORD_POLICY_CATALOG_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u JOIN public.profiles p ON p.id = u.id
    WHERE u.id = '${actorId}'::uuid AND u.email_confirmed_at IS NOT NULL
      AND (u.banned_until IS NULL OR u.banned_until <= now())
      AND p.account_status = 'active' AND p.signup_source = 'self_signup'
      AND p.admin_invitation_id IS NULL
  ) OR EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = '${actorId}'::uuid)
     OR NOT EXISTS (
       SELECT 1 FROM public.budget_workspaces
       WHERE owner_id = '${actorId}'::uuid AND workspace_type = 'personal'
     )
  THEN RAISE EXCEPTION 'FIXTURE_EXISTING_ORDINARY_ACCOUNT_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.app_admins a JOIN public.profiles p ON p.id = a.user_id
    JOIN auth.users u ON u.id = a.user_id
    WHERE a.user_id = '${adminId}'::uuid AND a.role = 'super_admin'
      AND p.account_status = 'active' AND u.email_confirmed_at IS NOT NULL
      AND (u.banned_until IS NULL OR u.banned_until <= now())
  ) THEN RAISE EXCEPTION 'FIXTURE_ACTIVE_SUPER_ADMIN_REQUIRED'; END IF;
`;
  const lockFixture = `  SELECT * INTO v FROM public.admin_user_invitations
  WHERE id = '${invitationId}'::uuid FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'FIXTURE_ROW_REQUIRED'; END IF;
`;
  const identityGuard = `  IF v.auth_user_id IS DISTINCT FROM '${actorId}'::uuid
     OR v.invited_by IS DISTINCT FROM '${adminId}'::uuid
     OR v.full_name IS DISTINCT FROM '${marker}'
     OR v.workspace_name IS DISTINCT FROM '${marker}'
     OR v.plan_code IS DISTINCT FROM 'free' OR v.workspace_type IS DISTINCT FROM 'personal'
     OR v.payment_received IS DISTINCT FROM false
     OR v.provisioned_workspace_id IS NOT NULL OR v.completed_at IS NOT NULL
     OR v.status NOT IN ('sent', 'expired', 'cancelled')
     OR EXISTS (SELECT 1 FROM public.profiles WHERE admin_invitation_id = v.id)
  THEN RAISE EXCEPTION 'FIXTURE_IDENTITY_OR_UNPROVISIONED_STATE_REQUIRED'; END IF;
`;
  const audit = (action, reason) => `  INSERT INTO public.admin_user_invitation_audit (invitation_id, actor_id, action, safe_details)
  VALUES ('${invitationId}'::uuid, '${adminId}'::uuid, '${action}',
    jsonb_build_object('fixture', 'AU02.04', 'run_id', '${invitationId}', 'reason', '${reason}'));
`;
  const ending = result => `END;
$fixture$;
SELECT jsonb_build_object('progress_display', 'Stage 3/10 | FR.2/8 | Batch W/Z',
  'result', '${result}', 'email_requests', 0, 'settings_or_profile_writes', 0,
  'hosted_denial_acceptance', false) AS safe_result;
COMMIT;
`;
  const expired = prefix + currentPolicy + `  PERFORM pg_advisory_xact_lock(hashtextextended('${invitationId}', 0));
  IF EXISTS (
    SELECT 1 FROM public.admin_user_invitations i JOIN auth.users u ON u.id = '${actorId}'::uuid
    WHERE i.auth_user_id = u.id OR lower(i.email) = lower(u.email) OR i.id = '${invitationId}'::uuid
  ) THEN RAISE EXCEPTION 'FIXTURE_REQUIRES_NO_EXISTING_RECIPIENT_INVITATION'; END IF;
  IF (SELECT count(*) FROM public.plans WHERE code = 'free' AND workspace_type = 'personal' AND is_active) <> 1
  THEN RAISE EXCEPTION 'FIXTURE_ONE_ACTIVE_FREE_PLAN_REQUIRED'; END IF;
  SELECT * INTO v_plan FROM public.plans WHERE code = 'free' AND workspace_type = 'personal' AND is_active;
  INSERT INTO public.admin_user_invitations (
    id, email, full_name, plan_id, plan_code, plan_name, workspace_type, workspace_name,
    billing_period, subscription_currency, enabled_currencies, default_currency,
    payment_received, status, auth_user_id, invited_by, sent_at, expires_at
  )
  SELECT '${invitationId}'::uuid, u.email, '${marker}', v_plan.id, 'free', v_plan.display_name,
    'personal', '${marker}', 'monthly', 'USD', ARRAY['USD']::text[], 'USD',
    false, 'sent', u.id, '${adminId}'::uuid, now() - interval '2 minutes', now() - interval '1 minute'
  FROM auth.users u WHERE u.id = '${actorId}'::uuid;
  SELECT * INTO v FROM public.admin_user_invitations WHERE id = '${invitationId}'::uuid;
  IF v.quoted_total_amount IS DISTINCT FROM 0::numeric
  THEN RAISE EXCEPTION 'FIXTURE_ZERO_PRICE_FREE_PLAN_REQUIRED'; END IF;
` + audit('created', 'expired_fixture') + ending('EXPIRED_FIXTURE_READY');
  const cancelled = prefix + currentPolicy + lockFixture + identityGuard + `  IF v.status <> 'sent' OR v.expires_at IS NULL OR v.expires_at > now()
  THEN RAISE EXCEPTION 'FIXTURE_EXPIRED_PREVIOUS_STEP_REQUIRED'; END IF;
  UPDATE public.admin_user_invitations SET status = 'cancelled', cancelled_at = now(),
    expires_at = now() + interval '1 day' WHERE id = v.id;
` + audit('cancelled', 'cancelled_fixture') + ending('CANCELLED_FIXTURE_READY');
  const replaced = prefix + currentPolicy + lockFixture + identityGuard + `  IF v.status <> 'cancelled' OR v.expires_at IS NULL OR v.expires_at <= now()
     OR NOT EXISTS (
       SELECT 1 FROM public.admin_user_invitation_audit
       WHERE invitation_id = v.id AND action = 'cancelled'
         AND safe_details ->> 'fixture' = 'AU02.04'
         AND safe_details ->> 'run_id' = '${invitationId}'
         AND safe_details ->> 'reason' = 'cancelled_fixture'
     ) OR EXISTS (
       SELECT 1 FROM public.admin_user_invitation_audit
       WHERE invitation_id = v.id AND safe_details ->> 'reason' = 'replaced'
     )
  THEN RAISE EXCEPTION 'FIXTURE_CANCELLED_PREVIOUS_STEP_REQUIRED'; END IF;
` + audit('cancelled', 'replaced') + ending('REPLACED_STATE_FIXTURE_READY');
  const cleanup = prefix + `  PERFORM pg_advisory_xact_lock(hashtextextended('${invitationId}', 0));
  SELECT * INTO v FROM public.admin_user_invitations
  WHERE id = '${invitationId}'::uuid FOR UPDATE;
  IF v.id IS NOT NULL THEN
` + identityGuard + `    IF EXISTS (
      SELECT 1 FROM public.admin_user_invitation_audit
      WHERE invitation_id = v.id AND (
        actor_id IS DISTINCT FROM '${adminId}'::uuid
        OR action NOT IN ('created', 'cancelled')
        OR safe_details ->> 'fixture' IS DISTINCT FROM 'AU02.04'
        OR safe_details ->> 'run_id' IS DISTINCT FROM '${invitationId}'
      )
    ) THEN RAISE EXCEPTION 'FIXTURE_UNEXPECTED_AUDIT_REVIEW_REQUIRED'; END IF;
    DELETE FROM public.admin_user_invitations WHERE id = v.id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_user_invitation_audit WHERE invitation_id = '${invitationId}'::uuid)
  THEN RAISE EXCEPTION 'FIXTURE_AUDIT_CLEANUP_REQUIRED'; END IF;
` + ending('TEMPORARY_INVITATION_FIXTURE_ABSENT');
  return { expired, cancelled, replaced, cleanup };
}
