// Batch S combines new local browser boundaries with retained SQL containment tests.
// No hosted option exists; no owner credentials or private packet are accepted.
import assert from 'node:assert/strict';
import {readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {boundedBrowserPreparation,stage} from './check-fr-2-email-batch-s.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let checkpoint='SOURCE_HASHES',hashes=0,syntax=0,units=null,retained=null,browser=null,expectedFailures=[],problem=null;
const group=(files,env={})=>{const run=spawnSync(process.execPath,['--require',path.join(root,'scripts/offline-test-network.cjs'),'--test','--test-concurrency=1','--test-reporter=tap',...files.map(f=>path.join(root,'tests',f+'.test.mjs'))],{cwd:root,env:{...process.env,...env},encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});const count=k=>Number((run.stdout??'').match(new RegExp('^# '+k+' (\\d+)\\s*$','m'))?.[1]??-1);return {tests:count('tests'),pass:count('pass'),fail:count('fail'),skipped:count('skipped'),cancelled:count('cancelled'),exit_code:run.status};};
try{
 assert.equal(process.argv.length,4);assert(path.isAbsolute(process.argv[2]));assert(path.isAbsolute(process.argv[3]));
 const manifest=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-batch-s-source-manifest.json'),'utf8'));
 assert.equal(manifest.stage_step,stage);assert.equal(Object.keys(manifest.file_sha256).length,manifest.source_file_count);
 for(const [f,h] of Object.entries(manifest.file_sha256)){
  assert(/^[A-Za-z0-9_./-]+$/.test(f)&&!f.includes('..')&&!path.isAbsolute(f));for(let p=path.join(root,f);;){assert(!(await lstat(p)).isSymbolicLink());const parent=path.dirname(p);if(parent===p)break;p=parent;}
  assert.equal(createHash('sha256').update(await readFile(path.join(root,f))).digest('hex'),h);hashes++;
 }
 checkpoint='SYNTAX';for(const f of manifest.syntax_paths){assert.equal(spawnSync(process.execPath,['--check',path.join(root,f)],{encoding:'utf8',timeout:30000}).status,0);syntax++;}
 checkpoint='RETAINED_PGLITE';const meta=JSON.parse(await readFile(path.resolve(path.dirname(process.argv[3]),'../package.json'),'utf8'));assert.equal(meta.name,'@electric-sql/pglite');assert.equal(meta.version,'0.5.8');
 checkpoint='LOCAL_REQUEST_GUARD_UNITS';units=group(['fr-2-email-batch-s']);assert.equal(units.tests,30);assert.equal(units.pass,30);assert.equal(units.fail,0);assert.equal(units.exit_code,0);
 checkpoint='RETAINED_SQL_AND_FAILURE_CONTAINMENT';retained=group(['fr-2-email-acceptance-window','fr-2-email-batch-l','fr-2-email-batch-m'],{MUSHAVO_EMAIL_UI_PGLITE:process.argv[3]});assert.equal(retained.tests,62);assert.equal(retained.pass,62);assert.equal(retained.fail,0);assert.equal(retained.skipped,0);assert.equal(retained.exit_code,0);
 checkpoint='LOCAL_ACTUAL_BROWSER';browser=await boundedBrowserPreparation(process.argv[2]);assert.equal(browser.exit_code,0);assert.equal(browser.tests,21);assert.equal(browser.pass,21);
 checkpoint='LOCAL_BROWSER_FAILURE_CONTAINMENT';
 for(const [failure,code,opened] of [['BEGIN_RESPONSE_LOST','EXPECTED_BEGIN_RESPONSE_LOST',false],['VERIFY_RESPONSE_LOST','EXPECTED_VERIFY_RESPONSE_LOST',false],['ACTIVE_PROOF_DENIED','LOCAL_BROWSER_CHECK_REQUIRED',true],['AFTER_OPEN','EXPECTED_AFTER_OPEN',true],['UNREVIEWED_REQUEST','LOCAL_REQUEST_GUARD_REQUIRED',true]]){
  const r=await boundedBrowserPreparation(process.argv[2],{failure});const clean=['synthetic_final_quarantined','incognito_contexts_disposed','disposed_context_cookies_absent','browser_process_stopped','temporary_profile_removed','local_fixture_closed'].every(k=>r[k]===true);
  const pass=r.exit_code===1&&r.problem_code===code&&r.synthetic_email_attempts===1&&r.synthetic_open_attempts===Number(opened)&&r.synthetic_quarantine_attempts===Number(opened)&&clean&&r.request_guard.begin===1&&r.request_guard.verify===(failure==='BEGIN_RESPONSE_LOST'?0:1);
  expectedFailures.push({exercise:failure,expected_stop_and_cleanup_verified:pass,observed_problem_code:r.problem_code,browser_checks_before_stop:r.pass,expected_rejection_checks:r.fail,synthetic_email_attempts:r.synthetic_email_attempts,synthetic_open_attempts:r.synthetic_open_attempts,synthetic_final_quarantined:r.synthetic_final_quarantined,request_guard:r.request_guard,cleanup_verified:clean});assert(pass);
 }
 checkpoint='COMPLETE';
}catch{problem='LOCAL_BROWSER_TRANSITION_OR_CONTAINMENT_REVIEW_REQUIRED';}
const ok=checkpoint==='COMPLETE'&&!problem,total=(units?.tests??0)+(retained?.tests??0)+(browser?.tests??0)+expectedFailures.length;
console.log(JSON.stringify({stage_step:stage,batch:'S',result:ok?'LOCAL_BATCH_S118_BROWSER_TRANSITIONS_AND_CONTAINMENT_SCOPED_PASS':'LOCAL_BATCH_S_REVIEW_REQUIRED',source_parent_commit:'b29a6d6aa71ce02b58dfc431ca8f4f0e5ec57f68',node_version:process.version,platform:process.platform,pglite_version:'0.5.8',source_hashes_verified:hashes,syntax_checks:syntax,tests:total,pass:ok?total:null,fail:ok?0:null,units,retained_SQL_containment:retained,local_browser:browser,expected_failure_exercises:expectedFailures,
 cases_include_retained_and_overlapping_regressions:true,synthetic_backend_browser_and_actual_SQL_runs_separate:true,Windows_S_execution_verified:false,hosted_driver_or_private_parent_ready:false,owner_action_required:false,actual_hosted_requests:0,real_email_requests:0,private_packets_or_credentials_accessed:false,committed_mode_change_requests:0,artifact_regenerated_or_uploaded:false,hosted_acceptance:false,live_activation_approved:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],checkpoint,problem_code:problem,exit_code:ok?0:1,checked_UTC:new Date().toISOString()},null,2));process.exitCode=ok?0:1;
