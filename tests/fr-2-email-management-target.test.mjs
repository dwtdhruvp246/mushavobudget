import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {checkManagementTarget,targetRef,expectedChecks,targetQueryURL} from '../scripts/check-fr-2-email-management-target.mjs';
const token='sbp_fc_SYNTHETIC_PRIVATE_TOKEN_20261021_00000000';
const metadata=()=>({id:targetRef,ref:targetRef,status:'ACTIVE_HEALTHY',database:{host:'db.'+targetRef+'.supabase.co'},name:'NOT_PRINTED'});
const answer=()=>[{staging_target_preflight:{checks:Object.fromEntries(expectedChecks.map(k=>[k,true])),read_only_role:true,transaction_read_only:'on'}}];
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
async function run({project=metadata(),result=answer(),first,second,input={token}}={}){
  const calls=[];const resultReceipt=await checkManagementTarget(input,{transport:async(url,options)=>{
    calls.push({url,options});return calls.length===1?(first??response(project)):(second??response(result,201));
  }});return{r:resultReceipt,calls};
}
test('Exactly one fixed metadata GET and one dedicated read-only POST carry only the pinned SQL',async()=>{
  const {r,calls}=await run();assert.equal(r.exit_code,0);assert.equal(calls.length,2);
  assert.equal(calls[0].url,'https://api.supabase.com/v1/projects/'+targetRef);
  assert.equal(calls[0].options.method,'GET');assert.equal(calls[1].url,calls[0].url+'/database/query/read-only');
  assert.equal(calls[1].options.method,'POST');assert.deepEqual(JSON.parse(calls[1].options.body),{query:await readFile(targetQueryURL,'utf8')});
  for(const c of calls){assert.equal(c.options.redirect,'error');assert.equal(c.options.headers.Authorization,'Bearer '+token);assert(c.options.signal);}
  assert(!JSON.stringify(r).includes(token));assert.equal(r.future_installation_target_or_privileges_verified,false);
});
test('Invalid, legacy, injected or additional private fields cannot start a request',async()=>{
  for(const input of [{},{token:'sbp_LEGACY_TOKEN_0000000000000000000'},{token:token+'\n'},{token,url:'https://foreign.invalid'},{token,query:'DROP SCHEMA public CASCADE'}]){
    const {r,calls}=await run({input});assert.equal(r.exit_code,1);assert.equal(calls.length,0);
  }
});
for(const [name,mutate,problem] of [
  ['wrong ref',p=>p.ref='kttkospkblwvguuwnhjj','TARGET_PROJECT_MISMATCH'],
  ['contradictory id',p=>p.id='kttkospkblwvguuwnhjj','TARGET_PROJECT_MISMATCH'],
  ['foreign database host',p=>p.database.host='db.kttkospkblwvguuwnhjj.supabase.co','TARGET_DATABASE_HOST_MISMATCH'],
  ['unhealthy project',p=>p.status='INACTIVE','TARGET_PROJECT_NOT_READY']
])test(name+' refuses before any SQL request',async()=>{
  const p=metadata();mutate(p);const {r,calls}=await run({project:p});assert.equal(r.problem_code,problem);assert.equal(calls.length,1);
});
test('The documented identity and legacy id-only identity are bounded to the same exact project',async()=>{
  const p=metadata();delete p.ref;assert.equal((await run({project:p})).r.exit_code,0);
});
for(const status of [401,403,429,500])test('Metadata HTTP '+status+' stops without retry or a write-capable fallback',async()=>{
  const {r,calls}=await run({first:response({error:token},status)});assert.equal(r.exit_code,1);assert.equal(calls.length,1);assert(!JSON.stringify(r).includes(token));
});
test('Read-only endpoint refusal stops after two requests and never prints its private response',async()=>{
  const {r,calls}=await run({second:response({message:token},403)});assert.equal(r.exit_code,1);assert.equal(calls.length,2);assert(!JSON.stringify(r).includes(token));
});
test('A redirect, incorrect content type or oversized provider response is rejected',async()=>{
  const redirected=response(metadata());Object.defineProperty(redirected,'redirected',{value:true});
  for(const first of [redirected,new Response('HTML',{headers:{'Content-Type':'text/html'}}),response({payload:'x'.repeat(70000)})])assert.equal((await run({first})).r.exit_code,1);
});
test('Only the exact single-row boolean catalog receipt is accepted',async()=>{
  for(const data of [[],{},[...answer(),...answer()],[{staging_target_preflight:{...answer()[0].staging_target_preflight,secret:token}}]])assert.equal((await run({result:data})).r.exit_code,1);
  const data=answer();data[0].staging_target_preflight.checks.extra=true;assert.equal((await run({result:data})).r.exit_code,1);
});
test('Unexpected execution role or transaction mode does not become target acceptance',async()=>{
  for(const [key,value]of [['read_only_role',false],['transaction_read_only','off']]){const data=answer();data[0].staging_target_preflight[key]=value;assert.equal((await run({result:data})).r.problem_code,'READ_ONLY_ROLE_OR_TRANSACTION_REVIEW_REQUIRED');}
});
test('A false catalog check is retained as a safe boolean and requires review',async()=>{
  const data=answer();data[0].staging_target_preflight.checks.email_backend_installer_and_guards_absent=false;
  const {r}=await run({result:data});assert.equal(r.problem_code,'CATALOG_BASELINE_REVIEW_REQUIRED');assert.equal(r.checks.email_backend_installer_and_guards_absent,false);
});
test('Raw exceptions and unrelated response metadata never enter the receipt',async()=>{
  const r=await checkManagementTarget({token},{transport:async()=>{throw Error(token);}});assert.equal(r.exit_code,1);assert(!JSON.stringify(r).includes(token));
  const p=metadata();p.secret=token;const {r:success}=await run({project:p});assert.equal(success.exit_code,0);assert(!JSON.stringify(success).includes(token));assert(!JSON.stringify(success).includes('NOT_PRINTED'));
});
test('Private CLI preflight uses no token or provider request and rejects public invocation',()=>{
  const file=fileURLToPath(new URL('../scripts/check-fr-2-email-management-target.mjs',import.meta.url));
  const r=spawnSync(process.execPath,[file,'--private-parent-pipe'],{input:'{"preflight":true}',encoding:'utf8'});assert.equal(r.status,0);assert.equal(JSON.parse(r.stdout).requests_attempted,0);
  const wrong=spawnSync(process.execPath,[file,'--activate'],{input:'{}',encoding:'utf8'});assert.equal(wrong.status,1);
});
