import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { createHandler, readConfiguration, MAX_BODY_BYTES } from '../supabase/functions/submit-enquiry/handler.mjs';

const require = createRequire(import.meta.url);
const { prepareContact } = require('../scripts/prepare-stage-2-contact.cjs');
const { STAGING, PRODUCTION, PUBLIC_FILES } = require('../scripts/prepare-stage-2-headers.cjs');
const root = new URL('../', import.meta.url);
const sourceSite = fs.readFileSync(new URL('site.js', root), 'utf8');
const sourceHtml = fs.readFileSync(new URL('contact.html', root), 'utf8');
const time = Date.parse('2026-10-09T19:01:00Z');
const configuration = {
  supabaseUrl: `https://${STAGING}.supabase.co`, origin: 'https://mushavo-budget-staging.pages.dev',
  backendKey: 'sb_secret_LOCAL_FIXTURE_ONLY', turnstileSecret: '0xLOCAL_SECRET_FIXTURE_ONLY', quotaSecret: 'ab'.repeat(32),
};
const submission = {
  full_name: '  Synthetic User  ', email: '  TEST@example.invalid ', country_code: 'us', country_name: 'Not the real country',
  enquiry_type: 'support', message: 'Synthetic enquiry for local tests only.', turnstile_token: 'synthetic-token', website: '',
};
const validChallenge = () => ({ success: true, hostname: new URL(configuration.origin).hostname,
  action: 'public_contact', challenge_ts: new Date(time - 1000).toISOString() });

function request(body = submission, options = {}) {
  return new Request(configuration.supabaseUrl + '/functions/v1/submit-enquiry', {
    method: 'POST', headers: { Origin: configuration.origin, 'Content-Type': 'application/json', ...options.headers },
    body: typeof body === 'string' ? body : JSON.stringify(body), ...options,
    // options.headers must merge the defaults above.
    ...(options.headers ? { headers: { Origin: configuration.origin, 'Content-Type': 'application/json', ...options.headers } } : {}),
  });
}
function fixture(options = {}) {
  const calls = [];
  const seen = new Set();
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    if (url.includes('/siteverify')) {
      if (options.challengeThrows) throw new Error('private-provider-value');
      const token = JSON.parse(init.body).response;
      let result = options.challenge ?? validChallenge();
      if (options.replay) { if (seen.has(token)) result = { success: false, 'error-codes': ['timeout-or-duplicate'] }; seen.add(token); }
      return Response.json(result, { status: options.challengeStatus || 200 });
    }
    if (options.rpcThrows) throw new Error('private-db-value');
    return Response.json(options.receipt ?? { accepted: true }, { status: options.rpcStatus || 200 });
  };
  return { calls, handler: createHandler({ configuration: options.configuration === undefined ? configuration : options.configuration,
    fetchImpl, now: () => time }) };
}

test('allowed submission verifies challenge, canonicalizes fields, hashes email and calls only the service RPC', async () => {
  const f = fixture(), response = await f.handler(request());
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { accepted: true });
  assert.equal(response.headers.get('access-control-allow-origin'), configuration.origin);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.equal(f.calls[0].init.redirect, 'error');
  assert.ok(!Object.hasOwn(f.calls[0].body, 'remoteip'));
  const rpc = f.calls[1];
  assert.equal(rpc.url, configuration.supabaseUrl + '/rest/v1/rpc/submit_verified_public_enquiry');
  assert.equal(rpc.init.headers.apikey, configuration.backendKey);
  assert.equal(rpc.init.headers.Authorization, undefined);
  assert.deepEqual(rpc.body.p_submission, { full_name: 'Synthetic User', email: 'test@example.invalid',
    country_code: 'US', country_name: 'United States', enquiry_type: 'support', message: submission.message });
  const expected = createHmac('sha256', Buffer.from(configuration.quotaSecret, 'hex')).update('public_contact:email:test@example.invalid').digest('hex');
  assert.equal(rpc.body.p_email_hash, expected);
  assert.equal(JSON.stringify(rpc.body).includes(submission.turnstile_token), false);
});

