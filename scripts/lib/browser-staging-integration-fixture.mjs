// Local actual browser -> actual gateway -> installed PGlite controls/RLS.
// Auth/Zoho/Management services and sessions are synthetic; no real provider is contacted.
import https from 'node:https';
import {readFile} from 'node:fs/promises';
import {localTLS} from './browser-local-tls.mjs';
import {localDatabase} from './stage-3-local-db.mjs';
import {prepareReviewedEmailPlatform} from './email-reviewed-platform-fixture.mjs';
import {handoffSQL,stagingRef} from './email-registration-handoff-sql.mjs';
import {installationSQL} from '../install-fr-2-email-batch-h.mjs';
import {windowHandoffSQL} from './email-window-handoff-sql.mjs';
import {gatewayFromEnvironment} from '../../supabase/functions/_shared/email-verification-gateway.mjs';
import {acknowledgement,origin as hostedOrigin} from '../check-fr-2-email-batch-t.mjs';
const api='https://'+stagingRef+'.supabase.co',management='https://api.supabase.com/v1/projects/'+stagingRef;
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
export const syntheticActors=[1,2,3,4].map(n=>({user:id(n===4?42002:42001),session:id(43000+n),email:n===4?'second@example.invalid':'first@example.invalid'}));
const reply=(data,status=200,headers={})=>Response.json(data,{status,headers});
export async function stagingIntegrationFixture(modulePath,{loss=null}={}){
 if(![null,'begin','verify','open','close','device','active-proof'].includes(loss))throw Error('LOCAL_LOSS_REQUIRED');
 const {db}=await localDatabase(modulePath,{preparePlatform:prepareReviewedEmailPlatform});let queue=Promise.resolve();
 const serial=fn=>{const task=queue.then(fn);queue=task.catch(()=>{});return task;};
 const value=async(q,args)=>(await db.query(q,args)).rows[0]?.value;
 const actors=syntheticActors,users=actors.map(a=>({id:a.user,email:a.email,email_confirmed_at:new Date().toISOString(),is_anonymous:false}));
 const claims=actors.map(a=>({sub:a.user,session_id:a.session,iss:api+'/auth/v1',role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600}));
 const tokens=claims.map(c=>[{alg:'HS256'},c].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.SYNTHETIC');
 const input={managementToken:'sbp_fc'+'SYNTHETIC_ONLY_'.repeat(3),accounts:[{email:actors[0].email,password:'SYNTHETIC_FIRST_PASSWORD'},{email:actors[3].email,password:'SYNTHETIC_SECOND_PASSWORD'}],publishableKey:'sb_publishable_SYNTHETIC',allowedRecipients:[actors[0].email,actors[3].email],acknowledgement,browserExecutable:null};
 const state={signed:0,mail:0,code:null,direct:0,browser:0,unreviewed:0,SQL_errors:[],managementQueries:[],beforeFence:null};let server,origin,localAPI;
 try{
  await db.exec((await handoffSQL()).write);for(const i of [0,3])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[actors[i].user,actors[i].email]);await db.exec((await installationSQL()).write);await db.exec((await windowHandoffSQL()).write);
  await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[id(45001),actors[0].user]);await db.query('insert into mushavo_email_auth.account_state(user_id) values($1)',[actors[0].user]);
  await db.query("insert into mushavo_email_auth.devices(id,user_id,credential_digest,security_version,origin_challenge_id,verified_at,expires_at) values($1,$2,$3,1,$4,statement_timestamp(),statement_timestamp()+interval '168 hours')",[id(45002),actors[0].user,'4b'.repeat(32),id(45003)]);
  await db.query("insert into mushavo_email_auth.session_proofs(session_id,user_id,security_version,source,verified_at,established_at,device_id) select $1,user_id,1,'device',verified_at,statement_timestamp(),id from mushavo_email_auth.devices where id=$2",[id(45001),id(45002)]);
  state.beforeFence=await value('select changed_at::text value from mushavo_email_install.rollout_control');
  const keys={begin_challenge:['p_user','p_session','p_challenge','p_code_mac','p_key_version','p_remember'],set_delivery:['p_user','p_session','p_challenge','p_delivered'],challenge_context:['p_user','p_session','p_challenge'],verify_challenge:['p_user','p_session','p_challenge','p_code_mac','p_device_digest'],session_status:['p_user','p_session'],restore_device:['p_user','p_session','p_device_digest']};
  const upstream=async(url,options)=>{
   if(url===api+'/auth/v1/user')return reply(users[tokens.indexOf(options.headers.authorization.slice(7))]);
   if(url.startsWith(api+'/rest/v1/rpc/email_gate_')){const name=url.split('email_gate_')[1],args=JSON.parse(options.body),k=keys[name];if(!k||options.headers.apikey!=='sb_secret_SYNTHETIC')throw Error('SYNTHETIC_UPSTREAM_REQUIRED');return serial(async()=>{await db.exec('set role service_role');try{return reply(await value('select public.email_gate_'+name+'('+k.map((_,i)=>'$'+(i+1)).join(',')+') value',k.map(x=>args[x])));}finally{await db.exec('reset role');}});}
   if(url==='https://accounts.zoho.com/oauth/v2/token')return reply({access_token:'SYNTHETIC_ZOHO_ACCESS',expires_in:3600});
   if(url==='https://mail.zoho.com/api/accounts/12345678/messages'){const m=JSON.parse(options.body);if(m.toAddress!==actors[0].email)throw Error('SYNTHETIC_MAIL_REQUIRED');state.code=m.content.match(/is (\d{6})\./)[1];state.mail++;return reply({status:{code:200}});}
   state.unreviewed++;throw Error('UNREVIEWED_UPSTREAM');
  };
  const gateway=gatewayFromEnvironment({EMAIL_GATE_MODE:'STAGING_CONTROLLED_ONLY',EMAIL_GATE_PROJECT:stagingRef,EMAIL_GATE_ORIGIN:hostedOrigin,EMAIL_GATE_PEPPERS_JSON:JSON.stringify({v1:'2a'.repeat(32)}),EMAIL_GATE_KEY_VERSION:'v1',EMAIL_GATE_RATE_PEPPER:'3a'.repeat(32),EMAIL_GATE_RATE_LIMITER:{limit:async()=>({success:true})},SUPABASE_PUBLISHABLE_KEY:input.publishableKey,SUPABASE_SERVICE_ROLE_KEY:'sb_secret_SYNTHETIC',ZOHO_MAIL_ORIGIN:'https://mail.zoho.com',ZOHO_ACCOUNTS_ORIGIN:'https://accounts.zoho.com',ZOHO_ACCOUNT_ID:'12345678',ZOHO_FROM_ADDRESS:'notification@example.invalid',ZOHO_CLIENT_ID:'SYNTHETIC_CLIENT',ZOHO_CLIENT_SECRET:'SYNTHETIC_SECRET',ZOHO_REFRESH_TOKEN:'SYNTHETIC_REFRESH',ZOHO_TEST_RECIPIENTS_JSON:JSON.stringify(input.allowedRecipients)},upstream);
  const asRole=(i,fn)=>serial(async()=>{await db.exec('begin');try{await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims[i])]);await db.exec('set local role authenticated');return await fn();}finally{await db.exec('rollback');}});
  const json=(res,body,status=200,headers={})=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',...headers});res.end(JSON.stringify(body));};
  server=https.createServer(localTLS(),async(req,res)=>{try{
   state.browser++;const url=new URL(req.url,'https://'+req.headers.host),ui=url.origin===origin,backend=url.origin===localAPI;
   if(!ui&&!backend){state.unreviewed++;json(res,{},403);return;}
   const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Max-Age':'600'};
   if(backend&&req.method==='OPTIONS'&&['/rest/v1/rpc/email_gate_current_session_verified','/rest/v1/profiles'].includes(url.pathname)){res.writeHead(204,cors);res.end();return;}
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192)throw Error('SYNTHETIC_BODY_REQUIRED');}
   if(ui&&url.pathname.startsWith('/api/email-verification/')&&req.method==='POST'){
    if(req.headers.origin!==origin){json(res,{},403);return;}
    const headers={...req.headers,origin:hostedOrigin,'sec-fetch-site':'same-origin','cf-connecting-ip':'192.0.2.172'};delete headers.host;
    const response=await gateway(new Request(hostedOrigin+url.pathname,{method:'POST',headers,body:raw}));
    if(loss==='begin'&&url.pathname.endsWith('/begin')||loss==='verify'&&url.pathname.endsWith('/verify')){json(res,{result:'UNAVAILABLE'},502);return;}
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
   }
   if(backend&&req.headers.apikey===input.publishableKey){const i=tokens.indexOf((req.headers.authorization||'').slice(7));if(i<0)throw Error('SYNTHETIC_ACTOR_REQUIRED');
    if(url.pathname==='/rest/v1/rpc/email_gate_current_session_verified'&&req.method==='POST'){
     const current=await asRole(i,()=>value('select public.email_gate_current_session_verified() value'));
     const active=await serial(()=>value("select mode='ACTIVE' value from mushavo_email_install.rollout_control"));json(res,loss==='active-proof'&&active?false:current,200,cors);return;
    }
    if(url.pathname==='/rest/v1/profiles'&&req.method==='GET'&&url.searchParams.get('select')==='id'){
     json(res,await asRole(i,async()=>(await db.query('select id from public.profiles where id=$1',[url.searchParams.get('id')?.replace('eq.','')])).rows),200,cors);return;
    }
   }
   if(ui&&req.method==='GET'){
    if(url.pathname==='/offline.html'){res.writeHead(301,{location:'/offline'});res.end();return;}
    if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
    const name=url.pathname==='/offline'?'offline.html':url.pathname.slice(1);
    if(['offline.html','session-entry.js','email-verification.js','sw.js','manifest.webmanifest','pwa-shell.css','pwa-update.css','pwa.js','assets/pwa-icon-192.png','assets/apple-touch-icon.png','assets/mushavo-budget-logo.png'].includes(name)){
     res.writeHead(200,{'content-type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.png')?'image/png':name.endsWith('.webmanifest')?'application/manifest+json':'text/html','cache-control':'no-store'});res.end(await readFile(new URL('../../'+name,import.meta.url)));return;
    }
   }
   state.unreviewed++;json(res,{},404);
  }catch{json(res,{result:'SYNTHETIC_FIXTURE_REQUIRED'},500);}});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});origin='https://localhost:'+server.address().port;localAPI='https://127.0.0.1:'+server.address().port;
  const transport=async(url,options)=>{
   state.direct++;
   if(url===management)return reply({ref:stagingRef,status:'ACTIVE_HEALTHY',database:{host:'db.'+stagingRef+'.supabase.co'}});
   if(url===management+'/database/query'){const q=JSON.parse(options.body).query;state.managementQueries.push(q);
    const output=await serial(async()=>{try{return (await db.exec(q)).filter(x=>x.fields?.length).at(-1)?.rows??[];}catch(e){state.SQL_errors.push(e.message);await db.exec('rollback');throw Error('SYNTHETIC_SQL_REQUIRED');}});
    if(loss==='open'&&q.includes('AS bounded_open')||loss==='close'&&q.includes('AS bounded_close')||loss==='device'&&q.includes('AS device_cleanup'))throw Error('SYNTHETIC_LOST_COMMIT_RESPONSE');return reply(output,201);
   }
   if(url===hostedOrigin+'/config.js')return new Response('window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify({supabaseUrl:api,supabasePublishableKey:input.publishableKey,vapidPublicKey:''})+';',{headers:{'content-type':'application/javascript'}});
   if(url===api+'/auth/v1/token?grant_type=password'){const i=state.signed++;if(JSON.stringify(JSON.parse(options.body))!==JSON.stringify(input.accounts[i===3?1:0]))throw Error('SYNTHETIC_SIGNIN_REQUIRED');await serial(()=>db.query('insert into auth.sessions(id,user_id) values($1,$2)',[actors[i].session,actors[i].user]));return reply({access_token:tokens[i],user:users[i]});}
   const i=tokens.indexOf((options.headers.Authorization||'').slice(7));
   if(url===api+'/auth/v1/user')return reply(users[i]);
   if(url===api+'/auth/v1/logout?scope=local'){await serial(()=>db.query('delete from auth.sessions where id=$1',[actors[i].session]));return new Response(null,{status:204});}
   state.unreviewed++;throw Error('UNREVIEWED_DIRECT_REQUEST');
  };
  return {origin,api:localAPI,input,state,tokens,actors,transport,readCode:async()=>state.code,async inspect(){return serial(async()=>({sessions:await value('select count(*)::int value from auth.sessions'),devices:await value('select count(*)::int value from mushavo_email_auth.devices'),proofs:await value('select count(*)::int value from mushavo_email_auth.session_proofs'),challenges:await value('select count(*)::int value from mushavo_email_auth.challenges'),mode:await value('select mode value from mushavo_email_install.rollout_control'),windows:await value('select count(*)::int value from mushavo_email_install.acceptance_window'),sendEvents:await value('select count(*)::int value from mushavo_email_auth.send_events'),priorSession:await value('select count(*)::int value from auth.sessions where id=$1',[id(45001)]),priorDevice:await value('select count(*)::int value from mushavo_email_auth.devices where id=$1',[id(45002)]),fenceChanged:await value('select changed_at::text value from mushavo_email_install.rollout_control')!==state.beforeFence}));},async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await queue;await db.close();}};
 }catch(e){if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await db.close();throw e;}
}
