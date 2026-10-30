// Fixed READ ONLY catalog/control queries. No registration or activation path.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {contextSQL,privateCatalogSQL,controlQuery,stagingRef} from './lib/email-registration-handoff-sql.mjs';
import {compareCatalog} from './lib/email-registration-catalog-versions.mjs';
export const reviewStage='FR.2.4.E5.19R_READ_ONLY_DORMANT_REGISTRATION_REVIEW';
export const reviewChecks=['selected_278_routine_fingerprint_matches','selected_166_policy_fingerprint_matches',
 'public_table_count_and_rls_match','public_view_invoker_metadata_matches','observed_storage_tables_have_rls',
 'required_auth_and_profile_column_types_present','reviewed_event_hook_metadata_matches',
 'email_backend_installer_and_guards_absent','privileged_origin_matches_installer_context'];
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&isDeepStrictEqual(Object.keys(x).sort(),keys.slice().sort());
const need=(x,code)=>{if(!x)throw Object.assign(Error(code),{safeCode:code});};
const errors=new Set(['PRIVATE_INPUT_REQUIRED','LOCAL_SOURCE_REVIEW_REQUIRED','HTTP_RESPONSE_REVIEW_REQUIRED','RESPONSE_FORMAT_REVIEW_REQUIRED',
 'RESPONSE_TOO_LARGE','TARGET_METADATA_REVIEW_REQUIRED','PRIVILEGED_READ_ONLY_CONTEXT_REQUIRED','SELECTED_BASELINE_REVIEW_REQUIRED',
 'PRIVATE_VERSIONED_CATALOG_REVIEW_REQUIRED','CONTROL_STATE_REVIEW_REQUIRED','CATALOG_CHANGED_DURING_REVIEW','NETWORK_OR_RESPONSE_REVIEW_REQUIRED']);
