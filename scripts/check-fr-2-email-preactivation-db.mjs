import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {hookGuard} from './lib/email-atomic-source.mjs';
import {readFile} from 'node:fs/promises';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
const ensure=JSON.parse(await readFile('tests/fixtures/fr-2-reviewed-ensure-rls.json','utf8'));
const providers=JSON.parse(await readFile('tests/fixtures/fr-2-reviewed-provider-hooks.json','utf8')).hooks;
const {db,migrations}=await localDatabase(process.env.MUSHAVO_EMAIL_UI_PGLITE??root+'/scripts/fixtures/email-session-review-tools/node_modules/@electric-sql/pglite/dist/index.js',{preparePlatform:async db=>{
 await db.exec("create role supabase_admin superuser;create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path=pg_catalog as $body$"+ensure.body+"$body$;create event trigger ensure_rls on ddl_command_end when tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO') execute function public.rls_auto_enable();");
 for(const h of providers)await db.exec('create function extensions.'+h.name+'() returns event_trigger language plpgsql set search_path=\'\' as $hook$'+h.body+'$hook$;alter function extensions.'+h.name+'() owner to supabase_admin;create event trigger '+h.name+' on '+h.event+' execute function extensions.'+h.name+'();alter event trigger '+h.name+' owner to supabase_admin;');
}});
await db.exec("alter table auth.users add column email_confirmed_at timestamptz,add column encrypted_password text,add column banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id),not_after timestamptz);alter table storage.buckets enable row level security;");
for(const [n,e,t]of [['fixture_graphql_drop','sql_drop','DROP EXTENSION'],['fixture_cron','ddl_command_end','CREATE EXTENSION'],['fixture_graphql','ddl_command_end','CREATE EXTENSION'],['fixture_net','ddl_command_end','CREATE EXTENSION']])await db.exec('create function extensions.'+n+'() returns event_trigger language plpgsql as $$begin return; end$$;create event trigger '+n+' on '+e+" when tag in ('"+t+"') execute function extensions."+n+'();');

