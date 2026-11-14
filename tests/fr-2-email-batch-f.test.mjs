import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {registerStaging,stage,acknowledgement,checkNames} from '../scripts/register-fr-2-email-batch-f.mjs';
import {handoffSQL,stagingRef} from '../scripts/lib/email-registration-handoff-sql.mjs';
import {localDatabase,root} from '../scripts/lib/stage-3-local-db.mjs';
import {prepareReviewedEmailPlatform} from '../scripts/lib/email-reviewed-platform-fixture.mjs';
const sql=await handoffSQL();
const expected=JSON.parse(await readFile(root+'/docs/security-audit/security-fr-2-email-batch-f-private-catalog.json','utf8'));
const input={token:'sbp_fc'+'SYNTHETIC_ONLY_'.repeat(3),acknowledgement};
const context={privileged_origin:true,transaction_read_only:'on'};
const checks=installed=>Object.fromEntries(checkNames.map(x=>[x,x==='email_backend_installer_and_guards_absent'?!installed:true]));
const project={ref:stagingRef,status:'ACTIVE_HEALTHY',database:{host:'db.'+stagingRef+'.supabase.co'}};
const reply=(data,status=201)=>Response.json(data,{status});
const pre=[{registration_preflight:{context,checks:checks(false)}}];
const post=[{registration_readback:{context,checks:checks(true),private_catalog:expected}}];
const control=[{registration_control:{context,state:{row_count:1,registered_only:true}}}];
function mock({failure,change}={}){
 const calls=[];const bodies=[project,pre,[],post,control,project];
 const transport=async(url,options)=>{const i=calls.length;calls.push({url,options});
  if(i===failure)throw Error('SENSITIVE_UNTRUSTED_PROVIDER_TEXT');
  return change?.(i,bodies[i],options)??reply(bodies[i],options.method==='GET'?200:201);
 };return {calls,transport};
}
test('Fixed staging transport registers exactly once and requires separate catalog/control/target readbacks',async()=>{
 const m=mock();const r=await registerStaging(input,m);assert.equal(r.exit_code,0);assert.equal(r.stage_step,stage);
 assert.equal(m.calls.length,6);assert.equal(r.registration_POST_requests,1);assert.equal(r.registration_committed_state_observed,true);
 assert.equal(r.activation_or_resume_or_quarantine_invoked,false);assert.equal(r.hosted_acceptance,false);
 for(const c of m.calls){assert(c.url==='https://api.supabase.com/v1/projects/'+stagingRef||c.url==='https://api.supabase.com/v1/projects/'+stagingRef+'/database/query');assert.equal(c.options.redirect,'error');assert(c.options.signal);}
 const queries=m.calls.filter(c=>c.options.method==='POST').map(c=>JSON.parse(c.options.body));
 assert.deepEqual(queries.map(x=>x.query),[sql.preflight,sql.write,sql.readback,sql.control]);assert(queries.every(x=>x.read_only===false));
 assert(!JSON.stringify(r).includes(input.token));
});
test('Unspecified write-response JSON shape does not substitute for exact independent readback',async()=>{
 const m=mock({change:(i)=>i===2?reply({opaque_provider_shape:true}):undefined});assert.equal((await registerStaging(input,m)).exit_code,0);
});
test('Missing acknowledgement, legacy tokens, injected SQL/URL and extra input are refused before any request',async()=>{
 for(const value of [{},{...input,acknowledgement:'ACTIVATE'},{...input,token:'sbp_legacy_secret'},{...input,query:'select 1'},{...input,url:'https://example.invalid'}]){
  const m=mock();const r=await registerStaging(value,m);assert.equal(r.exit_code,1);assert.equal(m.calls.length,0);
 }
});
test('Wrong staging identity, database host, project state or contradictory id prevents SQL',async()=>{
 for(const data of [{...project,ref:'kttkospkblwvguuwnhjj'},{...project,id:'kttkospkblwvguuwnhjj'},{...project,database:{host:'wrong.invalid'}},{...project,status:'PAUSED'}]){
  const m=mock({change:i=>i===0?reply(data,200):undefined});const r=await registerStaging(input,m);assert.equal(r.exit_code,1);assert.equal(m.calls.length,1);assert.equal(r.registration_POST_requests,0);
 }
});
test('Read-only provider role or wrong transaction context cannot authorize registration',async()=>{
 for(const value of [{privileged_origin:false,transaction_read_only:'on'},{privileged_origin:true,transaction_read_only:'off'}]){
  const m=mock({change:i=>i===1?reply([{registration_preflight:{context:value,checks:checks(false)}}]):undefined});const r=await registerStaging(input,m);assert.equal(r.problem_code,'PRIVILEGED_READ_ONLY_CONTEXT_REQUIRED');assert.equal(r.registration_POST_requests,0);
 }
});
test('Every selected baseline failure blocks the write, including prior installation and hook drift',async()=>{
 for(const name of checkNames){const c=checks(false);c[name]=false;const m=mock({change:i=>i===1?reply([{registration_preflight:{context,checks:c}}]):undefined});const r=await registerStaging(input,m);assert.equal(r.exit_code,1);assert.equal(r.registration_POST_requests,0);}
});
test('Every transport failure stops without retry; attempted writes always trigger an independent readback',async()=>{
 for(let i=0;i<6;i++){const m=mock({failure:i});const r=await registerStaging(input,m);assert.equal(r.exit_code,1);assert(r.registration_POST_requests<=1);assert.equal(r.automatic_write_retry_or_delete_performed,false);assert(!JSON.stringify(r).includes('SENSITIVE_UNTRUSTED_PROVIDER_TEXT'));
  if(i<2)assert.equal(r.registration_POST_requests,0);else assert.equal(r.independent_readback_attempted,true);
  if(i===2){assert.equal(m.calls.length,6);assert.equal(r.registration_committed_state_observed,true);assert.equal(r.registration_write_outcome_uncertain,false);}
  if(i===3||i===4)assert.equal(r.registration_write_outcome_uncertain,true);
 }
});
test('HTTP403 registration is not repeated and is followed by read-only inspection',async()=>{
 const m=mock({change:i=>i===2?reply({message:'PRIVATE_PROVIDER_MESSAGE'},403):undefined});const r=await registerStaging(input,m);
 assert.equal(r.exit_code,1);assert.equal(r.registration_HTTP_accepted,false);assert.equal(r.independent_readback_attempted,true);assert.equal(r.registration_POST_requests,1);assert(!JSON.stringify(r).includes('PRIVATE_PROVIDER_MESSAGE'));
});
test('Catalog source, ACL, owner, function and relation drift each prevent control acceptance',async()=>{
 for(const part of ['functions','schemas','relations','columns','constraints','indexes','policies','triggers','schema_api_access','table_api_access']){
  const x=structuredClone(post);x[0].registration_readback.private_catalog[part]=['CHANGED'];const m=mock({change:i=>i===3?reply(x):undefined});const r=await registerStaging(input,m);assert.equal(r.exit_code,1);assert.equal(r.registered_control_readback,false);assert.equal(m.calls.length,4);
 }
});
test('An active, duplicated, missing or nonregistered private control cannot pass',async()=>{
 for(const state of [{row_count:0,registered_only:false},{row_count:2,registered_only:true},{row_count:1,registered_only:false}]){
  const m=mock({change:i=>i===4?reply([{registration_control:{context,state}}]):undefined});const r=await registerStaging(input,m);assert.equal(r.exit_code,1);assert.equal(r.registration_committed_state_observed,false);
 }
});
test('Post-registration public routine, policy and event-hook drift blocks acceptance',async()=>{
 for(const name of checkNames.filter(x=>x!=='email_backend_installer_and_guards_absent')){
  const data=structuredClone(post);data[0].registration_readback.checks[name]=false;
  const m=mock({change:i=>i===3?reply(data):undefined});assert.equal((await registerStaging(input,m)).exit_code,1);
 }
});
test('Malformed, oversized, redirected and unexpected response shapes are bounded and refused',async()=>{
 for(const response of [new Response('NOT_JSON',{status:201,headers:{'content-type':'application/json'}}),
  reply([{wrong:'shape'}]),new Response('x'.repeat(131073),{status:201,headers:{'content-type':'application/json'}})]){
  const m=mock({change:i=>i===1?response:undefined});const r=await registerStaging(input,m);assert.equal(r.exit_code,1);assert.equal(r.registration_POST_requests,0);
 }
 const m=mock({change:i=>i===0?{...reply(project,200),status:200,redirected:true,url:'https://wrong.invalid'}:undefined});assert.equal((await registerStaging(input,m)).exit_code,1);
});
test('CLI private pipe preflight needs no credentials and rejects malformed/extra arguments safely',()=>{
 const entry=root+'/scripts/register-fr-2-email-batch-f.mjs';
 const run=(args,input)=>spawnSync(process.execPath,[entry,...args],{input,encoding:'utf8',timeout:10000});
 const p=run(['--private-parent-pipe'],'{"preflight":true}');assert.equal(p.status,0);assert.equal(JSON.parse(p.stdout).actual_hosted_requests,0);assert.equal(p.stderr,'');
 for(const [args,data]of [[[],JSON.stringify(input)],[['--private-parent-pipe','--activate'],JSON.stringify(input)],[['--private-parent-pipe'],'PRIVATE_MALFORMED']]){const r=run(args,data);assert.equal(r.status,1);assert(!r.stdout.includes(input.token));assert.equal(r.stderr,'');}
});
const {db}=await localDatabase(process.env.MUSHAVO_EMAIL_UI_PGLITE,{preparePlatform:prepareReviewedEmailPlatform});
test.after(async()=>db.close());
test('Actual SQL preflight has all nine fingerprints and privileged origin inside enforced read-only transaction',async()=>{
 const rows=(await db.exec(sql.preflight)).flatMap(x=>x.rows);assert.deepEqual(rows,pre);
 await assert.rejects(db.exec("BEGIN READ ONLY;create table public.forbidden_readonly(id int);ROLLBACK;"),/read-only transaction/);await db.exec('rollback');
 assert.equal((await db.query("select to_regclass('public.forbidden_readonly') value")).rows[0].value,null);
});
test('Actual registration rechecks late baseline drift and rolls back before creating the installer',async()=>{
 await db.exec('alter table auth.users alter column encrypted_password type text');
 await assert.rejects(db.exec(sql.write),/EMAIL_STAGING_BASELINE_REVIEW_REQUIRED/);await db.exec('rollback');
 assert.equal((await db.query("select to_regnamespace('mushavo_email_install') value")).rows[0].value,null);
 await db.exec('alter table auth.users alter column encrypted_password type varchar(255)');
});
test('Actual one-transaction registration rolls back a late injected failure completely',async()=>{
 const broken=sql.write.slice(0,-'COMMIT;\n'.length)+"DO $fail$ BEGIN RAISE EXCEPTION 'SYNTHETIC_LATE_FAILURE'; END; $fail$;COMMIT;\n";
 await assert.rejects(db.exec(broken),/SYNTHETIC_LATE_FAILURE/);await db.exec('rollback');assert.deepEqual((await db.exec(sql.preflight)).flatMap(x=>x.rows),pre);
});
test('Actual handler and SQL register dormant controls, match pinned private catalog and retain public baseline',async()=>{
 const calls=[];const transport=async(url,options)=>{calls.push({url,options});if(options.method==='GET')return reply(project,200);
  const {query}=JSON.parse(options.body);return reply((await db.exec(query)).flatMap(x=>x.rows));};
 const r=await registerStaging(input,{transport});assert.equal(r.exit_code,0);assert.equal(r.registration_committed_state_observed,true);assert.equal(calls.length,6);
 assert.deepEqual((await db.exec(sql.readback)).flatMap(x=>x.rows),post);assert.deepEqual((await db.exec(sql.control)).flatMap(x=>x.rows),control);
 assert.equal((await db.query("select to_regnamespace('mushavo_email_auth') value")).rows[0].value,null);
 for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("select has_schema_privilege($1,'mushavo_email_install','USAGE') value",[role])).rows[0].value,false);
});
test('Actual registered state prevents a second handler write without invoking any controls',async()=>{
 let writes=0;const transport=async(url,options)=>{if(options.method==='GET')return reply(project,200);const {query}=JSON.parse(options.body);if(query===sql.write)writes++;return reply((await db.exec(query)).flatMap(x=>x.rows));};
 const r=await registerStaging(input,{transport});assert.equal(r.exit_code,1);assert.equal(writes,0);assert.equal(r.registration_POST_requests,0);assert.equal(r.selected_nine_baseline_checks_passed,false);
});
