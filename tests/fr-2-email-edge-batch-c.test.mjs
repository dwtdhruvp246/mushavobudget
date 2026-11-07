import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createECDH,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {installBatchC,checkBatchCLocal,installAck} from '../scripts/install-fr-2-email-edge-batch-c.mjs';
import {createPublicZIP} from '../scripts/lib/store-public-zip.mjs';
import {acceptedZIP,acceptedPackage,batchRef,batchOrigin} from '../scripts/prepare-fr-2-email-edge-batch-a.mjs';
import {sixNames} from '../scripts/check-fr-2-email-edge-impact.mjs';
const repo=fileURLToPath(new URL('../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const token='sbp_fc'+'SYNTHETIC_MANAGEMENT_TOKEN'.repeat(2),currency='SYNTHETIC_CURRENCYAPI_KEY',caller='c9'.repeat(32),privateMarker='PRIVATE_PROVIDER_BODY';
const row={slug:'submit-enquiry',id:'SYNTHETIC_FUNCTION_ID',status:'ACTIVE',version:7,verify_jwt:false,created_at:1,updated_at:3},entry='/home/deno/functions/submit-enquiry/index.ts';
const sources=['index.ts','handler.mjs'].map(n=>[n,fs.readFileSync(path.join(repo,'supabase/functions/submit-enquiry',n))]);
function multipart(mismatch=false){const boundary='BatchCFixture';const chunks=[Buffer.from('--'+boundary+'\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n'+JSON.stringify({entrypoint_path:'file://'+entry})+'\r\n')];for(const[n,b]of sources)chunks.push(Buffer.from('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="'+entry.replace('index.ts',n)+'"\r\nContent-Type: application/typescript\r\n\r\n'),mismatch&&n==='index.ts'?Buffer.from(privateMarker):b,Buffer.from('\r\n'));chunks.push(Buffer.from('--'+boundary+'--\r\n'));return new Response(Buffer.concat(chunks),{headers:{'Content-Type':'multipart/form-data; boundary='+boundary}});}
function fixture(t,settings={}){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mushavo-batch-c-test-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));const ec=createECDH('prime256v1');ec.generateKeys();
 const env={APP_ORIGIN:batchOrigin,VAPID_PUBLIC_KEY:ec.getPublicKey().toString('base64url'),VAPID_PRIVATE_KEY:Buffer.from(ec.getPrivateKey().toString('hex').padStart(64,'0'),'hex').toString('base64url'),VAPID_SUBJECT:'mailto:synthetic@example.invalid',CURRENCYAPI_API_KEY:currency,CURRENCY_SYNC_SECRET:caller};
 const packet={schema_version:1,purpose:'MUSHAVO_STAGING_EDGE_CONFIGURATION_CANDIDATE_ONLY',project:batchRef,origin:batchOrigin,created_UTC:'2026-10-22T00:00:00.000Z',accepted_ZIP_SHA256:acceptedZIP,Edge_package_SHA256:acceptedPackage,frontend_VAPID_relation:'ABSENT_IN_RETAINED_ZIP',frontend_candidate_update_required:true,provider_credentials_verified:false,external_callers_verified:false,hosted_write_approved:false,live_activation_approved:false,env};
 const config=Buffer.from('window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify({supabaseUrl:'https://'+batchRef+'.supabase.co',supabasePublishableKey:'sb_publishable_SYNTHETIC',vapidPublicKey:env.VAPID_PUBLIC_KEY})+';\n'),worker=Buffer.from('SYNTHETIC_WORKER');
 const bytes=createPublicZIP([['config.js',config],['_worker.js',worker],...Array.from({length:42},(_,i)=>['file'+i+'.js',Buffer.from('// public '+i)])]);const candidateZIPPath=path.join(temp,'candidate.zip');fs.writeFileSync(candidateZIPPath,bytes);
 const input={action:'install',packet,candidateZIPPath,token,acknowledgement:installAck},calls=[];let stored=false;
 const transport=async(url,init)=>{
  calls.push({url,init});assert.equal(init.redirect,'error');assert(init.signal);let response;
  if(url==='https://api.currencyapi.com/v3/status'){assert.equal(init.method,'GET');assert.equal(init.headers.apikey,currency);assert.equal(init.headers.Authorization,undefined);response=settings.currencyStatus?new Response(privateMarker,{status:settings.currencyStatus}):Response.json(settings.currencyBody??{quotas:{month:{remaining:settings.noQuota?0:300}}});}
  else{
   assert(url.startsWith('https://api.supabase.com/v1/projects/'+batchRef));assert.equal(init.headers.Authorization,'Bearer '+token);const suffix=url.split(batchRef)[1];
   if(suffix==='/secrets'&&init.method==='POST'){
    assert.equal(calls.filter(c=>c.init.method==='POST').length,1);const body=JSON.parse(init.body);assert.equal(body.length,6);for(const x of body)assert.equal(x.value,env[x.name]);assert.deepEqual(body.map(x=>x.name),sixNames);
    if(settings.postMode==='forbidden')response=new Response(privateMarker,{status:403});else{stored=true;if(settings.postMode==='uncertain')throw Error(token+privateMarker);response=Response.json({},{status:201});}
   }else{
    assert.equal(init.method,'GET');assert.equal(init.body,undefined);
    if(suffix==='')response=Response.json({ref:batchRef,status:'ACTIVE_HEALTHY',database:{host:settings.wrongHost?'wrong.invalid':'db.'+batchRef+'.supabase.co'}});
    else if(suffix==='/functions'){const selected=settings.selectedRoute?{...row,slug:'send-test-push',id:'OTHER_ID'}:null;response=Response.json([{...row,version:settings.driftBefore||stored&&settings.driftAfter?8:7},...(selected?[selected]:[])]);}
    else if(suffix==='/functions/submit-enquiry')response=Response.json({...row,import_map:false,entrypoint_path:'file://'+entry});
    else if(suffix==='/functions/submit-enquiry/body')response=multipart(settings.badSource);
    else if(suffix==='/secrets'){const selected=stored?sixNames.filter(n=>n!==settings.missingAfter):settings.preexisting?[sixNames[0]]:[];const others=stored&&settings.otherChanged?['OTHER_NAME']:['KEEP_ME'];response=Response.json([...others,...selected].map(name=>({name,value:privateMarker})));}
    else throw Error(privateMarker);
   }
  }
  return settings.mutate?settings.mutate(calls.length,response):response;
 };
 const options={transport,expectedZIP:sha(bytes),expectedWorker:sha(worker),impactBaseline:{receipt:{stage_step:'FR.2.4.E5.12_EDGE_CONFIGURATION_AND_SCHEDULER_READINESS',other_function_count:1,selected_functions_still_absent:true,other_function_metadata_SHA256:sha(JSON.stringify([row]))}}};
 return {input,calls,options,run:(x=input)=>installBatchC(x,options)};
}
function safe(r,f){const s=JSON.stringify(r);for(const x of [token,currency,caller,privateMarker,row.id,entry,f.input.packet.env.VAPID_PRIVATE_KEY,f.input.packet.env.VAPID_SUBJECT])assert(!s.includes(x));assert.equal(r.application_or_Edge_functions_invoked,0);assert.equal(r.uploaded_or_deployed,false);assert.equal(r.live_activation_approved,false);assert.equal(r.secret_value_equality_or_runtime_access_verified,false);assert.equal(r.SQL_or_Auth_or_deployment_endpoint_used,false);}
test('complete guarded installation uses 16 fixed requests, one six-value POST, independent readback and fresh source checks',async t=>{const f=fixture(t),r=await f.run();assert.equal(r.exit_code,0);assert.equal(r.actual_hosted_requests,16);assert.equal(r.secret_POST_requests,1);assert.equal(r.installed_variable_count,6);assert(r.pre_install_checks_passed&&r.post_install_source_target_check_passed);assert.equal(r.write_outcome_uncertain,false);assert.equal(r.settings_may_have_changed,true);safe(r,f);});
test('local preflight validates the saved candidate pair without any provider request',t=>{const f=fixture(t),r=checkBatchCLocal({action:'local',packet:f.input.packet,candidateZIPPath:f.input.candidateZIPPath},f.options);assert.equal(r.exit_code,0);assert.equal(f.calls.length,0);safe(r,f);});
test('missing acknowledgement, unknown fields and malformed tokens cause zero requests',async t=>{const f=fixture(t);for(const patch of [{acknowledgement:'OFFLINE'},{unknown:token},{token:'invalid'}]){const r=await f.run({...f.input,...patch});assert.equal(r.exit_code,1);assert.equal(f.calls.length,0);safe(r,f);}});
test('foreign or malformed private packets stop before requesting any hosted service',async t=>{const f=fixture(t),r=await f.run({...f.input,packet:{...f.input.packet,project:'abcdefghijklmnopqrst'}});assert.equal(r.exit_code,1);assert.equal(f.calls.length,0);safe(r,f);});
test('changed frontend ZIP identity stops before any provider credential is sent',async t=>{const f=fixture(t);fs.appendFileSync(f.input.candidateZIPPath,'changed');const r=await f.run();assert.equal(r.exit_code,1);assert.equal(f.calls.length,0);safe(r,f);});
test('a different target database host prevents source download and secret access',async t=>{const f=fixture(t,{wrongHost:true}),r=await f.run();assert.equal(r.exit_code,1);assert.equal(f.calls.length,1);assert.equal(r.secret_write_attempted,false);safe(r,f);});
test('unreviewed contact source blocks installation before any secret endpoint',async t=>{const f=fixture(t,{badSource:true}),r=await f.run();assert.equal(r.exit_code,1);assert.equal(f.calls.length,4);assert.equal(r.source_target_precheck_problem,'FUNCTION_SOURCE_MISMATCH');safe(r,f);});
test('prior unrelated function metadata drift blocks installation',async t=>{const f=fixture(t,{driftBefore:true}),r=await f.run();assert.equal(r.exit_code,1);assert.equal(f.calls.length,2);assert.equal(r.secret_write_attempted,false);safe(r,f);});
test('an appeared selected Edge route blocks secret installation',async t=>{const f=fixture(t,{selectedRoute:true}),r=await f.run();assert.equal(r.exit_code,1);assert.equal(r.source_target_precheck_problem,'SELECTED_FUNCTION_APPEARED');assert.equal(r.secret_write_attempted,false);safe(r,f);});
test('any preexisting selected configuration name stops before CurrencyAPI or a write',async t=>{const f=fixture(t,{preexisting:true}),r=await f.run();assert.equal(r.exit_code,1);assert.equal(r.problem_code,'CONFIGURATION_ALREADY_PRESENT');assert.equal(f.calls.length,7);assert.equal(r.secret_write_attempted,false);safe(r,f);});
test('CurrencyAPI authentication rejection prevents staging writes',async t=>{const f=fixture(t,{currencyStatus:401}),r=await f.run();assert.equal(r.exit_code,1);assert.equal(f.calls.length,8);assert.equal(r.secret_write_attempted,false);safe(r,f);});
test('exhausted quota is reported without installing configuration',async t=>{const f=fixture(t,{noQuota:true}),r=await f.run();assert.equal(r.problem_code,'CURRENCYAPI_QUOTA_NOT_AVAILABLE');assert.equal(r.CurrencyAPI_status_HTTP_accepted,true);assert.equal(r.secret_write_attempted,false);safe(r,f);});
test('an unexpected CurrencyAPI status shape cannot approve installation',async t=>{const f=fixture(t,{currencyBody:{message:privateMarker}}),r=await f.run();assert.equal(r.exit_code,1);assert.equal(r.secret_write_attempted,false);safe(r,f);});
test('POST denial still triggers one independent readback and never repeats the write',async t=>{const f=fixture(t,{postMode:'forbidden'}),r=await f.run();assert.equal(r.exit_code,1);assert.equal(r.actual_hosted_requests,10);assert.equal(r.secret_POST_requests,1);assert.equal(r.independent_configuration_name_readback_received,true);assert.equal(r.write_outcome_uncertain,true);safe(r,f);});
test('a network-uncertain write retains uncertainty even when all names appear afterward',async t=>{const f=fixture(t,{postMode:'uncertain'}),r=await f.run();assert.equal(r.exit_code,1);assert.equal(r.six_configuration_names_listed_after,true);assert.equal(r.secret_write_HTTP_accepted,false);assert.equal(r.write_outcome_uncertain,true);assert.equal(r.secret_POST_requests,1);safe(r,f);});
test('missing post-install names fail readback without retries or automatic deletion',async t=>{const f=fixture(t,{missingAfter:'VAPID_SUBJECT'}),r=await f.run();assert.equal(r.exit_code,1);assert.equal(r.secret_write_HTTP_accepted,true);assert.equal(r.six_configuration_names_listed_after,false);assert.equal(r.secret_POST_requests,1);safe(r,f);});
test('unrelated configuration name changes fail the independent readback',async t=>{const f=fixture(t,{otherChanged:true}),r=await f.run();assert.equal(r.exit_code,1);assert.equal(r.other_configuration_names_unchanged,false);assert.equal(r.secret_POST_requests,1);safe(r,f);});
test('post-install function drift is reported while preserving the confirmed configuration write',async t=>{const f=fixture(t,{driftAfter:true}),r=await f.run();assert.equal(r.exit_code,1);assert.equal(r.installed_variable_count,6);assert.equal(r.write_outcome_uncertain,false);assert.equal(r.post_install_source_target_check_passed,false);assert.equal(r.secret_POST_requests,1);safe(r,f);});
test('redirects and oversized name metadata stop before the first write',async t=>{for(const mode of ['redirect','oversize']){const f=fixture(t,{mutate:(i,r)=>{if(i!==7)return r;if(mode==='redirect'){Object.defineProperty(r,'redirected',{value:true});return r;}return new Response('x'.repeat(262145),{headers:{'content-type':'application/json'}});}}),r=await f.run();assert.equal(r.exit_code,1);assert.equal(r.secret_write_attempted,false);safe(r,f);}});
test('private CLI preflight and malformed inputs make no hosted request or credential disclosure',()=>{for(const [input,status]of [['{"preflight":true}',0],['{'+token,1],[JSON.stringify({action:'install',token}),1]]){const r=spawnSync(process.execPath,['scripts/install-fr-2-email-edge-batch-c.mjs','--private-parent-pipe'],{cwd:repo,input,encoding:'utf8'});assert.equal(r.status,status);assert.equal(r.stderr,'');assert(!r.stdout.includes(token));assert.equal(JSON.parse(r.stdout).actual_hosted_requests,0);}});
