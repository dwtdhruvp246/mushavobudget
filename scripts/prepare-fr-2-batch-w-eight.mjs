// Patch only the three password-policy files in the exact accepted U public ZIP.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {verifyFrontendZIP} from './check-fr-2-email-batch-g.mjs';
import {readCanonicalPublicZIP} from './prepare-fr-2-email-modern-package.mjs';
import {createPublicZIP} from './lib/store-public-zip.mjs';
import {verifyEightSources, stage, display} from './lib/auth-eight-source.mjs';
const root = new URL('../', import.meta.url), hash = x => createHash('sha256').update(x).digest('hex');
export const retainedZIPHash = '03542ed32e0ef32392f718f518248954a81f5317e94b77adf90c5c2b9457fd1a';
export const policyFiles = ['auth-security.js', 'auth.html', 'signup.html'];
const staging = bytes => Buffer.from(bytes.toString('utf8').replaceAll('kttkospkblwvguuwnhjj', 'dczlddwbtgvfdujgcitb'));
const prior = JSON.parse(fs.readFileSync(new URL('docs/security-audit/security-fr-2-batch-w-eight-contract.json', root))).prior_public_policy_SHA256;
const candidates = () => new Map(policyFiles.map(n => [n, staging(fs.readFileSync(new URL(n, root)))]));
export function replacePasswordPolicyEntries(entries) {
  if (!(entries instanceof Map) || entries.size !== 44) throw Error('BATCH_W_PUBLIC_SET_REQUIRED');
  const next = new Map(entries), changed = candidates();
  for (const name of policyFiles) {
    if (!Buffer.isBuffer(entries.get(name)) || hash(entries.get(name)) !== prior[name]) throw Error('BATCH_W_PRIOR_PASSWORD_SOURCE_REQUIRED');
    next.set(name, changed.get(name));
  }
  if ([...entries].filter(([n, b]) => !policyFiles.includes(n) && Buffer.isBuffer(b) && b.equals(next.get(n))).length !== 41) throw Error('BATCH_W_UNRELATED_PUBLIC_CHANGE_REFUSED');
  return next;
}
function ordinary(filename, directory = false) {
  if (typeof filename !== 'string' || !path.isAbsolute(filename)) throw Error('BATCH_W_PUBLIC_PATH_REQUIRED');
  for (let p = filename;;) {
    if (fs.lstatSync(p).isSymbolicLink()) throw Error('BATCH_W_PUBLIC_PATH_REQUIRED');
    const parent = path.dirname(p); if (parent === p) break; p = parent;
  }
  if (directory ? !fs.statSync(filename).isDirectory() : !fs.statSync(filename).isFile()) throw Error('BATCH_W_PUBLIC_PATH_REQUIRED');
}
export async function prepareEightZIP(retainedZIP, outputDirectory) {
  const count = await verifyEightSources();
  ordinary(retainedZIP); ordinary(outputDirectory, true);
  if (fs.readdirSync(outputDirectory).length) throw Error('BATCH_W_EMPTY_OUTPUT_REQUIRED');
  verifyFrontendZIP(retainedZIP, {expectedZIP: retainedZIPHash});
  const old = fs.readFileSync(retainedZIP), next = replacePasswordPolicyEntries(readCanonicalPublicZIP(old));
  if ([...next.values()].some(b => b.includes(Buffer.from('kttkospkblwvguuwnhjj')))) throw Error('BATCH_W_PRODUCTION_REFERENCE_REFUSED');
  const bytes = createPublicZIP([...next]), decoded = readCanonicalPublicZIP(bytes);
  if ([...next].some(([n, b]) => !b.equals(decoded.get(n))) || hash(fs.readFileSync(retainedZIP)) !== retainedZIPHash) throw Error('BATCH_W_ZIP_READBACK_REQUIRED');
  const filename = path.join(outputDirectory, 'mushavo-password-eight-staging.zip');
  fs.writeFileSync(filename, bytes, {flag: 'wx'});
  if (!fs.readFileSync(filename).equals(bytes) || hash(fs.readFileSync(retainedZIP)) !== retainedZIPHash) throw Error('BATCH_W_ZIP_READBACK_REQUIRED');
  return {stage_step: stage, progress_display: display,
    result: 'BATCH_W_EIGHT_CHARACTER_PUBLIC_ZIP_PREPARED_NOT_DEPLOYED', source_hashes_verified: count,
    public_files: 44, changed_files: policyFiles, unchanged_public_entries: 41,
    retained_ZIP_SHA256_verified: retainedZIPHash, retained_ZIP_unchanged: true,
    staging_public_configuration_and_push_key_byte_preserved: true,
    gateway_worker_headers_routes_and_service_worker_byte_preserved: true,
    ZIP_path: filename, ZIP_SHA256: hash(bytes), entry_SHA256: Object.fromEntries([...next].map(([n, b]) => [n, hash(b)])),
    portable_ZIP_readback_verified: true, Windows_dotNET_ZIP_readback_verified: false,
    frontend_uploaded: false, Supabase_password_minimum_verified: false,
    actual_hosted_requests: 0, real_credentials_or_private_packets_accessed: false,
    real_email_requests: 0, committed_mode_change_requests: 0, pending_batch_V_MFA_deferred_by_owner: true,
    full_lettered_batch_W_complete: false, hosted_acceptance: false, production_or_native_changed: false,
    APK_update_deferred: true, findings_closed: [], exit_code: 0};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let result;
  try {
    if (process.argv.length !== 4) throw Error('BATCH_W_PUBLIC_PATH_REQUIRED');
    result = await prepareEightZIP(process.argv[2], process.argv[3]);
  } catch (e) {
    const safe = new Set(['BATCH_W_PUBLIC_SET_REQUIRED', 'BATCH_W_PRIOR_PASSWORD_SOURCE_REQUIRED',
      'BATCH_W_UNRELATED_PUBLIC_CHANGE_REFUSED', 'BATCH_W_PUBLIC_PATH_REQUIRED', 'BATCH_W_EMPTY_OUTPUT_REQUIRED', 'BATCH_W_ZIP_READBACK_REQUIRED', 'BATCH_W_PRODUCTION_REFERENCE_REFUSED']);
    result = {stage_step: stage, progress_display: display, result: 'BATCH_W_PUBLIC_ZIP_PREPARATION_REVIEW_REQUIRED',
      problem_code: safe.has(e?.message) ? e.message : 'RETAINED_REVIEWED_PUBLIC_ZIP_OR_SOURCE_REQUIRED',
      actual_hosted_requests: 0, committed_mode_change_requests: 0, exit_code: 1};
  }
  console.log(JSON.stringify(result, null, 2)); process.exitCode = result.exit_code;
}
