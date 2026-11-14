// Credential-free current-source checks and actual synthetic SQL/transport tests.
import assert from 'node:assert/strict';
import {readFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const stage='FR.2.4.E5.21_BATCH_H_QUARANTINED_STAGING_DATABASE_INSTALLATION';
let phase='SOURCE_HASHES',verified=0,syntax=0,problem=null,group=null;
try{
 assert.equal(process.argv.length,3);
 const m=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-batch-h-source-manifest.json'),'utf8'));
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
 const t=spawnSync(process.execPath,['--require',path.join(root,'scripts/offline-test-network.cjs'),'--test','--test-reporter=tap',path.join(root,'tests/fr-2-email-batch-f-review.test.mjs'),path.join(root,'tests/fr-2-email-batch-h.test.mjs')],
  {cwd:root,encoding:'utf8',env:{...process.env,MUSHAVO_EMAIL_UI_PGLITE:database},timeout:120000,maxBuffer:4*1024*1024});
 const out=(t.stdout||'')+'\n'+(t.stderr||'');const count=k=>Number(out.match(new RegExp('^# '+k+' (\\d+)\\s*$','m'))?.[1]??-1);
 group={tests:count('tests'),pass:count('pass'),fail:count('fail'),cancelled:count('cancelled'),skipped:count('skipped'),todo:count('todo'),
  failed_case_titles:out.split(/\r?\n/).filter(x=>x.startsWith('not ok ')),exit_code:t.status,signal:t.signal??null,error_code:t.error?.code??null};
 assert.equal(t.status,0);assert.equal(group.tests,29);assert.equal(group.pass,29);for(const k of ['fail','cancelled','skipped','todo'])assert.equal(group[k],0);
 phase='COMPLETE';
}catch{problem='OFFLINE_BATCH_H_SOURCE_OR_TEST_REQUIRED';}
const ok=phase==='COMPLETE'&&problem===null;
console.log(JSON.stringify({stage_step:stage,result:ok?'OFFLINE_BATCH_H29_PASS_OWNER_QUARANTINED_INSTALLATION_PENDING':'OFFLINE_BATCH_H_REVIEW_REQUIRED',
 source_parent_commit:'fa73e49a1113fc798f701ac00fc96152b9570b62',node_version:process.version,pglite_version:'0.5.8',
 source_files_SHA256_verified:verified,syntax_checks:syntax,tests:group?.tests??0,pass:group?.pass??0,fail:group?.fail??0,group,
 actual_quarantined_installation_and_independent_readback_SQL_exercised_in_synthetic_database:ok,write_time_private_catalog_drift_refused:ok,local_idempotent_quarantine_recovery_rollback_exercised:ok,
 all_eight_transport_failure_positions_and_no_write_retry_exercised:ok,readback_after_failed_write_exercised:ok,
 documented_version_variants_and_security_drift_refusal_exercised_synthetically:ok,older_PostgreSQL_servers_executed:false,Windows_private_parent_execution_verified:false,
 installed_dependency_bytes_independently_hashed:false,real_provider_SQL_transport_verified:false,
 credentials_or_private_packets_accessed:false,actual_hosted_requests:0,hosted_SQL_installation_attempted:false,
 hosted_activation_invoked:false,actual_local_activation_exercised:ok,email_push_or_FX_dispatched:false,live_activation_approved:false,hosted_acceptance:false,
 production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],checkpoint:phase,problem_code:problem,exit_code:ok?0:1},null,2));
process.exitCode=ok?0:1;
