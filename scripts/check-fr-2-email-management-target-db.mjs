// Actual fixed query under a modeled read-only provider role; no application reads.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
import {targetQueryURL,expectedChecks} from './check-fr-2-email-management-target.mjs';
const ensure=JSON.parse(await readFile(root+'/tests/fixtures/fr-2-reviewed-ensure-rls.json','utf8'));
const providers=JSON.parse(await readFile(root+'/tests/fixtures/fr-2-reviewed-provider-hooks.json','utf8')).hooks;
const {db}=await localDatabase(process.env.MUSHAVO_EMAIL_UI_PGLITE,{preparePlatform:async d=>{
  await d.exec("alter table auth.users add column email_confirmed_at timestamptz,add column encrypted_password varchar(255),add column banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id),not_after timestamptz);alter table storage.buckets enable row level security;create role supabase_admin superuser;create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path=pg_catalog as $hook$"+ensure.body+"$hook$;create event trigger ensure_rls on ddl_command_end when tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO') execute function public.rls_auto_enable()");
  for(const h of providers)await d.exec('create function extensions.'+h.name+"() returns event_trigger language plpgsql set search_path='' as $provider$"+h.body+'$provider$;alter function extensions.'+h.name+'() owner to supabase_admin;create event trigger '+h.name+' on '+h.event+' execute function extensions.'+h.name+'();alter event trigger '+h.name+' owner to supabase_admin');
  for(const [name,event,tag]of [['fixture_graphql_drop','sql_drop','DROP EXTENSION'],['fixture_cron','ddl_command_end','CREATE EXTENSION'],['fixture_graphql','ddl_command_end','CREATE EXTENSION'],['fixture_net','ddl_command_end','CREATE EXTENSION']])await d.exec('create function extensions.'+name+'() returns event_trigger language plpgsql as $$begin return;end;$$;create event trigger '+name+' on '+event+" when tag in ('"+tag+"') execute function extensions."+name+'()');
  // The application bootstrap models two Storage tables. Six explicit inert
  // stand-ins model the observed hosted count, not provider Storage behavior.
  for(let i=0;i<6;i++)await d.exec('create table storage.fixture_extra_'+i+'(id integer);alter table storage.fixture_extra_'+i+' enable row level security');
}});
await db.exec('create role supabase_read_only_user;grant usage on schema public,auth,storage to supabase_read_only_user');
test.after(()=>db.close());const query=await readFile(targetQueryURL,'utf8');
async function inspect(){await db.exec('begin transaction read only;set local role supabase_read_only_user');try{return(await db.query(query)).rows[0].staging_target_preflight;}finally{await db.exec('rollback');}}
test('The exact fixed statement compiles and returns eight matching checks in a real READ ONLY transaction',async()=>{
  const r=await inspect();assert.equal(r.read_only_role,true);assert.equal(r.transaction_read_only,'on');assert.deepEqual(r.checks,Object.fromEntries(expectedChecks.map(k=>[k,true])));
});
test('The modeled role can inspect the pinned catalogs without permission to select application or Auth rows',async()=>{
  await db.exec('begin transaction read only;set local role supabase_read_only_user');try{await assert.rejects(db.query('select id from auth.users'),e=>e.code==='42501');}finally{await db.exec('rollback');}
  assert.equal((await inspect()).checks.selected_routine_count_matches,true);
});
test('An existing installer namespace is reported without invoking or replacing an installer',async()=>{
  await db.exec('create schema mushavo_email_install');
  assert.equal((await inspect()).checks.email_backend_installer_and_guards_absent,false);
});
