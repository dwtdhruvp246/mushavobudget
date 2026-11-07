import test from 'node:test';
import assert from 'node:assert/strict';
import {checkSameUserRefresh} from '../scripts/lib/batch-w-same-user-refresh.mjs';
const id='actor-test',sid='session-test',secret='PRIVATE-CANARY';
const token=(sub=id,session_id=sid,rev=1)=>'header.'+Buffer.from(JSON.stringify({sub,session_id,rev})).toString('base64url')+'.'+secret;
const session=(rev=1,user=id,session_id=sid)=>({user:{id:user},access_token:token(user,session_id,rev),refresh_token:secret});
function fixture(overrides={}) {
 const calls=[];
 const auth={
  async getSession(){calls.push('getSession');return {data:{session:session()}};},
  async refreshSession(){calls.push('refreshSession');return {data:{session:session(2)}};},
  async getUser(jwt){calls.push('getUser');assert.equal(jwt,token(id,sid,2));return {data:{user:{id}}};},
  ...overrides
 };
 const input={origin:'https://mushavo-budget-staging.pages.dev',ready:true,
  config:{supabaseUrl:'https://dczlddwbtgvfdujgcitb.supabase.co',supabasePublishableKey:'public-key'},
  async loadSDK(){calls.push('loadSDK');return {createClient(url,key,options){
   assert.deepEqual(options.auth,{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false});
   return {auth};
  }};}
 };
 return {input,calls,run:()=>checkSameUserRefresh(input)};
}
const privateSafe=r=>{const s=JSON.stringify(r);assert(!s.includes(secret));assert(!s.includes(id));assert(!s.includes(sid));};
test('real-check coordinator requests one refresh and verifies same server user and session without logging private data',async()=>{
 const f=fixture(),r=await f.run();assert.equal(r.result,'PASS_REFRESH_UI_CHECK_PENDING');
 assert.deepEqual(f.calls,['loadSDK','getSession','refreshSession','getUser']);assert.equal(r.explicit_refresh_calls,1);
 assert.equal(r.automatic_timer_observed,false);privateSafe(r);
});
test('wrong origin, non-dashboard, wrong project or missing key stop before SDK/network',async()=>{
 for(const change of [{origin:'https://other.test'},{ready:false},{config:{supabaseUrl:'https://wrong.test',supabasePublishableKey:'public'}},{config:{supabaseUrl:'https://dczlddwbtgvfdujgcitb.supabase.co'}}]){
  const f=fixture();Object.assign(f.input,change);const r=await f.run();assert.equal(r.result,'REVIEW_REQUIRED');assert.equal(f.calls.length,0);privateSafe(r);
 }
});
test('missing or invalid stored session never requests refresh',async()=>{
 for(const response of [{data:{session:null}},{error:{message:secret}},{data:{session:{user:{id},access_token:'bad'}}}]){
  const f=fixture({getSession:async()=>response}),r=await f.run();assert.equal(r.explicit_refresh_calls,0);assert.equal(r.result,'REVIEW_REQUIRED');privateSafe(r);
 }
});
test('a refresh failure is not retried and never reports a pass',async()=>{
 const f=fixture({refreshSession:async()=>({error:{message:secret}})}),r=await f.run();
 assert.equal(r.result,'REVIEW_REQUIRED');assert.equal(r.explicit_refresh_calls,1);assert.equal(r.refresh_completed,false);privateSafe(r);
});
test('changed actor or session cannot pass',async()=>{
 for(const next of [session(2,'other-actor'),session(2,id,'other-session')]){
  const f=fixture({refreshSession:async()=>({data:{session:next}}),getUser:async()=>({data:{user:{id:next.user.id}}})}),r=await f.run();
  assert.equal(r.result,'REVIEW_REQUIRED');privateSafe(r);
 }
});
test('server identity error or disagreement cannot pass',async()=>{
 for(const response of [{error:{message:secret}},{data:{user:{id:'other'}}}]){
  const f=fixture({getUser:async()=>response}),r=await f.run();assert.equal(r.same_verified_user,false);assert.equal(r.result,'REVIEW_REQUIRED');privateSafe(r);
 }
});
test('unchanged access token stays review-required even when SDK reports success',async()=>{
 const f=fixture({refreshSession:async()=>({data:{session:session()}}),getUser:async()=>({data:{user:{id}}})}),r=await f.run();
 assert.equal(r.access_token_changed,false);assert.equal(r.result,'REVIEW_REQUIRED');privateSafe(r);
});
test('unexpected SDK exceptions are classified without leaking messages',async()=>{
 const f=fixture();f.input.loadSDK=async()=>{throw Error(secret);};const r=await f.run();assert.equal(r.checkpoint,'SDK');privateSafe(r);
});
