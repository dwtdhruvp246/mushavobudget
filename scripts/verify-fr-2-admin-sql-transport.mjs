// Source-only reproduction of Windows line-ending effects; no hosted installation.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
import {normalizeReviewedAdminSql} from './lib/fr-2-admin-sql-transport.mjs';
const manifest=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-admin-sql-transport-manifest.json'),'utf8'));
const {db,migrations}=await localDatabase(process.argv[2]);
const tests=[],test=name=>tests.push({test:name,status:'PASS'}),files={};
const readonly=async text=>(await db.exec(text)).flatMap(x=>x.rows||[]).find(x=>x.admin_mfa_readiness)?.admin_mfa_readiness;
const capture=async()=>({f:(await db.query("select jsonb_agg(to_jsonb(p) order by oid) value from pg_proc p where pronamespace='public'::regnamespace")).rows[0].value,p:(await db.query(`select jsonb_agg((to_jsonb(p)-'polqual'-'polwithcheck')||jsonb_build_object('using_expression',pg_get_expr(p.polqual,p.polrelid),'check_expression',pg_get_expr(p.polwithcheck,p.polrelid)) order by oid) value from pg_policy p`)).rows[0].value});
try{
 for(const [p,c] of Object.entries(manifest.artifacts)){
  const b=await readFile(path.join(root,p)),crlf=Buffer.from(b.toString('utf8').replace(/\n/g,'\r\n'));
  assert.deepEqual(normalizeReviewedAdminSql(b,c),b);assert.deepEqual(normalizeReviewedAdminSql(crlf,c),b);
  files[p]={lf:b,crlf};test('Reviewed exact LF and exact CRLF roundtrip to identical UTF8 bytes: '+p);
  assert.throws(()=>normalizeReviewedAdminSql(Buffer.concat([b,Buffer.from('-- tampered\n')]),c),/UNREVIEWED_BYTES/);
  assert.throws(()=>normalizeReviewedAdminSql(Buffer.concat([Buffer.from([239,187,191]),b]),c),/UNREVIEWED_BYTES/);
  test('Changed SQL bytes and BOM reject without execution: '+p);
 }
 const installerPath='supabase/candidates/security_stage_3_admin_mfa.sql',rollbackPath='supabase/candidates/security_stage_3_admin_mfa_rollback.sql',readinessPath='supabase/diagnostics/security_stage_3_admin_mfa_readiness.sql';
 const original=files[installerPath].lf,c=manifest.artifacts[installerPath];
 const mixed=Buffer.from(original.toString('utf8').replace('\n','\r\n'));
 assert.throws(()=>normalizeReviewedAdminSql(mixed,c),/UNREVIEWED_BYTES/);assert.throws(()=>normalizeReviewedAdminSql(Buffer.from([255,254,0]),c),/UNREVIEWED_BYTES/);test('Mixed line endings and corrupted encoding reject; no whitespace or Unicode guessing');
 assert.throws(()=>normalizeReviewedAdminSql('string',c),/CONTRACT_REQUIRED/);test('Non-byte input rejected');
 const lf=await readonly(files[readinessPath].lf.toString('utf8')),crlf=await readonly(files[readinessPath].crlf.toString('utf8'));
 const old=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-stage-3-admin-mfa-owner-readiness.json'),'utf8'));
 assert.equal(lf.policy_mismatches,0);assert.equal(crlf.policy_mismatches,34);assert.deepEqual(crlf.policy_mismatch_names,old.policy_mismatch_names);assert.equal(lf.routine_body_or_shape_mismatches,0);assert.equal(crlf.routine_body_or_shape_mismatches,0);
 test('Old readiness exact Windows CRLF reproduces same34 historical policy names; LF has zero mismatches');
 const normalized=await readonly(normalizeReviewedAdminSql(files[readinessPath].crlf,manifest.artifacts[readinessPath]).toString('utf8'));
 assert.deepEqual(normalized,lf);test('Byte-guarded normalization restores old selected readiness exactly');
 const frozenBefore=await capture();
 await assert.rejects(db.exec(files[installerPath].lf.toString('utf8')),/ADMIN_MFA_RECOVERY_REVIEW_REQUIRED/);await db.exec('rollback');
 await db.exec("set mushavo.admin_mfa_recovery_reviewed='yes'");
 await assert.rejects(db.exec(files[installerPath].lf.toString('utf8')),/ADMIN_MFA_CONTROLLED_OPERATOR_REQUIRED/);await db.exec('rollback');
 assert.deepEqual(await capture(),frozenBefore);test('Existing recovery and operator installer prerequisites still reject with source unchanged');
 await db.exec(`insert into auth.users(id,email) values('90000000-0000-4000-8000-000000000001','LOCAL-OPERATOR@example.invalid');
 insert into public.app_admins(user_id,email,role) values('90000000-0000-4000-8000-000000000001','LOCAL-OPERATOR@example.invalid','super_admin');
 insert into auth.mfa_factors(user_id,status,factor_type) values('90000000-0000-4000-8000-000000000001','verified','totp');`);
 const before=await capture();
 await assert.rejects(db.exec(files[installerPath].crlf.toString('utf8')),/ADMIN_MFA_POLICY_DRIFT/);await db.exec('rollback');
 assert.deepEqual(await capture(),before);test('Raw CRLF frozen installer rejects policy drift atomically even after modeled operator prerequisites');
 await db.exec(normalizeReviewedAdminSql(files[installerPath].crlf,c).toString('utf8'));
 assert.equal((await db.query("select count(*)::integer n from pg_proc where pronamespace='public'::regnamespace and proname in ('admin_mfa_satisfied','platform_admin_authorized','admin_mfa_status')")).rows[0].n,3);
 test('Exact normalized frozen candidate compiles against full54 source with modeled operator only');
 await assert.rejects(db.exec(files[rollbackPath].lf.toString('utf8')),/ADMIN_MFA_ROLLBACK_REVIEW_REQUIRED/);await db.exec('rollback');
 test('Independent rollback acknowledgement remains required');
 await db.exec("set mushavo.admin_mfa_rollback_reviewed='yes'");
 await assert.rejects(db.exec(files[rollbackPath].crlf.toString('utf8')),/ADMIN_MFA_ROLLBACK_POLICY_DRIFT/);await db.exec('rollback');
 test('Raw CRLF frozen rollback also rejects changed expected policy literal formatting');
 await db.exec(normalizeReviewedAdminSql(files[rollbackPath].crlf,manifest.artifacts[rollbackPath]).toString('utf8'));
 assert.deepEqual(await capture(),before);test('Normalized frozen rollback restores full routine metadata and policy metadata/exact deparsed definitions');
 const receipt={stage_step:'FR.2.4_ADMIN_SQL_DELIVERY_REVIEW',result:'LOCAL_EXACT_BYTE_DELIVERY_AND_HISTORICAL_CRLF_REPRODUCTION_PASS',source_parent_commit:'e13b4f48cda563eba8d4cbe3253d31d45ad5493d',node_version:process.version,migration_count:migrations.length,tests,local_PASS:tests.length,local_FAIL:0,exit_code:0,old_LF_policy_mismatches:0,old_CRLF_policy_mismatches:34,historical34_name_set_reproduced_exactly:true,actual_historical_pasted_bytes_not_retained:true,current_hosted_36_routine_58_policy_fingerprints_already_match_source:true,reviewed_frozen_SQL_artifacts_unchanged:true,real_Windows_clipboard_execution_verified:false,genuine_AAL1_AAL2_or_recovery_verified:false,new_hosted_installation_Auth_or_SQL_calls:0,hosted_acceptance:false,findings_closed:[]};
 await writeFile(path.join(root,'docs/security-audit/security-fr-2-admin-sql-transport-local-checks.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
}finally{await db.close();}