test.after(async()=>{await db.close();});
const sql=await readFile('supabase/diagnostics/security_fr_2_4_email_pre_activation_baseline.sql','utf8');
async function run(){
 try{const rs=await db.exec(sql);const value=rs.find(x=>x.rows?.[0]?.email_pre_activation_baseline)?.rows[0].email_pre_activation_baseline;assert(value);return value;}
 catch(e){await db.exec('rollback');throw e;}
}
const definition=async name=>(await db.query("select pg_get_functiondef(to_regprocedure($1)) value",[name])).rows[0].value;
const ok=x=>assert.equal(x.result,'SELECTED_METADATA_PREREQUISITES_MATCH_NOT_ACTIVATION_APPROVAL');
const blocked=x=>assert.equal(x.result,'SELECTED_STAGING_METADATA_REVIEW_REQUIRED');
test('The actual read-only query embeds the exact current installer hook predicate',()=>{
 assert(sql.includes('NOT ('+hookGuard.slice('IF '.length,hookGuard.indexOf(' THEN RAISE'))+')'));
 assert(sql.includes('BEGIN TRANSACTION READ ONLY;'));assert(sql.trimEnd().endsWith('ROLLBACK;'));assert.equal(migrations.length,54);
});
test('Current modeled application plus explicit provider stand-ins matches selected metadata',async()=>{
 const x=await run();ok(x);assert.equal(Object.keys(x.checks).length,9);assert(Object.values(x.checks).every(v=>v===true));assert.equal(x.transaction_read_only,'on');assert.equal(x.non_event_routines.count,278);assert.equal(x.policies.total,166);assert.equal(x.event_hook_count,7);assert.equal(x.private_installer_namespace_present,false);assert.equal(x.email_backend_namespace_present,false);
 for(const name of['application_rows_read','application_rows_or_function_bodies_printed','installer_registered_or_invoked','live_activation_approved','hosted_acceptance','project_selection_independently_verified'])assert.equal(x[name],false);
});
test('Function body drift is reported without invocation or body disclosure',async()=>{
 const name='public.archive_business_role(uuid,text,integer)',old=await definition(name);
 try{await db.exec(old.replace(/AS \$function\$/,'AS $function$\n'));const x=await run();blocked(x);assert.equal(x.checks.selected_278_routine_fingerprint_matches,false);assert.equal(x.application_or_hook_functions_invoked,0);}
 finally{await db.exec(old);}
});
test('Changed ensure_rls settings fail the exact hook predicate independently of non-event routines',async()=>{
 const old=await definition('public.rls_auto_enable()');
 try{await db.exec('alter function public.rls_auto_enable() set search_path=public');const x=await run();blocked(x);assert.equal(x.checks.reviewed_event_hook_metadata_matches,false);assert.equal(x.checks.selected_278_routine_fingerprint_matches,true);}
 finally{await db.exec(old);}
});
test('Missing required Auth session metadata returns a review result',async()=>{
 try{await db.exec('alter table auth.sessions rename column not_after to fixture_absent');const x=await run();blocked(x);assert.equal(x.checks.required_auth_and_profile_column_types_present,false);}
 finally{await db.exec('alter table auth.sessions rename column fixture_absent to not_after');}
});
test('A null view option safely returns false rather than passing or causing a cast error',async()=>{
 try{await db.exec('alter view public.cashbook_account_balances reset(security_invoker)');const x=await run();blocked(x);assert.equal(x.checks.public_view_invoker_metadata_matches,false);}
 finally{await db.exec('alter view public.cashbook_account_balances set(security_invoker=true)');}
});
test('Existing email namespaces are detected without invoking or replacing an installer',async()=>{
 try{await db.exec('create schema mushavo_email_auth;create schema mushavo_email_install');const x=await run();blocked(x);assert.equal(x.checks.email_backend_installer_and_guards_absent,false);assert.equal(x.private_installer_namespace_present,true);assert.equal(x.email_backend_namespace_present,true);}
 finally{await db.exec('drop schema mushavo_email_auth;drop schema mushavo_email_install');}
});
test('Policy expression drift does not pass on unchanged counts',async()=>{
 const qual=(await db.query("select pg_get_expr(polqual,polrelid) value from pg_policy where polrelid='public.payment_records'::regclass and polname='Account must be active'")).rows[0].value;
 try{await db.exec('alter policy "Account must be active" on public.payment_records using(false)');const x=await run();blocked(x);assert.equal(x.policies.total,166);assert.equal(x.checks.selected_166_policy_fingerprint_matches,false);}
 finally{await db.exec('alter policy "Account must be active" on public.payment_records using('+qual+')');}
});
test('An ordinary role cannot execute the privileged SQL Editor diagnostic',async()=>{
 try{await db.exec('set role authenticated');await assert.rejects(run(),/EMAIL_PREACTIVATION_REQUIRES_PRIVILEGED_SQL_EDITOR/);}
 finally{await db.exec('rollback;reset role');}
});
test('Read-only execution restores settings and leaves catalog metadata unchanged',async()=>{
 const snapshot=async()=>JSON.stringify((await db.query("select (select jsonb_agg(to_jsonb(p) order by oid) from pg_proc p) functions,(select jsonb_agg(to_jsonb(p) order by oid) from pg_policy p) policies,(select jsonb_agg(to_jsonb(t) order by oid) from pg_trigger t) triggers,(select jsonb_agg(to_jsonb(e) order by oid) from pg_event_trigger e) hooks")).rows);
 const before=await snapshot(),settings=(await db.query("select current_setting('search_path') path,current_setting('statement_timeout') timeout,current_setting('TimeZone') zone,current_setting('transaction_read_only') ro")).rows;
 ok(await run());assert.equal(await snapshot(),before);assert.deepEqual((await db.query("select current_setting('search_path') path,current_setting('statement_timeout') timeout,current_setting('TimeZone') zone,current_setting('transaction_read_only') ro")).rows,settings);
});
