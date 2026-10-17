import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {stripTypeScriptTypes} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifestPath='docs/security-audit/security-fr-2-email-callback-source-manifest.json';
let sourceFiles=0,syntaxChecks=0,failure=null,groups=[];
try {
  const manifest=JSON.parse(await readFile(path.join(root,manifestPath),'utf8'));
  assert.equal(manifest.stage_step,'FR.2.4.E4.7_AUTH_CALLBACK_INTEGRATION');
  for(const [file,expected] of Object.entries(manifest.file_sha256)){
    assert(!path.isAbsolute(file)&&!file.split('/').includes('..'));
    assert.equal(createHash('sha256').update(await readFile(path.join(root,file))).digest('hex'),expected,'Pinned input mismatch: '+file);
    sourceFiles++;
  }
  const migrationNames=(await readdir(path.join(root,'supabase/migrations'))).filter(x=>x.endsWith('.sql')).sort();
  assert.equal(migrationNames.length,54);
  assert.deepEqual(migrationNames,manifest.migration_paths.map(x=>path.basename(x)));
  for(const [file,expected]of Object.entries(manifest.unchanged_inline_script_SHA256)){
    const html=(await readFile(path.join(root,file),'utf8')).replace(/\r\n?/g,'\n');
    const hashes=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].filter(x=>! /\bsrc\s*=/i.test(x[1])&&x[2].trim()).map(x=>createHash('sha256').update(x[2]).digest('hex')).sort();
    assert.deepEqual(hashes,expected,'Changed inline script policy input: '+file);
  }
  const database=path.resolve(process.argv[2]||path.join(root,'scripts/fixtures/email-session-review-tools/node_modules/@electric-sql/pglite/dist/index.js'));
  const installed=JSON.parse(await readFile(path.resolve(path.dirname(database),'../package.json'),'utf8'));
  assert.equal(installed.name,'@electric-sql/pglite');assert.equal(installed.version,'0.5.8');
  const lock=JSON.parse(await readFile(path.join(root,'scripts/fixtures/email-session-review-tools/package-lock.json'),'utf8'));
  const entry=lock.packages['node_modules/@electric-sql/pglite'];
  assert.equal(entry.version,'0.5.8');
  assert.equal(entry.resolved,'https://registry.npmjs.org/@electric-sql/pglite/-/pglite-0.5.8.tgz');
  assert.equal(entry.integrity,'sha512-n9tsbUOhwx2epK1V0ZG9Ar4SHWUju04dhmzZXiSBXwBoleOvIfals33NAaWgagQVAL4Rbvx/Ptsu3P+pA09f6Q==');
  for(const file of manifest.syntax_paths){
    const source=await readFile(path.join(root,file),'utf8');
    const result=file.endsWith('.ts')
      ?spawnSync(process.execPath,['--input-type=module','--check'],{input:stripTypeScriptTypes(source),encoding:'utf8'})
      :spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});
    assert.equal(result.status,0,'Syntax check failed: '+file);syntaxChecks++;
  }
  for(const group of manifest.test_groups){
    const run=spawnSync(process.execPath,['--require',path.join(root,'scripts/offline-test-network.cjs'),'--test','--test-reporter=tap',...group.files.map(x=>path.join(root,x))],{
      cwd:root,encoding:'utf8',env:{...process.env,MUSHAVO_EMAIL_UI_PGLITE:database},maxBuffer:16*1024*1024,timeout:120000
    });
    const output=(run.stdout||'')+'\n'+(run.stderr||'');
    const count=label=>Number(output.match(new RegExp('^# '+label+' (\\d+)\\s*$','m'))?.[1]??-1);
    const receipt={name:group.name,tests:count('tests'),pass:count('pass'),fail:count('fail'),cancelled:count('cancelled'),skipped:count('skipped'),todo:count('todo'),exit_code:run.status,
      failed_case_titles:output.split(/\r?\n/).filter(x=>x.startsWith('not ok ')),non_failing_TypeScript_experimental_warning:output.includes('ExperimentalWarning'),non_failing_module_type_warning:output.includes('MODULE_TYPELESS_PACKAGE_JSON')};
    groups.push(receipt);
    assert.equal(run.status,0,'Selected batch failed');assert.equal(receipt.tests,group.expected_tests);
    assert.equal(receipt.pass,receipt.tests);for(const key of['fail','cancelled','skipped','todo'])assert.equal(receipt[key],0);
  }
} catch(error){failure={problem_code:'LOCAL_EMAIL_CALLBACK_REVIEW_REQUIRED',check:error.message?.startsWith('Pinned input mismatch:')?'SOURCE_HASH_MISMATCH':error.code==='ERR_ASSERTION'?'ASSERTION_OR_TEST_BATCH_FAILED':'LOCAL_INPUT_OR_RUNTIME_UNAVAILABLE'};}
const ok=!failure&&groups.length===4;
console.log(JSON.stringify({
  stage_step:'FR.2.4.E4.7_AUTH_CALLBACK_INTEGRATION',result:ok?'OFFLINE_ACTUAL_AUTH_CALLBACK_EMAIL_GATE_AND_SELECTED_SQL_REGRESSIONS_SCOPED_PASS':'OFFLINE_EMAIL_CALLBACK_REVIEW_REQUIRED',
  scope:'ACTUAL_AUTH_PAGE_MODULE_LINK_CONTROLLER_AND_MOUNTED_CODE_FORM_WITH_SYNTHETIC_DOM_AUTH_TRANSPORT_PLUS_PRIOR_ENTRY_EXPORTER_AND_FULL54_SQL_REGRESSIONS',
  source_parent_commit:'945acf1ee39c4c4698bf68177f641ca8ef45f1e9',node_version:process.version,pglite_version:'0.5.8',migration_count:54,
  source_files_SHA256_verified:sourceFiles,syntax_checks:syntaxChecks,
  tests:groups.reduce((n,g)=>n+Math.max(0,g.tests),0),pass:groups.reduce((n,g)=>n+Math.max(0,g.pass),0),fail:groups.reduce((n,g)=>n+Math.max(0,g.fail),0),groups,failure,
  confirmation_recovery_Business_callback_and_password_change_entry_wired:true,
  protected_invitation_RPC_and_session_adoption_preceded_by_server_proof:true,
  pending_invitation_check_before_Business_first_password_preserved:true,
  password_change_requires_fresh_proof:true,
  callback_cancellation_and_identity_or_token_change_fail_closed:true,
  Admin_invited_signup_and_explicit_Free_provisioning_globally_integrated:false,
  remembered_device_forget_or_revoke_all_settings_UI_wired:false,
  shared_email_screen_component_implemented:true,caller_bound_Admin_status_contract_implemented:true,
  existing_app_business_startup_and_Admin_UI_rewired:true,
  old_TOTP_enrollment_UI_or_client_status_called:false,
  production_staging_and_native_exporter_module_lists_updated:true,
  real_native_bundler_plugins_device_or_store_execution_verified:false,
  native_builder_source_module_list_updated:true,existing_www_or_native_project_changed:false,
  seven_day_device_and_open_session_SQL_integration_verified:true,
  actual_browser_DOM_engine_cookie_persistence_or_native_validation_verified:false,
  Deno_Supabase_dependency_resolution_bundle_runtime_or_actual_JWT_verification:false,
  actual_Auth_Zoho_provider_mail_push_or_scheduler_requests:0,
  canonical_schema_versioned_migration_Admin_UI_Pages_or_hosted_guards_complete:false,
  hosted_enforcement_installed:false,hosted_acceptance:false,actual_email_notification_or_charge_dispatched:false,
  owner_SQL_or_deployment_action_required:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],exit_code:ok?0:1
},null,2));
process.exitCode=ok?0:1;
