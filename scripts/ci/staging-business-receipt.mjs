import { randomUUID } from 'node:crypto';
import { API_ORIGIN, Stop, digest, need, tokenIdentity } from './staging-access.mjs';

const FIXTURE_NAME = /^audit-batch-x-receipt-[a-f0-9]{12}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BUCKET = 'business-documents';
const FILE_NAME = 'synthetic-audit-receipt.png';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF6sAAAAASUVORK5CYII=', 'base64');

export function isBusinessReceiptPlan(plan) {
  return plan.scope === 'business-receipt-authorization'
    && JSON.stringify(plan.case_ids) === '["X_RECEIPT","X_PRIVATE_STORAGE","Y_REQUEST_RACE"]'
    && typeof plan.fixture_name === 'string' && FIXTURE_NAME.test(plan.fixture_name);
}

function single(value) {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

function storageDenied(response) {
  return [401, 403, 404].includes(response.status)
    || response.status === 400 && [401, 403, 404].includes(Number(response.data?.statusCode));
}

function receiptTransport(key, agent, evidence, fetcher, limit) {
  evidence.exercise_requests = 0;
  return async (method, route, actor, body, readFile = false) => {
    const url = new URL(route, API_ORIGIN);
    need(route.startsWith('/') && url.origin === API_ORIGIN && !url.hash
      && evidence.exercise_requests < limit, 'RECEIPT_REQUEST_BOUNDARY_REQUIRED');
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
    if (response.status >= 400) {
      evidence.last_refusal = { status: response.status };
      if (typeof data?.message === 'string' && /^[A-Z][A-Z0-9_]{2,79}$/.test(data.message)) {
        evidence.last_refusal.application_code = data.message;
      }
    }
    return { status: response.status, data };
  };
}

function hasBoundSession(actor) {
  return UUID.test(actor?.id || '') && tokenIdentity(actor.token)?.userId === actor.id;
}

export async function manageReceiptFixture({ actors, evidence }, key, agent, plan, action, fetcher = fetch) {
  need(isBusinessReceiptPlan(plan) && ['provision', 'suspend'].includes(action), 'EXACT_FIXTURE_ACTION_REQUIRED');
  const { USER_A: owner, ADMIN: admin } = actors;
  need(Object.keys(actors).length === 2 && owner?.id !== admin?.id
    && [owner, admin].every(hasBoundSession), 'BOUND_FIXTURE_OWNER_AND_ADMIN_REQUIRED');
  const request = receiptTransport(key, agent, evidence, fetcher, 12);
  const fixtureRoute = '/rest/v1/budget_workspaces?select=id,owner_id,workspace_type,status,business_support_version'
    + '&name=eq.' + plan.fixture_name + '&limit=2';
  const existing = await request('GET', fixtureRoute, admin);
  need(existing.status === 200 && Array.isArray(existing.data), 'FIXTURE_NAME_LOOKUP_REQUIRED');
  const setStatus = async (row, status) => {
    const updated = await request('POST', '/rest/v1/rpc/admin_business_set_status', admin, {
      p_workspace_id: row.id, p_status: status, p_expected_version: row.business_support_version,
      p_confirmation_name: plan.fixture_name, p_reason: 'Isolate or resume the exact synthetic staging test workspace',
      p_request_id: randomUUID()
    });
    need(updated.status === 200 && UUID.test(updated.data || ''), 'FIXTURE_STATUS_ACKNOWLEDGEMENT_REQUIRED');
    const proof = await request('GET', fixtureRoute, admin);
    const current = single(proof.data);
    need(proof.status === 200 && current?.id === row.id && current.owner_id === owner.id
      && current.status === status, 'FIXTURE_STATUS_READBACK_REQUIRED');
  };
  const subscription = async row => {
    const result = await request('GET', '/rest/v1/workspace_subscriptions?select=member_limit,version,status'
      + '&workspace_id=eq.' + row.id + '&limit=2', admin);
    const current = single(result.data);
    need(result.status === 200 && current?.status === 'active'
      && Number.isInteger(current.version) && Number.isInteger(current.member_limit), 'EXACT_FIXTURE_SUBSCRIPTION_REQUIRED');
    return current;
  };
  const setSeats = async (row, current, seats) => {
    const updated = await request('POST', '/rest/v1/rpc/admin_set_business_seats', admin, {
      p_workspace_id: row.id, p_total_seats: seats, p_expected_version: current.version,
      p_confirmation_name: plan.fixture_name, p_reason: 'Scoped synthetic staging test seat adjustment'
    });
    need(updated.status === 200 && updated.data === seats, 'FIXTURE_SEAT_CHANGE_ACKNOWLEDGEMENT_REQUIRED');
    need((await subscription(row)).member_limit === seats, 'FIXTURE_SEAT_READBACK_REQUIRED');
  };
  if (action === 'provision' && plan.resume_fixture === true) {
    const row = single(existing.data);
    need(UUID.test(row?.id || '') && row.owner_id === owner.id && row.workspace_type === 'business'
      && row.status === 'suspended' && row.business_support_version === 2, 'REVIEWED_SUSPENDED_FIXTURE_REQUIRED');
    const grant = await request('GET', '/rest/v1/admin_subscription_grants?select=owner_id,grant_kind,reason'
      + '&workspace_id=eq.' + row.id + '&limit=2', admin);
    const binding = single(grant.data);
    need(grant.status === 200 && binding?.owner_id === owner.id && binding.grant_kind === 'business_test'
      && binding.reason === 'Generated staging receipt and spending request replay test', 'EXACT_ORIGINAL_TEST_GRANT_REQUIRED');
    const current = await subscription(row);
    need(current.version === 1 && current.member_limit === 1, 'REVIEWED_ORIGINAL_ONE_SEAT_FIXTURE_REQUIRED');
    try {
      await setStatus(row, 'active');
      await setSeats(row, current, 2);
    } catch (error) {
      const observed = await request('GET', fixtureRoute, admin);
      const active = single(observed.data);
      if (observed.status === 200 && active?.id === row.id && active.owner_id === owner.id
        && active.status === 'active' && active.business_support_version === 3) {
        await setStatus(active, 'suspended');
        evidence.failed_resume_suspended = true;
      }
      throw error;
    }
    evidence.disposable_workspace_restored = true;
    evidence.test_seat_limit = 2;
    return;
  }
  if (action === 'provision') {
    const owned = await request('GET', '/rest/v1/budget_workspaces?select=id&workspace_type=eq.business'
      + '&owner_id=eq.' + owner.id + '&limit=2', owner);
    need(existing.data.length === 0 && owned.status === 200 && Array.isArray(owned.data) && owned.data.length === 0,
      'NEW_DISPOSABLE_WORKSPACE_REQUIRED');
    const plans = await request('GET', '/rest/v1/plans?select=id,code,workspace_type,is_active'
      + '&code=eq.business&workspace_type=eq.business&is_active=eq.true&limit=2', admin);
    const businessPlan = single(plans.data);
    need(plans.status === 200 && UUID.test(businessPlan?.id || '') && businessPlan.code === 'business'
      && businessPlan.workspace_type === 'business' && businessPlan.is_active === true, 'EXACT_BUSINESS_PLAN_REQUIRED');
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 86400000);
    const grant = await request('POST', '/rest/v1/rpc/admin_grant_manual_subscription', admin, {
      p_owner_id: owner.id, p_workspace_id: null, p_plan_id: businessPlan.id, p_billing_period: 'monthly',
      p_starts_on: today.toISOString().slice(0, 10), p_ends_on: tomorrow.toISOString().slice(0, 10),
      p_reason: 'Generated staging receipt and spending request replay test',
      p_new_business_name: plan.fixture_name
    });
    const workspace = grant.data;
    need(grant.status === 200 && UUID.test(workspace || ''), 'BUSINESS_TEST_GRANT_ACKNOWLEDGEMENT_REQUIRED');
    const proof = await request('GET', fixtureRoute, admin);
    const row = single(proof.data);
    need(proof.status === 200 && row?.id === workspace && row.owner_id === owner.id
      && row.status === 'active' && row.workspace_type === 'business', 'BUSINESS_TEST_GRANT_READBACK_REQUIRED');
    evidence.disposable_workspace_provisioned = true;
    return;
  }

  const row = single(existing.data);
  need(UUID.test(row?.id || '') && row.owner_id === owner.id && row.workspace_type === 'business'
    && row.status === 'active' && Number.isInteger(row.business_support_version), 'EXACT_ACTIVE_FIXTURE_REQUIRED');
  if (plan.resume_fixture === true) {
    const scoped = '&workspace_id=eq.' + row.id + '&limit=3';
    const members = await request('GET', '/rest/v1/workspace_members?select=user_id&status=eq.active' + scoped, owner);
    const invitations = await request('GET', '/rest/v1/workspace_invitations?select=id&status=eq.pending' + scoped, owner);
    if (members.status === 200 && members.data?.length === 1 && members.data[0]?.user_id === owner.id
      && invitations.status === 200 && invitations.data?.length === 0) {
      await setSeats(row, await subscription(row), 1);
      evidence.original_one_seat_restored = true;
    }
  }
  await setStatus(row, 'suspended');
  evidence.disposable_workspace_suspended_with_audit_history = true;
}

