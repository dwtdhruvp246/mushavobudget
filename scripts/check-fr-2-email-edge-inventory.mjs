// Fixed staging Management API GETs only. Never invokes an Edge function.
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const inventoryStage='FR.2.4.E5.10_EDGE_METADATA_INVENTORY';
export const inventoryRef='dczlddwbtgvfdujgcitb';
export const selectedFunctions=Object.freeze([
  'invite-admin-user','invite-business-member','send-test-push','sync-exchange-rates'
]);
const base='https://api.supabase.com/v1/projects/'+inventoryRef;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).sort().join(',')===keys.slice().sort().join(',');
const need=(x,code)=>{if(!x)throw Object.assign(Error(code),{safeCode:code});};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const problems=new Set([
  'PRIVATE_TOKEN_INPUT_REQUIRED','PROJECT_METADATA_REVIEW_REQUIRED','TARGET_PROJECT_MISMATCH',
  'TARGET_DATABASE_HOST_MISMATCH','TARGET_PROJECT_NOT_READY','FUNCTION_METADATA_HTTP_REVIEW_REQUIRED',
  'FUNCTION_METADATA_SHAPE_REVIEW_REQUIRED','SELECTED_FUNCTION_MISSING_OR_INACTIVE',
  'OBSERVED_FUNCTION_METADATA_CHANGED','RESPONSE_TOO_LARGE','NETWORK_OR_RESPONSE_REVIEW_REQUIRED'
]);

