// Read-only rollout preparation. The separate dashboard upload is an owner action.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {readCanonicalPublicZIP,modernWorker} from './prepare-fr-2-email-modern-package.mjs';
import {parseStagingConfiguration} from './prepare-fr-2-email-edge-batch-a.mjs';
import {inspectPagesBaseline,summarizeChannel} from './inspect-fr-2-email-pages.mjs';
export const batchGStage='FR.2.4.E5.20_BATCH_G_FRONTEND_GATEWAY_ROLLOUT_PREPARATION';
export const frontendZIP='867296b5e71747a15d46c7ed8937484558ea9fcac97cd96c66ddf5dc00c8b9da';
const hash=x=>createHash('sha256').update(x).digest('hex');
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&isDeepStrictEqual(Object.keys(x).sort(),keys.slice().sort());
const need=(x,code)=>{if(!x)throw Object.assign(Error(code),{safeCode:code});};
const codes=new Set(['PRIVATE_INPUT_REQUIRED','FRONTEND_ZIP_REVIEW_REQUIRED','FRONTEND_CONFIGURATION_REVIEW_REQUIRED','PAGES_BASELINE_REVIEW_REQUIRED',
 'PAGES_STATIC_DIRECT_UPLOAD_TARGET_REQUIRED','CHANNEL_SETTINGS_OR_SECRET_METADATA_REVIEW_REQUIRED','PROJECT_CHANGED_DURING_REVIEW',
 'HTTP_OR_RESPONSE_REVIEW_REQUIRED','RESPONSE_TOO_LARGE','NETWORK_OR_SOURCE_REVIEW_REQUIRED']);
export function verifyFrontendZIP(filename,{expectedZIP=frontendZIP,expectedWorker=modernWorker}={}){
 need(typeof filename==='string'&&path.isAbsolute(filename),'FRONTEND_ZIP_REVIEW_REQUIRED');
 for(let p=path.resolve(filename);;){need(!fs.lstatSync(p).isSymbolicLink(),'FRONTEND_ZIP_REVIEW_REQUIRED');const parent=path.dirname(p);if(parent===p)break;p=parent;}
 const stat=fs.statSync(filename);need(stat.isFile()&&stat.size>0&&stat.size<=8388608,'FRONTEND_ZIP_REVIEW_REQUIRED');
 const bytes=fs.readFileSync(filename);need(hash(bytes)===expectedZIP,'FRONTEND_ZIP_REVIEW_REQUIRED');
 const entries=readCanonicalPublicZIP(bytes);need(entries.size===44&&entries.has('_headers')&&entries.has('_routes.json')&&entries.has('config.js')&&
  entries.has('app.html')&&entries.has('_worker.js')&&hash(entries.get('_worker.js'))===expectedWorker,'FRONTEND_ZIP_REVIEW_REQUIRED');
 const config=parseStagingConfiguration(entries.get('config.js').toString('utf8'));need(config.vapidPublicKey!=='','FRONTEND_CONFIGURATION_REVIEW_REQUIRED');
 return {files:44,ZIP_SHA256:expectedZIP,Worker_SHA256:expectedWorker};
}
const projectName='mushavo-budget-staging';
const usable=c=>c.configuration_metadata_reported===true&&c.compatibility_date_matches_reviewed===true&&c.always_use_latest_compatibility_date===false&&
 c.fail_open===false&&c.environment_entry_count===16&&c.required_variables.length===16&&
 c.required_variables.filter(v=>v.state==='SECRET_TEXT').length===13&&c.non_secret_staging_markers.length===3&&
 c.non_secret_staging_markers.every(v=>v.state==='MATCH')&&c.limiter_binding==='MATCH'&&c.other_Durable_Object_binding_count===0;
function selectedProject(p){return {name:p.name,subdomain:p.subdomain,source:p.source??null,production_branch:p.production_branch??null,
 canonical_deployment_id:p.canonical_deployment?.id,canonical_uses_functions:p.canonical_deployment?.uses_functions,
 channels:['production','preview'].map(c=>({wrangler_managed:!!p.deployment_configs?.[c]?.wrangler_config_hash}))};}
