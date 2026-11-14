// Fixed read-only publication check. No Auth/gateway/Management calls or browser execution.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {verifyEightSources} from './lib/auth-eight-source.mjs';

export const stage = 'FR.2.5.W5_EIGHT_CHARACTER_FRONTEND_DEPLOYMENT_AND_EXACT_AUTH_SETTINGS_READBACK';
export const display = 'Stage 3/10 | FR.2/8 | Batch W/Z';
export const origins = Object.freeze([
  ['DEPLOYMENT', 'https://05e04e4d.mushavo-budget-staging.pages.dev'],
  ['CANONICAL', 'https://mushavo-budget-staging.pages.dev'],
]);
export const files = Object.freeze(['auth-security.js', 'auth.html', 'signup.html', 'config.js', 'sw.js']);
export const flows = Object.freeze(['confirm', 'recover', 'business-new', 'business-existing']);
export const selectedHeaders = Object.freeze({'strict-transport-security': 'max-age=86400',
  'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'strict-origin-when-cross-origin'});
const hash = b => createHash('sha256').update(b).digest('hex');
const need = (value, code) => { if (!value) throw Error(code); };
const root = new URL('../', import.meta.url);
const receiptSHA256 = 'f8bda6a836f57f10939265089501fb654655c831ef76cfdd4fad6bb88c306a10';
export function loadExpected() {
  const bytes = fs.readFileSync(new URL('docs/security-audit/security-fr-2-batch-w-owner-eight-local-and-artifact-pass.json', root));
  need(hash(bytes) === receiptSHA256, 'REVIEWED_PUBLIC_RECEIPT_REQUIRED');
  const r = JSON.parse(bytes), a = r.artifact_preparation;
  need(r.source_commit === 'b8664567ee69f41fe30e7ea9191f19712de1c6c6' && r.combined_exit_code === 0
    && a.ZIP_SHA256 === '3255992abbc6058afa2e74f804cc19b3d9337d2380db52d52b82d0363454218b'
    && a.public_files === 44 && Object.keys(a.entry_SHA256).length === 44, 'REVIEWED_PUBLIC_RECEIPT_REQUIRED');
  const expected = new Map(files.map(n => [n, a.entry_SHA256[n]]));
  for (const n of ['auth-security.js', 'auth.html', 'signup.html', 'sw.js']) {
    const b = fs.readFileSync(new URL(n, root));
    const exported = n === 'signup.html' ? Buffer.from(b.toString('utf8').replaceAll('kttkospkblwvguuwnhjj', 'dczlddwbtgvfdujgcitb')) : b;
    need(hash(exported) === expected.get(n), 'REVIEWED_PUBLIC_SOURCE_REQUIRED');
  }
  return expected;
}
export async function collectPublic(expected, {transport = globalThis.fetch, requestMs = 8000, totalMs = 90000} = {}) {
  const r = {stage_step: stage, progress_display: display, result: 'BATCH_W_PUBLIC_READBACK_REVIEW_REQUIRED',
    scope: 'FIVE_SELECTED_PUBLIC_FILES_AND_FOUR_CALLBACKS_AT_TWO_STAGING_ORIGINS',
    metadata_cases_expected: 18, pass: 0, direct_public_GET_attempts: 0, HTTP_responses: 0, maximum_public_GET_requests: 30,
    automatic_retries: 0, unrestricted_redirects_followed: 0, samples: [],
    Auth_gateway_or_Management_requests: 0, real_email_requests: 0, settings_or_mode_or_account_writes: 0,
    credentials_private_packets_or_browser_accessed: false, response_bodies_keys_or_raw_headers_printed: false,
    entire_deployed_artifact_verified: false, real_Auth_password_policy_enforcement_verified: false,
    browser_TLS_cookie_cache_or_offline_acceptance_verified: false, quarantine_remeasured: false,
    pending_batch_V_MFA_deferred_by_owner: true, full_lettered_batch_W_complete: false,
    hosted_acceptance: false, production_or_native_changed: false, APK_update_deferred: true,
    findings_closed: [], checkpoint: 'PUBLIC_EXPECTATIONS', problem_code: null, exit_code: 1};
  const started = Date.now();
  async function get(url, sample) {
    need(r.direct_public_GET_attempts < 30 && Date.now() - started < totalMs, 'PUBLIC_REQUEST_BUDGET_REQUIRED');
    r.direct_public_GET_attempts++;
    const controller = new AbortController(); let reader, timer;
    const expired = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Error('PUBLIC_REQUEST_TIMEOUT')); }, Math.min(requestMs, totalMs - (Date.now() - started))); });
    try {
      const response = await Promise.race([Promise.resolve().then(() => transport(url, {method: 'GET', credentials: 'omit',
        redirect: 'manual', cache: 'no-store', headers: {Accept: '*/*'}, signal: controller.signal})), expired]);
      r.HTTP_responses++; sample.HTTP_statuses.push(response.status);
      need(!response.redirected, 'UNREVIEWED_REDIRECT_REFUSED');
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        response.body?.cancel().catch(() => {});
        return {redirect: response.headers.get('location')};
      }
      need(response.status === 200, 'PUBLIC_HTTP_STATUS_REQUIRED');
      const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      sample.MIME_match = sample.file.endsWith('.html') ? mime === 'text/html' : ['application/javascript', 'text/javascript'].includes(mime);
      sample.selected_headers_match = Object.entries(selectedHeaders).every(([n, v]) => response.headers.get(n) === v);
      need(sample.MIME_match && sample.selected_headers_match, 'PUBLIC_MIME_OR_HEADERS_REQUIRED');
      reader = response.body?.getReader(); need(reader, 'PUBLIC_BODY_REQUIRED');
      const parts = []; let size = 0;
      for (;;) {
        const x = await Promise.race([reader.read(), expired]); if (x.done) break;
        size += x.value.length; need(size <= 2 * 1024 * 1024, 'PUBLIC_RESPONSE_SIZE_REQUIRED'); parts.push(x.value);
      }
      const digest = hash(Buffer.concat(parts)); sample.source_match = digest === expected.get(sample.file);
      need(sample.source_match, 'PUBLIC_SOURCE_PARITY_REQUIRED');
      return {matched: true};
    } finally {
      clearTimeout(timer); controller.abort(); reader?.cancel().catch(() => {});
      try { reader?.releaseLock(); } catch {}
    }
  }
  try {
    need(expected instanceof Map && expected.size === 5 && files.every(n => /^[a-f0-9]{64}$/.test(expected.get(n) || '')), 'REVIEWED_PUBLIC_EXPECTATIONS_REQUIRED');
    for (const [label, origin] of origins) {
      const routes = [...files.map(file => ({file, route: '/' + file})),
        ...flows.map(flow => ({file: 'auth.html', route: '/auth.html?flow=' + flow}))];
      for (const {file, route} of routes) {
        r.checkpoint = label + '_' + route;
        const sample = {origin: label, route, file, HTTP_statuses: [], fixed_clean_path_followed: false,
          MIME_match: false, selected_headers_match: false, source_match: false};
        r.samples.push(sample);
        const first = await get(origin + route, sample);
        if ('redirect' in first) {
          need(file.endsWith('.html'), 'UNREVIEWED_REDIRECT_REFUSED');
          const clean = route.replace('.html', '');
          need(typeof first.redirect === 'string' && new URL(first.redirect, origin + route).href === origin + clean, 'UNREVIEWED_REDIRECT_REFUSED');
          sample.fixed_clean_path_followed = true;
          need((await get(origin + clean, sample)).matched === true, 'REPEATED_REDIRECT_REFUSED');
        }
        r.pass++;
      }
    }
    need(r.pass === 18, 'PUBLIC_CASE_COUNT_REQUIRED');
    r.result = 'BATCH_W_TWO_ORIGIN_EIGHT_CHARACTER_SOURCE_AND_CALLBACK_SERVING_SCOPED_PASS'; r.checkpoint = 'COMPLETE'; r.exit_code = 0;
  } catch (e) {
    const safe = new Set(['PUBLIC_REQUEST_BUDGET_REQUIRED', 'PUBLIC_REQUEST_TIMEOUT', 'UNREVIEWED_REDIRECT_REFUSED',
      'PUBLIC_HTTP_STATUS_REQUIRED', 'PUBLIC_MIME_OR_HEADERS_REQUIRED', 'PUBLIC_BODY_REQUIRED', 'PUBLIC_RESPONSE_SIZE_REQUIRED',
      'PUBLIC_SOURCE_PARITY_REQUIRED', 'REVIEWED_PUBLIC_EXPECTATIONS_REQUIRED', 'REPEATED_REDIRECT_REFUSED', 'PUBLIC_CASE_COUNT_REQUIRED']);
    r.problem_code = safe.has(e?.message) ? e.message : 'PUBLIC_TRANSPORT_OR_SOURCE_REVIEW_REQUIRED';
  }
  r.checked_UTC = new Date().toISOString(); return r;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let r;
  try {
    need(process.argv.length === 3 && process.argv[2] === '--staging-public-readback', 'FIXED_PUBLIC_ARGUMENT_REQUIRED');
    need(['NODE_OPTIONS', 'NODE_DEBUG', 'NODE_DEBUG_NATIVE', 'NODE_TLS_REJECT_UNAUTHORIZED', 'SSLKEYLOGFILE'].every(n => !process.env[n]), 'NORMAL_PUBLIC_RUNTIME_REQUIRED');
    const source_hashes_verified = await verifyEightSources();
    r = await collectPublic(loadExpected()); r.source_hashes_verified = source_hashes_verified;
  } catch {
    r = {stage_step: stage, progress_display: display, result: 'BATCH_W_PUBLIC_READBACK_NOT_STARTED',
      problem_code: 'FIXED_SOURCE_RUNTIME_OR_ARGUMENT_REQUIRED', direct_public_GET_attempts: 0,
      hosted_acceptance: false, production_or_native_changed: false, exit_code: 1};
  }
  console.log(JSON.stringify(r, null, 2)); process.exitCode = r.exit_code;
}
