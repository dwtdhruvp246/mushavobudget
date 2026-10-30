import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkCompletedAdminInvitation} from '../scripts/lib/completed-admin-invitation-check.mjs';
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const recipientId=uuid(1),otherId=uuid(2),invitationId=uuid(3),workspaceId=uuid(4),otherWorkspaceId=uuid(5);
const input={recipient:{email:'recipient@example.test',password:'PRIVATE_RECIPIENT_PASSWORD'},other:{email:'other@example.test',password:'PRIVATE_OTHER_PASSWORD'}};
function fixture(options={}){
 const requests=[],tokens={recipient:'PRIVATE_RECIPIENT_TOKEN',other:'PRIVATE_OTHER_TOKEN'};
 let repeats=0;
 const invitation={invitation_id:invitationId,email:input.recipient.email,invitation_status:options.unfinished?'sent':'provisioned',plan_code:'free',workspace_type:'personal',payment_received:false,provisioned_workspace_id:workspaceId,enabled_currencies:['USD'],default_currency:'USD'};
 const transport=async request=>{
  requests.push(request);
  const {method,route,body,token}=request;
  if(route==='/auth/v1/token?grant_type=password'){
   assert.equal(method,'POST');
   if(options.badPassword&&body.email===input.recipient.email)return {status:400,data:{error_code:'invalid_credentials',message:'PRIVATE_AUTH_RESPONSE'}};
   return {status:200,data:{access_token:body.email===input.recipient.email?tokens.recipient:tokens.other}};
  }
  const recipient=token===tokens.recipient;
  if(route==='/auth/v1/user')return {status:200,data:{id:recipient?recipientId:otherId,email:recipient?input.recipient.email:input.other.email,email_confirmed_at:'2026-10-30T00:00:00Z'}};
  if(route.startsWith('/rest/v1/profiles?')){
   if(options.profileDenied)return {status:403,data:{code:'42501',message:'PRIVATE_PROFILE_FAILURE'}};
   if(options.profileEmpty)return {status:200,data:[]};
   return {status:options.partialContent?206:200,data:[{id:recipientId,signup_source:options.selfSignup?'self_signup':'admin_invitation',admin_invitation_id:options.selfSignup?null:invitationId}]};
  }
  if(route.startsWith('/rest/v1/budget_workspaces?')){
   const rows=[{id:recipient?workspaceId:otherWorkspaceId,owner_id:recipient?recipientId:otherId,workspace_type:'personal'}];
   if(recipient&&options.duplicate&&repeats===2)rows.push({id:uuid(6),owner_id:recipientId,workspace_type:'personal'});
   return {status:options.partialContent?206:200,data:rows};
  }
  if(route==='/rest/v1/rpc/get_my_admin_user_invitation'){
   if(!recipient&&options.networkFailure)throw Error('PRIVATE_PROVIDER_RESPONSE_WITH_SECRET');
   return recipient||options.readAllowed?{status:200,data:[invitation]}:{status:400,data:{code:'P0001',message:options.sessionFailure?'application_session_required':'ADMIN_INVITATION_NOT_AVAILABLE'}};
  }
  if(route==='/rest/v1/rpc/complete_admin_user_invitation'){
   assert.deepEqual(body,{p_invitation_id:invitationId,p_enabled_currencies:['USD'],p_default_currency:'USD'});
   if(!recipient)return options.completeAllowed?{status:200,data:workspaceId}:{status:400,data:{code:'P0001',message:'ADMIN_INVITATION_IDENTITY_MISMATCH'}};
   repeats++;return {status:200,data:workspaceId};
  }
  if(route==='/auth/v1/logout?scope=local')return {status:options.cleanupFailure&&!recipient?401:204,data:null};
  throw Error('Unexpected fixture route');
 };
 return {transport,requests};
}
test('actual denials and repeated completed requests use 15 bounded calls and clean two scoped sessions',async()=>{
 const {transport,requests}=fixture(),report=await checkCompletedAdminInvitation(input,transport);
 assert.equal(report.exit_code,0);assert.equal(report.actual_hosted_requests,15);
 assert.equal(report.completion_RPC_calls,3);assert.equal(report.created_sessions,2);assert.equal(report.cleanup_sessions,2);
 assert.equal(report.checks.wrong_recipient_invitation_read_denied,true);
 assert.equal(report.checks.wrong_recipient_completion_denied,true);
 assert.equal(report.checks.repeated_completion_returns_same_workspace,true);
 assert.equal(report.checks.no_additional_owned_workspace,true);
 assert.ok(requests.every(r=>!r.route.includes('inviteUser')&&!r.route.includes('otp')&&!r.route.includes('recover')));
 const safe=JSON.stringify(report);
 for(const value of [input.recipient.email,input.other.email,input.recipient.password,input.other.password,'PRIVATE_RECIPIENT_TOKEN','PRIVATE_OTHER_TOKEN',workspaceId,invitationId])assert.ok(!safe.includes(value));
});
test('unfinished invitation stops before every completion request and cleans the created session',async()=>{
 const {transport,requests}=fixture({unfinished:true}),report=await checkCompletedAdminInvitation(input,transport);
 assert.equal(report.problem_code,'COMPLETED_FREE_PERSONAL_INVITATION_REQUIRED');assert.equal(report.cleanup_sessions,1);
 assert.ok(!requests.some(r=>r.route.includes('/complete_admin_user_invitation')));
});
test('wrong-recipient read success or session failure cannot be credited as identity denial',async()=>{
 for(const options of [{readAllowed:true},{sessionFailure:true}]){
  const {transport}=fixture(options),report=await checkCompletedAdminInvitation(input,transport);
  assert.equal(report.problem_code,'WRONG_RECIPIENT_READ_DENIAL_NOT_ESTABLISHED');assert.equal(report.exit_code,1);assert.equal(report.cleanup_sessions,2);
 }
});
test('wrong-recipient completion success is rejected and no correct-recipient repeats are made',async()=>{
 const {transport,requests}=fixture({completeAllowed:true}),report=await checkCompletedAdminInvitation(input,transport);
 assert.equal(report.problem_code,'WRONG_RECIPIENT_COMPLETION_DENIAL_NOT_ESTABLISHED');assert.equal(report.cleanup_sessions,2);
 assert.equal(requests.filter(r=>r.route.includes('/complete_admin_user_invitation')).length,1);
});
test('new workspace after repeated completion fails the idempotence check',async()=>{
 const {transport}=fixture({duplicate:true}),report=await checkCompletedAdminInvitation(input,transport);
 assert.equal(report.problem_code,'OWNED_WORKSPACE_SET_CHANGED');assert.equal(report.cleanup_sessions,2);assert.equal(report.exit_code,1);
});
test('request errors never print raw provider data and scoped cleanup still runs',async()=>{
 const {transport}=fixture({networkFailure:true}),report=await checkCompletedAdminInvitation(input,transport);
 assert.equal(report.problem_code,'REQUEST_FAILED');assert.equal(report.cleanup_sessions,2);
 assert.ok(!JSON.stringify(report).includes('PRIVATE_PROVIDER'));
});
test('cleanup denial prevents a complete result while retaining scoped observations',async()=>{
 const {transport}=fixture({cleanupFailure:true}),report=await checkCompletedAdminInvitation(input,transport);
 assert.equal(report.problem_code,'SCOPED_SESSION_CLEANUP_NOT_VERIFIED');assert.equal(report.exit_code,1);
 assert.equal(report.checks.repeated_completion_returns_same_workspace,true);assert.equal(report.cleanup_sessions,1);
});
test('same accounts or missing private input stop without a network request',async()=>{
 for(const bad of [null,{...input,other:input.recipient}]){
  let count=0;const report=await checkCompletedAdminInvitation(bad,async()=>{count++;});
  assert.equal(report.exit_code,1);assert.equal(count,0);
 }
});
test('failed sign-in identifies its slot and safe code without raw Auth messages',async()=>{
 const {transport}=fixture({badPassword:true}),report=await checkCompletedAdminInvitation(input,transport);
 assert.deepEqual(report.failed_auth,{account_slot:'recipient',HTTP_status:400,code:'invalid_credentials'});
 assert.equal(report.created_sessions,0);assert.equal(report.actual_hosted_requests,1);
 assert.ok(!JSON.stringify(report).includes('PRIVATE_AUTH_RESPONSE'));
});
test('profile diagnostics distinguish denied, hidden and non-invited rows without printing private data',async()=>{
 for(const options of [{profileDenied:true},{profileEmpty:true},{selfSignup:true}]){
  const {transport}=fixture(options),report=await checkCompletedAdminInvitation(input,transport);
  assert.equal(report.exit_code,1);assert.equal(report.actual_hosted_requests,4);
  assert.equal(report.completion_RPC_calls,0);assert.equal(report.cleanup_sessions,1);
  assert.ok(!JSON.stringify(report).includes('PRIVATE_PROFILE_FAILURE'));
  if(options.profileDenied){
   assert.equal(report.problem_code,'PROFILE_READ_NOT_SUCCESSFUL');
   assert.equal(report.profile_preflight.HTTP_status,403);
   assert.equal(report.profile_preflight.database_error_code,'42501');
  }else if(options.profileEmpty)assert.equal(report.profile_preflight.row_count,0);
  else {assert.equal(report.profile_preflight.signup_source,'self_signup');assert.equal(report.profile_preflight.invitation_id_present,false);}
 }
});
test('valid partial-content profile and workspace reads are accepted',async()=>{
 const {transport}=fixture({partialContent:true}),report=await checkCompletedAdminInvitation(input,transport);
 assert.equal(report.exit_code,0);assert.equal(report.profile_preflight.HTTP_status,206);assert.equal(report.actual_hosted_requests,15);
});
test('the other account prompt is not reached when recipient profile verification fails',async()=>{
 let prompted=false;const {transport}=fixture({profileEmpty:true});
 const report=await checkCompletedAdminInvitation({recipient:input.recipient,other:async()=>{prompted=true;return input.other;}},transport);
 assert.equal(prompted,false);assert.equal(report.created_sessions,1);assert.equal(report.cleanup_sessions,1);
});
test('cancelling the deferred other-account prompt still cleans up the recipient session',async()=>{
 const {transport}=fixture();
 const report=await checkCompletedAdminInvitation({recipient:input.recipient,other:async()=>{throw Error('OWNER_CANCELLED');}},transport);
 assert.equal(report.problem_code,'OWNER_CANCELLED');assert.equal(report.created_sessions,1);assert.equal(report.cleanup_sessions,1);
 assert.equal(report.completion_RPC_calls,0);
});
