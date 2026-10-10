import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const { PUBLIC_FILES, PRODUCTION, STAGING } = require('../scripts/prepare-stage-2-headers.cjs');
const { hash, SITE_HASH, HTML_HASH } = require('../scripts/check-staging-contact-api.cjs');
const ps = fs.readFileSync(path.join(root, 'scripts/prepare-stage-2-contact.ps1'), 'utf8');
const extractor = ps.match(/\$mushavoExtractor = @'\r?\n([\s\S]*?)\r?\n'@/)[1];
const key = '0xFIXTURE_PUBLIC_SITEKEY';
const names = ['site.js', 'contact.html', 'scripts/prepare-stage-2-headers.cjs',
  'scripts/prepare-stage-2-contact.cjs', 'scripts/check-staging-contact-api.cjs',
  'supabase/functions/submit-enquiry/index.ts', 'supabase/functions/submit-enquiry/handler.mjs'];
function fixture(t, { changedSite = false, missingKey = false } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mushavo-byte-test-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const repo = path.join(tmp, 'repo'), source = path.join(tmp, 'existing'), target = path.join(tmp, 'new');
  for (const dir of [repo, source, target]) fs.mkdirSync(dir);
  for (const name of names) {
    const destination = path.join(repo, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, fs.readFileSync(path.join(root, name)));
  }
  if (changedSite) fs.appendFileSync(path.join(repo, 'site.js'), '\n// Unreviewed change');
  const git = args => execFileSync('git', args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] });
  git(['init', '--quiet']);
  git(['-c', 'core.autocrlf=false', 'add', '.']);
  git(['-c', 'user.name=Local Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Fixture']);
  const commit = git(['rev-parse', 'HEAD']).toString('utf8').trim();
  for (const name of PUBLIC_FILES) {
    const destination = path.join(source, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, name.endsWith('.html') ? '<p>Synthetic fixture</p>' : 'synthetic');
  }
  const config = 'window.MUSHAVO_BUDGET_CONFIG = ' + JSON.stringify({
    supabaseUrl: `https://${STAGING}.supabase.co`, supabasePublishableKey: 'sb_publishable_FIXTURE', vapidPublicKey: '',
  }) + ';\r\n';
  fs.writeFileSync(path.join(source, 'config.js'), config);
  const site = fs.readFileSync(path.join(root, 'site.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'contact.html'), 'utf8').replace(PRODUCTION, STAGING)
    .replace('data-sitekey=""', missingKey ? 'data-sitekey=""' : `data-sitekey="${key}"`);
  // Deliberately damaged Unicode in the old candidate, with unchanged ASCII structure.
  fs.writeFileSync(path.join(source, 'site.js'), site.replace(/[^\x00-\x7F]/g, '\u00e2\u2592').replace(/\n/g, '\r\n'));
  fs.writeFileSync(path.join(source, 'contact.html'), html.replace(/[^\x00-\x7F]/g, '\u00e2\u2592').replace(/\n/g, '\r\n'));
  const original = new Map(PUBLIC_FILES.map(name => [name, fs.readFileSync(path.join(source, name))]));
  const execute = () => spawnSync(process.execPath, ['-e', 'eval(process.env.MUSHAVO_STAGE2_CONTACT_EXTRACTOR)'], {
    cwd: repo, encoding: 'utf8', env: { ...process.env,
      MUSHAVO_STAGE2_CONTACT_EXTRACTOR: extractor, MUSHAVO_STAGE2_CONTACT_COMMIT: commit,
      MUSHAVO_STAGE2_CONTACT_NEW_ROOT: target, MUSHAVO_STAGE2_CONTACT_SOURCE: source,
      MUSHAVO_STAGE2_CONTACT_REPAIR_MODE: 'true', MUSHAVO_STAGE2_CONTACT_PUBLIC_KEY: '',
    },
  });
  return { source, target, repo, execute, original };
}
test('exact owner Node extractor repairs damaged Unicode from real Git buffers, reuses key and preserves all source files', t => {
  assert.ok(!/[^\x00-\x7F]/.test(ps), 'PowerShell loader remains ASCII-safe');
  const f = fixture(t), result = f.execute();
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.result, 'STAGING_CONTACT_ENCODING_REPAIR_PREPARED');
  assert.equal(report.public_files, 35);
  assert.equal(report.reviewed_contact_javascript_match, true);
  assert.equal(report.reviewed_contact_html_match, true);
  assert.equal(report.existing_public_sitekey_reused, true);
  assert.equal(report.existing_source_config_bytes_preserved, true);
  assert.equal(report.edge_or_database_redeployment_performed, false);
  assert.ok(!result.stdout.includes(key));
  for (const name of names) assert.deepEqual(fs.readFileSync(path.join(f.target, name)), fs.readFileSync(path.join(f.repo, name)));
  const web = path.join(f.target, 'web');
  assert.equal(hash(fs.readFileSync(path.join(web, 'site.js'), 'utf8')), SITE_HASH);
  const html = fs.readFileSync(path.join(web, 'contact.html'), 'utf8');
  assert.ok(html.includes(key));
  assert.equal(hash(html.replace(`data-sitekey="${key}"`, 'data-sitekey=""')), HTML_HASH);
  for (const [name, bytes] of f.original) {
    assert.deepEqual(fs.readFileSync(path.join(f.source, name)), bytes);
    if (!['site.js', 'contact.html'].includes(name)) assert.deepEqual(fs.readFileSync(path.join(web, name)), bytes);
  }
  assert.ok(fs.readFileSync(path.join(web, '_headers'), 'utf8').includes('https://challenges.cloudflare.com'));
});
test('unreviewed pinned content fails before creating a public upload folder', t => {
  const f = fixture(t, { changedSite: true }), result = f.execute();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /PINNED_CONTACT_CANDIDATE_MISMATCH/);
  assert.equal(fs.existsSync(path.join(f.target, 'web')), false);
});
test('repair requires one existing public key and never substitutes a secret or empty widget', t => {
  const f = fixture(t, { missingKey: true }), result = f.execute();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /EXISTING_PUBLIC_SITEKEY_NOT_UNIQUE/);
  assert.equal(fs.existsSync(path.join(f.target, 'web')), false);
});
