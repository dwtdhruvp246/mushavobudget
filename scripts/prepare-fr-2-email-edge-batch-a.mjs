// Batch A: local public artifact checks and private candidate validation only.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createECDH,randomBytes} from 'node:crypto';
import {prepareEdgePackage,inspectPreparedPackage,assertOrdinaryPath} from './prepare-fr-2-email-edge-package.mjs';
export const batchStage='FR.2.4.E5.14_BATCH_A_LOCAL_EDGE_CONFIGURATION_PREPARATION';
export const batchRef='dczlddwbtgvfdujgcitb';
export const batchOrigin='https://mushavo-budget-staging.pages.dev';
export const acceptedZIP='cc9815bbd512400cbee3f3a227fdd62b697a19ee643e4458a0db924c24aaae24';
export const acceptedPackage='e1fb82c6001ee4bb8f3d6999f078a028637cf90d912e275fb14ac84774f192a3';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).sort().join(',')===[...keys].sort().join(',');
const need=(x,code)=>{if(!x)throw Object.assign(Error(code),{safeCode:code});};
const safeProblems=new Set(['LOCAL_BATCH_INPUT_REQUIRED','STAGING_CONFIG_REVIEW_REQUIRED','SOURCE_PACKAGE_REVIEW_REQUIRED']);
function base(){return {stage_step:batchStage,batch:'A',result:'LOCAL_BATCH_A_REVIEW_REQUIRED',batch_checks_complete:false,
  fresh_Edge_source_package_verified:false,package_files:0,package_SHA256:null,
  retained_ZIP_staging_configuration_validated:false,retained_frontend_VAPID_key_present:false,
  input_availability:{separate_staging_VAPID_pair:false,CurrencyAPI_key:false},
  VAPID_pair_mathematically_validated:false,VAPID_subject_syntax_validated:false,
  CurrencyAPI_input_syntax_validated:false,CurrencyAPI_provider_validity_verified:false,
  frontend_VAPID_relation:'NOT_CHECKED',frontend_candidate_update_required:false,
  independent_staging_caller_secret_generated:false,configured_variable_count:0,
  existing_private_packets_accessed:false,existing_credentials_rotated:false,
  actual_hosted_requests:0,application_or_Edge_functions_invoked:0,email_push_or_FX_dispatched:false,
  frontend_ZIP_or_runtime_source_modified:false,uploaded_or_deployed:false,settings_or_schedules_changed:false,
  readiness_approved:false,live_activation_approved:false,hosted_acceptance:false,
  production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],input_issues:[],checkpoint:'LOCAL_INPUT',problem_code:null,exit_code:1};}