export async function reviewSQL(){
 const baseline=await readFile(new URL('../supabase/diagnostics/security_fr_2_4_email_pre_activation_reviewed_types.sql',import.meta.url),'utf8');
 const start=baseline.indexOf('WITH routines AS ('),end=baseline.indexOf('\nSELECT jsonb_build_object(',start);
 need(start>=0&&end>start,'LOCAL_SOURCE_REVIEW_REQUIRED');
 return `BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='20s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
${baseline.slice(start,end)}
SELECT jsonb_build_object('context',${contextSQL},'checks',to_jsonb(c),
 'server_version_num',current_setting('server_version_num')::integer,
 'application_guards_absent',to_regnamespace('mushavo_email_auth') IS NULL
  AND NOT EXISTS(SELECT 1 FROM routines WHERE left(name,11)='email_gate_')
  AND NOT EXISTS(SELECT 1 FROM pg_policy WHERE polname='Email verified session required'),
 'private_catalog',${privateCatalogSQL}) AS registration_review FROM checks c;
ROLLBACK;
`;
}
export async function reviewRegistration(input,{transport=fetch}={}){
 const r={stage_step:reviewStage,result:'READ_ONLY_DORMANT_REGISTRATION_REVIEW_REQUIRED',actual_hosted_requests:0,
  fixed_staging_target_before_and_after_verified:false,privileged_read_only_context_verified:false,selected_eight_baseline_checks_passed:false,
  server_version_num:null,server_major:null,reference_basis:null,reference_adjustments:[],original_reference_exact:false,version_reference_exact:false,
  catalog_comparison:[],catalog_observations_agreed:false,checks:{},application_guards_absent_observed:false,
  private_control_rows_aggregated:false,registered_control_verified:false,current_dormant_registration_state_verified:false,
  historical_registration_receipt_remains_unchanged:true,registration_write_attempts:0,activation_or_resume_or_quarantine_invoked:false,
  general_SQL_endpoint_used:true,all_SQL_transactions_explicitly_READ_ONLY:true,application_rows_read_or_written:false,
  application_or_Edge_functions_explicitly_invoked:0,settings_roles_grants_data_secrets_or_deployments_changed:false,
  raw_provider_bodies_SQL_sources_or_unselected_identifiers_printed:false,token_saved_to_disk_or_environment:false,
  ZIP_DPAPI_or_saved_credentials_accessed:false,email_push_or_FX_dispatched:false,metadata_observation_is_not_a_write_lock:true,
  all_catalog_fields_or_real_PostgreSQL_concurrency_verified:false,live_activation_approved:false,hosted_acceptance:false,
  production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],samples:[],checkpoint:'PRIVATE_INPUT',problem_code:null,exit_code:1};
 try{
  need(exact(input,['token'])&&typeof input.token==='string'&&/^sbp_fc[A-Za-z0-9_-]{20,512}$/.test(input.token),'PRIVATE_INPUT_REQUIRED');
  r.checkpoint='LOCAL_SOURCES';let query,base;
  try{query=await reviewSQL();base=JSON.parse(await readFile(new URL('../docs/security-audit/security-fr-2-email-batch-f-private-catalog.json',import.meta.url),'utf8'));}
  catch{need(false,'LOCAL_SOURCE_REVIEW_REQUIRED');}
  async function request(label,suffix,sql){
   r.checkpoint=label;r.actual_hosted_requests++;const sample={endpoint:label,http_status:null};r.samples.push(sample);
   const url='https://api.supabase.com/v1/projects/'+stagingRef+suffix;
   const response=await transport(url,{method:sql?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(30000),
    headers:{Authorization:'Bearer '+input.token,Accept:'application/json','Cache-Control':'no-store',...(sql?{'Content-Type':'application/json'}:{})},
    ...(sql?{body:JSON.stringify({query:sql,read_only:false})}:{})});sample.http_status=response.status;
   need(!response.redirected&&(!response.url||response.url===url),'HTTP_RESPONSE_REVIEW_REQUIRED');
   if(response.status!==(sql?201:200)){await response.body?.cancel();need(false,'HTTP_RESPONSE_REVIEW_REQUIRED');}
   need(/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||''),'RESPONSE_FORMAT_REVIEW_REQUIRED');
   const reader=response.body?.getReader();need(reader,'RESPONSE_FORMAT_REVIEW_REQUIRED');const chunks=[];let size=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;need(size<=131072,'RESPONSE_TOO_LARGE');chunks.push(value);}}
   finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{need(false,'RESPONSE_FORMAT_REVIEW_REQUIRED');}
  }
  async function target(label){const p=await request(label,'');need(object(p)&&object(p.database)&&
   (p.ref===stagingRef||(p.ref===undefined&&p.id===stagingRef))&&!(typeof p.id==='string'&&/^[a-z]{20}$/.test(p.id)&&p.id!==stagingRef)&&
   p.database.host==='db.'+stagingRef+'.supabase.co'&&p.status==='ACTIVE_HEALTHY','TARGET_METADATA_REVIEW_REQUIRED');}
  function row(data,alias,fields){need(Array.isArray(data)&&data.length===1&&exact(data[0],[alias])&&exact(data[0][alias],fields),'RESPONSE_FORMAT_REVIEW_REQUIRED');return data[0][alias];}
  function context(x){need(exact(x,['privileged_origin','transaction_read_only'])&&x.privileged_origin===true&&x.transaction_read_only==='on','PRIVILEGED_READ_ONLY_CONTEXT_REQUIRED');}
  async function observe(label){
   const x=row(await request(label,'/database/query',query),'registration_review',['context','checks','server_version_num','application_guards_absent','private_catalog']);
   context(x.context);need(exact(x.checks,reviewChecks)&&Object.values(x.checks).every(v=>typeof v==='boolean')&&
    Number.isInteger(x.server_version_num)&&x.server_version_num>=100000&&x.server_version_num<1000000&&typeof x.application_guards_absent==='boolean','RESPONSE_FORMAT_REVIEW_REQUIRED');
   return x;
  }
  const baseline=x=>reviewChecks.every(k=>x.checks[k]===(k!=='email_backend_installer_and_guards_absent'))&&x.application_guards_absent===true;
  await target('STAGING_TARGET_BEFORE');const before=await observe('STAGING_CATALOG_BEFORE');
  r.privileged_read_only_context_verified=true;r.server_version_num=before.server_version_num;r.server_major=Math.floor(before.server_version_num/10000);
  const comparison=compareCatalog(base,before.private_catalog,before.server_version_num);
  r.original_reference_exact=comparison.original_reference_exact;r.version_reference_exact=comparison.version_reference_exact;
  r.reference_basis=comparison.version_reference_supported?'EXACT_PINNED_REFERENCE_FOR_POSTGRES_'+r.server_major:'UNSUPPORTED_SERVER_VERSION';
  if(comparison.version_reference_supported&&r.server_major<18)r.reference_adjustments.push('PRE18_FOUR_NOT_NULL_CATALOG_ROWS_ABSENT_COLUMN_NOT_NULL_FLAGS_STILL_EXACT');
  if(comparison.version_reference_supported&&r.server_major<17)r.reference_adjustments.push('PRE17_OWNER_TABLE_ACL_WITHOUT_MAINTAIN_ALL_OTHER_ACLS_STILL_EXACT');
  r.catalog_comparison=comparison.sections;r.checks=before.checks;r.selected_eight_baseline_checks_passed=baseline(before);
  r.application_guards_absent_observed=before.application_guards_absent;
  if(r.version_reference_exact&&r.selected_eight_baseline_checks_passed){
   const c=row(await request('STAGING_REGISTERED_CONTROL','/database/query',controlQuery),'registration_control',['context','state']);
   context(c.context);r.private_control_rows_aggregated=true;
   need(exact(c.state,['row_count','registered_only'])&&c.state.row_count===1&&c.state.registered_only===true,'CONTROL_STATE_REVIEW_REQUIRED');r.registered_control_verified=true;
  }
  const after=await observe('STAGING_CATALOG_AFTER');r.catalog_observations_agreed=isDeepStrictEqual(before,after);
  await target('STAGING_TARGET_AFTER');r.fixed_staging_target_before_and_after_verified=true;
  need(r.catalog_observations_agreed,'CATALOG_CHANGED_DURING_REVIEW');
  need(baseline(before)&&baseline(after),'SELECTED_BASELINE_REVIEW_REQUIRED');
  need(r.version_reference_exact,'PRIVATE_VERSIONED_CATALOG_REVIEW_REQUIRED');need(r.registered_control_verified,'CONTROL_STATE_REVIEW_REQUIRED');
  r.current_dormant_registration_state_verified=true;r.result='READ_ONLY_VERSIONED_DORMANT_REGISTRATION_AND_STATE_SCOPED_PASS';r.checkpoint='COMPLETE';r.exit_code=0;
 }catch(e){r.problem_code=errors.has(e?.safeCode)?e.safeCode:'NETWORK_OR_RESPONSE_REVIEW_REQUIRED';}
 r.checked_UTC=new Date().toISOString();return r;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 let r;
 try{
  need(process.argv.length===3&&process.argv[2]==='--private-parent-pipe'&&!process.stdin.isTTY&&!process.stdout.isTTY,'PRIVATE_INPUT_REQUIRED');
  const chunks=[];let size=0;for await(const chunk of process.stdin){size+=chunk.length;need(size<=8192,'PRIVATE_INPUT_REQUIRED');chunks.push(chunk);}
  const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  r=exact(input,['preflight'])&&input.preflight===true?{stage_step:reviewStage,result:'PRIVATE_PIPE_PREFLIGHT_PASS',actual_hosted_requests:0,exit_code:0}:await reviewRegistration(input);
 }catch{r={stage_step:reviewStage,result:'PRIVATE_READ_ONLY_REVIEW_INPUT_REQUIRED',actual_hosted_requests:0,problem_code:'PRIVATE_INPUT_REQUIRED',exit_code:1};}
 process.stdout.write(JSON.stringify(r));process.exitCode=r.exit_code;
}
