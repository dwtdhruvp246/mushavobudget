import assert from 'node:assert/strict';
import test from 'node:test';
import { checkBusinessFinance, isBusinessFinancePlan } from '../scripts/ci/staging-business-finance.mjs';

const id = digit => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
const actor = digit => ({ id: id(digit), token: 'test.' + Buffer.from(JSON.stringify({ sub: id(digit), session_id: id(digit) })).toString('base64url') + '.test' });
const actors = { USER_A: actor('1'), USER_B: actor('2'), ADMIN: actor('3') };
const accounts = { USER_B: { email: 'controlled@example.test' } };
const plan = { scope: 'business-finance-workflow', project: 'dczlddwbtgvfdujgcitb', fixture_name: 'audit-batch-x-receipt-d7be160c2026',
  expected_support_version: 6, expected_subscription_version: 3,
  case_ids: ['X_REQUEST_LIFECYCLE', 'X_REQUEST_BILL_LINK', 'X_BILL_PAYMENT_REPLAY', 'X_FINANCE_FIXTURE_ISOLATION'] };

function backend({ failPayment = false, loseResumeResponse = false } = {}) {
  const state = { status: 'suspended', support: 6, seats: 1, subscription: 3, manager: false, pending: false, request: null,
    bill: null, payments: [], calls: [] };
  const fetcher = async (url, options) => {
    const parsed = new URL(url), name = parsed.pathname.split('/').at(-1);
    assert.equal(parsed.origin, 'https://dczlddwbtgvfdujgcitb.supabase.co');
    const caller = Object.values(actors).find(value => options.headers.Authorization === 'Bearer ' + value.token);
    assert.ok(caller);
    const body = options.body ? JSON.parse(options.body) : {};
    state.calls.push({ name, method: options.method, body, caller });
    const ok = value => new Response(JSON.stringify(value), { status: 200 });
    const no = message => new Response(JSON.stringify({ message }), { status: 400 });
    const fixture = () => ({ id: id('4'), owner_id: actors.USER_A.id, workspace_type: 'business', status: state.status,
      business_support_version: state.support });
    if (options.method === 'GET') {
      assert.equal(parsed.searchParams.get('limit'), '3');
      if (name === 'budget_workspaces') return ok([fixture()]);
      if (name === 'workspace_subscriptions') return ok([{ member_limit: state.seats, version: state.subscription,
        status: 'active', paid_through_at: new Date(Date.now() + 3600000).toISOString() }]);
      if (name === 'workspace_members') return ok([{ id: actors.USER_A.id, user_id: actors.USER_A.id, role: 'owner', status: 'active' },
        ...(state.manager ? [{ id: actors.USER_B.id, user_id: actors.USER_B.id, role: 'finance_manager', status: 'active' }] : [])]);
      if (name === 'workspace_invitations') return ok(state.pending ? [{ id: id('7'), invitee_user_id: actors.USER_B.id, status: 'pending' }] : []);
      if (name === 'business_categories') return ok([{ id: id('5') }]);
      if (name === 'business_dimensions') return ok([{ id: id('6') }]);
      if (name === 'business_spending_requests') return ok(caller === actors.USER_B && !state.manager ? [] : [state.request]);
      if (name === 'business_bills') return ok([state.bill]);
      if (name === 'business_bill_payments') return ok(state.payments);
    }
    if (name === 'admin_business_set_status') {
      assert.equal(caller, actors.ADMIN); assert.equal(body.p_workspace_id, id('4'));
      assert.equal(body.p_expected_version, state.support); assert.equal(body.p_confirmation_name, plan.fixture_name);
      state.status = body.p_status; state.support++;
      if (loseResumeResponse && state.status === 'active') throw new Error('resume response lost');
      return ok(id('4'));
    }
    if (name === 'admin_set_business_seats') {
      assert.equal(caller, actors.ADMIN); assert.equal(body.p_expected_version, state.subscription);
      state.seats = body.p_total_seats; state.subscription++; return ok(state.seats);
    }
    if (name === 'create_business_invitation') { state.pending = true; return ok({ invitation_id: id('7'), invitee_user_id: actors.USER_B.id }); }
    if (name === 'respond_business_invitation') { state.pending = false; state.manager = true; return ok(id('4')); }
    if (name === 'cancel_business_invitation') { state.pending = false; return ok('cancelled'); }
    if (name === 'remove_business_member') { state.manager = false; return ok('removed'); }
    if (name === 'app_session_status') return ok({ session_valid: true, admin_authorized: false });
    if (name === 'save_business_supplier') return ok({ id: id('8'), workspace_id: id('4') });
    if (name === 'save_business_spending_request') {
      if (state.request) return body.p_expected_version === null ? ok(state.request) : no('BUSINESS_REQUEST_CHANGED');
      state.request = { id: body.p_request_id, workspace_id: body.p_workspace_id, submitted_by: caller.id,
        title: body.p_title, amount: body.p_amount, status: 'draft', version: 1 }; return ok(state.request);
    }
    if (name === 'transition_business_request') {
      if (body.p_expected_version !== state.request.version) return no('BUSINESS_REQUEST_CHANGED');
      if (body.p_action === 'approved' && caller === actors.USER_A) return no('BUSINESS_SELF_APPROVAL_FORBIDDEN');
      if (body.p_action === 'cancel') return no('BUSINESS_REQUEST_CANNOT_CANCEL');
      state.request.status = body.p_action === 'submit' ? 'submitted' : 'approved'; state.request.version++;
      if (body.p_action === 'approved') state.request.reviewed_by = caller.id;
      return ok(state.request);
    }
    if (name === 'create_business_bill_from_request') {
      if (!state.bill) {
        state.bill = { id: id('9'), workspace_id: id('4'), source_request_id: body.p_request_id, reference: body.p_reference,
          status: 'open', amount: 1, paid_amount: 0, currency: 'USD', reporting_amount: 1, created_by: caller.id, version: 1 };
        state.request.status = 'committed'; state.request.version++;
      }
      return ok(state.bill);
    }
    if (name === 'cancel_business_bill') return no('BUSINESS_BILL_CANNOT_CANCEL');
    if (name === 'record_business_bill_payment_with_source') {
      if (failPayment) throw new Error('synthetic transport failed during finance exercise');
      const old = state.payments.find(value => value.id === body.p_payment_id); if (old) return ok(old);
      if (body.p_amount > 1 - state.bill.paid_amount) return no('BUSINESS_BILL_PAYMENT_INVALID');
      const payment = { id: body.p_payment_id, bill_id: body.p_bill_id, amount: body.p_amount, reference: body.p_reference,
        payment_source: body.p_payment_source, recorded_by: caller.id };
      state.payments.push(payment); state.bill.paid_amount += body.p_amount; state.bill.version++;
      if (state.bill.paid_amount === 1) { state.bill.status = 'paid'; state.request.status = 'fulfilled'; state.request.version++; }
      return ok(payment);
    }
    throw new Error('unplanned test route');
  };
  return { state, fetcher };
}

