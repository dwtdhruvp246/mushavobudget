import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
if(!process.env.MUSHAVO_PGLITE_MODULE)throw Error('PINNED_PGLITE_MODULE_REQUIRED');
const {PGlite}=await import(pathToFileURL(process.env.MUSHAVO_PGLITE_MODULE).href);
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const upgrade=read('supabase/candidates/security_fr_2_5_password_signin_upgrade.sql'),rollback=read('supabase/candidates/security_fr_2_5_password_signin_rollback.sql');
const U='00000000-0000-4000-8000-000000000001',V='00000000-0000-4000-8000-000000000002',S='00000000-0000-4000-8000-000000000011',T='00000000-0000-4000-8000-000000000012';
let db,beforeData,oldPredicate;
const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
const tableSnapshot=async()=>{const out={};for(const name of ['auth.users','auth.sessions','public.profiles','public.app_admins','mushavo_email_auth.account_state','mushavo_email_auth.devices','mushavo_email_auth.challenges','mushavo_email_auth.send_events','mushavo_email_auth.session_proofs','mushavo_email_install.acceptance_window'])out[name]=(await db.query('select to_jsonb(t)::text value from '+name+' t order by to_jsonb(t)::text')).rows;return out;};
const claims=(changes={})=>({sub:U,session_id:S,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,...changes});
async function asUser(action,values=claims(),role='authenticated'){
 await db.query("select set_config('request.jwt.claims',$1,false)",[typeof values==='string'?values:JSON.stringify(values)]);
 await db.exec('set role '+role);
 try{return await action();}finally{await db.exec('reset role');}
}
const status=values=>asUser(()=>one('select public.app_session_status() value').then(x=>x.value),values);
const result=async(sql)=>{const r=await db.exec(sql);return r.flatMap(x=>x.rows||[]).find(x=>x.result)?.result;};
async function refused(sql,pattern){
 try{await assert.rejects(db.exec(sql),pattern);}finally{await db.exec('ROLLBACK;RESET ROLE;SET session_replication_role=origin');}
 assert.equal((await one("select to_regclass('mushavo_email_install.password_signin_policy') value")).value,null);
 assert.deepEqual(await tableSnapshot(),beforeData);
}
before(async()=>{
 db=new PGlite();
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;grant usage on schema auth to anon,authenticated,service_role;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,encrypted_password text,banned_until timestamptz);create table auth.sessions(id uuid primary key,user_id uuid references auth.users on delete cascade,not_after timestamptz);create table public.profiles(id uuid primary key,account_status text);create table public.app_admins(user_id uuid primary key,role text);create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;create function auth.role() returns text language sql stable as $$select auth.jwt()->>'role'$$;set mushavo.email_backend_review='OFFLINE_SOURCE_CANDIDATE'");
 await db.exec(read('supabase/candidates/security_fr_2_4_email_verification_backend.sql'));
 await db.exec(read('tests/fixtures/persistent-device-staging-model.sql'));
 await db.exec("set mushavo.email_session_review='OFFLINE_SOURCE_CANDIDATE';"+read('supabase/candidates/security_fr_2_4_email_session_predicate.sql'));
 const guards=read('supabase/candidates/security_fr_2_4_email_data_guards.sql'),start=guards.indexOf('EXECUTE $helper_ddl$')+'EXECUTE $helper_ddl$'.length,end=guards.indexOf('$helper_ddl$;',start);
 await db.exec(guards.slice(start,end));
 await db.exec("revoke all on function mushavo_email_auth.require_application_session() from public,anon,authenticated,service_role;set mushavo.email_admin_review='OFFLINE_SOURCE_CANDIDATE';"+read('supabase/candidates/security_fr_2_4_email_admin_status.sql'));
 await db.exec("BEGIN;SET LOCAL mushavo.persistent_device_component='VERIFIED_INSTALLER_OR_OFFLINE_REVIEW';"+read('supabase/candidates/security_fr_2_5_persistent_device_component.sql')+'COMMIT;');
 for(let i=0;i<148;i++)await db.exec('create function public.modeled_guard_'+i+'() returns void language plpgsql security definer set search_path=pg_catalog as $$begin PERFORM mushavo_email_auth.require_application_session();end;$$;revoke all on function public.modeled_guard_'+i+'() from public,anon;grant execute on function public.modeled_guard_'+i+'() to authenticated,service_role;');
 for(let i=0;i<82;i++)await db.exec('create table public.modeled_table_'+i+'(id integer,owner_id uuid);alter table public.modeled_table_'+i+' enable row level security;create policy "Email verified session required" on public.modeled_table_'+i+' as restrictive to authenticated using((select public.email_gate_current_session_verified())) with check((select public.email_gate_current_session_verified()))');
 await db.exec('create policy owner_scope on public.modeled_table_0 for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());grant select,insert on public.modeled_table_0 to authenticated;');
 await db.query("insert into auth.users values($1,'primary@example.invalid',now(),'UNCHANGED_A',null),($2,'other@example.invalid',now(),'UNCHANGED_B',null)",[U,V]);
 await db.query('insert into auth.sessions values($1,$2,null),($3,$4,null)',[S,U,T,V]);
 await db.query("insert into public.profiles values($1,'active'),($2,'active');",[U,V]);
 await db.query("insert into public.app_admins values($1,'super_admin')",[U]);
 await db.query('insert into public.modeled_table_0 values(1,$1),(2,$2)',[U,V]);
 await db.exec("insert into mushavo_email_install.acceptance_window values(true,'dczlddwbtgvfdujgcitb',array['00000000-0000-4000-8000-000000000002'::uuid],now()-interval '2 hours',now()-interval '1 hour');insert into mushavo_email_install.rollout_control values(true,'dczlddwbtgvfdujgcitb','ACTIVE',mushavo_email_install.catalog_identity(),now())");
 oldPredicate=(await one("select prosrc from pg_proc where oid='mushavo_email_auth.session_valid(uuid,uuid)'::regprocedure")).prosrc;
 beforeData=await tableSnapshot();
});
after(async()=>{await db?.close();});
test('wrong target or action refuses before changing policies or account state',async()=>{
 for(const [a,b]of [["SET LOCAL mushavo.email_rollout_project='dczlddwbtgvfdujgcitb'","SET LOCAL mushavo.email_rollout_project='wrong'"],["ENABLE_PASSWORD_SIGNIN_ALL_USERS","WRONG_ACTION"]])await refused(upgrade.replace(a,b),/TARGET_ACTION_REQUIRED/);
});
test('catalog drift and unreviewed hooks refuse and are never blessed or disabled',async()=>{
 await db.exec('create function public.catalog_drift() returns boolean language sql as $$select true$$');await refused(upgrade,/CURRENT_CATALOG_REQUIRED/);await db.exec('drop function public.catalog_drift()');
 await db.exec('create function public.unknown_hook() returns event_trigger language plpgsql as $$begin end$$;create event trigger unknown_hook on ddl_command_end execute function public.unknown_hook()');
 await refused(upgrade,/UNREVIEWED_DDL_HOOK/);assert.equal((await one("select evtenabled from pg_event_trigger where evtname='unknown_hook'")).evtenabled,'O');await db.exec('drop event trigger unknown_hook;drop function public.unknown_hook()');
});
test('postcondition failure atomically rolls back the new policy table, ACLs and mode',async()=>{
 const bad=upgrade.replace(" IF before_catalog IS DISTINCT FROM ("," GRANT SELECT ON public.profiles TO authenticated;\n IF before_catalog IS DISTINCT FROM (");
 await refused(bad,/PROTECTED_CATALOG_CHANGED/);assert.equal((await one('select mode from mushavo_email_install.rollout_control')).mode,'ACTIVE');
});
test('the guarded upgrade enables password sign-in for all roles without proofs, devices or test windows',async()=>{
 const r=await result(upgrade);assert.equal(r.result,'PASSWORD_SIGNIN_ALL_USERS_ENABLED_STAGING');assert.equal(r.includes_Admin,true);assert.equal(r.catalog_identity_matched,true);assert.equal(r.legacy_dispatch_RPCs_retired,8);assert.deepEqual(await tableSnapshot(),beforeData);
 const a=await status();assert.equal(a.session_valid,true);assert.equal(a.admin_authorized,true);assert.equal(a.role,'super_admin');
 const b=await status(claims({sub:V,session_id:T}));assert.equal(b.session_valid,true);assert.equal(b.admin_authorized,false);assert.equal(b.role,null);
});
test('the old Edge-compatible boolean now checks the valid Auth session without any email proof',async()=>{
 assert.equal(await asUser(()=>one('select public.email_gate_current_session_verified() value').then(x=>x.value)),true);
 assert.equal((await one('select count(*)::int n from mushavo_email_auth.session_proofs')).n,0);
});
test('forged actor/session pairs, expired JWTs and malformed claims cannot obtain session or Admin access',async()=>{
 for(const c of [claims({session_id:T}),claims({sub:V}),claims({exp:1}),claims({role:'service_role'}),claims({sub:'bad'}),'bad-json']){
  const r=await status(c);assert.equal(r.session_valid,false);assert.equal(r.admin_authorized,false);assert.equal(r.role,null);
 }
});
test('confirmation, ban, suspension and live-session expiry remain enforced',async()=>{
 for(const [sql,reset]of [
  ["update auth.users set email_confirmed_at=null where id='"+U+"'","update auth.users set email_confirmed_at=now() where id='"+U+"'"],
  ["update auth.users set banned_until=now()+interval '1 day' where id='"+U+"'","update auth.users set banned_until=null where id='"+U+"'"],
  ["update public.profiles set account_status='suspended' where id='"+U+"'","update public.profiles set account_status='active' where id='"+U+"'"],
  ["update auth.sessions set not_after=now()-interval '1 second' where id='"+S+"'","update auth.sessions set not_after=null where id='"+S+"'"]
 ]){
  await db.exec(sql);assert.equal((await status()).session_valid,false);await db.exec(reset);assert.equal((await status()).session_valid,true);
 }
});
test('revoked sessions and missing profiles do not regain access from remembered approvals',async()=>{
 await db.query('delete from auth.sessions where id=$1',[T]);assert.equal((await status(claims({sub:V,session_id:T}))).session_valid,false);await db.query('insert into auth.sessions values($1,$2,null)',[T,V]);
 await db.query('delete from public.profiles where id=$1',[V]);assert.equal((await status(claims({sub:V,session_id:T}))).session_valid,false);await db.query("insert into public.profiles values($1,'active')",[V]);
});
test('Admin privilege depends on the current assigned server role, never on password-only session alone',async()=>{
 await db.query('delete from public.app_admins where user_id=$1',[U]);const r=await status();assert.equal(r.session_valid,true);assert.equal(r.admin_authorized,false);assert.equal(r.role,null);await db.query("insert into public.app_admins values($1,'super_admin')",[U]);
});
test('preserved row policies and RPC guards permit own data and deny another owner',async()=>{
 const rows=await asUser(()=>db.query('select id from public.modeled_table_0 order by id'));assert.deepEqual(rows.rows,[{id:1}]);
 await asUser(()=>assert.rejects(db.query('insert into public.modeled_table_0 values(3,$1)',[V]),/row-level security/));
 await asUser(()=>db.query('select public.modeled_guard_0()'));
 await asUser(()=>assert.rejects(db.query('select public.modeled_guard_0()'),/EMAIL_VERIFICATION_REQUIRED/),claims({session_id:T}));
});
test('anonymous and direct legacy code/device dispatch APIs remain inaccessible',async()=>{
 assert.equal((await one("select has_function_privilege('anon','public.app_session_status()','EXECUTE') allowed")).allowed,false);
 assert.equal((await one("select has_function_privilege('service_role','public.email_gate_begin_challenge(uuid,uuid,uuid,text,text,boolean)','EXECUTE') allowed")).allowed,false);
 assert.equal((await one("select has_function_privilege('service_role','public.email_gate_register_link_device(uuid,uuid,text,timestamptz,boolean)','EXECUTE') allowed")).allowed,false);
 assert.equal((await one("select has_table_privilege('authenticated','mushavo_email_install.password_signin_policy','SELECT') allowed")).allowed,false);
});
test('emergency quarantine still denies ordinary and Admin access without recreating code requirements',async()=>{
 await db.exec("set mushavo.email_rollout_project='dczlddwbtgvfdujgcitb';set mushavo.email_rollout_action='QUARANTINE_STAGING_EMAIL';select mushavo_email_install.quarantine()");
 assert.equal((await status()).session_valid,false);await db.exec("update mushavo_email_install.rollout_control set mode='ACTIVE'");
});
test('reapplying the installer refuses safely instead of changing the accepted policy',async()=>{
 await assert.rejects(db.exec(upgrade),/ALREADY_INSTALLED/);await db.exec('ROLLBACK');assert.equal((await status()).session_valid,true);
});
test('rollback restores the exact previous predicate, service ACLs and catalog while quarantining access',async()=>{
 const r=await result(rollback);assert.equal(r.result,'PASSWORD_SIGNIN_ROLLED_BACK_QUARANTINED');
 assert.equal((await one("select prosrc from pg_proc where oid='mushavo_email_auth.session_valid(uuid,uuid)'::regprocedure")).prosrc,oldPredicate);
 assert.equal((await one("select to_regprocedure('public.app_session_status()') value")).value,null);
 assert.equal((await one("select has_function_privilege('service_role','public.email_gate_begin_challenge(uuid,uuid,uuid,text,text,boolean)','EXECUTE') allowed")).allowed,true);
 assert.equal((await one('select mode,catalog_sha256=mushavo_email_install.catalog_identity() matched from mushavo_email_install.rollout_control')).matched,true);
 assert.equal((await one('select mode from mushavo_email_install.rollout_control')).mode,'QUARANTINED');
});
for(const [name,convert]of [
 ['Windows CRLF',sql=>sql.replace(/\n/g,'\r\n')],
 ['mixed clipboard line endings',sql=>sql.split('\n').map((line,index)=>line+(index%2?'\r':'')).join('\n')]
])test(name+' install retains exact reviewed bodies, role ACLs and quarantined rollback',async()=>{
 const snapshot=await tableSnapshot();
 const r=await result(convert(upgrade));assert.equal(r.result,'PASSWORD_SIGNIN_ALL_USERS_ENABLED_STAGING');assert.equal(r.catalog_identity_matched,true);
 const bodies=(await db.query("select proname,position(chr(13) in prosrc)::int cr from pg_proc where oid in ('mushavo_email_auth.session_valid(uuid,uuid)'::regprocedure,'public.app_session_status()'::regprocedure)")).rows;
 assert.equal(bodies.length,2);assert(bodies.every(row=>row.cr===0));
 assert.equal((await status()).admin_authorized,true);assert.equal((await status(claims({sub:V,session_id:T}))).admin_authorized,false);
 assert.equal((await one("select has_function_privilege('anon','public.app_session_status()','EXECUTE') allowed")).allowed,false);
 assert.equal((await one("select has_table_privilege('service_role','mushavo_email_install.password_signin_policy','SELECT') allowed")).allowed,false);
 assert.deepEqual(await tableSnapshot(),snapshot);
 const back=await result(convert(rollback));assert.equal(back.result,'PASSWORD_SIGNIN_ROLLED_BACK_QUARANTINED');
 assert.equal((await one("select prosrc from pg_proc where oid='mushavo_email_auth.session_valid(uuid,uuid)'::regprocedure")).prosrc,oldPredicate);
 assert.equal((await one('select catalog_sha256=mushavo_email_install.catalog_identity() matched from mushavo_email_install.rollout_control')).matched,true);
 assert.equal((await one('select mode from mushavo_email_install.rollout_control')).mode,'QUARANTINED');assert.deepEqual(await tableSnapshot(),snapshot);
});
test('line-ending normalization never permits changed predicate semantics or new public authority',async()=>{
 const snapshot=await tableSnapshot();
 const denied=[
  upgrade.replace("AND u.email_confirmed_at IS NOT NULL AND p.account_status='active'","AND u.email_confirmed_at IS NOT NULL AND p.account_status<>'suspended'"),
  upgrade.replace('GRANT EXECUTE ON FUNCTION public.app_session_status() TO authenticated;','GRANT EXECUTE ON FUNCTION public.app_session_status() TO authenticated,anon;'),
  upgrade.replace(' INSERT INTO mushavo_email_install.password_signin_policy',' GRANT SELECT ON mushavo_email_install.password_signin_policy TO service_role;\n INSERT INTO mushavo_email_install.password_signin_policy')
 ];
 for(const sql of denied){
  assert.notEqual(sql,upgrade);await assert.rejects(db.exec(sql.replace(/\n/g,'\r\n')),/PASSWORD_SIGNIN_NEW_AUTHORITY_REQUIRED/);await db.exec('ROLLBACK');
  assert.equal((await one("select to_regclass('mushavo_email_install.password_signin_policy') value")).value,null);
  assert.equal((await one('select mode from mushavo_email_install.rollout_control')).mode,'QUARANTINED');
  assert.equal((await one('select catalog_sha256=mushavo_email_install.catalog_identity() matched from mushavo_email_install.rollout_control')).matched,true);assert.deepEqual(await tableSnapshot(),snapshot);
 }
});

