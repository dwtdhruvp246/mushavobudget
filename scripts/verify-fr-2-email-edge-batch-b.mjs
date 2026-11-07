// Offline regression verification. Owner ZIP, credentials and DPAPI are not accessed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {batchBStage} from './prepare-fr-2-email-edge-batch-b.mjs';
import {assertOrdinaryPath} from './prepare-fr-2-email-edge-package.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let phase='SOURCE_IDENTITIES',count=0,syntax=0,group=null,problem=null;
try{
  assert.equal(process.argv.length,2);
  const manifestFile=path.join(root,'docs/security-audit/security-fr-2-email-edge-batch-b-source-manifest.json');
  assertOrdinaryPath(manifestFile);
  const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  assert.equal(manifest.stage_step,batchBStage);assert.equal(manifest.source_file_count,91);
  assert.equal(Object.keys(manifest.file_sha256).length,91);
  for(const [name,expected] of Object.entries(manifest.file_sha256)){
    assert(/^[A-Za-z0-9_./-]+$/.test(name)&&!name.includes('..')&&!path.isAbsolute(name));
    assert(/^[a-f0-9]{64}$/.test(expected));const file=path.join(root,name);assertOrdinaryPath(file);
    assert(fs.lstatSync(file).isFile());
    assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),expected);count++;
  }
  const env={...process.env,NODE_OPTIONS:'',NODE_DEBUG:'',NODE_DEBUG_NATIVE:''};
  phase='JS_SYNTAX';
  for(const name of ['scripts/prepare-fr-2-email-edge-batch-b.mjs','scripts/verify-fr-2-email-edge-batch-b.mjs','tests/fr-2-email-edge-batch-b.test.mjs']){
    const run=spawnSync(process.execPath,['--check',path.join(root,name)],{encoding:'utf8',timeout:10000,env});assert.equal(run.status,0);syntax++;
  }
  phase='BATCH_B_REGRESSIONS';
  const run=spawnSync(process.execPath,['--require',path.join(root,'scripts/offline-test-network.cjs'),'--test','--test-reporter=tap',path.join(root,'tests/fr-2-email-edge-batch-b.test.mjs')],{cwd:root,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024,env});
  const output=(run.stdout||'')+'\n'+(run.stderr||'');
  const total=n=>Number(output.match(new RegExp('^# '+n+' (\\d+)\\s*$','m'))?.[1]??-1);
  group=Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(n=>[n,total(n)]));
  group.exit_code=run.status;
  assert.equal(run.status,0);assert.equal(group.tests,12);assert.equal(group.pass,12);
  for(const name of ['fail','cancelled','skipped','todo'])assert.equal(group[name],0);
  phase='COMPLETE';
}catch{problem='OFFLINE_BATCH_B_REVIEW_REQUIRED';}
const good=problem===null;
console.log(JSON.stringify({stage_step:batchBStage,batch:'B',result:good?'OFFLINE_BATCH_B_12_PASS_OWNER_RUN_PENDING':'OFFLINE_BATCH_B_REVIEW_REQUIRED',
  source_parent_commit:'73d63dc4f4a485e1b4869e8d17ff0ff33fdc9bbb',node_version:process.version,
  source_files_SHA256_verified:count,JS_syntax_checks:syntax,regressions:group,
  Windows_parent_execution_verified:false,owner_ZIP_accessed:false,owner_credentials_or_private_packets_accessed:false,
  actual_hosted_requests:0,uploaded_or_deployed:false,email_push_or_FX_dispatched:false,
  live_activation_approved:false,hosted_acceptance:false,production_or_native_changed:false,APK_update_deferred:true,
  findings_closed:[],checkpoint:phase,problem_code:problem,exit_code:good?0:1},null,2));
process.exitCode=good?0:1;
