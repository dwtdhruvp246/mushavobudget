import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {controlledProbe,privateDialogue,lifecycleSQL,deviceCleanupSQL,actorFactsSQL,cleanupSQL,acknowledgement,origin,stage} from '../scripts/check-fr-2-email-batch-j.mjs';
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
const base=JSON.parse(await readFile(root+'/docs/security-audit/security-fr-2-email-batch-f-private-catalog.json','utf8'));
const context={privileged_origin:true,transaction_read_only:'on'},challenge=id(24001),credential='K'.repeat(43);
const cookieName=i=>'__Host-mushavo_device_'+actors[i].user.replaceAll('-','');
const clear=i=>cookieName(i)+'=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0';
const gh={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; frame-ancestors 'none'"};
const reply=(data,status=200,headers={})=>Response.json(data,{status,headers});
const lifecycle={role_and_cross_account_scope:true,expired_device_denied_new_restore:true,existing_verified_sessions_retained_after_device_expiry:true,deadline_not_extended_by_restore:true,revocation_denies_all_device_bound_sessions:true,revoked_device_restore_denied:true,quarantine_restored_inside_transaction:true};
function observation(major=17){return {context,server_version_num:major*10000+11,installer_catalog:versionReference(base,major*10000+11),control:{rows:1,quarantined:true},guarded_RPCs:148,restrictive_policies:82,public_guard_policies:81,storage_guard_policies:1,backend_tables:5,backend_tables_forced_RLS:5,backend_schema_API_denied:true};}
function mock({fail,change,major=17}={}){
 const calls=[];let signed=0;
 const transport=async(url,options)=>{
  const pos=calls.length;calls.push({url,options});if(pos===fail)throw Error('PRIVATE_PROVIDER_SENTINEL');const override=await change?.(url,options,pos);if(override)return override;
  if(url===management)return reply({ref:stagingRef,status:'ACTIVE_HEALTHY',database:{host:'db.'+stagingRef+'.supabase.co'}});
  if(url===management+'/database/query'){
   const q=JSON.parse(options.body).query;
   if(q.includes('AS quarantined_readback'))return reply([{quarantined_readback:observation(major)}],201);
   if(q.includes('AS actor_facts'))return reply([{actor_facts:{context,four_ordinary_live_sessions:true,fresh_session_proofs_absent:true}}],201);
   if(q.includes('AS device_state'))return reply([{device_state:{context,one_exact_fixed_deadline_device:true,email_proof_and_restored_proof_bound:true,fresh_and_other_account_proofs_absent:true}}],201);
   if(q.includes('AS lifecycle_probe'))return reply([{lifecycle_probe:lifecycle}],201);
   if(q.includes('AS device_cleanup'))return reply([{device_cleanup:{selected_generated_device_absent:true}}],201);
   if(q.includes('AS session_cleanup'))return reply([{session_cleanup:{context,selected_sessions_absent:true,selected_proofs_absent:true,selected_challenges_absent:true,selected_generated_device_absent:true}}],201);
  }
  if(url===origin+'/config.js')return new Response('window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify({supabaseUrl:api,supabasePublishableKey:input.publishableKey,vapidPublicKey:''})+';',{headers:{'content-type':'application/javascript'}});
  if(url.includes('/auth/v1/token?')){const i=signed++;return reply({access_token:tokens[i],user:users[i]});}
  const i=tokens.indexOf((options.headers.Authorization||'').slice(7));
  if(url===api+'/auth/v1/user')return reply(users[i]);
  if(url===api+'/auth/v1/logout?scope=local')return new Response(null,{status:204});
  if(url===api+'/rest/v1/rpc/email_gate_current_session_verified')return reply(false);
  if(url.includes('/rest/v1/profiles?'))return reply([]);
  if(url.endsWith('/status'))return reply({verified:false},200,gh);
  if(url.endsWith('/begin'))return reply({result:'CODE_REQUESTED',challengeId:challenge,expiresAt:new Date(Date.now()+600000).toISOString()},200,gh);
  if(url.endsWith('/verify'))return reply({result:'VERIFIED'},200,{...gh,'set-cookie':cookieName(i)+'='+credential+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=604799; Expires='+new Date(Date.now()+604799000).toUTCString()});
  if(url.endsWith('/restore'))return i===3?reply({result:'CODE_REQUIRED'},200,{...gh,'set-cookie':clear(3)}):reply({result:options.headers.Cookie?'APPROVED':'CODE_REQUIRED'},200,gh);
  throw Error('UNEXPECTED_SYNTHETIC_REQUEST');
 };
 return {transport,calls,readCode:async()=> '123456'};
}
function noPrivate(r){const text=JSON.stringify(r);for(const value of [input.managementToken,...input.accounts.map(a=>a.password),...actors.flatMap(a=>[a.user,a.session,a.email]),...tokens,credential,'123456','PRIVATE_PROVIDER_SENTINEL'])assert(!text.includes(value),value);}
test('Two accounts/four sessions restore one remembered credential, bind actors, rehearse lifecycle and clean exact generated state',async()=>{
 for(const major of [15,16,17,18]){const m=mock({major});const r=await controlledProbe(input,m);assert.equal(r.exit_code,0,JSON.stringify(r));assert.equal(r.actual_hosted_requests,35);assert.equal(r.email_request_attempts,1);assert.equal(r.Auth_local_logout_attempts,4);assert.equal(r.exact_generated_device_cleanup_write_attempts,1);assert.equal(r.committed_mode_change_requests,0);assert.equal(r.selected_generated_device_absent,true);assert.equal(r.browser_cookie_cache_or_device_restore_verified,false);noPrivate(r);}
});
test('All35 direct failure positions stop safely with no resend, no repeated delete and no committed activation',async()=>{
 for(let fail=0;fail<35;fail++){const m=mock({fail});const r=await controlledProbe(input,m);assert.equal(r.exit_code,1,'position '+fail);assert(r.actual_hosted_requests<=35);assert(r.email_request_attempts<=1);assert(r.exact_generated_device_cleanup_write_attempts<=1);assert(r.Auth_local_logout_attempts<=4);assert.equal(r.committed_mode_change_requests,0);noPrivate(r);
  for(const c of m.calls)if(c.url===management+'/database/query'){const q=JSON.parse(c.options.body).query;if(/COMMIT\s*;/i.test(q))assert(q.includes('DELETE FROM mushavo_email_auth.devices')&&!q.includes('resume()'));}
 }
});
test('Unprepared, duplicated-account, malformed password, arbitrary URL or acknowledgement input sends no request',async()=>{
 for(const x of [{},{...input,acknowledgement:'ACTIVATE'},{...input,url:'https://foreign.invalid'},{...input,accounts:[input.accounts[0],input.accounts[0]]},{...input,allowedRecipients:[actors[0].email]},{...input,accounts:[{...input.accounts[0],password:'x\n'},input.accounts[1]]}]){const m=mock();assert.equal((await controlledProbe(x,m)).exit_code,1);assert.equal(m.calls.length,0);}
});
test('Changed target/catalog, public key, ordinary-account facts or unexpected proof stops before mail',async()=>{
 for(const kind of ['target','catalog','key','ordinary']){const m=mock({change:(url,options)=>{
  if(kind==='target'&&url===management)return reply({ref:'kttkospkblwvguuwnhjj'});
  if(kind==='key'&&url.endsWith('/config.js'))return new Response('window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify({supabaseUrl:api,supabasePublishableKey:'sb_publishable_OTHER',vapidPublicKey:''})+';',{headers:{'content-type':'text/javascript'}});
  if(url===management+'/database/query'){const q=JSON.parse(options.body).query;if(kind==='catalog'&&q.includes('AS quarantined_readback')){const o=observation();o.control.quarantined=false;return reply([{quarantined_readback:o}],201);}if(kind==='ordinary'&&q.includes('AS actor_facts'))return reply([{actor_facts:{context,four_ordinary_live_sessions:false,fresh_session_proofs_absent:false}}],201);}
 }});const r=await controlledProbe(input,m);assert.equal(r.exit_code,1);assert.equal(r.email_request_attempts,0);noPrivate(r);}
});
test('Foreign-account approval, missing-cookie approval or a sliding restore cookie refuses acceptance',async()=>{
 for(const kind of ['foreign','missing','sliding']){const m=mock({change:(url,options)=>{if(!url.endsWith('/restore'))return;const i=tokens.indexOf(options.headers.Authorization.slice(7));if(kind==='foreign'&&i===3)return reply({result:'APPROVED'},200,{...gh,'set-cookie':clear(3)});if(kind==='missing'&&i===1&&!options.headers.Cookie)return reply({result:'APPROVED'},200,gh);if(kind==='sliding'&&i===1&&options.headers.Cookie)return reply({result:'APPROVED'},200,{...gh,'set-cookie':'PRIVATE_SLIDING_COOKIE'});}});const r=await controlledProbe(input,m);assert.equal(r.exit_code,1);assert(r.Auth_local_logout_attempts===4);assert(!JSON.stringify(r).includes('PRIVATE_SLIDING_COOKIE'));noPrivate(r);}
});
test('Malformed remember cookie, missing/wrong code or delivery failure never resends and attempts exact cleanup',async()=>{
 for(const kind of ['cookie','code','delivery']){const m=mock({change:url=>kind==='cookie'&&url.endsWith('/verify')?reply({result:'VERIFIED'},200,{...gh,'set-cookie':'PRIVATE_BAD_COOKIE'}):kind==='delivery'&&url.endsWith('/begin')?reply({result:'MAIL_UNAVAILABLE'},503,gh):undefined});if(kind==='code')m.readCode=async()=> 'bad';const r=await controlledProbe(input,m);assert.equal(r.exit_code,1);assert.equal(r.email_request_attempts,1);assert.equal(r.Auth_local_logout_attempts,4);noPrivate(r);}
});
test('Unknown device cleanup/session state or final quarantine refuses success even if main probes pass',async()=>{
 for(const kind of ['device','session','final']){let seen=0;const m=mock({change:(url,options)=>{if(url!==management+'/database/query')return;const q=JSON.parse(options.body).query;if(kind==='device'&&q.includes('AS device_cleanup'))return reply([{device_cleanup:{selected_generated_device_absent:false}}],201);if(kind==='session'&&q.includes('AS session_cleanup'))return reply([{session_cleanup:{context,selected_sessions_absent:false,selected_proofs_absent:false,selected_challenges_absent:false,selected_generated_device_absent:false}}],201);if(kind==='final'&&q.includes('AS quarantined_readback')&&seen++>0){const o=observation();o.control.quarantined=false;return reply([{quarantined_readback:o}],201);}}});const r=await controlledProbe(input,m);assert.equal(r.exit_code,1);noPrivate(r);}
});
test('SQL builders reject actor/digest injection, pin sources, limit committed cleanup and always rollback lifecycle',async()=>{
 const q=await lifecycleSQL(actors,challenge,'a'.repeat(64));assert(q.startsWith('BEGIN;'));assert(q.endsWith('ROLLBACK;\n'));assert(!/\bCOMMIT\s*;/i.test(q));assert(q.includes('EMAIL_J_PINNED_INSTALLER_REQUIRED'));assert(q.includes('SET LOCAL ROLE authenticated;'));
 const clean=await deviceCleanupSQL(actors[0],challenge);assert(clean.endsWith('COMMIT;\n'));assert(clean.includes('origin_challenge_id='));assert(!clean.includes('DELETE FROM auth.'));assert(!clean.includes('resume()'));
 for(const bad of [{...actors[0],user:"';drop table x;--"},{...actors[0],extra:true}]){await assert.rejects(lifecycleSQL([bad,...actors.slice(1)],challenge,'a'.repeat(64)));assert.throws(()=>actorFactsSQL([bad,...actors.slice(1)]));assert.throws(()=>cleanupSQL([bad]));await assert.rejects(deviceCleanupSQL(bad,challenge));}
});
test('Private dialogue fixed preflight, hidden-code EOF/extra-field handling and redaction',async()=>{
 const p=spawnSync(process.execPath,[root+'/scripts/check-fr-2-email-batch-j.mjs','--private-dialogue'],{input:'{"preflight":true}\n',encoding:'utf8',timeout:10000});assert.equal(p.status,0);assert.equal(p.stderr,'');assert.equal(JSON.parse(p.stdout).receipt.stage_step,stage);
 for(const kind of ['good','extra','EOF']){const frames=[],m=mock();const r=await privateDialogue(input,{emit:x=>frames.push(x),readNext:async()=>{if(kind==='EOF')throw Error('PRIVATE_EOF');return kind==='extra'?{code:'123456',extra:true}:{code:'123456'};},probe:(x,{readCode})=>controlledProbe(x,{transport:m.transport,readCode})});assert.deepEqual(frames,[{protocol:'BATCH_J_CODE_REQUIRED'}]);assert.equal(r.exit_code,kind==='good'?0:1);noPrivate(r);}
});
async function actualIntegration(lostCleanupResponse=false){
 const {db}=await localDatabase(process.env.MUSHAVO_EMAIL_UI_PGLITE,{preparePlatform:prepareReviewedEmailPlatform});let signed=0,mailCode,mailCalls=0,unexpected=0;const errors=[];
 const value=async(q,args)=>(await db.query(q,args)).rows[0]?.value;
 const roles=async(role,c,fn)=>{await db.exec('begin');try{await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(c)]);await db.exec('set local role '+role);return await fn();}finally{await db.exec('rollback');}};
 try{
  await db.exec((await handoffSQL()).write);for(const i of [0,3])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[actors[i].user,actors[i].email]);await db.exec((await installationSQL()).write);
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
    if(q.includes('AS lifecycle_probe')){
     const old=await value("select pg_get_functiondef('mushavo_email_install.quarantine()'::regprocedure) value");await db.exec(old.replace('AS $function$','AS $function$\n'));
     await assert.rejects(db.exec(q),/EMAIL_J_PINNED_INSTALLER_REQUIRED/);await db.exec('rollback');await db.exec(old);
     const late=q.replace(' -- Move only'," RAISE EXCEPTION 'SYNTHETIC_AFTER_RESUME';\n -- Move only");await assert.rejects(db.exec(late),/SYNTHETIC_AFTER_RESUME/);await db.exec('rollback');
     assert.equal(await value('select mode value from mushavo_email_install.rollout_control'),'QUARANTINED');
     assert.equal(await value('select changed_at::text value from mushavo_email_install.rollout_control'),before);
    }
    const output=(await db.exec(q)).flatMap(x=>x.rows);
    if(lostCleanupResponse&&q.includes('AS device_cleanup'))throw Error('PRIVATE_LOST_COMMIT_RESPONSE');
    return reply(output,201);
   }catch(e){errors.push(e.message);await db.exec('rollback');throw Error('PRIVATE_SYNTHETIC_SQL_ERROR');}}
   if(url.includes('/auth/v1/token?')){const i=signed++;assert.deepEqual(JSON.parse(options.body),input.accounts[i===3?1:0]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[actors[i].session,actors[i].user]);return reply({access_token:tokens[i],user:users[i]});}
   const i=tokens.indexOf((options.headers.Authorization||'').slice(7));
   if(url===api+'/auth/v1/user')return reply(users[i]);
   if(url.startsWith(origin+'/api/email-verification/'))return gateway(new Request(url,{...options,headers:{...options.headers,'cf-connecting-ip':'192.0.2.171'}}));
   if(url===api+'/rest/v1/rpc/email_gate_current_session_verified')return reply(await roles('authenticated',JSON.parse(Buffer.from(tokens[i].split('.')[1],'base64url')),()=>value('select public.email_gate_current_session_verified() value')));
   if(url.includes('/rest/v1/profiles?'))return reply(await roles('authenticated',JSON.parse(Buffer.from(tokens[i].split('.')[1],'base64url')),async()=>(await db.query('select id from public.profiles where id=$1',[actors[i].user])).rows));
   if(url===api+'/auth/v1/logout?scope=local'){await db.query('delete from auth.sessions where id=$1',[actors[i].session]);return new Response(null,{status:204});}
   return fallback.transport(url,options);
  };
  const r=await controlledProbe(input,{transport,readCode:async()=>mailCode});assert.equal(r.exit_code,lostCleanupResponse?1:0,JSON.stringify({r,errors}));assert.equal(r.device_cleanup_write_outcome_uncertain,false);assert.equal(r.Auth_session_cleanup_outcome_uncertain,false);assert.equal(r.exact_generated_device_cleanup_write_attempts,1);assert.equal(mailCalls,1);assert.equal(unexpected,0);assert.equal(r.rolled_back_expiry_revocation_and_role_scope_rehearsal_passed,true);noPrivate(r);
  for(const table of ['auth.sessions','mushavo_email_auth.session_proofs','mushavo_email_auth.devices'])assert.equal(await value('select count(*)::integer value from '+table),1,table);
  assert.equal(await value('select count(*)::integer value from mushavo_email_auth.challenges'),0);
  assert.equal(await value('select count(*)::integer value from auth.sessions where id=$1',[id(25001)]),1);assert.equal(await value('select count(*)::integer value from mushavo_email_auth.devices where id=$1',[id(25002)]),1);
  assert.equal(await value('select count(*)::integer value from mushavo_email_auth.send_events'),1);assert.equal(await value('select count(*)::integer value from auth.users'),2);
  assert.equal(await value('select mode value from mushavo_email_install.rollout_control'),'QUARANTINED');assert.equal(await value('select changed_at::text value from mushavo_email_install.rollout_control'),before);
 }finally{await db.close();}
}
test('Actual gateway HMAC/mail/device routes plus installed SQL expiry/revocation/role rollback and precise cleanup integrate',()=>actualIntegration());
test('Lost response after actual committed device deletion is independently resolved without repeating the write',()=>actualIntegration(true));
