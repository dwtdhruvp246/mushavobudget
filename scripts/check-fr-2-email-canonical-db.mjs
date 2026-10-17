// Two independent modeled platform databases; no hosted connections or provider calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
const modulePath=process.env.MUSHAVO_EMAIL_UI_PGLITE;
const {PGlite}=await import(pathToFileURL(path.resolve(modulePath)));
const {db:migration,migrations}=await localDatabase(modulePath);
const canonical=new PGlite();
test.after(async()=>{await migration.close();await canonical.close();});
await canonical.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create schema extensions;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb,created_at timestamptz default now());
 create table auth.mfa_factors(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),status text,factor_type text);
 create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
 create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),auth.jwt()->>'role')$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text);
 alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
 grant usage on schema auth,storage,public to anon,authenticated,service_role;grant select,insert,update,delete on storage.objects to authenticated;
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
 alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
 alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;`);
await canonical.exec((await readFile(path.join(root,'supabase/schema.sql'),'utf8')).replace(/^create extension if not exists pgcrypto;\s*$/gim,''));
const databases=[migration,canonical];
const query=async(db,sql,params)=>(await db.query(sql,params)).rows;
async function equalSQL(sql){assert.deepEqual(await query(canonical,sql),await query(migration,sql));}
const routines=`select n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) args,
 pg_get_function_result(p.oid) result,l.lanname language,md5(replace(p.prosrc,E'\\r\\n',E'\\n')) body_md5,
 p.prosecdef definer,p.provolatile volatility,p.proisstrict strict,p.proleakproof leakproof,p.proparallel parallel,p.proconfig settings,
 has_function_privilege('anon',p.oid,'execute') anon,has_function_privilege('authenticated',p.oid,'execute') authenticated,
 has_function_privilege('service_role',p.oid,'execute') service
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
 where n.nspname in('public','mushavo_email_auth') and p.prokind='f' order by 1,2,3`;
const A='00000000-0000-4000-8000-000000000991',B='00000000-0000-4000-8000-000000000992',S='00000000-0000-4000-8000-000000000993',T='00000000-0000-4000-8000-000000000994';
const claims=(user,session)=>({sub:user,session_id:session,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600});
async function context(db,role,claimsValue,body){
 await db.exec('begin');
 try{await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claimsValue)]);await db.exec('set local role '+role);const value=await body();await db.exec('rollback');return value;}catch(error){await db.exec('rollback');throw error;}
}
const proof=async(db,user,session)=>context(db,'authenticated',claims(user,session),async()=>(await query(db,'select public.email_gate_current_session_verified() value'))[0].value);
test('Canonical bootstrap and all 54 migrations compile independently with no Auth account fixtures',async()=>{
 assert.equal(migrations.length,54);for(const db of databases){assert.equal((await query(db,"select count(*)::int n from pg_proc where pronamespace='public'::regnamespace and prokind='f'"))[0].n,278);assert.equal((await query(db,'select count(*)::int n from auth.users'))[0].n,0);}
});
test('All 278 public routine bodies, signatures, metadata and effective API execution grants match',async()=>{await equalSQL(routines);});
test('Every public/storage relation RLS setting and all 166 policies match',async()=>{
 await equalSQL("select n.nspname,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.reloptions from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','storage') and c.relkind in('r','v') order by 1,2");
 const sql="select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname in('public','storage') order by 1,2,3";await equalSQL(sql);assert.equal((await query(canonical,sql)).length,166);
});
test('Column definitions, generated expressions, constraints and indexes match across both paths',async()=>{
 await equalSQL("select n.nspname,c.relname,a.attname,format_type(a.atttypid,a.atttypmod) type,a.attnotnull,a.attgenerated,a.attidentity,pg_get_expr(d.adbin,d.adrelid) expression from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where n.nspname in('public','storage') and c.relkind in('r','v') and a.attnum>0 and not a.attisdropped order by 1,2,a.attnum");
 await equalSQL("select n.nspname,c.relname,k.conname,k.contype,k.convalidated,pg_get_constraintdef(k.oid) definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','storage') order by 1,2,3");
 await equalSQL("select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname in('public','storage') order by 1,2,3");
});
test('Trigger bindings and publication memberships match without invoking application routines',async()=>{
 await equalSQL("select n.nspname,c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in('public','storage','auth') order by 1,2,3");
 await equalSQL('select pubname,schemaname,tablename from pg_publication_tables order by 1,2,3');
});
test('Effective table and column grants match, and direct provisioning/contact submission stay denied',async()=>{
 await equalSQL("select grantor,grantee,table_schema,table_name,privilege_type,is_grantable from information_schema.table_privileges where table_schema in('public','storage') order by 1,2,3,4,5");
 await equalSQL("select grantor,grantee,table_schema,table_name,column_name,privilege_type,is_grantable from information_schema.column_privileges where table_schema in('public','storage') order by 1,2,3,4,5,6");
 for(const db of databases)for(const role of['anon','authenticated']){
  const result=(await query(db,"select has_function_privilege($1,'public.provision_budget_user(uuid)','execute') provision,has_any_column_privilege($1,'public.enquiries','INSERT') contact,has_function_privilege($1,'public.submit_verified_public_enquiry(jsonb,text)','execute') gate",[role]))[0];assert.deepEqual(result,{provision:false,contact:false,gate:false});
 }
});
test('Only the modeled service role can submit a valid contact; the temporary positive effect rolls back',async()=>{
 const submission={full_name:'Synthetic Contact',email:'canonical@example.invalid',message:'Synthetic canonical source check only.',country_name:'United States',country_code:'US',enquiry_type:'support'};
 for(const db of databases){
  for(const role of['anon','authenticated'])await assert.rejects(context(db,role,{role},()=>db.query('select public.submit_verified_public_enquiry($1,$2)',[submission,'a'.repeat(64)])),e=>e.code==='42501');
  const result=await context(db,'service_role',{role:'service_role'},async()=>{const value=(await query(db,'select public.submit_verified_public_enquiry($1,$2) value',[submission,'a'.repeat(64)]))[0].value;assert.equal((await query(db,'select count(*)::int n from public.enquiries'))[0].n,1);return value;});assert.deepEqual(result,{accepted:true});assert.equal((await query(db,'select count(*)::int n from public.enquiries'))[0].n,0);
 }
});
test('The existing four email candidates compile against both paths and produce identical guarded routine/policy catalogs',async()=>{
 for(const db of databases){
  await db.exec("alter table auth.users add column email_confirmed_at timestamptz,add column encrypted_password text,add column banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);set mushavo.email_backend_review='OFFLINE_SOURCE_CANDIDATE';set mushavo.email_session_review='OFFLINE_SOURCE_CANDIDATE';set mushavo.email_data_guard_review='OFFLINE_SOURCE_CANDIDATE';set mushavo.email_admin_review='OFFLINE_SOURCE_CANDIDATE';");
  for(const part of['verification_backend','session_predicate','data_guards','admin_status'])await db.exec(await readFile(path.join(root,'supabase/candidates/security_fr_2_4_email_'+part+'.sql'),'utf8'));
 }
 await equalSQL(routines);await equalSQL("select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname in('public','storage') order by 1,2,3");
 assert.equal((await query(canonical,"select count(*)::int n from pg_policies where policyname='Email verified session required'"))[0].n,82);
 assert.equal((await query(canonical,"select count(*)::int n from pg_proc where pronamespace='public'::regnamespace and position('PERFORM mushavo_email_auth.require_application_session();' in prosrc)>0"))[0].n,148);
});
test('Ordinary and Admin password-only sessions both lack server proof and protected profile access',async()=>{
 for(const db of databases){
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'canonical-a@example.invalid',now()),($2,'canonical-b@example.invalid',now())",[A,B]);await db.query('insert into auth.sessions(id,user_id) values($1,$2),($3,$4)',[S,A,T,B]);await db.query("insert into public.app_admins(user_id,email,role) values($1,'canonical-b@example.invalid','super_admin')",[B]);
  for(const [user,session]of[[A,S],[B,T]]){assert.equal(await proof(db,user,session),false);assert.equal((await context(db,'authenticated',claims(user,session),()=>query(db,'select id from public.profiles where id=$1',[user]))).length,0);}
 }
});
async function verify(db,user,session,challenge){
 await context(db,'service_role',{role:'service_role'},async()=>{
  assert.equal((await query(db,"select public.email_gate_begin_challenge($1,$2,$3,$4,'test',false) value",[user,session,challenge,'b'.repeat(64)]))[0].value.result,'PENDING_DELIVERY');
  assert.equal((await query(db,'select public.email_gate_set_delivery($1,$2,$3,true) value',[user,session,challenge]))[0].value.result,'READY');
  assert.equal((await query(db,'select public.email_gate_verify_challenge($1,$2,$3,$4,null) value',[user,session,challenge,'b'.repeat(64)]))[0].value.result,'VERIFIED');
  // Commit only this synthetic service transaction so subsequent API probes see proof.
  await db.exec('commit');
 });
}
test('The actual service challenge transition grants only the modeled ordinary caller its exact session proof',async()=>{
 for(const db of databases){await verify(db,A,S,'00000000-0000-4000-8000-000000000995');assert.equal(await proof(db,A,S),true);assert.equal(await proof(db,B,T),false);
  const rows=await context(db,'authenticated',claims(A,S),()=>query(db,'select id from public.profiles order by id'));assert.deepEqual(rows,[{id:A}]);const status=await context(db,'authenticated',claims(A,S),async()=>(await query(db,'select public.email_gate_admin_status() value'))[0].value);assert.deepEqual(status,{contract:1,verified:true,authorized:false,role:null});
 }
});
test('The same email gate retains an existing Admin role after exact-session verification',async()=>{
 for(const db of databases){await verify(db,B,T,'00000000-0000-4000-8000-000000000996');assert.equal(await proof(db,B,T),true);const status=await context(db,'authenticated',claims(B,T),async()=>(await query(db,'select public.email_gate_admin_status() value'))[0].value);assert.deepEqual(status,{contract:1,verified:true,authorized:true,role:'super_admin'});}
});
test('A repeated backend installation refuses existing state without changing synthetic proofs or roles',async()=>{
 for(const db of databases){const before=await query(db,'select session_id,user_id from mushavo_email_auth.session_proofs order by session_id');await assert.rejects(db.exec(await readFile(path.join(root,'supabase/candidates/security_fr_2_4_email_verification_backend.sql'),'utf8')),/EMAIL_BACKEND_NAMESPACE_ALREADY_EXISTS/);await db.exec('rollback');assert.deepEqual(await query(db,'select session_id,user_id from mushavo_email_auth.session_proofs order by session_id'),before);assert.equal((await query(db,'select count(*)::int n from public.app_admins'))[0].n,1);}
});
