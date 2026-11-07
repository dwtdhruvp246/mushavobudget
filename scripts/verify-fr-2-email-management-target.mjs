// Owner offline entrypoint: verifies pinned sources, then actual synthetic SQL.
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifestFile='docs/security-audit/security-fr-2-email-management-target-source-manifest.json';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let verified=0,syntax=0,phase='SOURCE_HASHES',problem=null;
const groups=[];
try {
  assert.equal(process.argv.length,3,'One PGlite module path required');
  const manifest=JSON.parse(await readFile(path.join(root,manifestFile),'utf8'));
  assert.equal(manifest.stage_step,'FR.2.4.E5.9_MANAGEMENT_READ_ONLY_TARGET');
  for(const [file,hash] of Object.entries(manifest.file_sha256)){
    assert(!path.isAbsolute(file)&&!file.includes('\\')&&!file.split('/').includes('..'));
    assert.equal(sha(await readFile(path.join(root,file))),hash);verified++;
  }
  assert.deepEqual((await readdir(path.join(root,'supabase/migrations'))).filter(x=>x.endsWith('.sql')).sort(),manifest.migrations);
  phase='DEPENDENCY';
  const database=path.resolve(process.argv[2]);
  const installed=JSON.parse(await readFile(path.resolve(path.dirname(database),'../package.json'),'utf8'));
  assert.equal(installed.name,'@electric-sql/pglite');assert.equal(installed.version,'0.5.8');
  const lock=JSON.parse(await readFile(path.join(root,'scripts/fixtures/email-session-review-tools/package-lock.json'),'utf8'));
  assert.equal(lock.packages['node_modules/@electric-sql/pglite'].version,'0.5.8');
  assert.equal(lock.packages['node_modules/@electric-sql/pglite'].integrity,'sha512-n9tsbUOhwx2epK1V0ZG9Ar4SHWUju04dhmzZXiSBXwBoleOvIfals33NAaWgagQVAL4Rbvx/Ptsu3P+pA09f6Q==');
  phase='SYNTAX';
  for(const file of manifest.syntax_paths){
    const r=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8',timeout:30000});
    assert.equal(r.status,0);syntax++;
  }
  phase='ACTUAL_SQL_TESTS';
  for(const group of manifest.test_groups){
    const r=spawnSync(process.execPath,['--require',path.join(root,'scripts/offline-test-network.cjs'),'--test','--test-reporter=tap',...group.files.map(f=>path.join(root,f))],{
      cwd:root,encoding:'utf8',env:{...process.env,MUSHAVO_EMAIL_UI_PGLITE:database},timeout:180000,maxBuffer:16*1024*1024
    });
    const out=(r.stdout||'')+'\n'+(r.stderr||'');
    const count=label=>Number(out.match(new RegExp('^# '+label+' (\\d+)\\s*$','m'))?.[1]??-1);
    const receipt={name:group.name,tests:count('tests'),pass:count('pass'),fail:count('fail'),cancelled:count('cancelled'),skipped:count('skipped'),todo:count('todo'),
      failed_case_titles:out.split(/\r?\n/).filter(x=>x.startsWith('not ok ')),exit_code:r.status,signal:r.signal??null,error_code:r.error?.code??null};
    groups.push(receipt);assert.equal(r.status,0);assert.equal(receipt.tests,group.expected_tests);assert.equal(receipt.pass,receipt.tests);
    for(const k of ['fail','cancelled','skipped','todo'])assert.equal(receipt[k],0);
  }
  phase='COMPLETE';
} catch {
  problem='OFFLINE_MANAGEMENT_TARGET_SOURCE_OR_TEST_REVIEW_REQUIRED';
}
const ok=problem===null&&phase==='COMPLETE';
console.log(JSON.stringify({
  stage_step:'FR.2.4.E5.9_MANAGEMENT_READ_ONLY_TARGET',
  result:ok?'OFFLINE_FIXED_MANAGEMENT_TARGET_TRANSPORT_AND_READ_ONLY_SQL_SCOPED_PASS':'OFFLINE_MANAGEMENT_TARGET_REVIEW_REQUIRED',
  source_parent_commit:'0a0244f05e8b81f744afbca526f5a7c80a92564d',node_version:process.version,pglite_version:'0.5.8',
  source_files_SHA256_verified:verified,syntax_checks:syntax,
  tests:groups.reduce((n,g)=>n+Math.max(0,g.tests),0),pass:groups.reduce((n,g)=>n+Math.max(0,g.pass),0),fail:groups.reduce((n,g)=>n+Math.max(0,g.fail),0),groups,
  fixed_two_request_contract_exercised_with_synthetic_provider_ports:ok,
  actual_fixed_SQL_exercised_under_modeled_read_only_role:ok,
  Windows_PowerShell_private_runner_verified:false,
  live_provider_route_or_token_acceptance_verified:false,
  future_installation_target_or_privileges_verified:false,
  full_catalog_fingerprints_or_hook_definitions_verified:false,
  installed_dependency_bytes_independently_hashed:false,
  real_owner_ZIP_DPAPI_packet_or_credentials_accessed:false,
  actual_hosted_requests:0,email_dispatched:false,uploaded_or_deployed:false,
  live_activation_approved:false,hosted_acceptance:false,production_or_native_changed:false,
  APK_update_deferred:true,findings_closed:[],local_checkpoint:phase,problem_code:problem,exit_code:ok?0:1
},null,2));
process.exitCode=ok?0:1;
