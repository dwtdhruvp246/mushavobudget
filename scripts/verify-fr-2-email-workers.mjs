import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const toolsRoot=path.resolve(process.argv[2]||path.join(root,'tools'));
let manifest,count=0,dependency=false,syntax=[],runtime=null,problem=null;
const hash=raw=>createHash('sha256').update(raw).digest('hex');
try {
 manifest=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-workers-source-manifest.json'),'utf8'));
 const files=Object.entries(manifest.file_sha256);assert.equal(files.length,16);
 for(const[file,digest]of files){assert(/^[A-Za-z0-9_./-]+$/.test(file)&&!file.includes('..')&&!path.isAbsolute(file));assert.equal(hash(await readFile(path.join(root,file))),digest);count++;}
 assert.equal(hash(await readFile(path.join(toolsRoot,'package-lock.json'))),manifest.file_sha256['scripts/fixtures/email-worker-tools/package-lock.json']);
 const lock=JSON.parse((await readFile(path.join(toolsRoot,'package-lock.json'),'utf8')).replace(/^\uFEFF/,''));
 for(const[name,version]of Object.entries({esbuild:'0.28.2',miniflare:'4.20260730.0',workerd:'1.20260730.1'})){
  const installed=JSON.parse(await readFile(path.join(toolsRoot,'node_modules',name,'package.json'),'utf8'));
  assert.equal(installed.name,name);assert.equal(installed.version,version);assert.equal(lock.packages['node_modules/'+name].version,version);
 }
 dependency=true;
 for(const file of files.map(x=>x[0]).filter(f=>/\.[cm]js$/.test(f))){
  const p=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8',timeout:15000});syntax.push({file,pass:p.status===0});
 }
 assert.equal(syntax.length,12);assert(syntax.every(x=>x.pass));
 const child=spawnSync(process.execPath,[path.join(root,'scripts/check-fr-2-email-workers.mjs'),toolsRoot],{
  encoding:'utf8',timeout:45000,maxBuffer:4*1024*1024,cwd:root});
 try{runtime=JSON.parse(child.stdout);}catch{throw Error('LOCAL_RUNTIME_OUTPUT_UNAVAILABLE');}
 assert.equal(child.status,0);assert.equal(runtime.exit_code,0);assert.equal(runtime.tests,31);assert.equal(runtime.pass,31);
 assert.deepEqual(runtime.bundle_sha256,manifest.expected_bundle_sha256);
}catch(error){problem=error.message==='LOCAL_RUNTIME_OUTPUT_UNAVAILABLE'?error.message:'LOCAL_SOURCE_DEPENDENCY_OR_RUNTIME_REVIEW_REQUIRED';}
const good=!problem&&count===16&&dependency&&syntax.length===12&&syntax.every(x=>x.pass)&&runtime?.exit_code===0;
console.log(JSON.stringify({stage_step:'FR.2.4.E3.2',result:good?'ACTUAL_BUNDLE_AND_LOCAL_DURABLE_LIMITER_SCOPED_PASS':'LOCAL_WORKER_VERIFICATION_REVIEW_REQUIRED',
 source_parent_commit:manifest?.source_parent_commit||null,node_version:process.version,
 source_files_SHA256_verified:count,full_dependency_lock_SHA256_matched:dependency,installed_package_bytes_independently_hashed:false,
 tools:{esbuild:'0.28.2',miniflare:'4.20260730.0',workerd:'1.20260730.1'},syntax_checks:syntax.length,syntax,
 tests:runtime?.tests||0,pass:runtime?.pass||0,fail:good?0:Math.max(1,runtime?.fail||0),exit_code:good?0:1,
 problem_code:problem,runtime_receipt:runtime,
 package_downloads_are_separate_from_offline_runtime_checks:true,
 real_Auth_Zoho_or_Cloudflare_requests:0,actual_email_dispatched:false,
 real_hosted_resources_bindings_secrets_SQL_Auth_roles_or_settings_changed:false,
 owner_browser_or_hosted_ingress_delivery_full_guard_acceptance_verified:false,
 hosted_acceptance:false,production_or_native_changed:false,findings_closed:[],APK_update_deferred:true},null,2));
process.exitCode=good?0:1;
