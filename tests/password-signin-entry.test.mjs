import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSessionAccess,createSessionEntry,createAuthCallbackEntry} from '../session-entry.js';
import worker from '../deployment/candidates/password-signin.pages.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const session=(id=A,token='SYNTHETIC_A')=>({user:{id},access_token:token,refresh_token:'SYNTHETIC_REFRESH'});
const payload=(patch={})=>({contract:1,policy:'PASSWORD_ONLY_ALL_USERS',session_valid:true,admin_authorized:false,role:null,...patch});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
function controller(options={}){
 let current=session();const states=[],calls=[],invalidations=[],unlocked=[];
 const client={rpc(name){calls.push(name);return options.request?options.request():Promise.resolve({data:payload(options.payload),error:null});}};
 const c=createSessionAccess({client,getSession:()=>current,requireAdmin:options.requireAdmin||false,onState:s=>states.push(s),onInvalidated:()=>invalidations.push(1),onUnlocked:async x=>{unlocked.push(x);await options.onUnlocked?.(x);}});
 return{c,client,states,calls,unlocked,invalidations,get current(){return current;},set current(x){current=x;}};
}
class Element{
 constructor(tag,doc){this.tag=tag;this.ownerDocument=doc;this.children=[];this.events={};this.hidden=false;this.textContent='';}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}
 setAttribute(key,value){this[key]=value;}addEventListener(name,fn){this.events[name]=fn;}
}
function document(){const doc={createElement:tag=>new Element(tag,doc)};return{doc,root:new Element('section',doc)};}
test('ordinary sign-in checks one server contract without requesting a code or reading browser approval',async()=>{
 const h=controller();assert.equal(await h.c.prepare(),true);assert.deepEqual(h.calls,['app_session_status']);assert.equal(h.c.authorized,true);assert.equal(h.unlocked.length,1);assert(h.unlocked[0].ticket());
});
test('Admin sign-in needs a server-assigned role and no email or factor code',async()=>{
 const h=controller({requireAdmin:true,payload:{admin_authorized:true,role:'super_admin'}});assert.equal(await h.c.prepare(),true);assert.deepEqual(h.calls,['app_session_status']);
 const g=controller({requireAdmin:true});assert.equal(await g.c.prepare(),false);assert.equal(g.states.at(-1).phase,'forbidden');
});
test('legacy, malformed, inconsistent and failed server responses cannot grant app access',async()=>{
 for(const data of [{contract:1,verified:true},payload({policy:'EMAIL_PROOF'}),payload({session_valid:'true'}),payload({admin_authorized:true}),payload({session_valid:false,admin_authorized:true,role:'super_admin'}),payload({role:'foreign'}),payload({debug:'extra'})]){
  const h=controller({request:()=>({data,error:null})});assert.equal(await h.c.prepare(),false);assert.equal(h.c.authorized,false);
 }
 const h=controller({request:()=>Promise.reject(Error('SYNTHETIC_PRIVATE'))});assert.equal(await h.c.prepare(),false);assert(!JSON.stringify(h.states).includes('SYNTHETIC_PRIVATE'));
});
test('account/token replacement invalidates an in-flight check and all old tickets',async()=>{
 const waiting=deferred(),h=controller({request:()=>waiting.promise});const request=h.c.prepare();h.current=session(B,'SYNTHETIC_B');h.c.bind(h.current);waiting.resolve({data:payload(),error:null});assert.equal(await request,false);assert.equal(h.unlocked.length,0);assert.equal(h.c.authorized,false);
 const g=controller();await g.c.prepare();const ticket=g.c.ticket();g.current=session(A,'NEW_TOKEN');g.c.bind(g.current);assert.equal(ticket(),false);assert.equal(g.c.authorized,false);
});
test('sign-out and explicit locking clear access while server failures remain retryable',async()=>{
 const h=controller();await h.c.prepare();const ticket=h.c.ticket();h.c.lock();assert.equal(ticket(),false);assert.equal(h.c.authorized,false);assert.equal(h.states.at(-1).phase,'unavailable');
 h.current=null;h.c.bind(null);assert.equal(await h.c.prepare(),false);assert.equal(h.c.authorized,false);
});
test('a failed workspace continuation clears any partial private model again',async()=>{
 const h=controller({onUnlocked:async()=>{throw Error('WORKSPACE_FAILURE');}});assert.equal(await h.c.prepare(),false);assert.equal(h.c.authorized,false);assert(h.invalidations.length>=3);assert.equal(h.states.at(-1).phase,'unavailable');
});
test('entry deduplicates startup and renders only retry/signout controls on unavailable status',async()=>{
 const d=document(),waiting=deferred(),calls=[],states=[];let current=session();
 const entry=createSessionEntry({client:{rpc:n=>{calls.push(n);return waiting.promise;}},getSession:()=>current,root:d.root,show:s=>states.push(s),onInvalidated(){},onUnlocked(){},onSignOut(){}});
 const a=entry.ensure(),b=entry.ensure();assert.equal(a,b);await new Promise(r=>setImmediate(r));assert.equal(calls.length,1);
 waiting.resolve({data:payload({session_valid:false}),error:null});assert.equal(await a,false);assert.equal(d.root.children.filter(x=>x.tag==='input'||x.tag==='form').length,0);assert.deepEqual(d.root.children.filter(x=>x.tag==='button').map(x=>x.textContent),['Try again','Sign out']);assert(!JSON.stringify(d.root.children.map(x=>x.textContent)).match(/Trust|email code|Verify your/));
});
test('retained Admin content stays visible on a valid background recheck and clears after role removal',async()=>{
 const d=document();let admin=true,invalidations=0;const shown=[];
 const e=createSessionEntry({client:{rpc:async()=>({data:payload({admin_authorized:admin,role:admin?'finance_staff':null}),error:null})},getSession:()=>session(),root:d.root,requireAdmin:true,retainViewDuringCheck:true,show:s=>shown.push(s.phase),onInvalidated:()=>invalidations++,onUnlocked(){},onSignOut(){}});
 assert.equal(await e.ensure(),true);const count=invalidations,views=shown.length;assert.equal(await e.recheck(),true);assert.equal(invalidations,count);assert.equal(shown.length,views);
 admin=false;assert.equal(await e.recheck(),false);assert(invalidations>count);assert.equal(shown.at(-1),'forbidden');
});
test('callback session authorization finishes automatically without a code form or normal-client adoption',async()=>{
 const d=document(),calls=[];let listener;const current=session();
 const client={auth:{getSession:async()=>({data:{session:current},error:null}),onAuthStateChange:fn=>{listener=fn;return{data:{subscription:{unsubscribe(){}}}};}},rpc:async n=>{calls.push(n);return{data:payload(),error:null};}};
 const entry=createAuthCallbackEntry({client,root:d.root,show(){},onInvalidated(){},onSignOut(){}});
 await entry.require(A);assert.deepEqual(calls,['app_session_status']);assert.equal(d.root.hidden,true);entry.cancel();entry.dispose();assert.equal(typeof listener,'function');
});
test('all retired gateway routes stop before assets, provider or limiter bindings are accessed',async()=>{
 let calls=0;
 const env=new Proxy({ASSETS:{fetch(){calls++;return new Response('STATIC');}}},{get(target,key){if(key==='ASSETS')return target[key];throw Error('PRIVATE_BINDING_ACCESSED');}});
 for(const route of ['begin','verify','restore','status','confirm-device','forget','revoke-all']){
  const r=await worker.fetch(new Request('https://mushavo-budget-staging.pages.dev/api/email-verification/'+route,{method:'POST'}),env);assert.equal(r.status,410);assert.deepEqual(await r.json(),{result:'SIGNIN_VERIFICATION_REMOVED'});
 }
 assert.equal(calls,0);
});
test('static worker strips credentials and refuses non-static methods',async()=>{
 let headers;const env={ASSETS:{fetch:r=>{headers=r.headers;return new Response('PUBLIC');}}};
 const r=await worker.fetch(new Request('https://mushavo-budget-staging.pages.dev/app.html',{headers:{authorization:'SYNTHETIC',cookie:'SYNTHETIC'}}),env);assert.equal(await r.text(),'PUBLIC');assert.equal(headers.get('authorization'),null);assert.equal(headers.get('cookie'),null);
 assert.equal((await worker.fetch(new Request('https://mushavo-budget-staging.pages.dev/other',{method:'POST'}),env)).status,405);
});
test('active screens and callbacks contain no trusted-browser or sign-in-code controls',()=>{
 for(const name of ['app.html','business.html','signup.html','auth.html','session-entry.js','auth-flows.js']){
  const text=fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');assert(!/Trust this browser|Verify your sign-in|registerConfirmationDevice|Send email code|securityTrustRetry|securityForgetDevice|securityRevokeAll/.test(text),name);
 }
 const build=fs.readFileSync(new URL('../scripts/build-public-site.mjs',import.meta.url),'utf8');assert(!build.includes("'email-verification.js'"));assert(!build.includes("'admin-mfa.js'"));
});

