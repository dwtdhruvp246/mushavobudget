// Invoke the unchanged, pinned preparer through its API and retain a new local review ZIP.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createHash} from 'node:crypto';import {pathToFileURL,fileURLToPath} from 'node:url';
const sha=b=>createHash('sha256').update(b).digest('hex');
const manifestSHA='6470790f9769d4c87cd09bb4cf06e5bdcfa7551fc1ef3a759d72039ce4108b27';
const same=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
const safeErrors=new Set(['RETRY_TEMP_OUTPUT_SCOPE','RETRY_MANIFEST_IDENTITY','RETRY_SOURCE_IDENTITY','RETRY_RESULT_SHAPE',
  'ORDINARY_PATH_REQUIRED','SOURCE_PATH','SOURCE_BOUND','SOURCE_MANIFEST','SOURCE_IDENTITY','CONFIG_BOUND','CONFIG_FORMAT','CONFIG_SCOPE',
  'NEW_ISOLATED_EMPTY_CANDIDATE_REQUIRED','PACKAGE_CONTRACT','TOOLS_LOCK','TOOLS_VERSION','WORKER_IDENTITY',
  'PINNED_ESBUILD_REQUIRED','UNEXPECTED_BUNDLE_SHAPE','UNREVIEWED_BUNDLE_INPUT','UNRESOLVED_WORKER_IMPORT',
  'INCOMPLETE_BUNDLE_INPUTS','PACKAGE_ALLOWLIST','PRODUCTION_REFERENCE','ZIP_ENTRY_COUNT','ZIP_ENTRY_SHAPE']);
export async function retryEmailStaging({source,configuration,candidate,toolsRoot}) {
  let checkpoint='ORIGINAL_PINNED_MANIFEST',checked=0,selected=null;
  try {
    source=path.resolve(source);candidate=path.resolve(candidate);toolsRoot=path.resolve(toolsRoot);
    if(!same(path.dirname(candidate),path.resolve(os.tmpdir()))||!/^mushavo-email-staging-review-[a-f0-9]{32}$/.test(path.basename(candidate)))throw Error('RETRY_TEMP_OUTPUT_SCOPE');
    const manifestBytes=fs.readFileSync(path.join(source,'docs/security-audit/security-fr-2-email-staging-package-source-manifest.json'));
    if(sha(manifestBytes)!==manifestSHA)throw Error('RETRY_MANIFEST_IDENTITY');
    const rows=Object.entries(JSON.parse(manifestBytes).file_sha256);if(rows.length!==57)throw Error('RETRY_MANIFEST_IDENTITY');
    checkpoint='ORIGINAL_57_SOURCE_IDENTITIES';
    for(const [name,expected]of rows){selected=name;if(sha(fs.readFileSync(path.join(source,name)))!==expected)throw Error('RETRY_SOURCE_IDENTITY');checked++;}
    selected=null;checkpoint='ORIGINAL_API_PREPARATION';
    const {prepareEmailStaging}=await import(pathToFileURL(path.join(source,'scripts/prepare-fr-2-email-staging.mjs')).href);
    const result=await prepareEmailStaging({source,configuration,candidate,toolsRoot});
    if(result.exit_code!==0||result.public_files!==44||result.do_not_upload_yet!==true||
      result.ZIP_path!==path.join(candidate,'mushavo-email-staging-review.zip'))throw Error('RETRY_RESULT_SHAPE');
    result.wrapper_revision='TEMP_FOLDER_DIRECT_API_SAVED_RECEIPT';
    checkpoint='SAVE_SAFE_PREPARATION_RECEIPT';
    fs.writeFileSync(path.join(candidate,'preparation-receipt.json'),JSON.stringify(result,null,2)+'\n');
    return result;
  }catch(error){
    return{stage_step:'FR.2.4.E5.1_LOCAL_UPLOAD_CANDIDATE',result:'LOCAL_PACKAGE_RETRY_REVIEW_REQUIRED_NOT_DEPLOYED',
      checkpoint,problem_code:safeErrors.has(error?.message)?error.message:'LOCAL_PREPARER_REVIEW_REQUIRED',
      system_error_code:['ENOENT','EACCES','EPERM','ENOTDIR','ENOSPC','MODULE_NOT_FOUND','ERR_MODULE_NOT_FOUND'].includes(error?.code)?error.code:null,
      exception_type:['Error','TypeError','SyntaxError','RangeError'].includes(error?.name)?error.name:null,
      original_source_hashes_verified:checked,selected_source_path:selected,new_local_candidate_may_remain:true,
      raw_exceptions_configuration_or_keys_printed:false,previous_candidate_changed:false,
      actual_hosted_requests:0,deployed:false,hosted_acceptance:false,exit_code:1};
  }
}
if(process.argv[1]==='-'||(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))){
  const args=process.argv.slice(2);
  if(args.length!==4){console.log(JSON.stringify({stage_step:'FR.2.4.E5.1_LOCAL_UPLOAD_CANDIDATE',problem_code:'RETRY_ARGUMENT_COUNT',exit_code:1}));process.exitCode=1;}
  else{const result=await retryEmailStaging({source:args[0],configuration:args[1],candidate:args[2],toolsRoot:args[3]});console.log(JSON.stringify(result,null,2));process.exitCode=result.exit_code;}
}
