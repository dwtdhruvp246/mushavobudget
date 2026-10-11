import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as security from '../auth-security.js';

const source=await readFile(new URL('../auth-flows.js',import.meta.url),'utf8');
const user={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'controlled@example.test',email_confirmed_at:'2026-10-11T00:00:00Z'};
async function page(flow='recover',options={}) {
  const nodes=new Map(),calls=[],navigations=[],replaced=[],storage=new Map();let normalHandler;
  function node(selector) {if(!nodes.has(selector))nodes.set(selector,{hidden:true,value:'',checked:false,disabled:false,textContent:'',handlers:new Map(),addEventListener(name,fn){this.handlers.set(name,fn);},reset(){node('#securityNewPassword').value='';node('#securityConfirmPassword').value='';node('#securityNonce').value='';node('#securityCurrentPassword').value='';}});return nodes.get(selector);}
  function client(kind){let active=user;return {auth:{
    async getSession(){calls.push([kind,'getSession']);return {data:{session:{user:active,access_token:'synthetic-access',refresh_token:'synthetic-refresh'}}};},
    async getUser(){calls.push([kind,'getUser']);return {data:{user:active}};},
    async setSession(){calls.push([kind,'setSession']);active=user;return {data:{session:{user:active,access_token:'synthetic-access',refresh_token:'synthetic-refresh'},user:active}};},
    async updateUser(args){calls.push([kind,'updateUser',args]);return {error:options.updateError};},
    async resetPasswordForEmail(email,args){calls.push([kind,'reset',email,args]);return {error:options.requestError};},
    async resend(args){calls.push([kind,'resend',args]);return {error:options.requestError};},
    async reauthenticate(){calls.push([kind,'reauthenticate']);return {error:null};},
    onAuthStateChange(handler){normalHandler=handler;},
    stopAutoRefresh(){calls.push([kind,'stopRefresh']);},
    async signOut(){calls.push([kind,'signOut']);return {error:null};}
  },async rpc(name){return {data:name==='has_my_unfinished_admin_invitation'?Boolean(options.unfinished):[]};}};}
  let count=0;const context=vm.createContext({...security,URL,URLSearchParams,Date,console:{warn(){},error(){}},document:{querySelector:node,querySelectorAll:()=>[node('#securityOpen'),node('#securityCancel')]},
    window:{location:{href:'https://app.test/auth.html?flow='+flow+(options.noTokens||flow.startsWith('request-')||flow==='change'?'':'#access_token=synthetic-access&refresh_token=synthetic-refresh&type='+ (flow==='confirm'?'signup':'recovery')),replace:value=>navigations.push(value)},history:{replaceState(_state,_title,value){replaced.push(value);}},sessionStorage:{removeItem:key=>storage.delete(key)},MUSHAVO_BUDGET_CONFIG:{supabaseUrl:'https://project.supabase.co',supabasePublishableKey:'sb_publishable_synthetic'}},
    createClient(_url,_key,settings){const kind=++count===1?'isolated':settings.auth.persistSession===false?'snapshot':'normal';calls.push([kind,'create',settings]);return client(kind);}});
  vm.runInContext(source.replace(/^import .*;\s*$/mg,'').replace('operation(init);','globalThis.started = operation(init);'),context);
  await context.started;
  async function event(selector,name='click'){const handler=node(selector).handlers.get(name);assert.ok(handler);handler({preventDefault(){}});for(let i=0;i<50&&vm.runInContext('busy',context);i++)await Promise.resolve();assert.equal(vm.runInContext('busy',context),false,'page operation should finish');}
  return {node,calls,navigations,replaced,event,accountChange:session=>normalHandler('SIGNED_IN',session)};
}
test('real page module rejects a flag-only recovery without showing a password form',async()=>{
  const h=await page('recover',{noTokens:true});assert.equal(h.node('#securityPassword').hidden,true);assert.match(h.node('#securityMessage').textContent,/link.*unavailable/);assert.equal(h.calls.some(c=>c[0]==='normal'),false);
});
test('real recovery page saves before showing explicit continuation and never auto-adopts',async()=>{
  const h=await page();assert.equal(h.node('#securityPassword').hidden,false);assert.equal(h.node('#securityContinue').hidden,true);assert.match(h.node('#securityIdentity').textContent,/controlled@example.test/);
  h.node('#securityNewPassword').value='correct-new-password';h.node('#securityConfirmPassword').value='correct-new-password';await h.event('#securityPassword','submit');assert.equal(h.node('#securityContinue').hidden,false);assert.equal(h.navigations.length,0);
  await h.event('#securityOpen');assert.equal(h.calls.some(c=>c[0]==='normal'),false);
  h.node('#securityAcknowledge').checked=true;await h.event('#securityOpen');assert.equal(h.navigations.at(-1),'https://app.test/app.html');assert.equal(h.calls.some(c=>c[0]==='isolated'&&c[1]==='signOut'),false);assert.equal(h.calls.some(c=>c[0]==='isolated'&&c[1]==='stopRefresh'),true);
});
test('real confirmation page shows continuation without a password update',async()=>{
  const h=await page('confirm');assert.equal(h.node('#securityContinue').hidden,false);assert.equal(h.node('#securityPassword').hidden,true);assert.equal(h.calls.some(c=>c[1]==='updateUser'),false);
});
test('unfinished Admin recipient keeps an explicit personal-signup choice without silent cancellation',async()=>{
  const h=await page('recover',{unfinished:true});assert.equal(h.node('#securitySelfSignup').hidden,false);assert.equal(h.node('#securityContinue').hidden,true);assert.equal(h.calls.some(c=>c[1]==='updateUser'),false);assert.equal(h.navigations.length,0);
});
test('request page uses generic feedback and one bounded local cooldown',async()=>{
  const h=await page('request-recovery',{requestError:{code:'user_not_found',message:'synthetic-sensitive'}});h.node('#securityEmail').value='missing@example.test';await h.event('#securityRequest','submit');assert.match(h.node('#securityMessage').textContent,/If your account/);assert.doesNotMatch(h.node('#securityMessage').textContent,/synthetic-sensitive/);
  await h.event('#securityRequest','submit');assert.equal(h.calls.filter(c=>c[1]==='reset').length,1);assert.match(h.node('#securityMessage').textContent,/Too many attempts/);
});
test('confirmation resend uses the isolated client and dedicated confirmation callback',async()=>{
  const h=await page('request-confirmation');h.node('#securityEmail').value='controlled@example.test';await h.event('#securityRequest','submit');const call=h.calls.find(c=>c[1]==='resend');assert.equal(call[0],'isolated');assert.equal(new URL(call[2].options.emailRedirectTo).searchParams.get('flow'),'confirm');
});
test('change page snapshots identity without sharing normal storage and clears form on account switch',async()=>{
  const h=await page('change');assert.ok(h.calls.find(c=>c[0]==='snapshot'&&c[1]==='create'&&c[2].auth.persistSession===false));assert.equal(h.node('#securityPassword').hidden,false);
  h.accountChange({user:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}});assert.equal(h.node('#securityPassword').hidden,true);assert.match(h.node('#securityMessage').textContent,/active account changed/);
  h.node('#securityNewPassword').value='correct-new-password';h.node('#securityConfirmPassword').value='correct-new-password';await h.event('#securityPassword','submit');assert.equal(h.calls.some(c=>c[1]==='updateUser'),false);
});
