import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {stage,acknowledgement,installationSQL,installQuarantined} from '../scripts/install-fr-2-email-batch-h.mjs';
import {reviewChecks} from '../scripts/review-fr-2-email-batch-f.mjs';
import {stagingRef,handoffSQL} from '../scripts/lib/email-registration-handoff-sql.mjs';
import {versionReference} from '../scripts/lib/email-registration-catalog-versions.mjs';
import {localDatabase,root} from '../scripts/lib/stage-3-local-db.mjs';
import {prepareReviewedEmailPlatform} from '../scripts/lib/email-reviewed-platform-fixture.mjs';
const base=JSON.parse(await readFile(root+'/docs/security-audit/security-fr-2-email-batch-f-private-catalog.json','utf8'));
const input={token:'sbp_fc'+'SYNTHETIC_ONLY_'.repeat(3),acknowledgement};
const project={ref:stagingRef,status:'ACTIVE_HEALTHY',database:{host:'db.'+stagingRef+'.supabase.co'}};
const context={privileged_origin:true,transaction_read_only:'on'};
function bodies(major=17){
 const catalog=versionReference(base,major*10000+11),before=[{registration_review:{context,checks:Object.fromEntries(reviewChecks.map(x=>[x,x!=='email_backend_installer_and_guards_absent'])),server_version_num:major*10000+11,application_guards_absent:true,private_catalog:catalog}}];
 return [project,before,[{registration_control:{context,state:{row_count:1,registered_only:true}}}],before,project,
 [{quarantined_installation:{result:'STAGING_EMAIL_INSTALLED_QUARANTINED',target_independently_verified:false,guarded_RPCs:148,restrictive_policies:82,hosted_acceptance:false}}],
 [{quarantined_readback:{context,server_version_num:major*10000+11,installer_catalog:catalog,control:{rows:1,quarantined:true},guarded_RPCs:148,restrictive_policies:82,public_guard_policies:81,storage_guard_policies:1,backend_tables:5,backend_tables_forced_RLS:5,backend_schema_API_denied:true}}],project];
}
function mock({major=17,fail,change}={}){
 const data=bodies(major),calls=[];
 return {calls,transport:async(url,options)=>{const i=calls.length;calls.push({url,options});if(i===fail)throw Error('PRIVATE_PROVIDER_BODY');return change?.(i,structuredClone(data[i]))??Response.json(data[i],{status:options.method==='GET'?200:201});}};
}
test('All supported versions use five fresh read-only checks, one fixed installation and independent readback/target checks',async()=>{
 for(const major of [15,16,17,18]){const m=mock({major});const r=await installQuarantined(input,m);assert.equal(r.exit_code,0);assert.equal(r.activation_POST_requests,1);assert.equal(r.actual_hosted_requests,8);assert.equal(r.activation_write_outcome_uncertain,false);assert.equal(r.quarantined_committed_state_observed,true);assert.equal(r.resume_or_quarantine_recovery_invoked,false);
  const sql=await installationSQL();assert.equal(JSON.parse(m.calls[5].options.body).query,sql.write);assert.equal(JSON.parse(m.calls[6].options.body).query,sql.readback);
  for(const c of m.calls){assert(c.url.startsWith('https://api.supabase.com/v1/projects/'+stagingRef));assert.equal(c.options.redirect,'error');assert(c.options.signal);}
  assert(!JSON.stringify(r).includes(input.token));}
});
test('Missing acknowledgement, malformed token, arbitrary URL/query or extra input fails before provider access',async()=>{
 for(const x of [{},{token:input.token},{...input,acknowledgement:'RESUME'},{...input,token:'bad'},{...input,url:'https://foreign.invalid'},{...input,query:'DROP TABLE x'}]){const m=mock();assert.equal((await installQuarantined(x,m)).exit_code,1);assert.equal(m.calls.length,0);}
});
test('All eight transport failure positions refuse success and never retry the installation',async()=>{
 for(let fail=0;fail<8;fail++){const m=mock({fail});const r=await installQuarantined(input,m);assert.equal(r.exit_code,1);assert.equal(r.activation_POST_requests,fail<5?0:1);assert(!JSON.stringify(r).includes('PRIVATE_PROVIDER_BODY'));
  const writes=m.calls.filter(c=>c.options.body&&JSON.parse(c.options.body).query.startsWith('BEGIN;'));assert.equal(writes.length,fail<5?0:1);
  if(fail===5){assert.equal(r.independent_readback_attempted,true);assert.equal(r.quarantined_committed_state_observed,true);assert.equal(r.activation_write_outcome_uncertain,false);}
  if(fail===6)assert.equal(r.activation_write_outcome_uncertain,true);
 }
});
test('HTTP denial of installation still receives readback without a second write',async()=>{
 const m=mock({change:i=>i===5?Response.json({private:'not printed'},{status:403}):undefined});const r=await installQuarantined(input,m);assert.equal(r.exit_code,1);assert.equal(r.activation_HTTP_accepted,false);assert.equal(r.independent_readback_attempted,true);assert.equal(m.calls.length,8);assert(!JSON.stringify(r).includes('not printed'));
});
test('An existing ACTIVE state or any dormant source drift blocks installation in the fresh review',async()=>{
 for(const type of ['mode','source']){const m=mock({change:(i,x)=>{if(type==='mode'&&i===2)x[0].registration_control.state.registered_only=false;else if(type==='source'&&i===1)x[0].registration_review.private_catalog.functions[0][14]='f'.repeat(64);else return;return Response.json(x,{status:201});}});const r=await installQuarantined(input,m);assert.equal(r.exit_code,1);assert.equal(r.activation_POST_requests,0);}
});
test('Wrong control mode, stamp, guards, policy count, RLS, API schema access, version or installer source refuses acceptance',async()=>{
 for(const key of ['control','guarded_RPCs','restrictive_policies','public_guard_policies','storage_guard_policies','backend_tables','backend_tables_forced_RLS','backend_schema_API_denied','server_version_num','installer_catalog','context']){
  const m=mock({change:(i,x)=>{if(i!==6)return;const r=x[0].quarantined_readback;if(key==='control')r.control.quarantined=false;else if(key==='installer_catalog')r.installer_catalog.functions[0][14]='a'.repeat(64);else if(key==='context')r.context.transaction_read_only='off';else r[key]=key==='backend_schema_API_denied'?false:0;return Response.json(x,{status:201});}});
  const r=await installQuarantined(input,m);assert.equal(r.exit_code,1,key);assert.equal(r.quarantined_committed_state_observed,false);assert.equal(r.activation_write_outcome_uncertain,true);assert.equal(r.activation_POST_requests,1);
 }
});
test('Post-install target mismatch refuses completion without undoing or repeating the observed installation',async()=>{
 const m=mock({change:(i,x)=>i===7?Response.json({...x,ref:'kttkospkblwvguuwnhjj'},{status:200}):undefined});const r=await installQuarantined(input,m);assert.equal(r.exit_code,1);assert.equal(r.quarantined_committed_state_observed,true);assert.equal(r.activation_write_outcome_uncertain,false);assert.equal(r.post_target_metadata_matched,false);
});
test('Malformed, oversized, redirected and unexpected install/readback responses are bounded and redacted',async()=>{
 const variants=[()=>new Response('PRIVATE_NON_JSON',{status:201,headers:{'content-type':'application/json'}}),()=>new Response('x'.repeat(131073),{status:201,headers:{'content-type':'application/json'}}),()=>Response.json([{wrong:'PRIVATE_FIELD'}],{status:201}),()=>Response.redirect('https://foreign.invalid',302)];
 for(const variant of variants){const m=mock({change:i=>i===6?variant():undefined});const r=await installQuarantined(input,m);assert.equal(r.exit_code,1);assert.equal(r.independent_readback_attempted,true);assert(!JSON.stringify(r).includes('PRIVATE_'));
 }
});
test('Private CLI preflight stays offline and extra executable arguments are refused',()=>{
 const entry=root+'/scripts/install-fr-2-email-batch-h.mjs';for(const args of [[entry,'--private-parent-pipe'],[entry,'--private-parent-pipe','--Resume']]){const p=spawnSync(process.execPath,args,{input:'{"preflight":true}',encoding:'utf8'});const x=JSON.parse(p.stdout);assert.equal(x.stage_step,stage);assert.equal(x.actual_hosted_requests,0);assert.equal(p.status,args.length===2?0:1);assert.equal(p.stderr,'');}
});
test('Actual registered SQL refuses source drift at write time, installs 148/82 quarantined, reads back and refuses a second installation',async()=>{
 const {db}=await localDatabase(process.env.MUSHAVO_EMAIL_UI_PGLITE,{preparePlatform:prepareReviewedEmailPlatform});
 try{
  await db.exec((await handoffSQL()).write);const sql=await installationSQL();
  const original=(await db.query("select pg_get_functiondef('mushavo_email_install.activate()'::regprocedure) value")).rows[0].value;
  await db.exec(original.replace('AS $function$','AS $function$\n'));
  await assert.rejects(db.exec(sql.write),/EMAIL_H_PINNED_DORMANT_CATALOG_REQUIRED/);await db.exec('rollback');
  assert.equal((await db.query("select to_regnamespace('mushavo_email_auth') value")).rows[0].value,null);await db.exec(original);
  const transport=async(url,options)=>{if(options.method==='GET')return Response.json(project,{status:200});const q=JSON.parse(options.body).query;return Response.json((await db.exec(q)).flatMap(x=>x.rows),{status:201});};
  const r=await installQuarantined(input,{transport});assert.equal(r.exit_code,0,JSON.stringify(r));assert.equal(r.guarded_RPCs,148);assert.equal(r.restrictive_policies,82);assert.equal(r.backend_forced_RLS_tables,5);
  assert.equal((await db.query('select mode from mushavo_email_install.rollout_control')).rows[0].mode,'QUARANTINED');
  const again=await installQuarantined(input,{transport});assert.equal(again.exit_code,1);assert.equal(again.activation_POST_requests,0);
  await db.exec("BEGIN;SET LOCAL mushavo.email_rollout_project='"+stagingRef+"';SET LOCAL mushavo.email_rollout_action='QUARANTINE_STAGING_EMAIL';SELECT mushavo_email_install.quarantine();ROLLBACK;");
  const rb=(await db.exec(sql.readback)).flatMap(x=>x.rows)[0].quarantined_readback;assert.deepEqual(rb.control,{rows:1,quarantined:true});
 }finally{await db.close();}
});

test('Provider strings in numeric readback fields are refused before receipt assignment',async()=>{
 const m=mock({change:(i,x)=>{if(i!==6)return;x[0].quarantined_readback.guarded_RPCs='PRIVATE_PROVIDER_VALUE';return Response.json(x,{status:201});}});
 const r=await installQuarantined(input,m);assert.equal(r.exit_code,1);assert.equal(r.guarded_RPCs,0);assert(!JSON.stringify(r).includes('PRIVATE_PROVIDER_VALUE'));
});
