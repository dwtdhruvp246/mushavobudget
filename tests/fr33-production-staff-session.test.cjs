'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { verifyProductionStaffSession } = require('../scripts/fr33-production-staff-session.cjs');

const site = 'https://mushavobudget.com';
const api = 'https://kttkospkblwvguuwnhjj.supabase.co';
const credentials = { email: 'fictional-staff@example.test', password: 'fictional-test-password' };
const accessToken = 'fixture.access.token';
const sessionPath = '/rest/v1/rpc/app_session_status';
const signOutPath = '/auth/v1/logout?scope=local';
const success = {
  contract: 1, policy: 'ACTIVE_SUPABASE_SESSION', session_valid: true,
  admin_authorized: true, role: 'support_staff',
};

function setup({ configProject = api, session = success, archiveGate = 403,
  cleanup = 204, revoked = true } = {}) {
  const calls = [];
  let credentialReads = 0;
  let signedOut = false;
  const json = (status, body) => Response.json(body, { status });
  const report = verifyProductionStaffSession(() => {
    credentialReads++;
    return { ...credentials };
  }, async (url, request) => {
    calls.push(url);
    assert.equal(request.redirect, 'error');
    if (url === `${site}/config.js`) {
      assert.equal(request.headers, undefined);
      return new Response(`supabaseUrl: '${configProject}', supabasePublishableKey: 'sb_publishable_fixture'`);
    }
    assert.ok(url.startsWith(api));
    assert.equal(request.headers.apikey, 'sb_publishable_fixture');
    const path = url.slice(api.length);
    if (path === '/auth/v1/token?grant_type=password') {
      assert.equal(request.headers.authorization, undefined);
      assert.deepEqual(JSON.parse(request.body), credentials);
      return json(200, { access_token: accessToken });
    }
    assert.equal(request.headers.authorization, `Bearer ${accessToken}`);
    if (path === sessionPath) return json(200, signedOut && revoked ? { session_valid: false } : session);
    if (path === '/rest/v1/rpc/fr33_list_assigned_support_archive') {
      assert.equal(JSON.parse(request.body).p_after, 'ffffffff-ffff-ffff-ffff-ffffffffffff');
      return json(archiveGate, archiveGate === 403 ? { code: '42501' } : []);
    }
    if (path === '/functions/v1/get-private-file') {
      assert.equal(request.headers.origin, site);
      return json(403, { error: 'ORIGIN_NOT_ALLOWED' });
    }
    assert.equal(path, signOutPath);
    signedOut = cleanup === 204;
    return new Response(null, { status: cleanup });
  });
  return { report, calls, get credentialReads() { return credentialReads; } };
}

test('verifies a production staff session, closed gates, and current-session revocation', async () => {
  const run = setup();
  const receipt = await run.report;
  assert.equal(receipt.result, 'FR33_PRODUCTION_STAFF_SESSION_PASS');
  assert.equal(receipt.exit_code, 0);
  assert.equal(receipt.test_session_access_revoked, true);
  assert.equal(receipt.staff_archive_gate_closed, true);
  assert.equal(receipt.private_file_gate_closed, true);
  assert.equal(run.credentialReads, 1);
  assert.deepEqual(run.calls.slice(-2), [`${api}${signOutPath}`, `${api}${sessionPath}`]);
  for (const secret of [credentials.email, credentials.password, accessToken]) {
    assert.ok(!JSON.stringify(receipt).includes(secret));
  }
});

test('rejects a different site configuration before reading credentials', async () => {
  const run = setup({ configProject: 'https://dczlddwbtgvfdujgcitb.supabase.co' });
  assert.equal((await run.report).failure_code, 'PRODUCTION_PUBLIC_CONFIG_MISMATCH');
  assert.equal(run.credentialReads, 0);
  assert.deepEqual(run.calls, [`${site}/config.js`]);
});

test('cleans up the session even when the account cannot access Support', async () => {
  const run = setup({ session: { ...success, role: 'finance_staff' } });
  const receipt = await run.report;
  assert.equal(receipt.failure_code, 'ACTIVE_SUPPORT_STAFF_SESSION_REQUIRED');
  assert.equal(receipt.test_session_access_revoked, true);
  assert.equal(run.calls.length, 5);
});

test('does not report a closed archive gate when the RPC is unexpectedly open', async () => {
  const receipt = await setup({ archiveGate: 200 }).report;
  assert.equal(receipt.failure_step, 'staff_archive_gate');
  assert.equal(receipt.staff_archive_gate_closed, false);
  assert.equal(receipt.test_session_access_revoked, true);
});

test('requires a successful sign-out response and a denied application session', async () => {
  const failedSignOut = await setup({ cleanup: 503 }).report;
  assert.equal(failedSignOut.test_session_signed_out, false);
  assert.equal(failedSignOut.failure_code, 'SIGN_OUT_HTTP_503');
  const failedRevocation = await setup({ revoked: false }).report;
  assert.equal(failedRevocation.test_session_signed_out, true);
  assert.equal(failedRevocation.test_session_access_revoked, false);
  assert.equal(failedRevocation.failure_code, 'SESSION_REVOCATION_NOT_CONFIRMED');
});
