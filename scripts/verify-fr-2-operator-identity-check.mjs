import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
const {db,migrations}=await localDatabase(process.argv[2]);
const original=await readFile(path.join(root,'supabase/diagnostics/security_fr_2_4_operator_identity_check.sql'),'utf8');
const sql=original.replace('PRIMARY_EMAIL_REPLACE_LOCALLY','fr24.primary@example.invalid').replace('RECOVERY_EMAIL_REPLACE_LOCALLY','fr24.recovery@example.invalid');
const tests=[],test=name=>tests.push({test:name,status:'PASS'}),read=async text=>(await db.exec(text||sql)).flatMap(x=>x.rows||[]).find(x=>x.operator_identity_check).operator_identity_check;
try{
 // Supabase Auth's documented timestamp, absent in the minimal source scaffold.
 await db.exec('alter table auth.users add column email_confirmed_at timestamptz');
 let v=await read();assert.equal(v.ready_for_private_MFA_preparation,false);assert(v.accounts.every(x=>x.auth_users===0));test('Missing logins reported without creating accounts or implying readiness');
 const ids=['00000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000072'];
 await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)',[ids[0],'fr24.primary@example.invalid',ids[1],'fr24.recovery@example.invalid']);
 v=await read();assert.equal(v.ready_for_private_MFA_preparation,false);assert(v.accounts.every(x=>x.auth_users===1&&x.active_profiles===1&&x.email_confirmation_timestamps===0&&x.platform_roles===0));test('Actual new-user profile callbacks run; unconfirmed ordinary logins remain pending');
 await db.exec('update auth.users set email_confirmed_at=now()');
 const before=(await db.query('select jsonb_agg(to_jsonb(u) order by id) value from auth.users u')).rows[0].value;
 v=await read();assert.equal(v.ready_for_private_MFA_preparation,true);assert(v.accounts.every(x=>x.verified_totp_factors===0&&x.platform_roles===0));assert.equal(v.genuine_signin_MFA_recovery_or_Admin_acceptance_verified,false);test('Two confirmed active isolated ordinary logins qualify only for subsequent private MFA preparation');
 assert.deepEqual((await db.query('select jsonb_agg(to_jsonb(u) order by id) value from auth.users u')).rows[0].value,before);test('Read-only identity diagnostic preserves full Auth rows');
 await db.exec('begin');try{
  await db.query("insert into public.app_admins(user_id,email,role) values($1,'fr24.primary@example.invalid','super_admin')",[ids[0]]);
  const query=sql.slice(sql.indexOf('WITH requested'),sql.lastIndexOf('ROLLBACK;'));
  await db.exec("set local mushavo.operator_primary_email='fr24.primary@example.invalid';set local mushavo.operator_recovery_email='fr24.recovery@example.invalid'");
  v=(await db.query(query)).rows[0].operator_identity_check;assert.equal(v.ready_for_private_MFA_preparation,false);test('Pre-existing platform role blocks ordinary pre-enrollment readiness');
 }finally{await db.exec('rollback');}
 for(const [label,text] of [['Shared prior audit identity',sql.replace('fr24.primary@example.invalid','audit.owner@example.com')],['Same email in both slots',sql.replace('fr24.recovery@example.invalid','fr24.primary@example.invalid')],['Unfilled placeholders',original]]){
  await assert.rejects(db.exec(text),/TWO_DISTINCT_NON_AUDIT_EMAILS_REQUIRED/);await db.exec('rollback');test(label+' rejected before account metadata query');
 }
 await db.exec('begin;set local role anon');try{await assert.rejects(db.exec(sql),/IDENTITY_CHECK_REQUIRES_PRIVILEGED_SQL_EDITOR/);test('Ordinary SQL role rejected before privileged Auth metadata reads');}finally{await db.exec('rollback;reset role');}
 const safe=JSON.stringify(await read());assert(!safe.includes(ids[0])&&!safe.includes('fr24.primary@example.invalid'));test('Only slot labels and aggregate status returned, without actor identifiers or emails');
 const receipt={stage_step:'FR.2.4_OPERATOR_IDENTITY_CHECK',result:'LOCAL_READ_ONLY_OPERATOR_IDENTITY_DIAGNOSTIC_SCOPED_PASS',migration_count:migrations.length,node_version:process.version,tests,local_PASS:tests.length,local_FAIL:0,exit_code:0,syntax_checks:1,modeled_Auth_Storage_and_confirmed_timestamp_used:true,actual_Auth_creation_dashboard_signin_MFA_or_email_delivery_verified:false,new_hosted_requests:0,hosted_acceptance:false,findings_closed:[]};
 await writeFile(path.join(root,'docs/security-audit/security-fr-2-operator-identity-local-checks.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
}finally{await db.close();}
