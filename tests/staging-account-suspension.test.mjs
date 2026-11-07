import assert from 'node:assert/strict';
import test from 'node:test';
import { checkAccountSuspension, isAccountSuspensionPlan } from '../scripts/ci/staging-account-suspension.mjs';

const actor = (digit, role) => {
  const id = `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
  return { id, role, token: 'test.' + Buffer.from(JSON.stringify({ sub: id,
    session_id: `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-9${digit.repeat(3)}-${digit.repeat(12)}` })).toString('base64url') + '.test' };
};
const actors = { USER_A: actor('1'), USER_B: actor('2'), ADMIN: actor('3', 'super_admin') };
const plan = { scope: 'account-suspension-boundaries', project: 'dczlddwbtgvfdujgcitb', target_slot: 'USER_A',
  case_ids: ['X_ACCOUNT_NONADMIN_DENIAL', 'X_ACCOUNT_EXISTING_SESSION_SUSPENDED',
    'X_ACCOUNT_OTHER_ACTORS_UNAFFECTED', 'X_ACCOUNT_SUPPORTED_RESTORE'] };

function backend({ badHiddenRead = false, ambiguousSuspend = false, refuseRestore = false } = {}) {
  let suspended = false;
  const calls = [];
  const fetcher = async (url, options) => {
    const caller = Object.values(actors).find(actor => options.headers.Authorization === 'Bearer ' + actor.token);
    assert.ok(caller);
    assert.equal(new URL(url).origin, 'https://dczlddwbtgvfdujgcitb.supabase.co');
    const route = new URL(url).pathname;
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ caller, route, body });
    const result = (value, status = 200) => new Response(JSON.stringify(value), { status });
    if (route.endsWith('/app_session_status')) return result({ contract: 1, policy: 'PASSWORD_ONLY_ALL_USERS',
      session_valid: caller !== actors.USER_A || !suspended, admin_authorized: caller === actors.ADMIN,
      role: caller.role ?? null });
    if (route.endsWith('/profiles')) return result([{ id: actors.USER_A.id, account_status: suspended ? 'suspended' : 'active' }]);
    if (route.endsWith('/budget_workspaces')) return result(caller === actors.USER_A && suspended && !badHiddenRead ? []
      : [{ id: caller.id, owner_id: caller.id, workspace_type: 'personal', status: 'active' }]);
    if (route.endsWith('/set_user_account_status')) {
      assert.equal(body.p_user_id, actors.USER_A.id);
      if (caller !== actors.ADMIN) return result({ message: 'ADMIN_REQUIRED' }, 400);
      if (body.p_status === 'active' && refuseRestore) return result({ message: 'UNEXPECTED' }, 500);
      suspended = body.p_status === 'suspended';
      if (suspended && ambiguousSuspend) throw new Error('response lost after write');
      return result(null);
    }
    if (route.endsWith('/archive_business_document')) {
      assert.equal(body.p_workspace_id, '00000000-0000-4000-8000-000000000000');
      assert.equal(body.p_document_id, body.p_workspace_id);
      return result({ code: '42501', message: 'EMAIL_VERIFICATION_REQUIRED' }, 403);
    }
    if (route === '/auth/v1/user') return result({ id: actors.USER_A.id, email_confirmed_at: '2026-11-07' });
    throw new Error('unplanned route');
  };
  return { fetcher, calls, suspended: () => suspended };
}

test('the account plan binds the exact project, account, and cases', () => {
  assert.equal(isAccountSuspensionPlan(plan), true);
  for (const altered of [{ project: 'production' }, { target_slot: 'ADMIN' }, { case_ids: plan.case_ids.slice(1) }])
    assert.equal(isAccountSuspensionPlan({ ...plan, ...altered }), false);
});
test('the suspension check uses the same sessions and restores its exact account', async () => {
  const mock = backend(), evidence = {};
  await checkAccountSuspension({ actors, evidence }, 'public-test-key', 'test-agent', mock.fetcher);
  assert.ok(Object.values(evidence.checks).every(Boolean));
  assert.equal(evidence.restored_active_verified, true);
  assert.equal(mock.suspended(), false);
  assert.equal(evidence.exercise_requests, mock.calls.length);
  assert.ok(mock.calls.length <= 30);
  assert.deepEqual(mock.calls.filter(call => call.route.endsWith('/set_user_account_status'))
    .map(call => [call.caller === actors.ADMIN, call.body.p_status]), [[false, 'suspended'], [true, 'suspended'], [true, 'active']]);
});
test('an intermediate failed assertion still restores the suspended account', async () => {
  const mock = backend({ badHiddenRead: true }), evidence = {};
  await assert.rejects(checkAccountSuspension({ actors, evidence }, 'test', 'test', mock.fetcher),
    error => error.code === 'ACCOUNT_SUSPENSION_PROTECTED_WORKSPACES_HIDDEN_REQUIRED');
  assert.equal(mock.suspended(), false);
  assert.equal(evidence.restored_active_verified, true);
});
test('an ambiguous suspension response is read back and restored once', async () => {
  const mock = backend({ ambiguousSuspend: true }), evidence = {};
  await assert.rejects(checkAccountSuspension({ actors, evidence }, 'test', 'test', mock.fetcher), /response lost after write/);
  assert.equal(mock.suspended(), false);
  assert.equal(evidence.restored_active_verified, true);
  assert.equal(mock.calls.filter(call => call.body?.p_status === 'active').length, 1);
});
test('restoration failure is reported without a blind retry or false cleanup pass', async () => {
  const mock = backend({ refuseRestore: true }), evidence = {};
  await assert.rejects(checkAccountSuspension({ actors, evidence }, 'test', 'test', mock.fetcher));
  assert.equal(mock.suspended(), true);
  assert.equal(evidence.restored_active_verified, false);
  assert.equal(mock.calls.filter(call => call.body?.p_status === 'active').length, 1);
});
test('a substituted account is rejected before requests', async () => {
  let called = false;
  await assert.rejects(checkAccountSuspension({ actors: { ...actors, ADMIN: actors.USER_A }, evidence: {} }, 'test', 'test', async () => {
    called = true;
  }), error => error.code === 'THREE_DISTINCT_BOUND_SESSIONS_REQUIRED');
  assert.equal(called, false);
});
