// Coordinated staging package: exact retained public ZIP plus private SQL sidecar.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readCanonicalPublicZIP} from './prepare-fr-2-email-modern-package.mjs';
import {createPublicZIP} from './lib/store-public-zip.mjs';
export const stage='FR.2.5.W10_SIGNUP_LINK_BROWSER_TRUST_AND_PERSISTENT_DEVICE_APPROVAL';
export const display='Stage 3/10 | FR.2/8 | Batch W/Z';
export const retainedZIPHash='ccc7ce4c5425fb88570fec7d931eba00a9dc71d50ded1968ad764e314949a6eb';
const root=new URL('../',import.meta.url),hash=x=>createHash('sha256').update(x).digest('hex');
export const publicUpdates=[
 {name:'auth-flows.js',source:'auth-flows.js',before:'ffee5b12df573326bf370be955ab5efb3dd12d9c96cedecec317b08fe7f808ea'},
 {name:'auth.html',source:'auth.html',before:'7dc63cebb5001e156cbec642594f512cc886f05f5dff8b3fa8ff621044d28b65'},
 {name:'auth-security.js',source:'auth-security.js',before:'5a536b4913a91f7575e4841e96c29c2686b07bffa0a36337757bba738bf2e762'},
 {name:'email-verification.js',source:'email-verification.js',before:'ae466d7272ae06e66d41848efa356132390aa0efe2c982b371bc2815b2be012d'},
 {name:'session-entry.js',source:'session-entry.js',before:'8ddf940ae5be0856ac85a20e3445995e535aac61e7d33c2379f89fb2e0125e58'},
 {name:'styles.css',source:'styles.css',before:'ae8314094adb97dc0ec07023eb783570d1f952e994fb5f885b889c2227ce4eb6'},
 {name:'_worker.js',source:'deployment/candidates/email-persistent-browser.pages.mjs',before:'a7cbfa8b257eb7a53185fc57cc93a8315bbc453fd0bbbd3cc3b2a5e3cf4ee651'}
];
export function verifyBrowserTrustSources(){
 const manifest=JSON.parse(fs.readFileSync(new URL('docs/security-audit/security-fr-2-batch-w-browser-trust-source-manifest.json',root),'utf8'));
 const rows=Object.entries(manifest.file_sha256||{});
 if(manifest.stage_step!==stage||rows.length!==manifest.source_file_count||rows.length<25)throw Error('BROWSER_TRUST_SOURCE_REQUIRED');
 for(const[name,digest]of rows){
  if(!/^[A-Za-z0-9_./-]+$/.test(name)||name.includes('..')||!/^[a-f0-9]{64}$/.test(digest))throw Error('BROWSER_TRUST_SOURCE_REQUIRED');
  const file=new URL(name,root);if(!fs.lstatSync(file).isFile()||hash(fs.readFileSync(file))!==digest)throw Error('BROWSER_TRUST_SOURCE_REQUIRED');
 }
 for(const row of publicUpdates)if(!manifest.file_sha256[row.source])throw Error('BROWSER_TRUST_SOURCE_REQUIRED');
 return manifest;
}
// Pure archive patcher. The CLI supplies only the pinned seven-entry replacement map.
export function replacePublicEntries(previous,replacements){
 if(!(previous instanceof Map)||previous.size!==44||!(replacements instanceof Map)||replacements.size!==7
 ||[...replacements.keys()].sort().join(',')!==publicUpdates.map(x=>x.name).sort().join(','))throw Error('PUBLIC_SET_REQUIRED');
 const next=new Map(previous);
 for(const[name,{before,bytes}]of replacements){
  if(!Buffer.isBuffer(previous.get(name))||hash(previous.get(name))!==before)throw Error('PRIOR_BROWSER_TRUST_SOURCE_REQUIRED');
  if(!Buffer.isBuffer(bytes)||!bytes.length)throw Error('BROWSER_TRUST_SOURCE_REQUIRED');next.set(name,bytes);
 }
 if([...previous].filter(([name,bytes])=>!replacements.has(name)&&Buffer.isBuffer(bytes)&&bytes.equals(next.get(name))).length!==37)throw Error('UNRELATED_PUBLIC_CHANGE_REFUSED');
 return next;
}
function ordinary(filename,directory=false){
 if(typeof filename!=='string'||!path.isAbsolute(filename))throw Error('PUBLIC_PATH_REQUIRED');
 for(let current=filename;;){if(fs.lstatSync(current).isSymbolicLink())throw Error('PUBLIC_PATH_REQUIRED');const parent=path.dirname(current);if(parent===current)break;current=parent;}
 if(directory?!fs.statSync(filename).isDirectory():!fs.statSync(filename).isFile())throw Error('PUBLIC_PATH_REQUIRED');
}
export function prepareBrowserTrustZIP(retainedZIP,outputDirectory){
 const manifest=verifyBrowserTrustSources();ordinary(retainedZIP);ordinary(outputDirectory,true);
 if(fs.readdirSync(outputDirectory).length)throw Error('EMPTY_OUTPUT_REQUIRED');
 if(fs.statSync(retainedZIP).size>8388608)throw Error('RETAINED_CONFIRMATION_ZIP_REQUIRED');
 const previousBytes=fs.readFileSync(retainedZIP);if(hash(previousBytes)!==retainedZIPHash)throw Error('RETAINED_CONFIRMATION_ZIP_REQUIRED');
 const replacements=new Map(publicUpdates.map(row=>[row.name,{before:row.before,bytes:fs.readFileSync(new URL(row.source,root))}]));
 const next=replacePublicEntries(readCanonicalPublicZIP(previousBytes),replacements);
 const bytes=createPublicZIP([...next]),decoded=readCanonicalPublicZIP(bytes);
 if([...next].some(([name,data])=>!data.equals(decoded.get(name)))||hash(fs.readFileSync(retainedZIP))!==retainedZIPHash)throw Error('ZIP_READBACK_REQUIRED');
 const filename=path.join(outputDirectory,'mushavo-trusted-browser-staging.zip');
 const sqlName='supabase/candidates/security_fr_2_5_persistent_device_handoff.sql',sqlBytes=fs.readFileSync(new URL(sqlName,root));
 const sqlPath=path.join(outputDirectory,'install-trusted-browser-staging.sql');
 fs.writeFileSync(filename,bytes,{flag:'wx'});fs.writeFileSync(sqlPath,sqlBytes,{flag:'wx'});
 if(!fs.readFileSync(filename).equals(bytes)||!fs.readFileSync(sqlPath).equals(sqlBytes)||hash(fs.readFileSync(retainedZIP))!==retainedZIPHash)throw Error('ZIP_READBACK_REQUIRED');
 const receipt={stage_step:stage,progress_display:display,result:'PERSISTENT_BROWSER_TRUST_SQL_AND_PUBLIC_ZIP_PREPARED_NOT_APPLIED',
  source_parent_commit:'187e330160b43f0229e425a9803ee5cb1a453369',source_hashes_verified:manifest.source_file_count,
  public_files:44,changed_files:publicUpdates.map(x=>x.name),unchanged_public_entries:37,
  retained_ZIP_SHA256_verified:retainedZIPHash,retained_ZIP_unchanged:true,
  configuration_service_worker_headers_routes_and_prior_short_messages_preserved:true,
  existing_limiter_bundle_unchanged:true,ZIP_path:filename,ZIP_SHA256:hash(bytes),SQL_path:sqlPath,SQL_SHA256:hash(sqlBytes),
  public_entry_sha256:Object.fromEntries([...next].map(([name,data])=>[name,hash(data)])),
  portable_ZIP_readback_verified:true,Windows_dotNET_ZIP_readback_verified:false,
  actual_hosted_requests:0,real_email_requests:0,settings_or_mode_or_account_writes:0,
  database_upgrade_applied:false,frontend_uploaded:false,hosted_acceptance:false,
  pending_batch_V_MFA_deferred_by_owner:true,full_lettered_batch_W_complete:false,
  production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],exit_code:0};
 fs.writeFileSync(path.join(outputDirectory,'browser-trust-package.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
 return receipt;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==4)throw Error('PUBLIC_PATH_REQUIRED');console.log(JSON.stringify(prepareBrowserTrustZIP(process.argv[2],process.argv[3]),null,2));}
 catch(error){const known=new Set(['PUBLIC_PATH_REQUIRED','PUBLIC_SET_REQUIRED','BROWSER_TRUST_SOURCE_REQUIRED','PRIOR_BROWSER_TRUST_SOURCE_REQUIRED','UNRELATED_PUBLIC_CHANGE_REFUSED','EMPTY_OUTPUT_REQUIRED','RETAINED_CONFIRMATION_ZIP_REQUIRED','ZIP_READBACK_REQUIRED']);
  console.log(JSON.stringify({stage_step:stage,progress_display:display,result:'BROWSER_TRUST_PREPARATION_REVIEW_REQUIRED',problem_code:known.has(error?.message)?error.message:'PUBLIC_ZIP_OR_SOURCE_REQUIRED',
   actual_hosted_requests:0,real_email_requests:0,settings_or_mode_or_account_writes:0,frontend_uploaded:false,database_upgrade_applied:false,
   pending_batch_V_MFA_deferred_by_owner:true,hosted_acceptance:false,production_or_native_changed:false,exit_code:1},null,2));process.exitCode=1;
 }
}
