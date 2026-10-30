// Controlled real-provider probe. One email; no committed mode change or release path.
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline';
import {isDeepStrictEqual} from 'node:util';
import {installationSQL} from './install-fr-2-email-batch-h.mjs';
import {contextSQL,privateCatalogSQL,stagingRef} from './lib/email-registration-handoff-sql.mjs';
import {versionReference} from './lib/email-registration-catalog-versions.mjs';
import {isSingleMailbox} from '../supabase/functions/_shared/email-verification-zoho.mjs';
import {parseStagingConfiguration} from './prepare-fr-2-email-edge-batch-a.mjs';
export const stage='FR.2.4.E5.22_BATCH_I_CONTROLLED_EMAIL_PROOF_AND_ROLLED_BACK_RECOVERY';
export const acknowledgement='ONE_CONTROLLED_STAGING_EMAIL_AND_ROLLED_BACK_RECOVERY_ONLY';
export const origin='https://mushavo-budget-staging.pages.dev';
const api='https://'+stagingRef+'.supabase.co';
const management='https://api.supabase.com/v1/projects/'+stagingRef;
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(x);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&isDeepStrictEqual(Object.keys(x).sort(),keys.slice().sort());
const need=(x,code)=>{if(!x)throw Object.assign(Error(code),{safeCode:code});};
const codes=new Set(['PRIVATE_INPUT_REQUIRED','TARGET_REVIEW_REQUIRED','HTTP_RESPONSE_REVIEW_REQUIRED','BOUNDED_RESPONSE_REQUIRED','QUARANTINED_CATALOG_REVIEW_REQUIRED','PUBLIC_CONFIGURATION_REVIEW_REQUIRED','AUTH_LOGIN_REVIEW_REQUIRED','AUTH_IDENTITY_REVIEW_REQUIRED','ORDINARY_STAGING_ACTOR_REQUIRED','QUARANTINED_HTTP_DENIAL_REVIEW_REQUIRED','GATEWAY_BOUNDARY_REVIEW_REQUIRED','EMAIL_REQUEST_REVIEW_REQUIRED','CODE_INPUT_REQUIRED','CODE_VERIFICATION_REVIEW_REQUIRED','CODE_REPLAY_REVIEW_REQUIRED','RECOVERY_REHEARSAL_REVIEW_REQUIRED','AUTH_CLEANUP_REVIEW_REQUIRED','NETWORK_OR_PROVIDER_REVIEW_REQUIRED']);
const safe=e=>codes.has(e?.safeCode)?e.safeCode:'NETWORK_OR_PROVIDER_REVIEW_REQUIRED';
const literal=x=>"'"+String(x).replaceAll("'","''")+"'";
const readonly=body=>`BEGIN TRANSACTION READ ONLY;\nSET LOCAL statement_timeout='25s';\nSET LOCAL lock_timeout='3s';\nSET LOCAL search_path=pg_catalog;\n${body}\nROLLBACK;\n`;
function actorRequired(a){need(exact(a,['user','session','email'])&&uuid(a.user)&&uuid(a.session)&&isSingleMailbox(a.email),'AUTH_IDENTITY_REVIEW_REQUIRED');}
export function actorFactsSQL(a){actorRequired(a);return readonly(`SELECT jsonb_build_object('context',${contextSQL},'ordinary_confirmed_active_actor',
 EXISTS(SELECT 1 FROM auth.users u JOIN public.profiles p ON p.id=u.id JOIN auth.sessions s ON s.user_id=u.id
 WHERE u.id=${literal(a.user)}::uuid AND s.id=${literal(a.session)}::uuid AND lower(u.email)=lower(${literal(a.email)})
 AND u.email_confirmed_at IS NOT NULL AND p.account_status='active' AND (u.banned_until IS NULL OR u.banned_until<=statement_timestamp())
 AND (s.not_after IS NULL OR s.not_after>statement_timestamp())
 AND NOT EXISTS(SELECT 1 FROM public.app_admins x WHERE x.user_id=u.id OR lower(x.email)=lower(u.email))),
 'selected_session_proof_absent',NOT EXISTS(SELECT 1 FROM mushavo_email_auth.session_proofs WHERE session_id=${literal(a.session)}::uuid)) AS actor_facts;`);}
