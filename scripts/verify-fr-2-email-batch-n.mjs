// Pinned local-source, protocol and actual engine verification; no owner credentials or services.
import assert from 'node:assert/strict';
import {readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {browserAcceptance,stage} from './check-fr-2-email-batch-n.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let checkpoint='PINNED_SOURCE',hashes=0,syntax=0,groups=[],browser=null,problem=null;
try{
 assert.equal(process.argv.length,3);
 const manifest=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-batch-n-source-manifest.json'),'utf8'));
 assert.equal(manifest.stage_step,stage);assert.equal(Object.keys(manifest.file_sha256).length,manifest.source_file_count);
 for(const [file,hash]of Object.entries(manifest.file_sha256)){
  assert(/^[A-Za-z0-9_./-]+$/.test(file)&&!file.includes('..')&&!path.isAbsolute(file));
  let probe=path.join(root,file);for(;;){assert(!(await lstat(probe)).isSymbolicLink());const parent=path.dirname(probe);if(parent===probe)break;probe=parent;}
  assert.equal(createHash('sha256').update(await readFile(path.join(root,file))).digest('hex'),hash);hashes++;
 }
 checkpoint='SYNTAX';for(const file of manifest.syntax_paths){const run=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8',timeout:30000});assert.equal(run.status,0);syntax++;}
 for(const group of manifest.test_groups){
  checkpoint=group.name;
  const run=spawnSync(process.execPath,[...(group.network==='DENY'?['--require',path.join(root,'scripts/offline-test-network.cjs')]:[]),'--test','--test-concurrency=1','--test-reporter=tap',...group.files.map(f=>path.join(root,f))],{cwd:root,encoding:'utf8',timeout:90000,maxBuffer:4*1024*1024});
  const output=(run.stdout||'')+'\n'+(run.stderr||'');const count=k=>Number(output.match(new RegExp('^# '+k+' (\\d+)\\s*$','m'))?.[1]??-1);
  const result={name:group.name,tests:count('tests'),pass:count('pass'),fail:count('fail'),cancelled:count('cancelled'),skipped:count('skipped'),todo:count('todo'),exit_code:run.status,signal:run.signal??null,error_code:run.error?.code??null,failed_case_titles:output.split(/\r?\n/).filter(x=>/^\s*not ok /.test(x))};groups.push(result);
  assert.equal(run.status,0);assert.equal(result.tests,group.expected_tests);assert.equal(result.pass,result.tests);for(const k of ['fail','cancelled','skipped','todo'])assert.equal(result[k],0);
 }
 checkpoint='ACTUAL_LOCAL_BROWSER';browser=await browserAcceptance(process.argv[2]);assert.equal(browser.exit_code,0);assert.equal(browser.tests,21);assert.equal(browser.pass,21);assert.equal(browser.fail,0);checkpoint='COMPLETE';
}catch{problem='LOCAL_BATCH_N_SOURCE_OR_BROWSER_REVIEW_REQUIRED';}
const ok=checkpoint==='COMPLETE'&&!problem;
console.log(JSON.stringify({stage_step:stage,batch:'N',result:ok?'LOCAL_BATCH_N120_BROWSER_ENGINE_SCOPED_PASS':'LOCAL_BATCH_N_REVIEW_REQUIRED',source_parent_commit:'24c0f83dc1383966e35f06e4e63674c9798ef7ce',node_version:process.version,platform:process.platform,
 source_hashes_verified:hashes,syntax_checks:syntax,tests:groups.reduce((n,g)=>n+Math.max(0,g.tests),0)+(browser?.tests??0),pass:groups.reduce((n,g)=>n+Math.max(0,g.pass),0)+(browser?.pass??0),fail:groups.reduce((n,g)=>n+Math.max(0,g.fail),0)+(browser?.fail??0),groups,browser,
 actual_hosted_requests_by_harness:0,real_email_requests:0,private_packets_accessed:false,committed_mode_change_requests:0,hosted_acceptance:false,live_activation_approved:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],checkpoint,problem_code:problem,exit_code:ok?0:1},null,2));process.exitCode=ok?0:1;
