import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readPublicZIP} from './lib/read-public-zip.mjs';
import {createPublicZIP} from './lib/store-public-zip.mjs';

const root=new URL('../',import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const targets=['auth-flows.js','auth.html'];
const beforeHashes={"auth-flows.js":"3bf445e67347e57f4f746e22baaa16866fd3ecb5570342d729fed8bbe4c47720","auth.html":"966e2b8e7a10c429c134fb2fa44a83f112c3ae0ca8db118baeb3cbe6a5c8f1dc"};
export const acceptedZIPHash='9bbad6f7fe83b731aef9b65d3bae5df8b832204c5e7bbd0867a9e5a9b811033b';
export function patchConfirmationRequestEntries(previous,replacements){
 if(!(previous instanceof Map)||previous.size!==42
 ||!(replacements instanceof Map)||replacements.size!==2
 ||targets.some(name=>!previous.has(name)||!replacements.has(name)))throw Error('PUBLIC_SET_REQUIRED');
 for(const name of targets){
  if(!Buffer.isBuffer(previous.get(name))||hash(previous.get(name))!==beforeHashes[name])throw Error('PRIOR_CONFIRMATION_SOURCE_REQUIRED');
  if(!Buffer.isBuffer(replacements.get(name))||!replacements.get(name).length)throw Error('SOURCE_REQUIRED');
 }
 const result=new Map(previous);
 for(const [name,bytes] of replacements)result.set(name,bytes);
 if([...previous].filter(([name,bytes])=>!replacements.has(name)&&Buffer.isBuffer(bytes)&&bytes.equals(result.get(name))).length!==40)throw Error('UNRELATED_PUBLIC_CHANGE');
 return result;
}
export function prepare(previous,output){
 const manifest=JSON.parse(fs.readFileSync(new URL('scripts/confirmation-request-feedback-manifest.json',root)));
 for(const [name,digest] of Object.entries(manifest.sources)){
  if(hash(fs.readFileSync(new URL(name,root)))!==digest)throw Error('SOURCE_HASH_MISMATCH');
 }
 const original=fs.readFileSync(previous);
 if(hash(original)!==acceptedZIPHash)throw Error('ACCEPTED_SIMPLE_SEATS_ZIP_REQUIRED');
 if(fs.readdirSync(output).length)throw Error('EMPTY_OUTPUT_REQUIRED');
 const replacements=new Map(targets.map(name=>[name,fs.readFileSync(new URL(name,root))]));
 const entries=patchConfirmationRequestEntries(readPublicZIP(original,42),replacements);
 const bytes=createPublicZIP([...entries]),decoded=readPublicZIP(bytes,42);
 for(const [name,data] of entries)if(!data.equals(decoded.get(name)))throw Error('ZIP_READBACK_FAILED');
 const zip=path.join(output,'mushavo-confirmation-request-retry-staging.zip');
 fs.writeFileSync(zip,bytes,{flag:'wx'});
 if(!fs.readFileSync(zip).equals(bytes)||!fs.readFileSync(previous).equals(original))throw Error('ZIP_READBACK_FAILED');
 return {
  progress_display:'Stage 3/10 | FR.2/8 | Batch W/Z',
  result:'CONFIRMATION_REQUEST_RETRY_FRONTEND_PREPARED_NOT_DEPLOYED',
  source_hashes_verified:Object.keys(manifest.sources).length,
  ZIP_path:zip,ZIP_SHA256:hash(bytes),retained_ZIP_unchanged:true,retained_ZIP_SHA256:acceptedZIPHash,
  public_files:42,changed_files:targets,unchanged_public_entries:40,
  public_file_SHA256:Object.fromEntries([...replacements].map(([name,data])=>[name,hash(data)])),
  configuration_Worker_service_worker_headers_routes_and_auth_policy_byte_preserved:true,
  portable_ZIP_readback_verified:true,Windows_dotNET_ZIP_readback_verified:false,
  SQL_install_required:false,SQL_executed:false,frontend_uploaded:false,
  actual_hosted_requests:0,real_email_requests:0,settings_or_account_writes:0,
  AU01_05_hosted_verified:false,full_lettered_batch_W_complete:false,
  production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],exit_code:0
 };
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(prepare(process.argv[2],process.argv[3]),null,2));}
 catch(error){
  const codes=new Set(['PUBLIC_SET_REQUIRED','PRIOR_CONFIRMATION_SOURCE_REQUIRED','SOURCE_REQUIRED','UNRELATED_PUBLIC_CHANGE','SOURCE_HASH_MISMATCH','ACCEPTED_SIMPLE_SEATS_ZIP_REQUIRED','EMPTY_OUTPUT_REQUIRED','ZIP_READBACK_FAILED']);
  console.log(JSON.stringify({
   progress_display:'Stage 3/10 | FR.2/8 | Batch W/Z',
   result:'CONFIRMATION_REQUEST_RETRY_PREPARATION_REVIEW_REQUIRED',
   problem_code:codes.has(error.message)?error.message:'SOURCE_OR_PATH_REQUIRED',
   actual_hosted_requests:0,real_email_requests:0,SQL_executed:false,frontend_uploaded:false,exit_code:1
  },null,2));process.exitCode=1;
 }
}

