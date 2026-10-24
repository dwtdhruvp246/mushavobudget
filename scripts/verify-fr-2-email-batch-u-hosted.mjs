// Owner local verification only. Real app/SDK, synthetic loopback services, no private input.
import assert from 'node:assert/strict';
import {readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {stage} from './check-fr-2-email-batch-u-hosted.mjs';
const progressContext={main_stage:'Stage 3/10',remediation_group:'FR.2/8',lettered_batch:'Batch U/Z',batch_status:'IN_PROGRESS'};
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let checkpoint='PUBLIC_INPUTS',hashes=0,syntax=0,group=null,problem=null,cases=[];
try{
 assert.equal(process.argv.length,4);const [browser,dependency]=process.argv.slice(2);assert(path.isAbsolute(browser)&&path.isAbsolute(dependency));assert((await lstat(browser)).isFile());
 checkpoint='SOURCE_HASHES';const manifest=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-batch-u-hosted-source-manifest.json'),'utf8'));assert.equal(manifest.stage_step,stage);assert.equal(Object.keys(manifest.file_sha256).length,manifest.source_file_count);
 for(const [name,expected]of Object.entries(manifest.file_sha256)){
  assert(/^[A-Za-z0-9_./-]+$/.test(name)&&!name.includes('..')&&!path.isAbsolute(name));for(let p=path.join(root,name);;){assert(!(await lstat(p)).isSymbolicLink());const parent=path.dirname(p);if(parent===p)break;p=parent;}
  assert.equal(createHash('sha256').update(await readFile(path.join(root,name))).digest('hex'),expected);hashes++;
 }
 checkpoint='SYNTAX';for(const name of manifest.syntax_paths){assert.equal(spawnSync(process.execPath,['--check',path.join(root,name)],{encoding:'utf8',timeout:30000}).status,0);syntax++;}
 checkpoint='RETAINED_PUBLIC_PGLITE';const meta=JSON.parse(await readFile(path.resolve(path.dirname(dependency),'../package.json'),'utf8'));assert.equal(meta.name,'@electric-sql/pglite');assert.equal(meta.version,'0.5.8');
 const lock=JSON.parse(await readFile(path.join(root,'scripts/fixtures/email-session-review-tools/package-lock.json'),'utf8'));assert.equal(lock.packages['node_modules/@electric-sql/pglite'].integrity,'sha512-n9tsbUOhwx2epK1V0ZG9Ar4SHWUju04dhmzZXiSBXwBoleOvIfals33NAaWgagQVAL4Rbvx/Ptsu3P+pA09f6Q==');
 checkpoint='NEW_HOSTED_DRIVER_LOCAL_REHEARSAL_AND_FAILURE_CONTAINMENT';
 const environment=Object.fromEntries(Object.entries(process.env).filter(([name])=>!/(TOKEN|PASSWORD|SECRET|SUPABASE|ZOHO|EMAIL_GATE|NODE_OPTIONS|NODE_DEBUG|NODE_TLS|SSLKEYLOG|CLOUDFLARE|WRANGLER)/i.test(name)));
 Object.assign(environment,{MUSHAVO_EMAIL_BROWSER_EXE:browser,MUSHAVO_EMAIL_UI_PGLITE:dependency});
 const run=spawnSync(process.execPath,['--experimental-vm-modules','--require',path.join(root,'scripts/offline-full-app-network.cjs'),'--test','--test-concurrency=1','--test-reporter=tap',...['fr-2-email-batch-u-hosted-policy','fr-2-email-batch-u-hosted','fr-2-email-batch-u-hosted-sql','fr-2-email-batch-u-hosted-browser'].map(n=>path.join(root,'tests',n+'.test.mjs'))],{cwd:root,env:environment,encoding:'utf8',timeout:600000,maxBuffer:8*1024*1024});
 const stdout=run.stdout??'',count=label=>Number(stdout.match(new RegExp('^# '+label+' (\\d+)\\s*$','m'))?.[1]??-1);
 group={tests:count('tests'),pass:count('pass'),fail:count('fail'),skipped:count('skipped'),cancelled:count('cancelled'),exit_code:run.status,failed_case_numbers:[...stdout.matchAll(/^not ok ([0-9]+) - /gm)].map(x=>Number(x[1]))};
 for(const line of stdout.split(/\r?\n/)){const marker=line.indexOf('BATCH_U_HOSTED_LOCAL_CASE ');if(marker>=0)try{cases.push(JSON.parse(line.slice(marker+'BATCH_U_HOSTED_LOCAL_CASE '.length)));}catch{throw Error('LOCAL_SAFE_RECEIPT_REQUIRED');}}
 assert.equal(group.tests,27);assert.equal(group.pass,27);assert.equal(group.fail,0);assert.equal(group.skipped,0);assert.equal(group.cancelled,0);assert.equal(group.exit_code,0);assert.equal(cases.length,5);assert.equal(cases[0].exit_code,0);for(const c of cases)assert(c.browser.cleanup_verified&&c.fixture_state.mode==='QUARANTINED'&&c.fixture_state.windows===0&&c.fixture_state.selectedSessions===0&&c.fixture_state.selectedDevices===0&&c.fixture_state.priorSession===1&&c.fixture_state.priorDevice===1&&c.fixture_state.priorProof===1);
 checkpoint='COMPLETE';
}catch{problem='BATCH_U_LOCAL_SOURCE_BROWSER_OR_CONTAINMENT_REVIEW_REQUIRED';}
const ok=checkpoint==='COMPLETE'&&!problem;
const result={stage_step:stage,progress_context:progressContext,batch:'U',result:ok?'BATCH_U_HOSTED_DRIVER_LOCAL27_PASS_PRIVATE_RUN_NEXT':'BATCH_U_HOSTED_DRIVER_LOCAL_REVIEW_REQUIRED',source_parent_commit:'aecdb030100f4d1e9f79c3cbbc9d495e70b37913',node_version:process.version,platform:process.platform,pglite_version:'0.5.8',source_hashes_verified:hashes,syntax_checks:syntax,tests:group?.tests??0,pass:group?.pass??0,fail:group?.fail??0,group,local_browser_cases:cases,
 actual_full_app_and_real_SDK_local_scenario_verified:ok,source_email_refresh_profile_guard_and_29_direct_transport_failure_positions_exercised:ok,five_actual_browser_cases:ok,installed_dependency_bytes_independently_hashed:false,actual_hosted_requests:0,real_email_requests:0,private_packets_or_real_credentials_accessed:false,hosted_installation_or_upload_attempted:false,committed_hosted_mode_change_requests:0,Windows_owner_execution_verified:ok&&process.platform==='win32',private_web_storage_physically_memory_only_independently_proven:false,real_PostgREST_Realtime_mail_or_concurrency_verified:false,full_Business_workspace_or_role_matrix_verified:false,OS_installed_PWA_or_native_lifecycle_verified:false,hosted_acceptance:false,live_activation_approved:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],checkpoint,problem_code:problem,exit_code:ok?0:1,checked_UTC:new Date().toISOString()};
console.log(JSON.stringify(result,null,2));process.exitCode=result.exit_code;
