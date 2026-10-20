// Offline package-only verification. No owner archive or private credentials are opened.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {stage,verifyModernPackageSources} from './prepare-fr-2-email-modern-package.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let sourceCount=0,syntax=0,tests=0,pass=0,fail=0,checkpoint='SOURCE_IDENTITIES',problem=null;
let failedTitles=[],testExit=null,testSignal=null,testError=null,packagePhase=null;
try{
  const m=verifyModernPackageSources(root);sourceCount=m.source_file_count;
  checkpoint='SOURCE_SYNTAX';
  for(const name of Object.keys(m.file_sha256).filter(x=>/\.[cm]js$/.test(x))){const c=spawnSync(process.execPath,['--check',path.join(root,name)],{encoding:'utf8',timeout:15000});if(c.status!==0)throw Error('SYNTAX');syntax++;}
  checkpoint='ACTUAL_EXPORTER_WORKER_AND_PACKAGE_TESTS';
  const c=spawnSync(process.execPath,['--require',path.join(root,'scripts/offline-test-network.cjs'),'--test','--test-reporter=tap',path.join(root,'tests/fr-2-email-modern-package.test.mjs')],{encoding:'utf8',timeout:60000,maxBuffer:2097152,cwd:root});
  const n=x=>Number(c.stdout.match(new RegExp('^# '+x+' (\\d+)$','m'))?.[1]||0);tests=n('tests');pass=n('pass');fail=n('fail');
  failedTitles=[...c.stdout.matchAll(/^not ok \d+ - ([^\r\n]+)$/gm)].slice(0,17).map(x=>x[1].slice(0,200));
  testExit=c.status;testSignal=['SIGTERM','SIGKILL','SIGABRT'].includes(c.signal)?c.signal:null;
  testError=['ENOENT','EACCES','EPERM','ETIMEDOUT','ENOBUFS'].includes(c.error?.code)?c.error.code:null;
  const phase=c.stdout.match(/# SAFE_PACKAGE_PHASE=([A-Z0-9_]+)/)?.[1];
  if(['MODERN_WORKER_AND_STATIC_EXPORT','PUBLIC_SCOPE_HEADERS_AND_ZIP','HISTORICAL_SOURCE_RECONSTRUCTION','HISTORICAL_BUNDLE_AND_43_FILE_COMPARISON','COMPLETE'].includes(phase))packagePhase=phase;
  if(c.status!==0||tests!==17||pass!==17||fail!==0)throw Error('TESTS');checkpoint='COMPLETE';
}catch{problem='OFFLINE_MODERN_PACKAGE_REVIEW_REQUIRED';}
console.log(JSON.stringify({stage_step:stage,result:problem?'OFFLINE_MODERN_PACKAGE_REVIEW_REQUIRED':'OFFLINE_ACTUAL_MODERN_WORKER_STATIC_EXPORTER_AND_ZIP_SCOPED_PASS',
  source_parent_commit:'c56b925dbd8fa66cb853db8b23e7a547b87957e1',revision:'PORTABLE_NODE_ONLY_PACKAGE_TESTS',node_version:process.version,
  source_files_SHA256_verified:sourceCount,syntax_checks:syntax,tests,pass,fail,
  failed_case_titles:failedTitles,test_process_exit_code:testExit,test_process_signal:testSignal,test_process_error_code:testError,
  package_test_phase:packagePhase,Python_command_required:false,
  actual_compiled_Worker_static_exporter_and_44_file_portable_ZIP_exercised:!problem,
  synthetic_public_configuration_only:true,real_owner_retained_ZIP_or_DPAPI_files_accessed:false,
  owner_Windows_dotNET_readback_verified:false,owner_original_43_unchanged_files_compared:false,
  previous_141_checks_rerun:false,actual_hosted_requests:0,email_dispatched:false,
  Cloudflare_SQL_Auth_or_settings_changed:false,uploaded_or_deployed:false,live_activation_approved:false,
  hosted_acceptance:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],
  local_checkpoint:checkpoint,problem_code:problem,exit_code:problem?1:0},null,2));process.exitCode=problem?1:0;
