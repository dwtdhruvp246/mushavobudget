// Fixed staging metadata and dedicated read-only SQL; no write or invocation path.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
export const readinessStage='FR.2.4.E5.12_EDGE_CONFIGURATION_AND_SCHEDULER_READINESS';
export const readinessRef='dczlddwbtgvfdujgcitb';
export const readinessFunctions=Object.freeze(['invite-admin-user','invite-business-member','send-test-push','sync-exchange-rates']);
export const customNames=Object.freeze(['APP_ORIGIN','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT','CURRENCYAPI_API_KEY','CURRENCY_SYNC_SECRET']);
export const accessQueryURL=new URL('../supabase/diagnostics/security_fr_2_4_email_edge_scheduler_access.sql',import.meta.url);
export const aggregateQueryURL=new URL('../supabase/diagnostics/security_fr_2_4_email_edge_scheduler_aggregates.sql',import.meta.url);
export const accessBooleanKeys=Object.freeze(['read_only_role','cron_schema_present','cron_job_relation_present','cron_job_table_shape_matches','cron_schema_usage','cron_job_table_select','cron_job_rls_enabled','cron_job_force_rls','role_bypasses_job_rls']);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).sort().join(',')===[...keys].sort().join(',');
const need=(x,code)=>{if(!x)throw Object.assign(Error(code),{safeCode:code});};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const count=x=>Number.isSafeInteger(x)&&x>=0&&x<=100000;
const problems=new Set(['PRIVATE_TOKEN_INPUT_REQUIRED','PROJECT_METADATA_REVIEW_REQUIRED','TARGET_PROJECT_MISMATCH','TARGET_DATABASE_HOST_MISMATCH','TARGET_PROJECT_NOT_READY','FUNCTION_METADATA_REVIEW_REQUIRED','SECRET_NAME_METADATA_REVIEW_REQUIRED','READ_ONLY_SQL_REVIEW_REQUIRED','READ_ONLY_CONTEXT_REVIEW_REQUIRED','RESPONSE_TOO_LARGE','NETWORK_OR_RESPONSE_REVIEW_REQUIRED']);
function functionProjection(rows){
  need(Array.isArray(rows)&&rows.length<=256,'FUNCTION_METADATA_REVIEW_REQUIRED');const names=new Set();
  const projection=rows.map(row=>{
    need(object(row)&&typeof row.slug==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(row.slug)&&!names.has(row.slug)&&
      typeof row.id==='string'&&row.id.length>0&&row.id.length<=256&&typeof row.status==='string'&&row.status.length<=128&&
      Number.isSafeInteger(row.version)&&row.version>=1&&typeof row.verify_jwt==='boolean'&&
      Number.isSafeInteger(row.created_at)&&row.created_at>=0&&Number.isSafeInteger(row.updated_at)&&row.updated_at>=row.created_at,'FUNCTION_METADATA_REVIEW_REQUIRED');
    names.add(row.slug);return {slug:row.slug,id:row.id,status:row.status,version:row.version,verify_jwt:row.verify_jwt,created_at:row.created_at,updated_at:row.updated_at};
  });
  projection.sort((a,b)=>a.slug<b.slug?-1:a.slug>b.slug?1:0);return projection;
}
function single(data,key,keys){
  need(Array.isArray(data)&&data.length===1&&exact(data[0],[key])&&exact(data[0][key],keys),'READ_ONLY_SQL_REVIEW_REQUIRED');
  const r=data[0][key];need(r.read_only_role===true&&r.transaction_read_only==='on','READ_ONLY_CONTEXT_REVIEW_REQUIRED');return r;
}
export async function checkEdgeReadiness(input,{transport=fetch}={}){
  const r={stage_step:readinessStage,result:'STAGING_EDGE_READINESS_OBSERVATION_REVIEW_REQUIRED',requests_attempted:0,
    fixed_staging_project_metadata_matched:false,fixed_staging_database_host_matched:false,
    selected_function_presence:[],selected_functions_still_absent:false,other_function_count:null,other_function_metadata_SHA256:null,
    custom_configuration_names:[],all_six_custom_names_listed:false,
    platform_environment_or_secret_values_verified:false,secret_value_fields_used_printed_or_saved:false,
    scheduler_access:null,scheduler_aggregates:null,scheduler_observation_state:'NOT_REQUESTED',
    scheduler_full_invocation_graph_or_external_callers_verified:false,
    unrelated_function_source_or_shared_configuration_impact_verified:false,
    metadata_snapshot_is_not_a_write_lock:true,token_permission_scope_independently_inspected:false,
    readiness_approved:false,future_installation_target_or_privileges_verified:false,
    general_SQL_or_write_endpoint_used:false,application_rows_read:false,scheduler_rows_aggregated:false,
    application_hook_or_scheduler_functions_explicitly_invoked:0,Edge_functions_invoked:0,
    raw_provider_bodies_unselected_names_or_scheduler_commands_printed:false,
    token_saved_to_disk_or_environment:false,ZIP_DPAPI_or_saved_application_keys_accessed:false,
    settings_roles_grants_data_or_schedules_changed:false,email_push_or_FX_dispatched:false,
    uploaded_or_deployed:false,live_activation_approved:false,hosted_acceptance:false,
    production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],samples:[],checkpoint:'PRIVATE_INPUT',problem_code:null,exit_code:1};
  try{
    need(exact(input,['token'])&&typeof input.token==='string'&&/^sbp_fc[A-Za-z0-9_-]{20,512}$/.test(input.token),'PRIVATE_TOKEN_INPUT_REQUIRED');
    async function request(label,suffix,query){
      r.checkpoint=label;r.requests_attempted++;const sample={endpoint:label,http_status:null,JSON_received:false};r.samples.push(sample);
      const url='https://api.supabase.com/v1/projects/'+readinessRef+suffix;
      const response=await transport(url,{method:query?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(12000),
        headers:{Authorization:'Bearer '+input.token,Accept:'application/json','Cache-Control':'no-store',...(query?{'Content-Type':'application/json'}:{})},...(query?{body:JSON.stringify({query})}:{})});
      sample.http_status=Number.isInteger(response.status)?response.status:null;
      if(response.status!==(query?201:200)){
        await response.body?.cancel();need(false,query?'READ_ONLY_SQL_REVIEW_REQUIRED':suffix==='/functions'?'FUNCTION_METADATA_REVIEW_REQUIRED':suffix==='/secrets'?'SECRET_NAME_METADATA_REVIEW_REQUIRED':'PROJECT_METADATA_REVIEW_REQUIRED');
      }
      if(response.redirected||(response.url&&response.url!==url)||!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||'')){
        await response.body?.cancel();need(false,'NETWORK_OR_RESPONSE_REVIEW_REQUIRED');
      }
      const reader=response.body?.getReader();need(reader,'NETWORK_OR_RESPONSE_REVIEW_REQUIRED');let size=0;const chunks=[];
      try{for(;;){const{done,value}=await reader.read();if(done)break;size+=value.length;need(size<=262144,'RESPONSE_TOO_LARGE');chunks.push(value);}}
      finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
      let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{need(false,'NETWORK_OR_RESPONSE_REVIEW_REQUIRED');}sample.JSON_received=true;return data;
    }
    const p=await request('STAGING_PROJECT_METADATA','');need(object(p),'PROJECT_METADATA_REVIEW_REQUIRED');
    need((p.ref===readinessRef||(p.ref===undefined&&p.id===readinessRef))&&!(typeof p.id==='string'&&/^[a-z]{20}$/.test(p.id)&&p.id!==readinessRef),'TARGET_PROJECT_MISMATCH');r.fixed_staging_project_metadata_matched=true;
    need(object(p.database)&&p.database.host==='db.'+readinessRef+'.supabase.co','TARGET_DATABASE_HOST_MISMATCH');r.fixed_staging_database_host_matched=true;need(p.status==='ACTIVE_HEALTHY','TARGET_PROJECT_NOT_READY');
    const functions=functionProjection(await request('STAGING_FUNCTION_METADATA','/functions'));
    r.selected_function_presence=readinessFunctions.map(slug=>({slug,present:functions.some(f=>f.slug===slug)}));
    r.selected_functions_still_absent=r.selected_function_presence.every(x=>!x.present);
    const others=functions.filter(f=>!readinessFunctions.includes(f.slug));r.other_function_count=others.length;r.other_function_metadata_SHA256=hash(others);
    const secrets=await request('STAGING_CONFIGURATION_NAMES','/secrets');need(Array.isArray(secrets)&&secrets.length<=256,'SECRET_NAME_METADATA_REVIEW_REQUIRED');const names=new Set();
    for(const row of secrets){need(object(row)&&typeof row.name==='string'&&/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(row.name)&&!names.has(row.name),'SECRET_NAME_METADATA_REVIEW_REQUIRED');names.add(row.name);}
    // The provider schema includes a value field. Treat all non-name fields as opaque;
    // do not consume, compare, hash, print or persist them, or assume they are digests.
    r.custom_configuration_names=customNames.map(name=>({name,listed:names.has(name)}));r.all_six_custom_names_listed=r.custom_configuration_names.every(x=>x.listed);
    const access=single(await request('STAGING_SCHEDULER_ACCESS','/database/query/read-only',await readFile(accessQueryURL,'utf8')),'edge_scheduler_access',[...accessBooleanKeys,'transaction_read_only']);
    need(accessBooleanKeys.every(k=>typeof access[k]==='boolean'),'READ_ONLY_SQL_REVIEW_REQUIRED');r.scheduler_access=access;
    if(access.cron_job_relation_present&&access.cron_job_table_shape_matches&&access.cron_schema_usage&&access.cron_job_table_select){
      const aggregate=single(await request('STAGING_VISIBLE_SCHEDULER_AGGREGATES','/database/query/read-only',await readFile(aggregateQueryURL,'utf8')),'edge_scheduler_aggregates',
        ['read_only_role','transaction_read_only','visible_jobs','visible_active_jobs','visible_active_FX_text_matches','all_rows_visible_under_selected_rls_controls','indirect_dynamic_or_external_callers_excluded']);
      need(count(aggregate.visible_jobs)&&count(aggregate.visible_active_jobs)&&count(aggregate.visible_active_FX_text_matches)&&
        aggregate.visible_active_FX_text_matches<=aggregate.visible_active_jobs&&aggregate.visible_active_jobs<=aggregate.visible_jobs&&
        typeof aggregate.all_rows_visible_under_selected_rls_controls==='boolean'&&aggregate.indirect_dynamic_or_external_callers_excluded===false,'READ_ONLY_SQL_REVIEW_REQUIRED');
      r.scheduler_aggregates=aggregate;r.scheduler_rows_aggregated=true;
      r.scheduler_observation_state=aggregate.all_rows_visible_under_selected_rls_controls?'VISIBLE_AGGREGATES_SELECTED_RLS_CONTROLS_ALLOW_ALL_ROWS':'VISIBLE_AGGREGATES_RLS_LIMITED';
    }else r.scheduler_observation_state=!access.cron_job_relation_present?'CRON_JOB_RELATION_NOT_OBSERVED':!access.cron_job_table_shape_matches?'CRON_JOB_SHAPE_REVIEW_REQUIRED':'CRON_JOB_READ_ACCESS_NOT_ESTABLISHED';
    r.result='STAGING_EDGE_CONFIGURATION_AND_SCHEDULER_VISIBILITY_OBSERVED_NOT_READINESS_APPROVAL';r.checkpoint='COMPLETE';r.exit_code=0;
  }catch(error){r.problem_code=problems.has(error?.safeCode)?error.safeCode:'NETWORK_OR_RESPONSE_REVIEW_REQUIRED';}
  r.checked_UTC=new Date().toISOString();return r;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  let r;try{
    need(process.argv.length===3&&process.argv[2]==='--private-parent-pipe'&&!process.stdin.isTTY&&!process.stdout.isTTY,'PRIVATE_TOKEN_INPUT_REQUIRED');
    let size=0;const chunks=[];for await(const chunk of process.stdin){size+=chunk.length;need(size<=8192,'PRIVATE_TOKEN_INPUT_REQUIRED');chunks.push(chunk);}
    const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));r=exact(input,['preflight'])&&input.preflight===true?{stage_step:readinessStage,result:'PRIVATE_PIPE_PREFLIGHT_PASS',requests_attempted:0,exit_code:0}:await checkEdgeReadiness(input);
  }catch{r={stage_step:readinessStage,result:'PRIVATE_EDGE_READINESS_INPUT_REVIEW_REQUIRED',requests_attempted:0,problem_code:'PRIVATE_TOKEN_INPUT_REQUIRED',exit_code:1};}
  process.stdout.write(JSON.stringify(r));process.exitCode=r.exit_code;
}