export async function checkBatchG(input,{transport=fetch,artifactCheck=verifyFrontendZIP}={}){
 const r={stage_step:batchGStage,batch:'G',result:'BATCH_G_ROLLOUT_PREPARATION_REVIEW_REQUIRED',actual_hosted_requests:0,
  retained_Batch_B_ZIP_identity_verified:false,public_files:0,ZIP_SHA256:null,Worker_SHA256:null,frontend_staging_configuration_and_public_push_key_present:false,
  fresh_Pages_limiter_and_namespace_baseline_passed:false,static_unmanaged_staging_project_verified:false,
  both_channels_fixed_date_fail_closed_markers_and_binding_verified:false,both_channels_13_secret_text_names_present:false,
  selected_project_deployment_and_channel_metadata_stable:false,previous_static_deployment_identity_SHA256:null,
  manual_staging_frontend_upload_preflight_passed:false,channels:[],samples:[],
  secret_values_read_or_verified:false,shared_configuration_runtime_impact_verified:false,full_scheduler_or_external_caller_graph_verified:false,
  automatic_upload_or_settings_write_attempted:false,SQL_Auth_or_Edge_endpoint_used:false,application_rows_accessed:false,
  email_push_or_FX_dispatched:false,raw_provider_bodies_credentials_or_account_namespace_deployment_IDs_printed:false,
  token_saved_to_disk_or_environment:false,DPAPI_or_saved_private_credentials_accessed:false,
  metadata_snapshot_is_not_a_write_lock:true,frontend_live_source_or_gateway_runtime_verified:false,
  application_guard_activation_approved:false,live_activation_approved:false,hosted_acceptance:false,
  production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],checkpoint:'PRIVATE_INPUT',problem_code:null,exit_code:1};
 try{
  need(exact(input,['account','token','zip'])&&typeof input.account==='string'&&/^[a-f0-9]{32}$/.test(input.account)&&
   typeof input.token==='string'&&/^[\x21-\x7e]{20,512}$/.test(input.token)&&typeof input.zip==='string'&&path.isAbsolute(input.zip),'PRIVATE_INPUT_REQUIRED');
  r.checkpoint='RETAINED_BATCH_B_ZIP';const a=await artifactCheck(input.zip);need(a.files===44&&a.ZIP_SHA256===frontendZIP&&a.Worker_SHA256===modernWorker,'FRONTEND_ZIP_REVIEW_REQUIRED');
  r.retained_Batch_B_ZIP_identity_verified=true;r.public_files=44;r.ZIP_SHA256=a.ZIP_SHA256;r.Worker_SHA256=a.Worker_SHA256;r.frontend_staging_configuration_and_public_push_key_present=true;
  const endpoint='https://api.cloudflare.com/client/v4/accounts/'+input.account;let before,namespace;
  async function bounded(response){
   need(response.status===200&&!response.redirected&&/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||''),'HTTP_OR_RESPONSE_REVIEW_REQUIRED');
   const reader=response.body?.getReader();need(reader,'HTTP_OR_RESPONSE_REVIEW_REQUIRED');const chunks=[];let size=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;need(size<=2097152,'RESPONSE_TOO_LARGE');chunks.push(value);}}
   finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   let b;try{b=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{need(false,'HTTP_OR_RESPONSE_REVIEW_REQUIRED');}
   need(object(b)&&b.success===true&&(b.errors==null||(Array.isArray(b.errors)&&b.errors.length===0)),'HTTP_OR_RESPONSE_REVIEW_REQUIRED');return b;
  }
  const counted=async(url,options)=>{
   const allowed=['/pages/projects/'+projectName,'/workers/scripts','/workers/durable_objects/namespaces?per_page=1000','/workers/scripts/mushavo-email-rate-staging/subdomain'].map(x=>endpoint+x);
   need(allowed.includes(url)&&options.method==='GET'&&options.redirect==='error'&&options.body===undefined,'PRIVATE_INPUT_REQUIRED');
   r.actual_hosted_requests++;const sample={endpoint:['STAGING_PAGES_BEFORE','WORKER_INVENTORY','NAMESPACE_INVENTORY','LIMITER_PUBLIC_URL_SETTINGS'][allowed.indexOf(url)],http_status:null};r.samples.push(sample);
   const response=await transport(url,options);sample.http_status=response.status;const data=await bounded(response);
   if(url===allowed[0]&&before===undefined)before=data.result;
   if(url===allowed[2]){const rows=data.result;namespace=Array.isArray(rows)?rows.find(x=>x?.script==='mushavo-email-rate-staging'&&x.class==='EmailGatewayRateLimiter')?.id:undefined;}
   return Response.json(data,{status:200});
  };
  r.checkpoint='FRESH_FOUR_GET_PAGES_AND_LIMITER_BASELINE';
  const inspected=await inspectPagesBaseline({account:input.account,token:input.token,candidate:path.dirname(input.zip)},{transport:counted,artifactCheck:async()=>{}});
  need(inspected.exit_code===0&&r.actual_hosted_requests===4,'PAGES_BASELINE_REVIEW_REQUIRED');r.fresh_Pages_limiter_and_namespace_baseline_passed=true;
  need(before?.name===projectName&&before.subdomain===projectName+'.pages.dev'&&before.source==null&&
   before.canonical_deployment?.uses_functions===false&&typeof before.canonical_deployment.id==='string'&&/^[a-f0-9-]{16,64}$/.test(before.canonical_deployment.id)&&
   ['production','preview'].every(c=>object(before.deployment_configs?.[c])&&!before.deployment_configs[c].wrangler_config_hash),'PAGES_STATIC_DIRECT_UPLOAD_TARGET_REQUIRED');
  r.static_unmanaged_staging_project_verified=true;
  need(inspected.channels.length===2&&inspected.channels.every(usable),'CHANNEL_SETTINGS_OR_SECRET_METADATA_REVIEW_REQUIRED');
  r.channels=inspected.channels.map(c=>({environment:c.environment,reviewed_date_matches:c.compatibility_date_matches_reviewed,fail_open:c.fail_open,
   three_markers_match:c.non_secret_staging_markers.every(x=>x.state==='MATCH'),secret_text_names_present:13,limiter_binding_matches:c.limiter_binding==='MATCH'}));
  r.both_channels_fixed_date_fail_closed_markers_and_binding_verified=true;r.both_channels_13_secret_text_names_present=true;
  const pinned=selectedProject(before);r.previous_static_deployment_identity_SHA256=hash(before.canonical_deployment.id);
  r.checkpoint='INDEPENDENT_PAGES_METADATA_AFTER';const sample={endpoint:r.checkpoint,http_status:null};r.samples.push(sample);
  r.actual_hosted_requests++;const response=await transport(endpoint+'/pages/projects/'+projectName,{method:'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+input.token,Accept:'application/json'}});sample.http_status=response.status;
  const after=(await bounded(response)).result;
  need(object(after)&&isDeepStrictEqual(pinned,selectedProject(after))&&['production','preview'].every(c=>usable(summarizeChannel(after.deployment_configs?.[c],c,namespace))),'PROJECT_CHANGED_DURING_REVIEW');
  r.selected_project_deployment_and_channel_metadata_stable=true;
  r.manual_staging_frontend_upload_preflight_passed=true;r.result='BATCH_G_FRONTEND_AND_PAGES_PREFLIGHT_PASS_MANUAL_STAGING_UPLOAD_NEXT';r.checkpoint='COMPLETE';r.exit_code=0;
 }catch(e){r.problem_code=codes.has(e?.safeCode)?e.safeCode:'NETWORK_OR_SOURCE_REVIEW_REQUIRED';}
 r.checked_UTC=new Date().toISOString();return r;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 let r;try{
  need(process.argv.length===3&&process.argv[2]==='--private-parent-pipe'&&!process.stdin.isTTY&&!process.stdout.isTTY,'PRIVATE_INPUT_REQUIRED');
  let size=0;const chunks=[];for await(const chunk of process.stdin){size+=chunk.length;need(size<=16384,'PRIVATE_INPUT_REQUIRED');chunks.push(chunk);}
  const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  r=exact(input,['preflight'])&&input.preflight===true?{stage_step:batchGStage,result:'PRIVATE_PIPE_PREFLIGHT_PASS',actual_hosted_requests:0,exit_code:0}:await checkBatchG(input);
 }catch{r={stage_step:batchGStage,result:'PRIVATE_BATCH_G_INPUT_REVIEW_REQUIRED',actual_hosted_requests:0,problem_code:'PRIVATE_INPUT_REQUIRED',exit_code:1};}
 process.stdout.write(JSON.stringify(r));process.exitCode=r.exit_code;
}
