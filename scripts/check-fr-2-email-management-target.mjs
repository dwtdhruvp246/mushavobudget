// Exactly two fixed read-only operations. No arbitrary SQL, URLs or write fallback.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export const targetStage='FR.2.4.E5.9_MANAGEMENT_READ_ONLY_TARGET';
export const targetRef='dczlddwbtgvfdujgcitb';
export const targetQueryURL=new URL('../supabase/diagnostics/security_fr_2_4_email_management_target.sql',import.meta.url);
export const expectedChecks=Object.freeze([
  'selected_routine_count_matches','selected_policy_counts_match',
  'public_table_count_and_rls_match','public_view_invoker_metadata_matches',
  'observed_storage_tables_have_rls','required_auth_and_profile_column_types_present',
  'event_hook_count_matches','email_backend_installer_and_guards_absent'
]);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).sort().join(',')===keys.slice().sort().join(',');
const need=(x,code)=>{if(!x)throw Object.assign(Error(code),{safeCode:code});};
const problems=new Set(['PRIVATE_TOKEN_INPUT_REQUIRED','PROJECT_RESPONSE_REVIEW_REQUIRED','TARGET_PROJECT_MISMATCH',
  'TARGET_DATABASE_HOST_MISMATCH','TARGET_PROJECT_NOT_READY','READ_ONLY_QUERY_RESPONSE_REVIEW_REQUIRED',
  'READ_ONLY_ROLE_OR_TRANSACTION_REVIEW_REQUIRED','CATALOG_BASELINE_REVIEW_REQUIRED','RESPONSE_TOO_LARGE',
  'NETWORK_OR_RESPONSE_REVIEW_REQUIRED']);
