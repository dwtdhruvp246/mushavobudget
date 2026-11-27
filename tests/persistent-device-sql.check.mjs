import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const modulePath=process.env.MUSHAVO_PGLITE_MODULE;
if(!modulePath)throw Error('PINNED_PGLITE_MODULE_REQUIRED');
const {PGlite}=await import(pathToFileURL(modulePath).href);
const root=new URL('../',import.meta.url),sql=name=>fs.readFileSync(new URL(name,root),'utf8');
const base=sql('supabase/candidates/security_fr_2_4_email_verification_backend.sql');
const component=sql('supabase/candidates/security_fr_2_5_persistent_device_component.sql');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=id(1),B=id(2),UNCONFIRMED=id(3),digest=n=>String(n).repeat(64);
let db,legacySource,proofTime,seq=100;
const one=async(query,args=[])=> (await db.query(query,args)).rows[0];
async function session(user=A){const value=id(++seq);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[value,user]);return value;}
async function service(name,args){await db.exec('set role service_role');try{return(await one('select public.email_gate_'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') value',args)).value;}finally{await db.exec('reset role');}}
const register=(s,d,allow=true,time=proofTime,user=A)=>service('register_link_device',[user,s,d,time,allow]);
before(async()=>{
 db=new PGlite();
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,encrypted_password text,banned_until timestamptz);create table auth.sessions(id uuid primary key,user_id uuid references auth.users on delete cascade,not_after timestamptz);create table public.profiles(id uuid primary key,account_status text);set mushavo.email_backend_review='OFFLINE_SOURCE_CANDIDATE'");
 await db.exec(base);
 legacySource=(await one("select prosrc from pg_proc where oid='mushavo_email_auth.session_valid(uuid,uuid)'::regprocedure")).prosrc;
 await db.query("insert into auth.users values($1,'primary@example.invalid',clock_timestamp(),'HASH',null),($2,'other@example.invalid',clock_timestamp(),'HASH',null),($3,'unconfirmed@example.invalid',null,'HASH',null)",[A,B,UNCONFIRMED]);
 await db.query("insert into public.profiles values($1,'active'),($2,'active'),($3,'active')",[A,B,UNCONFIRMED]);
 // Existing valid, expired and revoked approvals exercise migration without reviving invalid trust.
 await db.query('insert into mushavo_email_auth.account_state(user_id) values($1),($2)',[A,B]);
 await db.query("insert into mushavo_email_auth.devices(user_id,credential_digest,security_version,origin_challenge_id,verified_at,expires_at,revoked_at) values($1,$2,1,$3,now()-interval '1 day',now()+interval '6 days',null),($1,$4,1,$5,now()-interval '8 days',now()-interval '1 day',null),($1,$6,1,$7,now()-interval '1 day',now()+interval '6 days',now())",[A,digest('a'),id(11),digest('b'),id(12),digest('c'),id(13)]);
 await assert.rejects(db.exec(component),/COMPONENT_ACK_REQUIRED/);
 await db.exec("set mushavo.persistent_device_component='VERIFIED_INSTALLER_OR_OFFLINE_REVIEW'");
 await db.exec(component);
 // New confirmation follows the upgrade; AMR has second precision.
 proofTime=(await one("select date_trunc('second',clock_timestamp()+interval '2 seconds')::text value")).value;
 await db.query('update auth.users set email_confirmed_at=$1 where id=any($2::uuid[])',[proofTime,[A,B]]);
});
after(async()=>{await db?.close();});

