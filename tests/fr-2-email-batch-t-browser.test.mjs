import test from 'node:test';
import assert from 'node:assert/strict';
import {stagingIntegrationFixture} from '../scripts/lib/browser-staging-integration-fixture.mjs';
import {startLoopbackStagingBrowser} from '../scripts/lib/browser-staging-acceptance.mjs';
import {safeLocalDiagnostic} from '../scripts/lib/email-batch-t-diagnostic-shape.mjs';
import {controlledProbe} from '../scripts/check-fr-2-email-batch-t.mjs';
const executable=process.env.MUSHAVO_EMAIL_BROWSER_EXE,modulePath=process.env.MUSHAVO_EMAIL_UI_PGLITE;
for(const loss of [null,'begin','verify','open','close','device','active-proof'])test('Actual local browser + gateway + installed SQL end-to-end: '+(loss||'positive'),{timeout:90000},async(t)=>{
 assert(executable&&modulePath,'EXISTING_LOCAL_BROWSER_AND_PGLITE_REQUIRED');
 const f=await stagingIntegrationFixture(modulePath,{loss});
 try{
  f.input.browserExecutable=executable;
  let driver;const r=await controlledProbe(f.input,{transport:f.transport,readCode:f.readCode,createBrowser:(exe,options)=>driver=startLoopbackStagingBrowser(exe,{...options,origin:f.origin,api:f.api})});
  t.diagnostic('BATCH_T_LOCAL_DIAGNOSTIC '+JSON.stringify({case:loss||'positive',...safeLocalDiagnostic(r,driver?.diagnostics())}));
  assert.equal(r.exit_code,[null,'close'].includes(loss)?0:1,JSON.stringify(r));assert.equal(r.email_request_attempts,1);assert.equal(f.state.mail,1);assert.equal(f.state.unreviewed,0);assert.equal(r.browser.cleanup_verified,true);if(!loss||loss==='close'){assert.equal(r.browser.credential_not_document_readable,true);assert.equal(r.browser.same_account_session_change_clears_view_and_ticket,true);}assert(r.actual_hosted_requests<=32);assert(r.bounded_open_write_attempts<=1);assert(r.quarantine_write_attempts<=1);assert(r.browser.request_guard.attempts<=160);assert.equal(r.selected_sessions_proofs_and_challenges_absent,true);assert.equal(r.selected_generated_device_absent,true);
  if(['open','close','device','active-proof',null].includes(loss)){assert.equal(r.quarantine_write_attempts,1);assert.equal(r.explicit_quarantine_and_stale_open_fence_verified,true);}
  if(loss==='begin'){assert.equal(r.email_dispatch_outcome_uncertain,true);assert.equal(r.bounded_open_write_attempts,0);}
  if(loss==='verify'){assert.equal(r.verification_outcome_uncertain,true);assert.equal(r.bounded_open_write_attempts,0);}
  if(loss==='close'){assert.equal(r.quarantine_response_problem_code,'NETWORK_REQUIRED');assert.equal(r.quarantine_write_outcome_uncertain,false);}
  if(loss==='device')assert.equal(r.device_cleanup_write_outcome_uncertain,false);
  const inspection=await f.inspect();assert.deepEqual({...inspection,fenceChanged:undefined},{sessions:1,devices:1,proofs:1,challenges:0,mode:'QUARANTINED',windows:0,sendEvents:1,priorSession:1,priorDevice:1,fenceChanged:undefined});
  assert.equal(inspection.fenceChanged,!['begin','verify'].includes(loss));
  const text=JSON.stringify(r);for(const privateValue of [f.input.managementToken,...f.input.accounts.flatMap(a=>[a.email,a.password]),...f.actors.flatMap(a=>[a.user,a.session]),...f.tokens,f.state.code,'SYNTHETIC_ZOHO_ACCESS','sb_secret_SYNTHETIC'])assert(!text.includes(privateValue));
 }finally{await f.close();}
});
