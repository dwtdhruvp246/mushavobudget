const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { run, parseConfig, writeDenied, readDenied } = require('../scripts/check-stage-3-personal-api.cjs');
const uid = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const config = 'window.MUSHAVO_BUDGET_CONFIG = ' + JSON.stringify({
  supabaseUrl: 'https://dczlddwbtgvfdujgcitb.supabase.co',
  supabasePublishableKey: 'sb_publishable_TEST_ONLY', vapidPublicKey: '',
}) + ';';
function fixture(mode = 'good') {
  const ids = [uid(1), uid(2)], workspaces = [uid(10), uid(20)];
  const tables = { payment_items: new Map(), payment_records: new Map() };
  const log = [], loggedOut = [];
  let sequence = 100;
  const reply = (status, data) => ({ status, text: async () => data === undefined ? '' : JSON.stringify(data) });
  const forbid = () => reply(403, { code: '42501', message: 'not returned' });
  const empty = () => reply(200, []);
  const fetcher = async (url, opts = {}) => {
    const u = new URL(url), method = opts.method || 'GET';
    const actor = opts.headers?.Authorization?.replace('Bearer ', '');
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    log.push({ path: u.pathname, method, actor, body });
    if (u.pathname === '/config.js') {
      assert.equal(u.origin, 'https://mushavo-budget-staging.pages.dev');
      return { status: 200, text: async () => mode === 'production' ? config.replace('dczlddwbtgvfdujgcitb', 'kttkospkblwvguuwnhjj') : config };
    }
    assert.equal(u.origin, 'https://dczlddwbtgvfdujgcitb.supabase.co');
    if (u.pathname === '/auth/v1/token') {
      const index = body.email === 'audit.owner@example.com' ? 0 : 1;
      if (mode === 'second_login' && index === 1) return reply(400, { code: 'invalid_credentials' });
      return reply(200, { access_token: ids[index], user: { id: ids[index], email: mode === 'wrong_email' ? 'unexpected@example.com' : body.email } });
    }
    if (u.pathname === '/auth/v1/user') {
      return reply(200, { id: mode === 'wrong_identity' ? uid(99) : actor, email: actor === ids[0] ? 'audit.owner@example.com' : 'audit.outsider@example.com' });
    }
    if (u.pathname === '/auth/v1/logout') {
      assert.equal(u.searchParams.get('scope'), 'local'); loggedOut.push(actor);
      return reply(mode === 'logout' ? 500 : 204);
    }
    if (u.pathname.endsWith('/is_platform_staff')) return reply(200, mode === 'staff');
    if (u.pathname.endsWith('/my_account_suspended')) return reply(200, mode === 'suspended');
    if (u.pathname.includes('/rpc/')) {
      if (mode === 'missing_helper') return reply(404, { code: 'PGRST202' });
      if (mode === 'allowed_helper') return reply(200, []);
      return forbid();
    }
    if (u.pathname === '/rest/v1/budget_workspaces') {
      const selected = (u.searchParams.get('id') || '').replace('eq.', '');
      const index = ids.indexOf(actor);
      if (selected) return index >= 0 && selected === workspaces[index] ? reply(200, [{ id: selected }]) : empty();
      if (mode === 'missing_workspace') return empty();
      return reply(200, [{ id: workspaces[index], owner_id: actor, workspace_type: 'personal', status: 'active' }]);
    }
    const table = u.pathname.split('/').pop(), rows = tables[table];
    assert(rows, 'Unknown route: ' + u.pathname);
    const selected = (u.searchParams.get('id') || '').replace('eq.', '');
    const row = rows.get(selected);
    const fields = (u.searchParams.get('select') || 'id').split(',');
    const project = value => Object.fromEntries(fields.map(f => [f, value[f]]));
    if (method === 'POST') {
      if (mode === 'own_create' && actor === ids[0]) return reply(400, { code: '23514' });
      if (body.owner_id !== actor || (table === 'payment_items' ? body.created_by : body.recorded_by) !== actor) {
        if (mode === 'invalid_denial') return reply(400, { code: '23503' });
        if (mode === 'allowed_insert') { rows.set(body.id, { ...body }); return reply(201, [project(body)]); }
        if (mode === 'hidden_insert_effect') rows.set(body.id, { ...body });
        return forbid();
      }
      rows.set(body.id, { ...body }); return reply(201, [project(body)]);
    }
    if (!row) return empty();
    if (method === 'GET') {
      if (mode === 'exposed_read' && actor !== row.owner_id) return reply(200, [project(row)]);
      return actor === row.owner_id ? reply(200, [project(row)]) : empty();
    }
    assert(selected && !u.searchParams.has('owner_id'), 'Every destructive request must select one exact test ID');
    if (actor !== row.owner_id) {
      if (mode === 'server_error') return reply(500, []);
      if (mode === 'malformed_denial') return { status: 200, text: async () => 'not JSON' };
      if (mode === 'changed_behind_denial') row.notes = 'Unauthorized synthetic mutation';
      if (mode === 'allowed_mutation') {
        if (method === 'PATCH') Object.assign(row, body);
        if (method === 'DELETE') rows.delete(selected);
        return reply(200, [project(row)]);
      }
      return empty();
    }
    if (method === 'PATCH') {
      if (body.owner_id && body.owner_id !== actor) {
        if (mode === 'ownership') { Object.assign(row, body); return reply(200, [project(row)]); }
        return forbid();
      }
      if (body.workspace_id && body.workspace_id !== row.workspace_id) {
        if (mode === 'record_rebind' && table === 'payment_records') Object.assign(row, body);
        if (mode === 'normalization') return reply(200, [project(row)]);
        if (mode === 'record_rebind' && table === 'payment_records') return reply(200, [project(row)]);
        return reply(400, { code: 'P0001', message: 'WORKSPACE_ACCESS_REQUIRED' });
      }
      if (body.payment_item_id && tables.payment_items.get(body.payment_item_id)?.owner_id !== actor) {
        if (mode === 'record_relink') { Object.assign(row, body); return reply(200, [project(row)]); }
        return reply(400, { code: 'P0001', message: 'WORKSPACE_ACCESS_REQUIRED' });
      }
      Object.assign(row, body); return reply(200, [project(row)]);
    }
    if (method === 'DELETE') {
      if (mode === 'delete_failure') return empty();
      rows.delete(selected); return reply(200, [project(row)]);
    }
    throw Error('Unknown method');
  };
  return { fetcher, uuid: () => uid(++sequence), tables, log, loggedOut };
}
async function execute(mode) {
  const f = fixture(mode);
  const result = await run({ ...f, ownerPassword: 'PRIVATE_OWNER_SENTINEL', outsiderPassword: 'PRIVATE_OUTSIDER_SENTINEL', today: '2026-10-10' });
  const output = JSON.stringify(result);
  for (const privateValue of ['PRIVATE_OWNER_SENTINEL', 'PRIVATE_OUTSIDER_SENTINEL', 'sb_publishable_TEST_ONLY', uid(1), uid(2), uid(101)]) assert(!output.includes(privateValue));
  assert(f.log.filter(e => e.method === 'POST' && e.path.endsWith('payment_items')).every(e => e.body.status === 'inactive'));
  assert(!f.log.some(e => /notification|enquiry|invite|exchange-rate/.test(e.path)));
  return { result, ...f };
}
test('staging-only config and exact authorization-denial semantics', () => {
  assert.throws(() => parseConfig(config.replace('sb_publishable_TEST_ONLY', 'sb_secret_WRONG')));
  assert.throws(() => parseConfig(config.replace('"vapidPublicKey":""', '"vapidPublicKey":"REAL"')));
  for (const r of [{ status: 500, data: [] }, { status: 401, data: { code: 'invalid_jwt' } }, { status: 400, data: { code: '23503' } }, { status: 404, data: { code: 'PGRST202' } }, { status: 200, data: [{}] }]) {
    assert.equal(writeDenied(r), false); assert.equal(readDenied(r), false);
  }
  assert.equal(writeDenied({ status: 200, data: [] }, false), false);
});
test('legitimate CRUD controls, symmetric fixtures, ID-bounded deletion and local session logout', async () => {
  const f = await execute('good');
  assert.equal(f.result.result, 'STAGING_PERSONAL_CRUD_SCOPED_PASS');
  assert.equal(f.result.checks.length, 33);
  assert.equal(f.result.selected_fixture_rows_removed, true);
  assert.equal(f.tables.payment_items.size + f.tables.payment_records.size, 0);
  assert.deepEqual(f.loggedOut, [uid(1), uid(2)]);
});
test('server-side normalization of a forged workspace is accepted only with unchanged owner readback', async () => {
  assert.equal((await execute('normalization')).result.result, 'STAGING_PERSONAL_CRUD_SCOPED_PASS');
});
const failures = {
  production: 'CONFIG_NOT_STAGING', second_login: 'SYNTHETIC_SIGN_IN_FAILED', wrong_email: 'SYNTHETIC_SIGN_IN_FAILED', wrong_identity: 'SESSION_IDENTITY_CHECK_FAILED',
  staff: 'ORDINARY_ACTIVE_ACCOUNT_CONTROL_FAILED', suspended: 'ORDINARY_ACTIVE_ACCOUNT_CONTROL_FAILED',
  missing_workspace: 'PERSONAL_WORKSPACE_MISSING_OR_AMBIGUOUS', own_create: 'OWN_ITEM_CREATE_FAILED',
  exposed_read: 'FOREIGN_OR_ANONYMOUS_ROW_READ_EXPOSED', allowed_mutation: 'FOREIGN_OR_ANONYMOUS_MUTATION_NOT_DENIED',
  server_error: 'FOREIGN_OR_ANONYMOUS_MUTATION_NOT_DENIED', malformed_denial: 'FOREIGN_OR_ANONYMOUS_MUTATION_NOT_DENIED',
  changed_behind_denial: 'PROTECTED_FIXTURE_CHANGED', invalid_denial: 'FORGED_OWNERSHIP_INSERT_NOT_DENIED',
  allowed_insert: 'FORGED_OWNERSHIP_INSERT_NOT_DENIED', hidden_insert_effect: 'FORGED_INSERT_EFFECT_PRESENT_OR_UNCHECKABLE',
  ownership: 'OWNER_ID_REASSIGNMENT_NOT_DENIED', record_rebind: 'FOREIGN_WORKSPACE_REBIND_NOT_PREVENTED',
  record_relink: 'FOREIGN_PAYMENT_ITEM_RELINK_NOT_DENIED', missing_helper: 'INTERNAL_CURRENCY_HELPER_API_NOT_PERMISSION_DENIED',
  allowed_helper: 'INTERNAL_CURRENCY_HELPER_API_NOT_PERMISSION_DENIED', delete_failure: 'OWN_FIXTURE_DELETE_FAILED', logout: 'TEST_SESSION_LOGOUT_FAILED',
};
for (const [mode, expected] of Object.entries(failures)) test('rejects ' + mode, async () => {
  const f = await execute(mode);
  assert.equal(f.result.result, 'STAGING_PERSONAL_CRUD_REVIEW');
  assert.equal(f.result.problem_code, expected);
  assert(f.result.checks.some(e => e.status === 'REVIEW'));
  if (!['production', 'second_login', 'wrong_email', 'wrong_identity', 'staff', 'suspended'].includes(mode)) assert.equal(f.loggedOut.length, 2);
  if (mode === 'wrong_email') assert.equal(f.loggedOut.length, 1);
  if (!['production', 'second_login', 'wrong_email', 'wrong_identity', 'staff', 'suspended', 'missing_workspace', 'logout'].includes(mode)) assert.equal(f.result.selected_fixture_rows_removed, false);
});
test('transport exception output is redacted and verified sessions still log out', async () => {
  const f = fixture();
  const fetcher = (url, opts) => url.includes('/rest/v1/budget_workspaces') ? Promise.reject(Error('PRIVATE_TOKEN_SENTINEL')) : f.fetcher(url, opts);
  const result = await run({ ...f, fetcher, ownerPassword: 'owner', outsiderPassword: 'outsider' });
  assert.equal(result.problem_code, 'NETWORK_OR_LOCAL_ERROR');
  assert(!JSON.stringify(result).includes('PRIVATE_TOKEN_SENTINEL'));
  assert.equal(f.loggedOut.length, 2);
});
test('ASCII Git/PowerShell handoff embeds a valid Node expression and missing secrets cause no network request', () => {
  const runner = fs.readFileSync(path.join(__dirname, '../scripts/run-stage-3-personal-acceptance.ps1'), 'utf8');
  const checker = fs.readFileSync(path.join(__dirname, '../scripts/check-stage-3-personal-api.cjs'), 'utf8');
  assert(!/[^\x00-\x7F]/.test(runner + checker));
  const command = runner.match(/node -e '([^\n]+)'/)[1].replace(/''/g, "'");
  const env = { ...process.env, MUSHAVO_PERSONAL_AUDIT_CODE: checker };
  delete env.MUSHAVO_PERSONAL_TEST_OWNER_PASSWORD;
  delete env.MUSHAVO_PERSONAL_TEST_OUTSIDER_PASSWORD;
  const child = spawnSync(process.execPath, ['-e', 'global.fetch=()=>{throw Error("UNEXPECTED_NETWORK");};' + command], { env, encoding: 'utf8' });
  assert.equal(child.status, 1);
  assert.equal(child.stderr, '');
  assert.equal(JSON.parse(child.stdout).problem_code, 'TWO_STAGING_APP_PASSWORDS_REQUIRED');
});
