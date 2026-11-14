// Browser controller -> actual gateway -> actual SQL. Auth, cookie jar and mail are explicit synthetic ports.
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
const A=id(971),B=id(972),S=id(981),S2=id(982),S3=id(983),S4=id(984),BS=id(985);
let active={user:A,session:S},latestCode,cookie,mailCount=0,selectedToken;
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
 selectedToken=init.headers.Authorization.slice(7);const headers=new Headers(init.headers);headers.set('origin',STAGING_ORIGIN);headers.set('cf-connecting-ip','192.0.2.55');if(cookie)headers.set('cookie',cookie);
 const response=await gateway(new Request(url,{...init,headers}));
 const setCookie=response.headers.get('set-cookie');if(setCookie)cookie=/Max-Age=0(?:;|$)/i.test(setCookie)?null:setCookie.split(';')[0];return response;
};
function ui(requireAdmin=false){const states=[],unlocks=[];const c=createEmailVerification({client:{rpc:async name=>{
 assert(['email_gate_current_session_verified','email_gate_admin_status'].includes(name));return context('authenticated',claims(active.user,active.session),async()=>{try{return{data:(await db.query('select public.'+name+'() value')).rows[0].value,error:null};}catch{return{data:null,error:{code:'SYNTHETIC_SQL_DENIAL'}};}});
 }},getSession:session,fetcher:browserFetch,origin:STAGING_ORIGIN,requireAdmin,onState:x=>states.push(x),onUnlocked:x=>unlocks.push(x)});return{c,states,unlocks};}
