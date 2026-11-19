import path from 'node:path';import {pathToFileURL} from 'node:url';
import {verifyAccountCandidate} from './check-fr-2-cloudflare-account.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{safeCode:code});};
const fieldType=(object,key)=>!Object.hasOwn(object,key)?'ABSENT':object[key]===null?'NULL':Array.isArray(object[key])?'ARRAY':typeof object[key]==='boolean'?'BOOLEAN':typeof object[key]==='object'?'OBJECT':'OTHER';
export function summarizeEnvelope(body){
 const object=body&&typeof body==='object'&&!Array.isArray(body)?body:{};
 const errorsType=fieldType(object,'errors');
 const noErrors=errorsType==='ABSENT'||errorsType==='NULL'||(errorsType==='ARRAY'&&object.errors.length===0);
 return {success_field_type:fieldType(object,'success'),success_is_true:object.success===true,
  errors_field_type:errorsType,error_count:errorsType==='ARRAY'?object.errors.length:null,
  numeric_error_codes:errorsType==='ARRAY'?object.errors.slice(0,10).map(e=>e?.code).filter(n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000000):[],
  error_codes_truncated:errorsType==='ARRAY'&&object.errors.length>10,
  result_field_type:fieldType(object,'result'),
  prior_deployment_success_predicate_passes:object.success===true&&errorsType==='ARRAY'&&object.errors.length===0,
  success_and_no_reported_errors:object.success===true&&noErrors};
}
async function sample(transport,input,label,suffix){
 const summary={endpoint:label,http_status:null,JSON_received:false,problem_code:null};let response;
 try{
  response=await transport('https://api.cloudflare.com/client/v4/accounts/'+input.account+suffix,
   {method:'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+input.token,Accept:'application/json'}});
  summary.http_status=response.status;
  need(/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||''),'UNEXPECTED_RESPONSE_TYPE');
  const reader=response.body?.getReader();need(reader,'MISSING_RESPONSE_BODY');const parts=[];let bytes=0;
  try{for(;;){const{done,value}=await reader.read();if(done)break;bytes+=value.length;need(bytes<=2097152,'RESPONSE_TOO_LARGE');parts.push(value);}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  let body;try{body=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{need(false,'INVALID_JSON_RESPONSE');}
  summary.JSON_received=true;Object.assign(summary,summarizeEnvelope(body));
  return {summary,body,ok:response.status===200&&summary.success_and_no_reported_errors};
 }catch(error){await response?.body?.cancel().catch(()=>{});summary.problem_code=error.safeCode||'NETWORK_OR_RESPONSE_REVIEW_REQUIRED';return {summary,body:null,ok:false};}
}
export async function inspectLimiter(input,{transport=fetch,candidateCheck=verifyAccountCandidate}={}){
 const receipt={stage_step:'FR.2.4.E3.4_LIMITER_READ_ONLY_REVIEW',result:'STAGING_LIMITER_READ_ONLY_METADATA_REVIEW_REQUIRED',
  requests_attempted:0,candidate_hashes_match:false,staging_Pages_project_verified:false,
  target_Worker_present_verified:false,selected_SQLite_namespace_verified:false,
  namespace_inventory_complete:false,workers_dev_and_preview_URLs_disabled_verified:false,
  legacy_namespace_predicate_rejects_current_success_response:false,samples:[],
  upload_deletion_or_settings_write_attempted:false,token_saved_to_disk_or_environment:false,
  account_identifiers_credentials_namespace_IDs_or_response_bodies_printed:false,
  Zoho_file_accessed:false,email_dispatched:false,hosted_acceptance:false,
  production_or_native_changed:false,findings_closed:[],problem_code:null,exit_code:1};
 try{
  need(input&&Object.keys(input).sort().join(',')==='account,candidate,token','INVALID_PRIVATE_INPUT');
  need(typeof input.account==='string'&&/^[a-f0-9]{32}$/.test(input.account),'INVALID_ACCOUNT_ID');
  need(typeof input.token==='string'&&/^[\x21-\x7e]{20,512}$/.test(input.token),'INVALID_TOKEN_INPUT');
  need(typeof input.candidate==='string'&&path.isAbsolute(input.candidate),'INVALID_CANDIDATE_PATH');
  await candidateCheck(input.candidate);receipt.candidate_hashes_match=true;
  const get=async(label,suffix)=>{receipt.requests_attempted++;const result=await sample(transport,input,label,suffix);receipt.samples.push(result.summary);return result;};
  const pages=await get('STAGING_PAGES_PROJECT','/pages/projects/mushavo-budget-staging');
  need(pages.ok&&pages.body.result?.name==='mushavo-budget-staging'&&pages.body.result.subdomain==='mushavo-budget-staging.pages.dev','STAGING_ACCOUNT_CHECK_REVIEW_REQUIRED');
  receipt.staging_Pages_project_verified=true;
  const workers=await get('WORKER_INVENTORY','/workers/scripts');
  receipt.target_Worker_present_verified=!!(workers.ok&&Array.isArray(workers.body.result)&&workers.body.result.some(x=>x?.id==='mushavo-email-rate-staging'));
  const ns=await get('NAMESPACE_INVENTORY','/workers/durable_objects/namespaces?per_page=1000');
  receipt.legacy_namespace_predicate_rejects_current_success_response=!!(ns.ok&&!ns.summary.prior_deployment_success_predicate_passes);
  if(ns.ok&&Array.isArray(ns.body.result)){
   const info=ns.body.result_info;
   receipt.namespace_inventory_complete=!info||(typeof info==='object'&&!Array.isArray(info)&&
    (info.total_pages===undefined||(Number.isInteger(info.total_pages)&&info.total_pages<=1))&&
    (info.total_count===undefined||info.total_count===ns.body.result.length)&&
    (info.count===undefined||info.count===ns.body.result.length));
   const selected=ns.body.result.filter(n=>n?.script==='mushavo-email-rate-staging'&&n.class==='EmailGatewayRateLimiter');
   receipt.selected_SQLite_namespace_verified=receipt.namespace_inventory_complete&&selected.length===1&&selected[0].use_sqlite===true&&typeof selected[0].id==='string'&&selected[0].id.length>0;
  }
  const sub=await get('WORKER_PUBLIC_URL_SETTINGS','/workers/scripts/mushavo-email-rate-staging/subdomain');
  receipt.workers_dev_and_preview_URLs_disabled_verified=!!(sub.ok&&sub.body.result?.enabled===false&&sub.body.result.previews_enabled===false);
  need(receipt.target_Worker_present_verified&&receipt.selected_SQLite_namespace_verified&&receipt.workers_dev_and_preview_URLs_disabled_verified,'SELECTED_REMOTE_METADATA_REVIEW_REQUIRED');
  receipt.result='STAGING_LIMITER_READ_ONLY_SELECTED_METADATA_SCOPED_PASS_NOT_EMAIL_ACCEPTANCE';receipt.exit_code=0;
 }catch(error){receipt.problem_code=error.safeCode||'LOCAL_OR_METADATA_REVIEW_REQUIRED';}
 receipt.checked_UTC=new Date().toISOString();return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let input;try{const parts=[];let bytes=0;for await(const part of process.stdin){bytes+=part.length;need(bytes<=16384,'INVALID_PRIVATE_INPUT');parts.push(part);}input=JSON.parse(Buffer.concat(parts).toString('utf8'));need(input&&typeof input==='object'&&!Array.isArray(input),'INVALID_PRIVATE_INPUT');}
 catch{input=null;console.log(JSON.stringify({stage_step:'FR.2.4.E3.4_LIMITER_READ_ONLY_REVIEW',result:'PRIVATE_INPUT_REVIEW_REQUIRED',requests_attempted:0,upload_deletion_or_settings_write_attempted:false,problem_code:'INVALID_PRIVATE_INPUT',exit_code:1}));process.exitCode=1;}
 if(input){const receipt=await inspectLimiter(input);console.log(JSON.stringify(receipt,null,2));process.exitCode=receipt.exit_code;}
}
