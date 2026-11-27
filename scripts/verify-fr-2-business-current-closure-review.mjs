import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
const {db,migrations}=await localDatabase(process.argv[2]);
const sql=await readFile(resolve(root,'supabase/diagnostics/security_fr_2_3_business_current_closure_review.sql'),'utf8');
const checks=[];
const check=(name,fn)=>{fn();checks.push({name,status:'PASS'});};
const review=async()=>{
 const result=await db.exec(sql);
 return result.flatMap(x=>x.rows||[]).find(x=>x.business_current_closure_review)?.business_current_closure_review;
};
await db.exec("set time zone 'UTC'");
const initial=await review();
check('All 54 ordered source migrations compile',()=>assert.equal(migrations.length,54));
check('All 27 selected relations and 26 API roots are present',()=>{
 assert.equal(initial.selected_relations.length,27);assert.equal(initial.API_roots.length,26);
 assert.deepEqual(initial.missing_selected_relations,[]);assert.deepEqual(initial.missing_API_roots,[]);
});
check('Complete bounded metadata, no truncation',()=>{
 assert.equal(initial.trigger_details_truncated,false);assert.equal(initial.function_details_truncated,false);
 assert.equal(initial.trigger_metadata.length,initial.selected_user_trigger_count);
 assert.equal(initial.function_metadata.length,initial.reachable_public_function_count);
});
check('Outbox exact reviewed ordered-migration body',()=>assert.equal(initial.function_metadata.find(x=>x.name==='set_payment_outbox_workspace_context').lf_body_md5,'097128330dee61398b475cf244293e30'));
check('Policy dependency roots included',()=>assert.ok(initial.policy_dependency_root_count>0));
check('Read-only review reports no application invocation or acceptance',()=>{
 assert.equal(initial.transaction_read_only,'on');assert.equal(initial.application_routines_invoked,0);
 assert.equal(initial.Business_fixture_rows_created,0);assert.equal(initial.hosted_acceptance,false);
 assert.equal(initial.static_graph_complete_for_dynamic_unqualified_or_external_calls,false);
});
check('Relation column lists do not become unresolved call candidates in source model',()=>assert.deepEqual(initial.unresolved_qualified_call_candidates,[]));
const original=await db.query("select prosrc from pg_proc where oid='public.set_payment_outbox_workspace_context()'::regprocedure");
const body=original.rows[0].prosrc;
await db.exec('create or replace function public.set_payment_outbox_workspace_context() returns trigger language plpgsql security definer set search_path=public,pg_temp as $BODY$'+body.replaceAll('\n','\r\n')+'$BODY$');
const crlf=await review();
check('CRLF-only normalization retains exact LF hash and exposes raw byte difference',()=>{
 const f=crlf.function_metadata.find(x=>x.name==='set_payment_outbox_workspace_context');
 assert.equal(f.lf_body_md5,'097128330dee61398b475cf244293e30');assert.ok(f.raw_body_bytes>f.lf_body_bytes);
});
await db.exec('create or replace function public.set_payment_outbox_workspace_context() returns trigger language plpgsql security definer set search_path=public,pg_temp as $BODY$'+body.replace(' · ',' ┬╖ ')+'$BODY$');
const corrupt=await review();
check('Actual separator corruption stays distinguishable from CRLF formatting',()=>assert.equal(corrupt.function_metadata.find(x=>x.name==='set_payment_outbox_workspace_context').lf_body_md5,'12f6ae6147b24860005e0cd6b4e59a2a'));
await db.exec('alter table public.notification_outbox disable trigger set_payment_outbox_workspace_context_trigger');
const disabled=await review();
check('Disabled expected trigger remains visible in inventory',()=>assert.equal(disabled.trigger_metadata.find(x=>x.name==='set_payment_outbox_workspace_context_trigger').enabled_mode,'D'));
await db.exec('alter table public.notification_outbox enable trigger set_payment_outbox_workspace_context_trigger');
await db.exec(`create function public.audit_review_leaf() returns void language plpgsql as $$begin perform public.audit_review_cycle(); end$$;
create function public.audit_review_cycle() returns void language plpgsql as $$begin perform public.audit_review_leaf(); end$$;
create function public.audit_review_leaf(integer) returns void language plpgsql as $$begin execute 'select 1'; end$$;
create function public.audit_review_trigger() returns trigger language plpgsql as $$begin perform public.audit_review_leaf(); return new; end$$;
create trigger audit_review_extra before insert on public.business_profiles for each row execute function public.audit_review_trigger();
create trigger audit_review_when before update on public.business_profiles for each row when(old.workspace_id is distinct from new.workspace_id) execute function public.audit_review_trigger();`);
const cycle=await review();
check('Extra trigger and static helper cycle are included without infinite recursion',()=>{
 assert.ok(cycle.trigger_metadata.find(x=>x.name==='audit_review_extra'));
 assert.ok(cycle.function_metadata.find(x=>x.name==='audit_review_cycle'));
});
check('WHEN predicate using OLD and NEW is safely fingerprinted without expression deparse',()=>{
 const t=cycle.trigger_metadata.find(x=>x.name==='audit_review_when');assert.equal(t.when_clause_present,true);assert.notEqual(t.when_clause_md5,'d41d8cd98f00b204e9800998ecf8427e');
});
check('All named overloads retained for later exact source resolution',()=>assert.equal(cycle.function_metadata.filter(x=>x.name==='audit_review_leaf').length,2));
check('Dynamic SQL marker prevents claims of complete dispatch closure',()=>{
 assert.equal(cycle.function_metadata.find(x=>x.name==='audit_review_leaf'&&x.identity_arguments==='integer').dynamic_sql_marker,true);
 assert.equal(cycle.dynamic_SQL_or_outbound_markers_require_manual_review,true);
});
await db.exec(`create or replace function public.audit_review_cycle() returns void language plpgsql as $$begin perform public.not_a_catalog_function(); perform net.http_post(); end$$;`);
const outbound=await review();
check('Unresolved qualified call and outbound marker surfaced without invocation',()=>{
 assert.ok(outbound.unresolved_qualified_call_candidates.includes('not_a_catalog_function'));
 assert.equal(outbound.function_metadata.find(x=>x.name==='audit_review_cycle').outbound_marker,true);
});
await db.exec('drop trigger audit_review_extra on public.business_profiles; drop trigger audit_review_when on public.business_profiles; drop function public.audit_review_trigger(); drop function public.audit_review_cycle(); drop function public.audit_review_leaf(); drop function public.audit_review_leaf(integer);');
await db.exec('create or replace function public.set_payment_outbox_workspace_context() returns trigger language plpgsql security definer set search_path=public,pg_temp as $BODY$'+body+'$BODY$');
const before=(await db.query("select jsonb_agg(to_jsonb(p) order by oid) as metadata from pg_proc p where pronamespace='public'::regnamespace")).rows[0].metadata;
await review();const after=(await db.query("select jsonb_agg(to_jsonb(p) order by oid) as metadata from pg_proc p where pronamespace='public'::regnamespace")).rows[0].metadata;
check('Review preserves full public function catalog',()=>assert.deepEqual(after,before));
await db.exec('set role anon');let ordinaryDenied=false;try{await review();}catch(e){ordinaryDenied=String(e).includes('BUSINESS_REVIEW_REQUIRES_PRIVILEGED_SQL_EDITOR');await db.exec('rollback');}await db.exec('reset role');
check('Ordinary role rejected',()=>assert.equal(ordinaryDenied,true));
await db.exec("set session_replication_role='replica'");let replicaDenied=false;try{await review();}catch(e){replicaDenied=String(e).includes('BUSINESS_REVIEW_REQUIRES_ORIGIN');await db.exec('rollback');}await db.exec("set session_replication_role='origin'");
check('Non-origin session rejected',()=>assert.equal(replicaDenied,true));
const sourceInventory={...initial,stage_step:'FR.2.3_BUSINESS_CURRENT_CLOSURE_SOURCE_MODEL',source_parent_commit:'9b01ac1c674a94be60a54b21bea0466e831f3013',migrations:migrations.length,scope:'54_ORDERED_MIGRATIONS_WITH_MODELED_AUTH_STORAGE_AND_DEFAULT_GRANTS_NOT_HOSTED_CATALOG'};
delete sourceInventory.checked_UTC;delete sourceInventory.target_project;
await writeFile(resolve(root,'docs/security-audit/security-fr-2-business-current-closure-source-model.json'),JSON.stringify(sourceInventory,null,2)+'\n');
const result={stage_step:'FR.2.3_BUSINESS_CURRENT_CLOSURE_REVIEW',result:'LOCAL_ORDERED_SOURCE_CATALOG_AND_READ_ONLY_DIAGNOSTIC_SCOPED_PASS',source_parent_commit:'9b01ac1c674a94be60a54b21bea0466e831f3013',node_version:process.version,ordered_migrations:migrations.length,tests:checks.length,pass:checks.length,fail:0,exit_code:0,selected_relations:initial.selected_relations.length,API_roots:initial.API_roots.length,selected_user_triggers:initial.selected_user_trigger_count,reachable_public_functions:initial.reachable_public_function_count,policy_dependency_roots:initial.policy_dependency_root_count,dynamic_SQL_marker_names:initial.function_metadata.filter(x=>x.dynamic_sql_marker).map(x=>x.name),outbound_marker_names:initial.function_metadata.filter(x=>x.outbound_marker).map(x=>x.name),SQL_ASCII_only:!/[^\x00-\x7f]/.test(sql),SQL_SHA256:createHash('sha256').update(sql).digest('hex'),cases:checks,hosted_catalog_or_auth_verified:false,hosted_Business_API_checks_run:0,Business_fixture_rows_created:0,dispatch_jobs_or_provider_calls_run:0,hosted_acceptance:false,findings_closed:[]};
await writeFile(resolve(root,'docs/security-audit/security-fr-2-business-current-closure-local-checks.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));await db.close();
