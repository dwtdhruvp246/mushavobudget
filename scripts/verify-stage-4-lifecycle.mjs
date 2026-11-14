// Offline finite model verification. No dependency install, credentials or hosted requests.
import {readFile, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = ['tests/stage-4-lifecycle-review.test.mjs'];
const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], {cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024});
if (result.status !== 0) { process.stderr.write((result.stdout || result.stderr || 'Tests unavailable').slice(-12000)); process.exit(1); }
const count = name => Number(result.stdout.match(new RegExp('^# ' + name + ' (\\d+)$', 'm'))?.[1] || 0);
const tests = count('tests'), pass = count('pass'), fail = count('fail');
if (!tests || pass !== tests || fail || count('skipped') || count('todo') || count('cancelled')) throw Error('Incomplete test batch');
const checkedFiles = ['scripts/lib/stage-4-lifecycle-review.mjs', 'scripts/verify-stage-4-lifecycle.mjs', ...files];
const hashes = {};
for (const file of checkedFiles) {
  const check = spawnSync(process.execPath, ['--check', resolve(root, file)], {encoding: 'utf8'});
  if (check.status !== 0) throw Error('Syntax failed: ' + file);
  hashes[file] = createHash('sha256').update(await readFile(resolve(root, file))).digest('hex');
}
const decisionFile = 'docs/security-audit/security-stage-4-retention-decisions.json';
hashes[decisionFile] = createHash('sha256').update(await readFile(resolve(root, decisionFile))).digest('hex');
const receipt = {stage_step: '4.1.2', result: 'OFFLINE_LIFECYCLE_REVIEW_MODEL_SCOPED_PASS',
  scope: 'SYNTHETIC_IDENTITY_INVENTORY_RETENTION_PORTS_AND_PURE_STATE_TRANSITIONS', node_version: process.version,
  tests, pass, fail, exit_code: result.status, test_files: files, syntax_checks: checkedFiles.length,
  file_sha256: hashes, genuine_Auth_verification: false, final_or_hosted_dependency_inventory_verified: false,
  adopted_retention_policy: false, durable_job_or_provider_adapter_implemented: false,
  hosted_DL01_DL05_checks_run: 0, candidate_deployed: false, accounts_Storage_SQL_settings_changed: false,
  production_or_native_changed: false, account_deleted: false, finding_F02_closed: false};
if (process.argv[2]) await writeFile(resolve(process.argv[2]), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
