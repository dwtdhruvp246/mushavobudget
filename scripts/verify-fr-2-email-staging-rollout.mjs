// Owner offline entrypoint: verifies pinned sources, then actual synthetic SQL.
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifestFile='docs/security-audit/security-fr-2-email-staging-rollout-source-manifest.json';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let verified=0,syntax=0,phase='SOURCE_HASHES',problem=null;
const groups=[];
try {
  assert.equal(process.argv.length,3,'One PGlite module path required');
  const manifest=JSON.parse(await readFile(path.join(root,manifestFile),'utf8'));
  assert.equal(manifest.stage_step,'FR.2.4.E5.8_STAGING_ACTIVATION_RECOVERY_CANDIDATE');
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
  problem='OFFLINE_STAGING_ROLLOUT_SOURCE_OR_TEST_REVIEW_REQUIRED';
}
const ok=problem===null&&phase==='COMPLETE';
console.log(JSON.stringify({
  stage_step:'FR.2.4.E5.8_STAGING_ACTIVATION_RECOVERY_CANDIDATE',
  result:ok?'OFFLINE_STAGING_REGISTRATION_QUARANTINED_ACTIVATION_AND_RECOVERY_SCOPED_PASS':'OFFLINE_STAGING_ROLLOUT_REVIEW_REQUIRED',
  source_parent_commit:'5aecaff46cc4ad77315cbf3a311507fa81e27c4c',node_version:process.version,pglite_version:'0.5.8',
  source_files_SHA256_verified:verified,syntax_checks:syntax,
  tests:groups.reduce((n,g)=>n+Math.max(0,g.tests),0),pass:groups.reduce((n,g)=>n+Math.max(0,g.pass),0),fail:groups.reduce((n,g)=>n+Math.max(0,g.fail),0),groups,
  actual_candidate_SQL_exercised_in_synthetic_database:ok,
  original55_migrations_and_canonical_source_preserved:true,
  new_candidate_is_not_an_ordered_migration:true,
  target_GUC_is_operator_acknowledgement_not_independent_target_attestation:true,
  committed_recovery_retains_guards_proofs_and_application_rows:ok,
  selected_catalog_drift_blocks_resume:ok,
  in_flight_transactions_or_real_PostgreSQL_concurrency_verified:false,
  installed_dependency_bytes_independently_hashed:false,
  real_owner_ZIP_DPAPI_packet_or_credentials_accessed:false,
  actual_hosted_requests:0,email_dispatched:false,uploaded_or_deployed:false,
  live_activation_approved:false,hosted_acceptance:false,production_or_native_changed:false,
  APK_update_deferred:true,findings_closed:[],local_checkpoint:phase,problem_code:problem,exit_code:ok?0:1
},null,2));
process.exitCode=ok?0:1;
