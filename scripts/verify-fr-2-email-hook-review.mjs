// Actual read-only diagnostic against synthetic catalog fixtures, not the live hook.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
const relative='supabase/diagnostics/security_fr_2_4_email_live_hook_source.sql';
const sql=await readFile(path.join(root,relative),'utf8');
const manifest=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-hook-review-source-manifest.json'),'utf8'));
let sourceFiles=0;
for(const [file,expected]of Object.entries(manifest.file_sha256)){
 assert(!path.isAbsolute(file)&&!file.split('/').includes('..'));
 assert.equal(createHash('sha256').update(await readFile(path.join(root,file))).digest('hex'),expected,'SOURCE_HASH_MISMATCH');sourceFiles++;
}
const {db,migrations}=await localDatabase(process.argv[2],{includeEmailInstaller:true});
const cases=[];let failure=null;
const rows=async(text,params)=>(await db.query(text,params)).rows;
const scalar=async(text,params)=>(await rows(text,params))[0].value;
const md5=text=>createHash('md5').update(text).digest('hex');
const pin='99be20677b456ea8d3be47bdd44fb369';
const body="\nBEGIN\n RAISE EXCEPTION 'HOOK_MUST_NOT_BE_INVOKED';\nEND;\n".padEnd(953,' ');
const fakeSQL=source=>sql.replace(pin,md5(source));
async function state(){return scalar("select md5(jsonb_build_object('functions',(select jsonb_agg(to_jsonb(p) order by oid) from pg_proc p),'hooks',(select jsonb_agg(to_jsonb(e) order by oid) from pg_event_trigger e),'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p),'users',(select count(*) from auth.users),'profiles',(select count(*) from public.profiles))::text) value");}
async function run(source=sql){
 const before=await state(),previous=await scalar("select current_setting('statement_timeout') value");
 const results=await db.exec(source);const output=results.flatMap(x=>x.rows||[]).find(x=>x.email_live_hook_source_review)?.email_live_hook_source_review;
 assert(output);assert.equal(output.transaction_read_only,'on');assert.equal(output.application_rows_read,false);assert.equal(output.application_or_hook_functions_invoked,0);assert.equal(output.installer_invoked,false);assert.equal(output.live_activation_approved,false);assert.equal(output.hosted_acceptance,false);assert.deepEqual(output.findings_closed,[]);
 assert.equal(await state(),before);assert.equal(await scalar("select current_setting('transaction_read_only') value"),'off');assert.equal(await scalar("select current_setting('statement_timeout') value"),previous);
 return output;
}
async function fixture(source){assert(!source.includes('$fixture_body$'));await db.exec("create or replace function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path=pg_catalog as $fixture_body$"+source+'$fixture_body$');}
async function check(title,fn){await fn();cases.push({title,result:'PASS'});}
try{
 await check('The source is read-only and retains the exact prior selector pin, UTC scope and bounded inventory',async()=>{
  assert.equal(migrations.length,55);assert(sql.startsWith('-- Select STAGING dczlddwbtgvfdujgcitb'));assert.equal(sql.split(pin).length,2);assert(sql.includes('BEGIN TRANSACTION READ ONLY;'));assert(sql.endsWith('ROLLBACK;\n'));assert(sql.includes('LIMIT 20'));
 });
 await check('An absent hook returns metadata with no source and does not invoke the dormant installer',async()=>{const result=await run();assert.equal(result.selected_hook,null);assert.equal(result.selected_function_overloads,0);assert.equal(result.result,'HOOK_METADATA_REVIEW_REQUIRED_SOURCE_WITHHELD');assert.equal(result.private_installer_namespace_present,true);assert.equal(result.email_backend_namespace_present,false);});
 await fixture(body);await db.exec("create event trigger ensure_rls on ddl_command_end when tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO') execute function public.rls_auto_enable()");
 await check('A matching-name synthetic hook is withheld by the actual shipped MD5 pin',async()=>{const result=await run();assert.equal(result.selected_hook.pinned_source_returned,false);assert.equal(result.selected_hook.lf_function_body_for_review,null);assert.equal(result.selected_hook.lf_body_bytes,953);});
 await check('Synthetic selector substitution exercises the positive path without invoking the raising fixture',async()=>{const result=await run(fakeSQL(body));assert.equal(result.result,'PINNED_HOOK_SOURCE_RETURNED_FOR_REVIEW');assert.equal(result.selected_hook.pinned_source_returned,true);assert.equal(result.selected_hook.lf_function_body_for_review,body);assert.equal(result.selected_hook.lf_body_sha256,createHash('sha256').update(body).digest('hex'));});
 await check('A changed body fails the same synthetic selector and withholds source',async()=>{await fixture(body.slice(0,-1)+'\n');const result=await run(fakeSQL(body));assert.equal(result.selected_hook.pinned_source_returned,false);assert.equal(result.selected_hook.lf_function_body_for_review,null);await fixture(body);});
 await check('An unexpected function search path withholds otherwise matching source',async()=>{await db.exec('alter function public.rls_auto_enable() set search_path=public,pg_temp');const result=await run(fakeSQL(body));assert.equal(result.selected_hook.lf_function_body_for_review,null);await db.exec('alter function public.rls_auto_enable() set search_path=pg_catalog');});
 await check('An unexpected function owner withholds otherwise matching source',async()=>{await db.exec('create role hook_review_fixture_owner;alter function public.rls_auto_enable() owner to hook_review_fixture_owner');const result=await run(fakeSQL(body));assert.equal(result.selected_hook.lf_function_body_for_review,null);await db.exec('alter function public.rls_auto_enable() owner to postgres;drop role hook_review_fixture_owner');});
 await check('Extra function overloads prevent source release',async()=>{await db.exec("create function public.rls_auto_enable(text) returns void language sql as $$select null::text$$");const result=await run(fakeSQL(body));assert.equal(result.selected_function_overloads,2);assert.equal(result.selected_hook.lf_function_body_for_review,null);await db.exec('drop function public.rls_auto_enable(text)');});
 await check('Additional hook bindings prevent source release',async()=>{await db.exec("create event trigger ensure_rls_extra on ddl_command_end when tag in ('CREATE TABLE') execute function public.rls_auto_enable()");const result=await run(fakeSQL(body));assert.equal(result.selected_hook.lf_function_body_for_review,null);await db.exec('drop event trigger ensure_rls_extra');});
 await check('Credential-like text is withheld even when the local synthetic pin matches',async()=>{const sensitive="\nBEGIN\n-- api_key do-not-emit-this-value\nRETURN;\nEND;\n".padEnd(953,' ');await fixture(sensitive);const result=await run(fakeSQL(sensitive));assert.equal(result.selected_hook.lf_function_body_for_review,null);assert(!JSON.stringify(result).includes('do-not-emit-this-value'));await fixture(body);});
 await check('Oversized body source is withheld even under a matching synthetic selector',async()=>{const oversized=body.padEnd(5000,' ');await fixture(oversized);const result=await run(fakeSQL(oversized));assert.equal(result.selected_hook.lf_body_bytes,5000);assert.equal(result.selected_hook.lf_function_body_for_review,null);await fixture(body);});
 await check('More than 20 hooks return a bounded inventory with an explicit truncation flag',async()=>{for(let i=0;i<20;i++)await db.exec("create event trigger hook_review_extra_"+i+" on ddl_command_end when tag in ('CREATE TABLE') execute function public.rls_auto_enable()");const result=await run(fakeSQL(body));assert.equal(result.event_hook_count,21);assert.equal(result.event_hook_inventory.length,20);assert.equal(result.event_hook_inventory_truncated,true);assert.equal(result.selected_hook.lf_function_body_for_review,null);for(let i=0;i<20;i++)await db.exec('drop event trigger hook_review_extra_'+i);});
 await check('An ordinary API role cannot run the privileged diagnostic and the failure leaves no persistent changes',async()=>{const before=await state();await db.exec('set role authenticated');await assert.rejects(db.exec(sql),/EMAIL_HOOK_REVIEW_REQUIRES_PRIVILEGED_SQL_EDITOR/);await db.exec('rollback;reset role');assert.equal(await state(),before);});
}catch(error){failure={problem_code:'LOCAL_HOOK_SOURCE_DIAGNOSTIC_REVIEW_REQUIRED',last_completed_case:cases.length,error_code:error.code||'LOCAL_CHECK_FAILED'};}
finally{await db.close();}
console.log(JSON.stringify({stage_step:'FR.2.4.E4.12_LIVE_HOOK_SOURCE_REVIEW',result:failure?'LOCAL_READ_ONLY_HOOK_DIAGNOSTIC_REVIEW_REQUIRED':'LOCAL_READ_ONLY_PINNED_HOOK_SOURCE_DIAGNOSTIC_SCOPED_PASS',scope:'ACTUAL_CATALOG_SQL_IN_MODELED_FULL55_DATABASE_WITH_SYNTHETIC_EVENT_HOOKS_NOT_ACTUAL_STAGING_SOURCE',source_parent_commit:'ae2c886f6d14f3fe8ae4cc4a837e2be581c1b6a6',node_version:process.version,migration_count:migrations.length,source_files_SHA256_verified:sourceFiles,diagnostic_SHA256:createHash('sha256').update(sql).digest('hex'),tests:cases.length,pass:cases.length,fail:failure?1:0,cases,failure,positive_expected_MD5_substituted_only_in_memory_for_synthetic_fixture:true,actual_prior_pinned_hook_body_known_or_semantically_reviewed:false,actual_hosted_requests:0,application_hook_or_installer_invocations:0,hosted_SQL_Auth_rows_roles_grants_or_settings_changed:false,live_activation_approved:false,hosted_acceptance:false,findings_closed:[],production_or_native_changed:false,APK_update_deferred:true,exit_code:failure?1:0},null,2));
process.exitCode=failure?1:0;
