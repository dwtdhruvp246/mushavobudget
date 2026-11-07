import { randomUUID } from 'node:crypto';
import { API_ORIGIN, digest, need, tokenIdentity } from './staging-access.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF6sAAAAASUVORK5CYII=', 'base64');
const CASES = ['X_PRIVATE_FILE_OWNER_FOREIGN', 'X_SIGNED_URL_COLD_EXPIRY', 'X_SIGNED_URL_WARM_EXPIRY',
  'X_ZERO_AND_SHORT_UPLOAD_CACHE_CONTROL', 'X_PRIVATE_FILE_EXACT_CLEANUP'];
const BUCKET = '/storage/v1/object/payment-proofs';
const rowsDenied = result => [401, 403, 404].includes(result.status)
  || result.status === 400 && [401, 403, 404].includes(Number(result.data?.statusCode));
const expiredDenied = result => rowsDenied(result) || result.status === 400
  && result.data?.error === 'InvalidJWT' && /expired/i.test(result.data?.message || '');
const absent = result => result.status === 404 || result.status === 400 && Number(result.data?.statusCode) === 404;

export function isPrivateFileCachePlan(plan) {
  return plan.scope === 'private-file-cache-observation' && plan.project === 'dczlddwbtgvfdujgcitb'
    && JSON.stringify(plan.cache_controls) === '[0,60]' && plan.warm_seconds === 10 && plan.cold_seconds === 12
    && JSON.stringify(plan.case_ids) === JSON.stringify(CASES);
}

