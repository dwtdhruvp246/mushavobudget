// Four fixed Cloudflare GETs only. Project environment values never enter a receipt.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';
import {summarizeEnvelope} from './inspect-fr-2-email-limiter.mjs';
const ZIP_SHA='33bee04f34bf564330345ef7c041ca5b52e0222fbab7dd4cbcae1a789f5c6ef1';
const WORKER_SHA='fb089fffe0cabd9be4fb5e8cfed165786ef56dee8cd5209b7be679166ef4ae99';
const stage='FR.2.4.E5.2_PAGES_CONFIGURATION_BASELINE';
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{safeCode:code});};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const own=(value,key)=>object(value)&&Object.hasOwn(value,key);
const same=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const problems=new Set(['INVALID_PRIVATE_INPUT','INVALID_ACCOUNT_ID','INVALID_TOKEN_INPUT','INVALID_CANDIDATE_PATH',
 'ARTIFACT_PATH_REVIEW_REQUIRED','ZIP_IDENTITY_REVIEW_REQUIRED','RECEIPT_IDENTITY_REVIEW_REQUIRED',
 'HTTP_METADATA_REVIEW_REQUIRED','RESPONSE_TYPE_REVIEW_REQUIRED','RESPONSE_TOO_LARGE','INVALID_JSON_RESPONSE',
 'API_METADATA_REVIEW_REQUIRED','STAGING_PROJECT_MISMATCH','WORKER_INVENTORY_REVIEW_REQUIRED',
 'NAMESPACE_INVENTORY_REVIEW_REQUIRED','LIMITER_NAMESPACE_REVIEW_REQUIRED','LIMITER_PUBLIC_URL_REVIEW_REQUIRED',
 'PAGES_CHANNEL_METADATA_REVIEW_REQUIRED']);
export const requiredVariables=Object.freeze(['EMAIL_GATE_MODE','EMAIL_GATE_PROJECT','EMAIL_GATE_ORIGIN',
 'EMAIL_GATE_PEPPERS_JSON','EMAIL_GATE_KEY_VERSION','EMAIL_GATE_RATE_PEPPER','SUPABASE_PUBLISHABLE_KEY',
 'SUPABASE_SERVICE_ROLE_KEY','ZOHO_MAIL_ORIGIN','ZOHO_ACCOUNTS_ORIGIN','ZOHO_ACCOUNT_ID','ZOHO_FROM_ADDRESS',
 'ZOHO_CLIENT_ID','ZOHO_CLIENT_SECRET','ZOHO_REFRESH_TOKEN','ZOHO_TEST_RECIPIENTS_JSON']);
const sensitive=new Set(['EMAIL_GATE_PEPPERS_JSON','EMAIL_GATE_RATE_PEPPER','SUPABASE_SERVICE_ROLE_KEY',
 'ZOHO_CLIENT_SECRET','ZOHO_REFRESH_TOKEN','ZOHO_TEST_RECIPIENTS_JSON']);
