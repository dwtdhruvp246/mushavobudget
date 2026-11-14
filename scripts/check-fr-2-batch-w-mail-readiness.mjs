import {pathToFileURL} from 'node:url';
import {checkRecoveryRecipient,readPrivateInput} from './check-fr-2-batch-w-recovery-recipient.mjs';
import {prepareZohoSender} from './lib/fr-2-zoho-private-setup.mjs';
export const stage='FR.2.5.W44_MAIL_UNAVAILABLE_RETAINED_CONFIGURATION_DIAGNOSTIC';
const safeProblems=new Set(['LOCAL_INPUT_INVALID','OAUTH_SCOPE_REVIEW_REQUIRED','OAUTH_TOKEN_SHAPE_REVIEW_REQUIRED','OAUTH_REGION_REVIEW_REQUIRED','ACCOUNT_RESPONSE_REVIEW_REQUIRED','SENDER_MAILBOX_NOT_MATCHED','SENDER_MAILBOX_STATE_REVIEW_REQUIRED','REFRESH_CHECK_REJECTED_OR_UNAVAILABLE','ACCOUNT_READ_REJECTED_OR_UNAVAILABLE']);
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===keys.slice().sort().join(',');
function receipt(result,problem=null){
 return {stage_step:stage,progress_display:'Stage 3/10 | FR.2/8 | Batch W/Z',result,
 retained_packet_recipient_allowed:null,retained_packet_recipient_count:null,
 retained_Zoho_account_matches:null,provider_refresh_passed:false,provider_sender_enabled:false,
 provider_exact_scopes_reported:false,provider_requests:0,actual_hosted_requests:0,real_email_requests:0,
 settings_SQL_or_account_writes:0,live_Cloudflare_secret_values_verified:false,
 live_message_create_or_delivery_verified:false,private_values_or_hashes_printed:false,
 hosted_acceptance:false,production_or_native_changed:false,APK_update_deferred:true,
 problem_code:problem,exit_code:problem?1:0};
}
// The gateway packet stays in process memory. Reuse the reviewed refresh + account-GET checker,
// discard its private configuration and emit only a fixed projection. Never call /messages.
export async function checkMailReadiness(input,fetcher=globalThis.fetch){
 if(exact(input,['preflight'])&&input.preflight===true)return receipt('PRIVATE_PIPE_PREFLIGHT_PASS');
 const out=receipt('RETAINED_MAIL_READINESS_REVIEW_REQUIRED','PRIVATE_INPUT_REQUIRED');
 try{
  if(!exact(input,['packet_json','recipient']))return out;
  const membership=checkRecoveryRecipient(input);
  if(membership.retained_packet_recipient_allowed===null){out.problem_code='PRIVATE_PACKET_OR_RECIPIENT_REQUIRED';return out;}
  out.retained_packet_recipient_allowed=membership.retained_packet_recipient_allowed;
  out.retained_packet_recipient_count=membership.retained_packet_recipient_count;
  if(!membership.retained_packet_recipient_allowed){out.problem_code='RECIPIENT_NOT_IN_SELECTED_PACKET';return out;}
  const {env}=JSON.parse(input.packet_json);
  if(env.ZOHO_MAIL_ORIGIN!=='https://mail.zoho.com'||env.ZOHO_ACCOUNTS_ORIGIN!=='https://accounts.zoho.com'
    ||typeof env.ZOHO_ACCOUNT_ID!=='string'||!/^[0-9]{1,32}$/.test(env.ZOHO_ACCOUNT_ID)){
   out.problem_code='RETAINED_ZOHO_SCOPE_REQUIRED';return out;
  }
  const {receipt:provider,private_configuration:config}=await prepareZohoSender({mode:'refresh',
   clientId:env.ZOHO_CLIENT_ID,clientSecret:env.ZOHO_CLIENT_SECRET,
   refreshToken:env.ZOHO_REFRESH_TOKEN,sender:env.ZOHO_FROM_ADDRESS},fetcher);
  out.provider_requests=provider.requests_attempted;
  out.actual_hosted_requests=provider.requests_attempted;
  out.provider_refresh_passed=provider.refresh_token_check_passed===true;
  out.provider_sender_enabled=provider.sender_account_and_outgoing_state_matched===true;
  out.provider_exact_scopes_reported=provider.token_reported_exact_scopes===true;
  if(provider.exit_code!==0){
   out.problem_code=safeProblems.has(provider.problem_code)?provider.problem_code:'RETAINED_ZOHO_READINESS_REQUIRED';return out;
  }
  out.retained_Zoho_account_matches=config?.accountId===env.ZOHO_ACCOUNT_ID;
  if(!out.retained_Zoho_account_matches){out.problem_code='RETAINED_ZOHO_ACCOUNT_ID_MISMATCH';return out;}
  out.result='RETAINED_RECIPIENT_AND_ZOHO_METADATA_PASS_LIVE_DISPATCH_UNVERIFIED';out.problem_code=null;out.exit_code=0;
  return out;
 }catch{return out;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let answer;
 try{
  if(process.argv.length!==3||process.argv[2]!=='--private-parent-pipe'||process.stdin.isTTY)throw Error();
  answer=await checkMailReadiness(await readPrivateInput(process.stdin));
 }catch{answer=receipt('RETAINED_MAIL_READINESS_REVIEW_REQUIRED','PRIVATE_INPUT_REQUIRED');}
 process.stdout.write(JSON.stringify(answer)+'\n');process.exitCode=answer.exit_code;
}

