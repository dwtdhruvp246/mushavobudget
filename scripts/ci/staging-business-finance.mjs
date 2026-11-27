import { randomUUID } from 'node:crypto';
import { API_ORIGIN, need, tokenIdentity } from './staging-access.mjs';

const FIXTURE = 'audit-batch-x-receipt-d7be160c2026';
const CASES = ['X_REQUEST_LIFECYCLE', 'X_REQUEST_BILL_LINK', 'X_BILL_PAYMENT_REPLAY', 'X_FINANCE_FIXTURE_ISOLATION'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const one = data => Array.isArray(data) && data.length === 1 ? data[0] : data;
const RPCS = ['admin_business_set_status', 'admin_set_business_seats', 'create_business_invitation',
  'respond_business_invitation', 'cancel_business_invitation', 'remove_business_member', 'save_business_supplier',
  'save_business_spending_request', 'transition_business_request', 'create_business_bill_from_request',
  'record_business_bill_payment_with_source', 'cancel_business_bill', 'app_session_status'];
const TABLES = ['budget_workspaces', 'workspace_subscriptions', 'workspace_members', 'workspace_invitations',
  'business_categories', 'business_dimensions', 'business_spending_requests', 'business_bills', 'business_bill_payments'];

export function isBusinessFinancePlan(plan) {
  return plan.scope === 'business-finance-workflow' && plan.project === 'dczlddwbtgvfdujgcitb'
    && plan.fixture_name === FIXTURE && plan.expected_support_version === 6 && plan.expected_subscription_version === 3
    && JSON.stringify(plan.case_ids) === JSON.stringify(CASES);
}

export async function checkBusinessFinance({ actors, accounts, evidence }, key, agent, plan, fetcher = fetch) {
  need(isBusinessFinancePlan(plan), 'REVIEWED_BUSINESS_FINANCE_PLAN_REQUIRED');
  const owner = actors.USER_A, manager = actors.USER_B, admin = actors.ADMIN;
  const selected = [owner, manager, admin];
  need(Object.keys(actors).length === 3 && new Set(selected.map(actor => actor?.id)).size === 3
    && selected.every(actor => UUID.test(actor?.id || '') && tokenIdentity(actor.token)?.userId === actor.id),
  'BOUND_FINANCE_ACTORS_REQUIRED');
  Object.assign(evidence, { checks: {}, exercise_requests: 0, email_requests: 0, provider_payment_requests: 0,
    Storage_uploads: 0, resume_attempted: false, fixture_suspended_verified: false,
    temporary_member_removed: false, original_seat_limit_restored: false });
  const check = (name, passed) => { evidence.checks[name] = passed === true; need(passed === true, name + '_REQUIRED'); };
  const request = async (method, route, actor, body, cleanup = false) => {
    need(evidence.exercise_requests < (cleanup ? 90 : 65), 'FINANCE_REQUEST_LIMIT_REQUIRED');
    const url = new URL(route, API_ORIGIN), parts = url.pathname.split('/');
    need(route.startsWith('/') && url.origin === API_ORIGIN && !url.hash
      && (method === 'POST' && parts.slice(0,4).join('/') === '/rest/v1/rpc' && RPCS.includes(parts[4])
        || method === 'GET' && parts.slice(0,3).join('/') === '/rest/v1' && TABLES.includes(parts[3])
          && url.searchParams.get('limit') === '3'), 'FINANCE_ROUTE_REFUSED');
    evidence.exercise_requests++;
    const response = await fetcher(url, { method, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { apikey: key, Authorization: 'Bearer ' + actor.token, 'Content-Type': 'application/json', 'User-Agent': agent },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    let data = null;
    try { data = await response.json(); } catch {}
    if (response.status >= 400) {
      evidence.last_refusal = { status: response.status,
        ...(/^[A-Z][A-Z0-9_]{2,79}$/.test(data?.message || '') ? { application_code: data.message } : {}) };
    }
    return { status: response.status, data };
  };
  const rpc = (name, actor, body, cleanup = false) => request('POST', '/rest/v1/rpc/' + name, actor, body, cleanup);
  const get = (table, fields, filters, actor, cleanup = false) => request('GET',
    `/rest/v1/${table}?select=${fields}&${filters}&limit=3`, actor, undefined, cleanup);
  const validRows = result => result.status === 200 && Array.isArray(result.data) && result.data.length < 3;
  const fixture = async (cleanup = false) => {
    const result = await get('budget_workspaces', 'id,owner_id,workspace_type,status,business_support_version', 'name=eq.' + FIXTURE, admin, cleanup);
    const row = one(result.data);
    need(result.status === 200 && UUID.test(row?.id || '') && row.owner_id === owner.id && row.workspace_type === 'business'
      && ['active', 'suspended'].includes(row.status) && Number.isInteger(row.business_support_version), 'EXACT_FINANCE_FIXTURE_REQUIRED');
    return row;
  };
  let workspace, failure, cleanupFailure;
  const scoped = () => 'workspace_id=eq.' + workspace;
  const subscription = async (cleanup = false) => {
    const result = await get('workspace_subscriptions', 'member_limit,version,status,paid_through_at', scoped(), admin, cleanup);
    const row = one(result.data);
    need(result.status === 200 && row?.status === 'active' && Number.isInteger(row.version)
      && [1, 2].includes(row.member_limit), 'EXACT_FINANCE_SUBSCRIPTION_REQUIRED');
    return row;
  };
  const setStatus = async (row, status, cleanup = false) => {
    const result = await rpc('admin_business_set_status', admin, { p_workspace_id: workspace, p_status: status,
      p_expected_version: row.business_support_version, p_confirmation_name: FIXTURE,
      p_reason: 'Bounded synthetic request and bill workflow acceptance', p_request_id: randomUUID() }, cleanup);
    need(result.status === 200 && UUID.test(result.data || ''), 'FINANCE_FIXTURE_STATUS_ACK_REQUIRED');
    const after = await fixture(cleanup);
    need(after.id === workspace && after.status === status, 'FINANCE_FIXTURE_STATUS_READBACK_REQUIRED');
  };
  const setSeats = async (row, seats, cleanup = false) => {
    const result = await rpc('admin_set_business_seats', admin, { p_workspace_id: workspace, p_total_seats: seats,
      p_expected_version: row.version, p_confirmation_name: FIXTURE, p_reason: 'Temporary synthetic finance-manager seat' }, cleanup);
    need(result.status === 200 && result.data === seats && (await subscription(cleanup)).member_limit === seats,
      'FINANCE_FIXTURE_SEATS_READBACK_REQUIRED');
  };
  const members = (cleanup = false) => get('workspace_members', 'id,user_id,role,status', scoped() + '&status=eq.active', owner, cleanup);
  const pending = (cleanup = false) => get('workspace_invitations', 'id,invitee_user_id,status', scoped() + '&status=eq.pending', owner, cleanup);
  const denied = (result, code) => result.status === 400 && result.data?.message === code;
  try {
    const row = await fixture(); workspace = row.id;
    check('ISOLATED_SUSPENDED_FIXTURE_VERSION', row.status === 'suspended' && row.business_support_version === plan.expected_support_version);
    const sub = await subscription();
    check('ORIGINAL_ONE_SEAT_ENTITLEMENT_BOUND', sub.member_limit === 1 && sub.version === plan.expected_subscription_version
      && Date.parse(sub.paid_through_at) > Date.now() + 600000);
    evidence.resume_attempted = true;
    await setStatus(row, 'active');
    const currentMembers = await members(), currentPending = await pending();
    check('EXACT_OWNER_ONLY_PREPARATION', validRows(currentMembers) && currentMembers.data.length === 1
      && currentMembers.data[0].user_id === owner.id && validRows(currentPending) && currentPending.data.length === 0);
    await setSeats(sub, 2);
    const categories = await get('business_categories', 'id,name,status', scoped() + '&name=eq.Synthetic%20audit%20expense&status=eq.active', owner);
    const dimensions = await get('business_dimensions', 'id,name,status', scoped() + '&name=eq.Synthetic%20audit%20team&status=eq.active', owner);
    const category = one(categories.data)?.id, dimension = one(dimensions.data)?.id;
    check('RETAINED_SYNTHETIC_CATEGORY_AND_TEAM', categories.status === 200 && dimensions.status === 200
      && UUID.test(category || '') && UUID.test(dimension || ''));
    const invite = await rpc('create_business_invitation', owner, { p_workspace_id: workspace,
      p_email: accounts.USER_B.email, p_role: 'finance_manager', p_scope_ids: [dimension] });
    check('DATABASE_ONLY_MANAGER_INVITATION_BOUND', invite.status === 200 && UUID.test(invite.data?.invitation_id || '')
      && invite.data.invitee_user_id === manager.id);
    const accepted = await rpc('respond_business_invitation', manager, { p_invitation_id: invite.data.invitation_id, p_accept: true });
    check('EXACT_MANAGER_ACCEPTED', accepted.status === 200 && accepted.data === workspace);
    const activeMembers = await members();
    check('EXACT_FINANCE_MANAGER_MEMBERSHIP', validRows(activeMembers) && activeMembers.data.length === 2
      && activeMembers.data.some(member => member.user_id === manager.id && member.role === 'finance_manager'));
    const supplierResult = await rpc('save_business_supplier', manager, { p_workspace_id: workspace, p_supplier_id: null,
      p_name: 'Synthetic finance audit supplier 20261107', p_email: '', p_notes: 'No external order or actual payment', p_expected_version: null });
    const supplier = one(supplierResult.data);
    check('SYNTHETIC_SUPPLIER_CREATED', supplierResult.status === 200 && UUID.test(supplier?.id || '') && supplier.workspace_id === workspace);
    const requestId = randomUUID(), day = new Date().toISOString().slice(0,10);
    const draft = { p_workspace_id: workspace, p_request_id: requestId, p_expected_version: null,
      p_title: 'Synthetic request bill lifecycle 20261107', p_description: 'Synthetic USD 1 audit ledger; no external payment',
      p_category_id: category, p_dimension_id: dimension, p_amount: 1, p_currency: 'USD', p_planned_on: day };
    const draftResult = await rpc('save_business_spending_request', owner, draft);
    let current = one(draftResult.data);
    check('OWNER_DRAFT_REQUEST_BOUND', draftResult.status === 200 && current?.id === requestId && current.workspace_id === workspace
      && current.submitted_by === owner.id && current.status === 'draft' && current.amount === 1 && Number.isInteger(current.version));
    const replayDraft = one((await rpc('save_business_spending_request', owner, { ...draft, p_title: 'Replay must preserve original', p_amount: 2 })).data);
    check('REQUEST_ID_REPLAY_PRESERVES_ORIGINAL', replayDraft?.id === requestId && replayDraft.amount === 1
      && replayDraft.title === current.title && replayDraft.version === current.version);
    const submit = await rpc('transition_business_request', owner, { p_workspace_id: workspace, p_request_id: requestId,
      p_expected_version: current.version, p_action: 'submit', p_reason: null });
    current = one(submit.data);
    check('REQUEST_SUBMITTED', submit.status === 200 && current?.id === requestId && current.status === 'submitted');
    const review = { p_workspace_id: workspace, p_request_id: requestId, p_expected_version: current.version,
      p_action: 'approved', p_reason: 'Synthetic finance acceptance' };
    check('OWNER_SELF_APPROVAL_FORBIDDEN', denied(await rpc('transition_business_request', owner, review), 'BUSINESS_SELF_APPROVAL_FORBIDDEN'));
    const approval = await rpc('transition_business_request', manager, review); current = one(approval.data);
    check('DISTINCT_MANAGER_APPROVED_REQUEST', approval.status === 200 && current?.id === requestId
      && current.status === 'approved' && current.reviewed_by === manager.id);
    check('STALE_APPROVAL_REPLAY_REJECTED', denied(await rpc('transition_business_request', manager, review), 'BUSINESS_REQUEST_CHANGED'));
    const billArgs = { p_workspace_id: workspace, p_request_id: requestId, p_supplier_id: supplier.id,
      p_reference: 'AUDIT-X-FINANCE-20261107', p_due_on: day, p_remind_days_before: 0 };
    const createdBill = await rpc('create_business_bill_from_request', manager, billArgs);
    const bill = one(createdBill.data);
    check('APPROVED_REQUEST_LINKED_TO_BILL', createdBill.status === 200 && UUID.test(bill?.id || '') && bill.workspace_id === workspace
      && bill.source_request_id === requestId && bill.status === 'open' && bill.amount === 1 && bill.paid_amount === 0
      && bill.currency === 'USD' && bill.reporting_amount === 1 && bill.created_by === manager.id);
    const repeatedBill = one((await rpc('create_business_bill_from_request', manager,
      { ...billArgs, p_reference: 'Replay must preserve original reference' })).data);
    check('BILL_CREATION_REPLAY_RETURNS_SAME_BILL', repeatedBill?.id === bill.id && repeatedBill.reference === bill.reference);
    const readRequest = async () => {
      const result = await get('business_spending_requests', 'id,status,version', scoped() + '&id=eq.' + requestId, owner);
      const value = one(result.data); need(result.status === 200 && value?.id === requestId, 'REQUEST_READBACK_REQUIRED'); return value;
    };
    const readBill = async () => {
      const result = await get('business_bills', 'id,status,amount,paid_amount,version,source_request_id', scoped() + '&id=eq.' + bill.id, owner);
      const value = one(result.data); need(result.status === 200 && value?.id === bill.id, 'BILL_READBACK_REQUIRED'); return value;
    };
    current = await readRequest(); check('REQUEST_COMMITTED_BY_BILL_LINK', current.status === 'committed');
    check('LINKED_REQUEST_CANCELLATION_REJECTED', denied(await rpc('transition_business_request', owner,
      { p_workspace_id: workspace, p_request_id: requestId, p_expected_version: current.version,
        p_action: 'cancel', p_reason: 'Synthetic linked cancellation denial' }), 'BUSINESS_REQUEST_CANNOT_CANCEL'));
    const pay = { p_workspace_id: workspace, p_bill_id: bill.id, p_payment_id: randomUUID(), p_amount: 0.4,
      p_paid_at: new Date().toISOString(), p_reference: 'AUDIT-X-PARTIAL-20261107', p_payment_source: 'bank_transfer' };
    const paid = await rpc('record_business_bill_payment_with_source', manager, pay); const partial = one(paid.data);
    check('PARTIAL_PAYMENT_BOUND', paid.status === 200 && partial?.id === pay.p_payment_id && partial.bill_id === bill.id
      && partial.amount === 0.4 && partial.payment_source === 'bank_transfer' && partial.recorded_by === manager.id);
    const repeatedPayment = one((await rpc('record_business_bill_payment_with_source', manager,
      { ...pay, p_amount: 0.9, p_reference: 'Replay must preserve original', p_payment_source: 'cash' })).data);
    check('PAYMENT_REPLAY_PRESERVES_AMOUNT_SOURCE_REFERENCE', repeatedPayment?.id === partial.id
      && repeatedPayment.amount === partial.amount && repeatedPayment.payment_source === partial.payment_source
      && repeatedPayment.reference === partial.reference);
    const afterPartial = await readBill(); check('PARTIAL_BILL_REMAINS_OPEN', afterPartial.status === 'open' && afterPartial.paid_amount === 0.4);
    check('OVERPAYMENT_REJECTED', denied(await rpc('record_business_bill_payment_with_source', manager,
      { ...pay, p_payment_id: randomUUID(), p_amount: 0.7 }), 'BUSINESS_BILL_PAYMENT_INVALID'));
    const afterDenied = await readBill(); check('OVERPAYMENT_PRESERVED_BILL', JSON.stringify(afterDenied) === JSON.stringify(afterPartial));
    check('PARTIALLY_PAID_BILL_CANCELLATION_REJECTED', denied(await rpc('cancel_business_bill', manager,
      { p_workspace_id: workspace, p_bill_id: bill.id }), 'BUSINESS_BILL_CANNOT_CANCEL'));
    const finalPay = { ...pay, p_payment_id: randomUUID(), p_amount: 0.6,
      p_reference: 'AUDIT-X-FINAL-20261107', p_payment_source: 'cash' };
    const final = await rpc('record_business_bill_payment_with_source', manager, finalPay); const finalRow = one(final.data);
    check('FINAL_PAYMENT_BOUND', final.status === 200 && finalRow?.id === finalPay.p_payment_id && finalRow.amount === 0.6);
    const settled = await readBill(), fulfilled = await readRequest();
    check('BILL_FULLY_PAID', settled.status === 'paid' && settled.paid_amount === 1 && settled.amount === 1);
    check('LINKED_REQUEST_FULFILLED', fulfilled.status === 'fulfilled');
    const finalReplay = one((await rpc('record_business_bill_payment_with_source', manager,
      { ...finalPay, p_amount: 1, p_reference: 'Final replay must preserve original', p_payment_source: 'card' })).data);
    check('PAID_BILL_REPLAY_PRESERVES_ORIGINAL', finalReplay?.id === finalRow.id && finalReplay.amount === 0.6
      && finalReplay.reference === finalRow.reference && finalReplay.payment_source === 'cash');
    check('PAID_BILL_REPLAY_NO_TOTAL_OR_VERSION_CHANGE', JSON.stringify(await readBill()) === JSON.stringify(settled));
    const paymentRows = await get('business_bill_payments', 'id,bill_id,amount,payment_source', scoped() + '&bill_id=eq.' + bill.id, owner);
    const linkedBills = await get('business_bills', 'id,status,source_request_id', scoped() + '&source_request_id=eq.' + requestId, owner);
    check('EXACTLY_TWO_PAYMENTS_AND_ONE_LINKED_BILL', validRows(paymentRows) && paymentRows.data.length === 2
      && paymentRows.data.reduce((sum, value) => sum + value.amount, 0) === 1
      && validRows(linkedBills) && linkedBills.data.length === 1 && linkedBills.data[0].id === bill.id);
    check('FULFILLED_REQUEST_EDIT_REJECTED', denied(await rpc('save_business_spending_request', owner,
      { ...draft, p_expected_version: fulfilled.version }), 'BUSINESS_REQUEST_CHANGED'));
    evidence.synthetic_retained_ledger = { new_requests: 1, linked_bills: 1, bill_payments: 2, payment_total_USD: 1,
      request_status: 'fulfilled', bill_status: 'paid', supplier_rows: 1 };
  } catch (error) { failure = error; }
  finally {
    if (evidence.resume_attempted) {
      try {
        const current = await members(true); need(validRows(current), 'CLEANUP_MEMBER_READ_REQUIRED');
        const active = current.data.filter(member => member.user_id === manager.id);
        need(active.length <= 1 && current.data.every(member => [owner.id, manager.id].includes(member.user_id)), 'EXACT_CLEANUP_MEMBERS_REQUIRED');
        if (active.length) {
          const removed = await rpc('remove_business_member', owner, { p_workspace_id: workspace, p_member_id: active[0].id }, true);
          need(removed.status === 200 && removed.data === 'removed', 'EXACT_MANAGER_REMOVAL_ACK_REQUIRED');
        }
        const invitations = await pending(true); need(validRows(invitations), 'CLEANUP_INVITATION_READ_REQUIRED');
        for (const invitation of invitations.data) {
          need(invitation.invitee_user_id === manager.id, 'EXACT_CLEANUP_INVITATION_REQUIRED');
          const cancelled = await rpc('cancel_business_invitation', owner, { p_invitation_id: invitation.id }, true);
          need(cancelled.status === 200 && cancelled.data === 'cancelled', 'CLEANUP_INVITATION_ACK_REQUIRED');
        }
        const afterMembers = await members(true), afterPending = await pending(true);
        evidence.temporary_member_removed = validRows(afterMembers) && afterMembers.data.length === 1
          && afterMembers.data[0].user_id === owner.id && validRows(afterPending) && afterPending.data.length === 0;
        check('TEMPORARY_MANAGER_AND_PENDING_INVITATIONS_REMOVED', evidence.temporary_member_removed);
        const managerSession = await rpc('app_session_status', manager, {}, true);
        check('REMOVED_MANAGER_ORDINARY_SESSION_VALID', managerSession.status === 200 && managerSession.data?.session_valid === true
          && managerSession.data.admin_authorized === false);
        const deniedRead = await get('business_spending_requests', 'id', scoped(), manager, true);
        check('REMOVED_MANAGER_BUSINESS_ROWS_HIDDEN', validRows(deniedRead) && deniedRead.data.length === 0);
        const sub = await subscription(true); if (sub.member_limit === 2) await setSeats(sub, 1, true);
        evidence.original_seat_limit_restored = (await subscription(true)).member_limit === 1;
        check('ORIGINAL_ONE_SEAT_LIMIT_RESTORED', evidence.original_seat_limit_restored);
      } catch (error) { cleanupFailure = error; }
      try {
        const row = await fixture(true); if (row.status === 'active') await setStatus(row, 'suspended', true);
        evidence.fixture_suspended_verified = (await fixture(true)).status === 'suspended';
        check('FIXTURE_SUSPENDED_AFTER_CLEANUP', evidence.fixture_suspended_verified);
      } catch (error) { cleanupFailure ??= error; }
    }
  }
  if (cleanupFailure) throw cleanupFailure;
  if (failure) throw failure;
}
