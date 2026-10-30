import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {buildEmailWorkers} from './lib/build-fr-2-email-workers.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const toolsRoot=path.resolve(process.argv[2]||path.join(root,'node_modules/..'));
const checks=[];let mf,storageDir,bundles,unit,bundleHashes,problem=null,cleanup=true;
const pass=name=>checks.push({check:name,status:'PASS'});
try {
 const esbuild=await import(pathToFileURL(path.join(toolsRoot,'node_modules/esbuild/lib/main.js')).href);
 const {Miniflare,Log,LogLevel,Response:MFResponse}=await import(pathToFileURL(path.join(toolsRoot,'node_modules/miniflare/dist/src/index.js')).href);
 bundles=await buildEmailWorkers(esbuild);assert.equal(bundles.inputs.length,7);
 bundleHashes={pages:createHash('sha256').update(bundles.pages).digest('hex'),limiter:createHash('sha256').update(bundles.limiter).digest('hex')};
 pass('Pinned actual esbuild creates two import-free ESM bundles from exactly seven runtime modules');
 assert(!bundles.pages.includes('SYNTHETIC_')&&!bundles.limiter.includes('SYNTHETIC_'));
 const config=JSON.parse(await readFile(path.join(root,'deployment/candidates/email-rate-worker.wrangler.json'),'utf8'));
 assert.equal(config.workers_dev,false);assert.equal(config.preview_urls,false);assert.equal(config.migrations[0].new_sqlite_classes[0],'EmailGatewayRateLimiter');
 assert.equal(config.routes,undefined);pass('Limiter candidate config has no public route and declares a SQLite-backed namespace');
 storageDir=await mkdtemp(path.join(tmpdir(),'mushavo-email-workerd-'));
 const state={outbound:0,unexpected:0,mail:0,verified:false,rpc:[],code:null,challenge:null};
 const U='00000000-0000-4000-8000-000000000901',S='00000000-0000-4000-8000-000000000902';
 const origin='https://mushavo-budget-staging.pages.dev',api='https://dczlddwbtgvfdujgcitb.supabase.co';
 const json=(v,status=200)=>new MFResponse(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
 const outbound=async request=>{
  state.outbound++;const url=request.url;
  if(url===api+'/auth/v1/user')return json({id:U,email:'runtime@example.invalid',email_confirmed_at:new Date().toISOString()});
  if(url.startsWith(api+'/rest/v1/rpc/email_gate_')){
   const body=await request.json(),name=url.split('email_gate_')[1];state.rpc.push({name,body});assert.equal(body.p_user,U);assert.equal(body.p_session,S);
   if(name==='session_status')return json(state.verified);
   if(name==='begin_challenge'){state.challenge=body.p_challenge;return json({result:'PENDING_DELIVERY',challenge_id:body.p_challenge,expires_at:new Date(Date.now()+600000).toISOString()});}
   if(name==='set_delivery')return json({result:body.p_delivered?'READY':'DELIVERY_FAILED'});
   if(name==='challenge_context')return json({key_version:'v1',remember_device:true,expires_at:new Date(Date.now()+600000).toISOString()});
   if(name==='verify_challenge')return json({result:'VERIFIED',device_expires_at:new Date(Date.now()+604800000).toISOString()});
   if(name==='restore_device')return json({result:'APPROVED',device_expires_at:new Date(Date.now()+5000).toISOString()});
   if(name==='revoke_device'||name==='revoke_all')return json({result:'REVOKED'});
  }
  if(url==='https://accounts.zoho.com/oauth/v2/token')return json({access_token:'SYNTHETIC_ZOHO_TOKEN',expires_in:3600});
  if(url==='https://mail.zoho.com/api/accounts/12345678/messages'){
   const mail=await request.json();assert.equal(mail.toAddress,'runtime@example.invalid');state.mail++;
   state.code=mail.content.match(/is (\d{6})\./)[1];return json({status:{code:200}});
  }
  state.unexpected++;return json({error:'NETWORK_DISABLED'},503);
 };
 const bindings={EMAIL_GATE_MODE:'STAGING_CONTROLLED_ONLY',EMAIL_GATE_PROJECT:'dczlddwbtgvfdujgcitb',EMAIL_GATE_ORIGIN:origin,
  EMAIL_GATE_RATE_PEPPER:'3a'.repeat(32),EMAIL_GATE_PEPPERS_JSON:JSON.stringify({v1:'2a'.repeat(32)}),EMAIL_GATE_KEY_VERSION:'v1',
  SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_SYNTHETIC',
  ZOHO_MAIL_ORIGIN:'https://mail.zoho.com',ZOHO_ACCOUNTS_ORIGIN:'https://accounts.zoho.com',ZOHO_ACCOUNT_ID:'12345678',
  ZOHO_FROM_ADDRESS:'notification@example.invalid',ZOHO_CLIENT_ID:'SYNTHETIC_CLIENT',ZOHO_CLIENT_SECRET:'SYNTHETIC_CLIENT_SECRET',
  ZOHO_REFRESH_TOKEN:'SYNTHETIC_REFRESH_TOKEN',ZOHO_TEST_RECIPIENTS_JSON:'["runtime@example.invalid"]'};
 const assets=async request=>{
  assert.equal(request.headers.get('authorization'),null);assert.equal(request.headers.get('cookie'),null);
  return new MFResponse('STATIC_ASSET',{headers:{'content-type':'text/javascript','content-security-policy':"default-src 'none'"}});
 };
 const options={cf:false,host:'127.0.0.1',port:0,log:new Log(LogLevel.NONE),durableObjectsPersist:path.join(storageDir,'state'),workers:[
  {name:'pages',modules:true,script:bundles.pages,compatibilityDate:'2026-07-01',bindings,
   durableObjects:{EMAIL_GATE_LIMITER_NS:{className:'EmailGatewayRateLimiter',scriptName:'limiter',useSQLite:true}},
   serviceBindings:{ASSETS:assets},outboundService:outbound},
  {name:'limiter',modules:true,script:bundles.limiter,compatibilityDate:'2026-07-01',
   durableObjects:{SELF:{className:'EmailGatewayRateLimiter',useSQLite:true}},outboundService:()=>json({error:'NETWORK_DISABLED'},503)},
  {name:'unconfigured',modules:true,script:bundles.pages,compatibilityDate:'2026-07-01',bindings,
   serviceBindings:{ASSETS:assets},outboundService:outbound}
 ]};
 mf=new Miniflare(options);
 const claims={sub:U,session_id:S,iss:api+'/auth/v1',aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600};
 const token=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.c3ludGhldGlj';
 const headers={origin,'content-type':'application/json','x-mushavo-csrf':'email-v1','cf-connecting-ip':'192.0.2.21',authorization:'Bearer '+token};
 const call=(route,body={},extra={})=>mf.dispatchFetch(origin+'/api/email-verification/'+route,{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)});
 let r=await mf.dispatchFetch(origin+'/app.js',{headers:{authorization:'Bearer SYNTHETIC',cookie:'SYNTHETIC'}});
 assert.equal(await r.text(),'STATIC_ASSET');assert.equal(r.headers.get('content-security-policy'),"default-src 'none'");assert.equal(state.outbound,0);
 pass('Actual workerd Pages bundle serves static assets with preserved headers and no cookie/bearer forwarding');
 const unconfigured=await mf.getWorker('unconfigured');const internalHeaders={...headers};delete internalHeaders.origin;
 // Miniflare's internal proxy rejects external Origin headers before dispatch; this case tests only missing binding.
 r=await unconfigured.fetch(origin+'/api/email-verification/status',{method:'POST',headers:internalHeaders,body:'{}'});
 assert.equal(r.status,503);assert.equal(state.outbound,0);pass('Missing Durable Object namespace fails closed before Auth in the actual runtime');
 r=await call('status',{}, {origin:'https://foreign.invalid'});assert.equal(r.status,403);assert.equal(state.outbound,0);
 pass('Foreign-origin API request is refused before any Auth/provider request in workerd');
 r=await call('status');assert.equal(r.status,200);assert.deepEqual(await r.json(),{verified:false});
 pass('Bundled gateway reaches the real local Durable Object before its synthetic Auth/RPC ports');
 r=await call('begin',{remember:true});assert.equal(r.status,200);assert.equal((await r.json()).challengeId,state.challenge);assert.equal(state.mail,1);
 pass('Bundled WebCrypto challenge and Zoho adapter execute in workerd with only synthetic upstream acceptance');
 r=await call('verify',{challengeId:state.challenge,code:state.code});assert.equal(r.status,200);
 const cookie=r.headers.get('set-cookie');assert(cookie.includes('Secure; HttpOnly; SameSite=Strict'));assert(!cookie.includes('Domain='));assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(await r.json(),{result:'VERIFIED'});
 pass('Actual workerd response emits a secure account-specific cookie while JSON remains credential-free');
 r=await call('restore',{}, {cookie:cookie.split(';')[0]});assert.equal((await r.json()).result,'APPROVED');assert.equal(r.headers.get('set-cookie'),null);
 pass('Compiled remembered-device restore does not renew the cookie deadline');
 const namespace=await mf.getDurableObjectNamespace('EMAIL_GATE_LIMITER_NS','pages');
 const object=namespace.get(namespace.idFromName('local-concurrency-case'));
 const check=stub=>stub.fetch('https://email-rate.internal/check',{method:'POST',headers:{'content-type':'application/json','x-mushavo-internal':'email-rate-v1'},body:'{}'}).then(async response=>{assert.equal(response.status,200);return(await response.json()).success;});
 const results=await Promise.all(Array.from({length:120},()=>check(object)));
 assert.equal(results.filter(Boolean).length,60);assert.equal(results.filter(x=>!x).length,60);
 pass('120 simultaneous calls to the actual SQLite-backed Durable Object allow exactly60 within its rolling minute');
 const otherBinding=await mf.getDurableObjectNamespace('SELF','limiter');
 assert.equal(await check(otherBinding.get(otherBinding.idFromName('local-concurrency-case'))),false);
 assert.equal(await check(namespace.get(namespace.idFromName('independent-case'))),true);
 pass('Separate bindings share the same durable namespace while another object identity has an independent quota');
 assert.equal((await object.fetch('https://email-rate.internal/check',{method:'POST',headers:{'content-type':'application/json','x-mushavo-internal':'email-rate-v1'},body:'{"now":1}'})).status,400);
 assert.equal((await object.fetch('https://email-rate.internal/check',{method:'GET'})).status,404);
 pass('Actual Durable Object rejects caller timestamps,policy overrides and non-protocol requests');
 const publicLimiter=await mf.getWorker('limiter');assert.equal((await publicLimiter.fetch('https://public.invalid/check')).status,404);
 pass('Limiter Worker public fetch entrypoint never exposes or forwards to its private namespace');
 // Fresh IP exhausts through the actual compiled Pages-to-DO adapter, not a Node limiter substitute.
 let denied=0;for(let i=0;i<61;i++){const response=await call('status',{}, {'cf-connecting-ip':'192.0.2.22'});if(response.status===429)denied++;else assert.equal(response.status,200);}
 assert.equal(denied,1);pass('The61st gateway request for a fresh IP is denied by the real bound limiter');
 await mf.dispose();mf=null;mf=new Miniflare(options);
 const reloaded=await mf.getDurableObjectNamespace('EMAIL_GATE_LIMITER_NS','pages');
 assert.equal(await check(reloaded.get(reloaded.idFromName('local-concurrency-case'))),false);
 pass('Quota survives complete local runtime disposal/restart from its persisted SQLite state');
 assert.equal(state.unexpected,0);pass('All outbound fetches were intercepted locally; no external Auth,Zoho or Cloudflare request occurred');
 unit=spawnSync(process.execPath,['--require',path.join(root,'scripts/offline-test-network.cjs'),'--test','--test-reporter=tap',path.join(root,'tests/fr-2-email-rate-client.test.mjs')],{encoding:'utf8',timeout:20000,maxBuffer:1024*1024});
 assert.equal(unit.status,0);
} catch (error) {problem=error?.code==='ERR_ASSERTION'?'LOCAL_ASSERTION_FAILURE':'LOCAL_RUNTIME_OR_BUNDLE_UNAVAILABLE';}
finally {
 try{if(mf)await mf.dispose();}catch{cleanup=false;}
 try{if(storageDir)await rm(storageDir,{recursive:true,force:true});}catch{cleanup=false;}
}
const get=name=>Number((unit?.stdout||'').match(new RegExp('^# '+name+' (\\d+)$','m'))?.[1]||0);
const success=!problem&&cleanup&&checks.length===16&&unit?.status===0&&get('fail')===0&&get('tests')===15;
console.log(JSON.stringify({stage_step:'FR.2.4.E3.2',result:success?'ACTUAL_ESBUILD_AND_LOCAL_WORKERD_DURABLE_LIMITER_SCOPED_PASS':'LOCAL_WORKER_RUNTIME_REVIEW_REQUIRED',
 scope:'REAL_ESBUILD_NATIVE_COMPILER_AND_LOCAL_WORKERD_SQLITE_DO_WITH_INTERCEPTED_AUTH_ZOHO_PORTS_NOT_HOSTED_RUNTIME',
 node_version:process.version,esbuild_version:'0.28.2',miniflare_version:'4.20260730.0',
 checks,worker_checks:checks.length,rate_client_tests:get('tests'),pass:checks.length+get('pass'),fail:success?0:Math.max(1,get('fail')),tests:checks.length+get('tests'),exit_code:success?0:1,
 planned_checks:31,problem_code:problem,local_runtime_and_temporary_state_cleanup_completed:cleanup,
 bundle_sha256:bundleHashes||null,real_local_worker_bundles:bundles?2:0,
 real_local_Durable_Object_SQLite_and_parallel_requests_verified:checks.some(x=>x.check.startsWith('120 simultaneous')),
 real_local_persisted_runtime_restart_verified:checks.some(x=>x.check.startsWith('Quota survives')),
 hosted_Auth_Zoho_Cloudflare_requests:0,real_email_sent:false,hosted_resources_bindings_secrets_or_settings_changed:false,
 actual_Cloudflare_ingress_IP_or_hosted_multipop_behavior_verified:false,
 actual_Zoho_sender_data_centre_credentials_scopes_or_delivery_verified:false,
 browser_cookie_jar_native_or_app_wide_guards_verified:false,hosted_acceptance:false,production_or_native_changed:false,findings_closed:[],APK_update_deferred:true},null,2));
process.exitCode=success?0:1;
