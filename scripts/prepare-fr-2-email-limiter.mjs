import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,lstat,rm,copyFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {buildEmailWorkers} from './lib/build-fr-2-email-workers.mjs';

export const defaultSourceRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifestPath='docs/security-audit/security-fr-2-email-limiter-package-source-manifest.json';
const fixture='scripts/fixtures/email-limiter-deploy-tools';
const bundleHash='4d10a3f6ea03ab14979b1d821df2c35409d519b0550da8bd4a92f4b28d37b0a1';
const pagesHash='fb089fffe0cabd9be4fb5e8cfed165786ef56dee8cd5209b7be679166ef4ae99';
const digest=b=>createHash('sha256').update(b).digest('hex');
const need=(yes,code)=>{if(!yes)throw Object.assign(Error(code),{safeCode:code});};
const json=async file=>JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
export const limiterConfiguration=()=>({
  name:'mushavo-email-rate-staging',main:'email-rate-worker.mjs',compatibility_date:'2026-07-01',
  workers_dev:false,preview_urls:false,routes:[],no_bundle:true,find_additional_modules:false,
  durable_objects:{bindings:[{name:'EMAIL_GATE_LIMITER_NS',class_name:'EmailGatewayRateLimiter'}]},
  migrations:[{tag:'email-rate-v1',new_sqlite_classes:['EmailGatewayRateLimiter']}],
  observability:{enabled:false}
});
export function validateLimiterConfiguration(config) {
  try {assert.deepEqual(config,limiterConfiguration());}
  catch {need(false,'LIMITER_CONFIGURATION_REVIEW_REQUIRED');}
}
async function unlinked(file) {
  let current=path.resolve(file);
  for(;;) {
    try {need(!(await lstat(current)).isSymbolicLink(),'LINKED_LOCAL_PATH_REFUSED');}
    catch(error) {if(error.code!=='ENOENT')throw error;}
    const parent=path.dirname(current);if(parent===current)break;current=parent;
  }
}
const inside=(candidate,root)=>{
  const relative=path.relative(root,candidate);
  return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));
};
export async function verifyLimiterSourcesAndTools(sourceRoot,toolsRoot) {
  sourceRoot=path.resolve(sourceRoot);toolsRoot=path.resolve(toolsRoot);
  const manifest=await json(path.join(sourceRoot,manifestPath));
  const files=Object.entries(manifest.file_sha256);
  need(files.length===14,'SOURCE_MANIFEST_REVIEW_REQUIRED');
  for(const[file,hash]of files) {
    need(/^[A-Za-z0-9_./-]+$/.test(file)&&!file.includes('..'),'SOURCE_MANIFEST_REVIEW_REQUIRED');
    const selected=path.join(sourceRoot,file);await unlinked(selected);
    need((await lstat(selected)).isFile(),'SOURCE_MANIFEST_REVIEW_REQUIRED');
    need(digest(await readFile(selected))===hash,'SOURCE_HASH_MISMATCH');
  }
  await unlinked(toolsRoot);
  const installedLock=await readFile(path.join(toolsRoot,'package-lock.json'));
  need(digest(installedLock)===manifest.tools_lock_SHA256,'TOOLS_LOCK_MISMATCH');
  const lock=JSON.parse(installedLock),installed={};
  for(const[name,version]of Object.entries({wrangler:'4.149.0',esbuild:'0.28.2',
    workerd:'1.20261006.1',miniflare:'5.20261006.1-alpha'})) {
    const entry=lock.packages['node_modules/'+name];
    const pkg=await json(path.join(toolsRoot,'node_modules',name,'package.json'));
    need(entry?.version===version&&pkg.version===version&&pkg.name===name,'TOOLS_VERSION_MISMATCH');
    need(entry.resolved===`https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`&&
      typeof entry.integrity==='string'&&entry.integrity.startsWith('sha512-'),'TOOLS_VERSION_MISMATCH');
    installed[name]=version;
  }
  need(lock.packages['node_modules/wrangler'].integrity===
    'sha512-OzK7xmB5r5iLKb3cIT3783g13fe6T7xyeKu9LEdUyl+DKAM2KP/jkjnE0OUhyw+mB/XJM9ycjgF3MWm8PR9amg==',
    'TOOLS_VERSION_MISMATCH');
  return {source_files_SHA256_verified:files.length,tools:installed,tools_lock_SHA256_matched:true,
    dependency_bytes_independently_hashed:false};
}
export async function verifyPreparedLimiterDirectory(directory) {
  await unlinked(directory);
  const names=(await readdir(directory)).sort();
  need(JSON.stringify(names)===JSON.stringify(['email-rate-worker.mjs','wrangler.json']),
    'PACKAGE_FILE_SET_REVIEW_REQUIRED');
  for(const name of names)need((await lstat(path.join(directory,name))).isFile(),
    'PACKAGE_FILE_SET_REVIEW_REQUIRED');
  const config=await json(path.join(directory,'wrangler.json'));validateLimiterConfiguration(config);
  const worker=await readFile(path.join(directory,'email-rate-worker.mjs'));
  need(digest(worker)===bundleHash,'LIMITER_BUNDLE_HASH_MISMATCH');
  return {worker_SHA256:digest(worker),configuration_SHA256:digest(await readFile(path.join(directory,'wrangler.json'))),
    worker_files:2,public_routes_disabled:true,additional_module_discovery_disabled:true,
    SQLite_class_migration_present:true,secrets_or_account_identifiers_in_configuration:false};
}
function dryEnvironment(sourceRoot,scratch,report) {
  const env={};
  for(const[key,value]of Object.entries(process.env))
    if(!/^(?:CLOUDFLARE_|CF_|WRANGLER_|NODE_OPTIONS$|NODE_DEBUG|SSLKEYLOGFILE$|MUSHAVO_LIMITER_)/i.test(key))env[key]=value;
  const guard=path.join(sourceRoot,'scripts/offline-cloudflare-deploy.cjs').replaceAll('\\','/');
  env.NODE_OPTIONS='--require "'+guard.replaceAll('"','\\"')+'"';
  env.MUSHAVO_LIMITER_NETWORK_REPORT=report;
  env.WRANGLER_SEND_METRICS='false';env.WRANGLER_LOG_LEVEL='error';
  env.WRANGLER_HIDE_BANNER='true';
  env.WRANGLER_LOG_PATH=path.join(scratch,'logs');
  env.XDG_CONFIG_HOME=path.join(scratch,'xdg');env.XDG_CACHE_HOME=path.join(scratch,'cache');
  env.XDG_DATA_HOME=path.join(scratch,'data');env.CI='true';
  env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV='false';
  return env;
}
async function runDry(sourceRoot,toolsRoot,directory,scratch) {
  const mirror=path.join(scratch,'project');await mkdir(mirror,{recursive:true});
  for(const name of ['email-rate-worker.mjs','wrangler.json'])await copyFile(path.join(directory,name),path.join(mirror,name));
  const report=path.join(scratch,'network-counter');
  const run=spawnSync(process.execPath,[path.join(toolsRoot,'node_modules/wrangler/bin/wrangler.js'),
    'deploy','--config',path.join(mirror,'wrangler.json'),'--dry-run',
    '--outdir',path.join(scratch,'dry-output'),'--profile','mushavo-local-'+randomUUID()],{
    cwd:mirror,env:dryEnvironment(sourceRoot,scratch,report),encoding:'utf8',timeout:45000,maxBuffer:2*1024*1024});
  let events='';try {events=await readFile(report,'utf8');}catch{}
  const stop=code=>{throw Object.assign(Error(code),{safeCode:code,
    localWranglerExit:Number.isInteger(run.status)?run.status:null,
    localWranglerStartError:/^[A-Z0-9_]{1,40}$/.test(run.error?.code||'')?run.error.code:null,
    guardLoads:(events.match(/L/g)||[]).length,blockedAttempts:(events.match(/B/g)||[]).length});};
  if(events.length>65536||!/^L+$/.test(events))stop('LOCAL_DRY_RUN_NETWORK_GUARD_REVIEW_REQUIRED');
  if(run.status!==0||run.error)stop('WRANGLER_LOCAL_DRY_RUN_FAILED');
  const emitted=await readFile(path.join(scratch,'dry-output','email-rate-worker.mjs'));
  need(digest(emitted)===bundleHash,'WRANGLER_OUTPUT_HASH_MISMATCH');
  return {actual_Wrangler_dry_run_exit_code:0,Wrangler_output_matches_reviewed_bundle:true,
    network_guard_loaded_processes:events.length,blocked_network_attempts:0,
    Node_HTTP_socket_DNS_transports_disabled:true,unique_unused_auth_profile_selected:true,
    cached_default_auth_profile_selected:false,raw_CLI_output_or_private_paths_printed:false};
}
export async function prepareLimiterPackage({sourceRoot=defaultSourceRoot,toolsRoot,outputRoot}) {
  need(typeof toolsRoot==='string'&&typeof outputRoot==='string','LOCAL_PREPARATION_ARGUMENTS_REQUIRED');
  sourceRoot=path.resolve(sourceRoot);toolsRoot=path.resolve(toolsRoot);outputRoot=path.resolve(outputRoot);
  need(!inside(outputRoot,sourceRoot)&&!inside(outputRoot,toolsRoot),'OUTPUT_MUST_BE_OUTSIDE_SOURCE_AND_TOOLS');
  await unlinked(outputRoot);
  try {await lstat(outputRoot);need(false,'NEW_OUTPUT_DIRECTORY_REQUIRED');}
  catch(error) {if(error.code!=='ENOENT')throw error;}
  const inputs=await verifyLimiterSourcesAndTools(sourceRoot,toolsRoot);
  const candidate=await json(path.join(sourceRoot,'deployment/candidates/email-rate-worker.wrangler.json'));
  delete candidate.$schema;candidate.main='email-rate-worker.mjs';candidate.routes=[];
  candidate.no_bundle=true;candidate.find_additional_modules=false;validateLimiterConfiguration(candidate);
  const require=createRequire(path.join(toolsRoot,'package.json'));
  const artifacts=await buildEmailWorkers(require('esbuild'),sourceRoot);
  need(digest(artifacts.limiter)===bundleHash&&digest(artifacts.pages)===pagesHash,'REVIEWED_BUNDLE_HASH_MISMATCH');
  let created=false;
  try {
    await mkdir(outputRoot);created=true;
    const worker=path.join(outputRoot,'worker');await mkdir(worker);
    await writeFile(path.join(worker,'email-rate-worker.mjs'),artifacts.limiter,{flag:'wx'});
    await writeFile(path.join(worker,'wrangler.json'),JSON.stringify(candidate,null,2)+'\n',{flag:'wx'});
    const packageCheck=await verifyPreparedLimiterDirectory(worker);
    const scratch=path.join(outputRoot,'local-check');
    let dry;
    try {dry=await runDry(sourceRoot,toolsRoot,worker,scratch);}
    finally {await rm(scratch,{recursive:true,force:true});}
    assert.deepEqual(await verifyPreparedLimiterDirectory(worker),packageCheck);
    const receipt={stage_step:'FR.2.4.E3.4_LIMITER_PACKAGE',
      result:'LOCAL_LIMITER_PACKAGE_AND_ACTUAL_WRANGLER_DRY_RUN_SCOPED_PASS_NOT_DEPLOYED',
      source_parent_commit:'20b2648438cc21b70f23e2ea8ab183b81c269c4b',node_version:process.version,
      ...inputs,...packageCheck,...dry,local_dry_run_state_removed:true,
      account_login_or_private_API_requests:0,deployed:false,Cloudflare_resources_bindings_or_secrets_created:false,
      Zoho_encrypted_file_accessed_or_email_dispatched:false,SQL_Auth_roles_or_Pages_changed:false,
      hosted_acceptance:false,production_or_native_changed:false,findings_closed:[],APK_update_deferred:true,exit_code:0};
    await writeFile(path.join(outputRoot,'preparation-receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
    return receipt;
  } catch(error) {if(created)await rm(outputRoot,{recursive:true,force:true});throw error;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    need(process.argv.length===4,'LOCAL_PREPARATION_ARGUMENTS_REQUIRED');
    console.log(JSON.stringify(await prepareLimiterPackage({toolsRoot:process.argv[2],outputRoot:process.argv[3]}),null,2));
  } catch(error) {
    const code=typeof error.safeCode==='string'?error.safeCode:'LOCAL_PACKAGE_PREPARATION_REVIEW_REQUIRED';
    console.log(JSON.stringify({stage_step:'FR.2.4.E3.4_LIMITER_PACKAGE',result:'LOCAL_PACKAGE_REVIEW_REQUIRED',
      problem_code:code,local_Wrangler_exit_code:error.localWranglerExit??null,
      local_Wrangler_start_error:error.localWranglerStartError??null,
      dry_run_network_guard_loads:error.guardLoads??null,dry_run_blocked_network_attempts:error.blockedAttempts??null,
      deployed:false,hosted_acceptance:false,findings_closed:[],exit_code:1},null,2));process.exitCode=1;
  }
}
