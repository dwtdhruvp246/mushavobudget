// Read-only evidence collection. No dependencies, credentials, database calls,
// package installation, native sync, or source/configuration writes.
import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async file => { try { return await readFile(file, 'utf8'); } catch { return null; } };
const exists = async file => { try { await access(file); return true; } catch { return false; } };
const git = (directory, args) => {
  try { return execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
};

export async function collectBaseline(directory = root) {
  const packageText = await read(path.join(directory, 'package.json'));
  const pkg = JSON.parse(packageText || '{}');
  const declarations = { ...pkg.dependencies, ...pkg.devDependencies };
  const require = createRequire(path.join(directory, 'package.json'));
  const packages = {};
  for (const name of ['@capacitor/core', '@capacitor/cli', '@capacitor/android', '@capacitor/ios', '@capacitor/app', '@capacitor/preferences', 'esbuild']) {
    let installed = null;
    try { installed = require(name + '/package.json').version; } catch { /* Report absent, never install. */ }
    packages[name] = { declared: declarations[name] || null, installed };
  }
  const configText = await read(path.join(directory, 'capacitor.config.json'));
  let nativeConfig = null;
  if (configText) {
    try {
      const config = JSON.parse(configText);
      // Whitelist fields. Do not print the complete configuration or credentials.
      nativeConfig = { appId: config.appId || null, appName: config.appName || null, webDir: config.webDir || null,
        usesRemoteServer: Boolean(config.server?.url), cleartextEnabled: config.server?.cleartext === true };
    } catch { nativeConfig = { parseError: true }; }
  }
  const hashes = {};
  for (const file of ['app.js', 'business.js', 'app.html', 'business.html', 'pwa.js', 'sw.js', 'package.json', 'package-lock.json', 'scripts/build-capacitor.mjs']) {
    const bytes = await readFile(path.join(directory, file)).catch(() => null);
    hashes[file] = bytes ? hash(bytes) : null;
  }
  const pwa = await read(path.join(directory, 'pwa.js'));
  const schema = await read(path.join(directory, 'supabase/schema.sql'));
  const migrations = await readdir(path.join(directory, 'supabase/migrations')).catch(() => []);
  const publicPages = await Promise.all(['privacy.html', 'terms.html', 'delete-account.html'].map(async file => ({ file, present: await exists(path.join(directory, file)) })));
  const gitStatus = git(directory, ['status', '--porcelain']);
  return {
    evidenceType: 'LOCAL_INVENTORY_ONLY', collectedAt: new Date().toISOString(),
    commit: git(directory, ['rev-parse', 'HEAD']), branch: git(directory, ['branch', '--show-current']),
    localChangesPresent: gitStatus === null ? null : Boolean(gitStatus), node: process.version,
    appRelease: pwa?.match(/const RELEASE = "([^"]+)"/)?.[1] || null,
    packages, nativeConfig,
    nativeFiles: Object.fromEntries(await Promise.all(['capacitor.config.ts', 'android', 'ios', 'android/app/src/main/AndroidManifest.xml', 'ios/App/PrivacyInfo.xcprivacy'].map(async file => [file, await exists(path.join(directory, file))]))),
    migrationFileCount: migrations.filter(file => file.endsWith('.sql')).length,
    schemaTableCount: schema ? new Set([...schema.matchAll(/create table(?: if not exists)? public\.([a-z_]+)/gi)].map(match => match[1])).size : null,
    publicPages, hashes,
    limitations: ['Installed dependencies/configuration are inventory, not a signed release build.', 'No live database policies, OAuth, store-console, MFA, backup or device checks are performed.', 'No secret-history, vulnerability, authorization, or store-compliance certification is implied.']
  };
}

export async function collectLive(directory = root, fetcher = fetch) {
  const headerNames = ['strict-transport-security', 'content-security-policy', 'content-security-policy-report-only', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy'];
  return Promise.all(['/', '/app', '/business', '/signup', '/app.js', '/business.js', '/privacy', '/terms', '/delete-account'].map(async route => {
    try {
      const response = await fetcher('https://mushavobudget.com' + route, { signal: AbortSignal.timeout(12000), redirect: 'error' });
      const bytes = Buffer.from(await response.arrayBuffer());
      const item = { route, httpStatus: response.status, sha256: hash(bytes), headers: Object.fromEntries(headerNames.map(name => [name, response.headers.get(name)])), cloudflareAnalytics: bytes.includes(Buffer.from('static.cloudflareinsights.com')) };
      if (['/app.js', '/business.js'].includes(route)) {
        const local = await readFile(path.join(directory, route.slice(1))).catch(() => null);
        item.matchesLocalSource = local ? hash(local) === hash(bytes) : null;
      }
      return item;
    } catch { return { route, status: 'CANNOT VERIFY', reason: 'Network request failed, timed out, or redirected. No successful header test.' }; }
  }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).some(arg => arg !== '--live')) {
    console.error('Usage: node scripts/security-stage-0-check.mjs [--live]');
    process.exitCode = 2;
  } else {
    const evidence = await collectBaseline();
    if (process.argv.includes('--live')) evidence.live = await collectLive();
    console.log(JSON.stringify(evidence, null, 2));
  }
}
