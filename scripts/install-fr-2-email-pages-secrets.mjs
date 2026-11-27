// One narrowly scoped Cloudflare PATCH, after the actual seven-GET readiness check, then a fresh GET.
// Private values remain in process memory and the HTTPS body. No retries or automatic rollback.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {checkPrivateReadiness} from './check-fr-2-email-private-readiness.mjs';
import {requiredVariables} from './inspect-fr-2-email-pages.mjs';
export const secretStage='FR.2.4.E5.7_STAGING_SECRET_BINDINGS';
export const installAcknowledgement='ADD_13_SECRET_TEXT_BINDINGS_PER_CHANNEL_TO_STAGING_ONLY';
const markers=['EMAIL_GATE_MODE','EMAIL_GATE_PROJECT','EMAIL_GATE_ORIGIN'];
export const secretNames=Object.freeze(requiredVariables.filter(x=>!markers.includes(x)));
const channels=['production','preview'],project='mushavo-budget-staging';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const need=(b,code)=>{if(!b)throw Object.assign(Error(code),{secretCode:code});};
const exact=(x,keys)=>object(x)&&Object.keys(x).sort().join(',')===keys.slice().sort().join(',');
function stable(x){return Array.isArray(x)?x.map(stable):object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;}
const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const codes=new Set(['INSTALL_ACKNOWLEDGEMENT_REQUIRED','FRESH_READINESS_REVIEW_REQUIRED','STATIC_UNMANAGED_STAGING_PROJECT_REQUIRED',
  'EXACT_THREE_MARKER_BASELINE_REQUIRED','SECRET_ONLY_PAYLOAD_REQUIRED','RESPONSE_TYPE_REQUIRED','RESPONSE_TOO_LARGE',
  'RESPONSE_JSON_REQUIRED','PATCH_HTTP_OR_ENVELOPE_REVIEW_REQUIRED','READBACK_HTTP_OR_ENVELOPE_REVIEW_REQUIRED',
  'READBACK_SECRET_METADATA_REVIEW_REQUIRED','CHANNEL_SETTINGS_DRIFT_REVIEW_REQUIRED','PROJECT_METADATA_DRIFT_REVIEW_REQUIRED']);
