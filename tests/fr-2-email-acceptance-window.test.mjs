import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {localDatabase,root} from '../scripts/lib/stage-3-local-db.mjs';
import {prepareReviewedEmailPlatform} from '../scripts/lib/email-reviewed-platform-fixture.mjs';
import {handoffSQL,stagingRef} from '../scripts/lib/email-registration-handoff-sql.mjs';
import {installationSQL} from '../scripts/install-fr-2-email-batch-h.mjs';
import {windowSources,candidatePath} from '../scripts/lib/email-acceptance-window-source.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const users=[id(31001),id(31002),id(31003)],sessions=[id(32001),id(32002),id(32003)];
const source=await windowSources();
test('Candidate bytes equal the guarded renderer; old source remains separately frozen',async()=>{
 assert.equal(await readFile(root+'/'+candidatePath,'utf8'),source.upgrade);
 assert.notEqual(source.oldHash,source.newHash);assert(source.upgrade.endsWith('COMMIT;\n'));
});
test('Actual installed SQL retains role/proof checks and closes access by actors, deadline and quarantine',async t=>{
 const {db}=await localDatabase(process.env.MUSHAVO_EMAIL_UI_PGLITE,{preparePlatform:prepareReviewedEmailPlatform});
 const scalar=async q=>(await db.query(q)).rows[0].value;
 const transaction=async fn=>{await db.exec('BEGIN');try{return await fn();}finally{await db.exec('ROLLBACK');}};
 const action=async a=>db.query("SELECT set_config('mushavo.email_rollout_project',$1,true),set_config('mushavo.email_rollout_action',$2,true)",[stagingRef,a]);
 const call=async(ids=users.slice(0,2),seconds=300)=>{await action('OPEN_STAGING_ACCEPTANCE_WINDOW');return db.query('SELECT mushavo_email_install.open_acceptance_window($1::uuid[],$2::int) AS value',[ids,seconds]);};
 const valid=async i=>scalar(`SELECT mushavo_email_auth.session_valid('${users[i]}','${sessions[i]}') AS value`);
 const role=async i=>{await db.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:users[i],session_id:sessions[i],role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})]);await db.exec('SET LOCAL ROLE authenticated');try{return {verified:await scalar('SELECT public.email_gate_current_session_verified() AS value'),own:await scalar(`SELECT count(*)::int AS value FROM public.profiles WHERE id='${users[i]}'`),foreign:await scalar(`SELECT count(*)::int AS value FROM public.profiles WHERE id='${users[(i+1)%3]}'`)};}finally{await db.exec('RESET ROLE');}};
 try{
  await db.exec((await handoffSQL()).write);await db.exec((await installationSQL()).write);
  for(let i=0;i<3;i++){
   await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[users[i],`actor${i}@example.invalid`]);
   await db.query("INSERT INTO public.profiles(id,email,full_name,account_status) VALUES($1,$2,'Synthetic window actor','active') ON CONFLICT(id) DO UPDATE SET account_status='active'",[users[i],`actor${i}@example.invalid`]);
   await db.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)',[sessions[i],users[i]]);
   await db.query('INSERT INTO mushavo_email_auth.account_state(user_id) VALUES($1)',[users[i]]);
   await db.query("INSERT INTO mushavo_email_auth.session_proofs(session_id,user_id,security_version,verified_at,established_at,source) VALUES($1,$2,1,now(),now(),'email')",[sessions[i],users[i]]);
  }
  const originalQuarantine=await scalar("SELECT prosrc AS value FROM pg_proc WHERE oid='mushavo_email_install.quarantine()'::regprocedure");
  const ack="SET LOCAL mushavo.email_rollout_project='"+stagingRef+"'; SET LOCAL mushavo.email_rollout_action='INSTALL_CLOSED_STAGING_ACCEPTANCE_CONTROLS';";
  const upgrade=source.upgrade.replace('BEGIN;\n','BEGIN;\n'+ack+'\n');
  await t.test('Upgrade refuses missing acknowledgement without changing installed state',async()=>{await assert.rejects(db.exec(source.upgrade),/EMAIL_WINDOW_TARGET_ACTION_REQUIRED/);await db.exec('ROLLBACK');assert.equal(await scalar("SELECT to_regclass('mushavo_email_install.acceptance_window') IS NULL AS value"),true);});
  await t.test('Write-time catalog drift refuses upgrade and rolls back completely',()=>transaction(async()=>{await db.exec('ALTER TABLE public.profiles ADD COLUMN fixture_window_drift boolean');await assert.rejects(db.exec(upgrade.replace('BEGIN;\n','').replace(/COMMIT;\n$/,'')),/EMAIL_WINDOW_QUARANTINED_CATALOG_REQUIRED/);}));
  await t.test('Late installation failure rolls back DDL, predicate, resume and control stamp',async()=>{await transaction(async()=>{const late=upgrade.replace('BEGIN;\n','').replace(/COMMIT;\n$/,'').replace('DO $window_post$ BEGIN',"DO $window_post$ BEGIN RAISE EXCEPTION 'SYNTHETIC_LATE_WINDOW_FAILURE';");await assert.rejects(db.exec(late),/SYNTHETIC_LATE_WINDOW_FAILURE/);});assert.equal(await scalar("SELECT to_regclass('mushavo_email_install.acceptance_window') IS NULL AS value"),true);assert.equal(await scalar("SELECT catalog_sha256=mushavo_email_install.catalog_identity() AS value FROM mushavo_email_install.rollout_control"),true);});
  await t.test('Actual upgrade remains quarantined, empty and preserves quarantine recovery source',async()=>{await db.exec(upgrade);assert.equal(await scalar("SELECT mode AS value FROM mushavo_email_install.rollout_control"),'QUARANTINED');assert.equal(await scalar('SELECT count(*)::int AS value FROM mushavo_email_install.acceptance_window'),0);assert.equal(await scalar("SELECT prosrc AS value FROM pg_proc WHERE oid='mushavo_email_install.quarantine()'::regprocedure"),originalQuarantine);assert.equal(await valid(0),false);});
  await t.test('Old global resume cannot open access',()=>transaction(async()=>{await action('RESUME_STAGING_EMAIL');await assert.rejects(db.query('SELECT mushavo_email_install.resume()'),/EMAIL_WINDOW_EXPLICIT_BOUNDED_OPEN_REQUIRED/);}));
  for(const [label,ids,seconds]of [['empty',[],300],['null',null,300],['null member',[null],300],['duplicate',[users[0],users[0]],300],['unknown',[id(99999)],300],['too short',[users[0]],29],['too long',[users[0]],1801],['null duration',[users[0]],null],['too many',[...users,id(9),id(10)],300]])
   await t.test('Bounded opener rejects '+label,()=>transaction(()=>assert.rejects(call(ids,seconds),/EMAIL_WINDOW_/)));
  await t.test('Explicit selected users with proof read own profile and never foreign profile',()=>transaction(async()=>{await call();assert.equal(await valid(0),true);assert.equal(await valid(1),true);assert.equal(await valid(2),false);assert.deepEqual(await role(0),{verified:true,own:1,foreign:0});assert.deepEqual(await role(2),{verified:false,own:0,foreign:0});}));
  await t.test('Window membership is insufficient without a verified Auth session proof',()=>transaction(async()=>{await call();await db.query('DELETE FROM mushavo_email_auth.session_proofs WHERE session_id=$1',[sessions[0]]);assert.equal(await valid(0),false);assert.deepEqual(await role(0),{verified:false,own:0,foreign:0});}));
  await t.test('Deadline denies even verified selected users without a cleanup process',()=>transaction(async()=>{await call();await db.exec("UPDATE mushavo_email_install.acceptance_window SET opened_at=clock_timestamp()-interval '2 minutes',expires_at=clock_timestamp()-interval '1 minute'");assert.equal(await valid(0),false);assert.deepEqual(await role(0),{verified:false,own:0,foreign:0});assert.equal(await scalar('SELECT mode AS value FROM mushavo_email_install.rollout_control'),'ACTIVE');}));
  await t.test('Real-clock boundary closes within one transaction and does not use transaction start time',()=>transaction(async()=>{await call();await db.exec(`DO $clock$ BEGIN
 UPDATE mushavo_email_install.acceptance_window SET expires_at=clock_timestamp()+interval '200 milliseconds';
 IF NOT mushavo_email_auth.session_valid('${users[0]}','${sessions[0]}') THEN RAISE EXCEPTION 'SYNTHETIC_INITIAL_CLOCK_REQUIRED'; END IF;
 PERFORM pg_sleep(0.3);
 IF mushavo_email_auth.session_valid('${users[0]}','${sessions[0]}') THEN RAISE EXCEPTION 'SYNTHETIC_EXPIRED_CLOCK_REQUIRED'; END IF;
 END $clock$;`);}));
  await t.test('Repeated status/profile reads never extend the fixed window',()=>transaction(async()=>{await call();const before=await scalar('SELECT expires_at::text AS value FROM mushavo_email_install.acceptance_window');await role(0);await role(0);assert.equal(await scalar('SELECT expires_at::text AS value FROM mushavo_email_install.acceptance_window'),before);await assert.rejects(call(),/EMAIL_WINDOW_QUARANTINED_CATALOG_REQUIRED/);}));
  await t.test('Independent existing quarantine closes immediately and is idempotent',()=>transaction(async()=>{await call();await action('QUARANTINE_STAGING_EMAIL');await db.query('SELECT mushavo_email_install.quarantine()');assert.equal(await valid(0),false);await db.query('SELECT mushavo_email_install.quarantine()');assert.equal(await valid(1),false);}));
  await t.test('Suspension, expired Auth session and proof security-version changes still deny',async()=>{for(const sql of ["UPDATE public.profiles SET account_status='suspended' WHERE id='"+users[0]+"'","UPDATE auth.sessions SET not_after=clock_timestamp()-interval '1 second' WHERE id='"+sessions[0]+"'","UPDATE mushavo_email_auth.account_state SET security_version=security_version+1 WHERE user_id='"+users[0]+"'"]){await transaction(async()=>{await call();await db.exec(sql);assert.equal(await valid(0),false);});}});
  await t.test('Open refuses suspended actors before changing mode',()=>transaction(async()=>{await db.query("UPDATE public.profiles SET account_status='suspended' WHERE id=$1",[users[0]]);await assert.rejects(call(),/EMAIL_WINDOW_ACTIVE_CONFIRMED_ACTORS_REQUIRED/);}));
  await t.test('Subsequent public catalog drift prevents opening',()=>transaction(async()=>{await db.exec('ALTER TABLE public.profiles ADD COLUMN fixture_window_drift boolean');await assert.rejects(call(),/EMAIL_WINDOW_QUARANTINED_CATALOG_REQUIRED/);}));
  await t.test('Backend predicate drift is rejected by the overall catalog stamp',()=>transaction(async()=>{await db.exec("CREATE OR REPLACE FUNCTION mushavo_email_auth.session_valid(p_user uuid,p_session uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS 'SELECT true'");await assert.rejects(call(),/EMAIL_WINDOW_QUARANTINED_CATALOG_REQUIRED/);}));
  await t.test('Pinned predicate is also checked independently of a privileged refreshed stamp',()=>transaction(async()=>{await db.exec("CREATE OR REPLACE FUNCTION mushavo_email_auth.session_valid(p_user uuid,p_session uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS 'SELECT true';UPDATE mushavo_email_install.rollout_control SET catalog_sha256=mushavo_email_install.catalog_identity()");await assert.rejects(call(),/EMAIL_WINDOW_PREDICATE_DRIFT_REQUIRED/);}));
  for(const dbRole of ['anon','authenticated','service_role'])await t.test(dbRole+' cannot inspect window actors or invoke private controls',async()=>{for(const sql of ['SELECT * FROM mushavo_email_install.acceptance_window',"SELECT mushavo_email_install.open_acceptance_window(ARRAY['"+users[0]+"'::uuid],300)"])await transaction(async()=>{await db.exec('SET LOCAL ROLE '+dbRole);await assert.rejects(db.query(sql),/permission denied/);});});
  await t.test('Guard coverage and final quarantine remain installed without application row changes',async()=>{assert.equal(await scalar("SELECT count(*)::int AS value FROM pg_policies WHERE policyname='Email verified session required' AND permissive='RESTRICTIVE'"),82);assert.equal(await scalar("SELECT count(*)::int AS value FROM pg_proc WHERE pronamespace='public'::regnamespace AND position('PERFORM mushavo_email_auth.require_application_session();' in prosrc)>0"),148);assert.equal(await scalar('SELECT count(*)::int AS value FROM public.profiles'),3);assert.equal(await scalar('SELECT mode AS value FROM mushavo_email_install.rollout_control'),'QUARANTINED');assert.equal(await scalar('SELECT count(*)::int AS value FROM mushavo_email_install.acceptance_window'),0);});
 }finally{await db.close();}
});
