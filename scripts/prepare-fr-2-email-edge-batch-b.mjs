// Batch B is local packaging only: no provider transport or credential-generation path.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readCanonicalPublicZIP,modernWorker} from './prepare-fr-2-email-modern-package.mjs';
import {createPublicZIP} from './lib/store-public-zip.mjs';
import {sourceSnapshot,assertOrdinaryPath} from './prepare-fr-2-email-edge-package.mjs';
import {parseStagingConfiguration,validateVAPIDPair,batchRef,batchOrigin,acceptedZIP,acceptedPackage} from './prepare-fr-2-email-edge-batch-a.mjs';
export const batchBStage='FR.2.4.E5.15_BATCH_B_FRONTEND_AND_ROLLOUT_PREPARATION';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=x=>createHash('sha256').update(x).digest('hex');
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).sort().join(',')===[...keys].sort().join(',');
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{safeCode:code});};
const problems=new Set(['BATCH_B_INPUT_REQUIRED','BATCH_A_PACKET_REVIEW_REQUIRED','ACCEPTED_ZIP_REVIEW_REQUIRED','PUBLIC_CONFIGURATION_REVIEW_REQUIRED','NEW_OUTPUT_REQUIRED','SOURCE_PACKAGE_REVIEW_REQUIRED','PUBLIC_PACKAGE_READBACK_REQUIRED']);
function base(){return {stage_step:batchBStage,batch:'B',result:'LOCAL_BATCH_B_REVIEW_REQUIRED',
  Batch_A_private_candidate_validated:false,configured_variable_count:0,retained_ZIP_identity_verified:false,
  Edge_package_identity_verified:false,public_files:0,files_except_config_byte_identical:0,
  only_config_js_changed:false,Worker_identity_preserved:false,frontend_candidate_VAPID_matches_private_candidate:false,
  new_ZIP_SHA256:null,portable_ZIP_readback_verified:false,rollout_checklist_written:false,
  retained_ZIP_unchanged:false,private_credentials_written_to_public_artifacts:false,
  existing_credentials_rotated:false,CurrencyAPI_provider_validity_verified:false,
  actual_hosted_requests:0,application_or_Edge_functions_invoked:0,email_push_or_FX_dispatched:false,
  uploaded_or_deployed:false,settings_or_schedules_changed:false,frontend_live_key_verified:false,
  readiness_approved:false,live_activation_approved:false,hosted_acceptance:false,
  production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],checkpoint:'PRIVATE_INPUT',problem_code:null,exit_code:1};}
