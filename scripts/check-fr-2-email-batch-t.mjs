// Fixed staging shared-component browser acceptance with a private Management lifecycle.
// The browser gets selected sessions only; no Management token, service key, pepper or Zoho secret.
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline';
import {isDeepStrictEqual as equal} from 'node:util';
import {stateSQL,openSQL,leaseSQL,quarantineSQL,deviceCleanupSQL,windowSeconds,responseShapeSQL} from './lib/email-bounded-http-sql.mjs';
import {startStagingBrowser} from './lib/browser-staging-acceptance.mjs';
import {contextSQL,stagingRef} from './lib/email-registration-handoff-sql.mjs';

import {isSingleMailbox} from '../supabase/functions/_shared/email-verification-zoho.mjs';
import {deviceDigest} from '../supabase/functions/_shared/email-verification-crypto.mjs';
import {parseStagingConfiguration} from './prepare-fr-2-email-edge-batch-a.mjs';
export const stage='FR.2.4.E5.33_BATCH_T_HOSTED_SHARED_BROWSER_PROOF_COOKIE_AND_BOUNDED_RECOVERY';
export const acknowledgement='BROWSER_ONE_EMAIL_FIRST_ACCOUNT_FIVE_MINUTES_THEN_QUARANTINE';
export const origin='https://mushavo-budget-staging.pages.dev';
const api='https://'+stagingRef+'.supabase.co',management='https://api.supabase.com/v1/projects/'+stagingRef;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&equal(Object.keys(x).sort(),keys.slice().sort());
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(x);
const need=(v,code)=>{if(!v)throw Object.assign(Error(code),{safeCode:code});};
const problems=new Set(['PRIVATE_INPUT_REQUIRED','TARGET_REQUIRED','CATALOG_REQUIRED','RESPONSE_REQUIRED','NETWORK_REQUIRED','IDENTITY_REQUIRED','ORDINARY_ACTORS_REQUIRED','QUARANTINED_DENIAL_REQUIRED','EMAIL_REQUIRED','CODE_REQUIRED','COOKIE_REQUIRED','ACCOUNT_BINDING_REQUIRED','RESTORE_REQUIRED','DEVICE_STATE_REQUIRED','DEVICE_CLEANUP_REQUIRED','AUTH_CLEANUP_REQUIRED','WINDOW_REQUIRED','ACTIVE_HTTP_REQUIRED','QUARANTINE_REQUIRED','MANAGEMENT_RESULT_SHAPE_REQUIRED','WINDOW_RESPONSE_SHAPE_REQUIRED','WINDOW_LEASE_MATCH_REQUIRED','WINDOW_DEADLINE_REQUIRED','BROWSER_REQUIRED','BROWSER_INPUT_REQUIRED','BROWSER_RESPONSE_REQUIRED','BROWSER_REQUEST_GUARD_REQUIRED','BROWSER_UNREVIEWED_WORKER','BROWSER_SOURCE_REQUIRED','BROWSER_TLS_REQUIRED','BROWSER_NAVIGATION_REQUIRED','BROWSER_STORAGE_REQUIRED','BROWSER_CLEANUP_REQUIRED']);
const safe=e=>problems.has(e?.safeCode)?e.safeCode:/^(?:BROWSER_|CDP_)/.test(e?.message||'')?'BROWSER_REQUIRED':'NETWORK_REQUIRED';
const quote=x=>"'"+String(x).replaceAll("'","''")+"'";
const ro=body=>`BEGIN TRANSACTION READ ONLY;\nSET LOCAL statement_timeout='25s';\nSET LOCAL lock_timeout='3s';\nSET LOCAL search_path=pg_catalog;\n${body}\nROLLBACK;\n`;
function actorsRequired(actors){
 need(Array.isArray(actors)&&actors.length===4&&actors.every(a=>exact(a,['user','session','email'])&&uuid(a.user)&&uuid(a.session)&&isSingleMailbox(a.email))&&
  actors.slice(0,3).every(a=>a.user===actors[0].user&&a.email===actors[0].email)&&actors[3].user!==actors[0].user&&actors[3].email!==actors[0].email&&new Set(actors.map(a=>a.session)).size===4,'IDENTITY_REQUIRED');
}
function challengeRequired(c){need(uuid(c),'DEVICE_STATE_REQUIRED');}
function actorValues(actors){actorsRequired(actors);return actors.map(a=>`(${quote(a.user)}::uuid,${quote(a.session)}::uuid,${quote(a.email)})`).join(',');}
export function actorFactsSQL(actors){return ro(`WITH selected(user_id,session_id,email) AS (VALUES ${actorValues(actors)})
SELECT jsonb_build_object('context',${contextSQL},'four_ordinary_live_sessions',
 (SELECT count(*)=4 FROM selected x JOIN auth.users u ON u.id=x.user_id JOIN auth.sessions s ON s.id=x.session_id AND s.user_id=u.id JOIN public.profiles p ON p.id=u.id
 WHERE lower(u.email)=lower(x.email) AND u.email_confirmed_at IS NOT NULL AND p.account_status='active'
 AND (u.banned_until IS NULL OR u.banned_until<=statement_timestamp()) AND (s.not_after IS NULL OR s.not_after>statement_timestamp())
 AND NOT EXISTS(SELECT 1 FROM public.app_admins z WHERE z.user_id=u.id OR lower(z.email)=lower(u.email))),
 'fresh_session_proofs_absent',NOT EXISTS(SELECT 1 FROM mushavo_email_auth.session_proofs p JOIN selected x ON p.session_id=x.session_id)) AS actor_facts;`);}
