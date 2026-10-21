import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {checkEdgeInventory,inventoryRef,selectedFunctions} from '../scripts/check-fr-2-email-edge-inventory.mjs';
const token='sbp_fc_SYNTHETIC_PRIVATE_TOKEN_20261021_00000000';
const project=()=>({ref:inventoryRef,id:inventoryRef,status:'ACTIVE_HEALTHY',database:{host:'db.'+inventoryRef+'.supabase.co'}});
const functions=()=>selectedFunctions.map((slug,i)=>({id:'PRIVATE_ID_'+i,slug,name:'PRIVATE_NAME',status:'ACTIVE',version:i+1,
  created_at:1700000000000,updated_at:1800000000000,verify_jwt:i<2,import_map:false,ezbr_sha256:'a'.repeat(64),entrypoint_path:'PRIVATE_PATH'}));
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
async function run({p=project(),before=functions(),after=before,details=before,input={token},responseAt}={}){
  const calls=[];
  const r=await checkEdgeInventory(input,{transport:async(url,options)=>{
    calls.push({url,options});const i=calls.length;
    if(responseAt){const response=responseAt(i);if(response)return response;}
    return json(i===1?p:i===2?before:i===7?after:details[i-3]);
  }});
  return{r,calls};
}
test('Seven fixed GETs observe project and four list/detail/list metadata identities without invoking functions',async()=>{
  const {r,calls}=await run();assert.equal(r.exit_code,0);assert.equal(calls.length,7);
  const base='https://api.supabase.com/v1/projects/'+inventoryRef;
  assert.deepEqual(calls.map(x=>x.url),[base,base+'/functions',...selectedFunctions.map(s=>base+'/functions/'+s),base+'/functions']);
  for(const {options} of calls){assert.equal(options.method,'GET');assert.equal(options.body,undefined);assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer '+token);assert(options.signal);}
  assert.equal(r.selected_functions.length,4);assert.match(r.selected_metadata_SHA256,/^[a-f0-9]{64}$/);
  assert.equal(r.selected_metadata_agreed_across_list_detail_list,true);
  for(const key of ['deployment_source_parity_verified','previous_deployable_artifacts_retained','runtime_JWT_or_service_access_verified','future_installation_target_or_privileges_verified','hosted_acceptance'])assert.equal(r[key],false);
  assert.equal(r.Edge_functions_invoked,0);
});
test('Invalid token, legacy token, newline and caller target overrides cannot issue requests',async()=>{
  for(const input of [{},{token:'sbp_LEGACY_0000000000000000000000'},{token:token+'\n'},{token,url:'https://foreign.invalid'},{token,slug:'arbitrary'},{token,sql:'select 1'}]){
    const {r,calls}=await run({input});assert.equal(r.exit_code,1);assert.equal(calls.length,0);
  }
});
for(const [name,change] of [
  ['wrong project',p=>p.ref='kttkospkblwvguuwnhjj'],['contradictory id',p=>p.id='kttkospkblwvguuwnhjj'],
  ['foreign host',p=>p.database.host='db.foreign.supabase.co'],['inactive project',p=>p.status='INACTIVE']
])test(name+' stops before any function metadata request',async()=>{
  const p=project();change(p);const {r,calls}=await run({p});assert.equal(r.exit_code,1);assert.equal(calls.length,1);
});
test('Legacy id-only project metadata remains bounded to the exact staging identity',async()=>{
  const p=project();delete p.ref;assert.equal((await run({p})).r.exit_code,0);
});
for(const status of [401,403,404,429,500])test('Function-list HTTP '+status+' stops with no retry, invocation or fallback',async()=>{
  const {r,calls}=await run({responseAt:i=>i===2?json({message:token},status):null});
  assert.equal(r.exit_code,1);assert.equal(calls.length,2);assert(!JSON.stringify(r).includes(token));
});
test('Project HTTP denial prevents list requests',async()=>{
  const {r,calls}=await run({responseAt:i=>i===1?json({message:token},403):null});assert.equal(r.exit_code,1);assert.equal(calls.length,1);
});
test('Missing or inactive selected functions require review before detail requests',async()=>{
  for(const before of [functions().slice(1),functions().map((x,i)=>i?x:{...x,status:'REMOVED'})]){
    const {r,calls}=await run({before});assert.equal(r.problem_code,'SELECTED_FUNCTION_MISSING_OR_INACTIVE');assert.equal(calls.length,2);
  }
});
test('An early missing selected function still reports all four presences and the validated total',async()=>{
  const {r,calls}=await run({before:functions().slice(1)});
  assert.equal(r.diagnostic_revision,2);assert.equal(r.exit_code,1);assert.equal(calls.length,2);
  assert.equal(r.problem_code,'SELECTED_FUNCTION_MISSING_OR_INACTIVE');assert.equal(r.observed_total_function_count,3);
  assert.deepEqual(r.function_list_observations,[{observation:'BEFORE',total_functions:3,
    selected_functions:selectedFunctions.map((slug,i)=>({slug,present:i!==0,status_is_ACTIVE:i!==0}))}]);
  assert.deepEqual(r.selected_functions,[]);assert.equal(r.selected_metadata_agreed_across_list_detail_list,false);
});
test('Mixed missing and non-active functions retain only fixed names and booleans on refusal',async()=>{
  const before=functions().slice(1);before[0].status=token;
  before.push({slug:'private-unrelated-function',name:token,id:token,status:token});
  const {r,calls}=await run({before});assert.equal(r.exit_code,1);assert.equal(calls.length,2);
  const observed=r.function_list_observations[0].selected_functions;
  assert.deepEqual(observed.map(x=>[x.present,x.status_is_ACTIVE]),[[false,false],[true,false],[true,true],[true,true]]);
  assert.equal(r.observed_total_function_count,4);
  for(const privateText of [token,'private-unrelated-function','PRIVATE_ID_','PRIVATE_NAME','PRIVATE_PATH'])assert(!JSON.stringify(r).includes(privateText));
});
test('A structurally invalid list does not publish a misleading presence observation or count',async()=>{
  for(const before of [{data:functions()},[...functions(),functions()[0]]]){
    const {r}=await run({before});assert.equal(r.exit_code,1);assert.equal(r.problem_code,'FUNCTION_METADATA_SHAPE_REVIEW_REQUIRED');
    assert.deepEqual(r.function_list_observations,[]);assert.equal(r.observed_total_function_count,null);
  }
});
test('A function disappearing at the final list retains distinct before and after evidence without acceptance',async()=>{
  const {r,calls}=await run({after:functions().slice(0,3)});assert.equal(r.exit_code,1);assert.equal(calls.length,7);
  assert.equal(r.problem_code,'SELECTED_FUNCTION_MISSING_OR_INACTIVE');
  assert.deepEqual(r.function_list_observations.map(x=>x.observation),['BEFORE','AFTER']);
  assert.equal(r.function_list_observations[0].selected_functions[3].present,true);
  assert.equal(r.function_list_observations[1].selected_functions[3].present,false);
  assert.equal(r.selected_metadata_agreed_across_list_detail_list,false);assert.deepEqual(r.selected_functions,[]);
});
test('Duplicate or malformed slugs, wrapped arrays and unbounded inventories are refused',async()=>{
  for(const before of [[...functions(),functions()[0]],[...functions(),{slug:'../arbitrary'}],{data:functions()},Array.from({length:257},(_,i)=>({slug:'extra-'+i}))])assert.equal((await run({before})).r.exit_code,1);
});
test('Missing or invalid version, timestamps, JWT type, identity and bundle hash are refused',async()=>{
  for(const [key,value]of [['version',0],['version','1'],['updated_at',-1],['created_at',null],['verify_jwt','false'],['id',''],['ezbr_sha256',token],['import_map','false']]){
    const before=functions();before[0][key]=value;assert.equal((await run({before})).r.problem_code,'FUNCTION_METADATA_SHAPE_REVIEW_REQUIRED');
  }
});
test('Absent optional provider hash and import-map marker are explicit nulls, not invented evidence',async()=>{
  const before=functions();for(const f of before){delete f.ezbr_sha256;delete f.import_map;}
  const {r}=await run({before});assert.equal(r.exit_code,0);assert(r.selected_functions.every(f=>f.provider_bundle_SHA256===null&&f.import_map===null));
});
test('List/detail mismatch stops and does not publish a mixed selected inventory',async()=>{
  const details=functions();details[0].version++;const {r,calls}=await run({details});
  assert.equal(r.problem_code,'OBSERVED_FUNCTION_METADATA_CHANGED');assert.equal(calls.length,3);assert.deepEqual(r.selected_functions,[]);
});
test('Final-list drift of any selected metadata refuses observed-window agreement',async()=>{
  for(const [key,value]of [['version',5],['verify_jwt',false],['id','NEW_PRIVATE_ID'],['ezbr_sha256','b'.repeat(64)],['updated_at',1800000000001]]){
    const after=functions();after[0][key]=value;const {r,calls}=await run({after});assert.equal(r.problem_code,'OBSERVED_FUNCTION_METADATA_CHANGED');assert.equal(calls.length,7);assert.deepEqual(r.selected_functions,[]);
  }
});
test('Unrelated functions are counted but their names and metadata are not exposed',async()=>{
  const before=[...functions(),{slug:'unrelated-function',name:token,secret:token}];
  const {r}=await run({before});assert.equal(r.exit_code,0);assert.equal(r.observed_total_function_count,5);assert(!JSON.stringify(r).includes('unrelated-function'));assert(!JSON.stringify(r).includes(token));
});
test('Provider paths, names, IDs, extra fields and exceptions stay out of receipts',async()=>{
  const {r}=await run();for(const text of [token,'PRIVATE_PATH','PRIVATE_NAME','PRIVATE_ID_'])assert(!JSON.stringify(r).includes(text));
  const failed=await checkEdgeInventory({token},{transport:async()=>{throw Error(token);}});assert.equal(failed.exit_code,1);assert(!JSON.stringify(failed).includes(token));
});
test('Redirects, foreign response URLs, wrong content types, invalid JSON and oversized streams stop',async()=>{
  const redirect=json(project());Object.defineProperty(redirect,'redirected',{value:true});
  const foreign=json(project());Object.defineProperty(foreign,'url',{value:'https://foreign.invalid'});
  for(const response of [redirect,foreign,new Response('HTML'),new Response('{',{headers:{'content-type':'application/json'}}),json({large:'x'.repeat(262145)})]){
    const {r,calls}=await run({responseAt:i=>i===1?response:null});assert.equal(r.exit_code,1);assert.equal(calls.length,1);
  }
});
test('Detail failure stops at the selected request and no remaining GETs run',async()=>{
  const {r,calls}=await run({responseAt:i=>i===4?json({error:token},403):null});assert.equal(r.exit_code,1);assert.equal(calls.length,4);
});
test('Private CLI preflight is token-free; public flags, extra arguments and oversized stdin are refused',()=>{
  const file=fileURLToPath(new URL('../scripts/check-fr-2-email-edge-inventory.mjs',import.meta.url));
  const call=(args,input)=>spawnSync(process.execPath,[file,...args],{input,encoding:'utf8',timeout:5000});
  const p=call(['--private-parent-pipe'],'{"preflight":true}');assert.equal(p.status,0);assert.equal(JSON.parse(p.stdout).requests_attempted,0);
  for(const [args,input]of [[['--deploy'],'{}'],[['--private-parent-pipe','extra'],'{}'],[['--private-parent-pipe'],'x'.repeat(8193)],[['--private-parent-pipe'],'{']])assert.equal(call(args,input).status,1);
});
