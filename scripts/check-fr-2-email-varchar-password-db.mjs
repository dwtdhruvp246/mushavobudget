// Exact owner-observed varchar(255) compatibility, in-memory only; no live Auth repair.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
import {installerMigration,hookGuard} from './lib/email-atomic-source.mjs';
const modulePath=process.env.MUSHAVO_EMAIL_UI_PGLITE;
const ensure=JSON.parse(await readFile(root+'/tests/fixtures/fr-2-reviewed-ensure-rls.json','utf8'));
const providers=JSON.parse(await readFile(root+'/tests/fixtures/fr-2-reviewed-provider-hooks.json','utf8')).hooks;
async function preparePlatform(db){
 await db.exec("alter table auth.users add column email_confirmed_at timestamptz,add column encrypted_password varchar(255),add column banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);alter table storage.buckets enable row level security;create role supabase_admin superuser;create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path=pg_catalog as $body$"+ensure.body+"$body$;create event trigger ensure_rls on ddl_command_end when tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO') execute function public.rls_auto_enable()");
 for(const h of providers)await db.exec('create function extensions.'+h.name+"() returns event_trigger language plpgsql set search_path='' as $hook$"+h.body+'$hook$;alter function extensions.'+h.name+'() owner to supabase_admin;create event trigger '+h.name+' on '+h.event+' execute function extensions.'+h.name+'();alter event trigger '+h.name+' owner to supabase_admin');
}
async function addExtensionStandins(db){
 for(const [n,e,t]of [['fixture_graphql_drop','sql_drop','DROP EXTENSION'],['fixture_cron','ddl_command_end','CREATE EXTENSION'],['fixture_graphql','ddl_command_end','CREATE EXTENSION'],['fixture_net','ddl_command_end','CREATE EXTENSION']])await db.exec('create function extensions.'+n+'() returns event_trigger language plpgsql as $$begin return; end$$;create event trigger '+n+' on '+e+" when tag in ('"+t+"') execute function extensions."+n+'()');
}
const {db,migrations}=await localDatabase(modulePath,{preparePlatform});
await addExtensionStandins(db);test.after(()=>db.close());
const rows=async(sql,args)=>(await db.query(sql,args)).rows;
const value=async(sql,args)=>(await rows(sql,args))[0].value;
const baseline=await readFile(root+'/supabase/diagnostics/security_fr_2_4_email_pre_activation_reviewed_types.sql','utf8');
async function review(){try{return(await db.exec(baseline)).find(x=>x.rows?.[0]?.email_pre_activation_baseline).rows[0].email_pre_activation_baseline;}catch(e){await db.exec('rollback');throw e;}}
const column=()=>rows("select atttypid::regtype::text type,atttypmod,attnotnull from pg_attribute where attrelid='auth.users'::regclass and attname='encrypted_password'");
const hookState=()=>rows("select evtname,evtevent,evtenabled,evttags,evtfoid from pg_event_trigger order by evtname");
const activate=()=>value('select mushavo_email_install.activate() value');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=id(8101),B=id(8102),AS=id(8111),AS2=id(8112),BS=id(8113);let sequence=8200;
async function context(role,claims,fn){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims)]);await db.exec('set role '+role);try{return await fn();}finally{await db.exec('reset role;reset request.jwt.claims');}}
const service=(name,args)=>context('service_role',{role:'service_role'},()=>value('select public.email_gate_'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') value',args));
const proof=(u,s)=>context('authenticated',{sub:u,session_id:s,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},()=>value('select public.email_gate_current_session_verified() value'));
async function verify(u,s){const n=++sequence,c=id(n),digest=n.toString(16).padStart(64,'0');await db.query("update mushavo_email_auth.account_state set next_send_at='-infinity' where user_id=$1",[u]);await db.query('delete from mushavo_email_auth.send_events where user_id=$1',[u]);assert.equal((await service('begin_challenge',[u,s,c,'a'.repeat(64),'fixture_v1',true])).result,'PENDING_DELIVERY');assert.equal((await service('set_delivery',[u,s,c,true])).result,'READY');assert.equal((await service('verify_challenge',[u,s,c,'a'.repeat(64),digest])).result,'VERIFIED');return digest;}
let initialColumn,originalHooks,device;
test('Actual revised READ ONLY query matches nine exact observed definitions and original eight checks',async()=>{
 assert.equal(migrations.length,54);assert(baseline.includes('NOT ('+hookGuard.slice(3,hookGuard.indexOf(' THEN RAISE'))+')'));const x=await review();assert.equal(x.result,'SELECTED_METADATA_PREREQUISITES_MATCH_NOT_ACTIVATION_APPROVAL');assert.equal(Object.keys(x.checks).length,9);assert(Object.values(x.checks).every(v=>v===true));assert.equal(x.transaction_read_only,'on');assert.equal(x.live_activation_approved,false);assert.equal(x.application_rows_read,false);initialColumn=await column();assert.deepEqual(initialColumn,[{type:'character varying',atttypmod:259,attnotnull:false}]);originalHooks=await hookState();
});
for(const [label,ddl,restore]of[
 ['unbounded text','alter column encrypted_password type text','alter column encrypted_password type varchar(255)'],
 ['different varchar length','alter column encrypted_password type varchar(254)','alter column encrypted_password type varchar(255)'],
 ['changed nullability','alter column encrypted_password set not null','alter column encrypted_password drop not null']
])test('Reviewed metadata refuses '+label+' without broadening acceptance',async()=>{
 try{await db.exec('alter table auth.users '+ddl);const x=await review();assert.equal(x.checks.required_auth_and_profile_column_types_present,false);assert.equal(x.result,'SELECTED_STAGING_METADATA_REVIEW_REQUIRED');}finally{await db.exec('alter table auth.users '+restore);}
});
test('Domain over varchar is refused even with the same formatted underlying limit',async()=>{
 try{await db.exec('create domain public.fixture_password as varchar(255);alter table auth.users alter column encrypted_password type public.fixture_password');assert.equal((await review()).checks.required_auth_and_profile_column_types_present,false);}finally{await db.exec('alter table auth.users alter column encrypted_password type varchar(255);drop domain public.fixture_password');}
});
test('Catalog-only review leaves private fixture rows, column metadata, hooks and settings unchanged',async()=>{
 await db.query("insert into auth.users(id,email,email_confirmed_at,encrypted_password) values($1,'varchar-a@example.invalid',now(),'SYNTHETIC_PASSWORD_HASH'),($2,'varchar-b@example.invalid',now(),'SYNTHETIC_OTHER_HASH')",[A,B]);
 for(const [s,u]of[[AS,A],[AS2,A],[BS,B]])await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[s,u]);
 const snapshot=()=>rows('select to_jsonb(u) value from auth.users u order by id');const before=await snapshot();const settings=await rows("select current_setting('search_path') p,current_setting('statement_timeout') t,current_setting('TimeZone') z");const x=await review();assert(!JSON.stringify(x).includes('SYNTHETIC_PASSWORD_HASH'));assert.deepEqual(await snapshot(),before);assert.deepEqual(await column(),initialColumn);assert.deepEqual(await hookState(),originalHooks);assert.deepEqual(await rows("select current_setting('search_path') p,current_setting('statement_timeout') t,current_setting('TimeZone') z"),settings);
});
test('Ordinary API role cannot run the revised privileged diagnostic',async()=>{
 try{await db.exec('set role authenticated');await assert.rejects(review(),/EMAIL_PREACTIVATION_REQUIRES_PRIVILEGED_SQL_EDITOR/);}finally{await db.exec('rollback;reset role');}
});
test('Unchanged migration55 registers dormant installer against exact observed Auth column',async()=>{
 await db.exec(await readFile(root+'/supabase/migrations/'+installerMigration,'utf8'));assert.equal(await value("select to_regnamespace('mushavo_email_auth') value"),null);assert.deepEqual(await column(),initialColumn);await db.exec("set mushavo.email_atomic_review='OFFLINE_ATOMIC_REHEARSAL'");
});
test('Actual atomic activation with varchar rolls back completely and preserves hooks and Auth rows',async()=>{
 const before=await rows('select to_jsonb(u) value from auth.users u order by id');await db.exec('begin');assert.equal((await activate()).guarded_RPCs,148);assert.equal(await value("select count(*)::int value from pg_policies where policyname='Email verified session required'"),82);await db.exec('rollback');assert.equal(await value("select to_regnamespace('mushavo_email_auth') value"),null);assert.deepEqual(await rows('select to_jsonb(u) value from auth.users u order by id'),before);assert.deepEqual(await hookState(),originalHooks);assert.deepEqual(await column(),initialColumn);
});
test('Committed modeled activation preserves Auth rows and sets five private RLS/FORCE postconditions',async()=>{
 const before=await rows('select to_jsonb(u) value from auth.users u order by id');const x=await activate();assert.equal(x.guarded_RPCs,148);assert.equal(x.restrictive_policies,82);assert.deepEqual(await rows('select to_jsonb(u) value from auth.users u order by id'),before);const flags=await rows("select relrowsecurity,relforcerowsecurity from pg_class where relnamespace='mushavo_email_auth'::regnamespace and relkind='r'");assert.equal(flags.length,5);assert(flags.every(x=>x.relrowsecurity&&x.relforcerowsecurity));assert.deepEqual(await column(),initialColumn);
});
test('Password-only modeled sessions fail; actual service challenge/verify produces account-bound proof',async()=>{
 assert.equal(await proof(A,AS),false);assert.equal(await proof(B,BS),false);device=await verify(A,AS);await verify(B,BS);assert.equal(await proof(A,AS),true);assert.equal(await proof(B,BS),true);assert.equal(await proof(A,AS2),false);assert.equal(await proof(B,AS),false);
});
test('Remembered-device restore retains fixed expiry and cannot cross accounts',async()=>{
 const expiry=await value('select expires_at::text value from mushavo_email_auth.devices where credential_digest=$1',[device]);assert.equal((await service('restore_device',[A,AS2,device])).result,'APPROVED');assert.equal(await proof(A,AS2),true);assert.equal(await value('select expires_at::text value from mushavo_email_auth.devices where credential_digest=$1',[device]),expiry);assert.equal((await service('restore_device',[B,BS,device])).result,'CODE_REQUIRED');
});
test('Updating varchar password to its same value preserves proofs and security version',async()=>{
 const version=await value('select security_version value from mushavo_email_auth.account_state where user_id=$1',[A]);await db.query('update auth.users set encrypted_password=encrypted_password where id=$1',[A]);assert.equal(await proof(A,AS),true);assert.equal(await proof(A,AS2),true);assert.equal(await value('select security_version value from mushavo_email_auth.account_state where user_id=$1',[A]),version);
});
test('Actual changed-password trigger revokes both account sessions and device while preserving another account',async()=>{
 const version=await value('select security_version value from mushavo_email_auth.account_state where user_id=$1',[A]);await db.query('update auth.users set encrypted_password=$2 where id=$1',[A,'SYNTHETIC_CHANGED_HASH']);assert.equal(await proof(A,AS),false);assert.equal(await proof(A,AS2),false);assert.equal(await proof(B,BS),true);assert.equal(await value('select security_version value from mushavo_email_auth.account_state where user_id=$1',[A]),version+1);assert.equal((await service('restore_device',[A,AS2,device])).result,'CODE_REQUIRED');assert.equal(await value('select count(*)::int value from mushavo_email_auth.devices where user_id=$1 and revoked_at is null',[A]),0);
});
test('Nullable varchar password transitions invalidate proof without type errors',async()=>{
 await verify(A,AS);await db.query('update auth.users set encrypted_password=null where id=$1',[A]);assert.equal(await proof(A,AS),false);assert.equal(await proof(B,BS),true);await verify(A,AS);await db.query('update auth.users set encrypted_password=$2 where id=$1',[A,'SYNTHETIC_RESTORED_HASH']);assert.equal(await proof(A,AS),false);assert.deepEqual(await column(),initialColumn);
});
test('The existing 255-character limit rejects oversized input atomically, retaining a valid proof',async()=>{
 await verify(A,AS);const before=await rows('select encrypted_password value from auth.users where id=$1',[A]);await assert.rejects(db.query('update auth.users set encrypted_password=$2 where id=$1',[A,'x'.repeat(256)]),e=>e.code==='22001');assert.deepEqual(await rows('select encrypted_password value from auth.users where id=$1',[A]),before);assert.equal(await proof(A,AS),true);assert.equal(await proof(B,BS),true);
});
test('Canonical55 with exact varchar definition activates the same functions, API ACLs and policies',async()=>{
 const {db:other,migrations:all}=await localDatabase(modulePath,{includeEmailInstaller:true,creationPath:'canonical',preparePlatform});try{assert.equal(all.length,55);await other.exec("set mushavo.email_atomic_review='OFFLINE_ATOMIC_REHEARSAL'");assert.equal((await other.query('select mushavo_email_install.activate() value')).rows[0].value.guarded_RPCs,148);
 const functions="select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,pg_get_functiondef(p.oid) definition,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') service from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','mushavo_email_auth','mushavo_email_install') and p.prokind='f' order by 1,2,3";assert.deepEqual((await other.query(functions)).rows,await rows(functions));const policies='select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies order by 1,2,3';assert.deepEqual((await other.query(policies)).rows,await rows(policies));assert.deepEqual((await other.query("select atttypid::regtype::text type,atttypmod,attnotnull from pg_attribute where attrelid='auth.users'::regclass and attname='encrypted_password'")).rows,initialColumn);
 }finally{await other.close();}
});