function selectedMetadata(row,slug){
  need(object(row)&&row.slug===slug&&typeof row.id==='string'&&row.id.length>0&&row.id.length<=256&&
    Number.isSafeInteger(row.version)&&row.version>=1&&typeof row.verify_jwt==='boolean'&&
    Number.isSafeInteger(row.created_at)&&row.created_at>=0&&
    Number.isSafeInteger(row.updated_at)&&row.updated_at>=row.created_at&&
    (row.import_map===undefined||typeof row.import_map==='boolean')&&
    (row.ezbr_sha256===undefined||row.ezbr_sha256===null||row.ezbr_sha256===''||/^[a-fA-F0-9]{64}$/.test(row.ezbr_sha256)),
    'FUNCTION_METADATA_SHAPE_REVIEW_REQUIRED');
  need(row.status==='ACTIVE','SELECTED_FUNCTION_MISSING_OR_INACTIVE');
  // No arbitrary provider strings, paths, names or IDs enter the receipt.
  return {slug,version:row.version,status:'ACTIVE',verify_jwt:row.verify_jwt,
    created_at:row.created_at,updated_at:row.updated_at,
    function_identity_SHA256:hash([inventoryRef,slug,row.id]),
    import_map:row.import_map??null,
    provider_bundle_SHA256:row.ezbr_sha256?row.ezbr_sha256.toLowerCase():null};
}
function fromList(data){
  need(Array.isArray(data)&&data.length<=256,'FUNCTION_METADATA_SHAPE_REVIEW_REQUIRED');
  const seen=new Set();
  for(const row of data){
    need(object(row)&&typeof row.slug==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(row.slug)&&!seen.has(row.slug),
      'FUNCTION_METADATA_SHAPE_REVIEW_REQUIRED');
    seen.add(row.slug);
  }
  return selectedFunctions.map(slug=>{
    const row=data.find(x=>x.slug===slug);
    need(row,'SELECTED_FUNCTION_MISSING_OR_INACTIVE');return selectedMetadata(row,slug);
  });
}
export async function checkEdgeInventory(input,{transport=fetch}={}){
  const r={stage_step:inventoryStage,result:'STAGING_EDGE_METADATA_REVIEW_REQUIRED',requests_attempted:0,
    fixed_staging_project_metadata_matched:false,fixed_staging_database_host_matched:false,
    selected_function_count:4,observed_total_function_count:null,selected_functions:[],
    selected_metadata_agreed_across_list_detail_list:false,selected_metadata_SHA256:null,
    deployment_source_parity_verified:false,previous_deployable_artifacts_retained:false,
    runtime_JWT_or_service_access_verified:false,token_permission_scope_independently_inspected:false,
    future_installation_target_or_privileges_verified:false,
    database_or_SQL_endpoint_used:false,application_rows_read:false,Edge_functions_invoked:0,
    function_bodies_or_secrets_requested:false,raw_provider_bodies_paths_or_identifiers_printed:false,
    token_saved_to_disk_or_environment:false,ZIP_DPAPI_or_saved_application_keys_accessed:false,
    settings_or_deployments_changed:false,email_or_push_dispatched:false,uploaded_or_deployed:false,
    live_activation_approved:false,hosted_acceptance:false,production_or_native_changed:false,
    APK_update_deferred:true,findings_closed:[],samples:[],checkpoint:'PRIVATE_INPUT',problem_code:null,exit_code:1};
  try{
    need(exact(input,['token'])&&typeof input.token==='string'&&/^sbp_fc[A-Za-z0-9_-]{20,512}$/.test(input.token),
      'PRIVATE_TOKEN_INPUT_REQUIRED');
    async function get(label,suffix){
      r.checkpoint=label;r.requests_attempted++;
      const sample={endpoint:label,http_status:null,JSON_received:false};r.samples.push(sample);
      const url=base+suffix;
      const response=await transport(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),
        headers:{Authorization:'Bearer '+input.token,Accept:'application/json','Cache-Control':'no-store'}});
      sample.http_status=Number.isInteger(response.status)?response.status:null;
      if(response.status!==200){await response.body?.cancel();need(false,suffix?'FUNCTION_METADATA_HTTP_REVIEW_REQUIRED':'PROJECT_METADATA_REVIEW_REQUIRED');}
      if(response.redirected||(response.url&&response.url!==url)||
        !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||'')){
        await response.body?.cancel();need(false,'NETWORK_OR_RESPONSE_REVIEW_REQUIRED');
      }
      const reader=response.body?.getReader();need(reader,'NETWORK_OR_RESPONSE_REVIEW_REQUIRED');
      const chunks=[];let size=0;
      try{
        for(;;){const{done,value}=await reader.read();if(done)break;size+=value.length;need(size<=262144,'RESPONSE_TOO_LARGE');chunks.push(value);}
      }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
      let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{need(false,'NETWORK_OR_RESPONSE_REVIEW_REQUIRED');}
      sample.JSON_received=true;return data;
    }
    const p=await get('STAGING_PROJECT_METADATA','');
    need(object(p),'PROJECT_METADATA_REVIEW_REQUIRED');
    need((p.ref===inventoryRef||(p.ref===undefined&&p.id===inventoryRef))&&
      !(typeof p.id==='string'&&/^[a-z]{20}$/.test(p.id)&&p.id!==inventoryRef),'TARGET_PROJECT_MISMATCH');
    r.fixed_staging_project_metadata_matched=true;
    need(object(p.database)&&p.database.host==='db.'+inventoryRef+'.supabase.co','TARGET_DATABASE_HOST_MISMATCH');
    r.fixed_staging_database_host_matched=true;need(p.status==='ACTIVE_HEALTHY','TARGET_PROJECT_NOT_READY');
    const startList=await get('STAGING_FUNCTION_LIST_BEFORE','/functions');
    const start=fromList(startList);r.observed_total_function_count=startList.length;
    for(const [index,slug] of selectedFunctions.entries()){
      const detail=selectedMetadata(await get('SELECTED_FUNCTION_METADATA_'+(index+1),'/functions/'+slug),slug);
      need(JSON.stringify(detail)===JSON.stringify(start[index]),'OBSERVED_FUNCTION_METADATA_CHANGED');
    }
    const endList=await get('STAGING_FUNCTION_LIST_AFTER','/functions');const end=fromList(endList);
    need(JSON.stringify(start)===JSON.stringify(end),'OBSERVED_FUNCTION_METADATA_CHANGED');
    r.selected_functions=end;r.selected_metadata_SHA256=hash(end);
    r.selected_metadata_agreed_across_list_detail_list=true;
    r.result='STAGING_EDGE_METADATA_INVENTORY_SCOPED_PASS_NOT_SOURCE_OR_RECOVERY_ACCEPTANCE';
    r.checkpoint='COMPLETE';r.exit_code=0;
  }catch(error){r.problem_code=problems.has(error?.safeCode)?error.safeCode:'NETWORK_OR_RESPONSE_REVIEW_REQUIRED';}
  r.checked_UTC=new Date().toISOString();return r;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  let r;
  try{
    need(process.argv.length===3&&process.argv[2]==='--private-parent-pipe'&&!process.stdin.isTTY&&!process.stdout.isTTY,'PRIVATE_TOKEN_INPUT_REQUIRED');
    const chunks=[];let size=0;for await(const chunk of process.stdin){size+=chunk.length;need(size<=8192,'PRIVATE_TOKEN_INPUT_REQUIRED');chunks.push(chunk);}
    const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    r=exact(input,['preflight'])&&input.preflight===true
      ?{stage_step:inventoryStage,result:'PRIVATE_PIPE_PREFLIGHT_PASS',requests_attempted:0,exit_code:0}
      :await checkEdgeInventory(input);
  }catch{r={stage_step:inventoryStage,result:'PRIVATE_EDGE_INVENTORY_INPUT_REVIEW_REQUIRED',requests_attempted:0,problem_code:'PRIVATE_TOKEN_INPUT_REQUIRED',exit_code:1};}
  process.stdout.write(JSON.stringify(r));process.exitCode=r.exit_code;
}
