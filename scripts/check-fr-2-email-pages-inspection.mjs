import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import test from 'node:test';import assert from 'node:assert/strict';
import {inspectPagesBaseline,summarizeChannel,verifyReviewArtifact,requiredVariables} from './inspect-fr-2-email-pages.mjs';
const secret='PRIVATE_SENTINEL_NEVER_PRINT',account='a'.repeat(32),token=secret+'_TOKEN_123456';
const input={account,token,candidate:path.resolve(os.tmpdir(),'synthetic-staging-review')};
const paths=['/pages/projects/mushavo-budget-staging','/workers/scripts','/workers/durable_objects/namespaces?per_page=1000','/workers/scripts/mushavo-email-rate-staging/subdomain'];
const envelope=(result,errors=[])=>({success:true,errors,result});
function fixtures(){return[
 envelope({name:'mushavo-budget-staging',subdomain:'mushavo-budget-staging.pages.dev',source:null,canonical_deployment:{uses_functions:false},deployment_configs:{
  production:{compatibility_date:'2026-07-01',always_use_latest_compatibility_date:false,fail_open:false,env_vars:{
   EMAIL_GATE_MODE:{type:'plain_text',value:'STAGING_CONTROLLED_ONLY'},EMAIL_GATE_PROJECT:{type:'plain_text',value:'dczlddwbtgvfdujgcitb'},
   EMAIL_GATE_ORIGIN:{type:'plain_text',value:'https://mushavo-budget-staging.pages.dev'},SUPABASE_SERVICE_ROLE_KEY:{type:'plain_text',value:secret},[secret]:{type:'secret_text',value:secret}},
   durable_object_namespaces:{EMAIL_GATE_LIMITER_NS:{namespace_id:secret},[secret]:{namespace_id:secret}}},
  preview:{env_vars:{},durable_object_namespaces:{}}}}),
 envelope([{id:'mushavo-email-rate-staging'},{id:secret}]),
 envelope([{id:secret,script:'mushavo-email-rate-staging',class:'EmailGatewayRateLimiter',use_sqlite:true}],null),
 envelope({enabled:false,previews_enabled:false})];}