test('valid preflight allows only the reviewed origin, method and headers without contacting providers', async () => {
  const f = fixture();
  const response = await f.handler(new Request(configuration.supabaseUrl, { method: 'OPTIONS', headers: {
    Origin: configuration.origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Content-Type, apikey' } }));
  assert.equal(response.status, 204); assert.equal(f.calls.length, 0);
  const denied = await f.handler(new Request(configuration.supabaseUrl, { method: 'OPTIONS', headers: {
    Origin: configuration.origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Authorization' } }));
  assert.equal(denied.status, 403); assert.equal(f.calls.length, 0);
});

test('missing/foreign/production origins and unsupported methods do not reach challenge or database', async () => {
  for (const origin of ['', 'null', 'https://attacker.invalid', 'https://mushavobudget.com', configuration.origin + '.attacker.invalid']) {
    const f = fixture(), response = await f.handler(request(submission, { headers: { Origin: origin } }));
    assert.equal(response.status, 403); assert.equal(response.headers.get('access-control-allow-origin'), null); assert.equal(f.calls.length, 0);
  }
  const f = fixture(), response = await f.handler(new Request(configuration.supabaseUrl, { method: 'GET', headers: { Origin: configuration.origin } }));
  assert.equal(response.status, 405); assert.equal(f.calls.length, 0);
});

test('malformed, non-JSON and oversized bodies are rejected before outbound requests', async () => {
  for (const [req, status] of [
    [request('{broken'), 400], [request(submission, { headers: { 'Content-Type': 'text/plain' } }), 415],
    [request('x'.repeat(MAX_BODY_BYTES + 1)), 413],
    [request(submission, { headers: { 'Content-Length': String(MAX_BODY_BYTES + 1) } }), 413],
  ]) { const f = fixture(), response = await f.handler(req); assert.equal(response.status, status); assert.equal(f.calls.length, 0); }
});

test('streamed bodies cannot bypass the byte limit by omitting Content-Length', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_BODY_BYTES + 1)); }, cancel() { cancelled = true; } });
  const f = fixture(), response = await f.handler(new Request(configuration.supabaseUrl, { method: 'POST', duplex: 'half',
    headers: { Origin: configuration.origin, 'Content-Type': 'application/json' }, body: stream }));
  assert.equal(response.status, 413); assert.equal(f.calls.length, 0); assert.equal(cancelled, true);
});

test('unknown admin fields, invalid field types, bounds, countries and honeypots fail before verification', async () => {
  const invalid = [null, [], { ...submission, status: 'resolved' }, { ...submission, user_id: 'forged' },
    { ...submission, website: 'spam' }, { ...submission, website: {} }, { ...submission, full_name: 'x' },
    { ...submission, full_name: 'x'.repeat(121) }, { ...submission, email: 'bad@' }, { ...submission, country_code: 'ZZ' },
    { ...submission, enquiry_type: 'admin' }, { ...submission, message: 'short' }, { ...submission, message: 'x'.repeat(5001) },
    { ...submission, message: '\u0000'.repeat(10) }, { ...submission, country_name: [] }, { ...submission, turnstile_token: [] },
  ];
  for (const input of invalid) { const f = fixture(), response = await f.handler(request(input)); assert.equal(response.status, 400); assert.equal(f.calls.length, 0); }
});

test('missing, blank or overlong tokens fail before provider or database access', async () => {
  for (const token of [undefined, '', ' ', 'x'.repeat(2049)]) {
    const f = fixture(), response = await f.handler(request({ ...submission, turnstile_token: token }));
    assert.equal(response.status, 400); assert.equal(f.calls.length, 0);
  }
});

test('failed, wrong-host/action, expired, future and missing-timestamp challenges never reach the database', async () => {
  for (const challenge of [{ success: false }, { ...validChallenge(), hostname: 'mushavobudget.com' },
    { ...validChallenge(), action: 'login' }, { ...validChallenge(), challenge_ts: new Date(time - 300001).toISOString() },
    { ...validChallenge(), challenge_ts: new Date(time + 30001).toISOString() }, { ...validChallenge(), challenge_ts: undefined }]) {
    const f = fixture({ challenge }), response = await f.handler(request());
    assert.equal(response.status, 400); assert.equal(f.calls.length, 1);
  }
});

test('Siteverify duplicate-token rejection prevents a second RPC (provider mock, not hosted replay proof)', async () => {
  const f = fixture({ replay: true });
  assert.equal((await f.handler(request())).status, 200);
  assert.equal((await f.handler(request())).status, 400);
  assert.equal(f.calls.filter(call => call.url.includes('/rpc/')).length, 1);
});

test('challenge provider errors fail closed with no raw upstream values and no RPC', async () => {
  for (const options of [{ challengeThrows: true }, { challengeStatus: 500 },
    { challenge: { success: false, 'error-codes': ['invalid-input-secret'] } }]) {
    const f = fixture(options), response = await f.handler(request());
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { code: 'SERVICE_UNAVAILABLE' });
    assert.equal(f.calls.length, 1);
  }
});

test('durable quota receipt maps to 429/Retry-After without exposing a hash or enquiry', async () => {
  const f = fixture({ receipt: { accepted: false, retry_after_seconds: 42 } }), response = await f.handler(request());
  assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '42');
  assert.deepEqual(await response.json(), { code: 'SUBMISSION_LIMIT', retry_after_seconds: 42 });
});

