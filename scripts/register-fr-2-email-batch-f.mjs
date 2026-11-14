// One fixed staging registration attempt; independent readback also follows failure.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {handoffSQL,stagingRef} from './lib/email-registration-handoff-sql.mjs';
export const stage='FR.2.4.E5.19_BATCH_F_DORMANT_STAGING_DATABASE_REGISTRATION';
export const acknowledgement='REGISTER_DORMANT_STAGING_EMAIL_ONLY';
export const checkNames=Object.freeze(['selected_278_routine_fingerprint_matches','selected_166_policy_fingerprint_matches',
 'public_table_count_and_rls_match','public_view_invoker_metadata_matches','observed_storage_tables_have_rls',
 'required_auth_and_profile_column_types_present','reviewed_event_hook_metadata_matches',
 'email_backend_installer_and_guards_absent','privileged_origin_matches_installer_context']);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&isDeepStrictEqual(Object.keys(x).sort(),keys.slice().sort());
const need=(x,code)=>{if(!x)throw Object.assign(Error(code),{safeCode:code});};
const codes=new Set(['PRIVATE_INPUT_REQUIRED','PROJECT_RESPONSE_REVIEW_REQUIRED','TARGET_PROJECT_OR_HOST_MISMATCH',
 'HTTP_RESPONSE_REVIEW_REQUIRED','RESPONSE_FORMAT_REVIEW_REQUIRED','RESPONSE_TOO_LARGE','PRIVILEGED_READ_ONLY_CONTEXT_REQUIRED',
 'SELECTED_BASELINE_REVIEW_REQUIRED','PRIVATE_CATALOG_READBACK_REVIEW_REQUIRED','REGISTERED_CONTROL_READBACK_REVIEW_REQUIRED',
 'NETWORK_OR_RESPONSE_REVIEW_REQUIRED','LOCAL_SOURCE_REVIEW_REQUIRED']);
