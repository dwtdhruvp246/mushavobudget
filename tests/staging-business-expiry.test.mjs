import assert from 'node:assert/strict';
import test from 'node:test';
import { checkBusinessExpiry, isBusinessExpiryPlan } from '../scripts/ci/staging-business-expiry.mjs';

const id = digit => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
const workspace = 'dcf3d122-e99f-4fe5-bbd1-03c3547629df';
const start = Date.parse('2026-11-07T18:00:00Z'), expiry = start + 60000;
const actor = digit => ({ id: id(digit), token: 'test.' + Buffer.from(JSON.stringify({ sub: id(digit),
  session_id: id(digit), exp: (start + 3600000) / 1000 })).toString('base64url') + '.test' });
const actors = { USER_A: actor('1'), USER_B: actor('2'), ADMIN: actor('3') };
const accounts = { USER_B: { email: 'controlled@example.test' } };
const plan = { scope: 'business-expiry-boundaries', project: 'dczlddwbtgvfdujgcitb',
  fixture_name: 'audit-batch-x-receipt-d7be160c2026', workspace_id: workspace,
  expected_support_version: 8, expected_subscription_version: 6, expiry_at: new Date(expiry).toISOString(),
  original_paid_through_at: '2026-11-08T00:00:00.000Z', supported_restore: true,
  case_ids: ['X_EXPIRY_ACTIVE_BASELINE', 'X_EXPIRY_SAME_SESSION_DENIAL', 'X_EXPIRY_OWNER_RENEWAL_GATE', 'X_EXPIRY_FIXTURE_ISOLATION'] };

function backend({ retainedAccess = false, exposedBilling = false, failInvite = false, lateStart = false, lostRestore = false } = {}) {
  const state = { time: lateStart ? expiry + 1000 : start, status: 'suspended', support: 8, member: false, subVersion: 6, seats: 2, restored: false, pending: false, calls: [] };
  const fetcher = async (url, options) => {
    const parsed = new URL(url), name = parsed.pathname.split('/').at(-1);
    assert.equal(parsed.origin, 'https://dczlddwbtgvfdujgcitb.supabase.co');
    assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error');
    const caller = Object.values(actors).find(value => options.headers.Authorization === 'Bearer ' + value.token);
    assert.ok(caller);
    const body = options.body ? JSON.parse(options.body) : {};
    state.calls.push({ name, method: options.method, caller, body });
    const expired = state.time > expiry;
    const ok = data => Response.json(data);
    const no = message => Response.json({ message }, { status: 400 });
    const sub = { workspace_id: workspace, plan_id: id('9'), status: 'active', member_limit: state.seats, version: state.subVersion, paid_through_at: state.restored ? plan.original_paid_through_at : new Date(expiry).toISOString() };
    if (options.method === 'GET') {
      assert.equal(parsed.searchParams.get('limit'), '3');
      if (name === 'budget_workspaces') return ok(parsed.searchParams.has('workspace_type')
        ? [{ id: id('8'), owner_id: caller.id, workspace_type: 'personal', status: 'active' }]
        : [{ id: workspace, owner_id: actors.USER_A.id, name: plan.fixture_name, status: state.status, business_support_version: state.support }]);
      if (name === 'workspace_subscriptions') return ok([sub]);
      if (name === 'workspace_members') return ok([{ id: id('a'), user_id: actors.USER_A.id, role: 'business_owner' }, ...(state.member ? [{ id: id('b'), user_id: actors.USER_B.id, role: 'finance_manager' }] : [])]);
      if (name === 'workspace_invitations') return ok(state.pending ? [{ id: id('7'), invitee_user_id: actors.USER_B.id }] : []);
      if (name === 'business_dimensions') return ok([{ id: id('5') }]);
      if (name === 'business_bills') return ok(!expired || retainedAccess ? [{ id: id('6'), status: 'paid', amount: 1, paid_amount: 1 }] : []);
    }
    if (name === 'create_business_invitation') {
      state.pending = true;
      if (failInvite) throw new Error('synthetic lost invitation response');
      return ok({ invitation_id: id('7'), invitee_user_id: actors.USER_B.id });
    }
    if (name === 'respond_business_invitation') { state.member = true; state.pending = false; return ok(workspace); }
    if (name === 'admin_grant_manual_subscription') {
      assert.equal(caller, actors.ADMIN); assert.equal(body.p_plan_id, id('9'));
      state.restored = true; state.subVersion++;
      if (lostRestore) throw new Error('lost restore response');
      return ok(workspace);
    }
    if (name === 'remove_business_member') { state.member = false; return ok('removed'); }
    if (name === 'cancel_business_invitation') { state.pending = false; return ok('cancelled'); }
    if (name === 'admin_set_business_seats') { assert.equal(body.p_expected_version, state.subVersion); state.seats = 1; state.subVersion++; return ok(1); }
    if (name === 'business_has_permission') return ok(!expired || retainedAccess);
    if (name === 'business_billing_snapshot') return caller === actors.USER_A || exposedBilling
      ? ok({ subscription: sub, settings: { pilot_enabled: false, monthly_base: null }, suspended: false })
      : no('BUSINESS_BILLING_OWNER_REQUIRED');
    if (name === 'business_billing_owner') return ok(caller === actors.USER_A);
    if (name === 'app_session_status') return ok({ session_valid: true, admin_authorized: false });
    if (name === 'effective_workspace_entitlement') return ok([{ workspace_id: workspace, effective_status: 'expired', read_only: true }]);
    if (name === 'save_business_supplier') return no('BUSINESS_BILL_ACCESS_REQUIRED');
    if (name === 'business_subscription_quote') return no(caller === actors.USER_A ? 'BUSINESS_BILLING_NOT_CONFIGURED' : 'BUSINESS_BILLING_OWNER_REQUIRED');
    if (name === 'admin_business_set_status') {
      assert.equal(caller, actors.ADMIN); assert.equal(body.p_workspace_id, workspace);
      assert.equal(body.p_expected_version, state.support); assert.ok(['active', 'suspended'].includes(body.p_status));
      state.status = body.p_status; state.support++; return ok(workspace);
    }
    throw new Error('unplanned test route');
  };
  return { state, dependencies: { fetcher, now: () => state.time, pause: async ms => { assert.ok(ms > 0 && ms <= 1000); state.time += ms; } } };
}

