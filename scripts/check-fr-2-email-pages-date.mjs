import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {setExactPagesDate, exactDatePayload, REVIEWED_DATE} from './set-fr-2-email-pages-date.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sentinel = 'DO_NOT_PRINT_PRIVATE_SENTINEL';
const account = 'a'.repeat(32), token = sentinel + '_TOKEN', namespace = sentinel + '_NAMESPACE';
const input = {account, token, candidate: path.resolve(os.tmpdir(), 'synthetic-review-only')};
const baseURL = 'https://api.cloudflare.com/client/v4/accounts/' + account;
const suffixes = ['/pages/projects/mushavo-budget-staging', '/workers/scripts',
  '/workers/durable_objects/namespaces?per_page=1000', '/workers/scripts/mushavo-email-rate-staging/subdomain'];
const envelope = (result, errors = []) => ({success: true, errors, result});
const json = (value, status = 200) => new Response(JSON.stringify(value), {status, headers: {'content-type': 'application/json'}});
function project() {
  const channel = () => ({compatibility_date: '2026-10-08', compatibility_flags: [],
    always_use_latest_compatibility_date: false, fail_open: false, env_vars: {
      EMAIL_GATE_MODE: {type: 'plain_text', value: 'STAGING_CONTROLLED_ONLY'},
      EMAIL_GATE_PROJECT: {type: 'plain_text', value: 'dczlddwbtgvfdujgcitb'},
      EMAIL_GATE_ORIGIN: {type: 'plain_text', value: 'https://mushavo-budget-staging.pages.dev'}},
    durable_object_namespaces: {EMAIL_GATE_LIMITER_NS: {namespace_id: namespace}},
    placement: {mode: 'smart'}, unknown_nested_option: {retained: [3, 2, 1]}});
  return {id: sentinel + '_PROJECT', name: 'mushavo-budget-staging', subdomain: 'mushavo-budget-staging.pages.dev',
    source: null, production_branch: 'main', domains: [], build_config: {root_dir: ''},
    canonical_deployment: {id: sentinel + '_DEPLOYMENT', uses_functions: false},
    deployment_configs: {production: channel(), preview: channel()}};
}
async function run({before = project(), after, patchResponse, readResponse, mutation, inputOverride, artifactCheck} = {}) {
  const calls = []; let patched;
  const transport = async (url, init) => {
    calls.push({url, method: init.method, body: init.body});
    assert.equal(init.redirect, 'error'); assert.equal(init.headers.Authorization, 'Bearer ' + token);
    assert.ok(init.signal instanceof AbortSignal);
    const i = calls.length;
    if (i <= 4) {
      assert.equal(init.method, 'GET'); assert.equal(init.body, undefined); assert.equal(url, baseURL + suffixes[i - 1]);
      let body = [envelope(before), envelope([{id: 'mushavo-email-rate-staging'}]),
        envelope([{id: namespace, script: 'mushavo-email-rate-staging', class: 'EmailGatewayRateLimiter', use_sqlite: true}], null),
        envelope({enabled: false, previews_enabled: false})][i - 1];
      if (mutation) body = mutation(body, i);
      return body instanceof Response ? body : json(body);
    }
    assert.equal(url, baseURL + suffixes[0]);
    if (i === 5) {
      assert.equal(init.method, 'PATCH'); assert.equal(init.headers['Content-Type'], 'application/json');
      assert.deepEqual(JSON.parse(init.body), exactDatePayload()); assert.ok(!init.body.includes(sentinel));
      patched = structuredClone(before);
      for (const key of ['production', 'preview']) patched.deployment_configs[key].compatibility_date = REVIEWED_DATE;
      if (patchResponse) return patchResponse();
      return json(envelope(patched));
    }
    assert.equal(i, 6); assert.equal(init.method, 'GET'); assert.equal(init.body, undefined);
    return readResponse ? readResponse() : json(envelope(after ? after(patched) : patched));
  };
  const receipt = await setExactPagesDate(inputOverride || input, {transport, artifactCheck: artifactCheck || (() => {})});
  assert.ok(!JSON.stringify(receipt).includes(sentinel)); assert.ok(!JSON.stringify(receipt).includes(account));
  return {receipt, calls};
}
await test('Actual fixed date-only PATCH follows four fresh GETs and independently verifies both channels', async () => {
  const {receipt: r, calls} = await run(); assert.equal(r.exit_code, 0); assert.equal(calls.length, 6);
  assert.equal(r.date_only_payload_verified, true); assert.equal(r.date_patch_attempted, true);
  assert.equal(r.date_patch_HTTP_accepted, true); assert.equal(r.fresh_channel_readback_verified, true);
  assert.equal(r.all_observed_channel_settings_except_date_compared_unchanged, true);
  assert.equal(r.selected_project_source_build_and_deployment_metadata_compared_unchanged, true);
  assert.equal(r.remote_state_may_require_review, false); assert.equal(r.channels.length, 2);
  assert.ok(r.channels.every(x => x.compatibility_date_matches_reviewed && !x.fail_open && x.limiter_binding === 'MATCH'));
});
await test('Already-correct dates verify without another PATCH or deployment', async () => {
  const before = project(); for (const c of Object.values(before.deployment_configs)) c.compatibility_date = REVIEWED_DATE;
  const {receipt: r, calls} = await run({before}); assert.equal(r.exit_code, 0); assert.equal(calls.length, 4);
  assert.equal(r.no_write_needed, true); assert.equal(r.date_patch_attempted, false);
});
await test('One already-correct channel is retained by the same two-field payload', async () => {
  const before = project(); before.deployment_configs.preview.compatibility_date = REVIEWED_DATE;
  const {receipt: r} = await run({before}); assert.equal(r.exit_code, 0); assert.equal(r.date_patch_attempted, true);
});
for (const [label, mutate] of [
  ['fail-open', p => {p.deployment_configs.preview.fail_open = true;}],
  ['latest-date', p => {p.deployment_configs.production.always_use_latest_compatibility_date = true;}],
  ['wrong marker', p => {p.deployment_configs.preview.env_vars.EMAIL_GATE_PROJECT.value = sentinel;}],
  ['missing marker', p => {delete p.deployment_configs.production.env_vars.EMAIL_GATE_MODE;}],
  ['additional secret', p => {p.deployment_configs.production.env_vars.EXTRA_SECRET = {type: 'secret_text', value: sentinel};}],
  ['missing binding', p => {p.deployment_configs.preview.durable_object_namespaces = {};}],
  ['foreign binding', p => {p.deployment_configs.preview.durable_object_namespaces.EMAIL_GATE_LIMITER_NS.namespace_id += 'foreign';}],
  ['additional binding', p => {p.deployment_configs.preview.durable_object_namespaces.EXTRA = {namespace_id: sentinel};}]
]) await test('Pre-write guard refuses ' + label + ' without a write', async () => {
  const before = project(); mutate(before); const {receipt: r, calls} = await run({before});
  assert.equal(r.exit_code, 1); assert.equal(calls.length, 4); assert.equal(r.date_patch_attempted, false);
});
for (const [label, mutate] of [
  ['active Functions deployment', p => {p.canonical_deployment.uses_functions = true;}],
  ['unknown Functions state', p => {delete p.canonical_deployment.uses_functions;}],
  ['Git-managed source', p => {p.source = {type: 'github'};}],
  ['Wrangler-managed channel', p => {p.deployment_configs.preview.wrangler_config_hash = sentinel;}],
  ['unreported current date', p => {delete p.deployment_configs.production.compatibility_date;}]
]) await test('Write scope excludes ' + label, async () => {
  const before = project(); mutate(before); const {receipt: r, calls} = await run({before});
  assert.equal(r.exit_code, 1); assert.equal(calls.length, 4); assert.equal(r.date_patch_attempted, false);
});
await test('Foreign project and bad account/private input stop before mutation', async () => {
  const before = project(); before.name = sentinel;
  assert.equal((await run({before})).calls.length, 1);
  for (const inputOverride of [{...input, account: 'bad'}, {...input, method: 'POST'}, {...input, token: 'bad'}, null]) {
    const {receipt: r, calls} = await run({inputOverride: inputOverride || {}});
    assert.equal(r.exit_code, 1); assert.equal(calls.length, 0); assert.equal(r.date_patch_attempted, false);
  }
});
await test('Unavailable ZIP/receipt refuses every network request', async () => {
  const {receipt: r, calls} = await run({artifactCheck: () => {throw Error(sentinel);}});
  assert.equal(r.exit_code, 1); assert.equal(calls.length, 0);
});
await test('Wrong namespace inventory or public limiter URL stops before a date write', async () => {
  for (const mutation of [(body, i) => {if (i === 3) body.result[0].use_sqlite = false; return body;},
    (body, i) => {if (i === 4) body.result.enabled = true; return body;}]) {
    const {receipt: r, calls} = await run({mutation}); assert.equal(r.exit_code, 1);
    assert.ok(calls.length <= 4); assert.equal(r.date_patch_attempted, false);
  }
});
await test('PATCH HTTP rejection and ambiguous transport failure are never retried or automatically rolled back', async () => {
  for (const patchResponse of [() => json({private: sentinel}, 403), () => {throw Error(sentinel); }]) {
    const {receipt: r, calls} = await run({patchResponse}); assert.equal(r.exit_code, 1); assert.equal(calls.length, 5);
    assert.equal(r.remote_state_may_require_review, true); assert.equal(r.fresh_channel_readback_verified, false);
  }
});
await test('PATCH success alone never establishes acceptance if fresh readback fails', async () => {
  const {receipt: r, calls} = await run({readResponse: () => json({private: sentinel}, 500)});
  assert.equal(calls.length, 6); assert.equal(r.date_patch_HTTP_accepted, true);
  assert.equal(r.exit_code, 1); assert.equal(r.remote_state_may_require_review, true);
});
await test('Patch media, JSON, size and API-envelope errors are bounded and omit private values', async () => {
  for (const patchResponse of [() => new Response(sentinel),
    () => new Response('{'+sentinel, {headers: {'content-type': 'application/json'}}),
    () => new Response(' '.repeat(2097153), {headers: {'content-type': 'application/json'}}),
    () => json({success: false, errors: [{message: sentinel}]}), () => json({success: true})]) {
    const {receipt: r, calls} = await run({patchResponse}); assert.equal(r.exit_code, 1);
    assert.equal(calls.length, 5); assert.equal(r.remote_state_may_require_review, true);
  }
});
for (const [label, mutate] of [
  ['unapplied preview date', p => {p.deployment_configs.preview.compatibility_date = '2026-10-08';}],
  ['removed variables', p => {p.deployment_configs.production.env_vars = {};}],
  ['removed binding', p => {p.deployment_configs.preview.durable_object_namespaces = {};}],
  ['changed compatibility flags', p => {p.deployment_configs.production.compatibility_flags.push('nodejs_compat');}],
  ['changed unknown nested setting', p => {p.deployment_configs.preview.unknown_nested_option.retained.reverse();}],
  ['changed source branch', p => {p.production_branch = sentinel;}],
  ['changed deployment', p => {p.canonical_deployment.id = sentinel + '_NEW';}],
  ['changed project identity', p => {p.subdomain = sentinel;}]
]) await test('Fresh readback catches ' + label + ' and retains review-required state', async () => {
  const {receipt: r, calls} = await run({after: p => {mutate(p); return p;}});
  assert.equal(calls.length, 6); assert.equal(r.exit_code, 1); assert.equal(r.remote_state_may_require_review, true);
  assert.equal(r.fresh_channel_readback_verified, false);
});
await test('Object key reordering is accepted while actual setting values remain identical', async () => {
  const {receipt: r} = await run({after: p => {p.deployment_configs.preview.env_vars = Object.fromEntries(
    Object.entries(p.deployment_configs.preview.env_vars).reverse()); return p;}});
  assert.equal(r.exit_code, 0);
});
await test('First project read has the same size boundary before any PATCH is possible', async () => {
  const {receipt: r, calls} = await run({mutation: (body, i) => i === 1 ?
    new Response(' '.repeat(2097153), {headers: {'content-type': 'application/json'}}) : body});
  assert.equal(r.exit_code, 1); assert.equal(calls.length, 1); assert.equal(r.date_patch_attempted, false);
});
await test('Null-errors PATCH success still requires independent final GET verification', async () => {
  const {receipt: r, calls} = await run({patchResponse: () => json(envelope(null, null))});
  assert.equal(r.exit_code, 0); assert.equal(calls.length, 6); assert.equal(r.fresh_channel_readback_verified, true);
});
await test('Scope flags remain false for deployment, SQL, mail, concurrent safety and hosted acceptance', async () => {
  const {receipt: r} = await run();
  for (const key of ['upload_or_redeployment_attempted', 'email_or_provider_dispatch_attempted',
    'hosted_acceptance', 'live_activation_approved', 'concurrent_configuration_changes_excluded',
    'gateway_configuration_ready_verified', 'production_or_native_changed']) assert.equal(r[key], false);
  assert.equal(r.SQL_or_Auth_requests, 0); assert.deepEqual(r.findings_closed, []);
});
await test('Actual CLI refuses malformed private input without raw exception output', () => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/set-fr-2-email-pages-date.mjs')],
    {input: JSON.stringify({token: sentinel}), encoding: 'utf8', timeout: 10000});
  assert.equal(result.status, 1); assert.equal(result.stderr, '');
  assert.equal(JSON.parse(result.stdout).requests_attempted, 0); assert.ok(!result.stdout.includes(sentinel));
});
await test('Private PowerShell runner retains hidden stdin credentials, fixed source checks and working Node identity', () => {
  const ps = fs.readFileSync(path.join(root, 'scripts/run-fr-2-email-pages-date.ps1'), 'utf8');
  assert.match(ps, /Read-Host[^\n]+-AsSecureString/); assert.match(ps, /StandardInput.WriteLine/);
  assert.match(ps, /execPath:process.execPath/); assert.match(ps, /ZeroFreeBSTR/);
  assert.match(ps, /Rows.Count -ne 7/); assert.match(ps, /FR\.2\.4\.E5\.3_EXACT_PAGES_DATE/);
  assert.match(ps, /remote_state_may_require_review = \$ChildStarted/);
  assert.match(ps, /date_patch_attempted = \$null/);
  assert.ok(!ps.includes('upload_or_settings_write_attempted = $false'));
  assert.ok(!ps.includes('Invoke-Expression')); assert.ok(!ps.includes('CLOUDFLARE_API_TOKEN ='));
});
await test('The exact seven-source export verifies every digest and resolves the actual CLI without npm', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/security-audit/security-fr-2-email-pages-date-source-manifest.json'), 'utf8'));
  assert.equal(Object.keys(manifest.file_sha256).length, 7);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mushavo-pages-date-minimal-'));
  try {
    for (const [relative, expected] of Object.entries(manifest.file_sha256)) {
      const bytes = fs.readFileSync(path.join(root, relative));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), expected);
      const target = path.join(temp, relative); fs.mkdirSync(path.dirname(target), {recursive: true}); fs.writeFileSync(target, bytes);
    }
    const child = spawnSync(process.execPath, [path.join(temp, 'scripts/set-fr-2-email-pages-date.mjs')],
      {input: '{}', encoding: 'utf8', timeout: 10000});
    assert.equal(child.status, 1); assert.equal(child.stderr, '');
    assert.equal(JSON.parse(child.stdout).requests_attempted, 0);
  } finally { fs.rmSync(temp, {recursive: true, force: true}); }
});
