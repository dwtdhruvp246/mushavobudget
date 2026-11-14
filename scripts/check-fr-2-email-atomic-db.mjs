// Actual private installer and rollback checks in a modeled platform database only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
import {installerMigration} from './lib/email-atomic-source.mjs';
const {db,migrations}=await localDatabase(process.env.MUSHAVO_EMAIL_UI_PGLITE,{includeEmailInstaller:true});
test.after(async()=>{await db.close();});
const rows=async(sql,params)=>(await db.query(sql,params)).rows;
const value=async(sql,params)=>(await rows(sql,params))[0].value;
const migrationSource=await readFile(path.join(root,'supabase/migrations',installerMigration),'utf8');
const hooks=JSON.parse(await readFile(path.join(root,'tests/fixtures/fr-2-reviewed-provider-hooks.json'),'utf8')).hooks;
const call=()=>value('select mushavo_email_install.activate() value');
const absent=async()=>{assert.equal(await value("select to_regnamespace('mushavo_email_auth') value"),null);assert.equal(await value("select count(*)::int value from pg_policies where policyname='Email verified session required'"),0);};
const settings=async()=>rows("select current_setting('mushavo.email_backend_review',true) backend,current_setting('mushavo.email_session_review',true) session,current_setting('mushavo.email_data_guard_review',true) data,current_setting('mushavo.email_admin_review',true) admin");
async function appRowsDigest(){
 const tables=await rows("select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','auth','storage') order by 1,2");
 const contents=[];for(const table of tables){const ident=s=>'"'+s.replaceAll('"','""')+'"';contents.push([table.nspname,table.relname,await rows('select to_jsonb(t) value from '+ident(table.nspname)+'.'+ident(table.relname)+' t order by to_jsonb(t)::text')]);}
 return createHash('sha256').update(JSON.stringify(contents)).digest('hex');
}
async function snapshot(){
 const catalog=await rows(`select jsonb_build_object(
 'functions',(select jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),pg_get_functiondef(p.oid),p.proacl::text) order by n.nspname,p.proname,p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','auth','storage','mushavo_email_auth','mushavo_email_install') and p.prokind='f'),
 'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p),
 'triggers',(select jsonb_agg(jsonb_build_array(t.tgrelid::regclass::text,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid)) order by t.tgrelid,t.tgname) from pg_trigger t where not t.tgisinternal),
 'relations',(select jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relkind,c.relowner,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','auth','storage','mushavo_email_auth','mushavo_email_install') and c.relkind in('r','v'))
 ) value`);
 const tables=await rows("select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','auth','storage','mushavo_email_auth') order by 1,2");
 const contents=[];for(const table of tables){const ident=s=>'"'+s.replaceAll('"','""')+'"';contents.push([table.nspname,table.relname,await rows('select to_jsonb(t) value from '+ident(table.nspname)+'.'+ident(table.relname)+' t order by to_jsonb(t)::text')]);}
 return createHash('sha256').update(JSON.stringify({catalog,contents})).digest('hex');
}
async function rejectUnchanged(body,pattern){const before=await snapshot();await assert.rejects(body,pattern);await db.exec('rollback');assert.equal(await snapshot(),before);await absent();}
async function context(role,claims,body,{commit=false}={}){
 await db.exec('begin');try{await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims)]);await db.exec('set local role '+role);const result=await body();await db.exec(commit?'commit':'rollback');return result;}catch(error){await db.exec('rollback');throw error;}
}
const A='00000000-0000-4000-8000-000000000871',B='00000000-0000-4000-8000-000000000872',S='00000000-0000-4000-8000-000000000873',T='00000000-0000-4000-8000-000000000874';
const claims=(u,s)=>({sub:u,session_id:s,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600});
let originalActivation;
test('All 55 migrations register only a private installer; existing app RPCs/policies remain unmodified',async()=>{
 assert.equal(migrations.length,55);await absent();assert.equal(await value("select count(*)::int value from pg_proc where pronamespace='public'::regnamespace and prokind='f'"),278);assert.equal(await value('select count(*)::int value from pg_policies'),166);originalActivation=await value("select pg_get_functiondef('mushavo_email_install.activate()'::regprocedure) value");
});
test('The installer is invoker-only, has no arguments, and no API role has schema usage or execution',async()=>{
 const p=(await rows("select p.prosecdef,p.pronargs,p.proconfig from pg_proc p where p.oid='mushavo_email_install.activate()'::regprocedure"))[0];assert.equal(p.prosecdef,false);assert.equal(p.pronargs,0);assert.deepEqual(p.proconfig,['search_path=pg_catalog','lock_timeout=3s']);
 for(const role of['anon','authenticated','service_role']){assert.equal(await value("select has_schema_privilege($1,'mushavo_email_install','USAGE') value",[role]),false);assert.equal(await value("select has_function_privilege($1,'mushavo_email_install.activate()','EXECUTE') value",[role]),false);await assert.rejects(context(role,{role},call),e=>e.code==='42501');}await absent();
});
test('Missing or incorrect acknowledgement refuses activation without partial schema or guard installation',async()=>{
 for(const ack of['','STAGING','OFFLINE_SOURCE_CANDIDATE']){await db.query("select set_config('mushavo.email_atomic_review',$1,false)",[ack]);await rejectUnchanged(call,/EMAIL_ATOMIC_OFFLINE_REHEARSAL_ACK_REQUIRED/);}await db.exec("set mushavo.email_atomic_review='OFFLINE_ATOMIC_REHEARSAL'");
});
test('Even accidental private ACL grants cannot let API roles or forged claims activate the installer',async()=>{
 for(const role of['anon','authenticated','service_role']){const before=await snapshot();await db.exec('begin;grant usage on schema mushavo_email_install to '+role+';grant execute on function mushavo_email_install.activate() to '+role);await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({role:'postgres',sub:A})]);await db.exec('set local role '+role);await assert.rejects(call,/EMAIL_ATOMIC_PRIVILEGED_ORIGIN_REQUIRED/);await db.exec('rollback');assert.equal(await snapshot(),before);}await absent();
});
test('An unreviewed CREATE TABLE event hook blocks activation without disabling or invoking it',async()=>{
 await db.exec("create function extensions.fr_atomic_unknown_hook() returns event_trigger language plpgsql as $$begin raise exception 'UNKNOWN_HOOK_WAS_INVOKED';end;$$;create event trigger fr_atomic_unknown_hook on ddl_command_end when tag in ('CREATE TABLE') execute function extensions.fr_atomic_unknown_hook()");
 await rejectUnchanged(call,/EMAIL_ATOMIC_UNREVIEWED_DDL_HOOK/);assert.equal(await value("select evtenabled::text value from pg_event_trigger where evtname='fr_atomic_unknown_hook'"),'O');await db.exec('drop event trigger fr_atomic_unknown_hook;drop function extensions.fr_atomic_unknown_hook()');
});
test('Registration itself refuses an unreviewed hook and rolls back the attempted namespace replacement',async()=>{
 const before=await snapshot();await db.exec("begin;drop schema mushavo_email_install cascade;create function extensions.fr_atomic_unknown_hook() returns event_trigger language plpgsql as $$begin return;end;$$;create event trigger fr_atomic_unknown_hook on ddl_command_end when tag in ('CREATE TABLE') execute function extensions.fr_atomic_unknown_hook()");await assert.rejects(db.exec(migrationSource),/EMAIL_ATOMIC_UNREVIEWED_DDL_HOOK/);await db.exec('rollback');assert.equal(await snapshot(),before);await absent();
});
test('Replica execution and missing modeled Auth prerequisites fail without creating backend objects',async()=>{
 await db.exec("set session_replication_role='replica'");await rejectUnchanged(call,/EMAIL_ATOMIC_PRIVILEGED_ORIGIN_REQUIRED/);await db.exec("set session_replication_role='origin'");await rejectUnchanged(call,/relation "auth.sessions" does not exist/);
 await db.exec("alter table auth.users add column email_confirmed_at timestamptz,add column encrypted_password text,add column banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz)");
});
test('A changed original application routine causes stage-three rejection and rolls back stages one and two',async()=>{
 const original=await value("select pg_get_functiondef('public.is_app_admin()'::regprocedure) value");await db.exec(original.replace('AS $function$','AS $function$\n-- Deliberate synthetic baseline drift.'));
 await rejectUnchanged(call,/EMAIL_DATA_GUARD_UNREVIEWED_ROUTINE_BASELINE/);await db.exec(original);
});
test('An injected failure after all four components rolls back every new object and original routine/policy change',async()=>{
 await db.exec(originalActivation.replace('-- FR_ATOMIC_FINAL_ASSERTIONS',"RAISE EXCEPTION 'SYNTHETIC_FINAL_COMPONENT_FAILURE';\n -- FR_ATOMIC_FINAL_ASSERTIONS"));
 const beforeSettings=await settings();await rejectUnchanged(call,/SYNTHETIC_FINAL_COMPONENT_FAILURE/);assert.deepEqual(await settings(),beforeSettings);await db.exec(originalActivation);
});
test('Successful activation can be rolled back by the caller; the installer never commits internally',async()=>{
 const before=await snapshot();await db.exec('begin');assert.equal((await call()).result,'ATOMIC_EMAIL_SOURCE_REHEARSAL_INSTALLED');assert.notEqual(await value("select to_regnamespace('mushavo_email_auth') value"),null);await db.exec('rollback');assert.equal(await snapshot(),before);await absent();
});
test('Exact reviewed provider hooks can remain enabled during a successful rollback rehearsal',async()=>{
 await db.exec('create role supabase_admin superuser');
 for(const hook of hooks){assert.match(hook.name,/^pgrst_(ddl|drop)_watch$/);assert(!hook.body.includes('$provider_hook$'));await db.exec('create function extensions.'+hook.name+"() returns event_trigger language plpgsql set search_path='' as $provider_hook$"+hook.body+'$provider_hook$;alter function extensions.'+hook.name+'() owner to supabase_admin;create event trigger '+hook.name+' on '+hook.event+' execute function extensions.'+hook.name+'();alter event trigger '+hook.name+' owner to supabase_admin');}
 const before=await snapshot();await db.exec('begin');assert.equal((await call()).restrictive_policies,82);assert.equal(await value("select count(*)::int value from pg_event_trigger where evtenabled='O'"),2);await db.exec('rollback');assert.equal(await snapshot(),before);await absent();
});
test('A whitespace change in a reviewed provider hook is refused before activation',async()=>{
 const before=await snapshot();await db.exec('begin');const definition=await value("select pg_get_functiondef('extensions.pgrst_ddl_watch()'::regprocedure) value");await db.exec(definition.replace('AS $function$','AS $function$\n'));
 await assert.rejects(call,/EMAIL_ATOMIC_UNREVIEWED_DDL_HOOK/);await db.exec('rollback');assert.equal(await snapshot(),before);await absent();
 for(const hook of [...hooks].reverse())await db.exec('drop event trigger '+hook.name+';drop function extensions.'+hook.name+'()');await db.exec('drop role supabase_admin');
});
test('A committed activation preserves existing synthetic app rows and restores all component acknowledgement settings',async()=>{
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'atomic-a@example.invalid',now()),($2,'atomic-b@example.invalid',now())",[A,B]);await db.query('insert into auth.sessions(id,user_id) values($1,$2),($3,$4)',[S,A,T,B]);await db.query("insert into public.app_admins(user_id,email,role) values($1,'atomic-b@example.invalid','super_admin')",[B]);
 await db.exec("set mushavo.email_backend_review='prior-backend';set mushavo.email_session_review='prior-session';set mushavo.email_data_guard_review='prior-data';set mushavo.email_admin_review='prior-admin'");const previous=await settings();const appBefore=await appRowsDigest();
 assert.deepEqual(await call(),{result:'ATOMIC_EMAIL_SOURCE_REHEARSAL_INSTALLED',guarded_RPCs:148,restrictive_policies:82,hosted_acceptance:false});assert.deepEqual(await settings(),previous);assert.equal(await appRowsDigest(),appBefore);assert.equal(await value('select count(*)::int value from mushavo_email_auth.session_proofs'),0);assert.equal(await value('select count(*)::int value from public.app_admins'),1);
});
test('Password-only ordinary and existing Admin sessions both remain locked after installation',async()=>{
 for(const [u,s]of[[A,S],[B,T]]){assert.equal(await context('authenticated',claims(u,s),()=>value('select public.email_gate_current_session_verified() value')),false);assert.equal((await context('authenticated',claims(u,s),()=>rows('select id from public.profiles where id=$1',[u]))).length,0);assert.deepEqual(await context('authenticated',claims(u,s),()=>value('select public.email_gate_admin_status() value')),{contract:1,verified:false,authorized:false,role:null});}
});
test('Actual service SQL establishes exact ordinary session proof without granting an Admin role',async()=>{
 const challenge='00000000-0000-4000-8000-000000000875';await context('service_role',{role:'service_role'},async()=>{
 assert.equal((await value("select public.email_gate_begin_challenge($1,$2,$3,$4,'test',false) value",[A,S,challenge,'a'.repeat(64)])).result,'PENDING_DELIVERY');assert.equal((await value('select public.email_gate_set_delivery($1,$2,$3,true) value',[A,S,challenge])).result,'READY');assert.equal((await value('select public.email_gate_verify_challenge($1,$2,$3,$4,null) value',[A,S,challenge,'a'.repeat(64)])).result,'VERIFIED');},{commit:true});
 assert.equal(await context('authenticated',claims(A,S),()=>value('select public.email_gate_current_session_verified() value')),true);assert.deepEqual(await context('authenticated',claims(A,S),()=>rows('select id from public.profiles')),[{id:A}]);assert.deepEqual(await context('authenticated',claims(A,S),()=>value('select public.email_gate_admin_status() value')),{contract:1,verified:true,authorized:false,role:null});assert.equal(await context('authenticated',claims(B,T),()=>value('select public.email_gate_current_session_verified() value')),false);
});
test('Repeating activation or registration refuses existing state without replacing proofs, roles or guards',async()=>{
 const before=await snapshot();await assert.rejects(call,/EMAIL_BACKEND_NAMESPACE_ALREADY_EXISTS/);assert.equal(await snapshot(),before);await assert.rejects(db.exec(migrationSource),/EMAIL_ATOMIC_INSTALLER_NAMESPACE_EXISTS/);await db.exec('rollback');assert.equal(await snapshot(),before);
});
test('The canonical55 creation path registers and activates the same installer and produces matching protected catalogs',async()=>{
 const {db:canonical,migrations:all,creationPath}=await localDatabase(process.env.MUSHAVO_EMAIL_UI_PGLITE,{includeEmailInstaller:true,creationPath:'canonical'});
 try{
  assert.equal(all.length,55);assert.equal(creationPath,'canonical');assert.equal((await canonical.query("select to_regnamespace('mushavo_email_auth') value")).rows[0].value,null);
  await canonical.exec("alter table auth.users add column email_confirmed_at timestamptz,add column encrypted_password text,add column banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);set mushavo.email_atomic_review='OFFLINE_ATOMIC_REHEARSAL'");
  assert.equal((await canonical.query('select mushavo_email_install.activate() value')).rows[0].value.guarded_RPCs,148);
  const sql="select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,pg_get_functiondef(p.oid) definition,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') service from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','mushavo_email_auth','mushavo_email_install') and p.prokind='f' order by 1,2,3";
  assert.deepEqual((await canonical.query(sql)).rows,await rows(sql));const policies="select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies order by 1,2,3";assert.deepEqual((await canonical.query(policies)).rows,await rows(policies));assert.equal((await canonical.query('select count(*)::int n from auth.users')).rows[0].n,0);assert.equal((await canonical.query('select count(*)::int n from public.app_admins')).rows[0].n,0);
 }finally{await canonical.close();}
});