export async function checkPrivateFileCache({ actors, evidence }, key, agent, plan,
  { fetcher = fetch, now = Date.now, pause = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  need(isPrivateFileCachePlan(plan), 'REVIEWED_PRIVATE_FILE_CACHE_PLAN_REQUIRED');
  const owner = actors.USER_A, foreign = actors.USER_B;
  need(Object.keys(actors).length === 2 && owner?.id !== foreign?.id
    && [owner, foreign].every(actor => tokenIdentity(actor?.token)?.userId === actor?.id)
    && tokenIdentity(owner.token).sessionId !== tokenIdentity(foreign.token).sessionId,
  'TWO_DISTINCT_BOUND_ORDINARY_FILE_ACTORS_REQUIRED');
  Object.assign(evidence, { checks: {}, exercise_requests: 0, upload_attempts: 0, cleanup_paths: [],
    Storage_cleanup_verified: false, email_requests: 0, provider_payment_requests: 0, finance_writes: 0,
    browser_cache_tested: false, membership_revocation_tested: false, CDN_purge_requested: false,
    cached_copy_immediate_revocation_claimed: false, observations: [] });
  const check = (name, passed) => { evidence.checks[name] = passed === true; need(passed === true, name + '_REQUIRED'); };
  const nonce = randomUUID(), paths = plan.cache_controls.map(value => `personal/${owner.id}/audit-cache-${nonce}-${value}.png`);
  const attempted = new Set(), signed = new Set();
  const signPath = path => '/storage/v1/object/sign/payment-proofs/' + path;
  const authPath = path => '/storage/v1/object/authenticated/payment-proofs/' + path;
  const request = async (method, route, actor, body, { cleanup = false, binary = false, uploadCache } = {}) => {
    need(evidence.exercise_requests < (cleanup ? 44 : 35), 'PRIVATE_FILE_CACHE_REQUEST_BOUND_REQUIRED');
    const url = new URL(route, API_ORIGIN), queryKeys = [...url.searchParams.keys()].sort().join(',');
    const original = paths.some(path => url.pathname === authPath(path))
      && (queryKeys === '' || queryKeys === 'cacheNonce');
    const signedRead = signed.has(url.pathname + '?' + new URLSearchParams({ token: url.searchParams.get('token') }).toString())
      && (queryKeys === 'token' || queryKeys === 'cacheNonce,token');
    const allowed = method === 'POST' && paths.some(path => url.pathname === BUCKET + '/' + path || url.pathname === signPath(path)) && queryKeys === ''
      || method === 'GET' && (original || signedRead)
      || method === 'DELETE' && url.pathname === BUCKET && queryKeys === '' && Array.isArray(body?.prefixes)
        && body.prefixes.length === attempted.size && new Set(body.prefixes).size === attempted.size
        && body.prefixes.every(path => attempted.has(path));
    need(route.startsWith('/') && url.origin === API_ORIGIN && !url.hash && allowed, 'PRIVATE_FILE_CACHE_ROUTE_REFUSED');
    evidence.exercise_requests++;
    const response = await fetcher(url, { method, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { apikey: key, 'User-Agent': agent, ...(actor ? { Authorization: 'Bearer ' + actor.token } : {}),
        ...(body === undefined ? {} : { 'Content-Type': binary ? 'image/png' : 'application/json' }),
        ...(uploadCache === undefined ? {} : { 'cache-control': 'max-age=' + uploadCache, 'x-upsert': 'false' }) },
      ...(body === undefined ? {} : { body: binary ? body : JSON.stringify(body) }) });
    let data = null;
    if (method === 'GET' && binary && response.status === 200) data = Buffer.from(await response.arrayBuffer());
    else { try { data = await response.json(); } catch {} }
    const cache_headers = Object.fromEntries(['cache-control', 'cf-cache-status', 'age', 'vary', 'content-type']
      .map(name => [name, response.headers.get(name)]).filter(([, value]) => typeof value === 'string' && value.length <= 200));
    return { status: response.status, data, cache_headers };
  };
  const safe = result => ({ status: result.status, cache_headers: result.cache_headers,
    ...(Buffer.isBuffer(result.data) ? { bytes: result.data.length, harmless_fixture_matches: digest(result.data) === digest(PNG) } : {}),
    ...(result.data?.error === 'InvalidJWT' && /expired/i.test(result.data.message || '') ? { token_expired_response: true } : {}),
    ...(Number.isInteger(Number(result.data?.statusCode)) ? { Storage_status_code: Number(result.data.statusCode) } : {}) });
  const matches = result => result.status === 200 && Buffer.isBuffer(result.data) && digest(result.data) === digest(PNG);
  const readOriginal = (path, actor, cleanup = false, fresh = false) => request('GET', authPath(path)
    + (fresh ? '?cacheNonce=' + randomUUID() : ''), actor, undefined, { cleanup, binary: true });
  const mint = async (path, seconds) => {
    const result = await request('POST', signPath(path), owner, { expiresIn: seconds });
    const raw = result.data?.signedURL;
    need(result.status === 200 && typeof raw === 'string' && raw.startsWith(signPath(path).slice('/storage/v1'.length) + '?'),
      'EXACT_FIXTURE_SIGNED_URL_REQUIRED');
    const url = new URL('/storage/v1' + raw, API_ORIGIN);
    need(url.origin === API_ORIGIN && url.pathname === signPath(path) && [...url.searchParams.keys()].join() === 'token'
      && url.searchParams.get('token'), 'SIGNED_FIXTURE_URL_SCOPE_REQUIRED');
    let exp;
    try { exp = JSON.parse(Buffer.from(url.searchParams.get('token').split('.')[1], 'base64url').toString('utf8')).exp; } catch {}
    need(Number.isInteger(exp) && exp * 1000 > now() && exp * 1000 < now() + 20000, 'SHORT_SIGNED_EXPIRY_REQUIRED');
    // Tokens and complete URLs stay in memory. Only status/headers and expiry observations enter evidence.
    const route = url.pathname + url.search;
    signed.add(route);
    return { route, expires: exp * 1000 };
  };
  const readSigned = (link, fresh = false) => request('GET', link.route + (fresh ? '&cacheNonce=' + randomUUID() : ''), null,
    undefined, { binary: true });
  let failure, cleanupFailure;
  const fixtures = [];
  try {
    for (const [index, path] of paths.entries()) {
      const control = plan.cache_controls[index];
      attempted.add(path); evidence.cleanup_paths = [...attempted]; evidence.upload_attempts++;
      const uploaded = await request('POST', BUCKET + '/' + path, owner, PNG, { binary: true, uploadCache: control });
      check('UPLOAD_CACHE_' + control + '_ACCEPTED', [200, 201].includes(uploaded.status));
      const original = await readOriginal(path, owner);
      check('OWNER_ORIGINAL_CACHE_' + control + '_MATCHES', matches(original));
      const warm = await mint(path, plan.warm_seconds), cold = await mint(path, plan.cold_seconds);
      need(warm.route !== cold.route, 'DISTINCT_WARM_AND_COLD_SIGNED_KEYS_REQUIRED');
      const before = await readSigned(warm);
      check('WARM_SIGNED_CACHE_' + control + '_MATCHES_BEFORE_EXPIRY', matches(before) && now() < warm.expires);
      fixtures.push({ control, path, warm, cold });
      evidence.observations.push({ requested_upload_cache_control_seconds: control, original_before: safe(original), warm_before: safe(before) });
    }
    check('FOREIGN_ORIGINAL_DENIED', rowsDenied(await readOriginal(paths[0], foreign)));
    check('FOREIGN_SIGNING_DENIED', rowsDenied(await request('POST', signPath(paths[0]), foreign, { expiresIn: plan.warm_seconds })));
    check('ANONYMOUS_ORIGINAL_DENIED', rowsDenied(await readOriginal(paths[0], null)));
    check('ANONYMOUS_SIGNING_DENIED', rowsDenied(await request('POST', signPath(paths[0]), null, { expiresIn: plan.warm_seconds })));
    const expiry = Math.max(...fixtures.flatMap(item => [item.warm.expires, item.cold.expires]));
    while (now() <= expiry + 2000) await pause(Math.min(1000, expiry + 2001 - now()));
    check('ALL_TEST_SIGNED_TOKENS_EXPIRED', fixtures.every(item => now() > item.warm.expires && now() > item.cold.expires));
    for (const [index, item] of fixtures.entries()) {
      const cold = await readSigned(item.cold), warm = await readSigned(item.warm), freshWarm = await readSigned(item.warm, true);
      const retained = await readOriginal(item.path, owner, false, true);
      Object.assign(evidence.observations[index], { cold_after_expiry: safe(cold), warm_after_expiry: safe(warm),
        fresh_warm_after_expiry: safe(freshWarm), owner_original_after_signed_expiry: safe(retained),
        expired_warm_copy_observed: matches(warm), nonce_copy_after_expiry_observed: matches(freshWarm) });
      check('COLD_SIGNED_CACHE_' + item.control + '_DENIED_AFTER_EXPIRY', expiredDenied(cold));
      check('NONCE_WARM_SIGNED_CACHE_' + item.control + '_OUTCOME_RECORDED', expiredDenied(freshWarm) || matches(freshWarm));
      check('WARM_SIGNED_CACHE_' + item.control + '_OUTCOME_RECORDED', expiredDenied(warm) || matches(warm));
      check('OWNER_ORIGINAL_CACHE_' + item.control + '_STILL_EXISTS', matches(retained));
    }
    evidence.expired_signed_warm_copies_observed = evidence.observations.some(item => item.expired_warm_copy_observed);
    evidence.result_scope = 'MEASURED_PROVIDER_CACHE_BEHAVIOR_NOT_IMMEDIATE_REVOCATION_ACCEPTANCE';
  } catch (error) { failure = error; }
  finally {
    if (attempted.size) {
      try {
        const removed = await request('DELETE', BUCKET, owner, { prefixes: [...attempted] }, { cleanup: true });
        check('EXACT_PERSONAL_TEST_OBJECT_DELETE_ACKNOWLEDGED', removed.status === 200 && Array.isArray(removed.data)
          && removed.data.every(row => attempted.has(row.name)));
        const missing = [];
        for (const path of attempted) missing.push(absent(await readOriginal(path, owner, true, true)));
        evidence.Storage_cleanup_verified = missing.every(Boolean);
        check('ALL_ATTEMPTED_PERSONAL_OBJECTS_FRESHLY_ABSENT', evidence.Storage_cleanup_verified);
      } catch (error) { cleanupFailure = error; }
    }
  }
  if (cleanupFailure) throw cleanupFailure;
  if (failure) throw failure;
}
