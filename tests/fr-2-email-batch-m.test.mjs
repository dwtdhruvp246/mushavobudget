import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {controlledProbe,privateDialogue,actorFactsSQL,cleanupSQL,acknowledgement,origin,stage} from '../scripts/check-fr-2-email-batch-m.mjs';
import {versionReference} from '../scripts/lib/email-registration-catalog-versions.mjs';
import {localDatabase,root} from '../scripts/lib/stage-3-local-db.mjs';
import {prepareReviewedEmailPlatform} from '../scripts/lib/email-reviewed-platform-fixture.mjs';
import {handoffSQL,stagingRef} from '../scripts/lib/email-registration-handoff-sql.mjs';
import {installationSQL} from '../scripts/install-fr-2-email-batch-h.mjs';
import {gatewayFromEnvironment} from '../supabase/functions/_shared/email-verification-gateway.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const api='https://'+stagingRef+'.supabase.co',management='https://api.supabase.com/v1/projects/'+stagingRef;
const actors=[1,2,3,4].map((n)=>({user:id(n===4?22002:22001),session:id(23000+n),email:n===4?'second@example.invalid':'first@example.invalid'}));
const users=actors.map(a=>({id:a.user,email:a.email,email_confirmed_at:new Date().toISOString(),is_anonymous:false}));
const tokens=actors.map(a=>[{alg:'HS256'},{sub:a.user,session_id:a.session,iss:api+'/auth/v1',role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.SYNTHETIC');
const input={managementToken:'sbp_fc'+'SYNTHETIC_ONLY_'.repeat(3),accounts:[{email:actors[0].email,password:'SYNTHETIC_FIRST_PASSWORD'},{email:actors[3].email,password:'SYNTHETIC_SECOND_PASSWORD'}],publishableKey:'sb_publishable_SYNTHETIC',allowedRecipients:[actors[0].email,actors[3].email],acknowledgement};
import {stateSQL,openSQL,quarantineSQL,leaseSQL,deviceCleanupSQL,windowSeconds} from '../scripts/lib/email-bounded-http-sql.mjs';
import {windowHandoffSQL} from '../scripts/lib/email-window-handoff-sql.mjs';
const context={privileged_origin:true,transaction_read_only:'on'},challenge=id(24001),credential='K'.repeat(43);
const cookieName=i=>'__Host-mushavo_device_'+actors[i].user.replaceAll('-','');
const clear=i=>cookieName(i)+'=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0';
const gh={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; frame-ancestors 'none'"};
const reply=(data,status=200,headers={})=>Response.json(data,{status,headers});

const fence='2026-10-23 09:33:05.020000+00',later='2026-10-23 10:33:05.020000+00';
function observation(mode='QUARANTINED',after=false){return {context,server_version_num:180003,catalog_kind:'BOUNDED',control_rows:1,quarantined_stamp_matched:mode==='QUARANTINED',predicate_source_matched:true,mode,private_fence:after?later:fence,stamp_matched:true,window_present:true,window_empty:mode==='QUARANTINED',guarded_RPCs:148,restrictive_policies:82,backend_forced_RLS_tables:5,private_schema_API_denied:true};}
function mock({fail=-1,lostOpen=false,lostClose=false,change}={}){
 const calls=[];let signed=0,mode='QUARANTINED',after=false;
 const transport=async(url,options)=>{
  const pos=calls.length;calls.push({url,options});if(pos===fail)throw Error('PRIVATE_PROVIDER_SENTINEL');
  const override=await change?.(url,options,pos);if(override)return override;
  if(url===management)return reply({ref:stagingRef,status:'ACTIVE_HEALTHY',database:{host:'db.'+stagingRef+'.supabase.co'}});
  if(url===management+'/database/query'){
   const q=JSON.parse(options.body).query;
   if(q.includes('AS bounded_open')){mode='ACTIVE';if(lostOpen)throw Error('PRIVATE_LOST_OPEN');return reply([{bounded_open:{opened:true,allowed_actor_count:1,maximum_seconds:300}}],201);}
   if(q.includes('AS bounded_close')){mode='QUARANTINED';after=true;if(lostClose)throw Error('PRIVATE_LOST_CLOSE');return reply([{bounded_close:{quarantined:true,window_empty:true,stale_open_fenced:true}}],201);}
   if(q.includes('AS bounded_state'))return reply([{bounded_state:observation(mode,after)},...(q.includes('AS bounded_lease')?[{bounded_lease:{exact_live_lease:true,remaining_seconds:299}}]:[])],201);
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
function noPrivate(r){const text=JSON.stringify(r);for(const value of [input.managementToken,...input.accounts.map(a=>a.password),...actors.flatMap(a=>[a.user,a.session,a.email]),...tokens,credential,'123456','PRIVATE_PROVIDER_SENTINEL',fence,later,'PRIVATE_LOST_OPEN','PRIVATE_LOST_CLOSE'])assert(!text.includes(value),value);}
test('One real-proof-shaped flow uses the first account only, HTTP verified and unproved sessions, explicit quarantine and exact cleanup',async()=>{
 const m=mock(),r=await controlledProbe(input,m);assert.equal(r.exit_code,0,JSON.stringify(r));assert.equal(r.actual_hosted_requests,52);assert.equal(r.email_request_attempts,1);assert.equal(r.bounded_open_write_attempts,1);assert.equal(r.quarantine_write_attempts,1);assert.equal(r.committed_mode_change_requests,2);assert.equal(r.explicit_quarantine_and_stale_open_fence_verified,true);assert.equal(r.selected_sessions_proofs_and_challenges_absent,true);noPrivate(r);
});
test('All 52 direct failure positions preserve bounded calls, one email/open/close/delete and finally quarantine on attempted open',async()=>{
 for(let fail=0;fail<52;fail++){const m=mock({fail}),r=await controlledProbe(input,m);assert.equal(r.exit_code,1,'position '+fail);assert(r.actual_hosted_requests<=56);assert(r.email_request_attempts<=1);assert(r.bounded_open_write_attempts<=1);assert(r.quarantine_write_attempts<=1);assert(r.exact_generated_device_cleanup_write_attempts<=1);if(r.bounded_open_write_attempts)assert.equal(r.quarantine_write_attempts,1);noPrivate(r);}
});
test('A lost open response stops main acceptance, inspects, quarantines and verifies the stale-open fence without reopening',async()=>{
 const m=mock({lostOpen:true}),r=await controlledProbe(input,m);assert.equal(r.exit_code,1);assert.equal(r.bounded_open_write_attempts,1);assert.equal(r.explicit_quarantine_and_stale_open_fence_verified,true);assert.equal(r.open_write_outcome_uncertain,false);assert.equal(r.selected_sessions_proofs_and_challenges_absent,true);noPrivate(r);
});
test('A lost quarantine COMMIT response is independently resolved, without repeating it',async()=>{
 const m=mock({lostClose:true}),r=await controlledProbe(input,m);assert.equal(r.exit_code,0,JSON.stringify(r));assert.equal(r.quarantine_response_problem_code,'NETWORK_REQUIRED');assert.equal(r.quarantine_write_outcome_uncertain,false);assert.equal(r.quarantine_write_attempts,1);noPrivate(r);
});
test('Wrong acknowledgement, arbitrary host input, duplicated accounts and malformed identity inputs fail closed',async()=>{
 for(const x of [{},{...input,acknowledgement:'ACTIVATE'},{...input,url:'https://foreign.invalid'},{...input,accounts:[input.accounts[0],input.accounts[0]]}]){const m=mock();assert.equal((await controlledProbe(x,m)).exit_code,1);assert.equal(m.calls.length,0);}
 await assert.rejects(openSQL("';select 1;--",fence));await assert.rejects(quarantineSQL(actors[0].user,'bad'));await assert.rejects(deviceCleanupSQL({...actors[0],extra:true},challenge));
});
test('Source/target/ordinary account drift stops before email; stale lease and unexpected HTTP access fail and quarantine',async()=>{
 for(const kind of ['target','source','ordinary','lease','password','foreign','close']){
  let states=0;
  const m=mock({change:(url,options)=>{
   if(kind==='target'&&url===management)return reply({ref:'kttkospkblwvguuwnhjj'});
   if(url===management+'/database/query'){const q=JSON.parse(options.body).query;
    if(kind==='source'&&q.includes('AS bounded_state'))return reply([{bounded_state:{...observation(),predicate_source_matched:false}}],201);
    if(kind==='ordinary'&&q.includes('AS actor_facts'))return reply([{actor_facts:{context,four_ordinary_live_sessions:false,fresh_session_proofs_absent:false}}],201);
    if(kind==='lease'&&q.includes('AS bounded_lease'))return reply([{bounded_state:observation('ACTIVE')},{bounded_lease:{exact_live_lease:false,remaining_seconds:299}}],201);
    if(kind==='close'&&q.includes('AS bounded_state')&&states++>=3)return reply([{bounded_state:observation('ACTIVE')}],201);
   }
   const i=tokens.indexOf((options.headers.Authorization||'').slice(7));
   if(kind==='password'&&i===2&&url.endsWith('/status'))return reply({verified:true},200,gh);
   if(kind==='foreign'&&i===0&&url.includes('/profiles?')&&url.endsWith(actors[3].user))return reply([{id:actors[3].user}]);
  }});
  const r=await controlledProbe(input,m);assert.equal(r.exit_code,1,kind);if(['target','source','ordinary'].includes(kind))assert.equal(r.email_request_attempts,0);if(r.bounded_open_write_attempts)assert.equal(r.quarantine_write_attempts,1);noPrivate(r);
 }
});
test('Private dialogue reuses hidden one-code protocol and exact preflight without opening access',async()=>{
 const r=spawnSync(process.execPath,[root+'/scripts/check-fr-2-email-batch-m.mjs','--private-dialogue'],{input:'{"preflight":true}\n',encoding:'utf8',timeout:10000});assert.equal(r.status,0);assert.equal(r.stderr,'');assert.equal(JSON.parse(r.stdout).receipt.stage_step,stage);
 const m=mock(),frames=[];const result=await privateDialogue(input,{emit:x=>frames.push(x),readNext:async()=>({code:'123456'}),probe:(i,{readCode})=>controlledProbe(i,{transport:m.transport,readCode})});assert.equal(result.exit_code,0);assert.deepEqual(frames,[{protocol:'BATCH_M_CODE_REQUIRED'}]);noPrivate(result);
});
async function actualIntegration(loss=null){
 const {db}=await localDatabase(process.env.MUSHAVO_EMAIL_UI_PGLITE,{preparePlatform:prepareReviewedEmailPlatform});let signed=0,mailCode,mailCalls=0,unexpected=0;const errors=[];
 const value=async(q,args)=>(await db.query(q,args)).rows[0]?.value;
 const roles=async(role,c,fn)=>{await db.exec('begin');try{await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(c)]);await db.exec('set local role '+role);return await fn();}finally{await db.exec('rollback');}};
 try{
  await db.exec((await handoffSQL()).write);for(const i of [0,3])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[actors[i].user,actors[i].email]);await db.exec((await installationSQL()).write);await db.exec((await windowHandoffSQL()).write);
  await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[id(25001),actors[0].user]);
  await db.query('insert into mushavo_email_auth.account_state(user_id) values($1)',[actors[0].user]);
  await db.query("insert into mushavo_email_auth.devices(id,user_id,credential_digest,security_version,origin_challenge_id,verified_at,expires_at) values($1,$2,$3,1,$4,statement_timestamp(),statement_timestamp()+interval '168 hours')",[id(25002),actors[0].user,'4b'.repeat(32),id(25003)]);
  await db.query("insert into mushavo_email_auth.session_proofs(session_id,user_id,security_version,source,verified_at,established_at,device_id) select $1,user_id,1,'device',verified_at,statement_timestamp(),id from mushavo_email_auth.devices where id=$2",[id(25001),id(25002)]);
  const before=await value('select changed_at::text value from mushavo_email_install.rollout_control');
  const keys={begin_challenge:['p_user','p_session','p_challenge','p_code_mac','p_key_version','p_remember'],set_delivery:['p_user','p_session','p_challenge','p_delivered'],challenge_context:['p_user','p_session','p_challenge'],verify_challenge:['p_user','p_session','p_challenge','p_code_mac','p_device_digest'],session_status:['p_user','p_session'],restore_device:['p_user','p_session','p_device_digest']};
  const upstream=async(url,options)=>{
   if(url===api+'/auth/v1/user')return reply(users[tokens.indexOf(options.headers.authorization.slice(7))]);
   if(url.startsWith(api+'/rest/v1/rpc/email_gate_')){const name=url.split('email_gate_')[1],args=JSON.parse(options.body),k=keys[name];assert(k);assert.equal(options.headers.apikey,'sb_secret_SYNTHETIC');await db.exec('set role service_role');try{return reply(await value('select public.email_gate_'+name+'('+k.map((_,i)=>'$'+(i+1)).join(',')+') value',k.map(x=>args[x])));}finally{await db.exec('reset role');}}
   if(url==='https://accounts.zoho.com/oauth/v2/token')return reply({access_token:'SYNTHETIC_ZOHO_ACCESS',expires_in:3600});
   if(url==='https://mail.zoho.com/api/accounts/12345678/messages'){const m=JSON.parse(options.body);assert.equal(m.toAddress,actors[0].email);mailCode=m.content.match(/is (\d{6})\./)[1];mailCalls++;return reply({status:{code:200}});}
   unexpected++;throw Error('UNEXPECTED_UPSTREAM');
  };
  const gateway=gatewayFromEnvironment({EMAIL_GATE_MODE:'STAGING_CONTROLLED_ONLY',EMAIL_GATE_PROJECT:stagingRef,EMAIL_GATE_ORIGIN:origin,EMAIL_GATE_PEPPERS_JSON:JSON.stringify({v1:'2a'.repeat(32)}),EMAIL_GATE_KEY_VERSION:'v1',EMAIL_GATE_RATE_PEPPER:'3a'.repeat(32),EMAIL_GATE_RATE_LIMITER:{limit:async()=>({success:true})},SUPABASE_PUBLISHABLE_KEY:input.publishableKey,SUPABASE_SERVICE_ROLE_KEY:'sb_secret_SYNTHETIC',ZOHO_MAIL_ORIGIN:'https://mail.zoho.com',ZOHO_ACCOUNTS_ORIGIN:'https://accounts.zoho.com',ZOHO_ACCOUNT_ID:'12345678',ZOHO_FROM_ADDRESS:'notification@example.invalid',ZOHO_CLIENT_ID:'SYNTHETIC_CLIENT',ZOHO_CLIENT_SECRET:'SYNTHETIC_SECRET',ZOHO_REFRESH_TOKEN:'SYNTHETIC_REFRESH',ZOHO_TEST_RECIPIENTS_JSON:input.allowedRecipients?JSON.stringify(input.allowedRecipients):'[]'},upstream);
  const fallback=mock();
  const transport=async(url,options)=>{
   if(url===management+'/database/query'){const q=JSON.parse(options.body).query;try{
    const output=(await db.exec(q)).flatMap(x=>x.rows);
    if((loss==='open'&&q.includes('AS bounded_open'))||(loss==='close'&&q.includes('AS bounded_close'))||(loss==='device'&&q.includes('AS device_cleanup')))throw Error('PRIVATE_LOST_COMMIT_RESPONSE');
    return reply(output,201);
   }catch(e){errors.push(e.message);await db.exec('rollback');throw Error('PRIVATE_SYNTHETIC_SQL_ERROR');}}
   if(url.includes('/auth/v1/token?')){const i=signed++;assert.deepEqual(JSON.parse(options.body),input.accounts[i===3?1:0]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[actors[i].session,actors[i].user]);return reply({access_token:tokens[i],user:users[i]});}
   const i=tokens.indexOf((options.headers.Authorization||'').slice(7));
   if(url===api+'/auth/v1/user')return reply(users[i]);
   if(url.startsWith(origin+'/api/email-verification/'))return gateway(new Request(url,{...options,headers:{...options.headers,'cf-connecting-ip':'192.0.2.171'}}));
   if(url===api+'/rest/v1/rpc/email_gate_current_session_verified')return reply(await roles('authenticated',JSON.parse(Buffer.from(tokens[i].split('.')[1],'base64url')),()=>value('select public.email_gate_current_session_verified() value')));
   if(url.includes('/rest/v1/profiles?'))return reply(await roles('authenticated',JSON.parse(Buffer.from(tokens[i].split('.')[1],'base64url')),async()=>(await db.query('select id from public.profiles where id=$1',[url.split('id=eq.')[1]])).rows));
   if(url===api+'/auth/v1/logout?scope=local'){await db.query('delete from auth.sessions where id=$1',[actors[i].session]);return new Response(null,{status:204});}
   return fallback.transport(url,options);
  };
  const r=await controlledProbe(input,{transport,readCode:async()=>mailCode});assert.equal(r.exit_code,['open','device'].includes(loss)?1:0,JSON.stringify({r,errors}));assert.equal(r.device_cleanup_write_outcome_uncertain,false);assert.equal(r.Auth_session_cleanup_outcome_uncertain,false);assert.equal(r.exact_generated_device_cleanup_write_attempts,1);assert.equal(mailCalls,1);assert.equal(unexpected,0);assert.equal(r.explicit_quarantine_and_stale_open_fence_verified,true);assert.equal(r.quarantine_write_outcome_uncertain,false);noPrivate(r);
  for(const table of ['auth.sessions','mushavo_email_auth.session_proofs','mushavo_email_auth.devices'])assert.equal(await value('select count(*)::integer value from '+table),1,table);
  assert.equal(await value('select count(*)::integer value from mushavo_email_auth.challenges'),0);
  assert.equal(await value('select count(*)::integer value from auth.sessions where id=$1',[id(25001)]),1);assert.equal(await value('select count(*)::integer value from mushavo_email_auth.devices where id=$1',[id(25002)]),1);
  assert.equal(await value('select count(*)::integer value from mushavo_email_auth.send_events'),1);assert.equal(await value('select count(*)::integer value from auth.users'),2);
  assert.equal(await value('select mode value from mushavo_email_install.rollout_control'),'QUARANTINED');assert.notEqual(await value('select changed_at::text value from mushavo_email_install.rollout_control'),before);assert.equal(await value('select count(*)::int value from mushavo_email_install.acceptance_window'),0);
 }finally{await db.close();}
}

test('Actual installed SQL and gateway routes: bounded HTTP, precise foreign read, quarantine, session/device cleanup and preserved prior state',()=>actualIntegration());
test('Lost actual open COMMIT is contained; actual quarantine COMMIT loss is resolved; no repeated writes',async()=>{for(const loss of ['open','close','device'])await actualIntegration(loss);});
test('Actual stale-open fencing, changed-source refusal and containment after catalog drift',async t=>{
 const {db}=await localDatabase(process.env.MUSHAVO_EMAIL_UI_PGLITE,{preparePlatform:prepareReviewedEmailPlatform});
 const value=async(q,args)=>(await db.query(q,args)).rows[0]?.value;
 const execute=async q=>{try{return (await db.exec(q)).flatMap(x=>x.rows);}catch(e){await db.exec('ROLLBACK');throw e;}};
 try{
  await execute((await handoffSQL()).write);await execute((await installationSQL()).write);await execute((await windowHandoffSQL()).write);
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[actors[0].user,actors[0].email]);
  const take=async()=>(await execute(await stateSQL()))[0].bounded_state.private_fence;
  await t.test('Containment before delayed OPEN makes the original committed request stale',async()=>{
   const initial=await take();await execute(await quarantineSQL(actors[0].user,initial));
   await assert.rejects(execute(await openSQL(actors[0].user,initial)),/EMAIL_M_STALE_OPEN_REFUSED/);
   assert.equal(await value('select mode value from mushavo_email_install.rollout_control'),'QUARANTINED');
  });
  await t.test('Containment after committed OPEN also fences a duplicate/delayed original',async()=>{
   const initial=await take(),q=await openSQL(actors[0].user,initial);await execute(q);await execute(await quarantineSQL(actors[0].user,initial));await assert.rejects(execute(q),/EMAIL_M_STALE_OPEN_REFUSED/);
   assert.equal(await value('select count(*)::int value from mushavo_email_install.acceptance_window'),0);
  });
  await t.test('Containment refuses a changed installer function before invoking it',async()=>{
   const initial=await take(),source=await value("select pg_get_functiondef('mushavo_email_install.quarantine()'::regprocedure) value");
   await db.exec(source.replace('AS $function$','AS $function$\n'));
   await assert.rejects(execute(await quarantineSQL(actors[0].user,initial)),/EMAIL_L_CATALOG_SOURCE_REVIEW_REQUIRED/);await db.exec(source);
  });
  await t.test('Exact cleanup refuses an unrelated window; expiry does not impersonate quarantine',async()=>{
   const initial=await take();await execute(await openSQL(actors[0].user,initial));
   await db.query("update mushavo_email_install.acceptance_window set opened_at=opened_at-interval '10 minutes',expires_at=expires_at-interval '10 minutes'");
   await assert.rejects(execute(await quarantineSQL(actors[0].user,initial)),/EMAIL_M_SELECTED_WINDOW_STATE_REQUIRED/);
   assert.equal(await value('select mode value from mushavo_email_install.rollout_control'),'ACTIVE');
   await db.exec("update mushavo_email_install.acceptance_window set opened_at=(select changed_at from mushavo_email_install.rollout_control),expires_at=(select changed_at from mushavo_email_install.rollout_control)+interval '300 seconds'");
   await execute(await quarantineSQL(actors[0].user,initial));
  });
  await t.test('Late OPEN transaction failure rolls back its ACTIVE state and window atomically',async()=>{
   const initial=await take(),q=(await openSQL(actors[0].user,initial)).replace('SELECT jsonb_build_object(\'opened\'',()=>"DO $$BEGIN RAISE EXCEPTION 'SYNTHETIC_LATE_OPEN'; END$$;\nSELECT jsonb_build_object('opened'");
   await assert.rejects(execute(q),/SYNTHETIC_LATE_OPEN/);assert.equal(await value('select mode value from mushavo_email_install.rollout_control'),'QUARANTINED');assert.equal(await value('select count(*)::int value from mushavo_email_install.acceptance_window'),0);
  });
  await t.test('Public catalog drift blocks a new opening but does not block reviewed containment',async()=>{
   const initial=await take();await execute(await openSQL(actors[0].user,initial));await db.exec('alter table public.profiles add column synthetic_m_drift boolean');
   await execute(await quarantineSQL(actors[0].user,initial));
   const next=await take();await assert.rejects(execute(await openSQL(actors[0].user,next)),/EMAIL_WINDOW_QUARANTINED_CATALOG_REQUIRED/);
   await db.exec('alter table public.profiles drop column synthetic_m_drift');
  });
 }finally{await db.close();}
});
test('Windows parent packet/SecureString/dialogue helpers preserve the owner-proven implementation and accept all safe receipt fields',async()=>{
 const j=await readFile(root+'/scripts/run-fr-2-email-batch-j.ps1','utf8'),m=await readFile(root+'/scripts/run-fr-2-email-batch-m.ps1','utf8');
 const helper=s=>s.slice(s.indexOf('function Assert-Unlinked'),s.indexOf('\nif ($InspectPacketOnly'));
 assert.equal(helper(m),helper(j).replaceAll('FR.2.4.E5.23_BATCH_J_REMEMBERED_DEVICE_ACCOUNT_BINDING_AND_ROLLED_BACK_LIFECYCLE',stage).replaceAll('BATCH J','BATCH M').replaceAll('BATCH_J','BATCH_M').replace('$Answer.actual_hosted_requests -gt 35','$Answer.actual_hosted_requests -gt 56').replace('$Clock.ElapsedMilliseconds -ge 1500000','$Clock.ElapsedMilliseconds -ge 3600000'));
 const r=await controlledProbe(input,mock());const allowed=m.match(/\$Allowed = @\(([^\n]+)\)/)[1].match(/'([^']+)'/g).map(x=>x.slice(1,-1));assert.deepEqual(Object.keys(r).sort(),allowed.sort());assert(m.includes('[switch]$ExerciseBoundedHttpWindow'));assert(m.includes('committed_mode_change_may_require_inspection'));
});