export async function registerStaging(input,{transport=fetch}={}){
 const r={stage_step:stage,batch:'F',result:'BATCH_F_REGISTRATION_REVIEW_REQUIRED',actual_hosted_requests:0,
  fixed_staging_project_and_host_verified:false,privileged_origin_and_read_only_preflight_verified:false,
  selected_nine_baseline_checks_passed:false,registration_POST_requests:0,registration_HTTP_accepted:false,
  registration_write_outcome_uncertain:false,private_catalog_exact_readback:false,registered_control_readback:false,
  post_registration_eight_baseline_checks_passed:false,post_target_metadata_matched:false,
  registration_committed_state_observed:false,application_guards_absent_observed:false,
  checks:{},samples:[],independent_readback_attempted:false,readback_problem_code:null,
  arbitrary_SQL_or_user_selected_URL_accepted:false,general_write_capable_SQL_endpoint_used:false,
  catalog_transactions_explicitly_read_only:true,application_rows_explicitly_read_or_written:false,
  private_control_rows_aggregated:false,activation_or_resume_or_quarantine_invoked:false,
  application_or_Edge_functions_explicitly_invoked:0,reviewed_DDL_hooks_may_have_run:false,
  private_schema_functions_table_and_ACLs_may_have_changed:false,automatic_write_retry_or_delete_performed:false,
  raw_provider_bodies_SQL_sources_or_credentials_printed:false,token_saved_to_disk_or_environment:false,
  ZIP_DPAPI_or_saved_credentials_accessed:false,Auth_settings_secrets_schedules_or_deployments_changed:false,
  email_push_or_FX_explicitly_dispatched:false,metadata_observation_is_not_a_write_lock:true,
  target_GUC_is_acknowledgement_not_independent_attestation:true,token_scope_independently_inspected:false,
  actual_PostgreSQL_concurrency_verified:false,live_activation_approved:false,hosted_acceptance:false,
  production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],checkpoint:'PRIVATE_INPUT',problem_code:null,exit_code:1};
 let sql,expected;
 const safe=error=>codes.has(error?.safeCode)?error.safeCode:'NETWORK_OR_RESPONSE_REVIEW_REQUIRED';
 try{
  need(exact(input,['token','acknowledgement'])&&input.acknowledgement===acknowledgement&&
   typeof input.token==='string'&&/^sbp_fc[A-Za-z0-9_-]{20,512}$/.test(input.token),'PRIVATE_INPUT_REQUIRED');
  r.checkpoint='LOCAL_SOURCES';
  try{sql=await handoffSQL();expected=JSON.parse(await readFile(new URL('../docs/security-audit/security-fr-2-email-batch-f-private-catalog.json',import.meta.url),'utf8'));}
  catch{need(false,'LOCAL_SOURCE_REVIEW_REQUIRED');}
  async function request(label,suffix,query,{write=false}={}){
   r.checkpoint=label;r.actual_hosted_requests++;
   const sample={endpoint:label,http_status:null};r.samples.push(sample);
   const url='https://api.supabase.com/v1/projects/'+stagingRef+suffix;
   const response=await transport(url,{method:query?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(write?60000:30000),
    headers:{Authorization:'Bearer '+input.token,Accept:'application/json','Cache-Control':'no-store',...(query?{'Content-Type':'application/json'}:{})},
    ...(query?{body:JSON.stringify({query,read_only:false})}:{})});
   sample.http_status=response.status;
   if(write)r.registration_HTTP_accepted=response.status===201;
   need(!response.redirected&&(!response.url||response.url===url),'HTTP_RESPONSE_REVIEW_REQUIRED');
   if(response.status!==(query?201:200)){await response.body?.cancel();need(false,'HTTP_RESPONSE_REVIEW_REQUIRED');}
   need(/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||''),'RESPONSE_FORMAT_REVIEW_REQUIRED');
   const reader=response.body?.getReader();need(reader,'RESPONSE_FORMAT_REVIEW_REQUIRED');let size=0;const chunks=[];
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;need(size<=131072,'RESPONSE_TOO_LARGE');chunks.push(value);}}
   finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}
   catch{need(false,'RESPONSE_FORMAT_REVIEW_REQUIRED');}
  }
  async function metadata(label){
   const p=await request(label,'');need(object(p)&&object(p.database),'PROJECT_RESPONSE_REVIEW_REQUIRED');
   need((p.ref===stagingRef||(p.ref===undefined&&p.id===stagingRef))&&
    !(typeof p.id==='string'&&/^[a-z]{20}$/.test(p.id)&&p.id!==stagingRef)&&
    p.database.host==='db.'+stagingRef+'.supabase.co'&&p.status==='ACTIVE_HEALTHY','TARGET_PROJECT_OR_HOST_MISMATCH');
  }
  function row(data,name,fields){need(Array.isArray(data)&&data.length===1&&exact(data[0],[name])&&exact(data[0][name],fields),'RESPONSE_FORMAT_REVIEW_REQUIRED');return data[0][name];}
  function context(x){need(exact(x,['privileged_origin','transaction_read_only'])&&x.privileged_origin===true&&x.transaction_read_only==='on','PRIVILEGED_READ_ONLY_CONTEXT_REQUIRED');}
  function baseline(x,installed){
   need(exact(x,checkNames)&&Object.values(x).every(v=>typeof v==='boolean'),'RESPONSE_FORMAT_REVIEW_REQUIRED');
   need(checkNames.every(k=>x[k]===(k==='email_backend_installer_and_guards_absent'?!installed:true)),'SELECTED_BASELINE_REVIEW_REQUIRED');
  }
  async function inspect(){
   r.independent_readback_attempted=true;
   const x=row(await request('STAGING_PRIVATE_CATALOG_READBACK','/database/query',sql.readback),'registration_readback',['context','checks','private_catalog']);
   context(x.context);baseline(x.checks,true);r.post_registration_eight_baseline_checks_passed=true;
   need(isDeepStrictEqual(x.private_catalog,expected),'PRIVATE_CATALOG_READBACK_REVIEW_REQUIRED');r.private_catalog_exact_readback=true;
   const c=row(await request('STAGING_REGISTERED_CONTROL_READBACK','/database/query',sql.control),'registration_control',['context','state']);
   r.private_control_rows_aggregated=true;
   context(c.context);need(exact(c.state,['row_count','registered_only'])&&c.state.row_count===1&&c.state.registered_only===true,'REGISTERED_CONTROL_READBACK_REVIEW_REQUIRED');
   r.registered_control_readback=true;
   // The absence baseline becomes false solely because the pinned private schema exists.
   r.application_guards_absent_observed=true;r.registration_committed_state_observed=true;r.registration_write_outcome_uncertain=false;
   await metadata('STAGING_PROJECT_METADATA_AFTER');r.post_target_metadata_matched=true;
  }
  await metadata('STAGING_PROJECT_METADATA_BEFORE');r.fixed_staging_project_and_host_verified=true;
  r.general_write_capable_SQL_endpoint_used=true;
  const pre=row(await request('STAGING_PRIVILEGED_READ_ONLY_PREFLIGHT','/database/query',sql.preflight),'registration_preflight',['context','checks']);
  context(pre.context);r.privileged_origin_and_read_only_preflight_verified=true;
  r.checks=pre.checks;baseline(pre.checks,false);r.selected_nine_baseline_checks_passed=true;
  let writeProblem=null;
  r.registration_POST_requests=1;r.registration_write_outcome_uncertain=true;r.reviewed_DDL_hooks_may_have_run=true;
  r.private_schema_functions_table_and_ACLs_may_have_changed=true;
  try{await request('STAGING_REGISTER_DORMANT_EMAIL','/database/query',sql.write,{write:true});}catch(e){writeProblem=safe(e);}
  try{await inspect();}catch(e){r.readback_problem_code=safe(e);}
  if(writeProblem)need(false,writeProblem);
  if(r.readback_problem_code)need(false,r.readback_problem_code);
  r.result='BATCH_F_DORMANT_STAGING_REGISTRATION_AND_READBACK_SCOPED_PASS';r.checkpoint='COMPLETE';r.exit_code=0;
 }catch(e){r.problem_code=safe(e);}
 r.checked_UTC=new Date().toISOString();return r;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 let result;
 try{
  need(process.argv.length===3&&process.argv[2]==='--private-parent-pipe'&&!process.stdin.isTTY&&!process.stdout.isTTY,'PRIVATE_INPUT_REQUIRED');
  let size=0;const chunks=[];for await(const chunk of process.stdin){size+=chunk.length;need(size<=8192,'PRIVATE_INPUT_REQUIRED');chunks.push(chunk);}
  const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  result=exact(input,['preflight'])&&input.preflight===true?{stage_step:stage,result:'PRIVATE_PIPE_PREFLIGHT_PASS',actual_hosted_requests:0,exit_code:0}:await registerStaging(input);
 }catch{result={stage_step:stage,result:'PRIVATE_BATCH_F_INPUT_REVIEW_REQUIRED',actual_hosted_requests:0,problem_code:'PRIVATE_INPUT_REQUIRED',exit_code:1};}
 process.stdout.write(JSON.stringify(result));process.exitCode=result.exit_code;
}
