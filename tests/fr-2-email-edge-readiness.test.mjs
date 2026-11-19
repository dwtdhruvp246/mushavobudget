import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {checkEdgeReadiness,readinessRef,readinessFunctions,customNames,accessBooleanKeys,accessQueryURL,aggregateQueryURL} from '../scripts/check-fr-2-email-edge-readiness.mjs';
const token='sbp_fc_SYNTHETIC_PRIVATE_TOKEN_20261021_00000000';
const project=()=>({id:readinessRef,ref:readinessRef,status:'ACTIVE_HEALTHY',database:{host:'db.'+readinessRef+'.supabase.co'}});
const fn=(slug='private-unrelated-function')=>({id:'PRIVATE_FUNCTION_ID',slug,status:'ACTIVE',version:2,verify_jwt:true,created_at:1700000000000,updated_at:1800000000000,name:'PRIVATE_NAME',entrypoint_path:'PRIVATE_PATH'});
const secrets=()=>customNames.map(name=>({name,value:token,updated_at:'PRIVATE_UPDATED_AT'}));
const access=()=>Object.assign(Object.fromEntries(accessBooleanKeys.map(k=>[k,true])),{transaction_read_only:'on',cron_job_rls_enabled:false,cron_job_force_rls:false,role_bypasses_job_rls:false});
const aggregate=()=>({read_only_role:true,transaction_read_only:'on',visible_jobs:3,visible_active_jobs:2,visible_active_FX_text_matches:1,all_rows_visible_under_selected_rls_controls:true,indirect_dynamic_or_external_callers_excluded:false});
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json'}});
async function run({p=project(),functions=[fn()],secretRows=secrets(),a=access(),g=aggregate(),input={token},responseAt}={}){
 const calls=[];const r=await checkEdgeReadiness(input,{transport:async(url,options)=>{
  calls.push({url,options});const i=calls.length;const override=responseAt?.(i);if(override)return override;
  return i===1?json(p):i===2?json(functions):i===3?json(secretRows):i===4?json([{edge_scheduler_access:a}],201):json([{edge_scheduler_aggregates:g}],201);
 }});return{r,calls};
}
test('Only three fixed GETs and at most two pinned dedicated read-only POSTs collect observations',async()=>{
 const {r,calls}=await run();assert.equal(r.exit_code,0);assert.equal(calls.length,5);const base='https://api.supabase.com/v1/projects/'+readinessRef;
 assert.deepEqual(calls.map(c=>c.url),[base,base+'/functions',base+'/secrets',base+'/database/query/read-only',base+'/database/query/read-only']);
 assert.deepEqual(calls.map(c=>c.options.method),['GET','GET','GET','POST','POST']);
 for(const c of calls){assert.equal(c.options.redirect,'error');assert.equal(c.options.headers.Authorization,'Bearer '+token);assert(c.options.signal);}
 assert.deepEqual(JSON.parse(calls[3].options.body),{query:await readFile(accessQueryURL,'utf8')});assert.deepEqual(JSON.parse(calls[4].options.body),{query:await readFile(aggregateQueryURL,'utf8')});
 assert.equal(r.selected_functions_still_absent,true);assert.equal(r.all_six_custom_names_listed,true);assert.equal(r.readiness_approved,false);assert.equal(r.hosted_acceptance,false);assert.equal(r.scheduler_full_invocation_graph_or_external_callers_verified,false);
});
test('Tokens, caller URLs, SQL and extra fields are refused before a request',async()=>{
 for(const input of [{},{token:'sbp_LEGACY_PRIVATE_TOKEN_000000000000'},{token:token+'\n'},{token,url:'https://foreign.invalid'},{token,query:'drop schema public cascade'}]){const {r,calls}=await run({input});assert.equal(r.exit_code,1);assert.equal(calls.length,0);}
});
for(const [title,change]of [['wrong ref',p=>p.ref='kttkospkblwvguuwnhjj'],['contradictory id',p=>p.id='kttkospkblwvguuwnhjj'],['foreign host',p=>p.database.host='db.foreign.supabase.co'],['inactive project',p=>p.status='INACTIVE']])test(title+' stops before any configuration or scheduler request',async()=>{
 const p=project();change(p);const {r,calls}=await run({p});assert.equal(r.exit_code,1);assert.equal(calls.length,1);
});
test('Legacy id-only identity remains pinned to staging',async()=>{const p=project();delete p.ref;assert.equal((await run({p})).r.exit_code,0);});
for(const status of [401,403,404,429,500])test('Configuration HTTP '+status+' stops without retries or write fallback',async()=>{
 const {r,calls}=await run({responseAt:i=>i===3?json({error:token},status):null});assert.equal(r.exit_code,1);assert.equal(calls.length,3);assert(!JSON.stringify(r).includes(token));
});
test('Function metadata projection is deterministic and arbitrary names, IDs, paths and statuses stay private',async()=>{
 const functions=[fn(),{...fn('second-private-function'),id:'SECOND_PRIVATE',status:token}];const a=(await run({functions})).r,b=(await run({functions:functions.slice().reverse()})).r;
 assert.equal(a.exit_code,0);assert.equal(a.other_function_metadata_SHA256,b.other_function_metadata_SHA256);assert.equal(a.other_function_count,2);
 for(const s of [token,'private-unrelated-function','second-private-function','PRIVATE_FUNCTION_ID','PRIVATE_PATH','PRIVATE_NAME'])assert(!JSON.stringify(a).includes(s));
 const changed=functions.map((f,i)=>i?f:{...f,version:3});assert.notEqual((await run({functions:changed})).r.other_function_metadata_SHA256,a.other_function_metadata_SHA256);
});
test('A selected function appearing is explicitly reported without becoming deployment approval',async()=>{
 const {r}=await run({functions:[fn(),fn(readinessFunctions[1])]});assert.equal(r.exit_code,0);assert.equal(r.selected_functions_still_absent,false);assert.equal(r.selected_function_presence[1].present,true);assert.equal(r.readiness_approved,false);
});
test('Malformed or duplicate function records stop before secret metadata',async()=>{
 for(const functions of [[fn(),fn()],{data:[fn()]},[{...fn(),version:'2'}]]){const {r,calls}=await run({functions});assert.equal(r.exit_code,1);assert.equal(calls.length,2);}
});
test('Missing custom names are retained as booleans; platform environment and values remain unverified',async()=>{
 const {r}=await run({secretRows:[]});assert.equal(r.exit_code,0);assert.equal(r.all_six_custom_names_listed,false);assert(r.custom_configuration_names.every(x=>x.listed===false));assert.equal(r.platform_environment_or_secret_values_verified,false);
});
test('Opaque configuration value fields and unrelated names are neither used in the receipt nor hashed',async()=>{
 const secretRows=[...secrets(),{name:'PRIVATE_UNRELATED_NAME',value:token}];const a=(await run({secretRows})).r;
 const b=(await run({secretRows:secretRows.map(x=>({...x,value:{private:'DIFFERENT_PRIVATE_VALUE'}}))})).r;
 assert.equal(a.exit_code,0);assert.deepEqual(a.custom_configuration_names,b.custom_configuration_names);assert(!JSON.stringify(a).includes(token));assert(!JSON.stringify(a).includes('PRIVATE_UNRELATED_NAME'));assert.equal(a.secret_value_fields_used_printed_or_saved,false);
});
test('Duplicate or malformed secret names stop before the SQL request',async()=>{
 for(const secretRows of [[...secrets(),secrets()[0]],[{name:'INVALID-NAME',value:token}],{data:secrets()}]){const {r,calls}=await run({secretRows});assert.equal(r.exit_code,1);assert.equal(calls.length,3);}
});
test('Absent table, wrong table shape or insufficient grants skip aggregate SQL without reporting zero jobs',async()=>{
 for(const key of ['cron_job_relation_present','cron_job_table_shape_matches','cron_schema_usage','cron_job_table_select']){const a=access();a[key]=false;const {r,calls}=await run({a});assert.equal(r.exit_code,0);assert.equal(calls.length,4);assert.equal(r.scheduler_aggregates,null);assert.equal(r.scheduler_rows_aggregated,false);assert.equal(r.readiness_approved,false);}
});
test('RLS-filtered zero visible jobs remain explicitly limited rather than full scheduler acceptance',async()=>{
 const g=aggregate();g.visible_jobs=g.visible_active_jobs=g.visible_active_FX_text_matches=0;g.all_rows_visible_under_selected_rls_controls=false;
 const {r}=await run({g});assert.equal(r.exit_code,0);assert.equal(r.scheduler_observation_state,'VISIBLE_AGGREGATES_RLS_LIMITED');assert.equal(r.scheduler_full_invocation_graph_or_external_callers_verified,false);
});
test('Role or transaction mismatch at either SQL response refuses collection completion',async()=>{
 for(const key of ['a','g'])for(const [name,value]of [['read_only_role',false],['transaction_read_only','off']]){const v=key==='a'?access():aggregate();v[name]=value;const {r}=await run({[key]:v});assert.equal(r.problem_code,'READ_ONLY_CONTEXT_REVIEW_REQUIRED');assert.equal(r.exit_code,1);}
});
test('Unexpected SQL keys, types, counts or graph-completeness assertions are refused',async()=>{
 for(const g of [{...aggregate(),visible_jobs:-1},{...aggregate(),visible_active_jobs:4},{...aggregate(),visible_active_FX_text_matches:'1'},{...aggregate(),indirect_dynamic_or_external_callers_excluded:true},{...aggregate(),private:token}])assert.equal((await run({g})).r.exit_code,1);
 const a=access();a.cron_job_table_select='true';assert.equal((await run({a})).r.exit_code,1);
});
test('Read-only SQL HTTP refusal has no general-query fallback',async()=>{
 const {r,calls}=await run({responseAt:i=>i===4?json({error:token},403):null});assert.equal(r.exit_code,1);assert.equal(calls.length,4);assert.equal(r.general_SQL_or_write_endpoint_used,false);
});
test('Redirects, foreign response URLs, invalid content type, JSON and oversized streams stop safely',async()=>{
 const redirect=json(project());Object.defineProperty(redirect,'redirected',{value:true});const foreign=json(project());Object.defineProperty(foreign,'url',{value:'https://foreign.invalid'});
 for(const response of [redirect,foreign,new Response('HTML'),new Response('{',{headers:{'content-type':'application/json'}}),json({x:'x'.repeat(262145)})]){const {r,calls}=await run({responseAt:i=>i===1?response:null});assert.equal(r.exit_code,1);assert.equal(calls.length,1);}
});
test('Provider exceptions never expose their private text',async()=>{
 const r=await checkEdgeReadiness({token},{transport:async()=>{throw Error(token);}});assert.equal(r.exit_code,1);assert(!JSON.stringify(r).includes(token));
});
test('Private CLI preflight needs no token and unsupported invocation cannot contact providers',()=>{
 const file=fileURLToPath(new URL('../scripts/check-fr-2-email-edge-readiness.mjs',import.meta.url));
 for(const [args,input,status]of [[['--private-parent-pipe'],'{"preflight":true}',0],[['--deploy'],'{}',1],[['--private-parent-pipe','extra'],'{}',1],[['--private-parent-pipe'],'x'.repeat(8193),1]]){
  const r=spawnSync(process.execPath,[file,...args],{input,encoding:'utf8',timeout:5000});assert.equal(r.status,status);assert.equal(JSON.parse(r.stdout).requests_attempted,0);
 }
});
