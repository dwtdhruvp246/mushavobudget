import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {reviewRegistration,reviewSQL,reviewChecks,reviewStage} from '../scripts/review-fr-2-email-batch-f.mjs';
import {versionReference,compareCatalog} from '../scripts/lib/email-registration-catalog-versions.mjs';
import {controlQuery,handoffSQL,stagingRef} from '../scripts/lib/email-registration-handoff-sql.mjs';
import {localDatabase,root} from '../scripts/lib/stage-3-local-db.mjs';
import {prepareReviewedEmailPlatform} from '../scripts/lib/email-reviewed-platform-fixture.mjs';
const base=JSON.parse(await readFile(root+'/docs/security-audit/security-fr-2-email-batch-f-private-catalog.json','utf8'));
const input={token:'sbp_fc'+'SYNTHETIC_ONLY_'.repeat(3)};
const context={privileged_origin:true,transaction_read_only:'on'};
const checks=Object.fromEntries(reviewChecks.map(x=>[x,x!=='email_backend_installer_and_guards_absent']));
const project={ref:stagingRef,database:{host:'db.'+stagingRef+'.supabase.co'},status:'ACTIVE_HEALTHY'};
// Separate synthetic observations of the two documented catalog differences.
function observation(major){const x=structuredClone(base);if(major<18)x.constraints=x.constraints.filter(r=>!r[2].startsWith('NOT NULL '));if(major<17)x.relations.find(r=>r[0]==='rollout_control')[5]='{postgres=arwdDxt/postgres}';return x;}
const catalog=(major=18,projection=observation(major))=>[{registration_review:{context,checks,server_version_num:major*10000+1,application_guards_absent:true,private_catalog:projection}}];
const control=[{registration_control:{context,state:{row_count:1,registered_only:true}}}];
const reply=(body,status=201)=>Response.json(body,{status});
function mock({major=18,projection=observation(major),change,failure}={}){
 const calls=[],eligible=compareCatalog(base,projection,major*10000+1).version_reference_exact;
 const bodies=eligible?[project,catalog(major,projection),control,catalog(major,projection),project]:[project,catalog(major,projection),catalog(major,projection),project];
 const transport=async(url,options)=>{const i=calls.length;calls.push({url,options});if(i===failure)throw Error('PRIVATE_UPSTREAM_TEXT');return change?.(i,bodies[i])??reply(bodies[i],options.method==='GET'?200:201);};
 return {calls,transport};
}
test('Version-specific references retain exact ACLs, source hashes, attributes and required column NOT NULL flags',()=>{
 for(const major of [15,16,17,18]){const ref=versionReference(base,major*10000+1);assert.deepEqual(ref,observation(major));assert.equal(ref.functions.length,5);assert.deepEqual(ref.columns,base.columns);assert.equal(ref.constraints.length,major<18?6:10);}
 assert.equal(base.constraints.length,10);assert.equal(base.relations[0][5],'{postgres=arwdDxtm/postgres}');
 for(const version of [140000,190000,null,'180001',180000.5])assert.equal(versionReference(base,version),null);
});
test('All four supported major versions can establish current REGISTERED state through five fixed read-only requests',async()=>{
 const query=await reviewSQL();for(const major of [15,16,17,18]){const m=mock({major});const r=await reviewRegistration(input,m);assert.equal(r.exit_code,0);assert.equal(r.current_dormant_registration_state_verified,true);assert.equal(r.original_reference_exact,major===18);assert.equal(r.version_reference_exact,true);assert.equal(r.registration_write_attempts,0);assert.equal(r.activation_or_resume_or_quarantine_invoked,false);assert.equal(m.calls.length,5);
  for(const c of m.calls){assert(c.url==='https://api.supabase.com/v1/projects/'+stagingRef||c.url==='https://api.supabase.com/v1/projects/'+stagingRef+'/database/query');assert.equal(c.options.redirect,'error');assert(c.options.signal);
   if(c.options.method==='POST'){const b=JSON.parse(c.options.body);assert([query,controlQuery].includes(b.query));assert.match(b.query,/^BEGIN TRANSACTION READ ONLY;/);assert.match(b.query,/ROLLBACK;\s*$/);assert.equal(b.read_only,false);}
  }assert(!JSON.stringify(r).includes(input.token));}
});
test('Pre18 constraint rows are not optional when the server reports version18',async()=>{
 const m=mock({major:18,projection:observation(17)});const r=await reviewRegistration(input,m);assert.equal(r.exit_code,1);assert.equal(r.registered_control_verified,false);assert.equal(m.calls.length,4);
 const c=r.catalog_comparison.find(x=>x.section==='constraints');assert.equal(c.differences.filter(x=>x.matching_identity_count===0).length,4);
});
test('MAINTAIN owner ACL differences are version-gated rather than removed from observed metadata',async()=>{
 const x=observation(16);const m=mock({major:17,projection:x});const r=await reviewRegistration(input,m);assert.equal(r.exit_code,1);assert.equal(r.version_reference_exact,false);
 const d=r.catalog_comparison.find(x=>x.section==='relations').differences[0].field_changes[0];assert.equal(d.field,'ACL');assert.equal(d.observed,'OWNER_ONLY_TABLE_WITHOUT_MAINTAIN');
});
test('Every version refuses a nullable required control column even when separate NOT NULL catalog rows are absent',async()=>{
 for(const major of [15,16,17,18])for(const name of ['singleton','target_project','mode','changed_at']){const x=observation(major);x.columns.find(r=>r[1]===name)[4]=false;const m=mock({major,projection:x});assert.equal((await reviewRegistration(input,m)).exit_code,1);assert(!m.calls.some(c=>c.options.body&&JSON.parse(c.options.body).query===controlQuery));}
});
test('Function source, security context, attributes and API grants cannot be explained away as a version difference',async()=>{
 for(const index of [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17]){const x=observation(15);x.functions[0][index]=index===14?'f'.repeat(64):typeof x.functions[0][index]==='boolean'?!x.functions[0][index]:'UNTRUSTED_VALUE';const r=await reviewRegistration(input,mock({major:15,projection:x}));assert.equal(r.exit_code,1);assert.equal(r.registered_control_verified,false);}
});
test('Extra/missing objects, changed owners, RLS, policy, schema or table access remain review-required',async()=>{
 for(const part of Object.keys(base)){const x=observation(17);x[part]=Array.isArray(x[part])?x[part].slice(1):[['UNTRUSTED_EXTRA_OBJECT']];const r=await reviewRegistration(input,mock({major:17,projection:x}));assert.equal(r.exit_code,1);assert.equal(r.registered_control_verified,false);}
});
test('Diagnostic output uses fixed labels, booleans, known ACL profiles and hashes, never raw provider names or definitions',()=>{
 const x=observation(17);x.functions[0][13]='{UNSELECTED_PRIVATE_NAME=X/UNSELECTED_PRIVATE_NAME}';x.constraints[0][2]='UNSELECTED_PRIVATE_DEFINITION';x.indexes.push(['UNSELECTED_PRIVATE_INDEX','UNSELECTED_PRIVATE_DEFINITION']);
 const r=compareCatalog(base,x,170001);const text=JSON.stringify(r);assert(!text.includes('UNSELECTED_PRIVATE'));assert(text.includes('OTHER_OR_UNRECOGNIZED_ACL'));assert(text.includes('VALUE_REDACTED'));assert(r.sections.find(s=>s.section==='indexes').unexpected_identity_count===1);
});
test('Wrong target, host, inactive project and contradictory project identity prevent any SQL',async()=>{
 for(const p of [{...project,ref:'kttkospkblwvguuwnhjj'},{...project,database:{host:'wrong.invalid'}},{...project,status:'PAUSED'},{...project,id:'kttkospkblwvguuwnhjj'}]){const m=mock({change:i=>i===0?reply(p,200):undefined});assert.equal((await reviewRegistration(input,m)).exit_code,1);assert.equal(m.calls.length,1);}
});
test('Unprivileged or non-read-only observed context is refused before private state is read',async()=>{
 for(const value of [{privileged_origin:false,transaction_read_only:'on'},{privileged_origin:true,transaction_read_only:'off'}]){const x=catalog();x[0].registration_review.context=value;const m=mock({change:i=>i===1?reply(x):undefined});const r=await reviewRegistration(input,m);assert.equal(r.exit_code,1);assert.equal(r.private_control_rows_aggregated,false);}
});
test('Any baseline mismatch or installed application guard blocks successful registration acceptance',async()=>{
 for(const key of reviewChecks){const x=catalog();x[0].registration_review.checks={...checks,[key]:!checks[key]};const m=mock({change:(i)=>i===1||i===2?reply(x):i===3?reply(project,200):undefined});const r=await reviewRegistration(input,m);assert.equal(r.exit_code,1);assert.equal(r.registered_control_verified,false);}
 const x=catalog();x[0].registration_review.application_guards_absent=false;const m=mock({change:i=>i===1||i===2?reply(x):i===3?reply(project,200):undefined});assert.equal((await reviewRegistration(input,m)).exit_code,1);
});
test('Active, missing, duplicate or malformed control state never completes acceptance',async()=>{
 for(const state of [{row_count:0,registered_only:false},{row_count:2,registered_only:true},{row_count:1,registered_only:false},{unexpected:true}]){const m=mock({change:i=>i===2?reply([{registration_control:{context,state}}]):undefined});const r=await reviewRegistration(input,m);assert.equal(r.exit_code,1);assert.equal(r.current_dormant_registration_state_verified,false);}
});
test('Source or version changes during the before/after catalog observations are refused',async()=>{
 for(const change of ['source','version']){const after=catalog();if(change==='source')after[0].registration_review.private_catalog.functions[0][14]='e'.repeat(64);else after[0].registration_review.server_version_num=180002;const m=mock({change:i=>i===3?reply(after):undefined});const r=await reviewRegistration(input,m);assert.equal(r.exit_code,1);assert.equal(r.catalog_observations_agreed,false);assert.equal(r.current_dormant_registration_state_verified,false);}
});
test('All five transport failure positions stop without write or retry and redact provider exceptions',async()=>{
 for(let i=0;i<5;i++){const m=mock({failure:i});const r=await reviewRegistration(input,m);assert.equal(r.exit_code,1);assert.equal(m.calls.length,i+1);assert.equal(r.registration_write_attempts,0);assert(!JSON.stringify(r).includes('PRIVATE_UPSTREAM_TEXT'));}
});
test('Missing/malformed token, extra URL/query/acknowledgement or version override never reaches provider',async()=>{
 for(const x of [{},{...input,token:'sbp_legacy'},{...input,url:'https://example.invalid'},{...input,query:'create table x()'},{...input,acknowledgement:'REGISTER'},{...input,version:150000}]){const m=mock();const r=await reviewRegistration(x,m);assert.equal(r.exit_code,1);assert.equal(m.calls.length,0);}
});
test('Malformed, oversized and unexpected response structures are bounded and refused',async()=>{
 for(const response of [new Response('PRIVATE_NOT_JSON',{status:201,headers:{'content-type':'application/json'}}),reply([{wrong:'PRIVATE_TEXT'}]),new Response('x'.repeat(131073),{status:201,headers:{'content-type':'application/json'}})]){const m=mock({change:i=>i===1?response:undefined});const r=await reviewRegistration(input,m);assert.equal(r.exit_code,1);assert(!JSON.stringify(r).includes('PRIVATE_NOT_JSON'));}
});
test('Private CLI pipe preflight has no provider requests; registration arguments are refused',()=>{
 const entry=root+'/scripts/review-fr-2-email-batch-f.mjs';
 const r=spawnSync(process.execPath,[entry,'--private-parent-pipe'],{input:'{"preflight":true}',encoding:'utf8',timeout:10000});assert.equal(r.status,0);assert.equal(JSON.parse(r.stdout).stage_step,reviewStage);assert.equal(JSON.parse(r.stdout).actual_hosted_requests,0);assert.equal(r.stderr,'');
 const bad=spawnSync(process.execPath,[entry,'--private-parent-pipe','--Register'],{input:JSON.stringify(input),encoding:'utf8',timeout:10000});assert.equal(bad.status,1);assert(!bad.stdout.includes(input.token));assert.equal(bad.stderr,'');
});
test('Actual registered database can be reviewed through exact SQL without changing private/public catalogs or mode',async()=>{
 const {db}=await localDatabase(process.env.MUSHAVO_EMAIL_UI_PGLITE,{preparePlatform:prepareReviewedEmailPlatform});
 try{await db.exec((await handoffSQL()).write);const query=await reviewSQL();const before=(await db.exec(query)).flatMap(x=>x.rows);let writes=0;
  const transport=async(url,options)=>{if(options.method==='GET')return reply(project,200);const body=JSON.parse(options.body);if(![query,controlQuery].includes(body.query))writes++;return reply((await db.exec(body.query)).flatMap(x=>x.rows));};
  const r=await reviewRegistration(input,{transport});assert.equal(r.exit_code,0);assert.equal(r.current_dormant_registration_state_verified,true);assert.equal(writes,0);assert.deepEqual((await db.exec(query)).flatMap(x=>x.rows),before);assert.equal((await db.query('select mode from mushavo_email_install.rollout_control')).rows[0].mode,'REGISTERED');
  assert.equal((await db.query("select to_regnamespace('mushavo_email_auth') value")).rows[0].value,null);
 }finally{await db.close();}
});
