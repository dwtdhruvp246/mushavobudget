import assert from 'node:assert/strict';
import test from 'node:test';
import { checkFamilyProof, isFamilyProofPlan } from '../scripts/ci/staging-family-proof.mjs';
import { checkStagingAccess } from '../scripts/ci/staging-access.mjs';

const id = digit => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
const actor = digit => ({ id: id(digit), token: 'test.' + Buffer.from(JSON.stringify({ sub: id(digit), session_id: id(digit) })).toString('base64url') + '.test' });
const actors = { USER_A: actor('1'), USER_B: actor('2'), ADMIN: actor('3') };
const plan = { scope: 'family-proof-path-binding', project: 'dczlddwbtgvfdujgcitb', fixture_name: 'audit-family-proof-policy-20261107', family_id: id('4'),
  case_ids: ['X_FAMILY_PROOF_OWNER_MEMBER', 'X_FAMILY_PROOF_PATH_DENIALS', 'X_FAMILY_PROOF_REMOVAL', 'X_FAMILY_PROOF_CLEANUP'] };

function backend({ loseUploadResponse = false, refuseCleanup = false } = {}) {
  const state = { family: true, member: true, objects: new Map(), calls: [] };
  const fetcher = async (url, options) => {
    const p = new URL(url); assert.equal(p.origin, 'https://dczlddwbtgvfdujgcitb.supabase.co');
    const caller = Object.values(actors).find(value => options.headers.Authorization === 'Bearer ' + value.token);
    state.calls.push({ route: p.pathname, method: options.method });
    const ok = value => new Response(JSON.stringify(value), { status: 200 });
    const no = () => new Response(JSON.stringify({ statusCode: '403' }), { status: 400 });
    if (p.pathname === '/rest/v1/families') return ok(state.family ? [{ id: plan.family_id, name: plan.fixture_name, owner_id: actors.USER_A.id }] : []);
    if (p.pathname === '/rest/v1/family_members') return ok([{ id: id('5'), user_id: actors.USER_B.id, status: 'active' }]);
    if (p.pathname.endsWith('/remove_family_member')) { state.member = false; return ok('removed'); }
    if (p.pathname.endsWith('/delete_family_workspace')) {
      assert.equal(state.objects.size, 0, 'database fixture must survive until all file bytes are gone'); state.family = false; return ok('deleted');
    }
    if (options.method === 'DELETE') {
      assert.equal(caller, actors.ADMIN);
      if (refuseCleanup) return new Response('{}', { status: 500 });
      const removed = []; for (const path of JSON.parse(options.body).prefixes) {
        if (state.objects.delete(path)) removed.push({ name: path });
      }
      return ok(removed);
    }
    const binaryRoute = '/storage/v1/object/payment-proofs/';
    if (p.pathname.startsWith(binaryRoute)) {
      const path = p.pathname.slice(binaryRoute.length), parts = path.split('/');
      const permitted = caller && (parts[0] === 'personal' && parts[1] === caller.id
        || parts[0] === 'families' && parts[1] === plan.family_id && parts[2] === actors.USER_A.id && parts[3] === caller.id
          && (caller === actors.USER_A || caller === actors.USER_B && state.member));
      if (!permitted) return no();
      state.objects.set(path, Buffer.from(options.body));
      if (loseUploadResponse) throw new Error('upload committed but response lost');
      return ok({ Key: path });
    }
    if (p.pathname.includes('/object/sign/')) return no();
    if (p.pathname.includes('/object/authenticated/payment-proofs/')) {
      const path = p.pathname.split('/object/authenticated/payment-proofs/')[1];
      if (!state.objects.has(path)) return new Response(JSON.stringify({ statusCode: '404' }), { status: 400 });
      if (!(caller === actors.ADMIN || caller === actors.USER_A || caller === actors.USER_B && state.member)) return no();
      return new Response(state.objects.get(path), { status: 200 });
    }
    throw new Error('unexpected test route');
  };
  return { state, fetcher };
}

test('Family proof scope binds the synthetic fixture and reviewed cases', () => {
  assert.equal(isFamilyProofPlan(plan), true);
  assert.equal(isFamilyProofPlan({ ...plan, family_id: 'arbitrary' }), false);
  assert.equal(isFamilyProofPlan({ ...plan, project: 'production' }), false);
});
test('the real-request harness removes every attempted test object before deleting the Family', async () => {
  const { state, fetcher } = backend(), evidence = {};
  await checkFamilyProof({ actors, evidence }, 'public-test', 'test-agent', plan, fetcher);
  assert.ok(Object.values(evidence.checks).every(Boolean));
  assert.equal(state.objects.size, 0); assert.equal(state.family, false);
  assert.equal(evidence.Storage_cleanup_verified, true); assert.equal(evidence.synthetic_family_removed, true);
  assert.ok(state.calls.length <= 60); assert.equal(evidence.exercise_requests, state.calls.length);
});
test('an ambiguous committed upload is included in exact API cleanup', async () => {
  const { state, fetcher } = backend({ loseUploadResponse: true }), evidence = {};
  await assert.rejects(checkFamilyProof({ actors, evidence }, 'test', 'test', plan, fetcher), /response lost/);
  assert.equal(evidence.cleanup_paths.length, 1); assert.equal(state.objects.size, 0); assert.equal(state.family, false);
});
test('failed Storage cleanup preserves the Family and its cleanup manifest', async () => {
  const { state, fetcher } = backend({ refuseCleanup: true }), evidence = {};
  await assert.rejects(checkFamilyProof({ actors, evidence }, 'test', 'test', plan, fetcher));
  assert.equal(state.family, true); assert.equal(state.objects.size, 3);
  assert.equal(evidence.Storage_cleanup_verified, false); assert.equal(evidence.synthetic_family_removed, false);
  assert.equal(state.calls.filter(call => call.route.endsWith('/delete_family_workspace')).length, 0);
  assert.ok(evidence.cleanup_paths.length >= 3);
});
test('staging access accepts the database household type and reports it as Family', async () => {
  const accounts = Object.fromEntries(Object.entries(actors).map(([slot]) => [slot,{ email: slot.toLowerCase()+'@example.test', password: 'synthetic' }]));
  const transport = async ({ method, route, token, body }) => {
    const slot = token ? Object.keys(actors).find(slot => actors[slot].token === token)
      : Object.keys(accounts).find(slot => accounts[slot].email === body.email);
    const current = actors[slot];
    if (route.startsWith('/auth/v1/token')) return { status: 200, data: { access_token: current.token } };
    if (route.startsWith('/auth/v1/logout')) return { status: 204, data: null };
    if (route === '/auth/v1/user') return { status: 200, data: { id: current.id, email: accounts[slot].email, email_confirmed_at: '2026-11-07' } };
    if (route.startsWith('/rest/v1/profiles')) return { status: 200, data: [{ id: current.id, account_status: 'active' }] };
    if (route.startsWith('/rest/v1/app_admins')) return { status: 200, data: slot === 'ADMIN' ? [{ user_id: current.id, role: 'super_admin' }] : [] };
    assert.equal(method, 'GET');
    return { status: 200, data: [{ id: current.id, owner_id: current.id, workspace_type: 'personal', status: 'active' },
      ...(slot === 'USER_A' ? [{ id: id('6'), owner_id: current.id, workspace_type: 'household', status: 'active' }] : [])] };
  };
  const report = await checkStagingAccess(accounts, transport);
  assert.equal(report.exit_code, 0); assert.equal(report.accounts.USER_A.owned_workspace_counts.family, 1);
  assert.equal(report.cleanup_sessions, 3);
});
