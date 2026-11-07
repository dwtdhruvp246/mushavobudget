// Public-source package tests; optional real pinned Deno type/bundle/runtime review.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {prepareEdgePackage,sourceSnapshot,preparationRoot as root,preparationManifest,preparationStage,edgeNames} from './prepare-fr-2-email-edge-package.mjs';
let phase='SOURCE_IDENTITIES',problem=null,sourceCount=0,syntax=0,group=null,work=null,scratchRoot=null,cleanup=true;
const native={requested:process.argv.length===4,deno_version:null,type_checks:[],bundles:[],source_runtime:null,bundled_runtime:null};
let packageIdentity=null;
try{
 assert([2,4].includes(process.argv.length),'No arguments, or Deno tools and cache directories, required');
 const snapshot=sourceSnapshot();sourceCount=snapshot.sourceCount;packageIdentity=snapshot.packageIdentity;
 const manifest=JSON.parse(fs.readFileSync(path.join(root,preparationManifest),'utf8'));
 phase='JS_SYNTAX';
 for(const name of manifest.syntax_paths){const r=spawnSync(process.execPath,['--check',path.join(root,name)],{encoding:'utf8',timeout:10000});assert.equal(r.status,0);syntax++;}
 phase='PACKAGE_REGRESSIONS';
 const r=spawnSync(process.execPath,['--require',path.join(root,'scripts/offline-test-network.cjs'),'--test','--test-reporter=tap',path.join(root,'tests/fr-2-email-edge-preparation.test.mjs')],{cwd:root,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024,env:{...process.env,NODE_OPTIONS:'',NODE_DEBUG:'',NODE_DEBUG_NATIVE:''}});
 const output=(r.stdout||'')+'\n'+(r.stderr||'');const count=n=>Number(output.match(new RegExp('^# '+n+' (\\d+)\\s*$','m'))?.[1]??-1);
 group={tests:count('tests'),pass:count('pass'),fail:count('fail'),cancelled:count('cancelled'),skipped:count('skipped'),todo:count('todo'),failed_case_titles:output.split(/\r?\n/).filter(x=>x.startsWith('not ok ')),exit_code:r.status};
 assert.equal(r.status,0);assert.equal(group.tests,manifest.expected_package_tests);assert.equal(group.pass,group.tests);for(const k of ['fail','cancelled','skipped','todo'])assert.equal(group[k],0);
 if(native.requested){
  phase='PINNED_DENO_TOOLS';const tools=path.resolve(process.argv[2]),cache=path.resolve(process.argv[3]);
  assert(fs.readFileSync(path.join(tools,'package-lock.json')).equals(fs.readFileSync(path.join(root,'scripts/fixtures/email-deno-review-tools/package-lock.json'))));
  assert.equal(JSON.parse(fs.readFileSync(path.join(tools,'node_modules/deno/package.json'),'utf8')).version,'2.9.5');
  const binaryPackage={linux:{x64:'linux-x64-glibc',arm64:'linux-arm64-glibc'},win32:{x64:'win32-x64',arm64:'win32-arm64'},darwin:{x64:'darwin-x64',arm64:'darwin-arm64'}}[process.platform]?.[process.arch];assert(binaryPackage);
  const binary=path.join(tools,'node_modules/@deno',binaryPackage,process.platform==='win32'?'deno.exe':'deno');
  assert.equal(JSON.parse(fs.readFileSync(path.join(tools,'node_modules/@deno',binaryPackage,'package.json'),'utf8')).version,'2.9.5');
  const env={DENO_DIR:cache,DENO_NO_UPDATE_CHECK:'1',DENO_NO_PROMPT:'1',NO_COLOR:'1'};
  for(const key of ['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','NO_PROXY','no_proxy','SSL_CERT_FILE','SSL_CERT_DIR'])if(process.env[key])env[key]=process.env[key];
  if(process.env.SSL_CERT_FILE)env.DENO_CERT=process.env.SSL_CERT_FILE;
  const run=args=>spawnSync(binary,args,{cwd:work||root,env,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});
  assert.match(run(['--version']).stdout,/^deno 2\.9\.5 /);native.deno_version='2.9.5';
  scratchRoot=fs.mkdtempSync(path.join(os.tmpdir(),'mushavo-edge-prep-deno-'));const out=path.join(scratchRoot,'package');const prepared=prepareEdgePackage(out);assert.equal(prepared.packageIdentity,packageIdentity);work=out;
  phase='PACKAGED_DENO_TYPES';
  for(const slug of edgeNames){const p=run(['check','--frozen','--config','deno.json',`supabase/functions/${slug}/index.ts`]);native.type_checks.push({slug,pass:p.status===0});assert.equal(p.status,0);}
  phase='PACKAGED_DENO_BUNDLES';fs.mkdirSync(path.join(work,'bundles'));
  for(const slug of edgeNames){const p=run(['bundle','--config','deno.json',`supabase/functions/${slug}/index.ts`,'-o',`bundles/${slug}.mjs`]);native.bundles.push({slug,pass:p.status===0});assert.equal(p.status,0);}
  const harness='scripts/fixtures/email-deno-runtime/entrypoints.mts';fs.mkdirSync(path.dirname(path.join(work,harness)),{recursive:true});fs.copyFileSync(path.join(root,harness),path.join(work,harness));
  phase='PACKAGED_DENIED_NETWORK_RUNTIME';
  const permissions=['--cached-only','--frozen','--no-prompt','--deny-net','--deny-env','--deny-run','--deny-write','--allow-read='+work+','+cache,'--config','deno.json',harness];
  for(const [field,extra]of [['source_runtime',[]],['bundled_runtime',['--bundled']]]){
   const p=run(['run',...permissions,...extra]);const v=JSON.parse(p.stdout);assert.equal(p.status,0);assert.equal(v.tests,28);assert.equal(v.pass,28);assert.equal(v.fail,0);assert.equal(v.unexpected_upstream_attempts,0);
   native[field]={tests:v.tests,pass:v.pass,fail:v.fail,exit_code:v.exit_code,bundled_entrypoints:v.bundled_entrypoints,
    actual_SDK_imports_and_TypeScript_entrypoints_executed:v.actual_SDK_imports_and_TypeScript_entrypoints_executed,
    HTTP_and_environment_inputs_synthetic:v.HTTP_and_environment_inputs_synthetic,
    OS_network_and_subprocess_permissions_denied:v.OS_network_and_subprocess_permissions_denied,
    unexpected_upstream_attempts:v.unexpected_upstream_attempts};
  }
  for(const [name,bytes]of prepared.files)assert(fs.readFileSync(path.join(work,name)).equals(bytes));
 }
 assert.equal(sourceSnapshot().packageIdentity,packageIdentity);phase='COMPLETE';
}catch{problem='SOURCE_PACKAGE_OR_DENO_PREPARATION_REVIEW_REQUIRED';}
finally{if(scratchRoot)try{fs.rmSync(scratchRoot,{recursive:true,force:true});}catch{cleanup=false;}}
const good=problem===null&&cleanup;const tests=(group?.tests||0)+(native.source_runtime?.tests||0)+(native.bundled_runtime?.tests||0);
console.log(JSON.stringify({stage_step:preparationStage,result:good?'OFFLINE_FIRST_EDGE_PACKAGE_PREPARATION_SCOPED_PASS_NOT_DEPLOYMENT':'FIRST_EDGE_PACKAGE_PREPARATION_REVIEW_REQUIRED',
 source_parent_commit:'82694d5a9a1d69f23fcf8151cfab37950b5f6048',node_version:process.version,source_files_SHA256_verified:sourceCount,syntax_checks:syntax,
 package_SHA256:packageIdentity,package_regressions:group,native_Deno:native,tests,pass:(group?.pass||0)+(native.source_runtime?.pass||0)+(native.bundled_runtime?.pass||0),
 installed_dependency_bytes_independently_hashed:false,provider_bundle_or_gateway_JWT_acceptance_verified:false,
 Windows_package_execution_verified:false,credentials_or_private_packet_accessed:false,actual_hosted_requests:0,
 uploaded_or_deployed:false,email_or_push_or_FX_dispatched:false,live_activation_approved:false,hosted_acceptance:false,
 production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],temporary_package_removed:cleanup,checkpoint:phase,problem_code:problem,exit_code:good?0:1},null,2));process.exitCode=good?0:1;