export function cleanupSQL(a){actorRequired(a);return readonly(`SELECT jsonb_build_object('context',${contextSQL},
 'selected_session_absent',NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id=${literal(a.session)}::uuid),
 'selected_proofs_absent',NOT EXISTS(SELECT 1 FROM mushavo_email_auth.session_proofs WHERE session_id=${literal(a.session)}::uuid),
 'selected_challenges_absent',NOT EXISTS(SELECT 1 FROM mushavo_email_auth.challenges WHERE session_id=${literal(a.session)}::uuid)) AS session_cleanup;`);}
export async function recoverySQL(a,challenge){
 actorRequired(a);need(uuid(challenge),'CODE_VERIFICATION_REVIEW_REQUIRED');const {base}=await installationSQL();
 const references=Object.fromEntries([15,16,17,18].map(v=>[String(v),versionReference(base,v*10000)]));
 const catalog=privateCatalogSQL.replace("n.nspname IN ('mushavo_email_install','mushavo_email_auth')","n.nspname='mushavo_email_install'");
 const claims=JSON.stringify({sub:a.user,session_id:a.session,role:'authenticated',aud:'authenticated',iss:api+'/auth/v1',exp:Math.floor(Date.now()/1000)+1200});
 return `BEGIN;
SET LOCAL statement_timeout='35s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
SET LOCAL mushavo.email_rollout_project='${stagingRef}';
DO $probe$ DECLARE expected jsonb; active_proof boolean; closed_proof boolean; active_rows integer; closed_rows integer; result jsonb; BEGIN
 IF NOT ((${contextSQL})->>'privileged_origin')::boolean THEN RAISE EXCEPTION 'EMAIL_I_PRIVILEGED_ORIGIN_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(20261017,2411);
 expected:=${literal(JSON.stringify(references))}::jsonb -> (current_setting('server_version_num')::integer/10000)::text;
 IF expected IS NULL OR (${catalog}) IS DISTINCT FROM expected THEN RAISE EXCEPTION 'EMAIL_I_PINNED_INSTALLER_REQUIRED'; END IF;
 PERFORM 1 FROM mushavo_email_install.rollout_control WHERE singleton AND target_project='${stagingRef}' AND mode='QUARANTINED'
 AND catalog_sha256=mushavo_email_install.catalog_identity() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'EMAIL_I_QUARANTINED_STAMP_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM mushavo_email_auth.session_proofs p JOIN mushavo_email_auth.challenges c ON c.session_id=p.session_id AND c.user_id=p.user_id
 WHERE p.user_id=${literal(a.user)}::uuid AND p.session_id=${literal(a.session)}::uuid AND p.source='email' AND p.device_id IS NULL
 AND c.id=${literal(challenge)}::uuid AND c.state='used' AND c.remember_device=false)
 THEN RAISE EXCEPTION 'EMAIL_I_REAL_SESSION_EMAIL_PROOF_REQUIRED'; END IF;
 PERFORM set_config('mushavo.email_rollout_action','RESUME_STAGING_EMAIL',true);
 result:=mushavo_email_install.resume();
 IF result->>'result'<>'STAGING_EMAIL_ACTIVE' OR result->'catalog_identity_matched'<>'true'::jsonb THEN RAISE EXCEPTION 'EMAIL_I_RESUME_REQUIRED'; END IF;
 PERFORM set_config('request.jwt.claims',${literal(claims)},true);
 SET LOCAL ROLE authenticated;
 SELECT public.email_gate_current_session_verified() INTO active_proof;
 SELECT count(*)::integer INTO active_rows FROM public.profiles WHERE id=${literal(a.user)}::uuid;
 RESET ROLE;
 PERFORM set_config('mushavo.email_rollout_action','QUARANTINE_STAGING_EMAIL',true);
 result:=mushavo_email_install.quarantine();
 IF result->>'result'<>'STAGING_EMAIL_QUARANTINED' OR result->'guards_retained'<>'true'::jsonb THEN RAISE EXCEPTION 'EMAIL_I_QUARANTINE_REQUIRED'; END IF;
 SET LOCAL ROLE authenticated;
 SELECT public.email_gate_current_session_verified() INTO closed_proof;
 SELECT count(*)::integer INTO closed_rows FROM public.profiles WHERE id=${literal(a.user)}::uuid;
 RESET ROLE;
 IF active_proof IS DISTINCT FROM true OR closed_proof IS DISTINCT FROM false OR active_rows<>1 OR closed_rows<>0
 THEN RAISE EXCEPTION 'EMAIL_I_ROLE_AND_RLS_PROBE_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM mushavo_email_auth.session_proofs WHERE session_id=${literal(a.session)}::uuid AND user_id=${literal(a.user)}::uuid)
 THEN RAISE EXCEPTION 'EMAIL_I_PROOF_PRESERVATION_REQUIRED'; END IF;
 PERFORM set_config('mushavo.email_batch_i_receipt',jsonb_build_object('real_session_email_proof_present',true,
 'resume_and_quarantine_functions_executed',true,'authenticated_role_predicate_and_own_profile_visible_inside_uncommitted_active_state',true,
 'quarantined_predicate_and_own_profile_denied',true,'proof_retained_through_quarantine',true)::text,true);
END $probe$;
SELECT current_setting('mushavo.email_batch_i_receipt')::jsonb AS recovery_probe;
ROLLBACK;
`;
}
export async function controlledProbe(input,{transport=fetch,readCode=async()=>{throw Error('CODE_REQUIRED');}}={}){
 const r={stage_step:stage,batch:'I',result:'BATCH_I_CONTROLLED_PROOF_REVIEW_REQUIRED',actual_hosted_requests:0,
  gateway_internal_provider_requests_not_counted:true,fixed_target_before_and_after_verified:false,quarantined_catalog_before_verified:false,
  live_public_key_matches_private_snapshot:false,selected_email_matches_retained_allowlist:false,gateway_unauthenticated_status_denied:false,
  Auth_password_signin_attempted:false,Auth_identity_independently_verified:false,ordinary_active_staging_account_verified:false,
  password_only_gateway_and_RPC_and_profile_denied:false,email_request_attempts:0,email_provider_acceptance_observed:false,
  email_dispatch_outcome_uncertain:false,email_inbox_delivery_and_code_verified:false,verification_outcome_uncertain:false,used_code_replay_denied:false,secure_nonremember_cookie_clear_observed:false,
  recovery_transaction_attempted:false,rolled_back_recovery_rehearsal_passed:false,committed_resume_or_quarantine_requests:0,
  post_proof_quarantined_HTTP_access_denied:false,Auth_local_logout_attempted:false,Auth_local_logout_HTTP_accepted:false,
  selected_Auth_session_and_proofs_and_challenges_absent:false,Auth_session_cleanup_outcome_uncertain:false,quarantined_catalog_after_verified:false,
  private_rate_and_send_audit_rows_retained:true,application_row_read_queries_attempted:false,application_rows_explicitly_written:false,
  actor_and_profile_reads_limited_to_selected_account:true,browser_cookie_cache_and_device_restore_verified:false,
  active_state_HTTP_or_cross_account_acceptance_verified:false,raw_credentials_codes_emails_JWTs_IDs_or_provider_bodies_in_safe_result:false,
  credentials_codes_or_tokens_saved_to_disk_arguments_or_environment:false,Auth_settings_secrets_schedules_or_deployments_changed:false,
  real_PostgreSQL_concurrency_verified:false,full_scheduler_or_external_caller_graph_verified:false,live_activation_approved:false,
  hosted_acceptance:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],samples:[],
  cleanup_problem_code:null,final_state_problem_code:null,failure_checkpoint:null,checkpoint:'PRIVATE_INPUT',problem_code:null,exit_code:1};
 let actor,token,sql,version,ready=false,mainPassed=false;
 const row=(x,name)=>{need(Array.isArray(x)&&x.length===1&&exact(x[0],[name]),'BOUNDED_RESPONSE_REQUIRED');return x[0][name];};
 async function request(label,url,{method='GET',headers={},body,expected=200,json=true,limit=131072,gateway=false,expectedCookie=null}={}){
  r.checkpoint=label;r.actual_hosted_requests++;const sample={endpoint:label,http_status:null};r.samples.push(sample);
  const response=await transport(url,{method,redirect:'error',signal:AbortSignal.timeout(40000),headers:{Accept:json?'application/json':'text/javascript','Cache-Control':'no-store',...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  sample.http_status=response.status;if(response.redirected||(response.url&&response.url!==url)||response.status!==expected){await response.body?.cancel();need(false,'HTTP_RESPONSE_REVIEW_REQUIRED');}
  if(!json&&expected===204){await response.body?.cancel();return null;}
  const type=response.headers.get('content-type')||'';need(json?/^application\/json(?:\s*;|$)/i.test(type):/^(?:application|text)\/javascript(?:\s*;|$)/i.test(type),'BOUNDED_RESPONSE_REQUIRED');
  if(gateway)need(response.headers.get('cache-control')==='no-store'&&response.headers.get('x-content-type-options')==='nosniff'&&response.headers.get('referrer-policy')==='no-referrer'&&response.headers.get('content-security-policy')==="default-src 'none'; frame-ancestors 'none'"&&response.headers.get('set-cookie')===expectedCookie,'GATEWAY_BOUNDARY_REVIEW_REQUIRED');
  const reader=response.body?.getReader();need(reader,'BOUNDED_RESPONSE_REQUIRED');const chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;need(size<=limit,'BOUNDED_RESPONSE_REQUIRED');chunks.push(value);}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));return json?JSON.parse(text):text;}catch{need(false,'BOUNDED_RESPONSE_REQUIRED');}
 }
 const mgmt=(label,query)=>request(label,management+(query?'/database/query':''),{method:query?'POST':'GET',headers:{Authorization:'Bearer '+input.managementToken,...(query?{'Content-Type':'application/json'}:{})},...(query?{body:{query,read_only:false},expected:201}:{})});
 function target(p){need(object(p)&&object(p.database)&&(p.ref===stagingRef||(p.ref===undefined&&p.id===stagingRef))&&!(typeof p.id==='string'&&/^[a-z]{20}$/.test(p.id)&&p.id!==stagingRef)&&p.status==='ACTIVE_HEALTHY'&&p.database.host==='db.'+stagingRef+'.supabase.co','TARGET_REVIEW_REQUIRED');}
 function quarantined(x){
  need(exact(x,['context','server_version_num','installer_catalog','control','guarded_RPCs','restrictive_policies','public_guard_policies','storage_guard_policies','backend_tables','backend_tables_forced_RLS','backend_schema_API_denied'])&&isDeepStrictEqual(x.context,{privileged_origin:true,transaction_read_only:'on'})&&
   Number.isInteger(x.server_version_num)&&(!version||version===x.server_version_num)&&isDeepStrictEqual(x.installer_catalog,versionReference(sql.base,x.server_version_num))&&
   isDeepStrictEqual(x.control,{rows:1,quarantined:true})&&x.guarded_RPCs===148&&x.restrictive_policies===82&&x.public_guard_policies===81&&x.storage_guard_policies===1&&x.backend_tables===5&&x.backend_tables_forced_RLS===5&&x.backend_schema_API_denied===true,'QUARANTINED_CATALOG_REVIEW_REQUIRED');version=x.server_version_num;
 }
 const authHeaders=()=>({apikey:input.publishableKey,Authorization:'Bearer '+token});
 const gateway=(label,route,body={},expected=200,anonymous=false)=>request(label,origin+'/api/email-verification/'+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','x-mushavo-csrf':'email-v1','sec-fetch-site':'same-origin',...(!anonymous?{Authorization:'Bearer '+token}:{})},body,expected,gateway:true,limit:16384,expectedCookie:route==='verify'&&expected===200?'__Host-mushavo_device_'+actor.user.replaceAll('-','')+'=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0':null});
 async function closedHTTP(label){
  need(isDeepStrictEqual(await gateway(label+'_GATEWAY','status'),{verified:false}),'QUARANTINED_HTTP_DENIAL_REVIEW_REQUIRED');
  need(await request(label+'_RPC',api+'/rest/v1/rpc/email_gate_current_session_verified',{method:'POST',headers:{...authHeaders(),'Content-Type':'application/json'},body:{},limit:8192})===false,'QUARANTINED_HTTP_DENIAL_REVIEW_REQUIRED');
  need(isDeepStrictEqual(await request(label+'_PROFILE',api+'/rest/v1/profiles?select=id&id=eq.'+actor.user,{headers:authHeaders(),limit:8192}),[]),'QUARANTINED_HTTP_DENIAL_REVIEW_REQUIRED');
 }
 try{
  need(exact(input,['managementToken','email','password','publishableKey','allowedRecipients','acknowledgement'])&&input.acknowledgement===acknowledgement&&typeof input.managementToken==='string'&&/^sbp_fc[A-Za-z0-9_-]{20,512}$/.test(input.managementToken)&&
   isSingleMailbox(input.email)&&typeof input.password==='string'&&input.password.length>0&&input.password.length<=4096&&!/[\0\r\n]/.test(input.password)&&typeof input.publishableKey==='string'&&/^sb_publishable_[A-Za-z0-9_-]{1,512}$/.test(input.publishableKey)&&Array.isArray(input.allowedRecipients)&&input.allowedRecipients.length>=1&&input.allowedRecipients.length<=10&&input.allowedRecipients.every(isSingleMailbox)&&input.allowedRecipients.some(e=>e.toLowerCase()===input.email.toLowerCase()),'PRIVATE_INPUT_REQUIRED');
  r.selected_email_matches_retained_allowlist=true;sql=await installationSQL();target(await mgmt('TARGET_BEFORE'));
  quarantined(row(await mgmt('QUARANTINED_CATALOG_BEFORE',sql.readback),'quarantined_readback'));r.quarantined_catalog_before_verified=true;ready=true;
  const config=parseStagingConfiguration(await request('LIVE_PUBLIC_CONFIGURATION',origin+'/config.js',{json:false,limit:16384}));need(config.supabasePublishableKey===input.publishableKey,'PUBLIC_CONFIGURATION_REVIEW_REQUIRED');r.live_public_key_matches_private_snapshot=true;
  need(isDeepStrictEqual(await gateway('UNAUTHENTICATED_STATUS','status',{},401,true),{result:'SIGN_IN_REQUIRED'}),'GATEWAY_BOUNDARY_REVIEW_REQUIRED');r.gateway_unauthenticated_status_denied=true;
  r.Auth_password_signin_attempted=true;r.Auth_session_cleanup_outcome_uncertain=true;
  const login=await request('AUTH_PASSWORD_SIGNIN',api+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:input.publishableKey,'Content-Type':'application/json'},body:{email:input.email,password:input.password},limit:65536});
  need(object(login)&&object(login.user)&&typeof login.access_token==='string'&&login.access_token.length<=16384&&/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(login.access_token),'AUTH_LOGIN_REVIEW_REQUIRED');
  let claims;try{claims=JSON.parse(Buffer.from(login.access_token.split('.')[1],'base64url').toString('utf8'));}catch{need(false,'AUTH_LOGIN_REVIEW_REQUIRED');}
  need(object(claims)&&uuid(claims.sub)&&uuid(claims.session_id)&&claims.sub===login.user.id&&claims.iss===api+'/auth/v1'&&claims.role==='authenticated'&&claims.aud==='authenticated'&&Number.isInteger(claims.exp)&&claims.exp>Math.floor(Date.now()/1000)&&typeof login.user.email==='string'&&login.user.email.toLowerCase()===input.email.toLowerCase()&&login.user.is_anonymous!==true,'AUTH_IDENTITY_REVIEW_REQUIRED');
  token=login.access_token;actor={user:claims.sub,session:claims.session_id,email:input.email};
  const user=await request('AUTH_USER_INDEPENDENT_READ',api+'/auth/v1/user',{headers:authHeaders(),limit:32768});
  need(object(user)&&user.id===actor.user&&typeof user.email==='string'&&user.email.toLowerCase()===input.email.toLowerCase()&&user.is_anonymous!==true&&typeof user.email_confirmed_at==='string'&&Number.isFinite(Date.parse(user.email_confirmed_at)),'AUTH_IDENTITY_REVIEW_REQUIRED');r.Auth_identity_independently_verified=true;
  r.application_row_read_queries_attempted=true;
  const facts=row(await mgmt('SELECTED_ACTOR_FACTS',actorFactsSQL(actor)),'actor_facts');need(isDeepStrictEqual(facts,{context:{privileged_origin:true,transaction_read_only:'on'},ordinary_confirmed_active_actor:true,selected_session_proof_absent:true}),'ORDINARY_STAGING_ACTOR_REQUIRED');r.ordinary_active_staging_account_verified=true;
  await closedHTTP('PASSWORD_ONLY');r.password_only_gateway_and_RPC_and_profile_denied=true;
  r.email_request_attempts=1;r.email_dispatch_outcome_uncertain=true;
  const begun=await gateway('REQUEST_ONE_EMAIL_CODE','begin',{remember:false});
  need(exact(begun,['result','challengeId','expiresAt'])&&begun.result==='CODE_REQUESTED'&&uuid(begun.challengeId)&&typeof begun.expiresAt==='string'&&Number.isFinite(Date.parse(begun.expiresAt))&&Date.parse(begun.expiresAt)>Date.now(),'EMAIL_REQUEST_REVIEW_REQUIRED');r.email_provider_acceptance_observed=true;r.email_dispatch_outcome_uncertain=false;
  r.checkpoint='HIDDEN_INBOX_CODE';let code;try{code=await readCode();}catch{need(false,'CODE_INPUT_REQUIRED');}need(typeof code==='string'&&/^\d{6}$/.test(code),'CODE_INPUT_REQUIRED');
  r.verification_outcome_uncertain=true;need(isDeepStrictEqual(await gateway('VERIFY_INBOX_CODE','verify',{challengeId:begun.challengeId,code}),{result:'VERIFIED'}),'CODE_VERIFICATION_REVIEW_REQUIRED');r.email_inbox_delivery_and_code_verified=true;r.secure_nonremember_cookie_clear_observed=true;r.verification_outcome_uncertain=false;
  need(isDeepStrictEqual(await gateway('REJECT_USED_CODE_REPLAY','verify',{challengeId:begun.challengeId,code},400),{result:'CODE_UNAVAILABLE'}),'CODE_REPLAY_REVIEW_REQUIRED');r.used_code_replay_denied=true;
  r.recovery_transaction_attempted=true;
  const probe=row(await mgmt('ROLLED_BACK_RECOVERY_REHEARSAL',await recoverySQL(actor,begun.challengeId)),'recovery_probe');
  need(isDeepStrictEqual(probe,{real_session_email_proof_present:true,resume_and_quarantine_functions_executed:true,authenticated_role_predicate_and_own_profile_visible_inside_uncommitted_active_state:true,quarantined_predicate_and_own_profile_denied:true,proof_retained_through_quarantine:true}),'RECOVERY_REHEARSAL_REVIEW_REQUIRED');r.rolled_back_recovery_rehearsal_passed=true;
  await closedHTTP('AFTER_PROOF_QUARANTINED');r.post_proof_quarantined_HTTP_access_denied=true;mainPassed=true;
 }catch(e){r.failure_checkpoint=r.checkpoint;r.problem_code=safe(e);}
 finally{
  if(token&&actor){
   try{r.Auth_local_logout_attempted=true;await request('AUTH_LOCAL_LOGOUT',api+'/auth/v1/logout?scope=local',{method:'POST',headers:authHeaders(),expected:204,json:false});r.Auth_local_logout_HTTP_accepted=true;}catch(e){r.cleanup_problem_code=safe(e);}
   try{const clean=row(await mgmt('SELECTED_AUTH_SESSION_CLEANUP',cleanupSQL(actor)),'session_cleanup');need(isDeepStrictEqual(clean,{context:{privileged_origin:true,transaction_read_only:'on'},selected_session_absent:true,selected_proofs_absent:true,selected_challenges_absent:true}),'AUTH_CLEANUP_REVIEW_REQUIRED');r.selected_Auth_session_and_proofs_and_challenges_absent=true;r.Auth_session_cleanup_outcome_uncertain=false;}catch(e){r.cleanup_problem_code??=safe(e);}
  }
  if(ready){
   try{quarantined(row(await mgmt('QUARANTINED_CATALOG_AFTER',sql.readback),'quarantined_readback'));r.quarantined_catalog_after_verified=true;target(await mgmt('TARGET_AFTER'));r.fixed_target_before_and_after_verified=true;}catch(e){r.final_state_problem_code=safe(e);}
  }
  token=null;actor=null;
 }
 if(mainPassed&&!r.cleanup_problem_code&&!r.final_state_problem_code&&r.selected_Auth_session_and_proofs_and_challenges_absent&&r.quarantined_catalog_after_verified){r.result='BATCH_I_REAL_STAGING_EMAIL_PROOF_AND_ROLLED_BACK_RECOVERY_SCOPED_PASS';r.checkpoint='COMPLETE';r.exit_code=0;}
 else {if(!r.problem_code)r.problem_code=r.cleanup_problem_code||r.final_state_problem_code||'AUTH_CLEANUP_REVIEW_REQUIRED';if(r.failure_checkpoint)r.checkpoint=r.failure_checkpoint;}
 r.checked_UTC=new Date().toISOString();return r;
}
export async function privateDialogue(input,{readNext,emit,probe=controlledProbe}={}){
 if(exact(input,['preflight'])&&input.preflight===true)return {stage_step:stage,result:'PRIVATE_DIALOGUE_PREFLIGHT_PASS',actual_hosted_requests:0,exit_code:0};
 let asked=false;
 return await probe(input,{readCode:async()=>{
  need(!asked&&typeof readNext==='function'&&typeof emit==='function','CODE_INPUT_REQUIRED');asked=true;
  emit({protocol:'BATCH_I_CODE_REQUIRED'});
  const x=await readNext(480000);need(exact(x,['code'])&&typeof x.code==='string','CODE_INPUT_REQUIRED');return x.code;
 }});
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 let answer;let rl;
 try{
  need(process.argv.length===3&&process.argv[2]==='--private-dialogue'&&!process.stdin.isTTY&&!process.stdout.isTTY,'PRIVATE_INPUT_REQUIRED');
  rl=createInterface({input:process.stdin,crlfDelay:Infinity});const iterator=rl[Symbol.asyncIterator]();
  async function readLine(timeout){let timer;try{const line=await Promise.race([iterator.next(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('INPUT_TIMEOUT')),timeout);})]);need(!line.done&&Buffer.byteLength(line.value)<=16384,'PRIVATE_INPUT_REQUIRED');return JSON.parse(line.value);}finally{clearTimeout(timer);}}
  const input=await readLine(30000);
  answer=await privateDialogue(input,{readNext:readLine,emit:x=>process.stdout.write(JSON.stringify(x)+'\n')});
 }catch{answer={stage_step:stage,result:'PRIVATE_BATCH_I_INPUT_REVIEW_REQUIRED',actual_hosted_requests:0,problem_code:'PRIVATE_INPUT_REQUIRED',exit_code:1};}
 finally{rl?.close();process.stdin.destroy();}
 process.stdout.write(JSON.stringify({protocol:'BATCH_I_RESULT',receipt:answer})+'\n');process.exitCode=answer.exit_code;
}
