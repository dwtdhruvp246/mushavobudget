// Actual full-page code/SDK/gateway/SQL; Auth, REST transport, Realtime and mail are modeled.
// Every server binds loopback. No real account, provider or hosted project is contacted.
import https from 'node:https';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {localTLS} from './browser-local-tls.mjs';
import {localDatabase} from './stage-3-local-db.mjs';
import {prepareReviewedEmailPlatform} from './email-reviewed-platform-fixture.mjs';
import {handoffSQL,stagingRef} from './email-registration-handoff-sql.mjs';
import {installationSQL} from '../install-fr-2-email-batch-h.mjs';
import {windowHandoffSQL} from './email-window-handoff-sql.mjs';
import {openSQL,quarantineSQL} from './email-bounded-http-sql.mjs';
import {gatewayFromEnvironment,STAGING_ORIGIN} from '../../supabase/functions/_shared/email-verification-gateway.mjs';
import {acceptFixtureSocket} from './full-app-realtime-fixture.mjs';
import {modeledREST} from './full-app-rest-fixture.mjs';
const root=new URL('../../',import.meta.url),api='https://'+stagingRef+'.supabase.co',id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const reply=(data,status=200)=>Response.json(data,{status});
export const fullAppCanaries=['SYNTHETIC_PRIVATE_ACCOUNT_A','SYNTHETIC_PRIVATE_ACCOUNT_B'];
export async function fullAppLocalFixture(modulePath,{failure=null,holdInitialRestore=false}={}){
 if(![null,'begin','verify','rpc','source','open','close','profile-sync','refresh'].includes(failure))throw Error('LOCAL_FAILURE_REQUIRED');
 const {db}=await localDatabase(modulePath,{preparePlatform:prepareReviewedEmailPlatform});let queue=Promise.resolve(),server,origin,localAPI,closed=false,fence;const sockets=new Set(),held=[];let holdFinances=false,releaseInitialRestore=null,initialRestoreUsed=false;
 const serial=fn=>{const task=queue.then(fn);queue=task.catch(()=>{});return task;};
 const value=async(q,p)=>(await db.query(q,p)).rows[0]?.value;
 const actors=[{id:id(62001),email:'first@example.invalid',password:'SYNTHETIC_FIRST_PASSWORD',full_name:'Synthetic First'},{id:id(62002),email:'second@example.invalid',password:'SYNTHETIC_SECOND_PASSWORD',full_name:'Synthetic Second'}];
 const sessions=[],generatedChallenges=new Set(),publishableKey='sb_publishable_SYNTHETIC',state={mail:0,code:null,requests:0,unreviewed:0,rpcCalls:0,RESTCalls:0,authCalls:0,analyticsWrites:0,profileWriteAttempts:0,globalLogouts:0,localLogouts:0,refreshes:0,socketConnections:0,socketMessages:0,heldResponses:0,initialRestoreHeld:false,initialRestoreWasHeld:false,injectedFaults:[],SQL_errors:[],calls:[],offline:false};
 const publicNames=['app.html','app.js','app-entry.html','app-entry.js','auth.html','auth-flows.js','auth-security.js','admin-mfa.js','admin-plans.js','business.html','business.js','business.css','styles.css','workspace-preference.js','session-entry.js','email-verification.js','pwa.js','pwa-install.js','push-notifications.js','pwa-shell.css','pwa-update.css','pwa-install.css','offline.html','sw.js','manifest.webmanifest','assets/pwa-icon-192.png','assets/pwa-icon-512.png','assets/pwa-icon-maskable-512.png','assets/apple-touch-icon.png','assets/mushavo-budget-logo.png','assets/pwa-icon-maskable-192.png'];
 const publicSources=new Map();for(const name of publicNames){try{let bytes=await readFile(new URL(name,root));if(/\.(?:html|js|css|webmanifest)$/.test(name))bytes=Buffer.from(bytes.toString().replaceAll('kttkospkblwvguuwnhjj',stagingRef));publicSources.set('/'+name,bytes);}catch{if(name!=='assets/pwa-icon-maskable-192.png')throw Error('PUBLIC_SOURCE_REQUIRED');}}
 const servedSources=new Map(publicSources);
 if(failure==='source')servedSources.set('/app.js',Buffer.from(publicSources.get('/app.js').toString()+'\n// SYNTHETIC_SOURCE_DRIFT\n'));
 const asRole=(session,fn)=>serial(async()=>{await db.exec('begin');try{await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(session.claims)]);await db.exec('set local role authenticated');const result=await fn();await db.exec('commit');return result;}catch(e){state.SQL_errors.push({code:e.code||null,message:e.message});await db.exec('rollback');throw e;}});
 const user=a=>({id:a.id,email:a.email,aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-01-01T00:00:00.000Z',is_anonymous:false,app_metadata:{provider:'email',providers:['email']},user_metadata:{full_name:a.full_name},identities:[],created_at:'2026-01-01T00:00:00.000Z'});
 const mint=(actor,sessionId,revision=0)=>{
  const claims={sub:actor.id,session_id:sessionId,iss:api+'/auth/v1',role:'authenticated',aud:'authenticated',aal:'aal1',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,revision};
  const token=[{alg:'HS256',typ:'JWT'},claims].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.U1lOVEhFVElD';
  return {actor,sessionId,claims,token,refreshToken:'SYNTHETIC_REFRESH_'+sessionId+'_'+revision,tokens:new Set([token]),active:true,revision};
 };
 const find=header=>sessions.find(s=>s.tokens.has((header||'').replace('Bearer ','')));
 try{
  await db.exec((await handoffSQL()).write);
  for(let i=0;i<actors.length;i++){
   const a=actors[i];await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',[a.id,a.email,JSON.stringify({full_name:failure==='profile-sync'&&i===0?'Synthetic Changed':a.full_name})]);
   await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:a.id,role:'authenticated'})]);
   await db.query("insert into public.payment_items(id,owner_id,created_by,workspace_id,visibility,name,amount,currency,recurrence_type,due_day,start_date) select $1,$2,$2,id,'personal',$3,12,'USD','monthly',extract(day from current_date)::int,current_date-interval '1 month' from public.budget_workspaces where owner_id=$2 and workspace_type='personal'",[id(63001+i),a.id,fullAppCanaries[i]]);
   await db.exec("reset request.jwt.claims");
  }
  await db.exec((await installationSQL()).write);await db.exec((await windowHandoffSQL()).write);
  await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[id(65001),actors[0].id]);await db.query('insert into mushavo_email_auth.account_state(user_id) values($1)',[actors[0].id]);
  await db.query("insert into mushavo_email_auth.devices(id,user_id,credential_digest,security_version,origin_challenge_id,verified_at,expires_at) values($1,$2,$3,1,$4,statement_timestamp(),statement_timestamp()+interval '168 hours')",[id(65002),actors[0].id,'4b'.repeat(32),id(65003)]);
  await db.query("insert into mushavo_email_auth.session_proofs(session_id,user_id,security_version,source,verified_at,established_at,device_id) select $1,user_id,1,'device',verified_at,statement_timestamp(),id from mushavo_email_auth.devices where id=$2",[id(65001),id(65002)]);
  fence=await value("select (changed_at at time zone 'UTC')::text||'+00' value from mushavo_email_install.rollout_control");
  const keys={begin_challenge:['p_user','p_session','p_challenge','p_code_mac','p_key_version','p_remember'],set_delivery:['p_user','p_session','p_challenge','p_delivered'],challenge_context:['p_user','p_session','p_challenge'],verify_challenge:['p_user','p_session','p_challenge','p_code_mac','p_device_digest'],session_status:['p_user','p_session'],restore_device:['p_user','p_session','p_device_digest'],revoke_device:['p_user','p_session','p_device_digest'],revoke_all:['p_user','p_session']};
  const upstream=async(url,options)=>{
   const s=find(options.headers.authorization);if(url===api+'/auth/v1/user')return s?.active?reply(user(s.actor)):reply({},401);
   if(url.startsWith(api+'/rest/v1/rpc/email_gate_')){const name=url.split('email_gate_')[1],params=JSON.parse(options.body),k=keys[name];if(!k||options.headers.apikey!=='sb_secret_SYNTHETIC')throw Error('SYNTHETIC_UPSTREAM_REQUIRED');return serial(async()=>{await db.exec('set role service_role');try{return reply(await value('select public.email_gate_'+name+'('+k.map((_,i)=>'$'+(i+1)).join(',')+') value',k.map(x=>params[x])));}finally{await db.exec('reset role');}});}
   if(url==='https://accounts.zoho.com/oauth/v2/token')return reply({access_token:'SYNTHETIC_ZOHO_ACCESS',expires_in:3600});
   if(url==='https://mail.zoho.com/api/accounts/12345678/messages'){const m=JSON.parse(options.body);if(m.toAddress!==actors[0].email)throw Error('SYNTHETIC_MAIL_REQUIRED');state.code=m.content.match(/is (\d{6})\./)[1];state.mail++;return reply({status:{code:200}});}
   state.unreviewed++;throw Error('UNREVIEWED_UPSTREAM');
  };
  const gateway=gatewayFromEnvironment({EMAIL_GATE_MODE:'STAGING_CONTROLLED_ONLY',EMAIL_GATE_PROJECT:stagingRef,EMAIL_GATE_ORIGIN:STAGING_ORIGIN,EMAIL_GATE_PEPPERS_JSON:JSON.stringify({v1:'2a'.repeat(32)}),EMAIL_GATE_KEY_VERSION:'v1',EMAIL_GATE_RATE_PEPPER:'3a'.repeat(32),EMAIL_GATE_RATE_LIMITER:{limit:async()=>({success:true})},SUPABASE_PUBLISHABLE_KEY:publishableKey,SUPABASE_SERVICE_ROLE_KEY:'sb_secret_SYNTHETIC',ZOHO_MAIL_ORIGIN:'https://mail.zoho.com',ZOHO_ACCOUNTS_ORIGIN:'https://accounts.zoho.com',ZOHO_ACCOUNT_ID:'12345678',ZOHO_FROM_ADDRESS:'notification@example.invalid',ZOHO_CLIENT_ID:'SYNTHETIC_CLIENT',ZOHO_CLIENT_SECRET:'SYNTHETIC_SECRET',ZOHO_REFRESH_TOKEN:'SYNTHETIC_REFRESH',ZOHO_TEST_RECIPIENTS_JSON:JSON.stringify(actors.map(a=>a.email))},upstream);
  const json=(res,data,status=200,headers={})=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',...headers});res.end(JSON.stringify(data));};
  const authResponse=s=>({access_token:s.token,token_type:'bearer',expires_in:3600,expires_at:s.claims.exp,refresh_token:s.refreshToken,user:user(s.actor)});
  server=https.createServer(localTLS(),async(req,res)=>{try{
   state.requests++;const url=new URL(req.url,'https://'+req.headers.host),ui=url.origin===origin,backend=url.origin===localAPI;if(!ui&&!backend){state.unreviewed++;json(res,{},403);return;}
   state.calls.push({path:url.pathname,method:req.method,query:url.search,authorization:req.headers.authorization||null,preflightHeaders:req.headers['access-control-request-headers']||null});
   if(state.offline){req.socket.destroy();return;}
   const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-supabase-api-version,accept-profile,content-profile,prefer,range,range-unit','Access-Control-Allow-Methods':'GET,POST,OPTIONS,PATCH,DELETE','Access-Control-Max-Age':'600','Access-Control-Expose-Headers':'content-range'};
   if(backend&&req.method==='OPTIONS'){res.writeHead(204,cors);res.end();return;}
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>32768)throw Error('BODY_REQUIRED');}
   if(backend&&url.pathname.startsWith('/auth/v1/')){
    state.authCalls++;
    if(url.pathname==='/auth/v1/token'&&req.method==='POST'){
     const body=JSON.parse(raw);
     if(url.search==='?grant_type=password'){
      const a=actors.find(x=>x.email===body.email&&x.password===body.password);if(!a){json(res,{error:'invalid_grant',message:'Invalid login credentials'},400,cors);return;}
      const s=mint(a,id(64001+sessions.length));sessions.push(s);await serial(()=>db.query('insert into auth.sessions(id,user_id) values($1,$2)',[s.sessionId,a.id]));json(res,authResponse(s),200,cors);return;
     }
     if(url.search==='?grant_type=refresh_token'){
      if(failure==='refresh'){state.injectedFaults.push('refresh');json(res,{error:'invalid_grant',error_code:'refresh_token_not_found',message:'Invalid refresh token'},400,cors);return;}
      const old=sessions.find(x=>x.refreshToken===body.refresh_token&&x.active);if(!old){json(res,{error:'invalid_grant',message:'Invalid refresh token'},400,cors);return;}
      const next=mint(old.actor,old.sessionId,old.revision+1);for(const token of old.tokens)next.tokens.add(token);Object.assign(old,next);state.refreshes++;json(res,authResponse(old),200,cors);return;
     }
    }
    const s=find(req.headers.authorization);
    if(url.pathname==='/auth/v1/user'&&req.method==='GET'){json(res,s?.active?user(s.actor):{message:'Invalid session'},s?.active?200:401,cors);return;}
    if(url.pathname==='/auth/v1/logout'&&req.method==='POST'&&s){const scope=url.searchParams.get('scope')||'global';if(scope==='local'){s.active=false;state.localLogouts++;await serial(()=>db.query('delete from auth.sessions where id=$1',[s.sessionId]));}else if(scope==='global'){state.globalLogouts++;for(const x of sessions)if(x.actor.id===s.actor.id)x.active=false;await serial(()=>db.query('delete from auth.sessions where user_id=$1',[s.actor.id]));}else throw Error('LOGOUT_SCOPE_REQUIRED');res.writeHead(204,cors);res.end();return;}
    state.unreviewed++;json(res,{},404,cors);return;
   }
   if(ui&&url.pathname.startsWith('/api/email-verification/')&&req.method==='POST'){
    if(req.headers.origin!==origin){json(res,{},403);return;}
    const headers={...req.headers,origin:STAGING_ORIGIN,'sec-fetch-site':'same-origin','cf-connecting-ip':'192.0.2.182'};delete headers.host;
    if(url.pathname.endsWith('/verify')){const selected=JSON.parse(raw).challengeId;if(/^[a-f0-9-]{36}$/i.test(selected))generatedChallenges.add(selected);}
    const response=await gateway(new Request(STAGING_ORIGIN+url.pathname,{method:'POST',headers,body:raw}));
    if(holdInitialRestore&&!initialRestoreUsed&&url.pathname.endsWith('/restore')){initialRestoreUsed=true;state.initialRestoreHeld=true;state.initialRestoreWasHeld=true;await new Promise(resolve=>{releaseInitialRestore=()=>{state.initialRestoreHeld=false;releaseInitialRestore=null;resolve();};});}
    if(failure==='begin'&&url.pathname.endsWith('/begin')||failure==='verify'&&url.pathname.endsWith('/verify')){state.injectedFaults.push(failure);json(res,{result:'UNAVAILABLE'},502);return;}
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
   }
   if(backend&&url.pathname.startsWith('/rest/v1/')&&req.headers.apikey===publishableKey){
    const s=find(req.headers.authorization);if(!s?.active){json(res,{message:'Session required'},401,cors);return;}
    if(failure==='rpc'&&url.pathname.endsWith('/email_gate_current_session_verified')){state.injectedFaults.push('rpc');json(res,false,200,cors);return;}
    if(req.method==='PATCH'||req.method==='POST'&&!url.pathname.includes('/rpc/'))state.profileWriteAttempts++;
    if(url.pathname.includes('/rpc/'))state.rpcCalls++;else state.RESTCalls++;
    if(url.pathname.endsWith('/record_my_analytics_activity'))state.analyticsWrites++;
    try{const result=await asRole(s,()=>modeledREST(db,url,{method:req.method,body:raw?JSON.parse(raw):null,headers:req.headers}));if(url.pathname==='/rest/v1/payment_items'){state.privateRowsReturned??=0;state.privateRowsReturned+=Array.isArray(result.data)?result.data.length:0;}if(holdFinances&&s.actor.id===actors[0].id&&url.pathname==='/rest/v1/payment_items'){state.heldResponses++;await new Promise(resolve=>held.push(resolve));}json(res,result.data,result.status,cors);}catch(e){state.failedREST??=[];state.failedREST.push({path:url.pathname,SQLstate:e.code||null,marker:/^[A-Z_]{5,80}$/.test(e.message)?e.message:'SQL_ERROR'});json(res,{code:e.code||'LOCAL_FIXTURE',details:null,message:e.message?.includes('EMAIL_VERIFICATION_REQUIRED')?'EMAIL_VERIFICATION_REQUIRED':'Synthetic SQL request failed'},400,cors);}return;
   }
   if(ui&&req.method==='GET'){
    if(url.pathname==='/config.js'){res.writeHead(200,{'content-type':'application/javascript','cache-control':'no-store'});res.end('window.MUSHAVO_BUDGET_CONFIG='+JSON.stringify({supabaseUrl:localAPI,supabasePublishableKey:publishableKey,vapidPublicKey:''})+';');return;}
    if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
    const path=url.pathname==='/app'?'/app.html':url.pathname==='/app-entry'?'/app-entry.html':url.pathname==='/offline'?'/offline.html':url.pathname;
    const source=servedSources.get(path);if(source){if(failure==='source'&&path==='/app.js')state.injectedFaults.push('source');res.writeHead(200,{'content-type':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.png')?'image/png':path.endsWith('.webmanifest')?'application/manifest+json':'text/html','cache-control':'no-store',...(path==='/sw.js'?{'service-worker-allowed':'/'}:{})});res.end(source);return;}
   }
   state.unreviewed++;json(res,{},404);
  }catch{json(res,{result:'SYNTHETIC_FIXTURE_REQUIRED'},500);}});
  server.on('upgrade',(req,socket)=>{
   const url=new URL(req.url,'https://'+req.headers.host);if(url.origin!==localAPI||url.pathname!=='/realtime/v1/websocket'||url.searchParams.get('apikey')!==publishableKey||[...url.searchParams.keys()].some(x=>!['apikey','vsn'].includes(x))){state.unreviewed++;socket.destroy();return;}
   sockets.add(socket);state.socketConnections++;let socketActor=null;
   acceptFixtureSocket(req,socket,{origin,onClose:()=>sockets.delete(socket),onMessage:async(frame,send)=>{
    state.socketMessages++;if(!Array.isArray(frame)||frame.length!==5)throw Error('SOCKET_FRAME_REQUIRED');const [join,ref,topic,event,payload]=frame;
    if(event==='heartbeat'&&topic==='phoenix'){send([join,ref,topic,'phx_reply',{status:'ok',response:{}}]);return;}
    if(event==='phx_join'){const s=find('Bearer '+payload.access_token);if(!s?.active||!topic.startsWith('realtime:mushavo-budget:'+s.actor.id+':')||!await asRole(s,()=>value('select public.email_gate_current_session_verified() value')))throw Error('SOCKET_ACTOR_REQUIRED');socketActor=s;const changes=(payload.config?.postgres_changes||[]).map((x,i)=>({...x,id:i+1}));send([join,ref,topic,'phx_reply',{status:'ok',response:{postgres_changes:changes}}]);return;}
    if(event==='phx_leave'){send([join,ref,topic,'phx_reply',{status:'ok',response:{}}]);return;}
    if(event==='access_token'&&socketActor&&find('Bearer '+payload.access_token)?.actor.id===socketActor.actor.id)return;throw Error('SOCKET_EVENT_REQUIRED');
   }});
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});origin='https://localhost:'+server.address().port;localAPI='https://127.0.0.1:'+server.address().port;
  return {releaseInitialRestore(){releaseInitialRestore?.();},currentRevision(header){const s=find(header);return s?.active&&s.actor.id===actors[0].id&&header==='Bearer '+s.token?s.revision:null;},holdFinances(){holdFinances=true;},releaseFinances(){holdFinances=false;for(const resolve of held.splice(0))resolve();},origin,api:localAPI,actors,sessions,publishableKey,state,publicSources,
   async setWindow(open){const sql=open?await openSQL(actors[0].id,fence):await quarantineSQL(actors[0].id,fence);const result=await serial(()=>db.exec(sql));if(failure===(open?'open':'close')){state.injectedFaults.push(failure);throw Error('SYNTHETIC_LOST_COMMIT_RESPONSE');}return result;},
   async inspect(){return serial(async()=>({mode:await value('select mode value from mushavo_email_install.rollout_control'),windows:await value('select count(*)::int value from mushavo_email_install.acceptance_window'),priorSession:await value('select count(*)::int value from auth.sessions where id=$1',[id(65001)]),priorDevice:await value('select count(*)::int value from mushavo_email_auth.devices where id=$1',[id(65002)]),priorProof:await value('select count(*)::int value from mushavo_email_auth.session_proofs where session_id=$1',[id(65001)]),selectedSessions:await value('select count(*)::int value from auth.sessions where id<>$1',[id(65001)]),selectedDevices:await value('select count(*)::int value from mushavo_email_auth.devices where id<>$1',[id(65002)]),challenges:await value('select count(*)::int value from mushavo_email_auth.challenges'),paymentCanaries:await value('select count(*)::int value from public.payment_items where id in ($1,$2)',[id(63001),id(63002)])}));},
   async cleanup(){await serial(async()=>{await db.query('delete from mushavo_email_auth.devices where origin_challenge_id=any($1::uuid[]) and user_id=any($2::uuid[])',[[...generatedChallenges],actors.map(a=>a.id)]);await db.query('delete from auth.sessions where id=any($1::uuid[])',[sessions.map(s=>s.sessionId)]);});},
   async close(){if(closed)return;closed=true;releaseInitialRestore?.();for(const resolve of held.splice(0))resolve();for(const socket of sockets)socket.destroy();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await queue;await db.close();}
  };
 }catch(e){if(server){for(const socket of sockets)socket.destroy();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await db.close();throw e;}
}
