// Synthetic direct transport and browser port for exhaustive orchestration failure tests.
import {acknowledgement,origin} from '../../scripts/check-fr-2-email-batch-t.mjs';
import {stagingRef} from '../../scripts/lib/email-registration-handoff-sql.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const api='https://'+stagingRef+'.supabase.co',management='https://api.supabase.com/v1/projects/'+stagingRef;
export const actors=[1,2,3,4].map((n)=>({user:id(n===4?22002:22001),session:id(23000+n),email:n===4?'second@example.invalid':'first@example.invalid'}));
const users=actors.map(a=>({id:a.user,email:a.email,email_confirmed_at:new Date().toISOString(),is_anonymous:false}));
export const tokens=actors.map(a=>[{alg:'HS256'},{sub:a.user,session_id:a.session,iss:api+'/auth/v1',role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.SYNTHETIC');
export const input={managementToken:'sbp_fc'+'SYNTHETIC_ONLY_'.repeat(3),accounts:[{email:actors[0].email,password:'SYNTHETIC_FIRST_PASSWORD'},{email:actors[3].email,password:'SYNTHETIC_SECOND_PASSWORD'}],publishableKey:'sb_publishable_SYNTHETIC',allowedRecipients:[actors[0].email,actors[3].email],acknowledgement,browserExecutable:'/synthetic/chrome.exe'};
import {stateSQL,openSQL,quarantineSQL,leaseSQL,deviceCleanupSQL,windowSeconds,responseShapeSQL} from '../../scripts/lib/email-bounded-http-sql.mjs';
import {windowHandoffSQL} from '../../scripts/lib/email-window-handoff-sql.mjs';
const context={privileged_origin:true,transaction_read_only:'on'},challenge=id(24001),credential='K'.repeat(43);
const cookieName=i=>'__Host-mushavo_device_'+actors[i].user.replaceAll('-','');
const clear=i=>cookieName(i)+'=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0';
const gh={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; frame-ancestors 'none'"};
const reply=(data,status=200,headers={})=>Response.json(data,{status,headers});

const fence='2026-10-23 09:33:05.020000+00',later='2026-10-23 10:33:05.020000+00';
function observation(mode='QUARANTINED',after=false){return {context,server_version_num:180003,catalog_kind:'BOUNDED',control_rows:1,quarantined_stamp_matched:mode==='QUARANTINED',predicate_source_matched:true,mode,private_fence:after?later:fence,stamp_matched:true,window_present:true,window_empty:mode==='QUARANTINED',guarded_RPCs:148,restrictive_policies:82,backend_forced_RLS_tables:5,private_schema_API_denied:true};}
export function mock({fail=-1,lostOpen=false,lostClose=false,change,resultShape='last'}={}){
 const calls=[];let signed=0,mode='QUARANTINED',after=false;
 const transport=async(url,options)=>{
  const pos=calls.length;calls.push({url,options});if(pos===fail)throw Error('PRIVATE_PROVIDER_SENTINEL');
  const override=await change?.(url,options,pos);if(override)return override;
  if(url===management)return reply({ref:stagingRef,status:'ACTIVE_HEALTHY',database:{host:'db.'+stagingRef+'.supabase.co'}});
  if(url===management+'/database/query'){
   const q=JSON.parse(options.body).query;
   if(q.includes('AS bounded_shape_last'))return reply([...(resultShape==='all'?[{bounded_shape_first:'FIRST_PUBLIC_CONSTANT'}]:[]),{bounded_shape_last:'LAST_PUBLIC_CONSTANT',bounded_shape_pair:true}],201);
   if(q.includes('AS bounded_open')){mode='ACTIVE';if(lostOpen)throw Error('PRIVATE_LOST_OPEN');return reply([{bounded_open:{opened:true,allowed_actor_count:1,maximum_seconds:300}}],201);}
   if(q.includes('AS bounded_close')){mode='QUARANTINED';after=true;if(lostClose)throw Error('PRIVATE_LOST_CLOSE');return reply([{bounded_close:{quarantined:true,window_empty:true,stale_open_fenced:true}}],201);}
   if(q.includes('AS bounded_state'))return reply([{bounded_state:observation(mode,after),...(q.includes('AS bounded_lease')?{bounded_lease:{exact_live_lease:true,remaining_seconds:299}}:{})}],201);
   if(q.includes('AS actor_facts'))return reply([{actor_facts:{context,four_ordinary_live_sessions:true,fresh_session_proofs_absent:true}}],201);
   if(q.includes('AS device_state'))return reply([{device_state:{context,one_exact_fixed_deadline_device:true,email_proof_and_restored_proof_bound:true,fresh_and_other_account_proofs_absent:true}}],201);
   if(q.includes('AS device_cleanup'))return reply([{device_cleanup:{selected_generated_device_absent:true}}],201);
   if(q.includes('AS session_cleanup'))return reply([{session_cleanup:{context,selected_sessions_absent:true,selected_proofs_absent:true,selected_challenges_absent:true,selected_generated_device_absent:true}}],201);
  }
  if(url===origin+'/config.js')return new Response('window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify({supabaseUrl:api,supabasePublishableKey:input.publishableKey,vapidPublicKey:''})+';',{headers:{'content-type':'application/javascript'}});
  if(url.includes('/auth/v1/token?')){const i=signed++;return reply({access_token:tokens[i],user:users[i]});}
  const i=tokens.indexOf((options.headers.Authorization||'').slice(7));
  if(url===api+'/auth/v1/user')return reply(users[i]);
  if(url===api+'/auth/v1/logout?scope=local')return new Response(null,{status:204});
  const verified=mode==='ACTIVE'&&i<2;
  if(url===api+'/rest/v1/rpc/email_gate_current_session_verified')return reply(verified);
  if(url.includes('/rest/v1/profiles?'))return reply(verified&&url.endsWith(actors[i].user)?[{id:actors[i].user}]:[]);
  if(url.endsWith('/status'))return reply({verified},200,gh);
  if(url.endsWith('/begin'))return reply({result:'CODE_REQUESTED',challengeId:challenge,expiresAt:new Date(Date.now()+600000).toISOString()},200,gh);
  if(url.endsWith('/verify'))return reply({result:'VERIFIED'},200,{...gh,'set-cookie':cookieName(i)+'='+credential+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=604799; Expires='+new Date(Date.now()+604799000).toUTCString()});
  if(url.endsWith('/restore'))return i===3?reply({result:'CODE_REQUIRED'},200,{...gh,'set-cookie':clear(3)}):reply({result:options.headers.Cookie?'APPROVED':'CODE_REQUIRED'},200,gh);
  throw Error('UNEXPECTED_SYNTHETIC_REQUEST');
 };return {transport,calls,readCode:async()=> '123456'};
}
export function browserPort({failure=null}={}){
 const calls=[];let begun=false,proved=false,closed=false;
 const flags={email_request_attempts:0,verify_attempts:0,email_provider_acceptance_observed:false,email_dispatch_outcome_uncertain:false,email_code_verified:false,verification_outcome_uncertain:false,secure_fixed_deadline_remember_cookie_observed:false,foreign_account_renamed_cookie_restore_denied:false,cookie_free_same_account_browser_denied:false,same_account_new_session_restore_approved:false,repeated_restore_emits_no_cookie:false,private_web_storage_and_cache_empty:false,verified_browser_views_and_HTTP_passed:false,account_change_clears_view_and_ticket:false,same_account_session_change_clears_view_and_ticket:false,cleanup_verified:false,problem_code:null};
 const stop=name=>{calls.push(name);if(failure===name)throw Object.assign(Error('PRIVATE_BROWSER_SENTINEL'),{safeCode:'BROWSER_REQUIRED'});};
 const port={
  snapshot:()=>({...flags}),privateState:()=>({challenge:begun?challenge:null,credential:proved?credential:null,cookieExpirySeconds:Math.floor(Date.now()/1000)+604799}),
  async preflight(){stop('preflight');},async attachSessions(s){stop('attachSessions');if(s.length!==4)throw Error('PRIVATE_BROWSER_SENTINEL');},
  async prove(readCode){stop('beforeEmail');flags.email_request_attempts=1;flags.email_dispatch_outcome_uncertain=true;begun=true;stop('beginResponse');flags.email_provider_acceptance_observed=true;flags.email_dispatch_outcome_uncertain=false;stop('beforeCode');if(await readCode()!=='123456')throw Error('PRIVATE_BROWSER_SENTINEL');flags.verify_attempts=1;flags.verification_outcome_uncertain=true;stop('verifyResponse');flags.email_code_verified=true;flags.verification_outcome_uncertain=false;proved=true;flags.secure_fixed_deadline_remember_cookie_observed=true;stop('cookie');},
  async restoreAndBind(){stop('restoreAndBind');flags.foreign_account_renamed_cookie_restore_denied=true;flags.cookie_free_same_account_browser_denied=true;flags.same_account_new_session_restore_approved=true;flags.repeated_restore_emits_no_cookie=true;},
  async activeWindow(deadline){stop('activeWindow');if(deadline<=Date.now())throw Error('PRIVATE_BROWSER_SENTINEL');flags.verified_browser_views_and_HTTP_passed=true;flags.account_change_clears_view_and_ticket=true;flags.same_account_session_change_clears_view_and_ticket=true;},
  async afterQuarantine(){stop('afterQuarantine');flags.private_web_storage_and_cache_empty=true;},
  async close(){calls.push('close');if(closed)throw Error('PRIVATE_BROWSER_SENTINEL');closed=true;flags.cleanup_verified=failure!=='close';if(failure==='close')flags.problem_code='BROWSER_CLEANUP_REQUIRED';return {...flags};}
 };return {port,calls};
}
