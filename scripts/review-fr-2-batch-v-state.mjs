// Current-target metadata review only. No Auth API, factor write or MFA continuation.
import {fileURLToPath} from 'node:url';
import {inspectBatchV,stage} from './check-fr-2-batch-v.mjs';
import {verifySources} from './setup-fr-2-batch-v-mfa.mjs';
import {privateTerminal} from './lib/operator-private-terminal.mjs';
export {stage};
export async function reviewCurrentState({io,transport=fetch,sourceCheck=verifySources}){
 const hashes=await sourceCheck();
 const input={managementToken:(await io.prompt('Same staging Management token (hidden):')).trim(),primaryEmail:(await io.prompt('Existing PRIMARY operator email (visible locally):',false)).trim(),recoveryEmail:(await io.prompt('Existing separate RECOVERY operator email (visible locally):',false)).trim()};
 try{const result=await inspectBatchV(input,{transport});result.source_hashes_verified=hashes;return result;}finally{input.managementToken='';input.primaryEmail='';input.recoveryEmail='';}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 let terminal,result;
 try{
  if(process.argv.length!==3||process.argv[2]!=='--read-only')throw Error('READ_ONLY_ARGUMENT_REQUIRED');
  if(Object.entries(process.env).some(([k,v])=>v&&/^(?:NODE_OPTIONS|NODE_DEBUG|NODE_DEBUG_NATIVE|NODE_TLS_REJECT_UNAUTHORIZED|SSLKEYLOGFILE|SUPABASE_.*|ZOHO_.*|EMAIL_GATE_.*|CLOUDFLARE_.*|CF_API_.*|WRANGLER_.*)$|(?:TOKEN|PASSWORD|SECRET)$/i.test(k)))throw Error('PRIVATE_ENVIRONMENT_REVIEW_REQUIRED');
  terminal=privateTerminal();terminal.notice('Stage 3/10 | FR.2/8 | Batch V/Z — STARTED: READ ONLY current Admin/operator/factor metadata. No password, code, enrollment, deletion or mode change.');
  result=await reviewCurrentState({io:terminal});
 }catch(e){const known=new Set(['READ_ONLY_ARGUMENT_REQUIRED','PRIVATE_ENVIRONMENT_REVIEW_REQUIRED','SOURCE_MANIFEST_REQUIRED','SOURCE_PATH_REQUIRED','SOURCE_IDENTITY_REQUIRED','FROZEN_U_SOURCE_REQUIRED','PRIVATE_INTERACTIVE_TERMINAL_REQUIRED','OWNER_CANCELLED']);result={stage_step:stage,progress_display:'Stage 3/10 | FR.2/8 | Batch V/Z',result:'BATCH_V_PRIVATE_READ_ONLY_REVIEW_NOT_STARTED',problem_code:known.has(e?.message)?e.message:'LOCAL_SOURCE_OR_TERMINAL_REVIEW_REQUIRED',actual_hosted_requests:0,Auth_requests:0,exit_code:1};}
 finally{terminal?.close();}
 process.stdout.write('\nBEGIN SAFE BATCH V READ ONLY RESULT\n'+JSON.stringify(result,null,2)+'\nEND SAFE BATCH V READ ONLY RESULT\n');process.stdout.write('Stage 3/10 | FR.2/8 | Batch V/Z — '+(result.exit_code===0?'READ ONLY REVIEW COMPLETE; factor changes and full V acceptance remain pending.':'STOPPED FOR REVIEW; no factor change requested.')+'\n');process.exitCode=result.exit_code;
}
