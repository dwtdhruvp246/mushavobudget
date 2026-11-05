import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { privateAccounts, readPublicConfiguration, allowedAPICall, apiTransport, checkStagingAccess, Stop, API_ORIGIN, tokenIdentity } from '../scripts/ci/staging-access.mjs';
import { browserRequestDecision, reviewedSourceMatches } from '../scripts/ci/staging-confirmation.mjs';
import { checkServerPasswordBoundary, sessionBrowserDecision } from '../scripts/ci/staging-password-sessions.mjs';
import { staleSessionSnapshot, BUSINESS_READ_RPCS } from '../scripts/ci/staging-account-switch.mjs';

const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];
const workspace = '44444444-4444-4444-8444-444444444444';
const slots = ['USER_A', 'USER_B', 'ADMIN'];
const accounts = Object.fromEntries(slots.map((slot, i) => [slot, { email: `fixture${i}@example.invalid`, password: `private-fixture-password-${i}` }]));
function fixture(options = {}) {
  const calls = [];
  const fixtureToken = i => options.jwtTokens ? jwt(ids[i], ids[i], 1) : `fixture-token-${slots[i]}`;
  return { calls, transport: async request => {
    calls.push(request);
    const i = request.token ? slots.findIndex((slot, index) => request.token === fixtureToken(index)) : slots.findIndex(slot => accounts[slot].email === request.body?.email);
    const { route, method } = request;
    if (route === '/auth/v1/logout?scope=local') return { status: options.failedCleanup ? 500 : 204, data: null };
    if (route.startsWith('/auth/v1/token')) {
      if (options.badPassword && i === 1) return { status: 400, data: { code: 'invalid_credentials', message: accounts.USER_B.password } };
      return { status: 200, data: { access_token: fixtureToken(i), refresh_token: 'PRIVATE_REFRESH' } };
    }
    if (route === '/auth/v1/user') return { status: 200, data: { id: ids[options.sameIdentity ? 0 : i], email: accounts[slots[i]].email, email_confirmed_at: '2026-11-05T00:00:00Z' } };
    if (route.startsWith('/rest/v1/profiles?')) {
      if (options.networkFailure && i === 1) throw new Error(accounts.USER_B.password);
      return { status: 200, data: [{ id: ids[i], account_status: 'active' }] };
    }
    if (route.startsWith('/rest/v1/app_admins?')) return { status: 200, data: i === 2 && !options.wrongAdmin ? [{ user_id: ids[i], role: 'super_admin' }] : [] };
    if (route.startsWith('/rest/v1/budget_workspaces?')) return { status: 200, data: i === 2 ? [] : [{ id: workspace, owner_id: ids[i], workspace_type: 'personal', status: 'active' }] };
    throw new Error('Unexpected fixture request');
  } };
}

test('missing or misbound secret values are refused before authentication', () => {
  assert.throws(() => privateAccounts({}), /PRIVATE_CREDENTIALS_REQUIRED_USER_A/);
  const env = { MUSHAVO_STAGING_USER_A_EMAIL: 'other@example.invalid', MUSHAVO_STAGING_USER_A_PASSWORD: 'private' };
  assert.throws(() => privateAccounts(env), /PRIVATE_CREDENTIALS_REQUIRED_USER_A/);
});

function jwt(userId, sessionId, issued) {
  return 'fixture.' + Buffer.from(JSON.stringify({ sub: userId, session_id: sessionId, iat: issued })).toString('base64url') + '.signature';
}

test('rotation of the same owned JWT session updates cleanup credentials without counting a new session', async () => {
  const { calls, transport } = fixture({ jwtTokens: true });
  const rotated = jwt(ids[0], ids[0], 2);
  const report = await checkStagingAccess(accounts, transport, async ({ registerSession }) => registerSession(rotated));
  assert.equal(report.exit_code, 0); assert.equal(report.created_sessions, 3); assert.equal(report.cleanup_sessions, 3);
  assert.equal(calls.filter(call => call.route.includes('logout') && call.token === rotated).length, 1);
  assert.equal(JSON.stringify(report).includes(rotated), false);
  assert.deepEqual(tokenIdentity(rotated), { userId: ids[0], sessionId: ids[0] });
});

