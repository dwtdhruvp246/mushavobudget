// FR.1.3: fixed public static GET metadata only; no browser evaluation/Auth/API/SQL.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {prepareFinalStaging} from './prepare-final-staging.mjs';

export const ORIGIN = 'https://mushavo-budget-staging.pages.dev';
export const PROJECT = 'dczlddwbtgvfdujgcitb';
export const SOURCE_PIN = '268eb30b21154c14b5eede7e3ceb187341ef586b';
export const VERSIONED = Object.freeze([
 ['auth-flows.js','/auth-flows.js?v=1'],['auth-security.js','/auth-security.js?v=1'],
 ['admin-mfa.js','/admin-mfa.js?v=1'],['app.js','/app.js?v=115'],
 ['business.js','/business.js?v=20'],['config.js','/config.js?v=27'],
]);
export const FLOWS = Object.freeze(['confirm','recover','business-new','business-existing']);
export const MISSING = Object.freeze([
 '/__mushavo_fr1_missing_asset.js','/docs/security-audit/README.md',
 '/scripts/prepare-final-staging.mjs','/supabase/schema.sql','/preparation-receipt.json','/_headers',
]);
const sha = data=>createHash('sha256').update(data).digest('hex');
const canonical = name=>name==='index.html'?'/':name.endsWith('.html')?'/'+name.slice(0,-5):'/'+name;
const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

