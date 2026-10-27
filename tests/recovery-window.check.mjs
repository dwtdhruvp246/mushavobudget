import test, {before, after, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
if (!process.env.MUSHAVO_PGLITE_MODULE) throw Error('PINNED_PGLITE_MODULE_REQUIRED');
const {PGlite}=await import(pathToFileURL(process.env.MUSHAVO_PGLITE_MODULE).href);
const root=new URL('../',import.meta.url), read=p=>fs.readFileSync(new URL(p,root),'utf8');
const template=read('supabase/candidates/security_fr_2_5_recovery_test_window.sql');
const runFor=email=>template.replace('OWNER_CONTROLLED_RECOVERY_EMAIL',email);
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=id(1),B=id(2),U=id(3),SA=id(11),SB=id(12);
let db,predicate;
const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
const mode=()=>one('select mode from mushavo_email_install.rollout_control').then(x=>x.mode);
const valid=(actor,session)=>one('select mushavo_email_auth.session_valid($1,$2) value',[actor,session]).then(x=>x.value);
const window=()=>one('select * from mushavo_email_install.acceptance_window');
const execute=async(email='recovery@example.invalid')=>{
 const rows=await db.exec(runFor(email));
 return rows.flatMap(x=>x.rows||[]).find(x=>x.result)?.result;
};
async function rejects(sql,pattern){
 try {await assert.rejects(db.exec(sql),pattern);}
 finally {await db.exec('ROLLBACK;RESET ROLE;SET session_replication_role=origin');}
}
async function appSnapshot(){
 const result={};
 for(const table of ['auth.users','auth.sessions','public.profiles',...['account_state','send_events','challenges','devices','session_proofs'].map(x=>'mushavo_email_auth.'+x)]) {
  result[table]=(await db.query('select to_jsonb(t)::text value from '+table+' t order by to_jsonb(t)::text')).rows;
 }
 return result;
}
async function openOther(actors=[B]){
 await db.exec("set mushavo.email_rollout_project='dczlddwbtgvfdujgcitb';set mushavo.email_rollout_action='OPEN_STAGING_ACCEPTANCE_WINDOW'");
 await db.query('select mushavo_email_install.open_acceptance_window($1,1800)',[actors]);
}
before(async()=>{
 db=new PGlite();
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,encrypted_password text,banned_until timestamptz);create table auth.sessions(id uuid primary key,user_id uuid references auth.users on delete cascade,not_after timestamptz);create table public.profiles(id uuid primary key,account_status text);set mushavo.email_backend_review='OFFLINE_SOURCE_CANDIDATE'");
 await db.exec(read('supabase/candidates/security_fr_2_4_email_verification_backend.sql'));
 await db.exec(read('tests/fixtures/persistent-device-staging-model.sql'));
 const source=read('supabase/candidates/security_fr_2_4_email_acceptance_window.sql');
 const first=source.indexOf('CREATE FUNCTION mushavo_email_install.open_acceptance_window(');
 const marker='REVOKE ALL ON FUNCTION mushavo_email_install.open_acceptance_window(uuid[],integer) FROM PUBLIC,anon,authenticated,service_role;';
 const last=source.indexOf(marker,first);assert(first>=0&&last>first);
 await db.exec(source.slice(first,last+marker.length));
 await db.exec("BEGIN;SET LOCAL mushavo.persistent_device_component='VERIFIED_INSTALLER_OR_OFFLINE_REVIEW';"+read('supabase/candidates/security_fr_2_5_persistent_device_component.sql')+'COMMIT;');
 await db.query("insert into auth.users values($1,'recovery@example.invalid',now(),'UNCHANGED_HASH',null),($2,'other@example.invalid',now(),'UNCHANGED_HASH',null),($3,'unconfirmed@example.invalid',null,'UNCHANGED_HASH',null)",[A,B,U]);
 await db.query("insert into public.profiles values($1,'active'),($2,'active'),($3,'active')",[A,B,U]);
 await db.query('insert into auth.sessions(id,user_id) values($1,$2),($3,$4)',[SA,A,SB,B]);
 await db.query('insert into mushavo_email_auth.account_state(user_id) values($1),($2)',[A,B]);
 predicate=(await one("select pg_get_functiondef('mushavo_email_auth.session_valid(uuid,uuid)'::regprocedure) value")).value;
 await db.exec("insert into mushavo_email_install.rollout_control values(true,'dczlddwbtgvfdujgcitb','QUARANTINED',mushavo_email_install.catalog_identity(),clock_timestamp())");
});
beforeEach(async()=>{
 await db.exec('ROLLBACK;RESET ROLE;SET session_replication_role=origin');
 await db.exec("delete from mushavo_email_install.acceptance_window;update mushavo_email_install.rollout_control set mode='QUARANTINED',catalog_sha256=mushavo_email_install.catalog_identity();update auth.users set email_confirmed_at=now(),banned_until=null where email<>'unconfirmed@example.invalid';update public.profiles set account_status='active'");
});
after(async()=>{await db?.close();});
test('opens a one-account thirty-minute recovery window without requiring signup-link trust or creating proof',async()=>{
 const before=await appSnapshot(),out=await execute('RECOVERY@example.invalid');
 assert.equal(out.result,'RECOVERY_SINGLE_ACCOUNT_WINDOW_READY');
 assert.equal(out.window_action,'OPENED_FROM_QUARANTINE');assert.equal(out.allowed_actor_count,1);
 assert.equal(out.application_proof_created_by_this_SQL,false);
 const w=await window();assert.deepEqual(w.allowed_users,[A]);
 assert.equal((new Date(w.expires_at)-new Date(w.opened_at))/1000,1800);
 assert.deepEqual(await appSnapshot(),before);assert.equal(await valid(A,SA),false);
 assert.equal((await one("select pg_get_functiondef('mushavo_email_auth.session_valid(uuid,uuid)'::regprocedure) value")).value,predicate);
});
test('missing, placeholder and duplicate-address identities refuse before any control write',async()=>{
 for(const email of ['missing@example.invalid','OWNER_CONTROLLED_RECOVERY_EMAIL'])await rejects(runFor(email),/EXACTLY_ONE_RECOVERY_ACCOUNT_REQUIRED/);
 await db.query("insert into auth.users values($1,'RECOVERY@example.invalid',now(),'HASH',null)",[id(4)]);
 await rejects(runFor('recovery@example.invalid'),/EXACTLY_ONE_RECOVERY_ACCOUNT_REQUIRED/);
 await db.query('delete from auth.users where id=$1',[id(4)]);assert.equal(await mode(),'QUARANTINED');
});
test('unconfirmed, suspended, banned and missing-profile accounts refuse',async()=>{
 await rejects(runFor('unconfirmed@example.invalid'),/CONFIRMED_ACTIVE_RECOVERY_ACCOUNT_REQUIRED/);
 await db.query("update public.profiles set account_status='suspended' where id=$1",[A]);
 await rejects(runFor('recovery@example.invalid'),/CONFIRMED_ACTIVE_RECOVERY_ACCOUNT_REQUIRED/);
 await db.query("update public.profiles set account_status='active' where id=$1",[A]);
 await db.query("update auth.users set banned_until=now()+interval '1 hour' where id=$1",[A]);
 await rejects(runFor('recovery@example.invalid'),/CONFIRMED_ACTIVE_RECOVERY_ACCOUNT_REQUIRED/);
 await db.query('update auth.users set banned_until=null where id=$1',[A]);
 await db.query('delete from public.profiles where id=$1',[A]);
 await rejects(runFor('recovery@example.invalid'),/CONFIRMED_ACTIVE_RECOVERY_ACCOUNT_REQUIRED/);
 await db.query("insert into public.profiles values($1,'active')",[A]);assert.equal(await mode(),'QUARANTINED');
});
test('application roles and replica execution cannot open a window',async()=>{
 for(const role of ['anon','authenticated','service_role']){
  await db.exec('set role '+role);await rejects(runFor('recovery@example.invalid'),/RECOVERY_WINDOW_PRIVILEGED_ORIGIN_REQUIRED/);
 }
 await db.exec('set session_replication_role=replica');await rejects(runFor('recovery@example.invalid'),/RECOVERY_WINDOW_PRIVILEGED_ORIGIN_REQUIRED/);
 assert.equal(await mode(),'QUARANTINED');
});
test('wrong project, uninstalled mode, missing control and changed catalog stamps refuse',async()=>{
 for(const sql of ["update mushavo_email_install.rollout_control set target_project='different'","update mushavo_email_install.rollout_control set mode='REGISTERED'","update mushavo_email_install.rollout_control set catalog_sha256=repeat('0',64)"]){
  await db.exec(sql);await rejects(runFor('recovery@example.invalid'),/RECOVERY_WINDOW_CURRENT_CATALOG_REQUIRED/);
  await db.exec("update mushavo_email_install.rollout_control set target_project='dczlddwbtgvfdujgcitb',mode='QUARANTINED',catalog_sha256=mushavo_email_install.catalog_identity()");
 }
 await db.exec('delete from mushavo_email_install.rollout_control');await rejects(runFor('recovery@example.invalid'),/RECOVERY_WINDOW_CURRENT_CATALOG_REQUIRED/);
 await db.exec("insert into mushavo_email_install.rollout_control values(true,'dczlddwbtgvfdujgcitb','QUARANTINED',mushavo_email_install.catalog_identity(),now())");
});
test('a changed predicate cannot be accepted even with a refreshed catalog stamp',async()=>{
 try {
  await db.exec("create or replace function mushavo_email_auth.session_valid(p_user uuid,p_session uuid) returns boolean language sql stable security definer set search_path=pg_catalog as 'select true';update mushavo_email_install.rollout_control set catalog_sha256=mushavo_email_install.catalog_identity()");
  await rejects(runFor('recovery@example.invalid'),/RECOVERY_WINDOW_CANONICAL_PREDICATE_REQUIRED/);
 } finally {
  await db.exec(predicate);await db.exec('revoke all on function mushavo_email_auth.session_valid(uuid,uuid) from public,anon,authenticated,service_role');
 }
 assert.equal(await mode(),'QUARANTINED');
});
test('an active window for the exact same account is reused with unchanged deadline and application rows',async()=>{
 await execute();const before=await window(),rows=await appSnapshot();
 const control=await one('select * from mushavo_email_install.rollout_control');
 const out=await execute();assert.equal(out.window_action,'REUSED_WITHOUT_EXTENSION');
 assert.deepEqual(await window(),before);assert.deepEqual(await appSnapshot(),rows);
 assert.deepEqual(await one('select * from mushavo_email_install.rollout_control'),control);
});
test('an unexpired other-account or multiple-account window cannot be replaced or extended',async()=>{
 for(const actors of [[B],[A,B]]){
  await db.exec("update mushavo_email_install.rollout_control set mode='QUARANTINED'");await openOther(actors);
  const before=await window();await rejects(runFor('recovery@example.invalid'),/RECOVERY_WINDOW_OTHER_ACTIVE_ACTORS_RETAINED/);
  assert.deepEqual(await window(),before);assert.equal(await mode(),'ACTIVE');
 }
});
test('an expired active window is quarantined then reopened for this one account without changing proof or approvals',async()=>{
 await openOther();await db.exec("update mushavo_email_install.acceptance_window set opened_at=now()-interval '31 minutes',expires_at=now()-interval '1 minute'");
 const before=await appSnapshot(),out=await execute();assert.equal(out.window_action,'REOPENED_EXPIRED_WINDOW');
 assert.deepEqual((await window()).allowed_users,[A]);assert.equal(await mode(),'ACTIVE');
 assert.deepEqual(await appSnapshot(),before);assert.equal(await valid(A,SA),false);
});
test('active windows with absent, foreign, future, unbounded or malformed state refuse without replacement',async()=>{
 await db.exec("update mushavo_email_install.rollout_control set mode='ACTIVE'");
 await rejects(runFor('recovery@example.invalid'),/RECOVERY_WINDOW_VALID_EXISTING_BOUND_REQUIRED/);
 for(const assignment of ["target_project='wrong'","opened_at=now()+interval '1 minute'","expires_at=now()+interval '31 minutes'","allowed_users=ARRAY[]::uuid[]","allowed_users=ARRAY[NULL]::uuid[]","allowed_users=ARRAY['"+A+"','"+A+"']::uuid[]"]){
  await db.exec("update mushavo_email_install.rollout_control set mode='QUARANTINED'");await openOther([A]);await db.exec('update mushavo_email_install.acceptance_window set '+assignment);
  const before=await window();await rejects(runFor('recovery@example.invalid'),/RECOVERY_WINDOW_VALID_EXISTING_BOUND_REQUIRED/);assert.deepEqual(await window(),before);
 }
});
test('a later controller rejection rolls back the expired-window quarantine transition',async()=>{
 await openOther();await db.exec("update mushavo_email_install.acceptance_window set opened_at=now()-interval '31 minutes',expires_at=now()-interval '1 minute'");
 // No DDL is installed on the server by the wrapper. This modeled hook must still be rejected by the installed open controller.
 await db.exec("create function public.unreviewed_hook() returns event_trigger language plpgsql as 'begin end';create event trigger unreviewed_hook on ddl_command_end execute function public.unreviewed_hook();update mushavo_email_install.rollout_control set catalog_sha256=mushavo_email_install.catalog_identity()");
 const before=await window();await rejects(runFor('recovery@example.invalid'),/EMAIL_ATOMIC_UNREVIEWED_DDL_HOOK/);
 assert.equal(await mode(),'ACTIVE');assert.deepEqual(await window(),before);
 await db.exec('drop event trigger unreviewed_hook;drop function public.unreviewed_hook()');
});
test('window scope still requires an existing legitimate proof and expiry blocks even that proof',async()=>{
 await execute();assert.equal(await valid(A,SA),false);
 await db.query("insert into mushavo_email_auth.session_proofs(session_id,user_id,security_version,source,verified_at,established_at) select v.session_id,v.user_id,a.security_version,'email',now(),now() from (values($1::uuid,$2::uuid),($3::uuid,$4::uuid)) v(session_id,user_id) join mushavo_email_auth.account_state a on a.user_id=v.user_id",[SA,A,SB,B]);
 assert.equal(await valid(A,SA),true);assert.equal(await valid(B,SB),false);
 await db.exec("update mushavo_email_install.acceptance_window set opened_at=now()-interval '31 minutes',expires_at=now()-interval '1 minute'");
 assert.equal(await valid(A,SA),false);
 await db.query('delete from mushavo_email_auth.session_proofs where session_id=any($1)',[[SA,SB]]);
});
