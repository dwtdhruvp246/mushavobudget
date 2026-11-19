import test from 'node:test';
import assert from 'node:assert/strict';
import {securityPageFixture as page} from './helpers/password-page.mjs';
const valid=()=>({data:{contract:1,policy:'PASSWORD_ONLY_ALL_USERS',session_valid:true,admin_authorized:false,role:null},error:null});
test('flag-only and expired recovery links cannot reveal password forms or adopt a session',async()=>{
 for(const options of [{noTokens:true},{linkError:{code:'otp_expired'}}]){
  const h=page('recover',options);await h.ready();assert.equal(h.nodes.securityPassword.hidden,true);assert.equal(h.navigations.length,0);assert(!h.calls.includes('normal:adopt'));
 }
});
test('confirmed signup finishes with sign-in navigation and no trust registration or code request',async()=>{
 const h=page('confirm');await h.ready();assert.equal(h.nodes.securityTitle.textContent,'Email confirmed');assert.match(h.nodes.securityMessage.textContent,/You can now sign in/);assert.equal(h.nodes.securityCancel.textContent,'Go to sign in');assert.equal(h.nodes.securitySessionStatus.children.length,0);assert(!h.calls.includes('app_session_status'));assert(!h.calls.includes('UNEXPECTED_GATEWAY_REQUEST'));
 h.nodes.securityCancel.events.click();await h.ready();assert.match(h.navigations.at(-1),/app.html\?auth=manual$/);assert(!h.calls.includes('normal:logout'));
});
test('a failed confirmation-session signout stays visible and retries without sending mail',async()=>{
 const h=page('confirm');await h.ready();const logout=h.clients[0].auth.signOut;let tries=0;h.clients[0].auth.signOut=async()=>++tries===1?{error:{code:'network_error'}}:logout();h.nodes.securityCancel.events.click();await h.ready();assert.equal(h.navigations.length,0);h.nodes.securityCancel.events.click();await h.ready();assert.equal(h.navigations.length,1);assert(!h.calls.includes('UNEXPECTED_GATEWAY_REQUEST'));
});
test('recovery saves a valid password and opens the app automatically without an extra code',async()=>{
 const h=page();await h.ready();assert.equal(h.nodes.securityPassword.hidden,false);await h.save();await h.ready();assert.equal(h.calls.filter(x=>x==='isolated:password').length,1);assert.equal(h.calls.filter(x=>x==='normal:adopt').length,1);assert.match(h.navigations.at(-1),/app.html$/);assert(!h.calls.includes('UNEXPECTED_GATEWAY_REQUEST'));assert(!h.calls.includes('isolated:logout'));
});
test('short and mismatched recovery passwords are rejected before a password write',async()=>{
 const h=page();await h.ready();const submit=()=>h.nodes.securityPassword.events.submit({preventDefault(){}});
 h.nodes.securityNewPassword.value='Seven77';h.nodes.securityConfirmPassword.value='Seven77';submit();await h.ready();assert.match(h.nodes.securityMessage.textContent,/at least 8/);assert(!h.calls.includes('isolated:password'));
 h.nodes.securityNewPassword.value='Eight888';h.nodes.securityConfirmPassword.value='Different';submit();await h.ready();assert.match(h.nodes.securityMessage.textContent,/do not match/);assert(!h.calls.includes('isolated:password'));
});
test('unfinished Admin invitation after recovery still needs the established explicit setup choice',async()=>{
 const h=page('recover',{unfinished:true});await h.ready();await h.save();await h.ready();assert.equal(h.nodes.securitySelfSignup.hidden,false);assert.equal(h.navigations.length,0);assert(!h.calls.includes('normal:adopt'));
});
test('server status denial cannot transfer a recovered account and can retry after status becomes valid',async()=>{
 const h=page();await h.ready();h.status({data:{...valid().data,session_valid:false},error:null});await h.save();await h.ready();assert.equal(h.navigations.length,0);assert.equal(h.nodes.securitySessionStatus.hidden,false);
 h.status(null);const retry=h.all().find(n=>n.textContent==='Try again');retry.events.click();await h.ready();await h.ready();assert.equal(h.navigations.length,1);assert(!h.calls.includes('UNEXPECTED_GATEWAY_REQUEST'));
});
test('failed normal-session adoption retries without a second password write or email',async()=>{
 const h=page();await h.ready();h.normalAdoptError({code:'network_error'});await h.save();await h.ready();assert.equal(h.navigations.length,0);h.normalAdoptError(null);h.nodes.securityResume.events.click();await h.ready();assert.equal(h.navigations.length,1);assert.equal(h.calls.filter(x=>x==='isolated:password').length,1);assert(!h.calls.includes('UNEXPECTED_GATEWAY_REQUEST'));
});
test('Business invitation keeps explicit account acknowledgment and never accepts membership on link open',async()=>{
 const h=page('business-existing');await h.ready();assert.equal(h.nodes.securityContinue.hidden,false);assert.equal(h.navigations.length,0);await h.open();assert.match(h.navigations.at(-1),/business.html\?invitation=/);assert(!h.calls.includes('UNEXPECTED_GATEWAY_REQUEST'));assert(!h.calls.some(x=>x==='accept_business_invitation'));
});
test('account settings and old devices URLs show password management without trust controls',async()=>{
 for(const flow of ['account','devices']){
  const h=page(flow,{noTokens:true});await h.ready();assert.equal(h.nodes.securityAccountControls.hidden,false);assert.equal(h.nodes.securityTitle.textContent,'Account settings');assert(!h.calls.includes('UNEXPECTED_GATEWAY_REQUEST'));assert.equal(h.all().some(n=>n.tag==='input'),false);
  h.nodes.securityCancel.events.click();await h.ready();assert.match(h.navigations.at(-1),/app.html$/);assert(!h.calls.includes('normal:logout'));
 }
});
test('password change remains bound to the displayed account and preserves provider-required secure-change inputs',async()=>{
 const h=page('change');await h.ready();h.nodes.securityCurrentPassword.value='CURRENT_PRIVATE';h.nodes.securityNonce.value='NONCE_PRIVATE';await h.save();await h.ready();assert(h.calls.includes('snapshot:password'));assert.match(h.nodes.securityMessage.textContent,/Password changed/);assert(!h.calls.includes('UNEXPECTED_GATEWAY_REQUEST'));
});
test('an account switch while changing a password clears the form and prevents a late write',async()=>{
 const h=page('change');await h.ready();const normal=h.clients.find(c=>c.kind==='normal');normal.emit('SIGNED_IN',{user:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},access_token:'OTHER'});await h.ready();assert.equal(h.nodes.securityPassword.hidden,true);await h.save();assert(!h.calls.includes('snapshot:password'));
});
test('recovery-link request and confirmation resend retain generic feedback and bounded local cooldown',async()=>{
 for(const flow of ['request-recovery','request-confirmation']){
  const h=page(flow,{noTokens:true});await h.ready();h.nodes.securityEmail.value='owner@example.invalid';h.nodes.securityRequest.events.submit({preventDefault(){}});await h.ready();assert.match(h.nodes.securityMessage.textContent,/If your account can receive this link/);h.nodes.securityRequest.events.submit({preventDefault(){}});await h.ready();assert.match(h.nodes.securityMessage.textContent,/Wait/);assert(!h.calls.includes('UNEXPECTED_GATEWAY_REQUEST'));
 }
});
