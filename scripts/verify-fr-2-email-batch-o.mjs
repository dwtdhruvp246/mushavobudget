// One pinned, credential-free combined verification. Hosted public reads require explicit mode.
import assert from 'node:assert/strict';
import {readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {publicBrowser,stage} from './check-fr-2-email-batch-o.mjs';
const diagnostic=process.argv[3]==='--tls-diagnostic';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let checkpoint='PINNED_SOURCE',hashes=0,syntax=0,units=null,local=null,hosted=null,failures=[],problem=null;
const child=(file,args)=>spawnSync(process.execPath,[file,...args],{cwd:root,encoding:'utf8',timeout:90000,maxBuffer:4*1024*1024});
try{
 assert(process.argv.length===3||(process.argv.length===4&&['--hosted-public','--tls-diagnostic'].includes(process.argv[3])));
 const manifest=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-batch-o-source-manifest.json'),'utf8'));
 assert.equal(manifest.stage_step,stage);assert.equal(Object.keys(manifest.file_sha256).length,manifest.source_file_count);
 for(const [f,h]of Object.entries(manifest.file_sha256)){
  assert(/^[A-Za-z0-9_./-]+$/.test(f)&&!f.includes('..')&&!path.isAbsolute(f));
  for(let p=path.join(root,f);;){assert(!(await lstat(p)).isSymbolicLink());const parent=path.dirname(p);if(parent===p)break;p=parent;}
  assert.equal(createHash('sha256').update(await readFile(path.join(root,f))).digest('hex'),h);hashes++;
 }
 checkpoint='SYNTAX';for(const f of manifest.syntax_paths){assert.equal(child('--check',[path.join(root,f)]).status,0);syntax++;}
 checkpoint='OFFLINE_REQUEST_BOUNDARIES';const run=spawnSync(process.execPath,['--require',path.join(root,'scripts/offline-test-network.cjs'),'--test','--test-reporter=tap',...(diagnostic?[]:[path.join(root,'tests/fr-2-email-batch-o.test.mjs')]),path.join(root,'tests/fr-2-email-batch-o-tls.test.mjs')],{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:1048576});
 const count=k=>Number((run.stdout??'').match(new RegExp('^# '+k+' (\\d+)\\s*$','m'))?.[1]??-1);
 units={tests:count('tests'),pass:count('pass'),fail:count('fail'),exit_code:run.status};assert.equal(run.status,0);assert.equal(units.tests,diagnostic?7:19);assert.equal(units.pass,diagnostic?7:19);assert.equal(units.fail,0);
 const engine=path.join(root,'scripts/test-fr-2-email-batch-o-engine.mjs');
 checkpoint='OFFLINE_ACTUAL_BROWSER';const normal=child(engine,[process.argv[2],...(diagnostic?['tls-metadata']:[])]);local=JSON.parse(normal.stdout);assert.equal(normal.status,0);assert.equal(local.pass,diagnostic?1:10);assert.equal(local.exit_code,0);assert(local.temporary_profile_removed&&local.browser_process_stopped&&local.local_fixture_closed&&local.local_fixture_unexpected_requests===0);
 for(const variant of (diagnostic?[]:['source-drift','unreviewed-route'])){
  checkpoint='OFFLINE_EXPECTED_FAILURE_CLEANUP';const run=child(engine,[process.argv[2],variant]),r=JSON.parse(run.stdout);
  assert.equal(run.status,1);assert.equal(r.exit_code,1);assert(r.temporary_profile_removed&&r.browser_process_stopped&&r.local_fixture_closed&&r.local_fixture_unexpected_requests===0);
  assert.equal(r.problem_code,variant==='source-drift'?'PUBLIC_BROWSER_CHECK_REQUIRED':'UNREVIEWED_PUBLIC_REQUEST');
  assert.equal(r.blocked_unreviewed_requests,variant==='unreviewed-route'?1:0);
  failures.push({variant,expected_denial_and_cleanup_verified:true,exit_code:0});
 }
 if(diagnostic){checkpoint='HOSTED_PUBLIC_TLS_METADATA';hosted=await publicBrowser(process.argv[2],{tlsDiagnostic:true});assert.equal(hosted.exit_code,0);assert.equal(hosted.pass,1);assert(hosted.tls_metadata?.collection_only);}
 if(process.argv[3]==='--hosted-public'){checkpoint='HOSTED_PUBLIC_BROWSER';hosted=await publicBrowser(process.argv[2]);assert.equal(hosted.exit_code,0);assert(hosted.hosted_TLS_verified&&hosted.executed_worker_source_verified);assert.equal(hosted.pass,10);}
 checkpoint='COMPLETE';
}catch{problem='BATCH_O_SOURCE_LOCAL_OR_PUBLIC_BROWSER_REVIEW_REQUIRED';}
const ok=checkpoint==='COMPLETE'&&!problem;
console.log(JSON.stringify({stage_step:stage,batch:'O',result:ok?(diagnostic?'BATCH_O_TLS_METADATA_COLLECTED_ACCEPTANCE_REVIEW_PENDING':hosted?'BATCH_O_LOCAL31_AND_HOSTED_PUBLIC10_SCOPED_PASS':'LOCAL_BATCH_O31_PASS_HOSTED_PUBLIC_PENDING'):'BATCH_O_COMBINED_REVIEW_REQUIRED',source_parent_commit:'7905c724d6d640672a61c56413ec258fee7b7685',node_version:process.version,platform:process.platform,source_hashes_verified:hashes,syntax_checks:syntax,offline_units:units,local_browser:local,expected_failure_exercises:failures,offline_PASS:(units?.pass??0)+(local?.pass??0)+failures.length,hosted_public_browser:hosted,private_packets_accessed:false,real_email_requests:0,committed_mode_change_requests:0,hosted_acceptance:false,live_activation_approved:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],checkpoint,problem_code:problem,exit_code:ok?0:1},null,2));process.exitCode=ok?0:1;
