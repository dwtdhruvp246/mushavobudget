// Read-only current-state review after a confirmed configuration write. No installation path.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {decodeSourceMultipart,sourceObservation,matchReviewedArtifact} from './check-fr-2-email-edge-impact.mjs';
export const impactStage='FR.2.4.E5.16R_READ_ONLY_POST_INSTALL_SOURCE_REVIEW';
export const impactRef='dczlddwbtgvfdujgcitb';
export const selectedSlugs=Object.freeze(['invite-admin-user','invite-business-member','send-test-push','sync-exchange-rates']);
export const sixNames=Object.freeze(['APP_ORIGIN','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT','CURRENCYAPI_API_KEY','CURRENCY_SYNC_SECRET']);
const root=new URL('../',import.meta.url);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).sort().join(',')===[...keys].sort().join(',');
const need=(b,c)=>{if(!b)throw Object.assign(Error(c),{safeCode:c});};
const hash=x=>createHash('sha256').update(x).digest('hex');
const digest=x=>hash(JSON.stringify(x));
const codes=new Set(['PRIVATE_TOKEN_INPUT_REQUIRED','TARGET_REVIEW_REQUIRED','FUNCTION_METADATA_REVIEW_REQUIRED','SELECTED_FUNCTION_APPEARED','UNRELATED_FUNCTION_REVIEW_REQUIRED','FUNCTION_DETAIL_REVIEW_REQUIRED','FUNCTION_SOURCE_REVIEW_REQUIRED','FUNCTION_SOURCE_MISMATCH','OBSERVATION_CHANGED','RESPONSE_TOO_LARGE','PROVIDER_GET_REVIEW_REQUIRED','SOURCE_BASELINE_REVIEW_REQUIRED','CONFIGURATION_NAMES_REVIEW_REQUIRED','INSTALLED_NAMES_NOT_OBSERVED']);
function projection(row){
  need(object(row)&&typeof row.slug==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(row.slug)&&typeof row.id==='string'&&row.id.length>0&&row.id.length<=256&&typeof row.status==='string'&&row.status.length<=128&&Number.isSafeInteger(row.version)&&row.version>=1&&typeof row.verify_jwt==='boolean'&&Number.isSafeInteger(row.created_at)&&row.created_at>=0&&Number.isSafeInteger(row.updated_at)&&row.updated_at>=row.created_at,'FUNCTION_METADATA_REVIEW_REQUIRED');
  return Object.fromEntries(['slug','id','status','version','verify_jwt','created_at','updated_at'].map(k=>[k,row[k]]));
}
function list(rows){
  need(Array.isArray(rows)&&rows.length<=256,'FUNCTION_METADATA_REVIEW_REQUIRED');const p=rows.map(projection).sort((a,b)=>a.slug<b.slug?-1:a.slug>b.slug?1:0);
  need(new Set(p.map(x=>x.slug)).size===p.length,'FUNCTION_METADATA_REVIEW_REQUIRED');return p;
}
function providerPath(value){
  need(typeof value==='string'&&value.length>0&&value.length<=2048&&!/[\\\x00-\x1f%?#]/.test(value),'FUNCTION_SOURCE_REVIEW_REQUIRED');
  // Reject traversal before URL parsing, which otherwise normalizes dot segments.
  need(!value.split('/').some(x=>x==='..'||x==='.'),'FUNCTION_SOURCE_REVIEW_REQUIRED');
  let p=value;if(value.startsWith('file:///')){const u=new URL(value);need(u.host===''&&!u.search&&!u.hash,'FUNCTION_SOURCE_REVIEW_REQUIRED');p=u.pathname;}
  need(!p.includes('://')&&!p.split('/').some(x=>x==='..'||x==='.')&&path.posix.normalize(p)===p,'FUNCTION_SOURCE_REVIEW_REQUIRED');return p;
}
function detail(row,before){
  need(digest(projection(row))===digest(before)&&row.status==='ACTIVE'&&row.verify_jwt===false&&row.import_map===false&&(!row.import_map_path||row.import_map_path===''),'FUNCTION_DETAIL_REVIEW_REQUIRED');
  const entry=providerPath(row.entrypoint_path);need(entry.endsWith('/index.ts'),'FUNCTION_DETAIL_REVIEW_REQUIRED');
  need(row.ezbr_sha256===undefined||(typeof row.ezbr_sha256==='string'&&/^[a-f0-9]{64}$/.test(row.ezbr_sha256)),'FUNCTION_DETAIL_REVIEW_REQUIRED');
  return {metadata:projection(row),entrypoint_path:entry,import_map:false,import_map_path:row.import_map_path??null,ezbr_sha256:row.ezbr_sha256??null};
}
export async function reviewInstalledEdge(input,{transport=fetch,baselineReceipt}={}){
  const r={stage_step:impactStage,result:'POST_INSTALL_CURRENT_STATE_REVIEW_REQUIRED',requests_attempted:0,
    fixed_staging_project_metadata_matched:false,fixed_staging_database_host_matched:false,
    prior_metadata_fingerprint_matches:false,prior_function_ID_or_version_equality_independently_verified:false,metadata_change_cause_verified:false,selected_functions_absent_before_and_after:false,
    single_unrelated_function_matches_reviewed_contact_slug:false,detail_metadata_agreed_before_and_after:false,
    other_function_metadata_SHA256:null,downloaded_source_files:0,source_observation:sourceObservation(),source_comparison:[],exact_reviewed_contact_source_bytes_match:false,installed_configuration_names:[],all_six_names_listed:false,
    reviewed_contact_artifacts_match:false,source_review_basis:'NOT_ESTABLISHED',downloaded_source_normalized_for_acceptance:false,
    six_names_not_consumed_by_matched_source:false,
    shared_configuration_runtime_impact_verified:false,previous_deployable_artifact_retained:false,
    recovery_execution_verified:false,configuration_values_collected:false,secret_name_metadata_endpoint_used:false,
    application_rows_read:false,Edge_functions_invoked:0,SQL_endpoint_used:false,secret_write_attempted:false,downloaded_source_executed_or_saved:false,
    raw_source_provider_bodies_paths_or_unselected_identifiers_printed:false,token_saved_to_disk_or_environment:false,
    token_permission_scope_independently_inspected:false,metadata_snapshot_is_not_a_write_lock:true,
    settings_data_roles_grants_or_schedules_changed:false,email_push_or_FX_dispatched:false,
    readiness_approved:false,uploaded_or_deployed:false,live_activation_approved:false,hosted_acceptance:false,
    production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],samples:[],checkpoint:'PRIVATE_INPUT',problem_code:null,exit_code:1};
  try{
    need(exact(input,['token'])&&typeof input.token==='string'&&/^sbp_fc[A-Za-z0-9_-]{20,512}$/.test(input.token),'PRIVATE_TOKEN_INPUT_REQUIRED');
    const baseline=baselineReceipt??JSON.parse(await readFile(new URL('docs/security-audit/security-fr-2-email-edge-readiness-owner-observation.json',root),'utf8'));
    need(baseline.receipt?.stage_step==='FR.2.4.E5.12_EDGE_CONFIGURATION_AND_SCHEDULER_READINESS'&&baseline.receipt.other_function_count===1&&baseline.receipt.selected_functions_still_absent===true&&/^[a-f0-9]{64}$/.test(baseline.receipt.other_function_metadata_SHA256),'SOURCE_BASELINE_REVIEW_REQUIRED');
    async function get(label,suffix,{multipart=false}={}){
      r.checkpoint=label;r.requests_attempted++;need(r.requests_attempted<=7,'PROVIDER_GET_REVIEW_REQUIRED');
      const sample={endpoint:label,http_status:null,bounded_body_received:false};r.samples.push(sample);
      const url='https://api.supabase.com/v1/projects/'+impactRef+suffix;
      const response=await transport(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),headers:{Authorization:'Bearer '+input.token,Accept:multipart?'multipart/form-data':'application/json','Cache-Control':'no-store'}});
      sample.http_status=Number.isInteger(response.status)?response.status:null;
      if(response.status!==200||response.redirected||(response.url&&response.url!==url)){
        await response.body?.cancel();need(false,'PROVIDER_GET_REVIEW_REQUIRED');
      }
      const type=response.headers.get('content-type')||'';
      if(!(multipart?/^multipart\/form-data;/i:/^application\/json(?:\s*;|$)/i).test(type)){await response.body?.cancel();need(false,multipart?'FUNCTION_SOURCE_REVIEW_REQUIRED':'PROVIDER_GET_REVIEW_REQUIRED');}
      const reader=response.body?.getReader();need(reader,'PROVIDER_GET_REVIEW_REQUIRED');const chunks=[];let size=0;
      try{for(;;){const{done,value}=await reader.read();if(done)break;size+=value.length;need(size<=(multipart?2097152:262144),'RESPONSE_TOO_LARGE');chunks.push(value);}}
      finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
      const bytes=Buffer.concat(chunks);sample.bounded_body_received=true;
      if(multipart)return {bytes,type};try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{need(false,'PROVIDER_GET_REVIEW_REQUIRED');}
    }
    const project=await get('STAGING_PROJECT_METADATA','');
    need(object(project)&&(project.ref===impactRef||(project.ref===undefined&&project.id===impactRef))&&!(typeof project.id==='string'&&/^[a-z]{20}$/.test(project.id)&&project.id!==impactRef)&&project.status==='ACTIVE_HEALTHY','TARGET_REVIEW_REQUIRED');r.fixed_staging_project_metadata_matched=true;
    need(project.database?.host==='db.'+impactRef+'.supabase.co','TARGET_REVIEW_REQUIRED');r.fixed_staging_database_host_matched=true;
    const before=list(await get('STAGING_FUNCTION_LIST_BEFORE','/functions'));
    need(!before.some(x=>selectedSlugs.includes(x.slug)),'SELECTED_FUNCTION_APPEARED');need(before.length===1,'UNRELATED_FUNCTION_REVIEW_REQUIRED');
    r.other_function_metadata_SHA256=digest(before);r.prior_metadata_fingerprint_matches=r.other_function_metadata_SHA256===baseline.receipt.other_function_metadata_SHA256;
    need(before[0].slug==='submit-enquiry','UNRELATED_FUNCTION_REVIEW_REQUIRED');r.single_unrelated_function_matches_reviewed_contact_slug=true;
    const first=detail(await get('STAGING_CONTACT_DETAIL_BEFORE','/functions/submit-enquiry'),before[0]);
    const source=await get('STAGING_CONTACT_SOURCE','/functions/submit-enquiry/body',{multipart:true});
    const files=decodeSourceMultipart(source.bytes,source.type,first.entrypoint_path,r.source_observation);r.downloaded_source_files=files.size;
    for(const name of ['index.ts','handler.mjs']){
      const local=await readFile(new URL('supabase/functions/submit-enquiry/'+name,root));
      r.source_comparison.push({name,exact_original_LF_bytes_match:files.get(name).equals(local),...matchReviewedArtifact(name,files.get(name),local)});
    }
    need(r.source_comparison.every(x=>x.reviewed_artifact_exact_bytes_match),'FUNCTION_SOURCE_MISMATCH');
    r.exact_reviewed_contact_source_bytes_match=r.source_comparison.every(x=>x.exact_original_LF_bytes_match);
    r.reviewed_contact_artifacts_match=true;
    r.source_review_basis=r.exact_reviewed_contact_source_bytes_match?'EXACT_REVIEWED_LF_ARTIFACTS':
      r.source_comparison.every(x=>x.reviewed_artifact_variant==='PINNED_OWNER_OBSERVED_CRLF')?'EXACT_PINNED_CRLF_ARTIFACTS':'EXACT_REVIEWED_LF_AND_PINNED_CRLF_ARTIFACTS';
    // Bound to the exact LF or pinned reproduced CRLF artifacts of the two reviewed
    // files, not a scan of unknown code or proof of all runtime/platform behavior.
    r.six_names_not_consumed_by_matched_source=true;
    const last=detail(await get('STAGING_CONTACT_DETAIL_AFTER','/functions/submit-enquiry'),before[0]);
    need(digest(first)===digest(last),'OBSERVATION_CHANGED');r.detail_metadata_agreed_before_and_after=true;
    const after=list(await get('STAGING_FUNCTION_LIST_AFTER','/functions'));need(digest(before)===digest(after),'OBSERVATION_CHANGED');r.selected_functions_absent_before_and_after=true;
    const names=await get('STAGING_INSTALLED_CONFIGURATION_NAMES','/secrets');r.secret_name_metadata_endpoint_used=true;
    need(Array.isArray(names)&&names.length<=256,'CONFIGURATION_NAMES_REVIEW_REQUIRED');const seen=new Set();
    for(const row of names){need(object(row)&&typeof row.name==='string'&&/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(row.name)&&!seen.has(row.name),'CONFIGURATION_NAMES_REVIEW_REQUIRED');seen.add(row.name);}
    r.installed_configuration_names=sixNames.map(name=>({name,listed:seen.has(name)}));r.all_six_names_listed=r.installed_configuration_names.every(x=>x.listed);
    need(r.all_six_names_listed,'INSTALLED_NAMES_NOT_OBSERVED');
    r.result='CURRENT_CONTACT_ARTIFACTS_AND_SIX_INSTALLED_NAMES_SCOPED_PASS_CAUSE_UNVERIFIED';r.checkpoint='COMPLETE';r.exit_code=0;
  }catch(error){r.problem_code=codes.has(error?.safeCode)?error.safeCode:'PROVIDER_GET_REVIEW_REQUIRED';}
  r.checked_UTC=new Date().toISOString();return r;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  let r;try{
    need(process.argv.length===3&&process.argv[2]==='--private-parent-pipe'&&!process.stdin.isTTY&&!process.stdout.isTTY,'PRIVATE_TOKEN_INPUT_REQUIRED');
    let size=0;const chunks=[];for await(const chunk of process.stdin){size+=chunk.length;need(size<=8192,'PRIVATE_TOKEN_INPUT_REQUIRED');chunks.push(chunk);}
    const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));r=exact(input,['preflight'])&&input.preflight===true?{stage_step:impactStage,result:'PRIVATE_PIPE_PREFLIGHT_PASS',requests_attempted:0,exit_code:0}:await reviewInstalledEdge(input);
  }catch{r={stage_step:impactStage,result:'PRIVATE_EDGE_IMPACT_INPUT_REVIEW_REQUIRED',requests_attempted:0,problem_code:'PRIVATE_TOKEN_INPUT_REQUIRED',exit_code:1};}
  process.stdout.write(JSON.stringify(r));process.exitCode=r.exit_code;
}
