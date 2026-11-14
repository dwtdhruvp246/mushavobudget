import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {verifyEightSources, stage, display} from './lib/auth-eight-source.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
let count = 0, syntax = 0, group = null, checkpoint = 'SOURCE_IDENTITIES', problem = null;
try {
  assert.equal(process.argv.length, 2); count = await verifyEightSources();
  const manifest = JSON.parse(await readFile(path.join(root, 'docs/security-audit/security-fr-2-batch-w-eight-source-manifest.json'), 'utf8'));
  checkpoint = 'SYNTAX';
  for (const name of manifest.syntax_paths) {
    assert.equal(spawnSync(process.execPath, ['--check', path.join(root, name)], {encoding: 'utf8', timeout: 30000}).status, 0); syntax++;
  }
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/(TOKEN|PASSWORD|SECRET|SUPABASE|ZOHO|EMAIL_GATE|NODE_OPTIONS|NODE_DEBUG|NODE_TLS|SSLKEYLOG|CLOUDFLARE|WRANGLER)/i.test(k)));
  checkpoint = 'AFFECTED_AUTH_AND_RETAINED_PACKAGE_TESTS';
  const files = ['fr-2-batch-w-eight.test.mjs', 'fr-2-batch-w-auth.test.mjs', 'fr-2-batch-w-policy-sdk.test.mjs', 'stage-3-auth-flows.test.mjs', 'stage-3-auth-page.test.mjs'];
  const out = spawnSync(process.execPath, ['--experimental-vm-modules', '--require', path.join(root, 'scripts/offline-test-network.cjs'),
    '--test', '--test-concurrency=1', '--test-reporter=tap', ...files.map(n => path.join(root, 'tests', n))],
    {cwd: root, env, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024});
  const n = key => Number((out.stdout || '').match(new RegExp('^# ' + key + ' (\\d+)\\s*$', 'm'))?.[1] ?? -1);
  group = {tests: n('tests'), pass: n('pass'), fail: n('fail'), cancelled: n('cancelled'), skipped: n('skipped'),
    exit_code: out.status, failed_case_numbers: [...(out.stdout || '').matchAll(/^not ok ([0-9]+) - /gm)].map(x => Number(x[1]))};
  assert.equal(group.tests, 74); assert.equal(group.pass, 74); assert.equal(group.fail, 0);
  assert.equal(group.cancelled, 0); assert.equal(group.skipped, 0); assert.equal(group.exit_code, 0); checkpoint = 'COMPLETE';
} catch { problem = 'BATCH_W_EIGHT_CHARACTER_LOCAL_REVIEW_REQUIRED'; }
const ok = checkpoint === 'COMPLETE' && !problem;
console.log(JSON.stringify({stage_step: stage, progress_display: display,
  result: ok ? 'BATCH_W_OWNER_SELECTED_MINIMUM8_LOCAL74_PASS_PUBLIC_PACKAGE_READY' : 'BATCH_W_MINIMUM8_LOCAL_REVIEW_REQUIRED',
  source_parent_commit: 'ae235991910579b6eb4e4dd240a79149c37a326d', node_version: process.version,
  new_password_minimum: 8, source_hashes_verified: count, syntax_checks: syntax,
  tests: group?.tests ?? 0, pass: group?.pass ?? 0, fail: group?.fail ?? 0, group,
  policy_source_revisions: 7, intentional_prior_manifest_source_changes: 4,
  newly_covered_policy_source_revisions: 3, prior_manifests_preserved_as_historical: true,
  old_U_acceptance_not_claimed_for_modified_Auth_bytes: true,
  actual_pinned_SDK_with_synthetic_Auth_exercised: ok, public_three_file_patch_and_41_entry_preservation_exercised: ok,
  new_dependency_install_required: false, actual_hosted_requests: 0, real_credentials_or_private_packets_accessed: false,
  frontend_uploaded: false, Supabase_password_minimum_verified: false,
  real_email_requests: 0, committed_mode_change_requests: 0, pending_batch_V_MFA_deferred_by_owner: true,
  full_lettered_batch_W_complete: false, hosted_acceptance: false, production_or_native_changed: false,
  APK_update_deferred: true, findings_closed: [], checkpoint, problem_code: problem, exit_code: ok ? 0 : 1,
  checked_UTC: new Date().toISOString()}, null, 2));
process.exitCode = ok ? 0 : 1;