async function boundedJSON(response){
  if(!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();need(false,'RESPONSE_TYPE_REQUIRED');}
  const reader=response.body?.getReader();need(reader,'RESPONSE_JSON_REQUIRED');let size=0;const parts=[];
  try{for(;;){const{done,value}=await reader.read();if(done)break;size+=value.length;need(size<=2097152,'RESPONSE_TOO_LARGE');parts.push(value);}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{need(false,'RESPONSE_JSON_REQUIRED');}
}
const accepted=b=>object(b)&&b.success===true&&(b.errors===undefined||b.errors===null||(Array.isArray(b.errors)&&b.errors.length===0));
function settingsWithoutNewSecrets(configs){const value=structuredClone(configs);for(const c of channels)for(const n of secretNames)delete value[c].env_vars[n];return value;}
function selectedProject(p){return Object.fromEntries(['id','name','subdomain','production_branch','source','build_config','canonical_deployment','latest_deployment','domains'].filter(k=>Object.hasOwn(p,k)).map(k=>[k,p[k]]));}
export function secretBindingPayload(env){
  need(secretNames.length===13&&requiredVariables.every(n=>typeof env[n]==='string'&&env[n].length>0),'SECRET_ONLY_PAYLOAD_REQUIRED');
  // Include the three exact existing markers unchanged, so map replacement cannot remove them.
  return {deployment_configs:Object.fromEntries(channels.map(c=>[c,{env_vars:Object.fromEntries(requiredVariables.map(n=>[n,{type:markers.includes(n)?'plain_text':'secret_text',value:env[n]}]))}]))};
}
export async function installStagingSecretBindings(input,{transport=fetch,artifactCheck}={}){
  const r={stage_step:secretStage,result:'STAGING_SECRET_BINDINGS_REVIEW_REQUIRED',requests_attempted:0,
    fresh_seven_GET_readiness_passed:false,readiness_problem_code:null,exact_static_unmanaged_project_verified:false,
    only13_new_secrets_and3_unchanged_markers_per_channel_submitted:false,secret_patch_attempted:false,secret_patch_HTTP_accepted:false,
    independent_project_readback_received:false,both_channels_13_secret_text_entries_present:false,
    all_observed_channel_settings_except_new_secret_entries_compared_unchanged:false,
    selected_project_source_build_and_deployment_metadata_compared_unchanged:false,
    secret_values_read_back_or_equality_proven:false,runtime_binding_or_email_delivery_verified:false,
    concurrent_configuration_changes_excluded:false,remote_state_may_require_review:false,
    automatic_retry_or_rollback_attempted:false,private_values_arguments_or_environment_written:false,
    plaintext_secret_file_written:false,raw_responses_credentials_account_or_namespace_identifiers_printed:false,
    uploaded_or_deployed:false,SQL_or_application_routines_invoked:0,Auth_sessions_created:0,email_dispatched:false,
    live_activation_approved:false,hosted_acceptance:false,production_or_native_changed:false,APK_update_deferred:true,
    findings_closed:[],samples:[],channels:[],checkpoint:'INSTALL_ACKNOWLEDGEMENT',problem_code:null,exit_code:1};
  let before;
  try{
    need(exact(input,['account','token','candidate','packet','install_ack'])&&input.install_ack===installAcknowledgement,'INSTALL_ACKNOWLEDGEMENT_REQUIRED');
    const endpoint='https://api.cloudflare.com/client/v4/accounts/'+input.account+'/pages/projects/'+project;
    const counted=async(url,init)=>{
      r.requests_attempted++;const response=await transport(url,init);
      if(r.requests_attempted===1&&url===endpoint&&init.method==='GET'&&response.status===200){
        const body=await boundedJSON(response);before=body.result;return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
      }
      return response;
    };
    r.checkpoint='FRESH_SEVEN_GET_READINESS';
    const ready=await checkPrivateReadiness({account:input.account,token:input.token,candidate:input.candidate,packet:input.packet},
      {transport:counted,...(artifactCheck?{artifactCheck}:{})});
    r.samples.push(...ready.samples);r.readiness_problem_code=ready.problem_code;
    need(ready.exit_code===0&&r.requests_attempted===7,'FRESH_READINESS_REVIEW_REQUIRED');r.fresh_seven_GET_readiness_passed=true;
    need(before?.name===project&&before.subdomain===project+'.pages.dev'&&before.source==null&&before.canonical_deployment?.uses_functions===false&&
      channels.every(c=>object(before.deployment_configs?.[c])&&!before.deployment_configs[c].wrangler_config_hash),'STATIC_UNMANAGED_STAGING_PROJECT_REQUIRED');r.exact_static_unmanaged_project_verified=true;
    need(channels.every(c=>exact(before.deployment_configs[c].env_vars,markers)&&markers.every(n=>same(before.deployment_configs[c].env_vars[n],{type:'plain_text',value:input.packet.env[n]}))),'EXACT_THREE_MARKER_BASELINE_REQUIRED');
    const settings=structuredClone(settingsWithoutNewSecrets(before.deployment_configs)),metadata=structuredClone(selectedProject(before));
    const payload=secretBindingPayload(input.packet.env);
    need(exact(payload,['deployment_configs'])&&exact(payload.deployment_configs,channels)&&channels.every(c=>exact(payload.deployment_configs[c],['env_vars'])&&
      exact(payload.deployment_configs[c].env_vars,requiredVariables)&&requiredVariables.every(n=>same(payload.deployment_configs[c].env_vars[n],{type:markers.includes(n)?'plain_text':'secret_text',value:input.packet.env[n]}))),'SECRET_ONLY_PAYLOAD_REQUIRED');
    r.only13_new_secrets_and3_unchanged_markers_per_channel_submitted=true;
    async function request(label,method,body){
      r.checkpoint=label;const s={endpoint:label,http_status:null,JSON_received:false};r.samples.push(s);
      const response=await counted(endpoint,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+input.token,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
      s.http_status=response.status;
      if(response.status!==200){await response.body?.cancel();need(false,method==='PATCH'?'PATCH_HTTP_OR_ENVELOPE_REVIEW_REQUIRED':'READBACK_HTTP_OR_ENVELOPE_REVIEW_REQUIRED');}
      const b=await boundedJSON(response);s.JSON_received=true;need(accepted(b),method==='PATCH'?'PATCH_HTTP_OR_ENVELOPE_REVIEW_REQUIRED':'READBACK_HTTP_OR_ENVELOPE_REVIEW_REQUIRED');return b.result;
    }
    r.secret_patch_attempted=true;r.remote_state_may_require_review=true;let patchProblem=null,after;
    try{await request('INSTALL_13_SECRET_BINDINGS_PER_CHANNEL','PATCH',payload);r.secret_patch_HTTP_accepted=true;}
    catch(error){patchProblem=codes.has(error?.secretCode)?error.secretCode:'PATCH_HTTP_OR_ENVELOPE_REVIEW_REQUIRED';}
    // A fresh GET is attempted even if the PATCH outcome is uncertain. Never repeat the PATCH.
    after=await request('INDEPENDENT_POST_INSTALL_PROJECT_READBACK','GET');r.independent_project_readback_received=true;
    need(after?.name===project&&after.subdomain===project+'.pages.dev'&&object(after.deployment_configs),'READBACK_SECRET_METADATA_REVIEW_REQUIRED');
    r.channels=channels.map(c=>({environment:c.toUpperCase()+'_CHANNEL_OF_STAGING_PAGES_PROJECT',
      observed_secret_text_count:secretNames.filter(n=>after.deployment_configs[c]?.env_vars?.[n]?.type==='secret_text').length,
      required_variable_count:object(after.deployment_configs[c]?.env_vars)?Object.keys(after.deployment_configs[c].env_vars).length:null}));
    need(channels.every(c=>exact(after.deployment_configs[c]?.env_vars,requiredVariables)&&secretNames.every(n=>object(after.deployment_configs[c].env_vars[n])&&after.deployment_configs[c].env_vars[n].type==='secret_text')),'READBACK_SECRET_METADATA_REVIEW_REQUIRED');
    r.both_channels_13_secret_text_entries_present=true;
    need(same(settings,settingsWithoutNewSecrets(after.deployment_configs)),'CHANNEL_SETTINGS_DRIFT_REVIEW_REQUIRED');r.all_observed_channel_settings_except_new_secret_entries_compared_unchanged=true;
    need(same(metadata,selectedProject(after)),'PROJECT_METADATA_DRIFT_REVIEW_REQUIRED');r.selected_project_source_build_and_deployment_metadata_compared_unchanged=true;
    if(patchProblem)need(false,patchProblem);
    r.remote_state_may_require_review=false;r.result='STAGING_13_SECRET_BINDINGS_PER_CHANNEL_INSTALLED_METADATA_READBACK_NOT_RUNTIME_ACCEPTANCE';r.checkpoint='COMPLETE';r.exit_code=0;
  }catch(error){r.problem_code=codes.has(error?.secretCode)?error.secretCode:'LOCAL_OR_SECRET_INSTALLATION_REVIEW_REQUIRED';}
  r.checked_UTC=new Date().toISOString();return r;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{
    need(process.argv.length===3&&process.argv[2]==='--private-parent-pipe'&&!process.stdin.isTTY&&!process.stdout.isTTY,'INSTALL_ACKNOWLEDGEMENT_REQUIRED');
    let size=0;const parts=[];for await(const p of process.stdin){size+=p.length;need(size<=65536,'INSTALL_ACKNOWLEDGEMENT_REQUIRED');parts.push(p);}const input=JSON.parse(Buffer.concat(parts).toString('utf8'));
    if(exact(input,['preflight'])&&input.preflight===true){console.log(JSON.stringify({stage_step:secretStage,result:'PRIVATE_PIPE_PREFLIGHT_PASS',requests_attempted:0,exit_code:0}));process.exitCode=0;}
    else{const r=await installStagingSecretBindings(input);console.log(JSON.stringify(r));process.exitCode=r.exit_code;}
  }catch{console.log(JSON.stringify({stage_step:secretStage,result:'PRIVATE_INSTALLATION_INPUT_REVIEW_REQUIRED',requests_attempted:0,secret_patch_attempted:false,problem_code:'INSTALL_ACKNOWLEDGEMENT_REQUIRED',exit_code:1}));process.exitCode=1;}
}