export function validateArguments(args) {
 if (args.length!==2 || args[0]!=='--check-public-staging='+PROJECT || args[1]!=='--source-pin='+SOURCE_PIN) throw Error('INVALID_FIXED_STAGING_ARGUMENTS');
}
export function loadExpected(root=scriptRoot) {
 const contract=JSON.parse(fs.readFileSync(path.join(root,'docs/security-audit/security-final-staging-source-contract.json'),'utf8'));
 if(contract.source_commit!==SOURCE_PIN || contract.public_inputs.length!==38)throw Error('UNEXPECTED_SOURCE_CONTRACT');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mushavo-fr-serving-expected-'));
 try {
  const output=path.join(temp,'public');
  prepareFinalStaging({source:root,output,receipt:path.join(temp,'receipt.json'),sourcePin:SOURCE_PIN,project:PROJECT,publishableKey:'sb_publishable_SYNTHETIC_EXPECTATION_NOT_DEPLOYABLE',contract});
  const names=[...contract.public_inputs.map(r=>r.path),'404.html'];
  const assets=new Map(names.map(name=>[name,{name,path:canonical(name),data:fs.readFileSync(path.join(output,name))}]));
  const headers={};
  for(const m of fs.readFileSync(path.join(output,'_headers'),'utf8').matchAll(/^  ([A-Za-z-]+): (.+)$/gm))headers[m[1].toLowerCase()]=m[2].trim();
  if(assets.size!==39 || Object.keys(headers).length!==7)throw Error('UNEXPECTED_EXPECTATION_SHAPE');
  return {assets,headers,sourceConfig:fs.readFileSync(path.join(root,'config.js')),source_inputs_verified:39};
 } finally {fs.rmSync(temp,{recursive:true,force:true});}
}
function matchesType(name,headers,data) {
 const type=(headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 const html=/^\s*(?:<!doctype\b|<html\b)/i.test(data.subarray(0,512).toString('utf8'));
 if(name.endsWith('.html'))return type==='text/html'&&html;
 if(html)return false;
 if(name.endsWith('.js'))return ['text/javascript','application/javascript'].includes(type);
 if(name.endsWith('.css'))return type==='text/css';
 if(name.endsWith('.webmanifest'))return ['application/manifest+json','application/json'].includes(type);
 if(name.endsWith('.png'))return type==='image/png';
 if(name.endsWith('.svg'))return type==='image/svg+xml';
 return false;
}
function configFlags(data,expected) {
 const text=data.toString('utf8');
 const flags={JSON_assignment_valid:false,staging_URL_exact:false,publishable_key_format:false,push_key_disabled:false,
  production_reference_present:text.includes('kttkospkblwvguuwnhjj'),forbidden_secret_marker_observed:/sb_secret_|service_role|SUPABASE_SERVICE_ROLE_KEY/.test(text),source_production_key_match:false,exact_config_fields:false};
 try{
  const match=text.match(/^\s*window\.MUSHAVO_BUDGET_CONFIG\s*=\s*(\{[\s\S]*\})\s*;\s*$/);
  if(!match)return flags;
  const config=JSON.parse(match[1]);
  flags.JSON_assignment_valid=true;
  flags.staging_URL_exact=config.supabaseUrl==='https://'+PROJECT+'.supabase.co';
  flags.publishable_key_format=typeof config.supabasePublishableKey==='string'&&/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.supabasePublishableKey);
  flags.push_key_disabled=config.vapidPublicKey==='';
  flags.exact_config_fields=Object.keys(config).sort().join(',')==='supabasePublishableKey,supabaseUrl,vapidPublicKey';
  flags.source_production_key_match=typeof config.supabasePublishableKey==='string'&&config.supabasePublishableKey.length>0&&expected.sourceConfig.includes(Buffer.from(config.supabasePublishableKey));
 }catch{}
 return flags;
}
function assetMetadata(name,response,expected) {
 if(response.blocked || response.limit)return {result:response.blocked?'BLOCKED_TRANSPORT_OR_TIME_BUDGET':'FAIL_RESPONSE_SIZE_LIMIT',status:response.status??null};
 const row=expected.assets.get(name);
 const type_matches=matchesType(name,response.headers,response.data);
 const header_mismatches=Object.keys(expected.headers).filter(key=>(response.headers.get(key)||'').trim()!==expected.headers[key]);
 const base={status:response.status,bytes:response.data.length,type_matches,selected_header_mismatches:header_mismatches};
 if(name==='config.js'){
  const flags=configFlags(response.data,expected);
  const ok=flags.JSON_assignment_valid&&flags.staging_URL_exact&&flags.publishable_key_format&&flags.push_key_disabled&&flags.exact_config_fields&&!flags.production_reference_present&&!flags.forbidden_secret_marker_observed&&!flags.source_production_key_match;
  return {...base,sha256_omitted:true,config_flags:flags,result:response.status!==200?'FAIL_HTTP_STATUS':!type_matches?'FAIL_ASSET_TYPE':!ok?'FAIL_STAGING_CONFIG':header_mismatches.length?'FAIL_SELECTED_HEADERS':'PASS_CONFIG_SHAPE_NOT_KEY_OWNERSHIP'};
 }
 const hash=sha(response.data),source_match=hash===sha(row.data);
 return {...base,sha256:hash,source_match,result:response.status!==200?'FAIL_HTTP_STATUS':!type_matches?'FAIL_ASSET_TYPE':!source_match?'FAIL_SOURCE_PARITY':header_mismatches.length?'FAIL_SELECTED_HEADERS':'PASS'};
}
export async function collectServing({expected,fetchImpl=globalThis.fetch,now=()=>Date.now(),totalMs=75000,requestMs=6000}) {
 const start=now();let requests=0,completed=0;
 async function request(route,limit=2*1024*1024) {
  const remaining=totalMs-(now()-start);
  if(remaining<=0)return {blocked:true};
  requests++;const controller=new AbortController();let timer,reader,status;
  const expired=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('REQUEST_TIMEOUT'));},Math.min(requestMs,remaining));});
  try{
   const response=await Promise.race([Promise.resolve().then(()=>fetchImpl(ORIGIN+route,{method:'GET',redirect:'manual',credentials:'omit',headers:{Accept:'*/*'},signal:controller.signal})),expired]);
   status=response.status;completed++;
   if([301,302,303,307,308].includes(status)){response.body?.cancel().catch(()=>{});return {status,headers:response.headers,data:Buffer.alloc(0),location:response.headers.get('location')};}
   if(!response.body)return {status,headers:response.headers,data:Buffer.alloc(0)};
   reader=response.body.getReader();const chunks=[];let size=0;
   for(;;){const part=await Promise.race([reader.read(),expired]);if(part.done)break;size+=part.value.length;if(size>limit)return {limit:true,status};chunks.push(Buffer.from(part.value));}
   return {status,headers:response.headers,data:Buffer.concat(chunks)};
  }catch{return {blocked:true,status};}
  finally{clearTimeout(timer);controller.abort();reader?.cancel().catch(()=>{});}
 }
 const samples=[];
 for(const [name,row] of expected.assets){
  const response=await request(row.path,name==='config.js'?32768:2*1024*1024);
  samples.push({kind:'CANONICAL_ASSET',source_path:name,path:row.path,...assetMetadata(name,response,expected)});
 }
 for(const [name,route] of VERSIONED){
  samples.push({kind:'VERSIONED_SCRIPT',source_path:name,path:route,...assetMetadata(name,await request(route,name==='config.js'?32768:2*1024*1024),expected)});
 }
 async function alias(name,route,target,kind,followCanonical) {
  const response=await request(route);
  if(response.blocked||response.limit)return {kind,source_path:name,path:route,result:response.blocked?'BLOCKED_TRANSPORT_OR_TIME_BUDGET':'FAIL_RESPONSE_SIZE_LIMIT',status:response.status??null};
  if(response.status===200)return {kind,source_path:name,path:route,direct_alias:true,...assetMetadata(name,response,expected)};
  let location_match=false;
  try{location_match=new URL(response.location,ORIGIN).href===ORIGIN+target;}catch{}
  if(![301,302,303,307,308].includes(response.status)||!location_match)return {kind,source_path:name,path:route,status:response.status,expected_same_origin_location_match:location_match,result:'FAIL_ALIAS_OR_CALLBACK_REDIRECT'};
  if(!followCanonical)return {kind,source_path:name,path:route,status:response.status,expected_same_origin_location_match:true,redirect_not_followed:true,result:'PASS_EXPECTED_CANONICAL_REDIRECT'};
  const final=assetMetadata(name,await request(target),expected);
  return {kind,source_path:name,path:route,status:response.status,expected_same_origin_location_match:true,one_fixed_canonical_GET:true,canonical_result:final,result:final.result.startsWith('PASS')?'PASS_CALLBACK_SERVING':final.result};
 }
 for(const [name,row] of expected.assets)if(name.endsWith('.html')&&name!=='404.html')samples.push(await alias(name,'/'+name,row.path,'HTML_ALIAS',false));
 for(const flow of FLOWS)samples.push(await alias('auth.html','/auth.html?flow='+flow,'/auth?flow='+flow,'CALLBACK_ROUTE',true));
 const notFound=expected.assets.get('404.html').data;
 for(const route of MISSING){
  const response=await request(route);
  if(response.blocked||response.limit){samples.push({kind:'MISSING_OR_PRIVATE_PATH',path:route,status:response.status??null,result:response.blocked?'BLOCKED_TRANSPORT_OR_TIME_BUDGET':'FAIL_RESPONSE_SIZE_LIMIT'});continue;}
  const body_match=sha(response.data)===sha(notFound),type_matches=matchesType('404.html',response.headers,response.data);
  samples.push({kind:'MISSING_OR_PRIVATE_PATH',path:route,status:response.status,bytes:response.data.length,sha256:sha(response.data),custom_404_match:body_match,type_matches,result:response.status===404&&body_match&&type_matches?'PASS_NOT_FOUND':'FAIL_EXPECTED_NOT_FOUND'});
 }
 const pass=samples.filter(x=>x.result.startsWith('PASS')).length,fail=samples.filter(x=>x.result.startsWith('FAIL')).length,blocked=samples.filter(x=>x.result.startsWith('BLOCKED')).length;
 const all=pass===65&&fail===0&&blocked===0&&samples.length===65;
 return {stage_step:'FR.1.3',checked_UTC:new Date().toISOString(),result:all?'PUBLIC_STAGING_STATIC_SERVING_SCOPED_PASS':'PUBLIC_STAGING_SERVING_REVIEW_REQUIRED',
  scope:'FIXED_STATIC_ASSET_SOURCE_TYPES_SELECTED_HEADERS_CANONICAL_CALLBACK_REDIRECTS_AND_MISSING_PATHS_NOT_AUTH_BROWSER_SQL_BACKEND_OR_RELEASE_ACCEPTANCE',
  source_commit:SOURCE_PIN,project:PROJECT,origin:ORIGIN,source_inputs_verified:expected.source_inputs_verified,unique_served_files:39,versioned_script_cases:6,HTML_alias_cases:10,callback_route_cases:4,missing_or_private_path_cases:6,
  metadata_cases:samples.length,pass,fail,blocked,requests_attempted:requests,HTTP_responses_completed:completed,max_requests:69,unrestricted_redirects_followed:0,max_fixed_callback_canonical_GETs:4,authenticated_requests:0,samples,
  resource_CSP_mode:'REPORT_ONLY_BASELINE_ENFORCED_NOT_FULL_RESOURCE_CSP_ACCEPTANCE',raw_bodies_keys_headers_or_exception_text_printed:false,config_sha256_omitted:true,
  public_frontend_serving_scoped_acceptance:all,actual_key_ownership_verified:false,unique_Cloudflare_deployment_ID_verified:false,actual_Auth_API_SQL_jobs_provider_device_store_or_browser_workflows_checked:false,
  hosted_acceptance:false,native_security_acceptance:false,store_acceptance:false,accounts_fixtures_settings_or_existing_files_changed:false,production_or_native_changed:false,notification_email_or_charge_dispatched:false,APK_update_deferred:true,findings_closed:[]};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{validateArguments(process.argv.slice(2));const result=await collectServing({expected:loadExpected()});console.log(JSON.stringify(result,null,2));process.exitCode=result.public_frontend_serving_scoped_acceptance?0:1;}
 catch{console.error(JSON.stringify({stage_step:'FR.1.3',result:'COLLECTION_NOT_STARTED',reason:'Check fixed staging arguments and exact selected source inputs; no keys or raw exceptions are printed.',hosted_acceptance:false}));process.exitCode=2;}
}
