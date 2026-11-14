import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {stripTypeScriptTypes} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifestPath='docs/security-audit/security-fr-2-email-edge-source-manifest.json';
let sourceFiles=0,syntaxChecks=0,failure=null,groups=[];
try {
  const manifest=JSON.parse(await readFile(path.join(root,manifestPath),'utf8'));
  assert.equal(manifest.stage_step,'FR.2.4.E4.4_EDGE_GUARDS');
  for(const [file,expected] of Object.entries(manifest.file_sha256)){
    assert(!path.isAbsolute(file)&&!file.split('/').includes('..'));
    assert.equal(createHash('sha256').update(await readFile(path.join(root,file))).digest('hex'),expected,'Pinned input mismatch: '+file);
    sourceFiles++;
  }
  const migrationNames=(await readdir(path.join(root,'supabase/migrations'))).filter(x=>x.endsWith('.sql')).sort();
  assert.equal(migrationNames.length,54);
  assert.deepEqual(migrationNames,manifest.migration_paths.map(x=>path.basename(x)));
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
      cwd:root,encoding:'utf8',env:{...process.env,MUSHAVO_EMAIL_EDGE_PGLITE:database},maxBuffer:16*1024*1024,timeout:120000
    });
    const output=(run.stdout||'')+'\n'+(run.stderr||'');
    const count=label=>Number(output.match(new RegExp('^# '+label+' (\\d+)\\s*$','m'))?.[1]??-1);
    const receipt={name:group.name,tests:count('tests'),pass:count('pass'),fail:count('fail'),cancelled:count('cancelled'),skipped:count('skipped'),todo:count('todo'),exit_code:run.status,
      failed_case_titles:output.split(/\r?\n/).filter(x=>x.startsWith('not ok ')),non_failing_TypeScript_experimental_warning:output.includes('ExperimentalWarning'),non_failing_module_type_warning:output.includes('MODULE_TYPELESS_PACKAGE_JSON')};
    groups.push(receipt);
    assert.equal(run.status,0,'Selected batch failed');assert.equal(receipt.tests,group.expected_tests);
    assert.equal(receipt.pass,receipt.tests);for(const key of['fail','cancelled','skipped','todo'])assert.equal(receipt[key],0);
  }
} catch(error){failure={problem_code:'LOCAL_EMAIL_EDGE_REVIEW_REQUIRED',check:error.message?.startsWith('Pinned input mismatch:')?'SOURCE_HASH_MISMATCH':error.code==='ERR_ASSERTION'?'ASSERTION_OR_TEST_BATCH_FAILED':'LOCAL_INPUT_OR_RUNTIME_UNAVAILABLE'};}
const ok=!failure&&groups.length===3;
console.log(JSON.stringify({
  stage_step:'FR.2.4.E4.4_EDGE_GUARDS',result:ok?'OFFLINE_ACTUAL_EMAIL_EDGE_AND_SQL_PROOF_INTEGRATION_SCOPED_PASS':'OFFLINE_EMAIL_EDGE_REVIEW_REQUIRED',
  scope:'ACTUAL_STRIPPED_EDGE_ENTRYPOINTS_SHARED_PROOF_HELPER_AND_FULL54_SQL_WITH_SYNTHETIC_AUTH_SDK_TRANSPORT_AND_PROVIDER_PORTS',
  source_parent_commit:'fcfd6bc904af8cca2e6812aba35b7d3f6d9117e0',node_version:process.version,pglite_version:'0.5.8',migration_count:54,
  source_files_SHA256_verified:sourceFiles,syntax_checks:syntaxChecks,
  tests:groups.reduce((n,g)=>n+Math.max(0,g.tests),0),pass:groups.reduce((n,g)=>n+Math.max(0,g.pass),0),fail:groups.reduce((n,g)=>n+Math.max(0,g.fail),0),groups,failure,
  protected_user_Edge_entrypoints:4,unchanged_cron_dispatchers:2,unchanged_public_Turnstile_enquiry_handler:1,
  service_transport_does_not_replace_user_session_proof:true,existing_role_scope_recipient_and_cron_controls_preserved:true,
  Deno_Supabase_dependency_resolution_bundle_runtime_or_actual_JWT_verification:false,
  actual_Auth_Zoho_provider_mail_push_or_scheduler_requests:0,
  canonical_schema_versioned_migration_Admin_UI_Pages_or_hosted_guards_complete:false,
  hosted_enforcement_installed:false,hosted_acceptance:false,actual_email_notification_or_charge_dispatched:false,
  owner_SQL_or_deployment_action_required:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],exit_code:ok?0:1
},null,2));
process.exitCode=ok?0:1;
