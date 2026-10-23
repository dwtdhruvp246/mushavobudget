// Actual shared UI/gateway/SW sources over ephemeral loopback HTTPS. Auth/DB/mail are synthetic.
import https from 'node:https';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {localTLS} from './browser-local-tls.mjs';
import {collectUnreviewedRoute} from './browser-route-audit.mjs';
import {createEmailGateway,STAGING_ORIGIN} from '../../supabase/functions/_shared/email-verification-gateway.mjs';
const root=new URL('../../',import.meta.url);
export const actors={a1:{user:'00000000-0000-4000-8000-000000000901',session:'a1',dbSession:'00000000-0000-4000-8000-000000000911'},a2:{user:'00000000-0000-4000-8000-000000000901',session:'a2',dbSession:'00000000-0000-4000-8000-000000000912'},a3:{user:'00000000-0000-4000-8000-000000000901',session:'a3',dbSession:'00000000-0000-4000-8000-000000000913'},b1:{user:'00000000-0000-4000-8000-000000000902',session:'b1',dbSession:'00000000-0000-4000-8000-000000000914'}};
export async function browserFixture(){
 const state={proofs:new Set(),challenges:new Map(),devices:new Map(),mail:0,code:null,offline:false,suppressProof:false,requests:0,unexpected:0,unreviewedRoutes:new Map(),unreviewedRouteOverflow:0,probeCookie:null,routeCounts:{},rpcCalls:0};
 const adapter={authenticate:async request=>{const name=(request.headers.get('authorization')||'').replace('Bearer SYNTHETIC_',''),a=actors[name];if(!a)throw Error('SYNTHETIC_AUTH_REQUIRED');return{userId:a.user,sessionId:a.dbSession,email:name+'@example.invalid'};},
  rpc:async(name,p)=>{
   const key=p.p_user+':'+p.p_session;
   if(name==='session_status')return state.proofs.has(key)&&!state.suppressProof;
   if(name==='begin_challenge'){state.challenges.set(p.p_challenge,{...p,used:false});return{result:'PENDING_DELIVERY',challenge_id:p.p_challenge,expires_at:new Date(Date.now()+600000).toISOString()};}
   if(name==='set_delivery')return{result:p.p_delivered?'READY':'UNAVAILABLE'};
   const c=state.challenges.get(p.p_challenge);
   if(name==='challenge_context')return c&&!c.used&&c.p_user===p.p_user&&c.p_session===p.p_session?{remember_device:c.p_remember,key_version:c.p_key_version}:null;
   if(name==='verify_challenge'){
    if(!c||c.used||c.p_user!==p.p_user||c.p_session!==p.p_session||c.p_code_mac!==p.p_code_mac)return{result:'CODE_REJECTED'};
    c.used=true;state.proofs.add(key);const expiry=new Date(Date.now()+604800000).toISOString();if(p.p_device_digest)state.devices.set(p.p_device_digest,{user:p.p_user,expiry});return{result:'VERIFIED',device_expires_at:expiry};
   }
   if(name==='restore_device'){const d=state.devices.get(p.p_device_digest);if(!d||d.user!==p.p_user||Date.parse(d.expiry)<=Date.now())return{result:'CODE_REQUIRED'};state.proofs.add(key);return{result:'APPROVED'};}
   if(name==='revoke_device'){state.devices.delete(p.p_device_digest);state.proofs.clear();return{result:'REVOKED'};}
   if(name==='revoke_all'){state.devices.clear();state.proofs.clear();return{result:'REVOKED'};}
   throw Error('SYNTHETIC_RPC_REQUIRED');
  }};
 const gateway=createEmailGateway({adapter,mailer:async({code})=>{state.code=code;state.mail++;return{accepted:true};},keyring:new Map([['v1',new Uint8Array(32).fill(19)]]),currentKeyVersion:'v1',limit:async()=>({success:true})});
 const sources=Object.fromEntries(await Promise.all(['email-verification.js','session-entry.js','sw.js','offline.html','app-entry.html','manifest.webmanifest'].map(async f=>[f,await readFile(new URL(f,root),'utf8')])));
 let origin;
 const json=(res,data,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
 const html=res=>{res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});};
 const server=https.createServer(localTLS(),async(req,res)=>{try{
  state.requests++;const host=req.headers.host;if(![new URL(origin).host,new URL(origin.replace('localhost','127.0.0.1')).host].includes(host)){res.writeHead(403);res.end();return;}
  const url=new URL(req.url,origin);state.routeCounts[url.pathname]=(state.routeCounts[url.pathname]||0)+1;let raw='';for await(const part of req){raw+=part;if(raw.length>8192)throw Error('FIXTURE_BODY_REQUIRED');}
  if(url.pathname==='/api/email-verification/status'||url.pathname==='/api/email-verification/begin'||url.pathname==='/api/email-verification/verify'||url.pathname==='/api/email-verification/restore'||url.pathname==='/api/email-verification/forget'||url.pathname==='/api/email-verification/revoke-all'){
   if(req.headers.origin!==origin||req.headers['x-mushavo-csrf']!=='email-v1'){json(res,{result:'ORIGIN_REJECTED'},403);return;}
   // Origin translation is fixture-only. Hosted gateway CSRF/TLS acceptance is not claimed.
   const h={...req.headers,origin:STAGING_ORIGIN,'cf-connecting-ip':'192.0.2.199','sec-fetch-site':'same-origin'};delete h.host;
   const response=await gateway(new Request(STAGING_ORIGIN+url.pathname,{method:req.method,headers:h,body:raw}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
  }
  if(url.pathname.startsWith('/rpc/')){state.rpcCalls++;const actor=actors[(req.headers.authorization||'').replace('Bearer SYNTHETIC_','')];if(!actor){json(res,{data:false,error:null});return;}
   const verified=state.proofs.has(actor.user+':'+actor.dbSession)&&!state.suppressProof;
   json(res,{data:url.pathname.endsWith('email_gate_admin_status')?{contract:1,verified,authorized:false,role:null}:verified,error:null});return;
  }
  if(['/rest/','/auth/','/storage/','/functions/'].some(prefix=>url.pathname.startsWith(prefix))){json(res,{fixture:'SYNTHETIC_PRIVATE_CANARY'});return;}
  if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
  if(url.pathname==='/cookie-probe'){state.probeCookie=typeof req.headers.cookie==='string';html(res);res.end('<!doctype html><title>Probe complete</title>');return;}
  if(url.pathname==='/cross-site.html'){html(res);res.end('<!doctype html><form method="POST" action="'+origin+'/cookie-probe"><button>Submit</button></form>');return;}
  if(url.pathname==='/fixture.html'){const a=actors[url.searchParams.get('actor')||'a1'];if(!a)throw Error('FIXTURE_ACTOR_REQUIRED');html(res);res.end(`<!doctype html><meta charset="UTF-8"><title>Offline browser fixture</title><main id="gate"></main><section id="private"></section><div id="snapshot"><input id="original"></div><script type="module">
import {createSessionEntry,snapshotPrivateView} from '/session-entry.js';
import {createVerificationEvents} from '/email-verification.js';
let session={user:{id:${JSON.stringify(a.user)}},access_token:'SYNTHETIC_'+${JSON.stringify(a.session)}};
const events=createVerificationEvents(name=>new BroadcastChannel(name));
let loaded=null;
const entry=createSessionEntry({client:{rpc:async name=>(await fetch('/rpc/'+name,{method:'POST',cache:'no-store',headers:{Authorization:'Bearer '+session.access_token}})).json()},getSession:()=>session,root:document.querySelector('#gate'),origin:location.origin,requireAdmin:${url.searchParams.get('admin')==='1'},
show:()=>{},onInvalidated:()=>{loaded=null;document.querySelector('#private').replaceChildren();},onUnlocked:async()=>{loaded='SYNTHETIC_PRIVATE_CANARY';document.querySelector('#private').textContent=loaded;},onSignOut:async()=>{session=null;entry.bind(null);},events});
window.fixture={entry,events,async ensure(){const ok=await entry.ensure();if(ok&&entry.ticket()()){loaded='SYNTHETIC_PRIVATE_CANARY';document.querySelector('#private').textContent=loaded;}return ok;},get loaded(){return loaded;},get session(){return session;},switchActor(user,token){session={user:{id:user},access_token:token};entry.bind(session);},snapshotPrivateView};
await window.fixture.ensure();window.ready=true;
</script>`);return;}
  const name=url.pathname.slice(1);
  if(Object.hasOwn(sources,name)){res.writeHead(200,{'content-type':name.endsWith('.js')?'text/javascript':name==='manifest.webmanifest'?'application/manifest+json':'text/html','cache-control':'no-store','service-worker-allowed':'/'});res.end(sources[name]);return;}
  if(url.pathname==='/app.html'){if(state.offline){req.socket.destroy();return;}html(res);res.end('<!doctype html><title>Synthetic app</title>SYNTHETIC_PRIVATE_CANARY');return;}
  if(url.pathname.startsWith('/assets/')||/\.(?:js|css)$/.test(url.pathname)){res.writeHead(200,{'content-type':url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'application/octet-stream','cache-control':'no-store'});res.end('');return;}
  collectUnreviewedRoute(state,url,req.method,req.headers['sec-fetch-dest']);res.writeHead(404);res.end();
 }catch{json(res,{result:'FIXTURE_REQUIRED'},500);}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});origin='https://localhost:'+server.address().port;
 return{origin,state,close:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
