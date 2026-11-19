// Offline only: no credentials, private packets, hosted probes or SQL installation.
import assert from 'node:assert/strict';
import {readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {windowStage} from './lib/email-acceptance-window-source.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let phase='SOURCE_HASHES',hashes=0,syntax=0,group=null,problem=null;
try{
 assert.equal(process.argv.length,3);
 const m=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-batch-k-source-manifest.json'),'utf8'));
 assert.equal(m.stage_step,windowStage);assert.equal(Object.keys(m.file_sha256).length,m.source_file_count);
 for(const [file,hash]of Object.entries(m.file_sha256)){
  assert(/^[A-Za-z0-9_./-]+$/.test(file)&&!file.includes('..')&&!path.isAbsolute(file));
  let p=path.join(root,file);for(;;){assert(!(await lstat(p)).isSymbolicLink());const next=path.dirname(p);if(next===p)break;p=next;}
  assert.equal(createHash('sha256').update(await readFile(path.join(root,file))).digest('hex'),hash);hashes++;
 }
 phase='RETAINED_PUBLIC_DEPENDENCY';
 const dependency=path.resolve(process.argv[2]);
 const installed=JSON.parse(await readFile(path.resolve(path.dirname(dependency),'../package.json'),'utf8'));
 assert.equal(installed.name,'@electric-sql/pglite');assert.equal(installed.version,'0.5.8');
 const lock=JSON.parse(await readFile(path.join(root,'scripts/fixtures/email-session-review-tools/package-lock.json'),'utf8'));
 assert.equal(lock.packages['node_modules/@electric-sql/pglite'].integrity,'sha512-n9tsbUOhwx2epK1V0ZG9Ar4SHWUju04dhmzZXiSBXwBoleOvIfals33NAaWgagQVAL4Rbvx/Ptsu3P+pA09f6Q==');
 phase='SYNTAX';
 for(const file of m.syntax_paths){const r=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8',timeout:30000});assert.equal(r.status,0);syntax++;}
 phase='COMBINED_WINDOW_AND_I_J_REGRESSIONS';
 const t=spawnSync(process.execPath,['--require',path.join(root,'scripts/offline-test-network.cjs'),'--test','--test-concurrency=1','--test-reporter=tap',
  ...['fr-2-email-acceptance-window','fr-2-email-batch-i','fr-2-email-batch-j'].map(x=>path.join(root,'tests',x+'.test.mjs'))],
  {cwd:root,encoding:'utf8',env:{...process.env,MUSHAVO_EMAIL_UI_PGLITE:dependency},timeout:180000,maxBuffer:4*1024*1024});
 const output=(t.stdout||'')+'\n'+(t.stderr||'');
 const count=k=>Number(output.match(new RegExp('^# '+k+' (\\d+)\\s*$','m'))?.[1]??-1);
 group={tests:count('tests'),pass:count('pass'),fail:count('fail'),cancelled:count('cancelled'),skipped:count('skipped'),todo:count('todo'),
  failed_case_titles:output.split(/\r?\n/).filter(x=>/^\s*not ok /.test(x)),exit_code:t.status,signal:t.signal??null,error_code:t.error?.code??null};
 assert.equal(t.status,0);assert.equal(group.tests,56);assert.equal(group.pass,56);
 for(const k of ['fail','cancelled','skipped','todo'])assert.equal(group[k],0);
 phase='COMPLETE';
}catch{problem='OFFLINE_BATCH_K_SOURCE_OR_TEST_REQUIRED';}
const ok=phase==='COMPLETE'&&!problem;
console.log(JSON.stringify({stage_step:windowStage,batch:'K',result:ok?'OFFLINE_BATCH_K56_PASS_CLOSED_WINDOW_CANDIDATE_HOSTED_PENDING':'OFFLINE_BATCH_K_REVIEW_REQUIRED',
 source_parent_commit:'de32ce5d77e2b6b8f0c33ce8ae18b8589ed5130f',node_version:process.version,pglite_version:'0.5.8',
 source_hashes_verified:hashes,syntax_checks:syntax,tests:group?.tests??0,pass:group?.pass??0,fail:group?.fail??0,group,
 actual_local_installed_SQL_window_and_RLS_checks_passed:ok,retained_I_J_synthetic_regressions_passed:ok,
 server_clock_expiry_and_account_allowlist_exercised:ok,late_installation_rollback_and_catalog_drift_exercised:ok,
 original_quarantine_function_source_preserved:ok,global_unbounded_resume_refused:ok,
 deadline_changes_stored_mode_automatically:false,in_flight_work_or_existing_signed_URLs_cancelled:false,
 Windows_owner_execution_verified:false,older_PostgreSQL_servers_executed:false,installed_dependency_bytes_independently_hashed:false,
 credentials_or_private_packets_accessed:false,actual_hosted_requests:0,hosted_installation_attempted:false,
 committed_live_mode_change_requested:false,email_push_or_FX_dispatched:false,
 hosted_acceptance:false,live_activation_approved:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],
 checkpoint:phase,problem_code:problem,exit_code:ok?0:1},null,2));
process.exitCode=ok?0:1;
