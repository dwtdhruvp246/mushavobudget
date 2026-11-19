// Offline review-tool checks only. No installs, credentials, SDKs or hosted requests.
import {readFile, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {assessPrivacyReview} from './lib/stage-4-privacy-review.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testFile = 'tests/stage-4-privacy-review.test.mjs';
const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', testFile], {cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024});
if (result.status !== 0) { process.stderr.write((result.stdout || result.stderr || 'Tests unavailable').slice(-16000)); process.exit(1); }
const count = name => Number(result.stdout.match(new RegExp('^# ' + name + ' (\\d+)$', 'm'))?.[1] || 0);
const tests = count('tests'), pass = count('pass'), fail = count('fail');
if (!tests || pass !== tests || fail || count('skipped') || count('todo') || count('cancelled')) throw Error('Incomplete test batch');
const modules = ['scripts/lib/stage-4-privacy-review.mjs', 'scripts/verify-stage-4-privacy.mjs', testFile];
const artifacts = ['docs/security-audit/security-stage-4-privacy-decisions.json', 'docs/security-audit/security-stage-4-privacy-source-inventory.json', 'docs/security-audit/SECURITY_STAGE_4_3_PRIVACY_NOTICE_REVIEW_DRAFT.md'];
const hashes = {};
for (const file of modules) {
  const check = spawnSync(process.execPath, ['--check', resolve(root, file)], {encoding: 'utf8'});
  if (check.status !== 0) throw Error('Syntax failed: ' + file);
}
for (const file of [...modules, ...artifacts]) hashes[file] = createHash('sha256').update(await readFile(resolve(root, file))).digest('hex');
const inventory = JSON.parse(await readFile(resolve(root, artifacts[1]), 'utf8'));
const decisions = JSON.parse(await readFile(resolve(root, artifacts[0]), 'utf8'));
const assessment = assessPrivacyReview(inventory, decisions);
const receipt = {stage_step: '4.3.2', result: 'OFFLINE_PRIVACY_REVIEW_CONTRACT_AND_DRAFT_SCOPED_PASS',
  scope: 'STRUCTURED_OWNER_SOURCE_DECISIONS_FAIL_CLOSED_VALIDATION_AND_INERT_REVIEW_DRAFT_NOT_APP_COLLECTION_CONTROLS',
  source_parent_commit: decisions.source_parent_commit, node_version: process.version, tests, pass, fail, exit_code: result.status,
  syntax_checks: modules.length, file_sha256: hashes, review_status: assessment.status, publication_blockers: assessment.blocked_items.length,
  source_data_categories: assessment.source_data_categories, source_service_components: assessment.source_service_components,
  owner_facts_scope: assessment.owner_facts_scope, hosted_PR01_PR05_grouped_cases_run: 0,
  actual_app_analytics_consent_retention_deletion_or_child_controls_verified: false,
  adopted_public_policy: false, candidate_deployed: false, hosted_acceptance: false,
  public_notice_or_store_declaration_published: false, provider_email_job_executed: false,
  accounts_fixtures_Auth_Storage_SQL_settings_changed: false, production_or_native_changed: false, findings_closed: []};
if (process.argv[2]) await writeFile(resolve(process.argv[2]), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