test('database errors and malformed quota receipts never report success or expose messages', async () => {
  for (const options of [{ rpcThrows: true }, { rpcStatus: 500 }, { receipt: {} },
    { receipt: { accepted: false, retry_after_seconds: 0 } }]) {
    const f = fixture(options), response = await f.handler(request());
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { code: 'SERVICE_UNAVAILABLE' });
  }
});

test('runtime configuration binds exact projects, prefers new keys and refuses dummy challenge secrets', async () => {
  const values = { SUPABASE_URL: configuration.supabaseUrl, SUPABASE_SECRET_KEYS: JSON.stringify({ default: configuration.backendKey }),
    MUSHAVO_CONTACT_TURNSTILE_SECRET: configuration.turnstileSecret, MUSHAVO_CONTACT_QUOTA_SECRET: configuration.quotaSecret };
  const read = updates => readConfiguration(key => ({ ...values, ...updates })[key]);
  assert.equal(read({}).origin, configuration.origin);
  assert.equal(read({ SUPABASE_URL: `https://${PRODUCTION}.supabase.co` }).origin, 'https://mushavobudget.com');
  for (const updates of [{ SUPABASE_URL: configuration.supabaseUrl + '/' }, { SUPABASE_URL: 'https://unknown.supabase.co' },
    { MUSHAVO_CONTACT_TURNSTILE_SECRET: '1x0000000000000000000000000000000AA' },
    { MUSHAVO_CONTACT_QUOTA_SECRET: 'short' }, { SUPABASE_SECRET_KEYS: '{}' },
    { SUPABASE_SECRET_KEYS: 'null' }, { SUPABASE_URL: 'constructor' }]) assert.equal(read(updates), null);
  const f = fixture({ configuration: null }), response = await f.handler(request());
  assert.equal(response.status, 503); assert.equal(f.calls.length, 0);
  const legacy = read({ SUPABASE_SECRET_KEYS: '', SUPABASE_SERVICE_ROLE_KEY: 'eyJ_LOCAL.JWT.FIXTURE' });
  assert.ok(legacy);
  const old = fixture({ configuration: legacy }); assert.equal((await old.handler(request())).status, 200);
  assert.equal(old.calls[1].init.headers.Authorization, 'Bearer eyJ_LOCAL.JWT.FIXTURE');
});

