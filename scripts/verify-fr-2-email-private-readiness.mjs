// Built-in Node only. All provider requests in these tests use synthetic transport ports.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let count=0,syntax=0,tests=0,pass=0,fail=0,checkpoint='SOURCE_IDENTITIES',problem=null,failed=[],redirectType=null;
try{
  const m=JSON.parse(fs.readFileSync(path.join(root,'docs/security-audit/security-fr-2-email-private-readiness-source-manifest.json')));
  const rows=Object.entries(m.file_sha256);if(m.stage_step!=='FR.2.4.E5.6_PRIVATE_READ_ONLY_READINESS'||rows.length!==m.source_file_count||rows.length<20)throw Error();
  for(const [p,h]of rows){if(!/^[A-Za-z0-9_./-]+$/.test(p)||p.includes('..')||path.isAbsolute(p)||createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')!==h)throw Error();count++;}
  checkpoint='SOURCE_SYNTAX';for(const p of rows.map(x=>x[0]).filter(x=>/\.[cm]js$/.test(x))){const c=spawnSync(process.execPath,['--check',path.join(root,p)],{encoding:'utf8',timeout:15000});if(c.status!==0)throw Error();syntax++;}
  checkpoint='ACTUAL_READ_ONLY_HANDLERS_AND_INSPECTOR_TESTS';
  const c=spawnSync(process.execPath,['--require',path.join(root,'scripts/offline-test-network.cjs'),'--test','--test-reporter=tap',
    path.join(root,'tests/fr-2-email-private-readiness.test.mjs'),path.join(root,'scripts/check-fr-2-email-pages-inspection-portable.mjs')],
    {encoding:'utf8',timeout:30000,maxBuffer:2097152,cwd:root});
  const n=x=>Number(c.stdout.match(new RegExp('^# '+x+' (\\d+)$','m'))?.[1]||0);tests=n('tests');pass=n('pass');fail=n('fail');
  failed=[...c.stdout.matchAll(/^not ok \d+ - ([^\r\n]+)$/gm)].slice(0,10).map(x=>x[1].slice(0,200));
  const fixture=c.stdout.match(/# SAFE_REDIRECT_FIXTURE_TYPE=(junction|dir)/)?.[1];if(fixture)redirectType=fixture;
  if(c.status!==0||tests!==44||pass!==44||fail!==0)throw Error();checkpoint='COMPLETE';
}catch{problem='OFFLINE_READINESS_SOURCE_OR_TEST_REVIEW_REQUIRED';}
console.log(JSON.stringify({stage_step:'FR.2.4.E5.6_PRIVATE_READ_ONLY_READINESS',
  result:problem?'OFFLINE_PRIVATE_READINESS_REVIEW_REQUIRED':'OFFLINE_ACTUAL_READ_ONLY_READINESS_AND_INSPECTOR_SCOPED_PASS',
  source_parent_commit:'3e465bf082ad5cd269e7112c35e224948c81af19',revision:'WINDOWS_JUNCTION_TEST_FIXTURE',node_version:process.version,
  source_files_SHA256_verified:count,syntax_checks:syntax,tests,pass,fail,failed_case_titles:failed,
  redirected_artifact_test_fixture_type:redirectType,actual_native_Windows_junction_execution_verified:!problem&&process.platform==='win32'&&redirectType==='junction',
  new_readiness_cases:26,existing_inspector_regressions:18,fixed_GET_only_request_contract_exercised:!problem,
  real_owner_ZIP_DPAPI_packet_or_credentials_accessed:false,actual_Cloudflare_or_Supabase_requests:0,
  Windows_DPAPI_private_runner_execution_verified:false,provider_key_acceptance_or_live_readiness_verified:false,
  keys_settings_SQL_or_accounts_changed:false,email_dispatched:false,uploaded_or_deployed:false,live_activation_approved:false,
  hosted_acceptance:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],
  local_checkpoint:checkpoint,problem_code:problem,exit_code:problem?1:0},null,2));process.exitCode=problem?1:0;
