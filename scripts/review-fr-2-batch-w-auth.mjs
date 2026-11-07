import {readFile, lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {reviewAuthSettings, stage, display} from './lib/auth-batch-w-review.mjs';
import {privateTerminal} from './lib/operator-private-terminal.mjs';

export const unsafePrivateEnvironment = env => Object.entries(env).some(([k, v]) => v &&
  /^(?:NODE_OPTIONS|NODE_DEBUG|NODE_DEBUG_NATIVE|NODE_TLS_REJECT_UNAUTHORIZED|SSLKEYLOGFILE|SUPABASE_.*|ZOHO_.*|EMAIL_GATE_.*|CLOUDFLARE_.*|CF_API_.*|WRANGLER_.*)$|(?:TOKEN|PASSWORD|SECRET)$/i.test(k));

export async function verifyWSources() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const m = JSON.parse(await readFile(path.join(root, 'docs/security-audit/security-fr-2-batch-w-source-manifest.json'), 'utf8'));
  if (m.stage_step !== stage || m.source_file_count !== 345 || Object.keys(m.file_sha256).length !== m.source_file_count) throw Error('BATCH_W_SOURCE_MANIFEST_REQUIRED');
  for (const [name, expected] of Object.entries(m.file_sha256)) {
    if (!/^[A-Za-z0-9_./-]+$/.test(name) || name.includes('..') || path.isAbsolute(name) || !/^[a-f0-9]{64}$/.test(expected)) throw Error('BATCH_W_SOURCE_MANIFEST_REQUIRED');
    for (let p = path.join(root, name);;) {
      if ((await lstat(p)).isSymbolicLink()) throw Error('BATCH_W_SOURCE_PATH_REQUIRED');
      const parent = path.dirname(p); if (parent === p) break; p = parent;
    }
    if (createHash('sha256').update(await readFile(path.join(root, name))).digest('hex') !== expected) throw Error('BATCH_W_SOURCE_IDENTITY_REQUIRED');
  }
  const previous = JSON.parse(await readFile(path.join(root, 'docs/security-audit/security-fr-2-batch-v-recovery-source-manifest.json'), 'utf8'));
  if (previous.source_file_count !== 339 || Object.entries(previous.file_sha256).some(([n, h]) => m.file_sha256[n] !== h)) throw Error('BATCH_W_PREVIOUS339_SOURCE_REQUIRED');
  const contract = JSON.parse(await readFile(path.join(root, 'docs/security-audit/security-fr-2-batch-w-contract.json'), 'utf8'));
  if (contract.required_AU_case_count !== 31 || contract.acceptance_cases.length !== 31 || new Set(contract.acceptance_cases.map(x => x.id)).size !== 31) throw Error('BATCH_W_AU31_CONTRACT_REQUIRED');
  return m.source_file_count;
}

export async function authReviewEntry({sourceCheck = verifyWSources, io, transport} = {}) {
  const hashes = await sourceCheck();
  io.notice(display + ' — STARTED: read-only Auth settings; Batch V MFA remains pending during phone transfer.');
  io.notice('One hidden prompt: reuse your staging Management token. No password, authenticator, email code, factor change or settings write.');
  const input = {managementToken: (await io.prompt('Same staging Management token (hidden):')).trim()};
  try { const result = await reviewAuthSettings(input, {transport}); result.source_hashes_verified = hashes; return result; }
  finally { input.managementToken = ''; }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let terminal, result;
  try {
    if (process.argv.length !== 3 || process.argv[2] !== '--staging-auth-read-only') throw Error('STAGING_ARGUMENT_REQUIRED');
    if (unsafePrivateEnvironment(process.env)) throw Error('PRIVATE_ENVIRONMENT_REVIEW_REQUIRED');
    terminal = privateTerminal(); result = await authReviewEntry({io: terminal});
  } catch (e) {
    const allowed = new Set(['STAGING_ARGUMENT_REQUIRED', 'PRIVATE_ENVIRONMENT_REVIEW_REQUIRED',
      'BATCH_W_SOURCE_MANIFEST_REQUIRED', 'BATCH_W_SOURCE_PATH_REQUIRED', 'BATCH_W_SOURCE_IDENTITY_REQUIRED',
      'BATCH_W_PREVIOUS339_SOURCE_REQUIRED', 'BATCH_W_AU31_CONTRACT_REQUIRED', 'PRIVATE_INTERACTIVE_TERMINAL_REQUIRED', 'OWNER_CANCELLED']);
    result = {stage_step: stage, progress_display: display, result: 'BATCH_W_READ_ONLY_REVIEW_NOT_STARTED',
      problem_code: allowed.has(e?.message) ? e.message : 'LOCAL_SOURCE_OR_TERMINAL_REVIEW_REQUIRED',
      actual_hosted_requests: 0, Auth_requests: 0, factor_changes_requested: false,
      settings_or_roles_or_accounts_or_sessions_changed: false, committed_mode_change_requests: 0, exit_code: 1};
  } finally { terminal?.close(); }
  process.stdout.write('\nBEGIN SAFE BATCH W READ ONLY RESULT\n' + JSON.stringify(result, null, 2) + '\nEND SAFE BATCH W READ ONLY RESULT\n');
  process.stdout.write(display + ' — ' + (result.exit_code === 0
    ? 'COMPLETE: read-only inspection only; V MFA and full W acceptance remain pending.'
    : 'STOPPED FOR REVIEW: return the safe result; no automatic retry or settings change.') + '\n');
  process.exitCode = result.exit_code;
}
