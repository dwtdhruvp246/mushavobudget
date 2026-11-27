import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';

export const STAGING_PROJECT = 'dczlddwbtgvfdujgcitb';
export const STAGING_ORIGIN = 'https://mushavo-budget-staging.pages.dev';
const PRODUCTION_PROJECT = 'kttkospkblwvguuwnhjj';
export const TARGETS = Object.freeze([
  ['config.js', 'config.js', 'javascript'],
  ['auth.html', 'auth.html', 'html'],
  ['auth-flows.js', 'auth-flows.js', 'javascript'],
  ['auth-security.js', 'auth-security.js', 'javascript'],
  ['admin-mfa.js', 'admin-mfa.js', 'javascript'],
  ['app.js', 'app.js', 'javascript'],
  ['business.js', 'business.js', 'javascript'],
  ['app.html', 'app', 'html'],
  ['business.html', 'business', 'html'],
].map(([source, route, type]) => Object.freeze({ source, route, type })));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const normalize = text => text.replace(/\r\n?/g, '\n');
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const fail = code => { const error = new Error(code); error.code = code; throw error; };

export function validateContract(contract) {
  if (!contract || contract.stage_step !== '10.2' || contract.project !== STAGING_PROJECT
      || contract.origin !== STAGING_ORIGIN || !/^[a-f0-9]{40}$/.test(contract.source_parent_commit || '')
      || ['hosted_acceptance', 'hosted_operations_acceptance', 'native_security_acceptance', 'store_acceptance',
        'candidate_deployed', 'actual_notification_email_or_charge_dispatched', 'SQL_or_cron_or_settings_changed',
        'production_or_native_changed'].some(key => contract[key] !== false)
      || !Array.isArray(contract.source_targets) || contract.source_targets.length !== TARGETS.length) {
    fail('REVIEWED_SOURCE_CONTRACT_REQUIRED');
  }
  for (let index = 0; index < TARGETS.length; index += 1) {
    const target = contract.source_targets[index];
    if (!target || ['source', 'route', 'type'].some(key => target[key] !== TARGETS[index][key])
        || !/^[a-f0-9]{64}$/.test(target.normalized_source_sha256 || '')) {
      fail('FIXED_STAGING_TARGETS_REQUIRED');
    }
  }
  return contract;
}

export function parseCollectionArguments(args, sourcePin) {
  const expected = ['--collect-public-staging-metadata', `--confirm-staging=${STAGING_PROJECT}`, `--source-pin=${sourcePin}`];
  if (args.length !== expected.length || args.some((value, index) => value !== expected[index])) {
    fail('EXACT_PUBLIC_STAGING_ARGUMENTS_REQUIRED');
  }
}

export async function loadReviewedSources(root, contract) {
  validateContract(contract);
  root = resolve(root);
  let canonical;
  try {
    const info = await lstat(root);
    canonical = await realpath(root);
    if (!info.isDirectory() || info.isSymbolicLink() || !samePath(canonical, root)) fail('ORDINARY_SOURCE_ROOT_REQUIRED');
  } catch (error) {
    if (error.code === 'ORDINARY_SOURCE_ROOT_REQUIRED') throw error;
    fail('ORDINARY_SOURCE_ROOT_REQUIRED');
  }
  const result = [];
  for (const target of contract.source_targets) {
    let bytes;
    try {
      const path = resolve(root, target.source);
      const info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 2_097_152
          || !samePath(await realpath(path), path)) fail('ORDINARY_REVIEWED_SOURCE_REQUIRED');
      bytes = await readFile(path);
      if (bytes.byteLength > 2_097_152) fail('ORDINARY_REVIEWED_SOURCE_REQUIRED');
    } catch (error) {
      if (error.code === 'ORDINARY_REVIEWED_SOURCE_REQUIRED') throw error;
      fail('ORDINARY_REVIEWED_SOURCE_REQUIRED');
    }
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { fail('REVIEWED_SOURCE_ENCODING_REQUIRED'); }
    const normalized = normalize(text);
    if (sha(Buffer.from(normalized)) !== target.normalized_source_sha256) fail('REVIEWED_SOURCE_HASH_MISMATCH');
    result.push(Object.freeze({ ...target,
      normalized_staging_overlay_sha256: sha(Buffer.from(normalized.split(PRODUCTION_PROJECT).join(STAGING_PROJECT))),
    }));
  }
  return Object.freeze(result);
}

