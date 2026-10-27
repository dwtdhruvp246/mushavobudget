import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {renderPersistentDeviceUpgrade,renderPersistentDeviceHandoff,quarantineSQL,componentPath,upgradePath,handoffPath} from '../scripts/lib/email-persistent-device-source.mjs';
if(!process.env.MUSHAVO_PGLITE_MODULE)throw Error('PINNED_PGLITE_MODULE_REQUIRED');
const {PGlite}=await import(pathToFileURL(process.env.MUSHAVO_PGLITE_MODULE).href);
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const component=read(componentPath),upgrade=read(upgradePath);
let db,original;
const query=async(sql)=>(await db.query(sql)).rows[0];
const unchanged=async()=>{assert.equal((await query("select count(*)::int n from pg_attribute where attrelid='mushavo_email_auth.devices'::regclass and attname='enrollment_method' and not attisdropped")).n,0);};
async function rejected(sql,pattern){try{await assert.rejects(db.exec(sql),pattern);}finally{await db.exec('ROLLBACK');}await unchanged();}
before(async()=>{
 db=new PGlite();
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,encrypted_password text,banned_until timestamptz);create table auth.sessions(id uuid primary key,user_id uuid references auth.users on delete cascade,not_after timestamptz);create table public.profiles(id uuid primary key,account_status text);set mushavo.email_backend_review='OFFLINE_SOURCE_CANDIDATE'");
 await db.exec(read('supabase/candidates/security_fr_2_4_email_verification_backend.sql'));
 await db.exec(read('tests/fixtures/persistent-device-staging-model.sql'));
 // Synthetic application guards/policies provide the inventory shape, not product RPC behavior.
 for(let i=0;i<148;i++)await db.exec(`create function public.modeled_guard_${i}() returns void language plpgsql as $f$begin PERFORM mushavo_email_auth.require_application_session();end;$f$`);
 for(let i=0;i<82;i++)await db.exec(`create table public.modeled_table_${i}(id integer);alter table public.modeled_table_${i} enable row level security;create policy "Email verified session required" on public.modeled_table_${i} as restrictive to authenticated using(false)`);
 await db.exec("insert into mushavo_email_install.rollout_control values(true,'dczlddwbtgvfdujgcitb','QUARANTINED',mushavo_email_install.catalog_identity(),clock_timestamp())");
 original=(await query("select pg_get_functiondef('mushavo_email_auth.session_valid(uuid,uuid)'::regprocedure) source")).source;
});
after(async()=>{await db?.close();});
test('published SQL is an exact rendering of the reviewed component and wrapper',()=>{assert.equal(upgrade,renderPersistentDeviceUpgrade(component));assert.equal(read(handoffPath),renderPersistentDeviceHandoff(component));});
test('wrong project acknowledgement rolls back before schema changes',async()=>{
 await rejected(upgrade.replace("SET LOCAL mushavo.email_rollout_project='dczlddwbtgvfdujgcitb'","SET LOCAL mushavo.email_rollout_project='wrong'"),/TARGET_ACTION_REQUIRED/);
});
test('an active rollout is refused with no partial schema update',async()=>{
 await db.exec("update mushavo_email_install.rollout_control set mode='ACTIVE'");
 await rejected(upgrade,/QUARANTINED_CATALOG_REQUIRED/);
 await db.exec("update mushavo_email_install.rollout_control set mode='QUARANTINED'");
});
test('selected catalog drift is refused instead of blessing a new catalog',async()=>{
 await db.exec('create function public.unexpected_catalog_change() returns boolean language sql as $$select true$$');
 await rejected(upgrade,/QUARANTINED_CATALOG_REQUIRED/);
 await db.exec('drop function public.unexpected_catalog_change()');
});
test('a live acceptance deadline must be closed before installing',async()=>{
 await db.exec("insert into mushavo_email_install.acceptance_window values(true,'dczlddwbtgvfdujgcitb',array['00000000-0000-4000-8000-000000000001'::uuid],clock_timestamp(),clock_timestamp()+interval '10 minutes')");
 await rejected(upgrade,/CLOSED_WINDOW_REQUIRED/);await db.exec('delete from mushavo_email_install.acceptance_window');
});
test('a changed session predicate is rejected even if a privileged caller repins the catalog',async()=>{
 await db.exec("create or replace function mushavo_email_auth.session_valid(p_user uuid,p_session uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$select true$$;update mushavo_email_install.rollout_control set catalog_sha256=mushavo_email_install.catalog_identity()");
 await rejected(upgrade,/BOUNDED_PREDICATE_REQUIRED/);
 await db.exec(original+";update mushavo_email_install.rollout_control set catalog_sha256=mushavo_email_install.catalog_identity()");
});
test('an unreviewed DDL hook is refused and never disabled',async()=>{
 await db.exec("create function public.unreviewed_hook() returns event_trigger language plpgsql as $$begin end$$;create event trigger unreviewed_hook on ddl_command_end execute function public.unreviewed_hook()");
 await rejected(upgrade,/UNREVIEWED_DDL_HOOK/);
 assert.equal((await query("select evtenabled from pg_event_trigger where evtname='unreviewed_hook'")).evtenabled,'O');
 await db.exec('drop event trigger unreviewed_hook;drop function public.unreviewed_hook()');
});
test('postcondition failure rolls all component DDL and data back',async()=>{
 const injected=component+"\nGRANT SELECT ON mushavo_email_auth.devices TO authenticated;\n";
 await rejected(renderPersistentDeviceUpgrade(injected),/PROTECTED_CATALOG_CHANGED/);
 assert.equal((await query("select has_table_privilege('authenticated','mushavo_email_auth.devices','SELECT') allowed")).allowed,false);
});
test('the guarded upgrade stays quarantined, retains the exact bounded predicate and refreshes its legitimate catalog identity',async()=>{
 // Exercise the real maintenance prefix starting from an ACTIVE bounded window.
 await db.exec("update mushavo_email_install.rollout_control set mode='ACTIVE';insert into mushavo_email_install.acceptance_window values(true,'dczlddwbtgvfdujgcitb',array['00000000-0000-4000-8000-000000000001'::uuid],clock_timestamp(),clock_timestamp()+interval '10 minutes')");
 await db.exec(quarantineSQL);
 assert.equal((await query('select mode from mushavo_email_install.rollout_control')).mode,'QUARANTINED');
 assert.equal((await query('select count(*)::int n from mushavo_email_install.acceptance_window')).n,0);
 await db.exec(upgrade);
 assert.equal((await query("select pg_get_functiondef('mushavo_email_auth.session_valid(uuid,uuid)'::regprocedure) source")).source,original);
 const state=await query('select mode,catalog_sha256=mushavo_email_install.catalog_identity() matched from mushavo_email_install.rollout_control');
 assert.equal(state.mode,'QUARANTINED');assert.equal(state.matched,true);
 assert.equal((await query('select count(*)::int n from mushavo_email_install.acceptance_window')).n,0);
 assert.equal((await query("select count(*)::int n from pg_proc where pronamespace='public'::regnamespace and position('PERFORM mushavo_email_auth.require_application_session();' in prosrc)>0")).n,148);
});
test('rerunning the completed upgrade is refused without changing the accepted catalog',async()=>{
 await assert.rejects(db.exec(upgrade),/FRESH_COMPONENT_REQUIRED/);await db.exec('ROLLBACK');
 assert.equal((await query('select catalog_sha256=mushavo_email_install.catalog_identity() matched from mushavo_email_install.rollout_control')).matched,true);
});
