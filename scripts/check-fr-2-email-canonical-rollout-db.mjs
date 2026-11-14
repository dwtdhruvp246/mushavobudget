// Actual candidate SQL in PGlite. All identities and proof values are synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
import {stagingProject,stagingCandidate} from './lib/email-staging-rollout-source.mjs';
import {prepareReviewedEmailPlatform} from './lib/email-reviewed-platform-fixture.mjs';
import {canonicalMigration,registrationBundle} from './lib/email-canonical-rollout-source.mjs';
const {db,migrations}=await localDatabase(process.env.MUSHAVO_EMAIL_UI_PGLITE,{includeEmailInstaller:true,includeEmailCanonicalBridge:true,preparePlatform:prepareReviewedEmailPlatform});
test.after(async()=>db.close());
test.afterEach(async()=>db.exec('rollback'));
const candidate='SELECT mushavo_email_install.register_staging()';
const bridge=await readFile(root+'/supabase/migrations/'+canonicalMigration,'utf8');
const bundle=await readFile(root+'/'+registrationBundle,'utf8');
const rows=async(sql,args)=>(await db.query(sql,args)).rows;
const value=async(sql,args)=>(await rows(sql,args))[0].value;
const quote=s=>'"'+s.replaceAll('"','""')+'"';
const action=async name=>db.query("select set_config('mushavo.email_rollout_action',$1,false)",[name]);
const target=async name=>db.query("select set_config('mushavo.email_rollout_project',$1,false)",[name]);
const call=name=>value('select mushavo_email_install.'+name+'() value');
const mode=()=>value('select mode value from mushavo_email_install.rollout_control');
async function appRows(){
  const tables=await rows("select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','auth','storage') and c.relkind='r' order by 1,2"),data=[];
  for(const t of tables)data.push([t.nspname,t.relname,await rows('select to_jsonb(t) value from '+quote(t.nspname)+'.'+quote(t.relname)+' t order by to_jsonb(t)::text')]);
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}
const guards=()=>value("select count(*)::int value from pg_policies where policyname='Email verified session required'");
async function asRole(role,claims,body,{commit=false}={}){
  await db.exec('begin');try{await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims)]);await db.exec('set local role '+role);const r=await body();await db.exec(commit?'commit':'rollback');return r;}catch(e){await db.exec('rollback');throw e;}
}
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=id(9901),B=id(9902),S=id(9911),T=id(9912),C=id(9921);
const claims=(u,s)=>({sub:u,session_id:s,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600});
const verified=(u,s)=>asRole('authenticated',claims(u,s),()=>value('select public.email_gate_current_session_verified() value'));
let beforeRows,originalPredicate;
let canonicalProtectedCatalog;
async function catalog(database){
 const q=async sql=>(await database.query(sql)).rows;
 return {
 functions:await q("select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,pg_get_functiondef(p.oid) definition,r.rolname owner,p.proacl::text,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') service from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname in('public','auth','storage','mushavo_email_install','mushavo_email_auth') and p.prokind='f' order by 1,2,3"),
 policies:await q("select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies order by 1,2,3"),
 relations:await q("select n.nspname,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.reloptions,c.relacl::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','auth','storage','mushavo_email_install','mushavo_email_auth') and c.relkind in('r','p','v','S') order by 1,2"),
 columns:await q("select table_schema,table_name,column_name,ordinal_position,data_type,udt_schema,udt_name,is_nullable,column_default,character_maximum_length from information_schema.columns where table_schema in('public','auth','storage','mushavo_email_install','mushavo_email_auth') order by 1,2,4"),
 indexes:await q("select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname in('public','auth','storage','mushavo_email_install','mushavo_email_auth') order by 1,2,3"),
 constraints:await q("select n.nspname,c.relname,k.conname,pg_get_constraintdef(k.oid) definition,k.convalidated from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','auth','storage','mushavo_email_install','mushavo_email_auth') order by 1,2,3"),
 triggers:await q("select n.nspname,c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in('public','auth','storage','mushavo_email_install','mushavo_email_auth') order by 1,2,3")};
}
test('Actual canonical56 bootstrap and ordered56 migrations produce matching selected catalogs before activation',async()=>{
 const {db:other,migrations:all}=await localDatabase(process.env.MUSHAVO_EMAIL_UI_PGLITE,{includeEmailInstaller:true,includeEmailCanonicalBridge:true,creationPath:'canonical',preparePlatform:prepareReviewedEmailPlatform});
 try{assert.equal(all.length,56);assert.deepEqual(await catalog(other),await catalog(db));
 await other.exec("set mushavo.email_rollout_project='"+stagingProject+"';set mushavo.email_rollout_action='REGISTER_STAGING_EMAIL'");assert.equal((await other.query(candidate)).rows[0].register_staging.result,'CANONICAL_STAGING_EMAIL_REGISTERED');
 await other.exec("set mushavo.email_rollout_action='ACTIVATE_STAGING_EMAIL_QUARANTINED'");assert.equal((await other.query('select mushavo_email_install.activate() value')).rows[0].value.restrictive_policies,82);canonicalProtectedCatalog=await catalog(other);
 await other.exec("set mushavo.email_rollout_action='RESUME_STAGING_EMAIL'");assert.equal((await other.query('select mushavo_email_install.resume() value')).rows[0].value.catalog_identity_matched,true);
 await other.exec("set mushavo.email_rollout_action='QUARANTINE_STAGING_EMAIL'");assert.equal((await other.query('select mushavo_email_install.quarantine() value')).rows[0].value.guards_retained,true);
 }finally{await other.close();}
});
test('Existing54 registration bundle is atomic on late failure, then registers and installs the identical quarantined controls',async()=>{
 const {db:other,migrations:all}=await localDatabase(process.env.MUSHAVO_EMAIL_UI_PGLITE,{preparePlatform:prepareReviewedEmailPlatform});
 try{assert.equal(all.length,54);await other.exec("set mushavo.email_rollout_project='"+stagingProject+"';set mushavo.email_rollout_action='REGISTER_STAGING_EMAIL'");const before=await catalog(other);
 const broken=bundle.slice(0,-'COMMIT;\n'.length)+"DO $fail$ BEGIN RAISE EXCEPTION 'SYNTHETIC_BUNDLE_LATE_FAILURE'; END; $fail$;\nCOMMIT;\n";
 await assert.rejects(other.exec(broken),/SYNTHETIC_BUNDLE_LATE_FAILURE/);await other.exec('rollback');assert.deepEqual(await catalog(other),before);assert.equal((await other.query("select to_regnamespace('mushavo_email_install') value")).rows[0].value,null);
 await other.exec(bundle);assert.equal((await other.query('select mode from mushavo_email_install.rollout_control')).rows[0].mode,'REGISTERED');
 await other.exec("set mushavo.email_rollout_action='ACTIVATE_STAGING_EMAIL_QUARANTINED'");assert.equal((await other.query('select mushavo_email_install.activate() value')).rows[0].value.guarded_RPCs,148);assert.equal((await other.query('select mode from mushavo_email_install.rollout_control')).rows[0].mode,'QUARANTINED');assert.deepEqual(await catalog(other),canonicalProtectedCatalog);
 }finally{await other.close();}
});
test('Migration56 rejects changed dormant legacy body, private ACLs, extra functions or tables without replacing the old installer',async()=>{
 const {db:other}=await localDatabase(process.env.MUSHAVO_EMAIL_UI_PGLITE,{includeEmailInstaller:true,preparePlatform:prepareReviewedEmailPlatform});
 try{const legacyDefinition=(await other.query("select pg_get_functiondef('mushavo_email_install.activate()'::regprocedure) value")).rows[0].value;for(const ddl of [legacyDefinition.replace('AS $function$','AS $function$\n'),"create schema mushavo_email_auth","alter function mushavo_email_install.activate() set search_path=public","grant execute on function mushavo_email_install.activate() to authenticated","grant usage on schema mushavo_email_install to service_role","create function mushavo_email_install.extra() returns boolean language sql as 'select true'","create table mushavo_email_install.extra(id int)"]){const before=await catalog(other);await other.exec('begin;'+ddl);await assert.rejects(other.exec(bridge),/EMAIL_CANONICAL_DORMANT_INSTALLER_IDENTITY_REQUIRED/);await other.exec('rollback');assert.deepEqual(await catalog(other),before);}}
 finally{await other.close();}
});
test('Canonical56 migration registration is dormant and blocks the old offline activation path',async()=>{
 assert.equal(migrations.length,56);assert.equal(await guards(),0);assert.equal(await value("select to_regnamespace('mushavo_email_auth') value"),null);
 assert.equal(await value("select count(*)::int value from pg_proc where pronamespace='mushavo_email_install'::regnamespace"),2);
 await db.exec("set mushavo.email_atomic_review='OFFLINE_ATOMIC_REHEARSAL'");await assert.rejects(call('activate'),/EMAIL_CANONICAL_STAGING_REGISTRATION_REQUIRED/);
 await assert.rejects(db.exec(bridge),/EMAIL_CANONICAL_DORMANT_INSTALLER_IDENTITY_REQUIRED/);await db.exec('rollback');
});
test('Both migration56 private functions refuse API roles even after accidental grants and forged claims',async()=>{
 for(const role of ['anon','authenticated','service_role']){
  assert.equal(await value("select has_schema_privilege($1,'mushavo_email_install','USAGE') value",[role]),false);
  for(const fn of ['activate','register_staging']){
   assert.equal(await value("select has_function_privilege($1,$2,'EXECUTE') value",[role,'mushavo_email_install.'+fn+'()']),false);
   await db.exec('begin;grant usage on schema mushavo_email_install to '+role+';grant execute on all functions in schema mushavo_email_install to '+role);
   await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({role:'postgres'})]);await db.exec('set local role '+role);
   await assert.rejects(call(fn),/EMAIL_CANONICAL_PRIVILEGED_ORIGIN_REQUIRED/);await db.exec('rollback');
  }
 }
});
test('Staging target and distinct registration acknowledgement remain mandatory after canonical migration',async()=>{
 await action('REGISTER_STAGING_EMAIL');
 for(const project of ['','kttkospkblwvguuwnhjj']){await target(project);await assert.rejects(db.exec(candidate),/EMAIL_STAGING_TARGET_ACK_REQUIRED/);}
 await target(stagingProject);await action('OFFLINE_ATOMIC_REHEARSAL');await assert.rejects(db.exec(candidate),/EMAIL_STAGING_ACTION_ACK_REQUIRED/);
 assert.equal(await value("select to_regclass('mushavo_email_install.rollout_control') value"),null);
});
test('All nine baseline checks run before canonical staging control registration',async()=>{
 await action('REGISTER_STAGING_EMAIL');await db.exec('begin;alter table auth.users alter column encrypted_password type text');
 await assert.rejects(db.exec(candidate),/EMAIL_STAGING_BASELINE_REVIEW_REQUIRED/);await db.exec('rollback');
 assert.equal(await value("select to_regclass('mushavo_email_install.rollout_control') value"),null);
});
test('A late registration failure rolls back new controls and restores the disabled activation body',async()=>{
 const original=await value("select pg_get_functiondef('mushavo_email_install.register_staging()'::regprocedure) value");
 const before=await value("select pg_get_functiondef('mushavo_email_install.activate()'::regprocedure) value");
 await db.exec('begin;'+original.replace(" RETURN jsonb_build_object('result','CANONICAL_STAGING_EMAIL_REGISTERED'"," RAISE EXCEPTION 'SYNTHETIC_CANONICAL_REGISTRATION_FAILURE';\n RETURN jsonb_build_object('result','CANONICAL_STAGING_EMAIL_REGISTERED'"));
 await assert.rejects(db.exec(candidate),/SYNTHETIC_CANONICAL_REGISTRATION_FAILURE/);await db.exec('rollback');
 assert.equal(await value("select pg_get_functiondef('mushavo_email_install.activate()'::regprocedure) value"),before);
 assert.equal(await value("select to_regclass('mushavo_email_install.rollout_control') value"),null);assert.equal(await guards(),0);
});
test('Dormant canonical staging registration preserves public catalogs and creates private forced-RLS control',async()=>{
 await db.exec(candidate);assert.equal(await mode(),'REGISTERED');assert.equal(await guards(),0);assert.equal(await value("select to_regnamespace('mushavo_email_auth') value"),null);
 assert.equal(await value("select count(*)::int value from pg_proc where pronamespace='public'::regnamespace and prokind='f' and prorettype<>'event_trigger'::regtype"),278);
 assert.deepEqual((await rows("select relrowsecurity,relforcerowsecurity from pg_class where oid='mushavo_email_install.rollout_control'::regclass"))[0],{relrowsecurity:true,relforcerowsecurity:true});
});
test('No API role can call control functions or read or mutate control state',async()=>{
  for(const role of ['anon','authenticated','service_role']){
    assert.equal(await value("select has_schema_privilege($1,'mushavo_email_install','USAGE') value",[role]),false);
    for(const fn of ['activate','resume','quarantine','catalog_identity','register_staging'])assert.equal(await value("select has_function_privilege($1,$2,'EXECUTE') value",[role,'mushavo_email_install.'+fn+'()']),false);
    for(const body of [()=>call('activate'),()=>value('select mode value from mushavo_email_install.rollout_control'),()=>db.exec("update mushavo_email_install.rollout_control set mode='ACTIVE'")])await assert.rejects(asRole(role,{role},body),e=>e.code==='42501');
  }
});
test('API roles still fail privileged origin even after deliberate accidental private grants and forged claims',async()=>{
  await action('ACTIVATE_STAGING_EMAIL_QUARANTINED');
  for(const role of ['anon','authenticated','service_role']){
    await db.exec('begin;grant usage on schema mushavo_email_install to '+role+';grant execute on all functions in schema mushavo_email_install to '+role);
    await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({role:'postgres'})]);await db.exec('set local role '+role);
    for(const fn of ['activate','quarantine','resume']){await assert.rejects(call(fn),/EMAIL_(STAGING|ATOMIC|CANONICAL)_PRIVILEGED_ORIGIN_REQUIRED/);await db.exec('rollback');if(fn!=='resume')await db.exec('begin;grant usage on schema mushavo_email_install to '+role+';grant execute on all functions in schema mushavo_email_install to '+role+';set local role '+role);}
  }
  assert.equal(await mode(),'REGISTERED');
});
test('Offline rehearsal and wrong staging action cannot activate the candidate',async()=>{
  await db.exec("set mushavo.email_atomic_review='OFFLINE_ATOMIC_REHEARSAL'");
  for(const ack of ['OFFLINE_ATOMIC_REHEARSAL','REGISTER_STAGING_EMAIL','RESUME_STAGING_EMAIL']){await action(ack);await assert.rejects(call('activate'),/EMAIL_STAGING_ACTION_ACK_REQUIRED/);}
  assert.equal(await mode(),'REGISTERED');assert.equal(await guards(),0);
});
test('Every state-changing control rechecks the target acknowledgement and rejects replica execution',async()=>{
  for(const fn of ['activate','quarantine','resume']){
    await target('kttkospkblwvguuwnhjj');await assert.rejects(call(fn),/EMAIL_STAGING_TARGET_ACK_REQUIRED/);await target(stagingProject);
    await db.exec("set session_replication_role='replica'");await assert.rejects(call(fn),/EMAIL_(STAGING|ATOMIC|CANONICAL)_PRIVILEGED_ORIGIN_REQUIRED/);await db.exec("set session_replication_role='origin'");
  }
  assert.equal(await mode(),'REGISTERED');
});
test('Recovery controls cannot resume or quarantine a dormant registration',async()=>{
  await action('RESUME_STAGING_EMAIL');await assert.rejects(call('resume'),/EMAIL_STAGING_QUARANTINED_INSTALLATION_REQUIRED/);
  await action('QUARANTINE_STAGING_EMAIL');await assert.rejects(call('quarantine'),/EMAIL_STAGING_ACTIVE_INSTALLATION_REQUIRED/);
  await action('ACTIVATE_STAGING_EMAIL_QUARANTINED');assert.equal(await mode(),'REGISTERED');
});
test('An existing reviewed function drift rolls back activation and keeps the dormant installer',async()=>{
  await action('ACTIVATE_STAGING_EMAIL_QUARANTINED');const original=await value("select pg_get_functiondef('public.is_app_admin()'::regprocedure) value");
  await db.exec(original.replace('AS $function$','AS $function$\n'));
  await assert.rejects(call('activate'),/EMAIL_STAGING_BASELINE_REVIEW_REQUIRED/);
  assert.equal(await mode(),'REGISTERED');assert.equal(await guards(),0);assert.equal(await value("select to_regnamespace('mushavo_email_auth') value"),null);await db.exec(original);
});
test('Auth column or policy drift between registration and activation is rejected by the refreshed baseline',async()=>{
  for(const ddl of ['alter table auth.users alter column encrypted_password type text','alter policy "Account must be active" on public.payment_records using(false)']){
    await db.exec('begin;'+ddl);await assert.rejects(call('activate'),/EMAIL_STAGING_BASELINE_REVIEW_REQUIRED/);await db.exec('rollback');assert.equal(await mode(),'REGISTERED');assert.equal(await guards(),0);
  }
});
test('A failure after all four components rolls back every guard and rollout state update',async()=>{
  const original=await value("select pg_get_functiondef('mushavo_email_install.activate()'::regprocedure) value");
  await db.exec(original.replace('-- FR_STAGING_AFTER_COMPONENTS',"RAISE EXCEPTION 'SYNTHETIC_ROLLOUT_FINAL_FAILURE';\n -- FR_STAGING_AFTER_COMPONENTS"));
  await assert.rejects(call('activate'),/SYNTHETIC_ROLLOUT_FINAL_FAILURE/);assert.equal(await mode(),'REGISTERED');assert.equal(await guards(),0);
  assert.equal(await value("select to_regnamespace('mushavo_email_auth') value"),null);await db.exec(original);
});
test('A successful activation remains caller-rollbackable and contains148 RPCs and82 policies',async()=>{
  await db.exec('begin');const r=await call('activate');assert.equal(r.result,'STAGING_EMAIL_INSTALLED_QUARANTINED');assert.equal(r.guarded_RPCs,148);assert.equal(r.restrictive_policies,82);assert.equal(await mode(),'QUARANTINED');await db.exec('rollback');assert.equal(await mode(),'REGISTERED');assert.equal(await guards(),0);
});
test('Committed activation preserves all existing modeled application rows and starts quarantined',async()=>{
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'rollout-a@example.invalid',now()),($2,'rollout-b@example.invalid',now())",[A,B]);
  await db.query('insert into auth.sessions(id,user_id) values($1,$2),($3,$4)',[S,A,T,B]);
  await db.query("insert into public.app_admins(user_id,email,role) values($1,'rollout-b@example.invalid','super_admin')",[B]);beforeRows=await appRows();
  assert.equal((await call('activate')).result,'STAGING_EMAIL_INSTALLED_QUARANTINED');assert.equal(await mode(),'QUARANTINED');assert.equal(await appRows(),beforeRows);assert.deepEqual(await catalog(db),canonicalProtectedCatalog);
  assert.equal(await value('select catalog_sha256=mushavo_email_install.catalog_identity() value from mushavo_email_install.rollout_control'),true);
  originalPredicate=await value("select pg_get_functiondef('mushavo_email_auth.session_valid(uuid,uuid)'::regprocedure) value");
});
test('Real service SQL can establish proof during quarantine but neither ordinary nor Admin data becomes accessible',async()=>{
  await asRole('service_role',{role:'service_role'},async()=>{
    assert.equal((await value("select public.email_gate_begin_challenge($1,$2,$3,$4,'test',false) value",[A,S,C,'a'.repeat(64)])).result,'PENDING_DELIVERY');
    await value('select public.email_gate_set_delivery($1,$2,$3,true) value',[A,S,C]);
    assert.equal((await value('select public.email_gate_verify_challenge($1,$2,$3,$4,null) value',[A,S,C,'a'.repeat(64)])).result,'VERIFIED');
  },{commit:true});
  assert.equal(await verified(A,S),false);assert.equal(await verified(B,T),false);assert.equal(await value('select count(*)::int value from mushavo_email_auth.session_proofs'),1);
  assert.equal(await asRole('service_role',{role:'service_role'},()=>value('select public.email_gate_session_status($1,$2) value',[A,S])),false);
  assert.equal((await asRole('authenticated',claims(A,S),()=>rows('select id from public.profiles'))).length,0);
});
test('Resume requires its own action acknowledgement and a quarantined installed state',async()=>{
  await action('ACTIVATE_STAGING_EMAIL_QUARANTINED');await assert.rejects(call('resume'),/EMAIL_STAGING_ACTION_ACK_REQUIRED/);
  await action('RESUME_STAGING_EMAIL');assert.equal((await call('resume')).result,'STAGING_EMAIL_ACTIVE');assert.equal(await mode(),'ACTIVE');
  assert.equal(await verified(A,S),true);assert.equal(await verified(B,T),false);
  assert.equal(await asRole('service_role',{role:'service_role'},()=>value('select public.email_gate_session_status($1,$2) value',[A,S])),true);
  assert.deepEqual(await asRole('authenticated',claims(A,S),()=>rows('select id from public.profiles')),[{id:A}]);
  await assert.rejects(call('resume'),/EMAIL_STAGING_QUARANTINED_INSTALLATION_REQUIRED/);
});
test('Committed quarantine disables an existing proof while preserving guards, proofs, Auth sessions and application rows',async()=>{
  await action('QUARANTINE_STAGING_EMAIL');assert.equal((await call('quarantine')).guards_retained,true);assert.equal(await mode(),'QUARANTINED');assert.equal(await verified(A,S),false);assert.equal(await guards(),82);
  assert.equal(await value('select count(*)::int value from mushavo_email_auth.session_proofs'),1);assert.equal(await value('select count(*)::int value from auth.sessions'),2);assert.equal(await appRows(),beforeRows);
});
for(const [title,ddl,restore] of [
  ['policy expression drift', 'alter policy "Email verified session required" on public.profiles using(true)', null],
  ['canonical bridge function drift', 'alter function mushavo_email_install.register_staging() set search_path=public', null],
  ['predicate body drift', 'alter function mushavo_email_auth.session_valid(uuid,uuid) set search_path=public', null],
  ['extra API execution grant', 'grant usage on schema mushavo_email_install to authenticated', null],
  ['private table RLS drift', 'alter table mushavo_email_install.rollout_control no force row level security', null],
  ['application trigger removal', 'drop trigger email_gate_profile_suspended on public.profiles', null]
])test('Resume refuses '+title+' without opening access',async()=>{
  await action('RESUME_STAGING_EMAIL');await db.exec('begin');
  try{await db.exec(ddl);await assert.rejects(call('resume'),/EMAIL_STAGING_CATALOG_DRIFT_REVIEW_REQUIRED/);}finally{await db.exec('rollback');}
  assert.equal(await mode(),'QUARANTINED');assert.equal(await verified(A,S),false);
});
test('Quarantine remains available for containment when a selected catalog entry has drifted',async()=>{
  await action('QUARANTINE_STAGING_EMAIL');await db.exec('begin;grant usage on schema mushavo_email_install to authenticated');
  assert.equal((await call('quarantine')).result,'STAGING_EMAIL_QUARANTINED');await db.exec('rollback');assert.equal(await mode(),'QUARANTINED');
});
test('Resume refuses a newly enabled unknown event hook before opening access',async()=>{
  await action('RESUME_STAGING_EMAIL');await db.exec("begin;create function extensions.rollout_unknown() returns event_trigger language plpgsql as $$begin return;end;$$;create event trigger rollout_unknown on ddl_command_end when tag in ('CREATE TABLE') execute function extensions.rollout_unknown()");
  await assert.rejects(call('resume'),/EMAIL_ATOMIC_UNREVIEWED_DDL_HOOK/);await db.exec('rollback');assert.equal(await mode(),'QUARANTINED');assert.equal(await verified(A,S),false);
});
test('Missing control state fails closed and cannot be resumed',async()=>{
  await action('RESUME_STAGING_EMAIL');await db.exec('begin;delete from mushavo_email_install.rollout_control');
  assert.equal(await value('select mushavo_email_auth.session_valid($1,$2) value',[A,S]),false);await assert.rejects(call('resume'),/EMAIL_STAGING_QUARANTINED_INSTALLATION_REQUIRED/);await db.exec('rollback');assert.equal(await mode(),'QUARANTINED');
});
test('An unchanged catalog permits explicit resume after recovery and preserves ordinary ownership and Admin status',async()=>{
  await action('RESUME_STAGING_EMAIL');assert.equal((await call('resume')).catalog_identity_matched,true);assert.equal(await verified(A,S),true);assert.equal(await verified(B,T),false);
  assert.equal(await appRows(),beforeRows);assert.equal(await value('select count(*)::int value from public.app_admins'),1);assert.equal(await guards(),82);
});
test('Repeated activation or registration cannot overwrite committed proofs or controls',async()=>{
  await action('ACTIVATE_STAGING_EMAIL_QUARANTINED');await assert.rejects(call('activate'),/EMAIL_STAGING_(DORMANT_REGISTRATION_REQUIRED|BASELINE_REVIEW_REQUIRED)/);
  await action('REGISTER_STAGING_EMAIL');await assert.rejects(db.exec(candidate),/EMAIL_CANONICAL_DORMANT_INSTALLER_IDENTITY_REQUIRED/);await db.exec('rollback');
  assert.equal(await mode(),'ACTIVE');assert.equal(await verified(A,S),true);assert.equal(await appRows(),beforeRows);
});
