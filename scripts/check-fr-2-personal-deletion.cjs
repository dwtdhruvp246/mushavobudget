// FR.2.2: genuine staging API checks; only new inactive Personal fixture IDs may be deleted.
const { randomUUID } = require('node:crypto');
const { parseConfig, AuditError, permissionDenied } = require('./check-stage-3-personal-api.cjs');
const PROJECT = 'dczlddwbtgvfdujgcitb';
const API = 'https://' + PROJECT + '.supabase.co';
const CONFIG = 'https://mushavo-budget-staging.pages.dev/config.js';
const EMAILS = ['audit.owner@example.com', 'audit.outsider@example.com'];
const FAMILIES = ['AUDIT-S322-FAMILY-PRIMARY', 'AUDIT-S322-FAMILY-SECONDARY'];
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const ITEM = 'id,name,owner_id,created_by,workspace_id,family_id,visibility,amount,currency,status,notes';
const RECORD = 'id,payment_item_id,owner_id,recorded_by,workspace_id,family_id,visibility,amount,currency,notes';
const SETTINGS = 'workspace_id,base_currency,default_payment_currency,enabled_currencies,reporting_currency,conversion_enabled,reminder_enabled';
const ensure = (ok, code) => { if (!ok) throw new AuditError(code); };
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const one = (r, code, status = 200) => { ensure(r.status === status && Array.isArray(r.data) && r.data.length === 1, code); return r.data[0]; };
const empty = r => r.status === 200 && Array.isArray(r.data) && r.data.length === 0;
function deleteDenied(r) { return permissionDenied(r) || emptyResult(r); }
function emptyResult(r) { return r.status === 200 && Array.isArray(r.data) && r.data.length === 0; }
async function run({ fetcher = fetch, ownerPassword, outsiderPassword, uuid = randomUUID, today = new Date().toISOString().slice(0, 10) } = {}) {
  const checks = [], sessions = [], fixtures = [];
  let config, marker, problem = null, phase = 'Configuration', requestCount = 0;
  let itemCount = 0, recordCount = 0, conversionCount = 0, writesAttempted = false, logoutOk = true, preservationVerified = false, removed = false, schemaVerified = false;
  const pass = check => checks.push({ check, status: 'PASS' });
  async function request(route, { session, method = 'GET', body } = {}) {
    ensure(++requestCount <= 240, 'REQUEST_BUDGET_EXCEEDED');
    const headers = { apikey: config.supabasePublishableKey, Accept: 'application/json' };
    if (session) headers.Authorization = 'Bearer ' + session.token;
    if (method !== 'GET') headers.Prefer = 'return=representation';
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetcher(API + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(20000) });
    let data = null;
    try { const text = await response.text(); if (text) data = JSON.parse(text); } catch { /* No malformed success or denial accepted. */ }
    return { status: response.status, data };
  }
  const readSettings = f => request('/rest/v1/workspace_settings?select=' + SETTINGS + '&workspace_id=eq.' + f.workspace.id, { session: f.session });
  async function conversions(session) {
    const r = await request('/rest/v1/payment_conversions?select=*&order=id&limit=101', { session });
    ensure(r.status === 200 && Array.isArray(r.data) && r.data.length <= 100 && r.data.every(c => UUID.test(c.id || '') && UUID.test(c.entity_id || '')), 'CONVERSION_BASELINE_UNAVAILABLE_OR_TOO_LARGE');
    return r.data;
  }
  async function paymentRows(table, session) {
    const r = await request('/rest/v1/' + table + '?select=*&order=id&limit=101', { session });
    ensure(r.status === 200 && Array.isArray(r.data) && r.data.length <= 100 && r.data.every(x => UUID.test(x.id || '')), 'PAYMENT_BASELINE_UNAVAILABLE_OR_TOO_LARGE');
    return r.data;
  }
  const exactEndpoint = (table, id) => '/rest/v1/' + table + '?select=*&id=eq.' + id;
  async function unchanged(f, table, expected) {
    ensure(equal(one(await request(exactEndpoint(table, expected.id), { session: f.session }), 'PROTECTED_FIXTURE_READBACK_FAILED'), expected), 'PROTECTED_FIXTURE_CHANGED');
  }
  async function linked(f, id) {
    const r = await request('/rest/v1/payment_conversions?select=*&entity_type=eq.payment_record&entity_id=eq.' + id + '&order=id&limit=3', { session: f.session });
    ensure(r.status === 200 && Array.isArray(r.data) && r.data.length <= 2, 'LINKED_CONVERSION_READBACK_FAILED');
    return r.data;
  }
  async function protectedFixture(f, x) {
    await unchanged(f, 'payment_items', x.item);
    await unchanged(f, 'payment_records', x.record);
    ensure(equal(await linked(f, x.record.id), x.conversions), 'PROTECTED_CONVERSION_CHANGED');
  }
  async function absent(table, id) {
    for (const session of sessions) ensure(empty(await request(exactEndpoint(table, id), { session })), 'DELETED_ROW_STILL_VISIBLE_OR_UNCHECKABLE');
  }
  try {
    ensure(typeof ownerPassword === 'string' && ownerPassword.length > 0 && typeof outsiderPassword === 'string' && outsiderPassword.length > 0, 'TWO_STAGING_APP_PASSWORDS_REQUIRED');
    const response = await fetcher(CONFIG, { redirect: 'error', signal: AbortSignal.timeout(20000) });
    ensure(response.status === 200, 'CONFIG_FETCH_FAILED'); config = parseConfig(await response.text());
    pass('Public configuration is staging-only with push disabled');
    phase = 'Verified synthetic sessions';
    for (const [i, password] of [ownerPassword, outsiderPassword].entries()) {
      const login = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: EMAILS[i], password } });
      ensure(login.status === 200 && typeof login.data?.access_token === 'string', 'SYNTHETIC_SIGN_IN_FAILED');
      const s = { token: login.data.access_token, id: login.data.user?.id }; sessions.push(s);
      ensure(UUID.test(s.id || '') && login.data.user?.email === EMAILS[i], 'SESSION_IDENTITY_MISMATCH');
      const identity = await request('/auth/v1/user', { session: s });
      ensure(identity.status === 200 && identity.data?.id === s.id && identity.data?.email === EMAILS[i], 'SESSION_IDENTITY_MISMATCH');
      const staff = await request('/rest/v1/rpc/is_platform_staff', { session: s, method: 'POST', body: { p_roles: null } });
      const suspended = await request('/rest/v1/rpc/my_account_suspended', { session: s, method: 'POST', body: {} });
      ensure(staff.status === 200 && staff.data === false && suspended.status === 200 && suspended.data === false, 'ORDINARY_ACTIVE_ACCOUNT_REQUIRED');
    }
    ensure(sessions[0].id !== sessions[1].id, 'DISTINCT_ACCOUNTS_REQUIRED');
    pass('Two verified distinct ordinary nonsuspended staging accounts');
    phase = 'Existing workspace and conversion baselines';
    for (const [i, s] of sessions.entries()) {
      const workspace = one(await request('/rest/v1/budget_workspaces?select=id,owner_id,workspace_type,status&owner_id=eq.' + s.id + '&workspace_type=eq.personal&status=eq.active&limit=2', { session: s }), 'PERSONAL_WORKSPACE_MISSING_OR_AMBIGUOUS');
      ensure(UUID.test(workspace.id || '') && workspace.owner_id === s.id && workspace.workspace_type === 'personal' && workspace.status === 'active', 'PERSONAL_WORKSPACE_SCOPE_MISMATCH');
      const f = { session: s, workspace }; fixtures.push(f);
      f.settings = one(await readSettings(f), 'SETTINGS_UNAVAILABLE');
      ensure(f.settings.workspace_id === workspace.id && f.settings.reporting_currency === 'USD' && Array.isArray(f.settings.enabled_currencies) && f.settings.enabled_currencies.includes('USD') && f.settings.conversion_enabled === true, 'EXISTING_USD_REPORTING_AND_ENABLED_CONVERSION_REQUIRED_NO_SETTINGS_CHANGED');
      const shape = await request('/rest/v1/payment_conversions?select=id,payment_record_ref&limit=0', { session: s });
      ensure(empty(shape), 'GENERATED_REFERENCE_NOT_VISIBLE_IN_API_SCHEMA_CACHE');
      f.beforeConversions = await conversions(s);
      ensure(f.beforeConversions.every(c => Object.hasOwn(c, 'payment_record_ref') && (c.entity_type === 'payment_record' ? c.payment_record_ref === c.entity_id : c.payment_record_ref === null)), 'GENERATED_REFERENCE_BASELINE_SHAPE_MISMATCH');
      f.beforeItems = await paymentRows('payment_items', s);
      f.beforeRecords = await paymentRows('payment_records', s);
      const family = one(await request('/rest/v1/families?select=id,owner_id,name&owner_id=eq.' + s.id + '&name=eq.' + FAMILIES[i] + '&limit=2', { session: s }), 'RETAINED_FAMILY_UNAVAILABLE');
      ensure(UUID.test(family.id || '') && family.owner_id === s.id && family.name === FAMILIES[i], 'RETAINED_FAMILY_SCOPE_MISMATCH');
      const fw = one(await request('/rest/v1/budget_workspaces?select=id,owner_id,legacy_family_id,workspace_type,status&legacy_family_id=eq.' + family.id + '&limit=2', { session: s }), 'RETAINED_FAMILY_WORKSPACE_UNAVAILABLE');
      ensure(UUID.test(fw.id || '') && fw.owner_id === s.id && fw.legacy_family_id === family.id && fw.workspace_type === 'household' && fw.status === 'active', 'RETAINED_FAMILY_SCOPE_MISMATCH');
      const manual = f.beforeConversions.filter(c => c.workspace_id === fw.id && c.entity_type === 'payment_record' && c.rate_provider === 'manual' && c.rate_source === 'manual' && c.reporting_currency === 'USD');
      ensure(manual.length === 1 && Number(manual[0].original_amount) === 1 && Number(manual[0].converted_amount) === 1 && Number(manual[0].exchange_rate) === 1 && manual[0].original_currency === 'USD' && manual[0].is_locked === true && manual[0].entered_by === s.id, 'RETAINED_MANUAL_BASELINE_MISMATCH');
    }
    ensure(fixtures[0].workspace.id !== fixtures[1].workspace.id, 'DISTINCT_PERSONAL_WORKSPACES_REQUIRED');
    pass('Own distinct Personal scopes already use enabled conversions and USD reporting; settings privately captured');
    schemaVerified = true;
    pass('New generated reference is visible in the API schema cache and has the expected baseline shape');
    pass('All visible payment rows and conversions, including both retained Family manual USD1 rows, privately captured');
    const markerId = uuid(); ensure(UUID.test(markerId), 'SYNTHETIC_UUID_REQUIRED'); marker = 'AUDIT-FR22-DELETE-' + markerId;
    phase = 'New inactive fixture deletion and conversion cascades';
    for (const [i, f] of fixtures.entries()) {
      f.created = [];
      for (const mode of ['RECORD', 'ITEM']) {
        const itemId = uuid(), recordId = uuid();
        ensure(UUID.test(itemId) && UUID.test(recordId), 'SYNTHETIC_UUID_REQUIRED');
        const itemBody = { id: itemId, name: marker + '-' + (i + 1) + '-' + mode, owner_id: f.session.id, created_by: f.session.id, workspace_id: f.workspace.id, family_id: null, visibility: 'personal', amount: 1, currency: 'USD', recurrence_type: 'once', start_date: today, status: 'inactive', notes: 'Synthetic FR2 deletion fixture; only this exact run may be cleaned' };
        const x = { itemBody, recordId, mode }; f.created.push(x);
        writesAttempted = true;
        const item = one(await request('/rest/v1/payment_items?select=*', { session: f.session, method: 'POST', body: itemBody }), 'OWN_ITEM_CREATE_FAILED', 201);
        itemCount++; x.item = item;
        ensure(equal(Object.fromEntries(ITEM.split(',').map(k => [k, item[k]])), Object.fromEntries(ITEM.split(',').map(k => [k, itemBody[k]]))), 'OWN_ITEM_SCOPE_MISMATCH');
        const recordBody = { id: recordId, payment_item_id: item.id, owner_id: f.session.id, recorded_by: f.session.id, workspace_id: f.workspace.id, family_id: null, visibility: 'personal', amount: 1, currency: 'USD', period_start: today, due_date: today, payment_date: today, payment_method: 'Other', notes: 'Synthetic FR2 deletion record; only this exact run may be cleaned' };
        const record = one(await request('/rest/v1/payment_records?select=*', { session: f.session, method: 'POST', body: recordBody }), 'OWN_RECORD_CREATE_FAILED', 201);
        recordCount++; x.record = record;
        ensure(equal(Object.fromEntries(RECORD.split(',').map(k => [k, record[k]])), Object.fromEntries(RECORD.split(',').map(k => [k, recordBody[k]]))), 'OWN_RECORD_SCOPE_MISMATCH');
        x.conversions = await linked(f, record.id);
        ensure(x.conversions.length === 1, 'NEW_IDENTITY_CONVERSION_REQUIRED');
        const c = x.conversions[0];
        ensure(UUID.test(c.id || '') && c.entity_type === 'payment_record' && c.entity_id === record.id && c.payment_record_ref === record.id && c.workspace_id === f.workspace.id && c.rate_provider === 'identity' && c.rate_source === 'identity' && c.original_currency === 'USD' && c.reporting_currency === 'USD' && Number(c.original_amount) === 1 && Number(c.converted_amount) === 1 && Number(c.exchange_rate) === 1 && c.is_locked === true, 'NEW_IDENTITY_CONVERSION_REFERENCE_OR_SCOPE_MISMATCH');
        conversionCount++;
        await protectedFixture(f, x);
        pass('Owner ' + (i + 1) + ' ' + mode + ' path creates exact inactive USD1 item, paid record and generated identity conversion');
        for (const [label, session] of [['Outsider', sessions[1 - i]], ['Anonymous', undefined]]) {
          ensure(deleteDenied(await request(exactEndpoint('payment_records', record.id), { session, method: 'DELETE' })), 'UNAUTHORIZED_RECORD_DELETE_NOT_DENIED');
          await protectedFixture(f, x);
          ensure(deleteDenied(await request(exactEndpoint('payment_conversions', c.id), { session, method: 'DELETE' })), 'UNAUTHORIZED_CONVERSION_DELETE_NOT_DENIED');
          await protectedFixture(f, x);
          if (mode === 'ITEM') {
            ensure(deleteDenied(await request(exactEndpoint('payment_items', item.id), { session, method: 'DELETE' })), 'UNAUTHORIZED_ITEM_DELETE_NOT_DENIED');
            await protectedFixture(f, x);
          }
          pass(label + ' cannot delete owner ' + (i + 1) + ' ' + mode + ' path parents or conversion; full owner readbacks unchanged');
        }
        ensure(deleteDenied(await request(exactEndpoint('payment_conversions', c.id), { session: f.session, method: 'DELETE' })), 'OWNER_DIRECT_CONVERSION_DELETE_NOT_DENIED');
        await protectedFixture(f, x);
        pass('Owner ' + (i + 1) + ' ' + mode + ' path direct conversion DELETE has no effect under unchanged RLS');
        if (mode === 'RECORD') {
          const deleted = one(await request(exactEndpoint('payment_records', record.id), { session: f.session, method: 'DELETE' }), 'OWNER_RECORD_DELETE_FAILED');
          ensure(equal(deleted, record), 'OWNER_RECORD_DELETE_RETURN_MISMATCH');
          await absent('payment_records', record.id);
          await absent('payment_conversions', c.id);
          ensure((await linked(f, record.id)).length === 0, 'RECORD_CASCADE_CONVERSION_REMAINS');
          await unchanged(f, 'payment_items', item);
          pass('Owner ' + (i + 1) + ' record DELETE removes exact record and conversion while retaining its inactive parent');
          ensure(equal(one(await request(exactEndpoint('payment_items', item.id), { session: f.session, method: 'DELETE' }), 'OWN_EMPTY_ITEM_CLEANUP_FAILED'), item), 'OWN_ITEM_DELETE_RETURN_MISMATCH');
          await absent('payment_items', item.id);
          pass('Owner ' + (i + 1) + ' removes only the now-empty item from this new RECORD path');
        } else {
          ensure(equal(one(await request(exactEndpoint('payment_items', item.id), { session: f.session, method: 'DELETE' }), 'OWNER_ITEM_DELETE_FAILED'), item), 'OWNER_ITEM_DELETE_RETURN_MISMATCH');
          await absent('payment_items', item.id);
          await absent('payment_records', record.id);
          await absent('payment_conversions', c.id);
          ensure((await linked(f, record.id)).length === 0, 'ITEM_CASCADE_CONVERSION_REMAINS');
          pass('Owner ' + (i + 1) + ' item DELETE cascades through its exact new record and generated conversion');
        }
      }
    }
    phase = 'All new fixtures absent and old baselines unchanged';
    for (const f of fixtures) {
      ensure(equal(await conversions(f.session), f.beforeConversions), 'PREEXISTING_VISIBLE_CONVERSIONS_CHANGED_OR_NEW_CONVERSIONS_REMAIN');
      ensure(equal(await paymentRows('payment_items', f.session), f.beforeItems), 'PREEXISTING_VISIBLE_ITEMS_CHANGED_OR_NEW_ITEMS_REMAIN');
      ensure(equal(await paymentRows('payment_records', f.session), f.beforeRecords), 'PREEXISTING_VISIBLE_RECORDS_CHANGED_OR_NEW_RECORDS_REMAIN');
      ensure(equal(one(await readSettings(f), 'SETTINGS_READBACK_FAILED'), f.settings), 'SETTINGS_CHANGED');
    }
    preservationVerified = true; removed = true;
    pass('Both actors full visible payment and conversion baselines, including old orphan and manual rows, match their private pre-run captures');
    pass('All four new inactive items, four paid records and four generated identity conversions are absent; currency settings unchanged');
  } catch (e) {
    problem = e instanceof AuditError ? e.message : 'NETWORK_OR_LOCAL_ERROR'; checks.push({ check: phase, status: 'REVIEW', problem_code: problem });
  } finally {
    if (config) for (const s of sessions) {
      try { const r = await request('/auth/v1/logout?scope=local', { session: s, method: 'POST' }); if (![200, 204].includes(r.status)) logoutOk = false; } catch { logoutOk = false; }
    }
  }
  if (!problem && (!logoutOk || sessions.length !== 2)) { problem = 'TEST_SESSION_LOGOUT_FAILED'; checks.push({ check: 'Only test sessions are logged out', status: 'REVIEW', problem_code: problem }); }
  else if (logoutOk && sessions.length === 2) pass('Only the two API-created test sessions are logged out');
  return { stage_step: 'FR.2.2_DELETION', result: problem ? 'STAGING_PERSONAL_DELETION_REVIEW' : 'STAGING_PERSONAL_DELETION_AND_CONVERSION_CASCADE_SCOPED_PASS', project: PROJECT, checks, problem_code: problem, run_marker: marker || null, requests_attempted: requestCount, new_inactive_items_created: itemCount, new_paid_records_created: recordCount, new_identity_conversions_verified: conversionCount, selected_new_fixture_and_conversion_absence_verified: removed, incomplete_new_fixture_effects_may_remain: writesAttempted && !removed, preexisting_visible_payment_and_conversion_rows_unchanged: preservationVerified, test_sessions_logged_out: logoutOk && sessions.length === 2, existing_historical_records_or_orphan_conversions_repaired_or_deleted: false, existing_settings_changed: false, derived_conversion_rows_cleanup_verified: removed, schema_cache_generated_reference_verified: schemaVerified, post_batch_SQL_snapshot_rechecked: false, concurrent_transactions_or_provider_jobs_verified: false, hosted_acceptance: false, findings_closed: [], production_or_native_changed: false, credentials_tokens_keys_raw_rows_and_actor_identifiers_printed: false, completed_utc: new Date().toISOString() };
}
module.exports = { run, deleteDenied };
