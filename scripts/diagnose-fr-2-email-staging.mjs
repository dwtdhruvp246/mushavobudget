// Diagnose the original pinned E5.1 preparer; remove only this run's temporary output.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
const expectedManifest='6470790f9769d4c87cd09bb4cf06e5bdcfa7551fc1ef3a759d72039ce4108b27';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const codes=new Set(['ORDINARY_PATH_REQUIRED','SOURCE_PATH','SOURCE_BOUND','SOURCE_MANIFEST','SOURCE_IDENTITY',
  'CONFIG_BOUND','CONFIG_FORMAT','CONFIG_SCOPE','NEW_ISOLATED_EMPTY_CANDIDATE_REQUIRED','PACKAGE_CONTRACT',
  'TOOLS_LOCK','TOOLS_VERSION','WORKER_IDENTITY','PINNED_ESBUILD_REQUIRED','UNEXPECTED_BUNDLE_SHAPE',
  'UNREVIEWED_BUNDLE_INPUT','UNRESOLVED_WORKER_IMPORT','INCOMPLETE_BUNDLE_INPUTS','PACKAGE_ALLOWLIST',
  'PRODUCTION_REFERENCE','ZIP_ENTRY_COUNT','ZIP_ENTRY_SHAPE']);
const helperCodes=new Map([
  ['Use an ordinary directory without redirected parents.','STATIC_HELPER_ORDINARY_PATH'],
  ['The supplied key matches the source/production configuration.','SOURCE_PRODUCTION_KEY_REUSE'],
  ['Output and receipt must be outside source; receipt must be outside public output.','STATIC_HELPER_OUTPUT_SCOPE'],
  ['Output and receipt must be new and nonexistent.','STATIC_HELPER_EXISTING_OUTPUT'],
  ['Unexpected reviewed source contract.','STATIC_HELPER_CONTRACT'],
  ['Confirm the exact reviewed staging source and project.','STATIC_HELPER_SOURCE_PIN'],
  ['Use only the staging publishable key, never a secret or service-role key.','STATIC_HELPER_PUBLISHABLE_FORMAT']
]);
export async function diagnoseEmailStaging({source,configuration,toolsRoot}) {
  const answer={stage_step:'FR.2.4.E5.1_LOCAL_PACKAGE_DIAGNOSTIC',
    result:'LOCAL_PACKAGE_DIAGNOSTIC_REVIEW_REQUIRED',scope:'ORIGINAL_PINNED_PREPARER_WITH_NEW_TEMPORARY_OUTPUT_ONLY',
    node_version:process.version,platform:process.platform,original_package_commit:'9ef9a080676253cab97bfe60b79fa59737e95155',
    checkpoint:'PINNED_MANIFEST',source_hashes_verified:0,selected_source_path:null,
    original_preparer_completed:false,temporary_output_created:false,temporary_output_removed:false,
    public_files_verified:0,problem_code:null,system_error_code:null,exception_type:null,
    raw_exceptions_configuration_keys_or_individual_config_hash_printed:false,
    existing_Desktop_candidate_or_retained_configuration_changed:false,ZIP_retained_for_upload:false,
    Windows_dotNET_ZIP_readback_verified:false,actual_hosted_requests:0,email_dispatched:false,
    deployed:false,activation_approved:false,hosted_acceptance:false,findings_closed:[],production_or_native_changed:false,APK_update_deferred:true,exit_code:1};
  let temporary;
  try {
    source=path.resolve(source);configuration=path.resolve(configuration);toolsRoot=path.resolve(toolsRoot);
    const bytes=fs.readFileSync(path.join(source,'docs/security-audit/security-fr-2-email-staging-package-source-manifest.json'));
    if(digest(bytes)!==expectedManifest)throw Error('DIAGNOSTIC_MANIFEST_IDENTITY');
    const manifest=JSON.parse(bytes),rows=Object.entries(manifest.file_sha256);
    if(rows.length!==57)throw Error('DIAGNOSTIC_MANIFEST_IDENTITY');
    answer.checkpoint='ORIGINAL_57_SOURCE_HASHES';
    for(const [relative,expected]of rows) {
      answer.selected_source_path=relative;
      if(digest(fs.readFileSync(path.join(source,relative)))!==expected)throw Error('DIAGNOSTIC_SOURCE_IDENTITY');
      answer.source_hashes_verified++;
    }
    answer.selected_source_path=null;answer.checkpoint='IMPORT_ORIGINAL_PREPARER';
    const {verifyPackageSources,readStagingConfiguration,prepareEmailStaging}=await import(pathToFileURL(path.join(source,'scripts/prepare-fr-2-email-staging.mjs')).href);
    answer.checkpoint='ORIGINAL_ORDINARY_SOURCE_AND_MANIFEST_CHECK';verifyPackageSources(source);
    answer.checkpoint='ORIGINAL_RETAINED_CONFIGURATION_CHECK';readStagingConfiguration(configuration);
    answer.checkpoint='CREATE_ISOLATED_TEMPORARY_OUTPUT';
    temporary=fs.mkdtempSync(path.join(os.tmpdir(),'mushavo-email-package-diagnostic-'));answer.temporary_output_created=true;
    answer.checkpoint='ORIGINAL_PREPARER_TOOLS_BUILD_STATIC_FILES_AND_ZIP';
    const result=await prepareEmailStaging({source,configuration,candidate:temporary,toolsRoot});
    if(result.exit_code!==0||result.public_files!==44||result.do_not_upload_yet!==true)throw Error('DIAGNOSTIC_RESULT_SHAPE');
    answer.original_preparer_completed=true;answer.public_files_verified=44;answer.checkpoint='COMPLETE';
    answer.result='ORIGINAL_PREPARER_TEMPORARY_REHEARSAL_PASS_NOT_DESKTOP_WRAPPER_ACCEPTANCE';answer.exit_code=0;
  } catch(error) {
    const message=typeof error?.message==='string'?error.message:'';
    answer.problem_code=codes.has(message)?message:helperCodes.get(message)||
      (['DIAGNOSTIC_MANIFEST_IDENTITY','DIAGNOSTIC_SOURCE_IDENTITY','DIAGNOSTIC_RESULT_SHAPE'].includes(message)?message:'UNCLASSIFIED_LOCAL_FAILURE');
    if(['ENOENT','EACCES','EPERM','ENOTDIR','EISDIR','ENOSPC','ENAMETOOLONG','ERR_MODULE_NOT_FOUND','MODULE_NOT_FOUND'].includes(error?.code))answer.system_error_code=error.code;
    if(['Error','TypeError','RangeError','SyntaxError'].includes(error?.name))answer.exception_type=error.name;
  } finally {
    if(temporary) {
      try{fs.rmSync(temporary,{recursive:true,force:true});answer.temporary_output_removed=true;}
      catch{answer.problem_code='DIAGNOSTIC_TEMPORARY_CLEANUP_REVIEW_REQUIRED';answer.result='LOCAL_PACKAGE_DIAGNOSTIC_REVIEW_REQUIRED';answer.exit_code=1;}
    }
  }
  return answer;
}
if(process.argv[1]==='-'||(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))) {
  const args=process.argv.slice(2);
  if(args.length!==3){console.log(JSON.stringify({stage_step:'FR.2.4.E5.1_LOCAL_PACKAGE_DIAGNOSTIC',problem_code:'DIAGNOSTIC_ARGUMENTS_REQUIRED',exit_code:1}));process.exitCode=1;}
  else{const result=await diagnoseEmailStaging({source:args[0],configuration:args[1],toolsRoot:args[2]});console.log(JSON.stringify(result,null,2));process.exitCode=result.exit_code;}
}