async function run(bodies=fixtures(),options={}){
 const calls=[];const transport=options.transport||(async(url,init)=>{
  assert.equal(init.method,'GET');assert.equal(init.redirect,'error');assert.equal(init.body,undefined);assert.equal(init.headers.Authorization,'Bearer '+token);
  assert.equal(url,'https://api.cloudflare.com/client/v4/accounts/'+account+paths[calls.length]);calls.push(url);
  return new Response(JSON.stringify(bodies[calls.length-1]),{headers:{'content-type':'application/json'}});
 });
 return{receipt:await inspectPagesBaseline(options.input||input,{transport,artifactCheck:options.artifactCheck||(async()=>{})}),calls};
}
await test('Four fixed GETs collect channel metadata and preserve null-errors namespace compatibility without secret output',async()=>{
 const{receipt:r,calls}=await run();assert.equal(r.exit_code,0);assert.equal(calls.length,4);assert.equal(r.requests_attempted,4);
 assert.equal(r.channels.length,2);assert.equal(r.channels[0].required_variables.length,16);assert.equal(r.channels[0].limiter_binding,'MATCH');
 assert.equal(r.channels[1].limiter_binding,'ABSENT');assert.equal(r.channels[0].sensitive_required_variables_in_plaintext,1);
 assert.equal(r.gateway_configuration_ready_verified,false);assert.equal(r.live_activation_approved,false);assert.equal(r.hosted_acceptance,false);
 assert.ok(!JSON.stringify(r).includes(secret));assert.ok(!JSON.stringify(r).includes(account));assert.ok(!JSON.stringify(r).includes(token));
});
await test('Missing variables are collected as absence rather than misclassified as failed deployment',async()=>{
 const{receipt:r}=await run();assert.ok(r.channels[1].required_variables.every(x=>x.state==='ABSENT'));assert.equal(r.exit_code,0);
});
await test('Unreported variable/binding maps remain unknown rather than asserted absent',async()=>{
 const b=fixtures();b[0].result.deployment_configs.production.env_vars=null;delete b[0].result.deployment_configs.production.durable_object_namespaces;
 const{receipt:r}=await run(b);assert.equal(r.channels[0].environment_entry_count,null);assert.equal(r.channels[0].limiter_binding,'NOT_REPORTED');assert.ok(r.channels[0].required_variables.every(x=>x.state==='NOT_REPORTED'));
});
await test('Secret values and plain-text credential values are never read by channel summarization',()=>{
 const vars={};for(const name of requiredVariables){const row={type:name==='SUPABASE_SERVICE_ROLE_KEY'?'plain_text':'secret_text'};Object.defineProperty(row,'value',{get(){throw Error(secret);}});vars[name]=row;}
 const r=summarizeChannel({env_vars:vars},'SYNTHETIC',secret);assert.equal(r.sensitive_required_variables_in_plaintext,1);assert.ok(!JSON.stringify(r).includes(secret));
});
await test('Wrong non-secret staging markers and foreign namespace bindings are summarized without printing their values',async()=>{
 const b=fixtures();b[0].result.deployment_configs.production.env_vars.EMAIL_GATE_PROJECT.value=secret;b[0].result.deployment_configs.production.durable_object_namespaces.EMAIL_GATE_LIMITER_NS.namespace_id=secret+'FOREIGN';
 const{receipt:r}=await run(b);assert.equal(r.channels[0].non_secret_staging_markers[1].state,'DIFFERENT');assert.equal(r.channels[0].limiter_binding,'DIFFERENT_OR_INVALID');assert.ok(!JSON.stringify(r).includes(secret));assert.equal(r.exit_code,0);
});
await test('Wrong Pages project stops before any further account inventory requests',async()=>{
 const b=fixtures();b[0].result.name='production-'+secret;const{receipt:r,calls}=await run(b);assert.equal(r.problem_code,'STAGING_PROJECT_MISMATCH');assert.equal(calls.length,1);assert.ok(!JSON.stringify(r).includes(secret));
});
await test('Incomplete Worker inventory stops after two GETs',async()=>{
 const b=fixtures();b[1].result_info={total_pages:2};const{receipt:r,calls}=await run(b);assert.equal(r.problem_code,'WORKER_INVENTORY_REVIEW_REQUIRED');assert.equal(calls.length,2);
});
await test('Namespace pagination and duplicate/non-SQLite selected namespaces are refused',async()=>{
 for(const mutate of [b=>{b[2].result_info={cursors:{after:secret}};},b=>b[2].result.push({...b[2].result[0]}),b=>{b[2].result[0].use_sqlite=false;}]){
  const b=fixtures();mutate(b);const{receipt:r,calls}=await run(b);assert.equal(r.exit_code,1);assert.equal(calls.length,3);assert.ok(!JSON.stringify(r).includes(secret));
 }
});
await test('Enabled limiter public URLs require review without modifying them',async()=>{
 const b=fixtures();b[3].result.enabled=true;const{receipt:r}=await run(b);assert.equal(r.problem_code,'LIMITER_PUBLIC_URL_REVIEW_REQUIRED');assert.equal(r.upload_or_settings_write_attempted,false);
});
await test('Missing Pages environment metadata is not accepted as an established baseline',async()=>{
 const b=fixtures();delete b[0].result.deployment_configs;const{receipt:r}=await run(b);assert.equal(r.problem_code,'PAGES_CHANNEL_METADATA_REVIEW_REQUIRED');assert.equal(r.channels[0].configuration_metadata_reported,false);
});
await test('Artifact failure and extra private input fields stop before network',async()=>{
 const{receipt:r,calls}=await run(undefined,{artifactCheck:async()=>{throw Error(secret);}});assert.equal(r.requests_attempted,0);assert.equal(calls.length,0);assert.ok(!JSON.stringify(r).includes(secret));
 const extra=await run(undefined,{input:{...input,write:true}});assert.equal(extra.receipt.problem_code,'INVALID_PRIVATE_INPUT');assert.equal(extra.calls.length,0);
});
await test('HTTP errors, wrong media, malformed JSON and oversized responses fail with fixed codes',async()=>{
 for(const[response,code]of[
  [()=>new Response(secret,{status:403}),'HTTP_METADATA_REVIEW_REQUIRED'],
  [()=>new Response(secret,{headers:{'content-type':'text/html'}}),'RESPONSE_TYPE_REVIEW_REQUIRED'],
  [()=>new Response('{'+secret,{headers:{'content-type':'application/json'}}),'INVALID_JSON_RESPONSE'],
  [()=>new Response(' '.repeat(2097153),{headers:{'content-type':'application/json'}}),'RESPONSE_TOO_LARGE']]){
  const{receipt:r}=await run(undefined,{transport:async()=>response()});assert.equal(r.problem_code,code);assert.equal(r.requests_attempted,1);assert.ok(!JSON.stringify(r).includes(secret));
 }
});
await test('Reported API errors and arbitrary exception safeCode fields cannot leak messages or credentials',async()=>{
 const b=fixtures();b[0]={success:false,errors:[{message:secret}],result:null};const{receipt:r}=await run(b);assert.equal(r.problem_code,'API_METADATA_REVIEW_REQUIRED');assert.ok(!JSON.stringify(r).includes(secret));
 const fail=await run(undefined,{transport:async()=>{throw Object.assign(Error(secret),{safeCode:secret});}});assert.equal(fail.receipt.problem_code,'LOCAL_OR_METADATA_REVIEW_REQUIRED');assert.ok(!JSON.stringify(fail.receipt).includes(secret));
});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mushavo-pages-artifact-test-'));
try{
 const zip=path.join(temp,'mushavo-email-staging-review.zip'),receiptFile=path.join(temp,'preparation-receipt.json');
 const data=Buffer.from('SYNTHETIC_ARCHIVE_IDENTITY_BYTES_ONLY'),hash=createHash('sha256').update(data).digest('hex');
 fs.writeFileSync(zip,data);const receipt={stage_step:'FR.2.4.E5.1_LOCAL_UPLOAD_CANDIDATE',result:'LOCAL_ADVANCED_MODE_POSIX_ZIP_PREFLIGHT_PASS_NOT_DEPLOYED',
  target_project:'mushavo-budget-staging',target_domain:'mushavo-budget-staging.pages.dev',application_source_commit:'5a14f0c61a7ce91e3c3cefa16dc5ba276d11cc18',
  Worker_SHA256:'fb089fffe0cabd9be4fb5e8cfed165786ef56dee8cd5209b7be679166ef4ae99',ZIP_SHA256:hash,ZIP_path:zip,public_files:44,ZIP_content_hashes_matched:44,
  non_config_asset_hashes_recorded:43,source_files_SHA256_verified:57,selected_public_and_header_source_identities_verified:41,Windows_dotNET_ZIP_independent_readback_verified:true,
  legacy_JSON_array_probe_count:1,corrected_JSON_array_probe_count:43,do_not_upload_yet:true,deployed:false,exit_code:0};
 fs.writeFileSync(receiptFile,JSON.stringify(receipt));
 await test('Local artifact recheck verifies whole-file digest and bounded saved Windows receipt without reading public configuration',()=>{
  verifyReviewArtifact(temp,hash);assert.throws(()=>verifyReviewArtifact(temp));
 });
 await test('Changed archive bytes and unverified Windows readback are rejected',()=>{
  fs.writeFileSync(zip,Buffer.from('CHANGED'));assert.throws(()=>verifyReviewArtifact(temp,hash));fs.writeFileSync(zip,data);
  fs.writeFileSync(receiptFile,JSON.stringify({...receipt,Windows_dotNET_ZIP_independent_readback_verified:false}));assert.throws(()=>verifyReviewArtifact(temp,hash));fs.writeFileSync(receiptFile,JSON.stringify(receipt));
 });
 await test('Redirected artifact roots are rejected before any credential transport',()=>{
  const linked=path.join(temp,'linked');fs.symlinkSync(temp,linked,'dir');assert.throws(()=>verifyReviewArtifact(linked,hash));fs.unlinkSync(linked);
 });
 await test('Actual CLI rejects credential-bearing extra fields before network and prints only a safe receipt',()=>{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const child=spawnSync(process.execPath,[path.join(root,'scripts/inspect-fr-2-email-pages.mjs')],{input:JSON.stringify({...input,extra:secret}),encoding:'utf8'});
  assert.equal(child.status,1);assert.equal(child.stderr,'');const r=JSON.parse(child.stdout);assert.equal(r.requests_attempted,0);assert.equal(r.problem_code,'INVALID_PRIVATE_INPUT');assert.ok(!child.stdout.includes(secret));assert.ok(!child.stdout.includes(token));
 });
 await test('The isolated six-source handoff resolves its actual entrypoint and imports without npm or other repository files',()=>{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),isolated=path.join(temp,'isolated');
  const manifestPath='docs/security-audit/security-fr-2-email-pages-inspection-source-manifest.json';
  const manifest=JSON.parse(fs.readFileSync(path.join(root,manifestPath)));
  assert.equal(Object.keys(manifest.file_sha256).length,6);
  for(const name of [...Object.keys(manifest.file_sha256),manifestPath]){
   const destination=path.join(isolated,name);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(root,name),destination);
  }
  const child=spawnSync(process.execPath,[path.join(isolated,'scripts/inspect-fr-2-email-pages.mjs')],{input:JSON.stringify({...input,extra:secret}),encoding:'utf8'});
  assert.equal(child.status,1);assert.equal(child.stderr,'');assert.equal(JSON.parse(child.stdout).problem_code,'INVALID_PRIVATE_INPUT');assert.ok(!child.stdout.includes(secret));
 });
}finally{fs.rmSync(temp,{recursive:true,force:true});}
