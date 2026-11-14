import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,copyFile,rm,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {prepareLimiterPackage,verifyLimiterSourcesAndTools,verifyPreparedLimiterDirectory,
  limiterConfiguration,validateLimiterConfiguration,defaultSourceRoot} from './prepare-fr-2-email-limiter.mjs';
const rows=[];let root=null,problem=null,receipt=null,inputs=null,cleaned=false,syntax=[],failureDetails={};
const check=async(name,fn)=>{await fn();rows.push({check:name,status:'PASS'});};
const refusal=async(fn,code)=>{
  try {await fn();assert.fail('EXPECTED_REFUSAL');}catch(error){assert.equal(error.safeCode,code);}
};
try {
  assert.equal(process.argv.length,3);const toolsRoot=path.resolve(process.argv[2]);
  root=await mkdtemp(path.join(tmpdir(),'mushavo limiter fixture '));
  await check('All reviewed source hashes, complete tools lock and four installed tool versions match',async()=>{
    inputs=await verifyLimiterSourcesAndTools(defaultSourceRoot,toolsRoot);
  });
  const manifest=JSON.parse(await readFile(path.join(defaultSourceRoot,
    'docs/security-audit/security-fr-2-email-limiter-package-source-manifest.json'),'utf8'));
  await check('Every selected JavaScript input passes its Node syntax check',async()=>{
    for(const file of Object.keys(manifest.file_sha256).filter(f=>/\.[cm]js$/.test(f))) {
      const c=spawnSync(process.execPath,['--check',path.join(defaultSourceRoot,file)],{encoding:'utf8',timeout:10000});
      syntax.push({file,pass:c.status===0});assert.equal(c.status,0);
    }
    assert.equal(syntax.length,11);
  });
  const prepared=path.join(root,'prepared');
  await check('Actual esbuild package and actual offline Wrangler dry run preserve the reviewed Worker bytes',async()=>{
    receipt=await prepareLimiterPackage({toolsRoot,outputRoot:prepared});
    assert.equal(receipt.actual_Wrangler_dry_run_exit_code,0);assert.equal(receipt.blocked_network_attempts,0);
    assert(receipt.network_guard_loaded_processes>=2);assert.equal(receipt.worker_files,2);
    assert.equal(receipt.Cloudflare_resources_bindings_or_secrets_created,false);
  });
  await check('Existing preparation is refused without modifying its receipt',async()=>{
    const before=await readFile(path.join(prepared,'preparation-receipt.json'));
    await refusal(()=>prepareLimiterPackage({toolsRoot,outputRoot:prepared}),'NEW_OUTPUT_DIRECTORY_REQUIRED');
    assert.deepEqual(await readFile(path.join(prepared,'preparation-receipt.json')),before);
  });
  await check('Output inside the source is refused before any write',async()=>{
    await refusal(()=>prepareLimiterPackage({toolsRoot,outputRoot:defaultSourceRoot}),'OUTPUT_MUST_BE_OUTSIDE_SOURCE_AND_TOOLS');
  });
  for(const[name,mutate]of Object.entries({
    'Public workers.dev route':c=>c.workers_dev=true,
    'Public preview URL':c=>c.preview_urls=true,
    'Custom public route':c=>c.routes=['example.invalid/*'],
    'Unexpected Worker name':c=>c.name='different-worker',
    'Key-value rather than SQLite class migration':c=>{delete c.migrations[0].new_sqlite_classes;c.migrations[0].new_classes=['EmailGatewayRateLimiter'];},
    'Unexpected secret or account configuration':c=>{c.vars={SYNTHETIC_SECRET:'not-a-real-secret'};c.account_id='synthetic';},
    'Additional module discovery':c=>c.find_additional_modules=true,
    'Foreign namespace binding':c=>c.durable_objects.bindings[0].script_name='foreign-worker'
  }))await check(name+' is refused',async()=>{
    const config=limiterConfiguration();mutate(config);
    await refusal(()=>validateLimiterConfiguration(config),'LIMITER_CONFIGURATION_REVIEW_REQUIRED');
  });
  const clone=path.join(root,'copy');await mkdir(clone);
  for(const file of ['email-rate-worker.mjs','wrangler.json'])
    await copyFile(path.join(prepared,'worker',file),path.join(clone,file));
  await check('Changed Worker bytes are refused',async()=>{
    const file=path.join(clone,'email-rate-worker.mjs'),original=await readFile(file);
    await writeFile(file,Buffer.concat([original,Buffer.from('\n// changed\n')]));
    await refusal(()=>verifyPreparedLimiterDirectory(clone),'LIMITER_BUNDLE_HASH_MISMATCH');await writeFile(file,original);
  });
  await check('An extra private-looking file refuses the entire upload package without reading it',async()=>{
    const file=path.join(clone,'synthetic.dpapi');await writeFile(file,'synthetic canary');
    await refusal(()=>verifyPreparedLimiterDirectory(clone),'PACKAGE_FILE_SET_REVIEW_REQUIRED');
    assert.equal(await readFile(file,'utf8'),'synthetic canary');await rm(file);
  });
  await check('Changed source refuses preparation before an output directory is created',async()=>{
    const source=path.join(root,'modified-source');await mkdir(source);
    for(const file of [...Object.keys(manifest.file_sha256),
      'docs/security-audit/security-fr-2-email-limiter-package-source-manifest.json']) {
      const target=path.join(source,file);await mkdir(path.dirname(target),{recursive:true});
      await copyFile(path.join(defaultSourceRoot,file),target);
    }
    await writeFile(path.join(source,'supabase/functions/_shared/email-verification-rate-do.mjs'),'// altered source');
    const out=path.join(root,'must-not-exist');
    await refusal(()=>prepareLimiterPackage({sourceRoot:source,toolsRoot,outputRoot:out}),'SOURCE_HASH_MISMATCH');
    await assert.rejects(lstat(out),{code:'ENOENT'});
  });
  await check('Changed dependency lock refuses before loading a tool or writing a package',async()=>{
    const tools=path.join(root,'changed-tools');await mkdir(tools);
    await writeFile(path.join(tools,'package-lock.json'),'{}');
    await refusal(()=>prepareLimiterPackage({toolsRoot:tools,outputRoot:path.join(root,'bad-tools-output')}),'TOOLS_LOCK_MISMATCH');
  });
  await check('The dry-run CLI network guard actually refuses fetch and records no address or payload',async()=>{
    const report=path.join(root,'guard-probe');
    const c=spawnSync(process.execPath,['--require',path.join(defaultSourceRoot,'scripts/offline-cloudflare-deploy.cjs'),
      '-e','let refused=false;try{fetch("https://example.invalid")}catch{refused=true}process.exitCode=refused?0:1'],{
      env:{...process.env,MUSHAVO_LIMITER_NETWORK_REPORT:report},encoding:'utf8',timeout:5000});
    assert.equal(c.status,0);assert.equal(c.stdout,'');assert.equal(c.stderr,'');
    assert.equal(await readFile(report,'utf8'),'LB');
  });
} catch(error) {
  problem=/^[A-Z][A-Z0-9_]{1,80}$/.test(error.safeCode||'')?error.safeCode:'LOCAL_LIMITER_PACKAGE_CHECK_REVIEW_REQUIRED';
  failureDetails={local_Wrangler_exit_code:error.localWranglerExit??null,
    local_Wrangler_start_error:error.localWranglerStartError??null,
    dry_run_network_guard_loads:error.guardLoads??null,dry_run_blocked_network_attempts:error.blockedAttempts??null};
}
finally {if(root){try{await rm(root,{recursive:true,force:true});cleaned=true;}catch{problem='LOCAL_FIXTURE_CLEANUP_REVIEW_REQUIRED';}}}
console.log(JSON.stringify({stage_step:'FR.2.4.E3.4_LIMITER_PACKAGE_OFFLINE',
  result:!problem?'OFFLINE_ACTUAL_PACKAGE_WRANGLER_DRY_RUN_AND_REFUSAL_CHECKS_SCOPED_PASS':'LOCAL_PACKAGE_REVIEW_REQUIRED',
  node_version:process.version,source_files_SHA256_verified:inputs?.source_files_SHA256_verified||0,
  tools:inputs?.tools||null,tools_lock_SHA256_matched:!!inputs?.tools_lock_SHA256_matched,
  checks:rows.length,pass:rows.length,fail:problem?1:0,exit_code:problem?1:0,checks_detail:rows,
  syntax_checks:syntax.length,syntax,actual_package_receipt:receipt,
  temporary_fixture_cleanup_completed:cleaned,Windows_Wrangler_execution_verified:false,
  actual_Cloudflare_Auth_Zoho_or_SQL_requests:0,real_email_dispatched:false,deployed:false,
  hosted_acceptance:false,production_or_native_changed:false,findings_closed:[],
  problem_code:problem,...failureDetails,APK_update_deferred:true},null,2));
process.exitCode=problem?1:0;
