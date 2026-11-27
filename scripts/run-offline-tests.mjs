import { readdirSync, lstatSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function discoverTestFiles(directory = root) {
  return readdirSync(resolve(directory, 'tests')).filter(name => /\.test\.(mjs|cjs)$/.test(name)).sort().map(name => {
    const path = resolve(directory, 'tests', name);
    if (!lstatSync(path).isFile()) throw new Error('Test entry must be an ordinary file: ' + name);
    return path;
  });
}
export function runOfflineTests({ directory = root, capture = false } = {}) {
  const files = discoverTestFiles(directory);
  if (!files.length) throw new Error('No offline test files found.');
  const env = {};
  const allowed = new Set(['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SYSTEMROOT', 'COMSPEC', 'PATHEXT', 'LANG', 'LC_ALL', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']);
  for (const [key, value] of Object.entries(process.env)) if (allowed.has(key.toUpperCase())) env[key] = value;
  const preload = resolve(root, 'scripts/offline-test-network.cjs').replaceAll('\\', '/');
  env.NODE_OPTIONS = '--require "' + preload + '"';
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', '--test-reporter=tap', ...files], {
    cwd: directory, env, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit',
    timeout: 180000, maxBuffer: 32 * 1024 * 1024,
  });
  return { ...result, files: files.map(path => 'tests/' + path.split(/[\\/]/).at(-1)) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = runOfflineTests();
  process.exitCode = result.error || result.signal ? 1 : result.status ?? 1;
}
