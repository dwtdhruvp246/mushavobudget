// Owner offline preparation only: public local fixtures, no retained packet or hosted calls.
import assert from 'node:assert/strict';
import {readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {stage} from './check-fr-2-email-batch-t.mjs';
import {localDiagnosticEvents} from './lib/email-batch-t-diagnostic-shape.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let checkpoint='SOURCE_HASHES',hashes=0,syntax=0,group=null,runner=null,problem=null,localBrowserDiagnostics=[];
try{
 assert.equal(process.argv.length,4);assert(path.isAbsolute(process.argv[2]));assert(path.isAbsolute(process.argv[3]));
 const manifest=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-batch-t-source-manifest.json'),'utf8'));assert.equal(manifest.stage_step,stage);assert.equal(Object.keys(manifest.file_sha256).length,manifest.source_file_count);
 for(const [f,h] of Object.entries(manifest.file_sha256)){
  assert(/^[A-Za-z0-9_./-]+$/.test(f)&&!f.includes('..')&&!path.isAbsolute(f));for(let p=path.join(root,f);;){assert(!(await lstat(p)).isSymbolicLink());const parent=path.dirname(p);if(parent===p)break;p=parent;}
  assert.equal(createHash('sha256').update(await readFile(path.join(root,f))).digest('hex'),h);hashes++;
 }
 checkpoint='SYNTAX';for(const f of manifest.syntax_paths){assert.equal(spawnSync(process.execPath,['--check',path.join(root,f)],{encoding:'utf8',timeout:30000}).status,0);syntax++;}
 checkpoint='RETAINED_PGLITE';const dependency=process.argv[3],meta=JSON.parse(await readFile(path.resolve(path.dirname(dependency),'../package.json'),'utf8'));assert.equal(meta.name,'@electric-sql/pglite');assert.equal(meta.version,'0.5.8');const lock=JSON.parse(await readFile(path.join(root,'scripts/fixtures/email-session-review-tools/package-lock.json'),'utf8'));assert.equal(lock.packages['node_modules/@electric-sql/pglite'].integrity,'sha512-n9tsbUOhwx2epK1V0ZG9Ar4SHWUju04dhmzZXiSBXwBoleOvIfals33NAaWgagQVAL4Rbvx/Ptsu3P+pA09f6Q==');
 checkpoint='COMBINED_BROWSER_GUARD_TRANSPORT_AND_INSTALLED_SQL';
 const run=spawnSync(process.execPath,['--require',path.join(root,'scripts/offline-test-network.cjs'),'--test','--test-concurrency=1','--test-reporter=tap',...['fr-2-email-batch-t','fr-2-email-batch-t-guard','fr-2-email-batch-t-browser','fr-2-email-batch-t-diagnostics','fr-2-email-batch-t-target'].map(f=>path.join(root,'tests',f+'.test.mjs'))],{cwd:root,env:{...process.env,MUSHAVO_EMAIL_BROWSER_EXE:process.argv[2],MUSHAVO_EMAIL_UI_PGLITE:dependency},encoding:'utf8',timeout:360000,maxBuffer:8*1024*1024});
 localBrowserDiagnostics=localDiagnosticEvents(run.stdout??'');
 const count=k=>Number((run.stdout??'').match(new RegExp('^# '+k+' (\\d+)\\s*$','m'))?.[1]??-1);group={tests:count('tests'),pass:count('pass'),fail:count('fail'),skipped:count('skipped'),cancelled:count('cancelled'),exit_code:run.status,failed_case_numbers:[...(run.stdout??'').matchAll(/^not ok ([0-9]+) - /gm)].map(x=>Number(x[1]))};assert.equal(group.tests,66);assert.equal(group.pass,66);assert.equal(group.fail,0);assert.equal(group.skipped,0);assert.equal(group.cancelled,0);assert.equal(group.exit_code,0);
 checkpoint='WINDOWS_PACKET_HELPER_AST';
 if(process.platform==='win32'){
  const shell=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
  const ps=spawnSync(shell,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'tests/fr-2-email-batch-t-runner.tests.ps1'),'-SnapshotRoot',root],{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:65536});assert.equal(ps.status,0);assert.equal(ps.stderr,'');runner=JSON.parse(ps.stdout.replace(/^\uFEFF/,''));assert.equal(runner.tests,39);assert.equal(runner.pass,39);assert.equal(runner.fail,0);assert.equal(runner.actual_hosted_requests,0);
 }
 checkpoint='COMPLETE';
}catch{problem='BATCH_T_OFFLINE_SOURCE_OR_INTEGRATION_REVIEW_REQUIRED';}
const ok=checkpoint==='COMPLETE'&&!problem;
console.log(JSON.stringify({stage_step:stage,batch:'T',result:ok?(runner?'OFFLINE_BATCH_T105_PASS_OWNER_HOSTED_BROWSER_PENDING':'OFFLINE_BATCH_T66_PASS_WINDOWS_HELPERS_AND_HOSTED_BROWSER_PENDING'):'OFFLINE_BATCH_T_REVIEW_REQUIRED',source_parent_commit:'df36574bcc9ac2010deacc64aa6de6b2a1d6598f',node_version:process.version,platform:process.platform,pglite_version:'0.5.8',source_hashes_verified:hashes,syntax_checks:syntax,tests:(group?.tests??0)+(runner?.tests??0),pass:(group?.pass??0)+(runner?.pass??0),fail:(group?.fail??0)+(runner?.fail??0),group,runner,local_browser_diagnostics:localBrowserDiagnostics,
 actual_local_browser_gateway_installed_SQL_and_RLS_end_to_end_exercised:ok,synthetic_Auth_Management_and_Zoho_services:true,actual_local_cross_origin_CORS_exercised:ok,all_27_direct_transport_failure_positions_exercised:ok,browser_lifecycle_failure_boundaries_exercised:ok,seven_actual_browser_and_database_cases_exercised:ok,unrelated_service_worker_preserved_and_selected_page_worker_denied:ok,guard_cause_preserved_without_false_TLS_label:ok,preexisting_session_device_and_proof_preservation_exercised:ok,exact_cleanup_and_lost_COMMIT_readback_exercised:ok,
 Windows_owner_private_dialogue_execution_verified:false,installed_dependency_bytes_independently_hashed:false,older_PostgreSQL_servers_or_real_concurrency_verified:false,hosted_normal_trust_TLS_exercised:false,full_app_bootstrap_or_private_worker_cache_integration_exercised:false,
 actual_hosted_requests:0,real_email_requests:0,private_packets_or_credentials_accessed:false,committed_mode_change_requests:0,artifact_regenerated_or_uploaded:false,hosted_acceptance:false,live_activation_approved:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],checkpoint,problem_code:problem,exit_code:ok?0:1,checked_UTC:new Date().toISOString()},null,2));process.exitCode=ok?0:1;
