// Patch only recovery entry UI in the exact accepted staging archive. No deployment, SQL or email.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readCanonicalPublicZIP} from './prepare-fr-2-email-modern-package.mjs';
import {createPublicZIP} from './lib/store-public-zip.mjs';
const root=new URL('../',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
export const stage='FR.2.5.W35_RECOVERY_CODE_VERIFIED_AUTOMATIC_APP_ENTRY';
export const display='Stage 3/10 | FR.2/8 | Batch W/Z';
export const retainedZIPHash='53437a8f2b452b387f75bcbca512b08e08f29a6b446f33de28660154a03301f5';
export const updates=[
 {name:'auth-flows.js',before:'22d5003ac45a2910138e99d7bf812887c84c3f0d69ecaf050a7351b4f9d81695',after:'d22778e9f3b21180d30161a6588b4675f73ac5c2f939bc4b82c224a81106cffa'},
 {name:'auth-security.js',before:'81876a4032c49759e1df241ebef193b58681e2de4d52899c28cb4d9c65a6a6ee',after:'dbe1d2ef5edce2a626bb08375cd38dff2217a56e6393477474678052d14ec4da'},
 {name:'auth.html',before:'40bf13e33c7287398ebed8790e9c87be5f497b8ddabf7465abde39eaf8b846e6',after:'e07cffa1be014ad28197b402978020e7b7e40b79797d9ea64cc485d87870fb4e'}
];
export function verifySources(){
 const m=JSON.parse(fs.readFileSync(new URL('docs/security-audit/security-fr-2-batch-w-auto-entry-source-manifest.json',root),'utf8'));
 const rows=Object.entries(m.file_sha256||{});
 if(m.stage_step!==stage||rows.length!==m.source_file_count||rows.length<12||rows.length>50)throw Error('AUTO_ENTRY_SOURCE_REQUIRED');
 for(const[name,digest]of rows){
  if(!/^[A-Za-z0-9_./-]+$/.test(name)||name.includes('..')||!/^[a-f0-9]{64}$/.test(digest))throw Error('AUTO_ENTRY_SOURCE_REQUIRED');
  const p=new URL(name,root);if(!fs.lstatSync(p).isFile()||hash(fs.readFileSync(p))!==digest)throw Error('AUTO_ENTRY_SOURCE_REQUIRED');
 }
 for(const row of updates)if(m.file_sha256[row.name]!==row.after)throw Error('AUTO_ENTRY_SOURCE_REQUIRED');
 return rows.length;
}
export function replaceEntries(previous,replacements){
 if(!(previous instanceof Map)||previous.size!==44||!(replacements instanceof Map)||replacements.size!==3
 ||[...replacements.keys()].sort().join(',')!==updates.map(x=>x.name).sort().join(','))throw Error('PUBLIC_SET_REQUIRED');
 const next=new Map(previous);
 for(const[name,{before,bytes}]of replacements){
  if(!Buffer.isBuffer(previous.get(name))||hash(previous.get(name))!==before)throw Error('PRIOR_AUTO_ENTRY_SOURCE_REQUIRED');
  if(!Buffer.isBuffer(bytes)||!bytes.length)throw Error('AUTO_ENTRY_SOURCE_REQUIRED');next.set(name,bytes);
 }
 if([...previous].filter(([name,b])=>!replacements.has(name)&&Buffer.isBuffer(b)&&b.equals(next.get(name))).length!==41)throw Error('UNRELATED_PUBLIC_CHANGE_REFUSED');
 return next;
}
function ordinary(filename,directory=false){
 if(typeof filename!=='string'||!path.isAbsolute(filename))throw Error('PUBLIC_PATH_REQUIRED');
 for(let current=filename;;){if(fs.lstatSync(current).isSymbolicLink())throw Error('PUBLIC_PATH_REQUIRED');const parent=path.dirname(current);if(parent===current)break;current=parent;}
 if(directory?!fs.statSync(filename).isDirectory():!fs.statSync(filename).isFile())throw Error('PUBLIC_PATH_REQUIRED');
}
export function prepareAutoEntryZIP(retained,output){
 const count=verifySources();ordinary(retained);ordinary(output,true);
 if(fs.readdirSync(output).length)throw Error('EMPTY_OUTPUT_REQUIRED');
 if(fs.statSync(retained).size>8388608)throw Error('ACCEPTED_BROWSER_TRUST_ZIP_REQUIRED');
 const prior=fs.readFileSync(retained);if(hash(prior)!==retainedZIPHash)throw Error('ACCEPTED_BROWSER_TRUST_ZIP_REQUIRED');
 const next=replaceEntries(readCanonicalPublicZIP(prior),new Map(updates.map(row=>[row.name,{before:row.before,bytes:fs.readFileSync(new URL(row.name,root))}])));
 const bytes=createPublicZIP([...next]),decoded=readCanonicalPublicZIP(bytes);
 if([...next].some(([name,b])=>!b.equals(decoded.get(name)))||hash(fs.readFileSync(retained))!==retainedZIPHash)throw Error('ZIP_READBACK_REQUIRED');
 const filename=path.join(output,'mushavo-auto-signin-staging.zip');fs.writeFileSync(filename,bytes,{flag:'wx'});
 if(!fs.readFileSync(filename).equals(bytes))throw Error('ZIP_READBACK_REQUIRED');
 return{stage_step:stage,progress_display:display,result:'RECOVERY_AUTO_SIGNIN_PUBLIC_ZIP_PREPARED_NOT_DEPLOYED',
 source_parent_commit:'90f992f168847aee897f47feca6a411f57b1149d',source_hashes_verified:count,
 public_files:44,changed_files:updates.map(x=>x.name),unchanged_public_entries:41,
 retained_ZIP_SHA256_verified:retainedZIPHash,retained_ZIP_unchanged:true,
 configuration_worker_service_worker_headers_routes_and_existing_short_messages_preserved:true,
 ZIP_path:filename,ZIP_SHA256:hash(bytes),portable_ZIP_readback_verified:true,Windows_dotNET_ZIP_readback_verified:false,
 actual_hosted_requests:0,real_email_requests:0,settings_SQL_or_account_writes:0,frontend_uploaded:false,
 pending_batch_V_MFA_deferred_by_owner:true,full_lettered_batch_W_complete:false,hosted_acceptance:false,
 production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],exit_code:0};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==4)throw Error('PUBLIC_PATH_REQUIRED');console.log(JSON.stringify(prepareAutoEntryZIP(process.argv[2],process.argv[3]),null,2));}
 catch(error){const known=new Set(['AUTO_ENTRY_SOURCE_REQUIRED','PUBLIC_SET_REQUIRED','PRIOR_AUTO_ENTRY_SOURCE_REQUIRED','UNRELATED_PUBLIC_CHANGE_REFUSED','PUBLIC_PATH_REQUIRED','EMPTY_OUTPUT_REQUIRED','ACCEPTED_BROWSER_TRUST_ZIP_REQUIRED','ZIP_READBACK_REQUIRED']);
 console.log(JSON.stringify({stage_step:stage,progress_display:display,result:'RECOVERY_AUTO_ENTRY_PREPARATION_REVIEW_REQUIRED',problem_code:known.has(error?.message)?error.message:'PUBLIC_ZIP_OR_SOURCE_REQUIRED',actual_hosted_requests:0,real_email_requests:0,settings_SQL_or_account_writes:0,frontend_uploaded:false,hosted_acceptance:false,production_or_native_changed:false,exit_code:1},null,2));process.exitCode=1;}
}
