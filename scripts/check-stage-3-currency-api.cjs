// 3.2.3: selected staging currency settings and conversion boundaries.
const { randomUUID } = require('node:crypto');
const STAGING = 'https://dczlddwbtgvfdujgcitb.supabase.co';
const FRONTEND = 'https://mushavo-budget-staging.pages.dev/config.js';
const EMAILS = ['audit.owner@example.com', 'audit.outsider@example.com'];
const NAMES = ['AUDIT-S322-FAMILY-PRIMARY', 'AUDIT-S322-FAMILY-SECONDARY'];
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const SETTINGS = ['workspace_id', 'base_currency', 'default_payment_currency', 'enabled_currencies', 'reporting_currency', 'conversion_enabled', 'reminder_enabled'];
const CONVERSIONS = 'id,entity_type,entity_id,workspace_id,original_amount,original_currency,reporting_currency,exchange_rate,converted_amount,rate_provider,rate_source,is_locked,entered_by';
const ITEM = 'id,family_id,workspace_id,owner_id,created_by,visibility,name,amount,currency,status,notes';
const RECORD = 'id,family_id,workspace_id,payment_item_id,owner_id,recorded_by,visibility,amount,currency,payment_date,notes';
class AuditError extends Error {}
const ensure = (ok, code) => { if (!ok) throw new AuditError(code); };
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const permissionDenied = r => [401, 403].includes(r.status) && r.data?.code === '42501';
const empty = r => r.status === 200 && Array.isArray(r.data) && r.data.length === 0;
const rowDenied = r => empty(r) || permissionDenied(r);
const rpcDenied = (r, messages) => permissionDenied(r) || (r.status === 400 && r.data?.code === 'P0001' && messages.includes(r.data?.message));
function one(r, code) { ensure(r.status === 200 && Array.isArray(r.data) && r.data.length === 1, code); return r.data[0]; }
function settings(row) {
  ensure(row && typeof row === 'object' && !Array.isArray(row), 'SETTINGS_RESPONSE_SHAPE_INVALID');
  ensure(UUID.test(row.workspace_id || '') && Array.isArray(row.enabled_currencies) && row.enabled_currencies.length > 0 && row.enabled_currencies.every(c => /^[A-Z]{3}$/.test(c)) && typeof row.conversion_enabled === 'boolean' && typeof row.reminder_enabled === 'boolean', 'SETTINGS_RESPONSE_VALUES_INVALID');
  return Object.fromEntries(SETTINGS.map(k => [k, k === 'enabled_currencies' ? [...new Set(row[k])].sort() : row[k]]));
}
function parseConfig(text) {
  let c; try { c = JSON.parse(text.replace(/^\s*window\.MUSHAVO_BUDGET_CONFIG\s*=\s*/, '').replace(/;\s*$/, '')); }
  catch { throw new AuditError('CONFIG_PARSE_FAILED'); }
  ensure(c.supabaseUrl === STAGING && !text.includes('kttkospkblwvguuwnhjj') && !c.vapidPublicKey, 'CONFIG_NOT_ISOLATED_STAGING');
  ensure(/^sb_publishable_[A-Za-z0-9_-]+$/.test(c.supabasePublishableKey || ''), 'CONFIG_KEY_TYPE_REJECTED'); return c;
}
async function run({ fetcher = fetch, ownerPassword, outsiderPassword, uuid = randomUUID } = {}) {
  const checks = [], sessions = [], personal = [], families = [];
  let config, phase = 'Configuration', problem = null, count = 0, logoutOk = true, restored = false, manualCreated = 0, internalDenials = 0, writesAttempted = false;
  const pass = check => checks.push({ check, status: 'PASS' });
  async function request(route, { session, method = 'GET', body } = {}) {
    ensure(++count <= 220, 'REQUEST_BUDGET_EXCEEDED');
    const headers = { apikey: config.supabasePublishableKey, Accept: 'application/json' };
    if (session) headers.Authorization = 'Bearer ' + session.token;
    if (method !== 'GET') headers.Prefer = 'return=representation';
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetcher(STAGING + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(20000) });
    let data; try { const text = await response.text(); data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { status: response.status, data };
  }
  const get = (route, session) => request(route, { session });
  const rpc = (name, session, body) => request('/rest/v1/rpc/' + name, { session, method: 'POST', body });
  const settingsPath = id => '/rest/v1/workspace_settings?select=' + SETTINGS.join(',') + '&workspace_id=eq.' + id;
  const conversionPath = f => '/rest/v1/payment_conversions?select=' + CONVERSIONS + '&entity_type=eq.payment_record&entity_id=eq.' + f.record.id;
  const args = s => ({ p_workspace_id: s.workspace_id, p_default_payment_currency: s.default_payment_currency, p_enabled_currencies: s.enabled_currencies, p_reporting_currency: s.reporting_currency, p_conversion_enabled: s.conversion_enabled });
  async function readSettings(f) { return settings(one(await get(settingsPath(f.workspace.id), f.session), 'OWNER_SETTINGS_READ_FAILED')); }
  async function unchangedSettings(f, expected = f.original) { ensure(equal(await readSettings(f), expected), 'PROTECTED_SETTINGS_CHANGED'); }
  async function conversions(f, expected = []) { const r = await get(conversionPath(f), f.session); ensure(r.status === 200 && Array.isArray(r.data) && equal(r.data, expected), 'PROTECTED_CONVERSIONS_CHANGED'); }
  async function paymentUnchanged(f) {
    ensure(equal(one(await get('/rest/v1/payment_items?select=' + ITEM + '&id=eq.' + f.item.id, f.session), 'ITEM_READBACK_FAILED'), f.item), 'PROTECTED_PAYMENT_CHANGED');
    ensure(equal(one(await get('/rest/v1/payment_records?select=' + RECORD + '&id=eq.' + f.record.id, f.session), 'RECORD_READBACK_FAILED'), f.record), 'PROTECTED_PAYMENT_CHANGED');
  }
  async function save(f, body, expected) {
    writesAttempted = true; const r = await rpc('save_workspace_currency_settings', f.session, body);
    const row = Array.isArray(r.data) && r.data.length === 1 ? r.data[0] : r.data;
    ensure(r.status === 200 && equal(settings(row), expected), 'OWNER_SETTINGS_SAVE_FAILED'); await unchangedSettings(f, expected);
  }
  try {
    ensure(typeof ownerPassword === 'string' && ownerPassword.length > 0 && typeof outsiderPassword === 'string' && outsiderPassword.length > 0, 'TWO_STAGING_APP_PASSWORDS_REQUIRED');
    const response = await fetcher(FRONTEND, { redirect: 'error', signal: AbortSignal.timeout(20000) }); ensure(response.status === 200, 'CONFIG_FETCH_FAILED'); config = parseConfig(await response.text());
    pass('Deployed config uses staging with no production reference or push key'); phase = 'Verified staging sessions';
    for (const [i, password] of [ownerPassword, outsiderPassword].entries()) {
      const r = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: EMAILS[i], password } });
      ensure(r.status === 200 && typeof r.data?.access_token === 'string', 'STAGING_APP_SIGN_IN_FAILED');
      const s = { token: r.data.access_token, id: r.data.user?.id }; sessions.push(s);
      ensure(UUID.test(s.id || '') && r.data.user?.email === EMAILS[i], 'SIGN_IN_IDENTITY_MISMATCH');
      const identity = await get('/auth/v1/user', s), staff = await rpc('is_platform_staff', s, { p_roles: null }), suspended = await rpc('my_account_suspended', s, {});
      ensure(identity.status === 200 && identity.data?.id === s.id && identity.data?.email === EMAILS[i] && staff.status === 200 && staff.data === false && suspended.status === 200 && suspended.data === false, 'ORDINARY_ACTIVE_SESSION_CONTROL_FAILED');
    }
    ensure(sessions[0].id !== sessions[1].id, 'ACCOUNTS_NOT_DISTINCT'); pass('Two distinct verified staging sessions are ordinary active accounts');
    phase = 'Existing Personal and completed Family fixture controls';
    for (const [i, session] of sessions.entries()) {
      const workspace = one(await get('/rest/v1/budget_workspaces?select=id,owner_id,workspace_type,status&owner_id=eq.' + session.id + '&workspace_type=eq.personal&status=eq.active&limit=2', session), 'PERSONAL_WORKSPACE_MISSING_OR_AMBIGUOUS');
      ensure(UUID.test(workspace.id || '') && workspace.owner_id === session.id && workspace.workspace_type === 'personal' && workspace.status === 'active', 'PERSONAL_WORKSPACE_SCOPE_MISMATCH');
      const p = { session, workspace }; p.original = await readSettings(p); ensure(p.original.base_currency === p.original.reporting_currency, 'PERSONAL_NORMALIZABLE_BASELINE_REQUIRED'); personal.push(p);
      const family = one(await get('/rest/v1/families?select=id,owner_id,name&name=eq.' + NAMES[i] + '&owner_id=eq.' + session.id + '&limit=2', session), 'FAMILY_FIXTURE_MISSING_OR_AMBIGUOUS');
      const fw = one(await get('/rest/v1/budget_workspaces?select=id,owner_id,legacy_family_id,workspace_type,status&legacy_family_id=eq.' + family.id, session), 'FAMILY_WORKSPACE_MISSING');
      ensure(UUID.test(family.id || '') && family.owner_id === session.id && family.name === NAMES[i] && UUID.test(fw.id || '') && fw.owner_id === session.id && fw.legacy_family_id === family.id && fw.workspace_type === 'household' && fw.status === 'active', 'FAMILY_SCOPE_MISMATCH');
      const f = { session, family, workspace: fw }; f.original = await readSettings(f);
      ensure(equal(f.original, { workspace_id: fw.id, base_currency: 'USD', default_payment_currency: 'USD', enabled_currencies: ['USD'], reporting_currency: 'USD', conversion_enabled: false, reminder_enabled: false }), 'FAMILY_USD_DISABLED_BASELINE_REQUIRED');
      f.item = one(await get('/rest/v1/payment_items?select=' + ITEM + '&family_id=eq.' + family.id + '&name=eq.' + NAMES[i] + '-PAYMENT&limit=2', session), 'HEAD_ITEM_FIXTURE_MISSING');
      f.record = one(await get('/rest/v1/payment_records?select=' + RECORD + '&payment_item_id=eq.' + f.item.id + '&limit=2', session), 'HEAD_RECORD_FIXTURE_MISSING');
      ensure(UUID.test(f.item.id || '') && UUID.test(f.record.id || '') && f.item.owner_id === session.id && f.item.created_by === session.id && f.item.family_id === family.id && f.item.workspace_id === fw.id && f.item.visibility === 'family' && f.item.status === 'inactive' && Number(f.item.amount) === 1 && f.item.currency === 'USD' && f.record.owner_id === session.id && f.record.recorded_by === session.id && f.record.family_id === family.id && f.record.workspace_id === fw.id && f.record.payment_item_id === f.item.id && f.record.visibility === 'family' && Number(f.record.amount) === 1 && f.record.currency === 'USD' && /^\d{4}-\d{2}-\d{2}$/.test(f.record.payment_date || ''), 'HEAD_PAYMENT_SCOPE_MISMATCH');
      await conversions(f); families.push(f);
    }
    const [f, other] = families;
    ensure(new Set([...personal, ...families].map(x => x.workspace.id)).size === 4, 'WORKSPACES_NOT_DISTINCT');
    for (const [table, key, id, role] of [['family_members', 'family_id', f.family.id, 'Adult'], ['workspace_members', 'workspace_id', f.workspace.id, 'family_member']]) {
      const m = one(await get('/rest/v1/' + table + '?select=user_id,role,status&' + key + '=eq.' + id + '&user_id=eq.' + sessions[1].id, f.session), 'REMOVED_MEMBER_FIXTURE_MISSING');
      ensure(m.user_id === sessions[1].id && m.role === role && m.status === 'inactive', 'REMOVED_MEMBER_FIXTURE_NOT_INACTIVE');
    }
    const participant = await rpc('is_active_family_participant', sessions[1], { p_family_id: f.family.id }); ensure(participant.status === 200 && participant.data === false, 'REMOVED_PARTICIPANT_CONTROL_FAILED');
    pass('Own Personal workspaces and both retained USD 1 Family fixtures are scoped; former member remains inactive');
    phase = 'Supported currency controls';
    for (const code of ['USD', 'INR']) { const c = one(await get('/rest/v1/supported_currencies?select=code,is_active&code=eq.' + code, sessions[0]), 'SUPPORTED_CURRENCY_MISSING'); ensure(c.code === code && c.is_active === true, 'SUPPORTED_CURRENCY_NOT_ACTIVE'); }
    ensure(empty(await get('/rest/v1/supported_currencies?select=code&code=eq.ZZZ&is_active=eq.true', sessions[0])), 'UNSUPPORTED_TEST_CODE_NOT_VALID');
    pass('USD and INR are active; the unsupported test code is absent');
    phase = 'Personal owner no-op settings control';
    for (const p of personal) await save(p, args(p.original), p.original);
    pass('Both Personal owners can save existing currency values; selected settings remain unchanged');
    phase = 'Family head currency changes and restoration';
    for (const [i, family] of families.entries()) {
      const target = { ...family.original, base_currency: 'INR', default_payment_currency: 'INR', enabled_currencies: ['INR', 'USD'], reporting_currency: 'INR' };
      await save(family, { p_workspace_id: family.workspace.id, p_default_payment_currency: ' inr ', p_enabled_currencies: ['usd', 'INR', ' usd '], p_reporting_currency: 'inr', p_conversion_enabled: false }, target);
      await paymentUnchanged(family); await conversions(family);
      await save(family, args(family.original), family.original); await paymentUnchanged(family);
      pass('Family head ' + (i + 1) + ' changes normalized currency settings and restores the original USD disabled-conversion values');
    }
    restored = true;
    phase = 'Foreign, removed and anonymous workspace settings denials';
    for (const [label, fixtures] of [['Personal', personal], ['Family including removed member', families]]) {
      for (const [i, target] of fixtures.entries()) {
        for (const actor of [sessions[1 - i], undefined]) {
          ensure(rowDenied(await request(settingsPath(target.workspace.id), { session: actor })), 'FOREIGN_SETTINGS_READ_EXPOSED');
          const changed = { ...target.original, base_currency: 'INR', default_payment_currency: 'INR', enabled_currencies: ['INR', 'USD'], reporting_currency: 'INR' };
          ensure(rpcDenied(await rpc('save_workspace_currency_settings', actor, args(changed)), ['CURRENCY_SETTINGS_ACCESS_REQUIRED', 'AUTHENTICATION_REQUIRED']), 'FOREIGN_SETTINGS_RPC_NOT_DENIED'); await unchangedSettings(target);
          ensure(rowDenied(await request(settingsPath(target.workspace.id), { session: actor, method: 'PATCH', body: { base_currency: 'INR', default_payment_currency: 'INR', enabled_currencies: ['INR', 'USD'], reporting_currency: 'INR' } })), 'FOREIGN_DIRECT_SETTINGS_UPDATE_NOT_DENIED'); await unchangedSettings(target);
        }
      }
      pass(label + ' settings remain hidden and unchanged after foreign/anonymous RPC and direct PATCH attempts');
    }
    phase = 'Owner invalid currency inputs';
    for (const [patch, expected] of [[{ p_enabled_currencies: [] }, 'INVALID_ENABLED_CURRENCIES'], [{ p_default_payment_currency: 'INR' }, 'DEFAULT_AND_REPORTING_CURRENCY_MUST_BE_ENABLED'], [{ p_default_payment_currency: 'ZZZ', p_reporting_currency: 'ZZZ', p_enabled_currencies: ['ZZZ'] }, 'UNSUPPORTED_CURRENCY']]) {
      ensure(rpcDenied(await rpc('save_workspace_currency_settings', f.session, { ...args(f.original), ...patch }), [expected]), 'INVALID_CURRENCY_INPUT_NOT_REJECTED'); await unchangedSettings(f);
    }
    pass('Owner empty, unenabled and unsupported currency inputs are rejected without selected setting changes');
    phase = 'Protected conversion table and helper boundaries';
    const direct = { id: uuid(), entity_type: 'payment_record', entity_id: f.record.id, workspace_id: f.workspace.id, original_amount: 1, original_currency: 'USD', reporting_currency: 'USD', exchange_rate: 1, converted_amount: 1, rate_effective_at: new Date().toISOString(), rate_provider: 'manual', rate_source: 'manual', is_locked: true, entered_by: f.session.id };
    writesAttempted = true;
    ensure(permissionDenied(await request('/rest/v1/payment_conversions?select=id', { session: f.session, method: 'POST', body: direct })), 'DIRECT_OWNER_CONVERSION_INSERT_NOT_PERMISSION_DENIED'); await conversions(f); await paymentUnchanged(f);
    pass('Ordinary owner cannot bypass the protected conversion RPC with a direct table INSERT');
    const writer = { p_entity_type: 'payment_record', p_entity_id: f.record.id, p_workspace_id: f.workspace.id, p_original_amount: 1, p_original_currency: 'USD', p_reporting_currency: 'USD', p_payment_at: f.record.payment_date + 'T23:59:00Z' };
    for (const [label, actor] of [['Signed-in', f.session], ['Anonymous', undefined]]) {
      for (const [name, body] of [['store_api_payment_conversion', writer], ['currency_conversion_backfill_dates', { p_limit: 1 }]]) {
        ensure(permissionDenied(await rpc(name, actor, body)), 'INTERNAL_HELPER_NOT_PERMISSION_DENIED'); await conversions(f); await paymentUnchanged(f); internalDenials++;
        pass(label + ' direct ' + name + ' request is permission-denied; selected conversion/payment unchanged');
      }
    }
    phase = 'Manual conversion recipient and owner controls';
    const manual = family => ({ p_entity_type: 'payment_record', p_entity_id: family.record.id, p_reporting_currency: 'USD', p_exchange_rate: 1, p_converted_amount: 1 });
    for (const [i, family] of families.entries()) {
      for (const actor of [sessions[1 - i], undefined]) {
        ensure(rpcDenied(await rpc('save_manual_payment_conversion', actor, manual(family)), ['CURRENCY_SETTINGS_ACCESS_REQUIRED']), 'FOREIGN_MANUAL_CONVERSION_NOT_DENIED'); await conversions(family); await paymentUnchanged(family);
      }
    }
    pass('Other head, removed member and anonymous cannot manually convert the known foreign Family paid records');
    for (const [i, family] of families.entries()) {
      const r = await rpc('save_manual_payment_conversion', family.session, manual(family)); ensure(r.status === 200 && UUID.test(r.data || ''), 'HEAD_MANUAL_CONVERSION_POSITIVE_FAILED'); manualCreated++;
      const row = one(await get(conversionPath(family), family.session), 'MANUAL_CONVERSION_READ_FAILED');
      ensure(row.id === r.data && row.entity_type === 'payment_record' && row.entity_id === family.record.id && row.workspace_id === family.workspace.id && Number(row.original_amount) === 1 && row.original_currency === 'USD' && row.reporting_currency === 'USD' && Number(row.exchange_rate) === 1 && Number(row.converted_amount) === 1 && row.rate_provider === 'manual' && row.rate_source === 'manual' && row.is_locked === true && row.entered_by === family.session.id, 'MANUAL_CONVERSION_VALUES_OR_SCOPE_MISMATCH');
      family.conversion = row; await paymentUnchanged(family); await unchangedSettings(family);
      pass('Matching Family head ' + (i + 1) + ' saves and reads an attributed locked USD 1 manual conversion');
    }
    phase = 'Conversion row isolation and direct mutation controls';
    for (const [i, family] of families.entries()) {
      for (const actor of [sessions[1 - i], undefined]) {
        ensure(rowDenied(await request(conversionPath(family), { session: actor })), 'FOREIGN_CONVERSION_ROW_EXPOSED');
        for (const method of ['PATCH', 'DELETE']) {
          ensure(rowDenied(await request('/rest/v1/payment_conversions?select=' + CONVERSIONS + '&id=eq.' + family.conversion.id, { session: actor, method, body: method === 'PATCH' ? { exchange_rate: 2, converted_amount: 2 } : undefined })), 'FOREIGN_CONVERSION_MUTATION_NOT_DENIED'); await conversions(family, [family.conversion]);
        }
      }
    }
    pass('Foreign/removed and anonymous conversion reads or direct mutations reveal no row and leave owner readbacks unchanged');
    for (const method of ['PATCH', 'DELETE']) {
      ensure(rowDenied(await request('/rest/v1/payment_conversions?select=' + CONVERSIONS + '&id=eq.' + f.conversion.id, { session: f.session, method, body: method === 'PATCH' ? { exchange_rate: 2, converted_amount: 2 } : undefined })), 'DIRECT_OWNER_CONVERSION_MUTATION_NOT_DENIED'); await conversions(f, [f.conversion]);
    }
    pass('Owner direct PATCH/DELETE cannot bypass the protected manual conversion path');
    phase = 'Disabled-conversion workspace backfill';
    for (const [i, family] of families.entries()) {
      const positive = await rpc('backfill_workspace_currency_conversions', family.session, { p_workspace_id: family.workspace.id }); ensure(positive.status === 200 && positive.data === 0, 'DISABLED_OWNER_BACKFILL_NOT_ZERO');
      await conversions(family, [family.conversion]); await paymentUnchanged(family);
      for (const actor of [sessions[1 - i], undefined]) {
        ensure(rpcDenied(await rpc('backfill_workspace_currency_conversions', actor, { p_workspace_id: family.workspace.id }), ['CURRENCY_SETTINGS_ACCESS_REQUIRED']), 'FOREIGN_BACKFILL_NOT_DENIED'); await conversions(family, [family.conversion]);
      }
    }
    pass('Matching heads reach disabled backfill with zero changes; foreign/removed and anonymous backfill is denied');
    phase = 'Final selected fixture/settings preservation';
    for (const fixture of [...personal, ...families]) await unchangedSettings(fixture);
    for (const family of families) { await paymentUnchanged(family); await conversions(family, [family.conversion]); }
    pass('Original selected currency settings and Family payment values remain; only two new synthetic manual conversions are retained');
  } catch (e) { problem = e instanceof AuditError ? e.message : 'NETWORK_OR_LOCAL_ERROR'; checks.push({ check: phase, status: 'REVIEW', problem_code: problem }); }
  finally { if (config) for (const s of sessions) { try { const r = await request('/auth/v1/logout?scope=local', { session: s, method: 'POST' }); if (![200, 204].includes(r.status)) logoutOk = false; } catch { logoutOk = false; } } }
  if (!problem && (!logoutOk || sessions.length !== 2)) { problem = 'TEST_SESSION_LOGOUT_FAILED'; checks.push({ check: 'Local test-session logout', status: 'REVIEW', problem_code: problem }); }
  else if (logoutOk && sessions.length === 2) pass('Only the two generated API test sessions receive local logout');
  return { stage_step: '3.2.3', result: problem ? 'STAGING_CURRENCY_API_REVIEW' : 'STAGING_CURRENCY_API_SCOPED_PASS', project: 'dczlddwbtgvfdujgcitb', checks, problem_code: problem,
    test_sessions_logged_out: logoutOk && sessions.length === 2, selected_settings_restored_and_finally_verified: !problem && restored,
    manual_synthetic_conversion_rows_created: manualCreated, manual_conversion_rows_retained: manualCreated > 0, internal_helper_permission_denial_checks_passed: internalDenials,
    incomplete_write_effects_may_remain: !!problem && writesAttempted, original_personal_payment_fixtures_targeted: false,
    automatic_conversion_enabled_by_batch: false, family_membership_or_invitation_changed: false,
    provider_rates_service_scheduler_or_historical_conversion_integrity_verified: false, global_finance_or_Business_currency_authority_verified: false,
    prior_personal_binding_failure_or_relink_delete_cases_resolved: false, full_f15_acceptance_verified: false,
    production_or_native_changed: false, credentials_tokens_keys_and_raw_rows_printed: false, completed_utc: new Date().toISOString() };
}
module.exports = { run, parseConfig, rowDenied, rpcDenied, permissionDenied, AuditError };
