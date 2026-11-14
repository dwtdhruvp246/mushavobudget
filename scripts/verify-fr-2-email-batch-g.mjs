// Current source proof + compiled gateway/SQL integration + read-only preflight regressions.
import assert from 'node:assert/strict';
import {readFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const stage='FR.2.4.E5.20_BATCH_G_FRONTEND_GATEWAY_ROLLOUT_PREPARATION';
let phase='SOURCE_IDENTITIES',verified=0,syntax=0,problem=null;const groups=[];
try{
 assert.equal(process.argv.length,4);const database=path.resolve(process.argv[2]),tools=path.resolve(process.argv[3]);
 const m=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-batch-g-source-manifest.json'),'utf8'));
 assert.equal(m.stage_step,stage);assert.equal(Object.keys(m.file_sha256).length,m.source_file_count);
 for(const [file,hash]of Object.entries(m.file_sha256)){assert(/^[A-Za-z0-9_./-]+$/.test(file)&&!file.includes('..')&&!path.isAbsolute(file));let p=path.join(root,file);
  for(;;){assert(!(await lstat(p)).isSymbolicLink());const parent=path.dirname(p);if(parent===p)break;p=parent;}
  assert.equal(createHash('sha256').update(await readFile(path.join(root,file))).digest('hex'),hash);verified++;
 }
 phase='PINNED_DEPENDENCIES';
 const pglite=JSON.parse(await readFile(path.resolve(path.dirname(database),'../package.json'),'utf8'));
 const esbuild=JSON.parse(await readFile(path.join(tools,'node_modules/esbuild/package.json'),'utf8'));
 assert.equal(pglite.name,'@electric-sql/pglite');assert.equal(pglite.version,'0.5.8');assert.equal(esbuild.name,'esbuild');assert.equal(esbuild.version,'0.28.2');
 const lock=JSON.parse(await readFile(path.join(root,'scripts/fixtures/email-rollout-review-tools/package-lock.json'),'utf8'));
 assert.equal(lock.packages['node_modules/esbuild'].integrity,'sha512-HKVLS8dvII+xoKW9kmqxbRKrnWEXfJJr/FZhhJmiqIB0e053QNYFqOBouTMO/k5sID4MvCiUCvv8b9M4h32wIA==');
 assert.equal(lock.packages['node_modules/@electric-sql/pglite'].integrity,'sha512-n9tsbUOhwx2epK1V0ZG9Ar4SHWUju04dhmzZXiSBXwBoleOvIfals33NAaWgagQVAL4Rbvx/Ptsu3P+pA09f6Q==');
 phase='SYNTAX';for(const file of m.syntax_paths){assert.equal(spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8',timeout:30000}).status,0);syntax++;}
 phase='COMPILED_WORKER_SQL_AND_PREFLIGHT_TESTS';
 for(const group of m.test_groups){
  const r=spawnSync(process.execPath,['--require',path.join(root,'scripts/offline-test-network.cjs'),'--test','--test-reporter=tap',path.join(root,group.file)],{
   cwd:root,encoding:'utf8',env:{...process.env,MUSHAVO_EMAIL_UI_PGLITE:database,MUSHAVO_EMAIL_G_WORKER_TOOLS:tools},timeout:120000,maxBuffer:8*1024*1024});
  const out=(r.stdout||'')+'\n'+(r.stderr||'');const count=k=>Number(out.match(new RegExp('^# '+k+' (\\d+)\\s*$','m'))?.[1]??-1);
  const g={name:group.name,tests:count('tests'),pass:count('pass'),fail:count('fail'),cancelled:count('cancelled'),skipped:count('skipped'),todo:count('todo'),
   failed_case_titles:out.split(/\r?\n/).filter(x=>x.startsWith('not ok ')),exit_code:r.status,signal:r.signal??null,error_code:r.error?.code??null};groups.push(g);
  assert.equal(r.status,0);assert.equal(g.tests,group.expected_tests);assert.equal(g.pass,g.tests);for(const k of ['fail','cancelled','skipped','todo'])assert.equal(g[k],0);
 }
 phase='COMPLETE';
}catch{problem='OFFLINE_BATCH_G_SOURCE_DEPENDENCY_OR_TEST_REVIEW_REQUIRED';}
const ok=phase==='COMPLETE'&&problem===null;
console.log(JSON.stringify({stage_step:stage,result:ok?'OFFLINE_BATCH_G_COMPILED_GATEWAY_SQL_AND_PREFLIGHT31_PASS_OWNER_PENDING':'OFFLINE_BATCH_G_REVIEW_REQUIRED',
 source_parent_commit:'7bfe5a93bcc4e1510fd390c6e5362e484246c841',node_version:process.version,pglite_version:'0.5.8',esbuild_version:'0.28.2',
 source_files_SHA256_verified:verified,syntax_checks:syntax,tests:groups.reduce((n,g)=>n+Math.max(0,g.tests),0),pass:groups.reduce((n,g)=>n+Math.max(0,g.pass),0),fail:groups.reduce((n,g)=>n+Math.max(0,g.fail),0),groups,
 actual_accepted_Worker_rebuilt_and_hash_verified:ok,compiled_Worker_actual_integrated_SQL_and_shared_Edge_check_exercised:ok,
 Auth_Zoho_and_Durable_Object_boundaries_synthetic:true,actual_Cloudflare_or_provider_runtime_verified:false,
 all_five_preflight_transport_failure_positions_exercised:ok,Windows_parent_execution_verified:false,owner_ZIP_or_private_packets_accessed:false,
 installed_dependency_bytes_independently_hashed:false,actual_hosted_requests:0,uploaded_or_deployed:false,
 hosted_SQL_activation_or_resume_invoked:false,email_push_or_FX_dispatched:false,live_activation_approved:false,hosted_acceptance:false,
 production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],checkpoint:phase,problem_code:problem,exit_code:ok?0:1},null,2));
process.exitCode=ok?0:1;
