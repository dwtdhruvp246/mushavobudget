import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {checkEdgeImpact,decodeSourceMultipart,impactRef,impactStage,sixNames} from '../scripts/check-fr-2-email-edge-impact.mjs';
import {readConfiguration} from '../supabase/functions/submit-enquiry/handler.mjs';
const token='sbp_fc'+'SYNTHETIC_PRIVATE_TOKEN_'.repeat(2);
const privateMarker='PRIVATE_SOURCE_OR_ERROR_NEVER_PRINT';
const entry='/home/deno/functions/submit-enquiry/index.ts';
const row={slug:'submit-enquiry',id:'SYNTHETIC_PRIVATE_ID',status:'ACTIVE',version:7,verify_jwt:false,created_at:1,updated_at:3};
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const beforeHash=sha([row]);
const baseline={receipt:{stage_step:'FR.2.4.E5.12_EDGE_CONFIGURATION_AND_SCHEDULER_READINESS',other_function_count:1,selected_functions_still_absent:true,other_function_metadata_SHA256:beforeHash}};
const sources=new Map(await Promise.all(['index.ts','handler.mjs'].map(async n=>[n,await readFile(new URL('../supabase/functions/submit-enquiry/'+n,import.meta.url))])));
function multipart({files=[...sources].map(([n,b])=>({path:entry.replace('index.ts',n),body:b})),metadata={entrypoint_path:'file://'+entry},boundary='SafeBoundaryFixture',supabasePath=false}={}){
  const chunks=[];
  if(metadata!==false)chunks.push(Buffer.from('--'+boundary+'\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n'+JSON.stringify(metadata)+'\r\n'));
  for(const f of files)chunks.push(Buffer.from('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="'+(supabasePath?'ignored.ts':f.path)+'"\r\n'+(supabasePath?'Supabase-Path: '+f.path+'\r\n':'')+'Content-Type: application/typescript\r\n\r\n'),Buffer.from(f.body),Buffer.from('\r\n'));
  chunks.push(Buffer.from('--'+boundary+'--\r\n'));return {bytes:Buffer.concat(chunks),type:'multipart/form-data; boundary='+boundary};
}
function fixture({rows=[row],detailPatch={},body=multipart(),mutate,baselineReceipt=baseline}={}){
  const calls=[];let i=0;
  const transport=async(url,init)=>{
    calls.push({url,init});assert.equal(init.method,'GET');assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,'Bearer '+token);assert.equal(init.body,undefined);
    assert(url.startsWith('https://api.supabase.com/v1/projects/'+impactRef));
    assert(!url.includes('/secrets')&&!url.includes('/database')&&!url.includes('/functions/v1/'));
    i++;let response;
    if(i===1)response=Response.json({ref:impactRef,status:'ACTIVE_HEALTHY',database:{host:'db.'+impactRef+'.supabase.co'}});
    else if(i===2||i===6)response=Response.json(rows);
    else if(i===3||i===5)response=Response.json({...row,import_map:false,entrypoint_path:'file://'+entry,...detailPatch});
    else if(i===4){assert.equal(init.headers.Accept,'multipart/form-data');response=new Response(body.bytes,{headers:{'Content-Type':body.type}});}
    else throw Error(privateMarker);
    return mutate?mutate(i,response):response;
  };
  return {calls,run:input=>checkEdgeImpact(input??{token},{transport,baselineReceipt})};
}
function privateSafe(r){const s=JSON.stringify(r);for(const value of [token,privateMarker,row.id,entry])assert(!s.includes(value));assert.equal(r.Edge_functions_invoked,0);assert.equal(r.downloaded_source_executed_or_saved,false);assert.equal(r.readiness_approved,false);assert.equal(r.shared_configuration_runtime_impact_verified,false);assert.equal(r.previous_deployable_artifact_retained,false);}
test('six fixed GETs establish byte parity and stable list/detail snapshots without invoking source',async()=>{
  const f=fixture(),r=await f.run();assert.equal(r.exit_code,0);assert.equal(r.requests_attempted,6);assert.equal(r.downloaded_source_files,2);assert(r.exact_reviewed_contact_source_bytes_match&&r.six_names_not_consumed_by_matched_source&&r.selected_functions_absent_before_and_after);assert.equal(r.other_function_metadata_SHA256,beforeHash);privateSafe(r);
  assert.deepEqual(f.calls.map(x=>x.url.split(impactRef)[1]),['','/functions','/functions/submit-enquiry','/functions/submit-enquiry/body','/functions/submit-enquiry','/functions']);
});
test('pinned staging baseline is loaded only by the default path; test dependency is not a request field',async()=>{
  const f=fixture();const r=await f.run({token,baselineReceipt:baseline});assert.equal(r.problem_code,'PRIVATE_TOKEN_INPUT_REQUIRED');assert.equal(f.calls.length,0);
});
test('bad token and unknown caller fields stop before any request',async()=>{
  for(const input of [{},{token:'invalid'},{token,url:'https://example.invalid'},{token,write:true}]){const f=fixture();const r=await f.run(input);assert.equal(r.exit_code,1);assert.equal(f.calls.length,0);privateSafe(r);}
});
test('contradictory project id, host mismatch and unhealthy target stop before functions',async()=>{
  for(const patch of [{id:'abcdefghijklmnopqrst'},{database:{host:'wrong.invalid'}},{status:'INACTIVE'}]){const f=fixture({mutate:(i,r)=>i===1?Response.json({ref:impactRef,status:'ACTIVE_HEALTHY',database:{host:'db.'+impactRef+'.supabase.co'},...patch}):r});const r=await f.run();assert.equal(r.exit_code,1);assert.equal(f.calls.length,1);}
});
test('baseline drift is explicit and prevents private source retrieval',async()=>{
  const f=fixture({rows:[{...row,version:8}]});const r=await f.run();assert.equal(r.problem_code,'BASELINE_METADATA_CHANGED');assert.equal(f.calls.length,2);privateSafe(r);
});
test('a newly appeared selected route stops before downloading any source',async()=>{
  const f=fixture({rows:[row,{...row,slug:'send-test-push',id:'other'}]});const r=await f.run();assert.equal(r.problem_code,'SELECTED_FUNCTION_APPEARED');assert.equal(f.calls.length,2);
});
test('an unknown sole function is not requested or printed',async()=>{
  const rows=[{...row,slug:'unreviewed-function'}];const f=fixture({rows,baselineReceipt:{receipt:{...baseline.receipt,other_function_metadata_SHA256:sha(rows)}}});const r=await f.run();assert.equal(r.problem_code,'UNRELATED_FUNCTION_REVIEW_REQUIRED');assert.equal(f.calls.length,2);assert(!JSON.stringify(r).includes('unreviewed-function'));
});
test('duplicate malformed and excessively large lists stop at metadata',async()=>{
  for(const rows of [[row,row],[{...row,slug:'../bad'}],Array(257).fill(row),{rows:[row]}]){const f=fixture({rows});const r=await f.run();assert.equal(r.problem_code,'FUNCTION_METADATA_REVIEW_REQUIRED');assert.equal(f.calls.length,2);}
});
test('JWT, import-map, version and entrypoint differences prevent source comparison',async()=>{
  for(const detailPatch of [{verify_jwt:true},{import_map:true},{version:8},{entrypoint_path:'file:///src/../index.ts'},{import_map_path:'/private/map.json'}]){const f=fixture({detailPatch});const r=await f.run();assert.equal(r.exit_code,1);assert.equal(f.calls.length,3);privateSafe(r);}
});
test('source bytes including inert malicious JavaScript are never executed or accepted',async()=>{
  const body=multipart({files:[{path:entry,body:Buffer.from('globalThis.PRIVATE_SENTINEL=true;throw Error("'+privateMarker+'");')},{path:entry.replace('index.ts','handler.mjs'),body:sources.get('handler.mjs')}]});
  const f=fixture({body}),r=await f.run();assert.equal(r.problem_code,'FUNCTION_SOURCE_MISMATCH');assert.equal(f.calls.length,4);assert.equal(globalThis.PRIVATE_SENTINEL,undefined);privateSafe(r);
});
test('all source files must be present and exact, with no extra dependency or path traversal',async()=>{
  for(const files of [[{path:entry,body:sources.get('index.ts')}],[...sources].map(([n,b])=>({path:entry.replace('index.ts',n),body:b})).concat([{path:'/private/.env',body:'private'}]),[{path:entry,body:sources.get('index.ts')},{path:entry.replace('index.ts','../handler.mjs'),body:sources.get('handler.mjs')}]] ){
    const f=fixture({body:multipart({files})}),r=await f.run();assert.equal(r.problem_code,'FUNCTION_SOURCE_REVIEW_REQUIRED');assert.equal(f.calls.length,4);privateSafe(r);
  }
});
test('standard supabase-path headers are handled without any filesystem extraction',async()=>{
  const r=await fixture({body:multipart({supabasePath:true})}).run();assert.equal(r.exit_code,0);privateSafe(r);
});
test('optional metadata uses either exact entrypoint form and rejects conflicts',async()=>{
  for(const metadata of [false,{deno2_entrypoint_path:'file://'+entry}])assert.equal((await fixture({body:multipart({metadata})}).run()).exit_code,0);
  const r=await fixture({body:multipart({metadata:{entrypoint_path:'file:///different/index.ts'}})}).run();assert.equal(r.problem_code,'FUNCTION_SOURCE_REVIEW_REQUIRED');
});
test('multipart truncation duplicate paths ambiguous headers and binary format fail closed',()=>{
  const m=multipart();for(const [bytes,type] of [[m.bytes.subarray(0,-6),m.type],[m.bytes,'application/octet-stream'],[Buffer.from(m.bytes.toString().replace('Content-Type: application/typescript','Content-Type: application/typescript\r\nContent-Type: private')),m.type],[multipart({files:[{path:entry,body:'x'},{path:entry,body:'x'}]}).bytes,m.type]])assert.throws(()=>decodeSourceMultipart(bytes,type,entry));
});
test('metadata changes after body retrieval remain review results despite matched source',async()=>{
  for(const phase of [5,6]){const f=fixture({mutate:(i,r)=>i===phase?Response.json(i===5?{...row,import_map:false,entrypoint_path:'file://'+entry,ezbr_sha256:'a'.repeat(64)}:[{...row,version:8}]):r});const r=await f.run();assert.equal(r.exit_code,1);assert.equal(r.problem_code,'OBSERVATION_CHANGED');assert.equal(r.selected_functions_absent_before_and_after,false);privateSafe(r);}
});
test('private HTTP failures at every phase stop without retry or body disclosure',async()=>{
  for(let phase=1;phase<=6;phase++){const f=fixture({mutate:(i,r)=>i===phase?new Response(privateMarker,{status:403}):r});const r=await f.run();assert.equal(r.problem_code,'PROVIDER_GET_REVIEW_REQUIRED');assert.equal(f.calls.length,phase);privateSafe(r);}
});
test('redirect and wrong response URL are refused before parsing',async()=>{
  for(const key of ['redirected','url']){const f=fixture({mutate:(i,r)=>{if(i===2)Object.defineProperty(r,key,{value:key==='url'?'https://example.invalid':true});return r;}});const r=await f.run();assert.equal(r.exit_code,1);assert.equal(f.calls.length,2);privateSafe(r);}
});
test('JSON and source byte limits stop collection with safe receipts',async()=>{
  for(const phase of [2,4]){const f=fixture({mutate:(i,r)=>i===phase?new Response('x'.repeat(phase===2?262145:2097153),{headers:{'Content-Type':phase===2?'application/json':multipart().type}}):r});const r=await f.run();assert.equal(r.problem_code,'RESPONSE_TOO_LARGE');assert.equal(f.calls.length,phase);privateSafe(r);}
});
test('network exceptions never print the token source or raw error',async()=>{
  const r=await checkEdgeImpact({token},{baselineReceipt:baseline,transport:async()=>{throw Error(token+privateMarker);}});assert.equal(r.problem_code,'PROVIDER_GET_REVIEW_REQUIRED');privateSafe(r);
});
test('malformed private baseline refuses any provider request',async()=>{
  const f=fixture({baselineReceipt:{receipt:{...baseline.receipt,other_function_count:2}}});const r=await f.run();assert.equal(r.problem_code,'SOURCE_BASELINE_REVIEW_REQUIRED');assert.equal(f.calls.length,0);
});
test('private CLI preflight performs no requests and stdout remains JSON only',()=>{
  const r=spawnSync(process.execPath,['scripts/check-fr-2-email-edge-impact.mjs','--private-parent-pipe'],{input:'{"preflight":true}',encoding:'utf8'});assert.equal(r.status,0);assert.equal(r.stderr,'');assert.deepEqual(JSON.parse(r.stdout),{stage_step:impactStage,result:'PRIVATE_PIPE_PREFLIGHT_PASS',requests_attempted:0,exit_code:0});
});
test('private CLI rejects argument or input escape hatches',()=>{
  for(const [args,input]of [[[],JSON.stringify({token})],[['--private-parent-pipe'],JSON.stringify({token,baselineReceipt:baseline})],[['--private-parent-pipe'],'x'.repeat(8193)]]){const r=spawnSync(process.execPath,['scripts/check-fr-2-email-edge-impact.mjs',...args],{input,encoding:'utf8'});assert.equal(r.status,1);assert.equal(r.stderr,'');privateSafe({...JSON.parse(r.stdout),Edge_functions_invoked:0,downloaded_source_executed_or_saved:false,readiness_approved:false,shared_configuration_runtime_impact_verified:false,previous_deployable_artifact_retained:false});}
});
function environment(modern=false){return {SUPABASE_URL:'https://'+impactRef+'.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_SYNTHETIC',...(modern?{SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_MODERN_SYNTHETIC'})}:{}),MUSHAVO_CONTACT_TURNSTILE_SECRET:'0xSYNTHETIC_TURNSTILE_SECRET',MUSHAVO_CONTACT_QUOTA_SECRET:'ab'.repeat(32)};}
test('actual reviewed contact configuration reads only the five reviewed platform/contact names',()=>{
  const calls=[];assert(readConfiguration(name=>{calls.push(name);return environment()[name];}));assert.deepEqual(calls,['SUPABASE_URL','SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY','MUSHAVO_CONTACT_TURNSTILE_SECRET','MUSHAVO_CONTACT_QUOTA_SECRET']);assert(!calls.some(x=>sixNames.includes(x)));
});
test('all six proposed values leave actual legacy and modern contact configuration unchanged',()=>{
  for(const modern of [false,true]){const original=environment(modern);const prior=readConfiguration(k=>original[k]);assert(prior);for(const name of sixNames){const after={...original,[name]:privateMarker};assert.deepEqual(readConfiguration(k=>after[k]),prior);}assert.deepEqual(readConfiguration(k=>({...original,...Object.fromEntries(sixNames.map(n=>[n,privateMarker]))})[k]),prior);}
});
test('adding the six names cannot enable a contact handler missing its own secrets',()=>{
  const values=Object.fromEntries(sixNames.map(n=>[n,privateMarker]));assert.equal(readConfiguration(k=>values[k]),null);
});
test('revision two reports boundary grammar failure without printing the content-type value',async()=>{
  const body=multipart();body.type+='; private-extra='+privateMarker;
  const f=fixture({body}),r=await f.run();assert.equal(r.diagnostic_revision,2);assert.equal(r.problem_code,'FUNCTION_SOURCE_REVIEW_REQUIRED');assert.equal(r.source_observation.decoder_step,'CONTENT_TYPE_BOUNDARY');assert.equal(r.requests_attempted,4);assert.equal(r.downloaded_source_files,0);privateSafe(r);
});
test('missing disposition is isolated using a count without exposing unknown header names',async()=>{
  const body=multipart();body.bytes=Buffer.from(body.bytes.toString().replace('Content-Disposition:','X-Private-Disposition:'));
  const r=await fixture({body}).run();assert.equal(r.source_observation.decoder_step,'CONTENT_DISPOSITION');assert.equal(r.source_observation.multipart_parts_observed,1);assert.equal(r.source_observation.parts_with_content_disposition,0);assert.equal(r.source_observation.source_files_decoded,0);assert.equal(r.exit_code,1);privateSafe(r);
});
test('missing file-path parameter is distinguished from a private path mismatch',async()=>{
  const body=multipart();body.bytes=Buffer.from(body.bytes.toString().replace('; filename="'+entry+'"',''));
  const r=await fixture({body}).run();assert.equal(r.source_observation.decoder_step,'FILE_PART_PATH');assert.equal(r.source_observation.file_parts_observed,1);assert.equal(r.source_observation.file_path_forms.unsupported,1);assert.equal(r.exit_code,1);privateSafe(r);
});
test('metadata mismatch reports decoded counts rather than inventing a zero-file provider response',async()=>{
  const r=await fixture({body:multipart({metadata:{entrypoint_path:'file:///private/'+privateMarker+'/index.ts'}})}).run();
  assert.equal(r.source_observation.decoder_step,'METADATA_ENTRYPOINT');assert.equal(r.source_observation.source_files_decoded,2);assert.equal(r.source_observation.metadata_part_observed,true);assert.equal(r.source_observation.metadata_has_primary_entrypoint,true);assert.equal(r.source_observation.metadata_entrypoint_matches_detail,false);assert.equal(r.downloaded_source_files,0);assert.equal(r.exit_code,1);privateSafe(r);
});
test('extra source parts report only bounded counts and never their private names',async()=>{
  const files=[...sources].map(([n,b])=>({path:entry.replace('index.ts',n),body:b})).concat([{path:'/private/'+privateMarker+'.js',body:privateMarker}]);
  const r=await fixture({body:multipart({files})}).run();assert.equal(r.source_observation.decoder_step,'EXPECTED_SOURCE_FILE_COUNT');assert.equal(r.source_observation.source_files_decoded,3);assert.equal(r.source_observation.file_path_forms.absolute_posix,3);assert.equal(r.exact_reviewed_contact_source_bytes_match,false);assert.equal(r.exit_code,1);privateSafe(r);
});
test('relative source paths remain rejected while the diagnostic exposes only their form',async()=>{
  const files=[...sources].map(([n,b])=>({path:n,body:b}));const r=await fixture({body:multipart({files})}).run();assert.equal(r.source_observation.decoder_step,'EXPECTED_SOURCE_RELATIVE_PATHS');assert.equal(r.source_observation.file_path_forms.relative,2);assert.equal(r.source_observation.unexpected_relative_file_count,1);assert.equal(r.exit_code,1);privateSafe(r);
});
test('valid source returns the completed diagnostic and ignores private metadata extras',async()=>{
  const r=await fixture({body:multipart({metadata:{entrypoint_path:'file://'+entry,private_unknown:privateMarker}})}).run();assert.equal(r.exit_code,0);assert.equal(r.source_observation.decoder_step,'COMPLETE');assert.equal(r.source_observation.source_files_decoded,2);assert.deepEqual(r.source_observation.expected_relative_files,[{name:'index.ts',observed:true},{name:'handler.mjs',observed:true}]);assert.equal(r.source_observation.metadata_entrypoint_matches_detail,true);assert.equal(r.shared_configuration_runtime_impact_verified,false);privateSafe(r);
});
test('diagnostic state cannot be injected through private input to bypass source acceptance',async()=>{
  const f=fixture();const r=await f.run({token,source_observation:{decoder_step:privateMarker},diagnostic_revision:2});assert.equal(f.calls.length,0);assert.equal(r.problem_code,'PRIVATE_TOKEN_INPUT_REQUIRED');assert.equal(r.source_observation.decoder_step,'NOT_REACHED');assert.equal(r.exit_code,1);privateSafe(r);
});
