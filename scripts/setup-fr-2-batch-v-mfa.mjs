import {readFile,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {setupBatchVMfa,stage,acknowledgement} from './lib/admin-batch-v-mfa.mjs';
import {privateTerminal} from './lib/operator-private-terminal.mjs';
export async function verifySources(){
 const root=fileURLToPath(new URL('../',import.meta.url)),m=JSON.parse(await readFile(new URL('../docs/security-audit/security-fr-2-batch-v-mfa-source-manifest.json',import.meta.url),'utf8'));
 if(m.stage_step!==stage||Object.keys(m.file_sha256).length!==m.source_file_count)throw Error('SOURCE_MANIFEST_REQUIRED');
 for(const [name,expected]of Object.entries(m.file_sha256)){if(!/^[A-Za-z0-9_./-]+$/.test(name)||name.includes('..')||path.isAbsolute(name)||!/^[a-f0-9]{64}$/.test(expected))throw Error('SOURCE_MANIFEST_REQUIRED');for(let p=path.join(root,name);;){if((await lstat(p)).isSymbolicLink())throw Error('SOURCE_PATH_REQUIRED');const parent=path.dirname(p);if(parent===p)break;p=parent;}if(createHash('sha256').update(await readFile(path.join(root,name))).digest('hex')!==expected)throw Error('SOURCE_IDENTITY_REQUIRED');}
 const u=JSON.parse(await readFile(new URL('../docs/security-audit/security-fr-2-email-batch-u-hosted-source-manifest.json',import.meta.url),'utf8'));if(u.source_file_count!==310||Object.entries(u.file_sha256).some(([n,h])=>m.file_sha256[n]!==h))throw Error('FROZEN_U_SOURCE_REQUIRED');return m.source_file_count;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 let terminal,input,result;
 try{
  if(process.argv.length!==3||process.argv[2]!=='--staging-operator-mfa')throw Error('STAGING_ARGUMENT_REQUIRED');
  if(Object.entries(process.env).some(([k,v])=>v&&/^(?:NODE_OPTIONS|NODE_DEBUG|NODE_DEBUG_NATIVE|NODE_TLS_REJECT_UNAUTHORIZED|SSLKEYLOGFILE|SUPABASE_.*|ZOHO_.*|EMAIL_GATE_.*|CLOUDFLARE_.*|CF_API_.*|WRANGLER_.*)$|(?:TOKEN|PASSWORD|SECRET)$/i.test(k)))throw Error('PRIVATE_ENVIRONMENT_REVIEW_REQUIRED');
  const hashes=await verifySources();terminal=privateTerminal();
  terminal.notice('Stage 3/10 | FR.2/8 | Batch V/Z — STARTED: RECOVERY first, exact reviewed unverified PRIMARY only, genuine fresh-session MFA. Keep both authenticator entries. Staging stays quarantined.');
  terminal.notice('Use a private local terminal without transcript, recording or screen sharing. All addresses/passwords/codes stay hidden. The setup key appears only on a temporary private screen.');
  input={managementToken:(await terminal.prompt('Same staging Management token (hidden):')).trim(),primaryEmail:(await terminal.prompt('Existing PRIMARY operator email (hidden):')).trim(),recoveryEmail:(await terminal.prompt('Existing separate RECOVERY operator email (hidden):')).trim(),acknowledgement};
  if(await terminal.prompt('Type SETUP to enroll/reuse both factors and remove ONLY the exact reviewed unverified PRIMARY leftover after RECOVERY passes:',false)!=='SETUP')throw Error('OWNER_CANCELLED');
  result=await setupBatchVMfa(input,{io:{password:slot=>{terminal.clear();return terminal.prompt(slot+' staging APP password (hidden):');},code:(slot,{fresh,retry})=>terminal.prompt(slot+(fresh?' NEW changing authenticator code':' authenticator code')+(retry?' — retry':'')+' (hidden):'),setup:terminal.setup,notice:terminal.notice}});result.source_hashes_verified=hashes;
 }catch(e){const allowed=new Set(['STAGING_ARGUMENT_REQUIRED','PRIVATE_ENVIRONMENT_REVIEW_REQUIRED','SOURCE_MANIFEST_REQUIRED','SOURCE_PATH_REQUIRED','SOURCE_IDENTITY_REQUIRED','FROZEN_U_SOURCE_REQUIRED','PRIVATE_INTERACTIVE_TERMINAL_REQUIRED','OWNER_CANCELLED']);result={stage_step:stage,progress_display:'Stage 3/10 | FR.2/8 | Batch V/Z',result:'BATCH_V_PRIVATE_SETUP_NOT_STARTED',problem_code:allowed.has(e?.message)?e.message:'LOCAL_SOURCE_OR_TERMINAL_REVIEW_REQUIRED',actual_hosted_requests:0,exit_code:1};}
 finally{terminal?.close();input=null;}
 process.stdout.write('\nBEGIN SAFE BATCH V MFA RESULT\n'+JSON.stringify(result,null,2)+'\nEND SAFE BATCH V MFA RESULT\n');process.stdout.write('Stage 3/10 | FR.2/8 | Batch V/Z — '+(result.exit_code===0?'MFA SETUP COMPLETE; Admin enforcement and recovery acceptance remain pending.':'STOPPED FOR REVIEW; do not rerun setup or replace factors blindly.')+'\n');process.exitCode=result.exit_code;
}
