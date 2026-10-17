import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {requireEmailVerifiedSession,emailVerificationFailure} from '../supabase/functions/_shared/email-session-assurance.mjs';
import {createHandler} from '../supabase/functions/submit-enquiry/handler.mjs';
import {edgeHarness,guardedNames,validAdminBody,validBusinessBody,actor,origin} from './helpers/fr-2-email-edge-harness.mjs';

const noEffects=calls=>{
  assert.equal(calls.reads.length,0);assert.equal(calls.writes.length,0);
  assert.equal(calls.userRPC.length,0);assert.equal(calls.serviceRPC.length,0);
  assert.equal(calls.mail.length,0);assert.equal(calls.push.length,0);assert.equal(calls.provider.length,0);
};
test('Actual proof helper uses only a no-argument RPC and accepts the exact server boolean',async()=>{
  const calls=[];
  await requireEmailVerifiedSession({rpc:async(...args)=>{calls.push(args);return {data:true,error:null};}});
  assert.deepEqual(calls,[['email_gate_current_session_verified']]);
});
test('False proof is a fixed403 verification denial without an assurance or role exemption',async()=>{
  await assert.rejects(requireEmailVerifiedSession({rpc:async()=>({data:false,error:null})}),e=>{
    assert.deepEqual(emailVerificationFailure(e),{code:'EMAIL_VERIFICATION_REQUIRED',status:403});return true;
  });
});
test('Malformed/truthy status payloads and missing error contracts never become approval',async()=>{
  for(const result of[null,true,[],{}, {data:true},{data:'true',error:null},{data:1,error:null},{data:{verified:true,aal:'aal2'},error:null},{data:true,error:{message:'PRIVATE_SDK_ERROR'}}]){
    await assert.rejects(requireEmailVerifiedSession({rpc:async()=>result}),e=>{
      assert.deepEqual(emailVerificationFailure(e),{code:'EMAIL_VERIFICATION_UNAVAILABLE',status:503});return true;
    });
  }
});
test('Thrown private SDK errors are replaced and unknown errors cannot forge the helper failure class',async()=>{
  await assert.rejects(requireEmailVerifiedSession({rpc:async()=>{throw Error('PRIVATE_BEARER_OR_PROVIDER_ERROR');}}),{message:'EMAIL_VERIFICATION_UNAVAILABLE'});
  assert.equal(emailVerificationFailure({code:'EMAIL_VERIFICATION_REQUIRED',status:200}),null);
});
test('An unresponsive proof RPC times out closed without a fallback approval',{timeout:12000},async()=>{
  await assert.rejects(requireEmailVerifiedSession({rpc:()=>new Promise(()=>{})}),e=>emailVerificationFailure(e)?.status===503);
});
for(const name of guardedNames){
  test(`${name}: password-only or forged client flags stop before any protected port`,async()=>{
    const h=await edgeHarness(name,{proof:false});
    const r=await h.request({body:{...validAdminBody,...validBusinessBody,verified:true,role:'super_admin',aal:'aal2',source:'scheduled'}});
    assert.equal(r.status,403);assert.equal((await r.json()).error,'EMAIL_VERIFICATION_REQUIRED');noEffects(h.calls);
    assert.deepEqual(h.calls.proof,[{name:'email_gate_current_session_verified',args:undefined}]);
    assert.equal(h.calls.sequence[0],'getUser');
    assert.equal(h.calls.clients.find(x=>x.kind==='user').authorization,'Bearer synthetic-user-token');
  });
  test(`${name}: database/RPC outage fails503 without logging the private response`,async()=>{
    const h=await edgeHarness(name,{proof:true,proofError:{message:'PRIVATE_SECRET_RESPONSE'}});
    const r=await h.request();assert.equal(r.status,503);assert.equal((await r.json()).error,'EMAIL_VERIFICATION_UNAVAILABLE');
    noEffects(h.calls);assert(!JSON.stringify(h.calls.logs).includes('PRIVATE_SECRET_RESPONSE'));
  });
  test(`${name}: missing bearer or failed provider identity never reaches the proof RPC`,async()=>{
    for(const option of[{bearer:false},{authUser:false},{authError:{message:'PRIVATE_AUTH_ERROR'}}]){
      const h=await edgeHarness(name,option);const r=await h.request({bearer:option.bearer!==false});
      assert.equal(r.status,401);assert.equal(h.calls.proof.length,0);noEffects(h.calls);
    }
  });
}
test('Every request rechecks proof; a prior approved push request cannot cache authorization',async()=>{
  let approved=true;const h=await edgeHarness('send-test-push',{proofRPC:async()=>({data:approved,error:null})});
  assert.equal((await h.request()).status,200);const sends=h.calls.push.length;
  approved=false;assert.equal((await h.request()).status,403);assert.equal(h.calls.push.length,sends);assert.equal(h.calls.proof.length,2);
});
test('Admin invitation keeps the platform-role matrix after verification',async()=>{
  for(const role of['finance_staff','support_staff',null]){
    const h=await edgeHarness('invite-admin-user',{adminRole:role});assert.equal((await h.request({body:validAdminBody})).status,403);
    assert.equal(h.calls.mail.length,0);assert.equal(h.calls.serviceRPC.length,0);
  }
  for(const role of['super_admin','admin_staff']){
    const h=await edgeHarness('invite-admin-user',{adminRole:role});assert.equal((await h.request({body:validAdminBody})).status,200);
    assert.equal(h.calls.mail[0].kind,'invite');assert.equal(h.calls.serviceRPC[0].name,'reserve_admin_user_invitation');
    assert.equal(h.calls.serviceRPC[0].args.p_actor_id,actor);
    assert(h.calls.sequence.indexOf('user-rpc:email_gate_current_session_verified')<h.calls.sequence.indexOf('service:select:app_admins'));
  }
});
test('Admin replacement delivery keeps same existing identity and never requests account creation',async()=>{
  const h=await edgeHarness('invite-admin-user',{existingUser:true});assert.equal((await h.request({body:validAdminBody})).status,200);
  assert.equal(h.calls.mail[0].kind,'otp');assert.equal(h.calls.mail[0].args.options.shouldCreateUser,false);
  assert.equal(h.calls.writes[0].table,'Auth_metadata');
});
test('Business new/existing invitation controls and resend still use caller-bound reservation before delivery',async()=>{
  for(const existingUser of[false,true]){
    const h=await edgeHarness('invite-business-member',{existingUser});assert.equal((await h.request({body:validBusinessBody})).status,200);
    assert.equal(h.calls.userRPC[0].name,'create_business_invitation');
    assert.equal(h.calls.mail[0].kind,existingUser?'otp':'invite');
    if(existingUser)assert.equal(h.calls.mail[0].args.options.shouldCreateUser,false);
  }
  const h=await edgeHarness('invite-business-member',{existingUser:true});assert.equal((await h.request({body:{action:'resend',invitation_id:'synthetic-invitation'}})).status,200);
  assert.equal(h.calls.userRPC[0].name,'prepare_business_invitation_resend');
});
test('Business reservation denial still prevents all privileged dispatch after proof',async()=>{
  const h=await edgeHarness('invite-business-member',{reservationError:{message:'BUSINESS_TEAM_ACCESS_REQUIRED'}});
  assert.equal((await h.request({body:validBusinessBody})).status,403);
  assert.equal(h.calls.mail.length,0);assert.equal(h.calls.clients.some(x=>x.kind==='service'),false);
});
test('Verified test push retains account status, own recipient and rate-limit controls',async()=>{
  const h=await edgeHarness('send-test-push');assert.equal((await h.request({body:{user_id:'foreign',verified:true}})).status,200);
  assert.deepEqual(h.calls.reads.find(x=>x.table==='profiles').filters,[['eq','id',actor]]);
  assert.equal(h.calls.serviceRPC[0].name,'claim_push_test_rate_limit');assert.equal(h.calls.serviceRPC[0].args.p_user_id,actor);
  assert.equal(h.calls.push.length,1);
  for(const options of[{profile:{account_status:'suspended'}},{rateAllowed:false}]){
    const denied=await edgeHarness('send-test-push',options);assert.notEqual((await denied.request()).status,200);assert.equal(denied.calls.push.length,0);
  }
});
test('Manual FX sync requires both email verification and one of the existing finance/Admin roles',async()=>{
  for(const role of['super_admin','admin_staff','finance_staff']){
    const h=await edgeHarness('sync-exchange-rates',{adminRole:role});assert.equal((await h.request()).status,200);assert.equal(h.calls.provider.length,1);
    assert.equal(h.calls.reads[0].table,'app_admins');
  }
  const h=await edgeHarness('sync-exchange-rates',{adminRole:'support_staff'});assert.equal((await h.request()).status,401);
  assert.equal(h.calls.provider.length,0);assert.equal(h.calls.writes.length,0);
});
test('Scheduled FX path uses its server secret without a user or email gate; body claims cannot select it',async()=>{
  const h=await edgeHarness('sync-exchange-rates',{authUser:false,proof:false});
  assert.equal((await h.request({bearer:false,headers:{'x-cron-secret':'synthetic-currency-cron'}})).status,200);
  assert.equal(h.calls.proof.length,0);assert.equal(h.calls.provider.length,1);
  const wrong=await edgeHarness('sync-exchange-rates',{proof:false});
  assert.equal((await wrong.request({body:{source:'scheduled',verified:true},headers:{'x-cron-secret':'wrong'}})).status,403);noEffects(wrong.calls);
});
for(const name of['dispatch-push-reminders','dispatch-admin-notifications']){
  test(`${name}: cron-only boundary stays independent of user proofs`,async()=>{
    const wrong=await edgeHarness(name);assert.equal((await wrong.request({body:{source:'cron'}})).status,401);noEffects(wrong.calls);
    const browser=await edgeHarness(name);assert.equal((await browser.request({body:{source:'browser'},headers:{'x-mushavo-cron-secret':'synthetic-cron'}})).status,400);noEffects(browser.calls);
    const right=await edgeHarness(name);assert.equal((await right.request({bearer:false,body:{source:'cron'},headers:{'x-mushavo-cron-secret':'synthetic-cron'}})).status,200);
    assert.equal(right.calls.proof.length,0);assert.equal(right.calls.push.length,0);assert(right.calls.serviceRPC.some(x=>x.name.startsWith('claim_')));
  });
}
test('Public enquiries remain available without sign-in only after their existing Turnstile gate',async()=>{
  for(const success of[false,true]){
    const calls=[];const handle=createHandler({configuration:{origin,supabaseUrl:'https://dczlddwbtgvfdujgcitb.supabase.co',backendKey:'sb_secret_SYNTHETIC',turnstileSecret:'SYNTHETIC_TURNSTILE',quotaSecret:'1'.repeat(64)},cryptoImpl:webcrypto,
      fetchImpl:async(url)=>{calls.push(url);return new Response(JSON.stringify(url.includes('siteverify')?{success,hostname:new URL(origin).hostname,action:'public_contact',challenge_ts:new Date().toISOString()}:{accepted:true}),{status:200});}});
    const r=await handle(new Request(origin+'/contact',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({full_name:'Synthetic sender',email:'sender@example.invalid',country_code:'ZW',country_name:'Zimbabwe',enquiry_type:'support',message:'Synthetic public contact message.',turnstile_token:'synthetic-token'})}));
    assert.equal(r.status,success?200:400);assert.equal(calls.length,success?2:1);
    assert(!calls.some(url=>url.includes('email_gate_')));
  }
});
