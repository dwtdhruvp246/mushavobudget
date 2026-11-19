import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readPublicZIP} from './lib/read-public-zip.mjs';
import {createPublicZIP} from './lib/store-public-zip.mjs';
export const stage='FR.2.5.W51_PASSWORD_SIGNIN_FASTER_STARTUP';
export const display='Stage 3/10 | FR.2/8 | Batch W/Z';
export const updates=[
 {name:'app.js',source:'app.js',before:'97b3309ccf8d370cd9fb783b267e332f68459d0543039ee745d923720c3343ba',sourceSHA256:'5a9e94ae8c26d828e7fe90b92da46bf4ba696d455d7cc4d08a00ce2dfb30a0ca',after:'5a9e94ae8c26d828e7fe90b92da46bf4ba696d455d7cc4d08a00ce2dfb30a0ca'},
 {name:'app.html',source:'app.html',before:'41b0a005bbc95c69891b451041195de67cc891125d5b3168619293dac1142bf2',sourceSHA256:'56a192ea1d6752ba74237d07e0d7f7cc1c72144406a9a576be6b45e5f9ad57ef',after:'16a79d6c094b586511d8ab03860373cf471e7389b0b12ae4b4b383fb3304c4a1'}
];
const root=new URL('../',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
export function stagingBytes(bytes){return Buffer.from(bytes.toString('utf8').split('kttkospkblwvguuwnhjj').join('dczlddwbtgvfdujgcitb'));}
export function verifySources(){
 const m=JSON.parse(fs.readFileSync(new URL('docs/security-audit/security-fr-2-batch-w-fast-signin-source-manifest.json',root),'utf8'));
 const rows=Object.entries(m.file_sha256||{}),before=Object.entries(m.retained_public_entry_sha256||{});
 if(m.stage_step!==stage||rows.length!==m.source_file_count||rows.length<10||rows.length>60||before.length!==42)throw Error('FAST_SIGNIN_SOURCE_REQUIRED');
 for(const [name,digest]of [...rows,...before])if(!/^[A-Za-z0-9_./-]+$/.test(name)||name.includes('..')||!/^[a-f0-9]{64}$/.test(digest))throw Error('FAST_SIGNIN_SOURCE_REQUIRED');
 for(const [name,digest]of rows){const file=new URL(name,root);if(!fs.lstatSync(file).isFile()||hash(fs.readFileSync(file))!==digest)throw Error('FAST_SIGNIN_SOURCE_REQUIRED');}
 for(const row of updates)if(m.file_sha256[row.source]!==row.sourceSHA256||m.retained_public_entry_sha256[row.name]!==row.before||hash(stagingBytes(fs.readFileSync(new URL(row.source,root))))!==row.after)throw Error('FAST_SIGNIN_SOURCE_REQUIRED');
 return m;
}
export function replaceFastSigninEntries(previous,replacements,expected){
 if(!(previous instanceof Map)||previous.size!==42||!(replacements instanceof Map)||replacements.size!==2
 ||[...replacements.keys()].sort().join(',')!=='app.html,app.js'||Object.keys(expected||{}).length!==42)throw Error('PUBLIC_SET_REQUIRED');
 for(const [name,bytes]of previous)if(!Buffer.isBuffer(bytes)||hash(bytes)!==expected[name])throw Error('ACCEPTED_PASSWORD_SIGNIN_ZIP_REQUIRED');
 const next=new Map(previous);
 for(const [name,bytes]of replacements){if(!Buffer.isBuffer(bytes)||!bytes.length)throw Error('FAST_SIGNIN_SOURCE_REQUIRED');next.set(name,bytes);}
 if(next.size!==42||[...previous].filter(([name,bytes])=>!replacements.has(name)&&bytes.equals(next.get(name))).length!==40)throw Error('UNRELATED_PUBLIC_CHANGE_REFUSED');
 return next;
}
function ordinary(value,directory=false){
 if(typeof value!=='string'||!path.isAbsolute(value))throw Error('PUBLIC_PATH_REQUIRED');
 for(let current=value;;){if(fs.lstatSync(current).isSymbolicLink())throw Error('PUBLIC_PATH_REQUIRED');const parent=path.dirname(current);if(parent===current)break;current=parent;}
 if(directory?!fs.statSync(value).isDirectory():!fs.statSync(value).isFile())throw Error('PUBLIC_PATH_REQUIRED');
}
export function prepareFastSignin(retained,output){
 const m=verifySources();ordinary(retained);ordinary(output,true);
 if(fs.readdirSync(output).length)throw Error('EMPTY_OUTPUT_REQUIRED');
 if(fs.statSync(retained).size>8388608)throw Error('ACCEPTED_PASSWORD_SIGNIN_ZIP_REQUIRED');
 const input=fs.readFileSync(retained),inputHash=hash(input);
 const next=replaceFastSigninEntries(readPublicZIP(input,42),new Map(updates.map(row=>[row.name,stagingBytes(fs.readFileSync(new URL(row.source,root)))])),m.retained_public_entry_sha256);
 const bytes=createPublicZIP([...next]),decoded=readPublicZIP(bytes,42);
 if([...next].some(([name,data])=>!data.equals(decoded.get(name)))||hash(fs.readFileSync(retained))!==inputHash)throw Error('ZIP_READBACK_REQUIRED');
 const filename=path.join(output,'mushavo-fast-signin-staging.zip');fs.writeFileSync(filename,bytes,{flag:'wx'});
 if(!fs.readFileSync(filename).equals(bytes))throw Error('OUTPUT_READBACK_REQUIRED');
 return{stage_step:stage,progress_display:display,result:'FAST_SIGNIN_FRONTEND_ZIP_PREPARED_NOT_DEPLOYED',source_parent_commit:'3e5f04e429cc903f6837912b5345fd5068fad5a7',
 source_hashes_verified:m.source_file_count,public_files:42,changed_files:['app.js','app.html'],unchanged_public_entries:40,
 configuration_Worker_service_worker_headers_routes_and_auth_policy_byte_preserved:true,retained_ZIP_unchanged:true,retained_ZIP_SHA256:inputHash,
 ZIP_path:filename,ZIP_SHA256:hash(bytes),portable_ZIP_readback_verified:true,Windows_dotNET_ZIP_readback_verified:false,
 SQL_rerun_required:false,actual_hosted_requests:0,real_email_requests:0,settings_SQL_or_account_writes:0,frontend_uploaded:false,
 live_speed_improvement_verified:false,full_lettered_batch_W_complete:false,hosted_acceptance:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],exit_code:0};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==4)throw Error('PUBLIC_PATH_REQUIRED');console.log(JSON.stringify(prepareFastSignin(process.argv[2],process.argv[3]),null,2));}
 catch(error){const known=new Set(['FAST_SIGNIN_SOURCE_REQUIRED','PUBLIC_SET_REQUIRED','ACCEPTED_PASSWORD_SIGNIN_ZIP_REQUIRED','UNRELATED_PUBLIC_CHANGE_REFUSED','PUBLIC_PATH_REQUIRED','EMPTY_OUTPUT_REQUIRED','ZIP_READBACK_REQUIRED','OUTPUT_READBACK_REQUIRED']);
  console.log(JSON.stringify({stage_step:stage,progress_display:display,result:'FAST_SIGNIN_PREPARATION_REVIEW_REQUIRED',problem_code:known.has(error?.message)?error.message:'PUBLIC_ZIP_OR_SOURCE_REQUIRED',actual_hosted_requests:0,real_email_requests:0,settings_SQL_or_account_writes:0,frontend_uploaded:false,SQL_rerun_required:false,hosted_acceptance:false,exit_code:1},null,2));process.exitCode=1;}
}