export function deviceStateSQL(actors,c,digest,cookieExpirySeconds){actorsRequired(actors);challengeRequired(c);need(Number.isSafeInteger(cookieExpirySeconds)&&cookieExpirySeconds>0,'COOKIE_REQUIRED');need(typeof digest==='string'&&/^[a-f0-9]{64}$/.test(digest),'DEVICE_STATE_REQUIRED');const [a,b,f,o]=actors;
 return ro(`SELECT jsonb_build_object('context',${contextSQL},'one_exact_fixed_deadline_device',
 (SELECT count(*)=1 AND coalesce(bool_and(credential_digest=${quote(digest)} AND revoked_at IS NULL AND expires_at=verified_at+interval '168 hours' AND expires_at>statement_timestamp() AND floor(extract(epoch FROM expires_at))=${cookieExpirySeconds}),false)
 FROM mushavo_email_auth.devices WHERE user_id=${quote(a.user)}::uuid AND origin_challenge_id=${quote(c)}::uuid),
 'email_proof_and_restored_proof_bound',EXISTS(SELECT 1 FROM mushavo_email_auth.session_proofs p JOIN mushavo_email_auth.session_proofs q ON p.user_id=q.user_id
 JOIN mushavo_email_auth.devices d ON d.id=q.device_id JOIN mushavo_email_auth.challenges c ON c.id=d.origin_challenge_id
 WHERE p.session_id=${quote(a.session)}::uuid AND p.source='email' AND p.device_id=d.id AND q.session_id=${quote(b.session)}::uuid AND q.source='device'
 AND d.user_id=${quote(a.user)}::uuid AND d.origin_challenge_id=${quote(c)}::uuid AND p.verified_at=d.verified_at AND q.verified_at=d.verified_at
 AND c.session_id=p.session_id AND c.user_id=p.user_id AND c.state='used' AND c.remember_device=true),
 'fresh_and_other_account_proofs_absent',NOT EXISTS(SELECT 1 FROM mushavo_email_auth.session_proofs WHERE session_id IN (${quote(f.session)}::uuid,${quote(o.session)}::uuid))) AS device_state;`);
}
export function cleanupSQL(actors,c=null){need(Array.isArray(actors)&&actors.length<=4&&actors.every(a=>exact(a,['user','session','email'])&&uuid(a.user)&&uuid(a.session)&&isSingleMailbox(a.email)),'IDENTITY_REQUIRED');if(c!==null)challengeRequired(c);const sessions=actors.length?actors.map(a=>quote(a.session)+'::uuid').join(','):'NULL::uuid';
 return ro(`SELECT jsonb_build_object('context',${contextSQL},'selected_sessions_absent',NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id IN (${sessions})),
 'selected_proofs_absent',NOT EXISTS(SELECT 1 FROM mushavo_email_auth.session_proofs WHERE session_id IN (${sessions})),
 'selected_challenges_absent',NOT EXISTS(SELECT 1 FROM mushavo_email_auth.challenges WHERE session_id IN (${sessions})),
 'selected_generated_device_absent',${c&&actors.length?`NOT EXISTS(SELECT 1 FROM mushavo_email_auth.devices WHERE user_id=${quote(actors[0].user)}::uuid AND origin_challenge_id=${quote(c)}::uuid)`:'true'}) AS session_cleanup;`);
}
export async function controlledProbe(input,{transport=fetch,readCode=async()=>{throw Error('CODE_REQUIRED');},createBrowser=startStagingBrowser}={}){
 const r={stage_step:stage,batch:'T',result:'BATCH_T_BOUNDED_HTTP_ACCEPTANCE_REVIEW_REQUIRED',actual_hosted_requests:0,maximum_direct_HTTP_requests:32,gateway_internal_provider_requests_not_counted:true,
 fixed_target_before_and_after_verified:false,quarantined_catalog_before_verified:false,live_public_key_matches_private_snapshot:false,management_multiple_SELECT_result_shape:null,active_window_readback_rows:null,active_window_readback_shape_matched:false,active_window_lease_matched:false,active_window_remaining_seconds:null,four_ordinary_sessions_verified:false,
 quarantined_password_only_HTTP_denied:false,email_request_attempts:0,email_provider_acceptance_observed:false,email_dispatch_outcome_uncertain:false,email_code_verified:false,verification_outcome_uncertain:false,
 secure_fixed_deadline_remember_cookie_observed:false,foreign_account_renamed_cookie_restore_denied:false,missing_cookie_restore_requires_code:false,same_account_new_session_restore_approved:false,repeated_restore_emits_no_cookie:false,
 independent_device_and_proof_binding_aggregates_verified:false,bounded_window_seconds:windowSeconds,allowed_window_accounts:1,bounded_open_write_attempts:0,open_write_outcome_uncertain:false,independent_active_window_verified:false,
 verified_email_and_restored_session_HTTP_access_passed:false,same_account_password_only_HTTP_denied:false,other_account_password_only_HTTP_denied:false,verified_sessions_foreign_profile_HTTP_denied:false,
 pre_quarantine_state_inspected:false,quarantine_write_attempts:0,quarantine_write_outcome_uncertain:false,quarantine_response_problem_code:null,explicit_quarantine_and_stale_open_fence_verified:false,post_window_quarantined_HTTP_denied:false,committed_mode_change_requests:0,
 exact_generated_device_cleanup_write_attempts:0,device_cleanup_write_outcome_uncertain:false,selected_generated_device_absent:false,Auth_password_signin_attempts:0,Auth_local_logout_attempts:0,
 Auth_session_cleanup_outcome_uncertain:false,selected_sessions_proofs_and_challenges_absent:false,quarantined_catalog_after_verified:false,
 application_rows_explicitly_written:false,private_rate_and_send_audit_retained:true,other_devices_or_Auth_sessions_explicitly_deleted:false,
 browser_cookie_cache_or_device_restore_verified:false,full_cross_account_and_role_acceptance_verified:false,real_PostgreSQL_concurrency_verified:false,full_scheduler_or_external_caller_graph_verified:false,
 credentials_codes_cookies_or_raw_provider_bodies_in_safe_result:false,credentials_or_cookies_saved_to_disk_arguments_or_environment:false,
 Auth_settings_secrets_schedules_or_deployments_changed:false,live_activation_approved:false,hosted_acceptance:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],
 browser:null,samples:[],cleanup_problem_code:null,final_state_problem_code:null,failure_checkpoint:null,checkpoint:'PRIVATE_INPUT',problem_code:null,exit_code:1};
 const sessions=[];let browser=null;let sql,version,ready=false,challenge=null,credential=null,main=false,knownLogins=0,fence=null,openAttempted=false,closedVerified=false,activeDeadline=0;
 const row=(x,n)=>{need(Array.isArray(x)&&x.length===1&&exact(x[0],[n]),'RESPONSE_REQUIRED');return x[0][n];};
 async function request(label,url,{method='GET',headers={},body,expected=200,json=true,gateway=false,cookiePolicy='none'}={}){
  if(label.startsWith('ACTIVE_SESSION_'))need(Date.now()<activeDeadline,'WINDOW_REQUIRED');
  r.checkpoint=label;r.actual_hosted_requests++;need(r.actual_hosted_requests<=32,'RESPONSE_REQUIRED');const sample={endpoint:label,http_status:null};r.samples.push(sample);
  const res=await transport(url,{method,redirect:'error',signal:AbortSignal.timeout(label.startsWith('ACTIVE_SESSION_')?15000:40000),headers:{Accept:json?'application/json':'text/javascript','Cache-Control':'no-store',...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});sample.http_status=res.status;
  if(res.redirected||(res.url&&res.url!==url)||res.status!==expected){await res.body?.cancel();need(false,'RESPONSE_REQUIRED');}
  if(expected===204){await res.body?.cancel();return {data:null,cookie:null};}
  need(json?/^application\/json(?:\s*;|$)/i.test(res.headers.get('content-type')||''):/^(application|text)\/javascript(?:\s*;|$)/i.test(res.headers.get('content-type')||''),'RESPONSE_REQUIRED');
  const cookie=res.headers.get('set-cookie');
  if(gateway){need(res.headers.get('cache-control')==='no-store'&&res.headers.get('x-content-type-options')==='nosniff'&&res.headers.get('referrer-policy')==='no-referrer'&&res.headers.get('content-security-policy')==="default-src 'none'; frame-ancestors 'none'",'RESPONSE_REQUIRED');if(cookiePolicy==='none')need(cookie===null,'COOKIE_REQUIRED');else if(cookiePolicy!=='remember')need(cookie===cookiePolicy,'COOKIE_REQUIRED');}
  const reader=res.body?.getReader();need(reader,'RESPONSE_REQUIRED');let bytes=0;const chunks=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;need(bytes<=131072,'RESPONSE_REQUIRED');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  try{const text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));return {data:json?JSON.parse(text):text,cookie};}catch{need(false,'RESPONSE_REQUIRED');}
 }
 const mgmt=async(label,query)=>(await request(label,management+(query?'/database/query':''),{method:query?'POST':'GET',headers:{Authorization:'Bearer '+input.managementToken,...(query?{'Content-Type':'application/json'}:{})},...(query?{body:{query,read_only:false},expected:201}:{})})).data;
 const target=x=>need(object(x)&&object(x.database)&&(x.ref===stagingRef||(x.ref===undefined&&x.id===stagingRef))&&!(typeof x.id==='string'&&/^[a-z]{20}$/.test(x.id)&&x.id!==stagingRef)&&x.status==='ACTIVE_HEALTHY'&&x.database.host==='db.'+stagingRef+'.supabase.co','TARGET_REQUIRED');
 function observation(x,{closed=false,fenced=false}={}){
  need(exact(x,['context','server_version_num','catalog_kind','control_rows','quarantined_stamp_matched','predicate_source_matched','mode','private_fence','stamp_matched','window_present','window_empty','guarded_RPCs','restrictive_policies','backend_forced_RLS_tables','private_schema_API_denied'])&&equal(x.context,{privileged_origin:true,transaction_read_only:'on'})&&Number.isInteger(x.server_version_num)&&(!version||version===x.server_version_num)&&x.catalog_kind==='BOUNDED'&&x.control_rows===1&&x.predicate_source_matched===true&&x.stamp_matched===true&&x.window_present===true&&x.guarded_RPCs===148&&x.restrictive_policies===82&&x.backend_forced_RLS_tables===5&&x.private_schema_API_denied===true&&/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,6})?\+00$/.test(x.private_fence)&&['ACTIVE','QUARANTINED'].includes(x.mode)&&typeof x.window_empty==='boolean'&&x.quarantined_stamp_matched===(x.mode==='QUARANTINED'),'CATALOG_REQUIRED');
  if(closed)need(x.mode==='QUARANTINED'&&x.quarantined_stamp_matched&&x.window_empty,'QUARANTINE_REQUIRED');
  if(fenced)need(x.private_fence!==fence,'QUARANTINE_REQUIRED');
  version=x.server_version_num;return x;
 }

 const auth=s=>({apikey:input.publishableKey,Authorization:'Bearer '+s.token});

 try{
  need(exact(input,['managementToken','accounts','publishableKey','allowedRecipients','acknowledgement','browserExecutable'])&&input.acknowledgement===acknowledgement&&typeof input.browserExecutable==='string'&&input.browserExecutable.length>0&&input.browserExecutable.length<=4096&&!/[\0\r\n]/.test(input.browserExecutable)&&typeof input.managementToken==='string'&&/^sbp_fc[A-Za-z0-9_-]{20,512}$/.test(input.managementToken)&&typeof input.publishableKey==='string'&&/^sb_publishable_[A-Za-z0-9_-]{1,512}$/.test(input.publishableKey)&&Array.isArray(input.allowedRecipients)&&input.allowedRecipients.length>=2&&input.allowedRecipients.length<=10&&input.allowedRecipients.every(isSingleMailbox)&&Array.isArray(input.accounts)&&input.accounts.length===2&&input.accounts.every(a=>exact(a,['email','password'])&&isSingleMailbox(a.email)&&typeof a.password==='string'&&a.password.length>0&&a.password.length<=4096&&!/[\0\r\n]/.test(a.password)&&input.allowedRecipients.some(x=>x.toLowerCase()===a.email.toLowerCase()))&&input.accounts[0].email.toLowerCase()!==input.accounts[1].email.toLowerCase(),'PRIVATE_INPUT_REQUIRED');
  sql=await stateSQL();target(await mgmt('TARGET_BEFORE'));const initial=observation(row(await mgmt('QUARANTINED_CATALOG_BEFORE',sql),'bounded_state'),{closed:true});fence=initial.private_fence;ready=true;closedVerified=true;r.quarantined_catalog_before_verified=true;
  const shape=await mgmt('READ_ONLY_MANAGEMENT_RESULT_SHAPE',responseShapeSQL);
  const last={bounded_shape_last:'LAST_PUBLIC_CONSTANT',bounded_shape_pair:true};
  if(equal(shape,[last]))r.management_multiple_SELECT_result_shape='LAST_ROWSET_ONLY';
  else if(equal(shape,[{bounded_shape_first:'FIRST_PUBLIC_CONSTANT'},last]))r.management_multiple_SELECT_result_shape='ALL_ROWSETS_FLATTENED';
  else need(false,'MANAGEMENT_RESULT_SHAPE_REQUIRED');
  need(parseStagingConfiguration((await request('LIVE_PUBLIC_CONFIGURATION',origin+'/config.js',{json:false})).data).supabasePublishableKey===input.publishableKey,'TARGET_REQUIRED');r.live_public_key_matches_private_snapshot=true;
  r.checkpoint='BROWSER_PUBLIC_PREFLIGHT';browser=createBrowser(input.browserExecutable,{publishableKey:input.publishableKey});await browser.preflight();
  for(let i=0;i<4;i++){
   const account=input.accounts[i===3?1:0];r.Auth_password_signin_attempts++;r.Auth_session_cleanup_outcome_uncertain=true;
   const login=(await request('AUTH_SIGNIN_'+(i+1),api+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:input.publishableKey,'Content-Type':'application/json'},body:account})).data;
   need(object(login)&&object(login.user)&&typeof login.access_token==='string'&&login.access_token.length<=16384&&/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(login.access_token),'IDENTITY_REQUIRED');
   let c;try{c=JSON.parse(Buffer.from(login.access_token.split('.')[1],'base64url').toString('utf8'));}catch{need(false,'IDENTITY_REQUIRED');}
   need(object(c)&&uuid(c.sub)&&uuid(c.session_id)&&c.sub===login.user.id&&c.iss===api+'/auth/v1'&&c.role==='authenticated'&&c.aud==='authenticated'&&Number.isInteger(c.exp)&&c.exp>Math.floor(Date.now()/1000)&&isSingleMailbox(login.user.email)&&login.user.email.toLowerCase()===account.email.toLowerCase()&&login.user.is_anonymous!==true,'IDENTITY_REQUIRED');
   const s={actor:{user:c.sub,session:c.session_id,email:account.email},token:login.access_token};sessions.push(s);knownLogins++;
   const user=(await request('AUTH_IDENTITY_'+(i+1),api+'/auth/v1/user',{headers:auth(s)})).data;
   need(object(user)&&user.id===c.sub&&isSingleMailbox(user.email)&&user.email.toLowerCase()===account.email.toLowerCase()&&user.is_anonymous!==true&&typeof user.email_confirmed_at==='string'&&Number.isFinite(Date.parse(user.email_confirmed_at)),'IDENTITY_REQUIRED');
  }
  const actors=sessions.map(s=>s.actor);actorsRequired(actors);
  need(equal(row(await mgmt('FOUR_SELECTED_ACTOR_FACTS',actorFactsSQL(actors)),'actor_facts'),{context:{privileged_origin:true,transaction_read_only:'on'},four_ordinary_live_sessions:true,fresh_session_proofs_absent:true}),'ORDINARY_ACTORS_REQUIRED');r.four_ordinary_sessions_verified=true;
  r.checkpoint='BROWSER_PASSWORD_ONLY';await browser.attachSessions(sessions);r.quarantined_password_only_HTTP_denied=true;
  r.checkpoint='BROWSER_ONE_EMAIL_PROOF';await browser.prove(readCode);
  r.checkpoint='BROWSER_RESTORE_AND_ACCOUNT_BINDING';await browser.restoreAndBind();
  const device=browser.privateState();challenge=device.challenge;credential=device.credential;
  const digest=await deviceDigest(credential);
  need(equal(row(await mgmt('INDEPENDENT_DEVICE_BINDING',deviceStateSQL(actors,challenge,digest,device.cookieExpirySeconds)),'device_state'),{context:{privileged_origin:true,transaction_read_only:'on'},one_exact_fixed_deadline_device:true,email_proof_and_restored_proof_bound:true,fresh_and_other_account_proofs_absent:true}),'DEVICE_STATE_REQUIRED');r.independent_device_and_proof_binding_aggregates_verified=true;
  // No terminal prompt occurs while the account window is open.
  r.bounded_open_write_attempts=1;r.open_write_outcome_uncertain=true;openAttempted=true;closedVerified=false;r.committed_mode_change_requests++;
  need(equal(row(await mgmt('OPEN_FIRST_ACCOUNT_FIVE_MINUTE_WINDOW',await openSQL(actors[0].user,fence)),'bounded_open'),{opened:true,allowed_actor_count:1,maximum_seconds:windowSeconds}),'WINDOW_REQUIRED');
  const leaseRows=await mgmt('INDEPENDENT_ACTIVE_WINDOW',await leaseSQL(actors[0].user,fence));
  r.active_window_readback_rows=Array.isArray(leaseRows)&&leaseRows.length<=4?leaseRows.length:null;
  need(Array.isArray(leaseRows)&&leaseRows.length===1&&exact(leaseRows[0],['bounded_state','bounded_lease']),'WINDOW_RESPONSE_SHAPE_REQUIRED');r.active_window_readback_shape_matched=true;
  const live=observation(leaseRows[0].bounded_state),lease=leaseRows[0].bounded_lease;
  need(live.mode==='ACTIVE'&&!live.window_empty&&exact(lease,['exact_live_lease','remaining_seconds'])&&lease.exact_live_lease===true,'WINDOW_LEASE_MATCH_REQUIRED');r.active_window_lease_matched=true;
  if(Number.isInteger(lease.remaining_seconds)&&lease.remaining_seconds>=0&&lease.remaining_seconds<=windowSeconds)r.active_window_remaining_seconds=lease.remaining_seconds;
  need(Number.isInteger(lease.remaining_seconds)&&lease.remaining_seconds>=30&&lease.remaining_seconds<=windowSeconds,'WINDOW_DEADLINE_REQUIRED');
  // Use a conservative local budget; the database server remains the authority for expiry.
  activeDeadline=Date.now()+(lease.remaining_seconds-10)*1000;
  r.open_write_outcome_uncertain=false;r.independent_active_window_verified=true;
  r.checkpoint='BROWSER_ACTIVE_WINDOW_HTTP';await browser.activeWindow(activeDeadline);
  r.verified_email_and_restored_session_HTTP_access_passed=true;r.same_account_password_only_HTTP_denied=true;r.other_account_password_only_HTTP_denied=true;r.verified_sessions_foreign_profile_HTTP_denied=true;main=true;

 }catch(e){r.failure_checkpoint=r.checkpoint;r.problem_code=safe(e);}
 finally{
  if(browser){try{challenge??=browser.privateState().challenge;}catch{r.cleanup_problem_code??='BROWSER_REQUIRED';}}
  if(openAttempted){
   // Inspect existing state before containment; never repeat or extend the open.
   try{observation(row(await mgmt('INSPECT_WINDOW_BEFORE_QUARANTINE',sql),'bounded_state'));r.pre_quarantine_state_inspected=true;}catch(e){r.cleanup_problem_code??=safe(e);}
   r.quarantine_write_attempts=1;r.quarantine_write_outcome_uncertain=true;r.committed_mode_change_requests++;
   try{need(equal(row(await mgmt('QUARANTINE_AND_EXACT_WINDOW_CLEANUP',await quarantineSQL(sessions[0].actor.user,fence)),'bounded_close'),{quarantined:true,window_empty:true,stale_open_fenced:true}),'QUARANTINE_REQUIRED');}catch(e){r.quarantine_response_problem_code=safe(e);}
   try{observation(row(await mgmt('INDEPENDENT_QUARANTINE_AND_FENCE',sql),'bounded_state'),{closed:true,fenced:true});closedVerified=true;r.explicit_quarantine_and_stale_open_fence_verified=true;r.quarantine_write_outcome_uncertain=false;r.open_write_outcome_uncertain=false;}catch(e){r.cleanup_problem_code??=safe(e);}
   if(closedVerified&&main){try{r.checkpoint='BROWSER_POST_QUARANTINE';await browser.afterQuarantine();r.post_window_quarantined_HTTP_denied=true;}catch(e){r.cleanup_problem_code??=safe(e);r.failure_checkpoint??=r.checkpoint;}}
  }

  if(challenge&&sessions.length&&closedVerified){r.exact_generated_device_cleanup_write_attempts=1;r.device_cleanup_write_outcome_uncertain=true;
   try{need(equal(row(await mgmt('EXACT_GENERATED_DEVICE_CLEANUP',await deviceCleanupSQL(sessions[0].actor,challenge)),'device_cleanup'),{selected_generated_device_absent:true}),'DEVICE_CLEANUP_REQUIRED');}catch(e){r.cleanup_problem_code=safe(e);}
  }

  for(let i=0;i<sessions.length;i++){r.Auth_local_logout_attempts++;try{await request('AUTH_LOCAL_LOGOUT_'+(i+1),api+'/auth/v1/logout?scope=local',{method:'POST',headers:auth(sessions[i]),expected:204});}catch(e){r.cleanup_problem_code??=safe(e);}}
  if(sessions.length){try{const clean=row(await mgmt('INDEPENDENT_SELECTED_CLEANUP',cleanupSQL(sessions.map(s=>s.actor),challenge)),'session_cleanup');need(equal(clean,{context:{privileged_origin:true,transaction_read_only:'on'},selected_sessions_absent:true,selected_proofs_absent:true,selected_challenges_absent:true,selected_generated_device_absent:true}),'AUTH_CLEANUP_REQUIRED');r.selected_generated_device_absent=true;r.selected_sessions_proofs_and_challenges_absent=true;r.device_cleanup_write_outcome_uncertain=false;r.Auth_session_cleanup_outcome_uncertain=knownLogins!==r.Auth_password_signin_attempts;}catch(e){r.cleanup_problem_code??=safe(e);}}
  if(ready){try{observation(row(await mgmt('QUARANTINED_CATALOG_AFTER',sql),'bounded_state'),{closed:true,fenced:openAttempted});r.quarantined_catalog_after_verified=true;target(await mgmt('TARGET_AFTER'));r.fixed_target_before_and_after_verified=true;}catch(e){r.final_state_problem_code=safe(e);}}
  if(browser){try{r.browser=await browser.close();const b=r.browser;
   r.email_request_attempts=b.email_request_attempts;r.email_provider_acceptance_observed=b.email_provider_acceptance_observed;r.email_dispatch_outcome_uncertain=b.email_dispatch_outcome_uncertain;
   r.email_code_verified=b.email_code_verified;r.verification_outcome_uncertain=b.verification_outcome_uncertain;r.secure_fixed_deadline_remember_cookie_observed=b.secure_fixed_deadline_remember_cookie_observed;
   r.foreign_account_renamed_cookie_restore_denied=b.foreign_account_renamed_cookie_restore_denied;r.missing_cookie_restore_requires_code=b.cookie_free_same_account_browser_denied;
   r.same_account_new_session_restore_approved=b.same_account_new_session_restore_approved;r.repeated_restore_emits_no_cookie=b.repeated_restore_emits_no_cookie;
   r.browser_cookie_cache_or_device_restore_verified=b.cleanup_verified&&b.private_web_storage_and_cache_empty;
   if(!b.cleanup_verified||b.problem_code)r.cleanup_problem_code??=b.problem_code||'BROWSER_CLEANUP_REQUIRED';
  }catch{r.cleanup_problem_code??='BROWSER_CLEANUP_REQUIRED';}}
  credential=null;for(const s of sessions)s.token=null;
 }
 if(main&&r.browser?.cleanup_verified&&r.browser?.verified_browser_views_and_HTTP_passed&&r.browser?.account_change_clears_view_and_ticket&&r.browser?.same_account_session_change_clears_view_and_ticket&&r.explicit_quarantine_and_stale_open_fence_verified&&r.post_window_quarantined_HTTP_denied&&!r.problem_code&&!r.cleanup_problem_code&&!r.final_state_problem_code&&!r.Auth_session_cleanup_outcome_uncertain&&r.selected_generated_device_absent&&r.selected_sessions_proofs_and_challenges_absent&&r.quarantined_catalog_after_verified){r.result='BATCH_T_HOSTED_SHARED_BROWSER_AND_BOUNDED_RECOVERY_SCOPED_PASS';r.checkpoint='COMPLETE';r.exit_code=0;}
 else {r.problem_code??=r.cleanup_problem_code||r.final_state_problem_code||'AUTH_CLEANUP_REQUIRED';if(r.failure_checkpoint)r.checkpoint=r.failure_checkpoint;}
 r.checked_UTC=new Date().toISOString();return r;
}
export async function privateDialogue(input,{readNext,emit,probe=controlledProbe}={}){
 if(exact(input,['preflight'])&&input.preflight===true)return {stage_step:stage,result:'PRIVATE_DIALOGUE_PREFLIGHT_PASS',actual_hosted_requests:0,exit_code:0};
 let asked=false;return probe(input,{readCode:async()=>{need(!asked&&typeof readNext==='function'&&typeof emit==='function','CODE_REQUIRED');asked=true;emit({protocol:'BATCH_T_CODE_REQUIRED'});const x=await readNext(480000);need(exact(x,['code'])&&typeof x.code==='string','CODE_REQUIRED');return x.code;}});
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 let answer,rl;
 try{need(process.argv.length===3&&process.argv[2]==='--private-dialogue'&&!process.stdin.isTTY&&!process.stdout.isTTY,'PRIVATE_INPUT_REQUIRED');rl=createInterface({input:process.stdin,crlfDelay:Infinity});const it=rl[Symbol.asyncIterator]();
  async function readLine(timeout){let timer;try{const line=await Promise.race([it.next(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('INPUT_TIMEOUT')),timeout);})]);need(!line.done&&Buffer.byteLength(line.value)<=65536,'PRIVATE_INPUT_REQUIRED');return JSON.parse(line.value);}finally{clearTimeout(timer);}}
  answer=await privateDialogue(await readLine(30000),{readNext:readLine,emit:x=>process.stdout.write(JSON.stringify(x)+'\n')});
 }catch{answer={stage_step:stage,result:'PRIVATE_BATCH_T_INPUT_REVIEW_REQUIRED',actual_hosted_requests:0,problem_code:'PRIVATE_INPUT_REQUIRED',exit_code:1};}finally{rl?.close();process.stdin.destroy();}
 process.stdout.write(JSON.stringify({protocol:'BATCH_T_RESULT',receipt:answer})+'\n');process.exitCode=answer.exit_code;
}