function ordinary(location,directory,max=8*1024*1024){
 const full=path.resolve(location),stat=fs.lstatSync(full);
 need(!stat.isSymbolicLink()&&(directory?stat.isDirectory():stat.isFile()&&stat.size>0&&stat.size<=max)&&
  same(fs.realpathSync(full),full),'ARTIFACT_PATH_REVIEW_REQUIRED');return full;
}
export function verifyReviewArtifact(directory,expectedZIP=ZIP_SHA){
 directory=ordinary(directory,true);const zip=ordinary(path.join(directory,'mushavo-email-staging-review.zip'),false);
 need(sha(fs.readFileSync(zip))===expectedZIP,'ZIP_IDENTITY_REVIEW_REQUIRED');
 const receipt=JSON.parse(fs.readFileSync(ordinary(path.join(directory,'preparation-receipt.json'),false,32768),'utf8').replace(/^\uFEFF/,''));
 need(receipt.stage_step==='FR.2.4.E5.1_LOCAL_UPLOAD_CANDIDATE'&&receipt.result==='LOCAL_ADVANCED_MODE_POSIX_ZIP_PREFLIGHT_PASS_NOT_DEPLOYED'&&
  receipt.target_project==='mushavo-budget-staging'&&receipt.target_domain==='mushavo-budget-staging.pages.dev'&&
  receipt.application_source_commit==='5a14f0c61a7ce91e3c3cefa16dc5ba276d11cc18'&&receipt.Worker_SHA256===WORKER_SHA&&
  receipt.ZIP_SHA256===expectedZIP&&same(path.resolve(receipt.ZIP_path),zip)&&receipt.public_files===44&&
  receipt.ZIP_content_hashes_matched===44&&receipt.non_config_asset_hashes_recorded===43&&
  receipt.source_files_SHA256_verified===57&&receipt.selected_public_and_header_source_identities_verified===41&&
  receipt.Windows_dotNET_ZIP_independent_readback_verified===true&&receipt.legacy_JSON_array_probe_count===1&&
  receipt.corrected_JSON_array_probe_count===43&&receipt.do_not_upload_yet===true&&receipt.deployed===false&&receipt.exit_code===0,
  'RECEIPT_IDENTITY_REVIEW_REQUIRED');
}
function complete(rows,info){
 if(!Array.isArray(rows))return false;
 if(info===undefined||info===null)return rows.length<1000;
 return object(info)&&(info.total_pages===undefined||(Number.isInteger(info.total_pages)&&info.total_pages<=1))&&
  (info.total_count===undefined||info.total_count===rows.length)&&(info.count===undefined||info.count===rows.length)&&
  (!object(info.cursors)||!info.cursors.after);
}
function variableState(vars,name){
 if(!object(vars))return 'NOT_REPORTED';if(!own(vars,name))return 'ABSENT';
 const row=vars[name];return row?.type==='secret_text'?'SECRET_TEXT':row?.type==='plain_text'?'PLAIN_TEXT':'OTHER';
}
export function summarizeChannel(config,label,namespaceID){
 const vars=object(config)?config.env_vars:null,bindings=object(config)?config.durable_object_namespaces:null;
 const required=requiredVariables.map(name=>({name,state:variableState(vars,name)}));
 const markers=Object.entries({EMAIL_GATE_MODE:'STAGING_CONTROLLED_ONLY',EMAIL_GATE_PROJECT:'dczlddwbtgvfdujgcitb',EMAIL_GATE_ORIGIN:'https://mushavo-budget-staging.pages.dev'})
  .map(([name,expected])=>{const state=variableState(vars,name);return{name,state:state==='PLAIN_TEXT'?(vars[name].value===expected?'MATCH':'DIFFERENT'):state==='SECRET_TEXT'?'SECRET_VALUE_NOT_INSPECTED':state};});
 let binding='NOT_REPORTED';
 if(object(bindings))binding=!own(bindings,'EMAIL_GATE_LIMITER_NS')?'ABSENT':
  typeof bindings.EMAIL_GATE_LIMITER_NS?.namespace_id==='string'&&bindings.EMAIL_GATE_LIMITER_NS.namespace_id===namespaceID?'MATCH':'DIFFERENT_OR_INVALID';
 return{environment:label,configuration_metadata_reported:object(config),
  compatibility_date_matches_reviewed:typeof config?.compatibility_date==='string'?config.compatibility_date==='2026-07-01':null,
  always_use_latest_compatibility_date:typeof config?.always_use_latest_compatibility_date==='boolean'?config.always_use_latest_compatibility_date:null,
  fail_open:typeof config?.fail_open==='boolean'?config.fail_open:null,
  environment_entry_count:object(vars)?Object.keys(vars).length:null,required_variables:required,
  sensitive_required_variables_in_plaintext:required.filter(x=>sensitive.has(x.name)&&x.state==='PLAIN_TEXT').length,
  non_secret_staging_markers:markers,limiter_binding:binding,other_Durable_Object_binding_count:object(bindings)?Object.keys(bindings).filter(x=>x!=='EMAIL_GATE_LIMITER_NS').length:null};
}
export async function inspectPagesBaseline(input,{transport=fetch,artifactCheck=verifyReviewArtifact}={}){
 const receipt={stage_step:stage,result:'PAGES_CONFIGURATION_BASELINE_REVIEW_REQUIRED',requests_attempted:0,
  verified_local_ZIP_SHA256:null,local_44_file_review_artifact_unchanged:false,staging_Pages_project_in_selected_account:false,
  limiter_Worker_present:false,selected_SQLite_namespace_verified:false,limiter_public_URLs_disabled:false,
  source_control_integration_observed:'NOT_REPORTED',canonical_deployment_uses_functions:null,channels:[],samples:[],
  raw_environment_values_hashes_account_or_namespace_identifiers_printed:false,secret_values_used_or_printed:false,
  token_saved_to_disk_or_environment:false,upload_or_settings_write_attempted:false,Zoho_file_accessed:false,
  actual_email_or_provider_dispatch:false,SQL_or_Auth_requests:0,gateway_configuration_ready_verified:false,
  Supabase_project_selection_independently_verified:false,deployed:false,live_activation_approved:false,
  hosted_acceptance:false,findings_closed:[],production_or_native_changed:false,APK_update_deferred:true,
  checkpoint:'LOCAL_ARTIFACT',problem_code:null,exit_code:1};
 try{
  need(object(input)&&Object.keys(input).sort().join(',')==='account,candidate,token','INVALID_PRIVATE_INPUT');
  need(typeof input.account==='string'&&/^[a-f0-9]{32}$/.test(input.account),'INVALID_ACCOUNT_ID');
  need(typeof input.token==='string'&&/^[\x21-\x7e]{20,512}$/.test(input.token),'INVALID_TOKEN_INPUT');
  need(typeof input.candidate==='string'&&path.isAbsolute(input.candidate),'INVALID_CANDIDATE_PATH');
  await artifactCheck(input.candidate);receipt.local_44_file_review_artifact_unchanged=true;receipt.verified_local_ZIP_SHA256=ZIP_SHA;
  async function get(label,suffix){
   receipt.checkpoint=label;receipt.requests_attempted++;
   const sample={endpoint:label,http_status:null,JSON_received:false};receipt.samples.push(sample);
   const response=await transport('https://api.cloudflare.com/client/v4/accounts/'+input.account+suffix,
    {method:'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+input.token,Accept:'application/json'}});
   sample.http_status=response.status;
   if(response.status!==200){await response.body?.cancel();need(false,'HTTP_METADATA_REVIEW_REQUIRED');}
   if(!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||'')){
    await response.body?.cancel();need(false,'RESPONSE_TYPE_REVIEW_REQUIRED');
   }
   const reader=response.body?.getReader();need(reader,'INVALID_JSON_RESPONSE');let size=0;const parts=[];
   try{for(;;){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;need(size<=2097152,'RESPONSE_TOO_LARGE');parts.push(value);}}
   finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   let body;try{body=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{need(false,'INVALID_JSON_RESPONSE');}
   sample.JSON_received=true;const envelope=summarizeEnvelope(body);
   sample.success=envelope.success_is_true;sample.errors_shape=envelope.errors_field_type;sample.error_count=envelope.error_count;
   need(envelope.success_and_no_reported_errors,'API_METADATA_REVIEW_REQUIRED');return body;
  }
  const pages=(await get('STAGING_PAGES_PROJECT','/pages/projects/mushavo-budget-staging')).result;
  need(pages?.name==='mushavo-budget-staging'&&pages.subdomain==='mushavo-budget-staging.pages.dev','STAGING_PROJECT_MISMATCH');
  receipt.staging_Pages_project_in_selected_account=true;
  receipt.source_control_integration_observed=pages.source==null?'NO_GIT_SOURCE_REPORTED':['github','gitlab'].includes(pages.source?.type)?'GIT_SOURCE_REPORTED':'OTHER';
  receipt.canonical_deployment_uses_functions=typeof pages.canonical_deployment?.uses_functions==='boolean'?pages.canonical_deployment.uses_functions:null;
  const workers=await get('WORKER_INVENTORY','/workers/scripts');
  need(complete(workers.result,workers.result_info)&&workers.result.every(x=>object(x)&&typeof x.id==='string')&&workers.result.some(x=>x.id==='mushavo-email-rate-staging'),'WORKER_INVENTORY_REVIEW_REQUIRED');
  receipt.limiter_Worker_present=true;
  const namespaces=await get('NAMESPACE_INVENTORY','/workers/durable_objects/namespaces?per_page=1000');
  need(complete(namespaces.result,namespaces.result_info),'NAMESPACE_INVENTORY_REVIEW_REQUIRED');
  const selected=namespaces.result.filter(x=>x?.script==='mushavo-email-rate-staging'&&x.class==='EmailGatewayRateLimiter');
  need(selected.length===1&&selected[0].use_sqlite===true&&typeof selected[0].id==='string'&&selected[0].id.length>0,'LIMITER_NAMESPACE_REVIEW_REQUIRED');
  receipt.selected_SQLite_namespace_verified=true;
  const publicURLs=(await get('LIMITER_PUBLIC_URL_SETTINGS','/workers/scripts/mushavo-email-rate-staging/subdomain')).result;
  need(publicURLs?.enabled===false&&publicURLs.previews_enabled===false,'LIMITER_PUBLIC_URL_REVIEW_REQUIRED');receipt.limiter_public_URLs_disabled=true;
  receipt.checkpoint='SUMMARIZE_STAGING_CHANNELS';
  receipt.channels=[summarizeChannel(pages.deployment_configs?.production,'PRODUCTION_CHANNEL_OF_STAGING_PAGES_PROJECT',selected[0].id),
   summarizeChannel(pages.deployment_configs?.preview,'PREVIEW_CHANNEL_OF_STAGING_PAGES_PROJECT',selected[0].id)];
  need(receipt.channels.every(x=>x.configuration_metadata_reported),'PAGES_CHANNEL_METADATA_REVIEW_REQUIRED');
  receipt.result='STAGING_PAGES_CONFIGURATION_BASELINE_COLLECTED_NOT_ROLLOUT_ACCEPTANCE';receipt.exit_code=0;receipt.checkpoint='COMPLETE';
 }catch(error){receipt.problem_code=problems.has(error?.safeCode)?error.safeCode:'LOCAL_OR_METADATA_REVIEW_REQUIRED';}
 receipt.checked_UTC=new Date().toISOString();return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let input;try{const parts=[];let size=0;for await(const part of process.stdin){size+=part.length;need(size<=16384,'INVALID_PRIVATE_INPUT');parts.push(part);}input=JSON.parse(Buffer.concat(parts).toString('utf8'));}
 catch{input=null;}
 const receipt=await inspectPagesBaseline(input);console.log(JSON.stringify(receipt,null,2));process.exitCode=receipt.exit_code;
}
