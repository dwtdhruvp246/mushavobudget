import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tests=['tests/fr-2-email-gateway.test.mjs','scripts/check-fr-2-email-gateway-db.mjs'];
const syntaxFiles=['supabase/functions/_shared/email-verification-http.mjs','supabase/functions/_shared/email-verification-crypto.mjs',
 'supabase/functions/_shared/email-verification-zoho.mjs','supabase/functions/_shared/email-verification-gateway.mjs',
 ...tests,'scripts/verify-fr-2-email-gateway.mjs','scripts/offline-test-network.cjs'];
let sourceCount=0,dependency=false,syntax=[],child=null,manifest;
try {
 manifest=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-gateway-source-manifest.json'),'utf8'));
 const entries=Object.entries(manifest.file_sha256);assert.equal(entries.length,64);
 for(const[file,digest]of entries){
  assert(/^[A-Za-z0-9_./-]+$/.test(file)&&!file.includes('..')&&!path.isAbsolute(file));
  assert.equal(createHash('sha256').update(await readFile(path.join(root,file))).digest('hex'),digest);sourceCount++;
 }
 const pgPath=path.resolve(process.argv[2]||path.join(root,'node_modules/@electric-sql/pglite/dist/index.js'));
 const pkg=JSON.parse(await readFile(path.resolve(path.dirname(pgPath),'../package.json'),'utf8'));
 const depRoot=path.resolve(path.dirname(pgPath),'../../../..');
 const lock=JSON.parse((await readFile(path.join(depRoot,'package-lock.json'),'utf8')).replace(/^\uFEFF/,''));
 const entry=lock.packages?.['node_modules/@electric-sql/pglite'];
 assert.equal(pkg.name,'@electric-sql/pglite');assert.equal(pkg.version,'0.5.8');assert.equal(entry?.version,'0.5.8');
 assert.equal(entry.integrity,manifest.test_dependency.integrity);
 assert.equal(entry.resolved,'https://registry.npmjs.org/@electric-sql/pglite/-/pglite-0.5.8.tgz');dependency=true;
 for(const file of syntaxFiles){const check=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8',timeout:15000});syntax.push({file,pass:check.status===0});}
 assert(syntax.every(x=>x.pass));
 child=spawnSync(process.execPath,['--require',path.join(root,'scripts/offline-test-network.cjs'),
  '--test','--test-reporter=tap',...tests.map(f=>path.join(root,f))],{
  cwd:root,encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024,
  env:{...process.env,MUSHAVO_EMAIL_GATEWAY_PGLITE:pgPath}
 });
 assert.equal(child.status,0);
} catch { /* Print only the bounded summary below; upstream bodies and secrets are never emitted. */ }
const output=child?.stdout||'';
const count=name=>Number(output.match(new RegExp('^# '+name+' (\\d+)$','m'))?.[1]||0);
const good=sourceCount===64&&dependency&&syntax.length===8&&syntax.every(x=>x.pass)
 && child?.status===0&&count('tests')===63&&count('pass')===63&&count('fail')===0;
const receipt={stage_step:'FR.2.4.E3.1',
 result:good?'OFFLINE_ACTUAL_GATEWAY_MAIL_ADAPTER_AND_SQL_INTEGRATION_SCOPED_PASS':'OFFLINE_EMAIL_GATEWAY_REVIEW_REQUIRED',
 scope:'ACTUAL_PORTABLE_GATEWAY_ZOHO_ADAPTER_CRYPTO_AND_FULL54_SQL_WITH_SYNTHETIC_AUTH_PROVIDER_AND_LIMITER_PORTS',
 source_parent_commit:manifest?.source_parent_commit||null,node_version:process.version,pglite_version:dependency?'0.5.8':null,
 source_files_SHA256_verified:sourceCount,dependency_lock_version_registry_and_integrity_matched:dependency,
 tests:count('tests'),pass:count('pass'),fail:count('fail'),cancelled:count('cancelled'),skipped:count('skipped'),
 syntax_checks:syntax.length,syntax,exit_code:good?0:1,
 failed_case_titles:[...output.matchAll(/^not ok \d+ - ([^\r\n]+)$/gm)].map(x=>x[1]).slice(0,20),
 migration_count:54,actual_SQL_handler_integration_checks:13,isolated_gateway_transport_checks:50,
 real_Auth_or_Zoho_or_Cloudflare_HTTP_requests:0,real_mail_sent:false,
 real_Worker_bundle_or_runtime_verified:false,real_shared_rate_limiter_binding_verified:false,
 Zoho_data_centre_sender_scope_credentials_or_inbox_delivery_verified:false,
 existing_application_RLS_RPC_Edge_Storage_guards_installed:false,
 owner_real_SQL_Auth_profiles_roles_factors_or_settings_changed:false,
 hosted_acceptance:false,production_or_native_changed:false,findings_closed:[],APK_update_deferred:true};
console.log(JSON.stringify(receipt,null,2));process.exitCode=good?0:1;
