// 3.2.1: controlled staging-only Personal writes. No service key or database password.
const { randomUUID } = require('node:crypto');
const STAGING = 'https://dczlddwbtgvfdujgcitb.supabase.co';
const FRONTEND = 'https://mushavo-budget-staging.pages.dev/config.js';
const PROJECT = 'dczlddwbtgvfdujgcitb';
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const ITEM_FIELDS = 'id,name,owner_id,created_by,workspace_id,family_id,visibility,amount,currency,status,notes';
const RECORD_FIELDS = 'id,payment_item_id,owner_id,recorded_by,workspace_id,family_id,visibility,amount,currency,notes';
class AuditError extends Error {}
function ensure(ok, code) { if (!ok) throw new AuditError(code); }
function parseConfig(text) {
  let c;
  try { c = JSON.parse(text.replace(/^\s*window\.MUSHAVO_BUDGET_CONFIG\s*=\s*/, '').replace(/;\s*$/, '')); }
  catch { throw new AuditError('CONFIG_PARSE_FAILED'); }
  ensure(c.supabaseUrl === STAGING, 'CONFIG_NOT_STAGING');
  ensure(/^sb_publishable_[A-Za-z0-9_-]+$/.test(c.supabasePublishableKey || ''), 'CONFIG_KEY_TYPE_REJECTED');
  ensure(!c.vapidPublicKey && !text.includes('kttkospkblwvguuwnhjj'), 'CONFIG_PRODUCTION_REFERENCE_OR_PUSH_KEY');
  return c;
}
function permissionDenied(r) { return [401, 403].includes(r.status) && r.data?.code === '42501'; }
function writeDenied(r, allowEmpty = true) {
  return permissionDenied(r) || (allowEmpty && r.status === 200 && Array.isArray(r.data) && r.data.length === 0)
    || (r.status === 400 && r.data?.code === 'P0001' && r.data?.message === 'WORKSPACE_ACCESS_REQUIRED');
}
function readDenied(r) { return permissionDenied(r) || (r.status === 200 && Array.isArray(r.data) && r.data.length === 0); }
function one(r, code, statuses = [200]) {
  ensure(statuses.includes(r.status) && Array.isArray(r.data) && r.data.length === 1, code);
  return r.data[0];
}
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
async function run({ fetcher = fetch, ownerPassword, outsiderPassword, uuid = randomUUID, today = new Date().toISOString().slice(0, 10) } = {}) {
  const checks = [], sessions = [], fixtures = [];
  let config, current = 'Configuration', problem = null, logoutOk = true, removed = false;
  let requestCount = 0;
  const pass = check => checks.push({ check, status: 'PASS' });
  async function request(route, { token, method = 'GET', body } = {}) {
    requestCount++;
    ensure(requestCount <= 160, 'REQUEST_BUDGET_EXCEEDED');
    const headers = { apikey: config.supabasePublishableKey, Accept: 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (method !== 'GET') headers.Prefer = 'return=representation';
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const r = await fetcher(STAGING + route, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'error', signal: AbortSignal.timeout(20000),
    });
    let data = null;
    try { const text = await r.text(); if (text) data = JSON.parse(text); } catch { /* Never accept a malformed denial. */ }
    return { status: r.status, data };
  }
  const endpoint = (table, id) => '/rest/v1/' + table + '?select=' + (table === 'payment_items' ? ITEM_FIELDS : RECORD_FIELDS) + '&id=eq.' + id;
  async function unchanged(f, table, expected) {
    const result = one(await request(endpoint(table, expected.id), { token: f.session.token }), 'PROTECTED_FIXTURE_READBACK_FAILED');
    ensure(same(result, expected), 'PROTECTED_FIXTURE_CHANGED');
  }
  async function absent(table, id) {
    for (const session of sessions) {
      const r = await request(endpoint(table, id), { token: session.token });
      ensure(r.status === 200 && Array.isArray(r.data) && r.data.length === 0, 'FORGED_INSERT_EFFECT_PRESENT_OR_UNCHECKABLE');
    }
  }
  try {
    ensure(typeof ownerPassword === 'string' && ownerPassword.length > 0 && typeof outsiderPassword === 'string' && outsiderPassword.length > 0, 'TWO_STAGING_APP_PASSWORDS_REQUIRED');
    const r = await fetcher(FRONTEND, { redirect: 'error', signal: AbortSignal.timeout(20000) });
    ensure(r.status === 200, 'PUBLIC_CONFIG_FETCH_FAILED'); config = parseConfig(await r.text());
    pass('Deployed config uses the staging project and no push key');
    current = 'Synthetic account verification';
    for (const [email, password] of [['audit.owner@example.com', ownerPassword], ['audit.outsider@example.com', outsiderPassword]]) {
      const login = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
      ensure(login.status === 200 && typeof login.data?.access_token === 'string', 'SYNTHETIC_SIGN_IN_FAILED');
      const session = { token: login.data.access_token, id: login.data.user?.id };
      sessions.push(session);
      ensure(UUID.test(session.id || '') && login.data?.user?.email === email, 'SYNTHETIC_SIGN_IN_FAILED');
      const identity = await request('/auth/v1/user', { token: session.token });
      ensure(identity.status === 200 && identity.data?.id === session.id && identity.data?.email === email, 'SESSION_IDENTITY_CHECK_FAILED');
      const staff = await request('/rest/v1/rpc/is_platform_staff', { token: session.token, method: 'POST', body: { p_roles: null } });
      const suspended = await request('/rest/v1/rpc/my_account_suspended', { token: session.token, method: 'POST', body: {} });
      ensure(staff.status === 200 && staff.data === false && suspended.status === 200 && suspended.data === false, 'ORDINARY_ACTIVE_ACCOUNT_CONTROL_FAILED');
    }
    ensure(sessions[0].id !== sessions[1].id, 'ACCOUNTS_NOT_DISTINCT');
    pass('Two distinct verified staging sessions are ordinary active accounts');
    for (const session of sessions) {
      const w = one(await request('/rest/v1/budget_workspaces?select=id,owner_id,workspace_type,status&owner_id=eq.' + session.id + '&workspace_type=eq.personal&status=eq.active&limit=2', { token: session.token }), 'PERSONAL_WORKSPACE_MISSING_OR_AMBIGUOUS');
      ensure(UUID.test(w.id || '') && w.owner_id === session.id && w.workspace_type === 'personal' && w.status === 'active', 'PERSONAL_WORKSPACE_SCOPE_MISMATCH');
      fixtures.push({ session, workspace: w });
    }
    ensure(fixtures[0].workspace.id !== fixtures[1].workspace.id, 'PERSONAL_WORKSPACES_NOT_DISTINCT');
    pass('Each verified account reads its own distinct active Personal workspace');
    current = 'Own Personal create and update controls';
    const marker = 'AUDIT-S321-' + uuid();
    for (const [i, f] of fixtures.entries()) {
      const body = { id: uuid(), name: marker + '-' + i, owner_id: f.session.id, created_by: f.session.id,
        workspace_id: f.workspace.id, family_id: null, visibility: 'personal', amount: 1, currency: 'USD',
        recurrence_type: 'once', start_date: today, status: 'inactive', notes: 'Synthetic Stage 3 Personal isolation test' };
      f.itemBody = body;
      f.item = one(await request('/rest/v1/payment_items?select=' + ITEM_FIELDS, { token: f.session.token, method: 'POST', body }), 'OWN_ITEM_CREATE_FAILED', [201]);
      ensure(f.item.id === body.id && f.item.owner_id === f.session.id && f.item.created_by === f.session.id && f.item.workspace_id === f.workspace.id && f.item.family_id === null && f.item.visibility === 'personal' && f.item.status === 'inactive' && Number(f.item.amount) === 1 && f.item.currency === 'USD', 'OWN_ITEM_CREATE_SCOPE_MISMATCH');
      await unchanged(f, 'payment_items', f.item);
      const itemBefore = f.item;
      f.item = one(await request(endpoint('payment_items', f.item.id), { token: f.session.token, method: 'PATCH', body: { notes: 'Synthetic permitted update' } }), 'OWN_ITEM_UPDATE_FAILED');
      ensure(same(f.item, { ...itemBefore, notes: 'Synthetic permitted update' }), 'OWN_ITEM_UPDATE_EFFECT_MISSING');
      await unchanged(f, 'payment_items', f.item);
      const paid = { id: uuid(), payment_item_id: f.item.id, owner_id: f.session.id, recorded_by: f.session.id,
        workspace_id: f.workspace.id, family_id: null, visibility: 'personal', amount: 1, currency: 'USD',
        period_start: today, due_date: today, payment_date: today, payment_method: 'Other', notes: 'Synthetic paid record' };
      f.recordBody = paid;
      f.record = one(await request('/rest/v1/payment_records?select=' + RECORD_FIELDS, { token: f.session.token, method: 'POST', body: paid }), 'OWN_RECORD_CREATE_FAILED', [201]);
      ensure(f.record.id === paid.id && f.record.payment_item_id === f.item.id && f.record.owner_id === f.session.id && f.record.recorded_by === f.session.id && f.record.workspace_id === f.workspace.id && f.record.family_id === null && f.record.visibility === 'personal' && Number(f.record.amount) === 1 && f.record.currency === 'USD', 'OWN_RECORD_CREATE_SCOPE_MISMATCH');
      await unchanged(f, 'payment_records', f.record);
      const recordBefore = f.record;
      f.record = one(await request(endpoint('payment_records', f.record.id), { token: f.session.token, method: 'PATCH', body: { notes: 'Synthetic permitted paid update' } }), 'OWN_RECORD_UPDATE_FAILED');
      ensure(same(f.record, { ...recordBefore, notes: 'Synthetic permitted paid update' }), 'OWN_RECORD_UPDATE_EFFECT_MISSING');
      await unchanged(f, 'payment_records', f.record);
    }
    pass('Both accounts create, read and change their own inactive item and paid record');
    current = 'Foreign and anonymous read/write denials';
    const protectedFixture = fixtures[0];
    for (const [label, token] of [['Outsider', sessions[1].token], ['Anonymous', undefined]]) {
      for (const table of ['payment_items', 'payment_records']) {
        const expected = table === 'payment_items' ? protectedFixture.item : protectedFixture.record;
        ensure(readDenied(await request(endpoint(table, expected.id), { token })), 'FOREIGN_OR_ANONYMOUS_ROW_READ_EXPOSED');
        pass(label + ' cannot read the known owner ' + table + ' row');
        for (const method of ['PATCH', 'DELETE']) {
          const result = await request(endpoint(table, expected.id), { token, method, body: method === 'PATCH' ? { notes: 'Unauthorized synthetic mutation' } : undefined });
          ensure(writeDenied(result), 'FOREIGN_OR_ANONYMOUS_MUTATION_NOT_DENIED');
          await unchanged(protectedFixture, table, expected);
          pass(label + ' ' + method + ' affects no owner ' + table + ' row; owner readback matches');
        }
        const id = uuid();
        const body = { ...(table === 'payment_items' ? protectedFixture.itemBody : protectedFixture.recordBody), id };
        const result = await request('/rest/v1/' + table + '?select=id', { token, method: 'POST', body });
        ensure(writeDenied(result, false), 'FORGED_OWNERSHIP_INSERT_NOT_DENIED');
        await absent(table, id);
        await unchanged(protectedFixture, table, expected);
        pass(label + ' cannot insert an attributed owner ' + table + ' row; no visible effect for either account');
      }
      ensure(readDenied(await request('/rest/v1/budget_workspaces?select=id&id=eq.' + protectedFixture.workspace.id, { token })), 'FOREIGN_OR_ANONYMOUS_WORKSPACE_READ_EXPOSED');
      pass(label + ' cannot read the known owner workspace');
    }
    current = 'Personal ownership and workspace substitution';
    const other = fixtures[1];
    // Valid existing identifiers avoid a missing-reference failure masquerading as authorization.
    for (const [table, expected] of [['payment_items', protectedFixture.item], ['payment_records', protectedFixture.record]]) {
      const r = await request(endpoint(table, expected.id), { token: sessions[0].token, method: 'PATCH', body: { owner_id: sessions[1].id } });
      ensure(writeDenied(r), 'OWNER_ID_REASSIGNMENT_NOT_DENIED');
      await unchanged(protectedFixture, table, expected);
      pass('Owner cannot reassign ' + table + ' ownership to the other account');
      const rebind = await request(endpoint(table, expected.id), { token: sessions[0].token, method: 'PATCH', body: { workspace_id: other.workspace.id } });
      const normalized = rebind.status === 200 && Array.isArray(rebind.data) && rebind.data.length === 1 && same(rebind.data[0], expected);
      ensure(writeDenied(rebind) || normalized, 'FOREIGN_WORKSPACE_REBIND_NOT_PREVENTED');
      await unchanged(protectedFixture, table, expected);
      pass('Foreign workspace substitution is denied or normalized for ' + table);
    }
    const link = await request(endpoint('payment_records', protectedFixture.record.id), { token: sessions[0].token, method: 'PATCH', body: { payment_item_id: other.item.id } });
    ensure(writeDenied(link), 'FOREIGN_PAYMENT_ITEM_RELINK_NOT_DENIED');
    await unchanged(protectedFixture, 'payment_records', protectedFixture.record);
    pass('Own paid record cannot be linked to the other account payment item');
    current = 'Protected currency helper API denials';
    const writer = { p_entity_type: 'payment_record', p_entity_id: protectedFixture.record.id, p_workspace_id: protectedFixture.workspace.id,
      p_original_amount: 1, p_original_currency: 'USD', p_reporting_currency: 'USD', p_payment_at: today + 'T00:00:00Z' };
    for (const [label, token] of [['Signed-in', sessions[0].token], ['Anonymous', undefined]]) {
      for (const [name, body] of [['store_api_payment_conversion', writer], ['currency_conversion_backfill_dates', { p_limit: 1 }]]) {
        ensure(permissionDenied(await request('/rest/v1/rpc/' + name, { token, method: 'POST', body })), 'INTERNAL_CURRENCY_HELPER_API_NOT_PERMISSION_DENIED');
        pass(label + ' direct ' + name + ' request is permission-denied');
      }
    }
    current = 'Owned fixture delete controls';
    for (const f of fixtures) {
      for (const [table, expected] of [['payment_records', f.record], ['payment_items', f.item]]) {
        const deleted = one(await request(endpoint(table, expected.id), { token: f.session.token, method: 'DELETE' }), 'OWN_FIXTURE_DELETE_FAILED');
        ensure(deleted.id === expected.id, 'DELETE_TARGET_MISMATCH');
        await absent(table, expected.id);
      }
    }
    removed = true;
    pass('Both accounts delete only their new paid record and inactive schedule; absence verified');
  } catch (e) {
    problem = e instanceof AuditError ? e.message : 'NETWORK_OR_LOCAL_ERROR';
    checks.push({ check: current, status: 'REVIEW', problem_code: problem });
  } finally {
    if (config) for (const session of sessions) {
      try { const r = await request('/auth/v1/logout?scope=local', { token: session.token, method: 'POST' }); if (![200, 204].includes(r.status)) logoutOk = false; }
      catch { logoutOk = false; }
    }
  }
  if (!problem && (!logoutOk || sessions.length !== 2)) {
    problem = 'TEST_SESSION_LOGOUT_FAILED';
    checks.push({ check: 'Only the two API test sessions are logged out', status: 'REVIEW', problem_code: problem });
  } else if (logoutOk && sessions.length === 2) pass('Only the two API test sessions are logged out');
  return { stage_step: '3.2.1', result: problem ? 'STAGING_PERSONAL_CRUD_REVIEW' : 'STAGING_PERSONAL_CRUD_SCOPED_PASS',
    project: PROJECT, checks, problem_code: problem, test_sessions_logged_out: logoutOk && sessions.length === 2,
    selected_fixture_rows_removed: removed, incomplete_run_fixtures_may_remain: !removed && fixtures.some(f => f.itemBody),
    inactive_schedules_only: true, existing_stage_1_seed_targeted: false, derived_conversion_rows_cleanup_verified: false,
    family_invitation_removal_or_currency_settings_verified: false, service_scheduler_or_conversion_history_verified: false,
    full_f15_acceptance_verified: false, production_or_native_changed: false,
    credentials_tokens_keys_and_raw_rows_printed: false, completed_utc: new Date().toISOString() };
}
module.exports = { run, parseConfig, permissionDenied, writeDenied, readDenied, AuditError };
