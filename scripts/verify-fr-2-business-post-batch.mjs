// Read-only post-batch diagnostic tested against actual ordered source functions/RLS.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
import {localBusinessTransport} from './lib/stage-3-local-business-transport.mjs';
const require=createRequire(import.meta.url);
const {db,migrations}=await localDatabase(process.argv[2]);
const users=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'];
const emails=['audit.owner@example.com','audit.outsider@example.com'];
const adapter=localBusinessTransport(db,users,emails),tests=[];
const test=name=>tests.push({test:name,status:'PASS'});
const sql=await readFile(path.join(root,'supabase/diagnostics/security_fr_2_3_business_post_batch_review.sql'),'utf8');
const whole=async text=>(await db.exec(text)).flatMap(x=>x.rows||[]).find(x=>x.business_post_batch_review)?.business_post_batch_review;
const q=text=>text.slice(text.indexOf('WITH actors AS'),text.lastIndexOf('ROLLBACK;'));
async function capture(){
 const values={};
 for(const {tablename} of (await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows){
  assert.match(tablename,/^[a-z][a-z0-9_]*$/);
  values[tablename]=(await db.query('select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),\'[]\'::jsonb) as value from public."'+tablename+'" x')).rows[0].value;
 }
 values._functions=(await db.query("select jsonb_agg(to_jsonb(p) order by oid) as value from pg_proc p where pronamespace='public'::regnamespace")).rows[0].value;
 values._triggers=(await db.query('select jsonb_agg(to_jsonb(t) order by oid) as value from pg_trigger t')).rows[0].value;
 values._policies=(await db.query('select jsonb_agg(to_jsonb(p) order by oid) as value from pg_policy p')).rows[0].value;
 return values;
}
try{
 await db.exec("set time zone 'UTC'");
 await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)',[users[0],emails[0],users[1],emails[1]]);
 await db.exec(await readFile(path.join(root,'supabase/diagnostics/security_stage_3_family_fixture.sql'),'utf8'));
 for(const [file,expected] of [['check-stage-3-family-api.cjs','STAGING_FAMILY_API_SCOPED_PASS'],['check-stage-3-currency-api.cjs','STAGING_CURRENCY_API_SCOPED_PASS']]){
  await db.exec('begin');const receipt=await require('./'+file).run({fetcher:adapter(null).fetcher,ownerPassword:'LOCAL_DUMMY_OWNER',outsiderPassword:'LOCAL_DUMMY_MEMBER'});
  assert.equal(receipt.result,expected,JSON.stringify(receipt));await db.exec('commit');
 }
 test('Completed Family member-removal and retained manual conversions prepared in local source model');
 await db.exec('begin');
 await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claims',$2,true)",[users[0],JSON.stringify({sub:users[0],email:emails[0],role:'authenticated'})]);
 const personal=(await db.query("select id from public.budget_workspaces where owner_id=$1 and workspace_type='personal'",[users[0]])).rows[0].id;
 await db.query("select public.save_workspace_currency_settings($1,'USD',array['USD'],'USD',true)",[personal]);
 for(let i=0;i<3;i++){
  const item=(await db.query("insert into public.payment_items(owner_id,visibility,created_by,name,amount,currency,recurrence_type,start_date,status,notes) values($1,'personal',$1,$2,1,'USD','once',current_date,'inactive','Local baseline') returning id",[users[0],'LOCAL-POST-BASELINE-'+i])).rows[0].id;
  await db.query("insert into public.payment_records(owner_id,visibility,payment_item_id,period_start,due_date,amount,currency,payment_date,payment_method,recorded_by,notes) values($1,'personal',$2,current_date,current_date,1,'USD',current_date,'Other',$1,'Local baseline')",[users[0],item]);
 }
 await db.exec('commit');
 // Historical orphan shapes modeled only locally with FK restored NOT VALID.
 await db.exec(`alter table public.payment_conversions drop constraint payment_conversions_payment_record_ref_fkey;
 insert into public.payment_conversions(entity_type,entity_id,workspace_id,original_amount,original_currency,reporting_currency,exchange_rate,converted_amount,rate_effective_at,rate_provider,rate_source,is_locked)
 select 'payment_record',gen_random_uuid(),id,1,'USD','USD',1,1,now(),'identity','identity',true from public.budget_workspaces where workspace_type='personal';
 alter table public.payment_conversions add constraint payment_conversions_payment_record_ref_fkey foreign key(payment_record_ref) references public.payment_records(id) on delete cascade not valid;`);
 await db.exec(await readFile(path.join(root,'supabase/diagnostics/security_fr_2_3_business_fixture.sql'),'utf8'));
 await db.exec('begin');
 const primary=(await db.query("select id from public.budget_workspaces where name='AUDIT-S332-BUSINESS-PRIMARY'")).rows[0].id;
 const port=adapter(null).fetcher;
 const rpc=async(name,body)=>port('https://dczlddwbtgvfdujgcitb.supabase.co/rest/v1/rpc/'+name,{method:'POST',headers:{Authorization:'Bearer LOCAL_FAKE_TOKEN_0'},body:JSON.stringify(body)});
 let response=await rpc('save_business_role',{p_workspace_id:primary,p_code:null,p_name:'AUDIT-S333-ROLE',p_description:'Synthetic audit',p_scope_mode:'all',p_permissions:['workspace.view','reports.view'],p_expected_version:null});assert.equal(response.status,200);const old=JSON.parse(await response.text());
 response=await rpc('save_business_role',{p_workspace_id:primary,p_code:old.code,p_name:'AUDIT-S333-ROLE-EDITED',p_description:'Synthetic audit',p_scope_mode:'all',p_permissions:['workspace.view','reports.view'],p_expected_version:1});assert.equal(response.status,200);
 response=await rpc('archive_business_role',{p_workspace_id:primary,p_code:old.code,p_expected_version:2});assert.equal(response.status,204);await db.exec('commit');
 const state=(await db.exec(await readFile(path.join(root,'supabase/diagnostics/security_fr_2_3_business_archive_state_review.sql'),'utf8'))).flatMap(x=>x.rows||[]).find(x=>x.business_archive_state_review).business_archive_state_review;
 const c={role_sha256:state.target_role_details[0].role_row_sha256,permissions_sha256:state.target_role_details[0].permission_rows_sha256,audit_sha256:state.target_audit_rows_sha256};
 await db.exec('begin');const api=adapter(null),batch=await require('./check-stage-3-business-api.cjs').run({fetcher:api.fetcher,ownerPassword:'LOCAL_DUMMY_OWNER',outsiderPassword:'LOCAL_DUMMY_MEMBER',retainedArchive:c});
 assert.equal(batch.result,'STAGING_BUSINESS_API_SCOPED_PASS_WITH_CARRY_FORWARD',JSON.stringify(batch));assert.equal(batch.checks.filter(x=>x.status==='PASS').length,24);assert.equal(batch.checks.filter(x=>x.status==='BLOCKED').length,5);await db.exec('commit');
 await writeFile(path.join(root,'fr34-modeled-api-result.json'),JSON.stringify(batch,null,2)+'\n');
 test('Corrected complete source Business batch committed locally:24 scoped PASS and five unavailable groups retained');
 const before=await capture(),observed=await whole(sql);
 assert.equal(observed.transaction_read_only,'on');assert.equal(observed.matched_business_scopes,2);assert.equal(observed.synthetic_actor_rows_matched,2);
 assert.equal(observed.record_consistency.records_total,5);assert.equal(observed.record_consistency.parent_workspace_mismatches,0);assert.equal(observed.conversion_consistency.payment_record_conversions_total,7);assert.equal(observed.conversion_consistency.conversions_without_record,2);assert.equal(observed.conversion_consistency.record_workspace_mismatches,0);
 test('Full read-only diagnostic preserves five records/seven conversions/two old orphan shapes and zero joined mismatches');
 assert.equal(observed.retained_family_manual_USD1_rows_matching_full_scope,2);assert.equal(observed.reference_FK_validated,false);
 assert.equal(observed.retained_old_role_fingerprint_rows_matched,0);assert.equal(observed.retained_old_permissions_fingerprint_matches,false);assert.equal(observed.retained_old_audit_fingerprint_matches,false);assert.equal(observed.retained_manual_original_column_baseline_matches,false);
 test('Actual hosted fingerprints reject independently generated synthetic rows instead of accepting matching labels');
 const modeled=sql.replace('24ccbd63efe40da23303d3a9c9e866fbcfe83452fa2331cb8ea9444f361a900f',c.role_sha256).replace('fb1812e78849d04b443c3f1de4792873730a5e1199826dddd46c438ef61d9f65',c.permissions_sha256).replace('74cbb242ff9a95d17858459699e5eeb57672b1bec870b33b251539dcee3ce6a2',c.audit_sha256).replace('d707a69847876b25aea7d1ac453b80175affd454712820aa6944fb0d6986ddd3',observed.retained_manual_snapshot_sha256);
 const modeledResult=await whole(modeled);
 assert.equal(modeledResult.retained_old_role_fingerprint_rows_matched,1);assert.equal(modeledResult.retained_old_permissions_fingerprint_matches,true);assert.equal(modeledResult.retained_old_audit_fingerprint_matches,true);assert.equal(modeledResult.retained_manual_original_column_baseline_matches,true);assert.equal(modeledResult.retained_old_role_active_members,0);assert.equal(modeledResult.retained_old_role_pending_invitations,0);
 test('Four local-only substituted fingerprints confirm exact retained rows and unchanged manual original-column projection');
 const [p,s]=modeledResult.business_state;
 assert.deepEqual(p,{fixture:'PRIMARY',workspace_active:true,builtin_roles:6,active_custom_roles:3,archived_custom_roles:2,active_members:1,inactive_members:1,pending_invitations:0,cancelled_invitations:2,accepted_invitations:1,member_overrides:0,approved_claims:1,paid_claims:1,draft_claims:1,draft_budgets:1,reminders_and_fx_disabled_usd:true});
 assert.deepEqual(s,{fixture:'SECONDARY',workspace_active:true,builtin_roles:6,active_custom_roles:0,archived_custom_roles:0,active_members:1,inactive_members:0,pending_invitations:0,cancelled_invitations:0,accepted_invitations:0,member_overrides:0,approved_claims:2,paid_claims:0,draft_claims:0,draft_budgets:0,reminders_and_fx_disabled_usd:true});
 test('Expected primary completed synthetic mutations and pristine secondary aggregates distinguished');
 assert.deepEqual(await capture(),before);test('All public application rows/function/trigger/policy metadata remain unchanged after diagnostic');
 await db.exec('begin');try{
  await db.query('update public.business_roles set version=4 where workspace_id=$1 and code=$2',[primary,old.code]);
  const altered=(await db.query(q(modeled))).rows[0].business_post_batch_review;assert.equal(altered.retained_old_role_fingerprint_rows_matched,0);assert.equal(altered.retained_old_permissions_fingerprint_matches,false);assert.equal(altered.retained_old_audit_fingerprint_matches,false);
  test('Version drift loses exact retained match and fails both dependent fingerprints');
 }finally{await db.exec('rollback');}
 await db.exec('begin;set local role anon');try{await assert.rejects(db.exec(sql),/POST_BATCH_REQUIRES_PRIVILEGED_SQL_EDITOR/);test('Ordinary SQL caller rejected before application row reads');}finally{await db.exec('rollback;reset role');}
 const summary=JSON.stringify(modeledResult);assert(!summary.includes(users[0])&&!summary.includes(emails[0])&&!summary.includes(old.code));assert.equal(modeledResult.application_routines_invoked,0);assert.equal(modeledResult.rows_accounts_settings_or_catalog_changed,false);test('Diagnostic output excludes actor/row identifiers and claims no hosted acceptance or cleanup authorization');
 const receipt={stage_step:'FR.2.3_BUSINESS_POST_BATCH_REVIEW',result:'LOCAL_POST_BATCH_READ_ONLY_DIAGNOSTIC_SCOPED_PASS',source_parent_commit:'972c58f763ae425deecf4f849bcfaf72d563be5c',migration_count:migrations.length,node_version:process.version,tests,local_PASS:tests.length,local_FAIL:0,exit_code:0,synthetic_Auth_Storage_HTTP_used:true,hosted_owner_fingerprints_checked_against_local_rows_fail_closed:true,four_expected_hash_literals_substituted_only_for_positive_local_model:true,SQL_ASCII:! /[^\x00-\x7f]/.test(sql),new_hosted_SQL_or_API_requests:0,hosted_acceptance:false,findings_closed:[]};
 await writeFile(path.join(root,'docs/security-audit/security-fr-2-business-post-batch-local-checks.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
}finally{await db.close();}
