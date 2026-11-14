import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {reviewInstalledEdge as checkEdgeImpact,impactRef,impactStage,sixNames} from '../scripts/review-fr-2-email-edge-installed.mjs';
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
    assert(!url.includes('/database')&&!url.includes('/functions/v1/'));
    i++;let response;
    if(i===1)response=Response.json({ref:impactRef,status:'ACTIVE_HEALTHY',database:{host:'db.'+impactRef+'.supabase.co'}});
    else if(i===2||i===6)response=Response.json(rows);
    else if(i===3||i===5)response=Response.json({...row,import_map:false,entrypoint_path:'file://'+entry,...detailPatch});
    else if(i===4){assert.equal(init.headers.Accept,'multipart/form-data');response=new Response(body.bytes,{headers:{'Content-Type':body.type}});}
    else if(i===7)response=Response.json(sixNames.map(name=>({name,value:privateMarker})));
    else throw Error(privateMarker);
    return mutate?mutate(i,response):response;
  };
  return {calls,run:input=>checkEdgeImpact(input??{token},{transport,baselineReceipt})};
}
function safe(r){const s=JSON.stringify(r);for(const x of [token,privateMarker,row.id,entry])assert(!s.includes(x));assert.equal(r.secret_write_attempted,false);assert.equal(r.settings_data_roles_grants_or_schedules_changed,false);assert.equal(r.Edge_functions_invoked,0);assert.equal(r.metadata_change_cause_verified,false);assert.equal(r.prior_function_ID_or_version_equality_independently_verified,false);}
test('changed historical metadata can be reviewed only with exact current source and stable current list/detail snapshots',async()=>{const f=fixture({rows:[{...row,version:8}],detailPatch:{version:8}}),r=await f.run();assert.equal(r.exit_code,0);assert.equal(r.prior_metadata_fingerprint_matches,false);assert.equal(r.reviewed_contact_artifacts_match,true);assert.equal(r.all_six_names_listed,true);assert.equal(r.requests_attempted,7);safe(r);});
test('unchanged historical metadata is distinguished from changed metadata without changing either baseline',async()=>{const r=await fixture().run();assert.equal(r.exit_code,0);assert.equal(r.prior_metadata_fingerprint_matches,true);safe(r);});
test('changed metadata never permits modified source bytes to pass',async()=>{const f=fixture({rows:[{...row,version:8}],detailPatch:{version:8},body:multipart({files:[{path:entry,body:privateMarker},{path:entry.replace('index.ts','handler.mjs'),body:sources.get('handler.mjs')}]})}),r=await f.run();assert.equal(r.exit_code,1);assert.equal(r.problem_code,'FUNCTION_SOURCE_MISMATCH');assert.equal(f.calls.length,4);safe(r);});
test('selected routes and an unknown unrelated function cannot be accepted as the reviewed contact function',async()=>{for(const rows of [[row,{...row,slug:'send-test-push',id:'OTHER'}],[{...row,slug:'unknown'}]]){const f=fixture({rows}),r=await f.run();assert.equal(r.exit_code,1);assert.equal(f.calls.length,2);safe(r);}});
test('JWT, import-map and path changes are rejected before source acceptance',async()=>{for(const detailPatch of [{verify_jwt:true},{import_map:true},{entrypoint_path:'file:///src/../index.ts'}]){const r=await fixture({detailPatch}).run();assert.equal(r.exit_code,1);safe(r);}});
test('a source observation changing during the review does not become a new accepted snapshot',async()=>{for(const phase of [5,6]){const r=await fixture({mutate:(i,r)=>i===phase?Response.json(i===5?{...row,import_map:false,entrypoint_path:'file://'+entry,ezbr_sha256:'a'.repeat(64)}:[{...row,version:8}]):r}).run();assert.equal(r.exit_code,1);assert.equal(r.problem_code,'OBSERVATION_CHANGED');safe(r);}});
test('missing selected installed names remain a review result',async()=>{const r=await fixture({mutate:(i,r)=>i===7?Response.json(sixNames.slice(1).map(name=>({name,value:privateMarker}))):r}).run();assert.equal(r.exit_code,1);assert.equal(r.problem_code,'INSTALLED_NAMES_NOT_OBSERVED');safe(r);});
test('both exact pinned LF and CRLF source variants remain acceptable without normalization',async()=>{const body=multipart({files:[...sources].map(([n,b])=>({path:entry.replace('index.ts',n),body:Buffer.from(b.toString().replaceAll('\n','\r\n'))}))});const r=await fixture({body}).run();assert.equal(r.exit_code,0);assert.equal(r.source_review_basis,'EXACT_PINNED_CRLF_ARTIFACTS');assert.equal(r.downloaded_source_normalized_for_acceptance,false);safe(r);});
test('redirected and oversized responses stop without any write operation',async()=>{for(const mode of ['redirect','oversize']){const r=await fixture({mutate:(i,r)=>{if(i!==2)return r;if(mode==='redirect'){Object.defineProperty(r,'redirected',{value:true});return r;}return new Response('x'.repeat(262145),{headers:{'content-type':'application/json'}});}}).run();assert.equal(r.exit_code,1);safe(r);}});
test('provider failure at each of the seven GETs stops without retries or private response disclosure',async()=>{for(let p=1;p<=7;p++){const f=fixture({mutate:(i,r)=>i===p?new Response(privateMarker,{status:403}):r}),r=await f.run();assert.equal(r.exit_code,1);assert.equal(f.calls.length,p);assert(f.calls.every(x=>x.init.method==='GET'));safe(r);}});
test('caller write flags, endpoint overrides and invalid tokens cause no provider request',async()=>{for(const input of [{token,write:true},{token,url:'https://example.invalid'},{token:'invalid'}]){const f=fixture(),r=await f.run(input);assert.equal(r.exit_code,1);assert.equal(f.calls.length,0);safe(r);}});
test('private CLI preflight requires no credentials and returns no raw input on malformed payloads',()=>{for(const [input,status]of [['{"preflight":true}',0],['{'+token,1]]){const r=spawnSync(process.execPath,['scripts/review-fr-2-email-edge-installed.mjs','--private-parent-pipe'],{input,encoding:'utf8'});assert.equal(r.status,status);assert.equal(r.stderr,'');assert(!r.stdout.includes(token));assert.equal(JSON.parse(r.stdout).requests_attempted,0);}});
