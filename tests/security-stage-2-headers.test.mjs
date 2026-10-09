import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PRODUCTION, STAGING, PUBLIC_FILES, buildHeaders, inlineHashes, preparePreview } = require('../scripts/prepare-stage-2-headers.cjs');
const root = new URL('../', import.meta.url);
const html = PUBLIC_FILES.filter(p => p.endsWith('.html')).map(p => fs.readFileSync(new URL(p, root), 'utf8'));

test('tracked production policy matches reviewed HTML hashes and has no broad script permission', () => {
  const candidate = fs.readFileSync(new URL('_headers', root), 'utf8');
  assert.equal(candidate, buildHeaders(PRODUCTION, html));
  const report = candidate.split('\n').find(l => l.includes('Content-Security-Policy-Report-Only:'));
  const script = report.split(';').find(l => l.trim().startsWith('script-src '));
  assert.ok(!script.includes('unsafe-inline') && !script.includes('unsafe-eval'));
  const signup = html.find(h => h.includes('supabase-js@2.110.9/+esm'));
  const body = signup.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/\r\n?/g, '\n');
  const exact = createHash('sha256').update(body).digest('base64');
  assert.ok(script.includes("'sha256-" + exact + "'"));
  const tampered = createHash('sha256').update(body + '\nwindow.__injected=true;').digest('base64');
  assert.ok(!script.includes(tampered));
});

test('CRLF normalization retains the browser inline hash; external scripts are not hashed', () => {
  const lf = '<script>\nwindow.demo=1;\n</script><script src="app.js">ignored</script>';
  assert.deepEqual(inlineHashes([lf]), inlineHashes([lf.replaceAll('\n', '\r\n')]));
  assert.equal(inlineHashes([lf]).length, 1);
});

test('staging policy lists its exact backend without production and fits Cloudflare limits', () => {
  const text = buildHeaders(STAGING, html);
  assert.ok(!text.includes(PRODUCTION));
  assert.ok(text.includes(`https://${STAGING}.supabase.co`) && text.includes(`wss://${STAGING}.supabase.co`));
  assert.ok(text.split('\n').every(l => l.length <= 2000));
  const enforced = text.split('\n').find(l => /^  Content-Security-Policy:/.test(l));
  assert.ok(enforced.includes("frame-ancestors 'none'") && enforced.includes("object-src 'none'"));
  const hsts = text.split('\n').find(l => l.includes('Strict-Transport-Security:'));
  assert.ok(!enforced.includes('script-src') && !hsts.includes('includeSubDomains') && !hsts.includes('preload'));
  assert.throws(() => buildHeaders('unreviewed', html), /Unknown/);
});

function fixture(t) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mushavo-headers-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const source = path.join(tmp, 'staging'); fs.mkdirSync(source);
  for (const name of PUBLIC_FILES) {
    const full = path.join(source, name); fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, name.endsWith('.html') ? '<!doctype html><script>window.test=1;</script>' : 'synthetic-public-fixture');
  }
  const config = { supabaseUrl: `https://${STAGING}.supabase.co`, supabasePublishableKey: 'sb_publishable_STAGE2_DUMMY_ONLY', vapidPublicKey: '' };
  const writeConfig = () => fs.writeFileSync(path.join(source, 'config.js'), 'window.MUSHAVO_BUDGET_CONFIG = ' + JSON.stringify(config) + ';\n');
  writeConfig();
  return { tmp, source, output: path.join(tmp, 'new-preview'), config, writeConfig };
}

test('preview copies only public allowlist, preserves source and adds staging-only headers', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.source, 'secret.txt'), 'must-not-be-copied');
  const before = new Map(PUBLIC_FILES.map(n => [n, fs.readFileSync(path.join(f.source, n))]));
  const r = preparePreview(f.source, f.output);
  assert.equal(r.public_files, 35); assert.equal(r.source_files_modified, false);
  assert.equal(fs.existsSync(path.join(f.output, 'secret.txt')), false);
  assert.equal(fs.existsSync(path.join(f.source, '_headers')), false);
  for (const [n, bytes] of before) {
    assert.deepEqual(fs.readFileSync(path.join(f.source, n)), bytes);
    assert.deepEqual(fs.readFileSync(path.join(f.output, n)), bytes);
  }
  assert.ok(!fs.readFileSync(path.join(f.output, '_headers'), 'utf8').includes(PRODUCTION));
});

for (const [name, mutate] of [
  ['production backend', f => { f.config.supabaseUrl=`https://${PRODUCTION}.supabase.co`; f.writeConfig(); }],
  ['secret key', f => { f.config.supabasePublishableKey='sb_secret_DUMMY_ONLY'; f.writeConfig(); }],
  ['push configuration', f => { f.config.vapidPublicKey='DUMMY_PUSH'; f.writeConfig(); }],
  ['production reference in another asset', f => fs.writeFileSync(path.join(f.source, 'app.js'), PRODUCTION)],
  ['missing asset', f => fs.unlinkSync(path.join(f.source, 'app.html'))]
]) test(`preview rejects ${name} before creating output`, t => {
  const f = fixture(t); mutate(f); assert.throws(() => preparePreview(f.source, f.output));
  assert.equal(fs.existsSync(f.output), false);
});

test('preview refuses existing output and output within source', t => {
  const f = fixture(t); fs.mkdirSync(f.output); fs.writeFileSync(path.join(f.output, 'keep.txt'), 'retain');
  assert.throws(() => preparePreview(f.source, f.output), /nonexistent/);
  assert.equal(fs.readFileSync(path.join(f.output, 'keep.txt'), 'utf8'), 'retain');
  assert.throws(() => preparePreview(f.source, path.join(f.source, 'child')), /outside/);
});

test('preview rejects redirected asset without creating output', t => {
  const f = fixture(t), asset=path.join(f.source,'app.js'), other=path.join(f.tmp,'external.js');
  fs.writeFileSync(other,'synthetic');fs.unlinkSync(asset);fs.symlinkSync(other,asset);
  assert.throws(() => preparePreview(f.source,f.output), /redirected/);
  assert.equal(fs.existsSync(f.output),false);
});

test('preview rejects an output-parent alias into the source without modifying that source', t => {
  const f=fixture(t), alias=path.join(f.tmp,'alias');fs.symlinkSync(f.source,alias,'dir');
  assert.throws(()=>preparePreview(f.source,path.join(alias,'new-preview')),/redirected/);
  assert.equal(fs.existsSync(path.join(f.source,'new-preview')),false);
});

test('git-show environment handoff prepares the folder without printing its publishable key', t => {
  const f=fixture(t);
  const code=fs.readFileSync(new URL('scripts/prepare-stage-2-headers.cjs',root),'utf8');
  const r=spawnSync(process.execPath,['-e','eval(process.env.MUSHAVO_STAGE2_HEADER_SCRIPT)','--','--stage-2-preview',f.source,f.output],{encoding:'utf8',env:{...process.env,MUSHAVO_STAGE2_HEADER_SCRIPT:code}});
  assert.equal(r.status,0,r.stderr);
  assert.equal(JSON.parse(r.stdout).result,'STAGING_HEADER_CANDIDATE_PREPARED');
  assert.ok(!r.stdout.includes(f.config.supabasePublishableKey));
});
