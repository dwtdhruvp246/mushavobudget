// 2.1: prepare a new staging-only public folder; do not modify the source.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const PRODUCTION = 'kttkospkblwvguuwnhjj';
const STAGING = 'dczlddwbtgvfdujgcitb';
const PUBLIC_FILES = Object.freeze([
  'about.html', 'app-entry.html', 'app.html', 'business.html', 'contact.html',
  'index.html', 'offline.html', 'pricing.html', 'signup.html',
  'app-entry.js', 'app.js', 'admin-plans.js', 'business.js', 'config.js',
  'push-notifications.js', 'pwa-install.js', 'pwa.js', 'site.js', 'sw.js',
  'workspace-preference.js', 'business.css', 'pwa-install.css', 'pwa-shell.css',
  'pwa-update.css', 'site.css', 'styles.css', 'manifest.webmanifest',
  'assets/apple-touch-icon.png', 'assets/ledger-mark.svg',
  'assets/mushavo-budget-logo.png', 'assets/pwa-icon-192.png',
  'assets/pwa-icon-512.png', 'assets/pwa-icon-maskable-512.png', 'assets/pwa-icon.svg'
]);

function inlineHashes(htmlSources) {
  const hashes = new Set();
  for (const html of htmlSources) {
    // HTML parsing normalizes CR/CRLF before CSP hashes are checked.
    const normalized = html.replace(/\r\n?/g, '\n');
    for (const match of normalized.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      if (/\bsrc\s*=/i.test(match[1]) || !match[2].trim()) continue;
      hashes.add("'sha256-" + createHash('sha256').update(match[2], 'utf8').digest('base64') + "'");
    }
  }
  return [...hashes].sort();
}

function buildHeaders(reference, htmlSources) {
  if (![PRODUCTION, STAGING].includes(reference)) throw Error('Unknown reviewed backend reference.');
  const api = `https://${reference}.supabase.co`;
  const socket = `wss://${reference}.supabase.co`;
  const hashes = inlineHashes(htmlSources);
  const reportOnly = [
    "default-src 'self'",
    ["script-src 'self' https://cdn.jsdelivr.net https://static.cloudflareinsights.com", ...hashes].join(' '),
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${api} ${socket} https://cloudflareinsights.com`,
    `img-src 'self' data: blob: ${api}`,
    "font-src 'self'", "media-src 'self' blob:", "worker-src 'self'",
    "manifest-src 'self'", "frame-src 'none'", "object-src 'none'",
    "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"
  ].join('; ');
  const text = [
    '# 2.1 candidate: enforce baseline controls; observe resource CSP before promotion.',
    '# No remote report collector: inspect browser console; no violation URLs are uploaded.',
    '# Short initial HSTS lifetime; no includeSubDomains or preload commitment.',
    '/*',
    '  Strict-Transport-Security: max-age=86400',
    '  X-Content-Type-Options: nosniff',
    '  X-Frame-Options: DENY',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
    "  Content-Security-Policy: object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    '  Content-Security-Policy-Report-Only: ' + reportOnly,
    ''
  ].join('\n');
  if (text.split('\n').some(line => line.length > 2000)) throw Error('Cloudflare header line exceeds 2000 characters.');
  return text;
}

function preparePreview(sourceInput, outputInput) {
  if (!sourceInput || !outputInput) throw Error('Supply the existing STAGING folder and a new output folder.');
  const source = path.resolve(sourceInput);
  const output = path.resolve(outputInput);
  const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
  if (!fs.lstatSync(source).isDirectory() || !samePath(fs.realpathSync(source), source)) {
    throw Error('Source must be an ordinary existing staging directory, without redirected parents.');
  }
  if (fs.existsSync(output)) throw Error('Output must be a new nonexistent folder.');
  const outputParent = path.dirname(output);
  if (!fs.lstatSync(outputParent).isDirectory() || !samePath(fs.realpathSync(outputParent), outputParent)) {
    throw Error('Output parent must be an ordinary existing directory, without redirected parents.');
  }
  const relative = path.relative(source, output);
  if (!relative || (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative) && relative !== '..')) {
    throw Error('Output must be outside the existing staging folder.');
  }

  const files = new Map();
  for (const name of PUBLIC_FILES) {
    const full = path.join(source, name);
    const stat = fs.lstatSync(full);
    if (!stat.isFile() || stat.isSymbolicLink() || !samePath(fs.realpathSync(full), full)) {
      throw Error('Missing, redirected or non-file public asset: ' + name);
    }
    const data = fs.readFileSync(full);
    if (!data.length) throw Error('Empty public asset: ' + name);
    if (data.includes(Buffer.from(PRODUCTION))) throw Error('Production reference found in public asset: ' + name);
    files.set(name, data);
  }
  const configMatch = files.get('config.js').toString('utf8').match(/^\s*window\.MUSHAVO_BUDGET_CONFIG\s*=\s*(\{[\s\S]*\})\s*;\s*$/);
  if (!configMatch) throw Error('Use the JSON-based staging config prepared in 1.3.4.');
  const config = JSON.parse(configMatch[1]);
  if (config.supabaseUrl !== `https://${STAGING}.supabase.co` ||
      !/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.supabasePublishableKey || '') ||
      config.vapidPublicKey !== '' ||
      Object.keys(config).sort().join(',') !== 'supabasePublishableKey,supabaseUrl,vapidPublicKey') {
    throw Error('Expected the reviewed STAGING URL, publishable-key format and empty push key only.');
  }
  const html = [...files].filter(([name]) => name.endsWith('.html')).map(([, data]) => data.toString('utf8'));
  files.set('_headers', Buffer.from(buildHeaders(STAGING, html), 'utf8'));
  // Validate everything before writing; retain a partial new folder if writing fails.
  fs.mkdirSync(output);
  for (const [name, data] of files) {
    const full = path.join(output, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, data, { flag: 'wx' });
  }
  return {
    stage_step: '2.1', result: 'STAGING_HEADER_CANDIDATE_PREPARED',
    staging_reference: STAGING, output, public_files: files.size,
    production_reference_scan_passed: true, production_push_key_absent: true,
    source_files_modified: false, reviewed_file_allowlist_only: true,
    source_commit_or_key_project_ownership_independently_verified: false,
    enforced_csp_scope: 'OBJECT_BASE_FORM_FRAME_BASELINE',
    resource_csp_mode: 'REPORT_ONLY_BROWSER_DIAGNOSTICS_NO_REMOTE_COLLECTOR',
    deployed: false, browser_workflows_verified: false,
    production_changed: false, native_bundle_changed: false
  };
}

module.exports = { PRODUCTION, STAGING, PUBLIC_FILES, inlineHashes, buildHeaders, preparePreview };
if (require.main === module || process.argv[1] === '--stage-2-preview') {
  const args = process.argv.slice(2);
  try { console.log(JSON.stringify(preparePreview(args[0], args[1]), null, 2)); }
  catch (error) { console.error('2.1: ' + error.message); process.exitCode = 1; }
}
