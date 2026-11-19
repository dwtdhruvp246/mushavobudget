// One QUARANTINED-only control upgrade, or inspection of an already completed upgrade.
import {isDeepStrictEqual as equal} from 'node:util';
import {fileURLToPath} from 'node:url';
import {windowHandoffSQL} from './lib/email-window-handoff-sql.mjs';
import {stagingRef} from './lib/email-registration-handoff-sql.mjs';
export const stage='FR.2.4.E5.25_BATCH_L_QUARANTINED_ACCEPTANCE_CONTROL_UPGRADE_AND_READBACK';
export const acknowledgement='INSTALL_BOUNDED_STAGING_CONTROLS_KEEP_QUARANTINED';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&equal(Object.keys(x).sort(),keys.slice().sort());
const codes=new Set(['PRIVATE_INPUT_REQUIRED','TARGET_REQUIRED','RESPONSE_REQUIRED','SNAPSHOT_REQUIRED','CLOSED_CONTROLS_REQUIRED','NETWORK_REQUIRED']);
const need=(v,c)=>{if(!v)throw Object.assign(Error(c),{safeCode:c});};
const safe=e=>codes.has(e?.safeCode)?e.safeCode:'NETWORK_REQUIRED';
const fields=['context','server_version_num','catalog_kind','control_rows','quarantined_stamp_matched','predicate_source_matched','window_present','window_empty','guarded_RPCs','restrictive_policies','backend_forced_RLS_tables','private_schema_API_denied'];
export async function installWindowControls(input,{transport=fetch}={}){
 const r={stage_step:stage,batch:'L',result:'BATCH_L_REVIEW_REQUIRED',actual_hosted_requests:0,maximum_hosted_requests:5,
  target_before_verified:false,quarantined_precheck_verified:false,controls_already_installed_before_run:false,
  upgrade_write_attempts:0,upgrade_HTTP_accepted:false,write_response_problem_code:null,upgrade_write_outcome_uncertain:false,
  independent_readback_attempted:false,bounded_controls_verified:false,window_table_empty:false,quarantined_catalog_after_verified:false,
  target_after_verified:false,automatic_write_retry_performed:false,guarded_RPCs:0,restrictive_policies:0,backend_forced_RLS_tables:0,
  private_schema_API_denied:false,application_rows_read_or_written:false,application_access_opened:false,
  Auth_settings_secrets_schedules_or_deployments_changed:false,email_push_or_FX_dispatched:false,
  private_packets_accessed:false,token_saved_to_disk_arguments_or_environment:false,raw_provider_bodies_printed:false,
  committed_mode_change_requests:0,hosted_acceptance:false,live_activation_approved:false,production_or_native_changed:false,APK_update_deferred:true,
  findings_closed:[],samples:[],checkpoint:'PRIVATE_INPUT',problem_code:null,exit_code:1};
 const row=(x,alias)=>{need(Array.isArray(x)&&x.length===1&&exact(x[0],[alias]),'RESPONSE_REQUIRED');return x[0][alias];};
 let ready=false,version=null;
 const root='https://api.supabase.com/v1/projects/'+stagingRef;
 async function request(label,query){
  r.checkpoint=label;r.actual_hosted_requests++;need(r.actual_hosted_requests<=5,'RESPONSE_REQUIRED');
  const sample={endpoint:label,http_status:null};r.samples.push(sample);const url=root+(query?'/database/query':'');
  const response=await transport(url,{method:query?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(query?60000:30000),headers:{Authorization:'Bearer '+input.token,Accept:'application/json','Cache-Control':'no-store',...(query?{'Content-Type':'application/json'}:{})},...(query?{body:JSON.stringify({query,read_only:false})}:{})});
  sample.http_status=response.status;if(label==='INSTALL_CLOSED_CONTROLS')r.upgrade_HTTP_accepted=response.status===201;
  need(!response.redirected&&(!response.url||response.url===url)&&response.status===(query?201:200)&&/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||''),'RESPONSE_REQUIRED');
  const reader=response.body?.getReader();need(reader,'RESPONSE_REQUIRED');let size=0;const chunks=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;need(size<=65536,'RESPONSE_REQUIRED');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{need(false,'RESPONSE_REQUIRED');}
 }
 const target=x=>need(object(x)&&object(x.database)&&(x.ref===stagingRef||(x.ref===undefined&&x.id===stagingRef))&&!(typeof x.id==='string'&&/^[a-z]{20}$/.test(x.id)&&x.id!==stagingRef)&&x.status==='ACTIVE_HEALTHY'&&x.database.host==='db.'+stagingRef+'.supabase.co','TARGET_REQUIRED');
 function snapshot(x){
  need(exact(x,fields)&&equal(x.context,{privileged_origin:true,transaction_read_only:'on'})&&Number.isInteger(x.server_version_num)&&[15,16,17,18].includes(Math.floor(x.server_version_num/10000))&&(!version||version===x.server_version_num)&&['ORIGINAL','BOUNDED'].includes(x.catalog_kind)&&x.control_rows===1&&x.quarantined_stamp_matched===true&&x.predicate_source_matched===true&&x.guarded_RPCs===148&&x.restrictive_policies===82&&x.backend_forced_RLS_tables===5&&x.private_schema_API_denied===true&&typeof x.window_present==='boolean'&&typeof x.window_empty==='boolean'&&x.window_present===(x.catalog_kind==='BOUNDED')&&(x.catalog_kind!=='BOUNDED'||x.window_empty===true),'SNAPSHOT_REQUIRED');version=x.server_version_num;return x;
 }
 try{
  need(exact(input,['token','acknowledgement'])&&typeof input.token==='string'&&/^sbp_fc[A-Za-z0-9_-]{20,512}$/.test(input.token)&&input.acknowledgement===acknowledgement,'PRIVATE_INPUT_REQUIRED');
  const sql=await windowHandoffSQL();target(await request('TARGET_BEFORE'));r.target_before_verified=true;
  const before=snapshot(row(await request('QUARANTINED_SOURCE_PRECHECK',sql.snapshot),'window_snapshot'));
  r.quarantined_precheck_verified=true;ready=true;r.controls_already_installed_before_run=before.catalog_kind==='BOUNDED';
  if(!r.controls_already_installed_before_run){
   r.upgrade_write_attempts=1;r.upgrade_write_outcome_uncertain=true;
   try{need(equal(row(await request('INSTALL_CLOSED_CONTROLS',sql.write),'window_installation'),{result:'CLOSED_WINDOW_CONTROLS_INSTALLED',mode_change_requested:false}),'RESPONSE_REQUIRED');}catch(e){r.write_response_problem_code=safe(e);}
  }
  r.independent_readback_attempted=true;
  const after=snapshot(row(await request('INDEPENDENT_CLOSED_READBACK',sql.snapshot),'window_snapshot'));
  // ORIGINAL is a current observation, not proof that a timed-out POST cannot arrive later.
  // Only exact installed/closed state resolves the attempted upgrade without a retry.
  r.upgrade_write_outcome_uncertain=r.upgrade_write_attempts>0&&after.catalog_kind!=='BOUNDED';r.quarantined_catalog_after_verified=true;
  r.bounded_controls_verified=after.catalog_kind==='BOUNDED';r.window_table_empty=after.window_empty;
  r.guarded_RPCs=after.guarded_RPCs;r.restrictive_policies=after.restrictive_policies;r.backend_forced_RLS_tables=after.backend_forced_RLS_tables;r.private_schema_API_denied=after.private_schema_API_denied;
  need(r.bounded_controls_verified&&r.window_table_empty,'CLOSED_CONTROLS_REQUIRED');
 }catch(e){r.problem_code=safe(e);}
 finally{
  if(ready){try{target(await request('TARGET_AFTER'));r.target_after_verified=true;}catch(e){r.problem_code??=safe(e);}}
 }
 if(!r.problem_code&&r.bounded_controls_verified&&r.quarantined_catalog_after_verified&&r.target_after_verified){r.result=r.controls_already_installed_before_run?'BATCH_L_EXISTING_CLOSED_CONTROLS_READBACK_PASS':'BATCH_L_CLOSED_CONTROLS_UPGRADED_AND_READ_BACK';r.checkpoint='COMPLETE';r.exit_code=0;}
 r.checked_UTC=new Date().toISOString();return r;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 let r;try{
  need(process.argv.length===3&&process.argv[2]==='--private-parent-pipe'&&!process.stdin.isTTY&&!process.stdout.isTTY,'PRIVATE_INPUT_REQUIRED');
  let size=0;const chunks=[];for await(const b of process.stdin){size+=b.length;need(size<=8192,'PRIVATE_INPUT_REQUIRED');chunks.push(b);}
  const x=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  r=exact(x,['preflight'])&&x.preflight===true?{stage_step:stage,result:'PRIVATE_PIPE_PREFLIGHT_PASS',actual_hosted_requests:0,exit_code:0}:await installWindowControls(x);
 }catch{r={stage_step:stage,result:'PRIVATE_BATCH_L_INPUT_REQUIRED',actual_hosted_requests:0,problem_code:'PRIVATE_INPUT_REQUIRED',exit_code:1};}
 process.stdout.write(JSON.stringify(r));process.exitCode=r.exit_code;
}
