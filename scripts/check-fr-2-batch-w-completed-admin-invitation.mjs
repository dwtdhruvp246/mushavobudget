import fs from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {privateTerminal} from './lib/operator-private-terminal.mjs';
import {readPublicZIP} from './lib/read-public-zip.mjs';
import {checkCompletedAdminInvitation} from './lib/completed-admin-invitation-check.mjs';
const root=new URL('../',import.meta.url),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const ZIP_SHA256='9bbad6f7fe83b731aef9b65d3bae5df8b832204c5e7bbd0867a9e5a9b811033b';
export function readStagingConfiguration(bytes){
 if(hash(bytes)!==ZIP_SHA256)throw Error('ACCEPTED_STAGING_ZIP_REQUIRED');
 const configBytes=readPublicZIP(bytes,42).get('config.js');
 if(!configBytes)throw Error('STAGING_PUBLIC_CONFIGURATION_REQUIRED');
 const context={window:{}};
 vm.runInNewContext(configBytes.toString('utf8'),context,{timeout:1000});
 return validateStagingConfiguration(context.window.MUSHAVO_BUDGET_CONFIG||context.window.EXPENSE_TRACKER_CONFIG);
}
export function validateStagingConfiguration(config){
 if(config?.supabaseUrl!=='https://dczlddwbtgvfdujgcitb.supabase.co')throw Error('STAGING_PUBLIC_CONFIGURATION_REQUIRED');
 const key=config.supabasePublishableKey;
 let valid=typeof key==='string'&&/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(key);
 if(typeof key==='string'&&key.split('.').length===3){
  try {const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString('utf8'));valid=claims.role==='anon'&&claims.ref==='dczlddwbtgvfdujgcitb';}catch{}
 }
 if(!valid)throw Error('PUBLIC_ANON_OR_PUBLISHABLE_KEY_REQUIRED');
 return {origin:config.supabaseUrl,key};
}
function verifySources(){
 const expected=['scripts/check-fr-2-batch-w-completed-admin-invitation.mjs','scripts/lib/completed-admin-invitation-check.mjs','scripts/lib/operator-private-terminal.mjs','scripts/lib/read-public-zip.mjs','scripts/lib/store-public-zip.mjs'];
 const manifest=JSON.parse(fs.readFileSync(new URL('scripts/completed-admin-invitation-manifest.json',root),'utf8'));
 if(Object.keys(manifest.sources||{}).sort().join('|')!==expected.sort().join('|'))throw Error('SOURCE_HASH_MISMATCH');
 for(const name of expected)if(hash(fs.readFileSync(new URL(name,root)))!==manifest.sources[name])throw Error('SOURCE_HASH_MISMATCH');
 return expected.length;
}
async function main(){
 let terminal,input,activeController,interrupted=false;
 const interrupt=()=>{interrupted=true;activeController?.abort();};
 process.on('SIGINT',interrupt);
 try{
  if(process.argv.length!==3)throw Error('ACCEPTED_STAGING_ZIP_REQUIRED');
  const count=verifySources(),config=readStagingConfiguration(fs.readFileSync(process.argv[2]));
  terminal=privateTerminal();
  terminal.notice('STARTED: Batch W completed Admin invitation check — staging only.');
  terminal.notice('First enter the NEW FREE USER whose setup you just completed. Passwords are masked. The other test account is requested only after the recipient invitation is verified. No email is sent.');
  const recipient={email:(await terminal.prompt('New Free user email from completed setup:',false)).trim(),password:await terminal.prompt('New Free user password:',true)};
  const other=async()=>{
   terminal.notice('Recipient invitation verified. Enter a different existing staging test account.');
   return {email:(await terminal.prompt('Different existing test account email:',false)).trim(),password:await terminal.prompt('Other test account password:',true)};
  };
  input={recipient,other};
  const transport=async({method,route,token,body})=>{
   if(!/^\/(auth\/v1|rest\/v1)\//.test(route))throw Error('FIXED_ROUTE_REQUIRED');
   if(interrupted&&!route.startsWith('/auth/v1/logout'))throw Error('OWNER_CANCELLED');
   const controller=new AbortController();activeController=controller;
   const timer=setTimeout(()=>controller.abort(),25000);
   try{
    const response=await fetch(config.origin+route,{method,headers:{apikey:config.key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
     ...(body!==undefined?{body:JSON.stringify(body)}:{}),redirect:'error',signal:controller.signal});
    const text=await response.text();let data=null;
    if(text){try{data=JSON.parse(text);}catch{}}
    return {status:response.status,data};
   }finally{clearTimeout(timer);if(activeController===controller)activeController=null;}
  };
  const report=await checkCompletedAdminInvitation(input,transport);
  report.source_hashes_verified=count;report.retained_staging_ZIP_verified=true;
  terminal.notice(report.exit_code===0?'COMPLETE: Scoped server checks passed.':'STOPPED FOR REVIEW: Preserve the safe JSON below.');
  console.log(JSON.stringify(report,null,2));process.exitCode=report.exit_code;
 }catch(error){
  const allowed=new Set(['PRIVATE_INTERACTIVE_TERMINAL_REQUIRED','OWNER_CANCELLED','SOURCE_HASH_MISMATCH','ACCEPTED_STAGING_ZIP_REQUIRED','STAGING_PUBLIC_CONFIGURATION_REQUIRED','PUBLIC_ANON_OR_PUBLISHABLE_KEY_REQUIRED']);
  console.log(JSON.stringify({progress_display:'Stage 3/10 | FR.2/8 | Batch W/Z',result:'COMPLETED_ADMIN_INVITATION_PREPARATION_STOPPED',problem_code:allowed.has(error?.message)?error.message:'SOURCE_OR_PATH_REQUIRED',real_email_requests:0,exit_code:1},null,2));
  process.exitCode=1;
 }finally{input=null;terminal?.close();process.off('SIGINT',interrupt);}
}
if(process.argv[1]===fileURLToPath(import.meta.url))await main();
