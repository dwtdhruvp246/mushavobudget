// Scoped temporary finance fixture around the existing full-app controller.
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline';
import {isDeepStrictEqual as equal} from 'node:util';
import {controlledProbe,privateDialogue,acknowledgement,stage} from './check-fr-2-email-batch-u-hosted.mjs';
import {scopedPlanSQL,scopedSnapshotSQL,scopedCreateSQL,scopedDeleteSQL} from './lib/full-app-scoped-fixture-sql.mjs';
import {stateSQL} from './lib/email-bounded-http-sql.mjs';
import {stagingRef} from './lib/email-registration-handoff-sql.mjs';
export {stage};
export const scopedAcknowledgement='ONE_TEMP_PERSONAL_TEST_ITEM_ONE_EMAIL_FIVE_MINUTES_THEN_EXACT_CLEANUP';
const ctx={privileged_origin:true,transaction_read_only:'on'},object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),exact=(x,k)=>object(x)&&equal(Object.keys(x).sort(),k.slice().sort()),hash=x=>typeof x==='string'&&/^[a-f0-9]{32}$/.test(x);
const need=(v,c)=>{if(!v)throw Error(c);},safe=e=>/^SCOPED_FIXTURE_[A-Z0-9_]+$/.test(e?.message||'')?e.message:'SCOPED_FIXTURE_NETWORK_OR_RESPONSE_REQUIRED';
function preserved(x){return exact(x,['context','prior_sessions','prior_devices','payment_items','payment_records'])&&equal(x.context,ctx)&&['prior_sessions','prior_devices','payment_items','payment_records'].every(k=>hash(x[k]));}
export async function scopedProbe(input,{transport=fetch,readCode,createBrowser,coreProbe=controlledProbe}={}){
 const f={scope:'ONE_PRIVILEGED_STAGING_TEMPORARY_PERSONAL_ITEM',preparation_reached:false,empty_personal_scope_verified:false,create_write_attempts:0,create_response_problem_code:null,create_write_outcome_uncertain:false,independent_created_row_verified:false,cleanup_inspection_attempted:false,delete_write_attempts:0,delete_response_problem_code:null,delete_write_outcome_uncertain:false,exact_fixture_absent_verified:false,existing_Auth_device_and_finance_state_preserved:false,final_quarantine_catalog_verified:false,final_target_verified:false,extra_direct_requests:0,maximum_extra_direct_requests:12,problem_code:null,cleanup_problem_code:null,cleanup_readback_problem_code:null,final_absence_readback_resolved:false,samples:[]};
 let actors,plan,baseline,expectedHash=null,inner;
 const base='https://api.supabase.com/v1/projects/'+stagingRef;
 const request=async(label,query)=>{need(++f.extra_direct_requests<=12,'SCOPED_FIXTURE_REQUEST_BOUND');const sample={endpoint:label,http_status:null};f.samples.push(sample);const url=base+(query?'/database/query':'');const r=await transport(url,{method:query?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(40000),headers:{Authorization:'Bearer '+input.managementToken,Accept:'application/json',...(query?{'Content-Type':'application/json'}:{})},...(query?{body:JSON.stringify({query,read_only:false})}:{})});sample.http_status=r.status;need(r.status===(query?201:200)&&!r.redirected&&(!r.url||r.url===url)&&/^application\/json(?:\s*;|$)/i.test(r.headers.get('content-type')||''),'SCOPED_FIXTURE_RESPONSE_REQUIRED');const reader=r.body?.getReader();need(reader,'SCOPED_FIXTURE_RESPONSE_REQUIRED');let n=0;const parts=[];try{for(;;){const q=await reader.read();if(q.done)break;need((n+=q.value.length)<=131072,'SCOPED_FIXTURE_RESPONSE_BOUND');parts.push(q.value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)));};
 const row=(x,k)=>{need(Array.isArray(x)&&x.length===1&&exact(x[0],[k]),'SCOPED_FIXTURE_RESPONSE_REQUIRED');return x[0][k];};
 const snapshot=async label=>{const x=row(await request(label,scopedSnapshotSQL(actors,plan)),'scoped_snapshot');need(exact(x,['context','closed','absent','exact_row','row_fingerprint','records_absent','preservation'])&&equal(x.context,ctx)&&x.closed===true&&typeof x.absent==='boolean'&&typeof x.exact_row==='boolean'&&typeof x.records_absent==='boolean'&&(x.row_fingerprint===null||hash(x.row_fingerprint))&&preserved(x.preservation),'SCOPED_FIXTURE_SNAPSHOT_REQUIRED');return x;};
 try{
  need(input?.acknowledgement===scopedAcknowledgement,'SCOPED_FIXTURE_ACK_REQUIRED');
  inner=await coreProbe({...input,acknowledgement},{transport,readCode,createBrowser,beforePrerequisites:async selected=>{
   f.preparation_reached=true;actors=selected;
   try{
    const x=row(await request('SCOPED_FIXTURE_READ_ONLY_PLAN',scopedPlanSQL(actors)),'scoped_plan');need(exact(x,['context','closed','personal_count','id_absent','plan','preservation'])&&equal(x.context,ctx)&&x.closed===true&&x.personal_count===0&&x.id_absent===true&&exact(x.plan,['id','workspace','currency','date'])&&preserved(x.preservation),'SCOPED_FIXTURE_EMPTY_PLAN_REQUIRED');plan=x.plan;baseline=x.preservation;f.empty_personal_scope_verified=true;
    const create=await scopedCreateSQL(actors,plan);f.create_write_attempts=1;f.create_write_outcome_uncertain=true;
    try{const w=row(await request('SCOPED_FIXTURE_CREATE_ONCE',create),'scoped_created');need(exact(w,['created','row_fingerprint'])&&w.created===true&&hash(w.row_fingerprint),'SCOPED_FIXTURE_CREATE_RESPONSE_REQUIRED');expectedHash=w.row_fingerprint;}catch(e){f.create_response_problem_code=safe(e);}
    const s=await snapshot('SCOPED_FIXTURE_INDEPENDENT_CREATE_READBACK');if(s.absent){f.create_write_outcome_uncertain=false;throw Error('SCOPED_FIXTURE_CREATE_NOT_COMMITTED');}
    need(s.exact_row&&s.records_absent&&hash(s.row_fingerprint)&&(!expectedHash||s.row_fingerprint===expectedHash)&&equal(s.preservation,baseline),'SCOPED_FIXTURE_CREATE_READBACK_REQUIRED');expectedHash=s.row_fingerprint;f.create_write_outcome_uncertain=false;f.independent_created_row_verified=true;
   }catch(e){f.problem_code=safe(e);throw e;}
  }});
 }catch(e){f.problem_code??=safe(e);}
 finally{
  if(f.create_write_attempts){
   let s;
   try{f.cleanup_inspection_attempted=true;s=await snapshot('SCOPED_FIXTURE_INSPECT_BEFORE_CLEANUP');
    if(s.absent){f.create_write_outcome_uncertain=false;f.exact_fixture_absent_verified=true;}
    else {need(s.exact_row&&s.records_absent&&expectedHash!==null&&s.row_fingerprint===expectedHash,'SCOPED_FIXTURE_CHANGED_OR_UNIDENTIFIED_ROW_REFUSED');need(s.preservation.payment_items===baseline.payment_items&&s.preservation.payment_records===baseline.payment_records,'SCOPED_FIXTURE_FINANCE_DRIFT_REFUSED');
     const q=await scopedDeleteSQL(actors,plan,expectedHash,baseline);f.delete_write_attempts=1;f.delete_write_outcome_uncertain=true;
     try{need(equal(row(await request('SCOPED_FIXTURE_EXACT_DELETE_ONCE',q),'scoped_deleted'),{deleted:true}),'SCOPED_FIXTURE_DELETE_RESPONSE_REQUIRED');}catch(e){f.delete_response_problem_code=safe(e);}
     s=await snapshot('SCOPED_FIXTURE_INDEPENDENT_DELETE_READBACK');if(s.exact_row&&s.row_fingerprint===expectedHash)f.delete_write_outcome_uncertain=false;need(s.absent&&s.records_absent,'SCOPED_FIXTURE_ABSENCE_REQUIRED');f.exact_fixture_absent_verified=true;f.create_write_outcome_uncertain=false;f.delete_write_outcome_uncertain=false;
    }
    need(equal(s.preservation,baseline),'SCOPED_FIXTURE_EXISTING_STATE_DRIFT');f.existing_Auth_device_and_finance_state_preserved=true;
   }catch(e){f.cleanup_problem_code=safe(e);f.cleanup_readback_problem_code=safe(e);}
   // Independent absence inspection still happens after any lost delete response.
   if(f.delete_write_attempts&&!f.exact_fixture_absent_verified){try{s=await snapshot('SCOPED_FIXTURE_FINAL_ABSENCE_INSPECTION');if(s.exact_row&&s.row_fingerprint===expectedHash)f.delete_write_outcome_uncertain=false;if(s.absent&&s.records_absent&&equal(s.preservation,baseline)){f.exact_fixture_absent_verified=true;f.create_write_outcome_uncertain=false;f.delete_write_outcome_uncertain=false;f.existing_Auth_device_and_finance_state_preserved=true;f.cleanup_problem_code=null;f.final_absence_readback_resolved=true;}}catch{}}
   try{const state=row(await request('SCOPED_FIXTURE_FINAL_QUARANTINE_CATALOG',await stateSQL()),'bounded_state');need(equal(state?.context,ctx)&&state.mode==='QUARANTINED'&&state.window_empty===true&&state.catalog_kind==='BOUNDED'&&state.stamp_matched===true&&state.predicate_source_matched===true&&state.quarantined_stamp_matched===true&&state.guarded_RPCs===148&&state.restrictive_policies===82&&state.backend_forced_RLS_tables===5&&state.private_schema_API_denied===true,'SCOPED_FIXTURE_FINAL_QUARANTINE_REQUIRED');f.final_quarantine_catalog_verified=true;}catch(e){f.cleanup_problem_code??=safe(e);}
   try{const t=await request('SCOPED_FIXTURE_FINAL_TARGET');need(object(t)&&(t.ref===stagingRef||t.ref===undefined&&t.id===stagingRef)&&!(typeof t.id==='string'&&/^[a-z]{20}$/.test(t.id)&&t.id!==stagingRef)&&t.status==='ACTIVE_HEALTHY'&&t.database?.host==='db.'+stagingRef+'.supabase.co','SCOPED_FIXTURE_TARGET_REQUIRED');f.final_target_verified=true;}catch(e){f.cleanup_problem_code??=safe(e);}
  }
 }
 const ok=inner?.exit_code===0&&f.independent_created_row_verified&&f.exact_fixture_absent_verified&&f.existing_Auth_device_and_finance_state_preserved&&f.final_quarantine_catalog_verified&&f.final_target_verified&&!f.problem_code&&!f.cleanup_problem_code;
 const r={...(inner||{stage_step:stage,batch:'U',actual_hosted_requests:0,checkpoint:'SCOPED_FIXTURE_INPUT',problem_code:f.problem_code,exit_code:1}),result:ok?'BATCH_U_SCOPED_FIXTURE_FULL_APP_AND_EXACT_CLEANUP_PASS':'BATCH_U_SCOPED_FIXTURE_FULL_APP_REVIEW_REQUIRED',acceptance_core_direct_HTTP_requests:inner?.actual_hosted_requests||0,actual_hosted_requests:(inner?.actual_hosted_requests||0)+f.extra_direct_requests,maximum_direct_HTTP_requests:44,scoped_fixture:f,application_rows_explicitly_written:f.independent_created_row_verified?true:f.create_write_outcome_uncertain?null:inner?.application_rows_explicitly_written??false,hosted_acceptance:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],exit_code:ok?0:1,checked_UTC:new Date().toISOString()};
 if(!ok)r.problem_code??=f.problem_code||f.cleanup_problem_code||'SCOPED_FIXTURE_ACCEPTANCE_REQUIRED';
 if(f.create_write_attempts){r.quarantined_catalog_after_verified=inner?.quarantined_catalog_after_verified===true&&f.final_quarantine_catalog_verified;r.fixed_target_before_and_after_verified=inner?.fixed_target_before_and_after_verified===true&&f.final_target_verified;}
 plan=null;baseline=null;expectedHash=null;actors=null;return r;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 let answer,rl;try{need(process.argv.length===3&&process.argv[2]==='--private-dialogue'&&!process.stdin.isTTY&&!process.stdout.isTTY,'SCOPED_FIXTURE_PRIVATE_INPUT_REQUIRED');rl=createInterface({input:process.stdin,crlfDelay:Infinity});const it=rl[Symbol.asyncIterator]();const read=async ms=>{let timer;try{const x=await Promise.race([it.next(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('SCOPED_FIXTURE_INPUT_TIMEOUT')),ms);})]);need(!x.done&&Buffer.byteLength(x.value)<=65536,'SCOPED_FIXTURE_PRIVATE_INPUT_REQUIRED');return JSON.parse(x.value);}finally{clearTimeout(timer);}};answer=await privateDialogue(await read(30000),{readNext:read,emit:x=>process.stdout.write(JSON.stringify(x)+'\n'),probe:scopedProbe});}catch{answer={stage_step:stage,result:'SCOPED_FIXTURE_PRIVATE_INPUT_REVIEW_REQUIRED',actual_hosted_requests:0,exit_code:1};}finally{rl?.close();process.stdin.destroy();}process.stdout.write(JSON.stringify({protocol:'BATCH_U_RESULT',receipt:answer})+'\n');process.exitCode=answer.exit_code;
}
