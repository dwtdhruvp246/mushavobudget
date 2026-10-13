import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectPublicMetadata, loadReviewedSources, parseCollectionArguments, STAGING_ORIGIN, STAGING_PROJECT,
  TARGETS, validateContract } from '../scripts/lib/stage-10-public-metadata.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(await readFile(resolve(root, 'docs/security-audit/security-stage-10-operations-candidate-contract.json'), 'utf8'));
const reviewedSources = await loadReviewedSources(root, contract);
const hash = text => createHash('sha256').update(text).digest('hex');
const sourceBodies = new Map(await Promise.all(TARGETS.map(async t => [t.route,
  t.source === 'config.js' ? `window.config={supabaseUrl:'https://${STAGING_PROJECT}.supabase.co',publicKey:'sb_publishable_synthetic'};`
    : (await readFile(resolve(root, t.source), 'utf8')).replace(/\r\n?/g, '\n').split('kttkospkblwvguuwnhjj').join(STAGING_PROJECT)])));
function responseFor(url, overrides = {}) {
  const target = TARGETS.find(t => url === `${STAGING_ORIGIN}/${t.route}`);
  assert.ok(target, 'Only a fixed staging target may be requested');
  return new Response(overrides.body ?? sourceBodies.get(target.route), { status: overrides.status ?? 200,
    headers: { 'content-type': overrides.type ?? (target.type === 'html' ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8') } });
}
const collect = options => collectPublicMetadata({ reviewedSources, sourcePin: contract.source_parent_commit,
  fetchImpl: async url => responseFor(url), ...options });
async function fixture(run) {
  const base = await mkdtemp(resolve(tmpdir(), 'mushavo-op-metadata-'));
  const path = resolve(base, 'source space % #');
  await mkdir(path);
  for (const t of TARGETS) await copyFile(resolve(root, t.source), resolve(path, t.source));
  try { return await run(path, base); } finally { await rm(base, { recursive: true, force: true }); }
}

test('current actual sources load with fixed ordered target identities', async () => {
  assert.deepEqual(reviewedSources.map(t => t.source), TARGETS.map(t => t.source));
  assert.equal(reviewedSources.length, 9);
  assert.ok(reviewedSources.every(t => /^[a-f0-9]{64}$/.test(t.normalized_staging_overlay_sha256)));
});
test('changed actual local source is rejected before collection', async () => fixture(async path => {
  await writeFile(resolve(path, 'auth-flows.js'), 'unexpected code');
  await assert.rejects(loadReviewedSources(path, contract), /REVIEWED_SOURCE_HASH_MISMATCH/);
}));
test('ordinary source paths with spaces percent hash and CRLF remain valid', async () => fixture(async path => {
  for (const t of TARGETS) {
    const text = await readFile(resolve(path, t.source), 'utf8');
    await writeFile(resolve(path, t.source), text.replace(/\r\n?/g, '\n').replace(/\n/g, '\r\n'));
  }
  assert.equal((await loadReviewedSources(path, contract)).length, 9);
}));
test('missing reviewed source is denied without raw path disclosure', async () => fixture(async path => {
  await rm(resolve(path, 'auth-security.js'));
  await assert.rejects(loadReviewedSources(path, contract), error => error.code === 'ORDINARY_REVIEWED_SOURCE_REQUIRED');
}));
test('actual redirected source root is rejected using a directory link or Windows junction', async () => fixture(async (path, base) => {
  const alias = resolve(base, 'source-alias');
  await symlink(path, alias, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(loadReviewedSources(alias, contract), /ORDINARY_SOURCE_ROOT_REQUIRED/);
}));
test('contract cannot add a production URL arbitrary source or extra request', () => {
  for (const changes of [{ origin: 'https://mushavobudget.com' }, { project: 'kttkospkblwvguuwnhjj' },
    { source_targets: [...contract.source_targets, contract.source_targets[0]] }]) {
    assert.throws(() => validateContract({ ...contract, ...changes }), /REVIEWED_SOURCE_CONTRACT_REQUIRED/);
  }
  const changed = JSON.parse(JSON.stringify(contract));
  changed.source_targets[0].route = '../../functions/v1/dispatch-push-reminders';
  assert.throws(() => validateContract(changed), /FIXED_STAGING_TARGETS_REQUIRED/);
});
test('CLI arguments require exact staging confirmation and reviewed source pin', () => {
  parseCollectionArguments(['--collect-public-staging-metadata', `--confirm-staging=${STAGING_PROJECT}`,
    `--source-pin=${contract.source_parent_commit}`], contract.source_parent_commit);
  for (const args of [[], ['--url=https://mushavobudget.com'], ['--collect-public-staging-metadata', '--confirm-staging=kttkospkblwvguuwnhjj',
    `--source-pin=${contract.source_parent_commit}`], ['--collect-public-staging-metadata', `--confirm-staging=${STAGING_PROJECT}`, '--source-pin=incorrect']]) {
    assert.throws(() => parseCollectionArguments(args, contract.source_parent_commit), /EXACT_PUBLIC_STAGING_ARGUMENTS_REQUIRED/);
  }
});
test('actual collector uses nine fixed GETs manual redirects omitted credentials and no authorization', async () => {
  const calls = [];
  const receipt = await collect({ fetchImpl: async (url, options) => { calls.push([url, options]); return responseFor(url); } });
  assert.equal(calls.length, 9);
  assert.deepEqual(calls.map(c => c[0]), TARGETS.map(t => `${STAGING_ORIGIN}/${t.route}`));
  assert.ok(calls.every(([, o]) => o.method === 'GET' && o.redirect === 'manual' && o.credentials === 'omit'
    && !o.body && Object.keys(o.headers).length === 1 && !o.headers.Authorization));
  assert.equal(receipt.result, 'PUBLIC_STATIC_METADATA_PREREQUISITES_SCOPED_MATCH');
});
test('HTTP 200 HTML at a JavaScript module URL is an explicit asset type FAIL', async () => {
  const receipt = await collect({ fetchImpl: async url => responseFor(url,
    url.endsWith('/auth-flows.js') ? { body: '<!doctype html><html>fallback</html>', type: 'text/html' } : {}) });
  const sample = receipt.samples.find(x => x.path === 'auth-flows.js');
  assert.equal(sample.result, 'FAIL_SELECTED_PUBLIC_ASSET_TYPE');
  assert.equal(sample.http_status, 200);
  assert.equal(receipt.full_operations_grouped_cases_run, 0);
});
test('HTML body under a JavaScript content type still fails its type prerequisite', async () => {
  const receipt = await collect({ fetchImpl: async url => responseFor(url,
    url.endsWith('/auth-security.js') ? { body: '\n<html>fallback</html>', type: 'application/javascript' } : {}) });
  assert.equal(receipt.samples.find(x => x.path === 'auth-security.js').result, 'FAIL_SELECTED_PUBLIC_ASSET_TYPE');
});
test('wrong intended HTML page is a parity REVIEW despite valid HTML MIME', async () => {
  const receipt = await collect({ fetchImpl: async url => responseFor(url, url.endsWith('/auth.html')
    ? { body: '<html>other page</html>', type: 'text/html' } : {}) });
  assert.equal(receipt.samples.find(x => x.path === 'auth.html').result, 'REVIEW_SELECTED_PUBLIC_SOURCE_PARITY');
});
test('missing MIME is not treated as a script availability pass', async () => {
  const receipt = await collect({ fetchImpl: async url => {
    const response = responseFor(url); if (url.endsWith('/admin-mfa.js')) response.headers.delete('content-type'); return response;
  } });
  assert.equal(receipt.samples.find(x => x.path === 'admin-mfa.js').result, 'FAIL_SELECTED_PUBLIC_ASSET_TYPE');
});
test('script MIME parameters and CRLF preserve only normalized source comparison', async () => {
  const receipt = await collect({ fetchImpl: async url => responseFor(url,
    url.endsWith('/auth-flows.js') ? { body: sourceBodies.get('auth-flows.js').replace(/\n/g, '\r\n'), type: 'application/javascript; charset=UTF-8' } : {}) });
  const sample = receipt.samples.find(x => x.path === 'auth-flows.js');
  assert.equal(sample.result, 'MATCH_SELECTED_PUBLIC_SOURCE_METADATA');
  assert.notEqual(sample.sha256, hash(sourceBodies.get('auth-flows.js')));
});
test('redirect responses are reported without following or consuming target bodies', async () => {
  const urls = [];
  const receipt = await collect({ fetchImpl: async url => { urls.push(url); return responseFor(url, { status: 308 }); } });
  assert.equal(urls.length, 9);
  assert.ok(receipt.samples.every(s => s.result === 'REDIRECT_NOT_FOLLOWED_REVIEW' && s.sha256 === undefined));
  assert.equal(receipt.redirects_followed, 0);
});
test('HTTP failure statuses remain unverified at public metadata scope', async () => {
  const receipt = await collect({ fetchImpl: async url => responseFor(url, { status: 503 }) });
  assert.ok(receipt.samples.every(s => s.result === 'HTTP_STATUS_REVIEW'));
  assert.equal(receipt.result, 'PUBLIC_STATIC_METADATA_REVIEW_REQUIRED');
});
test('unexpected followed destination is rejected without printing its URL', async () => {
  const privateURL = 'https://other.invalid/private-token';
  const receipt = await collect({ fetchImpl: async url => {
    const response = responseFor(url); Object.defineProperty(response, 'url', { value: privateURL }); return response;
  } });
  assert.ok(receipt.samples.every(s => s.error_code === 'UNEXPECTED_RESPONSE_DESTINATION'));
  assert.ok(!JSON.stringify(receipt).includes(privateURL));
});
test('streamed bodies are byte bounded even without a content-length header', async () => {
  const receipt = await collect({ fetchImpl: async url => url.endsWith('/config.js') ? new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(32768)); controller.enqueue(new Uint8Array(1)); controller.close(); },
  }), { headers: { 'content-type': 'text/javascript' } }) : responseFor(url) });
  assert.equal(receipt.samples[0].error_code, 'METADATA_BODY_TOO_LARGE');
  assert.equal(receipt.samples[0].sha256, undefined);
});
test('invalid response UTF-8 is rejected without outputting bytes', async () => {
  const receipt = await collect({ fetchImpl: async url => url.endsWith('/auth-flows.js')
    ? responseFor(url, { body: new Uint8Array([0xc3, 0x28]) }) : responseFor(url) });
  assert.equal(receipt.samples.find(x => x.path === 'auth-flows.js').error_code, 'METADATA_ENCODING_INVALID');
});
test('transport error messages cannot leak credentials raw links or inbox contents', async () => {
  const secret = 'private-password https://service.invalid/token=private-secret';
  const receipt = await collect({ fetchImpl: async () => { throw new Error(secret); } });
  assert.ok(receipt.samples.every(s => s.error_code === 'METADATA_TRANSPORT_FAILURE'));
  assert.ok(!JSON.stringify(receipt).includes(secret));
});
test('staging config reference is a scoped observation with no key ownership acceptance', async () => {
  const receipt = await collect();
  assert.equal(receipt.samples[0].result, 'EXPECTED_STAGING_CONFIG_REFERENCE_OBSERVED');
  assert.equal(receipt.samples[0].normalized_staging_overlay_matches, null);
  assert.equal(receipt.key_ownership_or_complete_secret_scan_verified, false);
  assert.ok(!JSON.stringify(receipt).includes('sb_publishable_synthetic'));
});
test('production reference and forbidden secret markers in config fail without disclosure', async () => {
  for (const body of [`window.config='${STAGING_PROJECT} kttkospkblwvguuwnhjj'`,
    `window.config='${STAGING_PROJECT} sb_secret_synthetic-private'`]) {
    const receipt = await collect({ fetchImpl: async url => responseFor(url, url.endsWith('/config.js') ? { body } : {}) });
    assert.equal(receipt.samples[0].result, 'FAIL_SELECTED_PUBLIC_CONFIG_PREREQUISITE');
    assert.ok(!JSON.stringify(receipt).includes('sb_secret_synthetic-private'));
  }
});
test('total deadline aborts a hanging transport and leaves later targets not requested', async () => {
  const receipt = await collect({ fetchImpl: () => new Promise(() => {}), requestTimeoutMs: 100, totalTimeoutMs: 5 });
  assert.equal(receipt.requests_attempted, 1);
  assert.equal(receipt.samples[0].error_code, 'METADATA_TIMEOUT');
  assert.ok(receipt.samples.slice(1).every(s => s.result === 'NOT_REQUESTED_TOTAL_DEADLINE'));
});
test('response stream stalls are bounded independently of fetch completion', async () => {
  const receipt = await collect({ fetchImpl: async () => new Response(new ReadableStream({ start() {} }),
    { headers: { 'content-type': 'text/javascript' } }), requestTimeoutMs: 1, totalTimeoutMs: 100 });
  assert.equal(receipt.samples[0].error_code, 'METADATA_TIMEOUT');
});
test('caller cannot increase request or total time budgets', async () => {
  for (const options of [{ requestTimeoutMs: 6001 }, { totalTimeoutMs: 30001 }, { totalTimeoutMs: 0 }]) {
    await assert.rejects(collect(options), /BOUNDED_TIMEOUT_REQUIRED/);
  }
});
test('receipt cannot promote partial metadata into job recovery hosted native or store acceptance', async () => {
  const receipt = await collect();
  for (const key of ['hosted_operations_acceptance', 'hosted_acceptance', 'native_security_acceptance', 'store_acceptance',
    'installed_backend_or_full_CI_or_artifact_parity_verified', 'notification_email_or_charge_dispatched',
    'accounts_fixtures_Auth_Storage_SQL_settings_changed', 'production_or_native_changed']) assert.equal(receipt[key], false);
  assert.equal(receipt.full_operations_grouped_cases_run, 0);
  assert.deepEqual(receipt.findings_closed, []);
});
test('actual CLI rejects missing confirmation before its default transport', () => {
  const result = spawnSync(process.execPath, ['--require', resolve(root, 'scripts/offline-test-network.cjs'),
    resolve(root, 'scripts/collect-stage-10-public-metadata.mjs')], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stdout).public_requests_started, 0);
});
test('actual CLI under disabled default transport returns sanitized review and nonzero exit', () => {
  const result = spawnSync(process.execPath, ['--require', resolve(root, 'scripts/offline-test-network.cjs'),
    resolve(root, 'scripts/collect-stage-10-public-metadata.mjs'), '--collect-public-staging-metadata',
    `--confirm-staging=${STAGING_PROJECT}`, `--source-pin=${contract.source_parent_commit}`], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 1);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.result, 'PUBLIC_STATIC_METADATA_REVIEW_REQUIRED');
  assert.ok(receipt.samples.every(s => s.error_code === 'METADATA_TRANSPORT_FAILURE'));
  assert.ok(!result.stdout.includes('OFFLINE_TEST_NETWORK_DISABLED'));
});
