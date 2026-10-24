import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {installWindowControls,stage,acknowledgement} from '../scripts/install-fr-2-email-batch-l.mjs';
import {windowHandoffSQL,windowCatalogSQL,windowVersionReference} from '../scripts/lib/email-window-handoff-sql.mjs';
import {windowSources} from '../scripts/lib/email-acceptance-window-source.mjs';
import {installationSQL} from '../scripts/install-fr-2-email-batch-h.mjs';
import {localDatabase,root} from '../scripts/lib/stage-3-local-db.mjs';
import {prepareReviewedEmailPlatform} from '../scripts/lib/email-reviewed-platform-fixture.mjs';
import {handoffSQL,stagingRef} from '../scripts/lib/email-registration-handoff-sql.mjs';
const input={token:'sbp_fc'+'SYNTHETIC_ONLY_'.repeat(3),acknowledgement};
const api='https://api.supabase.com/v1/projects/'+stagingRef;
const expected=kind=>({context:{privileged_origin:true,transaction_read_only:'on'},server_version_num:170011,catalog_kind:kind,control_rows:1,quarantined_stamp_matched:true,predicate_source_matched:true,window_present:kind==='BOUNDED',window_empty:kind==='BOUNDED',guarded_RPCs:148,restrictive_policies:82,backend_forced_RLS_tables:5,private_schema_API_denied:true});
const target=()=>({ref:stagingRef,status:'ACTIVE_HEALTHY',database:{host:'db.'+stagingRef+'.supabase.co'}});
const reply=(data,status=201)=>Response.json(data,{status});
function fake({already=false,fail=-1,change,lost=false,rolledBack=false}={}){
 const calls=[];let installed=already;
 const transport=async(url,options)=>{const i=calls.length;calls.push({url,options});if(i===fail)throw Error('PRIVATE_PROVIDER_SENTINEL');const override=change?.(url,options,i);if(override)return override;
  if(url===api)return reply(target(),200);
  const q=JSON.parse(options.body).query;
  if(q.includes('AS window_installation')){installed=!rolledBack;if(lost)throw Error('PRIVATE_LOST_COMMIT');return reply([{window_installation:{result:'CLOSED_WINDOW_CONTROLS_INSTALLED',mode_change_requested:false}}]);}
  return reply([{window_snapshot:expected(installed?'BOUNDED':'ORIGINAL')}]);
 };return {transport,calls};
}
const privateFree=r=>{for(const x of [input.token,'PRIVATE_PROVIDER_SENTINEL','PRIVATE_LOST_COMMIT','UNTRUSTED_BODY_SENTINEL'])assert(!JSON.stringify(r).includes(x));};
test('Successful five-request upgrade and existing four-request inspection never reopen staging',async()=>{
 for(const already of [false,true]){const m=fake({already});const r=await installWindowControls(input,m);assert.equal(r.exit_code,0,JSON.stringify(r));assert.equal(r.actual_hosted_requests,already?4:5);assert.equal(r.upgrade_write_attempts,already?0:1);assert.equal(r.window_table_empty,true);assert.equal(r.application_access_opened,false);assert.equal(r.committed_mode_change_requests,0);privateFree(r);}
});
test('All five direct transport failure positions are bounded and never retry a write',async()=>{
 for(let fail=0;fail<5;fail++){const m=fake({fail});const r=await installWindowControls(input,m);assert.equal(r.exit_code,1,'position '+fail);assert(r.actual_hosted_requests<=5);assert(r.upgrade_write_attempts<=1);assert.equal(r.automatic_write_retry_performed,false);privateFree(r);}
});
test('A lost write response is resolved by independent exact closed-state readback, without retry',async()=>{
 const m=fake({lost:true});const r=await installWindowControls(input,m);assert.equal(r.exit_code,0);assert.equal(r.upgrade_write_attempts,1);assert.equal(r.upgrade_write_outcome_uncertain,false);assert.equal(r.write_response_problem_code,'NETWORK_REQUIRED');privateFree(r);
});
test('An ORIGINAL readback stops without retry and does not rule out a delayed attempted POST',async()=>{
 const m=fake({rolledBack:true});const r=await installWindowControls(input,m);assert.equal(r.exit_code,1);assert.equal(r.problem_code,'CLOSED_CONTROLS_REQUIRED');assert.equal(r.upgrade_write_outcome_uncertain,true);assert.equal(r.quarantined_catalog_after_verified,true);assert.equal(r.bounded_controls_verified,false);assert.equal(r.upgrade_write_attempts,1);privateFree(r);
});
test('Invalid private input, extra URLs or wrong acknowledgement send no requests',async()=>{
 for(const x of [{},{...input,url:'https://untrusted.invalid'},{...input,token:'bad'},{...input,acknowledgement:'OPEN'}]){const m=fake();const r=await installWindowControls(x,m);assert.equal(r.exit_code,1);assert.equal(m.calls.length,0);privateFree(r);}
});
test('Target/source/context/stamp/guard/window/version drift is rejected before write or success',async()=>{
 for(const key of ['target','context','stamp','guards','window','version','shape']){let seen=0;const m=fake({change:(url,options)=>{
  if(key==='target'&&url===api)return reply({...target(),database:{host:'db.kttkospkblwvguuwnhjj.supabase.co'}},200);
  if(url!==api&&JSON.parse(options.body).query.includes('AS window_snapshot')){
   const after=seen++>0,x=expected(after?'BOUNDED':'ORIGINAL');
   if(key==='context')x.context.transaction_read_only='off';if(key==='stamp')x.quarantined_stamp_matched=false;
   if(key==='guards')x.guarded_RPCs=147;if(key==='window'&&after)x.window_empty=false;
   if(key==='version'&&after)x.server_version_num=180003;if(key==='shape')x.extra='UNTRUSTED_BODY_SENTINEL';
   return reply([{window_snapshot:x}]);
  }
 }});const r=await installWindowControls(input,m);assert.equal(r.exit_code,1,key);assert(r.upgrade_write_attempts<=1);privateFree(r);}
});
test('Redirects, unexpected status/type and oversized/invalid JSON never disclose response bodies',async()=>{
 for(const kind of ['redirect','status','type','oversize','json']){const m=fake({change:(url)=>url===api?(kind==='redirect'?Object.assign(reply(target(),200),{}):kind==='status'?reply({error:'UNTRUSTED_BODY_SENTINEL'},403):kind==='type'?new Response('UNTRUSTED_BODY_SENTINEL',{headers:{'content-type':'text/html'}}):kind==='oversize'?new Response(JSON.stringify({x:'x'.repeat(70000)}),{headers:{'content-type':'application/json'}}):new Response('UNTRUSTED_BODY_SENTINEL',{headers:{'content-type':'application/json'}})):undefined});if(kind==='redirect'){const raw=m.transport;m.transport=async(...a)=>{const r=await raw(...a);Object.defineProperty(r,'redirected',{value:true});return r;};}const r=await installWindowControls(input,m);assert.equal(r.exit_code,1,kind);assert.equal(r.upgrade_write_attempts,0);privateFree(r);}
});
test('Version references change only known NOT NULL catalog rows and owner MAINTAIN ACL in the reference',async()=>{
 const base=JSON.parse(await readFile(root+'/docs/security-audit/security-fr-2-email-batch-l-private-catalog.json','utf8'));
 const before=JSON.stringify(base);for(const major of [15,16,17,18]){const ref=windowVersionReference(base,major*10000);assert.equal(ref.columns.filter(x=>x[0]==='acceptance_window'&&x[4]).length,5);assert.equal(ref.functions.length,6);assert.equal(ref.constraints.filter(x=>x[1].endsWith('_not_null')).length,major<18?0:9);}assert.equal(JSON.stringify(base),before);assert.equal(windowVersionReference(base,140000),null);
});
test('Original private pipe/path/SecureString helper source is reused; child protocol rejects wrong/extra input',async()=>{
 const old=await readFile(root+'/scripts/run-fr-2-email-batch-h.ps1','utf8'),current=await readFile(root+'/scripts/run-fr-2-email-batch-l.ps1','utf8');
 const helpers=s=>s.slice(s.indexOf('function Assert-Unlinked'),s.indexOf("\nWrite-Host 'BATCH"));
 assert.equal(helpers(current),helpers(old).replaceAll('BATCH H','BATCH L').replaceAll('FR.2.4.E5.21_BATCH_H_QUARANTINED_STAGING_DATABASE_INSTALLATION',stage).replaceAll('$Answer.actual_hosted_requests -gt 8','$Answer.actual_hosted_requests -gt 5'));
 for(const body of ['{"preflight":true}','{"preflight":true,"extra":true}','bad']){const r=spawnSync(process.execPath,[root+'/scripts/install-fr-2-email-batch-l.mjs','--private-parent-pipe'],{input:body,encoding:'utf8',timeout:15000});assert.equal(r.stderr,'');const x=JSON.parse(r.stdout);assert.equal(x.stage_step,stage);assert.equal(r.status,body==='{"preflight":true}'?0:1);assert.equal(x.actual_hosted_requests,0);}
});
async function actual(lost=false){
 const {db}=await localDatabase(process.env.MUSHAVO_EMAIL_UI_PGLITE,{preparePlatform:prepareReviewedEmailPlatform});let writes=0;
 try{
  await db.exec((await handoffSQL()).write);await db.exec((await installationSQL()).write);
  const sql=await windowHandoffSQL();
  const oldSource=(await db.query("SELECT prosrc FROM pg_proc WHERE oid='mushavo_email_install.quarantine()'::regprocedure")).rows[0].prosrc;
  const counts=(await db.query('SELECT count(*)::int AS n FROM public.profiles')).rows;
  // Unreviewed function source is refused before it can be called by the snapshot.
  const definition=(await db.query("SELECT pg_get_functiondef('mushavo_email_install.catalog_identity()'::regprocedure) AS source")).rows[0].source;
  await db.exec("CREATE OR REPLACE FUNCTION mushavo_email_install.catalog_identity() RETURNS text LANGUAGE sql STABLE SET search_path=pg_catalog AS $$SELECT 'UNREVIEWED_FUNCTION_SENTINEL'::text$$");
  await assert.rejects(db.exec(sql.snapshot),/EMAIL_L_CATALOG_SOURCE_REVIEW_REQUIRED/);await db.exec('ROLLBACK');await db.exec(definition);
  const transport=async(url,options)=>{
   if(url===api)return reply(target(),200);
   const q=JSON.parse(options.body).query;const writing=q.includes('AS window_installation');
   if(writing)writes++;
   let data;try{data=(await db.exec(q)).flatMap(x=>x.rows);}catch(e){await db.exec('ROLLBACK');throw e;}
   if(writing&&lost)throw Error('PRIVATE_LOST_COMMIT');return reply(data);
  };
  const r=await installWindowControls(input,{transport});assert.equal(r.exit_code,0,JSON.stringify(r));assert.equal(writes,1);assert.equal(r.upgrade_write_outcome_uncertain,false);privateFree(r);
  assert.equal((await db.query('SELECT mode FROM mushavo_email_install.rollout_control')).rows[0].mode,'QUARANTINED');
  assert.deepEqual((await db.query('SELECT count(*)::int AS n FROM public.profiles')).rows,counts);
  assert.equal((await db.query("SELECT prosrc FROM pg_proc WHERE oid='mushavo_email_install.quarantine()'::regprocedure")).rows[0].prosrc,oldSource);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM mushavo_email_install.acceptance_window')).rows[0].n,0);
  assert.deepEqual((await db.query('SELECT '+windowCatalogSQL+' AS value')).rows[0].value,JSON.parse(await readFile(root+'/docs/security-audit/security-fr-2-email-batch-l-private-catalog.json','utf8')));
  const repeat=await installWindowControls(input,{transport});assert.equal(repeat.exit_code,0);assert.equal(repeat.upgrade_write_attempts,0);assert.equal(writes,1);
 }finally{await db.close();}
}
test('Actual source-pinned preflight/atomic upgrade/readback integrates; a completed upgrade is never repeated',()=>actual());
test('Actual committed upgrade with lost response is independently resolved by SQL readback, without retry',()=>actual(true));
