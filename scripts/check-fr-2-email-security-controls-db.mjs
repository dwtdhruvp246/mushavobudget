// Actual new device actions -> actual gateway -> full54 SQL. Auth, cookie jars and mail are synthetic ports.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
import {createEmailVerification} from '../email-verification.js';
import {createBackendAdapter,createEmailGateway,STAGING_PROJECT,STAGING_ORIGIN} from '../supabase/functions/_shared/email-verification-gateway.mjs';
const {db,migrations}=await localDatabase(process.env.MUSHAVO_EMAIL_UI_PGLITE);
test.after(async()=>{await db.close();});
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=id(971),B=id(972),S=id(981),S2=id(982),S3=id(983),S4=id(984),BS=id(985),S5=id(986);
let active={user:A,session:S},latestCode,mailCount=0,selectedToken,browser='one';const cookies=new Map();
const claims=(user,session)=>({sub:user,session_id:session,role:'authenticated',aud:'authenticated',iss:'https://'+STAGING_PROJECT+'.supabase.co/auth/v1',exp:Math.floor(Date.now()/1000)+3600});
const jwt=c=>Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')+'.'+Buffer.from(JSON.stringify(c)).toString('base64url')+'.c3ludGhldGlj';
const tokens=new Map();
const session=()=>{const key=active.user+':'+active.session;if(!tokens.has(key))tokens.set(key,jwt(claims(active.user,active.session)));return{user:{id:active.user},access_token:tokens.get(key)};};
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json'}});
async function context(role,c,fn){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(c)]);await db.exec('set role '+role);try{return await fn();}finally{await db.exec('reset role;reset request.jwt.claims');}}
const shape={begin_challenge:['p_user','p_session','p_challenge','p_code_mac','p_key_version','p_remember'],set_delivery:['p_user','p_session','p_challenge','p_delivered'],challenge_context:['p_user','p_session','p_challenge'],verify_challenge:['p_user','p_session','p_challenge','p_code_mac','p_device_digest'],restore_device:['p_user','p_session','p_device_digest'],revoke_device:['p_user','p_session','p_device_digest'],revoke_all:['p_user','p_session'],session_status:['p_user','p_session']};
const provider=async(url,init)=>{
 if(url.endsWith('/auth/v1/user')){const c=JSON.parse(Buffer.from(init.headers.authorization.slice(7).split('.')[1],'base64url'));return json({id:c.sub,email:c.sub===A?'ui.a@example.invalid':'ui.b@example.invalid',email_confirmed_at:new Date().toISOString()});}
 const name=url.split('/email_gate_')[1],args=JSON.parse(init.body),keys=shape[name];assert(keys);assert.deepEqual(Object.keys(args).sort(),keys.slice().sort());
 return context('service_role',{role:'service_role'},async()=>{try{return json((await db.query('select public.email_gate_'+name+'('+keys.map((_,i)=>'$'+(i+1)).join(',')+') value',keys.map(k=>args[k]))).rows[0].value);}catch{return json({error:'SYNTHETIC_SQL_DENIAL'},400);}});
};
const gateway=createEmailGateway({adapter:createBackendAdapter({fetcher:provider,publishableKey:'sb_publishable_SYNTHETIC',serviceKey:'sb_secret_SYNTHETIC'}),mailer:async({code})=>{latestCode=code;mailCount++;return{accepted:true};},keyring:new Map([['ui_v1',new Uint8Array(32).fill(42)]]),currentKeyVersion:'ui_v1',limit:async()=>({success:true})});
const browserFetch=async(url,init)=>{
 selectedToken=init.headers.Authorization.slice(7);const headers=new Headers(init.headers);headers.set('origin',STAGING_ORIGIN);headers.set('cf-connecting-ip','192.0.2.55');const cookie=cookies.get(browser+':'+active.user);if(cookie)headers.set('cookie',cookie);
 const response=await gateway(new Request(url,{...init,headers}));
 const setCookie=response.headers.get('set-cookie');if(setCookie)cookies.set(browser+':'+active.user,/Max-Age=0(?:;|$)/i.test(setCookie)?null:setCookie.split(';')[0]);return response;
};
function ui(requireAdmin=false){const states=[],unlocks=[];const c=createEmailVerification({client:{rpc:async name=>{
 assert(['email_gate_current_session_verified','email_gate_admin_status'].includes(name));return context('authenticated',claims(active.user,active.session),async()=>{try{return{data:(await db.query('select public.'+name+'() value')).rows[0].value,error:null};}catch{return{data:null,error:{code:'SYNTHETIC_SQL_DENIAL'}};}});
 }},getSession:session,fetcher:browserFetch,origin:STAGING_ORIGIN,requireAdmin,onState:x=>states.push(x),onUnlocked:x=>unlocks.push(x)});return{c,states,unlocks};}
