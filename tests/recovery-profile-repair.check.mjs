import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
if(!process.env.MUSHAVO_PGLITE_MODULE)throw Error('PINNED_PGLITE_MODULE_REQUIRED');
const {PGlite}=await import(pathToFileURL(process.env.MUSHAVO_PGLITE_MODULE).href);
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const template=read('supabase/candidates/security_fr_2_5_recovery_profile_repair.sql');
const candidate=email=>template.replace('OWNER_CONTROLLED_RECOVERY_EMAIL',email);
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=id(1),B=id(2),U=id(3),SA=id(11),SB=id(12);let db;
const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
const stamp=()=>db.exec('update mushavo_email_install.rollout_control set catalog_sha256=mushavo_email_install.catalog_identity()');
const run=async(email='recovery@example.invalid')=>(await db.exec(candidate(email))).flatMap(x=>x.rows||[]).find(x=>x.result)?.result;
async function reject(sql,pattern){try{await assert.rejects(db.exec(sql),pattern);}finally{await db.exec("ROLLBACK;RESET ROLE;SET session_replication_role=origin;RESET request.jwt.claim.sub;RESET request.jwt.claim.role");}}
async function snapshot(){const out={};for(const table of ['auth.users','auth.sessions','public.profiles','public.app_admins','public.admin_user_invitations',...['account_state','send_events','challenges','devices','session_proofs'].map(x=>'mushavo_email_auth.'+x),'mushavo_email_install.rollout_control','mushavo_email_install.acceptance_window'])out[table]=(await db.query('select to_jsonb(t)::text value from '+table+' t order by to_jsonb(t)::text')).rows;return out;}
before(async()=>{
 db=new PGlite();
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,encrypted_password text,banned_until timestamptz,raw_user_meta_data jsonb);create table auth.sessions(id uuid primary key,user_id uuid references auth.users on delete cascade,not_after timestamptz);create table public.profiles(id uuid primary key references auth.users on delete cascade,full_name text not null,email text,account_status text not null default 'active' check(account_status in('active','suspended')),signup_source text not null default 'self_signup',created_at timestamptz not null default now());create unique index profiles_email_unique_idx on public.profiles(lower(email)) where email is not null;create table public.app_admins(user_id uuid primary key);create table public.admin_user_invitations(id uuid primary key,auth_user_id uuid,email text);set mushavo.email_backend_review='OFFLINE_SOURCE_CANDIDATE'");
 await db.exec(read('supabase/candidates/security_fr_2_4_email_verification_backend.sql'));
 await db.exec(read('tests/fixtures/persistent-device-staging-model.sql'));
 const controller=read('supabase/candidates/security_fr_2_4_email_acceptance_window.sql');
 const first=controller.indexOf('CREATE FUNCTION mushavo_email_install.open_acceptance_window('),marker='REVOKE ALL ON FUNCTION mushavo_email_install.open_acceptance_window(uuid[],integer) FROM PUBLIC,anon,authenticated,service_role;',last=controller.indexOf(marker,first);assert(first>=0&&last>first);await db.exec(controller.slice(first,last+marker.length));
 await db.exec("BEGIN;SET LOCAL mushavo.persistent_device_component='VERIFIED_INSTALLER_OR_OFFLINE_REVIEW';"+read('supabase/candidates/security_fr_2_5_persistent_device_component.sql')+'COMMIT;');
 await db.exec(read('tests/fixtures/recovery-profile-guard.sql'));
 await db.query("insert into auth.users values($1,'recovery@example.invalid',now(),'UNCHANGED_HASH',null,'{\"full_name\":\"Test Recovery\"}'),($2,'other@example.invalid',now(),'UNCHANGED_HASH',null,'{}'),($3,'unconfirmed@example.invalid',null,'UNCHANGED_HASH',null,'{}')",[A,B,U]);
 await db.query("insert into public.profiles(id,full_name,email) values($1,'Existing Other','other@example.invalid')",[B]);
 await db.query('insert into auth.sessions(id,user_id) values($1,$2),($3,$4)',[SA,A,SB,B]);
 await db.query('insert into mushavo_email_auth.account_state(user_id) values($1),($2)',[A,B]);
 await db.exec("insert into mushavo_email_install.rollout_control values(true,'dczlddwbtgvfdujgcitb','QUARANTINED',mushavo_email_install.catalog_identity(),now())");
});
beforeEach(async()=>{
 await db.exec("ROLLBACK;RESET ROLE;SET session_replication_role=origin;RESET request.jwt.claim.sub;RESET request.jwt.claim.role;delete from public.profiles where id='"+A+"';delete from public.app_admins;delete from public.admin_user_invitations;delete from mushavo_email_install.acceptance_window;update mushavo_email_install.rollout_control set target_project='dczlddwbtgvfdujgcitb',mode='QUARANTINED';update auth.users set email_confirmed_at=now(),banned_until=null,raw_user_meta_data='{\"full_name\":\"Test Recovery\"}' where id='"+A+"'");await stamp();
});
after(async()=>{await db?.close();});
test('restores one profile using normal defaults and derived Auth name without changing Auth, proof, window or unrelated rows',async()=>{
 const before=await snapshot(),result=await run('RECOVERY@example.invalid'),after=await snapshot();
 assert.equal(result.result,'RECOVERY_PROFILE_READY');assert.equal(result.profile_action,'CREATED');assert.equal(result.inserted_profiles,1);assert.equal(result.application_proof_created,false);assert.equal(result.test_window_changed,false);
 const row=await one('select full_name,email,account_status,signup_source from public.profiles where id=$1',[A]);assert.deepEqual(row,{full_name:'Test Recovery',email:'recovery@example.invalid',account_status:'active',signup_source:'self_signup'});
 delete before['public.profiles'];delete after['public.profiles'];assert.deepEqual(after,before);
 assert.equal((await one('select mushavo_email_auth.session_valid($1,$2) value',[A,SA])).value,false);
});
test('a repeated repair preserves an existing active profile without overwriting its name or timestamps',async()=>{
 await run();await db.query("update public.profiles set full_name='Owner edited name' where id=$1",[A]);const before=await snapshot(),result=await run();assert.equal(result.profile_action,'ALREADY_PRESENT_UNCHANGED');assert.equal(result.inserted_profiles,0);assert.deepEqual(await snapshot(),before);
});
test('unknown, placeholder and duplicate-address selectors cannot create a profile',async()=>{
 for(const email of ['missing@example.invalid','OWNER_CONTROLLED_RECOVERY_EMAIL'])await reject(candidate(email),/EXACTLY_ONE_RECOVERY_ACCOUNT_REQUIRED/);
 await db.query("insert into auth.users values($1,'RECOVERY@example.invalid',now(),'HASH',null,'{}')",[id(4)]);await reject(candidate('recovery@example.invalid'),/EXACTLY_ONE_RECOVERY_ACCOUNT_REQUIRED/);await db.query('delete from auth.users where id=$1',[id(4)]);assert.equal((await one('select count(*)::int n from public.profiles where id=$1',[A])).n,0);
});
test('unconfirmed or currently banned users are refused with unchanged rows',async()=>{
 await reject(candidate('unconfirmed@example.invalid'),/PROFILE_REPAIR_CONFIRMED_NONBANNED_ACCOUNT_REQUIRED/);
 await db.query("update auth.users set banned_until=now()+interval '1 hour' where id=$1",[A]);const before=await snapshot();await reject(candidate('recovery@example.invalid'),/PROFILE_REPAIR_CONFIRMED_NONBANNED_ACCOUNT_REQUIRED/);assert.deepEqual(await snapshot(),before);
});
test('an existing suspended or mismatched-origin profile is never activated or relabeled',async()=>{
 await db.query("insert into public.profiles(id,full_name,email,account_status) values($1,'Existing','recovery@example.invalid','suspended')",[A]);let before=await snapshot();await reject(candidate('recovery@example.invalid'),/PROFILE_REPAIR_EXISTING_PROFILE_REVIEW_REQUIRED/);assert.deepEqual(await snapshot(),before);
 await db.query("update public.profiles set account_status='active',signup_source='admin_invitation' where id=$1",[A]);before=await snapshot();await reject(candidate('recovery@example.invalid'),/PROFILE_REPAIR_EXISTING_PROFILE_REVIEW_REQUIRED/);assert.deepEqual(await snapshot(),before);
});
test('an email collision with another profile is refused without changing that profile',async()=>{
 await db.query("update public.profiles set email='RECOVERY@example.invalid' where id=$1",[B]);const before=await snapshot();try{await reject(candidate('recovery@example.invalid'),/PROFILE_REPAIR_EMAIL_COLLISION_REVIEW_REQUIRED/);assert.deepEqual(await snapshot(),before);}finally{await db.query("update public.profiles set email='other@example.invalid' where id=$1",[B]);}
});
test('invitation metadata, retained invitations and platform assignments exclude this ordinary signup repair',async()=>{
 for(const meta of [{signup_source:'admin_invitation'},{signup_source:'family_invitation'},{admin_invitation_id:id(50)}]){
  await db.query('update auth.users set raw_user_meta_data=$1 where id=$2',[JSON.stringify(meta),A]);await reject(candidate('recovery@example.invalid'),/PROFILE_REPAIR_ORDINARY_SELF_SIGNUP_REQUIRED/);
 }
 await db.query("update auth.users set raw_user_meta_data='{}' where id=$1",[A]);
 await db.query('insert into public.admin_user_invitations values($1,$2,$3)',[id(50),A,'recovery@example.invalid']);await reject(candidate('recovery@example.invalid'),/PROFILE_REPAIR_ORDINARY_SELF_SIGNUP_REQUIRED/);await db.exec('delete from public.admin_user_invitations');
 await db.query('insert into public.app_admins values($1)',[A]);await reject(candidate('recovery@example.invalid'),/PROFILE_REPAIR_ORDINARY_SELF_SIGNUP_REQUIRED/);
});
test('application roles, replica mode and a claimed API actor cannot use the privileged repair',async()=>{
 for(const role of ['anon','authenticated','service_role']){await db.exec('set role '+role);await reject(candidate('recovery@example.invalid'),/PROFILE_REPAIR_PRIVILEGED_UNCLAIMED_ORIGIN_REQUIRED/);}
 await db.exec('set session_replication_role=replica');await reject(candidate('recovery@example.invalid'),/PROFILE_REPAIR_PRIVILEGED_UNCLAIMED_ORIGIN_REQUIRED/);
 await db.exec("set request.jwt.claim.role='authenticated'");await reject(candidate('recovery@example.invalid'),/PROFILE_REPAIR_PRIVILEGED_UNCLAIMED_ORIGIN_REQUIRED/);
 await db.exec("set request.jwt.claim.sub='"+A+"'");await reject(candidate('recovery@example.invalid'),/PROFILE_REPAIR_PRIVILEGED_UNCLAIMED_ORIGIN_REQUIRED/);
});
test('a wrong target, unmatched catalog or uninstalled mode refuses before any insertion',async()=>{
 for(const change of ["target_project='wrong'","catalog_sha256=repeat('0',64)","mode='REGISTERED'"]){await db.exec('update mushavo_email_install.rollout_control set '+change);await reject(candidate('recovery@example.invalid'),/PROFILE_REPAIR_CURRENT_STAGING_CATALOG_REQUIRED/);await db.exec("update mushavo_email_install.rollout_control set target_project='dczlddwbtgvfdujgcitb',mode='QUARANTINED'");await stamp();}
});
test('normal default and email-index drift are refused even after modeled restamping',async()=>{
 try{await db.exec("alter table public.profiles alter column account_status set default 'suspended'");await stamp();await reject(candidate('recovery@example.invalid'),/PROFILE_REPAIR_NORMAL_DEFAULTS_REQUIRED/);}finally{await db.exec("alter table public.profiles alter column account_status set default 'active'");}
 try{await db.exec('drop index public.profiles_email_unique_idx');await stamp();await reject(candidate('recovery@example.invalid'),/PROFILE_REPAIR_EMAIL_UNIQUENESS_REQUIRED/);}finally{await db.exec('create unique index profiles_email_unique_idx on public.profiles(lower(email)) where email is not null');}
});
test('an additional insertion side-effect trigger is refused before it can run',async()=>{
 await db.exec("create table public.test_side_effects(value text);create function public.test_side_effect() returns trigger language plpgsql as $$begin insert into public.test_side_effects values('UNEXPECTED');return new;end$$;create trigger unexpected_profile_effect after insert on public.profiles for each row execute function public.test_side_effect()");await stamp();
 try{await reject(candidate('recovery@example.invalid'),/PROFILE_REPAIR_REVIEWED_INSERT_GUARD_REQUIRED/);assert.equal((await one('select count(*)::int n from public.test_side_effects')).n,0);}finally{await db.exec('drop trigger unexpected_profile_effect on public.profiles;drop function public.test_side_effect();drop table public.test_side_effects');}
});
test('a missing, disabled or changed suspension trigger cannot be bypassed',async()=>{
 try{await db.exec('alter table public.profiles disable trigger guard_suspended_account_write_trigger');await stamp();await reject(candidate('recovery@example.invalid'),/PROFILE_REPAIR_REVIEWED_INSERT_GUARD_REQUIRED/);}finally{await db.exec('alter table public.profiles enable trigger guard_suspended_account_write_trigger');}
 try{await db.exec("create or replace function public.guard_suspended_account_write() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin return new;end$$");await stamp();await reject(candidate('recovery@example.invalid'),/PROFILE_REPAIR_REVIEWED_INSERT_GUARD_REQUIRED/);}finally{await db.exec('drop trigger guard_suspended_account_write_trigger on public.profiles');await db.exec(read('tests/fixtures/recovery-profile-guard.sql'));}
});
test('a constraint failure rolls back the entire profile insertion and preserves other state',async()=>{
 await db.exec("alter table public.profiles add constraint modeled_rejection check(id<>'"+A+"'::uuid)");await stamp();const before=await snapshot();
 try{await reject(candidate('recovery@example.invalid'),/modeled_rejection/);assert.deepEqual(await snapshot(),before);}finally{await db.exec('alter table public.profiles drop constraint modeled_rejection');}
});
test('the restored profile satisfies the existing recovery-window prerequisite while a password-only session still has no proof',async()=>{
 await run();const source=read('supabase/candidates/security_fr_2_5_recovery_test_window.sql').replace('OWNER_CONTROLLED_RECOVERY_EMAIL','recovery@example.invalid');const rows=await db.exec(source),out=rows.flatMap(x=>x.rows||[]).find(x=>x.result)?.result;assert.equal(out.result,'RECOVERY_SINGLE_ACCOUNT_WINDOW_READY');assert.deepEqual((await one('select allowed_users from mushavo_email_install.acceptance_window')).allowed_users,[A]);assert.equal((await one('select mushavo_email_auth.session_valid($1,$2) value',[A,SA])).value,false);assert.equal((await one('select count(*)::int n from mushavo_email_auth.session_proofs')).n,0);
});
