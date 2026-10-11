// Offline actual client-function checks. No hosted requests, dependencies or secrets.
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const files=['tests/stage-4-upload-client.test.mjs'];
const result=spawnSync(process.execPath,['--test','--test-reporter=tap',...files],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
if(result.status!==0){process.stderr.write((result.stdout || result.stderr || 'Tests unavailable').slice(-12000));process.exit(1);}
const count=name=>Number(result.stdout.match(new RegExp('^# '+name+' (\\d+)$','m'))?.[1] || 0);
const tests=count('tests'),pass=count('pass'),fail=count('fail');
if(!tests || tests!==pass || fail || count('skipped') || count('todo') || count('cancelled'))throw Error('Incomplete batch');
const checked=['app.js','business.js',...files,'scripts/verify-stage-4-files.mjs'];
const hashes={};
for(const file of checked){
  const syntax=spawnSync(process.execPath,['--check',resolve(root,file)],{encoding:'utf8'});
  if(syntax.status!==0)throw Error('Syntax failed: '+file);
  hashes[file]=createHash('sha256').update(await readFile(resolve(root,file))).digest('hex');
}
const receipt={stage_step:'4.2.2',result:'OFFLINE_ACTUAL_CLIENT_FUNCTION_CHECKS_SCOPED_PASS',
  scope:'VM_EXECUTION_OF_SELECTED_APP_BUSINESS_FUNCTIONS_WITH_SYNTHETIC_STORAGE_RESPONSES',node_version:process.version,
  tests,pass,fail,exit_code:result.status,syntax_checks:checked.length,file_sha256:hashes,
  hosted_checks_run:0,candidate_deployed:false,server_content_validation_verified:false,
  hosted_authorization_quota_cleanup_verified:false,actual_upload_removal_or_signed_URL_request:false,
  accounts_fixtures_Auth_Storage_SQL_settings_changed:false,production_or_native_changed:false,findings_closed:[]};
if(process.argv[2])await writeFile(resolve(process.argv[2]),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
