import assert from 'node:assert/strict';
import test from 'node:test';
import { checkPrivateFileCache, isPrivateFileCachePlan } from '../scripts/ci/staging-private-file-cache.mjs';

const id = digit => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
const actor = digit => ({ id: id(digit), token: 'private.' + Buffer.from(JSON.stringify({ sub: id(digit), session_id: id(digit) })).toString('base64url') + '.session' });
const actors = { USER_A: actor('1'), USER_B: actor('2') };
const plan = { scope: 'private-file-cache-observation', project: 'dczlddwbtgvfdujgcitb', cache_controls: [0, 60], warm_seconds: 10, cold_seconds: 12,
  case_ids: ['X_PRIVATE_FILE_OWNER_FOREIGN', 'X_SIGNED_URL_COLD_EXPIRY', 'X_SIGNED_URL_WARM_EXPIRY',
    'X_ZERO_AND_SHORT_UPLOAD_CACHE_CONTROL', 'X_PRIVATE_FILE_EXACT_CLEANUP'] };

function backend({ coldExposure = false, foreignSigning = false, foreignURL = false, lostUpload = false, nonceHit = false, expiryText = '\"exp\" claim timestamp check failed' } = {}) {
  const state = { time: Date.parse('2026-11-07T18:00:00Z'), objects: new Map(), warmed: new Set(), calls: [], signedTokens: [] };
  const fetcher = async (url, options) => {
    const parsed = new URL(url); assert.equal(parsed.origin, 'https://dczlddwbtgvfdujgcitb.supabase.co');
    assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error');
    const caller = Object.values(actors).find(value => options.headers.Authorization === 'Bearer ' + value.token);
    state.calls.push({ method: options.method, route: parsed.pathname + parsed.search, caller });
    const json = (data, status = 200) => Response.json(data, { status });
    const missing = () => json({ statusCode: '404', error: 'not_found' }, 400);
    const expired = () => json({ statusCode: '400', error: 'InvalidJWT', message: expiryText }, 400);
    const image = (object, hit = false) => new Response(object.bytes, { status: 200,
      headers: { 'content-type': 'image/png', 'cache-control': 'private, no-cache', 'cf-cache-status': hit ? 'HIT' : 'MISS' } });
    if (options.method === 'POST' && parsed.pathname.startsWith('/storage/v1/object/payment-proofs/')) {
      assert.equal(caller, actors.USER_A); assert.equal(options.headers['x-upsert'], 'false');
      const path = parsed.pathname.slice('/storage/v1/object/payment-proofs/'.length);
      assert.ok(path.startsWith('personal/' + caller.id + '/audit-cache-'));
      const cache = options.headers['cache-control']; assert.ok(['max-age=0', 'max-age=60'].includes(cache));
      state.objects.set(path, { bytes: options.body, cache });
      if (lostUpload) throw new Error('lost upload response');
      return json({}, 200);
    }
    if (options.method === 'DELETE') {
      assert.equal(caller, actors.USER_A); assert.equal(parsed.pathname, '/storage/v1/object/payment-proofs');
      const { prefixes } = JSON.parse(options.body);
      for (const path of prefixes) { assert.ok(path.startsWith('personal/' + caller.id + '/audit-cache-')); state.objects.delete(path); }
      return json(prefixes.map(name => ({ name })));
    }
    if (options.method === 'GET' && parsed.pathname.startsWith('/storage/v1/object/authenticated/payment-proofs/')) {
      const path = parsed.pathname.slice('/storage/v1/object/authenticated/payment-proofs/'.length);
      if (caller !== actors.USER_A || !state.objects.has(path)) return missing();
      return image(state.objects.get(path));
    }
    if (parsed.pathname.startsWith('/storage/v1/object/sign/payment-proofs/')) {
      const path = parsed.pathname.slice('/storage/v1/object/sign/payment-proofs/'.length);
      if (options.method === 'POST') {
        if (caller !== actors.USER_A) return foreignSigning ? json({ signedURL: 'unexpected' }) : missing();
        const { expiresIn } = JSON.parse(options.body);
        const token = 'signed.' + Buffer.from(JSON.stringify({ exp: Math.floor(state.time / 1000) + expiresIn })).toString('base64url') + '.secret_signature';
        state.signedTokens.push(token);
        return json({ signedURL: foreignURL ? 'https://foreign.example.invalid/stolen' : '/object/sign/payment-proofs/' + path + '?token=' + token });
      }
      assert.equal(caller, undefined);
      const token = parsed.searchParams.get('token');
      const exp = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).exp * 1000;
      const key = parsed.pathname + '?token=' + token;
      const object = state.objects.get(path); if (!object) return missing();
      if (state.time > exp) {
        const warm = state.warmed.has(key) && object.cache === 'max-age=60';
        if (coldExposure || warm && (!parsed.searchParams.has('cacheNonce') || nonceHit)) return image(object, warm);
        return expired();
      }
      state.warmed.add(key); return image(object);
    }
    throw new Error('unplanned storage route');
  };
  return { state, dependencies: { fetcher, now: () => state.time,
    pause: async ms => { assert.ok(ms > 0 && ms <= 1000); state.time += ms; } } };
}

