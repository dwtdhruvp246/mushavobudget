// Replay the exact owner-returned hook with installer registration/activation in memory only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
import {installerMigration} from './lib/email-atomic-source.mjs';
const ensure=JSON.parse(await readFile(path.join(root,'tests/fixtures/fr-2-reviewed-ensure-rls.json'),'utf8'));
const providers=JSON.parse(await readFile(path.join(root,'tests/fixtures/fr-2-reviewed-provider-hooks.json'),'utf8')).hooks;
async function preparePlatform(db){
 assert(!ensure.body.includes('$ensure_fixture$'));
 await db.exec("create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path=pg_catalog as $ensure_fixture$"+ensure.body+"$ensure_fixture$;create event trigger ensure_rls on ddl_command_end when tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO') execute function public.rls_auto_enable();create role supabase_admin superuser");
 for(const hook of providers){assert.match(hook.name,/^pgrst_(ddl|drop)_watch$/);assert(!hook.body.includes('$provider_fixture$'));await db.exec('create function extensions.'+hook.name+"() returns event_trigger language plpgsql set search_path='' as $provider_fixture$"+hook.body+'$provider_fixture$;alter function extensions.'+hook.name+'() owner to supabase_admin;create event trigger '+hook.name+' on '+hook.event+' execute function extensions.'+hook.name+'();alter event trigger '+hook.name+' owner to supabase_admin');}
}
const {db,migrations}=await localDatabase(process.env.MUSHAVO_EMAIL_UI_PGLITE,{includeEmailInstaller:true,preparePlatform});
test.after(async()=>{await db.close();});
const rows=async(sql,params)=>(await db.query(sql,params)).rows;
const value=async(sql,params)=>(await rows(sql,params))[0].value;
const call=()=>value('select mushavo_email_install.activate() value');
const migrationSource=await readFile(path.join(root,'supabase/migrations',installerMigration),'utf8');
await db.exec("set mushavo.email_atomic_review='OFFLINE_ATOMIC_REHEARSAL'");
const hookState=()=>rows("select e.evtname,e.evtevent,e.evtenabled,e.evttags,er.rolname hook_owner,n.nspname,p.proname,pr.rolname function_owner,p.prosecdef,p.proconfig,encode(sha256(convert_to(replace(p.prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex') body_sha256,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') service from pg_event_trigger e join pg_proc p on p.oid=e.evtfoid join pg_namespace n on n.oid=p.pronamespace join pg_roles er on er.oid=e.evtowner join pg_roles pr on pr.oid=p.proowner order by e.evtname");
async function appRowsDigest(){
 const tables=await rows("select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','auth','storage') and c.relkind='r' order by 1,2");const data=[];
 for(const t of tables){const q=x=>'"'+x.replaceAll('"','""')+'"';data.push([t.nspname,t.relname,await rows('select to_jsonb(t) value from '+q(t.nspname)+'.'+q(t.relname)+' t order by to_jsonb(t)::text')]);}
 return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}