test('early owned-session revocation and browser logout are acknowledged once and not repeated during cleanup', async () => {
  const { calls, transport } = fixture({ jwtTokens: true });
  const report = await checkStagingAccess(accounts, transport, async ({ actors, scopedLogout, acknowledgeLogout }) => {
    await scopedLogout(actors.USER_B.token);
    acknowledgeLogout(actors.USER_A.token, 204);
    acknowledgeLogout(actors.USER_A.token, 204);
    await assert.rejects(scopedLogout('unrelated-session-token'), /OWN_SESSION_REQUIRED_FOR_LOGOUT/);
  });
  assert.equal(report.exit_code, 0); assert.equal(report.cleanup_sessions, 3);
  assert.equal(calls.filter(call => call.route.includes('logout')).length, 2);
});

test('server password boundary sends exactly one seven-character request and accepts only a real strength denial for minimum eight', async () => {
  const calls = [];
  const result = await checkServerPasswordBoundary(accounts.USER_A, 'public', () => {}, async (url, options) => {
    calls.push({ url, ...options });
    return new Response(JSON.stringify({ code: 422, error_code: 'weak_password', msg: 'Password should be at least 8 characters.' }), { status: 422 });
  });
  assert.equal(result.status, 'SCOPED_PASS'); assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0].body);
  assert.equal(body.email, accounts.USER_A.email); assert.equal(body.password.length, 7);
  assert.notEqual(body.password, accounts.USER_A.password);
  assert.equal(JSON.stringify(result).includes(accounts.USER_A.email), false);
});

test('generic duplicate responses, rate limits and wrong configured minimum cannot pass the password boundary', async () => {
  for (const [status, data] of [[200, { user: { identities: [] } }], [422, { code: 'user_already_exists' }],
    [429, { code: 'over_request_rate_limit' }], [422, { code: 'weak_password', msg: 'Password should be at least 12 characters.' }]]) {
    let calls = 0;
    const result = await checkServerPasswordBoundary(accounts.USER_A, 'public', () => {}, async () => {
      calls++; return new Response(JSON.stringify(data), { status });
    });
    assert.equal(result.status, 'REVIEW_REQUIRED'); assert.equal(calls, 1);
  }
});

test('unexpected server-issued session is registered for cleanup before a boundary failure is reported', async () => {
  const registered = [];
  const result = await checkServerPasswordBoundary(accounts.USER_A, 'public', value => registered.push(value), async () =>
    new Response(JSON.stringify({ access_token: 'private-unexpected-token' }), { status: 200 }));
  assert.equal(result.status, 'REVIEW_REQUIRED'); assert.deepEqual(registered, ['private-unexpected-token']);
  assert.equal(JSON.stringify(result).includes('private-unexpected-token'), false);
});

test('session-browser boundary permits only reads, refresh, local logout and normal activity while refusing mutations and mail', () => {
  assert.equal(sessionBrowserDecision(API_ORIGIN + '/auth/v1/token?grant_type=refresh_token', 'POST'), 'refresh');
  assert.equal(sessionBrowserDecision(API_ORIGIN + '/auth/v1/logout?scope=local', 'POST'), 'local-logout');
  assert.equal(sessionBrowserDecision(API_ORIGIN + '/rest/v1/rpc/app_session_status', 'POST'), 'read');
  assert.equal(sessionBrowserDecision(API_ORIGIN + '/rest/v1/rpc/record_my_analytics_activity', 'POST'), 'normal-activity');
  for (const [method, route] of [['POST', '/auth/v1/logout?scope=global'], ['PUT', '/auth/v1/user'],
    ['POST', '/auth/v1/recover'], ['POST', '/auth/v1/resend'], ['POST', '/auth/v1/signup'],
    ['DELETE', '/rest/v1/push_subscriptions'], ['PATCH', '/rest/v1/profiles'], ['POST', '/rest/v1/rpc/provision_my_budget_workspace']]) {
    assert.equal(sessionBrowserDecision(API_ORIGIN + route, method), 'refuse');
  }
});

