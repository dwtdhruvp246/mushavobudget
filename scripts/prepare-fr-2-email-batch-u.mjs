// Only the two Batch U lifecycle fixes; retained reviewed public configuration is preserved.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {reviewedZIP,ZIP_SHA256,SW_SHA256} from './check-fr-2-email-batch-q.mjs';
import {readCanonicalPublicZIP} from './prepare-fr-2-email-modern-package.mjs';
import {createPublicZIP} from './lib/store-public-zip.mjs';
import {stage,progressContext} from './check-fr-2-email-batch-u.mjs';
const root=new URL('../',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
export const priorSources=Object.freeze({'app.js':'6df6e954a1f71d74b1c73bc7d83f96f086cef01c2eb73e23cbe05cb31210edb9','session-entry.js':'09ad4dc4f03d1bce098a1849362a5e547e91cbfcb0715821a94cf81408ffef0e'});
const staging=bytes=>Buffer.from(bytes.toString().replaceAll('kttkospkblwvguuwnhjj','dczlddwbtgvfdujgcitb'));
export function replaceLifecycleSources(entries,candidates){
 if(!(entries instanceof Map)||entries.size!==44||!(candidates instanceof Map)||candidates.size!==2||hash(entries.get('sw.js')??'')!==SW_SHA256)throw Error('REVIEWED_PUBLIC_ARTIFACT_REQUIRED');
 const next=new Map(entries);
 for(const [name,sha]of Object.entries(priorSources)){
  // app.js contains no project literal today; the old pinned source hash therefore
  // also identifies its staging-exported bytes. No configuration regeneration.
  if(hash(entries.get(name)??'')!==sha||!Buffer.isBuffer(candidates.get(name))||!candidates.get(name).length||candidates.get(name).equals(entries.get(name)))throw Error('REVIEWED_LIFECYCLE_SOURCE_REQUIRED');
  next.set(name,candidates.get(name));
 }
 if([...entries].filter(([name,bytes])=>!Object.hasOwn(priorSources,name)&&bytes.equals(next.get(name))).length!==42)throw Error('UNRELATED_PUBLIC_CHANGE_REFUSED');
 return next;
}
function ordinary(filename,directory=false){
 if(typeof filename!=='string'||!path.isAbsolute(filename))throw Error('PUBLIC_PATH_REQUIRED');
 for(let p=filename;;){if(fs.lstatSync(p).isSymbolicLink())throw Error('PUBLIC_PATH_REQUIRED');const parent=path.dirname(p);if(parent===p)break;p=parent;}
 if(directory?!fs.statSync(filename).isDirectory():!fs.statSync(filename).isFile())throw Error('PUBLIC_PATH_REQUIRED');
}
export function prepareLifecycleZIP(retainedZIP,outputDirectory){
 ordinary(retainedZIP);ordinary(outputDirectory,true);if(fs.readdirSync(outputDirectory).length)throw Error('EMPTY_OUTPUT_REQUIRED');
 const entries=reviewedZIP(retainedZIP),candidates=new Map(Object.keys(priorSources).map(name=>[name,staging(fs.readFileSync(new URL(name,root)))]));
 const next=replaceLifecycleSources(entries,candidates),bytes=createPublicZIP([...next]),readback=readCanonicalPublicZIP(bytes);
 if(readback.size!==44||[...next].some(([name,data])=>!data.equals(readback.get(name)))||hash(fs.readFileSync(retainedZIP))!==ZIP_SHA256)throw Error('PUBLIC_ARTIFACT_READBACK_REQUIRED');
 const filename=path.join(outputDirectory,'mushavo-batch-u-lifecycle-review.zip');fs.writeFileSync(filename,bytes,{flag:'wx'});
 if(!fs.readFileSync(filename).equals(bytes)||hash(fs.readFileSync(retainedZIP))!==ZIP_SHA256)throw Error('PUBLIC_ARTIFACT_READBACK_REQUIRED');
 return {stage_step:stage,progress_context:progressContext,batch:'U',result:'BATCH_U_LOCAL_TWO_FILE_PUBLIC_CANDIDATE_PREPARED_NOT_DEPLOYED',changed_files:Object.keys(priorSources),unchanged_public_entries:42,public_files:44,retained_ZIP_SHA256_verified:ZIP_SHA256,retained_ZIP_unchanged:true,staging_configuration_and_public_push_key_byte_preserved:true,gateway_worker_headers_and_service_worker_byte_preserved:true,ZIP_path:filename,ZIP_SHA256:hash(bytes),entry_SHA256:Object.fromEntries([...next].map(([name,data])=>[name,hash(data)])),portable_ZIP_readback_verified:true,Windows_dotNET_ZIP_readback_verified:false,upload_requested:false,do_not_upload_yet:true,actual_hosted_requests:0,private_packets_or_real_credentials_accessed:false,real_email_requests:0,committed_hosted_mode_change_requests:0,production_or_native_changed:false,hosted_acceptance:false,exit_code:0};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let r;try{if(process.argv.length!==4)throw Error();r=prepareLifecycleZIP(process.argv[2],process.argv[3]);}catch(e){const codes=new Set(['PUBLIC_PATH_REQUIRED','EMPTY_OUTPUT_REQUIRED','REVIEWED_PUBLIC_ARTIFACT_REQUIRED','REVIEWED_LIFECYCLE_SOURCE_REQUIRED','UNRELATED_PUBLIC_CHANGE_REFUSED','PUBLIC_ARTIFACT_READBACK_REQUIRED']);r={stage_step:stage,progress_context:progressContext,batch:'U',result:'BATCH_U_LOCAL_PUBLIC_CANDIDATE_REVIEW_REQUIRED',problem_code:codes.has(e?.message)?e.message:'RETAINED_REVIEWED_PUBLIC_ZIP_REQUIRED',actual_hosted_requests:0,real_email_requests:0,upload_requested:false,exit_code:1};}console.log(JSON.stringify(r,null,2));process.exitCode=r.exit_code;
}
