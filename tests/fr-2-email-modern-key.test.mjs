import test from 'node:test';
import assert from 'node:assert/strict';
import {createBackendAdapter, createEmailGateway, STAGING_PROJECT, STAGING_ORIGIN} from '../supabase/functions/_shared/email-verification-gateway.mjs';
const url = 'https://' + STAGING_PROJECT + '.supabase.co';
const pub = 'sb_publishable_SYNTHETIC_ONLY';
const secret = 'sb_secret_SYNTHETIC_MODERN_ONLY';
const U = '00000000-0000-4000-8000-000000000911', S = '00000000-0000-4000-8000-000000000912';
const claims = () => ({sub: U, session_id: S, role: 'authenticated', aud: 'authenticated', iss: url + '/auth/v1', exp: Math.floor(Date.now()/1000) + 3600});
const jwt = c => Buffer.from('{"alg":"HS256"}').toString('base64url') + '.' + Buffer.from(JSON.stringify(c)).toString('base64url') + '.c3ludGhldGlj';
const json = (value, status = 200) => new Response(JSON.stringify(value), {status, headers: {'content-type': 'application/json'}});
const names = ['begin_challenge','set_delivery','challenge_context','verify_challenge','restore_device','revoke_device','revoke_all','session_status'];
for (const name of names) test('Modern secret uses only apikey for ' + name + ' without changing RPC arguments', async () => {
  const args = {p_user: U, p_session: S}; let calls = 0;
  const adapter = createBackendAdapter({publishableKey: pub, serviceKey: secret, fetcher: async (target, init) => {
    calls++; assert.equal(target, url + '/rest/v1/rpc/email_gate_' + name); assert.equal(init.method, 'POST');
    const headers = new Headers(init.headers); assert.equal(headers.get('apikey'), secret);
    assert.equal(headers.has('authorization'), false); assert.equal(headers.get('content-type'), 'application/json');
    assert.deepEqual(JSON.parse(init.body), args); assert.ok(!target.includes(secret)); assert.ok(!init.body.includes(secret));
    return json({result: 'SYNTHETIC_RESULT'});
  }});
  assert.deepEqual(await adapter.rpc(name, args), {result: 'SYNTHETIC_RESULT'}); assert.equal(calls, 1);
});
test('Legacy JWT service_role transport remains available without claiming signature or project ownership proof', async () => {
  const legacy = jwt({role: 'service_role', ref: STAGING_PROJECT}); let calls = 0;
  const adapter = createBackendAdapter({publishableKey: pub, serviceKey: legacy, fetcher: async (target, init) => {
    calls++; assert.equal(init.headers.apikey, legacy); assert.equal(init.headers.authorization, 'Bearer ' + legacy); return json(false);
  }});
  assert.equal(await adapter.rpc('session_status', {p_user: U, p_session: S}), false); assert.equal(calls, 1);
});
test('User Auth receives the exact caller JWT with the public key; the Secret key never replaces it', async () => {
  const bearer = 'Bearer ' + jwt(claims()); let calls = 0;
  const adapter = createBackendAdapter({publishableKey: pub, serviceKey: secret, fetcher: async (target, init) => {
    calls++; assert.equal(target, url + '/auth/v1/user'); assert.equal(init.headers.authorization, bearer);
    assert.equal(init.headers.apikey, pub); assert.ok(!JSON.stringify(init).includes(secret));
    return json({id: U, email: 'controlled@example.invalid', email_confirmed_at: new Date().toISOString()});
  }});
  const actor = await adapter.authenticate(new Request(STAGING_ORIGIN, {headers: {authorization: bearer}}));
  assert.equal(actor.userId, U); assert.equal(actor.sessionId, S); assert.equal(calls, 1);
});
test('Modern Secret key supplied as a user bearer cannot authenticate a user session', async () => {
  let calls = 0;
  const adapter = createBackendAdapter({publishableKey: pub, serviceKey: secret, fetcher: async () => {calls++; return json(true);}});
  await assert.rejects(adapter.authenticate(new Request(STAGING_ORIGIN, {headers: {authorization: 'Bearer ' + secret}})));
  assert.equal(calls, 0);
});
test('Admin-labelled but unvalidated user JWT cannot reach a privileged RPC with the modern server key', async () => {
  const seen = [];
  const adapter = createBackendAdapter({publishableKey: pub, serviceKey: secret, fetcher: async (target, init) => {
    seen.push(target); assert.equal(target, url + '/auth/v1/user'); assert.equal(init.headers.apikey, pub); return json({error: 'SYNTHETIC_DENIAL'}, 401);
  }});
  const gateway = createEmailGateway({adapter, mailer: async () => {throw Error('MAIL_MUST_NOT_RUN');},
    keyring: new Map([['v1', new Uint8Array(32).fill(42)]]), currentKeyVersion: 'v1', limit: async () => ({success: true})});
  const c = {...claims(), app_metadata: {role: 'super_admin'}};
  const response = await gateway(new Request(STAGING_ORIGIN + '/api/email-verification/status', {
    method: 'POST', headers: {origin: STAGING_ORIGIN, authorization: 'Bearer ' + jwt(c), 'content-type': 'application/json', 'x-mushavo-csrf': 'email-v1', 'cf-connecting-ip': '192.0.2.44'}, body: '{}'}));
  assert.equal(response.status, 401); assert.equal(seen.length, 1); assert.ok(!(await response.text()).includes(secret));
});
test('Modern transport cannot access a non-allowlisted service routine', async () => {
  let calls = 0;
  const adapter = createBackendAdapter({publishableKey: pub, serviceKey: secret, fetcher: async () => {calls++; return json(true);}});
  await assert.rejects(adapter.rpc('grant_admin', {p_user: U})); assert.equal(calls, 0);
});