test('Business concurrency allowlist contains reads and does not admit finance/team writes', () => {
  assert.equal(sessionBrowserDecision(API_ORIGIN + '/rest/v1/rpc/business_transaction_feed', 'POST', BUSINESS_READ_RPCS), 'read');
  for (const name of ['record_business_income', 'save_business_role', 'respond_business_invitation', 'remove_business_member', 'save_business_setup_with_branding'])
    assert.equal(sessionBrowserDecision(API_ORIGIN + '/rest/v1/rpc/' + name, 'POST', BUSINESS_READ_RPCS), 'refuse');
});

test('stale-token acceptance requires a still-unexpired JWT, the exact denied session contract and no protected row', async () => {
  const actor = { id: ids[1], token: 'fixture.' + Buffer.from(JSON.stringify({ sub: ids[1], session_id: ids[1], exp: Math.floor(Date.now()/1000) + 3600 })).toString('base64url') + '.signature' };
  const denied = { contract: 1, policy: 'PASSWORD_ONLY_ALL_USERS', session_valid: false, admin_authorized: false, role: null };
  for (const [gate, rows, pass] of [[denied, [], true], [{ ...denied, session_valid: true }, [], false], [denied, [{ id: ids[1] }], false]]) {
    let count = 0;
    const fetcher = async () => new Response(JSON.stringify(++count === 1 ? gate : rows), { status: 200 });
    if (pass) { const result = await staleSessionSnapshot(actor, 'public', 'fixture', fetcher); assert.equal(result.status, 'STALE_SESSION_VARIANT_SCOPED_PASS'); assert.equal(JSON.stringify(result).includes(actor.token), false); }
    else await assert.rejects(staleSessionSnapshot(actor, 'public', 'fixture', fetcher), /STALE_SESSION_BOUNDARY_NOT_VERIFIED/);
    assert.equal(count, 2);
  }
});

test('configuration refuses production, executable input and privileged keys', () => {
  const config = value => `window.MUSHAVO_BUDGET_CONFIG = ${JSON.stringify(value)};`;
  const valid = { supabaseUrl: API_ORIGIN, supabasePublishableKey: 'sb_publishable_examplePublicKey123' };
  assert.equal(readPublicConfiguration(config(valid)).key, valid.supabasePublishableKey);
  assert.throws(() => readPublicConfiguration(config({ ...valid, supabaseUrl: 'https://production.example.invalid' })), /EXACT_STAGING_PROJECT_REQUIRED/);
  assert.throws(() => readPublicConfiguration(config({ ...valid, supabasePublishableKey: 'sb_secret_privileged123' })), /PUBLIC_PUBLISHABLE_KEY_REQUIRED/);
  assert.throws(() => readPublicConfiguration('window.MUSHAVO_BUDGET_CONFIG = process.env;'), /PUBLIC_CONFIGURATION_FORMAT_REQUIRED/);
});

test('API boundaries refuse writes, RPCs, injected queries and global logout', async () => {
  for (const [method, route] of [['POST', '/auth/v1/logout'], ['POST', '/auth/v1/logout?scope=global'], ['PUT', '/auth/v1/user'], ['DELETE', '/rest/v1/profiles'], ['POST', '/rest/v1/rpc/complete_admin_user_invitation'], ['GET', '/rest/v1/profiles?select=*']]) assert.equal(allowedAPICall(method, route), false);
  let requests = 0;
  const send = apiTransport('public', 'fixture', async () => { requests++; });
  await assert.rejects(send({ method: 'POST', route: '/auth/v1/logout?scope=global' }), /UNPLANNED_API_CALL_REFUSED/);
  assert.equal(requests, 0);
});

