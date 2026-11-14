import { randomUUID } from 'node:crypto';
import { API_ORIGIN, need, tokenIdentity } from './staging-access.mjs';

const FIXTURE = 'audit-batch-x-receipt-d7be160c2026';
const WORKSPACE = 'dcf3d122-e99f-4fe5-bbd1-03c3547629df';
const CASES = ['X_EXPIRY_ACTIVE_BASELINE', 'X_EXPIRY_SAME_SESSION_DENIAL',
  'X_EXPIRY_OWNER_RENEWAL_GATE', 'X_EXPIRY_FIXTURE_ISOLATION'];
const RPCS = ['create_business_invitation', 'respond_business_invitation', 'business_has_permission',
  'effective_workspace_entitlement', 'business_billing_owner', 'business_billing_snapshot',
  'business_subscription_quote', 'save_business_supplier', 'app_session_status', 'admin_business_set_status',
  'admin_grant_manual_subscription', 'remove_business_member', 'cancel_business_invitation', 'admin_set_business_seats'];
const TABLES = ['budget_workspaces', 'workspace_subscriptions', 'workspace_members', 'workspace_invitations',
  'business_dimensions', 'business_bills', 'business_suppliers'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const one = data => Array.isArray(data) && data.length === 1 ? data[0] : data;

export function isBusinessExpiryPlan(plan) {
  return plan.scope === 'business-expiry-boundaries' && plan.project === 'dczlddwbtgvfdujgcitb'
    && plan.fixture_name === FIXTURE && plan.workspace_id === WORKSPACE
    && plan.expected_support_version === 10 && plan.expected_subscription_version === 8
    && plan.original_paid_through_at === '2026-11-08T00:00:00.000Z'
    && Number.isFinite(Date.parse(plan.expiry_at)) && plan.supported_restore === true
    && JSON.stringify(plan.case_ids) === JSON.stringify(CASES);
}

export async function checkBusinessExpiry({ actors, accounts, evidence }, key, agent, plan,
  { fetcher = fetch, now = Date.now, pause = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  need(isBusinessExpiryPlan(plan), 'REVIEWED_BUSINESS_EXPIRY_PLAN_REQUIRED');
  const owner = actors.USER_A, member = actors.USER_B, admin = actors.ADMIN;
  const selected = [owner, member, admin];
  need(Object.keys(actors).length === 3 && new Set(selected.map(actor => actor?.id)).size === 3
    && selected.every(actor => actor?.id && tokenIdentity(actor.token)?.userId === actor.id)
    && new Set(selected.map(actor => tokenIdentity(actor.token).sessionId)).size === 3,
  'THREE_DISTINCT_BOUND_EXPIRY_SESSIONS_REQUIRED');
  Object.assign(evidence, { checks: {}, exercise_requests: 0, email_requests: 0, provider_payment_requests: 0,
    Storage_requests: 0, supported_restore_required: true, fixture_suspended_verified: false, entitlement_restored_verified: false,
    temporary_member_removed: false, original_seats_restored: false,
    pricing_configuration_changed: false, operational_finance_writes_expected: 0 });
  const check = (name, passed) => { evidence.checks[name] = passed === true; need(passed === true, name + '_REQUIRED'); };
  const call = async (method, route, actor, body, cleanup = false) => {
    need(evidence.exercise_requests < (cleanup ? 82 : 58), 'EXPIRY_REQUEST_LIMIT_REQUIRED');
    const url = new URL(route, API_ORIGIN), parts = url.pathname.split('/');
    need(route.startsWith('/') && url.origin === API_ORIGIN && !url.hash
      && (method === 'POST' && parts.slice(0, 4).join('/') === '/rest/v1/rpc' && RPCS.includes(parts[4])
        || method === 'GET' && parts.slice(0, 3).join('/') === '/rest/v1' && TABLES.includes(parts[3])
          && url.searchParams.get('limit') === '3'), 'EXPIRY_ROUTE_REFUSED');
    evidence.exercise_requests++;
    const response = await fetcher(url, { method, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { apikey: key, Authorization: 'Bearer ' + actor.token, 'Content-Type': 'application/json',
        'User-Agent': agent }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    let data = null;
    try { data = await response.json(); } catch {}
    if (response.status >= 400) evidence.last_refusal = { status: response.status,
      ...(/^[A-Z][A-Z0-9_]{2,79}$/.test(data?.message || '') ? { application_code: data.message } : {}) };
    return { status: response.status, data };
  };
  const rpc = (name, actor, body = {}, cleanup = false) => call('POST', '/rest/v1/rpc/' + name, actor, body, cleanup);
  const get = (table, fields, filters, actor, cleanup = false) => call('GET',
    `/rest/v1/${table}?select=${fields}&${filters}&limit=3`, actor, undefined, cleanup);
  const scoped = 'workspace_id=eq.' + WORKSPACE;
  const rows = result => result.status === 200 && Array.isArray(result.data) && result.data.length < 3;
  const denied = (result, code) => result.status === 400 && result.data?.message === code;
  const fixture = async (cleanup = false) => {
    const result = await get('budget_workspaces', 'id,owner_id,name,status,business_support_version', 'id=eq.' + WORKSPACE, admin, cleanup);
    const row = one(result.data);
    need(result.status === 200 && row?.id === WORKSPACE && row.owner_id === owner.id && row.name === FIXTURE
      && ['active', 'suspended'].includes(row.status), 'EXACT_EXPIRY_FIXTURE_REQUIRED');
    return row;
  };
  const permission = actor => rpc('business_has_permission', actor, { p_workspace_id: WORKSPACE, p_permission_code: 'workspace.view' });
  const bills = actor => get('business_bills', 'id,status,amount,paid_amount', scoped, actor);
  const entitlement = actor => rpc('effective_workspace_entitlement', actor, { p_workspace_id: WORKSPACE });
  const billing = actor => rpc('business_billing_snapshot', actor, { p_workspace_id: WORKSPACE, p_offset: 0, p_limit: 1 });
  let fixtureBound = false, fixturePlanId, failure, cleanupFailure;
  try {
    const initial = await fixture();
    check('EXACT_SUSPENDED_SYNTHETIC_FIXTURE_BOUND', initial.status === 'suspended'
      && initial.business_support_version === plan.expected_support_version);
    const subResult = await get('workspace_subscriptions', 'plan_id,status,version,member_limit,paid_through_at', scoped, admin);
    const sub = one(subResult.data), expiry = Date.parse(plan.expiry_at);
    check('REVIEWED_RESTORE_DATE_CURRENT', new Date(now()).toISOString().slice(0, 10) === '2026-11-07');
    check('EXACT_SHORT_LIVED_TEST_ENTITLEMENT_BOUND', subResult.status === 200 && sub?.status === 'active'
      && sub.version === plan.expected_subscription_version && sub.member_limit === 2
      && Date.parse(sub.paid_through_at) === expiry && expiry - now() > 15000 && expiry - now() < 300000);
    fixtureBound = true; fixturePlanId = sub.plan_id;
    const resumed = await rpc('admin_business_set_status', admin, { p_workspace_id: WORKSPACE, p_status: 'active',
      p_expected_version: initial.business_support_version, p_confirmation_name: FIXTURE,
      p_reason: 'Bounded synthetic Business entitlement expiry acceptance', p_request_id: randomUUID() });
    const active = await fixture();
    check('SUPPORTED_ADMIN_RESUME_VERIFIED', resumed.status === 200 && UUID.test(resumed.data || '')
      && active.status === 'active' && active.business_support_version === plan.expected_support_version + 1);
    const members = await get('workspace_members', 'id,user_id,role,status', scoped + '&status=eq.active', owner);
    const invitations = await get('workspace_invitations', 'id', scoped + '&status=eq.pending', owner);
    check('EXACT_OWNER_ONLY_START_WITH_NO_PENDING_INVITATION', rows(members) && members.data.length === 1
      && members.data[0].user_id === owner.id && rows(invitations) && invitations.data.length === 0);
    const dimensions = await get('business_dimensions', 'id', scoped + '&name=eq.Synthetic%20audit%20team&status=eq.active', owner);
    const dimension = one(dimensions.data)?.id;
    check('RETAINED_SYNTHETIC_TEAM_BOUND', rows(dimensions) && dimensions.data.length === 1 && typeof dimension === 'string');
    const invite = await rpc('create_business_invitation', owner, { p_workspace_id: WORKSPACE,
      p_email: accounts.USER_B.email, p_role: 'finance_manager', p_scope_ids: [dimension] });
    check('EXACT_DATABASE_ONLY_MEMBER_INVITATION', invite.status === 200 && typeof invite.data?.invitation_id === 'string'
      && invite.data.invitee_user_id === member.id);
    const accepted = await rpc('respond_business_invitation', member, { p_invitation_id: invite.data.invitation_id, p_accept: true });
    check('MEMBER_ACCEPTED_BEFORE_EXPIRY', accepted.status === 200 && accepted.data === WORKSPACE && now() < expiry);
    for (const [slot, actor] of [['OWNER', owner], ['MEMBER', member]]) {
      const allowed = await permission(actor), visible = await bills(actor);
      check(slot + '_OPERATIONAL_ACCESS_BEFORE_EXPIRY', allowed.status === 200 && allowed.data === true
        && rows(visible) && visible.data.length === 1 && visible.data[0].status === 'paid'
        && visible.data[0].amount === 1 && visible.data[0].paid_amount === 1);
    }
    const initialBilling = await billing(owner);
    check('EXISTING_UNCONFIGURED_PRICING_BOUND', initialBilling.status === 200
      && initialBilling.data?.settings?.pilot_enabled === false && initialBilling.data.settings.monthly_base === null);
    evidence.active_baseline_verified = true;
    evidence.expiry_at = new Date(expiry).toISOString();
    // The same tokens are held in memory across real wall-clock expiry. No refresh, relogin or settings change occurs.
    while (now() <= expiry + 1500) await pause(Math.min(1000, expiry + 1501 - now()));
    check('REAL_ENTITLEMENT_TIME_BOUNDARY_ELAPSED', now() > expiry);
    const expiredFixture = await fixture();
    check('WORKSPACE_STILL_ACTIVE_AT_ENTITLEMENT_EXPIRY', expiredFixture.status === 'active'
      && expiredFixture.business_support_version === plan.expected_support_version + 1);
    for (const [slot, actor] of [['OWNER', owner], ['MEMBER', member]]) {
      const claims = JSON.parse(Buffer.from(actor.token.split('.')[1], 'base64url').toString('utf8'));
      const session = await rpc('app_session_status', actor);
      check(slot + '_SAME_UNEXPIRED_ORDINARY_SESSION_REMAINS_VALID', claims.exp * 1000 > now()
        && session.status === 200 && session.data?.session_valid === true && session.data.admin_authorized === false);
      const effective = await entitlement(actor), result = one(effective.data);
      check(slot + '_EFFECTIVE_ENTITLEMENT_EXPIRED', effective.status === 200 && result?.workspace_id === WORKSPACE
        && result.effective_status === 'expired' && result.read_only === true);
      const allowed = await permission(actor), visible = await bills(actor);
      check(slot + '_OPERATIONAL_PERMISSION_REVOKED', allowed.status === 200 && allowed.data === false);
      check(slot + '_DIRECT_FINANCE_ROWS_HIDDEN', rows(visible) && visible.data.length === 0);
      const deniedWrite = await rpc('save_business_supplier', actor, { p_workspace_id: WORKSPACE, p_supplier_id: null,
        p_name: 'Synthetic expiry denial ' + randomUUID(), p_email: '', p_notes: 'Must be denied before insertion', p_expected_version: null });
      check(slot + '_OPERATIONAL_WRITE_DENIED', denied(deniedWrite, 'BUSINESS_BILL_ACCESS_REQUIRED'));
      const personal = await get('budget_workspaces', 'id,owner_id,workspace_type,status',
        `owner_id=eq.${actor.id}&workspace_type=eq.personal&status=eq.active`, actor);
      check(slot + '_PERSONAL_WORKSPACE_UNAFFECTED', rows(personal) && personal.data.length === 1
        && personal.data[0].owner_id === actor.id && personal.data[0].workspace_type === 'personal');
    }
    const ownerGate = await rpc('business_billing_owner', owner, { p_workspace_id: WORKSPACE });
    const memberGate = await rpc('business_billing_owner', member, { p_workspace_id: WORKSPACE });
    check('EXPIRED_RENEWAL_GATE_OWNER_ONLY', ownerGate.status === 200 && ownerGate.data === true
      && memberGate.status === 200 && memberGate.data === false);
    const ownerBilling = await billing(owner), memberBilling = await billing(member);
    check('OWNER_RETAINS_EXPIRED_BILLING_ACCESS', ownerBilling.status === 200
      && ownerBilling.data?.subscription?.workspace_id === WORKSPACE
      && Date.parse(ownerBilling.data.subscription.paid_through_at) === expiry && ownerBilling.data.suspended === false);
    check('MEMBER_BILLING_ACCESS_DENIED', denied(memberBilling, 'BUSINESS_BILLING_OWNER_REQUIRED'));
    const quoteBody = { p_workspace_id: WORKSPACE, p_kind: 'renewal', p_billing_period: 'monthly', p_quantity: 2 };
    const ownerQuote = await rpc('business_subscription_quote', owner, quoteBody);
    const memberQuote = await rpc('business_subscription_quote', member, quoteBody);
    check('OWNER_RENEWAL_REACHES_EXISTING_CONFIGURATION_GATE', denied(ownerQuote, 'BUSINESS_BILLING_NOT_CONFIGURED'));
    check('MEMBER_RENEWAL_DENIED_AT_OWNERSHIP_GATE', denied(memberQuote, 'BUSINESS_BILLING_OWNER_REQUIRED'));
    evidence.renewal_payment_acceptance = 'NOT_TESTED_EXISTING_PRICING_UNCONFIGURED';
  } catch (error) { failure = error; }
  finally {
    if (fixtureBound) {
      try {
        const current = await get('workspace_subscriptions', 'plan_id,status,version,member_limit,paid_through_at', scoped, admin, true);
        const sub = one(current.data);
        need(current.status === 200 && sub?.version === plan.expected_subscription_version
          && sub.member_limit === 2 && sub.plan_id === fixturePlanId, 'EXACT_EXPIRY_CLEANUP_SUBSCRIPTION_REQUIRED');
        evidence.entitlement_restore_attempted = true;
        // Restore through the supported Admin operation, then verify independently even if its response was lost.
        let grantError;
        try {
          const grant = await rpc('admin_grant_manual_subscription', admin, { p_owner_id: owner.id, p_workspace_id: WORKSPACE,
            p_plan_id: fixturePlanId, p_billing_period: 'monthly', p_starts_on: '2026-11-06', p_ends_on: '2026-11-08',
            p_reason: 'Temporary synthetic expiry cleanup term; exact original end restored independently', p_new_business_name: null }, true);
          need(grant.status === 200 && grant.data === WORKSPACE, 'EXPIRY_SUPPORTED_RESTORE_ACK_REQUIRED');
        } catch (error) { grantError = error; }
        const restored = await get('workspace_subscriptions', 'plan_id,status,version,member_limit,paid_through_at', scoped, admin, true);
        const restoredSub = one(restored.data);
        evidence.entitlement_restored_verified = restored.status === 200 && restoredSub?.status === 'active'
          && restoredSub.plan_id === fixturePlanId && restoredSub.version === plan.expected_subscription_version + 1
          && restoredSub.member_limit === 2 && Date.parse(restoredSub.paid_through_at) === Date.parse('2026-11-09T00:00:00Z');
        check('TEMPORARY_CLEANUP_ENTITLEMENT_GRANTED_BY_ADMIN_AND_READ_BACK', evidence.entitlement_restored_verified);
        evidence.restore_acknowledgement = grantError ? 'INDEPENDENT_READBACK_AFTER_LOST_RESPONSE' : 'ACK_AND_INDEPENDENT_READBACK';
        const invitations = await get('workspace_invitations', 'id,invitee_user_id', scoped + '&status=eq.pending', owner, true);
        need(rows(invitations) && invitations.data.every(row => row.invitee_user_id === member.id), 'EXACT_CLEANUP_INVITATIONS_REQUIRED');
        for (const invitation of invitations.data) {
          const cancelled = await rpc('cancel_business_invitation', owner, { p_invitation_id: invitation.id }, true);
          need(cancelled.status === 200 && cancelled.data === 'cancelled', 'EXPIRY_INVITATION_CLEANUP_ACK_REQUIRED');
        }
        const members = await get('workspace_members', 'id,user_id,role,status', scoped + '&status=eq.active', owner, true);
        need(rows(members) && members.data.every(row => [owner.id, member.id].includes(row.user_id)), 'EXACT_CLEANUP_MEMBERS_REQUIRED');
        for (const row of members.data.filter(row => row.user_id === member.id)) {
          const removed = await rpc('remove_business_member', owner, { p_workspace_id: WORKSPACE, p_member_id: row.id }, true);
          need(removed.status === 200 && removed.data === 'removed', 'EXPIRY_MEMBER_REMOVAL_ACK_REQUIRED');
        }
        const afterMembers = await get('workspace_members', 'user_id', scoped + '&status=eq.active', owner, true);
        const afterPending = await get('workspace_invitations', 'id', scoped + '&status=eq.pending', owner, true);
        evidence.temporary_member_removed = rows(afterMembers) && afterMembers.data.length === 1
          && afterMembers.data[0].user_id === owner.id && rows(afterPending) && afterPending.data.length === 0;
        check('TEMPORARY_MEMBER_AND_PENDING_INVITATIONS_CLEANED', evidence.temporary_member_removed);
        const seats = await rpc('admin_set_business_seats', admin, { p_workspace_id: WORKSPACE, p_total_seats: 1,
          p_expected_version: restoredSub.version, p_confirmation_name: FIXTURE, p_reason: 'Restore one-seat synthetic expiry fixture' }, true);
        const finalSub = one((await get('workspace_subscriptions', 'status,version,member_limit,paid_through_at', scoped, admin, true)).data);
        evidence.original_seats_restored = seats.status === 200 && seats.data === 1 && finalSub?.member_limit === 1
          && finalSub.version === plan.expected_subscription_version + 2
          && Date.parse(finalSub.paid_through_at) === Date.parse('2026-11-09T00:00:00Z');
        check('ORIGINAL_ONE_SEAT_RESTORED_TEMPORARY_TERM_BOUND', evidence.original_seats_restored);
        evidence.operator_final_term_restore_required = true;
        evidence.synthetic_restore_history = { manual_grants: 1, entitlement_history_rows: 1, owner_notifications: 1,
          actual_payment_records: 0, external_requests: 0 };
      } catch (error) { cleanupFailure = error; }
      try {
        const row = await fixture(true);
        if (row.status === 'active') {
          const isolated = await rpc('admin_business_set_status', admin, { p_workspace_id: WORKSPACE, p_status: 'suspended',
            p_expected_version: row.business_support_version, p_confirmation_name: FIXTURE,
            p_reason: 'Isolate completed synthetic Business entitlement expiry test', p_request_id: randomUUID() }, true);
          need(isolated.status === 200 && UUID.test(isolated.data || ''), 'EXPIRY_ISOLATION_ACK_REQUIRED');
        }
        evidence.fixture_suspended_verified = (await fixture(true)).status === 'suspended';
        check('EXACT_TEST_WORKSPACE_SUSPENDED_AFTER_EXERCISE', evidence.fixture_suspended_verified);
      } catch (error) { cleanupFailure ??= error; }
    }
  }
  if (cleanupFailure) throw cleanupFailure;
  if (failure) throw failure;
}
