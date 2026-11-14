// Offline only: actual changed gateway, compiled Worker/SQLite DO and full55 SQL; no owner credentials.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const toolsRoot=path.resolve(process.argv[2]||path.join(root,'scripts/fixtures/email-worker-tools'));
const dbTools=path.resolve(process.argv[3]||path.join(root,'scripts/fixtures/email-session-review-tools'));
const hash=x=>createHash('sha256').update(x).digest('hex');
let manifest,hashes=0,toolsVerified=false,syntax=0,checkpoint='SOURCE_HASHES',problem=null;
const groups=[];
try {
  manifest=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-modern-source-manifest.json'),'utf8'));
  assert.equal(manifest.stage_step,'FR.2.4.E5.4_MODERN_KEYS_AND_PRIVATE_PREPARATION');
  const files=Object.entries(manifest.file_sha256);assert.equal(files.length,manifest.source_file_count);assert(files.length>=80);
  for(const [p,h]of files){assert(/^[A-Za-z0-9_./-]+$/.test(p)&&!p.includes('..')&&!path.isAbsolute(p));assert.equal(hash(await readFile(path.join(root,p))),h);hashes++;}
  checkpoint='PINNED_TOOLS';
  for(const [dir,relative,names]of [[toolsRoot,'scripts/fixtures/email-worker-tools',['esbuild','miniflare','workerd']],
    [dbTools,'scripts/fixtures/email-session-review-tools',['@electric-sql/pglite']]]) {
    const raw=await readFile(path.join(dir,'package-lock.json'));assert.equal(hash(raw),manifest.file_sha256[relative+'/package-lock.json']);
    const lock=JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,''));
    for(const name of names){const p=JSON.parse(await readFile(path.join(dir,'node_modules',name,'package.json'),'utf8'));
      assert.equal(p.name,name);assert.equal(p.version,manifest.tools[name]);assert.equal(lock.packages['node_modules/'+name].version,p.version);}
  }
  toolsVerified=true;checkpoint='SOURCE_SYNTAX';
  for(const p of files.map(x=>x[0]).filter(x=>/\.[cm]js$/.test(x))){
    const c=spawnSync(process.execPath,['--check',path.join(root,p)],{encoding:'utf8',timeout:15000});assert.equal(c.status,0);syntax++;
  }
  const database=path.join(dbTools,'node_modules/@electric-sql/pglite/dist/index.js');
  function runtime(file,args,count,label){
    checkpoint=label;
    const c=spawnSync(process.execPath,[path.join(root,file),...args],{encoding:'utf8',timeout:60000,maxBuffer:4194304,cwd:root});
    let r;try{r=JSON.parse(c.stdout);}catch{throw Error('SAFE_RUNTIME_RECEIPT_UNAVAILABLE');}
    assert.equal(c.status,0);assert.equal(r.exit_code,0);assert.equal(r.tests,count);assert.equal(r.pass,count);assert.equal(r.fail,0);
    assert.deepEqual(r.bundle_sha256,manifest.expected_bundle_sha256);
    assert.equal(r.actual_hosted_requests??r.hosted_Auth_Zoho_Cloudflare_requests,0);
    groups.push({name:label,tests:count,pass:count,fail:0});
  }
  runtime('scripts/check-fr-2-email-current-runtime.mjs',[toolsRoot,database],21,'ACTUAL_MODERN_KEY_WORKER_AND_FULL55_SQL');
  runtime('scripts/check-fr-2-email-workers.mjs',[toolsRoot],31,'SHARED_WORKER_AND_REAL_SQLITE_LIMITER_REGRESSIONS');
  checkpoint='ACTUAL_GATEWAY_MODERN_HEADERS_AND_PRIVATE_PACKET_BOUNDARIES';
  const c=spawnSync(process.execPath,['--require',path.join(root,'scripts/offline-test-network.cjs'),
    '--test','--test-reporter=tap',...['fr-2-email-gateway.test.mjs','fr-2-email-modern-key.test.mjs','fr-2-email-private-packet.test.mjs'].map(x=>path.join(root,'tests',x))],
    {encoding:'utf8',timeout:30000,maxBuffer:4194304,cwd:root});
  const n=name=>Number((c.stdout||'').match(new RegExp('^# '+name+' (\\d+)$','m'))?.[1]||0);
  assert.equal(c.status,0);assert.equal(n('tests'),89);assert.equal(n('pass'),89);assert.equal(n('fail'),0);
  groups.push({name:checkpoint,tests:89,pass:89,fail:0});checkpoint='COMPLETE';
}catch{problem='MODERN_SOURCE_DEPENDENCY_RUNTIME_OR_PACKET_REVIEW_REQUIRED';}
const good=!problem&&groups.length===3;
console.log(JSON.stringify({stage_step:'FR.2.4.E5.4_MODERN_KEYS_AND_PRIVATE_PREPARATION',
  result:good?'OFFLINE_MODERN_KEY_TRANSPORT_CURRENT_WORKER_SQL_AND_PRIVATE_PACKET_SCOPED_PASS':'OFFLINE_MODERN_PREPARATION_REVIEW_REQUIRED',
  source_parent_commit:manifest?.source_parent_commit||null,node_version:process.version,
  source_files_SHA256_verified:hashes,tools_locks_and_installed_versions_matched:toolsVerified,
  installed_package_bytes_independently_hashed:false,tools:manifest?.tools||null,syntax_checks:syntax,
  tests:groups.reduce((n,x)=>n+x.tests,0),pass:groups.reduce((n,x)=>n+x.pass,0),fail:good?0:1,groups,
  expected_bundle_sha256:manifest?.expected_bundle_sha256||null,
  modern_service_key_sent_only_in_apikey_header:good,caller_JWT_Auth_and_actor_session_binding_preserved:good,
  actual_local_Worker_SQLite_DO_and_full55_SQL_verified:good,private_packet_uses_actual_gateway_constructor:good,
  old_review_ZIP_requires_replacement_before_modern_key_deployment:true,
  actual_Windows_DPAPI_or_private_packet_file_save_verified:false,
  actual_provider_key_ownership_JWT_signature_mail_or_hosted_acceptance_verified:false,
  actual_Auth_Zoho_Cloudflare_or_hosted_SQL_requests:0,email_dispatched:false,
  real_owner_credentials_or_private_Zoho_file_accessed:false,Cloudflare_secrets_SQL_Auth_or_settings_changed:false,
  full_repository_1525_regression_rerun:false,live_activation_approved:false,hosted_acceptance:false,
  production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],local_checkpoint:checkpoint,
  problem_code:problem,exit_code:good?0:1},null,2));process.exitCode=good?0:1;