export async function checkBusinessReceipt({ accounts, actors, evidence }, key, agent, plan, fetcher = fetch) {
  need(isBusinessReceiptPlan(plan), 'REVIEWED_RECEIPT_PLAN_REQUIRED');
  const { USER_A: owner, USER_B: staff } = actors;
  need(Object.keys(actors).length === 2 && owner?.id !== staff?.id && [owner, staff].every(hasBoundSession),
    'TWO_ORDINARY_SESSIONS_REQUIRED');
  Object.assign(evidence, { checks: {}, upload_attempted: false,
    storage_delete_acknowledged: false, email_requests: 0, provider_payments: 0 });
  const confirm = (name, passed) => {
    evidence.checks[name] = Boolean(passed);
    need(passed, name);
  };
  const request = receiptTransport(key, agent, evidence, fetcher, 40);
  const rpc = (name, actor, body) => request('POST', '/rest/v1/rpc/' + name, actor, body);
  const workspaces = await request('GET', '/rest/v1/budget_workspaces?select=id,owner_id,workspace_type,status'
    + '&name=eq.' + plan.fixture_name + '&limit=2', owner);
  const fixture = single(workspaces.data);
  confirm('EXACT_NEW_BUSINESS_WORKSPACE', workspaces.status === 200 && UUID.test(fixture?.id || '')
    && fixture.owner_id === owner.id && fixture.workspace_type === 'business' && fixture.status === 'active');
  const workspace = fixture.id;
  const scoped = '&workspace_id=eq.' + workspace + '&limit=2';
  if (plan.cleanup_fixture === true) {
    // Archived rows are intentionally absent from the ordinary document read
    // policy. The exact target was independently verified in a read-only SQL
    // readback before this pinned, single-object cleanup plan was committed.
    const reviewed = plan.archived_receipt_readback;
    const parts = typeof reviewed?.storage_path === 'string' ? reviewed.storage_path.split('/') : [];
    confirm('EXACT_INDEPENDENT_ARCHIVE_READBACK_BOUND', reviewed?.project === 'dczlddwbtgvfdujgcitb'
      && reviewed.status === 'archived' && reviewed.size_bytes === PNG.length
      && reviewed.verified_on === '2026-11-07'
      && parts.length === 5 && parts[0] === 'workspaces' && parts[1] === workspace
      && parts[2] === staff.id && UUID.test(parts[3]) && parts[4] === FILE_NAME);
    evidence.independent_archive_readback_bound = true;
    const removed = await request('DELETE', '/storage/v1/object/' + BUCKET + '/' + reviewed.storage_path, owner);
    evidence.storage_delete_http_status = removed.status;
    evidence.storage_delete_acknowledged = removed.status === 204
      || removed.status === 200 && removed.data?.message === 'Successfully deleted';
    need(evidence.storage_delete_acknowledged, 'SINGLE_OBJECT_STORAGE_DELETE_REVIEW_REQUIRED');
    return;
  }
  const documents = await request('GET', '/rest/v1/business_documents?select=id&workspace_id=eq.' + workspace + '&limit=2', owner);
  const claims = await request('GET', '/rest/v1/business_expense_claims?select=id&workspace_id=eq.' + workspace + '&limit=2', owner);
  confirm('WORKSPACE_RECEIPTS_AND_CLAIMS_EMPTY', [documents, claims]
    .every(result => result.status === 200 && Array.isArray(result.data) && result.data.length === 0));
  const categories = plan.resume_fixture === true
    ? await request('GET', '/rest/v1/business_categories?select=id&status=eq.active&name=eq.Synthetic%20audit%20expense' + scoped, owner)
    : await rpc('save_business_category', owner, {
    p_workspace_id: workspace, p_category_id: null, p_category_type: 'expense', p_name: 'Synthetic audit expense',
    p_code: '', p_description: '', p_colour: '', p_status: 'active', p_expected_version: null
  });
  const dimensions = plan.resume_fixture === true
    ? await request('GET', '/rest/v1/business_dimensions?select=id&status=eq.active&name=eq.Synthetic%20audit%20team' + scoped, owner)
    : await rpc('save_business_dimension', owner, {
    p_workspace_id: workspace, p_dimension_id: null, p_dimension_type: 'team', p_name: 'Synthetic audit team',
    p_code: '', p_description: '', p_parent_id: null, p_status: 'active', p_expected_version: null
  });
  const category = single(categories.data)?.id;
  const dimension = single(dimensions.data)?.id;
  confirm('EXACT_FIXTURE_CATEGORY_AND_DIMENSION', categories.status === 200 && dimensions.status === 200
    && UUID.test(category || '') && UUID.test(dimension || ''));
  const invite = await rpc('create_business_invitation', owner, {
    p_workspace_id: workspace, p_email: accounts.USER_B.email, p_role: 'staff', p_scope_ids: [dimension]
  });
  confirm('DATABASE_ONLY_INVITATION_BOUND_TO_TEST_STAFF', invite.status === 200
    && UUID.test(invite.data?.invitation_id || '') && invite.data?.invitee_user_id === staff.id);
  const accepted = await rpc('respond_business_invitation', staff, { p_invitation_id: invite.data.invitation_id, p_accept: true });
  confirm('EXACT_TEST_STAFF_INVITATION_ACCEPTED', accepted.status === 200 && accepted.data === workspace);
  const members = await request('GET', '/rest/v1/workspace_members?select=id,user_id,role,status'
    + '&user_id=eq.' + staff.id + scoped, owner);
  const staffMembership = single(members.data);
  confirm('EXACT_ACTIVE_STAFF_MEMBERSHIP', members.status === 200 && UUID.test(staffMembership?.id || '')
    && staffMembership.user_id === staff.id && staffMembership.role === 'staff' && staffMembership.status === 'active');

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
    const requestId = randomUUID();
    const requestDraft = { p_workspace_id: workspace, p_request_id: requestId, p_expected_version: null,
      p_title: 'Synthetic replay request', p_description: 'Generated concurrency fixture',
      p_category_id: category, p_dimension_id: dimension, p_amount: 1, p_currency: 'USD',
      p_planned_on: new Date().toISOString().slice(0, 10) };
    const concurrent = await Promise.all([
      rpc('save_business_spending_request', staff, requestDraft),
      rpc('save_business_spending_request', staff, requestDraft)
    ]);
    const persisted = await request('GET', '/rest/v1/business_spending_requests?select=id,status,version'
      + '&id=eq.' + requestId + scoped, staff);
    const retained = single(persisted.data);
    confirm('CONCURRENT_SAME_REQUEST_ID_PERSISTS_ONE_DRAFT', concurrent.every(({ status, data }) => {
      const row = single(data);
      return status === 200 && row?.id === requestId && row?.status === 'draft' && row?.version === retained?.version;
    }) && persisted.status === 200 && retained?.id === requestId && retained?.status === 'draft');

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
