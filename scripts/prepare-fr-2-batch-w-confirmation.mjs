// Confirmation callback UI only; reuse the exact accepted concise-copy public ZIP.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readCanonicalPublicZIP} from './prepare-fr-2-email-modern-package.mjs';
import {createPublicZIP} from './lib/store-public-zip.mjs';
const root = new URL('../', import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const stage = 'FR.2.5.W8_CONFIRMATION_ONLY_SUCCESS_AND_RETURN_TO_SIGNIN';
export const display = 'Stage 3/10 | FR.2/8 | Batch W/Z';
export const retainedZIPHash = 'a6c5a3a3111b0a78af375a0ccf86f1bc7387e78b4a4b57adbada1efe04d8879d';
export const confirmationFiles = [
  {name:'auth-flows.js', before:'e922a7c2c3d4275d0f2590dfab7d0f390717dbbac79cece90397b9a5b6a549db', after:'ffee5b12df573326bf370be955ab5efb3dd12d9c96cedecec317b08fe7f808ea'},
  {name:'auth.html', before:'30209705284024ded1cfcfdc941cb4f3809f2e0c6cc23059c0da4c6a76472f49', after:'7dc63cebb5001e156cbec642594f512cc886f05f5dff8b3fa8ff621044d28b65'}
];
export function verifyConfirmationSources() {
  const manifest = JSON.parse(fs.readFileSync(new URL('docs/security-audit/security-fr-2-batch-w-confirmation-source-manifest.json', root), 'utf8'));
  const rows = Object.entries(manifest.file_sha256 || {});
  if (manifest.stage_step !== stage || rows.length !== manifest.source_file_count || rows.length !== 19) throw Error('CONFIRMATION_SOURCE_REQUIRED');
  for (const [name, digest] of rows) {
    if (!/^[A-Za-z0-9_./-]+$/.test(name) || name.includes('..') || !/^[a-f0-9]{64}$/.test(digest)) throw Error('CONFIRMATION_SOURCE_REQUIRED');
    const file = new URL(name, root);
    if (!fs.lstatSync(file).isFile() || hash(fs.readFileSync(file)) !== digest) throw Error('CONFIRMATION_SOURCE_REQUIRED');
  }
  return rows.length;
}
export function patchConfirmationEntries(previous) {
  if (!(previous instanceof Map) || previous.size !== 44) throw Error('PUBLIC_SET_REQUIRED');
  const next = new Map(previous), selected = new Set(confirmationFiles.map(row => row.name));
  for (const row of confirmationFiles) {
    if (!Buffer.isBuffer(previous.get(row.name)) || hash(previous.get(row.name)) !== row.before) throw Error('PRIOR_CONFIRMATION_SOURCE_REQUIRED');
    const bytes = fs.readFileSync(new URL(row.name, root));
    if (hash(bytes) !== row.after) throw Error('CONFIRMATION_SOURCE_REQUIRED');
    next.set(row.name, bytes);
  }
  if ([...previous].filter(([name, bytes]) => !selected.has(name) && Buffer.isBuffer(bytes) && bytes.equals(next.get(name))).length !== 42) throw Error('UNRELATED_PUBLIC_CHANGE_REFUSED');
  return next;
}
function ordinary(filename, directory = false) {
  if (typeof filename !== 'string' || !path.isAbsolute(filename)) throw Error('PUBLIC_PATH_REQUIRED');
  for (let current = filename;;) {
    if (fs.lstatSync(current).isSymbolicLink()) throw Error('PUBLIC_PATH_REQUIRED');
    const parent = path.dirname(current); if (parent === current) break; current = parent;
  }
  if (directory ? !fs.statSync(filename).isDirectory() : !fs.statSync(filename).isFile()) throw Error('PUBLIC_PATH_REQUIRED');
}
export function prepareConfirmationZIP(retainedZIP, outputDirectory) {
  const sourceCount = verifyConfirmationSources();
  ordinary(retainedZIP); ordinary(outputDirectory, true);
  if (fs.readdirSync(outputDirectory).length) throw Error('EMPTY_OUTPUT_REQUIRED');
  if (fs.statSync(retainedZIP).size > 8388608) throw Error('RETAINED_CONCISE_COPY_ZIP_REQUIRED');
  const previous = fs.readFileSync(retainedZIP);
  if (hash(previous) !== retainedZIPHash) throw Error('RETAINED_CONCISE_COPY_ZIP_REQUIRED');
  const next = patchConfirmationEntries(readCanonicalPublicZIP(previous));
  const bytes = createPublicZIP([...next]), decoded = readCanonicalPublicZIP(bytes);
  if ([...next].some(([name, contents]) => !contents.equals(decoded.get(name))) || hash(fs.readFileSync(retainedZIP)) !== retainedZIPHash) throw Error('ZIP_READBACK_REQUIRED');
  const filename = path.join(outputDirectory, 'mushavo-confirmation-signin-staging.zip');
  fs.writeFileSync(filename, bytes, {flag:'wx'});
  if (!fs.readFileSync(filename).equals(bytes) || hash(fs.readFileSync(retainedZIP)) !== retainedZIPHash) throw Error('ZIP_READBACK_REQUIRED');
  return {stage_step:stage,progress_display:display,result:'CONFIRMATION_ONLY_RETURN_TO_SIGNIN_PUBLIC_ZIP_PREPARED_NOT_DEPLOYED',
    source_parent_commit:'c18c2c876accab999c9463c42a70cdfb33bcb99f',source_hashes_verified:sourceCount,
    public_files:44,changed_files:confirmationFiles.map(row=>row.name),unchanged_public_entries:42,
    retained_ZIP_SHA256_verified:retainedZIPHash,retained_ZIP_unchanged:true,
    configuration_worker_service_worker_headers_routes_and_prior_short_messages_preserved:true,
    existing_new_device_signin_security_unchanged:true,ZIP_path:filename,ZIP_SHA256:hash(bytes),
    portable_ZIP_readback_verified:true,Windows_dotNET_ZIP_readback_verified:false,
    actual_hosted_requests:0,real_email_requests:0,settings_or_mode_or_account_writes:0,frontend_uploaded:false,
    pending_batch_V_MFA_deferred_by_owner:true,full_lettered_batch_W_complete:false,
    hosted_acceptance:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],exit_code:0};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4) throw Error('PUBLIC_PATH_REQUIRED');
    console.log(JSON.stringify(prepareConfirmationZIP(process.argv[2], process.argv[3]), null, 2));
  } catch (error) {
    const known = new Set(['CONFIRMATION_SOURCE_REQUIRED','PUBLIC_SET_REQUIRED','PRIOR_CONFIRMATION_SOURCE_REQUIRED','UNRELATED_PUBLIC_CHANGE_REFUSED','PUBLIC_PATH_REQUIRED','EMPTY_OUTPUT_REQUIRED','RETAINED_CONCISE_COPY_ZIP_REQUIRED','ZIP_READBACK_REQUIRED']);
    console.log(JSON.stringify({stage_step:stage,progress_display:display,result:'CONFIRMATION_RETURN_TO_SIGNIN_PREPARATION_REVIEW_REQUIRED',
      problem_code:known.has(error?.message)?error.message:'PUBLIC_ZIP_OR_SOURCE_REQUIRED',actual_hosted_requests:0,
      real_email_requests:0,settings_or_mode_or_account_writes:0,frontend_uploaded:false,
      pending_batch_V_MFA_deferred_by_owner:true,hosted_acceptance:false,production_or_native_changed:false,exit_code:1},null,2));
    process.exitCode=1;
  }
}
