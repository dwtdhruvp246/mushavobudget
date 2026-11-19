import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,copyFile,rm,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {checkCloudflareAccount} from '../scripts/check-fr-2-cloudflare-account.mjs';
const syntheticAccount='a'.repeat(32),syntheticToken='SYNTHETIC_PRIVATE_TOKEN_FOR_TESTS_ONLY';
const root=await mkdtemp(path.join(os.tmpdir(),'mushavo-account-check-'));
// Retained assistant review artifact is used only by the explicit verifier below.
const artifact=process.env.MUSHAVO_ACCOUNT_TEST_CANDIDATE;
const payload=x=>new Response(JSON.stringify({success:true,errors:[],result:x}),{headers:{'Content-Type':'application/json'}});
async function run(overrides={}){
 const calls=[];const outputs=[payload({status:'active'}),payload({name:'mushavo-budget-staging',subdomain:'mushavo-budget-staging.pages.dev'}),payload([])];
 const transport=async(url,init)=>{calls.push({url,init});if(overrides.throwRequest)throw Error(syntheticToken);return overrides.response?.(calls.length)||outputs[calls.length-1];};
 const candidateCheck=overrides.actualCandidate?undefined:async directory=>assert.equal(directory,root);
 const receipt=await checkCloudflareAccount({account:syntheticAccount,token:syntheticToken,candidate:root,...overrides.input},{transport,candidateCheck});
 assert(!JSON.stringify(receipt).includes(syntheticToken));assert(!JSON.stringify(receipt).includes(syntheticAccount));
 return {receipt,calls};
}
if(artifact){
 await copyFile(path.join(artifact,'email-rate-worker.mjs'),path.join(root,'email-rate-worker.mjs'));
 await copyFile(path.join(artifact,'wrangler.json'),path.join(root,'wrangler.json'));
}else{
 await writeFile(path.join(root,'email-rate-worker.mjs'),'synthetic');
 await writeFile(path.join(root,'wrangler.json'),'synthetic');
}
 test('selected account check makes exactly three fixed GETs, preserves candidate and returns no credentials',async()=>{
  const before=await readFile(path.join(root,'wrangler.json'));const{receipt,calls}=await run({actualCandidate:!!artifact});
  assert.equal(receipt.exit_code,0);assert.equal(receipt.target_Worker_absent,true);assert.equal(calls.length,3);
  for(const c of calls){assert.equal(c.init.method,'GET');assert.equal(c.init.redirect,'error');assert(c.url.startsWith('https://api.cloudflare.com/client/v4/'));assert.equal(c.init.headers.Authorization,'Bearer '+syntheticToken);}
  assert.equal(calls[1].url,`https://api.cloudflare.com/client/v4/accounts/${syntheticAccount}/pages/projects/mushavo-budget-staging`);
  assert.equal(calls[2].url,`https://api.cloudflare.com/client/v4/accounts/${syntheticAccount}/workers/scripts`);
  assert.deepEqual(await readFile(path.join(root,'wrangler.json')),before);
 });
 for(const [name,options,code,count]of[
  ['wrong account identifier',{input:{account:'bad'}},'INVALID_ACCOUNT_ID',0],
  ['inactive token',{response:n=>n===1?payload({status:'expired'}):null},'TOKEN_NOT_ACTIVE',1],
  ['wrong Pages project',{response:n=>n===2?payload({name:'other',subdomain:'other.pages.dev'}):null},'STAGING_PROJECT_MISMATCH',2],
  ['matching name but wrong domain',{response:n=>n===2?payload({name:'mushavo-budget-staging',subdomain:'other.pages.dev'}):null},'STAGING_PROJECT_MISMATCH',2],
  ['existing target Worker',{response:n=>n===3?payload([{id:'mushavo-email-rate-staging'}]):null},'TARGET_WORKER_ALREADY_EXISTS',3],
  ['unauthorized is not absence',{response:n=>n===3?new Response('private error',{status:403}):null},'WORKERS_HTTP_REVIEW_REQUIRED',3],
  ['404 is not absence',{response:n=>n===3?new Response('not found',{status:404}):null},'WORKERS_HTTP_REVIEW_REQUIRED',3],
  ['malformed inventory',{response:n=>n===3?payload({}):null},'WORKER_INVENTORY_INVALID',3],
  ['incomplete inventory',{response:n=>n===3?new Response(JSON.stringify({success:true,errors:[],result:[],result_info:{total_pages:2}}),{headers:{'Content-Type':'application/json'}}):null},'WORKER_INVENTORY_INCOMPLETE',3],
  ['redirect/network failure',{throwRequest:true},'TOKEN_NETWORK_OR_REDIRECT_FAILURE',1],
  ['oversized response',{response:n=>n===1?new Response(' '.repeat(2097153),{headers:{'Content-Type':'application/json'}}):null},'TOKEN_RESPONSE_TOO_LARGE',1],
  ['provider success false',{response:n=>n===1?new Response(JSON.stringify({success:false,errors:[{message:syntheticToken}]}),{headers:{'Content-Type':'application/json'}}):null},'TOKEN_API_REVIEW_REQUIRED',1]
 ])test(name+' stops safely',async()=>{const{receipt,calls}=await run(options);assert.equal(receipt.exit_code,1);assert.equal(receipt.problem_code,code);assert.equal(calls.length,count);assert.equal(receipt.deployed,false);});
 test('changed candidate stops before credentials can reach transport',async()=>{
   const original=await readFile(path.join(root,'wrangler.json'));
   try{await writeFile(path.join(root,'wrangler.json'),'{}');const{receipt,calls}=await run({actualCandidate:true});assert.equal(receipt.problem_code,'CANDIDATE_HASH_MISMATCH');assert.equal(calls.length,0);}
   finally{await writeFile(path.join(root,'wrangler.json'),original);}
 });
test('actual CLI rejects malformed private stdin without echoing it',()=>{
 for(const input of ['{'+syntheticToken,'null']){
  const child=spawnSync(process.execPath,['scripts/check-fr-2-cloudflare-account.mjs'],{input,encoding:'utf8'});
  assert.equal(child.status,1);assert.equal(child.stderr,'');assert(!child.stdout.includes(syntheticToken));assert.equal(JSON.parse(child.stdout).requests_attempted,0);
 }

});
test.after(async()=>{await rm(root,{recursive:true,force:true});});
