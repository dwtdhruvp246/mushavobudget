import test from 'node:test';
import assert from 'node:assert/strict';
import {securityPageFixture as page} from './helpers/security-page.mjs';
test('real page module rejects a flag-only recovery without showing a password form',async()=>{
 const h=page('recover',{noTokens:true});await h.ready();assert.equal(h.nodes.securityPassword.hidden,true);assert.match(h.nodes.securityMessage.textContent,/link.*unavailable/);assert(!h.calls.includes('normal:adopt'));
});
test('real recovery page saves before explicit continuation, fresh proof and account adoption',async()=>{
 const h=page();await h.ready();assert.equal(h.nodes.securityPassword.hidden,false);assert.equal(h.nodes.securityContinue.hidden,true);assert.match(h.nodes.securityIdentity.textContent,/owner@example.invalid/);
 await h.save();assert.equal(h.nodes.securityContinue.hidden,true);assert(!h.calls.includes('has_my_unfinished_admin_invitation'));assert.equal(h.navigations.length,0);
 await h.code();assert.equal(h.nodes.securityContinue.hidden,false);h.nodes.securityOpen.events.click();await h.ready();assert(!h.calls.includes('normal:adopt'));
 await h.open();assert.match(h.navigations.at(-1),/app.html$/);assert(!h.calls.includes('isolated:logout'));assert(h.calls.includes('isolated:stop-refresh'));
});
test('real confirmation page requires acknowledgement and code without a password update',async()=>{
 const h=page('confirm');await h.ready();assert.equal(h.nodes.securityContinue.hidden,false);assert.equal(h.nodes.securityPassword.hidden,true);assert(!h.calls.some(x=>x.endsWith(':password')));await h.open();assert(!h.calls.includes('normal:adopt'));await h.code();assert(h.calls.includes('normal:adopt'));
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
