// Private read-only readiness: four fixed Cloudflare GETs and three Auth-settings GETs.
// No sessions, table rows, SQL routines, mail or configuration writes.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {inspectPagesBaseline,requiredVariables} from './inspect-fr-2-email-pages.mjs';
import {readCanonicalPublicZIP,configurationFromZIP,modernWorker} from './prepare-fr-2-email-modern-package.mjs';
import {gatewayFromEnvironment} from '../supabase/functions/_shared/email-verification-gateway.mjs';
export const readinessStage='FR.2.4.E5.6_PRIVATE_READ_ONLY_READINESS';
const target='dczlddwbtgvfdujgcitb',origin='https://mushavo-budget-staging.pages.dev';
const ZIP='cc9815bbd512400cbee3f3a227fdd62b697a19ee643e4458a0db924c24aaae24';
const hash=b=>createHash('sha256').update(b).digest('hex');
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).sort().join(',')===keys.slice().sort().join(',');
const need=(b,code)=>{if(!b)throw Object.assign(Error(code),{safeCode:code});};
const problems=new Set(['PRIVATE_INPUT_REQUIRED','PACKET_SCOPE_REQUIRED','ARTIFACT_IDENTITY_REQUIRED',
  'PAGES_BASELINE_REVIEW_REQUIRED','PAGES_PUBLIC_SETTINGS_DRIFT','EXISTING_GATEWAY_VARIABLES_REQUIRE_REVIEW',
  'NEGATIVE_API_KEY_CONTROL_REVIEW_REQUIRED','PUBLISHABLE_API_KEY_REVIEW_REQUIRED','SECRET_API_KEY_REVIEW_REQUIRED',
  'AUTH_SETTINGS_RESPONSE_REVIEW_REQUIRED','RESPONSE_TOO_LARGE','NETWORK_OR_RESPONSE_REVIEW_REQUIRED']);
