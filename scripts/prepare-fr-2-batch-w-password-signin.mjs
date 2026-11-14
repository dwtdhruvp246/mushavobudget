import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readPublicZIP} from './lib/read-public-zip.mjs';
import {createPublicZIP} from './lib/store-public-zip.mjs';
export const stage='FR.2.5.W49_PASSWORD_SIGNIN_SQL_LINE_ENDINGS';
export const display='Stage 3/10 | FR.2/8 | Batch W/Z';
export const retainedZIPHash='e7de4e1b90d46a1503be5cf77fe7974b32d650fd526cb473c39002fe8cf1675b';
export const removedPublicFiles=['email-verification.js','admin-mfa.js'];
export const updates=[
  {
    "name": "app.js",
    "source": "app.js",
    "before": "ceea0458d1aab933bc09c3fa56a8d521e70844d35004e8d22917d9e0084e9b18",
    "sourceSHA256": "97b3309ccf8d370cd9fb783b267e332f68459d0543039ee745d923720c3343ba",
    "after": "97b3309ccf8d370cd9fb783b267e332f68459d0543039ee745d923720c3343ba"
  },
  {
    "name": "app.html",
    "source": "app.html",
    "before": "36e81de97af90556b76ec80e696fa77b527acca9dcf4a323d428245926a48294",
    "sourceSHA256": "0de1633cc3498642b9bba979f6a06be6079e0d15862442c14dc8420a3818a5cc",
    "after": "41b0a005bbc95c69891b451041195de67cc891125d5b3168619293dac1142bf2"
  },
  {
    "name": "business.js",
    "source": "business.js",
    "before": "b7fa416d4f56468842da986a6290796a0b482fdc2c4feda32521624681de608f",
    "sourceSHA256": "80c67ffb9af7aab8b76db156598cd7ea03234888d28e42eaf91d0aed43376567",
    "after": "80c67ffb9af7aab8b76db156598cd7ea03234888d28e42eaf91d0aed43376567"
  },
  {
    "name": "business.html",
    "source": "business.html",
    "before": "694ecc7041783014c0706f60edb5dbf993e579bb1aaf1d775df8814c827706d1",
    "sourceSHA256": "a502a1826821468f310b6d2987eb8a852b35b57a75b33749c6227869271353c9",
    "after": "77c55d6dfc1f5472c18ff0a341312fda452ffebb5f2ca9c9a14cff0c12328bfc"
  },
  {
    "name": "signup.html",
    "source": "signup.html",
    "before": "1ed89b4df447d145493cb7f795e52485527cd5639ab5879fc174aadc38155dfc",
    "sourceSHA256": "cdfb49dd46b25329d5a4be34654290820d22a0513c9a99e233a50342019bd240",
    "after": "0fcbdf23b1f453fc77d281b80e946f794aa89a71db6ad2996d253b4cd3e1053c"
  },
  {
    "name": "auth.html",
    "source": "auth.html",
    "before": "bc59aedaf62fe83bccf3fcdf8e1503dc49fc3c03be105a5468cd73ae92daaa77",
    "sourceSHA256": "966e2b8e7a10c429c134fb2fa44a83f112c3ae0ca8db118baeb3cbe6a5c8f1dc",
    "after": "966e2b8e7a10c429c134fb2fa44a83f112c3ae0ca8db118baeb3cbe6a5c8f1dc"
  },
  {
    "name": "auth-flows.js",
    "source": "auth-flows.js",
    "before": "795630fc842fa2ee40a4b5ca8b43ad28d32aa1c8480002dac93ad430ebfee23c",
    "sourceSHA256": "3bf445e67347e57f4f746e22baaa16866fd3ecb5570342d729fed8bbe4c47720",
    "after": "3bf445e67347e57f4f746e22baaa16866fd3ecb5570342d729fed8bbe4c47720"
  },
  {
    "name": "auth-security.js",
    "source": "auth-security.js",
    "before": "dbe1d2ef5edce2a626bb08375cd38dff2217a56e6393477474678052d14ec4da",
    "sourceSHA256": "6deb33eb3a976b40e090e94f12c0d028403a1438a7cc11b85acad0ec76229a42",
    "after": "6deb33eb3a976b40e090e94f12c0d028403a1438a7cc11b85acad0ec76229a42"
  },
  {
    "name": "session-entry.js",
    "source": "session-entry.js",
    "before": "970809c0d1ff9e1b170098147026b080dafcef585cf1c8ffd3f1f2f6745811ab",
    "sourceSHA256": "41ef2fd5c7db464788ccfb4b8f9f3ec31ed5686fd3ffe098b3c0ffb661021793",
    "after": "41ef2fd5c7db464788ccfb4b8f9f3ec31ed5686fd3ffe098b3c0ffb661021793"
  },
  {
    "name": "_worker.js",
    "source": "deployment/candidates/password-signin.pages.mjs",
    "before": "af5e4e8a766a7d70c6a745a4b88fd2f760450f9b4321cf56ef59104608032eb5",
    "sourceSHA256": "ae0a55e75a95a4e418f5beea4febffe3b197dc47fa780bcaaf35b7ff6ed6f2f4",
    "after": "ae0a55e75a95a4e418f5beea4febffe3b197dc47fa780bcaaf35b7ff6ed6f2f4"
  }
];
export const SQLFiles=[
  {
    "source": "supabase/candidates/security_fr_2_5_password_signin_upgrade.sql",
    "output": "mushavo-password-signin-staging.sql",
    "sha256": "14637a243fb514b32bab8de8d877181060d7bbb2dee9eb8ec638e35e4bc1e4ad"
  },
  {
    "source": "supabase/candidates/security_fr_2_5_password_signin_rollback.sql",
    "output": "mushavo-password-signin-rollback.sql",
    "sha256": "3ebcb1b32336364287d7a049115454456bed7b20af9dafd917e63d52d3f30376"
  }
];
const root=new URL('../',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
export function stagingBytes(bytes){return Buffer.from(bytes.toString('utf8').split('kttkospkblwvguuwnhjj').join('dczlddwbtgvfdujgcitb'));}
export function verifySources(){
 const manifest=JSON.parse(fs.readFileSync(new URL('docs/security-audit/security-fr-2-batch-w-password-signin-source-manifest.json',root),'utf8'));
 const entries=Object.entries(manifest.file_sha256||{});
 if(manifest.stage_step!==stage||entries.length!==manifest.source_file_count||entries.length<15||entries.length>70||Object.keys(manifest.retained_public_entry_sha256||{}).length!==44)throw Error('PASSWORD_SOURCE_REQUIRED');
 for(const [name,digest]of entries){
  if(!/^[A-Za-z0-9_./-]+$/.test(name)||name.includes('..')||!/^[a-f0-9]{64}$/.test(digest))throw Error('PASSWORD_SOURCE_REQUIRED');
  const file=new URL(name,root);if(!fs.lstatSync(file).isFile()||hash(fs.readFileSync(file))!==digest)throw Error('PASSWORD_SOURCE_REQUIRED');
 }
 for(const row of updates){
  if(manifest.file_sha256[row.source]!==row.sourceSHA256||manifest.retained_public_entry_sha256[row.name]!==row.before||hash(stagingBytes(fs.readFileSync(new URL(row.source,root))))!==row.after)throw Error('PASSWORD_SOURCE_REQUIRED');
 }
 for(const row of SQLFiles)if(manifest.file_sha256[row.source]!==row.sha256)throw Error('PASSWORD_SOURCE_REQUIRED');
 return manifest;
}
export function replacePasswordEntries(previous,replacements,expected){
 if(!(previous instanceof Map)||previous.size!==44||!(replacements instanceof Map)||replacements.size!==updates.length
 ||[...replacements.keys()].sort().join(',')!==updates.map(x=>x.name).sort().join(',')||Object.keys(expected||{}).length!==44)throw Error('PUBLIC_SET_REQUIRED');
 for(const[name,bytes]of previous)if(!Buffer.isBuffer(bytes)||hash(bytes)!==expected[name])throw Object.assign(Error('PRIOR_PUBLIC_SOURCE_REQUIRED'),{problem_file:updates.some(x=>x.name===name)?name:undefined});
 const next=new Map(previous);
 for(const[name,bytes]of replacements){if(!Buffer.isBuffer(bytes)||!bytes.length)throw Error('PASSWORD_SOURCE_REQUIRED');next.set(name,bytes);}
 for(const name of removedPublicFiles){if(!next.delete(name))throw Error('PUBLIC_SET_REQUIRED');}
 if(next.size!==42||[...previous].filter(([name,b])=>!replacements.has(name)&&!removedPublicFiles.includes(name)&&b.equals(next.get(name))).length!==32)throw Error('UNRELATED_PUBLIC_CHANGE_REFUSED');
 return next;
}
function ordinary(value,directory=false){
 if(typeof value!=='string'||!path.isAbsolute(value))throw Error('PUBLIC_PATH_REQUIRED');
 for(let current=value;;){if(fs.lstatSync(current).isSymbolicLink())throw Error('PUBLIC_PATH_REQUIRED');const parent=path.dirname(current);if(parent===current)break;current=parent;}
 if(directory?!fs.statSync(value).isDirectory():!fs.statSync(value).isFile())throw Error('PUBLIC_PATH_REQUIRED');
}
export function preparePasswordSignin(retained,output){
 const m=verifySources();ordinary(retained);ordinary(output,true);
 if(fs.readdirSync(output).length)throw Error('EMPTY_OUTPUT_REQUIRED');
 if(fs.statSync(retained).size>8388608)throw Error('ACCEPTED_SIGNOUT_ZIP_REQUIRED');
 const prior=fs.readFileSync(retained);if(hash(prior)!==retainedZIPHash)throw Error('ACCEPTED_SIGNOUT_ZIP_REQUIRED');
 const next=replacePasswordEntries(readPublicZIP(prior,44),new Map(updates.map(row=>[row.name,stagingBytes(fs.readFileSync(new URL(row.source,root)))])),m.retained_public_entry_sha256);
 const bytes=createPublicZIP([...next]),decoded=readPublicZIP(bytes,42);
 if([...next].some(([name,b])=>!b.equals(decoded.get(name)))||hash(fs.readFileSync(retained))!==retainedZIPHash)throw Error('ZIP_READBACK_REQUIRED');
 const files=[{name:'mushavo-password-signin-staging.zip',bytes},...SQLFiles.map(row=>({name:row.output,bytes:fs.readFileSync(new URL(row.source,root))}))];
 for(const file of files){const filename=path.join(output,file.name);fs.writeFileSync(filename,file.bytes,{flag:'wx'});if(!fs.readFileSync(filename).equals(file.bytes))throw Error('OUTPUT_READBACK_REQUIRED');}
 return{stage_step:stage,progress_display:display,result:'PASSWORD_SIGNIN_ALL_USERS_ZIP_AND_SQL_PREPARED_NOT_APPLIED',
 source_parent_commit:'e7964f3efe1e3546b6b59a05ab48d22d251dfce3',source_hashes_verified:m.source_file_count,
 includes_Admin:true,signup_email_confirmation_preserved:true,role_permissions_preserved:true,
 public_files:42,changed_files:updates.map(x=>x.name),removed_public_files:removedPublicFiles,unchanged_public_entries:32,
 config_service_worker_headers_and_routes_byte_preserved:true,retained_ZIP_unchanged:true,retained_ZIP_SHA256_verified:retainedZIPHash,
 ZIP_path:path.join(output,files[0].name),ZIP_SHA256:hash(bytes),portable_ZIP_readback_verified:true,Windows_dotNET_ZIP_readback_verified:false,
 SQL_path:path.join(output,SQLFiles[0].output),SQL_SHA256:SQLFiles[0].sha256,
 rollback_SQL_path:path.join(output,SQLFiles[1].output),rollback_SQL_SHA256:SQLFiles[1].sha256,
 actual_hosted_requests:0,real_email_requests:0,settings_SQL_or_account_writes:0,frontend_uploaded:false,SQL_applied:false,
 full_lettered_batch_W_complete:false,hosted_acceptance:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],exit_code:0};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==4)throw Error('PUBLIC_PATH_REQUIRED');console.log(JSON.stringify(preparePasswordSignin(process.argv[2],process.argv[3]),null,2));}
 catch(error){const known=new Set(['PASSWORD_SOURCE_REQUIRED','PUBLIC_SET_REQUIRED','PRIOR_PUBLIC_SOURCE_REQUIRED','UNRELATED_PUBLIC_CHANGE_REFUSED','PUBLIC_PATH_REQUIRED','EMPTY_OUTPUT_REQUIRED','ACCEPTED_SIGNOUT_ZIP_REQUIRED','ZIP_READBACK_REQUIRED','OUTPUT_READBACK_REQUIRED']);
 console.log(JSON.stringify({stage_step:stage,progress_display:display,result:'PASSWORD_SIGNIN_PREPARATION_REVIEW_REQUIRED',problem_code:known.has(error?.message)?error.message:'PUBLIC_ZIP_OR_SOURCE_REQUIRED',problem_file:updates.some(x=>x.name===error?.problem_file)?error.problem_file:undefined,actual_hosted_requests:0,real_email_requests:0,settings_SQL_or_account_writes:0,frontend_uploaded:false,SQL_applied:false,hosted_acceptance:false,exit_code:1},null,2));process.exitCode=1;}
}