function browserFixture({ sitekey = '0xLOCAL_PUBLIC_SITEKEY', fetchImpl = async () => Response.json({ accepted: true }) } = {}) {
  const callbacks = {}, requests = [], reset = [];
  const element = () => ({ textContent: '', dataset: {}, classList: { values: new Set(), add(value) { this.values.add(value); },
    remove(value) { this.values.delete(value); } }, addEventListener() {}, focus() {} });
  const selectors = {};
  for (const id of ['enquirySubmit','enquiryError','enquiryCountry','enquiryVerification','enquiryVerificationStatus',
    'enquiryMessage','enquiryMessageCount','enquirySuccess']) selectors['#' + id] = element();
  selectors['#enquiryVerification'].dataset.sitekey = sitekey;
  selectors['#enquiryCountry'].options = [{ value: 'US' }]; selectors['#enquiryCountry'].selectedOptions = [{ textContent: 'United States' }];
  selectors['#enquiryCountry'].insertAdjacentHTML = () => {};
  const form = { ...element(), reportValidity: () => true, reset() { this.resetCalled = true; }, querySelector: () => element() };
  selectors['#enquiryForm'] = form; selectors['[data-new-enquiry]'] = element();
  const document = { querySelector: selector => selectors[selector] || null, documentElement: { lang: 'en' },
    createElement: tag => { const e = element(); if (tag === 'div') Object.defineProperty(e, 'innerHTML', { get: () => e.textContent }); return e; },
    head: { appendChild(script) { script.onload(); } } };
  const window = { MUSHAVO_BUDGET_CONFIG: { supabaseUrl: configuration.supabaseUrl, supabasePublishableKey: 'sb_publishable_LOCAL' },
    location: { search: '' }, turnstile: { render(_container, options) { Object.assign(callbacks, options); return 0; }, reset(id) { reset.push(id); } } };
  const context = vm.createContext({ window, document, navigator: { language: 'en-US' }, Intl, URLSearchParams, AbortController, setTimeout, clearTimeout,
    fixtureForm: form, FormData: class { entries() { return Object.entries(submission); } },
    fetch: async (...args) => { requests.push(args); return fetchImpl(...args); } });
  vm.runInContext(sourceSite, context);
  const submit = () => vm.runInContext('submitEnquiry({preventDefault(){}, currentTarget: fixtureForm})', context);
  return { callbacks, requests, reset, selectors, form, submit };
}

test('browser keeps the button disabled without verification and expired tokens cannot submit', async () => {
  const f = browserFixture(); assert.equal(f.selectors['#enquirySubmit'].disabled, true);
  await f.submit(); assert.equal(f.requests.length, 0);
  f.callbacks.callback('fresh'); assert.equal(f.selectors['#enquirySubmit'].disabled, false);
  f.callbacks['expired-callback'](); await f.submit(); assert.equal(f.requests.length, 0);
  assert.equal(f.selectors['#enquirySubmit'].disabled, true);
  const unconfigured = browserFixture({ sitekey: '' });
  assert.match(unconfigured.selectors['#enquiryVerificationStatus'].textContent, /support@mushavobudget/);
  assert.equal(unconfigured.selectors['#enquirySubmit'].disabled, true);
});

test('browser sends only to the Edge endpoint, handles success, and resets the consumed token', async () => {
  const f = browserFixture(); f.callbacks.callback('fresh'); await f.submit();
  assert.equal(f.requests.length, 1); const [url, init] = f.requests[0];
  assert.equal(url, configuration.supabaseUrl + '/functions/v1/submit-enquiry');
  assert.equal(init.headers.Authorization, undefined); assert.equal(init.credentials, 'omit');
  assert.equal(JSON.parse(init.body).turnstile_token, 'fresh');
  assert.equal(f.form.resetCalled, true); assert.equal(f.form.classList.values.has('hidden'), true);
  assert.equal(f.reset.length, 1); assert.equal(f.selectors['#enquirySubmit'].disabled, true);
});

