// Offline verification only; all API/Auth ports are synthetic.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['scripts/check-fr-2-personal-deletion.cjs', 'scripts/run-fr-2-personal-deletion.ps1', 'scripts/verify-fr-2-personal-deletion.mjs', 'tests/fr-2-personal-deletion.test.cjs', 'scripts/check-stage-3-personal-api.cjs', 'scripts/offline-test-network.cjs'];
const child = spawnSync(process.execPath, ['--require', path.join(root, 'scripts/offline-test-network.cjs'), '--test', '--test-reporter=tap', path.join(root, 'tests/fr-2-personal-deletion.test.cjs')], { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
const out = child.stdout || '';
const count = name => Number(out.match(new RegExp('^# ' + name + ' (\\d+)$', 'm'))?.[1] || 0);
const syntaxFiles = files.filter(x => x.endsWith('.cjs') || x.endsWith('.mjs'));
const syntax = syntaxFiles.map(file => ({file, pass: spawnSync(process.execPath, ['--check', path.join(root, file)], {encoding: 'utf8', timeout: 10000}).status === 0}));
const ok = child.status === 0 && count('tests') === 41 && count('pass') === 41 && count('fail') === 0 && count('skipped') === 0 && syntax.every(x => x.pass);
console.log(JSON.stringify({stage_step: 'FR.2.2_DELETION_CANDIDATE', result: ok ? 'OFFLINE_ACTUAL_PERSONAL_DELETION_CHECKER_SCOPED_PASS' : 'OFFLINE_PERSONAL_DELETION_CHECKER_REVIEW', scope: 'ACTUAL_CHECKER_AND_EXTRACTED_DRIVER_WITH_SYNTHETIC_AUTH_RLS_CASCADE_AND_RESPONSE_PORTS_NOT_REAL_POSTGRESQL_OR_WINDOWS_POWERSHELL', source_parent_commit: 'd28043043cac9c4809172961be656ec10e2cff66', node_version: process.version, tests: count('tests'), pass: count('pass'), fail: count('fail'), cancelled: count('cancelled'), skipped: count('skipped'), exit_code: child.status, syntax_checks: syntax.length, syntax, planned_hosted_grouped_checks: 30, file_sha256: Object.fromEntries(files.map(x => [x, createHash('sha256').update(readFileSync(path.join(root, x))).digest('hex')])), default_network_disabled: true, Windows_PowerShell_execution_verified: false, new_hosted_requests_run: 0, candidate_API_deletion_checks_run: 0, settings_or_existing_rows_changed: false, production_or_native_changed: false, hosted_acceptance: false, findings_closed: []}, null, 2));
process.exitCode = ok ? 0 : 1;
