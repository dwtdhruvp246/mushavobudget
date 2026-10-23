// Credential-free current-source checks and actual synthetic SQL/transport tests.
import assert from 'node:assert/strict';
import {readFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const stage='FR.2.4.E5.22_BATCH_I_CONTROLLED_EMAIL_PROOF_AND_ROLLED_BACK_RECOVERY';
let phase='SOURCE_HASHES',verified=0,syntax=0,problem=null,group=null,runner=null;
try{
 assert([3,4].includes(process.argv.length));
 const m=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-batch-i-source-manifest.json'),'utf8'));
 assert.equal(m.stage_step,stage);assert.equal(Object.keys(m.file_sha256).length,m.source_file_count);
 for(const [file,hash]of Object.entries(m.file_sha256)){
  assert(/^[A-Za-z0-9_./-]+$/.test(file)&&!file.includes('..')&&!path.isAbsolute(file));
  let p=path.join(root,file);for(;;){assert(!(await lstat(p)).isSymbolicLink());const parent=path.dirname(p);if(parent===p)break;p=parent;}
  assert.equal(createHash('sha256').update(await readFile(path.join(root,file))).digest('hex'),hash);verified++;
 }
 phase='DEPENDENCY';const database=path.resolve(process.argv[2]);
 const installed=JSON.parse(await readFile(path.resolve(path.dirname(database),'../package.json'),'utf8'));
 assert.equal(installed.name,'@electric-sql/pglite');assert.equal(installed.version,'0.5.8');
 const lock=JSON.parse(await readFile(path.join(root,'scripts/fixtures/email-session-review-tools/package-lock.json'),'utf8'));
 assert.equal(lock.packages['node_modules/@electric-sql/pglite'].version,'0.5.8');
 assert.equal(lock.packages['node_modules/@electric-sql/pglite'].integrity,'sha512-n9tsbUOhwx2epK1V0ZG9Ar4SHWUju04dhmzZXiSBXwBoleOvIfals33NAaWgagQVAL4Rbvx/Ptsu3P+pA09f6Q==');
 phase='SYNTAX';for(const file of m.syntax_paths){const r=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8',timeout:30000});assert.equal(r.status,0);syntax++;}
 phase='ACTUAL_SQL_AND_PRIVATE_TRANSPORT';
 const t=spawnSync(process.execPath,['--require',path.join(root,'scripts/offline-test-network.cjs'),'--test','--test-reporter=tap',path.join(root,'tests/fr-2-email-batch-i.test.mjs')],
  {cwd:root,encoding:'utf8',env:{...process.env,MUSHAVO_EMAIL_UI_PGLITE:database},timeout:120000,maxBuffer:4*1024*1024});
 const out=(t.stdout||'')+'\n'+(t.stderr||'');const count=k=>Number(out.match(new RegExp('^# '+k+' (\\d+)\\s*$','m'))?.[1]??-1);
 group={tests:count('tests'),pass:count('pass'),fail:count('fail'),cancelled:count('cancelled'),skipped:count('skipped'),todo:count('todo'),
  failed_case_titles:out.split(/\r?\n/).filter(x=>x.startsWith('not ok ')),exit_code:t.status,signal:t.signal??null,error_code:t.error?.code??null};
 assert.equal(t.status,0);assert.equal(group.tests,14);assert.equal(group.pass,14);for(const k of ['fail','cancelled','skipped','todo'])assert.equal(group[k],0);
 phase='POWERSHELL_PACKET_HELPERS';
 const powershell=process.argv[3]??(process.platform==='win32'?path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'):'pwsh');
 const ps=spawnSync(powershell,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'tests/fr-2-email-batch-i-runner.tests.ps1'),'-SnapshotRoot',root],
  {cwd:root,encoding:'utf8',timeout:30000,maxBuffer:65536});
 assert.equal(ps.status,0);assert.equal(ps.stderr,'');runner=JSON.parse(ps.stdout.replace(/^\uFEFF/,''));
 assert.equal(runner.result,'LOCAL_PACKET_HELPERS_PASS');assert.equal(runner.tests,39);assert.equal(runner.pass,39);assert.equal(runner.fail,0);
 assert.equal(runner.actual_hosted_requests,0);assert.equal(runner.Windows_DPAPI_or_owner_packet_exercised,false);
 phase='COMPLETE';
}catch{problem='OFFLINE_BATCH_I_SOURCE_OR_TEST_REQUIRED';}
const ok=phase==='COMPLETE'&&problem===null;
console.log(JSON.stringify({stage_step:stage,result:ok?'OFFLINE_BATCH_I53_PASS_OWNER_CONTROLLED_EMAIL_PENDING':'OFFLINE_BATCH_I_REVIEW_REQUIRED',
 source_parent_commit:'1dbdba3a6cf1352f00c42249dcc0e12a8ee7479b',node_version:process.version,pglite_version:'0.5.8',
 source_files_SHA256_verified:verified,syntax_checks:syntax,tests:(group?.tests??0)+(runner?.tests??0),pass:(group?.pass??0)+(runner?.pass??0),fail:(group?.fail??0)+(runner?.fail??0),group,runner,
 actual_gateway_HMAC_SQL_and_rolled_back_recovery_exercised_with_synthetic_Auth_and_Zoho:ok,
 write_time_private_catalog_drift_and_late_after_resume_failure_roll_back:ok,
 all_21_direct_transport_failure_positions_and_no_email_resend_exercised:ok,
 selected_session_cleanup_on_failure_exercised:ok,
 Windows_private_dialogue_parent_execution_verified:false,
 older_PostgreSQL_servers_executed:false,
 installed_dependency_bytes_independently_hashed:false,real_provider_SQL_transport_verified:false,
 credentials_or_private_packets_accessed:false,actual_hosted_requests:0,hosted_controlled_email_attempted:false,
 hosted_activation_invoked:false,actual_local_rolled_back_recovery_exercised:ok,email_push_or_FX_dispatched:false,live_activation_approved:false,hosted_acceptance:false,
 production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],checkpoint:phase,problem_code:problem,exit_code:ok?0:1},null,2));
process.exitCode=ok?0:1;
