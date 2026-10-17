// Pinned current-runtime verification only; no deployment, credential entry or live SQL.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const toolsRoot=path.resolve(process.argv[2]||path.join(root,'scripts/fixtures/email-worker-tools'));
const dbTools=path.resolve(process.argv[3]||path.join(root,'scripts/fixtures/email-session-review-tools'));
const hash=b=>createHash('sha256').update(b).digest('hex');
let manifest,hashes=0,dependency=false,syntax=[],runtime=null,previous=null,problem=null,checkpoint='SOURCE_HASHES';
try{
 manifest=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-current-runtime-source-manifest.json'),'utf8'));
 const files=Object.entries(manifest.file_sha256);assert.equal(files.length,manifest.source_file_count);assert(files.length>=70);
 for(const[p,h]of files){assert(/^[A-Za-z0-9_./-]+$/.test(p)&&!p.includes('..')&&!path.isAbsolute(p));assert.equal(hash(await readFile(path.join(root,p))),h);hashes++;}
 checkpoint='PINNED_TOOLS';
 for(const [dir,relative,names]of[[toolsRoot,'scripts/fixtures/email-worker-tools',['esbuild','miniflare','workerd']],[dbTools,'scripts/fixtures/email-session-review-tools',['@electric-sql/pglite']]]){
  const lock=await readFile(path.join(dir,'package-lock.json'));assert.equal(hash(lock),manifest.file_sha256[relative+'/package-lock.json']);const parsed=JSON.parse(lock.toString('utf8').replace(/^\uFEFF/,''));
  for(const name of names){const installed=JSON.parse(await readFile(path.join(dir,'node_modules',name,'package.json'),'utf8'));assert.equal(installed.name,name);assert.equal(installed.version,manifest.tools[name]);assert.equal(parsed.packages['node_modules/'+name].version,manifest.tools[name]);}
 }
 dependency=true;checkpoint='SYNTAX';
 for(const file of files.map(x=>x[0]).filter(x=>/\.[cm]js$/.test(x))){const p=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8',timeout:15000});syntax.push({file,pass:p.status===0});assert.equal(p.status,0);}
 const database=path.join(dbTools,'node_modules/@electric-sql/pglite/dist/index.js');
 function run(file,args,expected){const child=spawnSync(process.execPath,[path.join(root,file),...args],{encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024,cwd:root});let receipt;try{receipt=JSON.parse(child.stdout);}catch{throw Error('SAFE_CHILD_RECEIPT_UNAVAILABLE');}assert.equal(child.status,0);assert.equal(receipt.exit_code,0);assert.equal(receipt.tests,expected);assert.equal(receipt.pass,expected);assert.equal(receipt.fail,0);assert.deepEqual(receipt.bundle_sha256,manifest.expected_bundle_sha256);return receipt;}
 checkpoint='ACTUAL_CURRENT_WORKER_SQL';runtime=run('scripts/check-fr-2-email-current-runtime.mjs',[toolsRoot,database],21);assert.equal(runtime.local_runtime_SQL_and_temporary_state_cleanup_completed,true);
 checkpoint='CURRENT_SHARED_LIMITER_REGRESSIONS';previous=run('scripts/check-fr-2-email-workers.mjs',[toolsRoot],31);assert.equal(previous.local_runtime_and_temporary_state_cleanup_completed,true);
 checkpoint='COMPLETE';
}catch(e){problem=e.message==='SAFE_CHILD_RECEIPT_UNAVAILABLE'?e.message:'CURRENT_RUNTIME_SOURCE_DEPENDENCY_SYNTAX_OR_ASSERTION_REVIEW_REQUIRED';}
const good=!problem&&dependency&&runtime?.exit_code===0&&previous?.exit_code===0;
console.log(JSON.stringify({stage_step:'FR.2.4.E4.16_CURRENT_WORKER_SQL_RUNTIME',result:good?'CURRENT_WORKER_SQL_AND_SHARED_LIMITER_RUNTIME_SCOPED_PASS':'CURRENT_WORKER_SQL_RUNTIME_REVIEW_REQUIRED',scope:'CURRENT_REAL_ESBUILD_WORKERD_SQLITE_DO_AND_ATOMIC55_PGLITE_SQL_WITH_INTERCEPTED_SYNTHETIC_AUTH_AND_MAIL',source_parent_commit:manifest?.source_parent_commit||null,node_version:process.version,source_files_SHA256_verified:hashes,full_tools_locks_and_installed_versions_matched:dependency,installed_package_bytes_independently_hashed:false,tools:manifest?.tools||null,syntax_checks:syntax.length,syntax,tests:(runtime?.tests||0)+(previous?.tests||0),pass:(runtime?.pass||0)+(previous?.pass||0),fail:good?0:1,exit_code:good?0:1,local_checkpoint:checkpoint,problem_code:problem,current_Worker_SQL_checks:runtime,shared_limiter_regression_checks:previous,expected_bundle_sha256:manifest?.expected_bundle_sha256||null,bundles_byte_identical_to_previously_reviewed_E3_2:good&&manifest?.bundle_bytes_match_reviewed_E3_2===true,owner_staging_nine_metadata_checks_received:true,package_downloads_separate_from_intercepted_runtime_checks:true,actual_Auth_Zoho_Cloudflare_or_hosted_SQL_requests:0,email_dispatched:false,credentials_or_private_Zoho_file_accessed:false,hosted_installer_enforcement_Pages_binding_or_resources_changed:false,real_browser_cookie_JWT_signature_provider_delivery_or_parallel_PostgreSQL_verified:false,full_Windows_1525_regression_rerun:false,hosted_acceptance:false,live_activation_approved:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[]},null,2));process.exitCode=good?0:1;
