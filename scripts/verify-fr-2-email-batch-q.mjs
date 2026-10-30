// --prepare: source/unit/existing-ZIP checks only. --hosted: independent public readback after dashboard success.
import assert from 'node:assert/strict';
import {readFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {stage,reviewedZIP,stagingRelease,ZIP_SHA256,SW_SHA256} from './check-fr-2-email-batch-q.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let checkpoint='PINNED_SOURCE',hashes=0,syntax=0,units=null,hosted=null,problem=null,zipVerified=false;
const prepare=process.argv[2]==='--prepare',hostedMode=process.argv[2]==='--hosted';
try{
 assert((prepare&&process.argv.length===4)||(hostedMode&&process.argv.length===6));
 const m=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-batch-q-source-manifest.json'),'utf8'));
 assert.equal(m.stage_step,stage);assert.equal(Object.keys(m.file_sha256).length,m.source_file_count);
 for(const [f,h]of Object.entries(m.file_sha256)){
  assert(/^[A-Za-z0-9_./-]+$/.test(f)&&!f.includes('..')&&!path.isAbsolute(f));for(let p=path.join(root,f);;){assert(!(await lstat(p)).isSymbolicLink());const parent=path.dirname(p);if(parent===p)break;p=parent;}
  assert.equal(createHash('sha256').update(await readFile(path.join(root,f))).digest('hex'),h);hashes++;
 }
 checkpoint='REUSE_REVIEWED_BATCH_P_ZIP';reviewedZIP(process.argv[prepare?3:4]);zipVerified=true;
 if(prepare){
  checkpoint='SYNTAX';for(const f of m.syntax_paths){assert.equal(spawnSync(process.execPath,['--check',path.join(root,f)],{encoding:'utf8',timeout:30000}).status,0);syntax++;}
  checkpoint='OFFLINE_PUBLIC_BOUNDARIES';const run=spawnSync(process.execPath,['--require',path.join(root,'scripts/offline-test-network.cjs'),'--test','--test-reporter=tap',path.join(root,'tests/fr-2-email-batch-q.test.mjs')],{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:1048576});
  const count=k=>Number((run.stdout??'').match(new RegExp('^# '+k+' (\\d+)\\s*$','m'))?.[1]??-1);
  units={tests:count('tests'),pass:count('pass'),fail:count('fail'),exit_code:run.status};assert.equal(run.status,0);assert.equal(units.tests,12);assert.equal(units.pass,12);assert.equal(units.fail,0);
 }else{checkpoint='TWO_ORIGIN_PUBLIC_READBACK';hosted=await stagingRelease(process.argv[3],process.argv[4],process.argv[5]);assert.equal(hosted.exit_code,0);}
 checkpoint='COMPLETE';
}catch{problem='PINNED_SOURCE_REVIEWED_ZIP_OR_PUBLIC_READBACK_REQUIRED';}
const ok=checkpoint==='COMPLETE'&&!problem;
console.log(JSON.stringify({stage_step:stage,batch:'Q',result:ok?(prepare?'BATCH_Q_LOCAL_PREPARATION_PASS_EXACT_ZIP_MANUAL_STAGING_UPLOAD_NEXT':'BATCH_Q_PUBLIC_READBACK_SCOPED_PASS'):'BATCH_Q_REVIEW_REQUIRED',mode:prepare?'LOCAL_PREPARATION':hostedMode?'HOSTED_PUBLIC_READBACK':'INVALID',node_version:process.version,platform:process.platform,source_hashes_verified:hashes,syntax_checks:syntax,offline_units:units,reviewed_ZIP_verified:zipVerified,ZIP_SHA256,SW_SHA256,hosted_public_readback:hosted,artifact_regenerated:false,artifact_written:false,automatic_upload_attempted:false,private_packets_or_credentials_accessed:false,email_requests:0,committed_mode_change_requests:0,hosted_acceptance:false,live_activation_approved:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],checkpoint,problem_code:problem,exit_code:ok?0:1},null,2));process.exitCode=ok?0:1;