function ordinary(value,directory=false,max=8388608){
  const full=path.resolve(value),s=fs.lstatSync(full),real=fs.realpathSync(full),same=process.platform==='win32'?real.toLowerCase()===full.toLowerCase():real===full;
  need(!s.isSymbolicLink()&&same&&(directory?s.isDirectory():s.isFile()&&s.size>0&&s.size<=max),'ARTIFACT_IDENTITY_REQUIRED');return full;
}
export function verifyModernReadinessArtifact(candidate){
  candidate=ordinary(candidate,true);const zip=path.join(candidate,'mushavo-email-modern-review.zip');
  const bytes=fs.readFileSync(ordinary(zip));need(hash(bytes)===ZIP,'ARTIFACT_IDENTITY_REQUIRED');
  const entries=readCanonicalPublicZIP(bytes),config=configurationFromZIP(entries);
  need(hash(entries.get('_worker.js'))===modernWorker,'ARTIFACT_IDENTITY_REQUIRED');
  const r=JSON.parse(fs.readFileSync(ordinary(path.join(candidate,'preparation-receipt.json'),false,32768),'utf8').replace(/^\uFEFF/,''));
  need(r.stage_step==='FR.2.4.E5.5_MODERN_REPLACEMENT_ZIP'&&r.result==='LOCAL_MODERN_ZIP_DOTNET_PREFLIGHT_SCOPED_PASS_NOT_DEPLOYED'&&
    r.target_project==='mushavo-budget-staging'&&r.target_domain==='mushavo-budget-staging.pages.dev'&&r.supabase_project===target&&
    r.Worker_SHA256===modernWorker&&r.ZIP_SHA256===ZIP&&path.resolve(r.ZIP_path)===zip&&r.public_files===44&&
    r.ZIP_content_hashes_matched===44&&r.Windows_dotNET_ZIP_independent_readback_verified===true&&
    r.public_files_except_Worker_byte_identical_to_prior_ZIP===43&&r.only_Worker_changed===true&&r.prior_ZIP_compared_unchanged===true&&
    r.do_not_upload_yet===true&&r.deployed===false&&r.exit_code===0,'ARTIFACT_IDENTITY_REQUIRED');
  return {publishableKey:config.supabasePublishableKey};
}
export function validateReadinessPacket(p){
  need(exact(p,['schema_version','purpose','project','origin','created_UTC','expected_modern_Pages_Worker_SHA256',
    'retained_ZIP_configuration_baseline_SHA256','retained_ZIP_is_configuration_source_only','requires_new_reviewed_Worker_upload','env'])&&
    p.schema_version===1&&p.purpose==='MUSHAVO_STAGING_EMAIL_GATEWAY_CONFIGURATION_ONLY'&&p.project===target&&p.origin===origin&&
    typeof p.created_UTC==='string'&&Number.isFinite(Date.parse(p.created_UTC))&&p.expected_modern_Pages_Worker_SHA256===modernWorker&&
    p.retained_ZIP_configuration_baseline_SHA256==='33bee04f34bf564330345ef7c041ca5b52e0222fbab7dd4cbcae1a789f5c6ef1'&&
    p.retained_ZIP_is_configuration_source_only===true&&p.requires_new_reviewed_Worker_upload===true&&exact(p.env,requiredVariables),'PACKET_SCOPE_REQUIRED');
  const e=p.env;need(Object.values(e).every(x=>typeof x==='string'&&x.length>0&&x.length<=8192)&&
    /^sb_publishable_[A-Za-z0-9_-]{1,512}$/.test(e.SUPABASE_PUBLISHABLE_KEY)&&/^sb_secret_[A-Za-z0-9_-]{1,4096}$/.test(e.SUPABASE_SERVICE_ROLE_KEY)&&
    e.EMAIL_GATE_KEY_VERSION==='v1'&&e.ZOHO_ACCOUNTS_ORIGIN==='https://accounts.zoho.com'&&e.ZOHO_MAIL_ORIGIN==='https://mail.zoho.com'&&
    e.ZOHO_FROM_ADDRESS==='notifications@mushavobudget.com'&&/^[a-f0-9]{64}$/.test(e.EMAIL_GATE_RATE_PEPPER),'PACKET_SCOPE_REQUIRED');
  let peppers,recipients;try{peppers=JSON.parse(e.EMAIL_GATE_PEPPERS_JSON);recipients=JSON.parse(e.ZOHO_TEST_RECIPIENTS_JSON);}catch{need(false,'PACKET_SCOPE_REQUIRED');}
  need(exact(peppers,['v1'])&&peppers.v1!==e.EMAIL_GATE_RATE_PEPPER&&Array.isArray(recipients)&&recipients.length===2&&new Set(recipients).size===2,'PACKET_SCOPE_REQUIRED');
  try{gatewayFromEnvironment({...e,EMAIL_GATE_RATE_LIMITER:{limit(){throw Error('NO_DISPATCH');}}},async()=>{throw Error('NO_DISPATCH');});}catch{need(false,'PACKET_SCOPE_REQUIRED');}
  return e;
}
export async function checkPrivateReadiness(input,{transport=fetch,artifactCheck=verifyModernReadinessArtifact}={}){
  const r={stage_step:readinessStage,result:'PRIVATE_READ_ONLY_READINESS_REVIEW_REQUIRED',requests_attempted:0,
    local_modern_ZIP_and_Windows_receipt_verified:false,private_packet_scope_and_constructor_validated:false,
    retained_public_key_matches_packet:false,staging_Pages_project_in_selected_account:false,
    limiter_Worker_SQLite_namespace_and_disabled_public_URLs_verified:false,both_channels_public_settings_match:false,
    remaining13_gateway_variables_absent_in_both_channels:false,negative_API_key_control_rejected:false,
    publishable_key_accepted_by_staging_Auth_settings:false,modern_secret_key_accepted_by_staging_Auth_settings:false,
    API_key_acceptance_scope:'FIXED_STAGING_AUTH_SETTINGS_WITH_INVALID_KEY_NEGATIVE_CONTROL_ONLY',
    service_role_DB_privileges_or_user_JWT_authorization_verified:false,Zoho_refresh_or_email_delivery_verified:false,
    settings_values_rows_identifiers_credentials_or_hashes_printed:false,credential_packet_changed:false,
    Cloudflare_secrets_SQL_Auth_accounts_or_settings_changed:false,Auth_sessions_created:0,application_routines_invoked:0,
    email_dispatched:false,uploaded_or_deployed:false,live_activation_approved:false,hosted_acceptance:false,
    production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],channels:[],samples:[],
    checkpoint:'PRIVATE_INPUT',problem_code:null,exit_code:1};
  try{
    need(exact(input,['account','token','candidate','packet'])&&typeof input.account==='string'&&/^[a-f0-9]{32}$/.test(input.account)&&
      typeof input.token==='string'&&/^[\x21-\x7e]{20,512}$/.test(input.token)&&typeof input.candidate==='string'&&path.isAbsolute(input.candidate),'PRIVATE_INPUT_REQUIRED');
    const e=validateReadinessPacket(input.packet);r.private_packet_scope_and_constructor_validated=true;
    r.checkpoint='LOCAL_MODERN_ZIP';const artifact=await artifactCheck(input.candidate);r.local_modern_ZIP_and_Windows_receipt_verified=true;
    need(artifact.publishableKey===e.SUPABASE_PUBLISHABLE_KEY,'PACKET_SCOPE_REQUIRED');r.retained_public_key_matches_packet=true;
    r.checkpoint='CLOUDFLARE_METADATA';
    // Reuse only the existing four-GET API inspector. Its historical artifact/ZIP labels are not returned here.
    const pages=await inspectPagesBaseline({account:input.account,token:input.token,candidate:input.candidate},
      {transport,artifactCheck:async()=>{}});
    r.requests_attempted+=pages.requests_attempted;r.samples.push(...pages.samples);
    need(pages.exit_code===0,'PAGES_BASELINE_REVIEW_REQUIRED');r.staging_Pages_project_in_selected_account=pages.staging_Pages_project_in_selected_account;
    r.limiter_Worker_SQLite_namespace_and_disabled_public_URLs_verified=pages.limiter_Worker_present&&pages.selected_SQLite_namespace_verified&&pages.limiter_public_URLs_disabled;
    r.channels=pages.channels.map(c=>({environment:c.environment,reviewed_date_matches:c.compatibility_date_matches_reviewed,
      fail_open:c.fail_open,latest_date_enabled:c.always_use_latest_compatibility_date,
      three_public_markers_match:c.non_secret_staging_markers.every(x=>x.state==='MATCH'),limiter_binding_matches:c.limiter_binding==='MATCH',
      remaining_variable_states:c.required_variables.filter(x=>!['EMAIL_GATE_MODE','EMAIL_GATE_PROJECT','EMAIL_GATE_ORIGIN'].includes(x.name))}));
    need(r.channels.length===2&&r.channels.every(c=>c.reviewed_date_matches===true&&c.fail_open===false&&c.latest_date_enabled===false&&c.three_public_markers_match&&c.limiter_binding_matches),'PAGES_PUBLIC_SETTINGS_DRIFT');
    r.both_channels_public_settings_match=true;
    need(r.channels.every(c=>c.remaining_variable_states.length===13&&c.remaining_variable_states.every(x=>x.state==='ABSENT')),'EXISTING_GATEWAY_VARIABLES_REQUIRE_REVIEW');r.remaining13_gateway_variables_absent_in_both_channels=true;
    async function authSettings(label,key,negative=false){
      r.checkpoint=label;r.requests_attempted++;const s={endpoint:label,http_status:null,JSON_received:false};r.samples.push(s);
      const response=await transport('https://'+target+'.supabase.co/auth/v1/settings',{method:'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:key,Accept:'application/json'}});
      s.http_status=response.status;
      if(negative){await response.body?.cancel();need([401,403].includes(response.status),'NEGATIVE_API_KEY_CONTROL_REVIEW_REQUIRED');return;}
      if(response.status!==200){await response.body?.cancel();need(false,label==='PUBLISHABLE_KEY_SETTINGS'?'PUBLISHABLE_API_KEY_REVIEW_REQUIRED':'SECRET_API_KEY_REVIEW_REQUIRED');}
      if(!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||'')){
        await response.body?.cancel();need(false,'AUTH_SETTINGS_RESPONSE_REVIEW_REQUIRED');
      }
      const reader=response.body?.getReader();need(reader,'AUTH_SETTINGS_RESPONSE_REVIEW_REQUIRED');let size=0;const parts=[];
      try{for(;;){const{done,value}=await reader.read();if(done)break;size+=value.length;need(size<=262144,'RESPONSE_TOO_LARGE');parts.push(value);}}
      finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
      let body;try{body=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{need(false,'AUTH_SETTINGS_RESPONSE_REVIEW_REQUIRED');}
      need(object(body)&&object(body.external)&&typeof body.disable_signup==='boolean','AUTH_SETTINGS_RESPONSE_REVIEW_REQUIRED');s.JSON_received=true;
    }
    await authSettings('INVALID_KEY_NEGATIVE_CONTROL','sb_publishable_READINESS_NEGATIVE_CONTROL_20261020',true);r.negative_API_key_control_rejected=true;
    await authSettings('PUBLISHABLE_KEY_SETTINGS',e.SUPABASE_PUBLISHABLE_KEY);r.publishable_key_accepted_by_staging_Auth_settings=true;
    await authSettings('MODERN_SECRET_KEY_SETTINGS',e.SUPABASE_SERVICE_ROLE_KEY);r.modern_secret_key_accepted_by_staging_Auth_settings=true;
    r.result='STAGING_PRIVATE_KEYS_AND_SELECTED_TARGET_READINESS_SCOPED_PASS_NOT_INSTALLATION';r.exit_code=0;r.checkpoint='COMPLETE';
  }catch(error){r.problem_code=problems.has(error?.safeCode)?error.safeCode:'NETWORK_OR_RESPONSE_REVIEW_REQUIRED';}
  r.checked_UTC=new Date().toISOString();return r;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  let input;try{
    need(process.argv.length===3&&process.argv[2]==='--private-parent-pipe'&&!process.stdin.isTTY&&!process.stdout.isTTY,'PRIVATE_INPUT_REQUIRED');
    let size=0;const parts=[];for await(const part of process.stdin){size+=part.length;need(size<=65536,'PRIVATE_INPUT_REQUIRED');parts.push(part);}input=JSON.parse(Buffer.concat(parts).toString('utf8'));
    if(exact(input,['preflight'])&&input.preflight===true){console.log(JSON.stringify({stage_step:readinessStage,result:'PRIVATE_PIPE_PREFLIGHT_PASS',requests_attempted:0,exit_code:0}));process.exitCode=0;}
    else{const r=await checkPrivateReadiness(input);console.log(JSON.stringify(r));process.exitCode=r.exit_code;}
  }catch{console.log(JSON.stringify({stage_step:readinessStage,result:'PRIVATE_READ_ONLY_INPUT_REVIEW_REQUIRED',requests_attempted:0,problem_code:'PRIVATE_INPUT_REQUIRED',exit_code:1}));process.exitCode=1;}
}
