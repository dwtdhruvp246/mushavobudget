import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {collectServing,loadExpected,validateArguments,ORIGIN,PROJECT,SOURCE_PIN} from '../scripts/check-final-staging-serving.mjs';

import {historicalSource} from './helpers/historical-reviewed-source.mjs';
const frozen=historicalSource('FR1');
const expected=loadExpected(frozen);
const config=Buffer.from('window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify({supabaseUrl:'https://'+PROJECT+'.supabase.co',supabasePublishableKey:'sb_publishable_SYNTHETIC_RESPONSE_ONLY',vapidPublicKey:''})+';\n');
const ctype=n=>n.endsWith('.html')?'text/html':n.endsWith('.js')?'text/javascript':n.endsWith('.css')?'text/css':n.endsWith('.png')?'image/png':n.endsWith('.svg')?'image/svg+xml':'application/manifest+json';
function response(name,data,status=200,extra={}) {
 return new Response(data??(name==='config.js'?config:expected.assets.get(name).data),{status,headers:{...expected.headers,'Content-Type':ctype(name),...extra}});
}
function normal(url) {
 const u=new URL(url);
 const alias=[...expected.assets].find(([n,row])=>'/'+n===u.pathname&&n.endsWith('.html')&&n!=='404.html');
 if(alias)return new Response(null,{status:301,headers:{Location:alias[1].path+u.search}});
 const row=[...expected.assets].find(([,r])=>r.path===u.pathname);
 if(row)return response(row[0]);
 return response('404.html',undefined,404);
}
async function run(override=()=>undefined,extra={}) {
 const calls=[];
 const result=await collectServing({expected,fetchImpl:async(url,options)=>{calls.push({url,options});return override(url,options)??normal(url);},...extra});
 return {result,calls};
}
test('actual checker accepts all 65 selected metadata cases in at most 69 fixed GETs',async()=>{
 const {result,calls}=await run();assert.equal(result.metadata_cases,65);assert.equal(result.pass,65);assert.equal(result.fail,0);assert.equal(result.blocked,0);assert.equal(calls.length,69);assert.equal(result.public_frontend_serving_scoped_acceptance,true);assert.equal(result.hosted_acceptance,false);
 for(const c of calls){assert.ok(c.url.startsWith(ORIGIN+'/'));assert.equal(c.options.method,'GET');assert.equal(c.options.redirect,'manual');assert.equal(c.options.credentials,'omit');assert.deepEqual(Object.keys(c.options.headers),['Accept']);}
 assert.equal(calls.some(c=>c.url===ORIGIN+'/_headers'&&c.options.method==='GET'),true);
});
test('HTTP 200 HTML at a module path remains explicit asset type FAIL',async()=>{
 const {result}=await run(url=>new URL(url).pathname==='/auth-security.js'?response('auth.html'):undefined);
 assert.equal(result.public_frontend_serving_scoped_acceptance,false);assert.ok(result.samples.some(s=>s.source_path==='auth-security.js'&&s.result==='FAIL_ASSET_TYPE'));
});
test('correct JavaScript type with altered bytes is source parity FAIL',async()=>{
 const {result}=await run(url=>new URL(url).pathname==='/admin-mfa.js'?response('admin-mfa.js',Buffer.from('console.log("synthetic altered");')):undefined);
 assert.ok(result.samples.some(s=>s.source_path==='admin-mfa.js'&&s.result==='FAIL_SOURCE_PARITY'));
});
test('missing selected security header cannot be promoted to PASS',async()=>{
 const {result}=await run(url=>new URL(url).pathname==='/auth'?response('auth.html',undefined,200,{'X-Frame-Options':''}):undefined);
 assert.ok(result.samples.some(s=>s.source_path==='auth.html'&&s.result==='FAIL_SELECTED_HEADERS'));assert.ok(result.samples.find(s=>s.path==='/auth').selected_header_mismatches.includes('x-frame-options'));
});
test('config prints neither body/key nor config digest and rejects production URL or secret format',async()=>{
 for(const changes of [{supabaseUrl:'https://kttkospkblwvguuwnhjj.supabase.co'},{supabasePublishableKey:'sb_secret_SYNTHETIC_DO_NOT_PRINT'}]){
  const value={supabaseUrl:'https://'+PROJECT+'.supabase.co',supabasePublishableKey:'sb_publishable_SYNTHETIC_DO_NOT_PRINT',vapidPublicKey:'',...changes};
  const raw=Buffer.from('window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify(value)+';');
  const {result}=await run(url=>new URL(url).pathname==='/config.js'?response('config.js',raw):undefined);
  const rows=result.samples.filter(s=>s.source_path==='config.js');assert.ok(rows.every(s=>s.result==='FAIL_STAGING_CONFIG'&&s.sha256_omitted&&!('sha256' in s)));
  assert.equal(JSON.stringify(result).includes('SYNTHETIC_DO_NOT_PRINT'),false);
 }
});
test('source production key in an apparently staging-shaped config is detected without echo',async()=>{
 const key=expected.sourceConfig.toString().match(/sb_publishable_[A-Za-z0-9_-]+/)[0];
 const raw=Buffer.from('window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify({supabaseUrl:'https://'+PROJECT+'.supabase.co',supabasePublishableKey:key,vapidPublicKey:''})+';');
 const {result}=await run(url=>new URL(url).pathname==='/config.js'?response('config.js',raw):undefined);
 assert.ok(result.samples.filter(s=>s.source_path==='config.js').every(s=>s.result==='FAIL_STAGING_CONFIG'&&s.config_flags.source_production_key_match));
 assert.equal(JSON.stringify(result).includes(key),false);
});
test('unexpected external callback redirect is never followed or printed',async()=>{
 const {result,calls}=await run(url=>url.includes('/auth.html?flow=confirm')?new Response(null,{status:302,headers:{Location:'https://unrelated.example.test/private?secret=SYNTHETIC_SENTINEL'}}):undefined);
 assert.ok(result.samples.some(s=>s.path==='/auth.html?flow=confirm'&&s.result==='FAIL_ALIAS_OR_CALLBACK_REDIRECT'));
 assert.equal(calls.some(c=>c.url.includes('unrelated')),false);assert.equal(JSON.stringify(result).includes('SYNTHETIC_SENTINEL'),false);
});
test('callback canonical redirect that drops flow fails before following',async()=>{
 const {result,calls}=await run(url=>url.includes('/auth.html?flow=recover')?new Response(null,{status:301,headers:{Location:'/auth'}}):undefined);
 assert.ok(result.samples.some(s=>s.path==='/auth.html?flow=recover'&&s.result==='FAIL_ALIAS_OR_CALLBACK_REDIRECT'));
 assert.equal(calls.some(c=>c.url===ORIGIN+'/auth?flow=recover'),false);
});
test('direct correctly served HTML aliases preserve callback acceptance without forced redirects',async()=>{
 const {result,calls}=await run(url=>new URL(url).pathname==='/auth.html'?response('auth.html'):undefined);
 assert.equal(result.pass,65);assert.equal(calls.length,65);assert.equal(result.public_frontend_serving_scoped_acceptance,true);
});
test('root-page fallback at private or missing paths is an explicit FAIL',async()=>{
 const {result}=await run(url=>new URL(url).pathname==='/docs/security-audit/README.md'?response('index.html'):undefined);
 assert.ok(result.samples.some(s=>s.path==='/docs/security-audit/README.md'&&s.result==='FAIL_EXPECTED_NOT_FOUND'));
});
test('selected versioned module requests are checked independently',async()=>{
 const {result}=await run(url=>url.endsWith('/auth-flows.js?v=1')?response('auth.html'):undefined);
 assert.ok(result.samples.some(s=>s.kind==='VERSIONED_SCRIPT'&&s.path==='/auth-flows.js?v=1'&&s.result==='FAIL_ASSET_TYPE'));
 assert.ok(result.samples.some(s=>s.kind==='CANONICAL_ASSET'&&s.source_path==='auth-flows.js'&&s.result==='PASS'));
});
test('transport exceptions are BLOCKED, sanitized and never described as live PASS',async()=>{
 const result=await collectServing({expected,fetchImpl(){throw Error('PRIVATE_EXCEPTION_TOKEN_SENTINEL');}});
 assert.equal(result.pass,0);assert.equal(result.fail,0);assert.equal(result.blocked,65);assert.equal(result.HTTP_responses_completed,0);assert.equal(JSON.stringify(result).includes('PRIVATE_EXCEPTION_TOKEN_SENTINEL'),false);
});
test('oversized streamed config cannot be read or promoted',async()=>{
 const {result}=await run(url=>new URL(url).pathname==='/config.js'?response('config.js',Buffer.alloc(32769,65)):undefined);
 assert.ok(result.samples.filter(s=>s.source_path==='config.js').every(s=>s.result==='FAIL_RESPONSE_SIZE_LIMIT'));
});
test('expired whole-batch time budget leaves explicit unattempted BLOCKED cases',async()=>{
 let clock=0;const {result,calls}=await run(()=>undefined,{now:()=>clock+=100,totalMs:1});
 assert.equal(calls.length,0);assert.equal(result.requests_attempted,0);assert.equal(result.blocked,65);assert.equal(result.public_frontend_serving_scoped_acceptance,false);
});
test('per-request timeout bounds a transport that does not settle',async()=>{
 const result=await collectServing({expected,fetchImpl:()=>new Promise(()=>{}),requestMs:1,totalMs:30});
 assert.equal(result.public_frontend_serving_scoped_acceptance,false);assert.equal(result.blocked,65);assert.ok(result.requests_attempted<69);
});
test('fixed argument validation and actual CLI fail safely under disabled default network',()=>{
 const args=['--check-public-staging='+PROJECT,'--source-pin='+SOURCE_PIN];assert.doesNotThrow(()=>validateArguments(args));assert.throws(()=>validateArguments([...args,'--url=https://other.example.test']));
 assert.throws(()=>validateArguments(['--check-public-staging=kttkospkblwvguuwnhjj',args[1]]));
 const root=frozen,script=path.join(root,'scripts/check-final-staging-serving.mjs'),guard=path.join(root,'scripts/offline-test-network.cjs');
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','TMPDIR','LANG','LC_ALL'].includes(k.toUpperCase())));
 const child=spawnSync(process.execPath,['--require',guard,script,...args],{env,encoding:'utf8',timeout:10000});
 assert.equal(child.status,1,child.stderr);const receipt=JSON.parse(child.stdout);assert.equal(receipt.blocked,65);assert.equal(receipt.HTTP_responses_completed,0);assert.equal(receipt.hosted_acceptance,false);
 const bad=spawnSync(process.execPath,[script,'--url=SYNTHETIC_SECRET_SENTINEL'],{env,encoding:'utf8',timeout:10000});
 assert.equal(bad.status,2);assert.equal(JSON.parse(bad.stderr).result,'COLLECTION_NOT_STARTED');assert.equal(bad.stderr.includes('SYNTHETIC_SECRET_SENTINEL'),false);
});