test('finance acceptance is pinned to one reviewed synthetic fixture', () => {
  assert.equal(isBusinessFinancePlan(plan), true);
  for (const change of [{ project: 'production' }, { fixture_name: 'customer business' }, { expected_support_version: 7 }, { case_ids: [] }])
    assert.equal(isBusinessFinancePlan({ ...plan, ...change }), false);
});
test('the bounded flow retains synthetic ledger history and restores member, seats and isolation', async () => {
  const { state, fetcher } = backend(), evidence = {};
  await checkBusinessFinance({ actors, accounts, evidence }, 'public-test-key', 'test-agent', plan, fetcher);
  assert.ok(Object.values(evidence.checks).every(Boolean));
  assert.equal(state.status, 'suspended'); assert.equal(state.seats, 1); assert.equal(state.manager, false); assert.equal(state.pending, false);
  assert.equal(state.payments.length, 2); assert.equal(state.request.status, 'fulfilled');
  assert.equal(evidence.exercise_requests, state.calls.length); assert.ok(state.calls.length < 90);
  assert.equal(state.calls.filter(call => call.name === 'admin_business_set_status').length, 2);
  assert.equal(evidence.email_requests + evidence.provider_payment_requests + evidence.Storage_uploads, 0);
});
test('an exercise transport failure still removes access and suspends the exact fixture', async () => {
  const { state, fetcher } = backend({ failPayment: true }), evidence = {};
  await assert.rejects(checkBusinessFinance({ actors, accounts, evidence }, 'test', 'test', plan, fetcher), /synthetic transport failed/);
  assert.equal(state.status, 'suspended'); assert.equal(state.seats, 1); assert.equal(state.manager, false); assert.equal(state.pending, false);
  assert.equal(evidence.fixture_suspended_verified, true); assert.equal(evidence.temporary_member_removed, true);
});
test('a lost resume response is independently read during cleanup without repeating resume', async () => {
  const { state, fetcher } = backend({ loseResumeResponse: true }), evidence = {};
  await assert.rejects(checkBusinessFinance({ actors, accounts, evidence }, 'test', 'test', plan, fetcher), /resume response lost/);
  assert.equal(state.status, 'suspended'); assert.equal(state.seats, 1); assert.equal(state.manager, false);
  assert.equal(state.calls.filter(call => call.name === 'admin_business_set_status' && call.body.p_status === 'active').length, 1);
  assert.equal(evidence.fixture_suspended_verified, true);
});
test('a substituted privileged actor causes no request', async () => {
  let requests = 0;
  await assert.rejects(checkBusinessFinance({ actors: { ...actors, ADMIN: actors.USER_A }, accounts, evidence: {} }, 'test', 'test', plan, async () => { requests++; }));
  assert.equal(requests, 0);
});