export function parseStagingConfiguration(text){
  need(typeof text==='string'&&Buffer.byteLength(text,'utf8')<=16384,'STAGING_CONFIG_REVIEW_REQUIRED');
  const m=text.replace(/^\uFEFF/,'').match(/^\s*window\.MUSHAVO_BUDGET_CONFIG\s*=\s*(\{[\s\S]*\})\s*;\s*$/);
  need(m,'STAGING_CONFIG_REVIEW_REQUIRED');let config;try{config=JSON.parse(m[1]);}catch{need(false,'STAGING_CONFIG_REVIEW_REQUIRED');}
  need(exact(config,['supabaseUrl','supabasePublishableKey','vapidPublicKey'])&&config.supabaseUrl==='https://'+batchRef+'.supabase.co'&&typeof config.supabasePublishableKey==='string'&&/^sb_publishable_[A-Za-z0-9_-]{1,512}$/.test(config.supabasePublishableKey)&&typeof config.vapidPublicKey==='string'&&config.vapidPublicKey.length<=128,'STAGING_CONFIG_REVIEW_REQUIRED');
  if(config.vapidPublicKey!=='')decodeKey(config.vapidPublicKey,65);
  return config;
}
function decodeKey(text,size){
  need(typeof text==='string'&&/^[A-Za-z0-9_-]+$/.test(text),'STAGING_CONFIG_REVIEW_REQUIRED');
  const bytes=Buffer.from(text,'base64url');need(bytes.length===size&&bytes.toString('base64url')===text&&(size!==65||bytes[0]===4),'STAGING_CONFIG_REVIEW_REQUIRED');return bytes;
}
export function validateVAPIDPair(vapid){
  if(!exact(vapid,['publicKey','privateKey','subject']))return false;
  let privateBytes;
  try{
    const publicBytes=decodeKey(vapid.publicKey,65);privateBytes=decodeKey(vapid.privateKey,32);
    const curve=createECDH('prime256v1');curve.setPrivateKey(privateBytes);return curve.getPublicKey().equals(publicBytes);
  }catch{return false;}finally{privateBytes?.fill(0);}
}
function validSubject(value){
  if(typeof value!=='string'||value.length<1||value.length>512||/[\x00-\x20\x7f]/.test(value))return false;
  if(value.startsWith('mailto:'))return /^[A-Za-z0-9.!#$&'*+/=^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(value.slice(7));
  try{const u=new URL(value);return u.protocol==='https:'&&u.hostname.length>0&&!u.username&&!u.password&&!u.search&&!u.hash;}catch{return false;}
}
function publicArtifacts(sourceRoot){
  try{
    const directory=path.join(sourceRoot,'batch-a-edge-source');assertOrdinaryPath(directory);
    const snapshot=fs.existsSync(directory)?inspectPreparedPackage(directory,{sourceRoot}):prepareEdgePackage(directory,{sourceRoot});
    need(snapshot.packageIdentity===acceptedPackage&&snapshot.files.size===12,'SOURCE_PACKAGE_REVIEW_REQUIRED');return snapshot;
  }catch{need(false,'SOURCE_PACKAGE_REVIEW_REQUIRED');}
}
export function prepareBatchA(input,{sourceRoot=root,entropy=randomBytes,now=()=>new Date().toISOString()}={}){
  const receipt=base();let private_configuration=null;
  try{
    need(object(input)&&['artifacts','candidate'].includes(input.action)&&exact(input,input.action==='artifacts'?['action','configuration']:['action','configuration','availability','vapid','currencyKey']),'LOCAL_BATCH_INPUT_REQUIRED');
    receipt.checkpoint='PUBLIC_ARTIFACTS';const config=parseStagingConfiguration(input.configuration);
    const snapshot=publicArtifacts(sourceRoot);receipt.fresh_Edge_source_package_verified=true;receipt.package_files=snapshot.files.size;receipt.package_SHA256=snapshot.packageIdentity;
    receipt.retained_ZIP_staging_configuration_validated=true;receipt.retained_frontend_VAPID_key_present=config.vapidPublicKey!=='';
    if(input.action==='artifacts'){receipt.result='LOCAL_BATCH_A_PUBLIC_ARTIFACTS_CHECKED';receipt.checkpoint='PUBLIC_ARTIFACTS_COMPLETE';receipt.exit_code=0;return {receipt,private_configuration};}
    receipt.checkpoint='INPUT_AVAILABILITY';
    need(exact(input.availability,['separate_staging_VAPID_pair','CurrencyAPI_key'])&&Object.values(input.availability).every(x=>typeof x==='boolean'),'LOCAL_BATCH_INPUT_REQUIRED');
    receipt.input_availability={...input.availability};
    if(!input.availability.separate_staging_VAPID_pair)receipt.input_issues.push('SEPARATE_STAGING_VAPID_PAIR_REQUIRED');
    if(!input.availability.CurrencyAPI_key)receipt.input_issues.push('STAGING_CURRENCYAPI_KEY_REQUIRED');
    if(receipt.input_issues.length){
      need(input.vapid===null&&input.currencyKey===null,'LOCAL_BATCH_INPUT_REQUIRED');
      receipt.batch_checks_complete=true;receipt.result='LOCAL_BATCH_A_CHECKS_COMPLETE_INPUTS_REQUIRED';receipt.checkpoint='COMPLETE_INPUTS_REQUIRED';receipt.exit_code=2;return {receipt,private_configuration};
    }
    receipt.checkpoint='PRIVATE_INPUT_VALIDATION';
    receipt.VAPID_pair_mathematically_validated=validateVAPIDPair(input.vapid);
    receipt.VAPID_subject_syntax_validated=validSubject(input.vapid?.subject);
    receipt.CurrencyAPI_input_syntax_validated=typeof input.currencyKey==='string'&&/^[A-Za-z0-9_.-]{16,512}$/.test(input.currencyKey);
    if(!receipt.VAPID_pair_mathematically_validated)receipt.input_issues.push('VAPID_KEY_PAIR_REVIEW_REQUIRED');
    if(!receipt.VAPID_subject_syntax_validated)receipt.input_issues.push('VAPID_SUBJECT_REVIEW_REQUIRED');
    if(!receipt.CurrencyAPI_input_syntax_validated)receipt.input_issues.push('CURRENCYAPI_INPUT_SYNTAX_REVIEW_REQUIRED');
    if(receipt.VAPID_pair_mathematically_validated){
      receipt.frontend_VAPID_relation=config.vapidPublicKey===''?'ABSENT_IN_RETAINED_ZIP':config.vapidPublicKey===input.vapid.publicKey?'MATCHES_VALIDATED_PAIR':'DIFFERENT_KEY';
      receipt.frontend_candidate_update_required=receipt.frontend_VAPID_relation==='ABSENT_IN_RETAINED_ZIP';
      if(receipt.frontend_VAPID_relation==='DIFFERENT_KEY')receipt.input_issues.push('FRONTEND_VAPID_KEY_MISMATCH');
    }
    if(receipt.input_issues.length){receipt.batch_checks_complete=true;receipt.result='LOCAL_BATCH_A_CHECKS_COMPLETE_INPUT_REVIEW_REQUIRED';receipt.checkpoint='COMPLETE_INPUT_REVIEW';receipt.exit_code=2;return {receipt,private_configuration};}
    const secret=entropy(32);need(Buffer.isBuffer(secret)&&secret.length===32,'LOCAL_BATCH_INPUT_REQUIRED');
    const callerSecret=secret.toString('hex');secret.fill(0);receipt.independent_staging_caller_secret_generated=true;
    const env={APP_ORIGIN:batchOrigin,VAPID_PUBLIC_KEY:input.vapid.publicKey,VAPID_PRIVATE_KEY:input.vapid.privateKey,VAPID_SUBJECT:input.vapid.subject,CURRENCYAPI_API_KEY:input.currencyKey,CURRENCY_SYNC_SECRET:callerSecret};
    private_configuration={schema_version:1,purpose:'MUSHAVO_STAGING_EDGE_CONFIGURATION_CANDIDATE_ONLY',project:batchRef,origin:batchOrigin,created_UTC:now(),accepted_ZIP_SHA256:acceptedZIP,Edge_package_SHA256:acceptedPackage,frontend_VAPID_relation:receipt.frontend_VAPID_relation,frontend_candidate_update_required:receipt.frontend_candidate_update_required,provider_credentials_verified:false,external_callers_verified:false,hosted_write_approved:false,live_activation_approved:false,env};
    receipt.configured_variable_count=6;receipt.batch_checks_complete=true;receipt.result='LOCAL_BATCH_A_PRIVATE_VALUES_VALIDATED_FOR_PARENT_ENCRYPTION';receipt.checkpoint='PARENT_ENCRYPTION_PENDING';receipt.exit_code=0;
  }catch(error){receipt.problem_code=safeProblems.has(error?.safeCode)?error.safeCode:'LOCAL_BATCH_INPUT_REQUIRED';}
  return {receipt,private_configuration};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  let answer;try{
    need(process.argv.length===3&&process.argv[2]==='--private-parent-pipe'&&!process.stdin.isTTY&&!process.stdout.isTTY,'LOCAL_BATCH_INPUT_REQUIRED');
    let size=0;const chunks=[];for await(const chunk of process.stdin){size+=chunk.length;need(size<=65536,'LOCAL_BATCH_INPUT_REQUIRED');chunks.push(chunk);}
    const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    answer=exact(input,['preflight'])&&input.preflight===true?{receipt:{...base(),result:'PRIVATE_PIPE_PREFLIGHT_PASS',exit_code:0},private_configuration:null}:prepareBatchA(input);
  }catch{answer={receipt:{...base(),problem_code:'LOCAL_BATCH_INPUT_REQUIRED'},private_configuration:null};}
  process.stdout.write(JSON.stringify(answer));process.exitCode=answer.receipt.exit_code;
}
