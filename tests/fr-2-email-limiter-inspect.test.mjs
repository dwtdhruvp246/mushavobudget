import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {inspectLimiter,summarizeEnvelope} from '../scripts/inspect-fr-2-email-limiter.mjs';
const token='SYNTHETIC_SECRET_TOKEN_NOT_REAL',account='a'.repeat(32),namespace='PRIVATE_NAMESPACE_ID';
const expected=[{name:'mushavo-budget-staging',subdomain:'mushavo-budget-staging.pages.dev'},[{id:'mushavo-email-rate-staging'}],
 [{script:'mushavo-email-rate-staging',class:'EmailGatewayRateLimiter',use_sqlite:true,id:namespace}],{enabled:false,previews_enabled:false}];
async function run(options={}){
 let calls=0;const urls=[];
 const receipt=await inspectLimiter({account,token,candidate:path.resolve('synthetic-candidate')},{
  candidateCheck:async()=>{if(options.badCandidate)throw Error(token);},
  transport:async(url,init)=>{calls++;urls.push(url);assert.equal(init.method,'GET');assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,'Bearer '+token);
   if(options.throwNamespace&&calls===3)throw Error(token);
   return options.response?.(calls)||new Response(JSON.stringify({success:true,errors:[],result:expected[calls-1]}),{headers:{'Content-Type':'application/json'}});}
 });
 const encoded=JSON.stringify(receipt);for(const secret of[token,account,namespace])assert(!encoded.includes(secret));
 return {receipt,calls,urls};
}
const response=(result,fields={})=>new Response(JSON.stringify({success:true,errors:[],result,...fields}),{headers:{'Content-Type':'application/json'}});
test('four fixed GETs verify selected metadata with no write or private output',async()=>{const{receipt,calls,urls}=await run();assert.equal(calls,4);assert.equal(receipt.exit_code,0);assert.equal(receipt.selected_SQLite_namespace_verified,true);assert.equal(receipt.upload_deletion_or_settings_write_attempted,false);assert(urls[2].endsWith('/workers/durable_objects/namespaces?per_page=1000'));});
for(const type of ['null','absent'])test('successful '+type+' errors is distinguished from the older array-only predicate',async()=>{
 const body={success:true,result:expected[2]};if(type==='null')body.errors=null;
 const{receipt}=await run({response:n=>n===3?new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}}):null});
 assert.equal(receipt.exit_code,0);assert.equal(receipt.legacy_namespace_predicate_rejects_current_success_response,true);assert.equal(receipt.samples[2].errors_field_type,type.toUpperCase());
});
for(const[name,fields]of[
 ['success false',{success:false,errors:[{code:10000,message:token}]}],
 ['success missing',{success:undefined,errors:[]}],
 ['nonempty errors',{errors:[{code:10000,message:token}]}],
 ['unexpected errors object',{errors:{private:token}}]
])test(name+' cannot verify metadata but remaining public settings are still inspected',async()=>{
 const{receipt,calls}=await run({response:n=>n===3?response(expected[2],fields):null});
 assert.equal(calls,4);assert.equal(receipt.exit_code,1);assert.equal(receipt.selected_SQLite_namespace_verified,false);assert.equal(receipt.workers_dev_and_preview_URLs_disabled_verified,true);
});
test('403 with API error exposes only status, shape and numeric codes',async()=>{
 const{receipt}=await run({response:n=>n===3?new Response(JSON.stringify({success:false,errors:[{code:10000,message:token}],result:null}),{status:403,headers:{'Content-Type':'application/json'}}):null});
 assert.equal(receipt.exit_code,1);assert.equal(receipt.samples[2].http_status,403);assert.deepEqual(receipt.samples[2].numeric_error_codes,[10000]);
});
test('wrong project stops before any Worker metadata reads',async()=>{const{receipt,calls}=await run({response:n=>n===1?response({name:'other',subdomain:'other.pages.dev'}):null});assert.equal(calls,1);assert.equal(receipt.exit_code,1);});
test('namespace transport failure still permits independent public settings GET',async()=>{const{receipt,calls}=await run({throwNamespace:true});assert.equal(calls,4);assert.equal(receipt.samples[2].problem_code,'NETWORK_OR_RESPONSE_REVIEW_REQUIRED');assert.equal(receipt.workers_dev_and_preview_URLs_disabled_verified,true);assert.equal(receipt.exit_code,1);});
test('pagination indicating additional namespaces cannot verify unique selection',async()=>{const{receipt}=await run({response:n=>n===3?response(expected[2],{result_info:{total_pages:2}}):null});assert.equal(receipt.namespace_inventory_complete,false);assert.equal(receipt.selected_SQLite_namespace_verified,false);assert.equal(receipt.exit_code,1);});
test('public URL enabled cannot pass',async()=>{const{receipt}=await run({response:n=>n===4?response({enabled:false,previews_enabled:true}):null});assert.equal(receipt.exit_code,1);assert.equal(receipt.workers_dev_and_preview_URLs_disabled_verified,false);});
test('candidate failure makes zero requests',async()=>{const{receipt,calls}=await run({badCandidate:true});assert.equal(calls,0);assert.equal(receipt.exit_code,1);});
test('error code summaries are bounded and exclude strings/messages',()=>{const result=summarizeEnvelope({success:false,errors:Array.from({length:12},(_,i)=>({code:i,message:token})),result:null});assert.equal(result.numeric_error_codes.length,10);assert.equal(result.error_codes_truncated,true);assert(!JSON.stringify(result).includes(token));});
test('actual CLI rejects malformed private stdin without printing it',()=>{const p=spawnSync(process.execPath,['scripts/inspect-fr-2-email-limiter.mjs'],{input:'{'+token,encoding:'utf8'});assert.equal(p.status,1);assert.equal(p.stderr,'');assert(!p.stdout.includes(token));assert.equal(JSON.parse(p.stdout).requests_attempted,0);});
