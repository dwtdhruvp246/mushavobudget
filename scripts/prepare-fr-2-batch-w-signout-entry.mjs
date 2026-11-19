// Patch only explicit sign-out/manual-entry UI in the exact accepted staging archive. No deployment, SQL or email.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readCanonicalPublicZIP} from './prepare-fr-2-email-modern-package.mjs';
import {createPublicZIP} from './lib/store-public-zip.mjs';
import {updates as priorSmoothUpdates,acceptedEntryHashes as priorAutoEntryHashes} from './prepare-fr-2-batch-w-smooth-signin.mjs';
const root=new URL('../',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
export const stage='FR.2.5.W42_SIGNOUT_RELOAD_MANUAL_ENTRY_AND_LOGOUT_RETRY';
export const display='Stage 3/10 | FR.2/8 | Batch W/Z';
export const retainedZIPHash='e49c866aa56aa3d634ef78cf8ea37c77e5a19143e7a5e0a5e63f67e28c8cb05e';
export const updates=[
 {
  "name": "app.js",
  "before": "c18946c75ae34a52f91ecb755ec29e7c50f92628829180035096fdfbfdb5c0c6",
  "sourceSHA256": "ceea0458d1aab933bc09c3fa56a8d521e70844d35004e8d22917d9e0084e9b18",
  "after": "ceea0458d1aab933bc09c3fa56a8d521e70844d35004e8d22917d9e0084e9b18"
 },
 {
  "name": "app.html",
  "before": "96933b18fda558f1a423f76d974153b1a940aee192081a65640d888d0f855e64",
  "sourceSHA256": "6a0393a4193ed06683de2de4d21bddcad429effeb0edc5d1e79c0ef9f6b29450",
  "after": "36e81de97af90556b76ec80e696fa77b527acca9dcf4a323d428245926a48294"
 }
];

const productionProject='kttkospkblwvguuwnhjj',stagingProject='dczlddwbtgvfdujgcitb';
// Match the established staging export; repository HTML keeps production preconnects.
export function stagingPublicBytes(bytes){
 if(!Buffer.isBuffer(bytes)||!bytes.length)throw Error('SIGNOUT_ENTRY_SOURCE_REQUIRED');
 return Buffer.from(bytes.toString('utf8').split(productionProject).join(stagingProject));
}
export function acceptedEntryHashes(){
 const entries=priorAutoEntryHashes();
 for(const row of priorSmoothUpdates)entries[row.name]=row.after;
 return entries;
}
export function verifySources(){
 const m=JSON.parse(fs.readFileSync(new URL('docs/security-audit/security-fr-2-batch-w-signout-entry-source-manifest.json',root),'utf8'));
 const rows=Object.entries(m.file_sha256||{});
 if(m.stage_step!==stage||rows.length!==m.source_file_count||rows.length<12||rows.length>50)throw Error('SIGNOUT_ENTRY_SOURCE_REQUIRED');
 for(const[name,digest]of rows){
  if(!/^[A-Za-z0-9_./-]+$/.test(name)||name.includes('..')||!/^[a-f0-9]{64}$/.test(digest))throw Error('SIGNOUT_ENTRY_SOURCE_REQUIRED');
  const p=new URL(name,root);if(!fs.lstatSync(p).isFile()||hash(fs.readFileSync(p))!==digest)throw Error('SIGNOUT_ENTRY_SOURCE_REQUIRED');
 }
 const prior=acceptedEntryHashes();
 for(const row of updates){
  if(m.file_sha256[row.name]!==row.sourceSHA256||prior[row.name]!==row.before||hash(stagingPublicBytes(fs.readFileSync(new URL(row.name,root))))!==row.after)throw Error('SIGNOUT_ENTRY_SOURCE_REQUIRED');
 }
 return rows.length;
}
export function replaceEntries(previous,replacements){
 if(!(previous instanceof Map)||previous.size!==44||!(replacements instanceof Map)||replacements.size!==updates.length
 ||[...replacements.keys()].sort().join(',')!==updates.map(x=>x.name).sort().join(','))throw Error('PUBLIC_SET_REQUIRED');
 const next=new Map(previous);
 for(const[name,{before,bytes}]of replacements){
  if(!Buffer.isBuffer(previous.get(name))||hash(previous.get(name))!==before)throw Object.assign(Error('PRIOR_SIGNOUT_ENTRY_SOURCE_REQUIRED'),{problem_file:name});
  if(!Buffer.isBuffer(bytes)||!bytes.length)throw Error('SIGNOUT_ENTRY_SOURCE_REQUIRED');next.set(name,bytes);
 }
 if([...previous].filter(([name,b])=>!replacements.has(name)&&Buffer.isBuffer(b)&&b.equals(next.get(name))).length!==44-updates.length)throw Error('UNRELATED_PUBLIC_CHANGE_REFUSED');
 return next;
}
function ordinary(filename,directory=false){
 if(typeof filename!=='string'||!path.isAbsolute(filename))throw Error('PUBLIC_PATH_REQUIRED');
 for(let current=filename;;){if(fs.lstatSync(current).isSymbolicLink())throw Error('PUBLIC_PATH_REQUIRED');const parent=path.dirname(current);if(parent===current)break;current=parent;}
 if(directory?!fs.statSync(filename).isDirectory():!fs.statSync(filename).isFile())throw Error('PUBLIC_PATH_REQUIRED');
}
export function prepareSignoutEntryZIP(retained,output){
 const count=verifySources();ordinary(retained);ordinary(output,true);
 if(fs.readdirSync(output).length)throw Error('EMPTY_OUTPUT_REQUIRED');
 if(fs.statSync(retained).size>8388608)throw Error('ACCEPTED_SMOOTH_SIGNIN_ZIP_REQUIRED');
 const prior=fs.readFileSync(retained);if(hash(prior)!==retainedZIPHash)throw Error('ACCEPTED_SMOOTH_SIGNIN_ZIP_REQUIRED');
 const next=replaceEntries(readCanonicalPublicZIP(prior),new Map(updates.map(row=>[row.name,{before:row.before,bytes:stagingPublicBytes(fs.readFileSync(new URL(row.name,root)))}])));
 const bytes=createPublicZIP([...next]),decoded=readCanonicalPublicZIP(bytes);
 if([...next].some(([name,b])=>!b.equals(decoded.get(name)))||hash(fs.readFileSync(retained))!==retainedZIPHash)throw Error('ZIP_READBACK_REQUIRED');
 const filename=path.join(output,'mushavo-signout-entry-staging.zip');fs.writeFileSync(filename,bytes,{flag:'wx'});
 if(!fs.readFileSync(filename).equals(bytes))throw Error('ZIP_READBACK_REQUIRED');
 return{stage_step:stage,progress_display:display,result:'SIGNOUT_ENTRY_PUBLIC_ZIP_PREPARED_NOT_DEPLOYED',
 source_parent_commit:'2e395b7d9b5e3ef38f8f4c924da5e0d34f0ea3fa',source_hashes_verified:count,
 public_files:44,changed_files:updates.map(x=>x.name),unchanged_public_entries:44-updates.length,
 retained_ZIP_SHA256_verified:retainedZIPHash,retained_ZIP_unchanged:true,
 configuration_worker_service_worker_headers_and_routes_byte_preserved:true,
 staging_project_references_preserved:true,prior_entry_hashes_matched_recorded_package_chain:true,
 ZIP_path:filename,ZIP_SHA256:hash(bytes),portable_ZIP_readback_verified:true,Windows_dotNET_ZIP_readback_verified:false,
 actual_hosted_requests:0,real_email_requests:0,settings_SQL_or_account_writes:0,frontend_uploaded:false,
 pending_batch_V_MFA_deferred_by_owner:true,full_lettered_batch_W_complete:false,hosted_acceptance:false,
 production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],exit_code:0};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==4)throw Error('PUBLIC_PATH_REQUIRED');console.log(JSON.stringify(prepareSignoutEntryZIP(process.argv[2],process.argv[3]),null,2));}
 catch(error){const known=new Set(['SIGNOUT_ENTRY_SOURCE_REQUIRED','PUBLIC_SET_REQUIRED','PRIOR_SIGNOUT_ENTRY_SOURCE_REQUIRED','UNRELATED_PUBLIC_CHANGE_REFUSED','PUBLIC_PATH_REQUIRED','EMPTY_OUTPUT_REQUIRED','ACCEPTED_SMOOTH_SIGNIN_ZIP_REQUIRED','ZIP_READBACK_REQUIRED']);
 console.log(JSON.stringify({stage_step:stage,progress_display:display,result:'SIGNOUT_ENTRY_PREPARATION_REVIEW_REQUIRED',problem_code:known.has(error?.message)?error.message:'PUBLIC_ZIP_OR_SOURCE_REQUIRED',problem_file:updates.some(row=>row.name===error?.problem_file)?error.problem_file:undefined,actual_hosted_requests:0,real_email_requests:0,settings_SQL_or_account_writes:0,frontend_uploaded:false,hosted_acceptance:false,production_or_native_changed:false,exit_code:1},null,2));process.exitCode=1;}
}
