// Local engine candidate only. No staging credentials, hosted mode changes or real provider calls.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {LocalCDP,until,evaluate} from './lib/browser-local-cdp.mjs';
import {safeRouteAudit} from './lib/browser-route-audit.mjs';
import {browserFixture,actors} from './lib/browser-email-fixture.mjs';
export const stage='FR.2.4.E5.27_BATCH_N_LOCAL_BROWSER_COOKIE_DOM_AND_SERVICE_WORKER';
export async function browserAcceptance(executable){
 const r={stage_step:stage,batch:'N',result:'LOCAL_BROWSER_BATCH_N_REVIEW_REQUIRED',scope:'ACTUAL_SHARED_COMPONENTS_GATEWAY_AND_SW_LOCAL_HTTPS_SYNTHETIC_BACKEND',tests:0,pass:0,fail:0,checks:[],browser_product:null,route_audit:null,
 isolated_temporary_profile:true,temporary_profile_removed:false,browser_process_stopped:false,loopback_fixture_closed:false,
 actual_browser_engine_executed:false,ephemeral_test_certificate_in_memory:true,local_certificate_validation_bypassed:true,
 real_Auth_database_and_mail_exercised:false,full_app_or_business_pages_bootstrapped:false,hosted_TLS_or_CSRF_acceptance:false,
 installed_PWA_OS_lifecycle_or_native_acceptance:false,external_traffic_OS_sandboxed:false,
 actual_hosted_requests_by_harness:0,real_email_requests:0,private_packets_accessed:false,committed_mode_change_requests:0,hosted_acceptance:false,live_activation_approved:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],checkpoint:'LOCAL_BROWSER_INPUT',problem_code:null,exit_code:1};
 let fixture,child,cdp,profile,main=false;
 const need=v=>{if(!v)throw Error('LOCAL_BROWSER_CHECK_REQUIRED');};
 const check=(name,v)=>{r.checkpoint=name;r.tests++;const ok=v===true;r.checks.push({check:name,status:ok?'PASS':'FAIL'});if(ok)r.pass++;else{r.fail++;throw Error('LOCAL_BROWSER_CHECK_REQUIRED');}};
 try{
  need(typeof executable==='string'&&path.isAbsolute(executable)&&(await stat(executable)).isFile());
  fixture=await browserFixture();profile=await mkdtemp(path.join(tmpdir(),'mushavo-browser-n-'));
  child=spawn(executable,[...(process.platform==='linux'?['--no-sandbox','--disable-setuid-sandbox']:[]),'--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--disable-default-apps','--disable-client-side-phishing-detection','--disable-domain-reliability','--disable-features=MediaRouter,OptimizationHints,AutofillServerCommunication','--no-proxy-server','--host-resolver-rules=MAP localhost 127.0.0.1, EXCLUDE 127.0.0.1, MAP * ~NOTFOUND','--ignore-certificate-errors','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
  let launchError=false;child.on('error',()=>{launchError=true;});
  r.checkpoint='ISOLATED_BROWSER_START';let endpoint;
  await until(async()=>{need(!launchError&&child.exitCode===null);try{const lines=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).trim().split(/\r?\n/);need(/^[1-9][0-9]{0,4}$/.test(lines[0])&&/^\/devtools\/browser\/[A-Za-z0-9-]+$/.test(lines[1]));endpoint='ws://127.0.0.1:'+lines[0]+lines[1];return true;}catch{return false;}},{timeout:20000});
  cdp=await LocalCDP.connect(endpoint);const version=await cdp.call('Browser.getVersion');need(typeof version.product==='string'&&/^(?:HeadlessChrome|Chrome|Edg)\/[0-9.]+$/.test(version.product));r.browser_product=version.product;r.actual_browser_engine_executed=true;
  const tab=async(url)=>{const t=await cdp.call('Target.createTarget',{url:'about:blank'}),a=await cdp.call('Target.attachToTarget',{targetId:t.targetId,flatten:true});const s=a.sessionId;await cdp.call('Page.enable',{},s);await cdp.call('Runtime.enable',{},s);await cdp.call('Page.navigate',{url},s);await until(async()=>{try{return await evaluate(cdp,s,'window.ready===true');}catch{return false;}});return s;};
  const ev=(s,code)=>evaluate(cdp,s,code),wait=(s,code)=>until(async()=>{try{return await ev(s,code);}catch{return false;}});
  const cookies=async()=>(await cdp.call('Storage.getCookies')).cookies;
  const name=user=>'__Host-mushavo_device_'+user.replaceAll('-','');
  const s=await tab(fixture.origin+'/fixture.html?actor=a1');
  check('LOCAL_SECURE_CONTEXT_AND_REAL_DOM',await ev(s,'isSecureContext&&document.querySelector("#gate h1").textContent==="Verify your sign-in"'));
  check('NO_AUTOMATIC_EMAIL_AND_PASSWORD_ONLY_LOCKED',fixture.state.mail===0&&await ev(s,'!fixture.entry.authorized&&fixture.loaded===null'));
  await ev(s,'document.querySelector("input[type=checkbox]").click();[...document.querySelectorAll("button")].find(x=>x.textContent==="Send email code").click()');
  await wait(s,'!document.querySelector("form").hidden');
  check('EXPLICIT_REMEMBER_CHOICE_BOUND',fixture.state.mail===1&&[...fixture.state.challenges.values()][0].p_remember===true);
  await ev(s,'document.querySelector("input[autocomplete=one-time-code]").value="12";document.querySelector("form").requestSubmit()');await delay(100);
  check('NATIVE_PATTERN_BLOCKS_MALFORMED_CODE',!fixture.state.routeCounts['/api/email-verification/verify']);
  await ev(s,'document.querySelector("input[autocomplete=one-time-code]").value='+JSON.stringify(fixture.state.code)+';document.querySelector("form").requestSubmit()');
  await wait(s,'fixture.entry.authorized');
  check('REAL_DOM_CODE_SUBMISSION_UNLOCKS_AND_CLEARS_INPUT',await ev(s,'fixture.loaded==="SYNTHETIC_PRIVATE_CANARY"&&document.querySelector("input[autocomplete=one-time-code]").value===""'));
  let cookie=(await cookies()).find(x=>x.name===name(actors.a1.user));
  check('SECURE_HTTPONLY_STRICT_HOST_ONLY_COOKIE',!!cookie&&cookie.secure&&cookie.httpOnly&&cookie.sameSite==='Strict'&&cookie.domain==='localhost'&&cookie.path==='/'&&!cookie.session&&cookie.expires>Date.now()/1000&&cookie.expires<=Date.now()/1000+604801);
  check('REMEMBER_CREDENTIAL_NOT_READABLE_BY_DOCUMENT_COOKIE',await ev(s,'!document.cookie.includes("__Host-mushavo_device_")'));
  const expiry=cookie.expires,s2=await tab(fixture.origin+'/fixture.html?actor=a2');
  check('NEW_SAME_ACCOUNT_SESSION_RESTORES_WITHOUT_MAIL',fixture.state.mail===1&&await ev(s2,'fixture.entry.authorized&&fixture.loaded==="SYNTHETIC_PRIVATE_CANARY"'));
  cookie=(await cookies()).find(x=>x.name===name(actors.a1.user));check('RESTORE_DOES_NOT_EXTEND_COOKIE_DEADLINE',cookie?.expires===expiry);
  const b=await tab(fixture.origin+'/fixture.html?actor=b1');
  await ev(b,'localStorage.setItem("emailVerified","true");sessionStorage.setItem("emailVerified","true");fixture.ensure()');
  check('OTHER_ACCOUNT_AND_FORGED_BROWSER_FLAGS_STAY_LOCKED',fixture.state.mail===1&&await ev(b,'!fixture.entry.authorized&&fixture.loaded===null'));
  fixture.state.suppressProof=true;const forged=await tab(fixture.origin+'/fixture.html?actor=a3');
  check('GATEWAY_RESTORE_WITH_FALSE_RPC_CANNOT_UNLOCK',await ev(forged,'!fixture.entry.authorized&&fixture.loaded===null'));
  fixture.state.suppressProof=false;
  const admin=await tab(fixture.origin+'/fixture.html?actor=a1&admin=1');
  check('ORDINARY_PROVED_ACCOUNT_STILL_DENIED_ADMIN',await ev(admin,'!fixture.entry.authorized&&fixture.loaded===null&&document.querySelector("[role=status]").textContent.includes("does not have Admin access")'));
  await ev(s,'window.oldTicket=fixture.entry.ticket();fixture.switchActor('+JSON.stringify(actors.b1.user)+',"SYNTHETIC_b1")');
  check('ACTOR_CHANGE_SYNCHRONOUSLY_CLEARS_VIEW_AND_TICKET',await ev(s,'!oldTicket()&&!fixture.entry.authorized&&fixture.loaded===null&&document.querySelector("#private").textContent===""'));
  const peer=await tab(fixture.origin+'/fixture.html?actor=a1');await ev(s2,'window.oldTicket=fixture.entry.ticket()');await ev(peer,'window.oldTicket=fixture.entry.ticket()');const reads=fixture.state.rpcCalls;
  await ev(peer,'fixture.events.publish(fixture.session.user.id)');await wait(s2,'!fixture.entry.authorized');
  check('REAL_BROADCAST_CHANNEL_INVALIDATES_PEER_DOM_WITHOUT_UNLOCK_OR_FETCH',await ev(s2,'!oldTicket()&&fixture.loaded===null')&&await ev(peer,'!oldTicket()&&fixture.loaded===null')&&fixture.state.rpcCalls===reads);
  check('REAL_DOM_SNAPSHOT_REMOVES_PRIVATE_NODES_PRESERVES_LISTENERS',await ev(s2,`(()=>{const root=document.querySelector('#snapshot'),input=document.querySelector('#original');let count=0;input.addEventListener('click',()=>count++);const restore=fixture.snapshotPrivateView(root);input.value='SYNTHETIC_PRIVATE_CANARY';root.append(document.createTextNode('SYNTHETIC_PRIVATE_CANARY'));restore();input.click();return root.children.length===1&&root.firstElementChild===input&&input.value===''&&!root.textContent.includes('SYNTHETIC_PRIVATE_CANARY')&&count===1;})()`));
  r.checkpoint='CROSS_SITE_COOKIE_POST';
  const cross=await cdp.call('Target.createTarget',{url:'about:blank'}),crossSession=(await cdp.call('Target.attachToTarget',{targetId:cross.targetId,flatten:true})).sessionId;
  await cdp.call('Page.enable',{},crossSession);await cdp.call('Runtime.enable',{},crossSession);
  await cdp.call('Page.navigate',{url:fixture.origin.replace('localhost','127.0.0.1')+'/cross-site.html'},crossSession);await wait(crossSession,'!!document.querySelector("form")');r.checkpoint='CROSS_SITE_POST_RESPONSE';await ev(crossSession,'setTimeout(()=>document.querySelector("form").submit(),0);true');await until(()=>fixture.state.probeCookie!==null);
  check('SAMESITE_STRICT_COOKIE_WITHHELD_ON_CROSS_SITE_POST',fixture.state.probeCookie===false);
  await ev(b,'[...document.querySelectorAll("button")].find(x=>x.textContent==="Send email code").click()');await wait(b,'!document.querySelector("form").hidden');
  await ev(b,'document.querySelector("input[autocomplete=one-time-code]").value='+JSON.stringify(fixture.state.code)+';document.querySelector("form").requestSubmit()');await wait(b,'fixture.entry.authorized');
  check('NONREMEMBER_CODE_CREATES_NO_PERSISTENT_ACCOUNT_COOKIE',fixture.state.mail===2&&!(await cookies()).some(x=>x.name===name(actors.b1.user)));
  await ev(s2,'caches.open("mushavo-budget-synthetic-stale-n").then(c=>c.put("/old-private",new Response("SYNTHETIC_PRIVATE_CANARY")))');
  await ev(s2,'navigator.serviceWorker.register("/sw.js").then(()=>navigator.serviceWorker.ready)');await wait(s2,'!!navigator.serviceWorker.controller');
  check('ACTUAL_SW_ACTIVATION_REMOVES_OLD_PRODUCT_CACHE',await ev(s2,'caches.keys().then(x=>!x.includes("mushavo-budget-synthetic-stale-n"))'));
  await ev(s2,'Promise.all(["/auth/private","/rest/private","/storage/private","/functions/private"].map(x=>fetch(x,{cache:"no-store"}).then(r=>r.text())))');
  check('ACTUAL_SW_DOES_NOT_CACHE_API_OR_PRIVATE_RESPONSES',await ev(s2,'(async()=>{for(const key of await caches.keys())for(const r of await(await caches.open(key)).keys())if(/\\/(?:api|rpc|auth|rest|storage|functions)\\//.test(new URL(r.url).pathname))return false;return true;})()'));
  fixture.state.offline=true;await cdp.call('Page.navigate',{url:fixture.origin+'/app.html?offline_n=1'},s2);await wait(s2,'document.body?.textContent.includes("No financial data has been stored")');
  check('ACTUAL_SW_NAVIGATION_OUTAGE_SHOWS_SAFE_OFFLINE_PAGE',await ev(s2,'!document.body.textContent.includes("SYNTHETIC_PRIVATE_CANARY")&&document.body.textContent.includes("Reconnect")'));
  main=true;
 }catch(error){const known=new Set(['LOCAL_BROWSER_CHECK_REQUIRED','CDP_COMMAND_REQUIRED','CDP_COMMAND_TIMEOUT','CDP_CONNECTION_REQUIRED','BROWSER_EVALUATION_REQUIRED','BROWSER_CHECK_TIMEOUT']);r.problem_code=known.has(error?.message)?error.message:'LOCAL_BROWSER_OR_CHECK_REVIEW_REQUIRED';}
 finally{
  if(cdp){try{await cdp.call('Browser.close',{},undefined,3000);}catch{}cdp.close();}
  if(child){if(child.exitCode===null&&!child.killed)child.kill();try{await until(()=>child.exitCode!==null||child.signalCode!==null,{timeout:5000});r.browser_process_stopped=true;}catch{}}
  if(fixture){try{await fixture.close();r.loopback_fixture_closed=true;}catch{}}
  if(fixture)r.route_audit=safeRouteAudit(fixture.state);
  if(profile){try{await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});r.temporary_profile_removed=true;}catch{}}
 }
 if(main){try{check('LOCAL_FIXTURE_NO_UNREVIEWED_ROUTE',r.route_audit?.unexpected_request_count===0);}catch{r.problem_code='LOCAL_BROWSER_UNREVIEWED_ROUTE_REQUIRED';main=false;}}
 if(main&&r.browser_process_stopped&&r.loopback_fixture_closed&&r.temporary_profile_removed){r.result='LOCAL_BROWSER_BATCH_N_SYNTHETIC_COOKIE_DOM_AND_SW_SCOPED_PASS';r.checkpoint='COMPLETE';r.exit_code=0;}else r.problem_code??='LOCAL_BROWSER_CLEANUP_REQUIRED';
 r.checked_UTC=new Date().toISOString();return r;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const r=await browserAcceptance(process.argv.length===3?process.argv[2]:null);console.log(JSON.stringify(r,null,2));process.exitCode=r.exit_code;
}
