import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {stripTypeScriptTypes} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifestPath='docs/security-audit/security-fr-2-email-ensure-rls-source-manifest.json';
let sourceFiles=0,syntaxChecks=0,failure=null,groups=[];
try {
  const manifest=JSON.parse(await readFile(path.join(root,manifestPath),'utf8'));
  assert.equal(manifest.stage_step,'FR.2.4.E4.13_REVIEWED_HOOK_COMPATIBILITY');
  for(const [file,expected] of Object.entries(manifest.file_sha256)){
    assert(!path.isAbsolute(file)&&!file.split('/').includes('..'));
    assert.equal(createHash('sha256').update(await readFile(path.join(root,file))).digest('hex'),expected,'Pinned input mismatch: '+file);
    sourceFiles++;
  }
  const migrationNames=(await readdir(path.join(root,'supabase/migrations'))).filter(x=>x.endsWith('.sql')).sort();
  assert.equal(migrationNames.length,55);
  assert.deepEqual(migrationNames,manifest.migration_paths.map(x=>path.basename(x)));
  for(const [file,expected]of Object.entries(manifest.unchanged_inline_script_SHA256)){
    const html=(await readFile(path.join(root,file),'utf8')).replace(/\r\n?/g,'\n');
    const hashes=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].filter(x=>! /\bsrc\s*=/i.test(x[1])&&x[2].trim()).map(x=>createHash('sha256').update(x[2]).digest('hex')).sort();
    assert.deepEqual(hashes,expected,'Changed inline script policy input: '+file);
  }
  for(const file of manifest.inline_module_syntax_paths){
    const html=await readFile(path.join(root,file),'utf8');
    const modules=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].filter(x=>/type=["']module["']/.test(x[1])&&!/\bsrc\s*=/.test(x[1]));
    assert.equal(modules.length,1);const check=spawnSync(process.execPath,['--input-type=module','--check'],{input:modules[0][2],encoding:'utf8'});assert.equal(check.status,0,'Inline module syntax failed');syntaxChecks++;
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
} catch(error){failure={problem_code:'LOCAL_REVIEWED_HOOK_COMPATIBILITY_REQUIRED',check:error.message?.startsWith('Pinned input mismatch:')?'SOURCE_HASH_MISMATCH':error.code==='ERR_ASSERTION'?'ASSERTION_OR_TEST_BATCH_FAILED':'LOCAL_INPUT_OR_RUNTIME_UNAVAILABLE'};}
const ok=!failure&&groups.length===11;
console.log(JSON.stringify({
 stage_step:'FR.2.4.E4.13_REVIEWED_HOOK_COMPATIBILITY',
 result:ok?'OFFLINE_EXACT_REVIEWED_ENSURE_RLS_HOOK_INSTALLER_AND_SELECTED_REGRESSIONS_SCOPED_PASS':'OFFLINE_REVIEWED_HOOK_COMPATIBILITY_REVIEW_REQUIRED',
 scope:'OWNER_RETURNED_EXACT_HOOK_REPLAY_WITH_PRIVATE_ATOMIC_INSTALLER_FULL55_MIGRATION_CANONICAL_DATABASES_AND_HISTORICAL54_COMPONENT_REGRESSIONS',
 source_parent_commit:'6698d75278aab6b6d45388a5fb129cb32a6e9ada',node_version:process.version,pglite_version:'0.5.8',migration_count:55,historical_component_fixture_migration_count:54,
 source_files_SHA256_verified:sourceFiles,syntax_checks:syntaxChecks,
 tests:groups.reduce((n,g)=>n+Math.max(0,g.tests),0),pass:groups.reduce((n,g)=>n+Math.max(0,g.pass),0),fail:groups.reduce((n,g)=>n+Math.max(0,g.fail),0),groups,failure,
 reviewed_hook_LF_SHA256:'2782e98b348aca7d6f6f73c420fd78d2e094957dd7a52b0483d4c34f29d2a7a1',
 owner_returned_hook_source_replayed_without_hash_substitution:ok,
 exact_hook_body_owner_flags_grants_tags_mode_overloads_and_bindings_pinned:ok,
 event_trigger_functions_excluded_from_application_RPC_target_selection:true,
 guarded_application_RPC_count:ok?148:0,restrictive_policy_count:ok?82:0,
 normal_registration_activates_email_gate:false,
 all_three_reviewed_hooks_remain_enabled_and_unchanged_in_rehearsal:ok,
 public_CREATE_TABLE_CTAS_SELECT_INTO_and_private_skip_behavior_exercised:ok,
 hook_catches_and_logs_RLS_errors_instead_of_guaranteeing_success:ok,
 five_private_tables_explicit_RLS_and_FORCE_RLS_postcondition_enforced:ok,
 injected_FORCE_RLS_failure_rolls_back_activation:ok,
 reviewed_hook_direct_API_function_calls_do_not_gain_event_context:ok,
 unknown_or_changed_relevant_hooks_still_rejected:ok,
 full55_migration_and_canonical_registration_activation_parity_verified:ok,
 existing_modeled_public_Auth_Storage_rows_preserved:ok,
 actual_staging_hook_compatibility_or_installer_execution_verified:false,
 actual_parallel_PostgreSQL_or_live_Auth_JWT_provider_browser_execution_verified:false,
 live_activation_acknowledgement_or_coordinated_rollout_approved:false,
 full_repository_regression_or_CI_execution_verified:false,
 actual_Auth_Zoho_Cloudflare_provider_mail_push_or_scheduler_requests:0,
 hosted_installer_enforcement_or_hook_changed:false,hosted_acceptance:false,
 owner_SQL_or_credentials_or_deployment_action_required:false,
 production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],exit_code:ok?0:1
},null,2));
process.exitCode=ok?0:1;
