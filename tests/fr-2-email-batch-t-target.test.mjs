import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import {LocalCDP,until,evaluate} from '../scripts/lib/browser-local-cdp.mjs';
import {localTLS} from '../scripts/lib/browser-local-tls.mjs';
import {guardStagingPageWorkers,navigationProblem} from '../scripts/lib/browser-staging-target.mjs';
import {workerAutoAttach} from '../scripts/lib/browser-public-target.mjs';
import {stagingIntegrationFixture} from '../scripts/lib/browser-staging-integration-fixture.mjs';
import {startLoopbackStagingBrowser} from '../scripts/lib/browser-staging-acceptance.mjs';
import {controlledProbe} from '../scripts/check-fr-2-email-batch-t.mjs';
import {safeLocalDiagnostic} from '../scripts/lib/email-batch-t-diagnostic-shape.mjs';

test('Worker auto-attachment is installed on the selected page session, never the browser root, with worker startup paused',async()=>{
 const calls=[];await guardStagingPageWorkers({call:async(...args)=>calls.push(args)},'SYNTHETIC_PAGE_SESSION');
 assert.deepEqual(calls,[['Target.setAutoAttach',workerAutoAttach,'SYNTHETIC_PAGE_SESSION']]);assert.equal(workerAutoAttach.waitForDebuggerOnStart,true);
 await assert.rejects(guardStagingPageWorkers({call:async()=>assert.fail('ROOT_ATTACH_FORBIDDEN')},undefined),{message:'BROWSER_INPUT_REQUIRED'});
});
test('Navigation preserves a known guard cause and labels only certificate/SSL errors as TLS failures without exposing raw text',()=>{
 assert.equal(navigationProblem('net::ERR_BLOCKED_BY_CLIENT','BROWSER_UNREVIEWED_WORKER'),'BROWSER_UNREVIEWED_WORKER');
 assert.equal(navigationProblem('net::ERR_BLOCKED_BY_CLIENT','BROWSER_REQUEST_GUARD_REQUIRED'),'BROWSER_REQUEST_GUARD_REQUIRED');
 for(const value of ['net::ERR_CERT_AUTHORITY_INVALID','net::ERR_SSL_PROTOCOL_ERROR'])assert.equal(navigationProblem(value,null),'BROWSER_TLS_REQUIRED');
 for(const value of ['net::ERR_CONNECTION_REFUSED','net::ERR_BLOCKED_BY_CLIENT','PRIVATE_URL_OR_ERROR'])assert.equal(navigationProblem(value,null),'BROWSER_NAVIGATION_REQUIRED');
 assert.equal(navigationProblem(undefined,null),null);assert.equal(navigationProblem('',null),null);assert.equal(navigationProblem(undefined,'PRIVATE_SENTINEL'),'BROWSER_REQUIRED');
});

for(const variant of ['outside-service-worker','selected-page-worker'])test('Actual browser target boundary: '+variant,{timeout:90000},async(t)=>{
 const executable=process.env.MUSHAVO_EMAIL_BROWSER_EXE,dependency=process.env.MUSHAVO_EMAIL_UI_PGLITE;assert(executable&&dependency);
 const original=LocalCDP.connect;let service,fixture,driver,injected=false;
 try{
  if(variant==='outside-service-worker'){
   service=https.createServer(localTLS(),(req,res)=>{assert(['/','/worker.js','/favicon.ico'].includes(req.url));res.setHeader('content-type',req.url==='/worker.js'?'text/javascript':'text/html');res.end(req.url==='/worker.js'?"self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));":'<h1>Synthetic outside-context worker</h1>');});
   await new Promise((resolve,reject)=>{service.once('error',reject);service.listen(0,'127.0.0.1',resolve);});
  }
  LocalCDP.connect=async(...args)=>{
   const cdp=await original.apply(LocalCDP,args);
   if(variant==='outside-service-worker'){
    const target=await cdp.call('Target.createTarget',{url:'https://localhost:'+service.address().port});const session=(await cdp.call('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
    await cdp.call('Runtime.enable',{},session);await until(async()=>{try{return await evaluate(cdp,session,'document.querySelector("h1")?.textContent==="Synthetic outside-context worker"');}catch{return false;}});
    await evaluate(cdp,session,'navigator.serviceWorker.register("/worker.js").then(()=>navigator.serviceWorker.ready).then(()=>true)');
    await until(async()=>(await cdp.call('Target.getTargets')).targetInfos.some(x=>x.type==='service_worker'));injected=true;
   }else{
    const originalCall=cdp.call.bind(cdp);cdp.call=async(method,params,session,...rest)=>{
     const value=await originalCall(method,params,session,...rest);
     if(!injected&&method==='Emulation.setScriptExecutionDisabled'&&params.value===false){
      injected=true;await originalCall('Runtime.evaluate',{expression:'globalThis.__selectedWorker=new Worker(URL.createObjectURL(new Blob(["onmessage=()=>{}"],{type:"text/javascript"})));true',returnByValue:true},session);
      await until(async()=>(await originalCall('Target.getTargets')).targetInfos.some(x=>x.type==='worker'));
     }
     return value;
    };
   }
   return cdp;
  };
  fixture=await stagingIntegrationFixture(dependency);fixture.input.browserExecutable=executable;
  const r=await controlledProbe(fixture.input,{transport:fixture.transport,readCode:fixture.readCode,createBrowser:(exe,options)=>driver=startLoopbackStagingBrowser(exe,{...options,origin:fixture.origin,api:fixture.api})});
  const diagnostic=safeLocalDiagnostic(r,driver.diagnostics());t.diagnostic('BATCH_T_TARGET_SCOPE '+JSON.stringify({variant,injected,...diagnostic}));
  assert.equal(injected,true);assert.equal(r.browser.cleanup_verified,true);assert.equal(fixture.state.unreviewed,0);
  const state=await fixture.inspect();assert.equal(state.mode,'QUARANTINED');assert.equal(state.windows,0);assert.equal(state.sessions,1);assert.equal(state.devices,1);assert.equal(state.proofs,1);assert.equal(state.challenges,0);assert.equal(state.priorSession,1);assert.equal(state.priorDevice,1);
  if(variant==='outside-service-worker'){assert.equal(r.exit_code,0,JSON.stringify(diagnostic));assert.equal(r.email_request_attempts,1);assert.equal(diagnostic.error_code,null);}
  else{assert.equal(r.exit_code,1);assert.equal(r.browser.problem_code,'BROWSER_UNREVIEWED_WORKER');assert.equal(diagnostic.error_code,'BROWSER_UNREVIEWED_WORKER');assert.equal(r.email_request_attempts,0);assert.equal(r.bounded_open_write_attempts,0);}
 }finally{
  LocalCDP.connect=original;if(driver)await driver.close();if(fixture)await fixture.close();if(service){service.closeAllConnections();await new Promise(resolve=>service.close(resolve));}
 }
});
