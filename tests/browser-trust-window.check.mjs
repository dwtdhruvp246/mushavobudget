import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
if(!process.env.MUSHAVO_PGLITE_MODULE)throw Error('PINNED_PGLITE_MODULE_REQUIRED');
const {PGlite}=await import(pathToFileURL(process.env.MUSHAVO_PGLITE_MODULE).href);
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const template=read('supabase/candidates/security_fr_2_5_browser_trust_test_window.sql');
const runFor=email=>template.replace('OWNER_CONTROLLED_FRESH_SIGNUP_EMAIL',email);
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=id(1),B=id(2),U=id(3),LINK=id(10),PASSWORD=id(11),OTHER=id(12),digest='a'.repeat(64);
let db,predicate;
const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
const status=(actor,session)=>one('select mushavo_email_auth.session_valid($1,$2) value',[actor,session]).then(x=>x.value);
const mode=()=>one('select mode from mushavo_email_install.rollout_control').then(x=>x.mode);
async function reject(sql,pattern){try{await assert.rejects(db.exec(sql),pattern);}finally{await db.exec('ROLLBACK');}assert.equal(await mode(),'QUARANTINED');}
before(async()=>{
 db=new PGlite();
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,encrypted_password text,banned_until timestamptz);create table auth.sessions(id uuid primary key,user_id uuid references auth.users on delete cascade,not_after timestamptz);create table public.profiles(id uuid primary key,account_status text);set mushavo.email_backend_review='OFFLINE_SOURCE_CANDIDATE'");
 await db.exec(read('supabase/candidates/security_fr_2_4_email_verification_backend.sql'));
 await db.exec(read('tests/fixtures/persistent-device-staging-model.sql'));
 const windowSource=read('supabase/candidates/security_fr_2_4_email_acceptance_window.sql');
 const first=windowSource.indexOf('CREATE FUNCTION mushavo_email_install.open_acceptance_window('),endMarker='REVOKE ALL ON FUNCTION mushavo_email_install.open_acceptance_window(uuid[],integer) FROM PUBLIC,anon,authenticated,service_role;';
 assert(first>=0);const last=windowSource.indexOf(endMarker,first);assert(last>first);
 await db.exec(windowSource.slice(first,last+endMarker.length));
 await db.exec("BEGIN;SET LOCAL mushavo.persistent_device_component='VERIFIED_INSTALLER_OR_OFFLINE_REVIEW';"+read('supabase/candidates/security_fr_2_5_persistent_device_component.sql')+'COMMIT;');
 await db.query("insert into auth.users values($1,'new@example.invalid',clock_timestamp(),'HASH',null),($2,'other@example.invalid',clock_timestamp(),'HASH',null),($3,'unconfirmed@example.invalid',null,'HASH',null)",[A,B,U]);
 await db.query("insert into public.profiles values($1,'active'),($2,'active'),($3,'active')",[A,B,U]);
 await db.query('insert into auth.sessions(id,user_id) values($1,$2),($3,$2),($4,$5)',[LINK,A,PASSWORD,OTHER,B]);
 const proof=(await one("select date_trunc('second',clock_timestamp())::text value")).value;
 const enrolled=await one('select public.email_gate_register_link_device($1,$2,$3,$4,true) value',[A,LINK,digest,proof]);assert.equal(enrolled.value.result,'TRUSTED');
 // The original link session is signed out; browser approval must remain usable.
 await db.query('delete from auth.sessions where id=$1',[LINK]);
 const restored=await one('select public.email_gate_restore_device($1,$2,$3) value',[A,PASSWORD,digest]);assert.equal(restored.value.result,'APPROVED');
 await db.query("insert into mushavo_email_auth.account_state(user_id) values($1) on conflict do nothing",[B]);
 await db.query("insert into mushavo_email_auth.session_proofs(session_id,user_id,security_version,source,verified_at,established_at) values($1,$2,1,'email',now(),now())",[OTHER,B]);
 await db.exec("insert into mushavo_email_install.rollout_control values(true,'dczlddwbtgvfdujgcitb','QUARANTINED',mushavo_email_install.catalog_identity(),clock_timestamp())");
 predicate=(await one("select pg_get_functiondef('mushavo_email_auth.session_valid(uuid,uuid)'::regprocedure) value")).value;
});
after(async()=>{await db?.close();});
test('a trusted restored password session remains blocked while staging is quarantined',async()=>{assert.equal(await status(A,PASSWORD),false);assert.equal(await status(B,OTHER),false);});
test('an unknown address and a placeholder cannot open a test window',async()=>{await reject(runFor('missing@example.invalid'),/EXACTLY_ONE_TEST_ACCOUNT_REQUIRED/);await reject(template,/EXACTLY_ONE_TEST_ACCOUNT_REQUIRED/);});
test('an unconfirmed account is refused before checking any browser approval',async()=>{await reject(runFor('unconfirmed@example.invalid'),/CONFIRMED_ACTIVE_TEST_ACCOUNT_REQUIRED/);});
test('a confirmed account without signup-link browser approval cannot open this acceptance window',async()=>{await reject(runFor('other@example.invalid'),/SAVED_SIGNUP_BROWSER_APPROVAL_REQUIRED/);});
test('revoked, finite and old-security-version approvals cannot satisfy the prerequisite',async()=>{
 await db.query('update mushavo_email_auth.devices set revoked_at=now() where user_id=$1',[A]);await reject(runFor('new@example.invalid'),/SAVED_SIGNUP_BROWSER_APPROVAL_REQUIRED/);await db.query('update mushavo_email_auth.devices set revoked_at=null where user_id=$1',[A]);
 await db.query("update mushavo_email_auth.devices set expires_at=verified_at+interval '168 hours' where user_id=$1",[A]);await reject(runFor('new@example.invalid'),/SAVED_SIGNUP_BROWSER_APPROVAL_REQUIRED/);await db.query("update mushavo_email_auth.devices set expires_at='infinity' where user_id=$1",[A]);
 await db.query('update mushavo_email_auth.devices set security_version=2 where user_id=$1',[A]);await reject(runFor('new@example.invalid'),/SAVED_SIGNUP_BROWSER_APPROVAL_REQUIRED/);await db.query('update mushavo_email_auth.devices set security_version=1 where user_id=$1',[A]);
});
test('application roles cannot execute the privileged test-window script',async()=>{
 for(const role of ['anon','authenticated','service_role']){await db.exec('set role '+role);try{await assert.rejects(db.exec(runFor('new@example.invalid')),/PRIVILEGED_ORIGIN_REQUIRED/);}finally{await db.exec('ROLLBACK;RESET ROLE');}}
 assert.equal(await mode(),'QUARANTINED');
});
test('the existing controller opens only the proved identity for thirty minutes without changing its bounded predicate or creating proof',async()=>{
 const before=(await one('select count(*)::int n from mushavo_email_auth.session_proofs')).n;
 const results=await db.exec(runFor('NEW@example.invalid'));const outcome=results.flatMap(x=>x.rows||[]).find(x=>x.result)?.result;
 assert.equal(outcome.result,'STAGING_BOUNDED_ACCEPTANCE_WINDOW_OPEN');assert.equal(outcome.saved_signup_browser_approval,true);assert.equal(outcome.application_proof_created_by_this_SQL,false);
 const window=await one('select cardinality(allowed_users)::int count,allowed_users,extract(epoch from(expires_at-opened_at))::integer duration from mushavo_email_install.acceptance_window');assert.equal(window.count,1);assert.deepEqual(window.allowed_users,[A]);assert.equal(window.duration,1800);
 assert.equal((await one('select count(*)::int n from mushavo_email_auth.session_proofs')).n,before);
 assert.equal((await one("select pg_get_functiondef('mushavo_email_auth.session_valid(uuid,uuid)'::regprocedure) value")).value,predicate);
 assert.equal((await one('select catalog_sha256=mushavo_email_install.catalog_identity() matched from mushavo_email_install.rollout_control')).matched,true);
});
test('the saved password session passes after opening while another proved account stays blocked',async()=>{assert.equal(await status(A,PASSWORD),true);assert.equal(await status(B,OTHER),false);});
test('rerunning the script cannot extend or replace an already active window',async()=>{
 const before=(await one('select expires_at::text value from mushavo_email_install.acceptance_window')).value;
 await assert.rejects(db.exec(runFor('new@example.invalid')),/QUARANTINED_CATALOG_REQUIRED/);await db.exec('ROLLBACK');assert.equal((await one('select expires_at::text value from mushavo_email_install.acceptance_window')).value,before);
});
test('expiry blocks app access without deleting the trusted browser approval',async()=>{
 await db.exec("update mushavo_email_install.acceptance_window set opened_at=now()-interval '31 minutes',expires_at=now()-interval '1 minute'");assert.equal(await status(A,PASSWORD),false);
 assert.equal((await one("select count(*)::int n from mushavo_email_auth.devices where expires_at='infinity' and revoked_at is null and user_id=$1",[A])).n,1);
});
test('the original quarantine controller closes access without revoking browser trust',async()=>{
 await db.exec("set mushavo.email_rollout_project='dczlddwbtgvfdujgcitb';set mushavo.email_rollout_action='QUARANTINE_STAGING_EMAIL';select mushavo_email_install.quarantine()");assert.equal(await mode(),'QUARANTINED');assert.equal(await status(A,PASSWORD),false);
 assert.equal((await one('select revoked_at is null valid from mushavo_email_auth.devices where user_id=$1',[A])).valid,true);
});
