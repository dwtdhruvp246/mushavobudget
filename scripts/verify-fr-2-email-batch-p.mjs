// Local candidate proof and optional retained public-ZIP preparation. No hosted transport.
import assert from 'node:assert/strict';
import {readFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {prepareOfflineZIP,stage} from './prepare-fr-2-email-batch-p.mjs';
import {verifyFrontendZIP} from './check-fr-2-email-batch-g.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let checkpoint='PINNED_SOURCE',hashes=0,syntax=0,units=null,reproduction=null,candidates=[],pack=null,problem=null,writeAttempted=false;
const child=(args,timeout=90000)=>spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout,maxBuffer:4*1024*1024});
try{
 assert(process.argv.length===3||process.argv.length===5);
 const manifest=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-batch-p-source-manifest.json'),'utf8'));assert.equal(manifest.stage_step,stage);assert.equal(Object.keys(manifest.file_sha256).length,manifest.source_file_count);
 for(const [f,h]of Object.entries(manifest.file_sha256)){
  assert(/^[A-Za-z0-9_./-]+$/.test(f)&&!f.includes('..')&&!path.isAbsolute(f));for(let p=path.join(root,f);;){assert(!(await lstat(p)).isSymbolicLink());const parent=path.dirname(p);if(parent===p)break;p=parent;}
  assert.equal(createHash('sha256').update(await readFile(path.join(root,f))).digest('hex'),h);hashes++;
 }
 checkpoint='SYNTAX';for(const f of manifest.syntax_paths)assert.equal(child(['--check',path.join(root,f)],30000).status,0),syntax++;
 if(process.argv.length===5){checkpoint='VERIFY_RETAINED_PUBLIC_ZIP';verifyFrontendZIP(process.argv[3]);}
 checkpoint='CANDIDATE_AND_REPACK_UNITS';const unit=child(['--require',path.join(root,'scripts/offline-test-network.cjs'),'--test','--test-reporter=tap',path.join(root,'tests/fr-2-email-batch-p.test.mjs')],30000),count=k=>Number((unit.stdout??'').match(new RegExp('^# '+k+' (\\d+)\\s*$','m'))?.[1]??-1);
 units={tests:count('tests'),pass:count('pass'),fail:count('fail'),exit_code:unit.status};assert.equal(unit.status,0);assert.equal(units.pass,8);assert.equal(units.tests,8);assert.equal(units.fail,0);
 const engine=path.join(root,'scripts/test-fr-2-email-batch-o-engine.mjs');
 checkpoint='REPRODUCE_CURRENT_WORKER_PAGES_REDIRECT_FAILURE';const bad=child([engine,process.argv[2],'pages-redirects']);reproduction=JSON.parse(bad.stdout);assert.equal(bad.status,1);assert.equal(reproduction.exit_code,1);assert.equal(reproduction.pass,7);assert.equal(reproduction.offline_navigation.cached_document_redirected,true);assert.equal(reproduction.offline_navigation.view.document_class,'BROWSER_ERROR');assert.equal(reproduction.offline_navigation.navigation_error_class,'ERR_FAILED');assert(reproduction.temporary_profile_removed&&reproduction.browser_process_stopped&&reproduction.local_fixture_closed&&reproduction.offline_app_navigation_reached_fixture===0&&reproduction.local_fixture_unexpected_requests===0);
 for(const variant of ['candidate-pages-redirects','candidate-direct']){
  checkpoint='ACTUAL_CANDIDATE_BROWSER';const run=child([engine,process.argv[2],variant]),r=JSON.parse(run.stdout);candidates.push(r);assert.equal(run.status,0);assert.equal(r.exit_code,0);assert.equal(r.pass,10);assert(r.candidate_worker_exercised&&r.offline_navigation.document_from_service_worker&&r.temporary_profile_removed&&r.browser_process_stopped&&r.local_fixture_closed&&r.offline_app_navigation_reached_fixture===0&&r.local_fixture_unexpected_requests===0);assert.equal(r.offline_navigation.cached_document_redirected,variant==='candidate-pages-redirects');
 }
 if(process.argv.length===5){checkpoint='PREPARE_NEW_PUBLIC_ZIP';writeAttempted=true;pack=prepareOfflineZIP(process.argv[3],process.argv[4]);assert.equal(pack.exit_code,0);}
 checkpoint='COMPLETE';
}catch{problem='LOCAL_SOURCE_CANDIDATE_REPRODUCTION_OR_RETAINED_ZIP_REVIEW_REQUIRED';}
const ok=checkpoint==='COMPLETE'&&!problem;
console.log(JSON.stringify({stage_step:stage,batch:'P',result:ok?(pack?'BATCH_P_LOCAL29PASS_RETAINED_PUBLIC_ZIP_PREPARED_NOT_DEPLOYED':'LOCAL_BATCH_P29PASS_CANDIDATE_OWNER_ZIP_PENDING'):'BATCH_P_LOCAL_REVIEW_REQUIRED',source_parent_commit:'df8bdc48490ceaf4879fe4056a0e5aa57e553997',node_version:process.version,platform:process.platform,source_hashes_verified:hashes,syntax_checks:syntax,units,expected_current_worker_redirect_failure:reproduction,candidate_browsers:candidates,tests:(units?.tests??0)+(reproduction?.exit_code===1?1:0)+candidates.reduce((n,x)=>n+x.tests,0),pass:(units?.pass??0)+(reproduction?.exit_code===1?1:0)+candidates.reduce((n,x)=>n+x.pass,0),package:pack,artifact_write_attempted:writeAttempted,artifact_write_outcome_requires_inspection:writeAttempted&&!ok,actual_hosted_requests:0,private_packets_or_credentials_accessed:false,email_requests:0,committed_mode_change_requests:0,uploaded_or_deployed:false,do_not_upload_yet:true,hosted_acceptance:false,live_activation_approved:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],checkpoint,problem_code:problem,exit_code:ok?0:1},null,2));process.exitCode=ok?0:1;
