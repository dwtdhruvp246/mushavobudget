// Credential-free verification of the actual private transport and source matcher.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const stage='FR.2.4.E5.16R_READ_ONLY_POST_INSTALL_SOURCE_REVIEW';
let verified=0,syntax=0,phase='SOURCE_HASHES',problem=null,group=null;
try{
  assert.equal(process.argv.length,2);
  const m=JSON.parse(fs.readFileSync(path.join(root,'docs/security-audit/security-fr-2-email-edge-installed-source-manifest.json'),'utf8'));
  assert.equal(m.stage_step,stage);assert.equal(m.source_file_count,14);assert.equal(Object.keys(m.file_sha256).length,14);
  for(const [name,hash]of Object.entries(m.file_sha256)){
    assert(/^[A-Za-z0-9_./-]+$/.test(name)&&!name.includes('..')&&!path.isAbsolute(name));
    const file=path.join(root,name);let p=file;
    for(;;){assert(!fs.lstatSync(p).isSymbolicLink());const parent=path.dirname(p);if(parent===p)break;p=parent;}
    assert(fs.statSync(file).isFile());assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash);verified++;
  }
  phase='SYNTAX';
  for(const name of m.syntax_paths){const r=spawnSync(process.execPath,['--check',path.join(root,name)],{encoding:'utf8',timeout:30000});assert.equal(r.status,0);syntax++;}
  phase='ACTUAL_PRIVATE_HANDLER_AND_CONFIGURATION_TESTS';
  const r=spawnSync(process.execPath,['--require',path.join(root,'scripts/offline-test-network.cjs'),'--test','--test-reporter=tap',path.join(root,'tests/fr-2-email-edge-installed-review.test.mjs')],{cwd:root,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
  const out=(r.stdout||'')+'\n'+(r.stderr||'');
  const count=label=>Number(out.match(new RegExp('^# '+label+' (\\d+)\\s*$','m'))?.[1]??-1);
  group={tests:count('tests'),pass:count('pass'),fail:count('fail'),cancelled:count('cancelled'),skipped:count('skipped'),todo:count('todo'),failed_case_titles:out.split(/\r?\n/).filter(x=>x.startsWith('not ok ')),exit_code:r.status,signal:r.signal??null,error_code:r.error?.code??null};
  assert.equal(r.status,0);assert.equal(group.tests,12);assert.equal(group.pass,12);
  for(const key of ['fail','cancelled','skipped','todo'])assert.equal(group[key],0);
  phase='COMPLETE';
}catch{problem='OFFLINE_EDGE_IMPACT_SOURCE_OR_TEST_REVIEW_REQUIRED';}
const ok=phase==='COMPLETE'&&problem===null;
console.log(JSON.stringify({stage_step:stage,result:ok?'OFFLINE_POST_INSTALL_READ_ONLY_REVIEW_12_PASS_OWNER_PENDING':'OFFLINE_EDGE_IMPACT_REVIEW_REQUIRED',source_parent_commit:'267da01c12481c13fd93681798d2a82a941858a8',node_version:process.version,source_files_SHA256_verified:verified,syntax_checks:syntax,tests:group?.tests??0,pass:group?.pass??0,fail:group?.fail??0,group,
  actual_source_decoder_and_private_transport_exercised_with_synthetic_inputs:ok,
  current_source_and_installed_names_exercised_with_synthetic_responses:ok,
  downloaded_provider_source_executed_or_saved:false,Windows_private_runner_verified:false,
  live_source_parity_or_shared_configuration_runtime_impact_verified:false,
  credentials_or_private_packet_accessed:false,actual_hosted_requests:0,
  settings_or_deployments_changed:false,email_push_or_FX_dispatched:false,
  uploaded_or_deployed:false,readiness_approved:false,live_activation_approved:false,hosted_acceptance:false,
  production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],local_checkpoint:phase,problem_code:problem,exit_code:ok?0:1},null,2));
process.exitCode=ok?0:1;
