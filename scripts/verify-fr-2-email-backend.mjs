import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
import {newChallengeMaterial,newDeviceMaterial,codeMac} from '../supabase/functions/_shared/email-verification-crypto.mjs';
globalThis.fetch=()=>{throw Error('HOSTED_TRANSPORT_FORBIDDEN_IN_LOCAL_REVIEW');};
const candidatePath='supabase/candidates/security_fr_2_4_email_verification_backend.sql';
const candidate=await readFile(path.join(root,candidatePath),'utf8');
const manifest=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-backend-source-manifest.json'),'utf8'));
assert.equal(Object.keys(manifest.file_sha256).length,59);
for(const [file,digest]of Object.entries(manifest.file_sha256)) {
 assert(/^[A-Za-z0-9_./-]+$/.test(file)&&!file.includes('..')&&!file.startsWith('/'));
 assert.equal(createHash('sha256').update(await readFile(path.join(root,file))).digest('hex'),digest,'Pinned source mismatch: '+file);
}
const pgModulePath=process.argv[2]||path.join(root,'node_modules/@electric-sql/pglite/dist/index.js');
const pgPackage=JSON.parse(await readFile(path.join(path.dirname(pgModulePath),'../package.json'),'utf8'));
assert.equal(pgPackage.name,manifest.test_dependency.package);assert.equal(pgPackage.version,manifest.test_dependency.version);
const {db,migrations}=await localDatabase(pgModulePath);
const tests=[],pass=test=>tests.push({test,status:'PASS'}),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const users=[id(201),id(202),id(203)],A=users[0],B=users[1],C=users[2];
const sessions=Array.from({length:16},(_,i)=>id(301+i));const [A1,A2,A3,A4,A5,A6,A7,A8,B1,C1,expired]=sessions;
const pepper=new Uint8Array(32).fill(42),keyVersion='local_v1';
let originalTriggerIds=null;
async function service(fn,args) {
 await db.exec('set role service_role');
 try {return (await db.query(`select public.${fn}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args)).rows[0].value;}
 finally {await db.exec('reset role');}
}
const status=(u,s)=>service('email_gate_session_status',[u,s]);
async function budget(u) {await db.query("update mushavo_email_auth.account_state set next_send_at='-infinity' where user_id=$1",[u]);await db.query('delete from mushavo_email_auth.send_events where user_id=$1',[u]);}
async function begin(u,s,remember=true) {
 const m=await newChallengeMaterial({userId:u,sessionId:s,keyVersion,pepper});
 const response=await service('email_gate_begin_challenge',[u,s,m.challengeId,m.codeMac,keyVersion,remember]);
 return {...m,response,user:u,session:s,remember};
}
const delivered=(c,ok=true)=>service('email_gate_set_delivery',[c.user,c.session,c.challengeId,ok]);
const verify=(c,mac=c.codeMac,digest=null)=>service('email_gate_verify_challenge',[c.user,c.session,c.challengeId,mac,digest]);
async function good(u,s,remember=true) {
 await budget(u);const c=await begin(u,s,remember);assert.equal(c.response.result,'PENDING_DELIVERY');
 assert.equal((await delivered(c)).result,'READY');const device=remember?await newDeviceMaterial():null;
 assert.equal((await verify(c,c.codeMac,device?.digest||null)).result,'VERIFIED');return {c,device};
}
async function catalog() {
 return (await db.query(`select
  (select jsonb_agg(jsonb_build_object('oid',p.oid,'name',p.proname,'source',p.prosrc,'acl',p.proacl,'settings',p.proconfig,'definer',p.prosecdef) order by p.oid)
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and left(p.proname,11)<>'email_gate_') as routines,
  (select jsonb_agg(to_jsonb(p) order by p.oid) from pg_policy p) as policies,
  (select jsonb_agg(to_jsonb(t) order by t.oid) from pg_trigger t where ($1::oid[] is null or t.oid=any($1::oid[]))) as triggers`,[originalTriggerIds])).rows[0];
}
try {
 assert.equal(migrations.length,54);assert.deepEqual(migrations,manifest.migration_paths.map(f=>path.basename(f)));
 // Explicit modeled Supabase Auth columns/session relation, not a hosted Auth migration.
 await db.exec(`alter table auth.users add column email_confirmed_at timestamptz,
  add column encrypted_password text,add column banned_until timestamptz;
  create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);`);
 await db.query("insert into auth.users(id,email,email_confirmed_at,encrypted_password) values($1,'email.primary@example.invalid',now(),'SYNTHETIC_HASH_1'),($2,'email.admin@example.invalid',now(),'SYNTHETIC_HASH_2'),($3,'email.unconfirmed@example.invalid',null,'SYNTHETIC_HASH_3')",users);
 for(const s of sessions)await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[s,s===B1?B:s===C1?C:A]);
 await db.query("update auth.sessions set not_after=now()-interval '1 minute' where id=$1",[expired]);
 await db.query("insert into public.app_admins(user_id,email,role) values($1,'email.admin@example.invalid','super_admin')",[B]);
 const beforeCatalog=await catalog();originalTriggerIds=beforeCatalog.triggers.map(t=>t.oid);
 const beforeUsers=(await db.query('select jsonb_agg(to_jsonb(u) order by id) value from auth.users u')).rows[0].value;
 const beforePayments=(await db.query('select (select jsonb_agg(to_jsonb(p) order by id) from public.payment_items p) items,(select jsonb_agg(to_jsonb(p) order by id) from public.payment_records p) records')).rows[0];
 await assert.rejects(db.exec(candidate),/EMAIL_BACKEND_OFFLINE_REVIEW_ACK_REQUIRED/);await db.exec('rollback');
 pass('Missing offline acknowledgement refuses candidate before any schema creation');
 await db.exec("set mushavo.email_backend_review='OFFLINE_SOURCE_CANDIDATE'");await db.exec(candidate);
 pass('Actual backend candidate compiles after all54 source migrations against modeled Auth sessions');
 await db.exec('set role service_role');try {await assert.rejects(db.exec(candidate),/EMAIL_BACKEND_PRIVILEGED_REVIEW_REQUIRED/);await db.exec('rollback');}finally{await db.exec('reset role');}
 pass('API service role cannot become schema owner even with the offline acknowledgement');
 assert.deepEqual(await catalog(),beforeCatalog);pass('Existing public routine bodies/ACLs, policies and original triggers stay byte/metadata-identical');
 assert.deepEqual((await db.query('select jsonb_agg(to_jsonb(u) order by id) value from auth.users u')).rows[0].value,beforeUsers);
 assert.deepEqual((await db.query('select (select jsonb_agg(to_jsonb(p) order by id) from public.payment_items p) items,(select jsonb_agg(to_jsonb(p) order by id) from public.payment_records p) records')).rows[0],beforePayments);
 pass('Candidate creation leaves modeled Auth users and original payment rows unchanged');
 const rels=(await db.query("select oid,relrowsecurity,relforcerowsecurity from pg_class where relnamespace='mushavo_email_auth'::regnamespace and relkind='r'")).rows;
 assert.equal(rels.length,5);assert(rels.every(x=>x.relrowsecurity&&x.relforcerowsecurity));
 for(const role of ['anon','authenticated','service_role'])for(const t of rels){const v=(await db.query('select has_schema_privilege($1,\'mushavo_email_auth\',\'USAGE\') u,has_table_privilege($1,$2::oid,\'SELECT,INSERT,UPDATE,DELETE\') d',[role,t.oid])).rows[0];assert.equal(v.u,false);assert.equal(v.d,false);}
 pass('All five private tables force RLS and deny direct schema/table access to every API role');
 const funcs=(await db.query("select p.oid,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and left(p.proname,11)='email_gate_'")).rows;
 assert.equal(funcs.length,8);for(const f of funcs){assert(f.prosecdef);assert.deepEqual(f.proconfig,['search_path=pg_catalog']);for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("select has_function_privilege($1,$2::oid,'EXECUTE') v",[role,f.oid])).rows[0].v,role==='service_role');}
 const privateFuncs=(await db.query("select oid from pg_proc where pronamespace='mushavo_email_auth'::regnamespace")).rows;assert.equal(privateFuncs.length,6);
 for(const f of privateFuncs)for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("select has_function_privilege($1,$2::oid,'EXECUTE') v",[role,f.oid])).rows[0].v,false);
 pass('Only eight pinned-search-path service RPCs are callable; all private helper EXECUTE grants are revoked');
 await assert.rejects(db.exec(candidate),/EMAIL_BACKEND_NAMESPACE_ALREADY_EXISTS/);await db.exec('rollback');pass('Reinstallation cannot replace an existing email namespace or application entrypoint');
 for(const role of ['anon','authenticated']) {
  await db.exec(`set role ${role};set request.jwt.claim.role='service_role'`);
  try{await assert.rejects(db.query('select public.email_gate_session_status($1,$2)',[A,A1]),/permission denied/);await assert.rejects(db.exec('select * from mushavo_email_auth.devices'),/permission denied/);}
  finally{await db.exec('reset role;reset request.jwt.claim.role');}
 }
 pass('Ordinary/anonymous callers cannot forge service privilege with JWT claim settings');
 for(const [u,s]of [[A,B1],[C,C1],[A,expired],[A,id(9999)]])await assert.rejects(begin(u,s),/EMAIL_ACTIVE_AUTH_SESSION_REQUIRED/);
 pass('Foreign, nonexistent, unconfirmed and timeboxed-expired Auth sessions cannot start proof');
 assert.equal(await status(A,A1),false);assert.equal(await status(B,B1),false);pass('Both ordinary users and platform Admins start without a verified-session exemption');
 const first=await begin(A,A1,true);assert.equal(first.response.result,'PENDING_DELIVERY');
 assert.equal((await begin(A,A1,true)).response.result,'COOLDOWN');assert.equal(await status(A,A1),false);
 assert.equal((await db.query('select extract(epoch from(expires_at-issued_at)) seconds from mushavo_email_auth.challenges where id=$1',[first.challengeId])).rows[0].seconds,'600.000000');
 pass('Server-clock10-minute challenge TTL and60-second cooldown do not grant data proof');
 const firstDevice=await newDeviceMaterial();assert.equal((await verify(first,first.codeMac,firstDevice.digest)).result,'UNAVAILABLE');
 assert.equal((await delivered(first,false)).result,'DELIVERY_FAILED');assert.equal((await verify(first,first.codeMac,firstDevice.digest)).result,'UNAVAILABLE');
 pass('Pending or failed mail delivery cannot authorize even the correct bound code');
 await budget(A);const old=await begin(A,A1);await delivered(old);await budget(A);const fresh=await begin(A,A1);await delivered(fresh);
 const context=await service('email_gate_challenge_context',[A,A1,fresh.challengeId]);assert.equal(context.key_version,keyVersion);assert.equal(context.remember_device,true);assert(!('code_mac' in context));
 assert.equal(await service('email_gate_challenge_context',[B,B1,fresh.challengeId]),null);
 pass('Service context supports key rotation without exposing code/MAC or another actor challenge');
 assert.equal((await verify(old,old.codeMac,firstDevice.digest)).result,'UNAVAILABLE');assert.equal((await delivered(old)).result,'UNAVAILABLE');
 pass('Resend supersedes the old code and late delivery callbacks cannot revive it');
 const wrongCode=String((Number(fresh.code)+1)%1000000).padStart(6,'0');
 const wrong=await codeMac({userId:A,sessionId:A1,challengeId:fresh.challengeId,keyVersion,code:wrongCode,pepper});
 assert.equal((await verify(fresh,wrong,firstDevice.digest)).result,'CODE_REJECTED');assert.equal((await db.query('select attempts from mushavo_email_auth.challenges where id=$1',[fresh.challengeId])).rows[0].attempts,1);assert.equal(await status(A,A1),false);
 pass('Wrong HMAC commits an attempt counter and grants no session proof');
 for(const [u,s]of [[A,A2],[B,B1]])assert.equal((await service('email_gate_verify_challenge',[u,s,fresh.challengeId,fresh.codeMac,firstDevice.digest])).result,'UNAVAILABLE');
 assert.equal((await db.query('select attempts from mushavo_email_auth.challenges where id=$1',[fresh.challengeId])).rows[0].attempts,1);
 pass('Challenge cannot be applied to another session or account, including an Admin');
 assert.equal((await verify(fresh,fresh.codeMac,null)).result,'INVALID');assert.equal((await verify(fresh,fresh.codeMac,firstDevice.digest)).result,'VERIFIED');assert.equal(await status(A,A1),true);
 const deviceBefore=(await db.query('select * from mushavo_email_auth.devices where credential_digest=$1',[firstDevice.digest])).rows[0];
 assert.equal((await db.query('select extract(epoch from(expires_at-verified_at)) seconds from mushavo_email_auth.devices where id=$1',[deviceBefore.id])).rows[0].seconds,'604800.000000');
 pass('Correct delivered code creates one session proof and exactly604800 seconds of device approval');
 assert.equal((await verify(fresh,fresh.codeMac,(await newDeviceMaterial()).digest)).result,'UNAVAILABLE');assert.equal((await db.query('select count(*) n from mushavo_email_auth.devices')).rows[0].n,1);
 pass('Consumed code replay cannot mint a second device approval or renew trust');
 assert.equal((await service('email_gate_restore_device',[A,A2,firstDevice.digest])).result,'APPROVED');
 const restored=(await db.query('select * from mushavo_email_auth.devices where id=$1',[deviceBefore.id])).rows[0];assert.deepEqual(restored,deviceBefore);assert.equal(await status(A,A2),true);
 pass('A fresh same-account session can restore approval without sliding the original expiry');
 assert.equal((await service('email_gate_restore_device',[B,B1,firstDevice.digest])).result,'CODE_REQUIRED');assert.equal((await service('email_gate_restore_device',[A,A3,(await newDeviceMaterial()).digest])).result,'CODE_REQUIRED');
 pass('Another account or an unrelated device credential always requires its own code');
 await good(B,B1);assert.equal(await status(B,B1),true);assert.equal((await db.query('select count(*) n from public.app_admins where user_id=$1',[A])).rows[0].n,0);
 pass('Platform Admin is verified through the same email backend; ordinary proof never promotes a role');
 await budget(A);const locked=await begin(A,A3);await delivered(locked);const lockDevice=await newDeviceMaterial();
 const rejected=await codeMac({userId:A,sessionId:A3,challengeId:locked.challengeId,keyVersion,code:String((Number(locked.code)+1)%1000000).padStart(6,'0'),pepper});
 for(let i=0;i<5;i++)assert.equal((await verify(locked,rejected,lockDevice.digest)).result,i===4?'LOCKED':'CODE_REJECTED');
 assert.equal((await verify(locked,locked.codeMac,lockDevice.digest)).result,'UNAVAILABLE');assert.equal(await status(A,A3),false);
 pass('Five wrong attempts lock the challenge; a later correct code cannot bypass lockout');
 await budget(A);const timed=await begin(A,A4);await delivered(timed);
 await db.query("with t as(select clock_timestamp() value) update mushavo_email_auth.challenges set issued_at=t.value-interval '601 seconds',expires_at=t.value-interval '1 second' from t where id=$1",[timed.challengeId]);
 assert.equal((await verify(timed,timed.codeMac,(await newDeviceMaterial()).digest)).result,'UNAVAILABLE');pass('Expired code is denied using database time rather than caller timestamps');
 const noRemember=await good(A,A5,false);assert.equal(await status(A,A5),true);
 assert.equal((await db.query('select device_id from mushavo_email_auth.session_proofs where session_id=$1',[A5])).rows[0].device_id,null);pass('Remember-off verification creates a session proof without any reusable device credential');
 await db.query("with t as(select clock_timestamp() value) update mushavo_email_auth.devices set verified_at=t.value-interval '168 hours 1 second',expires_at=t.value-interval '1 second' from t where id=$1",[deviceBefore.id]);
 assert.equal(await status(A,A1),true);assert.equal(await status(A,A2),true);assert.equal((await service('email_gate_restore_device',[A,A6,firstDevice.digest])).result,'CODE_REQUIRED');
 pass('After day7 existing verified sessions remain valid while a new sign-in needs a code');
 await db.query("update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=$1",[A1]);assert.equal(await status(A,A1),false);assert.equal(await status(A,A2),true);
 pass('Actual modeled Auth session timebox independently invalidates a previously verified session');
 await db.query('delete from auth.sessions where id=$1',[A1]);assert.equal((await db.query('select count(*) n from mushavo_email_auth.session_proofs where session_id=$1',[A1])).rows[0].n,0);assert.equal((await db.query('select count(*) n from mushavo_email_auth.devices where id=$1',[deviceBefore.id])).rows[0].n,1);
 pass('Auth session deletion cascades proof/challenge cleanup while remembered-device approval is retained');
 assert.equal((await service('email_gate_revoke_device',[A,A6,firstDevice.digest])).result,'VERIFICATION_REQUIRED');assert.equal((await service('email_gate_revoke_device',[A,A2,firstDevice.digest])).result,'REVOKED');assert.equal(await status(A,A2),false);assert.equal(await status(A,A5),true);
 pass('Forget-device requires proof and revokes device-derived sessions without unrelated session loss');
 await budget(A);const pending=await begin(A,A8);assert.equal((await service('email_gate_revoke_all',[A,A5])).result,'REVOKED');assert.equal(await status(A,A5),false);assert.equal(await status(B,B1),true);assert.equal((await delivered(pending)).result,'UNAVAILABLE');
 assert.equal((await service('email_gate_restore_device',[A,A7,firstDevice.digest])).result,'CODE_REQUIRED');pass('Revoke-all invalidates account proofs, pending challenges and old credentials without affecting another user');
 const passwordDevice=(await good(A,A5)).device;await db.query("update auth.users set encrypted_password='SYNTHETIC_NEW_HASH' where id=$1",[A]);assert.equal(await status(A,A5),false);assert.equal((await service('email_gate_restore_device',[A,A7,passwordDevice.digest])).result,'CODE_REQUIRED');pass('Password change trigger revokes proof and remembered approval before reuse');
 const emailDevice=(await good(A,A5)).device;await db.query("update auth.users set email='email.changed@example.invalid' where id=$1",[A]);assert.equal(await status(A,A5),false);assert.equal((await service('email_gate_restore_device',[A,A7,emailDevice.digest])).result,'CODE_REQUIRED');pass('Email change invalidates proof without persisting a duplicate password/credential snapshot');
 const bannedDevice=(await good(A,A5)).device;await db.query("update auth.users set banned_until=clock_timestamp()+interval '1 hour' where id=$1",[A]);assert.equal(await status(A,A5),false);await assert.rejects(begin(A,A7),/EMAIL_ACTIVE_AUTH_SESSION_REQUIRED/);await db.query('update auth.users set banned_until=null where id=$1',[A]);assert.equal((await service('email_gate_restore_device',[A,A7,bannedDevice.digest])).result,'CODE_REQUIRED');pass('Auth ban and later unban cannot revive old session/device proof');
 const suspendedDevice=(await good(A,A5)).device;await db.exec("set request.jwt.claim.role='service_role'");await db.query("update public.profiles set account_status='suspended' where id=$1",[A]);assert.equal(await status(A,A5),false);await assert.rejects(begin(A,A7),/EMAIL_ACTIVE_AUTH_SESSION_REQUIRED/);await db.query("update public.profiles set account_status='active' where id=$1",[A]);await db.exec('reset request.jwt.claim.role');assert.equal((await service('email_gate_restore_device',[A,A7,suspendedDevice.digest])).result,'CODE_REQUIRED');pass('Profile suspension revokes proof, and reactivation requires fresh verification');
 await budget(A);for(let i=0;i<5;i++){if(i)await db.query("update mushavo_email_auth.account_state set next_send_at='-infinity' where user_id=$1",[A]);const c=await begin(A,A8);assert.equal(c.response.result,'PENDING_DELIVERY');}
 await db.query("update mushavo_email_auth.account_state set next_send_at='-infinity' where user_id=$1",[A]);assert.equal((await begin(A,A8)).response.result,'RATE_LIMIT');pass('Account-wide rolling five-per-hour send budget survives resend attempts across sessions');
 await db.query('delete from auth.sessions where id=$1',[A8]);assert.equal((await begin(A,A7)).response.result,'RATE_LIMIT');
 await db.query("update mushavo_email_auth.send_events set reserved_at=clock_timestamp()-interval '1 hour 1 second' where user_id=$1",[A]);assert.equal((await begin(A,A7)).response.result,'PENDING_DELIVERY');
 pass('Auth logout cannot erase send budget; rolling-window expiry permits a later request');
 await assert.rejects(db.query('delete from auth.users where id=$1',[A]),/budget_workspaces_owner_id_fkey/);
 assert.equal((await db.query('select count(*) n from mushavo_email_auth.account_state where user_id=$1',[A])).rows[0].n,1);
 pass('Existing workspace-owner FK still blocks premature Auth account deletion without private-state loss');
 await db.query('delete from mushavo_email_auth.account_state where user_id=$1',[A]);for(const table of ['account_state','send_events','challenges','devices','session_proofs'])assert.equal((await db.query(`select count(*) n from mushavo_email_auth.${table} where user_id=$1`,[A])).rows[0].n,0);assert.equal(await status(B,B1),true);pass('Private-state cascade removes only its actor records, leaving other verified accounts and Auth rows intact');
 assert.deepEqual(await catalog(),beforeCatalog);pass('Existing application routine/policy/trigger definitions remain unchanged after all backend exercises');
 const p=spawnSync(process.execPath,['--test','--test-reporter=tap',path.join(root,'tests/fr-2-email-crypto.test.mjs')],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
 const n=name=>Number(p.stdout?.match(new RegExp('^# '+name+' (\\d+)$','m'))?.[1]??-1);assert.equal(p.status,0,p.stdout);assert.equal(n('tests'),7);assert.equal(n('pass'),7);assert.equal(n('fail'),0);assert.equal(n('skipped'),0);
 const files=[candidatePath,'supabase/functions/_shared/email-verification-crypto.mjs','scripts/verify-fr-2-email-backend.mjs','scripts/lib/stage-3-local-db.mjs','tests/fr-2-email-crypto.test.mjs'];
 let syntax=0;for(const f of files.filter(f=>f.endsWith('.mjs'))){assert.equal(spawnSync(process.execPath,['--check',path.join(root,f)],{encoding:'utf8',timeout:10000}).status,0);syntax++;}
 const hashes={};for(const f of files)hashes[f]=createHash('sha256').update(await readFile(path.join(root,f))).digest('hex');
 console.log(JSON.stringify({stage_step:'FR.2.4.E2',result:'OFFLINE_ACTUAL_EMAIL_BACKEND_SQL_AND_CRYPTO_SCOPED_PASS',scope:'FULL54_SOURCE_PLUS_ACTUAL_CANDIDATE_SQL_WITH_MODELED_AUTH_AND_SERVICE_ROLE_CALLS_NOT_REAL_AUTH_OR_EMAIL',node_version:process.version,pglite_version:pgPackage.version,migration_count:migrations.length,source_files_SHA256_verified:59,backend_checks:tests.length,crypto_tests:7,tests:tests.length+7,pass:tests.length+7,fail:0,exit_code:0,syntax_checks:syntax,checks:tests,file_sha256:hashes,modeled_Auth_session_and_credential_columns_used:true,privileged_fixture_clock_and_budget_manipulation_used:true,real_parallel_PostgreSQL_connections_or_races_verified:false,real_Auth_email_gateway_device_cookie_or_native_checks_run:0,application_RLS_RPC_Edge_Storage_gate_installed:false,existing_application_public_functions_policies_and_original_triggers_unchanged:true,hosted_SQL_or_Auth_changes:false,hosted_acceptance:false,production_or_native_changed:false,findings_closed:[],APK_update_deferred:true},null,2));
} catch(error) {
 console.log(JSON.stringify({stage_step:'FR.2.4.E2',result:'OFFLINE_EMAIL_BACKEND_REVIEW_REQUIRED',
  problem_code:'LOCAL_SOURCE_OR_ASSERTION_FAILURE',sqlstate:/^[0-9A-Z]{5}$/.test(error?.code||'')?error.code:null,
  last_completed_check:tests.at(-1)?.test||null,completed_backend_checks:tests.length,exit_code:1,
  real_hosted_requests:0,hosted_acceptance:false,findings_closed:[]},null,2));process.exitCode=1;
} finally {await db.close();}
