// Full current top-level test discovery plus actual SQL integration; no hosted action.
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {stripTypeScriptTypes} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {discoverTestFiles,runOfflineTests} from './run-offline-tests.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
let hashes=0,syntax=0,groups=[],failure=null,manifest,checkpoint='MANIFEST',selectedPath=null;
const requiredZero=['fail','cancelled','skipped','todo'];
function receipt(name,result,expected){
 const output=(result.stdout||'')+'\n'+(result.stderr||'');
 const count=key=>Number(output.match(new RegExp('^# '+key+' (\\d+)\\s*$','m'))?.[1]??-1);
 const row={name,...Object.fromEntries(['tests','pass',...requiredZero].map(k=>[k,count(k)])),exit_code:result.status,
  process_error:Boolean(result.error),process_signal:result.signal??null,
  failed_case_titles:output.split(/\r?\n/).filter(x=>x.startsWith('not ok ')).slice(0,60),
  non_failing_TypeScript_experimental_warning:output.includes('ExperimentalWarning'),non_failing_module_type_warning:output.includes('MODULE_TYPELESS_PACKAGE_JSON')};
 groups.push(row);
 assert(!result.error&&!result.signal);assert.equal(row.exit_code,0);assert.equal(row.tests,expected);assert.equal(row.pass,expected);
 for(const k of requiredZero)assert.equal(row[k],0);
}
try{
 manifest=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-regression-source-manifest.json'),'utf8'));
 assert.equal(manifest.stage_step,'FR.2.4.E4.14_FULL_OFFLINE_REGRESSION');
 checkpoint='SOURCE_HASHES';
 for(const [name,expected]of Object.entries(manifest.file_sha256)){
  assert(!path.isAbsolute(name)&&!name.includes('\\')&&!name.split('/').includes('..'));
  selectedPath=/^[A-Za-z0-9_.\/-]+$/.test(name)?name:null;
  assert.equal(createHash('sha256').update(await readFile(path.join(root,name))).digest('hex'),expected);hashes++;
 }
 selectedPath=null;checkpoint='TEST_DISCOVERY';
 const discovered=discoverTestFiles(root).map(x=>'tests/'+path.basename(x));
 assert.deepEqual(discovered,manifest.discovered_test_files);
 assert.deepEqual((await readdir(path.join(root,'supabase/migrations'))).filter(x=>x.endsWith('.sql')).sort(),manifest.migration_paths.map(x=>path.basename(x)));
 checkpoint='DEPENDENCY_METADATA';
 const database=path.resolve(process.argv[2]||path.join(root,'scripts/fixtures/email-session-review-tools/node_modules/@electric-sql/pglite/dist/index.js'));
 const pkg=JSON.parse(await readFile(path.resolve(path.dirname(database),'../package.json'),'utf8'));
 assert.equal(pkg.name,'@electric-sql/pglite');assert.equal(pkg.version,'0.5.8');
 const lock=JSON.parse(await readFile(path.join(root,'scripts/fixtures/email-session-review-tools/package-lock.json'),'utf8'));
 const entry=lock.packages['node_modules/@electric-sql/pglite'];assert.equal(entry.version,'0.5.8');
 assert.equal(entry.resolved,'https://registry.npmjs.org/@electric-sql/pglite/-/pglite-0.5.8.tgz');
 assert.equal(entry.integrity,'sha512-n9tsbUOhwx2epK1V0ZG9Ar4SHWUju04dhmzZXiSBXwBoleOvIfals33NAaWgagQVAL4Rbvx/Ptsu3P+pA09f6Q==');
 const env={};const allowed=new Set(['PATH','HOME','TMPDIR','TMP','TEMP','SYSTEMROOT','COMSPEC','PATHEXT','LANG','LC_ALL','USERPROFILE','APPDATA','LOCALAPPDATA']);
 for(const [key,value]of Object.entries(process.env))if(allowed.has(key.toUpperCase()))env[key]=value;
 checkpoint='SYNTAX';
 for(const name of manifest.syntax_paths){
  selectedPath=/^[A-Za-z0-9_.\/-]+$/.test(name)?name:null;
  const source=await readFile(path.join(root,name),'utf8');
  const run=name.endsWith('.ts')?spawnSync(process.execPath,['--input-type=module','--check'],{input:stripTypeScriptTypes(source),encoding:'utf8',env,timeout:15000}):spawnSync(process.execPath,['--check',path.join(root,name)],{encoding:'utf8',env,timeout:15000});
  assert(!run.error&&!run.signal);assert.equal(run.status,0);syntax++;
 }
 selectedPath=null;checkpoint='DISCOVERED_TESTS';
 receipt('ALL_DISCOVERED_TOP_LEVEL_MJS_AND_CJS_TESTS',runOfflineTests({directory:root,capture:true}),manifest.expected_discovered_tests);
 const sqlEnv={...env,MUSHAVO_EMAIL_UI_PGLITE:database,MUSHAVO_EMAIL_EDGE_PGLITE:database,MUSHAVO_EMAIL_GATEWAY_PGLITE:database};
 checkpoint='SQL_INTEGRATION';
 for(const group of manifest.sql_groups){
  const run=spawnSync(process.execPath,['--require',path.join(root,'scripts/offline-test-network.cjs'),'--test','--test-reporter=tap',path.join(root,group.file)],{cwd:root,env:sqlEnv,encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024});
  receipt(group.name,run,group.expected_tests);
 }
}catch{failure={problem_code:'FULL_OFFLINE_SOURCE_SYNTAX_TEST_OR_DEPENDENCY_REVIEW_REQUIRED',checkpoint,selected_source_path:selectedPath};}
const ok=!failure&&groups.length===9;
console.log(JSON.stringify({stage_step:'FR.2.4.E4.14_FULL_OFFLINE_REGRESSION',
 result:ok?'OFFLINE_ALL_DISCOVERED_TESTS_AND_EMAIL_SQL_INTEGRATION_SCOPED_PASS':'FULL_OFFLINE_REGRESSION_REVIEW_REQUIRED',
 scope:'ALL_DISCOVERED_TOP_LEVEL_MJS_CJS_TESTS_CURRENT_EXPORTERS_HISTORICAL_PINNED_FIXTURES_AND_EIGHT_ACTUAL_EMAIL_SQL_INTEGRATION_BATCHES',
 source_parent_commit:'01f916084c31fda7dce8fd8add354f2ad37494e9',revision:'WINDOWS_ARCHIVE_LINE_ENDING_CORRECTION',node_version:process.version,pglite_version:'0.5.8',
 discovered_test_files:manifest?.discovered_test_files.length??0,MJS_test_files:manifest?.discovered_test_files.filter(x=>x.endsWith('.mjs')).length??0,CJS_test_files:manifest?.discovered_test_files.filter(x=>x.endsWith('.cjs')).length??0,
 source_files_SHA256_verified:hashes,syntax_checks:syntax,migration_count:55,historical_component_fixture_migration_count:54,
 tests:groups.reduce((n,g)=>n+Math.max(0,g.tests),0),pass:groups.reduce((n,g)=>n+Math.max(0,g.pass),0),fail:groups.reduce((n,g)=>n+Math.max(0,g.fail),0),groups,failure,
 all_discovered_tests_and_selected_actual_SQL_passed:ok,
 historical_FR1_and_stage10_source_pins_preserved:true,
 historical_inputs_retrieved_at_original_commits_and_independently_hash_checked:true,
 application_or_SQL_runtime_source_changed_by_this_checkpoint:false,
 provider_JWT_Auth_Storage_or_actual_parallel_PostgreSQL_verified:false,
 real_Deno_Cloudflare_or_native_bundle_runtime_verified:false,
 full_CI_workflow_or_store_execution_verified:false,
 browser_cookie_cross_device_or_recovery_acceptance_verified:false,
 actual_Auth_Zoho_Cloudflare_provider_mail_push_or_scheduler_requests:0,
 hosted_SQL_installer_email_enforcement_or_hook_changed:false,
 live_activation_acknowledgement_or_coordinated_rollout_approved:false,
 actual_email_notification_or_charge_dispatched:false,
 hosted_acceptance:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],exit_code:ok?0:1
},null,2));
process.exitCode=ok?0:1;