export function validateBatchAPacket(p){
  need(exact(p,['schema_version','purpose','project','origin','created_UTC','accepted_ZIP_SHA256','Edge_package_SHA256','frontend_VAPID_relation','frontend_candidate_update_required','provider_credentials_verified','external_callers_verified','hosted_write_approved','live_activation_approved','env']), 'BATCH_A_PACKET_REVIEW_REQUIRED');
  need(p.schema_version===1&&p.purpose==='MUSHAVO_STAGING_EDGE_CONFIGURATION_CANDIDATE_ONLY'&&p.project===batchRef&&p.origin===batchOrigin&&
    p.accepted_ZIP_SHA256===acceptedZIP&&p.Edge_package_SHA256===acceptedPackage&&p.frontend_VAPID_relation==='ABSENT_IN_RETAINED_ZIP'&&p.frontend_candidate_update_required===true&&
    p.provider_credentials_verified===false&&p.external_callers_verified===false&&p.hosted_write_approved===false&&p.live_activation_approved===false&&
    typeof p.created_UTC==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(p.created_UTC)&&Number.isFinite(Date.parse(p.created_UTC)), 'BATCH_A_PACKET_REVIEW_REQUIRED');
  const e=p.env;
  need(exact(e,['APP_ORIGIN','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT','CURRENCYAPI_API_KEY','CURRENCY_SYNC_SECRET'])&&e.APP_ORIGIN===batchOrigin&&
    validateVAPIDPair({publicKey:e.VAPID_PUBLIC_KEY,privateKey:e.VAPID_PRIVATE_KEY,subject:e.VAPID_SUBJECT})&&
    typeof e.VAPID_SUBJECT==='string'&&e.VAPID_SUBJECT.length<=512&&!/[\x00-\x20\x7f]/.test(e.VAPID_SUBJECT)&&/^(mailto:|https:\/\/)/.test(e.VAPID_SUBJECT)&&
    typeof e.CURRENCYAPI_API_KEY==='string'&&/^[A-Za-z0-9_.-]{16,512}$/.test(e.CURRENCYAPI_API_KEY)&&
    typeof e.CURRENCY_SYNC_SECRET==='string'&&/^[a-f0-9]{64}$/.test(e.CURRENCY_SYNC_SECRET),'BATCH_A_PACKET_REVIEW_REQUIRED');
  return e;
}
export function prepareBatchB(input,{sourceRoot=root,output=path.join(sourceRoot,'batch-b-frontend'),expectedZIP=acceptedZIP,expectedWorker=modernWorker}={}){
  const r=base();let created=false;
  try{
    need(exact(input,['action','packet','acceptedZIPPath'])&&input.action==='prepare'&&typeof input.acceptedZIPPath==='string'&&path.isAbsolute(input.acceptedZIPPath),'BATCH_B_INPUT_REQUIRED');
    r.checkpoint='BATCH_A_PRIVATE_CANDIDATE';const env=validateBatchAPacket(input.packet);r.Batch_A_private_candidate_validated=true;r.configured_variable_count=6;
    r.checkpoint='ACCEPTED_ZIP';assertOrdinaryPath(input.acceptedZIPPath);
    const stat=fs.lstatSync(input.acceptedZIPPath);need(stat.isFile()&&stat.size<=8388608,'ACCEPTED_ZIP_REVIEW_REQUIRED');
    const prior=fs.readFileSync(input.acceptedZIPPath);need(hash(prior)===expectedZIP,'ACCEPTED_ZIP_REVIEW_REQUIRED');r.retained_ZIP_identity_verified=true;
    const previous=readCanonicalPublicZIP(prior);need(previous.size===44&&hash(previous.get('_worker.js'))===expectedWorker,'ACCEPTED_ZIP_REVIEW_REQUIRED');
    const config=parseStagingConfiguration(previous.get('config.js')?.toString('utf8'));need(config.vapidPublicKey==='','PUBLIC_CONFIGURATION_REVIEW_REQUIRED');
    r.checkpoint='EDGE_SOURCE_IDENTITY';const edge=sourceSnapshot(sourceRoot);need(edge.packageIdentity===acceptedPackage,'SOURCE_PACKAGE_REVIEW_REQUIRED');r.Edge_package_identity_verified=true;
    const next=new Map(previous);next.set('config.js',Buffer.from('window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify({...config,vapidPublicKey:env.VAPID_PUBLIC_KEY},null,2)+';\n'));
    const publicKey=env.VAPID_PUBLIC_KEY;
    const nextConfig=parseStagingConfiguration(next.get('config.js').toString('utf8'));
    need(nextConfig.vapidPublicKey===publicKey&&nextConfig.supabaseUrl===config.supabaseUrl&&nextConfig.supabasePublishableKey===config.supabasePublishableKey,'PUBLIC_CONFIGURATION_REVIEW_REQUIRED');
    for(const [name,data] of next){if(name!=='config.js'){need(data.equals(previous.get(name)),'PUBLIC_CONFIGURATION_REVIEW_REQUIRED');r.files_except_config_byte_identical++;}}
    need(r.files_except_config_byte_identical===43&&!next.get('config.js').equals(previous.get('config.js')),'PUBLIC_CONFIGURATION_REVIEW_REQUIRED');
    r.only_config_js_changed=true;r.Worker_identity_preserved=true;r.frontend_candidate_VAPID_matches_private_candidate=true;r.public_files=44;
    const bytes=createPublicZIP([...next]);const decoded=readCanonicalPublicZIP(bytes);
    for(const [name,data] of next)need(data.equals(decoded.get(name)),'PUBLIC_PACKAGE_READBACK_REQUIRED');
    r.new_ZIP_SHA256=hash(bytes);r.portable_ZIP_readback_verified=true;
    const checklist={schema_version:1,purpose:'LOCAL_STAGING_ROLLOUT_CANDIDATE_ONLY',project:batchRef,origin:batchOrigin,
      prior_ZIP_SHA256:acceptedZIP,candidate_ZIP_SHA256:r.new_ZIP_SHA256,Worker_SHA256:modernWorker,Edge_package_SHA256:acceptedPackage,
      configuration_names:Object.keys(env),local_frontend_and_private_VAPID_pair_match:true,
      original_immutable_Edge_readiness:{...edge.plan.readiness},
      outstanding_hosted_prerequisites:['FRESH_TARGET_AND_CATALOG_AND_FUNCTION_CONFIGURATION_BASELINES','CURRENCYAPI_PROVIDER_CREDENTIAL_ACCEPTANCE',
        'SCHEDULER_AND_EXTERNAL_CALLERS','CURRENT_PAGES_AND_LIMITER_IDENTITY_AND_BINDINGS','CANONICAL_DATABASE_INTEGRATION',
        'COORDINATED_DEPLOYMENT_AND_QUARANTINED_ACTIVATION','HOSTED_AUTHORIZATION_EMAIL_AND_RECOVERY_ACCEPTANCE'],
      recovery:{prior_ZIP_retained:true,before_database_activation:'RETAIN_PREVIOUS_DEPLOYABLE_ARTIFACTS_AND_EXPLICIT_WINDOW',after_database_activation:'QUARANTINE_AND_FORWARD_REPAIR_REQUIRED'},
      hosted_write_approved:false,deployable_now:false,readiness_approved:false,live_activation_approved:false,hosted_acceptance:false};
    // Only the public key may be copied from the encrypted configuration into these artifacts.
    const plan=Buffer.from(JSON.stringify(checklist,null,2)+'\n');
    for(const secret of [env.VAPID_PRIVATE_KEY,env.CURRENCYAPI_API_KEY,env.CURRENCY_SYNC_SECRET])need(!bytes.includes(Buffer.from(secret))&&!plan.includes(Buffer.from(secret)),'PUBLIC_CONFIGURATION_REVIEW_REQUIRED');
    r.checkpoint='NEW_LOCAL_OUTPUT';assertOrdinaryPath(output);need(!fs.existsSync(output)&&fs.lstatSync(path.dirname(output)).isDirectory(),'NEW_OUTPUT_REQUIRED');
    fs.mkdirSync(output);created=true;
    const zip=path.join(output,'mushavo-email-push-review.zip'),planFile=path.join(output,'rollout-checklist.json');
    fs.writeFileSync(zip,bytes,{flag:'wx'});fs.writeFileSync(planFile,plan,{flag:'wx'});
    need(fs.readFileSync(zip).equals(bytes)&&fs.readFileSync(planFile).equals(plan),'PUBLIC_PACKAGE_READBACK_REQUIRED');
    need(hash(fs.readFileSync(input.acceptedZIPPath))===expectedZIP,'ACCEPTED_ZIP_REVIEW_REQUIRED');
    r.rollout_checklist_written=true;r.retained_ZIP_unchanged=true;r.result='LOCAL_BATCH_B_FRONTEND_AND_ROLLOUT_CANDIDATE_PREPARED_NOT_DEPLOYED';r.checkpoint='COMPLETE';r.exit_code=0;
  }catch(error){r.problem_code=problems.has(error?.safeCode)?error.safeCode:'LOCAL_BATCH_B_REVIEW_REQUIRED';if(created){try{fs.rmSync(output,{recursive:true,force:true});}catch{r.problem_code='OWNED_OUTPUT_CLEANUP_REVIEW_REQUIRED';}}}
  return r;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  let answer;try{
    need(process.argv.length===3&&process.argv[2]==='--private-parent-pipe'&&!process.stdin.isTTY&&!process.stdout.isTTY,'BATCH_B_INPUT_REQUIRED');
    const chunks=[];let size=0;for await(const chunk of process.stdin){size+=chunk.length;need(size<=65536,'BATCH_B_INPUT_REQUIRED');chunks.push(chunk);}
    const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    answer=exact(input,['preflight'])&&input.preflight===true?{...base(),result:'PRIVATE_PIPE_PREFLIGHT_PASS',exit_code:0}:prepareBatchB(input);
  }catch{answer={...base(),problem_code:'BATCH_B_INPUT_REQUIRED'};}
  process.stdout.write(JSON.stringify(answer));process.exitCode=answer.exit_code;
}