async function state(){
 const metadata=await rows("select jsonb_build_object('functions',(select jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),pg_get_functiondef(p.oid),p.proacl::text) order by n.nspname,p.proname,p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','extensions','mushavo_email_auth','mushavo_email_install') and p.prokind='f'),'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p),'relations',(select jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','auth','storage','mushavo_email_auth') and c.relkind in('r','v'))) value");
 return createHash('sha256').update(JSON.stringify({metadata,hooks:await hookState(),rows:await appRowsDigest()})).digest('hex');
}
const absent=async()=>assert.equal(await value("select to_regnamespace('mushavo_email_auth') value"),null);
async function rejectMutation(ddl){
 const before=await state();await db.exec('begin;'+ddl);await assert.rejects(call,/EMAIL_ATOMIC_UNREVIEWED_DDL_HOOK/);await db.exec('rollback');assert.equal(await state(),before);await absent();
}
test('The exact owner source fixture retains the 953-byte MD5/SHA256 and observed metadata',()=>{
 assert.equal(Buffer.byteLength(ensure.body),953);assert.equal(createHash('md5').update(ensure.body).digest('hex'),'99be20677b456ea8d3be47bdd44fb369');assert.equal(createHash('sha256').update(ensure.body).digest('hex'),'2782e98b348aca7d6f6f73c420fd78d2e094957dd7a52b0483d4c34f29d2a7a1');assert.deepEqual(ensure.tags,['CREATE TABLE','CREATE TABLE AS','SELECT INTO']);assert.equal(ensure.security_definer,true);assert.equal(ensure.project_selection_independently_verified,false);
});
test('Full55 migrations compile with all three exact hooks already enabled and register without activating',async()=>{
 assert.equal(migrations.length,55);assert.equal((await hookState()).length,3);for(const h of await hookState())assert.equal(h.evtenabled,'O');await absent();assert.notEqual(await value("select to_regprocedure('mushavo_email_install.activate()') value"),null);assert.equal(await value("select count(*)::int value from pg_proc where pronamespace='public'::regnamespace and prorettype<>'event_trigger'::regtype and prokind='f'"),278);
});
test('The actual hook enables public RLS for CREATE TABLE, CTAS and SELECT INTO but skips private tables',async()=>{
 const before=await hookState();await db.exec('create table public.hook_plain(id integer);create table public.hook_as as select 1::integer id;select 1::integer as id into public.hook_into;create schema hook_review_private;create table hook_review_private.hook_private(id integer)');
 const publicFlags=await rows("select relname,relrowsecurity,relforcerowsecurity from pg_class where oid in('public.hook_plain'::regclass,'public.hook_as'::regclass,'public.hook_into'::regclass) order by relname");assert.equal(publicFlags.length,3);for(const f of publicFlags){assert.equal(f.relrowsecurity,true);assert.equal(f.relforcerowsecurity,false);}assert.equal(await value("select relrowsecurity value from pg_class where oid='hook_review_private.hook_private'::regclass"),false);
 await db.exec('drop table public.hook_plain,public.hook_as,public.hook_into;drop schema hook_review_private cascade');assert.deepEqual(await hookState(),before);
});
test('PostgreSQL-supplied object identity preserves a quoted public identifier containing punctuation',async()=>{
 await db.exec('create table public."hook quoted; keep safe"(id integer)');assert.equal(await value("select relrowsecurity value from pg_class where relnamespace='public'::regnamespace and relname='hook quoted; keep safe'"),true);await db.exec('drop table public."hook quoted; keep safe"');await absent();
});
test('The hook swallows an ALTER failure, while the installer still refuses the unrelated failing event hook',async()=>{
 await db.exec("create function extensions.hook_review_fail_alter() returns event_trigger language plpgsql as $$begin raise exception 'SYNTHETIC_ALTER_FAILURE';end;$$;create event trigger hook_review_fail_alter on ddl_command_end when tag in ('ALTER TABLE') execute function extensions.hook_review_fail_alter();create table public.hook_failed_rls(id integer)");assert.equal(await value("select relrowsecurity value from pg_class where oid='public.hook_failed_rls'::regclass"),false);const before=await state();await assert.rejects(call,/EMAIL_ATOMIC_UNREVIEWED_DDL_HOOK/);assert.equal(await state(),before);await absent();await db.exec('drop event trigger hook_review_fail_alter;drop function extensions.hook_review_fail_alter();drop table public.hook_failed_rls');
});
test('Existing API EXECUTE grants do not let ordinary SQL calls invoke an event-trigger function',async()=>{
 const before=await hookState();for(const role of['anon','authenticated','service_role']){await db.exec('begin;set local role '+role);await assert.rejects(db.query('select public.rls_auto_enable()'),/event trigger context|trigger functions can only/i);await db.exec('rollback');}assert.deepEqual(await hookState(),before);
});
test('A whitespace-only change to the reviewed body is rejected before activation',async()=>{
 const definition=await value("select pg_get_functiondef('public.rls_auto_enable()'::regprocedure) value");await rejectMutation(definition.replace('AS $function$','AS $function$\n'));
});
test('The registration guard also rejects body drift without replacing the existing private installer',async()=>{
 const before=await state();await db.exec('begin;drop schema mushavo_email_install cascade');const definition=await value("select pg_get_functiondef('public.rls_auto_enable()'::regprocedure) value");await db.exec(definition.replace('AS $function$','AS $function$\n'));await assert.rejects(db.exec(migrationSource),/EMAIL_ATOMIC_UNREVIEWED_DDL_HOOK/);await db.exec('rollback');assert.equal(await state(),before);
});
for(const [title,ddl]of[
 ['A broadened event tag binding','drop event trigger ensure_rls;create event trigger ensure_rls on ddl_command_end execute function public.rls_auto_enable()'],
 ['An ALWAYS-mode hook',"alter event trigger ensure_rls enable always"],
 ['A different function search path','alter function public.rls_auto_enable() set search_path=public,pg_temp'],
 ['A changed security-definer flag','alter function public.rls_auto_enable() security invoker'],
 ['A changed function owner','create role ensure_review_owner superuser;alter function public.rls_auto_enable() owner to ensure_review_owner'],
 ['Changed effective API execution grants','revoke execute on function public.rls_auto_enable() from public,anon'],
 ['An extra function overload',"create function public.rls_auto_enable(text) returns void language sql as $$select null::text$$"],
 ['An extra hook binding',"create event trigger ensure_rls_extra on ddl_command_end when tag in ('CREATE TABLE') execute function public.rls_auto_enable()"]
])test(title+' is refused without changing the original hook or installing guards',async()=>rejectMutation(ddl));
test('With the reviewed hook enabled, activation explicitly enables and forces RLS on all five private tables and can roll back',async()=>{
 await db.exec("alter table auth.users add column email_confirmed_at timestamptz,add column encrypted_password text,add column banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz)");
 const before=await state(),hooksBefore=await hookState();await db.exec('begin');assert.equal((await call()).guarded_RPCs,148);const flags=await rows("select relname,relrowsecurity,relforcerowsecurity from pg_class where relnamespace='mushavo_email_auth'::regnamespace and relkind='r' order by relname");assert.equal(flags.length,5);for(const f of flags){assert.equal(f.relrowsecurity,true);assert.equal(f.relforcerowsecurity,true);}assert.deepEqual(await hookState(),hooksBefore);await db.exec('rollback');assert.equal(await state(),before);await absent();
});
test('A false private FORCE RLS postcondition aborts and rolls back the whole activation',async()=>{
 const before=await state(),definition=await value("select pg_get_functiondef('mushavo_email_install.activate()'::regprocedure) value");assert(definition.includes('-- FR_ATOMIC_FINAL_ASSERTIONS'));await db.exec('begin');await db.exec(definition.replace('-- FR_ATOMIC_FINAL_ASSERTIONS','ALTER TABLE mushavo_email_auth.devices NO FORCE ROW LEVEL SECURITY;\n -- FR_ATOMIC_FINAL_ASSERTIONS'));await assert.rejects(call,/EMAIL_ATOMIC_FINAL_INVENTORY_MISMATCH/);await db.exec('rollback');assert.equal(await state(),before);await absent();
});
test('An extension-only hook is outside this installer DDL scope and is not invoked during successful rehearsal',async()=>{
 await db.exec("create function extensions.hook_review_unused_extension() returns event_trigger language plpgsql as $$begin raise exception 'EXTENSION_HOOK_MUST_NOT_RUN';end;$$;create event trigger hook_review_unused_extension on ddl_command_end when tag in ('CREATE EXTENSION') execute function extensions.hook_review_unused_extension()");const before=await state();await db.exec('begin');assert.equal((await call()).restrictive_policies,82);await db.exec('rollback');assert.equal(await state(),before);await db.exec('drop event trigger hook_review_unused_extension;drop function extensions.hook_review_unused_extension()');
});
test('Committed activation preserves all modeled public/Auth/Storage rows and leaves all three hooks enabled and byte-identical',async()=>{
 await db.exec("insert into auth.users(id,email,email_confirmed_at) values('00000000-0000-4000-8000-000000000861','hook-a@example.invalid',now()),('00000000-0000-4000-8000-000000000862','hook-b@example.invalid',now())");const before=await appRowsDigest(),hooksBefore=await hookState();assert.deepEqual(await call(),{result:'ATOMIC_EMAIL_SOURCE_REHEARSAL_INSTALLED',guarded_RPCs:148,restrictive_policies:82,hosted_acceptance:false});assert.equal(await appRowsDigest(),before);assert.deepEqual(await hookState(),hooksBefore);assert.equal(await value("select count(*)::int value from pg_policies where policyname='Email verified session required'"),82);
});
test('Canonical55 with the same three pre-existing hooks registers and activates identical application/email catalogs',async()=>{
 const {db:canonical,migrations:all}=await localDatabase(process.env.MUSHAVO_EMAIL_UI_PGLITE,{includeEmailInstaller:true,creationPath:'canonical',preparePlatform});
 try{assert.equal(all.length,55);assert.equal((await canonical.query("select to_regnamespace('mushavo_email_auth') value")).rows[0].value,null);await canonical.exec("alter table auth.users add column email_confirmed_at timestamptz,add column encrypted_password text,add column banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);set mushavo.email_atomic_review='OFFLINE_ATOMIC_REHEARSAL'");assert.equal((await canonical.query('select mushavo_email_install.activate() value')).rows[0].value.guarded_RPCs,148);
 const sql="select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,pg_get_functiondef(p.oid) definition,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') service from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','mushavo_email_auth','mushavo_email_install') and p.prokind='f' order by 1,2,3";assert.deepEqual((await canonical.query(sql)).rows,await rows(sql));const policies='select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies order by 1,2,3';assert.deepEqual((await canonical.query(policies)).rows,await rows(policies));const flags="select n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','mushavo_email_auth','auth','storage') and c.relkind in('r','v') order by 1,2";assert.deepEqual((await canonical.query(flags)).rows,await rows(flags));
 }finally{await canonical.close();}
});
