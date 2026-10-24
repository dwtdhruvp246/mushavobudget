import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmailVerification,attachEmailVerificationView} from '../email-verification.js';
const origin='https://mushavo-budget-staging.pages.dev',challenge='00000000-0000-4000-8000-000000000981';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json'}});
function fixture(options={}){
  let session={user:{id:'actor-a'},access_token:'synthetic-bearer-a'},approved=options.approved??false;
  const states=[],calls=[],rpcCalls=[],unlocks=[],invalidations=[];
  const client={rpc:async name=>{rpcCalls.push(name);if(options.rpc)return options.rpc(name);return{data:name==='email_gate_admin_status'?(options.adminStatus??{contract:1,verified:true,authorized:true,role:'super_admin'}):approved,error:null};}};
  const fetcher=async(url,init)=>{calls.push({url,init,body:JSON.parse(init.body)});if(options.fetcher)return options.fetcher(url,init);
    if(url.endsWith('/restore'))return json({result:'CODE_REQUIRED'});
    if(url.endsWith('/begin'))return json({result:'CODE_REQUESTED',challengeId:challenge,expiresAt:new Date(Date.now()+600000).toISOString()});
    approved=options.proofAfterVerify!==false;return json({result:'VERIFIED'});
  };
  const c=createEmailVerification({client,getSession:()=>session,fetcher,origin,requireAdmin:options.requireAdmin??false,onState:x=>states.push(x),onUnlocked:async x=>{unlocks.push(x);await options.onUnlocked?.(x);},onInvalidated:()=>invalidations.push(true)});
  return{c,states,calls,rpcCalls,unlocks,invalidations,setSession:x=>{session=x;},approve:x=>{approved=x;}};
}
test('A password-only session stays locked and no code is dispatched automatically',async()=>{
 const h=fixture();assert.equal(await h.c.prepare(),false);assert.equal(h.states.at(-1).phase,'locked');assert.equal(h.calls.length,1);assert(h.calls[0].url.endsWith('/restore'));assert.equal(h.unlocks.length,0);
});
test('An already approved open session needs no restore or mail request',async()=>{
 const h=fixture({approved:true});assert.equal(await h.c.prepare(),true);assert.equal(h.calls.length,0);assert.equal(h.unlocks.length,1);assert.equal(h.unlocks[0].ticket(),true);
});
test('Restored device approval must be confirmed by the no-argument SQL proof RPC',async()=>{
 const h=fixture({fetcher:async()=>{h.approve(true);return json({result:'APPROVED'});}});assert.equal(await h.c.prepare(),true);assert.deepEqual(h.rpcCalls,['email_gate_current_session_verified','email_gate_current_session_verified']);
});
test('A forged gateway approval cannot authorize a false SQL session proof',async()=>{
 const h=fixture({fetcher:async()=>json({result:'APPROVED'})});assert.equal(await h.c.prepare(),false);assert.equal(h.states.at(-1).phase,'unavailable');assert.equal(h.unlocks.length,0);
});
test('Explicit send binds exact remember choice and bearer to a same-origin POST',async()=>{
 const h=fixture();await h.c.requestCode(true);const x=h.calls[0];assert.equal(x.url,origin+'/api/email-verification/begin');assert.deepEqual(x.body,{remember:true});
 assert.equal(x.init.headers.Authorization,'Bearer synthetic-bearer-a');assert.equal(x.init.headers['X-Mushavo-CSRF'],'email-v1');
 for(const [k,v]of Object.entries({method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'}))assert.equal(x.init[k],v);
 assert(x.init.signal instanceof AbortSignal);assert.equal(h.c.authorized,false);assert.equal(h.states.at(-1).phase,'code');
});
test('Only a boolean remember flag is accepted and default is off',async()=>{
 const h=fixture();await h.c.requestCode('yes');assert.equal(h.calls.length,0);await h.c.requestCode();assert.deepEqual(h.calls[0].body,{remember:false});
});
test('Code verification transmits only challenge and six digits then rechecks SQL before unlocking',async()=>{
 const h=fixture();await h.c.requestCode(false);await h.c.verify('123456');assert.deepEqual(h.calls[1].body,{challengeId:challenge,code:'123456'});assert.equal(h.c.authorized,true);assert.equal(h.unlocks.length,1);assert.deepEqual(h.rpcCalls,['email_gate_current_session_verified']);
});
test('Malformed code and verification without a current challenge do not issue requests',async()=>{
 const h=fixture();await h.c.verify('123456');await h.c.requestCode();for(const code of['12345','1234567','12 456',123456,'<script>'])await h.c.verify(code);assert.equal(h.calls.length,1);
});
test('Verified gateway response without stored proof never unlocks',async()=>{
 const h=fixture({proofAfterVerify:false});await h.c.requestCode();assert.equal(await h.c.verify('123456'),false);assert.equal(h.c.authorized,false);assert.equal(h.unlocks.length,0);
});
test('Send failure clears the previous challenge and returns only fixed UI text',async()=>{
 let fail=false;const h=fixture({fetcher:async()=>fail?json({result:'MAIL_UNAVAILABLE',secret:'PRIVATE_PROVIDER'},503):json({result:'CODE_REQUESTED',challengeId:challenge,expiresAt:new Date().toISOString()})});
 await h.c.requestCode();fail=true;await h.c.requestCode();assert.equal(h.states.at(-1).canVerify,false);assert.equal(h.states.at(-1).message,'Your code could not be sent. Try again later.');assert(!JSON.stringify(h.states).includes('PRIVATE_PROVIDER'));
});
test('Cooldown and attempt rejection use fixed messages and never authorize',async()=>{
 for(const [result,status]of[['COOLDOWN',429],['RATE_LIMIT',429],['RATE_LIMITED',429]]){const h=fixture({fetcher:async()=>json({result},status)});await h.c.requestCode();assert.equal(h.c.authorized,false);assert.match(h.states.at(-1).message,/Wait|wait|requests|attempts/);}
});
test('Bad code retains the current challenge for a corrected attempt',async()=>{
 let rejected=true;const h=fixture({fetcher:async url=>{
  if(url.endsWith('/begin'))return json({result:'CODE_REQUESTED',challengeId:challenge,expiresAt:new Date().toISOString()});
  if(rejected)return json({result:'CODE_REJECTED'},400);h.approve(true);return json({result:'VERIFIED'});
 }});
 await h.c.requestCode();assert.equal(await h.c.verify('000000'),false);assert.equal(h.states.at(-1).canVerify,true);assert.equal(h.states.at(-1).phase,'code');assert.match(h.states.at(-1).message,/not accepted/);
 rejected=false;assert.equal(await h.c.verify('123456'),true);assert.equal(h.unlocks.length,1);assert.equal(h.calls[2].body.challengeId,challenge);
});
test('Malformed JSON, HTML fallback, oversized body and redirected responses fail closed',async()=>{
 for(const make of[()=>new Response('<html>fallback</html>'),()=>new Response('{',{headers:{'content-type':'application/json'}}),()=>json({result:'CODE_REQUESTED',padding:'x'.repeat(5000)}),()=>({redirected:true,headers:new Headers({'content-type':'application/json'})})]){
 const h=fixture({fetcher:async()=>make()});await h.c.requestCode();assert.equal(h.c.authorized,false);assert.equal(h.states.at(-1).canVerify,false);}
});
test('Unexpected provider errors and malformed truthy RPC proof do not leak or approve',async()=>{
 for(const data of['true',1,{},null]){const h=fixture({rpc:async()=>({data,error:null})});await h.c.check();assert.equal(h.c.authorized,false);assert.equal(h.states.at(-1).phase,'unavailable');}
 const h=fixture({rpc:async()=>{throw Error('PRIVATE_TOKEN');}});await h.c.check();assert(!JSON.stringify(h.states).includes('PRIVATE_TOKEN'));
});
test('An unresponsive proof request stops with fixed unavailable state',{timeout:12000},async()=>{
 const h=fixture({rpc:()=>new Promise(()=>{})});assert.equal(await h.c.check(),false);assert.equal(h.c.busy,false);assert.equal(h.states.at(-1).phase,'unavailable');assert.equal(h.unlocks.length,0);
});
test('Admin requires server proof plus exact authorized platform role contract',async()=>{
 for(const role of['super_admin','admin_staff','finance_staff','support_staff']){const h=fixture({approved:true,requireAdmin:true,adminStatus:{contract:1,verified:true,authorized:true,role}});assert.equal(await h.c.check(),true);}
 for(const adminStatus of[{contract:1,verified:true,authorized:false,role:null},{contract:1,verified:true,authorized:true,role:null},{contract:1,verified:false,authorized:true,role:'super_admin'},{contract:1,verified:true,authorized:true,role:'business_owner'},{authorized:true,has_verified_factor:true}]){const h=fixture({approved:true,requireAdmin:true,adminStatus});assert.equal(await h.c.check(),false);}
});
test('Unverified Admin never requests the role/status response',async()=>{
 const h=fixture({requireAdmin:true});await h.c.check();assert.deepEqual(h.rpcCalls,['email_gate_current_session_verified']);
});
test('Actor change aborts a pending send and cannot retain its challenge or unlock',async()=>{
 const d=deferred();const h=fixture({fetcher:()=>d.promise});const pending=h.c.requestCode();await new Promise(r=>setImmediate(r));
 h.setSession({user:{id:'actor-b'},access_token:'synthetic-bearer-b'});h.c.bind({user:{id:'actor-b'},access_token:'synthetic-bearer-b'});
 d.resolve(json({result:'CODE_REQUESTED',challengeId:challenge,expiresAt:new Date().toISOString()}));await pending;
 assert.equal(h.states.at(-1).canVerify,false);assert.equal(h.c.authorized,false);assert.equal(h.unlocks.length,0);assert.equal(h.calls[0].init.signal.aborted,true);
});
test('Same-actor token replacement invalidates tickets and rejects an in-flight proof',async()=>{
 const d=deferred();let pending=false;const h=fixture({approved:true,rpc:async()=>pending?d.promise:{data:true,error:null}});await h.c.check();const ticket=h.c.ticket();assert(ticket());pending=true;const checking=h.c.check();await new Promise(r=>setImmediate(r));
 h.setSession({user:{id:'actor-a'},access_token:'new-bearer'});h.c.bind({user:{id:'actor-a'},access_token:'new-bearer'});d.resolve({data:true,error:null});await checking;assert.equal(ticket(),false);assert.equal(h.c.authorized,false);
});
test('A code from the previous actor is not posted under a new identity',async()=>{
 const h=fixture();await h.c.requestCode();h.setSession({user:{id:'actor-b'},access_token:'new-bearer'});await h.c.verify('123456');assert.equal(h.calls.length,1);assert.equal(h.c.authorized,false);
});
test('Logout clears approval, challenge and access ticket without deleting Auth factors',async()=>{
 const h=fixture({approved:true});await h.c.check();const ticket=h.c.ticket();h.setSession(null);assert.equal(h.c.authorized,false);assert.equal(ticket(),false);h.c.bind(null);assert.equal(h.c.authorized,false);assert.equal(ticket(),false);assert.equal(await h.c.prepare(),false);assert.equal(h.calls.length,0);
});
test('Busy state prevents duplicate code requests',async()=>{
 const d=deferred();const h=fixture({fetcher:()=>d.promise});const first=h.c.requestCode();await new Promise(r=>setImmediate(r));assert.equal(await h.c.requestCode(),false);assert.equal(h.calls.length,1);d.resolve(json({result:'CODE_REQUESTED',challengeId:challenge,expiresAt:new Date().toISOString()}));await first;
});
test('Each later check revokes the prior ticket before accepting a new server result',async()=>{
 const h=fixture({approved:true});await h.c.check();const ticket=h.c.ticket();h.approve(false);assert.equal(await h.c.check(),false);assert.equal(ticket(),false);assert(h.invalidations.length>=2);
});
test('Unexpected response fields do not supply approval or a navigation destination',async()=>{
 const h=fixture({fetcher:async()=>json({result:'VERIFIED',verified:true,authorized:true,role:'super_admin',redirect:'https://foreign.invalid'})});await h.c.requestCode();assert.equal(h.c.authorized,false);assert.equal(h.unlocks.length,0);
});
test('HTTP and non-origin configuration is refused before any transport',()=>{
 for(const value of['http://example.invalid',origin+'/',origin+'/other','https://user:pass@example.invalid'])assert.throws(()=>createEmailVerification({origin:value,client:{},getSession:()=>null}));
});
class Element{
 constructor(tag,doc){this.tag=tag;this.ownerDocument=doc;this.children=[];this.events={};this.value='';this.hidden=false;this.disabled=false;this.checked=false;}
 append(...x){this.children.push(...x);}replaceChildren(...x){this.children=x;}setAttribute(k,v){this[k]=v;}addEventListener(k,fn){this.events[k]=fn;}
}
function view(){const doc={createElement:tag=>new Element(tag,doc),createTextNode:text=>({textContent:text})};const root=new Element('section',doc),calls=[];const controller={requestCode:x=>calls.push(['send',x]),prepare:()=>calls.push(['prepare']),verify:x=>calls.push(['verify',x]),lock:()=>calls.push(['lock'])};const render=attachEmailVerificationView({controller,root,document:doc,onSignOut:()=>calls.push(['signout'])});const all=[];function visit(n){all.push(n);for(const x of n.children||[])visit(x);}visit(root);return{root,all,calls,render};}
test('Actual view defaults remember off, labels email code and keeps signout available during requests',()=>{
 const v=view(),remember=v.all.find(x=>x.type==='checkbox'),send=v.all.find(x=>x.textContent==='Send email code');assert.equal(remember.checked,false);remember.checked=true;send.events.click();assert.deepEqual(v.calls,[['send',true]]);
 v.render({phase:'loading',busy:true,authorized:false,canVerify:false});assert.equal(send.disabled,true);assert.equal(v.all.find(x=>x.textContent==='Sign out').disabled,false);
});
test('Actual form removes the code from its input before invoking verification',()=>{
 const v=view(),form=v.all.find(x=>x.tag==='form'),code=v.all.find(x=>x.autocomplete==='one-time-code');code.value=' 123456 ';let prevented=false;form.events.submit({preventDefault(){prevented=true;}});assert(prevented);assert.equal(code.value,'');assert.deepEqual(v.calls,[['verify','123456']]);
});
test('Changing remember after requesting a code invalidates that challenge before a new choice',()=>{
 const v=view(),remember=v.all.find(x=>x.type==='checkbox'),code=v.all.find(x=>x.autocomplete==='one-time-code');
 v.render({phase:'code',busy:false,authorized:false,canVerify:true});remember.checked=true;code.value='123456';remember.events.change();assert.deepEqual(v.calls,[['lock']]);assert.equal(code.value,'');assert.equal(remember.checked,true);
});
test('Actual view uses textContent for messages and clears code/remember on logout and locking',()=>{
 const v=view(),code=v.all.find(x=>x.autocomplete==='one-time-code'),remember=v.all.find(x=>x.type==='checkbox'),signout=v.all.find(x=>x.textContent==='Sign out');code.value='123456';remember.checked=true;signout.events.click();assert.equal(code.value,'');assert.equal(remember.checked,false);assert.deepEqual(v.calls,[['lock'],['signout']]);v.render({phase:'locked',message:'<img onerror=unsafe>',busy:false,authorized:false,canVerify:false});assert.equal(v.all.find(x=>x.role==='status').textContent,'<img onerror=unsafe>');
});
