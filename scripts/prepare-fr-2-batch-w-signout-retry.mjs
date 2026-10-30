import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readPublicZIP} from './lib/read-public-zip.mjs';
import {createPublicZIP} from './lib/store-public-zip.mjs';
export const stage='FR.2.5.AU05.05_SIGNOUT_RETRY_FIX';
export const display='Stage 3/10 | FR.2/8 | Batch W/Z';
export const updates=[
  {
    "name": "app.js",
    "source": "app.js",
    "before": "edfced2f479edaf34bdfce1daac5448157cb4b957ee0de631326a3441d4e9a1e",
    "sourceSHA256": "34ebb8fe15c112483f535c86e469e071b5f37e8191a41e6e8e6a36f5c4ab5e76",
    "after": "34ebb8fe15c112483f535c86e469e071b5f37e8191a41e6e8e6a36f5c4ab5e76"
  },
  {
    "name": "app.html",
    "source": "app.html",
    "before": "df9216d3ce1c4717c1e6467a5beed11bed83b45020ded63ae13fd3c034e8d4d7",
    "sourceSHA256": "7613bde43837a44ec2972290d910081b37c4e3c730d795d9d7e1f4670f3d54ed",
    "after": "a900dc61d505321a4a11817fd59cbeb9c432c5dd78772d1c18e45feb4213d0d7"
  }
];
const root=new URL('../',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
export function stagingBytes(bytes){return Buffer.from(bytes.toString('utf8').split('kttkospkblwvguuwnhjj').join('dczlddwbtgvfdujgcitb'));}
export function verifySources(){
 const m=JSON.parse(fs.readFileSync(new URL('docs/security-audit/security-fr-2-batch-w-signout-retry-source-manifest.json',root),'utf8'));
 const rows=Object.entries(m.file_sha256||{}),before=Object.entries(m.retained_public_entry_sha256||{});
 if(m.stage_step!==stage||rows.length!==m.source_file_count||rows.length<5||rows.length>60||before.length!==42)throw Error('SIGNOUT_RETRY_SOURCE_REQUIRED');
 for(const [name,digest]of [...rows,...before])if(!/^[A-Za-z0-9_./-]+$/.test(name)||name.includes('..')||!/^[a-f0-9]{64}$/.test(digest))throw Error('SIGNOUT_RETRY_SOURCE_REQUIRED');
 for(const [name,digest]of rows){const file=new URL(name,root);if(!fs.lstatSync(file).isFile()||hash(fs.readFileSync(file))!==digest)throw Error('SIGNOUT_RETRY_SOURCE_REQUIRED');}
 for(const row of updates)if(m.file_sha256[row.source]!==row.sourceSHA256||m.retained_public_entry_sha256[row.name]!==row.before||hash(stagingBytes(fs.readFileSync(new URL(row.source,root))))!==row.after)throw Error('SIGNOUT_RETRY_SOURCE_REQUIRED');
 return m;
}
export function replaceRetryEntries(previous,replacements,expected){
 if(!(previous instanceof Map)||previous.size!==42||!(replacements instanceof Map)||replacements.size!==2
 ||[...replacements.keys()].sort().join(',')!=='app.html,app.js'||Object.keys(expected||{}).length!==42)throw Error('PUBLIC_SET_REQUIRED');
 for(const [name,bytes]of previous)if(!Buffer.isBuffer(bytes)||hash(bytes)!==expected[name])throw Error('ACCEPTED_SHARED_TABS_ZIP_REQUIRED');
 const next=new Map(previous);
 for(const [name,bytes]of replacements){if(!Buffer.isBuffer(bytes)||!bytes.length)throw Error('SIGNOUT_RETRY_SOURCE_REQUIRED');next.set(name,bytes);}
 if(next.size!==42||[...previous].filter(([name,bytes])=>!replacements.has(name)&&bytes.equals(next.get(name))).length!==40)throw Error('UNRELATED_PUBLIC_CHANGE_REFUSED');
 return next;
}
function ordinary(value,directory=false){
 if(typeof value!=='string'||!path.isAbsolute(value))throw Error('PUBLIC_PATH_REQUIRED');
 for(let current=value;;){if(fs.lstatSync(current).isSymbolicLink())throw Error('PUBLIC_PATH_REQUIRED');const parent=path.dirname(current);if(parent===current)break;current=parent;}
 if(directory?!fs.statSync(value).isDirectory():!fs.statSync(value).isFile())throw Error('PUBLIC_PATH_REQUIRED');
}
export function prepareSignoutRetry(retained,output){
 const m=verifySources();ordinary(retained);ordinary(output,true);
 if(fs.readdirSync(output).length)throw Error('EMPTY_OUTPUT_REQUIRED');
 if(fs.statSync(retained).size>8388608)throw Error('ACCEPTED_SHARED_TABS_ZIP_REQUIRED');
 const input=fs.readFileSync(retained),inputHash=hash(input);
 const next=replaceRetryEntries(readPublicZIP(input,42),new Map(updates.map(row=>[row.name,stagingBytes(fs.readFileSync(new URL(row.source,root)))])),m.retained_public_entry_sha256);
 const bytes=createPublicZIP([...next]),decoded=readPublicZIP(bytes,42);
 if([...next].some(([name,data])=>!data.equals(decoded.get(name)))||hash(fs.readFileSync(retained))!==inputHash)throw Error('ZIP_READBACK_REQUIRED');
 const filename=path.join(output,'mushavo-signout-retry-staging.zip');fs.writeFileSync(filename,bytes,{flag:'wx'});
 if(!fs.readFileSync(filename).equals(bytes))throw Error('OUTPUT_READBACK_REQUIRED');
 return{stage_step:stage,progress_display:display,result:'SIGNOUT_RETRY_FRONTEND_ZIP_PREPARED_NOT_DEPLOYED',source_parent_commit:'062a6e2b7897aeaa44f3dc0570e28c3cc9e7d6fc',
 source_hashes_verified:m.source_file_count,public_files:42,changed_files:['app.js','app.html'],unchanged_public_entries:40,
 configuration_Worker_service_worker_headers_routes_and_auth_policy_byte_preserved:true,retained_ZIP_unchanged:true,retained_ZIP_SHA256:inputHash,
 ZIP_path:filename,ZIP_SHA256:hash(bytes),portable_ZIP_readback_verified:true,Windows_dotNET_ZIP_readback_verified:false,
 SQL_rerun_required:false,actual_hosted_requests:0,real_email_requests:0,settings_SQL_or_account_writes:0,frontend_uploaded:false,
 signout_retry_hosted_verified:false,full_lettered_batch_W_complete:false,hosted_acceptance:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],exit_code:0};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==4)throw Error('PUBLIC_PATH_REQUIRED');console.log(JSON.stringify(prepareSignoutRetry(process.argv[2],process.argv[3]),null,2));}
 catch(error){const known=new Set(['SIGNOUT_RETRY_SOURCE_REQUIRED','PUBLIC_SET_REQUIRED','ACCEPTED_SHARED_TABS_ZIP_REQUIRED','UNRELATED_PUBLIC_CHANGE_REFUSED','PUBLIC_PATH_REQUIRED','EMPTY_OUTPUT_REQUIRED','ZIP_READBACK_REQUIRED','OUTPUT_READBACK_REQUIRED']);
  console.log(JSON.stringify({stage_step:stage,progress_display:display,result:'SIGNOUT_RETRY_PREPARATION_REVIEW_REQUIRED',problem_code:known.has(error?.message)?error.message:'PUBLIC_ZIP_OR_SOURCE_REQUIRED',actual_hosted_requests:0,real_email_requests:0,settings_SQL_or_account_writes:0,frontend_uploaded:false,SQL_rerun_required:false,hosted_acceptance:false,exit_code:1},null,2));process.exitCode=1;}
}

