// Isolated real Deno dependency/type/bundle/runtime review. Never deploys or reads private settings.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {stripTypeScriptTypes} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tools=path.resolve(process.argv[2]||path.join(root,'scripts/fixtures/email-deno-review-tools'));
const dbTools=path.resolve(process.argv[3]||path.join(root,'scripts/fixtures/email-session-review-tools'));
const cache=path.resolve(process.argv[4]||path.join(tools,'public-deno-cache'));
const hash=b=>createHash('sha256').update(b).digest('hex');
let work,manifest,hashes=0,checkpoint='SOURCE_HASHES',problem=null,cleanup=true,binaryMatched=false,sourceReceipt,bundleReceipt,nodeReceipt,beforeFailure=false,erasedEqual=false;
const typeChecks=[],bundles=[];
try{
 manifest=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-deno-edge-source-manifest.json'),'utf8'));const files=Object.entries(manifest.file_sha256);assert.equal(files.length,manifest.source_file_count);
 for(const[p,h]of files){assert(/^[A-Za-z0-9_./-]+$/.test(p)&&!p.includes('..')&&!path.isAbsolute(p));assert.equal(hash(await readFile(path.join(root,p))),h);hashes++;}
 checkpoint='PINNED_TOOLS';
 for(const[dir,fixture,name,version]of[[tools,'scripts/fixtures/email-deno-review-tools','deno','2.9.5'],[dbTools,'scripts/fixtures/email-session-review-tools','@electric-sql/pglite','0.5.8']]){
  const lock=await readFile(path.join(dir,'package-lock.json'));assert.equal(hash(lock),manifest.file_sha256[fixture+'/package-lock.json']);const parsed=JSON.parse(lock.toString());assert.equal(parsed.packages['node_modules/'+name].version,version);const pkg=JSON.parse(await readFile(path.join(dir,'node_modules',name,'package.json'),'utf8'));assert.equal(pkg.name,name);assert.equal(pkg.version,version);
 }
 const binaryPackage={linux:{x64:'linux-x64-glibc',arm64:'linux-arm64-glibc'},win32:{x64:'win32-x64',arm64:'win32-arm64'},darwin:{x64:'darwin-x64',arm64:'darwin-arm64'}}[process.platform]?.[process.arch];assert(binaryPackage);
 const deno=path.join(tools,'node_modules/@deno',binaryPackage,process.platform==='win32'?'deno.exe':'deno');
 const nativePkg=JSON.parse(await readFile(path.join(tools,'node_modules/@deno',binaryPackage,'package.json'),'utf8'));assert.equal(nativePkg.version,'2.9.5');
 const env={DENO_DIR:cache,DENO_NO_UPDATE_CHECK:'1',DENO_NO_PROMPT:'1',NO_COLOR:'1'};
 // Keep only ordinary OS/proxy/CA settings. ALL_PROXY is omitted: this environment's SOCKS route
 // is unsupported by this native client; the supplied HTTPS proxy works with TLS verification.
 for(const key of ['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','NO_PROXY','no_proxy','SSL_CERT_FILE','SSL_CERT_DIR'])if(process.env[key])env[key]=process.env[key];
 if(process.env.SSL_CERT_FILE)env.DENO_CERT=process.env.SSL_CERT_FILE;
 function run(args){return spawnSync(deno,args,{cwd:work||root,env,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});}
 assert.match(run(['--version']).stdout,/^deno 2\.9\.5 /);binaryMatched=true;
 checkpoint='ISOLATED_SOURCE_COPY';work=await mkdtemp(path.join(tmpdir(),'mushavo-deno-edge-'));
 const copied=[...manifest.edge_source_paths,'scripts/fixtures/email-deno-runtime/entrypoints.mts'];
 for(const p of copied){const out=path.join(work,p);await mkdir(path.dirname(out),{recursive:true});await copyFile(path.join(root,p),out);}
 await copyFile(path.join(root,'scripts/fixtures/email-deno-runtime/edge-deno.lock'),path.join(work,'edge-deno.lock'));
 const config={nodeModulesDir:'none',lock:{path:'./edge-deno.lock',frozen:true}};await writeFile(path.join(work,'deno.json'),JSON.stringify(config));
 const lockBefore=hash(await readFile(path.join(work,'edge-deno.lock')));
 const syncPath='supabase/functions/sync-exchange-rates/index.ts';const fixed=await readFile(path.join(work,syncPath),'utf8');
 const old=fixed.replace('createClient, type SupabaseClient','createClient').replace('serviceClient: SupabaseClient','serviceClient: ReturnType<typeof createClient>');assert.notEqual(old,fixed);assert.equal(hash(old),manifest.prior_sync_source_sha256);
 erasedEqual=stripTypeScriptTypes(old,{mode:'transform'})===stripTypeScriptTypes(fixed,{mode:'transform'});assert(erasedEqual);
 checkpoint='FROZEN_DEPENDENCIES_AND_EDGE_TYPES';
 for(const name of manifest.edge_names){const p='supabase/functions/'+name+'/index.ts';const child=run(['check','--frozen','--config','deno.json',p]);typeChecks.push({entrypoint:name,pass:child.status===0});assert.equal(child.status,0);}
 checkpoint='TYPE_ONLY_CORRECTION_REPRODUCTION';
 await writeFile(path.join(work,syncPath),old);const negative=run(['check','--frozen','--config','deno.json',syncPath]);await writeFile(path.join(work,syncPath),fixed);beforeFailure=negative.status!==0&&negative.stderr.includes('TS2345')&&negative.stderr.includes('authorizeRequest');assert(beforeFailure);
 const harness='scripts/fixtures/email-deno-runtime/entrypoints.mts';const harnessCheck=run(['check','--frozen','--config','deno.json',harness]);assert.equal(harnessCheck.status,0);
 checkpoint='ACTUAL_DENO_BUNDLES';await mkdir(path.join(work,'bundles'));
 for(const name of manifest.edge_names){const out='bundles/'+name+'.mjs';const child=run(['bundle','--config','deno.json','supabase/functions/'+name+'/index.ts','-o',out]);assert.equal(child.status,0);const bytes=await readFile(path.join(work,out));assert(bytes.length>1000&&bytes.length<2*1024*1024);bundles.push({entrypoint:name,bytes:bytes.length,sha256:hash(bytes)});}
 assert.equal(hash(await readFile(path.join(work,'edge-deno.lock'))),lockBefore);
 checkpoint='DENIED_NETWORK_SOURCE_AND_BUNDLE_RUNTIME';
 const permissions=['--cached-only','--frozen','--no-prompt','--deny-net','--deny-env','--deny-run','--deny-write','--allow-read='+work+','+cache,'--config','deno.json',harness];
 function runtime(extra){const child=run(['run',...permissions,...extra]);let v;try{v=JSON.parse(child.stdout);}catch{throw Error('SAFE_RUNTIME_RECEIPT_UNAVAILABLE');}assert.equal(child.status,0);assert.equal(v.tests,28);assert.equal(v.pass,28);assert.equal(v.fail,0);assert.equal(v.unexpected_upstream_attempts,0);return v;}
 sourceReceipt=runtime([]);bundleReceipt=runtime(['--bundled']);assert.equal(bundleReceipt.bundled_entrypoints,true);
 checkpoint='AFFECTED_NODE_AND_ACTUAL_SQL_REGRESSIONS';
 const test=spawnSync(process.execPath,['--require',path.join(root,'scripts/offline-test-network.cjs'),'--test','--test-reporter=tap',...manifest.regression_paths.map(p=>path.join(root,p))],{cwd:root,env:{...process.env,MUSHAVO_EMAIL_EDGE_PGLITE:path.join(dbTools,'node_modules/@electric-sql/pglite/dist/index.js')},encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
 const output=(test.stdout||'')+'\n'+(test.stderr||'');const count=n=>Number(output.match(new RegExp('^# '+n+' (\\d+)\\s*$','m'))?.[1]??-1);
 nodeReceipt={tests:count('tests'),pass:count('pass'),fail:count('fail'),cancelled:count('cancelled'),skipped:count('skipped'),todo:count('todo'),exit_code:test.status,TypeScript_experimental_warning:output.includes('ExperimentalWarning')};assert.equal(test.status,0);assert.equal(nodeReceipt.tests,88);assert.equal(nodeReceipt.pass,88);for(const k of ['fail','cancelled','skipped','todo'])assert.equal(nodeReceipt[k],0);
 // Copying and executing the candidate never changes current source, reviewed lock or deployment config.
 for(const[p,h]of files)assert.equal(hash(await readFile(path.join(root,p))),h);assert.equal(hash(await readFile(path.join(work,'edge-deno.lock'))),lockBefore);checkpoint='COMPLETE';
}catch(e){problem=e.message==='SAFE_RUNTIME_RECEIPT_UNAVAILABLE'?e.message:'DENO_SOURCE_DEPENDENCY_TYPE_BUNDLE_OR_RUNTIME_REVIEW_REQUIRED';}
finally{try{if(work)await rm(work,{recursive:true,force:true});}catch{cleanup=false;}}
const good=!problem&&cleanup&&sourceReceipt?.pass===28&&bundleReceipt?.pass===28&&nodeReceipt?.pass===88;
console.log(JSON.stringify({stage_step:'FR.2.4.E4.17_DENO_EDGE_RUNTIME',result:good?'ACTUAL_DENO_TYPES_BUNDLES_SDK_BOUNDARIES_AND_SQL_REGRESSIONS_SCOPED_PASS':'DENO_EDGE_REVIEW_REQUIRED',source_parent_commit:manifest?.source_parent_commit||null,node_version:process.version,deno_version:'2.9.5',source_files_SHA256_verified:hashes,tools_locks_and_installed_versions_verified:binaryMatched,installed_binary_or_package_bytes_independently_hashed:false,actual_Deno_type_checks:typeChecks,actual_Deno_bundles:bundles,old_generic_client_type_error_reproduced:beforeFailure,type_only_change_emits_identical_runtime_JavaScript:erasedEqual,source_runtime_checks:sourceReceipt||null,bundled_runtime_checks:bundleReceipt||null,affected_Node_and_actual_SQL_regressions:nodeReceipt||null,tests:(sourceReceipt?.tests||0)+(bundleReceipt?.tests||0)+(nodeReceipt?.tests||0),pass:(sourceReceipt?.pass||0)+(bundleReceipt?.pass||0)+(nodeReceipt?.pass||0),fail:good?0:1,exit_code:good?0:1,local_checkpoint:checkpoint,problem_code:problem,temporary_source_and_bundle_output_removed:cleanup,public_dependency_cache_retained_locally:true,dependency_downloads_separate_from_denied_network_runtime_checks:true,original_SDK_import_specifiers_and_all_API_logic_preserved:true,real_Auth_SQL_Zoho_push_FX_or_Cloudflare_requests:0,email_notification_or_charge_dispatched:false,private_credentials_DPAPI_or_hosted_settings_accessed:false,hosted_deployment_or_email_activation_performed:false,actual_provider_Supabase_Edge_runtime_JWT_or_browser_acceptance_verified:false,full_Windows_1525_regression_rerun:false,hosted_acceptance:false,live_activation_approved:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[]},null,2));process.exitCode=good?0:1;
