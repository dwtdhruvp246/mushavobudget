import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {collectPublic, loadExpected, files, selectedHeaders} from '../scripts/check-fr-2-batch-w-public.mjs';
import {verifyEightSources} from '../scripts/lib/auth-eight-source.mjs';
const bytes = new Map(files.map(n => [n, Buffer.from(n === 'config.js' ? 'SYNTHETIC_PUBLIC_CONFIG' : n)]));
const expected = new Map([...bytes].map(([n, b]) => [n, createHash('sha256').update(b).digest('hex')]));
function fixture({redirects = false, inject = () => null} = {}) {
  const calls = [];
  const transport = async (url, options) => {
    calls.push({url, method: options.method, credentials: options.credentials, redirect: options.redirect});
    const injected = await inject(calls.length, url, options); if (injected) return injected;
    const u = new URL(url), clean = u.pathname.replace(/^\//, '');
    const name = clean.includes('.') ? clean : clean + '.html';
    if (redirects && name.endsWith('.html') && clean.endsWith('.html')) return new Response(null, {status: 301, headers: {location: u.pathname.replace('.html', '') + u.search}});
    return new Response(bytes.get(name), {headers: {...selectedHeaders, 'content-type': name.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/javascript'}});
  };
  return {calls, transport};
}
test('current 356 sources and exact accepted owner ZIP receipt validate without HTTP', async () => {
  assert.equal(await verifyEightSources(), 356); assert.equal(loadExpected().size, 5);
});
test('18 direct metadata cases use only fixed public GETs and sanitized output', async () => {
  const f = fixture(), r = await collectPublic(expected, f);
  assert.equal(r.exit_code, 0); assert.equal(r.pass, 18); assert.equal(f.calls.length, 18);
  assert(f.calls.every(x => x.method === 'GET' && x.credentials === 'omit' && x.redirect === 'manual'));
  assert(!JSON.stringify(r).includes('SYNTHETIC_PUBLIC_CONFIG'));
  assert.equal(r.real_Auth_password_policy_enforcement_verified, false); assert.equal(r.hosted_acceptance, false);
});
test('only one fixed clean HTML redirect is followed; maximum is exactly 30 GETs', async () => {
  const f = fixture({redirects: true}), r = await collectPublic(expected, f);
  assert.equal(r.exit_code, 0); assert.equal(r.pass, 18); assert.equal(f.calls.length, 30);
  assert.equal(r.samples.filter(x => x.fixed_clean_path_followed).length, 12);
});
test('every direct failure position stops without retry or raw exception/body output', async () => {
  for (let i = 1; i <= 18; i++) {
    const f = fixture({inject: n => { if (n === i) throw Error('PRIVATE_SENTINEL_NEVER_PRINT'); }});
    const r = await collectPublic(expected, f);
    assert.equal(r.exit_code, 1); assert.equal(f.calls.length, i); assert.equal(r.pass, i - 1);
    assert.equal(r.automatic_retries, 0); assert(!JSON.stringify(r).includes('PRIVATE_SENTINEL_NEVER_PRINT'));
  }
});
test('source/MIME/header drift and foreign, query-changing or repeated redirects never pass', async () => {
  const failures = [
    () => new Response('WRONG', {headers: {...selectedHeaders, 'content-type': 'application/javascript'}}),
    () => new Response(bytes.get('auth-security.js'), {headers: {...selectedHeaders, 'content-type': 'text/html'}}),
    () => new Response(bytes.get('auth-security.js'), {headers: {'content-type': 'application/javascript'}}),
  ];
  for (const fail of failures) {
    const f = fixture({inject: n => n === 1 ? fail() : null}), r = await collectPublic(expected, f);
    assert.equal(r.exit_code, 1); assert.equal(f.calls.length, 1);
  }
  for (const location of ['https://example.invalid/auth', '/auth?unexpected=1', '/auth#fragment']) {
    const f = fixture({inject: n => n === 2 ? new Response(null, {status: 302, headers: {location}}) : null});
    const r = await collectPublic(expected, f); assert.equal(r.exit_code, 1); assert.equal(f.calls.length, 2);
  }
  const f = fixture({inject: n => [2, 3].includes(n) ? new Response(null, {status: 301, headers: {location: '/auth'}}) : null});
  const r = await collectPublic(expected, f); assert.equal(r.exit_code, 1); assert.equal(f.calls.length, 3);
});
test('invalid expectations and elapsed/transport time budgets fail closed without a retry', async () => {
  let calls = 0;
  const bad = await collectPublic(new Map(), {transport: () => { calls++; }});
  assert.equal(bad.exit_code, 1); assert.equal(calls, 0);
  const elapsed = await collectPublic(expected, {totalMs: 0, transport: () => { calls++; }});
  assert.equal(elapsed.exit_code, 1); assert.equal(calls, 0);
  const stalled = await collectPublic(expected, {requestMs: 15, transport: () => { calls++; return new Promise(() => {}); }});
  assert.equal(stalled.problem_code, 'PUBLIC_REQUEST_TIMEOUT'); assert.equal(calls, 1);
});
