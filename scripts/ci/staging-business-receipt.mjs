import { randomUUID } from 'node:crypto';
import { API_ORIGIN, Stop, digest, need, tokenIdentity } from './staging-access.mjs';

const FIXTURE_NAME = /^audit-batch-x-receipt-[a-f0-9]{12}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BUCKET = 'business-documents';
const FILE_NAME = 'synthetic-audit-receipt.png';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF6sAAAAASUVORK5CYII=', 'base64');

export function isBusinessReceiptPlan(plan) {
  return plan.scope === 'business-receipt-authorization'
    && JSON.stringify(plan.case_ids) === '["X_RECEIPT","X_PRIVATE_STORAGE"]'
    && typeof plan.fixture_name === 'string' && FIXTURE_NAME.test(plan.fixture_name);
}

function single(value) {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

function storageDenied(response) {
  return [401, 403, 404].includes(response.status)
    || response.status === 400 && [401, 403, 404].includes(Number(response.data?.statusCode));
}

export async function checkBusinessReceipt({ actors, evidence }, key, agent, plan, fetcher = fetch) {
  need(isBusinessReceiptPlan(plan), 'REVIEWED_RECEIPT_PLAN_REQUIRED');
  const { USER_A: owner, USER_B: staff } = actors;
  need(Object.keys(actors).length === 2 && owner?.id !== staff?.id
    && [owner, staff].every(actor => UUID.test(actor?.id || '')
      && tokenIdentity(actor.token)?.userId === actor.id), 'TWO_ORDINARY_SESSIONS_REQUIRED');
  Object.assign(evidence, { checks: {}, exercise_requests: 0, upload_attempted: false,
    storage_delete_acknowledged: false, email_requests: 0, provider_payments: 0 });
  const confirm = (name, passed) => {
    evidence.checks[name] = Boolean(passed);
    need(passed, name);
  };
  const request = async (method, route, actor, body, readFile = false) => {
    const url = new URL(route, API_ORIGIN);
    need(route.startsWith('/') && url.origin === API_ORIGIN && !url.hash
      && evidence.exercise_requests < 30, 'RECEIPT_REQUEST_BOUNDARY_REQUIRED');
    evidence.exercise_requests++;
    const binary = Buffer.isBuffer(body);
    const response = await fetcher(url, {
      method, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { apikey: key, 'User-Agent': agent, 'Cache-Control': 'no-cache',
        ...(actor ? { Authorization: 'Bearer ' + actor.token } : {}),
        ...(body === undefined ? {} : { 'Content-Type': binary ? 'image/png' : 'application/json' }),
        ...(binary ? { 'x-upsert': 'false' } : {}) },
      ...(body === undefined ? {} : { body: binary ? body : JSON.stringify(body) })
    });
    let data = null;
    if (readFile && response.status === 200) {
      data = Buffer.from(await response.arrayBuffer());
    } else {
      try { data = await response.json(); } catch {}
    }
    return { status: response.status, data };
  };
  const rpc = (name, actor, body) => request('POST', '/rest/v1/rpc/' + name, actor, body);
  const workspaces = await request('GET', '/rest/v1/budget_workspaces?select=id,owner_id,workspace_type,status'
    + '&name=eq.' + plan.fixture_name + '&limit=2', owner);
  const fixture = single(workspaces.data);
  confirm('EXACT_NEW_BUSINESS_WORKSPACE', workspaces.status === 200 && UUID.test(fixture?.id || '')
    && fixture.owner_id === owner.id && fixture.workspace_type === 'business' && fixture.status === 'active');
  const workspace = fixture.id;
  const scoped = '&workspace_id=eq.' + workspace + '&limit=2';
  const members = await request('GET', '/rest/v1/workspace_members?select=id,user_id,role,status'
    + '&user_id=eq.' + staff.id + scoped, owner);
  const staffMembership = single(members.data);
  confirm('EXACT_ACTIVE_STAFF_MEMBERSHIP', members.status === 200 && UUID.test(staffMembership?.id || '')
    && staffMembership.user_id === staff.id && staffMembership.role === 'staff' && staffMembership.status === 'active');
  const categories = await request('GET', '/rest/v1/business_categories?select=id&name=eq.Fixture%20expense' + scoped, owner);
  const dimensions = await request('GET', '/rest/v1/business_dimensions?select=id&name=eq.Fixture%20team' + scoped, owner);
  const category = single(categories.data)?.id;
  const dimension = single(dimensions.data)?.id;
  confirm('EXACT_FIXTURE_CATEGORY_AND_DIMENSION', categories.status === 200 && dimensions.status === 200
    && UUID.test(category || '') && UUID.test(dimension || ''));
  const documents = await request('GET', '/rest/v1/business_documents?select=id&workspace_id=eq.' + workspace + '&limit=2', owner);
  const claims = await request('GET', '/rest/v1/business_expense_claims?select=id&workspace_id=eq.' + workspace + '&limit=2', owner);
  confirm('WORKSPACE_RECEIPTS_AND_CLAIMS_EMPTY', [documents, claims]
    .every(result => result.status === 200 && Array.isArray(result.data) && result.data.length === 0));

  const document = randomUUID();
  const objectPath = ['workspaces', workspace, staff.id, document, FILE_NAME].join('/');
  const objectRoute = '/storage/v1/object/' + BUCKET + '/' + objectPath;
  const signRoute = '/storage/v1/object/sign/' + BUCKET + '/' + objectPath;
  const readRoute = '/storage/v1/object/authenticated/' + BUCKET + '/' + objectPath;
  const sign = actor => request('POST', signRoute, actor, { expiresIn: 60 });
  const claimArgs = { p_workspace_id: workspace };
  let registered = false;
  let currentClaim;
  let failure;
  try {
    const draft = await rpc('create_business_claim', staff, { ...claimArgs,
      p_kind: 'reimbursement', p_title: 'Synthetic Batch X receipt', p_description: 'Generated audit fixture',
      p_category_id: category, p_dimension_id: dimension, p_amount: 1, p_currency: 'USD',
      p_expense_date: new Date().toISOString().slice(0, 10) });
    currentClaim = single(draft.data);
    confirm('STAFF_DRAFT_CREATED', draft.status === 200 && UUID.test(currentClaim?.id || '')
      && currentClaim.submitted_by === staff.id && currentClaim.workspace_id === workspace
      && currentClaim.status === 'draft' && Number.isInteger(currentClaim.version));
    claimArgs.p_claim_id = currentClaim.id;
    claimArgs.p_expected_version = currentClaim.version;
    const receiptMissing = await rpc('submit_business_claim', staff, claimArgs);
    confirm('UNATTACHED_SUBMISSION_DENIED', receiptMissing.status === 400 && receiptMissing.data?.message === 'BUSINESS_RECEIPT_REQUIRED');

    evidence.upload_attempted = true;
    const uploaded = await request('POST', objectRoute, staff, PNG);
    confirm('REAL_STORAGE_UPLOAD', [200, 201].includes(uploaded.status));
    const attach = await rpc('register_business_document', staff, { p_document_id: document,
      p_workspace_id: workspace, p_parent_type: 'expense_claim', p_parent_id: currentClaim.id,
      p_storage_path: objectPath, p_original_name: FILE_NAME, p_mime_type: 'image/png', p_size_bytes: PNG.length });
    const attached = single(attach.data);
    registered = attach.status === 200 && attached?.id === document && attached?.parent_id === currentClaim.id;
    confirm('UPLOADED_RECEIPT_REGISTERED', registered);

    const submitted = await rpc('submit_business_claim', staff, claimArgs);
    currentClaim = single(submitted.data);
    confirm('ATTACHED_CLAIM_SUBMITTED', submitted.status === 200 && currentClaim?.id === claimArgs.p_claim_id
      && currentClaim.status === 'submitted' && currentClaim.version > claimArgs.p_expected_version);
    const original = await request('GET', readRoute, owner, undefined, true);
    confirm('AUTHORIZED_ORIGINAL_MATCHES_UPLOAD', original.status === 200 && digest(original.data) === digest(PNG));
    const signed = await sign(owner);
    const rawLink = signed.data?.signedURL;
    need(signed.status === 200 && typeof rawLink === 'string'
      && rawLink.startsWith(signRoute.slice('/storage/v1'.length) + '?'), 'AUTHORIZED_SIGNED_URL_REQUIRED');
    const link = new URL('/storage/v1' + rawLink, API_ORIGIN);
    need(link.pathname === signRoute && [...link.searchParams.keys()].join() === 'token'
      && Boolean(link.searchParams.get('token')), 'SIGNED_URL_BOUND_TO_FIXTURE_REQUIRED');
    const viaLink = await request('GET', link.pathname + link.search, null, undefined, true);
    confirm('AUTHORIZED_SIGNED_DOWNLOAD_MATCHES_UPLOAD', viaLink.status === 200 && digest(viaLink.data) === digest(PNG));
    confirm('ANONYMOUS_ORIGINAL_AND_SIGNING_DENIED',
      storageDenied(await request('GET', readRoute, null)) && storageDenied(await sign(null)));

    const reviewArgs = { ...claimArgs, p_expected_version: currentClaim.version,
      p_decision: 'changes_requested', p_reason: 'Generated receipt audit review' };
    const reviewed = await rpc('review_business_claim', owner, reviewArgs);
    currentClaim = single(reviewed.data);
    confirm('OWNER_REVIEWED_STAFF_CLAIM', reviewed.status === 200 && currentClaim?.id === claimArgs.p_claim_id
      && currentClaim.status === 'changes_requested' && currentClaim.reviewed_by === owner.id);
    const reviewReplay = await rpc('review_business_claim', owner, reviewArgs);
    const submissionReplay = await rpc('submit_business_claim', staff, claimArgs);
    confirm('STALE_SUBMISSION_AND_REVIEW_REPLAY_DENIED',
      [reviewReplay, submissionReplay].every(result => result.status === 400 && result.data?.message === 'BUSINESS_CLAIM_CHANGED'));
    const removed = await rpc('remove_business_member', owner, { p_workspace_id: workspace, p_member_id: staffMembership.id });
    confirm('SCOPED_STAFF_MEMBERSHIP_REMOVED', removed.status === 200 && removed.data === 'removed');
    const liveSession = await rpc('app_session_status', staff, {});
    confirm('REMOVED_STAFF_SESSION_STILL_VALID', liveSession.status === 200
      && liveSession.data?.session_valid === true && liveSession.data?.admin_authorized === false);
    confirm('REMOVED_STAFF_ORIGINAL_AND_SIGNING_DENIED',
      storageDenied(await request('GET', readRoute, staff)) && storageDenied(await sign(staff)));
  } catch (error) {
    failure = error;
  }

  if (evidence.upload_attempted) {
    try {
      if (registered) {
        const archived = await rpc('archive_business_document', owner, { p_workspace_id: workspace,
          p_document_id: document, p_reason: 'Remove the exact synthetic audit receipt' });
        need(archived.status === 200 && archived.data === objectPath, 'FIXTURE_ARCHIVE_REQUIRED');
      }
      const removed = await request('DELETE', '/storage/v1/object/' + BUCKET, owner, { prefixes: [objectPath] });
      evidence.storage_delete_acknowledged = removed.status === 200 && Array.isArray(removed.data)
        && removed.data.some(item => item?.name === objectPath);
    } catch {
      evidence.storage_delete_acknowledged = false;
    }
  }
  if (failure) throw failure;
  if (!evidence.storage_delete_acknowledged) throw new Stop('EXACT_STORAGE_CLEANUP_READBACK_REQUIRED');
}
