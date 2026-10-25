import {readFile,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {setupBatchVRecovery,stage,acknowledgements} from './lib/admin-batch-v-recovery.mjs';
import {privateTerminal} from './lib/operator-private-terminal.mjs';
export async function verifyRecoverySources(){
 const root=fileURLToPath(new URL('../',import.meta.url)),m=JSON.parse(await readFile(new URL('../docs/security-audit/security-fr-2-batch-v-recovery-source-manifest.json',import.meta.url),'utf8'));
 if(m.stage_step!==stage||Object.keys(m.file_sha256).length!==m.source_file_count)throw Error('SOURCE_MANIFEST_REQUIRED');
 for(const [name,expected]of Object.entries(m.file_sha256)){if(!/^[A-Za-z0-9_./-]+$/.test(name)||name.includes('..')||path.isAbsolute(name)||!/^[a-f0-9]{64}$/.test(expected))throw Error('SOURCE_MANIFEST_REQUIRED');for(let p=path.join(root,name);;){if((await lstat(p)).isSymbolicLink())throw Error('SOURCE_PATH_REQUIRED');const parent=path.dirname(p);if(parent===p)break;p=parent;}if(createHash('sha256').update(await readFile(path.join(root,name))).digest('hex')!==expected)throw Error('SOURCE_IDENTITY_REQUIRED');}
 const u=JSON.parse(await readFile(new URL('../docs/security-audit/security-fr-2-email-batch-u-hosted-source-manifest.json',import.meta.url),'utf8'));if(u.source_file_count!==310||Object.entries(u.file_sha256).some(([n,h])=>m.file_sha256[n]!==h))throw Error('FROZEN_U_SOURCE_REQUIRED');return m.source_file_count;
}

export async function recoveryEntry({sourceCheck=verifyRecoverySources,io,transport}={}){
 const hashes=await sourceCheck();
 io.notice('Stage 3/10 | FR.2/8 | Batch V/Z — current MFA recovery. Prior enrollment origin remains unknown. No Admin roles or mode changes.');
 io.notice('Choose privately based on your CURRENT phone: 1 = saved Mushavo STAGING RECOVERY entry is usable; 2 = phone ready but no usable RECOVERY entry; 3 = phone transfer unfinished / cancel.');
 const choice=await io.prompt('Choose 1, 2 or 3 (visible):',false);
 if(choice==='3')return {stage_step:stage,progress_display:'Stage 3/10 | FR.2/8 | Batch V/Z',result:'BATCH_V_PHONE_NOT_READY_NO_HOSTED_ACTION',actual_hosted_requests:0,Auth_requests:0,factor_changes_requested:false,exit_code:1,source_hashes_verified:hashes};
 if(!['1','2'].includes(choice))throw Error('OWNER_CHOICE_REQUIRED');
 const mode=choice==='1'?'RESUME':'RECOVER';
 const input={mode,managementToken:(await io.prompt('Same staging Management token (hidden):')).trim(),primaryEmail:(await io.prompt('Existing PRIMARY operator email (visible locally):',false)).trim(),recoveryEmail:(await io.prompt('Existing separate RECOVERY operator email (visible locally):',false)).trim(),acknowledgement:acknowledgements[mode]};
 io.notice('Selected accounts:\n1: PRIMARY '+input.primaryEmail+'\n2: RECOVERY '+input.recoveryEmail);
 io.notice(mode==='RESUME'?'RESUME: use the saved RECOVERY code without deleting/re-enrolling it; then set up missing PRIMARY MFA. First password belongs to RECOVERY '+input.recoveryEmail+'.':'RECOVER: prove working PRIMARY MFA first; replace only the exact reviewed unverified RECOVERY factor if present. Provider enrollment may expire that reviewed unused factor. Previously verified entries are retained; a currently verified RECOVERY factor blocks replacement. First password belongs to PRIMARY '+input.primaryEmail+'.');
 if(await io.prompt('Type '+mode+' to accept this exact staging action (visible):',false)!==mode)throw Error('OWNER_CANCELLED');
 try{
  const result=await setupBatchVRecovery(input,{transport,io:{
   password:slot=>{io.clear?.();return io.prompt(slot+' staging APP password for '+(slot==='PRIMARY'?input.primaryEmail:input.recoveryEmail)+' (hidden):');},
   code:(slot,{fresh,retry})=>io.prompt(slot+(fresh?' NEW changing authenticator code':' authenticator code')+(retry?' — retry':'')+' (hidden):'),setup:io.setup,notice:io.notice}});
  result.source_hashes_verified=hashes;return result;
 }finally{input.managementToken='';input.primaryEmail='';input.recoveryEmail='';}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 let terminal,result;
 try{
  if(process.argv.length!==3||process.argv[2]!=='--staging-operator-recovery')throw Error('STAGING_ARGUMENT_REQUIRED');
  if(Object.entries(process.env).some(([k,v])=>v&&/^(?:NODE_OPTIONS|NODE_DEBUG|NODE_DEBUG_NATIVE|NODE_TLS_REJECT_UNAUTHORIZED|SSLKEYLOGFILE|SUPABASE_.*|ZOHO_.*|EMAIL_GATE_.*|CLOUDFLARE_.*|CF_API_.*|WRANGLER_.*)$|(?:TOKEN|PASSWORD|SECRET)$/i.test(k)))throw Error('PRIVATE_ENVIRONMENT_REVIEW_REQUIRED');
  terminal=privateTerminal();result=await recoveryEntry({io:terminal});
 }catch(e){const allowed=new Set(['STAGING_ARGUMENT_REQUIRED','PRIVATE_ENVIRONMENT_REVIEW_REQUIRED','SOURCE_MANIFEST_REQUIRED','SOURCE_PATH_REQUIRED','SOURCE_IDENTITY_REQUIRED','FROZEN_U_SOURCE_REQUIRED','PRIVATE_INTERACTIVE_TERMINAL_REQUIRED','OWNER_CANCELLED','OWNER_CHOICE_REQUIRED']);result={stage_step:stage,progress_display:'Stage 3/10 | FR.2/8 | Batch V/Z',result:'BATCH_V_PRIVATE_RECOVERY_NOT_STARTED',problem_code:allowed.has(e?.message)?e.message:'LOCAL_SOURCE_OR_TERMINAL_REVIEW_REQUIRED',actual_hosted_requests:0,Auth_requests:0,exit_code:1};}
 finally{terminal?.close();}
 process.stdout.write('\nBEGIN SAFE BATCH V RECOVERY RESULT\n'+JSON.stringify(result,null,2)+'\nEND SAFE BATCH V RECOVERY RESULT\n');
 process.stdout.write('Stage 3/10 | FR.2/8 | Batch V/Z — '+(result.exit_code===0?'MFA RECOVERY COMPLETE; Admin enforcement and full V acceptance remain pending.':'STOPPED FOR REVIEW; do not rerun enrollment/deletion or replace factors blindly.')+'\n');process.exitCode=result.exit_code;
}