async function budget(){await db.query("update mushavo_email_auth.account_state set next_send_at='-infinity' where user_id=$1",[active.user]);await db.query('delete from mushavo_email_auth.send_events where user_id=$1',[active.user]);}
const status=()=>context('authenticated',claims(active.user,active.session),async()=>(await db.query('select public.email_gate_admin_status() value')).rows[0].value);
const sessionValid=(user,session)=>context('authenticated',claims(user,session),async()=>(await db.query('select public.email_gate_current_session_verified() value')).rows[0].value);
async function unlock(remember,requireAdmin=false){await budget();const h=ui(requireAdmin);await h.c.requestCode(remember);assert.equal(await h.c.verify(latestCode),true);return h;}
let first,second,independent,other,originalDeviceDeadlines;
test('Full54 SQL and all existing email guards compile; only synthetic account/session fixtures are created',async()=>{
 assert.equal(migrations.length,54);
 await db.exec("alter table auth.users add column email_confirmed_at timestamptz,add column encrypted_password text,add column banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);set mushavo.email_backend_review='OFFLINE_SOURCE_CANDIDATE';set mushavo.email_session_review='OFFLINE_SOURCE_CANDIDATE';set mushavo.email_data_guard_review='OFFLINE_SOURCE_CANDIDATE';set mushavo.email_admin_review='OFFLINE_SOURCE_CANDIDATE';");
 for(const part of['verification_backend','session_predicate','data_guards','admin_status'])await db.exec(await readFile(path.join(root,'supabase/candidates/security_fr_2_4_email_'+part+'.sql'),'utf8'));
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'ui.a@example.invalid',now()),($2,'ui.b@example.invalid',now())",[A,B]);
 for(const [s,u]of[[S,A],[S2,A],[S3,A],[S4,A],[S5,A],[BS,B]])await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[s,u]);
 await db.query("insert into public.app_admins(user_id,email,role) values($1,'ui.a@example.invalid','super_admin')",[A]);
 assert.equal((await db.query('select count(*)::int n from auth.sessions')).rows[0].n,6);
});
test('Password-only direct forget and revoke-all requests are denied by the real gateway without approval changes',async()=>{
 for(const route of['forget','revoke-all']){
  const response=await browserFetch(STAGING_ORIGIN+'/api/email-verification/'+route,{method:'POST',headers:{Authorization:'Bearer '+session().access_token,'Content-Type':'application/json','X-Mushavo-CSRF':'email-v1'},body:'{}'});
  assert.equal(response.status,403);
 }
 assert.equal((await db.query('select count(*)::int n from mushavo_email_auth.session_proofs')).rows[0].n,0);assert.equal(mailCount,0);
});
test('Actual controller establishes initial Admin email proof and a remembered device through actual gateway SQL',async()=>{
 first=await unlock(true,true);assert.equal((await status()).role,'super_admin');assert(cookies.get('one:'+A));assert.equal(await sessionValid(A,S),true);
});
test('A second session restores the same fixed-expiry device; independent device/email sessions and another account remain distinct',async()=>{
 active={user:A,session:S2};const count=mailCount;assert.equal(await ui().c.prepare(),true);assert.equal(mailCount,count);
 browser='two';active={user:A,session:S3};second=await unlock(true,true);
 browser='email';active={user:A,session:S4};independent=await unlock(false,true);
 browser='other';active={user:B,session:BS};other=await unlock(true);
 originalDeviceDeadlines=(await db.query('select id,expires_at::text expiry from mushavo_email_auth.devices order by id')).rows;
 assert.equal(originalDeviceDeadlines.length,3);assert.equal(await sessionValid(A,S2),true);
});
test('Forget removes the selected device cookie and both device-linked proofs while preserving independent sessions',async()=>{
 browser='one';active={user:A,session:S};const count=mailCount;
 assert.deepEqual(await first.c.manageDevice('forget',true),{result:'FORGOTTEN',verified:false});
 assert.equal(cookies.get('one:'+A),null);assert.equal(await sessionValid(A,S),false);assert.equal(await sessionValid(A,S2),false);
 for(const [u,s]of[[A,S3],[A,S4],[B,BS]])assert.equal(await sessionValid(u,s),true);
 assert.equal(mailCount,count);assert.equal((await db.query('select count(*)::int n from auth.sessions')).rows[0].n,6);
});
test('A forgotten device cannot restore the second session and does not send a code automatically',async()=>{
 browser='one';active={user:A,session:S2};const count=mailCount;assert.equal(await ui().c.prepare(),false);assert.equal(mailCount,count);
});
test('Forget with no selected cookie preserves an independent email proof after real server readback',async()=>{
 browser='email';active={user:A,session:S4};const count=mailCount;
 assert.deepEqual(await independent.c.manageDevice('forget',true),{result:'FORGOTTEN',verified:true});assert.equal(await sessionValid(A,S4),true);assert.equal(mailCount,count);
});
test('Revoke-all removes every same-account proof and device approval while another account retains access',async()=>{
 browser='two';active={user:A,session:S3};const count=mailCount;
 assert.deepEqual(await second.c.manageDevice('revoke-all',true),{result:'REVOKED',verified:false});
 for(const s of[S,S2,S3,S4,S5])assert.equal(await sessionValid(A,s),false);
 assert.equal(await sessionValid(B,BS),true);assert.equal(cookies.get('two:'+A),null);assert.equal(mailCount,count);
 assert.equal((await db.query('select count(*)::int n from auth.sessions')).rows[0].n,6);
});
test('Existing Auth sessions with revoked email proof cannot read their own protected profile',async()=>{
 const rows=await context('authenticated',claims(A,S4),async()=>(await db.query('select id from public.profiles where id=$1',[A])).rows);assert.equal(rows.length,0);
 const otherRows=await context('authenticated',claims(B,BS),async()=>(await db.query('select id from public.profiles where id=$1',[B])).rows);assert.equal(otherRows.length,1);
});
test('Revoked remembered approval cannot restore a new session or extend any original device deadline',async()=>{
 browser='two';active={user:A,session:S5};const count=mailCount;assert.equal(await ui().c.prepare(),false);assert.equal(mailCount,count);
 assert.deepEqual((await db.query('select id,expires_at::text expiry from mushavo_email_auth.devices order by id')).rows,originalDeviceDeadlines);
});
test('A fresh explicit code restores only its selected session and preserves the existing platform role',async()=>{
 browser='two';active={user:A,session:S3};second=await unlock(false,true);assert.equal(await sessionValid(A,S3),true);assert.equal(await sessionValid(A,S4),false);assert.equal((await status()).role,'super_admin');assert.equal(await sessionValid(B,BS),true);
 assert.equal((await db.query('select count(*)::int n from public.app_admins')).rows[0].n,1);assert.equal((await db.query('select count(*)::int n from auth.mfa_factors')).rows[0].n,0);
});
