import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARGETS, validateContract } from './lib/stage-10-public-metadata.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contractPath = 'docs/security-audit/security-stage-10-operations-candidate-contract.json';
const contract = validateContract(JSON.parse(readFileSync(resolve(root, contractPath), 'utf8')));
if (contract.expected_offline_cases !== 27) throw new Error('OFFLINE_CASE_CONTRACT_CHANGED');
const syntaxTargets = ['scripts/lib/stage-10-public-metadata.mjs', 'scripts/collect-stage-10-public-metadata.mjs',
  'scripts/verify-stage-10-operations.mjs', 'tests/stage-10-public-metadata.test.mjs'];
const inputs = [...syntaxTargets, 'scripts/offline-test-network.cjs', ...TARGETS.map(t => t.source), contractPath];
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => [
  'PATH', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'TMPDIR', 'LANG', 'LC_ALL',
].includes(key.toUpperCase())));
const syntax = syntaxTargets.map(file => {
  const result = spawnSync(process.execPath, ['--check', resolve(root, file)],
    { cwd: root, env, encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 });
  return { file, pass: !result.error && !result.signal && result.status === 0 };
});
const result = syntax.every(check => check.pass) ? spawnSync(process.execPath, [
  '--require', resolve(root, 'scripts/offline-test-network.cjs'), '--test', '--test-reporter=tap',
  resolve(root, 'tests/stage-10-public-metadata.test.mjs'),
], { cwd: root, env, encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024 }) : { status: 1, stdout: '' };
const count = key => Number((result.stdout || '').match(new RegExp('^# ' + key + ' (\\d+)$', 'm'))?.[1] ?? -1);
const totals = Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map(key => [key, count(key)]));
const pass = syntax.every(check => check.pass) && !result.error && !result.signal && result.status === 0
  && totals.tests === 27 && totals.pass === 27 && ['fail', 'cancelled', 'skipped', 'todo'].every(key => totals[key] === 0);
const hashes = Object.fromEntries(inputs.map(file => [file,
  createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')]));
console.log(JSON.stringify({
  stage_step: '10.2', result: pass ? 'OFFLINE_ACTUAL_PUBLIC_METADATA_COLLECTOR_AND_CLI_SCOPED_PASS' : 'OFFLINE_OPERATIONS_CANDIDATE_REVIEW',
  scope: 'ACTUAL_COLLECTOR_WITH_SYNTHETIC_RESPONSE_STREAMS_REAL_TEMPORARY_FILES_AND_CLI_UNDER_DISABLED_DEFAULT_TRANSPORT',
  source_parent_commit: contract.source_parent_commit, node_version: process.version,
  ...totals, exit_code: result.status, syntax_checks: syntax.length, syntax, file_sha256: hashes,
  failed_case_titles: (result.stdout || '').split(/\r?\n/).filter(line => /^not ok \d+ - /.test(line)),
  actual_public_staging_HTTP_requests: 0, Auth_API_SQL_jobs_alerts_provider_device_or_store_checks_run: 0,
  planned_real_operations_grouped_cases: 24, full_operations_grouped_cases_run: 0,
  full_regression_CI_or_current_backend_job_alert_recovery_verified: false,
  candidate_deployed: false, hosted_operations_acceptance: false, hosted_acceptance: false,
  native_security_acceptance: false, store_acceptance: false,
  actual_notification_email_or_charge_dispatched: false, accounts_fixtures_Auth_Storage_SQL_settings_changed: false,
  production_or_native_changed: false, APK_update_deferred: true, findings_closed: [],
}, null, 2));
process.exitCode = pass ? 0 : 1;