function withAbort(promise, signal) {
  if (signal.aborted) return Promise.reject(new Error('METADATA_TIMEOUT'));
  return new Promise((resolvePromise, rejectPromise) => {
    const aborted = () => rejectPromise(new Error('METADATA_TIMEOUT'));
    signal.addEventListener('abort', aborted, { once: true });
    Promise.resolve(promise).then(resolvePromise, rejectPromise)
      .finally(() => signal.removeEventListener('abort', aborted));
  });
}

async function boundedBody(response, limit, signal) {
  if (!response.body?.getReader) fail('METADATA_BODY_UNAVAILABLE');
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const chunk = await withAbort(reader.read(), signal);
      if (chunk.done) break;
      if (!(chunk.value instanceof Uint8Array)) fail('METADATA_BODY_INVALID');
      bytes += chunk.value.byteLength;
      if (bytes > limit) fail('METADATA_BODY_TOO_LARGE');
      chunks.push(chunk.value);
    }
    return Buffer.concat(chunks, bytes);
  } finally {
    try { Promise.resolve(reader.cancel()).catch(() => {}); } catch {}
    try { reader.releaseLock(); } catch {}
  }
}

const safeError = error => ['METADATA_TIMEOUT', 'METADATA_BODY_TOO_LARGE', 'METADATA_BODY_UNAVAILABLE',
  'METADATA_BODY_INVALID', 'METADATA_ENCODING_INVALID', 'UNEXPECTED_RESPONSE_DESTINATION'].includes(error?.message)
  ? error.message : 'METADATA_TRANSPORT_FAILURE';
function contentKind(response) {
  const mime = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (mime === 'text/html') return 'html';
  if (['application/javascript', 'text/javascript', 'application/ecmascript', 'text/ecmascript'].includes(mime)) return 'javascript';
  return 'other_or_missing';
}

