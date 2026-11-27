// Current staging recovery only. Auth factor writes; Management SQL remains READ ONLY.
import {readFile} from 'node:fs/promises';
import {isDeepStrictEqual as equal} from 'node:util';
import {runOperatorMfa,boundedBody,validateEmails,AUTH,CONFIG,SetupError} from './fr-2-operator-mfa.mjs';
import {operatorSnapshotSQL,validatePrivateState,closedState} from './admin-batch-v-mfa.mjs';
import {validateReview,exact,object} from './admin-batch-v-review.mjs';
import {stateSQL} from './email-bounded-http-sql.mjs';
import {parseStagingConfiguration} from '../prepare-fr-2-email-edge-batch-a.mjs';
export const stage='FR.2.4.E5.37_BATCH_V_CURRENT_RECOVERY_REUSE_OR_EXACT_PENDING_REPLACEMENT';
export const acknowledgements={RESUME:'RESUME_CURRENT_RECOVERY_THEN_PRIMARY',RECOVER:'PRIMARY_FIRST_RECOVER_EXACT_PENDING_RECOVERY'};
export const expectedPending='6c694294cb8273bce316aa86fd706e32a8028f2e3fba3ac65d4e75f98e6854cc';
const base='https://api.supabase.com/v1/projects/dczlddwbtgvfdujgcitb',slots=['PRIMARY','RECOVERY'];
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(x);
const need=(v,c)=>{if(!v)throw Object.assign(Error(c),{batchVSafe:true});};
const safe=e=>e?.batchVSafe===true?e.message:e instanceof SetupError?e.code:'BATCH_V_PRIVATE_OPERATION_REVIEW_REQUIRED';
export async function recoverySnapshotSQL(primary,recovery){
 const q=await operatorSnapshotSQL(primary,recovery),marker='AS private_operator_state;';need(q.split(marker).length===2,'BATCH_V_SQL_SOURCE_REQUIRED');
 return q.replace(marker,`AS private_operator_state,
 (SELECT jsonb_build_object('outside_factor_count',count(*),
 'outside_unverified',count(*) FILTER (WHERE f.status='unverified'),
 'outside_metadata_sha256',encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_object(
 'id',f.id,'user_id',f.user_id,'factor_type',f.factor_type,'status',f.status,
 'friendly_name',f.friendly_name,'created_at',f.created_at,'updated_at',f.updated_at)
 ORDER BY f.id),'[]'::jsonb)::text,'UTF8')),'hex'))
 FROM auth.mfa_factors f WHERE f.user_id NOT IN (SELECT u.id FROM auth.users u
 WHERE lower(u.email) IN (lower(current_setting('mushavo.operator_primary_email')),
 lower(current_setting('mushavo.operator_recovery_email'))))) AS private_factor_boundary;`);
}
export async function setupBatchVRecovery(input,{transport=fetch,io}={}){
 const r={stage_step:stage,progress_display:'Stage 3/10 | FR.2/8 | Batch V/Z',result:'BATCH_V_RECOVERABLE_MFA_REVIEW_REQUIRED',
 actual_hosted_requests:0,maximum_direct_HTTP_requests:80,Management_requests:0,Auth_requests:0,public_config_requests:0,
 target_before_and_after_verified:false,quarantined_catalog_before_verified:false,quarantined_catalog_after_verified:false,
 Admin_source_and_effective_grants_matched_before_and_after:false,existing_operator_identities_ordinary_and_isolated:false,live_public_key_ownership_verified:false,
 mode:null,first_operator:null,first_operator_fresh_AAL2_verified:false,preexisting_operator_sessions_block_changes:true,
 outside_selected_unverified_factors_block_enrollment:true,outside_factor_metadata_preserved:false,
 exact_reviewed_unverified_RECOVERY_factor_delete_attempts:0,pending_factor_delete_HTTP_accepted:false,pending_factor_delete_HTTP_status:null,
 pending_factor_delete_outcome_uncertain:false,pending_factor_delete_response_problem_code:null,exact_pending_factor_absent_independently_verified:false,
 reviewed_RECOVERY_pending_factor_resumed:false,pending_RECOVERY_absence_observed_after_PRIMARY_enrollment_attempt:false,
 automatic_factor_write_retries:0,verified_factors_explicitly_deleted:false,new_enrollment_attempts:0,selected_created_Auth_sessions:0,
 selected_sessions_absent_independently_verified:false,final_operator_session_counts:[],final_factor_metadata:[],unattributed_operator_session_count:0,
 mfa:null,cleanup_problem_code:null,final_state_problem_code:null,failure_checkpoint:null,checkpoint:'PRIVATE_INPUT',problem_code:null,exit_code:1,
 origin_of_prior_enrollment_established:false,phone_transfer_completion_asserted_by_local_mode_choice:false,
 real_email_requests:0,Auth_provider_security_notifications_not_independently_counted:true,application_rows_or_roles_or_settings_changed:false,committed_mode_change_requests:0,
 credentials_codes_factor_secrets_or_tokens_saved_to_files_arguments_or_environment:false,credentials_emails_raw_IDs_or_provider_bodies_in_safe_result:false,
 independent_device_or_account_recovery_drill_verified:false,hosted_Admin_MFA_acceptance:false,full_lettered_batch_V_complete:false,
 hosted_acceptance:false,live_activation_approved:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[]};
 let ready=false,finished=false,snapshotQuery,closedQuery,model,initial=null,current=null,boundary=null;
 const created=[],retained=new Map();const one=(rows,slot)=>rows.find(x=>x.slot===slot);
 const row=(v,keys)=>{need(Array.isArray(v)&&v.length===1&&exact(v[0],keys),'BATCH_V_ROWSET_REQUIRED');return v[0];};
 const pending=f=>f?.status==='unverified'&&f.factor_type==='totp'&&f.expected_label===true&&f.metadata_sha256===expectedPending;
 const verified=x=>x.factors.length===1&&x.factors[0].status==='verified'&&x.factors[0].expected_label===true;
 async function request(label,url,options={},limit=262144){
  r.checkpoint=label;need(++r.actual_hosted_requests<=80,'BATCH_V_REQUEST_BOUND');const mgmt=url===base||url===base+'/database/query',auth=url.startsWith(AUTH+'/');need(mgmt||auth||url===CONFIG,'BATCH_V_ENDPOINT_REQUIRED');
  if(mgmt)r.Management_requests++;else if(auth)r.Auth_requests++;else r.public_config_requests++;
  const res=await transport(url,{...options,redirect:'error',signal:AbortSignal.timeout(40000)});
  if(label==='AUTH_DELETE_EXACT_REVIEWED_UNVERIFIED_RECOVERY')r.pending_factor_delete_HTTP_status=res.status;
  need(!res.redirected&&(!res.url||res.url===url),'BATCH_V_RESPONSE_REQUIRED');if(options.expected204&&res.status===204){await res.body?.cancel();return null;}
  need(res.status===(url===base+'/database/query'?201:200)&&/^(?:application\/json|(?:application|text)\/javascript)(?:\s*;|$)/i.test(res.headers.get('content-type')||''),'BATCH_V_RESPONSE_REQUIRED');
  const text=await boundedBody(res,limit);return url===CONFIG?text:JSON.parse(text);
 }
 const mgmt=(label,query)=>request(label,base+(query?'/database/query':''),{method:query?'POST':'GET',headers:{Authorization:'Bearer '+input.managementToken,Accept:'application/json',...(query?{'Content-Type':'application/json'}:{})},...(query?{body:JSON.stringify({query,read_only:false})}:{})});
 const target=t=>need(object(t)&&(t.ref==='dczlddwbtgvfdujgcitb'||t.ref===undefined&&t.id==='dczlddwbtgvfdujgcitb')&&!(typeof t.id==='string'&&/^[a-z]{20}$/.test(t.id)&&t.id!=='dczlddwbtgvfdujgcitb')&&t.status==='ACTIVE_HEALTHY'&&t.database?.host==='db.dczlddwbtgvfdujgcitb.supabase.co','BATCH_V_TARGET_REQUIRED');
 function sessionGuard(state,slot,session){for(const x of state)need(equal(x.sessions,x.slot===slot?[session]:[]),'BATCH_V_UNEXPECTED_OPERATOR_SESSION');}
 async function snapshot(label){
  r.outside_factor_metadata_preserved=false;
  const x=row(await mgmt(label,snapshotQuery),['batch_v_review','private_operator_state','private_factor_boundary']);const review=validateReview(x.batch_v_review,model);
  need(review.source_and_effective_grants_match_current_installed_baseline&&review.operators_ready_as_ordinary_isolated_identities,'BATCH_V_ADMIN_OR_OPERATOR_DRIFT');current=validatePrivateState(x.private_operator_state,review);
  const b=x.private_factor_boundary;need(exact(b,['outside_factor_count','outside_unverified','outside_metadata_sha256'])&&Number.isSafeInteger(b.outside_factor_count)&&b.outside_factor_count>=0&&Number.isSafeInteger(b.outside_unverified)&&b.outside_unverified>=0&&b.outside_unverified<=b.outside_factor_count&&/^[a-f0-9]{64}$/.test(b.outside_metadata_sha256),'BATCH_V_FACTOR_BOUNDARY_REQUIRED');
  if(boundary)need(equal(b,boundary),'BATCH_V_OUTSIDE_FACTOR_METADATA_CHANGED');else boundary=structuredClone(b);
  need(b.outside_unverified===0,'BATCH_V_OUTSIDE_PENDING_FACTORS_REQUIRE_REVIEW');r.outside_factor_metadata_preserved=true;
  if(initial){need(current.every(x=>x.user_id===one(initial,x.slot).user_id),'BATCH_V_ACTOR_DRIFT');for(const [slot,id]of retained)need(one(current,slot).factors.some(f=>f.id===id),'BATCH_V_RETAINED_FACTOR_CHANGED');
   if(r.first_operator_fresh_AAL2_verified)need(verified(one(current,r.first_operator)),'BATCH_V_WORKING_FIRST_FACTOR_REQUIRED');
   const before=one(initial,'RECOVERY'),now=one(current,'RECOVERY');
   if(before.factors.length===1&&pending(before.factors[0])&&now.factors.length===0&&!r.exact_pending_factor_absent_independently_verified&&r.exact_reviewed_unverified_RECOVERY_factor_delete_attempts===0){
    need(input.mode==='RECOVER'&&r.new_enrollment_attempts>=1,'BATCH_V_PENDING_FACTOR_DISAPPEARED_BEFORE_AUTHORIZED_PRIMARY_ENROLLMENT');
    r.pending_RECOVERY_absence_observed_after_PRIMARY_enrollment_attempt=true;
   }
  }return current;
 }
 function allowed(x,atStart=false){if(x.slot==='PRIMARY')return x.factors.length===0||verified(x);return verified(x)||x.factors.length===1&&pending(x.factors[0])||!atStart&&input.mode==='RECOVER'&&x.factors.length===0&&r.pending_RECOVERY_absence_observed_after_PRIMARY_enrollment_attempt;}
 try{
  need(exact(input,['managementToken','primaryEmail','recoveryEmail','mode','acknowledgement'])&&Object.hasOwn(acknowledgements,input.mode)&&input.acknowledgement===acknowledgements[input.mode]&&/^sbp_fc[A-Za-z0-9_-]{20,512}$/.test(input.managementToken||''),'BATCH_V_PRIVATE_INPUT_REQUIRED');
  r.mode=input.mode;r.first_operator=input.mode==='RESUME'?'RECOVERY':'PRIMARY';r.phone_transfer_completion_asserted_by_local_mode_choice=true;
  const emails=validateEmails([input.primaryEmail,input.recoveryEmail]);snapshotQuery=await recoverySnapshotSQL(...emails);closedQuery=await stateSQL();model=JSON.parse(await readFile(new URL('../../docs/security-audit/security-fr-2-batch-v-source-model.json',import.meta.url),'utf8'));
  target(await mgmt('TARGET_BEFORE'));closedState(row(await mgmt('QUARANTINED_CATALOG_BEFORE',closedQuery),['bounded_state']).bounded_state);ready=true;r.quarantined_catalog_before_verified=true;
  initial=structuredClone(await snapshot('CURRENT_ADMIN_OPERATOR_FACTOR_SESSION_AND_OUTSIDE_BOUNDARY'));r.existing_operator_identities_ordinary_and_isolated=true;
  need(initial.every(x=>x.sessions.length===0),'BATCH_V_PREEXISTING_OPERATOR_SESSIONS_REQUIRE_REVIEW');need(initial.every(x=>allowed(x,true)),'BATCH_V_UNEXPECTED_EXISTING_FACTOR');
  need(input.mode!=='RECOVER'||!verified(one(initial,'RECOVERY')),'BATCH_V_VERIFIED_RECOVERY_FACTOR_REQUIRES_SAVED_ENTRY');
  for(const x of initial)if(verified(x))retained.set(x.slot,x.factors[0].id);
  const config=parseStagingConfiguration(await request('LIVE_PUBLIC_CONFIGURATION',CONFIG,{headers:{Accept:'application/javascript','Cache-Control':'no-store'}},8192));
  const authTransport=async(url,opts)=>{need(url.startsWith(AUTH+'/')&&((opts.method==='POST'&&['/token?grant_type=password','/logout?scope=local','/factors'].includes(url.slice(AUTH.length)))||(opts.method==='GET'&&url===AUTH+'/user')||(opts.method==='POST'&&/^\/factors\/[a-f0-9-]{36}\/(challenge|verify)$/.test(url.slice(AUTH.length)))),'BATCH_V_AUTH_ENDPOINT_REQUIRED');
   r.checkpoint='AUTH_'+(url===AUTH+'/factors'?'ENROLL':url.endsWith('/verify')?'VERIFY':url.endsWith('/challenge')?'CHALLENGE':url.endsWith('/user')?'USER':url.includes('/logout')?'LOCAL_LOGOUT':'PASSWORD_SIGNIN');need(++r.actual_hosted_requests<=80,'BATCH_V_REQUEST_BOUND');r.Auth_requests++;if(url===AUTH+'/factors')r.new_enrollment_attempts++;return transport(url,opts);};
  r.mfa=await runOperatorMfa({emails,order:input.mode==='RESUME'?[1,0]:[0,1],verifiedPublishableKey:config.supabasePublishableKey,fetcher:authTransport,
   io:{...io,notice:code=>{if(code===r.first_operator+'_PASS')r.first_operator_fresh_AAL2_verified=true;io.notice(code);}},
   sessionOpened:async({slot,email,token})=>{let c;try{c=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));}catch{need(false,'BATCH_V_SESSION_SHAPE_REQUIRED');}need(uuid(c.sub)&&uuid(c.session_id)&&c.sub===one(initial,slot).user_id&&email.toLowerCase()===emails[slots.indexOf(slot)],'BATCH_V_SESSION_IDENTITY_REQUIRED');need(!created.some(x=>x.session===c.session_id),'BATCH_V_FRESH_SESSION_REQUIRED');created.push({slot,session:c.session_id});r.selected_created_Auth_sessions=created.length;},
   prepareFactors:async({slot,initial:login,token})=>{
    let state=await snapshot('BEFORE_'+slot+'_FACTOR_ACTION');sessionGuard(state,slot,login.c.session_id);need(login.user.id===one(state,slot).user_id,'BATCH_V_ACTOR_DRIFT');r.live_public_key_ownership_verified=true;
    const selected=one(state,slot);need(allowed(selected),'BATCH_V_UNEXPECTED_EXISTING_FACTOR');const api=login.user.factors||[];need(Array.isArray(api)&&api.length<=1&&api.every(f=>selected.factors.some(y=>y.id===f.id&&y.status===f.status&&y.factor_type===f.factor_type)),'BATCH_V_AUTH_SQL_FACTOR_DISAGREEMENT');
    if(input.mode==='RECOVER'&&slot==='RECOVERY'){
     need(r.first_operator_fresh_AAL2_verified&&verified(one(state,'PRIMARY')),'BATCH_V_WORKING_PRIMARY_FACTOR_REQUIRED');
     if(selected.factors[0]?.status==='unverified'){
      const f=selected.factors[0],working=structuredClone(one(state,'PRIMARY').factors);need(pending(f),'BATCH_V_EXACT_PENDING_FACTOR_REQUIRED');r.exact_reviewed_unverified_RECOVERY_factor_delete_attempts++;r.pending_factor_delete_outcome_uncertain=true;
      try{const data=await request('AUTH_DELETE_EXACT_REVIEWED_UNVERIFIED_RECOVERY',AUTH+'/factors/'+f.id,{method:'DELETE',headers:{apikey:config.supabasePublishableKey,Authorization:'Bearer '+token,Accept:'application/json'},expected204:true});need(data===null||data?.id===f.id,'BATCH_V_DELETE_RESPONSE_REQUIRED');r.pending_factor_delete_HTTP_accepted=true;}catch(e){r.pending_factor_delete_response_problem_code=safe(e);}
      state=await snapshot('INDEPENDENT_EXACT_PENDING_RECOVERY_ABSENCE');sessionGuard(state,slot,login.c.session_id);need(one(state,slot).factors.length===0&&equal(one(state,'PRIMARY').factors,working),'BATCH_V_DELETE_READBACK_REQUIRED');r.exact_pending_factor_absent_independently_verified=true;r.pending_factor_delete_outcome_uncertain=false;
      need(r.pending_factor_delete_HTTP_accepted,'BATCH_V_DELETE_RESPONSE_LOST_STATE_RESOLVED_REVIEW_REQUIRED');
     }else if(selected.factors.length===0){need(r.pending_RECOVERY_absence_observed_after_PRIMARY_enrollment_attempt,'BATCH_V_EXACT_PENDING_FACTOR_REQUIRED');r.exact_pending_factor_absent_independently_verified=true;}
     else need(false,'BATCH_V_VERIFIED_RECOVERY_FACTOR_REQUIRES_SAVED_ENTRY');
    }
    return one(state,slot).factors.map(f=>({id:f.id,status:f.status,factor_type:f.factor_type}));
   },
   resumeUnverifiedFactor:async({slot,factor,actor,session})=>{need(input.mode==='RESUME'&&slot==='RECOVERY','BATCH_V_PENDING_RESUME_SCOPE_REQUIRED');const state=await snapshot('EXACT_PENDING_RECOVERY_RESUME_GUARD');sessionGuard(state,slot,session);const x=one(state,slot);need(x.user_id===actor&&x.factors.length===1&&x.factors[0].id===factor.id&&pending(x.factors[0]),'BATCH_V_EXACT_PENDING_FACTOR_REQUIRED');r.reviewed_RECOVERY_pending_factor_resumed=true;return true;},
   beforeVerify:async({slot,factor,actor,session})=>{const state=await snapshot('BEFORE_'+slot+'_TOTP_VERIFY');sessionGuard(state,slot,session);const x=one(state,slot);need(x.user_id===actor&&x.factors.length===1&&x.factors[0].id===factor&&x.factors[0].expected_label,'BATCH_V_VERIFY_FACTOR_DRIFT');if(input.mode==='RESUME'&&slot==='RECOVERY'&&x.factors[0].status==='unverified')need(pending(x.factors[0]),'BATCH_V_EXACT_PENDING_FACTOR_REQUIRED');if(retained.has(slot))need(retained.get(slot)===factor,'BATCH_V_RETAINED_FACTOR_CHANGED');retained.set(slot,factor);}
  });
  need(r.mfa.result==='STAGING_TWO_OPERATOR_TOTP_AND_FRESH_AUTH_SESSIONS_SCOPED_PASS','BATCH_V_GENUINE_MFA_FLOW_REQUIRED');finished=true;
 }catch(e){r.problem_code=safe(e);r.failure_checkpoint=r.checkpoint;}
 finally{if(ready){
  try{const state=await snapshot('INDEPENDENT_FINAL_FACTOR_SESSION_AND_OUTSIDE_STATE');r.final_factor_metadata=slots.map(slot=>({slot,factors:one(state,slot).factors.map(f=>({factor_type:f.factor_type,status:f.status,expected_label:f.expected_label,metadata_sha256:f.metadata_sha256}))}));r.final_operator_session_counts=slots.map(slot=>({slot,sessions:one(state,slot).sessions.length}));r.unattributed_operator_session_count=state.reduce((n,x)=>n+x.sessions.filter(s=>!created.some(y=>y.slot===x.slot&&y.session===s)).length,0);r.selected_sessions_absent_independently_verified=created.every(s=>!one(state,s.slot).sessions.includes(s.session));need(r.selected_sessions_absent_independently_verified&&state.every(x=>x.sessions.length===0),'BATCH_V_OPERATOR_SESSION_CLEANUP_REQUIRED');if(finished)need(state.every(verified),'BATCH_V_FINAL_VERIFIED_FACTOR_REQUIRED');r.Admin_source_and_effective_grants_matched_before_and_after=!!initial;}catch(e){r.cleanup_problem_code=safe(e);}
  try{closedState(row(await mgmt('QUARANTINED_CATALOG_AFTER',closedQuery),['bounded_state']).bounded_state);r.quarantined_catalog_after_verified=true;}catch(e){r.final_state_problem_code=safe(e);}
  try{target(await mgmt('TARGET_AFTER'));r.target_before_and_after_verified=true;}catch(e){r.final_state_problem_code??=safe(e);}
 }}
 if(finished&&!r.problem_code&&!r.cleanup_problem_code&&!r.final_state_problem_code){r.result='BATCH_V_RECOVERABLE_TWO_OPERATOR_FRESH_AAL2_SCOPED_PASS';r.checkpoint='COMPLETE';r.exit_code=0;}r.checked_UTC=new Date().toISOString();return r;
}
