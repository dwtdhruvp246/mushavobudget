// Offline targeted regression. Uses existing separately locked tool installations.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {buildEmailWorkers} from './lib/build-fr-2-email-workers.mjs';
import {verifyBrowserTrustSources,stage,display} from './prepare-fr-2-batch-w-browser-trust.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),hash=x=>createHash('sha256').update(x).digest('hex');
export const tests=['tests/fr-2-email-gateway.test.mjs','tests/fr-2-email-ui.test.mjs','tests/stage-3-auth-page.test.mjs',
 'tests/stage-3-auth-flows.test.mjs','tests/fr-2-persistent-device.test.mjs','tests/fr-2-browser-trust-package.test.mjs',
 'tests/fr-2-batch-w-copy.test.mjs','tests/fr-2-batch-w-confirmation.test.mjs',
 'tests/persistent-device-sql.check.mjs','tests/persistent-device-upgrade.check.mjs'];
export async function checkBrowserTrust(){
 const manifest=verifyBrowserTrustSources();
 const pglitePath=process.env.MUSHAVO_PGLITE_MODULE,esbuildPath=process.env.MUSHAVO_ESBUILD_MODULE;
 if(!pglitePath||!esbuildPath||!path.isAbsolute(pglitePath)||!path.isAbsolute(esbuildPath))throw Error('EXISTING_PINNED_TOOLS_REQUIRED');
 const pglitePackage=JSON.parse(fs.readFileSync(path.join(path.dirname(pglitePath),'..','package.json')));
 const esbuildPackage=JSON.parse(fs.readFileSync(path.join(path.dirname(esbuildPath),'..','package.json')));
 if(pglitePackage.version!=='0.5.8'||esbuildPackage.version!=='0.28.2')throw Error('EXISTING_PINNED_TOOLS_REQUIRED');
 const esbuild=await import(pathToFileURL(esbuildPath).href),built=await buildEmailWorkers(esbuild,root);
 const artifact=fs.readFileSync(path.join(root,'deployment/candidates/email-persistent-browser.pages.mjs'));
 if(!artifact.equals(Buffer.from(built.pages))||hash(built.limiter)!=='4d10a3f6ea03ab14979b1d821df2c35409d519b0550da8bd4a92f4b28d37b0a1')throw Error('REPRODUCIBLE_WORKER_REQUIRED');
 const env={...process.env,NODE_OPTIONS:'--require '+JSON.stringify(path.join(root,'scripts/offline-test-network.cjs'))};
 const result=spawnSync(process.execPath,['--test','--test-reporter=tap',...tests],{cwd:root,env,encoding:'utf8',timeout:90000,maxBuffer:16*1024*1024});
 const summary=label=>Number(result.stdout?.match(new RegExp('^# '+label+' (\\d+)$','m'))?.[1]??-1);
 if(result.status!==0||result.error||result.signal||summary('fail')!==0||summary('pass')<170||summary('skipped')!==0){process.stderr.write(result.stdout||'');process.stderr.write(result.stderr||'');throw Error('BROWSER_TRUST_REGRESSION_REQUIRED');}
 return{stage_step:stage,progress_display:display,result:'OFFLINE_BROWSER_TRUST_REGRESSION_PASS',
  source_parent_commit:'187e330160b43f0229e425a9803ee5cb1a453369',source_hashes_verified:manifest.source_file_count,
  tests:summary('tests'),pass:summary('pass'),fail:0,skipped:0,test_files:tests,
  pglite_package:'0.5.8',esbuild_package:'0.28.2',Worker_SHA256:hash(artifact),Worker_reproducible:true,
  Worker_bundled_source_inputs:built.inputs,limiter_bundle_unchanged:true,
  SQL_scope:'Real component and guarded transaction on local PostgreSQL; upgrade catalog uses explicitly modeled application guard/policy counts.',
  actual_hosted_requests:0,real_email_requests:0,settings_or_mode_or_account_writes:0,
  database_upgrade_applied:false,frontend_uploaded:false,hosted_acceptance:false,
  pending_batch_V_MFA_deferred_by_owner:true,full_lettered_batch_W_complete:false,
  production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],exit_code:0};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await checkBrowserTrust(),null,2));}
 catch(error){console.log(JSON.stringify({stage_step:stage,progress_display:display,result:'OFFLINE_BROWSER_TRUST_REVIEW_REQUIRED',problem_code:error?.message,hosted_acceptance:false,exit_code:1},null,2));process.exitCode=1;}
}
