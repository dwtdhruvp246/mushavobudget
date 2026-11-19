import test from 'node:test';
import assert from 'node:assert/strict';
import {registerConfirmationDevice} from '../email-verification.js';
import {securityPageFixture as page} from './helpers/security-page.mjs';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const origin='https://mushavo-budget-staging.pages.dev';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
function fixture(response){
 let current={user:{id,email_confirmed_at:'2026-10-27T00:00:00Z'},access_token:'synthetic-link-bearer'};
 const calls=[],client={auth:{getSession:async()=>({data:{session:current},error:null}),getUser:async()=>({data:{user:current?.user},error:null})}};
 const options={client,expectedId:id,origin,fetcher:async(url,init)=>{calls.push({url,init});return response(calls.length);}};
 return{calls,options,setSession:value=>current=value};
}
test('confirmation enrollment completes its bounded two-cookie handshake without sending any code',async()=>{
 const f=fixture(n=>json(n===1?{result:'DEVICE_COOKIE_PREPARED'}:{result:'TRUSTED',persistent:true}));
 assert.equal(await registerConfirmationDevice(f.options),true);assert.equal(f.calls.length,2);
 for(const call of f.calls){assert.equal(call.url,origin+'/api/email-verification/confirm-device');assert.equal(call.init.credentials,'same-origin');assert.equal(call.init.cache,'no-store');assert.equal(call.init.redirect,'error');assert.equal(call.init.body,'{}');assert.equal(call.init.headers.Authorization,'Bearer synthetic-link-bearer');assert.equal(call.init.signal.aborted,true);}
});
test('blocked cookie storage stops after two preparations and never claims trusted success',async()=>{
 const f=fixture(()=>json({result:'DEVICE_COOKIE_PREPARED'}));
 await assert.rejects(registerConfirmationDevice(f.options),{code:'device_trust_unavailable'});assert.equal(f.calls.length,2);
});
test('a transient transport error is sanitized and not automatically retried',async()=>{
 const f=fixture(()=>{throw Error('PRIVATE_AUTH_TOKEN');});
 await assert.rejects(registerConfirmationDevice(f.options),error=>error.code==='device_trust_unavailable'&&!error.message.includes('PRIVATE'));
 assert.equal(f.calls.length,1);
});
test('unconfirmed identity or initial actor mismatch cannot send enrollment requests',async()=>{
 for(const user of [{id:other,email_confirmed_at:'2026-10-27'},{id,email_confirmed_at:null}]){
  const f=fixture(()=>json({result:'TRUSTED',persistent:true}));f.setSession({user,access_token:'synthetic-link-bearer'});
  await assert.rejects(registerConfirmationDevice(f.options),{code:'session_changed'});assert.equal(f.calls.length,0);
 }
});
test('an account switch or token replacement during enrollment discards the response and prevents the next POST',async()=>{
 for(const next of [{user:{id:other,email_confirmed_at:'2026-10-27'},access_token:'synthetic-link-bearer'},{user:{id,email_confirmed_at:'2026-10-27'},access_token:'replacement'}]){
  let resolve;const f=fixture(()=>new Promise(r=>resolve=r));const pending=registerConfirmationDevice(f.options);
  await new Promise(r=>setImmediate(r));f.setSession(next);resolve(json({result:'DEVICE_COOKIE_PREPARED'}));
  await assert.rejects(pending,{code:'session_changed'});assert.equal(f.calls.length,1);
 }
});
test('HTML, oversized responses, nonpersistent success and service errors cannot claim browser trust',async()=>{
 for(const make of [()=>new Response('<html>fallback</html>'),()=>json({result:'TRUSTED',persistent:true,padding:'x'.repeat(5000)}),()=>json({result:'TRUSTED',persistent:false}),()=>json({result:'UNAVAILABLE',secret:'PRIVATE'},503)]){
  const f=fixture(make);await assert.rejects(registerConfirmationDevice(f.options),{code:'device_trust_unavailable'});assert.equal(f.calls.length,1);
 }
});
test('the actual confirmation page completes both enrollment steps before presenting manual sign-in',async()=>{
 const h=page('confirm',{prepareDeviceCookie:true});await h.ready();
 assert.equal(h.calls.filter(x=>x==='gateway:confirm-device').length,2);
 assert.equal(h.nodes.securityMessage.textContent,'This browser is trusted. You can now sign in.');
 assert.equal(h.nodes.securityCancel.disabled,false);assert.equal(h.nodes.securityTrustRetry.hidden,true);
 assert.equal(h.nodes.securityEmailVerification.children.length,0);assert(!h.calls.includes('gateway:begin'));
 h.nodes.securityCancel.events.click();await h.ready();assert.equal(h.navigations.at(-1),origin+'/app.html?auth=manual');
});
test('a failed trust save has a retry that preserves the consumed-link session and never sends another code',async()=>{
 const options={failDeviceTrust:true},h=page('confirm',options);await h.ready();
 assert.equal(h.nodes.securityTrustRetry.hidden,false);assert.equal(h.nodes.securityCancel.disabled,false);
 assert.equal(h.nodes.securityMessage.textContent,"Email confirmed. We couldn't save this browser. Try again.");
 const linkAdoptions=h.calls.filter(x=>x==='isolated:adopt').length;
 options.failDeviceTrust=false;h.nodes.securityTrustRetry.events.click();await h.ready();
 assert.equal(h.nodes.securityTrustRetry.hidden,true);assert.equal(h.nodes.securityMessage.textContent,'This browser is trusted. You can now sign in.');
 assert.equal(h.calls.filter(x=>x==='isolated:adopt').length,linkAdoptions);
 assert(!h.calls.includes('gateway:begin'));assert(!h.calls.includes('normal:adopt'));
});
