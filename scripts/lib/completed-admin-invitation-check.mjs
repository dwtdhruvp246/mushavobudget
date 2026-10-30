const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
class Review extends Error { constructor(code){super(code);this.safeCode=code;} }
const requireCheck=(condition,code)=>{if(!condition)throw new Review(code);};
export async function checkCompletedAdminInvitation(input,transport){
 const sessions=[],checks={},report={progress_display:'Stage 3/10 | FR.2/8 | Batch W/Z',
  result:'COMPLETED_ADMIN_INVITATION_REVIEW_REQUIRED',checks,actual_hosted_requests:0,
  real_email_requests:0,SQL_or_settings_writes:0,first_provisioning_requested:false,
  completion_RPC_calls:0,created_sessions:0,cleanup_sessions:0,
  full_AU02_05_failure_retry_acceptance:false,full_lettered_batch_W_complete:false,exit_code:1};
 let complete=false;
 async function call(method,route,token,body){
  requireCheck(report.actual_hosted_requests<15,'REQUEST_BOUND_REACHED');
  report.actual_hosted_requests++;
  return transport({method,route,token,body});
 }
 async function login(account,slot){
  const result=await call('POST','/auth/v1/token?grant_type=password',null,{email:account.email,password:account.password});
  if(result.status!==200){
   const known=new Set(['invalid_credentials','email_not_confirmed','over_request_rate_limit','over_email_send_rate_limit','user_banned','signup_disabled','unexpected_failure']);
   const candidate=result.data?.error_code||result.data?.code;
   report.failed_auth={account_slot:slot,HTTP_status:result.status,code:known.has(candidate)?candidate:'UNCLASSIFIED'};
  }
  const token=result.data?.access_token;
  if(result.status===200&&typeof token==='string'&&token.length) {sessions.push(token);report.created_sessions++;}
  requireCheck(result.status===200&&sessions.includes(token),'SIGNIN_NOT_ESTABLISHED');
  const checked=await call('GET','/auth/v1/user',token);
  const user=checked.data;
  requireCheck(checked.status===200&&UUID.test(user?.id||'')&&user.email?.toLowerCase()===account.email.toLowerCase()
   &&!!user.email_confirmed_at,'CONFIRMED_IDENTITY_NOT_ESTABLISHED');
  return {token,user};
 }
 async function rpc(actor,name,body){return call('POST','/rest/v1/rpc/'+name,actor.token,body);}
 async function workspaces(actor){
  const response=await call('GET','/rest/v1/budget_workspaces?select=id,owner_id,workspace_type&owner_id=eq.'+actor.user.id+'&limit=21',actor.token);
  requireCheck(response.status===200&&Array.isArray(response.data)&&response.data.length>=1&&response.data.length<=20
   &&response.data.every(row=>UUID.test(row.id||'')&&row.owner_id===actor.user.id),'OWNED_WORKSPACE_READ_NOT_ESTABLISHED');
  return response.data.map(row=>row.id).sort();
 }
 try {
  for(const account of [input?.recipient,input?.other]){
   requireCheck(typeof account?.email==='string'&&account.email.length<=320&&EMAIL.test(account.email)
    &&typeof account.password==='string'&&account.password.length>0&&account.password.length<=4096,'PRIVATE_INPUT_REQUIRED');
  }
  requireCheck(input.recipient.email.toLowerCase()!==input.other.email.toLowerCase(),'DISTINCT_TEST_ACCOUNTS_REQUIRED');
  const recipient=await login(input.recipient,'recipient');
  const profile=await call('GET','/rest/v1/profiles?select=id,signup_source,admin_invitation_id&id=eq.'+recipient.user.id+'&limit=2',recipient.token);
  requireCheck(profile.status===200&&Array.isArray(profile.data)&&profile.data.length===1
   &&profile.data[0].id===recipient.user.id&&profile.data[0].signup_source==='admin_invitation'
   &&UUID.test(profile.data[0].admin_invitation_id||''),'COMPLETED_ADMIN_INVITATION_PROFILE_REQUIRED');
  const invitationId=profile.data[0].admin_invitation_id;
  const read=await rpc(recipient,'get_my_admin_user_invitation',{p_invitation_id:invitationId});
  const invitation=Array.isArray(read.data)&&read.data.length===1?read.data[0]:null;
  requireCheck(read.status===200&&invitation?.invitation_id===invitationId
   &&invitation.email?.toLowerCase()===input.recipient.email.toLowerCase()
   &&invitation.invitation_status==='provisioned'&&invitation.plan_code==='free'
   &&invitation.workspace_type==='personal'&&invitation.payment_received===false
   &&UUID.test(invitation.provisioned_workspace_id||''),'COMPLETED_FREE_PERSONAL_INVITATION_REQUIRED');
  requireCheck(Array.isArray(invitation.enabled_currencies)&&invitation.enabled_currencies.length>=1
   &&invitation.enabled_currencies.length<=20&&invitation.enabled_currencies.every(code=>typeof code==='string'&&/^[A-Z]{3}$/.test(code))
   &&new Set(invitation.enabled_currencies).size===invitation.enabled_currencies.length
   &&invitation.enabled_currencies.includes(invitation.default_currency),'INVITATION_CURRENCY_SELECTION_REQUIRED');
  checks.completed_recipient_invitation_verified=true;
  const before=await workspaces(recipient);
  requireCheck(before.includes(invitation.provisioned_workspace_id),'INVITATION_WORKSPACE_NOT_OWNED');
  const other=await login(input.other,'other');
  requireCheck(other.user.id!==recipient.user.id,'DISTINCT_TEST_ACCOUNTS_REQUIRED');
  await workspaces(other);
  checks.other_account_valid_and_distinct=true;
  const wrongRead=await rpc(other,'get_my_admin_user_invitation',{p_invitation_id:invitationId});
  requireCheck([400,403].includes(wrongRead.status)&&wrongRead.data?.message==='ADMIN_INVITATION_NOT_AVAILABLE','WRONG_RECIPIENT_READ_DENIAL_NOT_ESTABLISHED');
  checks.wrong_recipient_invitation_read_denied=true;
  const payload={p_invitation_id:invitationId,p_enabled_currencies:invitation.enabled_currencies,p_default_currency:invitation.default_currency};
  report.completion_RPC_calls++;
  const wrongComplete=await rpc(other,'complete_admin_user_invitation',payload);
  requireCheck([400,403].includes(wrongComplete.status)&&wrongComplete.data?.message==='ADMIN_INVITATION_IDENTITY_MISMATCH','WRONG_RECIPIENT_COMPLETION_DENIAL_NOT_ESTABLISHED');
  checks.wrong_recipient_completion_denied=true;
  for(let index=0;index<2;index++){
   report.completion_RPC_calls++;
   const repeated=await rpc(recipient,'complete_admin_user_invitation',payload);
   requireCheck(repeated.status===200&&repeated.data===invitation.provisioned_workspace_id,'REPEATED_COMPLETION_IDENTITY_NOT_ESTABLISHED');
  }
  checks.repeated_completion_returns_same_workspace=true;
  const after=await workspaces(recipient);
  requireCheck(JSON.stringify(before)===JSON.stringify(after),'OWNED_WORKSPACE_SET_CHANGED');
  checks.no_additional_owned_workspace=true;
  complete=true;
 } catch(error) {
  report.problem_code=error instanceof Review?error.safeCode:'REQUEST_FAILED';
 } finally {
  for(const token of sessions.reverse()){
   try {const result=await call('POST','/auth/v1/logout?scope=local',token);
    if([200,204].includes(result.status))report.cleanup_sessions++;
   }catch{}
  }
  checks.created_sessions_cleaned_up=report.cleanup_sessions===report.created_sessions;
  if(complete&&checks.created_sessions_cleaned_up){
   report.result='WRONG_RECIPIENT_DENIAL_AND_COMPLETED_INVITATION_IDEMPOTENCE_SCOPED_PASS';report.exit_code=0;
  }else if(!checks.created_sessions_cleaned_up){report.problem_code='SCOPED_SESSION_CLEANUP_NOT_VERIFIED';}
 }
 return report;
}
