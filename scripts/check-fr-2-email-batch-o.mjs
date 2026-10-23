// Public staging only: no Auth, gateway, private packets, credentials or mode changes.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {LocalCDP,until} from './lib/browser-local-cdp.mjs';
import {tlsObservation,browserTransportVerified} from './lib/browser-tls-observation.mjs';
import {configurePublicTarget,workerAutoAttach} from './lib/browser-public-target.mjs';
export const stage='FR.2.4.E5.28_BATCH_O_HOSTED_PUBLIC_BROWSER_TLS_AND_SERVICE_WORKER';
export const stagingOrigin='https://mushavo-budget-staging.pages.dev';
export const assets=['offline.html','app-entry.html','sw.js','manifest.webmanifest','workspace-preference.js','app-entry.js','pwa-shell.css','pwa-update.css','pwa-install.css','pwa-install.js','pwa.js','assets/mushavo-budget-logo.png','assets/pwa-icon-192.png','assets/pwa-icon-512.png','assets/pwa-icon-maskable-512.png','assets/apple-touch-icon.png'];
const queries=new Set(['','?v=1','?v=2','?v=3','?v=5','?v=76','?v=80']);
export function publicRequestAllowed(url,method,{origin=stagingOrigin,offline=false}={}){
 try{const u=new URL(url);if(method!=='GET'||u.origin!==origin||u.username||u.password||u.hash)return false;
 if(offline&&u.pathname==='/app.html'&&u.search==='?batch_o=offline')return true;
 return queries.has(u.search)&&(assets.some(x=>u.pathname==='/'+x)||['/offline','/app-entry'].includes(u.pathname));
 }catch{return false;}
}
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function publicBrowser(executable,{fixtureOrigin=null,tlsDiagnostic=false}={}){
 const fixture=fixtureOrigin!==null;
 if(fixture&&!/^https:\/\/localhost:[1-9][0-9]{0,4}$/.test(fixtureOrigin))throw Error('LOOPBACK_FIXTURE_REQUIRED');
 const origin=fixture?fixtureOrigin:stagingOrigin;
 const r={stage_step:stage,batch:'O',result:'BATCH_O_PUBLIC_BROWSER_REVIEW_REQUIRED',scope:fixture?'LOCAL_HTTPS_PUBLIC_SOURCE_FIXTURE':'HOSTED_PUBLIC_SOURCE_TLS_AND_BROWSER_SERVICE_WORKER',
 tls_metadata:null,tls_metadata_only:tlsDiagnostic,target_setup_failure:null,explicit_page_attachment:true,checks:[],tests:0,pass:0,fail:0,browser_product:null,public_assets_verified:0,intercepted_request_attempts:0,maximum_intercepted_requests:128,blocked_unreviewed_requests:0,simulated_offline_requests:0,
 intercepted_hosted_request_attempts:0,worker_startup_fetches_not_intercepted:true,total_browser_hosted_requests_independently_counted:false,document_scripts_disabled:true,hosted_TLS_verified:false,hosted_secure_transport_verified:false,executed_worker_source_verified:false,isolated_temporary_profile:true,temporary_profile_removed:false,browser_process_stopped:false,
 private_packets_accessed:false,credentials_or_Auth_or_gateway_requests_permitted:false,real_email_requests:0,committed_mode_change_requests:0,hosted_authenticated_browser_acceptance:false,
 installed_PWA_OS_lifecycle_verified:false,external_traffic_OS_sandboxed:false,local_certificate_validation_bypassed:fixture,hosted_acceptance:false,live_activation_approved:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],checkpoint:'BROWSER_INPUT',problem_code:null,exit_code:1};
 let child,profile,cdp,offline=false,fatal=null,workerHash=false,main=false;
 const sessions=new Map(),tasks=new Set(),tls=tlsObservation(origin);let pageSession=null;
 const need=(v,code='PUBLIC_BROWSER_CHECK_REQUIRED')=>{if(!v)throw Error(code);};
 const check=(name,v)=>{r.checkpoint=name;r.tests++;const ok=v===true;r.checks.push({check:name,status:ok?'PASS':'FAIL'});ok?r.pass++:r.fail++;need(ok);need(!fatal,fatal);};
 const job=p=>{tasks.add(p);p.catch(()=>{fatal??='BROWSER_NETWORK_GUARD_REQUIRED';}).finally(()=>tasks.delete(p));};
 try{
  need(typeof executable==='string'&&path.isAbsolute(executable)&&(await stat(executable)).isFile());
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),expected={};
  for(const f of assets)expected['/'+f]=hash(await readFile(path.join(root,f)));
  profile=await mkdtemp(path.join(tmpdir(),'mushavo-browser-o-'));
  child=spawn(executable,[...(process.platform==='linux'?['--no-sandbox','--disable-setuid-sandbox']:[]),'--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--disable-default-apps','--disable-client-side-phishing-detection','--disable-domain-reliability','--disable-features=MediaRouter,OptimizationHints,AutofillServerCommunication','--no-proxy-server',
   '--host-resolver-rules='+(fixture?'MAP localhost 127.0.0.1, EXCLUDE 127.0.0.1':'EXCLUDE mushavo-budget-staging.pages.dev')+', MAP * ~NOTFOUND',...(fixture?['--ignore-certificate-errors']:[]),'--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
  let launchError=false;child.on('error',()=>{launchError=true;});r.checkpoint='ISOLATED_BROWSER_START';let endpoint;
  await until(async()=>{need(!launchError&&child.exitCode===null);try{const lines=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).trim().split(/\r?\n/);need(/^[1-9][0-9]{0,4}$/.test(lines[0])&&/^\/devtools\/browser\/[A-Za-z0-9-]+$/.test(lines[1]));endpoint='ws://127.0.0.1:'+lines[0]+lines[1];return true;}catch{return false;}},{timeout:20000});
  cdp=await LocalCDP.connect(endpoint);
  const version=await cdp.call('Browser.getVersion');need(/^(?:HeadlessChrome|Chrome|Edg)\/[0-9.]+$/.test(version.product));r.browser_product=version.product;
  cdp.socket.addEventListener('message',event=>{let x;try{x=JSON.parse(String(event.data));}catch{return;}const p=x.params??{},sid=x.sessionId;if(sid===pageSession)tls.event(x.method,p);
   // Only worker targets are automatically attached. Never configure Chrome's transient startup page/tab.
   if(x.method==='Target.attachedToTarget'&&['service_worker','worker'].includes(p.targetInfo.type))job((async()=>{
    const target=p.targetInfo.targetId;if([...sessions.values()].some(x=>x.target===target))return;
    const s=p.sessionId;sessions.set(s,{target,ready:false});
    await configurePublicTarget(cdp,{sessionId:s,type:p.targetInfo.type},failure=>{r.target_setup_failure??=failure;});
    sessions.get(s).ready=true;
   })());
   if(x.method==='Fetch.requestPaused')job((async()=>{
    const allowed=publicRequestAllowed(p.request.url,p.request.method,{origin,offline});
    r.intercepted_request_attempts++;const budget=r.intercepted_request_attempts<=r.maximum_intercepted_requests;
    if(!allowed){r.blocked_unreviewed_requests++;fatal??='UNREVIEWED_PUBLIC_REQUEST';}
    if(!budget)fatal??='PUBLIC_REQUEST_BUDGET_REQUIRED';
    if(!allowed||!budget||fatal||offline){if(offline&&allowed)r.simulated_offline_requests++;await cdp.call('Fetch.failRequest',{requestId:p.requestId,errorReason:'InternetDisconnected'},sid);}
    else{if(!fixture)r.intercepted_hosted_request_attempts++;await cdp.call('Fetch.continueRequest',{requestId:p.requestId},sid);}
   })());
   if(x.method==='Debugger.scriptParsed'&&publicRequestAllowed(p.url,'GET',{origin})&&new URL(p.url).pathname==='/sw.js')job((async()=>{const s=await cdp.call('Debugger.getScriptSource',{scriptId:p.scriptId},sid);workerHash=hash(s.scriptSource)===expected['/sw.js'];})());
  });
  r.checkpoint='WORKER_AUTO_ATTACH_CONFIGURATION';
  await cdp.call('Target.setAutoAttach',workerAutoAttach);
  r.checkpoint='EXPLICIT_PUBLIC_PAGE_ATTACHMENT';
  const t=await cdp.call('Target.createTarget',{url:'about:blank'});
  const attached=await cdp.call('Target.attachToTarget',{targetId:t.targetId,flatten:true}),s=attached.sessionId;
  pageSession=s;sessions.set(s,{target:t.targetId,ready:false});
  await configurePublicTarget(cdp,{sessionId:s,type:'page'},failure=>{r.target_setup_failure??=failure;});
  sessions.get(s).ready=true;
  const ev=async code=>{const x=await cdp.call('Runtime.evaluate',{expression:code,awaitPromise:true,returnByValue:true},s,45000);need(!x.exceptionDetails&&x.result&&x.result.subtype!=='error','BROWSER_EVALUATION_REQUIRED');return x.result.value;},wait=code=>until(async()=>{need(!fatal,fatal);try{return await ev(code);}catch{return false;}},{timeout:25000});
  r.checkpoint='PUBLIC_OFFLINE_DOCUMENT';const navigation=await cdp.call('Page.navigate',{url:origin+'/offline'},s);if(navigation.errorText){const e=navigation.errorText;r.navigation_failure_class=e.startsWith('net::ERR_CERT_')?'TLS_CERTIFICATE_REJECTED':e==='net::ERR_NAME_NOT_RESOLVED'?'DNS_UNAVAILABLE':'NETWORK_NAVIGATION_REQUIRED';need(false,r.navigation_failure_class);}await wait('document.querySelector("h1")?.textContent==="Your workspace needs a connection"');
  check('REAL_PUBLIC_DOM_AND_SECURE_CONTEXT',await ev('isSecureContext&&location.origin==='+JSON.stringify(origin)));
  if(tlsDiagnostic)await delay(500);
  if(!fixture&&!tlsDiagnostic){try{await until(()=>{const m=tls.snapshot();return m.document_response_observed&&m.visible_state_observed&&m.visible_certificate_present;},{timeout:5000});}catch{}}
  r.tls_metadata=tls.snapshot();
  if(tlsDiagnostic){main=true;}else{
  check(fixture?'LOCAL_FIXTURE_TLS_BYPASS_EXPLICIT':'BROWSER_SECURE_TRANSPORT_AND_CERTIFICATE_VERIFIED',fixture||browserTransportVerified(r.tls_metadata,{certificateBypass:r.local_certificate_validation_bypassed}));r.hosted_secure_transport_verified=!fixture;r.hosted_TLS_verified=r.hosted_secure_transport_verified;
  r.checkpoint='PUBLIC_SOURCE_BYTES';
  const source=await ev(`(async()=>{const expected=${JSON.stringify(expected)};let count=0;for(const [p,h]of Object.entries(expected)){const r=await fetch(p,{cache:'no-store',credentials:'omit',redirect:'follow',signal:AbortSignal.timeout(10000)});if(!r.ok||new URL(r.url).origin!==location.origin)return false;const reader=r.body.getReader(),chunks=[];let n=0;try{for(;;){const x=await reader.read();if(x.done)break;n+=x.value.length;if(n>1048576)return false;chunks.push(x.value);}}finally{await reader.cancel();reader.releaseLock();}const b=new Uint8Array(n);let at=0;for(const c of chunks){b.set(c,at);at+=c.length;}const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');if(digest!==h)return false;count++;}return count;})()`);
  check('ALL_16_PUBLIC_ASSET_BYTES_MATCH_PINNED_SOURCE',source===assets.length);r.public_assets_verified=source;
  check('FRESH_PROFILE_HAS_NO_AUTH_STORAGE_OR_DEVICE_COOKIE',await ev('localStorage.length===0&&sessionStorage.length===0&&document.cookie===""')&&(await cdp.call('Storage.getCookies')).cookies.length===0);
  await ev('caches.open("mushavo-budget-batch-o-stale").then(c=>c.put("/batch-o-stale",new Response("PUBLIC_SYNTHETIC_MARKER")))');
  await ev('caches.open("batch-o-unrelated").then(c=>c.put("/batch-o-preserve",new Response("PUBLIC_SYNTHETIC_MARKER")))');
  r.checkpoint='PUBLIC_SERVICE_WORKER_ACTIVATION';await ev('navigator.serviceWorker.register("/sw.js?v=76",{scope:"/",updateViaCache:"none"}).then(()=>true)');await wait('!!navigator.serviceWorker.controller');
  await until(()=>{need(!fatal,fatal);return workerHash;});check('ACTUALLY_EXECUTED_WORKER_SOURCE_MATCHES_PIN',workerHash);r.executed_worker_source_verified=true;
  check('STALE_PRODUCT_CACHE_REMOVED_UNRELATED_CACHE_PRESERVED',await ev('caches.keys().then(x=>!x.includes("mushavo-budget-batch-o-stale")&&x.includes("batch-o-unrelated")&&x.includes("mushavo-budget-pwa-shell-v88"))'));
  const audit=`(async()=>{const expected=${JSON.stringify(expected)};const c=await caches.open('mushavo-budget-pwa-shell-v88');const keys=await c.keys();if(keys.length!==14)return false;for(const request of keys){const u=new URL(request.url);let p=u.pathname;if(p==='/__mushavo-budget-offline/app-entry')p='/app-entry.html';else if(p==='/__mushavo-budget-offline/page')p='/offline.html';if(u.origin!==location.origin||!expected[p]||p==='/sw.js'||p==='/manifest.webmanifest')return false;const bytes=await(await c.match(request)).arrayBuffer();const h=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(h!==expected[p])return false;}return true;})()`;
  check('ALL_14_PRODUCT_CACHE_ENTRIES_ARE_EXACT_PUBLIC_SOURCE',await ev(audit));
  offline=true;
  for(const sid of sessions.keys())await cdp.call('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0},sid);
  r.checkpoint='BROWSER_OFFLINE_NAVIGATION';await cdp.call('Page.navigate',{url:origin+'/app.html?batch_o=offline'},s);
  await wait('document.querySelector("h1")?.textContent==="Your workspace needs a connection"');
  check('REAL_WORKER_OFFLINE_NAVIGATION_SHOWS_ONLY_SAFE_DOCUMENT',await ev('location.pathname==="/app.html"&&document.body.textContent.includes("No financial data has been stored")&&!navigator.onLine'));
  check('OFFLINE_NAVIGATION_DID_NOT_CACHE_PRIVATE_APP_HTML',await ev(audit));
  check('NO_INTERCEPTED_AUTH_GATEWAY_OR_UNREVIEWED_REQUEST_ALLOWED',r.blocked_unreviewed_requests===0&&!fatal);
  main=true;
  }
 }catch(error){const known=new Set(['PUBLIC_BROWSER_CHECK_REQUIRED','LOOPBACK_FIXTURE_REQUIRED','BROWSER_NETWORK_GUARD_REQUIRED','BROWSER_TARGET_SETUP_REQUIRED','UNREVIEWED_PUBLIC_REQUEST','PUBLIC_REQUEST_BUDGET_REQUIRED','UNREVIEWED_BROWSER_TARGET','BROWSER_CHECK_TIMEOUT','CDP_COMMAND_REQUIRED','CDP_COMMAND_TIMEOUT','CDP_CONNECTION_REQUIRED','BROWSER_EVALUATION_REQUIRED','TLS_CERTIFICATE_REJECTED','DNS_UNAVAILABLE','NETWORK_NAVIGATION_REQUIRED']);r.problem_code=known.has(error?.message)?error.message:'PUBLIC_BROWSER_OR_SOURCE_REVIEW_REQUIRED';}
 finally{
  if(cdp){try{await cdp.call('Browser.close',{},undefined,3000);}catch{}cdp.close();}
  if(child){if(child.exitCode===null&&!child.killed)child.kill();try{await until(()=>child.exitCode!==null||child.signalCode!==null,{timeout:5000});r.browser_process_stopped=true;}catch{}}
  await Promise.allSettled([...tasks]);
  if(profile){try{await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});r.temporary_profile_removed=true;}catch{}}
 }
 if(main&&!fatal&&r.browser_process_stopped&&r.temporary_profile_removed){r.result=tlsDiagnostic?'BATCH_O_TLS_METADATA_COLLECTED_REVIEW_REQUIRED':fixture?'LOCAL_BATCH_O_PUBLIC_BROWSER_FIXTURE_SCOPED_PASS':'BATCH_O_HOSTED_PUBLIC_BROWSER_TLS_AND_SW_SCOPED_PASS';r.checkpoint='COMPLETE';r.exit_code=0;}else r.problem_code??=fatal??'ISOLATED_BROWSER_CLEANUP_REQUIRED';
 r.checked_UTC=new Date().toISOString();return r;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const r=await publicBrowser(process.argv.length===3?process.argv[2]:null);console.log(JSON.stringify(r,null,2));process.exitCode=r.exit_code;
}
