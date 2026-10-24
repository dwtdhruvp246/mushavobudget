import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {stripTypeScriptTypes} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifestPath='docs/security-audit/security-fr-2-email-canonical-source-manifest.json';
let sourceFiles=0,syntaxChecks=0,failure=null,groups=[];
try {
  const manifest=JSON.parse(await readFile(path.join(root,manifestPath),'utf8'));
  assert.equal(manifest.stage_step,'FR.2.4.E4.10_CANONICAL_BASELINE');
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
} catch(error){failure={problem_code:'LOCAL_EMAIL_CANONICAL_REVIEW_REQUIRED',check:error.message?.startsWith('Pinned input mismatch:')?'SOURCE_HASH_MISMATCH':error.code==='ERR_ASSERTION'?'ASSERTION_OR_TEST_BATCH_FAILED':'LOCAL_INPUT_OR_RUNTIME_UNAVAILABLE'};}
const ok=!failure&&groups.length===9;
console.log(JSON.stringify({
 stage_step:'FR.2.4.E4.10_CANONICAL_BASELINE',
 result:ok?'OFFLINE_CANONICAL_SCHEMA_MIGRATION_PARITY_EMAIL_CANDIDATES_AND_SELECTED_REGRESSIONS_SCOPED_PASS':'OFFLINE_CANONICAL_BASELINE_REVIEW_REQUIRED',
 scope:'ACTUAL_CANONICAL_SCHEMA_AND_FULL54_MIGRATIONS_IN_SEPARATE_MODELED_PLATFORM_DATABASES_PLUS_FOUR_EMAIL_CANDIDATES_AND_PRIOR_SELECTED_REGRESSIONS',
 source_parent_commit:'19d7babc0fa08af83f030dd3ae863799ba92da0f',node_version:process.version,pglite_version:'0.5.8',migration_count:54,
 source_files_SHA256_verified:sourceFiles,syntax_checks:syntaxChecks,
 tests:groups.reduce((n,g)=>n+Math.max(0,g.tests),0),pass:groups.reduce((n,g)=>n+Math.max(0,g.pass),0),fail:groups.reduce((n,g)=>n+Math.max(0,g.fail),0),groups,failure,
 canonical_schema_generated_from_unchanged_migration_history:ok,
 canonical_builder_CLI_is_read_only:true,
 actual_schema_bootstrap_and_incremental_catalogs_compared:ok,
 compared_public_routine_count:ok?278:0,compared_original_policy_count:ok?166:0,
 function_bodies_effective_API_ACLs_columns_constraints_indexes_RLS_policies_triggers_and_publications_compared:ok,
 canonical_direct_provisioning_and_public_contact_DML_bypasses_removed:ok,
 four_existing_email_SQL_candidates_compile_on_both_creation_paths:ok,
 guarded_RPC_count:ok?148:0,added_restrictive_policies:ok?82:0,
 ordinary_and_Admin_exact_session_proof_and_existing_role_controls_exercised:ok,
 actual_provider_Auth_JWT_or_hosted_SQL_verified:false,
 source_canonical_bootstrap_is_a_live_repair_script:false,
 email_backend_or_activation_versioned_migration_promoted:false,
 email_gate_added_to_automatic_schema_or_migration_execution:false,
 applicationwide_atomic_email_activation_and_coordinated_rollout_complete:false,
 full_repository_regression_or_CI_execution_verified:false,
 actual_Auth_Zoho_Cloudflare_provider_mail_push_or_scheduler_requests:0,
 hosted_enforcement_installed:false,hosted_acceptance:false,
 owner_SQL_or_deployment_action_required:false,production_or_native_changed:false,
 APK_update_deferred:true,findings_closed:[],exit_code:ok?0:1
},null,2));
process.exitCode=ok?0:1;
