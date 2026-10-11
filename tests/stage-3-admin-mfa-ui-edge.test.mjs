// Local SDK/Edge adapter tests. No genuine Auth, provider, email or hosted requests.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {createAdminMfa} from '../admin-mfa.js';
import {requireAdminAssurance} from '../supabase/functions/_shared/admin-assurance.mjs';
const allowed={staff:true,active:true,authorized:true,has_verified_factor:true};
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
function ui() {
 let session={user:{id:'local-a'},access_token:'local-conventional'},unlock=0;
 const states=[],calls=[];
 const client={rpc:async()=>({data:{...allowed,authorized:false}}),auth:{
  getSession:async()=>({data:{session}}),refreshSession:async()=>({data:{session}}),mfa:{
   listFactors:async()=>({data:{totp:[{id:'local-factor',status:'verified'}]}}),
   enroll:async()=>({data:{id:'local-new',totp:{secret:'LOCAL_SETUP_KEY'}}}),
   challengeAndVerify:async()=>({error:{message:'LOCAL_INVALID_CODE'}}),
   unenroll:async args=>{calls.push(args);return {};}
  }}};
 const controller=createAdminMfa({client,getSession:()=>session,onState:s=>states.push(s),onUnlocked:()=>{unlock++;}});
 controller.bind(session);
 return {controller,client,states,calls,setSession:s=>{session=s;controller.bind(s);},stepUp:()=>{session={...session,access_token:'local-stepped-up'};},get unlock(){return unlock;}};
}
test('low assurance and failed status cannot authorize/load Admin data',async()=> {
 const h=ui();assert.equal(await h.controller.check(),false);assert.equal(h.unlock,0);
 h.client.rpc=async()=>{throw Error('LOCAL_PRIVATE_ERROR');};assert.equal(await h.controller.check(),false);
 assert.equal(h.states.at(-1).phase,'unavailable');assert.ok(!JSON.stringify(h.states).includes('LOCAL_PRIVATE_ERROR'));
});
test('stale assurance result from previous account cannot unlock switched account',async()=> {
 const h=ui(),d=deferred();h.client.rpc=()=>d.promise;const result=h.controller.check();
 h.setSession({user:{id:'local-b'},access_token:'local-b-token'});d.resolve({data:allowed});
 assert.equal(await result,false);assert.equal(h.controller.authorized,false);assert.equal(h.unlock,0);
});
test('same-user token replacement rejects in-flight status and invalidates data ticket',async()=> {
 const h=ui();h.client.rpc=async()=>({data:allowed});assert.equal(await h.controller.check(),true);const ticket=h.controller.ticket();
 const d=deferred();h.client.rpc=()=>d.promise;const result=h.controller.check();h.stepUp();d.resolve({data:allowed});
 assert.equal(await result,false);assert.equal(ticket(),false);assert.equal(h.controller.authorized,false);
});
test('enrollment alone and invalid code stay locked; genuine SDK result still needs server gate',async()=> {
 const h=ui();await h.controller.prepare();await h.controller.enroll();assert.equal(h.controller.authorized,false);
 assert.equal(h.states.at(-1).secret,'LOCAL_SETUP_KEY');assert.equal(await h.controller.verify('123456'),false);
 assert.equal(h.states.at(-1).secret,'');assert.equal(h.unlock,0);
 h.client.auth.mfa.challengeAndVerify=async()=>{h.stepUp();return {};};
 assert.equal(await h.controller.verify('123456'),false);assert.equal(h.unlock,0);
 // A successfully verified factor must never be treated as cancellable unverified setup.
 await h.controller.cancel();assert.equal(h.calls.length,0);
});
test('successful SDK challenge plus server grant unlocks and clears setup secret',async()=> {
 const h=ui();await h.controller.prepare();await h.controller.enroll();
 h.client.auth.mfa.challengeAndVerify=async()=>{h.stepUp();return {};};h.client.rpc=async()=>({data:allowed});
 assert.equal(await h.controller.verify('123456'),true);assert.equal(h.unlock,1);assert.equal(h.controller.authorized,true);
 assert.equal(h.states.at(-1).secret,'');h.setSession(null);assert.equal(h.controller.authorized,false);assert.equal(h.states.at(-1).secret,'');
});
test('in-flight enrollment/challenge cannot expose a secret or unlock after logout',async()=> {
 const h=ui(),d=deferred();h.client.auth.mfa.enroll=()=>d.promise;const enrollment=h.controller.enroll();
 h.setSession(null);d.resolve({data:{id:'local-orphan',totp:{secret:'LOCAL_STALE_SECRET'}}});await enrollment;
 assert.ok(!JSON.stringify(h.states).includes('LOCAL_STALE_SECRET'));assert.equal(h.unlock,0);
 const next=ui(),v=deferred();await next.controller.prepare();next.client.auth.mfa.challengeAndVerify=()=>v.promise;
 const verifying=next.controller.verify('123456');next.setSession(null);v.resolve({});assert.equal(await verifying,false);assert.equal(next.unlock,0);
});
test('last verified factor cannot be removed; replacement removal rechecks assurance',async()=> {
 const h=ui();assert.equal(await h.controller.removeFactor('local-factor'),false);assert.equal(h.calls.length,0);
 h.client.auth.mfa.listFactors=async()=>({data:{totp:[{id:'local-factor',status:'verified'},{id:'local-replacement',status:'verified'}]}});
 h.client.rpc=async()=>({data:allowed});assert.equal(await h.controller.removeFactor('local-factor'),true);assert.equal(h.calls.length,1);
 h.client.auth.refreshSession=async()=>({error:{message:'LOCAL_REFRESH_FAILED'}});
 assert.equal(await h.controller.removeFactor('local-replacement'),false);assert.equal(h.controller.authorized,false);
});
test('Edge assurance helper fails closed and never exposes private adapter errors',async()=> {
 for(const data of [null,{}, {...allowed,staff:false},{...allowed,active:false},{...allowed,authorized:false},{...allowed,has_verified_factor:false}])await assert.rejects(requireAdminAssurance({rpc:async()=>({data})}),/ADMIN_MFA_REQUIRED/);
 await assert.rejects(requireAdminAssurance({rpc:async()=>{throw Error('LOCAL_PRIVATE_ERROR');}}),{message:'ADMIN_MFA_REQUIRED'});
 await requireAdminAssurance({rpc:async()=>({data:allowed})});
});
async function edge(name,{assurance=allowed,role='super_admin',user=true,cron='local-secret'}={}) {
 let handler;const calls={serviceReads:0,serviceWrites:0,provider:0,email:0,rpcs:[]};
 const env={APP_ORIGIN:'https://local.example.invalid',SUPABASE_URL:'https://local.example.invalid',SUPABASE_ANON_KEY:'local-anon',SUPABASE_SERVICE_ROLE_KEY:'local-service',CURRENCYAPI_API_KEY:'local-provider',CURRENCY_SYNC_SECRET:cron,CRON_SECRET:cron,VAPID_PUBLIC_KEY:'local-public',VAPID_PRIVATE_KEY:'local-private',VAPID_SUBJECT:'mailto:local@example.invalid'};
 const service={from:table=> {
  calls.serviceReads++;let operation='select',single=false;
  const query=new Proxy({}, {get:(_,key)=> {
   if(key==='then')return (resolve)=>resolve({data:table==='app_admins'?(rolesFor(name).includes(role)?{role}:null):table==='exchange_rate_sync_runs'?(single?{id:'local-run'}:[]):table==='supported_currencies'?[{code:'USD'}]:[],error:null});
   return (...args)=>{if(['insert','update','upsert','delete'].includes(key)){operation=key;calls.serviceWrites++;}if(['single','maybeSingle'].includes(key))single=true;return query;};
  }});return query;
 },rpc:async(name)=>{calls.rpcs.push(name);return {data:name.startsWith('enqueue_')?0:[],error:null};},auth:{admin:{inviteUserByEmail:async()=>{calls.email++;throw Error('NO_EMAIL_ALLOWED');}}}};
 const client={auth:{getUser:async()=>({data:{user:user?{id:'local-a'}:null},error:null})},rpc:async name=>{assert.equal(name,'admin_mfa_status');return {data:assurance,error:null};}};
 const source=await readFile(new URL(`../supabase/functions/${name}/index.ts`,import.meta.url),'utf8');
 const stripped=stripTypeScriptTypes(source.replace(/^import\s[\s\S]*?;\s*$/gm,''),{mode:'strip'});
 vm.runInNewContext(stripped,{
  Deno:{env:{get:key=>env[key]},serve:fn=>{handler=fn;}},createClient:(_url,key)=>key==='local-service'?service:client,
  requireAdminAssurance,Request,Response,Headers,URL,TextEncoder,AbortController,Date,setTimeout,clearTimeout,
  console:{error:()=>{},warn:()=>{},info:()=>{}},Error,
  safeProviderError:error=> /AUTHENTICATION|ACCESS_REQUIRED/.test(error?.message||'')?error.message:'LOCAL_SAFE_ERROR',currencyApiUrl:()=> 'https://local.example.invalid/rates',providerFailure:()=> 'LOCAL_PROVIDER_FAILURE',PROVIDER_BASE_CURRENCY:'USD',PROVIDER_NAME:'currencyapi',
  normalizeCurrencyApiPayload:()=>({rates:[{quote_currency:'USD',rate:1}],effectiveAt:'2026-10-11T00:00:00Z',missingCurrencies:[]}),
  fetch:async()=>{calls.provider++;return new Response('{}',{status:200});},
  webpush:{setVapidDetails:()=>{}},createGuardedPushSender:()=>async()=>{calls.provider++;throw Error('NO_PUSH_ALLOWED');},isBlockedPushDestination:()=>true
 });
 return {calls,request:async({secret,body={source:'cron'},bearer=true,method='POST'}={})=>handler(new Request('https://local.example.invalid',{method,headers:{...(bearer?{Authorization:'Bearer local-token'}:{}),...(secret!==undefined?{'x-cron-secret':secret,'x-mushavo-cron-secret':secret}:{}),'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})}))};
}
const rolesFor=name=>name==='invite-admin-user'?['super_admin','admin_staff']:['super_admin','admin_staff','finance_staff'];
test('actual Admin invite handler denies low assurance before service work or email',async()=> {
 const h=await edge('invite-admin-user',{assurance:{...allowed,authorized:false}});
 const r=await h.request({body:{role:'super_admin',aal:'aal2',mfa:true}});assert.equal(r.status,403);assert.equal((await r.json()).error,'ADMIN_MFA_REQUIRED');
 assert.equal(h.calls.serviceReads,0);assert.equal(h.calls.serviceWrites,0);assert.equal(h.calls.email,0);
});
test('actual Admin invite handler retains role limits after assurance',async()=> {
 for(const role of ['finance_staff','support_staff']){const h=await edge('invite-admin-user',{role});assert.equal((await h.request()).status,403);assert.equal(h.calls.email,0);assert.equal(h.calls.serviceWrites,0);}
 for(const role of ['super_admin','admin_staff']){const h=await edge('invite-admin-user',{role});assert.equal((await h.request({body:{}})).status,400);assert.equal(h.calls.email,0);}
});
test('actual currency handler denies forged MFA before service writes/provider',async()=> {
 const h=await edge('sync-exchange-rates',{assurance:{...allowed,authorized:false}});
 const r=await h.request({body:{source:'scheduled',aal:'aal2',mfa:true}});assert.equal(r.status,403);
 assert.equal((await r.json()).error,'ADMIN_MFA_REQUIRED');assert.equal(h.calls.serviceWrites,0);assert.equal(h.calls.provider,0);
});
test('actual currency handler keeps role matrix and scheduled secret branch',async()=> {
 for(const role of ['super_admin','admin_staff','finance_staff']) {const h=await edge('sync-exchange-rates',{role});assert.equal((await h.request({body:{}})).status,200);assert.equal(h.calls.provider,1);}
 const support=await edge('sync-exchange-rates',{role:'support_staff'});assert.notEqual((await support.request()).status,200);assert.equal(support.calls.serviceWrites,0);assert.equal(support.calls.provider,0);
 const scheduled=await edge('sync-exchange-rates',{user:false,assurance:null});assert.equal((await scheduled.request({secret:'local-secret',bearer:false})).status,200);assert.equal(scheduled.calls.provider,1);
 const wrong=await edge('sync-exchange-rates',{user:false});assert.equal((await wrong.request({secret:'wrong',bearer:false})).status,401);assert.equal(wrong.calls.serviceWrites,0);assert.equal(wrong.calls.provider,0);
});
for(const name of ['dispatch-admin-notifications','dispatch-push-reminders']) {
 test(`${name} actual handler rejects absent/wrong/empty secret and forged source before queue`,async()=> {
  for(const secret of [undefined,'wrong','']){const h=await edge(name);assert.equal((await h.request({secret})).status,401);assert.equal(h.calls.rpcs.length,0);assert.equal(h.calls.provider,0);}
  const h=await edge(name);assert.equal((await h.request({secret:'local-secret',body:{source:'browser'}})).status,400);assert.equal(h.calls.rpcs.length,0);
  const empty=await edge(name,{cron:''});assert.equal((await empty.request({secret:''})).status,401);assert.equal(empty.calls.rpcs.length,0);
 });
 test(`${name} local empty-queue secret control preserves safe service path`,async()=> {
  const h=await edge(name);const r=await h.request({secret:'local-secret'});assert.equal(r.status,200);assert.ok(h.calls.rpcs.some(n=>n.startsWith('claim_')));assert.equal(h.calls.provider,0);
 });
}
