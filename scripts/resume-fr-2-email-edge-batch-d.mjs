// Resume only the recorded one-function partial staging deployment. No redeployment of that route.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {sourceSnapshot} from './prepare-fr-2-email-edge-package.mjs';
import {impactRef,selectedSlugs,sixNames} from './review-fr-2-email-edge-installed.mjs';
import {decodeSourceMultipart,matchReviewedArtifact} from './check-fr-2-email-edge-impact.mjs';
export const stage='FR.2.4.E5.17R_BATCH_D_VERIFY_ONE_AND_DEPLOY_REMAINING_THREE';
export const acknowledgement='VERIFY_RECORDED_FIRST_AND_DEPLOY_THREE_MISSING_STAGING_FUNCTIONS_ONLY';
export const existingReceiptPin=Object.freeze({slug:'invite-admin-user',version:1,function_identity_SHA256:'fb57a24cbaca20d32fe5533d4169006813c706d145fcf188d1da58c1e00ff224',deployment_bundle_SHA256:'9e3d472069c6c87c33dcc5af08f7293c4c14fd387d328c78c107e30b26df0b81'});
export const reviewedMetadata='f8fe331bf335145aff9cb8979816b3d092bc900c93c78e8856be1afbb975296e';
const root=new URL('../',import.meta.url),endpoint='https://api.supabase.com/v1/projects/'+impactRef;
const need=(b,c)=>{if(!b)throw Object.assign(Error(c),{safeCode:c});};
const hash=x=>createHash('sha256').update(x).digest('hex');
const digest=x=>hash(JSON.stringify(x));
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).sort().join(',')===[...keys].sort().join(',');
const codes=new Set(['PRIVATE_INPUT_REQUIRED','ACKNOWLEDGEMENT_REQUIRED','PREPARED_PACKAGE_REQUIRED','CURRENT_REVIEW_REQUIRED','CURRENT_BASELINE_CHANGED','METADATA_REVIEW_REQUIRED','OBSERVATION_CHANGED','PROVIDER_RESPONSE_REVIEW_REQUIRED','SOURCE_READBACK_REVIEW_REQUIRED','UNAUTHENTICATED_DENIAL_REVIEW_REQUIRED','RECORDED_FUNCTION_PIN_REQUIRED','RECORDED_PARTIAL_STATE_REQUIRED','RECORDED_FUNCTION_CHANGED']);
export function projection(row){
 need(object(row)&&typeof row.slug==='string'&&/^[a-z0-9_-]{1,128}$/.test(row.slug)&&typeof row.id==='string'&&row.id.length>0&&row.id.length<=256&&row.status==='ACTIVE'&&Number.isSafeInteger(row.version)&&row.version>=1&&typeof row.verify_jwt==='boolean'&&Number.isSafeInteger(row.created_at)&&row.created_at>=0&&Number.isSafeInteger(row.updated_at)&&row.updated_at>=row.created_at,'METADATA_REVIEW_REQUIRED');
 return Object.fromEntries(['slug','id','status','version','verify_jwt','created_at','updated_at'].map(k=>[k,row[k]]));
}
function rows(input){need(Array.isArray(input)&&input.length<=16,'METADATA_REVIEW_REQUIRED');const result=input.map(projection).sort((a,b)=>a.slug.localeCompare(b.slug));need(new Set(result.map(x=>x.slug)).size===result.length,'METADATA_REVIEW_REQUIRED');return result;}
function safePath(value){
 need(typeof value==='string'&&value.length>0&&value.length<=2048&&!/[\\\x00-\x1f%?#]/.test(value)&&!value.split('/').some(x=>x==='.'||x==='..'),'SOURCE_READBACK_REVIEW_REQUIRED');
 if(value.startsWith('file:///'))value=new URL(value).pathname;
 need(!value.includes('://')&&path.posix.normalize(value)===value,'SOURCE_READBACK_REVIEW_REQUIRED');return value;
}
export function uploadFiles(slug,snapshot=sourceSnapshot()){
 need(selectedSlugs.includes(slug)&&snapshot.packageIdentity==='e1fb82c6001ee4bb8f3d6999f078a028637cf90d912e275fb14ac84774f192a3','PREPARED_PACKAGE_REQUIRED');
 const prefix='supabase/functions/',names=[prefix+slug+'/index.ts',prefix+'_shared/email-session-assurance.mjs'];
 if(slug==='send-test-push')names.push(prefix+'_shared/push-destination.mjs',prefix+'_shared/notification-recipient.mjs');
 if(slug==='sync-exchange-rates')names.push(prefix+'_shared/currencyapi.ts');
 return new Map(names.map(n=>{need(snapshot.files.has(n),'PREPARED_PACKAGE_REQUIRED');return[n,snapshot.files.get(n)];}));
}
export function deploymentForm(slug,snapshot){
 const files=uploadFiles(slug,snapshot),form=new FormData();
 form.append('metadata',JSON.stringify({name:slug,entrypoint_path:'supabase/functions/'+slug+'/index.ts',verify_jwt:selectedSlugs.indexOf(slug)<2,import_map_path:'',static_patterns:[]}));
 for(const [name,bytes]of files)form.append('file',new Blob([bytes],{type:'application/octet-stream'}),name);
 return form;
}
export async function exactSourceReadback(bytes,type,detailEntry,slug,expected){
 need(/^multipart\/form-data;\s*boundary=/i.test(type)&&bytes.length>0&&bytes.length<=2097152,'SOURCE_READBACK_REVIEW_REQUIRED');
 let form;try{form=await new Response(bytes,{headers:{'content-type':type}}).formData();}catch{need(false,'SOURCE_READBACK_REVIEW_REQUIRED');}
 const files=new Map();let metadata=null,count=0;
 for(const [field,value]of form){need(++count<=16,'SOURCE_READBACK_REVIEW_REQUIRED');
  if(field==='metadata'&&typeof value==='string'){need(metadata===null&&value.length<=8192,'SOURCE_READBACK_REVIEW_REQUIRED');try{metadata=JSON.parse(value);}catch{need(false,'SOURCE_READBACK_REVIEW_REQUIRED');}need(object(metadata),'SOURCE_READBACK_REVIEW_REQUIRED');}
  else {need(field==='file'&&typeof value!=='string'&&value.size>0,'SOURCE_READBACK_REVIEW_REQUIRED');const name=safePath(value.name);need(!files.has(name),'SOURCE_READBACK_REVIEW_REQUIRED');files.set(name,Buffer.from(await value.arrayBuffer()));}
 }
 const entry=safePath(metadata?.deno2_entrypoint_path||metadata?.entrypoint_path||detailEntry);
 need(path.posix.basename(entry)==='index.ts'&&files.has(entry)&&files.size===expected.size,'SOURCE_READBACK_REVIEW_REQUIRED');
 const localEntry='supabase/functions/'+slug+'/index.ts',seen=new Set();
 for(const [name,data]of files){need(path.posix.isAbsolute(name)===path.posix.isAbsolute(entry),'SOURCE_READBACK_REVIEW_REQUIRED');const mapped=path.posix.normalize(path.posix.join(path.posix.dirname(localEntry),path.posix.relative(path.posix.dirname(entry),name)));need(expected.has(mapped)&&!seen.has(mapped)&&data.equals(expected.get(mapped)),'SOURCE_READBACK_REVIEW_REQUIRED');seen.add(mapped);}
 return seen.size;
}
export async function resumeBatchD(input,{transport=fetch,baseline=reviewedMetadata,existingPin=existingReceiptPin}={}){
 const r={stage_step:stage,batch:'D_RESUME',previously_confirmed_deployment_count:1,new_deployment_target_count:3,result:'STAGING_BATCH_D_RESUME_REVIEW_REQUIRED',recorded_existing_function_verified:false,recorded_existing_function_redeployed:false,denial_evidence_basis:'EXACT_HTTP_401_ONLY',denial_response_JSON_format_verified:false,actual_hosted_requests:0,deployment_POST_requests:0,deployment_HTTP_accepted_count:0,deployment_write_outcome_uncertain:false,
  fresh_source_target_and_six_names_verified:false,current_review_problem:null,reviewed_current_metadata_matched:false,package_SHA256:null,
  selected_functions:[],all_four_source_readbacks_exact:false,all_four_unauthenticated_requests_denied:false,unrelated_contact_metadata_and_artifacts_preserved:false,
  metadata_snapshot_is_not_a_write_lock:true,automatic_retry_or_delete_performed:false,hosted_dependency_bytes_or_lockfile_parity_verified:false,
  runtime_authenticated_JWT_and_user_authorization_verified:false,secret_value_equality_or_full_runtime_access_verified:false,shared_configuration_runtime_impact_verified:false,
  application_rows_read:false,SQL_Auth_secret_write_or_scheduler_endpoint_used:false,unauthenticated_Edge_requests:0,email_push_or_FX_dispatched:false,
  deployment_may_have_changed:false,uploaded_or_deployed:false,live_activation_approved:false,hosted_acceptance:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],raw_provider_bodies_paths_IDs_or_credentials_printed:false,
  token_saved_to_disk_or_environment:false,samples:[],checkpoint:'PRIVATE_INPUT',problem_code:null,exit_code:1};
 try{
  need(exact(input,['token','acknowledgement'])&&typeof input.token==='string'&&/^sbp_fc[A-Za-z0-9_-]{20,512}$/.test(input.token),'PRIVATE_INPUT_REQUIRED');need(input.acknowledgement===acknowledgement,'ACKNOWLEDGEMENT_REQUIRED');
  const snapshot=sourceSnapshot();r.package_SHA256=snapshot.packageIdentity;need(snapshot.packageIdentity==='e1fb82c6001ee4bb8f3d6999f078a028637cf90d912e275fb14ac84774f192a3','PREPARED_PACKAGE_REQUIRED');
  async function request(label,url,init,status,{multipart=false,write=false,denial=false}={}){
   r.checkpoint=label;r.actual_hosted_requests++;need(r.actual_hosted_requests<=32,'PROVIDER_RESPONSE_REVIEW_REQUIRED');
   const sample={endpoint:label,http_status:null};r.samples.push(sample);
   const response=await transport(url,{...init,redirect:'error',signal:AbortSignal.timeout(write?60000:12000)});sample.http_status=response.status;
   need(response.status===status&&!response.redirected&&(!response.url||response.url===url),'PROVIDER_RESPONSE_REVIEW_REQUIRED');
   const type=response.headers.get('content-type')||'';if(!denial)need((multipart?/^multipart\/form-data;/i:/^application\/json(?:\s*;|$)/i).test(type),'PROVIDER_RESPONSE_REVIEW_REQUIRED');
   if(denial&&response.body===null)return {status:401};
   const reader=response.body?.getReader();need(reader,'PROVIDER_RESPONSE_REVIEW_REQUIRED');const chunks=[];let size=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;need(size<=(multipart?2097152:262144),'PROVIDER_RESPONSE_REVIEW_REQUIRED');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   if(denial)return {status:401};
   const bytes=Buffer.concat(chunks);if(multipart)return {bytes,type};try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{need(false,'PROVIDER_RESPONSE_REVIEW_REQUIRED');}
  }
  const headers={Authorization:'Bearer '+input.token,Accept:'application/json','Cache-Control':'no-store'};
  const get=(label,suffix,options)=>request(label,endpoint+suffix,{method:'GET',headers:{...headers,...(options?.multipart?{Accept:'multipart/form-data'}:{})}},200,options);
  r.checkpoint='FRESH_RECORDED_PARTIAL_STATE';
  need(exact(existingPin,['slug','version','function_identity_SHA256','deployment_bundle_SHA256'])&&existingPin.slug===selectedSlugs[0]&&Number.isSafeInteger(existingPin.version)&&existingPin.version>=1&&/^[a-f0-9]{64}$/.test(existingPin.function_identity_SHA256)&&/^[a-f0-9]{64}$/.test(existingPin.deployment_bundle_SHA256),'RECORDED_FUNCTION_PIN_REQUIRED');
  const project=await get('STAGING_PROJECT','');
  need(object(project)&&(project.ref===impactRef||(project.ref===undefined&&project.id===impactRef))&&!(typeof project.id==='string'&&/^[a-z]{20}$/.test(project.id)&&project.id!==impactRef)&&project.status==='ACTIVE_HEALTHY'&&project.database?.host==='db.'+impactRef+'.supabase.co','CURRENT_REVIEW_REQUIRED');
  const firstList=rows(await get('STAGING_PARTIAL_FUNCTION_LIST','/functions'));
  need(firstList.length===2&&firstList.some(x=>x.slug==='submit-enquiry')&&firstList.some(x=>x.slug===existingPin.slug),'RECORDED_PARTIAL_STATE_REQUIRED');
  const initial=firstList.filter(x=>x.slug==='submit-enquiry'),existing=firstList.find(x=>x.slug===existingPin.slug);
  need(digest(initial)===baseline,'CURRENT_BASELINE_CHANGED');r.reviewed_current_metadata_matched=true;
  need(existing.verify_jwt===true&&existing.version===existingPin.version&&hash(existing.id)===existingPin.function_identity_SHA256,'RECORDED_FUNCTION_CHANGED');
  const contactDetail=await get('STAGING_CONTACT_DETAIL_PINNED','/functions/submit-enquiry');
  need(digest(projection(contactDetail))===digest(initial[0])&&contactDetail.import_map===false&&!contactDetail.import_map_path,'OBSERVATION_CHANGED');
  async function contactSource(label,detail){const b=await get(label,'/functions/submit-enquiry/body',{multipart:true});const files=decodeSourceMultipart(b.bytes,b.type,detail.entrypoint_path);for(const name of ['index.ts','handler.mjs'])need(matchReviewedArtifact(name,files.get(name),fs.readFileSync(new URL('supabase/functions/submit-enquiry/'+name,root))).reviewed_artifact_exact_bytes_match,'SOURCE_READBACK_REVIEW_REQUIRED');}
  await contactSource('STAGING_CONTACT_SOURCE_PINNED',contactDetail);
  const contactAfter=await get('STAGING_CONTACT_DETAIL_AFTER','/functions/submit-enquiry');
  need(digest(projection(contactAfter))===digest(initial[0])&&contactAfter.entrypoint_path===contactDetail.entrypoint_path&&contactAfter.ezbr_sha256===contactDetail.ezbr_sha256&&contactAfter.import_map===false&&!contactAfter.import_map_path,'OBSERVATION_CHANGED');
  const names=await get('STAGING_INSTALLED_NAMES','/secrets');need(Array.isArray(names)&&names.length<=256,'CURRENT_REVIEW_REQUIRED');const seenNames=new Set();for(const row of names){need(object(row)&&typeof row.name==='string'&&/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(row.name)&&!seenNames.has(row.name),'CURRENT_REVIEW_REQUIRED');seenNames.add(row.name);}need(sixNames.every(n=>seenNames.has(n)),'CURRENT_REVIEW_REQUIRED');r.fresh_source_target_and_six_names_verified=true;
  const deployed=[existing];
  async function unchanged(label){const list=rows(await get(label,'/functions'));need(digest(list)===digest([...initial,...deployed].sort((a,b)=>a.slug.localeCompare(b.slug))),'OBSERVATION_CHANGED');return list;}
  function itemFor(slug){return {slug,verify_jwt_expected:selectedSlugs.indexOf(slug)<2,already_installed:slug===existingPin.slug,POST_attempted:false,POST_HTTP_accepted:false,metadata_readback_matched:false,source_files_exact:0,unauthenticated_HTTP_status:null,unauthenticated_denied:false,denial_evidence_basis:'EXACT_HTTP_401_ONLY',version:null,function_identity_SHA256:null,deployment_bundle_SHA256:null};}
  async function verifyOne(slug,installed,bundle,item){
   item.version=installed.version;item.function_identity_SHA256=hash(installed.id);item.deployment_bundle_SHA256=bundle;
   const detail=await get('STAGING_DEPLOYED_DETAIL_'+slug,'/functions/'+slug);need(digest(projection(detail))===digest(installed)&&detail.ezbr_sha256===bundle&&detail.import_map===false&&!detail.import_map_path,'METADATA_REVIEW_REQUIRED');safePath(detail.entrypoint_path);item.metadata_readback_matched=true;
   const body=await get('STAGING_DEPLOYED_SOURCE_'+slug,'/functions/'+slug+'/body',{multipart:true});item.source_files_exact=await exactSourceReadback(body.bytes,body.type,detail.entrypoint_path,slug,uploadFiles(slug,snapshot));
   const second=await get('STAGING_DEPLOYED_DETAIL_AFTER_'+slug,'/functions/'+slug);need(digest(projection(second))===digest(installed)&&second.entrypoint_path===detail.entrypoint_path&&second.ezbr_sha256===detail.ezbr_sha256&&second.import_map===false&&!second.import_map_path,'OBSERVATION_CHANGED');
   r.unauthenticated_Edge_requests++;
   // HTTP 401 is the denial observation. A provider-specific error JSON schema
   // is not a prerequisite and is never claimed as evidence of gateway execution.
   await request('STAGING_UNAUTHENTICATED_DENIAL_'+slug,'https://'+impactRef+'.supabase.co/functions/v1/'+slug,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://mushavo-budget-staging.pages.dev'},body:'{}'},401,{denial:true});
   item.unauthenticated_HTTP_status=401;item.unauthenticated_denied=true;
  }
  const retained=itemFor(existing.slug);r.selected_functions.push(retained);
  await verifyOne(existing.slug,existing,existingPin.deployment_bundle_SHA256,retained);r.recorded_existing_function_verified=true;
  for(const slug of selectedSlugs.slice(1)){
   await unchanged('STAGING_ABSENCE_BEFORE_'+slug);
   const item=itemFor(slug);r.selected_functions.push(item);
   const form=deploymentForm(slug,snapshot);item.POST_attempted=true;r.deployment_POST_requests++;r.deployment_write_outcome_uncertain=true;r.deployment_may_have_changed=true;
   const response=await request('STAGING_DEPLOY_'+slug,endpoint+'/functions/deploy?slug='+slug,{method:'POST',headers,body:form},201,{write:true});
   const installed=projection(response);need(installed.slug===slug&&installed.verify_jwt===(selectedSlugs.indexOf(slug)<2),'METADATA_REVIEW_REQUIRED');
   item.POST_HTTP_accepted=true;r.uploaded_or_deployed=true;r.deployment_HTTP_accepted_count++;r.deployment_write_outcome_uncertain=false;
   need(typeof response.ezbr_sha256==='string'&&/^[a-f0-9]{64}$/.test(response.ezbr_sha256)&&![...initial,...deployed].some(x=>x.id===installed.id),'METADATA_REVIEW_REQUIRED');deployed.push(installed);
   await verifyOne(slug,installed,response.ezbr_sha256,item);
  }
  await unchanged('STAGING_FINAL_FUNCTION_LIST');
  const finalDetail=await get('STAGING_CONTACT_FINAL_DETAIL','/functions/submit-enquiry');need(digest(projection(finalDetail))===digest(initial[0])&&finalDetail.entrypoint_path===contactDetail.entrypoint_path&&finalDetail.ezbr_sha256===contactDetail.ezbr_sha256&&finalDetail.import_map===false&&!finalDetail.import_map_path,'OBSERVATION_CHANGED');
  const source=await get('STAGING_CONTACT_FINAL_SOURCE','/functions/submit-enquiry/body',{multipart:true});const files=decodeSourceMultipart(source.bytes,source.type,finalDetail.entrypoint_path);
  for(const name of ['index.ts','handler.mjs'])need(matchReviewedArtifact(name,files.get(name),fs.readFileSync(new URL('supabase/functions/submit-enquiry/'+name,root))).reviewed_artifact_exact_bytes_match,'SOURCE_READBACK_REVIEW_REQUIRED');
  await unchanged('STAGING_FINAL_STABLE_FUNCTION_LIST');
  r.unrelated_contact_metadata_and_artifacts_preserved=true;r.all_four_source_readbacks_exact=true;r.all_four_unauthenticated_requests_denied=true;
  r.result='STAGING_BATCH_D_RESUMED_THREE_DEPLOYED_FOUR_SOURCE_AND_HTTP401_SCOPED_PASS';r.checkpoint='COMPLETE';r.exit_code=0;
 }catch(error){r.problem_code=codes.has(error?.safeCode)?error.safeCode:'PROVIDER_RESPONSE_REVIEW_REQUIRED';}
 r.checked_UTC=new Date().toISOString();return r;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 let r;try{need(process.argv.length===3&&process.argv[2]==='--private-parent-pipe'&&!process.stdin.isTTY&&!process.stdout.isTTY,'PRIVATE_INPUT_REQUIRED');const chunks=[];let size=0;for await(const b of process.stdin){size+=b.length;need(size<=8192,'PRIVATE_INPUT_REQUIRED');chunks.push(b);}const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));r=exact(input,['preflight'])&&input.preflight===true?{stage_step:stage,result:'PRIVATE_PIPE_PREFLIGHT_PASS',actual_hosted_requests:0,exit_code:0}:await resumeBatchD(input);}catch{r={stage_step:stage,result:'PRIVATE_INPUT_REVIEW_REQUIRED',actual_hosted_requests:0,exit_code:1};}
 process.stdout.write(JSON.stringify(r));process.exitCode=r.exit_code;
}