test('expiry plan refuses another project, fixture, version, original term or automatic restore assumption', () => {
  assert.equal(isBusinessExpiryPlan(plan), true);
  for (const value of [{ project: 'production' }, { workspace_id: id('4') }, { fixture_name: 'customer business' },
    { expected_support_version: 9 }, { original_paid_through_at: '2026-12-08T00:00:00.000Z' },
    { supported_restore: false }, { expiry_at: 'invalid' }, { case_ids: [] }])
    assert.equal(isBusinessExpiryPlan({ ...plan, ...value }), false);
});
test('the same ordinary sessions cross expiry, lose operations and retain Owner-only renewal gating', async () => {
  const { state, dependencies } = backend(), evidence = {};
  await checkBusinessExpiry({ actors, accounts, evidence }, 'public', 'test', plan, dependencies);
  assert.ok(Object.values(evidence.checks).every(Boolean));
  assert.equal(state.status, 'suspended'); assert.equal(evidence.fixture_suspended_verified, true);
  assert.equal(evidence.supported_restore_required, true);
  assert.equal(evidence.renewal_payment_acceptance, 'NOT_TESTED_EXISTING_PRICING_UNCONFIGURED');
  assert.equal(state.calls.length, evidence.exercise_requests); assert.ok(state.calls.length < 82);
  assert.equal(state.calls.filter(value => value.name === 'admin_business_set_status').length, 2);
  assert.equal(state.calls.some(value => /token|logout|recover|signup/.test(value.name)), false);
  const safe = JSON.stringify(evidence);
  for (const value of [...Object.values(actors).map(value => value.token), accounts.USER_B.email]) assert.equal(safe.includes(value), false);
});
test('retained operational permission after expiry is a failure and still isolates the exact fixture', async () => {
  const { state, dependencies } = backend({ retainedAccess: true }), evidence = {};
  await assert.rejects(checkBusinessExpiry({ actors, accounts, evidence }, 'public', 'test', plan, dependencies), /OPERATIONAL_PERMISSION_REVOKED/);
  assert.equal(state.status, 'suspended'); assert.equal(evidence.fixture_suspended_verified, true);
});
test('nonowner billing exposure cannot pass and still isolates the fixture', async () => {
  const { state, dependencies } = backend({ exposedBilling: true }), evidence = {};
  await assert.rejects(checkBusinessExpiry({ actors, accounts, evidence }, 'public', 'test', plan, dependencies), /MEMBER_BILLING_ACCESS_DENIED/);
  assert.equal(state.status, 'suspended');
});
test('a lost invitation response still suspends the known fixture without repeating invitation creation', async () => {
  const { state, dependencies } = backend({ failInvite: true }), evidence = {};
  await assert.rejects(checkBusinessExpiry({ actors, accounts, evidence }, 'public', 'test', plan, dependencies), /lost invitation/);
  assert.equal(state.status, 'suspended');
  assert.equal(state.calls.filter(value => value.name === 'create_business_invitation').length, 1);
});
test('an already-expired start refuses behavioral acceptance before any fixture mutation', async () => {
  const { state, dependencies } = backend({ lateStart: true }), evidence = {};
  await assert.rejects(checkBusinessExpiry({ actors, accounts, evidence }, 'public', 'test', plan, dependencies), /SHORT_LIVED_TEST_ENTITLEMENT/);
  assert.equal(state.calls.some(value => value.method === 'POST'), false);
});
test('a substituted Admin actor is refused before network access', async () => {
  let calls = 0;
  await assert.rejects(checkBusinessExpiry({ actors: { ...actors, ADMIN: actors.USER_A }, accounts, evidence: {} },
    'public', 'test', plan, { fetcher: async () => { calls++; } }), /DISTINCT_BOUND_EXPIRY_SESSIONS/);
  assert.equal(calls, 0);
});

 test('lost restoration response is independently verified without a second grant', async () => {
  const { state, dependencies } = backend({ lostRestore: true }), evidence = {};
  await checkBusinessExpiry({ actors, accounts, evidence }, 'public', 'test', plan, dependencies);
  assert.equal(evidence.restore_acknowledgement, 'INDEPENDENT_READBACK_AFTER_LOST_RESPONSE');
  assert.equal(state.calls.filter(value => value.name === 'admin_grant_manual_subscription').length, 1);
  assert.equal(state.member, false); assert.equal(state.pending, false); assert.equal(state.seats, 1);
  assert.equal(state.status, 'suspended');
});
