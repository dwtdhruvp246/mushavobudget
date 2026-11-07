// One explicit staging-only six-secret POST, bounded prechecks and independent readback.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {validateBatchAPacket} from './prepare-fr-2-email-edge-batch-b.mjs';
import {parseStagingConfiguration,batchRef} from './prepare-fr-2-email-edge-batch-a.mjs';
import {assertOrdinaryPath} from './prepare-fr-2-email-edge-package.mjs';
import {readCanonicalPublicZIP,modernWorker} from './prepare-fr-2-email-modern-package.mjs';
import {checkEdgeImpact,sixNames} from './check-fr-2-email-edge-impact.mjs';
export const batchCStage='FR.2.4.E5.16_BATCH_C_STAGING_EDGE_CONFIGURATION_INSTALLATION';
export const batchCZIP='867296b5e71747a15d46c7ed8937484558ea9fcac97cd96c66ddf5dc00c8b9da';
export const installAck='INSTALL_SIX_STAGING_EDGE_CONFIGURATION_VALUES_ONLY';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).sort().join(',')===[...keys].sort().join(',');
const need=(x,code)=>{if(!x)throw Object.assign(Error(code),{safeCode:code});};
const sha=x=>createHash('sha256').update(x).digest('hex');
const endpoint='https://api.supabase.com/v1/projects/'+batchRef;
const currencyURL='https://api.currencyapi.com/v3/status';
const codes=new Set(['BATCH_C_INPUT_REQUIRED','INSTALL_ACKNOWLEDGEMENT_REQUIRED','PRIVATE_TOKEN_INPUT_REQUIRED','LOCAL_CANDIDATE_REVIEW_REQUIRED','FRESH_SOURCE_TARGET_REVIEW_REQUIRED','CONFIGURATION_NAMES_REVIEW_REQUIRED','CONFIGURATION_ALREADY_PRESENT','CURRENCYAPI_STATUS_REVIEW_REQUIRED','CURRENCYAPI_QUOTA_NOT_AVAILABLE','INSTALL_OR_READBACK_REVIEW_REQUIRED','POST_INSTALL_SOURCE_TARGET_REVIEW_REQUIRED','PROVIDER_RESPONSE_REVIEW_REQUIRED','FIXED_REQUEST_REQUIRED']);
function base(){return {stage_step:batchCStage,batch:'C',result:'STAGING_BATCH_C_REVIEW_REQUIRED',
  local_candidate_and_private_pair_verified:false,fresh_source_target_precheck_passed:false,source_target_precheck_problem:null,
  six_configuration_names_absent_before:false,CurrencyAPI_status_HTTP_accepted:false,CurrencyAPI_quota_available:false,
  CurrencyAPI_FX_endpoint_access_verified:false,pre_install_checks_passed:false,secret_write_attempted:false,
  secret_write_HTTP_accepted:false,independent_configuration_name_readback_received:false,
  six_configuration_names_listed_after:false,other_configuration_names_unchanged:false,post_install_source_target_check_passed:false,
  installed_variable_count:0,settings_may_have_changed:false,write_outcome_uncertain:false,
  secret_value_equality_or_runtime_access_verified:false,shared_configuration_runtime_impact_verified:false,
  metadata_snapshot_is_not_a_write_lock:true,token_permission_scope_independently_inspected:false,
  actual_hosted_requests:0,secret_POST_requests:0,application_or_Edge_functions_invoked:0,
  SQL_or_Auth_or_deployment_endpoint_used:false,downloaded_source_executed_or_saved:false,
  raw_provider_bodies_paths_or_private_values_printed:false,email_push_or_FX_dispatched:false,
  uploaded_or_deployed:false,readiness_approved:false,live_activation_approved:false,hosted_acceptance:false,
  production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],samples:[],checked_UTC:null,checkpoint:'PRIVATE_INPUT',problem_code:null,exit_code:1};}
