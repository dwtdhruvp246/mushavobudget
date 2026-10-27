import test from 'node:test';
import assert from 'node:assert/strict';
import {securityPageFixture as page} from './helpers/security-page.mjs';
test('real page module rejects a flag-only recovery without showing a password form',async()=>{
 const h=page('recover',{noTokens:true});await h.ready();assert.equal(h.nodes.securityPassword.hidden,true);assert.match(h.nodes.securityMessage.textContent,/link.*unavailable/);assert(!h.calls.includes('normal:adopt'));
});
test('real recovery page automatically adopts and opens the app only after password save and fresh proof',async()=>{
 const h=page();await h.ready();assert.equal(h.nodes.securityPassword.hidden,false);assert.equal(h.nodes.securityContinue.hidden,true);assert.match(h.nodes.securityIdentity.textContent,/owner@example.invalid/);
 await h.save();assert.equal(h.nodes.securityContinue.hidden,true);assert(!h.calls.includes('has_my_unfinished_admin_invitation'));assert.equal(h.navigations.length,0);
 await h.code();await h.ready();assert.equal(h.nodes.securityContinue.hidden,true);assert.equal(h.nodes.securityAcknowledge.checked,false);
 assert.equal(h.navigations.length,1);assert.match(h.navigations.at(-1),/app.html$/);assert(!h.calls.includes('isolated:logout'));assert(h.calls.includes('isolated:stop-refresh'));
 assert.equal(h.calls.filter(x=>x==='normal:adopt').length,1);
});
test('actual recovery page rejects seven characters then saves an eight-character password without premature adoption or email',async()=>{
 const h=page();await h.ready();
 const submit=()=>h.nodes.securityPassword.events.submit({preventDefault(){}});
 h.nodes.securityNewPassword.value='Seven77';h.nodes.securityConfirmPassword.value='Seven77';submit();await h.ready();
 assert.match(h.nodes.securityMessage.textContent,/at least 8 characters/);assert(!h.calls.includes('isolated:password'));
 h.nodes.securityNewPassword.value='Eight888';h.nodes.securityConfirmPassword.value='Eight888';submit();await h.ready();
 assert.equal(h.calls.filter(x=>x==='isolated:password').length,1);assert(!h.calls.includes('normal:adopt'));
 assert(!h.calls.includes('gateway:begin'));assert.equal(h.navigations.length,0);
});
test('real confirmation page verifies the link without mounting a code screen or adopting an app session',async()=>{
 const h=page('confirm');await h.ready();
 assert.equal(h.nodes.securityTitle.textContent,'Email confirmed');
 assert.match(h.nodes.securityMessage.textContent,/You can now sign in/);
 assert.match(h.nodes.securityIdentity.textContent,/owner@example.invalid/);
 for(const name of ['securityContinue','securityPassword','securityEmailVerification','securityDeviceControls'])assert.equal(h.nodes[name].hidden,true);
 assert.equal(h.nodes.securityCancel.textContent,'Go to sign in');
 assert.equal(h.nodes.securityEmailVerification.children.length,0);
 assert.equal(h.calls.filter(x=>x==='gateway:confirm-device').length,1);
 assert(!h.calls.some(x=>(x.startsWith('gateway:')&&x!=='gateway:confirm-device')||x.endsWith(':password')||x==='normal:adopt'||x==='email_gate_current_session_verified'));
 assert(h.clients.every(client=>client.kind==='isolated'));
 assert.equal(h.navigations.length,0);
});
test('confirmation success returns to manual sign-in after isolated logout without touching an app session',async()=>{
 const h=page('confirm');await h.ready();
 h.nodes.securityCancel.events.click();await h.ready();
 assert.equal(h.calls.filter(call=>call==='isolated:logout').length,1);
 assert.equal(h.navigations.at(-1),'https://mushavo-budget-staging.pages.dev/app.html?auth=manual');
 assert(!h.calls.some(call=>(call.startsWith('gateway:')&&call!=='gateway:confirm-device')||call==='normal:adopt'||call==='normal:logout'));
});
test('failed confirmation-session cleanup stays on the page and can retry without sending a code',async()=>{
 const h=page('confirm');await h.ready();
 const original=h.clients[0].auth.signOut;let attempts=0;
 h.clients[0].auth.signOut=async()=>++attempts===1?{error:{code:'network_error'}}:original();
 h.nodes.securityCancel.events.click();await h.ready();assert.equal(h.navigations.length,0);
 assert.match(h.nodes.securityMessage.textContent,/try again/);
 h.nodes.securityCancel.events.click();await h.ready();
 assert.equal(h.navigations.at(-1),'https://mushavo-budget-staging.pages.dev/app.html?auth=manual');
 assert(!h.calls.some(call=>(call.startsWith('gateway:')&&call!=='gateway:confirm-device')||call==='normal:adopt'));
});
test('confirmation intent alone or an expired link never displays verified success or mounts a code screen',async()=>{
 for(const options of [{noTokens:true},{linkError:{code:'otp_expired'}}]){
  const h=page('confirm',options);await h.ready();
  assert.notEqual(h.nodes.securityTitle.textContent,'Email confirmed');
  assert.match(h.nodes.securityMessage.textContent,/link.*unavailable/);
  assert.equal(h.nodes.securityContinue.hidden,true);
  assert.equal(h.nodes.securityEmailVerification.children.length,0);
  assert(!h.calls.some(call=>call.startsWith('gateway:')||call==='normal:adopt'));
 }
});
test('a legacy confirmation Continue event returns to sign-in without an application verification attempt',async()=>{
 const h=page('confirm');await h.ready();await h.open();
 assert.equal(h.navigations.at(-1),'https://mushavo-budget-staging.pages.dev/app.html?auth=manual');
 assert(!h.calls.some(call=>(call.startsWith('gateway:')&&call!=='gateway:confirm-device')||call==='email_gate_current_session_verified'||call==='normal:adopt'));
});
test('unfinished Admin recipient keeps an explicit personal-signup choice after password and fresh proof',async()=>{
 const h=page('recover',{unfinished:true});await h.ready();await h.save();await h.code();assert.equal(h.nodes.securitySelfSignup.hidden,false);assert.equal(h.nodes.securityContinue.hidden,true);assert(!h.calls.some(x=>/complete_|cancel.*invitation/.test(x)));assert.equal(h.navigations.length,0);
});
test('request page uses generic feedback and one bounded local cooldown',async()=>{
 const h=page('request-recovery');await h.ready();let requests=0;h.clients[0].auth.resetPasswordForEmail=async()=>{requests++;return{error:{code:'user_not_found',message:'synthetic-sensitive'}};};h.nodes.securityEmail.value='missing@example.test';h.nodes.securityRequest.events.submit({preventDefault(){}});await h.ready();assert.match(h.nodes.securityMessage.textContent,/If your account/);assert.doesNotMatch(h.nodes.securityMessage.textContent,/synthetic-sensitive/);
 h.nodes.securityRequest.events.submit({preventDefault(){}});await h.ready();assert.equal(requests,1);assert.match(h.nodes.securityMessage.textContent,/Too many attempts/);
});
test('confirmation resend uses the isolated client and dedicated confirmation callback',async()=>{
 const h=page('request-confirmation');await h.ready();let settings;h.clients[0].auth.resend=async args=>{settings=args;return{error:null};};h.nodes.securityEmail.value='controlled@example.test';h.nodes.securityRequest.events.submit({preventDefault(){}});await h.ready();assert.equal(new URL(settings.options.emailRedirectTo).searchParams.get('flow'),'confirm');assert(!h.calls.includes('normal:adopt'));
});
test('change page snapshots identity and clears the password form on account switch',async()=>{
 const h=page('change');await h.ready();assert(h.clients.some(c=>c.kind==='snapshot'));assert.equal(h.nodes.securityPassword.hidden,false);
 h.clients.find(c=>c.kind==='normal').emit('SIGNED_IN',{user:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},access_token:'foreign'});await h.ready();assert.equal(h.nodes.securityPassword.hidden,true);assert.match(h.nodes.securityMessage.textContent,/active account changed/);
 await h.save();assert(!h.calls.some(x=>x.endsWith(':password')));
});
test('a rejected recovery code keeps verification open without adopting or navigating',async()=>{
 const h=page();await h.ready();await h.save();h.verifyResult('CODE_REJECTED');await h.code();await h.ready();
 assert.equal(h.nodes.securityEmailVerification.hidden,false);assert.equal(h.nodes.securityContinue.hidden,true);assert.equal(h.navigations.length,0);assert(!h.calls.includes('normal:adopt'));assert(!h.calls.includes('has_my_unfinished_admin_invitation'));
 assert(h.all().some(n=>/code was not accepted/.test(n.textContent||'')));
});
test('gateway code success without current server proof cannot automatically open recovery',async()=>{
 const h=page();await h.ready();await h.save();h.proof({data:false,error:null});await h.code();await h.ready();
 assert.equal(h.navigations.length,0);assert(!h.calls.includes('normal:adopt'));assert(!h.calls.includes('has_my_unfinished_admin_invitation'));
});
test('an account or bearer change while recovery waits for its code cancels automatic sign-in',async()=>{
 for(const user of [{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',email_confirmed_at:'today'},{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email_confirmed_at:'today'}]){
  const h=page();await h.ready();await h.save();h.clients.find(c=>c.kind==='isolated').emit('SIGNED_IN',{user,access_token:'replacement',refresh_token:'replacement-refresh'});await h.ready();
  assert.equal(h.navigations.length,0);assert(!h.calls.includes('normal:adopt'));assert.match(h.nodes.securityMessage.textContent,/active account changed/);
 }
});
test('failed automatic session adoption can retry without another password save or email',async()=>{
 const h=page();await h.ready();await h.save();h.normalAdoptError({code:'network_error'});await h.code();await h.ready();
 assert.equal(h.navigations.length,0);assert.equal(h.nodes.securityContinue.hidden,true);assert.equal(h.nodes.securityResume.hidden,false);assert.match(h.nodes.securityMessage.textContent,/try again/);
 h.normalAdoptError(null);h.nodes.securityResume.events.click();await h.ready();await h.ready();
 assert.equal(h.navigations.length,1);assert.match(h.navigations[0],/app.html$/);assert.equal(h.calls.filter(x=>x==='isolated:password').length,1);assert.equal(h.calls.filter(x=>x==='gateway:begin').length,1);
});
test('failed recovery destination lookup cannot adopt until a successful proof-checked retry',async()=>{
 const h=page();await h.ready();await h.save();h.unfinishedError({code:'network_error'});await h.code();await h.ready();assert.equal(h.navigations.length,0);assert(!h.calls.includes('normal:adopt'));
 h.unfinishedError(null);h.nodes.securityResume.events.click();await h.ready();await h.ready();assert.equal(h.navigations.length,1);
});
test('Business invitation verification retains its explicit account choice',async()=>{
 const h=page('business-new');await h.ready();await h.code();await h.ready();await h.save();await h.code();await h.ready();assert.equal(h.nodes.securityContinue.hidden,false);assert.equal(h.navigations.length,0);assert(!h.calls.includes('normal:adopt'));
 h.nodes.securityOpen.events.click();await h.ready();assert(!h.calls.includes('normal:adopt'));await h.open();assert.equal(h.navigations.length,1);assert.match(h.navigations[0],/business.html/);
});
test('a duplicate verification event does not adopt or navigate a recovered account twice',async()=>{
 const h=page();await h.ready();await h.save();await h.code();await h.ready();const form=h.all().find(n=>n.tag==='form');form.events.submit({preventDefault(){}});await h.ready();
 assert.equal(h.navigations.length,1);assert.equal(h.calls.filter(x=>x==='normal:adopt').length,1);
});
