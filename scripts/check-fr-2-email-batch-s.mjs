// Local preparation only. CLI accepts an existing browser path, never private inputs.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {LocalCDP,until,evaluate} from './lib/browser-local-cdp.mjs';
import {boundedBrowserFixture,actors} from './lib/browser-bounded-local-fixture.mjs';
import {boundedLocalGuard} from './lib/browser-bounded-local-guard.mjs';
export const stage='FR.2.4.E5.32_BATCH_S_LOCAL_QUARANTINE_BROWSER_TRANSITION_AND_FAILURE_CONTAINMENT';
const faults=[null,'BEGIN_RESPONSE_LOST','VERIFY_RESPONSE_LOST','ACTIVE_PROOF_DENIED','AFTER_OPEN','UNREVIEWED_REQUEST'];
export async function boundedBrowserPreparation(executable,{failure=null}={}){
 const r={stage_step:stage,batch:'S',result:'BATCH_S_LOCAL_BROWSER_REVIEW_REQUIRED',scope:'LOCAL_REAL_COMPONENTS_SYNTHETIC_AUTH_MAIL_AND_BOUNDED_BACKEND',checks:[],tests:0,pass:0,fail:0,browser_product:null,
 failure_exercise:failure,synthetic_email_attempts:0,synthetic_open_attempts:0,synthetic_quarantine_attempts:0,synthetic_final_quarantined:false,request_guard:null,
 actual_modules_loaded_and_hashed:false,incognito_contexts_disposed:false,disposed_context_cookies_absent:false,browser_process_stopped:false,temporary_profile_removed:false,local_fixture_closed:false,
 shared_components_executed:true,full_app_bootstrap_executed:false,local_certificate_validation_bypassed:true,hosted_TLS_verified:false,actual_hosted_requests:0,real_email_requests:0,private_packets_or_credentials_accessed:false,
 actual_SQL_or_real_session_cleanup_executed:false,committed_mode_change_requests:0,hosted_acceptance:false,live_activation_approved:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],checkpoint:'INPUT',problem_code:null,exit_code:1};
 let fixture,child,cdp,profile,guard,main=false,guardProblem=false;const contexts=[],tasks=new Set(),modules=new Map();
 const need=(v,c='LOCAL_BROWSER_CHECK_REQUIRED')=>{if(!v)throw Error(c);};
 const check=(name,v)=>{r.checkpoint=name;r.tests++;r.checks.push({check:name,status:v===true?'PASS':'FAIL'});if(v===true)r.pass++;else{r.fail++;throw Error('LOCAL_BROWSER_CHECK_REQUIRED');}};
 try{
  need(faults.includes(failure)&&typeof executable==='string'&&path.isAbsolute(executable)&&(await stat(executable)).isFile(),'LOCAL_INPUT_REQUIRED');
  fixture=await boundedBrowserFixture({failure:['BEGIN_RESPONSE_LOST','VERIFY_RESPONSE_LOST','ACTIVE_PROOF_DENIED'].includes(failure)?failure:null});guard=boundedLocalGuard(fixture.origin);
  profile=await mkdtemp(path.join(tmpdir(),'mushavo-browser-s-'));
  child=spawn(executable,[...(process.platform==='linux'?['--no-sandbox','--disable-setuid-sandbox']:[]),'--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--disable-default-apps','--disable-client-side-phishing-detection','--disable-domain-reliability','--disable-features=MediaRouter,OptimizationHints,AutofillServerCommunication','--no-proxy-server','--host-resolver-rules=MAP localhost 127.0.0.1, EXCLUDE 127.0.0.1, MAP * ~NOTFOUND','--ignore-certificate-errors','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
  let launchError=false;child.on('error',()=>{launchError=true;});r.checkpoint='ISOLATED_BROWSER_START';let endpoint;
  await until(async()=>{need(!launchError&&child.exitCode===null);try{const lines=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).trim().split(/\r?\n/);need(/^[1-9][0-9]{0,4}$/.test(lines[0])&&/^\/devtools\/browser\/[A-Za-z0-9-]+$/.test(lines[1]));endpoint='ws://127.0.0.1:'+lines[0]+lines[1];return true;}catch{return false;}},{timeout:20000});
  cdp=await LocalCDP.connect(endpoint);const version=await cdp.call('Browser.getVersion');need(/^(?:HeadlessChrome|Chrome|Edg)\/[0-9.]+$/.test(version.product));r.browser_product=version.product;
  const responses=new Map();
  cdp.socket.addEventListener('message',event=>{let e;try{e=JSON.parse(String(event.data));}catch{guardProblem=true;return;}
   if(!e.method)return;
   if(e.method==='Fetch.requestPaused'){
    const p=e.params,allowed=guard.allow({...p.request,resourceType:p.resourceType});
    if(!allowed)guardProblem=true;
    const task=cdp.call(allowed?'Fetch.continueRequest':'Fetch.failRequest',{requestId:p.requestId,...(!allowed?{errorReason:'BlockedByClient'}:{})},e.sessionId).catch(()=>{guardProblem=true;});tasks.add(task);task.finally(()=>tasks.delete(task));
   }
   if(e.method==='Network.responseReceived'){
    const p=e.params,base=fixture.origin;
    if([base+'/session-entry.js',base+'/email-verification.js?v=2'].includes(p.response.url))responses.set(e.sessionId+':'+p.requestId,{name:new URL(p.response.url).pathname.slice(1),valid:p.response.status===200&&/javascript/i.test(p.response.mimeType)});
   }
   if(e.method==='Network.loadingFinished'){
    const key=e.sessionId+':'+e.params.requestId,meta=responses.get(key);if(!meta)return;responses.delete(key);
    const task=cdp.call('Network.getResponseBody',{requestId:e.params.requestId},e.sessionId).then(x=>{const body=Buffer.from(x.body,x.base64Encoded?'base64':'utf8');need(meta.valid&&createHash('sha256').update(body).digest('hex')===createHash('sha256').update(fixture.sources[meta.name]).digest('hex'),'MODULE_BYTES_REQUIRED');modules.set(meta.name,true);}).catch(()=>{guardProblem=true;});tasks.add(task);task.finally(()=>tasks.delete(task));
   }
  });
  const context=async()=>{const x=await cdp.call('Target.createBrowserContext',{disposeOnDetach:true});contexts.push(x.browserContextId);return x.browserContextId;};
  const shared=await context(),isolated=await context();
  const ev=(s,x)=>evaluate(cdp,s,x),wait=(s,x)=>until(async()=>{need(!guardProblem,'LOCAL_REQUEST_GUARD_REQUIRED');try{return await ev(s,x);}catch{return false;}},{timeout:10000});
  const tab=async(alias,ctx=shared)=>{const t=await cdp.call('Target.createTarget',{url:'about:blank',browserContextId:ctx}),s=(await cdp.call('Target.attachToTarget',{targetId:t.targetId,flatten:true})).sessionId;
   await cdp.call('Network.enable',{},s);await cdp.call('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},s);await cdp.call('Page.enable',{},s);await cdp.call('Runtime.enable',{},s);
   await cdp.call('Page.navigate',{url:fixture.origin+'/fixture.html?actor='+alias},s);await wait(s,'window.ready===true');return s;
  };
  const cookie=async()=>{const all=(await cdp.call('Storage.getCookies',{browserContextId:shared})).cookies;return all.find(c=>c.name==='__Host-mushavo_device_'+actors.a1.user.replaceAll('-',''));};
  const a=await tab('a1');
  await until(()=>modules.size===2);r.actual_modules_loaded_and_hashed=true;
  check('PINNED_SHARED_MODULES_EXECUTED_IN_SECURE_LOCAL_DOM',await ev(a,'isSecureContext&&document.querySelector("h1").textContent==="Verify your sign-in"'));
  check('QUARANTINED_PASSWORD_ONLY_VIEW_LOCKED_NO_EMAIL',fixture.state.mail===0&&await ev(a,'!fixture.entry.authorized&&!document.querySelector("#private").textContent'));
  await ev(a,'document.querySelector("input[type=checkbox]").click();[...document.querySelectorAll("button")].find(b=>b.textContent==="Send email code").click()');
  await wait(a,'!fixture.entry.busy');
  if(failure==='BEGIN_RESPONSE_LOST')throw Error('EXPECTED_BEGIN_RESPONSE_LOST');
  check('ONE_EXPLICIT_REMEMBER_EMAIL_WHILE_QUARANTINED',fixture.state.mail===1&&fixture.state.mode==='QUARANTINED'&&await ev(a,'!document.querySelector("form").hidden'));
  await ev(a,'document.querySelector("input[autocomplete=one-time-code]").value='+JSON.stringify(fixture.state.code)+';document.querySelector("form").requestSubmit()');
  await wait(a,'!fixture.entry.busy');
  if(failure==='VERIFY_RESPONSE_LOST')throw Error('EXPECTED_VERIFY_RESPONSE_LOST');
  check('CODE_ACCEPTED_BUT_QUARANTINE_STILL_LOCKS_VIEW',fixture.state.proofs.size===1&&await ev(a,'!fixture.entry.authorized&&!document.querySelector("#private").textContent&&document.querySelector("input[autocomplete=one-time-code]").value===""'));
  const remembered=await cookie();
  check('AUTOMATIC_COOKIE_SECURE_HTTPONLY_STRICT_HOST_ONLY',!!remembered&&remembered.secure&&remembered.httpOnly&&remembered.sameSite==='Strict'&&remembered.domain==='localhost'&&remembered.path==='/'&&!remembered.session&&remembered.expires>Date.now()/1000&&remembered.expires<=Date.now()/1000+604801);
  check('HTTPONLY_COOKIE_NOT_EXPOSED_TO_DOCUMENT',await ev(a,'!document.cookie.includes("__Host-mushavo_device_")'));
  const restored=await tab('a2');
  check('RESTORE_CREATES_PROOF_WHILE_QUARANTINED_WITHOUT_UNLOCK_OR_RESEND',fixture.state.proofs.size===2&&fixture.state.mail===1&&await ev(restored,'!fixture.entry.authorized&&!document.querySelector("#private").textContent'));
  check('AUTOMATIC_RESTORE_PRESERVES_FIXED_COOKIE_EXPIRY',(await cookie())?.expires===remembered.expires);
  const fresh=await tab('a3',isolated),other=await tab('b1');
  await ev(other,'localStorage.setItem("emailVerified","true");sessionStorage.setItem("emailVerified","true");fixture.ensure()');
  check('FRESH_SESSION_AND_OTHER_ACCOUNT_KEEP_NO_PROOFS',fixture.state.proofs.size===2&&await ev(fresh,'!fixture.entry.authorized')&&await ev(other,'!fixture.entry.authorized'));
  r.checkpoint='SYNTHETIC_BOUNDED_OPEN';need(!guardProblem);fixture.open();
  if(failure==='AFTER_OPEN')throw Error('EXPECTED_AFTER_OPEN');
  for(const s of [a,restored,fresh,other])await ev(s,'fixture.ensure()');
  check('BOUNDED_MODE_UNLOCKS_ONLY_TWO_PROVED_SESSIONS',await ev(a,'fixture.entry.authorized&&!!document.querySelector("#private").textContent')&&await ev(restored,'fixture.entry.authorized')&&await ev(fresh,'!fixture.entry.authorized')&&await ev(other,'!fixture.entry.authorized'));
  for(const [i,s] of [a,restored,fresh,other].entries()){
   const http=await ev(s,'fixture.http()'),expected=i<2;
   check('ACTUAL_BROWSER_HTTP_SESSION_'+(i+1)+'_BOUNDARIES',http.gateway===expected&&http.rpc===expected&&http.own===expected&&http.foreignDenied===true);
  }
  await ev(a,'window.oldTicket=fixture.entry.ticket();fixture.switchActor('+JSON.stringify(actors.b1.user)+',"SYNTHETIC_b1")');
  check('ACCOUNT_CHANGE_SYNCHRONOUSLY_CLEARS_VIEW_AND_TICKET',await ev(a,'!oldTicket()&&!fixture.entry.authorized&&!document.querySelector("#private").textContent'));
  await ev(restored,'window.oldTicket=fixture.entry.ticket()');fixture.quarantine();
  for(const s of [a,restored,fresh,other])await ev(s,'fixture.ensure()');
  check('EXPLICIT_QUARANTINE_LOCKS_VIEWS_AND_OLD_TICKET',await ev(restored,'!oldTicket()&&!fixture.entry.authorized&&!document.querySelector("#private").textContent')&&await ev(a,'!fixture.entry.authorized'));
  const after=await ev(restored,'fixture.http()');check('POST_QUARANTINE_BROWSER_GATEWAY_RPC_AND_PROFILE_DENIED',!after.gateway&&!after.rpc&&!after.own&&after.foreignDenied);
  check('ONE_EMAIL_AND_ONE_VERIFY_NO_RETRY_DURING_MODE_TRANSITIONS',fixture.state.mail===1&&fixture.state.routeCounts['/api/email-verification/verify']===1&&guard.safe().begin===1&&guard.safe().verify===1);
  const storageSafe=await Promise.all([a,restored,fresh,other].map(s=>ev(s,'[localStorage,sessionStorage].every(store=>Object.keys(store).every(k=>k==="emailVerified"&&store.getItem(k)==="true"))')));
  check('NO_AUTH_TOKENS_CODES_OR_DEVICE_CREDENTIAL_IN_WEB_STORAGE',storageSafe.every(x=>x===true));
  check('NO_PRIVATE_RESPONSE_OR_CANARY_IN_CACHE_STORAGE',(await Promise.all([restored,fresh].map(s=>ev(s,'caches.keys().then(x=>x.length===0)')))).every(x=>x===true));
  if(failure==='UNREVIEWED_REQUEST'){await ev(restored,'fetch("/unreviewed",{cache:"no-store"}).catch(()=>false)');need(!guardProblem,'LOCAL_REQUEST_GUARD_REQUIRED');}
  await Promise.all([...tasks]);check('EXACT_REQUEST_GUARD_AND_FIXTURE_ROUTES',!guardProblem&&fixture.state.unexpected===0&&guard.safe().blocked===0);main=true;
 }catch(e){const codes=new Set(['LOCAL_INPUT_REQUIRED','LOCAL_BROWSER_CHECK_REQUIRED','LOCAL_REQUEST_GUARD_REQUIRED','MODULE_BYTES_REQUIRED','BROWSER_CHECK_TIMEOUT','CDP_COMMAND_REQUIRED','CDP_COMMAND_TIMEOUT','BROWSER_EVALUATION_REQUIRED','EXPECTED_BEGIN_RESPONSE_LOST','EXPECTED_VERIFY_RESPONSE_LOST','EXPECTED_AFTER_OPEN']);r.problem_code=codes.has(e?.message)?e.message:'LOCAL_BROWSER_PREPARATION_REQUIRED';}
 finally{
  if(fixture){if(fixture.state.mode!=='QUARANTINED')fixture.quarantine();r.synthetic_email_attempts=fixture.state.mail;r.synthetic_open_attempts=fixture.state.opens;r.synthetic_quarantine_attempts=fixture.state.closes;r.synthetic_final_quarantined=fixture.state.mode==='QUARANTINED';}
  if(guard)r.request_guard=guard.safe();
  if(cdp){
   try{await Promise.all([...tasks]);for(const id of contexts)await cdp.call('Target.disposeBrowserContext',{browserContextId:id});r.incognito_contexts_disposed=true;const remaining=await cdp.call('Target.getBrowserContexts');r.incognito_contexts_disposed=contexts.every(x=>!remaining.browserContextIds.includes(x));r.disposed_context_cookies_absent=(await cdp.call('Storage.getCookies')).cookies.length===0;}catch{}
   try{await cdp.call('Browser.close',{},undefined,3000);}catch{}cdp.close();
  }
  if(child){if(child.exitCode===null&&!child.killed)child.kill();try{await until(()=>child.exitCode!==null||child.signalCode!==null,{timeout:5000});r.browser_process_stopped=true;}catch{}}
  if(fixture){try{await fixture.close();r.local_fixture_closed=true;}catch{}}
  if(profile){try{await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});r.temporary_profile_removed=true;}catch{}}
 }
 const cleaned=r.synthetic_final_quarantined&&r.incognito_contexts_disposed&&r.disposed_context_cookies_absent&&r.browser_process_stopped&&r.temporary_profile_removed&&r.local_fixture_closed;
 if(main&&cleaned&&!guardProblem&&r.request_guard?.blocked===0){r.result='BATCH_S_LOCAL_BOUNDED_BROWSER_TRANSITIONS_SCOPED_PASS';r.checkpoint='COMPLETE';r.exit_code=0;}
 else r.problem_code??=guardProblem?'LOCAL_REQUEST_GUARD_REQUIRED':'LOCAL_BROWSER_CLEANUP_REQUIRED';
 r.checked_UTC=new Date().toISOString();return r;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const r=await boundedBrowserPreparation(process.argv.length===3?process.argv[2]:null);console.log(JSON.stringify(r,null,2));process.exitCode=r.exit_code;}
