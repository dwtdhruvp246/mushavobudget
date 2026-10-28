import {pathToFileURL} from 'node:url';
import {checkRecoveryRecipient,readPrivateInput} from './check-fr-2-batch-w-recovery-recipient.mjs';
export const stage='FR.2.5.W45_FOUR_RECIPIENT_STAGING_PREPARATION';
function safe(result,problem=null,before=null,after=null,changed=false){return {stage_step:stage,progress_display:'Stage 3/10 | FR.2/8 | Batch W/Z',result,original_recipient_count:before,prepared_recipient_count:after,recipient_value_changed:changed,actual_hosted_requests:0,real_email_requests:0,Cloudflare_settings_or_SQL_or_account_writes:0,password_save_requested:false,provider_credentials_or_private_hashes_printed:false,hosted_acceptance:false,production_or_native_changed:false,APK_update_deferred:true,problem_code:problem,exit_code:problem?1:0};}
export function planRecipientAddition(input){
 try{
  const before=checkRecoveryRecipient(input);
  if(before.result==='PRIVATE_PIPE_PREFLIGHT_PASS')return {receipt:safe('PRIVATE_PIPE_PREFLIGHT_PASS'),recipient_json:null};
  if(before.problem_code)return {receipt:safe('LOCAL_RECIPIENT_ADDITION_REVIEW_REQUIRED',before.problem_code),recipient_json:null};
  const count=before.retained_packet_recipient_count,allowed=before.retained_packet_recipient_allowed;
  if(!((count===3&&allowed===false)||(count===4&&allowed===true)))return {receipt:safe('LOCAL_RECIPIENT_ADDITION_REVIEW_REQUIRED','THREE_RECIPIENT_BASELINE_OR_PREPARED_FOUR_REQUIRED'),recipient_json:null};
  const packet=JSON.parse(input.packet_json),old=JSON.parse(packet.env.ZOHO_TEST_RECIPIENTS_JSON);
  if(new Set(old.map(x=>x.toLowerCase())).size!==old.length)return {receipt:safe('LOCAL_RECIPIENT_ADDITION_REVIEW_REQUIRED','UNIQUE_RETAINED_RECIPIENTS_REQUIRED'),recipient_json:null};
  const next=allowed?old:[...old,input.recipient.trim().toLowerCase()];
  const recipient_json=JSON.stringify(next);
  const candidate={...packet,env:{...packet.env,ZOHO_TEST_RECIPIENTS_JSON:recipient_json}};
  const after=checkRecoveryRecipient({...input,packet_json:JSON.stringify(candidate)});
  if(after.exit_code!==0||after.retained_packet_recipient_count!==4)throw new Error();
  return {receipt:safe(allowed?'LOCAL_FOUR_RECIPIENT_VALUE_ALREADY_PREPARED':'LOCAL_FOUR_RECIPIENT_VALUE_PREPARED_NOT_INSTALLED',null,count,4,!allowed),recipient_json};
 }catch{return {receipt:safe('LOCAL_RECIPIENT_ADDITION_REVIEW_REQUIRED','LOCAL_PRIVATE_INPUT_REQUIRED'),recipient_json:null};}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let answer;
 try{if(process.argv.length!==3||process.argv[2]!=='--private-parent-pipe'||process.stdin.isTTY||process.stdout.isTTY)throw new Error();answer=planRecipientAddition(await readPrivateInput(process.stdin));}
 catch{answer={receipt:safe('LOCAL_RECIPIENT_ADDITION_REVIEW_REQUIRED','LOCAL_PRIVATE_INPUT_REQUIRED'),recipient_json:null};}
 // This stdout is the bounded anonymous pipe to the pinned parent, never the public receipt.
 process.stdout.write(JSON.stringify(answer)+'\n');process.exitCode=answer.receipt.exit_code;
}
