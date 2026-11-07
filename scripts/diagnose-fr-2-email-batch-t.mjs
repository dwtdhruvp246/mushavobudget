// One positive local reproduction only. This entry point never invokes the private owner runner.
import assert from 'node:assert/strict';
import {readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {diagnosticError,safeLocalDiagnostic} from './lib/email-batch-t-diagnostic-shape.mjs';
createRequire(import.meta.url)('./offline-test-network.cjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const stage='FR.2.4.E5.33_BATCH_T_HOSTED_SHARED_BROWSER_PROOF_COOKIE_AND_BOUNDED_RECOVERY';
let checkpoint='SOURCE_HASHES',hashes=0,syntax=0,problem=null,fixture,driver,result,detail=null,fixtureClosed=false,seedPreserved=false,fixtureCleanupProblem=false;
try{
 assert.equal(process.argv.length,4);const [executable,dependency]=process.argv.slice(2);assert(path.isAbsolute(executable)&&path.isAbsolute(dependency));
 const manifest=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-batch-t-source-manifest.json'),'utf8'));assert.equal(manifest.stage_step,stage);assert.equal(Object.keys(manifest.file_sha256).length,manifest.source_file_count);
 for(const [f,h] of Object.entries(manifest.file_sha256)){
  assert(/^[A-Za-z0-9_./-]+$/.test(f)&&!f.includes('..')&&!path.isAbsolute(f));for(let p=path.join(root,f);;){assert(!(await lstat(p)).isSymbolicLink());const parent=path.dirname(p);if(parent===p)break;p=parent;}
  assert.equal(createHash('sha256').update(await readFile(path.join(root,f))).digest('hex'),h);hashes++;
 }
 checkpoint='SYNTAX';for(const f of manifest.syntax_paths){assert.equal(spawnSync(process.execPath,['--check',path.join(root,f)],{encoding:'utf8',timeout:30000}).status,0);syntax++;}
 checkpoint='RETAINED_PUBLIC_DEPENDENCY';const meta=JSON.parse(await readFile(path.resolve(path.dirname(dependency),'../package.json'),'utf8'));assert.equal(meta.name,'@electric-sql/pglite');assert.equal(meta.version,'0.5.8');
 checkpoint='LOCAL_DATABASE_FIXTURE_CREATE';
 const {stagingIntegrationFixture}=await import('./lib/browser-staging-integration-fixture.mjs');
 const {startLoopbackStagingBrowser}=await import('./lib/browser-staging-acceptance.mjs');
 const {controlledProbe}=await import('./check-fr-2-email-batch-t.mjs');
 fixture=await stagingIntegrationFixture(dependency);fixture.input.browserExecutable=executable;
 checkpoint='ONE_LOCAL_BROWSER_REPRODUCTION';
 result=await controlledProbe(fixture.input,{transport:fixture.transport,readCode:fixture.readCode,createBrowser:(exe,options)=>driver=startLoopbackStagingBrowser(exe,{...options,origin:fixture.origin,api:fixture.api})});
 detail=safeLocalDiagnostic(result,driver?.diagnostics());
 const state=await fixture.inspect();seedPreserved=state.sessions===1&&state.devices===1&&state.proofs===1&&state.challenges===0&&state.mode==='QUARANTINED'&&state.windows===0&&state.priorSession===1&&state.priorDevice===1;
 if(result.exit_code!==0||!detail.browser_cleanup_verified||!seedPreserved)problem='LOCAL_BROWSER_REPRODUCTION_REVIEW_REQUIRED';
 checkpoint=problem?'ONE_LOCAL_BROWSER_REPRODUCTION':'COMPLETE';
}catch(e){problem=diagnosticError(e);}
finally{
 if(driver){try{const browser=await driver.close();detail=safeLocalDiagnostic({...result,browser},driver.diagnostics());}catch{fixtureCleanupProblem=true;}}
 if(fixture){try{await fixture.close();fixtureClosed=true;}catch{fixtureCleanupProblem=true;}}
 if(fixtureCleanupProblem)problem='LOCAL_FIXTURE_CLEANUP_REQUIRED';
}
const ok=checkpoint==='COMPLETE'&&!problem;
console.log(JSON.stringify({stage_step:stage,batch:'T',result:ok?'BATCH_T_FOCUSED_OFFLINE_REPRODUCTION_PASS':'BATCH_T_FOCUSED_OFFLINE_DIAGNOSTIC_REVIEW_REQUIRED',scope:'ONE_LOCAL_BROWSER_WITH_SYNTHETIC_AUTH_MANAGEMENT_ZOHO_AND_IN_MEMORY_SQL',node_version:process.version,platform:process.platform,source_hashes_verified:hashes,syntax_checks:syntax,diagnostic:detail,local_fixture_closed:fixtureClosed,preexisting_synthetic_seed_preserved:seedPreserved,raw_error_or_provider_details_printed:false,private_packets_or_credentials_accessed:false,actual_hosted_requests:0,real_email_requests:0,committed_mode_change_requests:0,hosted_normal_trust_TLS_exercised:false,hosted_acceptance:false,live_activation_approved:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],checkpoint,problem_code:problem,exit_code:ok?0:1,checked_UTC:new Date().toISOString()},null,2));process.exitCode=ok?0:1;
