// Built-in Node only; all tests use synthetic credentials and provider transports.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let count=0,syntax=0,tests=0,pass=0,fail=0,checkpoint='SOURCE_IDENTITIES',problem=null,failed=[],redirectType=null;
try{
  const m=JSON.parse(fs.readFileSync(path.join(root,'docs/security-audit/security-fr-2-email-secrets-source-manifest.json')));
  const rows=Object.entries(m.file_sha256);if(m.stage_step!=='FR.2.4.E5.7_STAGING_SECRET_BINDINGS'||rows.length!==m.source_file_count||rows.length<30)throw Error();
  for(const [p,h]of rows){if(!/^[A-Za-z0-9_./-]+$/.test(p)||p.includes('..')||path.isAbsolute(p)||createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')!==h)throw Error();count++;}
  checkpoint='SOURCE_SYNTAX';for(const p of rows.map(x=>x[0]).filter(x=>/\.[cm]js$/.test(x))){const c=spawnSync(process.execPath,['--check',path.join(root,p)],{encoding:'utf8',timeout:15000});if(c.status!==0)throw Error();syntax++;}
  checkpoint='ACTUAL_INSTALLER_AND_READINESS_BOUNDARIES';
  const c=spawnSync(process.execPath,['--require',path.join(root,'scripts/offline-test-network.cjs'),'--test','--test-reporter=tap',
    path.join(root,'tests/fr-2-email-pages-secrets.test.mjs'),path.join(root,'tests/fr-2-email-private-readiness.test.mjs'),
    path.join(root,'scripts/check-fr-2-email-pages-inspection-portable.mjs')],{encoding:'utf8',timeout:30000,maxBuffer:2097152,cwd:root});
  const n=x=>Number(c.stdout.match(new RegExp('^# '+x+' (\\d+)$','m'))?.[1]||0);tests=n('tests');pass=n('pass');fail=n('fail');
  failed=[...c.stdout.matchAll(/^not ok \d+ - ([^\r\n]+)$/gm)].slice(0,10).map(x=>x[1].slice(0,200));
  const kind=c.stdout.match(/# SAFE_REDIRECT_FIXTURE_TYPE=(junction|dir)/)?.[1];if(kind)redirectType=kind;
  if(c.status!==0||tests!==72||pass!==72||fail!==0)throw Error();checkpoint='COMPLETE';
}catch{problem='OFFLINE_SECRET_INSTALLER_SOURCE_OR_TEST_REVIEW_REQUIRED';}
console.log(JSON.stringify({stage_step:'FR.2.4.E5.7_STAGING_SECRET_BINDINGS',
  result:problem?'OFFLINE_STAGING_SECRET_INSTALLER_REVIEW_REQUIRED':'OFFLINE_ACTUAL_STAGING_SECRET_INSTALLER_AND_READINESS_SCOPED_PASS',
  source_parent_commit:'5c9689dbf7be9342a3c0f5fcb18a47eb9e31bd49',node_version:process.version,
  source_files_SHA256_verified:count,syntax_checks:syntax,tests,pass,fail,failed_case_titles:failed,
  new_installer_cases:28,existing_readiness_and_inspector_cases:44,
  redirected_artifact_test_fixture_type:redirectType,actual_native_Windows_junction_execution_verified:!problem&&process.platform==='win32'&&redirectType==='junction',
  fresh_seven_GETs_one_PATCH_one_GET_contract_exercised:!problem,partial_unknown_write_and_no_retry_controls_exercised:!problem,
  actual_owner_credentials_ZIP_or_DPAPI_file_accessed:false,actual_Cloudflare_Supabase_or_Zoho_requests:0,
  actual_Windows_private_runner_or_secret_installation_verified:false,
  application_runtime_SQL_Worker_private_packet_or_accepted_ZIP_changed:false,
  plaintext_secret_files_or_argument_or_environment_credentials_written:false,
  uploaded_or_deployed:false,email_dispatched:false,live_activation_approved:false,hosted_acceptance:false,
  production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],
  local_checkpoint:checkpoint,problem_code:problem,exit_code:problem?1:0},null,2));process.exitCode=problem?1:0;
