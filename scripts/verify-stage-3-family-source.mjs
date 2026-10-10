// Local source validation with provider/Auth/HTTP adapters; no hosted requests.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { run } = require('./check-stage-3-family-api.cjs');
const modulePath = process.argv[2];
if (!modulePath) throw new Error('Supply an externally installed PGlite module path.');
const { PGlite } = await import(pathToFileURL(modulePath));
const db = new PGlite();
const users = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];
const emails = ['audit.owner@example.com', 'audit.outsider@example.com'];
const fixtureSql = await readFile(path.join(root, 'supabase/diagnostics/security_stage_3_family_fixture.sql'), 'utf8');
const tests = [];
const result = (status, data, raw = false) => ({ status, text: async () => raw ? data : JSON.stringify(data) });
const ident = value => { assert.match(value, /^[a-z][a-z0-9_]*$/); return '"' + value + '"'; };
async function context(role, i) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true),set_config('request.jwt.claims',$3,true)",
    [i === undefined ? '' : users[i], role, JSON.stringify(i === undefined ? { role } : { sub: users[i], email: emails[i], role })]);
  await db.exec('set local role ' + ident(role));
}
// Deliberately minimal PostgREST-shaped adapter, not a reproduction of hosted PostgREST.
function adapter(fault) {
  let calls = 0, logouts = 0, fired = false, removed = false;
  const tokens = new Set();
  async function fetcher(raw, options = {}) {
    calls++;
    if (raw === 'https://mushavo-budget-staging.pages.dev/config.js') return result(200, 'window.MUSHAVO_BUDGET_CONFIG = ' + JSON.stringify({ supabaseUrl: 'https://dczlddwbtgvfdujgcitb.supabase.co', supabasePublishableKey: 'sb_publishable_SYNTHETIC_LOCAL_ONLY', vapidPublicKey: '' }) + ';', true);
    const url = new URL(raw), method = options.method || 'GET', body = options.body ? JSON.parse(options.body) : {};
    const token = options.headers?.Authorization?.replace('Bearer ', ''), i = token ? Number(token.slice(-1)) : undefined;
    if (url.pathname === '/auth/v1/token') { const account = emails.indexOf(body.email); assert.notEqual(account, -1); const access = 'LOCAL_FAKE_TOKEN_' + account; tokens.add(access); return result(200, { access_token: access, user: { id: users[account], email: emails[account] } }); }
    if (url.pathname === '/auth/v1/user') return result(200, { id: users[i], email: emails[i] });
    if (url.pathname === '/auth/v1/logout') { logouts++; assert.equal(url.searchParams.get('scope'), 'local'); return result(fault === 'logout' ? 500 : 204, null); }
    await db.exec('savepoint api_request');
    try {
      await context(i === undefined ? 'anon' : 'authenticated', i);
      let response;
      if (url.pathname.startsWith('/rest/v1/rpc/')) {
        const name = url.pathname.slice('/rest/v1/rpc/'.length), entries = Object.entries(body);
        const args = entries.map(([key], index) => ident(key) + ' => $' + (index + 1)).join(',');
        const isTable = name === 'effective_workspace_entitlement';
        const query = 'select ' + (isTable ? '*' : 'public.' + ident(name) + '(' + args + ') as value') + (isTable ? ' from public.' + ident(name) + '(' + args + ')' : '');
        const rows = (await db.query(query, entries.map(x => x[1]))).rows;
        response = result(200, isTable ? rows : rows[0].value);
        if (name === 'remove_family_member' && response.status === 200) removed = true;
      } else {
        const table = url.pathname.slice('/rest/v1/'.length), params = [], cols = (url.searchParams.get('select') || '*').split(',').map(ident).join(',');
        const filters = [...url.searchParams].filter(([key]) => !['select', 'limit'].includes(key));
        const where = filters.length ? ' where ' + filters.map(([key, value]) => { assert(value.startsWith('eq.')); params.push(value.slice(3)); return ident(key) + ' = $' + params.length; }).join(' and ') : '';
        let sql;
        if (method === 'GET') sql = 'select ' + cols + ' from public.' + ident(table) + where + (url.searchParams.has('limit') ? ' limit ' + Number(url.searchParams.get('limit')) : '');
        if (method === 'DELETE') sql = 'delete from public.' + ident(table) + where + ' returning ' + cols;
        if (method === 'PATCH') { const sets = Object.entries(body).map(([key, value]) => { params.push(value); return ident(key) + ' = $' + params.length; }); sql = 'update public.' + ident(table) + ' set ' + sets.join(',') + where + ' returning ' + cols; }
        if (method === 'POST') { const entries = Object.entries(body); sql = 'insert into public.' + ident(table) + '(' + entries.map(([key]) => ident(key)).join(',') + ') values (' + entries.map(([, value]) => { params.push(value); return '$' + params.length; }).join(',') + ') returning ' + cols; }
        const rows = (await db.query(sql, params)).rows;
        response = result(method === 'POST' ? 201 : 200, rows);
        if (!fired && fault === 'removed_read' && removed && i === 1 && table === 'payment_items' && method === 'GET') {
          await db.exec('reset role'); response = result(200, (await db.query('select ' + cols + ' from public.' + ident(table) + where, params)).rows); fired = true;
        }
        if (!fired && fault === 'hidden_write' && i === 1 && table === 'payment_items' && method === 'PATCH' && !removed) {
          await context('postgres', 0); await db.query('update public.payment_items set notes=$2 where id=$1', [filters.find(([k]) => k === 'id')[1].slice(3), body.notes]); response = result(403, { code: '42501' }); fired = true;
        }
      }
      await db.exec('reset role; release savepoint api_request'); return response;
    } catch (error) {
      await db.exec('rollback to savepoint api_request; reset role; release savepoint api_request');
      const data = { code: error.code, message: error.message };
      if (!fired && fault === 'false_denial' && error.code === 'P0001') { fired = true; return result(400, { code: '23503', message: 'Synthetic FK error' }); }
      return result(error.code === '42501' ? 403 : 400, data);
    }
  }
  return { fetcher, counters: () => ({ calls, logouts, fired, tokens: tokens.size }) };
}
async function batch(fault, expected) {
  await db.exec('begin');
  try {
    const api = adapter(fault);
    const receipt = await run({ fetcher: api.fetcher, ownerPassword: 'LOCAL_DUMMY_OWNER', outsiderPassword: 'LOCAL_DUMMY_MEMBER' });
    assert.equal(receipt.problem_code, expected, JSON.stringify({ problem: receipt.problem_code, last: receipt.checks.slice(-2) }));
    assert.equal(receipt.result, expected ? 'STAGING_FAMILY_API_REVIEW' : 'STAGING_FAMILY_API_SCOPED_PASS');
    const counters = api.counters(); assert.equal(counters.logouts, 2);
    assert(!JSON.stringify(receipt).includes(users[0]) && !JSON.stringify(receipt).includes('LOCAL_FAKE_TOKEN_'));
    if (!expected) { assert.equal(receipt.member_contribution_rows_removed, true); assert(counters.calls < 300); }
    tests.push({ test: fault || 'source Family lifecycle', status: 'PASS', acceptance_checks: receipt.checks.filter(x => x.status === 'PASS').length, requests: counters.calls });
  } finally { await db.exec('rollback'); }
}
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage; create schema extensions;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb,created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
    create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),auth.jwt()->>'role')$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text);
    create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
    grant usage on schema auth,storage,public to anon,authenticated,service_role;grant select,insert,update,delete on storage.objects to authenticated;
    -- Model hosted broad default grants before migrations, so later explicit revokes remain effective.
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
    alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;`);
  const migrations = (await readdir(path.join(root, 'supabase/migrations'))).filter(n => n.endsWith('.sql')).sort();
  for (const name of migrations) {
    const source = await readFile(path.join(root, 'supabase/migrations', name), 'utf8');
    // gen_random_uuid is built in; unavailable pgcrypto is not claimed recovered.
    await db.exec(source.replace(/^create extension if not exists pgcrypto;\s*$/gim, ''));
  }
  await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)', [users[0], emails[0], users[1], emails[1]]);
  // Guard checks are rolled back. They cannot alter the baseline fixtures.
  for (const [name, setup, expected] of [
    ['extra Auth account', "insert into auth.users(id,email) values(gen_random_uuid(),'synthetic.extra@example.com')", 'EXPECTED_TWO_SYNTHETIC_STAGING_AUTH_USERS'],
    ['suspended account', "update public.profiles set account_status='suspended' where id='" + users[1] + "'", 'EXPECTED_ORDINARY_ACTIVE_SYNTHETIC_PROFILES'],
    ['unreviewed notification trigger', "create function public.s322_extra_trigger() returns trigger language plpgsql as $$begin return new; end$$; create trigger s322_extra before insert on public.notifications for each row execute function public.s322_extra_trigger()", 'UNREVIEWED_NOTIFICATION_TRIGGER'],
  ]) {
    await db.exec('begin'); await db.exec(setup);
    let actual; try { await db.exec(fixtureSql.replace(/^BEGIN;/m, '').replace(/^COMMIT;/m, '')); } catch (e) { actual = e.message; }
    await db.exec('rollback'); assert.equal(actual, expected); assert.equal((await db.query('select count(*)::int as n from public.families')).rows[0].n, 0);
    tests.push({ test: 'fixture guard: ' + name, status: 'PASS' });
  }
  const fixtureRows = (await db.exec(fixtureSql)).flatMap(r => r.rows || []).filter(r => r.check_name);
  assert.deepEqual(fixtureRows.map(r => r.status), ['INFO', 'PASS', 'INFO', 'REVIEW']);
  const before = (await db.query('select count(*)::int as n from public.families')).rows[0].n;
  let repeated; try { await db.exec(fixtureSql); } catch (e) { repeated = e.message; await db.exec('rollback'); }
  assert.equal(repeated, 'STAGING_FAMILY_FIXTURE_REQUIRES_NO_EXISTING_FAMILIES');
  assert.equal((await db.query('select count(*)::int as n from public.families')).rows[0].n, before);
  tests.push({ test: 'fixture once-only transaction and four-row receipt', status: 'PASS' });
  await batch(null, null);
  await batch('hidden_write', 'PROTECTED_ROW_CHANGED');
  await batch('false_denial', 'HEAD_FOREIGN_FAMILY_MANAGEMENT_NOT_DENIED');
  await batch('removed_read', 'REMOVED_MEMBER_FAMILY_READ_EXPOSED');
  await batch('logout', 'TEST_SESSION_LOGOUT_FAILED');
  console.log(JSON.stringify({ stage_step: '3.2.2', result: 'LOCAL_FAMILY_SOURCE_AND_CHECKER_PASS', migration_count: migrations.length, tests,
    provider_auth_storage_default_grant_and_http_adapters_used: true, native_PostgreSQL_or_hosted_PostgREST_verified: false,
    email_push_edge_UI_or_real_role_bootstrap_verified: false, production_staging_or_native_changed: false }, null, 2));
} finally { await db.close(); }
