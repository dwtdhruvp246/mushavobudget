import assert from 'node:assert/strict';
import test from 'node:test';
import { checkBusinessTeam, isBusinessTeamPlan } from '../scripts/ci/staging-business-team.mjs';
import { checkStagingAccess, privateAccounts } from '../scripts/ci/staging-access.mjs';

const id = digit => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
const workspace = 'dcf3d122-e99f-4fe5-bbd1-03c3547629df';
const actor = digit => ({ id: id(digit), token: 'test.' + Buffer.from(JSON.stringify({ sub: id(digit),
  session_id: id(digit), exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.test' });
const actors = { USER_A: actor('1'), USER_B: actor('2'), USER_C: actor('3'), ADMIN: actor('4') };
const accounts = Object.fromEntries(Object.entries(actors).map(([slot], i) => [slot,
  { email: `controlled${i}@example.test`, password: `PRIVATE_PASSWORD_${i}` }]));
const plan = { scope: 'business-team-boundaries', project: 'dczlddwbtgvfdujgcitb', fixture_name: 'audit-batch-x-receipt-d7be160c2026',
  workspace_id: workspace, expected_support_version: 14, expected_subscription_version: 13,
  original_paid_through_at: '2026-11-08T00:00:00.000Z',
  case_ids: ['X_THREE_ORDINARY_TEAM_ACTORS', 'X_MANAGER_OWNER_AND_ESCALATION_DENIALS',
    'X_MANAGER_REMOVES_ANOTHER_MEMBER', 'X_REMOVED_MEMBER_SAME_SESSION', 'X_TEAM_FIXTURE_CLEANUP'] };

function backend({ wrongDenial = false, lostInvitation = false, lostSeatResponse = false, failedCleanup = false } = {}) {
  const state = { status: 'suspended', support: 14, seats: 1, subVersion: 13, managerRole: 'finance_manager',
    managerActive: false, memberExists: true, memberActive: false, managerDenied: false, memberOverride: false,
    managerScopes: [], memberScopes: [], pending: [], calls: [] };
  const ownerRow = () => ({ id: id('a'), user_id: actors.USER_A.id, role: 'business_owner', status: 'active' });
  const managerRow = () => ({ id: id('b'), user_id: actors.USER_B.id, role: state.managerRole, status: state.managerActive ? 'active' : 'inactive' });
  const memberRow = () => ({ id: id('c'), user_id: actors.USER_C.id, role: 'staff', status: state.memberActive ? 'active' : 'inactive' });
  const fetcher = async (url, options) => {
    const parsed = new URL(url), name = parsed.pathname.split('/').at(-1);
    assert.equal(parsed.origin, 'https://dczlddwbtgvfdujgcitb.supabase.co');
    assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error');
    const caller = Object.values(actors).find(value => options.headers.Authorization === 'Bearer ' + value.token);
    assert.ok(caller); const body = options.body ? JSON.parse(options.body) : {};
    state.calls.push({ name, method: options.method, caller, body });
    const ok = value => Response.json(value), no = message => Response.json({ message }, { status: 400 });
    if (options.method === 'GET') {
      assert.equal(parsed.searchParams.get('limit'), '4');
      if (name === 'budget_workspaces') return ok(parsed.searchParams.has('workspace_type')
        ? [{ id: id('9'), owner_id: caller.id, workspace_type: 'personal', status: 'active' }]
        : [{ id: workspace, owner_id: actors.USER_A.id, name: plan.fixture_name, workspace_type: 'business', status: state.status, business_support_version: state.support }]);
      if (name === 'workspace_subscriptions') return ok([{ status: 'active', version: state.subVersion, member_limit: state.seats, paid_through_at: plan.original_paid_through_at }]);
      if (name === 'workspace_members') return ok([ownerRow(), managerRow(), ...(state.memberExists ? [memberRow()] : [])]);
      if (name === 'workspace_invitations') return ok(state.pending);
      if (name === 'business_dimensions') return ok([{ id: id('d') }]);
      if (name === 'business_categories') return ok(caller === actors.USER_C && !state.memberActive ? [] : [{ id: id('e') }]);
      const forManager = parsed.searchParams.get('member_id') === 'eq.' + id('b');
      if (name === 'business_member_scopes') return ok((forManager ? state.managerScopes : state.memberScopes)
        .map(dimension_id => ({ member_id: forManager ? id('b') : id('c'), dimension_id })));
      if (name === 'business_member_permissions') return ok(forManager
        ? state.managerDenied ? [{ member_id: id('b'), permission_code: 'team.manage', effect: 'deny' }] : []
        : state.memberOverride ? [{ member_id: id('c'), permission_code: 'team.view', effect: 'allow' }] : []);
    }
    if (name === 'app_session_status') return ok({ session_valid: true, admin_authorized: caller === actors.ADMIN });
    if (name === 'admin_business_set_status') {
      assert.equal(caller, actors.ADMIN); assert.equal(body.p_expected_version, state.support);
      state.status = body.p_status; state.support++; return ok(id('f'));
    }
    if (name === 'admin_set_business_seats') {
      assert.equal(caller, actors.ADMIN); assert.equal(body.p_expected_version, state.subVersion);
      state.seats = body.p_total_seats; state.subVersion++;
      if (lostSeatResponse && body.p_total_seats === 3) throw new Error('lost seat response');
      return ok(state.seats);
    }
    if (name === 'create_business_invitation') {
      assert.equal(caller, actors.USER_A);
      const isManager = body.p_email === accounts.USER_B.email;
      const invitation = { id: isManager ? id('5') : id('6'), invitee_user_id: isManager ? actors.USER_B.id : actors.USER_C.id };
      state.pending.push(invitation);
      if (lostInvitation && !isManager) throw new Error('lost third invitation response');
      return ok({ invitation_id: invitation.id, invitee_user_id: invitation.invitee_user_id });
    }
    if (name === 'respond_business_invitation') {
      if (caller === actors.USER_B) { state.managerActive = true; state.managerRole = 'team_manager'; state.managerScopes = [id('d')]; }
      else { state.memberExists = true; state.memberActive = true; state.memberScopes = [id('d')]; }
      state.pending = state.pending.filter(value => value.id !== body.p_invitation_id); return ok(workspace);
    }
    if (name === 'cancel_business_invitation') { state.pending = state.pending.filter(value => value.id !== body.p_invitation_id); return ok('cancelled'); }
    if (name === 'business_has_permission') return ok(caller === actors.USER_B
      ? state.managerActive && !state.managerDenied : caller === actors.USER_C ? state.memberActive : true);
    if (name === 'set_business_member_permission') {
      if (caller !== actors.USER_A) return no('BUSINESS_OWNER_REQUIRED');
      if (body.p_member_id === id('b')) state.managerDenied = body.p_effect === 'deny';
      else state.memberOverride = body.p_effect === 'allow';
      return new Response(null, { status: 204 });
    }
    if (name === 'update_business_member_access') {
      if (caller === actors.USER_B) return no('BUSINESS_PRIVILEGE_ESCALATION_BLOCKED');
      assert.equal(caller, actors.USER_A); assert.equal(body.p_member_id, id('b'));
      state.managerRole = body.p_role; state.managerScopes = body.p_scope_ids; return ok('updated');
    }
    if (name === 'remove_business_member') {
      if (caller === actors.USER_C || caller === actors.USER_B && state.managerDenied) return no('BUSINESS_TEAM_ACCESS_REQUIRED');
      if (body.p_member_id === id('a') || caller === actors.USER_B && body.p_member_id === id('b'))
        return wrongDenial ? ok('removed') : no('INVALID_BUSINESS_MEMBER');
      if (body.p_member_id === id('c')) {
        if (!state.memberActive) return no('INVALID_BUSINESS_MEMBER');
        state.memberActive = false; state.memberOverride = false; state.memberScopes = [];
      } else {
        if (failedCleanup) throw new Error('synthetic manager cleanup failure');
        assert.equal(caller, actors.USER_A); state.managerActive = false; state.managerDenied = false; state.managerScopes = [];
      }
      return ok('removed');
    }
    if (name === 'business_team_snapshot') return no('BUSINESS_MEMBERSHIP_REQUIRED');
    throw new Error('unplanned test route');
  };
  return { state, fetcher };
}

test('team scope binds one reviewed fixture, original term and exact versions', () => {
  assert.equal(isBusinessTeamPlan(plan), true);
  for (const change of [{ project: 'production' }, { workspace_id: id('7') }, { fixture_name: 'customer' },
    { expected_support_version: 15 }, { expected_subscription_version: 14 }, { case_ids: [] }])
    assert.equal(isBusinessTeamPlan({ ...plan, ...change }), false);
});
test('an unconfigured third credential is refused without weakening the standard three-account scope', () => {
  assert.throws(() => privateAccounts({}, { accountScope: 'businessTeam' }), /PRIVATE_CREDENTIALS_REQUIRED_USER_A/);
  assert.throws(() => privateAccounts({}, { accountScope: 'unexpected' }), /REVIEWED_ACCOUNT_SCOPE_REQUIRED/);
});
test('real-session team flow removes the target with the nonowner manager and restores all test access', async () => {
  const { state, fetcher } = backend(), evidence = {};
  await checkBusinessTeam({ actors, accounts, evidence }, 'public', 'test', plan, fetcher);
  assert.ok(Object.values(evidence.checks).every(Boolean));
  assert.equal(state.status, 'suspended'); assert.equal(state.seats, 1); assert.equal(state.subVersion, 15);
  assert.equal(state.managerActive, false); assert.equal(state.memberActive, false); assert.equal(state.managerRole, 'finance_manager');
  assert.equal(state.pending.length, 0); assert.equal(state.managerScopes.length + state.memberScopes.length, 0);
  assert.ok(state.calls.some(value => value.name === 'remove_business_member' && value.caller === actors.USER_B && value.body.p_member_id === id('c')));
  assert.deepEqual(evidence.permission_update_HTTP_statuses, { member_allow: 204, manager_deny: 204, manager_clear: 204 });
  assert.equal(state.calls.length, evidence.exercise_requests); assert.ok(state.calls.length < 100);
  const safe = JSON.stringify(evidence);
  for (const value of [...Object.values(actors).map(value => value.token), ...Object.values(accounts).flatMap(value => [value.email, value.password])])
    assert.equal(safe.includes(value), false);
});
test('a permissive response to Owner removal is a failure and still isolates the synthetic fixture', async () => {
  const { state, fetcher } = backend({ wrongDenial: true }), evidence = {};
  await assert.rejects(checkBusinessTeam({ actors, accounts, evidence }, 'public', 'test', plan, fetcher), /MANAGER_CANNOT_REMOVE_OWNER/);
  assert.equal(state.status, 'suspended'); assert.equal(state.managerActive, false); assert.equal(state.memberActive, false);
});
test('a lost third invitation response cancels its exact pending invitation and removes the manager', async () => {
  const { state, fetcher } = backend({ lostInvitation: true }), evidence = {};
  await assert.rejects(checkBusinessTeam({ actors, accounts, evidence }, 'public', 'test', plan, fetcher), /lost third invitation/);
  assert.equal(state.pending.length, 0); assert.equal(state.managerActive, false); assert.equal(state.status, 'suspended');
  assert.equal(state.seats, 1); assert.equal(state.calls.filter(value => value.name === 'create_business_invitation').length, 2);
});
test('a lost seat-change response is read during cleanup and original seats are restored without repeating expansion', async () => {
  const { state, fetcher } = backend({ lostSeatResponse: true }), evidence = {};
  await assert.rejects(checkBusinessTeam({ actors, accounts, evidence }, 'public', 'test', plan, fetcher), /lost seat response/);
  assert.equal(state.status, 'suspended'); assert.equal(state.seats, 1);
  assert.equal(state.calls.filter(value => value.name === 'admin_set_business_seats' && value.body.p_total_seats === 3).length, 1);
});
test('a member-cleanup failure cannot pass but workspace isolation is still attempted', async () => {
  const { state, fetcher } = backend({ failedCleanup: true }), evidence = {};
  await assert.rejects(checkBusinessTeam({ actors, accounts, evidence }, 'public', 'test', plan, fetcher), /manager cleanup failure/);
  assert.equal(state.status, 'suspended'); assert.equal(evidence.fixture_suspended_verified, true);
  assert.equal(evidence.temporary_members_removed, false);
});
test('a privileged actor substituted for an ordinary manager is refused before any request', async () => {
  let calls = 0;
  await assert.rejects(checkBusinessTeam({ actors: { ...actors, USER_B: actors.ADMIN }, accounts, evidence: {} },
    'public', 'test', plan, async () => { calls++; }), /DISTINCT_BOUND_TEAM_ACTORS/);
  assert.equal(calls, 0);
});
test('four-account prerequisite verification logs out all four sessions within the existing request bound', async () => {
  const calls = [];
  const transport = async request => {
    calls.push(request);
    const slot = request.token ? Object.keys(actors).find(key => actors[key].token === request.token)
      : Object.keys(accounts).find(key => accounts[key].email === request.body?.email);
    const actor = actors[slot];
    if (request.route.startsWith('/auth/v1/token')) return { status: 200, data: { access_token: actor.token } };
    if (request.route === '/auth/v1/user') return { status: 200, data: { id: actor.id, email: accounts[slot].email, email_confirmed_at: '2026-11-01' } };
    if (request.route.startsWith('/rest/v1/profiles')) return { status: 200, data: [{ id: actor.id, account_status: 'active' }] };
    if (request.route.startsWith('/rest/v1/app_admins')) return { status: 200, data: slot === 'ADMIN' ? [{ user_id: actor.id, role: 'super_admin' }] : [] };
    if (request.route.startsWith('/rest/v1/budget_workspaces')) return { status: 200, data: [{ id: id('9'), owner_id: actor.id, workspace_type: 'personal', status: 'active' }] };
    if (request.route.startsWith('/auth/v1/logout')) return { status: 204, data: null };
    throw new Error('unplanned prerequisite request');
  };
  const result = await checkStagingAccess(accounts, transport, async () => {}, { accountScope: 'businessTeam' });
  assert.equal(result.exit_code, 0); assert.equal(result.API_requests, 24);
  assert.equal(result.created_sessions, 4); assert.equal(result.cleanup_sessions, 4);
  assert.equal(result.checks.three_ordinary_credentials_and_separate_super_admin_verified, true);
});
