// Actual compiled Pages Worker + integrated SQL + shared Edge session check.
// Auth, Zoho and the Durable Object network boundary are explicit synthetic ports.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {localDatabase} from '../scripts/lib/stage-3-local-db.mjs';
import {prepareReviewedEmailPlatform} from '../scripts/lib/email-reviewed-platform-fixture.mjs';
import {handoffSQL} from '../scripts/lib/email-registration-handoff-sql.mjs';
import {buildEmailWorkers} from '../scripts/lib/build-fr-2-email-workers.mjs';
import {modernWorker} from '../scripts/prepare-fr-2-email-modern-package.mjs';
import {requireEmailVerifiedSession,emailVerificationFailure} from '../supabase/functions/_shared/email-session-assurance.mjs';
const require=createRequire(process.env.MUSHAVO_EMAIL_G_WORKER_TOOLS+'/package.json');
const built=await buildEmailWorkers(require('esbuild'));
const worker=(await import('data:text/javascript;base64,'+Buffer.from(built.pages).toString('base64'))).default;
const {db}=await localDatabase(process.env.MUSHAVO_EMAIL_UI_PGLITE,{preparePlatform:prepareReviewedEmailPlatform});
const value=async(sql,args)=>(await db.query(sql,args)).rows[0]?.value;
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=id(12001),B=id(12002),S=id(12011),T=id(12012),U=id(12013),base='https://dczlddwbtgvfdujgcitb.supabase.co',origin='https://mushavo-budget-staging.pages.dev';
const json=(x,status=200)=>Response.json(x,{status});
const originalFetch=globalThis.fetch,calls=[];let unexpected=0,code,challenge,cookie,denyLimiter=false;
const rpcArgs={begin_challenge:['p_user','p_session','p_challenge','p_code_mac','p_key_version','p_remember'],set_delivery:['p_user','p_session','p_challenge','p_delivered'],
 challenge_context:['p_user','p_session','p_challenge'],verify_challenge:['p_user','p_session','p_challenge','p_code_mac','p_device_digest'],
 restore_device:['p_user','p_session','p_device_digest'],revoke_device:['p_user','p_session','p_device_digest'],revoke_all:['p_user','p_session'],session_status:['p_user','p_session']};
globalThis.fetch=async(url,init)=>{
 calls.push(url);assert.equal(init.redirect,'manual');
 if(url===base+'/auth/v1/user'){const claims=JSON.parse(Buffer.from(init.headers.authorization.slice(7).split('.')[1],'base64url').toString());return json({id:claims.sub,email:claims.sub===A?'compiled-a@example.invalid':'compiled-b@example.invalid',email_confirmed_at:new Date().toISOString()});}
 if(url.startsWith(base+'/rest/v1/rpc/email_gate_')){
  const name=url.slice((base+'/rest/v1/rpc/email_gate_').length),keys=rpcArgs[name];assert(keys);const body=JSON.parse(init.body);assert.deepEqual(Object.keys(body).sort(),keys.slice().sort());
  assert.equal(init.headers.apikey,'sb_secret_SYNTHETIC');assert.equal(init.headers.authorization,undefined);
  await db.exec('set role service_role');try{return json(await value('select public.email_gate_'+name+'('+keys.map((_,i)=>'$'+(i+1)).join(',')+') value',keys.map(k=>body[k])));}catch{return json({message:'SYNTHETIC_SQL_REFUSAL'},400);}finally{await db.exec('reset role');}
 }
 if(url==='https://accounts.zoho.com/oauth/v2/token')return json({access_token:'SYNTHETIC_ZOHO_ACCESS',expires_in:3600});
 if(url==='https://mail.zoho.com/api/accounts/12345678/messages'){code=JSON.parse(init.body).content.match(/is (\d{6})\./)[1];return json({status:{code:200}});}
 unexpected++;throw Error('UNEXPECTED_SYNTHETIC_PORT');
};
const env={EMAIL_GATE_MODE:'STAGING_CONTROLLED_ONLY',EMAIL_GATE_PROJECT:'dczlddwbtgvfdujgcitb',EMAIL_GATE_ORIGIN:origin,
 EMAIL_GATE_PEPPERS_JSON:JSON.stringify({v1:'2a'.repeat(32)}),EMAIL_GATE_KEY_VERSION:'v1',EMAIL_GATE_RATE_PEPPER:'3b'.repeat(32),
 SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_SYNTHETIC',ZOHO_MAIL_ORIGIN:'https://mail.zoho.com',ZOHO_ACCOUNTS_ORIGIN:'https://accounts.zoho.com',
 ZOHO_ACCOUNT_ID:'12345678',ZOHO_FROM_ADDRESS:'notification@example.invalid',ZOHO_CLIENT_ID:'SYNTHETIC_CLIENT',ZOHO_CLIENT_SECRET:'SYNTHETIC_CLIENT_SECRET',ZOHO_REFRESH_TOKEN:'SYNTHETIC_REFRESH',
 ZOHO_TEST_RECIPIENTS_JSON:JSON.stringify(['compiled-a@example.invalid','compiled-b@example.invalid']),
 EMAIL_GATE_LIMITER_NS:{idFromName:name=>name,get:()=>({fetch:async()=>json({success:!denyLimiter})})},
 ASSETS:{fetch:async request=>{assert.equal(request.headers.get('authorization'),null);assert.equal(request.headers.get('cookie'),null);return new Response('SYNTHETIC_STATIC');}}};
