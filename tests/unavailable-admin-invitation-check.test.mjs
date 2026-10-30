import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkUnavailableAdminInvitation } from '../scripts/lib/unavailable-admin-invitation-check.mjs';
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const actorId = id(1), adminId = id(2), invitationId = id(3), workspaceId = id(4);
const input = { actor: { email: 'test@example.test', password: 'PRIVATE_TEST_PASSWORD' },
  admin: { email: 'admin@example.test', password: 'PRIVATE_ADMIN_PASSWORD' }, invitationId };
function fixture(options = {}) {
  const requests = [], steps = []; let state = null, removed = false, prepared = false, elapsed = 0, version = 0;
  const sessionIds = { actor: id(10), admin: id(20) };
  const jwt = (slot, sessionId = sessionIds[slot], userId = slot === 'admin' ? adminId : actorId) =>
    'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub: userId, session_id: sessionId })).toString('base64url') + '.PRIVATE_' + slot + '_TOKEN_' + version;
  const tokens = { actor: jwt('actor'), admin: jwt('admin') };
  const refreshTokens = { actor: 'PRIVATE_ACTOR_REFRESH_0', admin: 'PRIVATE_ADMIN_REFRESH_0' };
  const issued = new Map();
  const authResult = slot => {
    issued.set(tokens[slot], { slot, expiresAt: elapsed + 3600000, refreshed: version > 0 });
    return { status: 200, data: { access_token: tokens[slot], refresh_token: refreshTokens[slot], expires_in: 3600 } };
  };
  const transport = async request => {
    requests.push(request);
    const { route, body, token } = request;
    if (route === '/auth/v1/token?grant_type=password') {
      if (options.badPassword) return { status: 400, data: { error_code: 'invalid_credentials', message: 'PRIVATE_RAW_AUTH_RESPONSE' } };
      return authResult(body.email === input.actor.email ? 'actor' : 'admin');
    }
    if (route === '/auth/v1/token?grant_type=refresh_token') {
      const slot = Object.keys(refreshTokens).find(name => refreshTokens[name] === body.refresh_token);
      assert.ok(slot, 'only the current in-memory refresh token may be used');
      if (options.refreshFailure) return { status: 400, data: { code: 'refresh_token_not_found', message: 'PRIVATE_REFRESH_FAILURE' } };
      version++;
      tokens[slot] = jwt(slot, options.changedRefreshSession ? id(99) : sessionIds[slot], options.changedRefreshUser ? id(98) : slot === 'admin' ? adminId : actorId);
      refreshTokens[slot] = 'PRIVATE_' + slot + '_REFRESH_' + version;
      return authResult(slot);
    }
    const owner = issued.get(token), isAdmin = owner?.slot === 'admin';
    if (!owner || owner.expiresAt <= elapsed) return { status: 401, data: { code: 'bad_jwt', message: 'PRIVATE_EXPIRED_RESPONSE' } };
    if (route === '/auth/v1/user') return { status: 200, data: { id: options.badRefreshGetUser && owner.refreshed ? id(98) : isAdmin ? adminId : actorId,
      email: isAdmin ? input.admin.email : input.actor.email, email_confirmed_at: '2026-10-30T00:00:00Z' } };
    if (route.startsWith('/rest/v1/profiles?')) return { status: 200, data: [{ id: actorId, signup_source: options.invitedProfile ? 'admin_invitation' : 'self_signup',
      admin_invitation_id: options.invitedProfile ? id(9) : null, account_status: options.changedProfile && state === 'replaced' ? 'suspended' : 'active' }] };
    if (route.startsWith('/rest/v1/budget_workspaces?')) {
      const rows = [{ id: workspaceId, owner_id: actorId, workspace_type: 'personal' }];
      if (options.additionalWorkspace && state === 'replaced') rows.push({ id: id(8), owner_id: actorId, workspace_type: 'personal' });
      return { status: 200, data: rows };
    }
    if (route.startsWith('/rest/v1/app_admins?')) return { status: 200, data: [{ user_id: adminId, role: options.notAdmin ? 'finance_staff' : 'super_admin' }] };
    if (route.startsWith('/rest/v1/admin_user_invitations?')) {
      if (options.deniedStaffRead) return { status: 403, data: { code: '42501' } };
      if (!state || removed || options.missingFixture) return { status: 200, data: [] };
      const marker = 'AU02.04 temporary fixture ' + invitationId;
      return { status: 200, serverDate: 'Fri, 30 Oct 2026 12:00:00 GMT', data: [{ id: invitationId,
        email: input.actor.email, auth_user_id: options.wrongBinding ? id(7) : actorId, invited_by: adminId,
        full_name: marker, workspace_name: marker, plan_code: 'free', workspace_type: 'personal',
        payment_received: !!options.payment, provisioned_workspace_id: options.provisioned ? id(8) : null, completed_at: null,
        status: state === 'expired' ? 'sent' : 'cancelled', expires_at: state === 'expired' ? '2026-10-30T11:59:00Z' : '2026-10-31T12:00:00Z' }] };
    }
    if (route.startsWith('/rest/v1/admin_user_invitation_audit?')) {
      return { status: 200, data: state === 'replaced' && !removed && !options.missingReplacedAudit ? [{ actor_id: adminId,
        action: 'cancelled', safe_details: { fixture: 'AU02.04', run_id: invitationId, reason: 'replaced' } }] : [] };
    }
    if (route === '/rest/v1/rpc/get_my_admin_user_invitation') {
      assert.equal(owner.slot, 'actor'); assert.equal(body.p_invitation_id, invitationId);
      if (options.networkFailure) throw Error('PRIVATE_NETWORK_RESPONSE');
      return options.readAllowed ? { status: 200, data: [{ invitation_id: invitationId }] }
        : { status: 400, data: { message: options.sessionFailure ? 'application_session_required' : 'ADMIN_INVITATION_NOT_AVAILABLE' } };
    }
    if (route === '/rest/v1/rpc/complete_admin_user_invitation') {
      assert.equal(owner.slot, 'actor'); assert.deepEqual(body, { p_invitation_id: invitationId, p_enabled_currencies: ['USD'], p_default_currency: 'USD' });
      return options.completionAllowed ? { status: 200, data: workspaceId }
        : { status: 400, data: { message: options.identityFailure ? 'ADMIN_INVITATION_IDENTITY_MISMATCH'
          : state === 'expired' ? 'ADMIN_INVITATION_EXPIRED' : 'ADMIN_INVITATION_NOT_AVAILABLE' } };
    }
    if (route === '/auth/v1/logout?scope=local') {
      if (isAdmin && options.advanceAfterAdminLogout) elapsed += 2 * 60 * 60 * 1000;
      return { status: options.logoutFailure ? 401 : 204, data: null };
    }
    throw Error('Unexpected route ' + route);
  };
  const interact = {
    prepare: async pack => {
      assert.deepEqual(Object.keys(pack), ['expired', 'cancelled', 'replaced', 'cleanup']);
      assert.ok(pack.cleanup.includes('DELETE FROM public.admin_user_invitations WHERE id = v.id'));
      prepared = true;
    },
    sqlStep: async phase => {
      assert.equal(prepared, true); steps.push(phase);
      if (options.cancelBeforeSQL && phase === 'expired') throw Error('OWNER_CANCELLED');
      if (phase === 'cleanup') { if (options.cleanupFailure) throw Error('PRIVATE_CLEANUP_FAILURE'); removed = true; }
      else state = phase;
      if (options.advanceEachSQL || options.advanceFirstSQL && phase === 'expired' || options.advanceCleanup && phase === 'cleanup') elapsed += 2 * 60 * 60 * 1000;
    }
  };
  return { transport, interact, requests, steps, now: () => elapsed };
}
test('three real-identity denial states require all fixture checks and cleanup in 25 bounded HTTP calls', async () => {
  const f = fixture(), report = await checkUnavailableAdminInvitation(input, f.transport, f.interact);
  assert.equal(report.exit_code, 0); assert.equal(report.actual_hosted_requests, 25);
  assert.equal(report.completion_RPC_calls, 3); assert.equal(report.created_sessions, 2); assert.equal(report.cleanup_sessions, 2);
  assert.equal(report.fixture_SQL_steps_acknowledged, 4); assert.equal(report.fixture_cleanup_required, false);
  assert.deepEqual(f.steps, ['expired', 'cancelled', 'replaced', 'cleanup']);
  for (const variant of Object.values(report.variants)) assert.deepEqual(variant, { exact_recipient_bound_fixture_verified: true, invitation_read_denied: true, completion_denied: true });
  const safe = JSON.stringify(report);
  for (const privateValue of [actorId, adminId, invitationId, workspaceId, input.actor.email, input.admin.email,
    input.actor.password, input.admin.password, 'PRIVATE_TEST_TOKEN', 'PRIVATE_ADMIN_TOKEN']) assert.ok(!safe.includes(privateValue));
  assert.ok(f.requests.every(r => !/otp|recover|inviteUser|mfa|token\?grant_type=refresh/.test(r.route)));
});
test('profile and staff readiness failures occur before any fixture request and clean created sessions', async () => {
  for (const options of [{ invitedProfile: true }, { notAdmin: true }, { deniedStaffRead: true }]) {
    const f = fixture(options), report = await checkUnavailableAdminInvitation(input, f.transport, f.interact);
    assert.equal(report.exit_code, 1); assert.equal(report.completion_RPC_calls, 0); assert.equal(f.steps.length, 0);
    assert.equal(report.created_sessions, report.cleanup_sessions);
  }
});
test('incorrect fixture binding, payment or prior provisioning cannot reach completion', async () => {
  for (const options of [{ wrongBinding: true }, { payment: true }, { provisioned: true }]) {
    const f = fixture(options), report = await checkUnavailableAdminInvitation(input, f.transport, f.interact);
    assert.equal(report.problem_code, 'EXACT_UNPROVISIONED_FIXTURE_NOT_VERIFIED'); assert.equal(report.completion_RPC_calls, 0);
    assert.deepEqual(f.steps, ['expired', 'cleanup']); assert.equal(report.cleanup_sessions, 2);
  }
});
test('generic session failure or an available read cannot count as state denial', async () => {
  for (const options of [{ sessionFailure: true }, { readAllowed: true }]) {
    const f = fixture(options), report = await checkUnavailableAdminInvitation(input, f.transport, f.interact);
    assert.equal(report.problem_code, 'UNAVAILABLE_READ_DENIAL_NOT_ESTABLISHED'); assert.equal(report.completion_RPC_calls, 0);
    assert.equal(report.checks.temporary_invitation_and_audit_absent, true);
  }
});
test('wrong identity or successful completion cannot be credited as unavailable completion', async () => {
  for (const options of [{ identityFailure: true }, { completionAllowed: true }]) {
    const f = fixture(options), report = await checkUnavailableAdminInvitation(input, f.transport, f.interact);
    assert.equal(report.problem_code, 'UNAVAILABLE_COMPLETION_DENIAL_NOT_ESTABLISHED'); assert.equal(report.completion_RPC_calls, 1);
    assert.equal(report.exit_code, 1); assert.equal(report.cleanup_sessions, 2);
  }
});
test('replacement requires its actual fixture audit marker before RPC denial calls', async () => {
  const f = fixture({ missingReplacedAudit: true }), report = await checkUnavailableAdminInvitation(input, f.transport, f.interact);
  assert.equal(report.problem_code, 'REPLACED_STATE_AUDIT_NOT_VERIFIED'); assert.equal(report.completion_RPC_calls, 2); assert.equal(report.exit_code, 1);
});
test('network failure and owner cancellation still attempt the already-prepared cleanup', async () => {
  for (const options of [{ networkFailure: true }, { cancelBeforeSQL: true }]) {
    const f = fixture(options), report = await checkUnavailableAdminInvitation(input, f.transport, f.interact);
    assert.equal(f.steps.at(-1), 'cleanup'); assert.equal(report.checks.temporary_invitation_and_audit_absent, true);
    assert.equal(report.cleanup_sessions, 2); assert.equal(report.exit_code, 1); assert.ok(!JSON.stringify(report).includes('PRIVATE_NETWORK'));
  }
});
test('unverified fixture or session cleanup blocks COMPLETE and retains a specific recovery flag', async () => {
  for (const options of [{ cleanupFailure: true }, { logoutFailure: true }]) {
    const f = fixture(options), report = await checkUnavailableAdminInvitation(input, f.transport, f.interact);
    assert.equal(report.exit_code, 1);
    if (options.cleanupFailure) { assert.equal(report.fixture_cleanup_required, true); assert.equal(report.cleanup_problem_code, 'FIXTURE_CLEANUP_NOT_VERIFIED'); }
    else assert.equal(report.session_cleanup_problem_code, 'SCOPED_SESSION_CLEANUP_NOT_VERIFIED');
  }
});
test('profile or owned-workspace mutation prevents success', async () => {
  for (const options of [{ changedProfile: true }, { additionalWorkspace: true }]) {
    const f = fixture(options), report = await checkUnavailableAdminInvitation(input, f.transport, f.interact);
    assert.equal(report.exit_code, 1); assert.equal(report.checks.temporary_invitation_and_audit_absent, true);
  }
});
test('bad password has a safe classification and no fixture handoff', async () => {
  const f = fixture({ badPassword: true }), report = await checkUnavailableAdminInvitation(input, f.transport, f.interact);
  assert.deepEqual(report.failed_auth, { account_slot: 'ordinary_test_user', HTTP_status: 400, code: 'invalid_credentials' });
  assert.equal(f.steps.length, 0); assert.equal(report.created_sessions, 0); assert.ok(!JSON.stringify(report).includes('PRIVATE_RAW'));
});
test('SQL UUID bindings reject code, repeated identifiers and missing fields without a request', async () => {
  for (const bad of [{ ...input, invitationId: "';DELETE" }, { ...input, invitationId: null }]) {
    const f = fixture(), report = await checkUnavailableAdminInvitation(bad, f.transport, f.interact);
    assert.equal(report.problem_code, 'FIXTURE_RUN_BINDING_REQUIRED'); assert.equal(f.requests.length, 0);
  }
});
test('two-hour manual pauses refresh the same two sessions, rotate private refresh tokens and still clean up', async () => {
  const f = fixture({ advanceEachSQL: true }), report = await checkUnavailableAdminInvitation(input, f.transport, f.interact, { now: f.now });
  assert.equal(report.exit_code, 0); assert.equal(report.refresh_grants, 8); assert.equal(report.actual_hosted_requests, 41);
  assert.equal(report.created_sessions, 2); assert.equal(report.cleanup_sessions, 2); assert.equal(report.completion_RPC_calls, 3);
  assert.ok(report.refresh_checks.every(item => item.same_user_and_session_verified));
  assert.ok(f.requests.filter(r => r.route.includes('/logout')).every(r => r.route === '/auth/v1/logout?scope=local'));
  const safe = JSON.stringify(report);
  for (const value of ['PRIVATE_', actorId, adminId, id(10), id(20), input.actor.email, input.admin.email]) assert.ok(!safe.includes(value));
});
test('a long cleanup pause renews both owned sessions before their local logouts', async () => {
  const f = fixture({ advanceCleanup: true }), report = await checkUnavailableAdminInvitation(input, f.transport, f.interact, { now: f.now });
  assert.equal(report.exit_code, 0); assert.equal(report.refresh_grants, 2); assert.equal(report.cleanup_sessions, 2);
  assert.equal(report.actual_hosted_requests, 29); assert.ok(report.session_cleanup_responses.every(item => item.HTTP_status === 204));
});
test('a refresh response with another user or session stops before denial RPCs and never adopts that token', async () => {
  for (const options of [{ advanceFirstSQL: true, changedRefreshSession: true }, { advanceFirstSQL: true, changedRefreshUser: true }]) {
    const f = fixture(options), report = await checkUnavailableAdminInvitation(input, f.transport, f.interact, { now: f.now });
    assert.equal(report.problem_code, 'REFRESH_SESSION_IDENTITY_CHANGED'); assert.equal(report.completion_RPC_calls, 0); assert.equal(report.exit_code, 1);
    for (const request of f.requests.filter(r => r.route.includes('/logout'))) {
      const claims = JSON.parse(Buffer.from(request.token.split('.')[1], 'base64url').toString('utf8'));
      assert.ok([id(10), id(20)].includes(claims.session_id)); assert.ok([actorId, adminId].includes(claims.sub));
    }
  }
});
test('a failed refresh is classified without a retry and logout failures include safe HTTP status/code', async () => {
  const f = fixture({ advanceFirstSQL: true, refreshFailure: true }), report = await checkUnavailableAdminInvitation(input, f.transport, f.interact, { now: f.now });
  assert.equal(report.problem_code, 'SESSION_REFRESH_NOT_ESTABLISHED'); assert.equal(report.exit_code, 1);
  assert.equal(report.completion_RPC_calls, 0); assert.equal(report.cleanup_sessions, 0); assert.equal(report.refresh_grants, 2);
  assert.ok(report.session_cleanup_responses.every(item => item.HTTP_status === 401 && item.error_code === 'bad_jwt'));
  assert.ok(!JSON.stringify(report).includes('PRIVATE_REFRESH_FAILURE'));
});
test('refresh claims alone are insufficient when Auth getUser returns a different identity', async () => {
  const f = fixture({ advanceFirstSQL: true, badRefreshGetUser: true }), report = await checkUnavailableAdminInvitation(input, f.transport, f.interact, { now: f.now });
  assert.equal(report.problem_code, 'REFRESH_USER_IDENTITY_NOT_ESTABLISHED'); assert.equal(report.completion_RPC_calls, 0);
  assert.equal(report.exit_code, 1); assert.ok(report.refresh_checks.every(item => item.same_user_and_session_verified === false));
  assert.equal(report.cleanup_sessions, 2);
  for (const request of f.requests.filter(r => r.route.includes('/logout'))) {
    const claims = JSON.parse(Buffer.from(request.token.split('.')[1], 'base64url').toString('utf8'));
    assert.ok([id(10), id(20)].includes(claims.session_id));
  }
  assert.ok(!JSON.stringify(report).includes(id(98)));
});
test('a missing fixture reports HTTP200/zero rows and still verifies independent cleanup', async () => {
  const f = fixture({ missingFixture: true }), report = await checkUnavailableAdminInvitation(input, f.transport, f.interact);
  assert.equal(report.problem_code, 'EXACT_UNPROVISIONED_FIXTURE_NOT_VERIFIED');
  assert.equal(report.fixture_preflights.expired.HTTP_status, 200); assert.equal(report.fixture_preflights.expired.row_count, 0);
  assert.equal(report.fixture_cleanup_responses.invitation.row_count, 0);
  assert.equal(report.checks.temporary_invitation_and_audit_absent, true); assert.equal(report.cleanup_sessions, 2);
});
test('a renewal identity failure during final logout prevents PASS even when both local logouts succeed', async () => {
  const f = fixture({ advanceAfterAdminLogout: true, badRefreshGetUser: true }), report = await checkUnavailableAdminInvitation(input, f.transport, f.interact, { now: f.now });
  assert.equal(report.completion_RPC_calls, 3); assert.equal(report.cleanup_sessions, 2);
  assert.equal(report.checks.temporary_invitation_and_audit_absent, true);
  assert.equal(report.checks.session_renewals_verified, false);
  assert.equal(report.session_renewal_problem_code, 'TEST_SESSION_RENEWAL_NOT_VERIFIED'); assert.equal(report.exit_code, 1);
});
