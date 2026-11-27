import assert from 'node:assert/strict';
import test from 'node:test';
import { checkDispatcherBoundaries, isDispatcherBoundaryPlan } from '../scripts/ci/staging-dispatcher-boundaries.mjs';

const actor = id => ({ id, token: 'test.' + Buffer.from(JSON.stringify({ sub: id,
  session_id: '33333333-3333-4333-8333-333333333333' })).toString('base64url') + '.test' });
const actors = { USER_A: actor('11111111-1111-4111-8111-111111111111'),
  USER_B: actor('22222222-2222-4222-8222-222222222222') };
const plan = { scope: 'dispatcher-boundaries', project: 'dczlddwbtgvfdujgcitb',
  case_ids: ['Y_EDGE_METHOD', 'Y_EDGE_NO_SECRET', 'Y_EDGE_WRONG_SECRET', 'Y_EDGE_HUMAN_CALLER'] };

test('the dispatcher plan requires the exact staging target and selected cases', () => {
  assert.equal(isDispatcherBoundaryPlan(plan), true);
  assert.equal(isDispatcherBoundaryPlan({ ...plan, project: 'production' }), false);
  assert.equal(isDispatcherBoundaryPlan({ ...plan, case_ids: [...plan.case_ids, 'extra'] }), false);
});
test('only ten denied calls reach the two fixed staging endpoints', async () => {
  const calls = [], evidence = {};
  await checkDispatcherBoundaries({ actors, evidence }, 'test-public', 'test-agent', async (url, options) => {
    calls.push({ url: String(url), ...options });
    const get = options.method === 'GET';
    return new Response(JSON.stringify({ error: get ? 'METHOD_NOT_ALLOWED' : 'CRON_AUTHENTICATION_FAILED' }),
      { status: get ? 405 : 401, headers: { 'cache-control': 'no-store' } });
  });
  assert.equal(calls.length, 10);
  assert.equal(evidence.exercise_requests, 10);
  assert.ok(Object.values(evidence.checks).every(Boolean));
  assert.ok(calls.every(call => /^https:\/\/dczlddwbtgvfdujgcitb\.supabase\.co\/functions\/v1\/dispatch-(push-reminders|admin-notifications)$/.test(call.url)));
  assert.equal(calls.filter(call => call.headers.Authorization).length, 4);
  assert.equal(calls.filter(call => call.headers['x-mushavo-cron-secret']).length, 2);
  assert.ok(calls.filter(call => call.method === 'POST').every(call => call.body === '{"source":"cron"}'));
  assert.equal(evidence.valid_cron_secret_used, false);
});
test('an unexpected allowed response stops before subsequent calls', async () => {
  let requests = 0;
  await assert.rejects(checkDispatcherBoundaries({ actors, evidence: {} }, 'test', 'test', async () => {
    requests++;
    return new Response('{}', { status: 200, headers: { 'cache-control': 'no-store' } });
  }), error => error.code === 'DISPATCHER_AUTHORIZATION_DENIAL_REQUIRED');
  assert.equal(requests, 1);
});
test('misbound actors cannot trigger any endpoint request', async () => {
  let called = false;
  await assert.rejects(checkDispatcherBoundaries({ actors: { ...actors, USER_B: actors.USER_A }, evidence: {} }, 'test', 'test', async () => {
    called = true;
  }), error => error.code === 'TWO_ORDINARY_BOUND_SESSIONS_REQUIRED');
  assert.equal(called, false);
});
