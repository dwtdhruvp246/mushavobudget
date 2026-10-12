import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildPublicSite, PUBLIC_SITE_FILES } from '../scripts/build-public-site.mjs';
import { discoverTestFiles } from '../scripts/run-offline-tests.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
async function fixture(t) {
  const root = await mkdtemp(resolve(tmpdir(), 'mushavo-release-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = resolve(root, 'source'), output = resolve(root, 'output');
  await mkdir(source);
  for (const name of PUBLIC_SITE_FILES) await cp(resolve(repository, name), resolve(source, name), { recursive: name === 'assets' });
  return { root, source, output };
}

test('actual release exporter preserves Auth pages/modules and every literal local page/module reference', async t => {
  const f = await fixture(t);
  await buildPublicSite(f.source, f.output);
  for (const name of ['auth.html', 'auth-flows.js', 'auth-security.js']) assert.equal(await readFile(resolve(f.output, name), 'utf8'), await readFile(resolve(f.source, name), 'utf8'));
  for (const name of (await readdir(f.output)).filter(name => /\.(html|js)$/.test(name))) {
    const body = await readFile(resolve(f.output, name), 'utf8');
    const references = name.endsWith('.html') ? [...body.matchAll(/(?:src|href)=["']([^"']+)["']/g)] : [...body.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'](\.{1,2}\/[^"']+|\/[^"']+)["']/g)];
    for (const match of references) {
      const path = match[1].split(/[?#]/)[0];
      if (/^(?:[a-z]+:)?\/\//i.test(path) || !/\.(html|js|css|webmanifest|png|svg|jpg|jpeg|webp|ico)$/.test(path)) continue;
      const target = path.startsWith('/') ? resolve(f.output, path.slice(1)) : resolve(f.output, dirname(name), path);
      await readFile(target);
    }
  }
});

test('actual exporter excludes development/private files and keeps source bytes intact', async t => {
  const f = await fixture(t);
  await writeFile(resolve(f.source, '.env'), 'SYNTHETIC_PRIVATE');
  await writeFile(resolve(f.source, 'private-notes.txt'), 'SYNTHETIC_PRIVATE');
  const before = await readFile(resolve(f.source, 'app.html'));
  await buildPublicSite(f.source, f.output);
  const names = await readdir(f.output);
  assert.equal(names.includes('.env'), false); assert.equal(names.includes('private-notes.txt'), false);
  assert.equal(names.includes('scripts'), false); assert.equal(names.includes('supabase'), false);
  assert.deepEqual(await readFile(resolve(f.source, 'app.html')), before);
});

test('missing Auth helper fails before creating an export; existing artifact is preserved', async t => {
  const f = await fixture(t);
  await rm(resolve(f.source, 'auth-security.js'));
  await assert.rejects(buildPublicSite(f.source, f.output), { code: 'ENOENT' });
  await assert.rejects(readFile(resolve(f.output, 'app.html')), { code: 'ENOENT' });
  await mkdir(f.output); await writeFile(resolve(f.output, 'previous.txt'), 'existing artifact');
  await assert.rejects(buildPublicSite(f.source, f.output), /Output must be new/);
  assert.equal(await readFile(resolve(f.output, 'previous.txt'), 'utf8'), 'existing artifact');
});

test('offline runner includes MJS and CJS tests while excluding helpers and other files', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'mushavo-test-discovery-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'tests'));
  for (const name of ['first.test.cjs', 'second.test.mjs', 'helper.mjs', 'notes.txt']) await writeFile(resolve(root, 'tests', name), '');
  assert.deepEqual(discoverTestFiles(root).map(path => path.split(/[\\/]/).at(-1)), ['first.test.cjs', 'second.test.mjs']);
  assert.equal(discoverTestFiles(repository).filter(path => path.endsWith('.cjs')).length, 7);
});

test('offline preload rejects default fetch and ordinary HTTP without contacting a service', () => {
  const guard = resolve(repository, 'scripts/offline-test-network.cjs');
  const child = spawnSync(process.execPath, ['--require', guard, '-e', "const assert=require('node:assert/strict');assert.throws(()=>fetch('https://example.invalid'),/OFFLINE_TEST_NETWORK_DISABLED/);assert.throws(()=>require('node:https').request('https://example.invalid'),/OFFLINE_TEST_NETWORK_DISABLED/);"], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
});

test('CI uses the exercised exporter and the package uses explicit offline discovery', async () => {
  const workflow = await readFile(resolve(repository, '.github/workflows/pages.yml'), 'utf8');
  assert.match(workflow, /node scripts\/build-public-site\.mjs/);
  const pkg = JSON.parse(await readFile(resolve(repository, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.test, 'node scripts/run-offline-tests.mjs');
});