export async function collectPublicMetadata({ reviewedSources, sourcePin, fetchImpl = globalThis.fetch,
  requestTimeoutMs = 6000, totalTimeoutMs = 30000 }) {
  if (!Array.isArray(reviewedSources) || reviewedSources.length !== TARGETS.length
      || reviewedSources.some((value, i) => ['source', 'route', 'type'].some(key => value[key] !== TARGETS[i][key])
        || !/^[a-f0-9]{64}$/.test(value.normalized_staging_overlay_sha256 || ''))
      || !/^[a-f0-9]{40}$/.test(sourcePin || '')) fail('REVIEWED_SOURCE_CONTRACT_REQUIRED');
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 6000
      || !Number.isInteger(totalTimeoutMs) || totalTimeoutMs < 1 || totalTimeoutMs > 30000) fail('BOUNDED_TIMEOUT_REQUIRED');
  const overall = new AbortController();
  const deadline = setTimeout(() => overall.abort(), totalTimeoutMs);
  const samples = [];
  let attempted = 0;
  try {
    for (const target of reviewedSources) {
      const sample = { path: target.route, source_path: target.source, expected_type: target.type };
      if (overall.signal.aborted) {
        samples.push({ ...sample, result: 'NOT_REQUESTED_TOTAL_DEADLINE' });
        continue;
      }
      const controller = new AbortController();
      const abort = () => controller.abort();
      overall.signal.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(abort, requestTimeoutMs);
      const url = `${STAGING_ORIGIN}/${target.route}`;
      let response;
      try {
        attempted += 1;
        response = await withAbort(fetchImpl(url, { method: 'GET', redirect: 'manual', credentials: 'omit',
          headers: { Accept: target.type === 'html' ? 'text/html' : 'application/javascript, text/javascript' },
          signal: controller.signal }), controller.signal);
        if (response.redirected || (response.url && response.url !== url)) fail('UNEXPECTED_RESPONSE_DESTINATION');
        sample.http_status = response.status;
        if (response.status !== 200) {
          samples.push({ ...sample, result: response.status >= 300 && response.status < 400
            ? 'REDIRECT_NOT_FOLLOWED_REVIEW' : 'HTTP_STATUS_REVIEW' });
          continue;
        }
        const body = await boundedBody(response, target.source === 'config.js' ? 32768 : 2_097_152, controller.signal);
        let text;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(body); }
        catch { fail('METADATA_ENCODING_INVALID'); }
        const looksHTML = /^\s*(?:<!doctype\s+html\b|<html\b|<head\b|<body\b)/i.test(text);
        const observedType = contentKind(response);
        Object.assign(sample, { bytes: body.byteLength, sha256: sha(body), observed_type: observedType,
          looks_like_HTML: looksHTML, type_matches: observedType === target.type && (target.type !== 'javascript' || !looksHTML),
          normalized_staging_overlay_matches: target.source === 'config.js' ? null
            : sha(Buffer.from(normalize(text))) === target.normalized_staging_overlay_sha256 });
        if (target.source === 'config.js') {
          sample.expected_staging_reference_present = text.includes(STAGING_PROJECT);
          sample.production_reference_present = text.includes(PRODUCTION_PROJECT);
          sample.forbidden_secret_marker_observed = /sb_secret_[A-Za-z0-9_-]+|cur_(?:live|test)_[A-Za-z0-9_-]+/.test(text);
        }
        sample.result = !sample.type_matches ? 'FAIL_SELECTED_PUBLIC_ASSET_TYPE'
          : target.source === 'config.js' ? (sample.expected_staging_reference_present && !sample.production_reference_present
            && !sample.forbidden_secret_marker_observed ? 'EXPECTED_STAGING_CONFIG_REFERENCE_OBSERVED'
              : 'FAIL_SELECTED_PUBLIC_CONFIG_PREREQUISITE')
            : sample.normalized_staging_overlay_matches ? 'MATCH_SELECTED_PUBLIC_SOURCE_METADATA' : 'REVIEW_SELECTED_PUBLIC_SOURCE_PARITY';
        samples.push(sample);
      } catch (error) {
        samples.push({ ...sample, result: 'UNVERIFIED_REQUEST_OR_BODY', error_code: safeError(error) });
      } finally {
        clearTimeout(timer);
        overall.signal.removeEventListener('abort', abort);
        try { Promise.resolve(response?.body?.cancel()).catch(() => {}); } catch {}
      }
    }
  } finally { clearTimeout(deadline); }
  return {
    stage_step: '10.3', candidate_stage_step: '10.2', checked_UTC: new Date().toISOString(),
    result: samples.every(sample => ['EXPECTED_STAGING_CONFIG_REFERENCE_OBSERVED', 'MATCH_SELECTED_PUBLIC_SOURCE_METADATA'].includes(sample.result))
      ? 'PUBLIC_STATIC_METADATA_PREREQUISITES_SCOPED_MATCH' : 'PUBLIC_STATIC_METADATA_REVIEW_REQUIRED',
    scope: 'FIXED_PUBLIC_STAGING_STATIC_GET_METADATA_NOT_AUTH_SQL_JOBS_ALERTS_RECOVERY_OR_RELEASE_ACCEPTANCE',
    source_parent_commit: sourcePin, project: STAGING_PROJECT, requests_attempted: attempted,
    redirects_followed: 0, authenticated_requests: 0, samples,
    response_bodies_keys_or_headers_printed: false, key_ownership_or_complete_secret_scan_verified: false,
    installed_backend_or_full_CI_or_artifact_parity_verified: false, full_operations_grouped_cases_run: 0,
    hosted_operations_acceptance: false, hosted_acceptance: false, native_security_acceptance: false,
    store_acceptance: false, notification_email_or_charge_dispatched: false,
    accounts_fixtures_Auth_Storage_SQL_settings_changed: false, production_or_native_changed: false,
    APK_update_deferred: true, findings_closed: [],
  };
}
