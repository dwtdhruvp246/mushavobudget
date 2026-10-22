import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {controlledProbe,privateDialogue,recoverySQL,actorFactsSQL,cleanupSQL,acknowledgement,origin,stage} from '../scripts/check-fr-2-email-batch-i.mjs';
import {versionReference} from '../scripts/lib/email-registration-catalog-versions.mjs';
import {localDatabase,root} from '../scripts/lib/stage-3-local-db.mjs';
import {prepareReviewedEmailPlatform} from '../scripts/lib/email-reviewed-platform-fixture.mjs';
import {handoffSQL,stagingRef} from '../scripts/lib/email-registration-handoff-sql.mjs';
import {installationSQL} from '../scripts/install-fr-2-email-batch-h.mjs';
import {gatewayFromEnvironment} from '../supabase/functions/_shared/email-verification-gateway.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const actor={user:id(15001),session:id(15002),email:'controlled@example.invalid'},challenge=id(15003);
const api='https://'+stagingRef+'.supabase.co',management='https://api.supabase.com/v1/projects/'+stagingRef;
const base=JSON.parse(await readFile(root+'/docs/security-audit/security-fr-2-email-batch-f-private-catalog.json','utf8'));
const input={managementToken:'sbp_fc'+'SYNTHETIC_ONLY_'.repeat(3),email:actor.email,password:'SYNTHETIC_APP_PASSWORD',publishableKey:'sb_publishable_SYNTHETIC',allowedRecipients:[actor.email],acknowledgement};
const claims={sub:actor.user,session_id:actor.session,iss:api+'/auth/v1',role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600};
const jwt=[{alg:'HS256'},claims].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.SYNTHETIC_ONLY';
const user={id:actor.user,email:actor.email,email_confirmed_at:new Date().toISOString(),is_anonymous:false};
const project={ref:stagingRef,status:'ACTIVE_HEALTHY',database:{host:'db.'+stagingRef+'.supabase.co'}};
const context={privileged_origin:true,transaction_read_only:'on'};
const recovery={real_session_email_proof_present:true,resume_and_quarantine_functions_executed:true,authenticated_role_predicate_and_own_profile_visible_inside_uncommitted_active_state:true,quarantined_predicate_and_own_profile_denied:true,proof_retained_through_quarantine:true};
const gatewayHeaders={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; frame-ancestors 'none'"};
const reply=(x,status=200,headers={})=>Response.json(x,{status,headers});
function observation(major=17){return {context,server_version_num:major*10000+11,installer_catalog:versionReference(base,major*10000+11),control:{rows:1,quarantined:true},guarded_RPCs:148,restrictive_policies:82,public_guard_policies:81,storage_guard_policies:1,backend_tables:5,backend_tables_forced_RLS:5,backend_schema_API_denied:true};}
function mock({fail,change,major=17}={}){
 const calls=[];let used=false;
 const transport=async(url,options)=>{
  const i=calls.length;calls.push({url,options});if(i===fail)throw Error('PRIVATE_PROVIDER_TEXT');
  const replacement=await change?.(url,options,i);if(replacement)return replacement;
  if(url===management)return reply(project);
  if(url===management+'/database/query'){
   const q=JSON.parse(options.body).query;assert.equal(JSON.parse(options.body).read_only,false);
   if(q.includes('AS quarantined_readback'))return reply([{quarantined_readback:observation(major)}],201);
   if(q.includes('AS actor_facts'))return reply([{actor_facts:{context,ordinary_confirmed_active_actor:true,selected_session_proof_absent:true}}],201);
   if(q.includes('AS recovery_probe'))return reply([{recovery_probe:recovery}],201);
   if(q.includes('AS session_cleanup'))return reply([{session_cleanup:{context,selected_session_absent:true,selected_proofs_absent:true,selected_challenges_absent:true}}],201);
  }
  if(url===origin+'/config.js')return new Response('window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify({supabaseUrl:api,supabasePublishableKey:input.publishableKey,vapidPublicKey:''})+';',{headers:{'content-type':'application/javascript'}});
  if(url===api+'/auth/v1/token?grant_type=password')return reply({access_token:jwt,refresh_token:'SYNTHETIC_REFRESH_TOKEN',user});
  if(url===api+'/auth/v1/user')return reply(user);
  if(url===api+'/auth/v1/logout?scope=local')return new Response(null,{status:204});
  if(url===api+'/rest/v1/rpc/email_gate_current_session_verified')return reply(false);
  if(url.startsWith(api+'/rest/v1/profiles?select=id&id=eq.'))return reply([]);
  if(url.startsWith(origin+'/api/email-verification/')){
   const route=url.split('/').at(-1);if(route==='status')return options.headers.Authorization?reply({verified:false},200,gatewayHeaders):reply({result:'SIGN_IN_REQUIRED'},401,gatewayHeaders);
   if(route==='begin')return reply({result:'CODE_REQUESTED',challengeId:challenge,expiresAt:new Date(Date.now()+600000).toISOString()},200,gatewayHeaders);
   if(route==='verify'){if(used)return reply({result:'CODE_UNAVAILABLE'},400,gatewayHeaders);used=true;return reply({result:'VERIFIED'},200,{...gatewayHeaders,'set-cookie':'__Host-mushavo_device_'+actor.user.replaceAll('-','')+'=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0'});}
  }
  throw Error('UNEXPECTED_URL');
 };
 return {calls,transport,readCode:async()=> '123456'};
}
const noSecrets=r=>{for(const x of [input.password,input.managementToken,input.email,jwt,actor.user,actor.session,'123456','PRIVATE_PROVIDER_TEXT','SYNTHETIC_REFRESH_TOKEN'])assert(!JSON.stringify(r).includes(x));};
test('Fixed one-email probe checks genuine-facing APIs, rolled-back SQL and selected-session cleanup while keeping quarantine',async()=>{
 for(const major of [15,16,17,18]){const m=mock({major});const r=await controlledProbe(input,m);assert.equal(r.exit_code,0,JSON.stringify(r));assert.equal(r.actual_hosted_requests,21);assert.equal(r.email_request_attempts,1);assert.equal(r.rolled_back_recovery_rehearsal_passed,true);assert.equal(r.quarantined_catalog_after_verified,true);assert.equal(r.selected_Auth_session_and_proofs_and_challenges_absent,true);assert.equal(r.committed_resume_or_quarantine_requests,0);noSecrets(r);
  assert.equal(m.calls.filter(x=>x.url.endsWith('/begin')).length,1);assert.equal(m.calls.filter(x=>x.url.includes('/logout')).length,1);assert(m.calls.every(x=>[origin,api,management].some(prefix=>x.url.startsWith(prefix))));
  for(const c of m.calls){assert.equal(c.options.redirect,'error');assert(c.options.signal);}
 }
});
test('All 21 direct transport failure positions fail safely, never resend a code and never commit a mode change',async()=>{
 for(let fail=0;fail<21;fail++){const m=mock({fail});const r=await controlledProbe(input,m);assert.equal(r.exit_code,1,'failure '+fail);assert(r.email_request_attempts<=1);assert.equal(r.committed_resume_or_quarantine_requests,0);assert.equal(m.calls.filter(x=>x.url.endsWith('/begin')).length,r.email_request_attempts);noSecrets(r);
  for(const c of m.calls)if(c.url===management+'/database/query')assert(!/\bCOMMIT\s*;/i.test(JSON.parse(c.options.body).query));
  if(fail>=5){assert.equal(r.Auth_local_logout_attempted,true);assert.equal(m.calls.filter(x=>x.url.endsWith('/logout?scope=local')).length,1);}
 }
});
test('Wrong acknowledgement, arbitrary URL/query, malformed secret or an email outside the retained list never reaches provider',async()=>{
 for(const x of [{},{...input,acknowledgement:'ACTIVATE'},{...input,url:'https://foreign.invalid'},{...input,query:'select 1'},{...input,managementToken:'bad'},{...input,allowedRecipients:['other@example.invalid']},{...input,password:'x\nmalformed'}]){const m=mock();assert.equal((await controlledProbe(x,m)).exit_code,1);assert.equal(m.calls.length,0);}
});
test('Changed target, stamp, private function source, guard policy distribution or private API access stops before signin/email',async()=>{
 for(const kind of ['target','stamp','source','policies','access']){const m=mock({change:(url)=>{if(kind==='target'&&url===management)return reply({...project,ref:'kttkospkblwvguuwnhjj'});if(url!==management+'/database/query')return;const x=observation();if(kind==='stamp')x.control.quarantined=false;else if(kind==='source')x.installer_catalog.functions[0][14]='a'.repeat(64);else if(kind==='policies')x.storage_guard_policies=0;else if(kind==='access')x.backend_schema_API_denied=false;else return;return reply([{quarantined_readback:x}],201);}});const r=await controlledProbe(input,m);assert.equal(r.exit_code,1);assert.equal(r.Auth_password_signin_attempted,false);assert.equal(r.email_request_attempts,0);noSecrets(r);}
});
test('A live public key mismatch and unavailable gateway stop without a password signin or email',async()=>{
 for(const kind of ['key','gateway']){const m=mock({change:(url)=>kind==='key'&&url.endsWith('/config.js')?new Response('window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify({supabaseUrl:api,supabasePublishableKey:'sb_publishable_OTHER',vapidPublicKey:''})+';',{headers:{'content-type':'text/javascript'}}):kind==='gateway'&&url.endsWith('/status')?reply({result:'UNAVAILABLE'},503,gatewayHeaders):undefined});const r=await controlledProbe(input,m);assert.equal(r.exit_code,1);assert.equal(r.Auth_password_signin_attempted,false);assert.equal(r.email_request_attempts,0);}
});
test('Auth claims or independently returned actor mismatch prevents email and exposes no private response text',async()=>{
 for(const kind of ['claims','user','facts']){const m=mock({change:(url,options)=>{if(kind==='claims'&&url.includes('grant_type=password'))return reply({access_token:'not.JWT.valid',user});if(kind==='user'&&url===api+'/auth/v1/user')return reply({...user,id:id(99999)});if(kind==='facts'&&url===management+'/database/query'&&JSON.parse(options.body).query.includes('AS actor_facts'))return reply([{actor_facts:{context,ordinary_confirmed_active_actor:false,selected_session_proof_absent:true}}],201);}});const r=await controlledProbe(input,m);assert.equal(r.exit_code,1);assert.equal(r.email_request_attempts,0);noSecrets(r);}
});
test('Any premature gateway or RPC approval or own-profile visibility is refused before email',async()=>{
 for(const kind of ['gateway','rpc','profile']){const m=mock({change:(url,options)=>kind==='gateway'&&url.endsWith('/status')&&options.headers.Authorization?reply({verified:true},200,gatewayHeaders):kind==='rpc'&&url.endsWith('/rpc/email_gate_current_session_verified')?reply(true):kind==='profile'&&url.includes('/profiles?')?reply([{id:actor.user}]):undefined});const r=await controlledProbe(input,m);assert.equal(r.exit_code,1);assert.equal(r.email_request_attempts,0);assert.equal(r.Auth_local_logout_attempted,true);noSecrets(r);}
});
test('Mail failure, missing/invalid inbox code and rejected verification clean up without automatic resend',async()=>{
 const variants=[{change:url=>url.endsWith('/begin')?reply({result:'MAIL_UNAVAILABLE'},503,gatewayHeaders):undefined},{readCode:async()=>{throw Error('PRIVATE_CANCEL');}},{readCode:async()=> 'badcode'},{change:url=>url.endsWith('/verify')?reply({result:'CODE_REJECTED'},400,gatewayHeaders):undefined}];
 for(const variant of variants){const m=mock(variant);Object.assign(m,variant.readCode?{readCode:variant.readCode}:{});const r=await controlledProbe(input,m);assert.equal(r.exit_code,1);assert.equal(r.email_request_attempts,1);assert.equal(r.Auth_local_logout_attempted,true);assert.equal(r.selected_Auth_session_and_proofs_and_challenges_absent,true);assert.equal(r.quarantined_catalog_after_verified,true);noSecrets(r);}
});
test('Malformed, oversized or cookie-setting responses are bounded and never reflected in safe output',async()=>{
 for(const variant of [()=>new Response('PRIVATE_RESPONSE',{status:200,headers:{'content-type':'application/json'}}),()=>new Response('x'.repeat(131073),{status:200,headers:{'content-type':'application/json'}}),()=>reply({verified:false},200,{...gatewayHeaders,'set-cookie':'PRIVATE_COOKIE'})]){const m=mock({change:(url,options)=>url.endsWith('/status')&&options.headers.Authorization?variant():undefined});const r=await controlledProbe(input,m);assert.equal(r.exit_code,1);assert.equal(r.email_request_attempts,0);assert(!JSON.stringify(r).includes('PRIVATE_RESPONSE'));assert(!JSON.stringify(r).includes('PRIVATE_COOKIE'));}
});
test('An unknown cleanup or final catalog state refuses success even after successful code verification',async()=>{
 for(const kind of ['cleanup','catalog']){let observed=0;const m=mock({change:(url,options)=>{if(url!==management+'/database/query')return;const q=JSON.parse(options.body).query;if(kind==='cleanup'&&q.includes('AS session_cleanup'))return reply([{session_cleanup:{context,selected_session_absent:false,selected_proofs_absent:false,selected_challenges_absent:false}}],201);if(kind==='catalog'&&q.includes('AS quarantined_readback')&&observed++>0){const x=observation();x.control.quarantined=false;return reply([{quarantined_readback:x}],201);}}});const r=await controlledProbe(input,m);assert.equal(r.exit_code,1);assert.equal(r.email_inbox_delivery_and_code_verified,true);noSecrets(r);}
});
test('Recovery SQL uses validated exact actors, private source/stamp guard, role-scoped reads and mandatory rollback',async()=>{
 const q=await recoverySQL(actor,challenge);assert(q.startsWith('BEGIN;'));assert(q.endsWith('ROLLBACK;\n'));assert(!/\bCOMMIT\s*;/i.test(q));assert(q.includes('EMAIL_I_PINNED_INSTALLER_REQUIRED'));assert(q.includes('SET LOCAL ROLE authenticated;'));assert(q.includes("'QUARANTINE_STAGING_EMAIL'"));assert(!q.includes(input.password));assert(!q.includes(input.managementToken));
 for(const a of [{...actor,user:"';drop table x;--"},{...actor,session:''},{...actor,extra:true}]){assert.throws(()=>actorFactsSQL(a));assert.throws(()=>cleanupSQL(a));await assert.rejects(recoverySQL(a,challenge));}
});
test('Private dialogue preflight emits one fixed safe result and no code/email prompt',()=>{
 const p=spawnSync(process.execPath,[root+'/scripts/check-fr-2-email-batch-i.mjs','--private-dialogue'],{input:'{"preflight":true}\n',encoding:'utf8',timeout:10000});assert.equal(p.status,0);assert.equal(p.stderr,'');const msg=JSON.parse(p.stdout);assert.equal(msg.protocol,'BATCH_I_RESULT');assert.equal(msg.receipt.result,'PRIVATE_DIALOGUE_PREFLIGHT_PASS');assert.equal(msg.receipt.actual_hosted_requests,0);
});
test('Actual gateway HMAC/mail adapter, installed SQL, rolled-back role/RLS recovery and selected-session cascade cleanup integrate',async()=>{
 const {db}=await localDatabase(process.env.MUSHAVO_EMAIL_UI_PGLITE,{preparePlatform:prepareReviewedEmailPlatform});const errors=[];let mailCode,mailCalls=0,authCalls=0,unexpected=0;
 const value=async(q,args)=>(await db.query(q,args)).rows[0]?.value;
 const roles=async(role,c,fn)=>{await db.exec('begin');try{await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(c)]);await db.exec('set local role '+role);return await fn();}finally{await db.exec('rollback');}};
 try{
  await db.exec((await handoffSQL()).write);await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[actor.user,actor.email]);await db.exec((await installationSQL()).write);
  const before=await value('select changed_at::text value from mushavo_email_install.rollout_control');
  const keys={begin_challenge:['p_user','p_session','p_challenge','p_code_mac','p_key_version','p_remember'],set_delivery:['p_user','p_session','p_challenge','p_delivered'],challenge_context:['p_user','p_session','p_challenge'],verify_challenge:['p_user','p_session','p_challenge','p_code_mac','p_device_digest'],session_status:['p_user','p_session']};
  const upstream=async(url,options)=>{
   if(url===api+'/auth/v1/user'){authCalls++;assert.equal(options.headers.authorization,'Bearer '+jwt);return reply(user);}
   if(url.startsWith(api+'/rest/v1/rpc/email_gate_')){const name=url.split('email_gate_')[1],args=JSON.parse(options.body),k=keys[name];assert(k);assert.equal(options.headers.apikey,'sb_secret_SYNTHETIC');await db.exec('set role service_role');try{return reply(await value('select public.email_gate_'+name+'('+k.map((_,i)=>'$'+(i+1)).join(',')+') value',k.map(x=>args[x])));}finally{await db.exec('reset role');}}
   if(url==='https://accounts.zoho.com/oauth/v2/token')return reply({access_token:'SYNTHETIC_ZOHO_ACCESS',expires_in:3600});
   if(url==='https://mail.zoho.com/api/accounts/12345678/messages'){const mail=JSON.parse(options.body);assert.equal(mail.toAddress,actor.email);mailCode=mail.content.match(/is (\d{6})\./)[1];mailCalls++;return reply({status:{code:200}});}
   unexpected++;throw Error('UNEXPECTED_SYNTHETIC_UPSTREAM');
  };
  const gateway=gatewayFromEnvironment({EMAIL_GATE_MODE:'STAGING_CONTROLLED_ONLY',EMAIL_GATE_PROJECT:stagingRef,EMAIL_GATE_ORIGIN:origin,EMAIL_GATE_PEPPERS_JSON:JSON.stringify({v1:'2a'.repeat(32)}),EMAIL_GATE_KEY_VERSION:'v1',EMAIL_GATE_RATE_PEPPER:'3a'.repeat(32),EMAIL_GATE_RATE_LIMITER:{limit:async()=>({success:true})},SUPABASE_PUBLISHABLE_KEY:input.publishableKey,SUPABASE_SERVICE_ROLE_KEY:'sb_secret_SYNTHETIC',ZOHO_MAIL_ORIGIN:'https://mail.zoho.com',ZOHO_ACCOUNTS_ORIGIN:'https://accounts.zoho.com',ZOHO_ACCOUNT_ID:'12345678',ZOHO_FROM_ADDRESS:'notification@example.invalid',ZOHO_CLIENT_ID:'SYNTHETIC_CLIENT',ZOHO_CLIENT_SECRET:'SYNTHETIC_SECRET',ZOHO_REFRESH_TOKEN:'SYNTHETIC_REFRESH',ZOHO_TEST_RECIPIENTS_JSON:JSON.stringify([actor.email])},upstream);
  const fallback=mock();
  const transport=async(url,options)=>{
   if(url===management+'/database/query'){try{
    const query=JSON.parse(options.body).query;
    if(query.includes('AS recovery_probe')){
     const old=(await db.query("select pg_get_functiondef('mushavo_email_install.quarantine()'::regprocedure) value")).rows[0].value;
     await db.exec(old.replace('AS $function$','AS $function$\n'));
     await assert.rejects(db.exec(query),/EMAIL_I_PINNED_INSTALLER_REQUIRED/);await db.exec('rollback');await db.exec(old);
     const late=query.replace(' SET LOCAL ROLE authenticated;',' RAISE EXCEPTION \'SYNTHETIC_AFTER_RESUME\';\n SET LOCAL ROLE authenticated;');
     await assert.rejects(db.exec(late),/SYNTHETIC_AFTER_RESUME/);await db.exec('rollback');
     assert.equal(await value('select mode value from mushavo_email_install.rollout_control'),'QUARANTINED');
     assert.equal(await value('select changed_at::text value from mushavo_email_install.rollout_control'),before);
    }
    return reply((await db.exec(query)).flatMap(x=>x.rows),201);
   }catch(e){errors.push(e.message);await db.exec('rollback');throw Error('PRIVATE_SYNTHETIC_SQL_ERROR');}}
   if(url===api+'/auth/v1/token?grant_type=password'){assert.deepEqual(JSON.parse(options.body),{email:actor.email,password:input.password});await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[actor.session,actor.user]);return reply({access_token:jwt,user,refresh_token:'SYNTHETIC_REFRESH'});}
   if(url.startsWith(origin+'/api/email-verification/'))return gateway(new Request(url,{...options,headers:{...options.headers,'cf-connecting-ip':'192.0.2.151'}}));
   if(url===api+'/rest/v1/rpc/email_gate_current_session_verified')return reply(await roles('authenticated',claims,()=>value('select public.email_gate_current_session_verified() value')));
   if(url.startsWith(api+'/rest/v1/profiles?'))return reply(await roles('authenticated',claims,async()=>(await db.query('select id from public.profiles where id=$1',[actor.user])).rows));
   if(url===api+'/auth/v1/logout?scope=local'){await db.query('delete from auth.sessions where id=$1',[actor.session]);return new Response(null,{status:204});}
   return fallback.transport(url,options);
  };
  const r=await controlledProbe(input,{transport,readCode:async()=>{assert.equal(mailCalls,1);assert(/^\d{6}$/.test(mailCode));return mailCode;}});
  assert.equal(r.exit_code,0,JSON.stringify({receipt:r,errors}));assert.equal(r.rolled_back_recovery_rehearsal_passed,true);assert.equal(mailCalls,1);assert(authCalls>=5);assert.equal(unexpected,0);
  assert.equal(await value('select mode value from mushavo_email_install.rollout_control'),'QUARANTINED');assert.equal(await value('select changed_at::text value from mushavo_email_install.rollout_control'),before);
  assert.equal(await value('select count(*)::int value from auth.sessions'),0);assert.equal(await value('select count(*)::int value from mushavo_email_auth.session_proofs'),0);assert.equal(await value('select count(*)::int value from mushavo_email_auth.devices'),0);assert.equal(await value('select count(*)::int value from mushavo_email_auth.send_events'),1);assert.equal(await value('select count(*)::int value from auth.users'),1);noSecrets(r);
 }finally{await db.close();}
});

test('Private code dialogue emits one fixed prompt, accepts only the code field and cleans up on EOF/malformed replies',async()=>{
 for(const kind of ['correct','extra','EOF']){const frames=[],m=mock();let reads=0;
  const r=await privateDialogue(input,{emit:x=>frames.push(x),readNext:async()=>{reads++;if(kind==='EOF')throw Error('PRIVATE_EOF');return kind==='extra'?{code:'123456',extra:'PRIVATE_VALUE'}:{code:'123456'};},probe:(x,{readCode})=>controlledProbe(x,{transport:m.transport,readCode})});
  assert.deepEqual(frames,[{protocol:'BATCH_I_CODE_REQUIRED'}]);assert.equal(reads,1);assert.equal(r.exit_code,kind==='correct'?0:1);assert.equal(r.selected_Auth_session_and_proofs_and_challenges_absent,true);noSecrets(r);assert(!JSON.stringify(r).includes('PRIVATE_VALUE'));
 }
});