test('browser keeps entered details on quota or provider failure and uses safe helpful error text', async () => {
  for (const status of [400, 429, 503]) {
    const f = browserFixture({ fetchImpl: async () => Response.json({ message: 'private-upstream-value' }, { status }) });
    f.callbacks.callback('fresh'); await f.submit();
    assert.equal(f.form.resetCalled, undefined); assert.equal(f.form.classList.values.has('hidden'), false);
    const message = f.selectors['#enquiryError'].textContent;
    assert.ok(!message.includes('private-upstream-value'));
    if (status === 429) assert.match(message, /limit/);
    assert.equal(f.reset.length, 1); assert.equal(f.selectors['#enquirySubmit'].disabled, true);
  }
});

test('browser prevents concurrent clicks from submitting a token twice', async () => {
  let release; const result = new Promise(resolve => { release = resolve; });
  const f = browserFixture({ fetchImpl: () => result }); f.callbacks.callback('fresh');
  const first = f.submit(); await f.submit(); assert.equal(f.requests.length, 1);
  release(Response.json({ accepted: true })); await first;
});

function webFixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mushavo-contact-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'source'), output = path.join(directory, 'web'); fs.mkdirSync(source);
  for (const name of PUBLIC_FILES) {
    const full = path.join(source, name); fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, name.endsWith('.html') ? '<!doctype html>' : 'synthetic-public-fixture');
  }
  fs.writeFileSync(path.join(source, 'config.js'), 'window.MUSHAVO_BUDGET_CONFIG = ' + JSON.stringify({
    supabaseUrl: configuration.supabaseUrl, supabasePublishableKey: 'sb_publishable_LOCAL', vapidPublicKey: '' }) + ';');
  fs.writeFileSync(path.join(source, 'private-secret.env'), 'excluded');
  return { source, output, directory };
}

test('staging overlay preserves the old folder, excludes private files and permits only the challenge host in CSP', t => {
  const f = webFixture(t), old = fs.readFileSync(path.join(f.source, 'site.js'));
  const r = prepareContact(f.source, f.output, '0xLOCAL_PUBLIC_SITEKEY');
  assert.equal(r.stage_step, '2.2.2'); assert.equal(r.public_files, 35); assert.equal(r.database_gate_applied, false);
  assert.deepEqual(fs.readFileSync(path.join(f.source, 'site.js')), old);
  assert.equal(fs.existsSync(path.join(f.output, 'private-secret.env')), false);
  assert.equal(fs.existsSync(path.join(f.output, 'supabase')), false);
  const html = fs.readFileSync(path.join(f.output, 'contact.html'), 'utf8');
  assert.ok(html.includes('data-sitekey="0xLOCAL_PUBLIC_SITEKEY"')); assert.ok(!html.includes(PRODUCTION));
  const policy = fs.readFileSync(path.join(f.output, '_headers'), 'utf8');
  assert.ok(policy.includes('frame-src https://challenges.cloudflare.com')); assert.ok(policy.includes("frame-ancestors 'none'"));
  assert.equal(policy.includes('https://*.cloudflare.com'), false);
});

test('staging builder rejects a secret/test key or changed candidate before creating the web output', t => {
  for (const key of ['sb_secret_PRIVATE', '1x00000000000000000000AA', '0x"><script>']) {
    const f = webFixture(t); assert.throws(() => prepareContact(f.source, f.output, key)); assert.equal(fs.existsSync(f.output), false);
  }
  const f = webFixture(t); assert.throws(() => prepareContact(f.source, f.output, '0xLOCAL_PUBLIC_SITEKEY',
    { site: sourceSite, html: sourceHtml.replace('data-sitekey=""', '') })); assert.equal(fs.existsSync(f.output), false);
});