export function checkBatchCLocal(input,{expectedZIP=batchCZIP,expectedWorker=modernWorker}={}){
  const r=base();
  try{
    need(exact(input,['action','packet','candidateZIPPath'])&&input.action==='local'&&typeof input.candidateZIPPath==='string'&&path.isAbsolute(input.candidateZIPPath),'BATCH_C_INPUT_REQUIRED');
    const env=validateBatchAPacket(input.packet);assertOrdinaryPath(input.candidateZIPPath);
    const stat=fs.lstatSync(input.candidateZIPPath);need(stat.isFile()&&stat.size<=8388608,'LOCAL_CANDIDATE_REVIEW_REQUIRED');
    const bytes=fs.readFileSync(input.candidateZIPPath);need(sha(bytes)===expectedZIP,'LOCAL_CANDIDATE_REVIEW_REQUIRED');
    const entries=readCanonicalPublicZIP(bytes),config=parseStagingConfiguration(entries.get('config.js')?.toString('utf8'));
    need(config.vapidPublicKey===env.VAPID_PUBLIC_KEY&&sha(entries.get('_worker.js'))===expectedWorker,'LOCAL_CANDIDATE_REVIEW_REQUIRED');
    r.local_candidate_and_private_pair_verified=true;r.result='LOCAL_BATCH_C_ARTIFACTS_VALIDATED';r.checkpoint='LOCAL_COMPLETE';r.exit_code=0;
  }catch{r.problem_code='LOCAL_CANDIDATE_REVIEW_REQUIRED';}
  return r;
}
async function jsonBody(response){
  need(/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||''),'PROVIDER_RESPONSE_REVIEW_REQUIRED');
  const reader=response.body?.getReader();need(reader,'PROVIDER_RESPONSE_REVIEW_REQUIRED');let size=0;const chunks=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;need(size<=262144,'PROVIDER_RESPONSE_REVIEW_REQUIRED');chunks.push(value);}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{need(false,'PROVIDER_RESPONSE_REVIEW_REQUIRED');}
}
function namesOnly(rows){
  need(Array.isArray(rows)&&rows.length<=256,'CONFIGURATION_NAMES_REVIEW_REQUIRED');const names=[];
  for(const row of rows){need(object(row)&&typeof row.name==='string'&&/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(row.name)&&!names.includes(row.name),'CONFIGURATION_NAMES_REVIEW_REQUIRED');names.push(row.name);}
  // All non-name fields are opaque, including any provider value/digest fields.
  return names.sort();
}
export async function installBatchC(input,{transport=fetch,impactBaseline,expectedZIP=batchCZIP,expectedWorker=modernWorker}={}){
  let r=base();
  try{
    need(exact(input,['action','packet','candidateZIPPath','token','acknowledgement'])&&input.action==='install','BATCH_C_INPUT_REQUIRED');
    need(input.acknowledgement===installAck,'INSTALL_ACKNOWLEDGEMENT_REQUIRED');
    need(typeof input.token==='string'&&/^sbp_fc[A-Za-z0-9_-]{20,512}$/.test(input.token),'PRIVATE_TOKEN_INPUT_REQUIRED');
    r=checkBatchCLocal({action:'local',packet:input.packet,candidateZIPPath:input.candidateZIPPath},{expectedZIP,expectedWorker});
    need(r.exit_code===0,'LOCAL_CANDIDATE_REVIEW_REQUIRED');r.exit_code=1;r.result='STAGING_BATCH_C_REVIEW_REQUIRED';
    async function counted(url,init){
      const suffix=url.startsWith(endpoint)?url.slice(endpoint.length):null;
      const readAllowed=init.method==='GET'&&['','/functions','/functions/submit-enquiry','/functions/submit-enquiry/body','/secrets'].includes(suffix);
      const writeAllowed=init.method==='POST'&&suffix==='/secrets'&&r.pre_install_checks_passed&&r.secret_POST_requests===0;
      const currencyAllowed=url===currencyURL&&init.method==='GET'&&init.headers.apikey===input.packet.env.CURRENCYAPI_API_KEY&&!init.headers.Authorization;
      need((currencyAllowed||(readAllowed||writeAllowed)&&init.headers.Authorization==='Bearer '+input.token)&&r.actual_hosted_requests<16,'FIXED_REQUEST_REQUIRED');
      r.actual_hosted_requests++;if(writeAllowed)r.secret_POST_requests++;
      const sample={endpoint:currencyAllowed?'CURRENCYAPI_STATUS':suffix==='/secrets'?(writeAllowed?'STAGING_INSTALL_SIX_CONFIGURATION_VALUES':'STAGING_CONFIGURATION_NAME_METADATA'):suffix===''?'STAGING_PROJECT_METADATA':suffix.endsWith('/body')?'STAGING_CONTACT_SOURCE':'STAGING_FUNCTION_METADATA',http_status:null};r.samples.push(sample);
      const response=await transport(url,init);sample.http_status=Number.isInteger(response.status)?response.status:null;return response;
    }
    async function secrets(method,body){
      const url=endpoint+'/secrets';const response=await counted(url,{method,redirect:'error',signal:AbortSignal.timeout(12000),headers:{Authorization:'Bearer '+input.token,Accept:'application/json','Cache-Control':'no-store',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
      if(response.redirected||(response.url&&response.url!==url)||response.status!==(method==='POST'?201:200)){await response.body?.cancel();need(false,method==='POST'?'INSTALL_OR_READBACK_REVIEW_REQUIRED':'CONFIGURATION_NAMES_REVIEW_REQUIRED');}
      if(method==='POST'){await response.body?.cancel();return;}
      return namesOnly(await jsonBody(response));
    }
    r.checkpoint='FRESH_SOURCE_AND_TARGET';
    const before=await checkEdgeImpact({token:input.token},{transport:counted,baselineReceipt:impactBaseline});r.source_target_precheck_problem=before.problem_code;
    need(before.exit_code===0&&before.reviewed_contact_artifacts_match&&before.six_names_not_consumed_by_matched_source&&before.selected_functions_absent_before_and_after,'FRESH_SOURCE_TARGET_REVIEW_REQUIRED');r.fresh_source_target_precheck_passed=true;
    r.checkpoint='CONFIGURATION_NAMES_BEFORE';const original=await secrets('GET');
    need(sixNames.every(name=>!original.includes(name)),'CONFIGURATION_ALREADY_PRESENT');r.six_configuration_names_absent_before=true;
    r.checkpoint='CURRENCYAPI_STATUS';
    const response=await counted(currencyURL,{method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),headers:{apikey:input.packet.env.CURRENCYAPI_API_KEY,Accept:'application/json','Cache-Control':'no-store'}});
    if(response.status!==200||response.redirected||(response.url&&response.url!==currencyURL)){await response.body?.cancel();need(false,'CURRENCYAPI_STATUS_REVIEW_REQUIRED');}
    const status=await jsonBody(response);need(object(status)&&object(status.quotas)&&object(status.quotas.month)&&Number.isSafeInteger(status.quotas.month.remaining),'CURRENCYAPI_STATUS_REVIEW_REQUIRED');
    r.CurrencyAPI_status_HTTP_accepted=true;r.CurrencyAPI_quota_available=status.quotas.month.remaining>0||(Number.isSafeInteger(status.quotas.grace?.remaining)&&status.quotas.grace.remaining>0);
    need(r.CurrencyAPI_quota_available,'CURRENCYAPI_QUOTA_NOT_AVAILABLE');r.pre_install_checks_passed=true;
    r.checkpoint='ONE_STAGING_CONFIGURATION_INSTALL';r.secret_write_attempted=true;r.settings_may_have_changed=true;r.write_outcome_uncertain=true;
    let accepted=false;try{await secrets('POST',sixNames.map(name=>({name,value:input.packet.env[name]})));accepted=true;r.secret_write_HTTP_accepted=true;}catch{}
    // Always attempt one independent readback, including after uncertain write responses. Never retry the POST.
    r.checkpoint='INDEPENDENT_CONFIGURATION_NAME_READBACK';const after=await secrets('GET');r.independent_configuration_name_readback_received=true;
    r.six_configuration_names_listed_after=sixNames.every(name=>after.includes(name));
    r.other_configuration_names_unchanged=JSON.stringify(after.filter(name=>!sixNames.includes(name)))===JSON.stringify(original);
    need(accepted&&r.six_configuration_names_listed_after&&r.other_configuration_names_unchanged,'INSTALL_OR_READBACK_REVIEW_REQUIRED');
    r.installed_variable_count=6;r.write_outcome_uncertain=false;
    r.checkpoint='POST_INSTALL_SOURCE_AND_TARGET';const last=await checkEdgeImpact({token:input.token},{transport:counted,baselineReceipt:impactBaseline});
    need(last.exit_code===0&&last.other_function_metadata_SHA256===before.other_function_metadata_SHA256,'POST_INSTALL_SOURCE_TARGET_REVIEW_REQUIRED');r.post_install_source_target_check_passed=true;
    r.result='STAGING_BATCH_C_SIX_CONFIGURATION_NAMES_INSTALLED_AND_READ_BACK_NOT_ACTIVATED';r.checkpoint='COMPLETE';r.exit_code=0;
  }catch(error){r.problem_code=codes.has(error?.safeCode)?error.safeCode:'STAGING_BATCH_C_REVIEW_REQUIRED';}
  r.checked_UTC=new Date().toISOString();return r;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  let r;try{
    need(process.argv.length===3&&process.argv[2]==='--private-parent-pipe'&&!process.stdin.isTTY&&!process.stdout.isTTY,'BATCH_C_INPUT_REQUIRED');
    let size=0;const chunks=[];for await(const chunk of process.stdin){size+=chunk.length;need(size<=65536,'BATCH_C_INPUT_REQUIRED');chunks.push(chunk);}
    const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    r=exact(input,['preflight'])&&input.preflight===true?{...base(),result:'PRIVATE_PIPE_PREFLIGHT_PASS',exit_code:0}:input?.action==='local'?checkBatchCLocal(input):await installBatchC(input);
  }catch{r={...base(),problem_code:'BATCH_C_INPUT_REQUIRED'};}
  process.stdout.write(JSON.stringify(r));process.exitCode=r.exit_code;
}
