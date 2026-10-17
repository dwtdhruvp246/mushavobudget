// Current compiled Pages -> real local SQLite DO -> actual SQL. All Auth and mail ports are synthetic.
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {buildEmailWorkers} from './lib/build-fr-2-email-workers.mjs';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
const tools=path.resolve(process.argv[2]),pglite=path.resolve(process.argv[3]);
const checks=[];let mf,db,scratch,bundleHashes,cleanup=true,problem=null;
const pass=check=>checks.push({check,status:'PASS'});
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=id(8301),B=id(8302),S=id(8311),S2=id(8312),S3=id(8313),BS=id(8314);
const origin='https://mushavo-budget-staging.pages.dev',api='https://dczlddwbtgvfdujgcitb.supabase.co';
let active={user:A,session:S},mailFailure=false,unexpected=0,outboundCount=0,mailCount=0;
const codes=new Map(),tokens=new Map();let deviceCookie;
try {
 const esbuild=await import(pathToFileURL(path.join(tools,'node_modules/esbuild/lib/main.js')));
 const {Miniflare,Log,LogLevel,Response:MFResponse}=await import(pathToFileURL(path.join(tools,'node_modules/miniflare/dist/src/index.js')));
 const bundles=await buildEmailWorkers(esbuild);assert.equal(bundles.inputs.length,7);
 bundleHashes={pages:createHash('sha256').update(bundles.pages).digest('hex'),limiter:createHash('sha256').update(bundles.limiter).digest('hex')};
 pass('Current seven actual runtime modules build as two import-free esbuild ESM bundles');
 const ensure=JSON.parse(await readFile(root+'/tests/fixtures/fr-2-reviewed-ensure-rls.json','utf8'));
 const providers=JSON.parse(await readFile(root+'/tests/fixtures/fr-2-reviewed-provider-hooks.json','utf8')).hooks;
 const local=await localDatabase(pglite,{includeEmailInstaller:true,preparePlatform:async d=>{
  await d.exec("alter table auth.users add column email_confirmed_at timestamptz,add column encrypted_password varchar(255),add column banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);create role supabase_admin superuser;create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path=pg_catalog as $body$"+ensure.body+"$body$;create event trigger ensure_rls on ddl_command_end when tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO') execute function public.rls_auto_enable()");
  for(const h of providers)await d.exec('create function extensions.'+h.name+"() returns event_trigger language plpgsql set search_path='' as $hook$"+h.body+'$hook$;alter function extensions.'+h.name+'() owner to supabase_admin;create event trigger '+h.name+' on '+h.event+' execute function extensions.'+h.name+'();alter event trigger '+h.name+' owner to supabase_admin');
 }});db=local.db;
 const rows=async(sql,args)=>(await db.query(sql,args)).rows;
 const value=async(sql,args)=>(await rows(sql,args))[0].value;
 assert.equal(local.migrations.length,55);assert.equal(await value("select to_regnamespace('mushavo_email_auth') value"),null);assert.equal(await value("select atttypmod value from pg_attribute where attrelid='auth.users'::regclass and attname='encrypted_password'"),259);
 await db.exec("set mushavo.email_atomic_review='OFFLINE_ATOMIC_REHEARSAL'");const activation=await value('select mushavo_email_install.activate() value');assert.equal(activation.guarded_RPCs,148);assert.equal(activation.restrictive_policies,82);
 await db.query("insert into auth.users(id,email,email_confirmed_at,encrypted_password) values($1,'runtime-a@example.invalid',now(),'SYNTHETIC_A_HASH'),($2,'runtime-b@example.invalid',now(),'SYNTHETIC_B_HASH')",[A,B]);
 for(const [s,u]of[[S,A],[S2,A],[S3,A],[BS,B]])await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[s,u]);
 pass('Full55 dormant registration activates unchanged actual guards in memory against observed nullable varchar255');
 async function context(role,claims,fn){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims)]);await db.exec('set role '+role);try{return await fn();}finally{await db.exec('reset role;reset request.jwt.claims');}}
 const claims=(u,s)=>({sub:u,session_id:s,iss:api+'/auth/v1',aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600});
 const token=()=>{const c=claims(active.user,active.session),t=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify(c)).toString('base64url')+'.c3ludGhldGlj';tokens.set(t,c);return t;};
 const proof=(u,s)=>context('authenticated',claims(u,s),()=>value('select public.email_gate_current_session_verified() value'));
 const shape={begin_challenge:['p_user','p_session','p_challenge','p_code_mac','p_key_version','p_remember'],set_delivery:['p_user','p_session','p_challenge','p_delivered'],challenge_context:['p_user','p_session','p_challenge'],verify_challenge:['p_user','p_session','p_challenge','p_code_mac','p_device_digest'],restore_device:['p_user','p_session','p_device_digest'],revoke_device:['p_user','p_session','p_device_digest'],revoke_all:['p_user','p_session'],session_status:['p_user','p_session']};
 const json=(x,status=200)=>new MFResponse(JSON.stringify(x),{status,headers:{'content-type':'application/json'}});
 const outbound=async request=>{
  outboundCount++;const url=request.url;
  if(url===api+'/auth/v1/user'){
   const c=tokens.get((request.headers.get('authorization')||'').slice(7));assert(c);assert.equal(request.headers.get('apikey'),'sb_publishable_SYNTHETIC');
   return json({id:c.sub,email:c.sub===A?'runtime-a@example.invalid':'runtime-b@example.invalid',email_confirmed_at:new Date().toISOString()});
  }
  if(url.startsWith(api+'/rest/v1/rpc/email_gate_')){
   assert.equal(request.headers.get('authorization'),'Bearer sb_secret_SYNTHETIC');const name=url.split('email_gate_')[1],keys=shape[name];assert(keys);const args=await request.json();assert.deepEqual(Object.keys(args).sort(),keys.slice().sort());assert([A,B].includes(args.p_user));assert([S,S2,S3,BS].includes(args.p_session));
   return context('service_role',{role:'service_role'},async()=>{try{return json(await value('select public.email_gate_'+name+'('+keys.map((_,i)=>'$'+(i+1)).join(',')+') value',keys.map(k=>args[k])));}catch{return json({error:'SYNTHETIC_SQL_DENIAL'},400);}});
  }
  if(url==='https://accounts.zoho.com/oauth/v2/token')return json({access_token:'SYNTHETIC_ZOHO_TOKEN',expires_in:3600});
  if(url==='https://mail.zoho.com/api/accounts/12345678/messages'){
   const mail=await request.json();assert(['runtime-a@example.invalid','runtime-b@example.invalid'].includes(mail.toAddress));assert.equal(mail.fromAddress,'notification@example.invalid');codes.set(mail.toAddress,mail.content.match(/is (\d{6})\./)[1]);mailCount++;return mailFailure?json({status:{code:500}},500):json({status:{code:200}});
  }
  unexpected++;return json({error:'UNEXPECTED_NETWORK_DISABLED'},503);
 };
 const bindings={EMAIL_GATE_MODE:'STAGING_CONTROLLED_ONLY',EMAIL_GATE_PROJECT:'dczlddwbtgvfdujgcitb',EMAIL_GATE_ORIGIN:origin,EMAIL_GATE_RATE_PEPPER:'3a'.repeat(32),EMAIL_GATE_PEPPERS_JSON:JSON.stringify({v1:'2a'.repeat(32)}),EMAIL_GATE_KEY_VERSION:'v1',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_SYNTHETIC',ZOHO_MAIL_ORIGIN:'https://mail.zoho.com',ZOHO_ACCOUNTS_ORIGIN:'https://accounts.zoho.com',ZOHO_ACCOUNT_ID:'12345678',ZOHO_FROM_ADDRESS:'notification@example.invalid',ZOHO_CLIENT_ID:'SYNTHETIC_CLIENT',ZOHO_CLIENT_SECRET:'SYNTHETIC_CLIENT_SECRET',ZOHO_REFRESH_TOKEN:'SYNTHETIC_REFRESH_TOKEN',ZOHO_TEST_RECIPIENTS_JSON:'["runtime-a@example.invalid","runtime-b@example.invalid"]'};
 scratch=await mkdtemp(path.join(tmpdir(),'mushavo-current-worker-'));
 mf=new Miniflare({cf:false,host:'127.0.0.1',port:0,log:new Log(LogLevel.NONE),durableObjectsPersist:path.join(scratch,'state'),workers:[
  {name:'pages',modules:true,script:bundles.pages,compatibilityDate:'2026-07-01',bindings,durableObjects:{EMAIL_GATE_LIMITER_NS:{className:'EmailGatewayRateLimiter',scriptName:'limiter',useSQLite:true}},serviceBindings:{ASSETS:async request=>{assert.equal(request.headers.get('authorization'),null);assert.equal(request.headers.get('cookie'),null);return new MFResponse('STATIC_ASSET',{headers:{'content-type':'text/javascript','content-security-policy':"default-src 'none'"}});}},outboundService:outbound},
  {name:'limiter',modules:true,script:bundles.limiter,compatibilityDate:'2026-07-01',durableObjects:{SELF:{className:'EmailGatewayRateLimiter',useSQLite:true}},outboundService:()=>{unexpected++;return json({error:'UNEXPECTED_NETWORK_DISABLED'},503);}}
 ]});
 const call=(route,body={},cookie,extra={})=>mf.dispatchFetch(origin+'/api/email-verification/'+route,{method:'POST',headers:{origin,'content-type':'application/json','x-mushavo-csrf':'email-v1','cf-connecting-ip':'192.0.2.83',authorization:'Bearer '+token(),...(cookie?{cookie}:{}),...extra},body:JSON.stringify(body)});
 const status=async()=>{const r=await call('status');assert.equal(r.status,200);return(await r.json()).verified;};
 async function budget(){await db.query("update mushavo_email_auth.account_state set next_send_at='-infinity' where user_id=$1",[active.user]);await db.query('delete from mushavo_email_auth.send_events where user_id=$1',[active.user]);}
 async function begin(remember=true){await budget();const r=await call('begin',{remember});assert.equal(r.status,200);return await r.json();}
 async function verify(challenge){const r=await call('verify',{challengeId:challenge.challengeId,code:codes.get(active.user===A?'runtime-a@example.invalid':'runtime-b@example.invalid')});assert.equal(r.status,200);assert.deepEqual(await r.json(),{result:'VERIFIED'});return r.headers.get('set-cookie');}
 let r=await mf.dispatchFetch(origin+'/app.js',{headers:{authorization:'Bearer SYNTHETIC',cookie:'SYNTHETIC'}});assert.equal(await r.text(),'STATIC_ASSET');assert.equal(r.headers.get('content-security-policy'),"default-src 'none'");assert.equal(outboundCount,0);pass('Compiled static fallback preserves security headers and strips cookie and bearer before assets');
 assert.equal(await status(),false);assert.equal(await proof(A,S),false);pass('Actual runtime and actual SQL both deny password-only proof');
 r=await call('begin',{remember:true,p_user:B});assert.equal(r.status,400);assert.equal(mailCount,0);pass('Runtime refuses caller actor substitution without creating a challenge or mail');
 const challenge=await begin();assert.equal(mailCount,1);assert.equal(await proof(A,S),false);pass('Compiled HMAC challenge and Zoho adapter mark SQL delivery ready without granting proof');
 const code=codes.get('runtime-a@example.invalid');r=await call('verify',{challengeId:challenge.challengeId,code:code==='000000'?'111111':'000000'});assert.equal(r.status,400);assert.equal(await proof(A,S),false);assert.equal(await value('select attempts::int value from mushavo_email_auth.challenges where id=$1',[challenge.challengeId]),1);pass('Wrong code increments actual SQL attempts without granting a session proof');
 const fullCookie=await verify(challenge);assert(fullCookie.includes('Secure; HttpOnly; SameSite=Strict'));assert(!fullCookie.includes('Domain='));deviceCookie=fullCookie.split(';')[0];assert.equal(await status(),true);assert.equal(await proof(A,S),true);pass('Actual compiled verify creates real SQL proof and emits only an HttpOnly device cookie');
 r=await call('verify',{challengeId:challenge.challengeId,code});assert.equal(r.status,400);assert.equal(await value('select count(*)::int value from mushavo_email_auth.devices where user_id=$1',[A]),1);pass('Replaying a consumed code cannot create a second device');
 const expiry=await value('select expires_at::text value from mushavo_email_auth.devices where user_id=$1',[A]);active={user:A,session:S2};assert.equal(await status(),false);r=await call('restore',{},deviceCookie);assert.equal(r.status,200);assert.equal((await r.json()).result,'APPROVED');assert.equal(r.headers.get('set-cookie'),null);assert.equal(await proof(A,S2),true);assert.equal(await value('select expires_at::text value from mushavo_email_auth.devices where user_id=$1',[A]),expiry);pass('Fresh same-account session restores through real DO and SQL without sliding its deadline');
 active={user:B,session:BS};r=await call('restore',{},deviceCookie);assert.equal((await r.json()).result,'CODE_REQUIRED');assert.equal(await proof(B,BS),false);await verify(await begin());assert.equal(await proof(B,BS),true);pass('Another account cannot borrow a device and establishes its own independent email proof');
 active={user:A,session:S};r=await call('forget',{},deviceCookie);assert.equal(r.status,200);assert.equal((await r.json()).result,'FORGOTTEN');assert(r.headers.get('set-cookie').includes('Max-Age=0'));assert.equal(await proof(A,S),false);assert.equal(await proof(A,S2),false);assert.equal(await proof(B,BS),true);pass('Compiled forget clears selected cookie and both linked proofs while preserving another account');
 active={user:A,session:S3};r=await call('restore',{},deviceCookie);assert.equal((await r.json()).result,'CODE_REQUIRED');assert.equal(await proof(A,S3),false);pass('A forgotten device cannot reestablish a new session');
 active={user:A,session:S};deviceCookie=(await verify(await begin())).split(';')[0];r=await call('revoke-all',{},deviceCookie);assert.equal(r.status,200);assert.equal((await r.json()).result,'REVOKED');assert(r.headers.get('set-cookie').includes('Max-Age=0'));assert.equal(await proof(A,S),false);assert.equal(await proof(B,BS),true);pass('Compiled revoke-all removes actor approval and leaves another actor verified');
 deviceCookie=(await verify(await begin())).split(';')[0];await db.query('update auth.users set encrypted_password=$2 where id=$1',[A,'SYNTHETIC_CHANGED_HASH']);assert.equal(await status(),false);r=await call('restore',{},deviceCookie);assert.equal((await r.json()).result,'CODE_REQUIRED');assert.equal(await proof(B,BS),true);pass('Observed varchar password change invalidates actual SQL proof and compiled device restore');
 deviceCookie=(await verify(await begin())).split(';')[0];await db.query("update mushavo_email_auth.devices set verified_at=now()-interval '8 days',expires_at=now()-interval '1 day' where user_id=$1 and revoked_at is null",[A]);assert.equal(await status(),true);active={user:A,session:S3};r=await call('restore',{},deviceCookie);assert.equal((await r.json()).result,'CODE_REQUIRED');assert.equal(await proof(A,S3),false);pass('Expired seven-day device keeps an approved open session but cannot approve a new session');
 for(const route of['forget','revoke-all']){r=await call(route);assert.equal(r.status,403);}assert.equal(await proof(A,S),true);assert.equal(await proof(B,BS),true);pass('Unverified management calls are denied without revoking protected sessions');
 mailFailure=true;await budget();r=await call('begin',{remember:true});assert.equal(r.status,503);assert.equal(await proof(A,S3),false);assert.equal(await value("select count(*)::int value from mushavo_email_auth.challenges where user_id=$1 and session_id=$2 and state='failed'",[A,S3]),1);mailFailure=false;pass('Synthetic provider delivery failure leaves SQL challenge failed and session unapproved');
 const before=outboundCount;r=await call('status',{},undefined,{origin:'https://foreign.invalid'});assert.equal(r.status,403);assert.equal(outboundCount,before);pass('Foreign-origin runtime request fails before any Auth or SQL transport');
 const ownRows=await context('authenticated',claims(A,S3),()=>rows('select id from public.profiles where id=$1',[A]));const otherRows=await context('authenticated',claims(B,BS),()=>rows('select id from public.profiles where id=$1',[B]));assert.equal(ownRows.length,0);assert.equal(otherRows.length,1);pass('Actual restrictive profile RLS denies unverified data while retaining verified owner access');
 assert.equal(unexpected,0);assert.equal(await value('select count(*)::int value from auth.sessions'),4);assert.equal(await value('select count(*)::int value from public.app_admins'),0);pass('All outbound calls were intercepted; Auth sessions survive and no Admin role is assigned');
}catch(e){problem=e?.code==='ERR_ASSERTION'?'CURRENT_RUNTIME_ASSERTION_FAILED':'CURRENT_RUNTIME_OR_SQL_UNAVAILABLE';}
finally{
 try{if(mf)await mf.dispose();}catch{cleanup=false;}
 try{if(db)await db.close();}catch{cleanup=false;}
 try{if(scratch)await rm(scratch,{recursive:true,force:true});}catch{cleanup=false;}
}
const good=!problem&&cleanup&&checks.length===21;
console.log(JSON.stringify({stage_step:'FR.2.4.E4.16_CURRENT_WORKER_SQL_RUNTIME',result:good?'CURRENT_COMPILED_WORKER_AND_ACTUAL_SQL_SCOPED_PASS':'CURRENT_WORKER_SQL_RUNTIME_REVIEW_REQUIRED',scope:'ACTUAL_CURRENT_ESBUILD_WORKERD_SQLITE_DO_AND_ATOMIC55_PGLITE_SQL_WITH_SYNTHETIC_AUTH_AND_ZOHO_PORTS',node_version:process.version,tests:checks.length,pass:checks.length,fail:good?0:1,planned_tests:21,checks,bundle_sha256:bundleHashes||null,actual_hosted_requests:0,email_dispatched:false,synthetic_mail_adapter_calls:mailCount,unexpected_outbound_calls:unexpected,local_runtime_SQL_and_temporary_state_cleanup_completed:cleanup,Auth_JWT_signature_browser_cookie_jar_and_real_PostgreSQL_concurrency_verified:false,hosted_resources_SQL_roles_or_settings_changed:false,hosted_acceptance:false,live_activation_approved:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],problem_code:problem,exit_code:good?0:1},null,2));process.exitCode=good?0:1;
