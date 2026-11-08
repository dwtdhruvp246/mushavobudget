import { randomUUID } from 'node:crypto';
import { API_ORIGIN, digest, need, tokenIdentity } from './staging-access.mjs';

const FIXTURE = 'audit-family-proof-policy-20261107';
const BROKER_FIXTURE = 'audit-family-private-broker-20261108';
const CASES = ['X_FAMILY_PROOF_OWNER_MEMBER', 'X_FAMILY_PROOF_PATH_DENIALS', 'X_FAMILY_PROOF_REMOVAL', 'X_FAMILY_PROOF_CLEANUP'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF6sAAAAASUVORK5CYII=', 'base64');
const one = data => Array.isArray(data) && data.length === 1 ? data[0] : data;
const denied = result => [401,403,404].includes(result.status)
  || result.status === 400 && [401,403,404].includes(Number(result.data?.statusCode));
const absent = result => result.status === 404 || result.status === 400 && Number(result.data?.statusCode) === 404;

export function isFamilyProofPlan(plan) {
  const original = JSON.stringify(plan.case_ids) === JSON.stringify(CASES) && plan.revocation_mode === undefined;
  const observed = plan.revocation_mode === 'ORIGIN_DENIAL_WITH_CACHED_COPY_OBSERVATION'
    && JSON.stringify(plan.case_ids) === JSON.stringify([...CASES, 'X_FAMILY_PROOF_CDN_OBSERVATION']);
  const broker = plan.revocation_mode === 'BROKER_CURRENT_ACCESS_NO_STORE'
    && JSON.stringify(plan.case_ids) === JSON.stringify([...CASES, 'X_FAMILY_PROOF_BROKER_NO_STORE_AND_RAW_DENIAL']);
  return plan.scope === 'family-proof-path-binding' && plan.project === 'dczlddwbtgvfdujgcitb'
    && plan.fixture_name === (broker ? BROKER_FIXTURE : FIXTURE) && UUID.test(plan.family_id || '')
    && (original || observed || broker);
}

export async function checkFamilyProof({ actors, evidence }, key, agent, plan, fetcher = fetch) {
  need(isFamilyProofPlan(plan), 'REVIEWED_FAMILY_PROOF_PLAN_REQUIRED');
  const owner = actors.USER_A, member = actors.USER_B, admin = actors.ADMIN;
  const selected = [owner,member,admin];
  need(Object.keys(actors).length === 3 && new Set(selected.map(actor => actor?.id)).size === 3
    && selected.every(actor => UUID.test(actor?.id || '') && tokenIdentity(actor.token)?.userId === actor.id), 'BOUND_FAMILY_PROOF_ACTORS_REQUIRED');
  Object.assign(evidence, { checks: {}, exercise_requests: 0, upload_attempts: 0,
    cleanup_paths: [], Storage_cleanup_verified: false, synthetic_family_removed: false,
    email_requests: 0, provider_requests: 0, finance_writes: 0 });
  const check = (name, passed) => { evidence.checks[name] = passed === true; need(passed === true, name + '_REQUIRED'); };
  const broker = plan.revocation_mode === 'BROKER_CURRENT_ACCESS_NO_STORE';
  const fixtureName = broker ? BROKER_FIXTURE : FIXTURE;
  const family = plan.family_id, nonce = randomUUID();
  const familyPath = (uploader, suffix, familyId = family, ownerId = owner.id) =>
    `families/${familyId}/${ownerId}/${uploader}/${nonce}-${suffix}.png`;
  const personal = `personal/${owner.id}/${nonce}-personal.png`;
  const attempted = new Set();
  const request = async (method, route, actor, body, cleanup = false, binary = false) => {
    need(evidence.exercise_requests < (cleanup ? 60 : 35), 'FAMILY_PROOF_REQUEST_LIMIT_REQUIRED');
    const url = new URL(route, API_ORIGIN);
    const brokerRead = broker && method === 'POST' && url.pathname === '/functions/v1/get-private-file'
      && body?.bucket === 'payment-proofs' && attempted.has(body.path) && Object.keys(body).sort().join() === 'bucket,path';
    const uploadBody = binary && method === 'POST' && url.pathname.startsWith('/storage/v1/object/payment-proofs/');
    need(route.startsWith('/') && url.origin === API_ORIGIN && !url.hash
      && (brokerRead || url.pathname.startsWith('/storage/v1/object/')
        || method === 'GET' && ['/rest/v1/families','/rest/v1/family_members'].includes(url.pathname)
        || method === 'POST' && ['/rest/v1/rpc/remove_family_member','/rest/v1/rpc/delete_family_workspace',
          '/rest/v1/rpc/is_active_family_participant','/rest/v1/rpc/app_session_status'].includes(url.pathname)),
    'FAMILY_PROOF_ROUTE_REFUSED');
    evidence.exercise_requests++;
    const response = await fetcher(url, { method, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { apikey: key, 'User-Agent': agent, ...(actor ? { Authorization: 'Bearer ' + actor.token } : {}),
        ...(body === undefined ? {} : { 'Content-Type': uploadBody ? 'image/png' : 'application/json' }), ...(uploadBody ? { 'x-upsert': 'false' } : {}) },
      ...(body === undefined ? {} : { body: uploadBody ? body : JSON.stringify(body) }) });
    let data = null;
    if ((method === 'GET' || brokerRead) && binary && response.status === 200) data = Buffer.from(await response.arrayBuffer());
    else { try { data = await response.json(); } catch {} }
    const cache_headers = Object.fromEntries(['cache-control','cf-cache-status','age','vary','content-type']
      .map(name => [name, response.headers.get(name)]).filter(([,value]) => typeof value === 'string' && value.length <= 200));
    return { status: response.status, data, cache_headers };
  };
  const familyRoute = `/rest/v1/families?select=id,owner_id,name&id=eq.${family}&name=eq.${fixtureName}&limit=2`;
  const read = (path, actor, cleanup = false, fresh = false) => broker
    ? request('POST', '/functions/v1/get-private-file', actor, { bucket: 'payment-proofs', path }, cleanup, true)
    : request('GET', '/storage/v1/object/authenticated/payment-proofs/' + path
    + (fresh ? '?cacheNonce=' + randomUUID() : ''), actor, undefined, cleanup, true);
  const safeResponse = result => ({ status: result.status, cache_headers: result.cache_headers,
    ...(result.data?.statusCode && /^[0-9]{3}$/.test(String(result.data.statusCode)) ? { Storage_status_code: Number(result.data.statusCode) } : {}),
    ...(Buffer.isBuffer(result.data) ? { bytes: result.data.length, harmless_fixture_matches: digest(result.data) === digest(PNG) } : {}) });
  const upload = async (path, actor) => {
    attempted.add(path); evidence.cleanup_paths = [...attempted]; evidence.upload_attempts++;
    return request('POST', '/storage/v1/object/payment-proofs/' + path, actor, PNG, false, true);
  };
  let fixtureBound = false, failure, cleanupFailure;
  try {
    const current = await request('GET', familyRoute, owner), row = one(current.data);
    check('EXACT_EMPTY_SYNTHETIC_FAMILY_BOUND', current.status === 200 && row?.id === family && row.owner_id === owner.id && row.name === fixtureName);
    fixtureBound = true;
    const membership = await request('GET', `/rest/v1/family_members?select=id,user_id,status&family_id=eq.${family}&user_id=eq.${member.id}&limit=2`, owner);
    const memberRow = one(membership.data);
    check('EXACT_ACTIVE_TEST_MEMBER', membership.status === 200 && UUID.test(memberRow?.id || '') && memberRow.user_id === member.id && memberRow.status === 'active');
    const ownerPath = familyPath(owner.id,'owner'), memberPath = familyPath(member.id,'member');
    check('OWNER_FAMILY_UPLOAD_ALLOWED', [200,201].includes((await upload(ownerPath,owner)).status));
    check('ACTIVE_MEMBER_FAMILY_UPLOAD_ALLOWED', [200,201].includes((await upload(memberPath,member)).status));
    check('OWN_PERSONAL_UPLOAD_REMAINS_ALLOWED', [200,201].includes((await upload(personal,owner)).status));
    const ownerFile = await read(ownerPath,owner), memberFile = await read(memberPath,member);
    evidence.active_member_read_response = safeResponse(memberFile);
    if (broker) {
      check('ACTIVE_BROKER_RESPONSE_NO_STORE', /private, no-store/.test(memberFile.cache_headers['cache-control'] || ''));
      const raw = await request('GET','/storage/v1/object/authenticated/payment-proofs/'+memberPath,owner,undefined,false,true);
      check('CURRENT_OWNER_RAW_BYTES_BLOCKED',denied(raw));
      const sign = await request('POST','/storage/v1/object/sign/payment-proofs/'+memberPath,owner,{expiresIn:60});
      check('CURRENT_OWNER_SIGNING_BLOCKED',denied(sign));
    }
    check('UPLOADED_BYTES_MATCH', [ownerFile,memberFile].every(file => file.status === 200 && digest(file.data) === digest(PNG)));
    check('FOREIGN_UPLOADER_PATH_DENIED', denied(await upload(familyPath(member.id,'spoof-uploader'),owner)));
    check('WRONG_FAMILY_OWNER_PATH_DENIED', denied(await upload(familyPath(member.id,'spoof-owner',family,member.id),member)));
    check('NONEXISTENT_FAMILY_PATH_DENIED', denied(await upload(familyPath(owner.id,'absent-family','00000000-0000-4000-8000-000000000000'),owner)));
    check('ANONYMOUS_UPLOAD_DENIED', denied(await upload(familyPath(owner.id,'anonymous'),null)));
    const removed = await request('POST','/rest/v1/rpc/remove_family_member',owner,{ p_family_id: family, p_member_id: memberRow.id });
    check('OWNER_REMOVED_EXACT_TEST_MEMBER', removed.status === 200 && removed.data === 'removed');
    check('REMOVED_MEMBER_UPLOAD_DENIED', denied(await upload(familyPath(member.id,'removed'),member)));
    const removedRead = await read(memberPath,member);
    evidence.removed_member_original_read_response = safeResponse(removedRead);
    if (broker) {
      check('WARM_IDENTICAL_BROKER_REQUEST_DENIED',removedRead.status === 404 && /private, no-store/.test(removedRead.cache_headers['cache-control'] || ''));
      const session = await request('POST','/rest/v1/rpc/app_session_status',member,{});
      check('REMOVED_MEMBER_SAME_ORDINARY_SESSION_VALID',session.status === 200 && session.data?.session_valid === true && session.data.admin_authorized === false);
      const access = await request('POST','/rest/v1/rpc/is_active_family_participant',member,{p_family_id:family});
      check('AUTHORITATIVE_MEMBERSHIP_FALSE',access.status === 200 && access.data === false);
      evidence.broker_revocation_verified = true;
    }
    if (plan.revocation_mode === 'ORIGIN_DENIAL_WITH_CACHED_COPY_OBSERVATION') {
      const liveSession = await request('POST','/rest/v1/rpc/app_session_status',member,{});
      check('REMOVED_MEMBER_ORDINARY_SESSION_VALID', liveSession.status === 200 && liveSession.data?.session_valid === true
        && liveSession.data.admin_authorized === false);
      const access = await request('POST','/rest/v1/rpc/is_active_family_participant',member,{ p_family_id: family });
      check('AUTHORITATIVE_FAMILY_PARTICIPATION_REVOKED', access.status === 200 && access.data === false);
      const freshRead = await read(memberPath,member,false,true);
      evidence.removed_member_fresh_read_response = safeResponse(freshRead);
      check('REMOVED_MEMBER_FRESH_ORIGIN_READ_DENIED', denied(freshRead));
      evidence.warm_cached_read_observed = removedRead.status === 200 && Buffer.isBuffer(removedRead.data)
        && digest(removedRead.data) === digest(PNG);
      check('WARM_URL_OUTCOME_RECORDED', denied(removedRead) || evidence.warm_cached_read_observed);
      evidence.cached_copy_revocation_immediate = denied(removedRead);
      evidence.cached_read_behavior_requires_file_delivery_followup = evidence.warm_cached_read_observed;
    } else {
      check('REMOVED_MEMBER_ORIGINAL_READ_DENIED', denied(removedRead));
    }
    const sign = await request('POST','/storage/v1/object/sign/payment-proofs/'+memberPath,member,{ expiresIn: 60 });
    check('REMOVED_MEMBER_SIGNING_DENIED', denied(sign));
    const retained = await read(memberPath,owner);
    check('FAMILY_OWNER_RETAINS_MEMBER_FILE_ACCESS', retained.status === 200 && digest(retained.data) === digest(PNG));
  } catch (error) { failure = error; }
  finally {
    if (fixtureBound) {
      try {
        if (attempted.size) {
          const removed = await request('DELETE','/storage/v1/object/payment-proofs',admin,{ prefixes: [...attempted] },true);
          check('EXACT_STORAGE_API_REMOVAL_ACKNOWLEDGED', removed.status === 200 && Array.isArray(removed.data)
            && removed.data.every(item => attempted.has(item.name)));
          const missing = [];
          for (const path of attempted) missing.push(absent(await read(path,admin,true)));
          check('ALL_ATTEMPTED_TEST_OBJECTS_INDEPENDENTLY_ABSENT', missing.every(Boolean));
        }
        evidence.Storage_cleanup_verified = true;
      } catch (error) { cleanupFailure = error; }
      if (evidence.Storage_cleanup_verified) {
        try {
          const removed = await request('POST','/rest/v1/rpc/delete_family_workspace',owner,{ p_family_id: family },true);
          check('OWNER_DELETED_EMPTY_SYNTHETIC_FAMILY', removed.status === 200 && removed.data === 'deleted');
          const absentFamily = await request('GET',familyRoute,owner,undefined,true);
          evidence.synthetic_family_removed = absentFamily.status === 200 && Array.isArray(absentFamily.data) && absentFamily.data.length === 0;
          check('SYNTHETIC_FAMILY_ABSENT_READBACK', evidence.synthetic_family_removed);
        } catch (error) { cleanupFailure ??= error; }
      }
    }
  }
  if (cleanupFailure) throw cleanupFailure;
  if (failure) throw failure;
}
