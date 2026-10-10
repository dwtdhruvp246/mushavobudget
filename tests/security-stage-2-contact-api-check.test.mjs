import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createHandler } from '../supabase/functions/submit-enquiry/handler.mjs';
const require = createRequire(import.meta.url);
const { run, STAGING, WEBSITE } = require('../scripts/check-staging-contact-api.cjs');
const key = 'sb_publishable_local_test_fixture';
const password = 'private_password_never_print';
const token = 'private_session_token_never_print';
function fixture({ bypass = false, badDenial = false, productionConfig = false, alteredSite = false } = {}) {
  const calls = [];
  const handler = createHandler({ configuration: { supabaseUrl: STAGING, origin: WEBSITE,
    backendKey: 'sb_secret_private_fixture', turnstileSecret: 'real_format_secret_for_local_fixture', quotaSecret: 'a'.repeat(64) },
    fetchImpl: async () => Response.json({ success: false, 'error-codes': ['invalid-input-response'] }) });
  const config = { supabaseUrl: productionConfig ? 'https://kttkospkblwvguuwnhjj.supabase.co' : STAGING,
    supabasePublishableKey: key, vapidPublicKey: '' };
  const site = fs.readFileSync(new URL('../site.js', import.meta.url), 'utf8') + (alteredSite ? '\n// different deployment' : '');
  const html = fs.readFileSync(new URL('../contact.html', import.meta.url), 'utf8')
    .replace('kttkospkblwvguuwnhjj', 'dczlddwbtgvfdujgcitb').replace('data-sitekey=""', 'data-sitekey="0xPUBLIC_FIXTURE_SITEKEY"');
  const headers = { 'Content-Security-Policy': "object-src 'none'; frame-ancestors 'none'",
    'Content-Security-Policy-Report-Only': "script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com" };
  const fetcher = async (url, options = {}) => {
    calls.push({ url, options });
    if (url === WEBSITE + '/config.js') return new Response('window.MUSHAVO_BUDGET_CONFIG = ' + JSON.stringify(config) + ';');
    if (url === WEBSITE + '/site.js') return new Response(site);
    if (url === WEBSITE + '/contact') return new Response(html, { headers });
    if (url === STAGING + '/functions/v1/submit-enquiry') return handler(new Request(url, options));
    if (url === STAGING + '/auth/v1/token?grant_type=password') return Response.json({ access_token: token,
      user: { id: 'private_user_id', email: 'audit.owner@example.com' } });
    if (url === STAGING + '/auth/v1/user') return Response.json({ id: 'private_user_id', email: 'audit.owner@example.com' });
    if (url === STAGING + '/auth/v1/logout?scope=local') return new Response(null, { status: 204 });
    if (url.startsWith(STAGING + '/rest/v1/')) {
      if (bypass && url.endsWith('/enquiries')) return Response.json([{ id: 'private_inserted_id' }], { status: 201 });
      if (badDenial && url.includes('/rpc/')) return Response.json({ code: 'PGRST301', message: 'invalid JWT private details' }, { status: 401 });
      return Response.json({ code: '42501', message: 'permission denied private details' }, { status: 403 });
    }
    throw Error('Unexpected fixture request');
  };
  return { fetcher, calls };
}
test('checker exercises real handler rejection paths and role API checks, and redacts private results', async () => {
  const f = fixture(); const result = await run({ fetcher: f.fetcher, password, now: () => Date.UTC(2026, 9, 10, 9) });
  assert.equal(result.result, 'STAGING_CONTACT_API_SCOPED_PASS');
  assert.equal(result.checks.length, 18);
  assert.ok(result.checks.every(check => check.status === 'PASS'));
  assert.equal(result.test_session_logged_out, true);
  const serialized = JSON.stringify(result);
  for (const secret of [password, token, key, 'private_user_id', 'private details']) assert.ok(!serialized.includes(secret));
  assert.equal(f.calls.filter(call => call.url.includes('/auth/v1/logout?scope=local')).length, 1);
});
test('unexpected successful direct INSERT is a failed check, never a passing denial', async () => {
  const f = fixture({ bypass: true }); const result = await run({ fetcher: f.fetcher, password });
  assert.equal(result.result, 'STAGING_CONTACT_API_REVIEW');
  assert.equal(result.checks.filter(check => check.check.includes('direct enquiry INSERT') && check.status === 'FAIL').length, 2);
  assert.ok(!JSON.stringify(result).includes('private_inserted_id'));
});
test('JWT errors with HTTP 401 do not prove a permission denial', async () => {
  const f = fixture({ badDenial: true }); const result = await run({ fetcher: f.fetcher, password });
  assert.equal(result.result, 'STAGING_CONTACT_API_REVIEW');
  assert.equal(result.checks.filter(check => check.check.includes('submission RPC') && check.status === 'FAIL').length, 2);
});
test('production config or a changed frontend stops before backend requests', async () => {
  for (const options of [{ productionConfig: true }, { alteredSite: true }]) {
    const f = fixture(options); const result = await run({ fetcher: f.fetcher, password });
    assert.equal(result.result, 'STAGING_CONTACT_API_REVIEW');
    assert.ok(result.problem_code);
    assert.equal(f.calls.filter(call => call.url.startsWith(STAGING)).length, 0);
  }
});
test('omitting the test password reports signed-in checks unverified', async () => {
  const f = fixture(); const result = await run({ fetcher: f.fetcher });
  assert.equal(result.result, 'STAGING_CONTACT_API_SCOPED_PASS_SIGNED_IN_UNVERIFIED');
  assert.equal(result.checks.at(-1).status, 'UNVERIFIED');
  assert.equal(f.calls.filter(call => call.url.includes('/auth/v1/')).length, 0);
});
