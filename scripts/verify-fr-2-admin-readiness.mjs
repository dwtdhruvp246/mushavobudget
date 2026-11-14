// Local source-catalog validation only; no hosted Auth/SQL calls or enrollment.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
const {db,migrations}=await localDatabase(process.argv[2]);
const sql=await readFile(path.join(root,'supabase/diagnostics/security_fr_2_4_admin_readiness.sql'),'utf8');
const tests=[],test=name=>tests.push({test:name,status:'PASS'});
const query=sql.slice(sql.indexOf('WITH selected_routines'),sql.lastIndexOf('ROLLBACK;'));
const read=async()=> (await db.exec(sql)).flatMap(x=>x.rows||[]).find(x=>x.admin_readiness).admin_readiness;
const sourceRows=async()=>({
 functions:(await db.query("select jsonb_agg(to_jsonb(p) order by oid) value from pg_proc p where pronamespace='public'::regnamespace")).rows[0].value,
 policies:(await db.query('select jsonb_agg(to_jsonb(p) order by oid) value from pg_policy p')).rows[0].value,
 roles:(await db.query('select jsonb_agg(to_jsonb(r) order by oid) value from pg_roles r')).rows[0].value,
 factors:(await db.query('select jsonb_agg(to_jsonb(f) order by id) value from auth.mfa_factors f')).rows[0].value,
 appAdmins:(await db.query('select jsonb_agg(to_jsonb(a) order by user_id) value from public.app_admins a')).rows[0].value,
 accounts:(await db.query('select jsonb_agg(to_jsonb(p) order by id) value from public.profiles p')).rows[0].value
});
try{
 await db.exec("set time zone 'UTC'");
 const ids=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'];
 await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)',[ids[0],'audit.owner@example.com',ids[1],'audit.outsider@example.com']);
 const before=await sourceRows(),baseline=await read();
 assert.equal(baseline.transaction_read_only,'on');assert.equal(baseline.selected_routine_names,36);assert.equal(baseline.observed_selected_routine_overloads,36);assert(baseline.routine_fingerprints.every(x=>x.overloads===1));
 test('Read-only full54-migration catalog returns all36 selected routines without overload ambiguity');
 assert.equal(baseline.selected_policies,58);assert.equal(baseline.observed_selected_policies,58);assert.equal(baseline.policy_fingerprints.filter(x=>x.relation==='storage.objects').length,3);assert(baseline.policy_fingerprints.every(x=>x.present));
 test('Exact frozen55 public plus three Storage policy selectors all resolve');
 assert.equal(baseline.selected_anonymous_executable_routines,14);assert.equal(baseline.selected_authenticated_executable_routines,31);
 test('Source effective execute counts14 anonymous/31 authenticated retained as metadata only');
 assert.equal(baseline.candidate_helper_overloads,0);assert.equal(baseline.active_super_users_with_verified_totp,0);assert.equal(baseline.shared_audit_actors_with_platform_role,0);assert.equal(baseline.readiness,'BLOCKED_NO_VERIFIED_SUPER_OPERATOR');
 assert.equal(baseline.operator_control_or_independent_recovery_verified,false);assert.equal(baseline.hosted_acceptance,false);
 test('No operator/helper metadata yields blocked readiness without promoting shared actors or inferring recovery');
 await db.exec('begin');try{
  await db.exec("update pg_proc set prosrc=replace(prosrc,chr(10),chr(13)||chr(10)) where pronamespace='public'::regnamespace");
  const crlf=(await db.query(query)).rows[0].admin_readiness;assert.deepEqual(crlf.routine_fingerprints,baseline.routine_fingerprints);
  test('Only exact CRLF-to-LF body normalization preserves routine fingerprints');
 }finally{await db.exec('rollback');}
 await db.exec('begin');try{
  await db.exec("update pg_proc set prosrc=prosrc||chr(10)||'-- LOCAL-SOURCE-DRIFT' where oid='public.is_app_admin()'::regprocedure");
  const changed=(await db.query(query)).rows[0].admin_readiness;assert.equal(changed.routine_fingerprints.filter((x,i)=>x.sha256!==baseline.routine_fingerprints[i].sha256).length,1);
  test('Single actual routine body drift changes selected fingerprint');
 }finally{await db.exec('rollback');}
 await db.exec('begin');try{
  await db.exec('revoke execute on function public.is_app_admin() from authenticated');
  const changed=(await db.query(query)).rows[0].admin_readiness;assert.notDeepEqual(changed.routine_fingerprints,baseline.routine_fingerprints);
  test('Effective execute privilege drift changes selected source projection');
 }finally{await db.exec('rollback');}
 await db.exec('begin');try{
  await db.exec('create function public.is_app_admin(integer) returns boolean language sql as $$select false$$');
  const changed=(await db.query(query)).rows[0].admin_readiness;assert.equal(changed.observed_selected_routine_overloads,37);assert.equal(changed.routine_fingerprints.find(x=>x.name==='is_app_admin').overloads,2);
  test('Unexpected selected-name overload is included and exposes catalog drift');
 }finally{await db.exec('rollback');}
 await db.exec('begin');try{
  await db.exec('alter policy "Users and admins can read profiles" on public.profiles using (false)');
  const changed=(await db.query(query)).rows[0].admin_readiness;assert.equal(changed.policy_fingerprints.filter((x,i)=>x.sha256!==baseline.policy_fingerprints[i].sha256).length,1);
  test('Changed policy expression changes one exact selected policy fingerprint');
 }finally{await db.exec('rollback');}
 await db.exec('begin');try{
  await db.exec('drop policy "Users and admins can read profiles" on public.profiles');
  const changed=(await db.query(query)).rows[0].admin_readiness;assert.equal(changed.observed_selected_policies,57);assert.equal(changed.policy_fingerprints.find(x=>x.name==='Users and admins can read profiles').present,false);
  test('Missing selected policy is explicitly reported rather than silently omitted');
 }finally{await db.exec('rollback');}
 await db.exec('begin');try{
  const id='00000000-0000-4000-8000-000000000099';await db.query('insert into auth.users(id,email) values($1,$2)',[id,'LOCAL-ISOLATED-OPERATOR@example.com']);
  await db.query("insert into public.app_admins(user_id,email,role) values($1,'LOCAL-ISOLATED-OPERATOR@example.com','super_admin')",[id]);
  await db.query("insert into auth.mfa_factors(user_id,status,factor_type) values($1,'unverified','totp')",[id]);
  let changed=(await db.query(query)).rows[0].admin_readiness;assert.equal(changed.active_super_users_with_verified_totp,0);
  await db.query("update auth.mfa_factors set status='verified' where user_id=$1",[id]);
  changed=(await db.query(query)).rows[0].admin_readiness;assert.equal(changed.active_super_users_with_verified_totp,1);assert.equal(changed.readiness,'VERIFIED_SUPER_EXISTS_CONTROL_AND_RECOVERY_UNVERIFIED');assert.equal(changed.operator_control_or_independent_recovery_verified,false);assert.equal(changed.shared_audit_actors_with_platform_role,0);
  test('Unverified factor excluded; isolated active verified TOTP counts without claiming operator control or recovery');
 }finally{await db.exec('rollback');}
 await db.exec('begin;set local role anon');try{await assert.rejects(db.exec(sql),/ADMIN_READINESS_REQUIRES_PRIVILEGED_SQL_EDITOR/);test('Ordinary SQL caller rejected before privileged metadata reads');}finally{await db.exec('rollback;reset role');}
 assert.deepEqual(await sourceRows(),before);test('Roles/accounts/factors/public functions/policies remain byte-equivalent after read-only checks');
 const out=JSON.stringify(baseline);assert(!ids.some(x=>out.includes(x)));assert(!out.includes('audit.owner@example.com'));assert(!out.includes('begin\n'));assert.equal(baseline.application_routines_invoked,0);test('Safe output contains catalog hashes/counts and no actor identifiers, raw bodies or credentials');
 const source={stage_step:'FR.2.4_ADMIN_READINESS_SOURCE_MODEL',scope:'ORDERED54_MIGRATION_METADATA_NOT_HOSTED_AUTHORIZATION',server_version:baseline.server_version,normalization:'CRLF_TO_LF_ONLY_ROUTINE_BODY_NO_ARBITRARY_WHITESPACE_STRIPPING',routine_fingerprints:baseline.routine_fingerprints,policy_fingerprints:baseline.policy_fingerprints,source_effective_anon_execute:14,source_effective_authenticated_execute:31,source_projection_not_semantic_equivalence_or_hosted_acceptance:true};
 await writeFile(path.join(root,'docs/security-audit/security-fr-2-admin-readiness-source-model.json'),JSON.stringify(source,null,2)+'\n');
 const receipt={stage_step:'FR.2.4_ADMIN_READINESS',result:'LOCAL_READ_ONLY_ADMIN_METADATA_DIAGNOSTIC_SCOPED_PASS',source_parent_commit:'4092ed756be509f36e1a64201926524de6ef1068',node_version:process.version,migration_count:migrations.length,tests,local_PASS:tests.length,local_FAIL:0,exit_code:0,syntax_checks:1,modeled_Auth_Storage_and_default_grants:true,real_hosted_or_genuine_Auth_MFA_cases_run:0,SQL_ASCII:! /[^\x00-\x7f]/.test(sql),hosted_acceptance:false,findings_closed:[]};
 await writeFile(path.join(root,'docs/security-audit/security-fr-2-admin-readiness-local-checks.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
}finally{await db.close();}