test('three genuine identities and expected roles finish with exactly three scoped logouts', async () => {
  const { calls, transport } = fixture(); let exercised = 0;
  const report = await checkStagingAccess(accounts, transport, async ({ evidence }) => { exercised++; evidence.selected_scope_passed = true; });
  assert.equal(report.exit_code, 0); assert.equal(exercised, 1);
  assert.equal(report.API_requests, 18); assert.equal(report.created_sessions, 3); assert.equal(report.cleanup_sessions, 3);
  assert.equal(calls.filter(call => call.route === '/auth/v1/logout?scope=local').length, 3);
  for (const value of [...Object.values(accounts).flatMap(account => [account.email, account.password]), 'fixture-token-', 'PRIVATE_REFRESH']) assert.equal(JSON.stringify(report).includes(value), false);
});

test('failed credentials and transport errors preserve cleanup and never run the selected browser check', async () => {
  for (const options of [{ badPassword: true }, { networkFailure: true }]) {
    const { transport } = fixture(options); let exercised = false;
    const report = await checkStagingAccess(accounts, transport, async () => { exercised = true; });
    assert.equal(report.exit_code, 1); assert.equal(exercised, false);
    assert.equal(report.created_sessions, report.cleanup_sessions);
    assert.equal(JSON.stringify(report).includes(accounts.USER_B.password), false);
  }
});

test('wrong Admin role and duplicate identities cannot earn acceptance', async () => {
  for (const options of [{ wrongAdmin: true }, { sameIdentity: true }]) {
    const { transport } = fixture(options);
    const report = await checkStagingAccess(accounts, transport, () => { throw new Error('Browser must not run'); });
    assert.equal(report.exit_code, 1); assert.equal(report.created_sessions, report.cleanup_sessions);
    assert.equal(report.checks.three_private_credentials_and_expected_roles_verified, undefined);
  }
});

test('browser failure retains partial safe evidence and still cleans all created sessions', async () => {
  const { transport } = fixture();
  const report = await checkStagingAccess(accounts, transport, async ({ evidence }) => {
    evidence.blocked_resend_attempts = 1; throw new Stop('BROWSER_EXPECTATION_NOT_MET');
  });
  assert.equal(report.exit_code, 1); assert.equal(report.exercise.blocked_resend_attempts, 1);
  assert.equal(report.cleanup_sessions, 3);
});

test('a failed local logout blocks COMPLETE', async () => {
  const { transport } = fixture({ failedCleanup: true });
  const report = await checkStagingAccess(accounts, transport);
  assert.equal(report.exit_code, 1); assert.equal(report.cleanup_sessions, 0);
  assert.equal(report.cleanup_problem_code, 'SCOPED_SESSION_CLEANUP_NOT_VERIFIED');
});

test('browser guard caps duplicate signup and blocks every resend, production call and unplanned mutation', () => {
  assert.equal(browserRequestDecision(API_ORIGIN + '/auth/v1/signup', 'POST', 'signup', 0), 'duplicate-signup');
  assert.equal(browserRequestDecision(API_ORIGIN + '/auth/v1/signup', 'POST', 'signup', 1), 'refuse');
  assert.equal(browserRequestDecision(API_ORIGIN + '/auth/v1/resend?redirect_to=ignored', 'POST', 'confirmation', 1), 'block-resend');
  assert.equal(browserRequestDecision(API_ORIGIN + '/auth/v1/recover', 'POST', 'confirmation', 1), 'refuse');
  assert.equal(browserRequestDecision(API_ORIGIN + '/auth/v1/user', 'PUT', 'confirmation', 1), 'refuse');
  assert.equal(browserRequestDecision('https://production.example.invalid/auth/v1/resend', 'POST', 'confirmation', 1), 'refuse');
});

test('signup pin accepts only the exact canonical HTML with the approved two staging DNS substitutions', () => {
  const canonical = fs.readFileSync(new URL('../signup.html', import.meta.url), 'utf8');
  const staging = Buffer.from(canonical.replaceAll('kttkospkblwvguuwnhjj.supabase.co', 'dczlddwbtgvfdujgcitb.supabase.co'));
  assert.equal(reviewedSourceMatches('/signup', staging), true);
  assert.equal(reviewedSourceMatches('/signup', Buffer.from(canonical)), false);
  assert.equal(reviewedSourceMatches('/signup', Buffer.from(staging.toString().replace('supabase.auth.signUp', 'supabase.auth.signOut'))), false);
});