function request(user,session,route,body={},credential){const c={sub:user,session_id:session,role:'authenticated',aud:'authenticated',iss:base+'/auth/v1',exp:Math.floor(Date.now()/1000)+3600};
 const token=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify(c)).toString('base64url')+'.c3ludGhldGlj';
 const headers={'content-type':'application/json',origin,'x-mushavo-csrf':'email-v1','cf-connecting-ip':'192.0.2.1',authorization:'Bearer '+token};if(credential)headers.cookie=credential;
 return new Request(origin+'/api/email-verification/'+route,{method:'POST',headers,body:JSON.stringify(body)});
}
const send=(u,s,route,body={},credential)=>worker.fetch(request(u,s,route,body,credential),env);
const status=async(u,s)=>(await (await send(u,s,'status')).json()).verified;
const ack=action=>db.exec("set mushavo.email_rollout_project='dczlddwbtgvfdujgcitb';set mushavo.email_rollout_action='"+action+"'");
async function asUser(user,session,fn){await db.exec('begin');try{await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:user,session_id:session,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})]);await db.exec('set local role authenticated');return await fn();}finally{await db.exec('rollback');}}
function userClient(user,session){return {rpc:async name=>{assert.equal(name,'email_gate_current_session_verified');try{return {data:await asUser(user,session,()=>value('select public.email_gate_current_session_verified() value')),error:null};}catch{return {data:null,error:{message:'SYNTHETIC_RPC_REFUSAL'}};}}};}
test.after(async()=>{globalThis.fetch=originalFetch;await db.close();});
test('Actual rebuilt compiled Worker is byte-identical to the accepted frontend Worker',()=>{assert.equal(createHash('sha256').update(built.pages).digest('hex'),modernWorker);assert.equal(built.inputs.length,7);});
test('Actual existing54 canonical registration stays dormant before compiled gateway requests',async()=>{await db.exec((await handoffSQL()).write);assert.equal(await value('select mode value from mushavo_email_install.rollout_control'),'REGISTERED');await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'compiled-a@example.invalid',now()),($2,'compiled-b@example.invalid',now())",[A,B]);for(const [s,u]of [[S,A],[T,A],[U,B]])await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[s,u]);assert.equal(await value("select to_regnamespace('mushavo_email_auth') value"),null);});
test('Compiled Worker denies a missing bearer without backend Auth, SQL or mail requests',async()=>{const n=calls.length,r=request(A,S,'status');r.headers.delete('authorization');assert.equal((await worker.fetch(r,env)).status,401);assert.equal(calls.length,n);});
test('Shared deployed Edge session check fails unavailable while its SQL RPC is not installed',async()=>{await assert.rejects(requireEmailVerifiedSession(userClient(A,S)),e=>emailVerificationFailure(e)?.status===503);});
test('Compiled registered-only gateway refuses status/begin and never dispatches mail',async()=>{assert.equal((await send(A,S,'status')).status,503);assert.equal((await send(A,S,'begin',{remember:true})).status,503);assert(!calls.some(u=>u.startsWith('https://mail.zoho.com/')));});
test('Actual integrated activation installs all148 RPC guards and82 policies in quarantine',async()=>{await ack('ACTIVATE_STAGING_EMAIL_QUARANTINED');const result=await value('select mushavo_email_install.activate() value');assert.equal(result.guarded_RPCs,148);assert.equal(result.restrictive_policies,82);assert.equal(await value('select mode value from mushavo_email_install.rollout_control'),'QUARANTINED');});
test('Compiled gateway records actual code proof during quarantine while session status/data and shared Edge gate stay blocked',async()=>{const b=await send(A,S,'begin',{remember:true});assert.equal(b.status,200);challenge=(await b.json()).challengeId;const v=await send(A,S,'verify',{challengeId:challenge,code});assert.equal(v.status,200);cookie=v.headers.get('set-cookie').split(';')[0];assert.equal(await value('select count(*)::int value from mushavo_email_auth.session_proofs'),1);assert.equal(await status(A,S),false);await assert.rejects(requireEmailVerifiedSession(userClient(A,S)),e=>emailVerificationFailure(e)?.status===403);assert.equal((await asUser(A,S,async()=>(await db.query('select id from public.profiles')).rows)).length,0);});
test('Explicit unchanged-catalog resume makes the compiled gateway, shared Edge check and own-row access agree',async()=>{await ack('RESUME_STAGING_EMAIL');assert.equal((await value('select mushavo_email_install.resume() value')).catalog_identity_matched,true);assert.equal(await status(A,S),true);await requireEmailVerifiedSession(userClient(A,S));assert.deepEqual(await asUser(A,S,async()=>(await db.query('select id from public.profiles')).rows),[{id:A}]);});
test('Other account and fresh unverified session remain blocked by the real shared Edge RPC check',async()=>{for(const [u,s]of [[A,T],[B,U]]){assert.equal(await status(u,s),false);await assert.rejects(requireEmailVerifiedSession(userClient(u,s)),e=>emailVerificationFailure(e)?.status===403);}});
test('Compiled remembered-device restore binds a fresh same-account session without extending actual expiry',async()=>{const before=await value('select expires_at::text value from mushavo_email_auth.devices where user_id=$1',[A]);assert.equal((await (await send(A,T,'restore',{},cookie)).json()).result,'APPROVED');assert.equal(await status(A,T),true);await requireEmailVerifiedSession(userClient(A,T));assert.equal(await value('select expires_at::text value from mushavo_email_auth.devices where user_id=$1',[A]),before);});
test('Renaming the compiled cookie for another account cannot cross the actual SQL owner boundary',async()=>{const renamed=cookie.replace(A.replaceAll('-',''),B.replaceAll('-',''));assert.equal((await (await send(B,U,'restore',{},renamed)).json()).result,'CODE_REQUIRED');assert.equal(await status(B,U),false);});
test('Committed quarantine retains proofs but blocks compiled gateway status, shared Edge access and application rows',async()=>{const count=await value('select count(*)::int value from mushavo_email_auth.session_proofs');await ack('QUARANTINE_STAGING_EMAIL');await value('select mushavo_email_install.quarantine() value');assert.equal(await value('select count(*)::int value from mushavo_email_auth.session_proofs'),count);assert.equal(await status(A,S),false);await assert.rejects(requireEmailVerifiedSession(userClient(A,S)),e=>emailVerificationFailure(e)?.status===403);assert.equal((await asUser(A,S,async()=>(await db.query('select id from public.profiles')).rows)).length,0);});
test('Selected catalog drift blocks resume and the compiled gateway stays unverified',async()=>{await ack('RESUME_STAGING_EMAIL');await db.exec('begin;grant usage on schema mushavo_email_install to authenticated');try{await assert.rejects(value('select mushavo_email_install.resume() value'),/EMAIL_STAGING_CATALOG_DRIFT_REVIEW_REQUIRED/);}finally{await db.exec('rollback');}assert.equal(await status(A,S),false);});
test('Unchanged recovery restores the retained session proof and shared Edge access without password-only bypass',async()=>{await value('select mushavo_email_install.resume() value');assert.equal(await status(A,S),true);await requireEmailVerifiedSession(userClient(A,S));assert.equal(await status(B,U),false);});
test('Compiled device revocation invalidates actual original/restored proofs and shared Edge authorization',async()=>{assert.equal((await send(A,S,'forget',{},cookie)).status,200);for(const s of [S,T]){assert.equal(await status(A,s),false);await assert.rejects(requireEmailVerifiedSession(userClient(A,s)),e=>emailVerificationFailure(e)?.status===403);}});
test('Compiled limiter denial fails before Auth/SQL/mail transport',async()=>{denyLimiter=true;const n=calls.length;try{assert.equal((await send(A,S,'begin',{remember:false})).status,429);assert.equal(calls.length,n);}finally{denyLimiter=false;}});
test('Compiled static routing strips credentials and every upstream request stayed inside explicit synthetic ports',async()=>{const r=await worker.fetch(new Request(origin+'/app.html',{headers:{authorization:'Bearer PRIVATE_SENTINEL',cookie:'PRIVATE_SENTINEL'}}),env);assert.equal(await r.text(),'SYNTHETIC_STATIC');assert.equal(unexpected,0);assert(calls.every(u=>u===base+'/auth/v1/user'||u.startsWith(base+'/rest/v1/rpc/email_gate_')||u==='https://accounts.zoho.com/oauth/v2/token'||u==='https://mail.zoho.com/api/accounts/12345678/messages'));});