test('cache scope refuses another project, extra cache controls, longer token lifetime or missing cases', () => {
  assert.equal(isPrivateFileCachePlan(plan), true);
  for (const change of [{ project: 'production' }, { cache_controls: [0, 3600] }, { warm_seconds: 60 }, { cold_seconds: 60 }, { case_ids: [] }])
    assert.equal(isPrivateFileCachePlan({ ...plan, ...change }), false);
});
test('warm expiry is measured independently from cold expiry and both harmless objects are removed', async () => {
  const { state, dependencies } = backend(), evidence = {};
  await checkPrivateFileCache({ actors, evidence }, 'public', 'test', plan, dependencies);
  assert.ok(Object.values(evidence.checks).every(Boolean));
  assert.equal(evidence.expired_signed_warm_copies_observed, true);
  assert.equal(evidence.observations[0].expired_warm_copy_observed, false);
  assert.equal(evidence.observations[1].expired_warm_copy_observed, true);
  assert.equal(evidence.cached_copy_immediate_revocation_claimed, false);
  assert.equal(evidence.membership_revocation_tested, false); assert.equal(evidence.browser_cache_tested, false);
  assert.equal(evidence.Storage_cleanup_verified, true); assert.equal(state.objects.size, 0);
  assert.ok(state.calls.length < 35); assert.equal(state.calls.length, evidence.exercise_requests);
  const safe = JSON.stringify(evidence);
  for (const value of [...state.signedTokens, actors.USER_A.token, actors.USER_B.token, '?token=']) assert.equal(safe.includes(value), false);
});
test('a cacheNonce hit is recorded without manufacturing a provider-origin denial', async () => {
  const { state, dependencies } = backend({ nonceHit: true }), evidence = {};
  await checkPrivateFileCache({ actors, evidence }, 'public', 'test', plan, dependencies);
  assert.equal(evidence.observations[1].nonce_copy_after_expiry_observed, true);
  assert.equal(evidence.cached_copy_immediate_revocation_claimed, false); assert.equal(state.objects.size, 0);
});
test('never-requested cold URLs cannot expose expired content and still clean both objects', async () => {
  const { state, dependencies } = backend({ coldExposure: true }), evidence = {};
  await assert.rejects(checkPrivateFileCache({ actors, evidence }, 'public', 'test', plan, dependencies), /COLD_SIGNED_CACHE_0_DENIED/);
  assert.equal(state.objects.size, 0); assert.equal(evidence.Storage_cleanup_verified, true);
});
test('a foreign ordinary account obtaining a signature is a failure with exact cleanup', async () => {
  const { state, dependencies } = backend({ foreignSigning: true }), evidence = {};
  await assert.rejects(checkPrivateFileCache({ actors, evidence }, 'public', 'test', plan, dependencies), /FOREIGN_SIGNING_DENIED/);
  assert.equal(state.objects.size, 0);
});
test('a returned URL outside the exact generated object is refused before any download', async () => {
  const { state, dependencies } = backend({ foreignURL: true }), evidence = {};
  await assert.rejects(checkPrivateFileCache({ actors, evidence }, 'public', 'test', plan, dependencies), /EXACT_FIXTURE_SIGNED_URL/);
  assert.equal(state.calls.filter(value => value.method === 'GET').length, 2); // Original read and exact absence readback.
  assert.equal(state.objects.size, 0);
});
test('a lost upload acknowledgement still removes the only attempted generated object', async () => {
  const { state, dependencies } = backend({ lostUpload: true }), evidence = {};
  await assert.rejects(checkPrivateFileCache({ actors, evidence }, 'public', 'test', plan, dependencies), /lost upload/);
  assert.equal(evidence.upload_attempts, 1); assert.equal(evidence.Storage_cleanup_verified, true); assert.equal(state.objects.size, 0);
});
test('duplicate ordinary identities cause no storage request', async () => {
  let requests = 0;
  await assert.rejects(checkPrivateFileCache({ actors: { ...actors, USER_B: actors.USER_A }, evidence: {} },
    'public', 'test', plan, { fetcher: async () => { requests++; } }), /TWO_DISTINCT_BOUND_ORDINARY/);
  assert.equal(requests, 0);
});

test('legacy expiry wording is also recognized but unrelated JWT failures cannot pass', async () => {
  const legacy = backend({ expiryText: 'jwt expired' }), legacyEvidence = {};
  await checkPrivateFileCache({ actors, evidence: legacyEvidence }, 'public', 'test', plan, legacy.dependencies);
  assert.equal(legacyEvidence.Storage_cleanup_verified, true);
  const invalid = backend({ expiryText: 'signature verification failed' });
  await assert.rejects(checkPrivateFileCache({ actors, evidence: {} }, 'public', 'test', plan, invalid.dependencies), /COLD_SIGNED_CACHE_0_DENIED/);
  assert.equal(invalid.state.objects.size, 0);
});
