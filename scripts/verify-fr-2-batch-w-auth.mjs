import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {verifyWSources} from './review-fr-2-batch-w-auth.mjs';
import {stage, display} from './lib/auth-batch-w-review.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
let hashes = 0, syntax = 0, group = null, checkpoint = 'SOURCE_IDENTITIES', problem = null;
try {
  assert.equal(process.argv.length, 2); hashes = await verifyWSources();
  const manifest = JSON.parse(await readFile(path.join(root, 'docs/security-audit/security-fr-2-batch-w-source-manifest.json'), 'utf8'));
  checkpoint = 'SYNTAX';
  for (const name of manifest.syntax_paths) {
    assert.equal(spawnSync(process.execPath, ['--check', path.join(root, name)], {encoding: 'utf8', timeout: 30000}).status, 0); syntax++;
  }
  checkpoint = 'READ_ONLY_TRANSPORT_PROJECTION_AND_DIALOGUE_TESTS';
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/(TOKEN|PASSWORD|SECRET|SUPABASE|ZOHO|EMAIL_GATE|NODE_OPTIONS|NODE_DEBUG|NODE_TLS|SSLKEYLOG|CLOUDFLARE|WRANGLER)/i.test(k)));
  const out = spawnSync(process.execPath, ['--require', path.join(root, 'scripts/offline-test-network.cjs'),
    '--test', '--test-concurrency=1', '--test-reporter=tap', path.join(root, 'tests/fr-2-batch-w-auth.test.mjs')],
    {cwd: root, env, encoding: 'utf8', timeout: 90000, maxBuffer: 4 * 1024 * 1024});
  const count = k => Number((out.stdout || '').match(new RegExp('^# ' + k + ' (\\d+)\\s*$', 'm'))?.[1] ?? -1);
  group = {tests: count('tests'), pass: count('pass'), fail: count('fail'), cancelled: count('cancelled'), skipped: count('skipped'),
    exit_code: out.status, failed_case_numbers: [...(out.stdout || '').matchAll(/^not ok ([0-9]+) - /gm)].map(x => Number(x[1]))};
  assert.equal(group.tests, 20); assert.equal(group.pass, 20); assert.equal(group.fail, 0);
  assert.equal(group.cancelled, 0); assert.equal(group.skipped, 0); assert.equal(group.exit_code, 0); checkpoint = 'COMPLETE';
} catch { problem = 'BATCH_W_LOCAL_READ_ONLY_REVIEW_REQUIRED'; }
const ok = checkpoint === 'COMPLETE' && !problem;
console.log(JSON.stringify({stage_step: stage, progress_display: display,
  result: ok ? 'BATCH_W_LOCAL20_PASS_READ_ONLY_AUTH_REVIEW_OWNER_READY' : 'BATCH_W_LOCAL_REVIEW_REQUIRED',
  source_parent_commit: '4396cb32033802d37b4fd2a8d7f84da92e692901',
  node_version: process.version, source_hashes_verified: hashes, syntax_checks: syntax,
  prior339_source_hashes_unchanged: ok, frozen_U310_source_hashes_unchanged: ok,
  tests: group?.tests ?? 0, pass: group?.pass ?? 0, fail: group?.fail ?? 0, group,
  actual_hosted_requests: 0, real_credentials_or_private_packets_accessed: false,
  real_email_requests: 0, real_factors_roles_or_settings_changed: false,
  required_AU_cases: 31, actual_hosted_AU_cases_run: 0,
  previous_owner_V86_pass_reused_not_repeated: true, pending_batch_V_MFA_deferred_by_owner: true,
  new_dependency_install_required: false, Windows_private_terminal_executed: false,
  full_lettered_batch_W_complete: false, hosted_acceptance: false,
  production_or_native_changed: false, APK_update_deferred: true, findings_closed: [],
  checkpoint, problem_code: problem, exit_code: ok ? 0 : 1, checked_UTC: new Date().toISOString()}, null, 2));
process.exitCode = ok ? 0 : 1;
