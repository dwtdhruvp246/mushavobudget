import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,access} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {deployLimiter,deploymentEnvironment} from '../scripts/deploy-fr-2-email-limiter.mjs';
const account='a'.repeat(32),token='SYNTHETIC_PRIVATE_TOKEN_FOR_TESTS_ONLY';
const root=await mkdtemp(path.join(os.tmpdir(),'mushavo-live-test-'));
await writeFile(path.join(root,'email-rate-worker.mjs'),'synthetic');await writeFile(path.join(root,'wrangler.json'),'synthetic');
const payload=result=>new Response(JSON.stringify({success:true,errors:[],result}),{headers:{'Content-Type':'application/json'}});
async function run(options={}){
 let executions=0,requests=0,scratch;
 const responses=[{status:'active'},{name:'mushavo-budget-staging',subdomain:'mushavo-budget-staging.pages.dev'},[],
  [{script:'mushavo-email-rate-staging',class:'EmailGatewayRateLimiter',use_sqlite:true,id:'synthetic-id'}],{enabled:false,previews_enabled:false}];
 const receipt=await deployLimiter({account,token,candidate:root,tools:root},{
  toolsCheck:async()=>{if(options.badTools)throw Error(token);},
  candidateCheck:async()=>{if(options.badCandidate)throw Error(token);},
  transport:async(url,init)=>{requests++;assert.equal(init.method,'GET');assert.equal(init.redirect,'error');
   if(options.throwPost&&requests===4)throw Error(token);
   return options.response?.(requests)||payload(responses[requests-1]);},
  execute:async args=>{executions++;scratch=args.scratch;assert.equal(args.input.token,token);return {exit_code:options.exit??0};}
 });
 assert(!JSON.stringify(receipt).includes(token));assert(!JSON.stringify(receipt).includes(account));
 if(scratch)await assert.rejects(access(scratch));return {receipt,executions,requests};
}
test('deployment orchestration checks absence before exactly one execution then verifies metadata and removes scratch',async()=>{
 const{receipt,executions,requests}=await run();assert.equal(receipt.exit_code,0);assert.equal(receipt.Worker_deployed,true);
 assert.equal(receipt.selected_SQLite_namespace_verified,true);assert.equal(receipt.workers_dev_and_preview_URLs_disabled_verified,true);
 assert.equal(receipt.local_deployment_scratch_removed,true);assert.equal(executions,1);assert.equal(requests,5);
});
for(const[name,options]of[
 ['candidate corruption',{badCandidate:true}],['tools mismatch',{badTools:true}],
 ['inactive token',{response:n=>n===1?payload({status:'expired'}):null}],
 ['wrong account project',{response:n=>n===2?payload({name:'other'}):null}],
 ['existing Worker',{response:n=>n===3?payload([{id:'mushavo-email-rate-staging'}]):null}],
 ['inventory auth failure',{response:n=>n===3?new Response('private',{status:403}):null}]
])test(name+' prevents every upload attempt',async()=>{const{receipt,executions}=await run(options);assert.equal(receipt.exit_code,1);assert.equal(receipt.upload_attempted,false);assert.equal(executions,0);});
test('nonzero CLI is not retried and reports possible partial remote effects',async()=>{const{receipt,executions,requests}=await run({exit:1});assert.equal(executions,1);assert.equal(requests,3);assert.equal(receipt.exit_code,1);assert.equal(receipt.remote_state_may_require_review,true);});
for(const[name,options]of[
 ['namespace not SQLite',{response:n=>n===4?payload([{script:'mushavo-email-rate-staging',class:'EmailGatewayRateLimiter',id:'synthetic-id',use_sqlite:false}]):null}],
 ['namespace wrong script',{response:n=>n===4?payload([{script:'other',class:'EmailGatewayRateLimiter',id:'synthetic-id',use_sqlite:true}]):null}],
 ['missing namespace',{response:n=>n===4?payload([]):null}],
 ['public workers.dev enabled',{response:n=>n===5?payload({enabled:true,previews_enabled:false}):null}],
 ['preview URLs enabled',{response:n=>n===5?payload({enabled:false,previews_enabled:true}):null}],
 ['post-check transport failure',{throwPost:true}]
])test(name+' preserves deployed-but-review-required state without retries',async()=>{const{receipt,executions}=await run(options);assert.equal(executions,1);assert.equal(receipt.Worker_deployed,true);assert.equal(receipt.exit_code,1);assert.equal(receipt.remote_state_may_require_review,true);});
test('child environment uses explicit account/token and disables inherited Node preload and default secret config',()=>{
 const old=process.env.NODE_OPTIONS;process.env.NODE_OPTIONS='synthetic-preload';
 try{const env=deploymentEnvironment({account,token},root);assert.equal(env.NODE_OPTIONS,undefined);assert.equal(env.CLOUDFLARE_ACCOUNT_ID,account);assert.equal(env.CLOUDFLARE_API_TOKEN,token);assert.equal(env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV,'false');assert.equal(env.WRANGLER_SEND_METRICS,'false');assert.equal(env.WRANGLER_HIDE_BANNER,'true');}
 finally{if(old===undefined)delete process.env.NODE_OPTIONS;else process.env.NODE_OPTIONS=old;}
});
test('actual CLI rejects malformed private stdin without credential echo',()=>{const child=spawnSync(process.execPath,['scripts/deploy-fr-2-email-limiter.mjs'],{input:'{'+token,encoding:'utf8'});assert.equal(child.status,1);assert.equal(child.stderr,'');assert(!child.stdout.includes(token));assert.equal(JSON.parse(child.stdout).upload_attempted,false);});
test.after(async()=>rm(root,{recursive:true,force:true}));
