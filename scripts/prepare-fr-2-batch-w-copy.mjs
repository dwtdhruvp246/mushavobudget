// Reuse the accepted public password-eight ZIP; change only two confirmation messages.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readCanonicalPublicZIP} from './prepare-fr-2-email-modern-package.mjs';
import {createPublicZIP} from './lib/store-public-zip.mjs';

const root = new URL('../', import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const stage = 'FR.2.5.W6_ORDINARY_SIGNUP_OWNER_RESULT_AND_CONCISE_CONFIRMATION_COPY';
export const display = 'Stage 3/10 | FR.2/8 | Batch W/Z';
export const retainedZIPHash = '3255992abbc6058afa2e74f804cc19b3d9337d2380db52d52b82d0363454218b';
export const copyChanges = [
  {
    name: 'app.js',
    before: 'If an account can be created, check your inbox for confirmation before signing in. Existing account holders can sign in or use Forgot password. Use Resend confirmation if you need another link.',
    after: 'Check your inbox to confirm your email, then sign in.',
    previousSHA256: '05e08c2c7b62303ebb2f4b9b45a3fc7232e24ece61793df9e0a8551c4f7061bb',
    nextSHA256: 'ba02a923b8373d5812df1499ab570fafb45cad078d252ef63d42cb087a866e8e'
  },
  {
    name: 'auth-security.js',
    before: 'Confirm your email before signing in. Open the newest email or request another confirmation link.',
    after: 'Confirm your email before signing in.',
    previousSHA256: '664146415c65d1018350544875d76a4f564ee471a85fbfa562180316a1a2baff',
    nextSHA256: '5a536b4913a91f7575e4841e96c29c2686b07bffa0a36337757bba738bf2e762'
  }
];

export function verifyCopySources() {
  const manifest = JSON.parse(fs.readFileSync(new URL('docs/security-audit/security-fr-2-batch-w-copy-source-manifest.json', root), 'utf8'));
  const rows = Object.entries(manifest.file_sha256 || {});
  if (manifest.stage_step !== stage || rows.length !== manifest.source_file_count || rows.length < 10) throw Error('BATCH_W_COPY_SOURCE_REQUIRED');
  for (const [name, digest] of rows) {
    if (!/^[A-Za-z0-9_./-]+$/.test(name) || name.includes('..') || !/^[a-f0-9]{64}$/.test(digest)) throw Error('BATCH_W_COPY_SOURCE_REQUIRED');
    const file = new URL(name, root);
    if (!fs.lstatSync(file).isFile() || hash(fs.readFileSync(file)) !== digest) throw Error('BATCH_W_COPY_SOURCE_REQUIRED');
  }
  return rows.length;
}

export function replaceConfirmationCopy(entries) {
  if (!(entries instanceof Map) || entries.size !== 44) throw Error('BATCH_W_PUBLIC_SET_REQUIRED');
  const next = new Map(entries);
  for (const change of copyChanges) {
    const previous = entries.get(change.name);
    if (!Buffer.isBuffer(previous) || hash(previous) !== change.previousSHA256) throw Error('BATCH_W_PRIOR_COPY_SOURCE_REQUIRED');
    const text = previous.toString('utf8');
    if (text.split(change.before).length !== 2) throw Error('BATCH_W_PRIOR_COPY_SOURCE_REQUIRED');
    const updated = Buffer.from(text.replace(change.before, change.after));
    if (hash(updated) !== change.nextSHA256) throw Error('BATCH_W_COPY_SOURCE_REQUIRED');
    next.set(change.name, updated);
  }
  const selected = new Set(copyChanges.map(change => change.name));
  if ([...entries].filter(([name, bytes]) => !selected.has(name) && Buffer.isBuffer(bytes) && bytes.equals(next.get(name))).length !== 42) throw Error('BATCH_W_UNRELATED_PUBLIC_CHANGE_REFUSED');
  return next;
}

function ordinary(filename, directory = false) {
  if (typeof filename !== 'string' || !path.isAbsolute(filename)) throw Error('BATCH_W_PUBLIC_PATH_REQUIRED');
  for (let current = filename;;) {
    if (fs.lstatSync(current).isSymbolicLink()) throw Error('BATCH_W_PUBLIC_PATH_REQUIRED');
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  if (directory ? !fs.statSync(filename).isDirectory() : !fs.statSync(filename).isFile()) throw Error('BATCH_W_PUBLIC_PATH_REQUIRED');
}

export function prepareCopyZIP(retainedZIP, outputDirectory) {
  const sourceCount = verifyCopySources();
  ordinary(retainedZIP);
  ordinary(outputDirectory, true);
  if (fs.readdirSync(outputDirectory).length) throw Error('BATCH_W_EMPTY_OUTPUT_REQUIRED');
  if (fs.statSync(retainedZIP).size > 8388608) throw Error('BATCH_W_RETAINED_PASSWORD8_ZIP_REQUIRED');
  const previous = fs.readFileSync(retainedZIP);
  if (hash(previous) !== retainedZIPHash) throw Error('BATCH_W_RETAINED_PASSWORD8_ZIP_REQUIRED');
  const next = replaceConfirmationCopy(readCanonicalPublicZIP(previous));
  const bytes = createPublicZIP([...next]);
  const readback = readCanonicalPublicZIP(bytes);
  if ([...next].some(([name, contents]) => !contents.equals(readback.get(name))) || hash(fs.readFileSync(retainedZIP)) !== retainedZIPHash) throw Error('BATCH_W_ZIP_READBACK_REQUIRED');
  const filename = path.join(outputDirectory, 'mushavo-confirmation-copy-staging.zip');
  fs.writeFileSync(filename, bytes, {flag: 'wx'});
  if (!fs.readFileSync(filename).equals(bytes) || hash(fs.readFileSync(retainedZIP)) !== retainedZIPHash) throw Error('BATCH_W_ZIP_READBACK_REQUIRED');
  return {
    stage_step: stage, progress_display: display,
    result: 'BATCH_W_CONCISE_CONFIRMATION_COPY_ZIP_PREPARED_NOT_DEPLOYED',
    source_parent_commit: '35a1e70649a4e9407fbe519596959a5f562524a9',
    source_hashes_verified: sourceCount,
    public_files: 44, changed_files: copyChanges.map(change => change.name), unchanged_public_entries: 42,
    retained_ZIP_SHA256_verified: retainedZIPHash, retained_ZIP_unchanged: true,
    configuration_worker_service_worker_headers_and_routes_byte_preserved: true,
    ZIP_path: filename, ZIP_SHA256: hash(bytes), portable_ZIP_readback_verified: true,
    Windows_dotNET_ZIP_readback_verified: false,
    actual_hosted_requests: 0, real_email_requests: 0, settings_or_mode_or_account_writes: 0,
    frontend_uploaded: false, pending_batch_V_MFA_deferred_by_owner: true,
    full_lettered_batch_W_complete: false, hosted_acceptance: false,
    production_or_native_changed: false, APK_update_deferred: true, findings_closed: [], exit_code: 0
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4) throw Error('BATCH_W_PUBLIC_PATH_REQUIRED');
    console.log(JSON.stringify(prepareCopyZIP(process.argv[2], process.argv[3]), null, 2));
  } catch (error) {
    const known = new Set(['BATCH_W_COPY_SOURCE_REQUIRED', 'BATCH_W_PUBLIC_SET_REQUIRED', 'BATCH_W_PRIOR_COPY_SOURCE_REQUIRED', 'BATCH_W_UNRELATED_PUBLIC_CHANGE_REFUSED', 'BATCH_W_PUBLIC_PATH_REQUIRED', 'BATCH_W_EMPTY_OUTPUT_REQUIRED', 'BATCH_W_RETAINED_PASSWORD8_ZIP_REQUIRED', 'BATCH_W_ZIP_READBACK_REQUIRED']);
    console.log(JSON.stringify({
      stage_step: stage, progress_display: display, result: 'BATCH_W_CONFIRMATION_COPY_PREPARATION_REVIEW_REQUIRED',
      problem_code: known.has(error?.message) ? error.message : 'BATCH_W_PUBLIC_ZIP_OR_SOURCE_REQUIRED',
      actual_hosted_requests: 0, real_email_requests: 0, settings_or_mode_or_account_writes: 0,
      frontend_uploaded: false, pending_batch_V_MFA_deferred_by_owner: true,
      full_lettered_batch_W_complete: false, hosted_acceptance: false, production_or_native_changed: false, exit_code: 1
    }, null, 2));
    process.exitCode = 1;
  }
}
