import {mkdtemp,mkdir,copyFile,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {checkCloudflareAccount,verifyAccountCandidate} from './check-fr-2-cloudflare-account.mjs';
import {verifyLimiterSourcesAndTools,defaultSourceRoot} from './prepare-fr-2-email-limiter.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{safeCode:code});};
export function deploymentEnvironment(input,scratch){
 const env={};for(const[k,v]of Object.entries(process.env))
  if(!/^(?:CLOUDFLARE_|CF_|WRANGLER_|NODE_OPTIONS$|NODE_DEBUG|SSLKEYLOGFILE$|MUSHAVO_)/i.test(k))env[k]=v;
 Object.assign(env,{CLOUDFLARE_API_TOKEN:input.token,CLOUDFLARE_ACCOUNT_ID:input.account,
  CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false',WRANGLER_SEND_METRICS:'false',
  WRANGLER_HIDE_BANNER:'true',WRANGLER_LOG_LEVEL:'error',WRANGLER_LOG_PATH:path.join(scratch,'logs'),
  XDG_CONFIG_HOME:path.join(scratch,'config'),XDG_CACHE_HOME:path.join(scratch,'cache'),
  XDG_DATA_HOME:path.join(scratch,'data'),CI:'true'});return env;
}
export async function runWrangler({tools,project,scratch,input}){
 return new Promise(resolve=>{
  const child=spawn(process.execPath,[path.join(tools,'node_modules/wrangler/bin/wrangler.js'),
   'deploy','--config',path.join(project,'wrangler.json'),'--strict','--profile','mushavo-limiter-'+randomUUID()],
   {cwd:project,env:deploymentEnvironment(input,scratch),stdio:['ignore','pipe','pipe'],windowsHide:true});
  let bytes=0,finished=false;const timer=setTimeout(()=>{child.kill();},120000);
  const finish=result=>{if(finished)return;finished=true;clearTimeout(timer);resolve(result);};
  // Output may contain private account metadata; consume it without printing or saving it.
  for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{bytes+=b.length;if(bytes>2097152)child.kill();});
  child.on('error',()=>finish({exit_code:null}));
  child.on('close',(code,signal)=>finish({exit_code:signal?null:code}));
 });
}
async function metadata(transport,input,suffix){
 let response;try{response=await transport('https://api.cloudflare.com/client/v4/accounts/'+input.account+suffix,
  {method:'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+input.token,Accept:'application/json'}});}
 catch{need(false,'POST_DEPLOY_NETWORK_OR_REDIRECT_REVIEW_REQUIRED');}
 need(response.status===200,'POST_DEPLOY_HTTP_REVIEW_REQUIRED');
 need(/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||''),'POST_DEPLOY_INVALID_RESPONSE');
 const reader=response.body?.getReader();need(reader,'POST_DEPLOY_INVALID_RESPONSE');let size=0;const parts=[];
 try{for(;;){const{done,value}=await reader.read();if(done)break;size+=value.length;need(size<=2097152,'POST_DEPLOY_RESPONSE_TOO_LARGE');parts.push(value);}}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 let body;try{body=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{need(false,'POST_DEPLOY_INVALID_RESPONSE');}
 need(body.success===true&&(body.errors==null||(Array.isArray(body.errors)&&body.errors.length===0)),'POST_DEPLOY_API_REVIEW_REQUIRED');return body;
}
export async function deployLimiter(input,{sourceRoot=defaultSourceRoot,transport=fetch,
 candidateCheck=verifyAccountCandidate,toolsCheck=verifyLimiterSourcesAndTools,execute=runWrangler}={}){
 const receipt={stage_step:'FR.2.4.E3.4_LIMITER_DEPLOYMENT',result:'LIMITER_DEPLOYMENT_REVIEW_REQUIRED',
  fresh_account_and_absence_check_passed:false,tools_verified:false,upload_attempted:false,
  Wrangler_exit_code:null,Worker_deployed:false,remote_state_may_require_review:false,
  selected_SQLite_namespace_verified:false,workers_dev_and_preview_URLs_disabled_verified:false,
  candidate_unchanged_verified:false,local_deployment_scratch_removed:false,
  Cloudflare_token_in_child_process_environment_only:true,credential_file_or_command_argument_written:false,
  Pages_gateway_or_binding_changed:false,email_dispatched:false,Zoho_file_accessed:false,
  SQL_Auth_or_application_guards_changed:false,email_login_enabled:false,
  hosted_acceptance:false,production_or_native_changed:false,findings_closed:[],problem_code:null,exit_code:1};
 let scratch;
 try{
  need(input&&Object.keys(input).sort().join(',')==='account,candidate,token,tools','INVALID_PRIVATE_INPUT');
  const accountInput={account:input.account,candidate:input.candidate,token:input.token};
  // Validate local artifacts/tools before opening authenticated network access.
  await candidateCheck(input.candidate);
  need(typeof input.tools==='string'&&path.isAbsolute(input.tools),'INVALID_TOOLS_PATH');
  await toolsCheck(sourceRoot,input.tools);receipt.tools_verified=true;
  scratch=await mkdtemp(path.join(os.tmpdir(),'mushavo-limiter-live-'));
  const project=path.join(scratch,'worker');await mkdir(project);
  for(const name of ['email-rate-worker.mjs','wrangler.json'])await copyFile(path.join(input.candidate,name),path.join(project,name));
  await candidateCheck(project);
  const before=await checkCloudflareAccount(accountInput,{transport,candidateCheck});
  need(before.exit_code===0,before.problem_code||'FRESH_ACCOUNT_CHECK_FAILED');
  receipt.fresh_account_and_absence_check_passed=true;
  // No automatic retry: remote writes may be partial even when the CLI fails.
  receipt.upload_attempted=true;receipt.remote_state_may_require_review=true;
  const result=await execute({tools:input.tools,project,scratch,input});receipt.Wrangler_exit_code=result.exit_code;
  need(result.exit_code===0,'WRANGLER_DEPLOYMENT_REVIEW_REQUIRED');receipt.Worker_deployed=true;
  const ns=await metadata(transport,input,'/workers/durable_objects/namespaces');
  need(Array.isArray(ns.result),'NAMESPACE_INVENTORY_INVALID');
  const selected=ns.result.filter(n=>n.script==='mushavo-email-rate-staging'&&n.class==='EmailGatewayRateLimiter');
  need(selected.length===1&&selected[0].use_sqlite===true&&typeof selected[0].id==='string','SQLITE_NAMESPACE_REVIEW_REQUIRED');
  receipt.selected_SQLite_namespace_verified=true;
  const sub=await metadata(transport,input,'/workers/scripts/mushavo-email-rate-staging/subdomain');
  need(sub.result?.enabled===false&&sub.result.previews_enabled===false,'PUBLIC_URL_CONFIGURATION_REVIEW_REQUIRED');
  receipt.workers_dev_and_preview_URLs_disabled_verified=true;
  await candidateCheck(input.candidate);receipt.candidate_unchanged_verified=true;
  receipt.remote_state_may_require_review=false;
  receipt.result='STAGING_LIMITER_DEPLOYED_SELECTED_METADATA_SCOPED_PASS_NOT_EMAIL_ACCEPTANCE';receipt.exit_code=0;
 }catch(error){receipt.problem_code=error.safeCode||'LOCAL_OR_DEPLOYMENT_REVIEW_REQUIRED';}
 finally{if(scratch){try{await rm(scratch,{recursive:true,force:true});receipt.local_deployment_scratch_removed=true;}catch{receipt.exit_code=1;receipt.problem_code='LOCAL_SCRATCH_CLEANUP_REVIEW_REQUIRED';}}}
 receipt.checked_UTC=new Date().toISOString();return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let input;try{let size=0;const parts=[];for await(const b of process.stdin){size+=b.length;need(size<=16384,'INVALID_PRIVATE_INPUT');parts.push(b);}input=JSON.parse(Buffer.concat(parts).toString('utf8'));need(input&&typeof input==='object'&&!Array.isArray(input),'INVALID_PRIVATE_INPUT');}
 catch{console.log(JSON.stringify({stage_step:'FR.2.4.E3.4_LIMITER_DEPLOYMENT',result:'PRIVATE_INPUT_REVIEW_REQUIRED',upload_attempted:false,problem_code:'INVALID_PRIVATE_INPUT',exit_code:1}));process.exitCode=1;}
 if(input){const receipt=await deployLimiter(input);console.log(JSON.stringify(receipt,null,2));process.exitCode=receipt.exit_code;}
}
