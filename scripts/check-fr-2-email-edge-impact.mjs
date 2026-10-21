// Private fixed-project GETs only. Downloaded source is data, never imported or saved.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const impactStage='FR.2.4.E5.13_PRIVATE_EDGE_CONFIGURATION_AND_SHARED_IMPACT_PREPARATION';
export const impactRef='dczlddwbtgvfdujgcitb';
export const selectedSlugs=Object.freeze(['invite-admin-user','invite-business-member','send-test-push','sync-exchange-rates']);
export const sixNames=Object.freeze(['APP_ORIGIN','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT','CURRENCYAPI_API_KEY','CURRENCY_SYNC_SECRET']);
const root=new URL('../',import.meta.url);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).sort().join(',')===[...keys].sort().join(',');
const need=(b,c)=>{if(!b)throw Object.assign(Error(c),{safeCode:c});};
const hash=x=>createHash('sha256').update(x).digest('hex');
const digest=x=>hash(JSON.stringify(x));
const codes=new Set(['PRIVATE_TOKEN_INPUT_REQUIRED','TARGET_REVIEW_REQUIRED','FUNCTION_METADATA_REVIEW_REQUIRED','BASELINE_METADATA_CHANGED','SELECTED_FUNCTION_APPEARED','UNRELATED_FUNCTION_REVIEW_REQUIRED','FUNCTION_DETAIL_REVIEW_REQUIRED','FUNCTION_SOURCE_REVIEW_REQUIRED','FUNCTION_SOURCE_MISMATCH','OBSERVATION_CHANGED','RESPONSE_TOO_LARGE','PROVIDER_GET_REVIEW_REQUIRED','SOURCE_BASELINE_REVIEW_REQUIRED']);
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
export function sourceObservation(){
  return {decoder_step:'NOT_REACHED',multipart_parts_observed:0,file_parts_observed:0,source_files_decoded:0,
    parts_with_content_disposition:0,parts_with_supabase_path:0,parts_with_quoted_filename:0,
    metadata_part_observed:false,metadata_has_primary_entrypoint:false,metadata_has_deno2_entrypoint:false,
    metadata_entrypoint_matches_detail:null,body_entrypoint_selected:'NOT_REACHED',body_entrypoint_form:'NOT_REACHED',entrypoint_mapping_verified:false,mapped_relative_file_count:0,
    file_path_forms:{absolute_posix:0,file_URL:0,relative:0,unsupported:0},
    expected_relative_files:[{name:'index.ts',observed:false},{name:'handler.mjs',observed:false}],unexpected_relative_file_count:0};
}
// Strict bounded multipart decoder. Diagnostic fields describe fixed format
// categories only; paths, source, metadata values and headers never leave memory.
export function decodeSourceMultipart(bytes,type,entrypoint,observation=sourceObservation()){
  const step=value=>{observation.decoder_step=value;};
  step('BODY_BOUNDS');
  need(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=2097152,'FUNCTION_SOURCE_REVIEW_REQUIRED');
  step('CONTENT_TYPE_BOUNDARY');
  const m=/^multipart\/form-data;\s*boundary=(?:"([A-Za-z0-9_+=:.,/-]{1,70})"|([A-Za-z0-9_+=:.,/-]{1,70}))\s*$/i.exec(type);
  need(m,'FUNCTION_SOURCE_REVIEW_REQUIRED');const boundary=m[1]||m[2],opening=Buffer.from('--'+boundary+'\r\n'),sep=Buffer.from('\r\n--'+boundary);
  step('OPENING_BOUNDARY');
  need(bytes.subarray(0,opening.length).equals(opening),'FUNCTION_SOURCE_REVIEW_REQUIRED');let at=opening.length,parts=0,metadata=null;const files=new Map();
  for(;;){
    step('PART_LIMIT');observation.multipart_parts_observed=++parts;
    need(parts<=8,'FUNCTION_SOURCE_REVIEW_REQUIRED');const end=bytes.indexOf(sep,at),headEnd=bytes.indexOf('\r\n\r\n',at);
    step('PART_FRAMING');
    need(end>=0&&headEnd>=at&&headEnd<end&&headEnd-at<=8192,'FUNCTION_SOURCE_REVIEW_REQUIRED');
    step('PART_HEADERS');
    const headers=new Map();for(const line of bytes.subarray(at,headEnd).toString('utf8').split('\r\n')){
      const h=/^([A-Za-z0-9-]+):[ \t]*([^\r\n]*)$/.exec(line);need(h&&!headers.has(h[1].toLowerCase()),'FUNCTION_SOURCE_REVIEW_REQUIRED');headers.set(h[1].toLowerCase(),h[2]);
    }
    const cd=headers.get('content-disposition')||'';
    observation.parts_with_content_disposition+=headers.has('content-disposition')?1:0;
    observation.parts_with_supabase_path+=headers.has('supabase-path')?1:0;
    step('CONTENT_DISPOSITION');
    need(/^form-data(?:;|$)/i.test(cd)&&!cd.includes('filename*='),'FUNCTION_SOURCE_REVIEW_REQUIRED');
    step('PART_PARAMETERS');
    const param=name=>{const matches=[...cd.matchAll(new RegExp('(?:^|;)\\s*'+name+'="([^"\\\\]*)"','gi'))];need(matches.length<=1,'FUNCTION_SOURCE_REVIEW_REQUIRED');return matches[0]?.[1];};
    const name=param('name'),filename=param('filename'),supabasePath=headers.get('supabase-path');
    observation.parts_with_quoted_filename+=filename!==undefined?1:0;
    const body=bytes.subarray(headEnd+4,end);
    if(name==='metadata'&&!filename&&!supabasePath){
      step('METADATA_PART');observation.metadata_part_observed=true;
      need(metadata===null&&body.length<=8192,'FUNCTION_SOURCE_REVIEW_REQUIRED');try{metadata=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));}catch{need(false,'FUNCTION_SOURCE_REVIEW_REQUIRED');}
      need(object(metadata),'FUNCTION_SOURCE_REVIEW_REQUIRED');
      observation.metadata_has_primary_entrypoint=Object.hasOwn(metadata,'entrypoint_path');
      observation.metadata_has_deno2_entrypoint=Object.hasOwn(metadata,'deno2_entrypoint_path');
    }else{
      step('FILE_PART_PATH');observation.file_parts_observed++;
      const value=supabasePath||filename;
      const form=typeof value!=='string'||value.length===0?'unsupported':value.startsWith('file:///')?'file_URL':value.startsWith('/')?'absolute_posix':value.includes('://')||value.includes('\\')?'unsupported':'relative';
      observation.file_path_forms[form]++;
      const p=providerPath(value);step('FILE_PART_IDENTITY');need(!files.has(p)&&body.length>0,'FUNCTION_SOURCE_REVIEW_REQUIRED');files.set(p,body);observation.source_files_decoded=files.size;
    }
    step('NEXT_OR_CLOSING_BOUNDARY');
    const tail=end+sep.length;
    if(bytes.subarray(tail,tail+2).toString()==='--'){
      const rest=bytes.subarray(tail+2).toString();need(rest===''||rest==='\r\n','FUNCTION_SOURCE_REVIEW_REQUIRED');break;
    }
    need(bytes.subarray(tail,tail+2).toString()==='\r\n','FUNCTION_SOURCE_REVIEW_REQUIRED');at=tail+2;
  }
  let bodyEntrypoint=entrypoint;observation.body_entrypoint_selected='DETAIL_FALLBACK';
  if(metadata){
    step('METADATA_ENTRYPOINT');
    observation.metadata_has_primary_entrypoint=Object.hasOwn(metadata,'entrypoint_path');
    observation.metadata_has_deno2_entrypoint=Object.hasOwn(metadata,'deno2_entrypoint_path');
    const deno2=metadata.deno2_entrypoint_path;
    const hasDeno2=typeof deno2==='string'&&deno2.length>0;
    need(deno2===undefined||deno2===null||typeof deno2==='string','FUNCTION_SOURCE_REVIEW_REQUIRED');
    const entry=hasDeno2?deno2:metadata.entrypoint_path;
    need(entry!==undefined,'FUNCTION_SOURCE_REVIEW_REQUIRED');bodyEntrypoint=providerPath(entry);
    observation.body_entrypoint_selected=hasDeno2?'DENO2_METADATA':'PRIMARY_METADATA';
    observation.metadata_entrypoint_matches_detail=bodyEntrypoint===entrypoint;
  }
  step('ENTRYPOINT_MAPPING');
  need(path.posix.basename(bodyEntrypoint)==='index.ts','FUNCTION_SOURCE_REVIEW_REQUIRED');
  observation.body_entrypoint_form=path.posix.isAbsolute(bodyEntrypoint)?'ABSOLUTE_POSIX':'RELATIVE';
  step('EXPECTED_SOURCE_FILE_COUNT');
  need(files.size===2,'FUNCTION_SOURCE_REVIEW_REQUIRED');const relative=new Map();
  const virtualRoot='/reviewed-contact';
  for(const [p,body]of files){
    step('EXPECTED_SOURCE_RELATIVE_PATHS');
    // Match the pinned Supabase CLI's metadata precedence and path-space mapping,
    // but require the result to be exactly our two reviewed files. This virtual
    // directory is string arithmetic only; it is never created or accessed.
    const fromEntrypoint=path.posix.isAbsolute(bodyEntrypoint)===path.posix.isAbsolute(p)
      ?path.posix.relative(bodyEntrypoint,p):path.posix.join('..',p);
    const destination=fromEntrypoint.length===0?path.posix.resolve(virtualRoot,'index.ts')
      :path.posix.resolve(virtualRoot,'index.ts',...fromEntrypoint.split('/'));
    const relativePath=path.posix.relative(virtualRoot,destination);
    const expected=observation.expected_relative_files.find(x=>x.name===relativePath);
    if(expected)expected.observed=true;else observation.unexpected_relative_file_count++;
    need(['index.ts','handler.mjs'].includes(relativePath)&&!relative.has(relativePath),'FUNCTION_SOURCE_REVIEW_REQUIRED');relative.set(relativePath,body);
    if(!path.posix.isAbsolute(p))observation.mapped_relative_file_count++;
  }
  observation.entrypoint_mapping_verified=true;
  step('COMPLETE');
  return relative;
}
export async function checkEdgeImpact(input,{transport=fetch,baselineReceipt}={}){
  const r={stage_step:impactStage,diagnostic_revision:3,result:'STAGING_EDGE_SHARED_IMPACT_REVIEW_REQUIRED',requests_attempted:0,
    fixed_staging_project_metadata_matched:false,fixed_staging_database_host_matched:false,
    prior_other_function_metadata_matched:false,selected_functions_absent_before_and_after:false,
    single_unrelated_function_matches_reviewed_contact_slug:false,detail_metadata_agreed_before_and_after:false,
    other_function_metadata_SHA256:null,downloaded_source_files:0,source_observation:sourceObservation(),exact_reviewed_contact_source_bytes_match:false,
    six_names_not_consumed_by_matched_source:false,
    shared_configuration_runtime_impact_verified:false,previous_deployable_artifact_retained:false,
    recovery_execution_verified:false,configuration_values_collected:false,secret_or_SQL_endpoint_used:false,
    application_rows_read:false,Edge_functions_invoked:0,downloaded_source_executed_or_saved:false,
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
      r.checkpoint=label;r.requests_attempted++;need(r.requests_attempted<=6,'PROVIDER_GET_REVIEW_REQUIRED');
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
    r.other_function_metadata_SHA256=digest(before);need(r.other_function_metadata_SHA256===baseline.receipt.other_function_metadata_SHA256,'BASELINE_METADATA_CHANGED');r.prior_other_function_metadata_matched=true;
    need(before[0].slug==='submit-enquiry','UNRELATED_FUNCTION_REVIEW_REQUIRED');r.single_unrelated_function_matches_reviewed_contact_slug=true;
    const first=detail(await get('STAGING_CONTACT_DETAIL_BEFORE','/functions/submit-enquiry'),before[0]);
    const source=await get('STAGING_CONTACT_SOURCE','/functions/submit-enquiry/body',{multipart:true});
    const files=decodeSourceMultipart(source.bytes,source.type,first.entrypoint_path,r.source_observation);r.downloaded_source_files=files.size;
    for(const [name,bytes]of files){const local=await readFile(new URL('supabase/functions/submit-enquiry/'+name,root));need(bytes.equals(local),'FUNCTION_SOURCE_MISMATCH');}
    r.exact_reviewed_contact_source_bytes_match=true;
    // This conclusion is bound to the two exact reviewed files, not a lexical scan
    // of unknown code or a claim about all runtime/platform behavior.
    r.six_names_not_consumed_by_matched_source=true;
    const last=detail(await get('STAGING_CONTACT_DETAIL_AFTER','/functions/submit-enquiry'),before[0]);
    need(digest(first)===digest(last),'OBSERVATION_CHANGED');r.detail_metadata_agreed_before_and_after=true;
    const after=list(await get('STAGING_FUNCTION_LIST_AFTER','/functions'));need(digest(before)===digest(after),'OBSERVATION_CHANGED');r.selected_functions_absent_before_and_after=true;
    r.result='STAGING_CONTACT_SOURCE_PARITY_OBSERVED_NOT_CONFIGURATION_APPROVAL';r.checkpoint='COMPLETE';r.exit_code=0;
  }catch(error){r.problem_code=codes.has(error?.safeCode)?error.safeCode:'PROVIDER_GET_REVIEW_REQUIRED';}
  r.checked_UTC=new Date().toISOString();return r;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  let r;try{
    need(process.argv.length===3&&process.argv[2]==='--private-parent-pipe'&&!process.stdin.isTTY&&!process.stdout.isTTY,'PRIVATE_TOKEN_INPUT_REQUIRED');
    let size=0;const chunks=[];for await(const chunk of process.stdin){size+=chunk.length;need(size<=8192,'PRIVATE_TOKEN_INPUT_REQUIRED');chunks.push(chunk);}
    const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));r=exact(input,['preflight'])&&input.preflight===true?{stage_step:impactStage,result:'PRIVATE_PIPE_PREFLIGHT_PASS',requests_attempted:0,exit_code:0}:await checkEdgeImpact(input);
  }catch{r={stage_step:impactStage,result:'PRIVATE_EDGE_IMPACT_INPUT_REVIEW_REQUIRED',requests_attempted:0,problem_code:'PRIVATE_TOKEN_INPUT_REQUIRED',exit_code:1};}
  process.stdout.write(JSON.stringify(r));process.exitCode=r.exit_code;
}
