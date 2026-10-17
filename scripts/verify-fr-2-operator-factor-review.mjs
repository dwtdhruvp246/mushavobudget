import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
const {db,migrations}=await localDatabase(process.argv[2]);
const original=await readFile(path.join(root,'supabase/diagnostics/security_fr_2_4_operator_factor_review.sql'),'utf8');
const sql=original.replace('PRIMARY_EMAIL_REPLACE_LOCALLY','fr24.primary@example.invalid').replace('RECOVERY_EMAIL_REPLACE_LOCALLY','fr24.recovery@example.invalid');
const tests=[],pass=test=>tests.push({test,status:'PASS'});
const read=async(text=sql)=>(await db.exec(text)).flatMap(x=>x.rows||[]).find(x=>x.factor_setup_review).factor_setup_review;
const ids=['00000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000072'];
try {
 await db.exec('alter table auth.mfa_factors add column friendly_name text, add column created_at timestamptz, add column updated_at timestamptz, add column secret text');
 let value=await read();assert(value.accounts.every(x=>x.auth_users===0&&x.factor_count===0));pass('Missing users/factors remain uncreated with empty bounded metadata');
 await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)',[ids[0],'fr24.primary@example.invalid',ids[1],'fr24.recovery@example.invalid']);
 value=await read();assert(value.accounts.every(x=>x.auth_users===1&&x.active_profiles===1&&x.platform_roles===0));pass('Two source-created active ordinary profiles are identified by slot only');
 await db.query("insert into auth.mfa_factors(id,user_id,factor_type,status,friendly_name,created_at,updated_at,secret) values('00000000-0000-4000-8000-000000000081',$1,'totp','unverified','Mushavo staging PRIMARY','2026-10-15T05:59:59Z','2026-10-15T05:59:59Z','SYNTHETIC_SECRET_NOT_SELECTED')",[ids[0]]);
 value=await read();let p=value.accounts.find(x=>x.slot==='PRIMARY');assert.equal(p.unverified_totp,1);assert.equal(p.verified_totp,0);assert(p.factors[0].matches_expected_setup_label&&p.factors[0].created_in_failed_run_window);assert.equal(value.time_or_label_correlation_proves_provenance_or_authorizes_cleanup,false);pass('Pending expected-label factor within failed-run window is reported without cleanup permission');
 const hash=p.factors[0].metadata_sha256;assert(/^[0-9a-f]{64}$/.test(hash));const safe=JSON.stringify(value);assert(!safe.includes(ids[0])&&!safe.includes('00000000-0000-4000-8000-000000000081')&&!safe.includes('fr24.primary@example.invalid')&&!safe.includes('SYNTHETIC_SECRET_NOT_SELECTED'));pass('Output contains no raw identifiers/email/secret and fingerprints selected metadata only');
 await db.exec("update auth.mfa_factors set secret='DIFFERENT_SYNTHETIC_SECRET'");value=await read();assert.equal(value.accounts.find(x=>x.slot==='PRIMARY').factors[0].metadata_sha256,hash);pass('Changing only excluded synthetic secret cannot affect metadata fingerprint');
 await db.exec("update auth.mfa_factors set status='verified',updated_at='2026-10-15T06:01:00Z'");value=await read();p=value.accounts.find(x=>x.slot==='PRIMARY');assert.equal(p.verified_totp,1);assert.notEqual(p.factors[0].metadata_sha256,hash);pass('Verified-state changes are distinguished without implying AAL2 acceptance');
 await db.query("insert into auth.mfa_factors(user_id,factor_type,status,friendly_name,created_at,updated_at) select $1,'totp','unverified','different label','2026-10-14T00:00:00Z','2026-10-14T00:00:00Z' from generate_series(1,6)",[ids[1]]);
 value=await read();const rec=value.accounts.find(x=>x.slot==='RECOVERY');assert.equal(rec.factor_count,6);assert.equal(rec.factors.length,5);assert(rec.details_truncated);assert(rec.factors.every(x=>!x.matches_expected_setup_label&&!x.created_in_failed_run_window));pass('Unexpected labels/times and excessive factor detail remain bounded with explicit truncation');
 const before=(await db.query('select jsonb_agg(to_jsonb(f) order by id) value from auth.mfa_factors f')).rows[0].value;
 await read();assert.deepEqual((await db.query('select jsonb_agg(to_jsonb(f) order by id) value from auth.mfa_factors f')).rows[0].value,before);pass('Read-only transaction preserves complete modeled factor rows including excluded secrets');
 for(const [name,text]of [['reserved audit identity',sql.replace('fr24.primary@example.invalid','audit.owner@example.com')],['duplicate slots',sql.replace('fr24.recovery@example.invalid','fr24.primary@example.invalid')],['unfilled template',original]]){
  await assert.rejects(db.exec(text),/TWO_DISTINCT_NON_AUDIT_EMAILS_REQUIRED/);await db.exec('rollback');pass('Input guard rejects '+name);
 }
 await db.exec('begin;set local role anon');try{await assert.rejects(db.exec(sql),/FACTOR_REVIEW_REQUIRES_PRIVILEGED_SQL_EDITOR/);pass('Unprivileged SQL role cannot inspect Auth factor metadata');}finally{await db.exec('rollback;reset role');}
 const receipt={stage_step:'FR.2.4_OPERATOR_FACTOR_REVIEW',result:'LOCAL_READ_ONLY_FACTOR_METADATA_DIAGNOSTIC_SCOPED_PASS',migration_count:migrations.length,node_version:process.version,tests,pass:tests.length,fail:0,exit_code:0,modeled_documented_Auth_metadata_columns_added_locally:true,real_hosted_requests:0,actual_hosted_pending_factor_status_or_provenance_verified:false,hosted_acceptance:false,findings_closed:[]};
 await writeFile(path.join(root,'docs/security-audit/security-fr-2-operator-factor-review-local-checks.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
} finally {await db.close();}
