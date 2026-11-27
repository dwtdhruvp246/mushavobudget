// Synthetic cron table only; no actual scheduler/HTTP engine is installed or run.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {accessQueryURL,aggregateQueryURL} from './check-fr-2-email-edge-readiness.mjs';
const {PGlite}=await import(pathToFileURL(process.env.MUSHAVO_EMAIL_UI_PGLITE));const db=new PGlite();
await db.exec('create role supabase_read_only_user;create schema private_app;create table private_app.customer_rows(id integer);insert into private_app.customer_rows values(1)');
const access=await readFile(accessQueryURL,'utf8'),aggregate=await readFile(aggregateQueryURL,'utf8');
test.after(()=>db.close());
async function query(sql,key,{role=true,readOnly=true}={}){
 await db.exec('begin'+(readOnly?' transaction read only':''));try{if(role)await db.exec('set local role supabase_read_only_user');return(await db.query(sql)).rows[0][key];}finally{await db.exec('rollback');}
}
async function table(){await db.exec('drop schema if exists cron cascade;create schema cron;create table cron.job(active boolean,command text)');}
test('Fixed catalog SELECT works without cron schema or application-row access and reports absence, not zero jobs',async()=>{
 const r=await query(access,'edge_scheduler_access');assert.equal(r.read_only_role,true);assert.equal(r.transaction_read_only,'on');assert.equal(r.cron_job_relation_present,false);assert.equal(r.cron_job_table_select,false);
 await db.exec('begin transaction read only;set local role supabase_read_only_user');try{await assert.rejects(db.query('select * from private_app.customer_rows'),e=>e.code==='42501');}finally{await db.exec('rollback');}
});
test('A synthetic cron table with no grants is observed without attempting to read scheduler rows',async()=>{
 await table();const r=await query(access,'edge_scheduler_access');assert.equal(r.cron_job_relation_present,true);assert.equal(r.cron_job_table_shape_matches,true);assert.equal(r.cron_schema_usage,false);assert.equal(r.cron_job_table_select,false);
});
test('Granted scheduler aggregates return only numeric counts and context; command text is not executed or returned',async()=>{
 await db.exec("grant usage on schema cron to supabase_read_only_user;grant select on cron.job to supabase_read_only_user;insert into cron.job values(true,'SELECT private_app.NEVER_INVOKE(''SYNTHETIC_PRIVATE_TOKEN'', ''SYNC-EXCHANGE-RATES'')'),(true,'SELECT private_app.OTHER_PRIVATE_COMMAND()'),(false,'sync-exchange-rates')");
 const a=await query(access,'edge_scheduler_access');assert(a.cron_schema_usage&&a.cron_job_table_select);
 const r=await query(aggregate,'edge_scheduler_aggregates');assert.equal(r.visible_jobs,3);assert.equal(r.visible_active_jobs,2);assert.equal(r.visible_active_FX_text_matches,1);assert.equal(r.all_rows_visible_under_selected_rls_controls,true);assert.equal(r.indirect_dynamic_or_external_callers_excluded,false);assert(!JSON.stringify(r).includes('SYNTHETIC_PRIVATE_TOKEN'));
});
test('RLS with no read policy can show zero visible rows and explicitly fails the selected all-row visibility control',async()=>{
 await db.exec('alter table cron.job enable row level security;alter table cron.job force row level security');const a=await query(access,'edge_scheduler_access');assert.equal(a.cron_job_rls_enabled,true);assert.equal(a.cron_job_force_rls,true);assert.equal(a.role_bypasses_job_rls,false);
 const r=await query(aggregate,'edge_scheduler_aggregates');assert.equal(r.visible_jobs,0);assert.equal(r.all_rows_visible_under_selected_rls_controls,false);
});
test('A modeled BYPASSRLS role sees the synthetic rows but still cannot exclude indirect or external callers',async()=>{
 await db.exec('alter role supabase_read_only_user bypassrls');const r=await query(aggregate,'edge_scheduler_aggregates');assert.equal(r.visible_jobs,3);assert.equal(r.all_rows_visible_under_selected_rls_controls,true);assert.equal(r.indirect_dynamic_or_external_callers_excluded,false);await db.exec('alter role supabase_read_only_user nobypassrls');
});
test('Wrong scheduler column types are reported as shape mismatch through catalogs',async()=>{
 await db.exec('drop schema cron cascade;create schema cron;create table cron.job(active text,command text)');const r=await query(access,'edge_scheduler_access');assert.equal(r.cron_job_relation_present,true);assert.equal(r.cron_job_table_shape_matches,false);
});
test('The fixed SELECT reports wrong role or writable transaction context without inventing read-only acceptance',async()=>{
 assert.equal((await query(access,'edge_scheduler_access',{role:false})).read_only_role,false);
 assert.equal((await query(access,'edge_scheduler_access',{readOnly:false})).transaction_read_only,'off');
});
