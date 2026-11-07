import { randomUUID } from 'node:crypto';
import { API_ORIGIN, digest, need, tokenIdentity } from './staging-access.mjs';

const FIXTURE = 'audit-family-proof-policy-20261107';
const CASES = ['X_FAMILY_PROOF_OWNER_MEMBER', 'X_FAMILY_PROOF_PATH_DENIALS', 'X_FAMILY_PROOF_REMOVAL', 'X_FAMILY_PROOF_CLEANUP'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF6sAAAAASUVORK5CYII=', 'base64');
const one = data => Array.isArray(data) && data.length === 1 ? data[0] : data;
const denied = result => [401,403,404].includes(result.status)
  || result.status === 400 && [401,403,404].includes(Number(result.data?.statusCode));
const absent = result => result.status === 404 || result.status === 400 && Number(result.data?.statusCode) === 404;

export function isFamilyProofPlan(plan) {
  return plan.scope === 'family-proof-path-binding' && plan.project === 'dczlddwbtgvfdujgcitb'
    && plan.fixture_name === FIXTURE && UUID.test(plan.family_id || '')
    && JSON.stringify(plan.case_ids) === JSON.stringify(CASES);
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
  const family = plan.family_id, nonce = randomUUID();
  const familyPath = (uploader, suffix, familyId = family, ownerId = owner.id) =>
    `families/${familyId}/${ownerId}/${uploader}/${nonce}-${suffix}.png`;
  const personal = `personal/${owner.id}/${nonce}-personal.png`;
  const attempted = new Set();
  const request = async (method, route, actor, body, cleanup = false, binary = false) => {
    need(evidence.exercise_requests < (cleanup ? 60 : 35), 'FAMILY_PROOF_REQUEST_LIMIT_REQUIRED');
    const url = new URL(route, API_ORIGIN);
    need(route.startsWith('/') && url.origin === API_ORIGIN && !url.hash
      && (url.pathname.startsWith('/storage/v1/object/')
        || method === 'GET' && ['/rest/v1/families','/rest/v1/family_members'].includes(url.pathname)
        || method === 'POST' && ['/rest/v1/rpc/remove_family_member','/rest/v1/rpc/delete_family_workspace'].includes(url.pathname)),
    'FAMILY_PROOF_ROUTE_REFUSED');
    evidence.exercise_requests++;
    const response = await fetcher(url, { method, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { apikey: key, 'User-Agent': agent, ...(actor ? { Authorization: 'Bearer ' + actor.token } : {}),
        ...(body === undefined ? {} : { 'Content-Type': binary ? 'image/png' : 'application/json' }), ...(binary ? { 'x-upsert': 'false' } : {}) },
      ...(body === undefined ? {} : { body: binary ? body : JSON.stringify(body) }) });
    let data = null;
    if (method === 'GET' && binary && response.status === 200) data = Buffer.from(await response.arrayBuffer());
    else { try { data = await response.json(); } catch {} }
    return { status: response.status, data };
  };
  const familyRoute = `/rest/v1/families?select=id,owner_id,name&id=eq.${family}&name=eq.${FIXTURE}&limit=2`;
  const read = (path, actor, cleanup = false) => request('GET', '/storage/v1/object/authenticated/payment-proofs/' + path, actor, undefined, cleanup, true);
  const upload = async (path, actor) => {
    attempted.add(path); evidence.cleanup_paths = [...attempted]; evidence.upload_attempts++;
    return request('POST', '/storage/v1/object/payment-proofs/' + path, actor, PNG, false, true);
  };
  let fixtureBound = false, failure, cleanupFailure;
  try {
    const current = await request('GET', familyRoute, owner), row = one(current.data);
    check('EXACT_EMPTY_SYNTHETIC_FAMILY_BOUND', current.status === 200 && row?.id === family && row.owner_id === owner.id && row.name === FIXTURE);
    fixtureBound = true;
    const membership = await request('GET', `/rest/v1/family_members?select=id,user_id,status&family_id=eq.${family}&user_id=eq.${member.id}&limit=2`, owner);
    const memberRow = one(membership.data);
    check('EXACT_ACTIVE_TEST_MEMBER', membership.status === 200 && UUID.test(memberRow?.id || '') && memberRow.user_id === member.id && memberRow.status === 'active');
    const ownerPath = familyPath(owner.id,'owner'), memberPath = familyPath(member.id,'member');
    check('OWNER_FAMILY_UPLOAD_ALLOWED', [200,201].includes((await upload(ownerPath,owner)).status));
    check('ACTIVE_MEMBER_FAMILY_UPLOAD_ALLOWED', [200,201].includes((await upload(memberPath,member)).status));
    check('OWN_PERSONAL_UPLOAD_REMAINS_ALLOWED', [200,201].includes((await upload(personal,owner)).status));
    const ownerFile = await read(ownerPath,owner), memberFile = await read(memberPath,member);
    check('UPLOADED_BYTES_MATCH', [ownerFile,memberFile].every(file => file.status === 200 && digest(file.data) === digest(PNG)));
    check('FOREIGN_UPLOADER_PATH_DENIED', denied(await upload(familyPath(member.id,'spoof-uploader'),owner)));
    check('WRONG_FAMILY_OWNER_PATH_DENIED', denied(await upload(familyPath(member.id,'spoof-owner',family,member.id),member)));
    check('NONEXISTENT_FAMILY_PATH_DENIED', denied(await upload(familyPath(owner.id,'absent-family','00000000-0000-4000-8000-000000000000'),owner)));
    check('ANONYMOUS_UPLOAD_DENIED', denied(await upload(familyPath(owner.id,'anonymous'),null)));
    const removed = await request('POST','/rest/v1/rpc/remove_family_member',owner,{ p_family_id: family, p_member_id: memberRow.id });
    check('OWNER_REMOVED_EXACT_TEST_MEMBER', removed.status === 200 && removed.data === 'removed');
    check('REMOVED_MEMBER_UPLOAD_DENIED', denied(await upload(familyPath(member.id,'removed'),member)));
    check('REMOVED_MEMBER_ORIGINAL_READ_DENIED', denied(await read(memberPath,member)));
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