export async function checkManagementTarget(input,{transport=fetch}={}){
  const r={stage_step:targetStage,result:'MANAGEMENT_READ_ONLY_TARGET_REVIEW_REQUIRED',requests_attempted:0,
    fixed_staging_project_metadata_matched:false,fixed_staging_database_host_matched:false,
    provider_routed_read_only_catalog_request_confirmed:false,read_only_role_and_transaction_confirmed:false,
    selected_eight_catalog_checks_match:false,checks:{},samples:[],
    future_installation_target_or_privileges_verified:false,full_catalog_fingerprints_or_hook_definitions_verified:false,token_permission_scope_independently_inspected:false,
    arbitrary_SQL_or_general_query_endpoint_used:false,application_rows_read:false,
    application_or_hook_functions_invoked:0,rows_roles_grants_Auth_or_settings_changed:false,
    raw_token_provider_bodies_or_database_identifiers_printed:false,token_saved_to_disk_or_environment:false,
    ZIP_DPAPI_or_saved_application_keys_accessed:false,email_dispatched:false,uploaded_or_deployed:false,
    live_activation_approved:false,hosted_acceptance:false,production_or_native_changed:false,
    APK_update_deferred:true,findings_closed:[],checkpoint:'PRIVATE_INPUT',problem_code:null,exit_code:1};
  try{
    need(exact(input,['token'])&&typeof input.token==='string'&&/^sbp_fc[A-Za-z0-9_-]{20,512}$/.test(input.token),'PRIVATE_TOKEN_INPUT_REQUIRED');
    async function request(label,suffix,method='GET',body){
      r.checkpoint=label;r.requests_attempted++;const sample={endpoint:label,http_status:null,JSON_received:false};r.samples.push(sample);
      const response=await transport('https://api.supabase.com/v1/projects/'+targetRef+suffix,{
        method,redirect:'error',signal:AbortSignal.timeout(20000),
        headers:{Authorization:'Bearer '+input.token,Accept:'application/json','Cache-Control':'no-store',...(body?{'Content-Type':'application/json'}:{})},
        ...(body?{body:JSON.stringify(body)}:{})
      });
      sample.http_status=response.status;
      if(response.status!==(method==='GET'?200:201)){
        await response.body?.cancel();need(false,method==='GET'?'PROJECT_RESPONSE_REVIEW_REQUIRED':'READ_ONLY_QUERY_RESPONSE_REVIEW_REQUIRED');
      }
      need(!response.redirected&&(!response.url||response.url==='https://api.supabase.com/v1/projects/'+targetRef+suffix),'NETWORK_OR_RESPONSE_REVIEW_REQUIRED');
      need(/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||''),'NETWORK_OR_RESPONSE_REVIEW_REQUIRED');
      const reader=response.body?.getReader();need(reader,'NETWORK_OR_RESPONSE_REVIEW_REQUIRED');let size=0;const chunks=[];
      try{for(;;){const{done,value}=await reader.read();if(done)break;size+=value.length;need(size<=65536,'RESPONSE_TOO_LARGE');chunks.push(value);}}
      finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
      let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{need(false,'NETWORK_OR_RESPONSE_REVIEW_REQUIRED');}
      sample.JSON_received=true;return data;
    }
    const project=await request('STAGING_PROJECT_METADATA','');
    need(object(project),'PROJECT_RESPONSE_REVIEW_REQUIRED');
    // ref is the current documented identity. Older metadata used id as the ref.
    need(project.ref===targetRef||(project.ref===undefined&&project.id===targetRef),'TARGET_PROJECT_MISMATCH');
    need(!(typeof project.id==='string'&&/^[a-z]{20}$/.test(project.id)&&project.id!==targetRef),'TARGET_PROJECT_MISMATCH');
    r.fixed_staging_project_metadata_matched=true;
    need(object(project.database)&&project.database.host==='db.'+targetRef+'.supabase.co','TARGET_DATABASE_HOST_MISMATCH');r.fixed_staging_database_host_matched=true;
    need(project.status==='ACTIVE_HEALTHY','TARGET_PROJECT_NOT_READY');
    const query=await readFile(targetQueryURL,'utf8');
    const data=await request('STAGING_FIXED_READ_ONLY_CATALOG','/database/query/read-only','POST',{query});
    need(Array.isArray(data)&&data.length===1&&exact(data[0],['staging_target_preflight'])&&
      exact(data[0].staging_target_preflight,['checks','read_only_role','transaction_read_only']),'READ_ONLY_QUERY_RESPONSE_REVIEW_REQUIRED');
    const result=data[0].staging_target_preflight;r.provider_routed_read_only_catalog_request_confirmed=true;
    need(result.read_only_role===true&&result.transaction_read_only==='on','READ_ONLY_ROLE_OR_TRANSACTION_REVIEW_REQUIRED');r.read_only_role_and_transaction_confirmed=true;
    need(exact(result.checks,expectedChecks)&&Object.values(result.checks).every(x=>typeof x==='boolean'),'READ_ONLY_QUERY_RESPONSE_REVIEW_REQUIRED');
    r.checks=Object.fromEntries(expectedChecks.map(k=>[k,result.checks[k]]));
    need(Object.values(r.checks).every(x=>x===true),'CATALOG_BASELINE_REVIEW_REQUIRED');r.selected_eight_catalog_checks_match=true;
    r.result='PROVIDER_ROUTED_STAGING_READ_ONLY_CATALOG_SCOPED_PASS_NOT_INSTALLATION';r.checkpoint='COMPLETE';r.exit_code=0;
  }catch(error){r.problem_code=problems.has(error?.safeCode)?error.safeCode:'NETWORK_OR_RESPONSE_REVIEW_REQUIRED';}
  r.checked_UTC=new Date().toISOString();return r;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  let result;
  try{
    need(process.argv.length===3&&process.argv[2]==='--private-parent-pipe'&&!process.stdin.isTTY&&!process.stdout.isTTY,'PRIVATE_TOKEN_INPUT_REQUIRED');
    let size=0;const chunks=[];for await(const chunk of process.stdin){size+=chunk.length;need(size<=8192,'PRIVATE_TOKEN_INPUT_REQUIRED');chunks.push(chunk);}
    const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    result=exact(input,['preflight'])&&input.preflight===true
      ?{stage_step:targetStage,result:'PRIVATE_PIPE_PREFLIGHT_PASS',requests_attempted:0,exit_code:0}
      :await checkManagementTarget(input);
  }catch{result={stage_step:targetStage,result:'PRIVATE_MANAGEMENT_INPUT_REVIEW_REQUIRED',requests_attempted:0,problem_code:'PRIVATE_TOKEN_INPUT_REQUIRED',exit_code:1};}
  process.stdout.write(JSON.stringify(result));process.exitCode=result.exit_code;
}
