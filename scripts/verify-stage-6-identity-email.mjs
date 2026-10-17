// Offline source/template-control projection and selected synthetic regression.
// No Go runtime, Supabase renderer, SDK provider session or actual mail request.
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const primaryFile = 'tests/stage-6-email-templates.test.mjs';
const regressionFile = 'tests/stage-3-auth-edge-build.test.mjs';
function batch(args, expectedPass, allowedSkip) {
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...args], {cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024});
  if (result.status !== 0) {
    process.stderr.write((result.stdout || result.stderr || 'Test process unavailable').slice(-18000));
    process.exit(1);
  }
  const count = name => Number(result.stdout.match(new RegExp('^# ' + name + ' (\\d+)$', 'm'))?.[1] ?? -1);
  const tests = count('tests'), pass = count('pass'), fail = count('fail'), skipped = count('skipped');
  if (pass !== expectedPass || fail !== 0 || !allowedSkip.includes(skipped) || tests !== pass + skipped || count('todo') !== 0 || count('cancelled') !== 0) throw Error('Incomplete or unexpected offline batch');
  return {tests_reported: tests, executed: pass, pass, fail, intentionally_filtered: skipped, exit_code: result.status,
    non_failing_TypeScript_experimental_warning: /ExperimentalWarning: stripTypeScriptTypes/.test(result.stderr || '')};
}
const primary = batch([primaryFile], 43, [0]);
// Node versions either omit filtered tests or report them as skipped. These
// three builder tests are intentionally outside this exact unchanged-handler
// regression subset; no skipped test is included as an executed PASS.
const regression = batch(['--test-name-pattern=^actual Business Edge handler', regressionFile], 3, [0, 3]);
const modules = ['tests/helpers/auth-email-template-projection.mjs', primaryFile, 'scripts/verify-stage-6-identity-email.mjs'];
for (const file of modules) {
  const result = spawnSync(process.execPath, ['--check', resolve(root, file)], {encoding: 'utf8'});
  if (result.status !== 0) throw Error('Node syntax failed: ' + file);
}
const artifacts = ['supabase/templates/invite-user.html', 'supabase/templates/invite-user.subject.txt',
  'supabase/templates/magic-link.html', 'supabase/templates/magic-link.subject.txt',
  'tests/fixtures/stage-6-email-template-baseline.json', regressionFile,
  'supabase/functions/invite-business-member/index.ts',
  'docs/security-audit/security-stage-6-identity-email-candidate-contract.json'];
const hashes = {};
for (const file of [...modules, ...artifacts]) hashes[file] = createHash('sha256').update(await readFile(resolve(root, file))).digest('hex');
const contract = JSON.parse(await readFile(resolve(root, artifacts.at(-1)), 'utf8'));
if (contract.stage_step !== '6.2' || contract.hosted_acceptance !== false || contract.providers_activated !== false || contract.email_dispatched !== false) throw Error('Candidate scope changed');
console.log(JSON.stringify({stage_step: '6.2', result: 'OFFLINE_EMAIL_TEMPLATE_CONTROL_FLOW_AND_SYNTHETIC_HANDLER_SCOPED_PASS',
  scope: 'NODE_EVALUATION_OF_ACTUAL_TEMPLATE_CONTROL_FLOW_NOT_GO_SUPABASE_RENDERING_PLUS_THREE_MOCKED_EDGE_CASES',
  source_parent_commit: contract.source_parent_commit, node_version: process.version,
  tests: primary.executed + regression.executed, pass: primary.pass + regression.pass, fail: 0, exit_code: 0,
  template_control_flow_cases: primary, selected_existing_handler_regression: regression,
  syntax_checks: modules.length, file_sha256: hashes,
  Go_or_Supabase_template_renderer_verified: false, contextual_HTML_or_URL_escaping_verified: false,
  actual_provider_login_linking_or_email_delivery_verified: false, runtime_provider_login_or_hook_or_application_mailer_implemented: false,
  candidate_deployed: false, hosted_IE01_IE06_grouped_cases_run: 0, hosted_acceptance: false,
  actual_email_dispatched: false, accounts_fixtures_Auth_Storage_SQL_settings_changed: false,
  production_or_native_changed: false, APK_update_deferred: true, findings_closed: []}, null, 2));
