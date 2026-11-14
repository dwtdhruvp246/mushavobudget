// Node built-ins only. Offline synthetic model plus unchanged manual regressions.
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const primaryFile = 'tests/stage-7-commerce-model.test.mjs';
const regressionFiles = ['tests/business-stage-10.test.mjs', 'tests/admin-manual-subscription.test.mjs'];
const modules = ['scripts/lib/stage-7-commerce-model.mjs', primaryFile, 'scripts/verify-stage-7-commerce.mjs'];
const inputs = [...modules, ...regressionFiles, 'business.js', 'app.js', 'app.html', 'supabase/schema.sql',
  'supabase/migrations/20260930090000_business_stage_10_billing.sql',
  'supabase/migrations/20260928090000_admin_manual_subscription_grants.sql',
  'docs/security-audit/security-stage-7-commerce-candidate-contract.json'];
function batch(files, expected) {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files],
    {cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024});
  const count = key => Number(r.stdout?.match(new RegExp('^# ' + key + ' (\\d+)$', 'm'))?.[1] ?? -1);
  if (r.status !== 0 || count('tests') !== expected || count('pass') !== expected ||
    ['fail', 'skipped', 'todo', 'cancelled'].some(k => count(k) !== 0)) {
    process.stderr.write((r.stdout || r.stderr || 'Unavailable test process').slice(-20000));
    throw Error('Offline batch failed or incomplete');
  }
  return {tests: count('tests'), pass: count('pass'), fail: 0, skipped: 0, exit_code: r.status};
}
const contract = JSON.parse(await readFile(resolve(root, inputs.at(-1)), 'utf8'));
if (contract.stage_step !== '7.2' || contract.approved_runtime_catalog !== null ||
  contract.configured_provider_adapters.length !== 0 || contract.model_fixture_catalog_is_synthetic !== true ||
  ['runtime_integration_implemented', 'provider_signature_receipt_or_API_verification_implemented',
    'durable_purchase_ledger_or_event_receiver_implemented', 'candidate_deployed', 'hosted_acceptance',
    'real_charges_performed', 'production_or_native_changed'].some(k => contract[k] !== false)) throw Error('Review scope changed');
const primary = batch([primaryFile], 20);
const regressions = batch(regressionFiles, 10);
for (const file of modules) {
  const r = spawnSync(process.execPath, ['--check', resolve(root, file)], {encoding: 'utf8'});
  if (r.status !== 0) throw Error('Syntax failed: ' + file);
}
const hashes = {};
for (const path of inputs) hashes[path] = createHash('sha256').update(await readFile(resolve(root, path))).digest('hex');
console.log(JSON.stringify({stage_step: '7.2',
  result: 'OFFLINE_SYNTHETIC_COMMERCE_MODEL_AND_EXISTING_MANUAL_REGRESSION_SCOPED_PASS',
  scope: 'PURE_REVIEW_MODEL_WITH_SYNTHETIC_ADAPTER_PLUS_SELECTED_ACTUAL_CLIENT_VM_AND_SQL_SOURCE_ASSERTIONS',
  source_parent_commit: contract.source_parent_commit, node_version: process.version,
  tests: primary.tests + regressions.tests, pass: primary.pass + regressions.pass, fail: 0, exit_code: 0,
  synthetic_commerce_model: primary, selected_existing_manual_regressions: regressions,
  syntax_checks: modules.length, file_sha256: hashes,
  actual_provider_receipt_signature_or_webhook_verification: false,
  actual_durable_ledger_global_chain_ownership_or_concurrent_DB_CAS_verified: false,
  actual_app_native_purchase_or_backend_commerce_integration_implemented: false,
  hosted_CO01_CO08_grouped_cases_run: 0, planned_hosted_grouped_cases: 48,
  candidate_deployed: false, hosted_acceptance: false, real_charges_performed: false,
  accounts_fixtures_Auth_Storage_SQL_settings_changed: false,
  production_or_native_changed: false, APK_update_deferred: true, findings_closed: []}, null, 2));
