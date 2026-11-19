import {pathToFileURL} from 'node:url';
export const stage = 'FR.2.5.W27_RECOVERY_RECIPIENT_LOCAL_READ_ONLY';
const project='dczlddwbtgvfdujgcitb',origin='https://mushavo-budget-staging.pages.dev';
const mailbox=/^[A-Za-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?\.[A-Za-z]{2,63}$/;
const envKeys=['EMAIL_GATE_MODE','EMAIL_GATE_PROJECT','EMAIL_GATE_ORIGIN','EMAIL_GATE_PEPPERS_JSON','EMAIL_GATE_KEY_VERSION','EMAIL_GATE_RATE_PEPPER','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY','ZOHO_MAIL_ORIGIN','ZOHO_ACCOUNTS_ORIGIN','ZOHO_ACCOUNT_ID','ZOHO_FROM_ADDRESS','ZOHO_CLIENT_ID','ZOHO_CLIENT_SECRET','ZOHO_REFRESH_TOKEN','ZOHO_TEST_RECIPIENTS_JSON'];
const ordinary=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>ordinary(x)&&Object.keys(x).sort().join(',')===keys.slice().sort().join(',');
const address=x=>typeof x==='string'&&x.length<=254&&mailbox.test(x);
const need=(condition,code)=>{if(!condition)throw new Error(code);};
const problems=new Set(['PRIVATE_INPUT_REQUIRED','PRIVATE_PACKET_SCOPE_REQUIRED','PRIVATE_RECIPIENT_LIST_REQUIRED','PRIVATE_RECIPIENT_FORMAT_REQUIRED']);
function receipt(result,code=null,allowed=null,count=null){
 return {stage_step:stage,progress_display:'Stage 3/10 | FR.2/8 | Batch W/Z',result,
  retained_packet_recipient_allowed:allowed,retained_packet_recipient_count:count,
  live_Cloudflare_secret_value_readback:false,live_email_delivery_verified:false,
  actual_hosted_requests:0,real_email_requests:0,settings_SQL_or_account_writes:0,
  password_save_requested:false,raw_private_values_or_hashes_printed:false,
  hosted_acceptance:false,production_or_native_changed:false,APK_update_deferred:true,
  problem_code:code,exit_code:code||allowed===false?1:0};
}
export function checkRecoveryRecipient(input){
 try{
  if(exact(input,['preflight'])&&input.preflight===true)return receipt('PRIVATE_PIPE_PREFLIGHT_PASS');
  need(exact(input,['packet_json','recipient'])&&typeof input.packet_json==='string'&&Buffer.byteLength(input.packet_json)<=131072,'PRIVATE_INPUT_REQUIRED');
  need(typeof input.recipient==='string'&&address(input.recipient.trim()),'PRIVATE_RECIPIENT_FORMAT_REQUIRED');
  let p;try{p=JSON.parse(input.packet_json);}catch{throw new Error('PRIVATE_PACKET_SCOPE_REQUIRED');}
  need(ordinary(p)&&p.schema_version===1&&p.purpose==='MUSHAVO_STAGING_EMAIL_GATEWAY_CONFIGURATION_ONLY'&&p.project===project&&p.origin===origin&&exact(p.env,envKeys),'PRIVATE_PACKET_SCOPE_REQUIRED');
  need(p.env.EMAIL_GATE_MODE==='STAGING_CONTROLLED_ONLY'&&p.env.EMAIL_GATE_PROJECT===project&&p.env.EMAIL_GATE_ORIGIN===origin,'PRIVATE_PACKET_SCOPE_REQUIRED');
  need(typeof p.env.ZOHO_TEST_RECIPIENTS_JSON==='string'&&Buffer.byteLength(p.env.ZOHO_TEST_RECIPIENTS_JSON)<=4096,'PRIVATE_RECIPIENT_LIST_REQUIRED');
  let recipients;try{recipients=JSON.parse(p.env.ZOHO_TEST_RECIPIENTS_JSON);}catch{throw new Error('PRIVATE_RECIPIENT_LIST_REQUIRED');}
  need(Array.isArray(recipients)&&recipients.length>=1&&recipients.length<=10&&recipients.every(address),'PRIVATE_RECIPIENT_LIST_REQUIRED');
  const allowed=recipients.some(x=>x.toLowerCase()===input.recipient.trim().toLowerCase());
  return receipt(allowed?'RECOVERY_RECIPIENT_IN_RETAINED_STAGING_PACKET':'RECOVERY_RECIPIENT_NOT_IN_RETAINED_STAGING_PACKET',null,allowed,recipients.length);
 }catch(error){return receipt('RECOVERY_RECIPIENT_LOCAL_REVIEW_REQUIRED',problems.has(error?.message)?error.message:'PRIVATE_INPUT_REQUIRED');}
}
export async function readPrivateInput(stream){
 let bytes=0;const parts=[];
 for await(const value of stream){const chunk=Buffer.from(value);bytes+=chunk.length;if(bytes>262144)throw new Error('PRIVATE_INPUT_REQUIRED');parts.push(chunk);}
 if(bytes===0)throw new Error('PRIVATE_INPUT_REQUIRED');
 return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let answer;
 try{if(process.argv.length!==3||process.argv[2]!=='--private-parent-pipe'||process.stdin.isTTY)throw new Error('PRIVATE_INPUT_REQUIRED');answer=checkRecoveryRecipient(await readPrivateInput(process.stdin));}
 catch{answer=receipt('RECOVERY_RECIPIENT_LOCAL_REVIEW_REQUIRED','PRIVATE_INPUT_REQUIRED');}
 process.stdout.write(JSON.stringify(answer)+'\n');process.exitCode=answer.exit_code;
}
