// Node built-ins only: actual selected client/Edge functions with synthetic ports.
// No provider, hosted SQL, browser/device registration or native compilation.
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const primary = 'tests/stage-8-notification-boundaries.test.mjs';
const regressions = ['tests/security-stage-2-push-destination.test.mjs', 'tests/push-display-click.test.mjs',
  'tests/notification-workspace-context.test.mjs', 'tests/business-stage-10.test.mjs'];
const jsTargets = ['business.js', 'app.js', 'supabase/functions/_shared/notification-recipient.mjs', primary,
  'scripts/verify-stage-8-notifications.mjs', regressions[0]];
const tsTargets = ['supabase/functions/send-test-push/index.ts', 'supabase/functions/dispatch-push-reminders/index.ts',
  'supabase/functions/dispatch-admin-notifications/index.ts'];
const inputs = [...jsTargets, ...tsTargets, 'business.html', 'app.html', 'supabase/functions/_shared/push-destination.mjs',
  ...regressions.slice(1), 'sw.js', 'supabase/schema.sql',
  'supabase/migrations/20260930090000_business_stage_10_billing.sql',
  'supabase/migrations/20260921130000_notification_workspace_context.sql',
  'supabase/notification-workspace-context-diagnostic.sql',
  'docs/security-audit/security-stage-8-notification-candidate-contract.json'];
function batch(files, expected) {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files],
    {cwd:root, encoding:'utf8', maxBuffer:8*1024*1024});
  const count = k => Number(r.stdout?.match(new RegExp('^# '+k+' (\\d+)$','m'))?.[1] ?? -1);
  if (r.status !== 0 || count('tests') !== expected || count('pass') !== expected ||
    ['fail','skipped','todo','cancelled'].some(k=>count(k)!==0)) {
    process.stderr.write((r.stdout || r.stderr || 'Test process unavailable').slice(-25000));
    throw Error('Offline batch failed or incomplete');
  }
  return {tests:count('tests'),pass:count('pass'),fail:0,skipped:0,exit_code:r.status,
    non_failing_TypeScript_experimental_warning:/ExperimentalWarning: stripTypeScriptTypes/.test((r.stdout||'')+(r.stderr||''))};
}
const contract = JSON.parse(await readFile(resolve(root,inputs.at(-1)),'utf8'));
if(contract.stage_step!=='8.2' || ['candidate_deployed','hosted_acceptance','native_security_acceptance',
  'actual_notification_dispatched','device_permission_or_subscription_changed','native_push_transport_implemented',
  'new_provider_or_native_registration_SDK_selected','SQL_or_schema_or_cron_changed','production_or_native_changed']
  .some(k=>contract[k]!==false)) throw Error('Candidate scope changed');
const model = batch([primary],32), regression = batch(regressions,38);
for(const file of jsTargets){
  const r=spawnSync(process.execPath,['--check',resolve(root,file)],{encoding:'utf8'});
  if(r.status!==0)throw Error('Node syntax failed: '+file);
}
for(const file of tsTargets){
  const code=stripTypeScriptTypes(await readFile(resolve(root,file),'utf8'),{mode:'strip'});
  const r=spawnSync(process.execPath,['--input-type=module','--check'],{input:code,encoding:'utf8'});
  if(r.status!==0)throw Error('Stripped TS Node syntax failed: '+file);
}
const hashes={};for(const path of inputs)hashes[path]=createHash('sha256').update(await readFile(resolve(root,path))).digest('hex');
console.log(JSON.stringify({stage_step:'8.2',
  result:'OFFLINE_ACTUAL_NOTIFICATION_BOUNDARIES_AND_SELECTED_REGRESSIONS_SCOPED_PASS',
  scope:'ACTUAL_BUSINESS_SIGNOUT_VM_SHARED_HELPERS_AND_STRIPPED_EDGE_HANDLERS_WITH_SYNTHETIC_AUTH_DB_BROWSER_TRANSPORT_PORTS',
  source_parent_commit:contract.source_parent_commit,node_version:process.version,
  tests:70,pass:70,fail:0,exit_code:0,notification_boundaries:model,selected_existing_regressions:regression,
  syntax_checks:9,Node_JS_syntax_checks:6,stripped_TS_Node_syntax_checks:3,file_sha256:hashes,
  actual_Deno_dependency_resolution_bundle_or_hosted_execution_verified:false,
  actual_PostgreSQL_RLS_roles_MFA_concurrent_claims_or_recovery_verified:false,
  actual_provider_OS_display_account_switch_privacy_or_cleanup_verified:false,
  native_push_SDK_transport_or_registration_implemented:false,
  hosted_ND01_ND08_grouped_cases_run:0,planned_hosted_device_grouped_cases:48,
  candidate_deployed:false,hosted_acceptance:false,native_security_acceptance:false,
  actual_notification_dispatched:false,device_permission_or_subscription_changed:false,
  accounts_fixtures_Auth_Storage_SQL_settings_changed:false,production_or_native_changed:false,
  APK_update_deferred:true,findings_closed:[]},null,2));
