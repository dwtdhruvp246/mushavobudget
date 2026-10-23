// Canonical source integration of the exact hosted Q worker. Local regressions only.
import assert from 'node:assert/strict';
import {readFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const stage='FR.2.4.E5.31_BATCH_R_CANONICAL_V89_SOURCE_ALIGNMENT_AND_LOCAL_REGRESSIONS';
let checkpoint='PINNED_SOURCE',hashes=0,syntax=0,groups=[],problem=null;
try{
 assert.equal(process.argv.length,3);assert(path.isAbsolute(process.argv[2]));
 const manifest=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-batch-r-source-manifest.json'),'utf8'));
 assert.equal(manifest.stage_step,stage);assert.equal(Object.keys(manifest.file_sha256).length,manifest.source_file_count);
 for(const [f,h]of Object.entries(manifest.file_sha256)){
  assert(/^[A-Za-z0-9_./-]+$/.test(f)&&!f.includes('..')&&!path.isAbsolute(f));for(let p=path.join(root,f);;){assert(!(await lstat(p)).isSymbolicLink());const parent=path.dirname(p);if(parent===p)break;p=parent;}
  assert.equal(createHash('sha256').update(await readFile(path.join(root,f))).digest('hex'),h);hashes++;
 }
 checkpoint='SYNTAX';for(const f of manifest.syntax_paths){assert.equal(spawnSync(process.execPath,['--check',path.join(root,f)],{encoding:'utf8',timeout:30000}).status,0);syntax++;}
 for(const g of manifest.groups){
  checkpoint=g.name;
  const args=g.verifier?[path.join(root,g.verifier),process.argv[2]]:['--require',path.join(root,'scripts/offline-test-network.cjs'),'--test','--test-reporter=tap',...g.files.map(f=>path.join(root,f))];
  const run=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:150000,maxBuffer:8*1024*1024});
  let receipt,result;
  if(g.verifier){receipt=JSON.parse(run.stdout);result={name:g.name,tests:receipt[g.count_field],pass:receipt[g.count_field],exit_code:run.status,receipt};assert.equal(receipt.exit_code,0);}
  else{const count=k=>Number((run.stdout??'').match(new RegExp('^# '+k+' (\\d+)\\s*$','m'))?.[1]??-1);result={name:g.name,tests:count('tests'),pass:count('pass'),fail:count('fail'),exit_code:run.status};assert.equal(result.fail,0);}
  groups.push(result);assert.equal(run.status,0);assert.equal(result.tests,g.expected_tests);assert.equal(result.pass,g.expected_tests);
 }
 assert.equal(groups.reduce((n,g)=>n+g.tests,0),244);checkpoint='COMPLETE';
}catch{problem='CANONICAL_SOURCE_OR_RETAINED_REGRESSION_REVIEW_REQUIRED';}
const ok=checkpoint==='COMPLETE'&&!problem;
console.log(JSON.stringify({stage_step:stage,batch:'R',result:ok?'LOCAL_BATCH_R244_CANONICAL_HOSTED_V89_ALIGNMENT_SCOPED_PASS':'LOCAL_BATCH_R_REVIEW_REQUIRED',source_parent_commit:'78a1bfc4561782190fa6c20da991f7d2a696214f',node_version:process.version,platform:process.platform,source_hashes_verified:hashes,syntax_checks:syntax,tests:groups.reduce((n,g)=>n+g.tests,0),pass:groups.reduce((n,g)=>n+g.pass,0),fail:ok?0:null,groups,
 canonical_SW_SHA256:'0bc471318eb7156aed4f004c153a3e45fd08a71f665ad77ba59caa29fd8d8c47',archived_v88_SW_SHA256:'de41c590f8538b9998eebc7c5a181792a616db44711486fe3f976f7f0d2e750c',canonical_matches_previously_owner_hosted_bytes:ok,
 cases_include_retained_regressions_and_are_not_unique_coverage:true,Windows_R_execution_verified:false,hosted_Q_result_repeated:false,actual_hosted_requests:0,private_packets_or_credentials_accessed:false,email_requests:0,committed_mode_change_requests:0,artifact_regenerated_or_uploaded:false,hosted_acceptance:false,live_activation_approved:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],checkpoint,problem_code:problem,exit_code:ok?0:1,checked_UTC:new Date().toISOString()},null,2));process.exitCode=ok?0:1;
