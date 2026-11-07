import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOfflineTests, discoverTestFiles } from './run-offline-tests.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contractPath = 'docs/security-audit/security-stage-9-regression-candidate-contract.json';
const contract = JSON.parse(readFileSync(resolve(root, contractPath), 'utf8'));
const files = discoverTestFiles(root).map(path => 'tests/' + path.split(/[\\/]/).at(-1));
if (contract.stage_step !== '9.2' || JSON.stringify(files) !== JSON.stringify(contract.expected_test_files)
  || contract.hosted_acceptance !== false || contract.native_security_acceptance !== false
  || contract.candidate_deployed !== false) throw new Error('Pinned offline regression scope changed.');
const syntax = contract.syntax_targets.map(file => {
  const r = spawnSync(process.execPath, ['--check', resolve(root, file)], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0 || r.error) throw new Error('Syntax check failed: ' + file);
  return file;
});
const r = runOfflineTests({ capture: true });
const output = (r.stdout || '') + (r.stderr || '');
const count = name => Number((r.stdout || '').match(new RegExp('^# ' + name + ' (\\d+)$', 'm'))?.[1] ?? -1);
const totals = Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map(name => [name, count(name)]));
const ok = !r.error && !r.signal && r.status === 0 && totals.tests === contract.expected_cases
  && totals.pass === contract.expected_cases && ['fail', 'cancelled', 'skipped', 'todo'].every(name => totals[name] === 0);
const hashes = Object.fromEntries([...new Set([...contract.hash_targets, contractPath])].map(file => [file, createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')]));
console.log(JSON.stringify({
  stage_step: '9.2', result: ok ? 'OFFLINE_FULL_DISCOVERED_REGRESSION_AND_ACTUAL_EXPORTER_SCOPED_PASS' : 'OFFLINE_REGRESSION_REVIEW',
  scope: 'ALL_DISCOVERED_MJS_CJS_NODE_TESTS_WITH_SYNTHETIC_PORTS_SOURCE_ASSERTIONS_AND_TEMPORARY_REAL_EXPORTER_FIXTURES',
  source_parent_commit: contract.source_parent_commit, node_version: process.version,
  ...totals, exit_code: r.status, test_files: files.length, MJS_test_files: files.filter(file => file.endsWith('.mjs')).length,
  CJS_test_files: files.filter(file => file.endsWith('.cjs')).length, new_release_runner_cases: 6,
  syntax_checks: syntax.length, file_sha256: hashes,
  non_failing_TypeScript_experimental_warning: /ExperimentalWarning: stripTypeScriptTypes/.test(output),
  non_failing_module_type_warning: /MODULE_TYPELESS_PACKAGE_JSON/.test(output),
  failed_case_titles: (r.stdout || '').split(/\r?\n/).filter(line => line.startsWith('not ok ')),
  dependency_install_or_real_native_bundle_run: false, full_CI_workflow_execution_verified: false,
  hosted_device_store_or_performance_cases_run: 0, planned_hosted_device_store_grouped_cases: 48,
  candidate_deployed: false, hosted_acceptance: false, native_security_acceptance: false, store_acceptance: false,
  notification_email_or_charge_dispatched: false, accounts_fixtures_Auth_Storage_SQL_settings_changed: false,
  production_or_native_changed: false, APK_update_deferred: true, findings_closed: [],
}, null, 2));
process.exitCode = ok ? 0 : 1;
