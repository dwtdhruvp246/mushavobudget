// Offline behavior receipt: real local RLS/RPC execution; modeled Auth/Storage/grants.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
const {db,migrations}=await localDatabase(process.argv[2]);
const output=process.argv[3];
const candidate=await readFile(resolve(root,'supabase/candidates/security_stage_3_admin_mfa.sql'),'utf8');
const checks=[];
async function check(name,fn){try{await fn();checks.push({name,result:'PASS'});}catch(e){checks.push({name,result:'FAIL',error:e.message.slice(0,200)});throw e;}}
const ids=Array.from({length:7},(_,i)=>`10000000-0000-4000-8000-00000000000${i+1}`);
const roles=['super_admin','admin_staff','finance_staff','support_staff'];
const family='20000000-0000-4000-8000-000000000001';
async function claims(id,aal='aal1',role='authenticated') {await db.query(`select set_config('request.jwt.claims',$1,false)`,[JSON.stringify({sub:id,aal,role})]);}
async function as(id,aal,sql,params=[]) {await claims(id,aal);await db.exec('set role authenticated');try{return (await db.query(sql,params)).rows;}finally{await db.exec('reset role');}}
async function deny(id,aal,sql,params=[]) {await assert.rejects(as(id,aal,sql,params));}
async function installerDenial(pattern) {
  await assert.rejects(db.exec(candidate),pattern);await db.exec('rollback');
  assert.equal((await db.query(`select to_regprocedure('public.admin_mfa_satisfied()') is null missing`)).rows[0].missing,true);
}
try {
 await check('all 52 frozen migrations compile',()=>assert.equal(migrations.length,52));
 await check('read-only readiness compiles with no staff and records blocker',async()=> {
  const rows=await db.exec(await readFile(resolve(root,'supabase/diagnostics/security_stage_3_admin_mfa_readiness.sql'),'utf8'));
  const value=rows.flatMap(r=>r.rows||[]).find(r=>r.admin_mfa_readiness)?.admin_mfa_readiness;
  assert.equal(value.readiness,'BLOCKED_NO_VERIFIED_SUPER_OPERATOR');assert.equal(value.routine_body_or_shape_mismatches,0);assert.equal(value.policy_mismatches,0);assert.equal(value.selected_policies,58);
 });
 const before=(await db.query(`select p.proname,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by p.oid`)).rows;
 await check('installer refuses unreviewed recovery and rolls back',()=>installerDenial(/RECOVERY_REVIEW_REQUIRED/));
 await db.exec(`set mushavo.admin_mfa_recovery_reviewed='yes';`);
 await check('installer refuses absent verified super operator',()=>installerDenial(/CONTROLLED_OPERATOR_REQUIRED/));
 await claims(null,'aal1','service_role');
 for(let i=0;i<ids.length;i++)await db.query(`insert into auth.users(id,email) values($1,$2)`,[ids[i],`local-${i}@example.invalid`]);
 for(let i=0;i<4;i++) {
  await db.query(`insert into public.app_admins(user_id,email,role) values($1,$2,$3)`,[ids[i],`local-${i}@example.invalid`,roles[i]]);
  await db.query(`insert into auth.mfa_factors(user_id,status,factor_type) values($1,'verified','totp')`,[ids[i]]);
 }
 await db.query(`insert into auth.mfa_factors(user_id,status,factor_type) values($1,'verified','totp')`,[ids[4]]);
 await db.query(`insert into public.families(id,owner_id,name) values($1,$2,'LOCAL_MFA_FOREIGN_FAMILY')`,[family,ids[4]]);
 await db.query(`insert into public.family_members(family_id,name,email,user_id,role,created_by) values($1,'Local member',$2,$3,'Adult',$3)`,[family,'local-5@example.invalid',ids[5]]);
 await check('installer rejects changed routine body without helper residue',async()=> {
  const r=(await db.query(`select pg_get_functiondef('public.is_app_admin()'::regprocedure) d`)).rows[0].d;
  await db.exec(r.replace('select','select /* unreviewed */'));
  await installerDenial(/SOURCE_DRIFT/);await db.exec(r);
 });
 await check('installer rejects changed security-definer shape',async()=> {
  await db.exec('alter function public.is_app_admin() security invoker');
  await installerDenial(/SOURCE_DRIFT/);await db.exec('alter function public.is_app_admin() security definer');
 });
 await check('installer rejects changed policy without helper residue',async()=> {
  const r=(await db.query(`select pg_get_expr(polqual,polrelid) q from pg_policy where polrelid='public.admin_finance_settings'::regclass and polcmd='r'`)).rows[0];
  const n=(await db.query(`select polname from pg_policy where polrelid='public.admin_finance_settings'::regclass and polcmd='r'`)).rows[0].polname;
  await db.exec(`alter policy "${n}" on public.admin_finance_settings using (true)`);
  await installerDenial(/POLICY_DRIFT/);await db.exec(`alter policy "${n}" on public.admin_finance_settings using (${r.q})`);
 });
 await check('exact reviewed CRLF body variant installs',async()=> {
  const r=(await db.query(`select pg_get_functiondef('public.is_app_admin()'::regprocedure) d,prosrc b from pg_proc where oid='public.is_app_admin()'::regprocedure`)).rows[0];
  await db.exec(r.d.replace(r.b,()=>r.b.replaceAll('\n','\r\n')));await db.exec(candidate);
 });
 await check('existing routine ACLs unchanged',async()=> {
  const after=(await db.query(`select p.proname,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by p.oid`)).rows;
  assert.deepEqual(after.filter(r=>!['admin_mfa_status','admin_mfa_satisfied','platform_admin_authorized'].includes(r.proname)),before);
 });
 await check('new bootstrap/assurance helpers have no anonymous execution',async()=> {
  for(const signature of ['admin_mfa_status()','admin_mfa_satisfied()','platform_admin_authorized(text[])'])assert.equal((await db.query(`select has_function_privilege('anon',$1,'execute') allowed`,['public.'+signature])).rows[0].allowed,false);
 });
 for(let i=0;i<4;i++) {
  await check(`${roles[i]} aal1 raw identity and own role bootstrap remain`,async()=> {
   assert.equal((await as(ids[i],'aal1',`select public.is_platform_staff(null) raw,public.platform_admin_authorized(null) allowed`))[0].raw,true);
   assert.equal((await as(ids[i],'aal1',`select count(*)::int n from app_admins`))[0].n,1);
  });
  await check(`${roles[i]} aal1 foreign Family row invisible`,async()=>assert.equal((await as(ids[i],'aal1',`select count(*)::int n from families where id=$1`,[family]))[0].n,0));
  await check(`${roles[i]} aal1 foreign Family mutation has no effect`,async()=> {
   assert.equal((await as(ids[i],'aal1',`update families set name='SHOULD_NOT_WRITE' where id=$1 returning id`,[family])).length,0);
   assert.equal((await db.query(`select name from families where id=$1`,[family])).rows[0].name,'LOCAL_MFA_FOREIGN_FAMILY');
  });
  await check(`${roles[i]} aal1 Admin RPC denied`,()=>deny(ids[i],'aal1',`select public.admin_analytics_foundation()`));
  await check(`${roles[i]} aal2 raw-branch Family read permitted`,async()=>assert.equal((await as(ids[i],'aal2',`select count(*)::int n from families where id=$1`,[family]))[0].n,1));
  await check(`${roles[i]} aal2 helper-backed analytics returns report`,async()=>assert.ok((await as(ids[i],'aal2',`select public.admin_analytics_foundation() report`))[0].report));
  await check(`${roles[i]} retains exact finance writer role`,async()=> {
   const sql=`select public.save_admin_finance_currency_settings('USD',array['USD'],false)`;
   if(i===3)await deny(ids[i],'aal2',sql);else await as(ids[i],'aal2',sql);
   const row=(await db.query(`select conversion_enabled,updated_by from admin_finance_settings where id=1`)).rows[0];
   assert.equal(row.conversion_enabled,false);assert.equal(row.updated_by,i===3?ids[2]:ids[i]);
  });
 }
 await check('aal1 owner reads own Family row',async()=>assert.equal((await as(ids[4],'aal1',`select count(*)::int n from families where id=$1`,[family]))[0].n,1));
 await check('aal1 actual Family participant helper retained',async()=>assert.equal((await as(ids[5],'aal1',`select public.is_active_family_participant($1) allowed`,[family]))[0].allowed,true));
 const workspace=(await db.query(`select id from budget_workspaces where legacy_family_id=$1`,[family])).rows[0].id;
 await check('aal1 actual workspace owner retained',async()=>assert.equal((await as(ids[4],'aal1',`select public.is_workspace_owner($1) allowed`,[workspace]))[0].allowed,true));
 await check('aal1 staff without membership loses workspace override',async()=>assert.equal((await as(ids[1],'aal1',`select public.is_workspace_member($1) allowed`,[workspace]))[0].allowed,false));
 await check('ordinary verified aal2 owner still lacks Admin authority',async()=> {
  assert.equal((await as(ids[4],'aal2',`select public.platform_admin_authorized(null) allowed`))[0].allowed,false);
  await deny(ids[4],'aal2',`select public.admin_analytics_foundation()`);
 });
 await check('user-editable role/MFA metadata cannot grant administrative authority',async()=> {
  await db.query(`update auth.users set raw_user_meta_data=$2::jsonb where id=$1`,[ids[4],JSON.stringify({role:'super_admin',aal:'aal2',mfa:true})]);
  assert.equal((await as(ids[4],'aal2',`select public.platform_admin_authorized(null) allowed`))[0].allowed,false);
 });
 await db.query(`insert into storage.objects(bucket_id,name) values('payment-proofs',$1)`,[`personal/${ids[4]}/private.pdf`]);
 await check('Storage private proof denied to low-assurance staff',async()=>assert.equal((await as(ids[0],'aal1',`select count(*)::int n from storage.objects`))[0].n,0));
 await check('Storage private proof available to stepped-up staff',async()=>assert.equal((await as(ids[0],'aal2',`select count(*)::int n from storage.objects`))[0].n,1));
 await check('Storage private proof owner branch retained',async()=>assert.equal((await as(ids[4],'aal1',`select count(*)::int n from storage.objects`))[0].n,1));
 await check('Storage denied delete leaves owner object unchanged',async()=> {
  assert.equal((await as(ids[0],'aal1',`delete from storage.objects returning id`)).length,0);
  assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n,1);
 });
 await check('last factor removal denies stale aal2 token',async()=> {
  await db.query(`delete from auth.mfa_factors where user_id=$1`,[ids[0]]);
  assert.equal((await as(ids[0],'aal2',`select public.platform_admin_authorized(null) allowed`))[0].allowed,false);
  await deny(ids[0],'aal2',`select public.admin_analytics_foundation()`);
  await db.query(`insert into auth.mfa_factors(user_id,status,factor_type) values($1,'verified','totp')`,[ids[0]]);
 });
 await check('unverified factor does not satisfy assurance',async()=> {
  await db.query(`update auth.mfa_factors set status='unverified' where user_id=$1`,[ids[0]]);
  assert.equal((await as(ids[0],'aal2',`select public.platform_admin_authorized(null) allowed`))[0].allowed,false);
  await db.query(`update auth.mfa_factors set status='verified' where user_id=$1`,[ids[0]]);
 });
 await check('same-session suspended staff denies read and mutation',async()=> {
  await claims(null,'aal1','service_role');await db.query(`update profiles set account_status='suspended' where id=$1`,[ids[0]]);
  assert.equal((await as(ids[0],'aal2',`select public.platform_admin_authorized(null) allowed`))[0].allowed,false);
  await deny(ids[0],'aal2',`select public.save_admin_finance_currency_settings('USD',array['USD'],true)`);
  assert.equal((await db.query(`select conversion_enabled from admin_finance_settings where id=1`)).rows[0].conversion_enabled,false);
  await claims(null,'aal1','service_role');await db.query(`update profiles set account_status='active' where id=$1`,[ids[0]]);
 });
 await check('missing profile denies authorization even with staff and factor',async()=> {
  await db.query(`delete from profiles where id=$1`,[ids[0]]);
  assert.equal((await as(ids[0],'aal2',`select public.platform_admin_authorized(null) allowed`))[0].allowed,false);
  await db.query(`insert into profiles(id,full_name,email) values($1,'Local restored','local-0@example.invalid')`,[ids[0]]);
 });
 await check('same-session staff revocation denies administrative RPC',async()=> {
  await db.query(`delete from app_admins where user_id=$1`,[ids[0]]);
  assert.equal((await as(ids[0],'aal2',`select public.is_platform_staff(null) raw`))[0].raw,false);
  await deny(ids[0],'aal2',`select public.admin_analytics_foundation()`);
 });
 await check('trusted service currency backfill remains callable',async()=> {
  await claims(null,'aal1','service_role');await db.exec('set role service_role');
  try{await db.query('select public.backfill_currency_conversions()');}finally{await db.exec('reset role');}
 });
 await check('raw internal recipient/permit/reservation routines remain unavailable to ordinary API roles',async()=> {
  const rows=(await db.query(`select has_function_privilege('authenticated',oid,'execute') allowed,has_function_privilege('anon',oid,'execute') anonymous_allowed from pg_proc where proname in ('reserve_admin_user_invitation','business_admin_test_permit','enqueue_admin_event_notification')`)).rows;
  assert.equal(rows.length,3);for(const row of rows){assert.equal(row.allowed,false);assert.equal(row.anonymous_allowed,false);}
 });
 await check('repeat install refused without mutations',async()=> {
  await assert.rejects(db.exec(candidate),/ALREADY_INSTALLED/);await db.exec('rollback');
  assert.equal((await db.query(`select to_regprocedure('public.admin_mfa_satisfied()') is not null present`)).rows[0].present,true);
 });
 const rollback=await readFile(resolve(root,'supabase/candidates/security_stage_3_admin_mfa_rollback.sql'),'utf8');
 await check('rollback refuses missing operator review',async()=> {await assert.rejects(db.exec(rollback),/ROLLBACK_REVIEW_REQUIRED/);await db.exec('rollback');});
 await check('reviewed rollback restores baseline policies and routines without dropping fixtures',async()=> {
  await db.exec(`set mushavo.admin_mfa_rollback_reviewed='yes'`);await db.exec(rollback);
  assert.equal((await db.query(`select to_regprocedure('public.admin_mfa_status()') is null missing`)).rows[0].missing,true);
  assert.equal((await as(ids[1],'aal1',`select count(*)::int n from families where id=$1`,[family]))[0].n,1);
  assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n,1);
 });
}catch(e){if(!checks.some(c=>c.result==='FAIL'))checks.push({name:'local harness setup/completion',result:'FAIL',error:e.message.slice(0,200)});console.error('LOCAL CHECK FAILED:',e.message);process.exitCode=1;}
finally {
 await db.close();
 const result={stage_step:'3.4.2',scope:'OFFLINE_PGLITE_MODELED_AUTH_STORAGE_GRANTS',hosted_acceptance:false,auth_issued_tokens_or_totp_verified:false,migration_count:migrations.length,candidate_sha256:createHash('sha256').update(candidate).digest('hex'),passed:checks.filter(c=>c.result==='PASS').length,failed:checks.filter(c=>c.result==='FAIL').length,checks};
 if(output)await writeFile(resolve(output),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({passed:result.passed,failed:result.failed,hosted_acceptance:false}));
}
