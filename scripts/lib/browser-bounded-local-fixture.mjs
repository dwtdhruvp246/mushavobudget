// Synthetic bounded-mode backend only. Real shared DOM component + gateway code.
// Never accepts a real account, token, configurable public origin, or Management API.
import https from 'node:https';
import {readFile} from 'node:fs/promises';
import {localTLS} from './browser-local-tls.mjs';
import {actors} from './browser-email-fixture.mjs';
import {createEmailGateway,STAGING_ORIGIN} from '../../supabase/functions/_shared/email-verification-gateway.mjs';
export {actors};
export async function boundedBrowserFixture({failure=null}={}){
 if(![null,'BEGIN_RESPONSE_LOST','VERIFY_RESPONSE_LOST','ACTIVE_PROOF_DENIED'].includes(failure))throw Error('LOCAL_FIXTURE_INPUT_REQUIRED');
 const state={mode:'QUARANTINED',deadline:0,opens:0,closes:0,mail:0,code:null,requests:0,unexpected:0,proofs:new Set(),devices:new Map(),challenges:new Map(),routeCounts:{}};
 const key=a=>a.userId+':'+a.sessionId;
 const active=a=>state.mode==='ACTIVE'&&Date.now()<state.deadline&&a.userId===actors.a1.user&&state.proofs.has(key(a))&&failure!=='ACTIVE_PROOF_DENIED';
 const adapter={authenticate:async request=>{const alias=(request.headers.get('authorization')||'').replace('Bearer SYNTHETIC_',''),a=actors[alias];if(!a)throw Error('SYNTHETIC_ACTOR_REQUIRED');return {userId:a.user,sessionId:a.dbSession,email:alias+'@example.invalid'};},rpc:async(name,p)=>{
  const k=p.p_user+':'+p.p_session,c=state.challenges.get(p.p_challenge);
  if(name==='session_status')return active({userId:p.p_user,sessionId:p.p_session});
  if(name==='begin_challenge'){state.challenges.set(p.p_challenge,{...p,used:false});return {result:'PENDING_DELIVERY',challenge_id:p.p_challenge,expires_at:new Date(Date.now()+600000).toISOString()};}
  if(name==='set_delivery')return {result:p.p_delivered?'READY':'UNAVAILABLE'};
  if(name==='challenge_context')return c&&!c.used&&c.p_user===p.p_user&&c.p_session===p.p_session?{remember_device:c.p_remember,key_version:c.p_key_version}:null;
  if(name==='verify_challenge'){
   if(!c||c.used||c.p_user!==p.p_user||c.p_session!==p.p_session||c.p_code_mac!==p.p_code_mac)return {result:'CODE_REJECTED'};
   c.used=true;state.proofs.add(k);const expiry=new Date(Date.now()+604800000).toISOString();
   if(p.p_device_digest)state.devices.set(p.p_device_digest,{user:p.p_user,expiry});return {result:'VERIFIED',device_expires_at:expiry};
  }
  if(name==='restore_device'){const d=state.devices.get(p.p_device_digest);if(!d||d.user!==p.p_user||Date.parse(d.expiry)<=Date.now())return {result:'CODE_REQUIRED'};state.proofs.add(k);return {result:'APPROVED'};}
  throw Error('UNREVIEWED_SYNTHETIC_RPC');
 }};
 const gateway=createEmailGateway({adapter,mailer:async({code})=>{state.code=code;state.mail++;return {accepted:true};},keyring:new Map([['v1',new Uint8Array(32).fill(23)]]),currentKeyVersion:'v1',limit:async()=>({success:true})});
 const sources=Object.fromEntries(await Promise.all(['session-entry.js','email-verification.js'].map(async f=>[f,await readFile(new URL('../../'+f,import.meta.url),'utf8')])));
 let origin;
 const json=(res,data,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
 const server=https.createServer(localTLS(),async(req,res)=>{try{
  state.requests++;if(req.headers.host!==new URL(origin).host){state.unexpected++;json(res,{},403);return;}
  const url=new URL(req.url,origin);state.routeCounts[url.pathname]=(state.routeCounts[url.pathname]||0)+1;
  let raw='';for await(const part of req){raw+=part;if(raw.length>1024)throw Error('BOUNDED_BODY_REQUIRED');}
  if(/^\/api\/email-verification\/(?:status|restore|begin|verify)$/.test(url.pathname)&&req.method==='POST'&&!url.search){
   if(req.headers.origin!==origin||req.headers['x-mushavo-csrf']!=='email-v1'){json(res,{},403);return;}
   const headers={...req.headers,origin:STAGING_ORIGIN,'cf-connecting-ip':'192.0.2.198','sec-fetch-site':'same-origin'};delete headers.host;
   const response=await gateway(new Request(STAGING_ORIGIN+url.pathname,{method:'POST',headers,body:raw}));
   if((failure==='BEGIN_RESPONSE_LOST'&&url.pathname.endsWith('/begin'))||(failure==='VERIFY_RESPONSE_LOST'&&url.pathname.endsWith('/verify'))){json(res,{result:'UNAVAILABLE'},502);return;}
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
  }
  if(['/rpc/email_gate_current_session_verified','/profile'].includes(url.pathname)&&req.method==='POST'&&!url.search){
   const a=await adapter.authenticate(new Request(origin,{headers:req.headers})),verified=active(a);
   json(res,url.pathname==='/profile'?{data:verified&&JSON.parse(raw).scope==='own'?[{id:a.userId}]:[],error:null}:{data:verified,error:null});return;
  }
  if(req.method==='GET'&&url.pathname==='/favicon.ico'&&!url.search){res.writeHead(204);res.end();return;}
  if(req.method==='GET'&&(url.pathname==='/session-entry.js'&&!url.search||url.pathname==='/email-verification.js'&&url.search==='?v=2')){res.writeHead(200,{'content-type':'text/javascript','cache-control':'no-store'});res.end(sources[url.pathname.slice(1)]);return;}
  if(req.method==='GET'&&/^\?actor=(?:a1|a2|a3|b1)$/.test(url.search)&&url.pathname==='/fixture.html'){
   const alias=url.searchParams.get('actor'),a=actors[alias];
   res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});
   res.end(`<!doctype html><meta charset="utf-8"><title>Local bounded preparation</title><main id="gate"></main><section id="private"></section><script type="module">
import {createSessionEntry} from '/session-entry.js';
let session={user:{id:${JSON.stringify(a.user)}},access_token:'SYNTHETIC_'+${JSON.stringify(alias)}};
const headers=()=>({'Content-Type':'application/json',Authorization:'Bearer '+session.access_token});
const rpc=async()=>{const r=await fetch('/rpc/email_gate_current_session_verified',{method:'POST',cache:'no-store',headers:headers(),body:'{}'});return r.json();};
const entry=createSessionEntry({client:{rpc},getSession:()=>session,root:document.querySelector('#gate'),origin:location.origin,events:null,show:()=>{},onInvalidated:()=>document.querySelector('#private').replaceChildren(),onUnlocked:()=>{document.querySelector('#private').textContent='SYNTHETIC_PRIVATE_CANARY';},onSignOut:()=>{session=null;entry.bind(null);}});
window.fixture={entry,async ensure(){const ok=await entry.recheck();if(ok&&entry.ticket()())document.querySelector('#private').textContent='SYNTHETIC_PRIVATE_CANARY';return ok;},async http(){const gateway=await(await fetch('/api/email-verification/status',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{...headers(),'x-mushavo-csrf':'email-v1'},body:'{}'})).json();const proof=await rpc();const own=await(await fetch('/profile',{method:'POST',cache:'no-store',headers:headers(),body:JSON.stringify({scope:'own'})})).json();const foreign=await(await fetch('/profile',{method:'POST',cache:'no-store',headers:headers(),body:JSON.stringify({scope:'foreign'})})).json();return {gateway:gateway.verified,rpc:proof.data,own:own.data.length===1&&own.data[0].id===session.user.id,foreignDenied:foreign.data.length===0};},switchActor(user,token){session={user:{id:user},access_token:token};entry.bind(session);}};
await fixture.ensure();window.ready=true;
</script>`);return;
  }
  state.unexpected++;json(res,{},404);
 }catch{json(res,{result:'LOCAL_FIXTURE_REQUIRED'},500);}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});origin='https://localhost:'+server.address().port;
 return {origin,state,sources,open(){if(state.opens||state.mode!=='QUARANTINED')throw Error('LOCAL_OPEN_ONCE_REQUIRED');state.opens++;state.mode='ACTIVE';state.deadline=Date.now()+300000;},quarantine(){state.closes++;state.mode='QUARANTINED';state.deadline=0;},async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
