import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {safeAuthMessage,authError,callbackUrl} from '../auth-security.js';

const source=fs.readFileSync(new URL('../auth-flows.js',import.meta.url),'utf8');
const operation=source.slice(source.indexOf('async function operation('),source.indexOf('function prepareEmailEntry('));
const handler=source.slice(source.indexOf("$('#securityRequest').addEventListener("),source.indexOf("$('#securityPassword').addEventListener("));
const generic='If your account can receive this link, check your inbox for the newest email. Wait a minute before requesting another.';
const retry='The request could not finish. Check your connection and try again.';
const rate='Too many attempts. Wait before trying again.';
function page({flow='request-confirmation',respond=async()=>({error:null})}={}) {
 let clock=1000000;
 const calls=[],tasks=[],button={disabled:false};
 const email={value:' Controlled@Example.test '},message={textContent:''};
 const form={hidden:false,addEventListener(name,fn){this[name]=fn;}};
 const nodes={'#securityRequest':form,'#securityEmail':email};
 const sdk=async(name,args)=>{calls.push({name,args:structuredClone(args)});return respond(name,args);};
 const context=vm.createContext({
  busy:false,cooldownUntil:0,flow,Date:{now:()=>clock},
  isolated:{auth:{
   resend:args=>sdk('resend',args),
   resetPasswordForEmail:(address,options)=>sdk('resetPasswordForEmail',{address,options})
  }},
  window:{location:{href:'https://mushavo-budget-staging.pages.dev/auth.html?flow='+flow}},
  document:{querySelectorAll:()=>[button]},$:selector=>nodes[selector],
  message:value=>{message.textContent=value;},safeAuthMessage,authError,callbackUrl
 });
 vm.runInContext(operation,context);
 const run=context.operation;
 context.operation=action=>{const task=run(action);tasks.push(task);return task;};
 vm.runInContext(handler,context);
 return {
  calls,button,email,form,message,
  advance(ms){clock+=ms;},
  async submit(){form.submit({preventDefault(){}});await tasks.at(-1);}
 };
}
test('confirmation request uses the exact public callback and neutral success guidance',async()=>{
 const h=page();await h.submit();
 assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].name,'resend');
 assert.deepEqual(h.calls[0].args,{type:'signup',email:'controlled@example.test',options:{emailRedirectTo:'https://mushavo-budget-staging.pages.dev/auth.html?flow=confirm'}});
 assert.equal(h.message.textContent,generic);
 assert.equal(h.button.disabled,false);
});
test('account-state errors retain the same neutral response without revealing provider text',async()=>{
 for(const [status,code] of [[400,'user_not_found'],[400,'email_exists'],[400,'email_not_confirmed'],[422,'validation_failed']]){
  const h=page({respond:async()=>({error:{status,code,message:'PRIVATE_PROVIDER_DETAIL'}})});
  await h.submit();assert.equal(h.message.textContent,generic);
  assert(!h.message.textContent.includes('PRIVATE_PROVIDER_DETAIL'));
 }
});
test('SDK network and server failures show retry guidance with the form and address retained',async()=>{
 for(const error of [
  {name:'AuthRetryableFetchError',status:0,message:'PRIVATE_NETWORK_DETAIL'},
  {name:'AuthRetryableFetchError',message:'PRIVATE_NETWORK_DETAIL'},
  {status:503,code:'unexpected_failure',message:'PRIVATE_SERVER_DETAIL'},
  {status:500,message:'PRIVATE_SERVER_DETAIL'}
 ]){
  const h=page({respond:async()=>({error})});await h.submit();
  assert.equal(h.message.textContent,retry);
  assert.equal(h.form.hidden,false);assert.equal(h.email.value,' Controlled@Example.test ');
  assert.equal(h.button.disabled,false);assert.equal(h.calls.length,1);
  assert(!h.message.textContent.includes('PRIVATE_'));
 }
});
test('thrown transport errors are safely displayed without an automatic resend',async()=>{
 const h=page({respond:async()=>{throw new TypeError('PRIVATE_FETCH_DETAIL');}});
 await h.submit();assert.equal(h.message.textContent,retry);assert.equal(h.calls.length,1);assert.equal(h.button.disabled,false);
});
test('provider rate status and supported rate codes retain the existing wait message',async()=>{
 for(const error of [{status:429,message:'PRIVATE_RATE_DETAIL'},{status:400,code:'over_email_send_rate_limit',message:'PRIVATE_RATE_DETAIL'}]){
  const h=page({respond:async()=>({error})});await h.submit();
  assert.equal(h.message.textContent,rate);assert.equal(h.calls.length,1);assert.equal(h.button.disabled,false);
 }
});
test('cooldown blocks another request after failure, then permits an explicit later retry',async()=>{
 let count=0;const h=page({respond:async()=>++count===1?{error:{status:0,name:'AuthRetryableFetchError'}}:{error:null}});
 await h.submit();assert.equal(h.message.textContent,retry);
 await h.submit();assert.equal(h.message.textContent,rate);assert.equal(h.calls.length,1);
 h.advance(60000);await h.submit();assert.equal(h.message.textContent,generic);assert.equal(h.calls.length,2);
});
test('recovery request preserves its callback and gains the same operational failure handling',async()=>{
 const h=page({flow:'request-recovery'});await h.submit();
 assert.equal(h.calls[0].name,'resetPasswordForEmail');
 assert.deepEqual(h.calls[0].args,{address:'controlled@example.test',options:{redirectTo:'https://mushavo-budget-staging.pages.dev/auth.html?flow=recover'}});
 assert.equal(h.message.textContent,generic);
 const failed=page({flow:'request-recovery',respond:async()=>({error:{status:503}})});
 await failed.submit();assert.equal(failed.message.textContent,retry);assert.equal(failed.calls.length,1);
});
test('a concurrent submission stays bounded and re-enables the button when complete',async()=>{
 let release;const waiting=new Promise(resolve=>{release=resolve;});
 const h=page({respond:()=>waiting});
 const first=h.submit();assert.equal(h.button.disabled,true);
 await h.submit();assert.equal(h.calls.length,1);
 release({error:null});await first;assert.equal(h.button.disabled,false);
});
test('an empty address makes no Auth request',async()=>{
 const h=page();h.email.value=' ';await h.submit();assert.equal(h.calls.length,0);assert.equal(h.button.disabled,false);
});

