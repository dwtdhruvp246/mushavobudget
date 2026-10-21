// Built-in Node only; validates identities and tests synthetic provider ports.
import assert from 'node:assert/strict';
import {readFile,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const stage='FR.2.4.E5.10_EDGE_METADATA_INVENTORY';
let phase='SOURCE_HASHES',problem=null,verified=0,syntax=0,group=null;
try{
  assert.equal(process.argv.length,2,'No input arguments supported');
  const manifest=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-edge-inventory-source-manifest.json'),'utf8'));
  assert.equal(manifest.stage_step,stage);assert.equal(Object.keys(manifest.file_sha256).length,manifest.source_file_count);
  for(const [file,expected]of Object.entries(manifest.file_sha256)){
    assert(/^[A-Za-z0-9_./-]+$/.test(file)&&!path.isAbsolute(file)&&!file.includes('..'));
    const full=path.join(root,file),stat=await lstat(full);
    assert(stat.isFile()&&!stat.isSymbolicLink());
    const real=await realpath(full);assert.equal(process.platform==='win32'?real.toLowerCase():real,process.platform==='win32'?full.toLowerCase():full);
    assert.equal(createHash('sha256').update(await readFile(full)).digest('hex'),expected);verified++;
  }
  phase='SYNTAX';
  for(const file of manifest.syntax_paths){
    const r=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8',timeout:10000});assert.equal(r.status,0);syntax++;
  }
  phase='OFFLINE_TESTS';
  const r=spawnSync(process.execPath,['--require',path.join(root,'scripts/offline-test-network.cjs'),'--test','--test-reporter=tap',path.join(root,'tests/fr-2-email-edge-inventory.test.mjs')],{
    cwd:root,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024,
    env:{...process.env,NODE_OPTIONS:'',NODE_DEBUG:'',NODE_DEBUG_NATIVE:''}
  });
  const out=(r.stdout||'')+'\n'+(r.stderr||'');
  const count=k=>Number(out.match(new RegExp('^# '+k+' (\\d+)\\s*$','m'))?.[1]??-1);
  group={tests:count('tests'),pass:count('pass'),fail:count('fail'),cancelled:count('cancelled'),skipped:count('skipped'),todo:count('todo'),
    failed_case_titles:out.split(/\r?\n/).filter(x=>x.startsWith('not ok ')),exit_code:r.status,signal:r.signal??null,error_code:r.error?.code??null};
  assert.equal(r.status,0);assert.equal(group.tests,manifest.expected_tests);assert.equal(group.pass,group.tests);
  for(const k of ['fail','cancelled','skipped','todo'])assert.equal(group[k],0);
  phase='COMPLETE';
}catch{problem='OFFLINE_EDGE_INVENTORY_SOURCE_OR_TEST_REVIEW_REQUIRED';}
const ok=problem===null;
console.log(JSON.stringify({stage_step:stage,result:ok?'OFFLINE_FIXED_EDGE_METADATA_INVENTORY_SCOPED_PASS':'OFFLINE_EDGE_INVENTORY_REVIEW_REQUIRED',
  source_parent_commit:'3dd3afdcbc6f572fc2871a821774a5dfce0155c3',node_version:process.version,
  source_files_SHA256_verified:verified,syntax_checks:syntax,group,
  synthetic_provider_transport_tests:true,Windows_PowerShell_private_runner_verified:false,
  actual_hosted_requests:0,provider_inventory_or_token_acceptance_verified:false,
  deployment_source_parity_verified:false,previous_deployable_artifacts_retained:false,
  runtime_JWT_or_service_access_verified:false,live_activation_approved:false,hosted_acceptance:false,
  uploaded_or_deployed:false,email_or_push_dispatched:false,production_or_native_changed:false,
  APK_update_deferred:true,findings_closed:[],checkpoint:phase,problem_code:problem,exit_code:ok?0:1},null,2));
process.exitCode=ok?0:1;