test('upgrade makes only valid existing approvals permanent and keeps application predicate unchanged',async()=>{
 const rows=(await db.query('select credential_digest,expires_at::text deadline,revoked_at is not null revoked from mushavo_email_auth.devices order by credential_digest')).rows;
 assert.equal(rows[0].deadline,'infinity');assert.notEqual(rows[1].deadline,'infinity');assert.equal(rows[2].revoked,true);
 assert.equal((await one("select prosrc from pg_proc where oid='mushavo_email_auth.session_valid(uuid,uuid)'::regprocedure")).prosrc,legacySource);
});
test('signup-link enrollment is idempotent for one browser, permanent and does not grant application proof',async()=>{
 const s=await session();assert.equal((await register(s,digest('d'),false)).result,'PENDING_REQUIRED');
 assert.equal((await register(s,digest('d'))).result,'TRUSTED');assert.equal((await register(s,digest('d'))).result,'TRUSTED');
 assert.equal((await register(s,digest('e'))).result,'LINK_ALREADY_REGISTERED');
 assert.equal((await one('select count(*)::int n from mushavo_email_auth.devices where origin_link_session=$1',[s])).n,1);
 assert.equal(await service('session_status',[A,s]),false);
 const row=await one('select expires_at::text deadline,enrollment_method,origin_challenge_id from mushavo_email_auth.devices where origin_link_session=$1',[s]);
 assert.equal(row.deadline,'infinity');assert.equal(row.enrollment_method,'signup_link');assert.equal(row.origin_challenge_id,null);
});
test('the cookie for the browser that opened the link restores a fresh password session without a code',async()=>{
 const link=await session();assert.equal((await register(link,digest('f'))).result,'TRUSTED');
 await db.query('delete from auth.sessions where id=$1',[link]);
 const passwordSession=await session();assert.equal((await service('restore_device',[A,passwordSession,digest('f')])).result,'APPROVED');
 assert.equal(await service('session_status',[A,passwordSession]),true);
});
test('an unregistered browser and a different account still require verification',async()=>{
 const a=await session(),b=await session(B);
 assert.equal((await service('restore_device',[A,a,digest('0')])).result,'CODE_REQUIRED');
 assert.equal((await service('restore_device',[B,b,digest('f')])).result,'CODE_REQUIRED');
 assert.equal(await service('session_status',[A,a]),false);assert.equal(await service('session_status',[B,b]),false);
});
test('server trust survives far beyond seven days without extending Auth session lifetimes',async()=>{
 const s=await session();await db.query("update mushavo_email_auth.devices set verified_at=now()-interval '800 days' where credential_digest=$1",[digest('f')]);
 const result=await service('restore_device',[A,s,digest('f')]);assert.equal(result.result,'APPROVED');assert.equal(result.device_persistent,true);assert.equal(result.device_expires_at,null);
 await db.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[s]);
 await assert.rejects(service('restore_device',[A,s,digest('f')]),/ACTIVE_AUTH_SESSION_REQUIRED/);
 assert.equal(await service('session_status',[A,s]),false);
});
test('stale, future, absent and nonfinite link proof cannot enroll a browser',async()=>{
 const s=await session();
 for(const time of [null,'-infinity','infinity',new Date(Date.now()-600000).toISOString(),new Date(Date.now()+600000).toISOString()])assert.equal((await register(s,digest('1'),true,time)).result,'LINK_PROOF_REQUIRED');
 assert.equal((await one('select count(*)::int n from mushavo_email_auth.devices where origin_link_session=$1',[s])).n,0);
});
test('foreign, unconfirmed and suspended identities cannot create approval',async()=>{
 const s=await session(),u=await session(UNCONFIRMED);
 await assert.rejects(register(s,digest('2'),true,proofTime,B),/ACTIVE_AUTH_SESSION_REQUIRED/);
 await assert.rejects(register(u,digest('2'),true,proofTime,UNCONFIRMED),/ACTIVE_AUTH_SESSION_REQUIRED/);
 await db.query("update public.profiles set account_status='suspended' where id=$1",[B]);
 await assert.rejects(register(await session(B),digest('2'),true,proofTime,B),/ACTIVE_AUTH_SESSION_REQUIRED/);
 await db.query("update public.profiles set account_status='active' where id=$1",[B]);
});
test('direct anonymous or authenticated callers cannot enroll themselves or read device credentials',async()=>{
 const s=await session();
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);
  try{await assert.rejects(db.query('select public.email_gate_register_link_device($1,$2,$3,$4,true)',[A,s,digest('3'),proofTime]),/permission denied/);await assert.rejects(db.query('select * from mushavo_email_auth.devices'),/permission denied/);}
  finally{await db.exec('reset role');}
 }
});
test('new-device code verification creates permanent approval while preserving one-use challenge behavior',async()=>{
 const s=await session(B),challenge=id(++seq),mac=digest('4'),device=digest('5');
 await db.query("update mushavo_email_auth.account_state set next_send_at='-infinity' where user_id=$1",[B]);
 assert.equal((await service('begin_challenge',[B,s,challenge,mac,'v1',true])).result,'PENDING_DELIVERY');
 assert.equal((await service('set_delivery',[B,s,challenge,true])).result,'READY');
 const result=await service('verify_challenge',[B,s,challenge,mac,device]);assert.equal(result.result,'VERIFIED');assert.equal(result.device_persistent,true);assert.equal(result.device_expires_at,null);
 assert.equal((await one('select expires_at::text deadline from mushavo_email_auth.devices where credential_digest=$1',[device])).deadline,'infinity');
 assert.equal((await service('verify_challenge',[B,s,challenge,mac,device])).result,'UNAVAILABLE');
 assert.equal((await service('restore_device',[B,await session(B),device])).result,'APPROVED');
});
test('forgetting a browser revokes its approval and affected session proof',async()=>{
 const s=await session();assert.equal((await service('restore_device',[A,s,digest('f')])).result,'APPROVED');
 assert.equal((await service('revoke_device',[A,s,digest('f')])).result,'REVOKED');assert.equal(await service('session_status',[A,s]),false);
 assert.equal((await service('restore_device',[A,await session(),digest('f')])).result,'CODE_REQUIRED');
});
test('security resets revoke approvals and old link proof cannot silently reenroll a browser',async()=>{
 const s=await session();
 await db.query('update mushavo_email_auth.account_state set security_changed_at=clock_timestamp()+interval\'10 seconds\' where user_id=$1',[A]);
 assert.equal((await register(s,digest('6'))).result,'LINK_PROOF_REQUIRED');
 await db.query("update auth.users set encrypted_password='NEW_HASH' where id=$1",[A]);
 assert.equal((await service('restore_device',[A,await session(),digest('d')])).result,'CODE_REQUIRED');
 assert.equal((await register(s,digest('6'),true,new Date(Date.now()-10000).toISOString())).result,'LINK_PROOF_REQUIRED');
});
test('a security reset before the first enrollment still prevents an older confirmation bearer from enrolling',async()=>{
 const user=id(4),oldProof=new Date(Date.now()-1000).toISOString();
 await db.query("insert into auth.users values($1,'fresh@example.invalid',$2,'HASH',null)",[user,oldProof]);
 await db.query("insert into public.profiles values($1,'active')",[user]);
 const s=await session(user);assert.equal((await one('select count(*)::int n from mushavo_email_auth.account_state where user_id=$1',[user])).n,0);
 await db.query("update auth.users set encrypted_password='NEW_HASH' where id=$1",[user]);
 assert.equal((await one('select count(*)::int n from mushavo_email_auth.account_state where user_id=$1',[user])).n,1);
 assert.equal((await register(s,digest('9'),true,oldProof,user)).result,'LINK_PROOF_REQUIRED');
});
test('all private tables keep forced RLS and only service-role can execute enrollment',async()=>{
 const rows=(await db.query("select relrowsecurity,relforcerowsecurity from pg_class where relnamespace='mushavo_email_auth'::regnamespace and relkind='r'")).rows;
 assert.equal(rows.length,5);assert(rows.every(row=>row.relrowsecurity&&row.relforcerowsecurity));
 for(const role of ['anon','authenticated','service_role']){
  assert.equal((await one("select has_table_privilege($1,'mushavo_email_auth.devices','SELECT,INSERT,UPDATE,DELETE') value",[role])).value,false);
  assert.equal((await one("select has_function_privilege($1,'public.email_gate_register_link_device(uuid,uuid,text,timestamptz,boolean)','EXECUTE') value",[role])).value,role==='service_role');
 }
});
