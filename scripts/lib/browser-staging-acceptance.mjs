// One disposable browser process; two empty incognito contexts. No full app bootstrap.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {LocalCDP,until,evaluate} from './browser-local-cdp.mjs';
import {tlsObservation,browserTransportVerified} from './browser-tls-observation.mjs';
import {workerAutoAttach} from './browser-public-target.mjs';
import {stagingOrigin,stagingAPI,stagingGuard,loopbackStagingGuard} from './browser-staging-guard.mjs';
import {diagnosticError} from './email-batch-t-diagnostic-shape.mjs';
import {harnessExpression,lockedExpression,cleanDocument} from './browser-staging-harness.mjs';
const root=new URL('../../',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===keys.slice().sort().join(',');
const need=(x,code='BROWSER_REQUIRED')=>{if(!x)throw Object.assign(Error(code),{safeCode:code});};
const deviceName=s=>'__Host-mushavo_device_'+s.actor.user.replaceAll('-','');
const cleared=s=>deviceName(s)+'=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0';
export function startStagingBrowser(executable,{publishableKey}){return browser(executable,{origin:stagingOrigin,api:stagingAPI,publishableKey,fixture:false});}
export function startLoopbackStagingBrowser(executable,{origin,api=origin,publishableKey}){need(/^https:\/\/localhost:[1-9][0-9]{0,4}$/.test(origin),'LOCAL_FIXTURE_ONLY');return browser(executable,{origin,api,publishableKey,fixture:true});}
function browser(executable,{origin,api,publishableKey,fixture}){
 const guard=fixture?loopbackStagingGuard({origin,api,publishableKey}):stagingGuard({publishableKey});
 const r={scope:fixture?'LOCAL_BROWSER_AND_SYNTHETIC_SERVICES':'HOSTED_SHARED_COMPONENTS_WITH_MEMORY_ONLY_CLIENT_ADAPTER',browser_product:null,public_source_bytes_verified:0,executed_modules_verified:false,normal_hosted_TLS_verified:false,local_certificate_validation_bypassed:fixture,
 email_provider_acceptance_observed:false,email_dispatch_outcome_uncertain:false,email_code_verified:false,verification_outcome_uncertain:false,secure_fixed_deadline_remember_cookie_observed:false,password_only_browser_denied:false,
 same_account_new_session_restore_approved:false,foreign_account_renamed_cookie_restore_denied:false,cookie_free_same_account_browser_denied:false,repeated_restore_emits_no_cookie:false,quarantined_proof_keeps_view_locked:false,code_input_cleared:false,credential_not_document_readable:false,
 verified_browser_views_and_HTTP_passed:false,account_change_clears_view_and_ticket:false,same_account_session_change_clears_view_and_ticket:false,quarantine_clears_view_and_ticket:false,post_quarantine_browser_HTTP_denied:false,private_web_storage_and_cache_empty:false,
 incognito_contexts_disposed:false,disposed_context_cookies_absent:false,browser_process_stopped:false,temporary_profile_removed:false,cleanup_verified:false,request_guard:null,checkpoint:'BROWSER_INPUT',problem_code:null,
 full_app_or_business_bootstrap:false,service_worker_registered_or_private_cache_integration_verified:false,total_browser_requests_independently_counted:false,external_traffic_OS_sandboxed:false};
 let cdp,child,profile,launchError=false,fatal=null,selected=[],shared,isolated,firstPage=null,challenge=null,credential=null,cookieExpirySeconds=null,closed=false;
 const diagnostic={operation:'INPUT',failure_operation:null,error_code:null,failed_cdp_method:null};
 const mark=x=>{diagnostic.operation=x;};
 const failure=e=>{diagnostic.failure_operation??=diagnostic.operation;diagnostic.error_code??=diagnosticError(e);};
 const call=(method,...args)=>cdp.call(method,...args).catch(e=>{if(!diagnostic.error_code){failure(e);diagnostic.failed_cdp_method=method;}throw e;});
 const pages=new Map(),tasks=new Set(),pendingRequests=new Map(),expected={},executed=new Set(),wireCookies=new Map(),restores=[[],[],[],[]];let initialCookie=null;
 const step=x=>{r.checkpoint=x;need(!fatal,fatal||'BROWSER_REQUIRED');};
 const job=promise=>{tasks.add(promise);promise.catch(e=>{failure(e);fatal??=e?.safeCode||'BROWSER_REQUIRED';}).finally(()=>tasks.delete(promise));};
 const wait=async test=>until(async()=>{need(!fatal,fatal||'BROWSER_REQUIRED');return test();},{timeout:20000});
 const ev=(s,expression)=>{need(!fatal,fatal||'BROWSER_REQUIRED');return evaluate(cdp,s,expression);};
 const idle=()=>Promise.all([...tasks]);
 const snapshot=()=>({...r,email_request_attempts:guard.safe().email_request_attempts,verify_attempts:guard.safe().verify_attempts,request_guard:guard.safe(),email_dispatch_outcome_uncertain:guard.safe().email_request_attempts>0&&!r.email_provider_acceptance_observed,verification_outcome_uncertain:guard.safe().verify_attempts>0&&!r.email_code_verified});
 const cookies=async context=>(await call('Storage.getCookies',{browserContextId:context})).cookies;
 async function rememberCookie(){const values=await cookies(shared),name=deviceName(selected[0]),c=values.find(x=>x.name===name);
  need(!!c&&values.every(x=>x.name===name)&&c.secure&&c.httpOnly&&c.sameSite==='Strict'&&c.path==='/'&&c.domain===new URL(origin).hostname&&!c.session&&/^[A-Za-z0-9_-]{43}$/.test(c.value)&&c.expires>Date.now()/1000&&c.expires<=Date.now()/1000+604801,'COOKIE_REQUIRED');return c;
 }
 async function response(p,s){
  const meta=pendingRequests.get(s+':'+p.requestId);need(meta,'BROWSER_RESPONSE_REQUIRED');pendingRequests.delete(s+':'+p.requestId);
  need(!p.responseErrorReason&&p.responseStatusCode===200&&Array.isArray(p.responseHeaders),'BROWSER_RESPONSE_REQUIRED');
  const headers=new Map();for(const h of p.responseHeaders){const key=h.name.toLowerCase();need(!headers.has(key)||key==='vary','BROWSER_RESPONSE_REQUIRED');headers.set(key,h.value);}
  need(/^application\/json(?:\s*;|$)/i.test(headers.get('content-type')||'')&&headers.get('cache-control')==='no-store'&&headers.get('x-content-type-options')==='nosniff'&&headers.get('referrer-policy')==='no-referrer'&&headers.get('content-security-policy')==="default-src 'none'; frame-ancestors 'none'",'BROWSER_RESPONSE_REQUIRED');
  const body=await call('Fetch.getResponseBody',{requestId:p.requestId},s),bytes=Buffer.from(body.body,body.base64Encoded?'base64':'utf8');need(bytes.length<=4096,'BROWSER_RESPONSE_REQUIRED');let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{need(false,'BROWSER_RESPONSE_REQUIRED');}
  const wireKey=s+':'+p.networkId;
  need(typeof p.networkId==='string','BROWSER_RESPONSE_REQUIRED');await until(()=>wireCookies.has(wireKey),{timeout:5000});
  const cookie=headers.get('set-cookie')??wireCookies.get(wireKey)??null;wireCookies.delete(wireKey);
  if(meta.route==='begin'){
   need(exact(value,['result','challengeId','expiresAt'])&&value.result==='CODE_REQUESTED'&&typeof value.challengeId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.challengeId)&&Date.parse(value.expiresAt)>Date.now()&&cookie===null,'EMAIL_REQUIRED');
   challenge=value.challengeId;guard.challenge(challenge);r.email_provider_acceptance_observed=true;
  }else if(meta.route==='verify'){
   need(exact(value,['result'])&&value.result==='VERIFIED','CODE_REQUIRED');r.email_code_verified=true;
   const match=typeof cookie==='string'&&cookie.match(new RegExp('^'+deviceName(selected[0])+'=([A-Za-z0-9_-]{43}); Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=([1-9][0-9]*); Expires=(.+)$'));
   need(match&&Number(match[2])<=604800&&Date.parse(match[3])>Date.now()&&Date.parse(match[3])<=Date.now()+604801000,'COOKIE_REQUIRED');credential=match[1];cookieExpirySeconds=Math.floor(Date.parse(match[3])/1000);
  }else if(meta.route==='restore'){
   need(exact(value,['result'])&&['CODE_REQUIRED','APPROVED'].includes(value.result),'RESTORE_REQUIRED');
   need(cookie===null||meta.index===3&&value.result==='CODE_REQUIRED'&&cookie===cleared(selected[3]),'COOKIE_REQUIRED');restores[meta.index].push({result:value.result,cookiePresent:cookie!==null});
  }else need(exact(value,['verified'])&&typeof value.verified==='boolean'&&cookie===null,'BROWSER_RESPONSE_REQUIRED');
  await call('Fetch.continueResponse',{requestId:p.requestId},s);
 }
 async function page(context){
  mark('PAGE_CREATE_AND_ATTACH');
  const t=await call('Target.createTarget',{url:'about:blank',browserContextId:context}),s=(await call('Target.attachToTarget',{targetId:t.targetId,flatten:true})).sessionId;
  const tls=tlsObservation(origin);pages.set(s,{tls,index:null,context});
  mark('PAGE_DOMAIN_SETUP');await call('Network.enable',{},s);await call('Network.setBypassServiceWorker',{bypass:true},s);
  await call('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'},{urlPattern:origin+'/api/email-verification/*',requestStage:'Response'}]},s);
  await call('Page.enable',{},s);await call('Security.enable',{},s);await call('Runtime.enable',{},s);await call('Debugger.enable',{},s);await call('Emulation.setScriptExecutionDisabled',{value:true},s);
  mark('PAGE_NAVIGATION');const nav=await call('Page.navigate',{url:origin+'/offline'},s);need(!nav.errorText,'BROWSER_TLS_REQUIRED');
  mark('PAGE_DOCUMENT_READY');await wait(async()=>{try{return await ev(s,'document.querySelector("h1")?.textContent==="Your workspace needs a connection"&&isSecureContext');}catch{return false;}});
  if(!fixture){await wait(()=>browserTransportVerified(tls.snapshot(),{certificateBypass:false}));r.normal_hosted_TLS_verified=true;}
  mark('PAGE_TEST_MOUNT');const frame=(await call('Page.getFrameTree',{},s)).frameTree.frame.id;
  await call('Page.setDocumentContent',{frameId:frame,html:cleanDocument},s);
  return s;
 }
 async function attach(index,context){mark('SESSION_PAGE_ATTACH');const s=index===0?firstPage:await page(context);guard.bind(s,index);pages.get(s).index=index;
  mark('SESSION_MODULE_IMPORT');await call('Emulation.setScriptExecutionDisabled',{value:false},s);await ev(s,harnessExpression(selected[index],api,publishableKey));await idle();need(!fatal,fatal||'BROWSER_REQUIRED');return s;
 }
 const byIndex=i=>[...pages].find(([,p])=>p.index===i)?.[0];
 async function http(i,approved){const got=await ev(byIndex(i),'__mushavoAcceptance.http('+JSON.stringify(selected[3].actor.user)+')');need(exact(got,['gateway','rpc','own','ownDenied','foreignDenied'])&&got.gateway===approved&&got.rpc===approved&&got.own===approved&&got.ownDenied===!approved&&got.foreignDenied===true,'ACTIVE_HTTP_REQUIRED');}
 const port={
  snapshot,diagnostics:()=>({...diagnostic,guard_denial:guard.diagnostics().first_denial}),privateState:()=>({challenge,credential,cookieExpirySeconds}),
  async preflight(){
   mark('PUBLIC_SOURCE_INPUTS');step('BROWSER_PUBLIC_AND_TLS_PREFLIGHT');need(typeof executable==='string'&&path.isAbsolute(executable)&&(await stat(executable)).isFile(),'BROWSER_INPUT_REQUIRED');
   for(const f of ['offline.html','email-verification.js','session-entry.js','sw.js'])expected['/'+f]=hash(await readFile(new URL(f,root)));
   mark('TEMPORARY_PROFILE_CREATE');profile=await mkdtemp(path.join(tmpdir(),'mushavo-browser-t-'));
   const environment=Object.fromEntries(Object.entries(process.env).filter(([name])=>!/(TOKEN|PASSWORD|SECRET|SUPABASE|ZOHO|EMAIL_GATE|NODE_OPTIONS|NODE_DEBUG|NODE_TLS|SSLKEYLOG|CLOUDFLARE|WRANGLER)/i.test(name)));
   mark('BROWSER_PROCESS_START');child=spawn(executable,[...(process.platform==='linux'?['--no-sandbox','--disable-setuid-sandbox']:[]),'--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--disable-default-apps','--disable-client-side-phishing-detection','--disable-domain-reliability','--disable-breakpad','--disable-crash-reporter','--disable-logging','--disable-features=MediaRouter,OptimizationHints,AutofillServerCommunication','--no-proxy-server','--host-resolver-rules='+(fixture?'MAP localhost 127.0.0.1, EXCLUDE 127.0.0.1':'EXCLUDE '+new URL(origin).hostname+', EXCLUDE '+new URL(api).hostname)+', MAP * ~NOTFOUND',...(fixture?['--ignore-certificate-errors']:[]),'--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true,env:environment});child.on('error',()=>{launchError=true;});
   mark('DEVTOOLS_ENDPOINT_READY');let endpoint;await until(async()=>{need(!launchError&&child.exitCode===null);try{const lines=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).trim().split(/\r?\n/);need(/^[1-9][0-9]{0,4}$/.test(lines[0])&&/^\/devtools\/browser\/[A-Za-z0-9-]+$/.test(lines[1]));endpoint='ws://127.0.0.1:'+lines[0]+lines[1];return true;}catch{return false;}},{timeout:20000});
   mark('CDP_CONNECT_AND_VERSION');cdp=await LocalCDP.connect(endpoint);const version=await call('Browser.getVersion');need(/^(?:HeadlessChrome|Chrome|Edg)\/[0-9.]+$/.test(version.product));r.browser_product=version.product;
   cdp.socket.addEventListener('message',event=>{let e;try{e=JSON.parse(String(event.data));}catch{fatal??='BROWSER_REQUIRED';return;}const p=e.params??{},s=e.sessionId;
    pages.get(s)?.tls.event(e.method,p);
    if(e.method==='Network.responseReceivedExtraInfo'){
     const entry=Object.entries(p.headers??{}).find(([name])=>name.toLowerCase()==='set-cookie');
     wireCookies.set(s+':'+p.requestId,entry?.[1]??null);
    }
    if(e.method==='Target.attachedToTarget'&&['worker','service_worker'].includes(p.targetInfo?.type))fatal??='BROWSER_UNREVIEWED_WORKER';
    if(e.method==='Fetch.requestPaused')job((async()=>{
     if(p.responseStatusCode!==undefined||p.responseErrorReason){try{await response(p,s);}catch(e){try{await call('Fetch.failRequest',{requestId:p.requestId,errorReason:'BlockedByClient'},s);}catch{}throw e;}return;}
     const allowed=!fatal&&guard.allow({...p.request,resourceType:p.resourceType,redirected:!!p.redirectedRequestId},s);
     if(!allowed){fatal??='BROWSER_REQUEST_GUARD_REQUIRED';await call('Fetch.failRequest',{requestId:p.requestId,errorReason:'BlockedByClient'},s);return;}
     const u=new URL(p.request.url);if(u.origin===origin&&u.pathname.startsWith('/api/email-verification/'))pendingRequests.set(s+':'+p.requestId,{route:u.pathname.split('/').at(-1),index:pages.get(s).index});
     await call('Fetch.continueRequest',{requestId:p.requestId},s);
    })());
    if(e.method==='Debugger.scriptParsed'&&[origin+'/session-entry.js',origin+'/email-verification.js?v=2'].includes(p.url))job((async()=>{const source=await call('Debugger.getScriptSource',{scriptId:p.scriptId},s),f=new URL(p.url).pathname;need(hash(source.scriptSource)===expected[f],'BROWSER_SOURCE_REQUIRED');executed.add(f);})());
   });
   mark('BROWSER_CONTEXT_SETUP');await call('Target.setAutoAttach',workerAutoAttach);
   shared=(await call('Target.createBrowserContext',{disposeOnDetach:true})).browserContextId;isolated=(await call('Target.createBrowserContext',{disposeOnDetach:true})).browserContextId;
   firstPage=await page(shared);
   mark('PUBLIC_SOURCE_FETCH_AND_HASH');const count=await ev(firstPage,`(async()=>{const expected=${JSON.stringify(expected)};let n=0;for(const [p,h] of Object.entries(expected)){const r=await fetch(p,{credentials:'omit',cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(12000)});if(!r.ok||new URL(r.url).origin!==location.origin)return false;const b=await r.arrayBuffer();if(b.byteLength>1048576)return false;const v=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');if(v!==h)return false;n++;}return n;})()`);
   need(count===4,'BROWSER_SOURCE_REQUIRED');r.public_source_bytes_verified=count;
   mark('EMPTY_CONTEXT_STORAGE');need((await cookies(shared)).length===0&&(await cookies(isolated)).length===0&&await ev(firstPage,'localStorage.length===0&&sessionStorage.length===0'),'COOKIE_REQUIRED');await idle();need(!fatal,fatal||'BROWSER_REQUIRED');
  },
  async attachSessions(values){mark('PASSWORD_ONLY_CHECK');step('BROWSER_PASSWORD_ONLY');guard.sessions(values);selected=values;const s=await attach(0,shared);await wait(()=>executed.size===2);r.executed_modules_verified=true;await http(0,false);need(await ev(s,lockedExpression),'QUARANTINED_DENIAL_REQUIRED');r.password_only_browser_denied=true;},
  async prove(readCode){mark('EMAIL_BEGIN_ACTION');step('BROWSER_ONE_EMAIL');const s=byIndex(0);await ev(s,'document.querySelector("input[type=checkbox]").click();[...document.querySelectorAll("button")].find(x=>x.textContent==="Send email code").click()');await wait(()=>r.email_provider_acceptance_observed);await wait(()=>ev(s,'!__mushavoAcceptance.entry.busy&&!document.querySelector("form").hidden'));
   mark('CODE_VERIFY_ACTION');step('BROWSER_HIDDEN_CODE');let code=await readCode();need(typeof code==='string'&&/^\d{6}$/.test(code),'CODE_REQUIRED');
   await ev(s,'document.querySelector("input[autocomplete=one-time-code]").value='+JSON.stringify(code)+';document.querySelector("form").requestSubmit()');code=null;await wait(()=>r.email_code_verified);await wait(()=>ev(s,'!__mushavoAcceptance.entry.busy'));
   mark('REMEMBER_COOKIE_ATTRIBUTES');initialCookie=await rememberCookie();need(initialCookie.value===credential&&Math.abs(initialCookie.expires-cookieExpirySeconds)<=2,'COOKIE_REQUIRED');r.secure_fixed_deadline_remember_cookie_observed=true;need(await ev(s,'!document.cookie.includes("__Host-mushavo_device_")'),'COOKIE_REQUIRED');r.credential_not_document_readable=true;
   need(await ev(s,lockedExpression),'QUARANTINED_DENIAL_REQUIRED');r.quarantined_proof_keeps_view_locked=true;need(await ev(s,'document.querySelector("input[autocomplete=one-time-code]").value===""'),'CODE_REQUIRED');r.code_input_cleared=true;
  },
  async restoreAndBind(){mark('RESTORE_AND_ACCOUNT_BINDING');step('BROWSER_RESTORE_AND_ACCOUNT_BINDING');const a2=await attach(1,shared);need(restores[1].at(-1)?.result==='APPROVED'&&await ev(a2,lockedExpression),'RESTORE_REQUIRED');r.same_account_new_session_restore_approved=true;
   await ev(a2,'__mushavoAcceptance.recheck()');need(restores[1].length===2&&restores[1].every(x=>x.result==='APPROVED'&&!x.cookiePresent)&&(await rememberCookie()).expires===initialCookie.expires,'RESTORE_REQUIRED');r.repeated_restore_emits_no_cookie=true;
   const fresh=await attach(2,isolated);need((await cookies(isolated)).length===0&&restores[2].at(-1)?.result==='CODE_REQUIRED'&&await ev(fresh,lockedExpression),'RESTORE_REQUIRED');r.cookie_free_same_account_browser_denied=true;
   await call('Storage.setCookies',{browserContextId:shared,cookies:[{name:deviceName(selected[3]),value:credential,url:origin+'/',path:'/',secure:true,httpOnly:true,sameSite:'Strict',expires:initialCookie.expires}]});
   const other=await attach(3,shared);need(restores[3].at(-1)?.result==='CODE_REQUIRED'&&restores[3].at(-1)?.cookiePresent===true&&!(await cookies(shared)).some(x=>x.name===deviceName(selected[3])),'ACCOUNT_BINDING_REQUIRED');
   await ev(other,'localStorage.setItem("emailVerified","true");sessionStorage.setItem("emailVerified","true");__mushavoAcceptance.recheck()');need(await ev(other,lockedExpression),'ACCOUNT_BINDING_REQUIRED');r.foreign_account_renamed_cookie_restore_denied=true;
  },
  async activeWindow(deadline){mark('BOUNDED_BROWSER_HTTP');step('BROWSER_BOUNDED_ACTIVE_HTTP');guard.deadline(deadline);
   for(let i=0;i<4;i++){await ev(byIndex(i),'__mushavoAcceptance.recheck()');const allowed=i<2;need((await ev(byIndex(i),'__mushavoAcceptance.entry.authorized'))===allowed,'ACTIVE_HTTP_REQUIRED');await http(i,allowed);}
   r.verified_browser_views_and_HTTP_passed=true;
   const s=byIndex(0);guard.bind(s,1);pages.get(s).index=1;
   await ev(s,'window.__oldTicket=__mushavoAcceptance.entry.ticket();__mushavoAcceptance.bind('+JSON.stringify({user:{id:selected[1].actor.user},access_token:selected[1].token})+')');need(await ev(s,'!__oldTicket()&&'+lockedExpression),'ACCOUNT_BINDING_REQUIRED');r.same_account_session_change_clears_view_and_ticket=true;
   await ev(s,'__mushavoAcceptance.recheck()');need(await ev(s,'__mushavoAcceptance.entry.authorized'),'ACTIVE_HTTP_REQUIRED');
   guard.bind(s,3);pages.get(s).index=3;
   await ev(s,'window.__oldTicket=__mushavoAcceptance.entry.ticket();__mushavoAcceptance.bind('+JSON.stringify({user:{id:selected[3].actor.user},access_token:selected[3].token})+')');need(await ev(s,'!__oldTicket()&&'+lockedExpression),'ACCOUNT_BINDING_REQUIRED');r.account_change_clears_view_and_ticket=true;
   // Keep a ticket from the restored page for the explicit quarantine check.
   await ev(byIndex(1),'window.__oldTicket=__mushavoAcceptance.entry.ticket()');
  },
  async afterQuarantine(){mark('POST_QUARANTINE_BROWSER');step('BROWSER_POST_QUARANTINE');guard.deadline(null);const s=byIndex(1);if(!s)return;
   await ev(s,'__mushavoAcceptance.recheck()');need(await ev(s,'!window.__oldTicket?.()&&'+lockedExpression),'QUARANTINE_REQUIRED');r.quarantine_clears_view_and_ticket=true;await http(1,false);r.post_quarantine_browser_HTTP_denied=true;
   for(const page of pages.keys())need(await ev(page,'[localStorage,sessionStorage].every(s=>Object.keys(s).every(k=>k==="emailVerified"&&s.getItem(k)==="true"))&&document.querySelector("input[autocomplete=one-time-code]")?.value===""'),'BROWSER_STORAGE_REQUIRED');
   for(const context of [shared,isolated]){const session=[...pages].find(([,p])=>p.context===context)?.[0];need(await ev(session,'caches.keys().then(x=>x.length===0)'),'BROWSER_STORAGE_REQUIRED');}r.private_web_storage_and_cache_empty=true;
  },
  async close(){mark('BROWSER_CLEANUP');if(closed)return snapshot();closed=true;const ids=[shared,isolated].filter(Boolean);
   if(cdp){try{await idle();for(const id of ids)await call('Target.disposeBrowserContext',{browserContextId:id});const remaining=(await call('Target.getBrowserContexts')).browserContextIds;r.incognito_contexts_disposed=ids.every(x=>!remaining.includes(x));r.disposed_context_cookies_absent=(await call('Storage.getCookies')).cookies.length===0;}catch{r.problem_code='BROWSER_CLEANUP_REQUIRED';}try{await call('Browser.close',{},undefined,3000);}catch{}cdp.close();}
   if(child){if(child.exitCode===null&&!child.killed)child.kill();try{await until(()=>child.exitCode!==null||child.signalCode!==null,{timeout:5000});r.browser_process_stopped=true;}catch{}}else r.browser_process_stopped=true;
   if(profile){try{await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});r.temporary_profile_removed=true;}catch{}}else r.temporary_profile_removed=true;
   if(!ids.length){r.incognito_contexts_disposed=true;r.disposed_context_cookies_absent=true;}
   r.cleanup_verified=r.incognito_contexts_disposed&&r.disposed_context_cookies_absent&&r.browser_process_stopped&&r.temporary_profile_removed;
   r.problem_code??=fatal;guard.clear();credential=null;challenge=null;cookieExpirySeconds=null;initialCookie=null;selected=[];pendingRequests.clear();wireCookies.clear();return snapshot();
  }
 };
 for(const method of ['preflight','attachSessions','prove','restoreAndBind','activeWindow','afterQuarantine','close']){const execute=port[method];port[method]=async(...args)=>{try{return await execute(...args);}catch(e){failure(e);throw e;}};}
 return port;
}