async function budget(){await db.query("update mushavo_email_auth.account_state set next_send_at='-infinity' where user_id=$1",[active.user]);await db.query('delete from mushavo_email_auth.send_events where user_id=$1',[active.user]);}
const status=()=>context('authenticated',claims(active.user,active.session),async()=>(await db.query('select public.email_gate_admin_status() value')).rows[0].value);
const candidate=await readFile(path.join(root,'supabase/candidates/security_fr_2_4_email_admin_status.sql'),'utf8');
let before;
test('New Admin status requires its offline acknowledgement and all prior database guards',async()=>{
 assert.equal(migrations.length,54);await assert.rejects(db.exec(candidate),/EMAIL_ADMIN_OFFLINE_REVIEW_ACK_REQUIRED/);await db.exec('rollback');
 await db.exec("set mushavo.email_admin_review='OFFLINE_SOURCE_CANDIDATE'");await assert.rejects(db.exec(candidate),/EMAIL_ADMIN_DATABASE_GUARDS_REQUIRED/);await db.exec('rollback');
 await db.exec(`alter table auth.users add column email_confirmed_at timestamptz,add column encrypted_password text,add column banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);set mushavo.email_backend_review='OFFLINE_SOURCE_CANDIDATE';set mushavo.email_session_review='OFFLINE_SOURCE_CANDIDATE';set mushavo.email_data_guard_review='OFFLINE_SOURCE_CANDIDATE';`);
 for(const name of['verification_backend','session_predicate','data_guards'])await db.exec(await readFile(path.join(root,'supabase/candidates/security_fr_2_4_email_'+name+'.sql'),'utf8'));
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'ui.a@example.invalid',now()),($2,'ui.b@example.invalid',now())",[A,B]);
 for(const [s,u]of[[S,A],[S2,A],[S3,A],[S4,A],[BS,B]])await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[s,u]);
 before=(await db.query("select oid,prosrc,proacl::text acl,proconfig from pg_proc where pronamespace='public'::regnamespace order by oid")).rows;
});
test('Installing the new status preserves every prior public routine body, ACL and setting',async()=>{
 await db.exec(candidate);const after=(await db.query("select oid,prosrc,proacl::text acl,proconfig from pg_proc where pronamespace='public'::regnamespace and proname<>'email_gate_admin_status' order by oid")).rows;assert.deepEqual(after,before);
 assert.equal((await db.query("select count(*)::int n from pg_policies where policyname='Email verified session required'")).rows[0].n,82);
});
test('Reinstallation and API-role installation are rejected without replacing the status',async()=>{
 await assert.rejects(db.exec(candidate),/EMAIL_ADMIN_STATUS_ALREADY_PRESENT/);await db.exec('rollback');await db.exec('set role authenticated');try{await assert.rejects(db.exec(candidate),/EMAIL_ADMIN_POSTGRES_ORIGIN_REQUIRED/);await db.exec('rollback');}finally{await db.exec('reset role');}
});
test('Only authenticated can call Admin status; anonymous and service roles have no grant',async()=>{
 for(const role of['anon','service_role']){assert.equal((await db.query("select has_function_privilege($1,'public.email_gate_admin_status()','EXECUTE') value",[role])).rows[0].value,false);await context(role,{role},()=>assert.rejects(db.query('select public.email_gate_admin_status()'),e=>e.code==='42501'));}
});
test('Password-only Admin status hides role and browser restore sends no email automatically',async()=>{
 await db.query("insert into public.app_admins(user_id,email,role) values($1,'ui.a@example.invalid','super_admin')",[A]);
 assert.deepEqual(await status(),{contract:1,verified:false,authorized:false,role:null});const h=ui(true);assert.equal(await h.c.prepare(),false);assert.equal(mailCount,0);assert.equal(h.states.at(-1).phase,'locked');
});
test('Actual browser code flow through gateway and SQL unlocks an existing Admin only after stored proof',async()=>{
 const h=ui(true);await h.c.requestCode(true);assert.equal(mailCount,1);assert.equal(h.c.authorized,false);assert.match(latestCode,/^\d{6}$/);
 assert.equal(await h.c.verify(latestCode),true);assert.equal(h.unlocks.length,1);assert(h.unlocks[0].ticket());assert.deepEqual(await status(),{contract:1,verified:true,authorized:true,role:'super_admin'});assert.equal(selectedToken,session().access_token);assert(cookie?.startsWith('__Host-mushavo_device_'));
});
test('Verified Admin status keeps all four exact platform roles and never elevates a missing assignment',async()=>{
 for(const role of['super_admin','admin_staff','finance_staff','support_staff']){await db.query('update public.app_admins set role=$2 where user_id=$1',[A,role]);assert.equal((await status()).role,role);assert.equal(await ui(true).c.check(),true);}
 await db.query('delete from public.app_admins where user_id=$1',[A]);const h=ui(true);assert.equal(await h.c.check(),false);assert.equal(h.states.at(-1).phase,'forbidden');assert.deepEqual(await status(),{contract:1,verified:true,authorized:false,role:null});assert.equal(await ui(false).c.check(),true);
});
test('A remembered-device restore creates proof for a fresh same-account session without another email',async()=>{
 active.session=S2;const count=mailCount;const beforeExpiry=(await db.query('select expires_at::text value from mushavo_email_auth.devices where user_id=$1',[A])).rows[0].value;
 assert.equal(await ui(false).c.prepare(),true);assert.equal(mailCount,count);assert.equal((await db.query('select expires_at::text value from mushavo_email_auth.devices where user_id=$1',[A])).rows[0].value,beforeExpiry);
});
test('A foreign account cannot borrow the remembered device or gain Admin access',async()=>{
 active={user:B,session:BS};const h=ui(true);assert.equal(await h.c.prepare(),false);assert.equal(h.states.at(-1).phase,'locked');assert.deepEqual(await status(),{contract:1,verified:false,authorized:false,role:null});active={user:A,session:S2};
});
test('Day-seven expiry preserves an open verified session but a new sign-in requires a code',async()=>{
 await db.query("update mushavo_email_auth.devices set verified_at=now()-interval '8 days',expires_at=now()-interval '1 day' where user_id=$1",[A]);assert.equal(await ui(false).c.prepare(),true);
 active.session=S3;const count=mailCount;const h=ui(false);assert.equal(await h.c.prepare(),false);assert.equal(h.states.at(-1).phase,'locked');assert.equal(mailCount,count);
});
test('A real SQL verification with remember off creates no new reusable device and clears its cookie',async()=>{
 await budget();const h=ui(false);await h.c.requestCode(false);assert.equal(await h.c.verify(latestCode),true);assert.equal(cookie,null);assert.equal((await db.query('select count(*)::int n from mushavo_email_auth.devices where user_id=$1',[A])).rows[0].n,1);
});
test('Password invalidation blocks the open browser proof and Admin status despite a still-accepted synthetic bearer',async()=>{
 await db.query("update auth.users set encrypted_password='SYNTHETIC_CHANGED_HASH' where id=$1",[A]);const h=ui(false);assert.equal(await h.c.check(),false);assert.deepEqual(await status(),{contract:1,verified:false,authorized:false,role:null});
});
test('Suspension and reactivation do not revive an earlier stored proof',async()=>{
 await budget();const h=ui(false);await h.c.requestCode(false);assert.equal(await h.c.verify(latestCode),true);await db.query("update public.profiles set account_status='suspended' where id=$1",[A]);assert.equal(await h.c.check(),false);await db.query("update public.profiles set account_status='active' where id=$1",[A]);assert.equal(await h.c.check(),false);
});
test('Forged AAL2, role and client approval claims cannot supply proof or disclose an assignment',async()=>{
 await db.query("insert into public.app_admins(user_id,email,role) values($1,'ui.a@example.invalid','super_admin')",[A]);
 const result=await context('authenticated',{...claims(A,S4),aal:'aal2',platform_role:'super_admin',email_verified:true},async()=>(await db.query('select public.email_gate_admin_status() value')).rows[0].value);assert.deepEqual(result,{contract:1,verified:false,authorized:false,role:null});
});
