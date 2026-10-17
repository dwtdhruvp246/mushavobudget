import { cp, lstat, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PUBLIC_SITE_FILES = Object.freeze([
  '.nojekyll', 'about.html', 'app-entry.html', 'app.html', 'auth.html', 'business.html',
  'contact.html', 'index.html', 'offline.html', 'pricing.html', 'signup.html',
  'app-entry.js', 'app.js', 'admin-plans.js', 'admin-mfa.js', 'email-verification.js', 'session-entry.js', 'auth-flows.js', 'auth-security.js',
  'business.js', 'config.js', 'push-notifications.js', 'pwa-install.js', 'pwa.js', 'site.js',
  'sw.js', 'workspace-preference.js', 'business.css', 'pwa-install.css', 'pwa-shell.css',
  'pwa-update.css', 'site.css', 'styles.css', 'manifest.webmanifest', 'assets',
]);
export async function buildPublicSite(source = root, destination = resolve(root, '_site')) {
  source = resolve(source); destination = resolve(destination);
  // Never overwrite an existing serving artifact or copy into the source root.
  if (destination === source) throw new Error('Output must differ from source.');
  if (await lstat(destination).catch(error => { if (error.code !== 'ENOENT') throw error; })) throw new Error('Output must be new.');
  for (const name of PUBLIC_SITE_FILES) {
    const info = await lstat(resolve(source, name));
    if (name === 'assets' ? !info.isDirectory() : !info.isFile()) throw new Error('Invalid public asset: ' + name);
  }
  await mkdir(destination);
  try {
    for (const name of PUBLIC_SITE_FILES) await cp(resolve(source, name), resolve(destination, name), { recursive: name === 'assets', dereference: false });
  } catch (error) { await rm(destination, { recursive: true, force: true }); throw error; }
  return { public_entries: PUBLIC_SITE_FILES.length };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildPublicSite();
}
