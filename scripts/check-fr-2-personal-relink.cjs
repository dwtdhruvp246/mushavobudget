// FR.2.2: new inactive Personal fixtures; retained for separately reviewed exact cleanup.
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
function missingDenied(r) {
  return permissionDenied(r) || (r.status === 400 && (
    r.data?.code === '23503' ||
    (r.data?.code === 'P0001' && ['WORKSPACE_ACCESS_REQUIRED', 'WORKSPACE_NOT_PROVISIONED'].includes(r.data?.message))
  ));
}
async function run({ fetcher = fetch, ownerPassword, outsiderPassword, uuid = randomUUID, today = new Date().toISOString().slice(0, 10) } = {}) {
  const checks = [], sessions = [], fixtures = [];
  let config, marker, problem = null, phase = 'Configuration', requestCount = 0;
  let itemCount = 0, recordCount = 0, writesAttempted = false, logoutOk = true, preservationVerified = false;
  const pass = check => checks.push({ check, status: 'PASS' });
  async function request(route, { session, method = 'GET', body } = {}) {
    ensure(++requestCount <= 160, 'REQUEST_BUDGET_EXCEEDED');
    const headers = { apikey: config.supabasePublishableKey, Accept: 'application/json' };
    if (session) headers.Authorization = 'Bearer ' + session.token;
    if (method !== 'GET') headers.Prefer = 'return=representation';
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetcher(API + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(20000) });
    let data = null;
    try { const text = await response.text(); if (text) data = JSON.parse(text); } catch { /* No malformed success or denial accepted. */ }
    return { status: response.status, data };
  }
  const endpoint = (table, id) => '/rest/v1/' + table + '?select=' + (table === 'payment_items' ? ITEM : RECORD) + '&id=eq.' + id;
  const readSettings = f => request('/rest/v1/workspace_settings?select=' + SETTINGS + '&workspace_id=eq.' + f.workspace.id, { session: f.session });
  async function conversions(session) {
    const r = await request('/rest/v1/payment_conversions?select=*&order=id&limit=101', { session });
    ensure(r.status === 200 && Array.isArray(r.data) && r.data.length <= 100 && r.data.every(c => UUID.test(c.id || '') && UUID.test(c.entity_id || '')), 'CONVERSION_BASELINE_UNAVAILABLE_OR_TOO_LARGE');
    return r.data;
  }
  async function unchangedRecord(f) {
    ensure(equal(one(await request(endpoint('payment_records', f.record.id), { session: f.session }), 'RECORD_READBACK_FAILED'), f.record), 'RECORD_READBACK_CHANGED');
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
      ensure(f.settings.workspace_id === workspace.id && f.settings.reporting_currency === 'USD' && Array.isArray(f.settings.enabled_currencies) && f.settings.enabled_currencies.includes('USD') && typeof f.settings.conversion_enabled === 'boolean', 'USD_IDENTITY_SETTINGS_REQUIRED_NO_SETTINGS_CHANGED');
      f.beforeConversions = await conversions(s);
      const family = one(await request('/rest/v1/families?select=id,owner_id,name&owner_id=eq.' + s.id + '&name=eq.' + FAMILIES[i] + '&limit=2', { session: s }), 'RETAINED_FAMILY_UNAVAILABLE');
      ensure(UUID.test(family.id || '') && family.owner_id === s.id && family.name === FAMILIES[i], 'RETAINED_FAMILY_SCOPE_MISMATCH');
      const fw = one(await request('/rest/v1/budget_workspaces?select=id,owner_id,legacy_family_id,workspace_type,status&legacy_family_id=eq.' + family.id + '&limit=2', { session: s }), 'RETAINED_FAMILY_WORKSPACE_UNAVAILABLE');
      ensure(UUID.test(fw.id || '') && fw.owner_id === s.id && fw.legacy_family_id === family.id && fw.workspace_type === 'household' && fw.status === 'active', 'RETAINED_FAMILY_SCOPE_MISMATCH');
      const manual = f.beforeConversions.filter(c => c.workspace_id === fw.id && c.entity_type === 'payment_record' && c.rate_provider === 'manual' && c.rate_source === 'manual' && c.reporting_currency === 'USD');
      ensure(manual.length === 1 && Number(manual[0].original_amount) === 1 && Number(manual[0].converted_amount) === 1 && Number(manual[0].exchange_rate) === 1 && manual[0].original_currency === 'USD' && manual[0].is_locked === true && manual[0].entered_by === s.id, 'RETAINED_MANUAL_BASELINE_MISMATCH');
    }
    ensure(fixtures[0].workspace.id !== fixtures[1].workspace.id, 'DISTINCT_PERSONAL_WORKSPACES_REQUIRED');
    pass('Own distinct Personal workspaces have unchanged USD identity settings');
    pass('Existing visible conversion rows and both attributed Family manual USD1 rows privately captured');
    const markerId = uuid(); ensure(UUID.test(markerId), 'SYNTHETIC_UUID_REQUIRED'); marker = 'AUDIT-FR22-RELINK-' + markerId;
    phase = 'New inactive fixtures and owner relinking';
    for (const [i, f] of fixtures.entries()) {
      f.items = [];
      for (const label of ['A', 'B']) {
        const id = uuid(); ensure(UUID.test(id), 'SYNTHETIC_UUID_REQUIRED');
        const body = { id, name: marker + '-' + (i + 1) + '-' + label, owner_id: f.session.id, created_by: f.session.id, workspace_id: f.workspace.id, family_id: null, visibility: 'personal', amount: 1, currency: 'USD', recurrence_type: 'once', start_date: today, status: 'inactive', notes: 'Synthetic FR2 relink fixture retained for exact cleanup' };
        writesAttempted = true;
        const row = one(await request('/rest/v1/payment_items?select=' + ITEM, { session: f.session, method: 'POST', body }), 'OWN_ITEM_CREATE_FAILED', 201);
        ensure(equal(row, Object.fromEntries(ITEM.split(',').map(k => [k, body[k]]))), 'OWN_ITEM_SCOPE_MISMATCH'); f.items.push(row); itemCount++;
      }
      const id = uuid(); ensure(UUID.test(id), 'SYNTHETIC_UUID_REQUIRED');
      const body = { id, payment_item_id: f.items[0].id, owner_id: f.session.id, recorded_by: f.session.id, workspace_id: f.workspace.id, family_id: null, visibility: 'personal', amount: 1, currency: 'USD', period_start: today, due_date: today, payment_date: today, payment_method: 'Other', notes: 'Synthetic FR2 relink record retained for exact cleanup' };
      f.record = one(await request('/rest/v1/payment_records?select=' + RECORD, { session: f.session, method: 'POST', body }), 'OWN_RECORD_CREATE_FAILED', 201);
      ensure(equal(f.record, Object.fromEntries(RECORD.split(',').map(k => [k, body[k]]))), 'OWN_RECORD_SCOPE_MISMATCH'); recordCount++;
      f.newConversions = (await conversions(f.session)).filter(c => c.entity_type === 'payment_record' && c.entity_id === id);
      ensure(f.newConversions.length === (f.settings.conversion_enabled ? 1 : 0), 'NEW_CONVERSION_COUNT_MISMATCH');
      if (f.newConversions.length) { const c = f.newConversions[0]; ensure(c.workspace_id === f.workspace.id && c.rate_provider === 'identity' && c.rate_source === 'identity' && c.original_currency === 'USD' && c.reporting_currency === 'USD' && Number(c.original_amount) === 1 && Number(c.converted_amount) === 1 && Number(c.exchange_rate) === 1 && c.is_locked === true, 'NEW_IDENTITY_CONVERSION_SCOPE_MISMATCH'); }
      await unchangedRecord(f);
      pass('Owner ' + (i + 1) + ' creates two inactive own parents and an attributed USD1 paid record');
      const initial = f.record;
      const linked = one(await request(endpoint('payment_records', id), { session: f.session, method: 'PATCH', body: { payment_item_id: f.items[1].id } }), 'VALID_OWN_RELINK_FAILED');
      ensure(equal(linked, { ...initial, payment_item_id: f.items[1].id }), 'VALID_RELINK_SCOPE_OR_VALUE_CHANGED'); f.record = linked; await unchangedRecord(f);
      pass('Owner ' + (i + 1) + ' valid own-parent relink preserves workspace ownership and finance values');
      const missing = uuid(); ensure(UUID.test(missing), 'SYNTHETIC_UUID_REQUIRED');
      for (const s of sessions) ensure(empty(await request(endpoint('payment_items', missing), { session: s })), 'GENERATED_MISSING_PARENT_VISIBLE');
      ensure(missingDenied(await request(endpoint('payment_records', id), { session: f.session, method: 'PATCH', body: { payment_item_id: missing } })), 'MISSING_PARENT_RELINK_NOT_REJECTED');
      await unchangedRecord(f);
      pass('Owner ' + (i + 1) + ' generated absent-parent relink is rejected with unchanged record');
      f.record = one(await request(endpoint('payment_records', id), { session: f.session, method: 'PATCH', body: { payment_item_id: f.items[0].id } }), 'ORIGINAL_PARENT_RESTORE_FAILED');
      ensure(equal(f.record, initial), 'ORIGINAL_PARENT_RESTORE_CHANGED_VALUES'); await unchangedRecord(f);
      pass('Owner ' + (i + 1) + ' restores the new record original parent and verifies full selected values');
    }
    phase = 'Final baseline and fixture preservation';
    const newRecordIds = new Set(fixtures.map(f => f.record.id));
    for (const f of fixtures) {
      const after = await conversions(f.session);
      ensure(equal(after.filter(c => c.entity_type === 'payment_record' && c.entity_id === f.record.id), f.newConversions), 'NEW_CONVERSIONS_CHANGED_DURING_RELINK');
      ensure(equal(after.filter(c => !(c.entity_type === 'payment_record' && newRecordIds.has(c.entity_id))), f.beforeConversions), 'PREEXISTING_VISIBLE_CONVERSIONS_CHANGED');
      ensure(equal(one(await readSettings(f), 'SETTINGS_READBACK_FAILED'), f.settings), 'SETTINGS_CHANGED');
      await unchangedRecord(f);
      for (const item of f.items) ensure(equal(one(await request(endpoint('payment_items', item.id), { session: f.session }), 'ITEM_READBACK_FAILED'), item), 'INACTIVE_PARENT_CHANGED');
    }
    preservationVerified = true;
    pass('New record conversion rows remain byte-identical through relink and restore');
    pass('All previously visible conversion rows including retained manual rows remain byte-identical');
    pass('Original selected settings and exact new inactive parents and restored records remain');
  } catch (e) {
    problem = e instanceof AuditError ? e.message : 'NETWORK_OR_LOCAL_ERROR'; checks.push({ check: phase, status: 'REVIEW', problem_code: problem });
  } finally {
    if (config) for (const s of sessions) {
      try { const r = await request('/auth/v1/logout?scope=local', { session: s, method: 'POST' }); if (![200, 204].includes(r.status)) logoutOk = false; } catch { logoutOk = false; }
    }
  }
  if (!problem && (!logoutOk || sessions.length !== 2)) { problem = 'TEST_SESSION_LOGOUT_FAILED'; checks.push({ check: 'Only test sessions are logged out', status: 'REVIEW', problem_code: problem }); }
  else if (logoutOk && sessions.length === 2) pass('Only the two API-created test sessions are logged out');
  return { stage_step: 'FR.2.2_RELINK', result: problem ? 'STAGING_PERSONAL_RELINK_REVIEW' : 'STAGING_PERSONAL_RELINK_SCOPED_PASS', project: PROJECT, checks, problem_code: problem, run_marker: marker || null, new_inactive_items_created: itemCount, new_paid_records_created: recordCount, new_fixture_rows_intentionally_retained: writesAttempted, incomplete_new_fixture_effects_may_remain: !!problem && writesAttempted, preexisting_visible_conversion_rows_unchanged: preservationVerified, test_sessions_logged_out: logoutOk && sessions.length === 2, existing_historical_records_or_conversions_repaired: false, derived_conversion_rows_cleanup_verified: false, post_batch_SQL_snapshot_rechecked: false, hosted_acceptance: false, findings_closed: [], production_or_native_changed: false, credentials_tokens_keys_raw_rows_and_actor_identifiers_printed: false, completed_utc: new Date().toISOString() };
}
module.exports = { run, missingDenied };
