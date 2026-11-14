import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import path from 'node:path';import {createHash} from 'node:crypto';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
const paths=['supabase/remediation/security_fr_2_4_bill_reminder_separator_correction.sql','supabase/remediation/security_fr_2_4_bill_reminder_separator_rollback.sql'];
const [correction,rollback]=await Promise.all(paths.map(p=>readFile(path.join(root,p),'utf8')));
const migration=await readFile(path.join(root,'supabase/migrations/20260928213000_business_stage_6_bills.sql'),'utf8');
const reviewed=migration.match(/create function public\.enqueue_due_business_bill_reminders\(.*? as \$\$(.*?)\$\$;/is)[1];
const corrupted=reviewed.replace('\u00b7','\u252c\u2556');
const sha=x=>createHash('sha256').update(x).digest('hex'),md5=x=>createHash('md5').update(x).digest('hex');
const cases=[];let db,migrations,failure;
async function check(title,fn){try{await fn();cases.push({title,result:'PASS'});}catch(error){cases.push({title,result:'FAIL',code:error.code||'ASSERTION'});throw error;}}
async function source(){return(await db.query("select prosrc from pg_proc where oid='public.enqueue_due_business_bill_reminders(timestamptz)'::regprocedure")).rows[0].prosrc;}
async function define(body){const row=(await db.query("select pg_get_functiondef('public.enqueue_due_business_bill_reminders(timestamptz)'::regprocedure) as definition,prosrc from pg_proc where oid='public.enqueue_due_business_bill_reminders(timestamptz)'::regprocedure")).rows[0];await db.exec(row.definition.replace(row.prosrc,body));}
async function apply(sql=correction){const results=await db.exec(sql);return results.flatMap(x=>x.rows||[]).find(x=>x.bill_reminder_separator_correction||x.bill_reminder_separator_rollback);}
async function rejected(sql,expected){const before=await source();await db.exec('begin');try{await db.exec(sql);await apply();assert.fail('Unreviewed state accepted');}catch(error){assert.notEqual(error.code,'ERR_ASSERTION');assert.equal(error.message,expected);await db.exec('rollback');}assert.equal(await source(),before);}
try{
 ({db,migrations}=await localDatabase(process.argv[2]));
 await check('ASCII SQL reconstruction matches owner MD5 and reviewed source SHA256 with exactly one changed line',async()=>{
  assert(correction.split('').every(x=>x.charCodeAt(0)<128));assert(rollback.split('').every(x=>x.charCodeAt(0)<128));
  assert.equal(md5(reviewed),'cb3b123fa3eb25aed3d2cb0ef3a025db');assert.equal(md5(corrupted),'140dff26cec8361452eb317ec74225b2');
  assert.equal(sha(reviewed),'1366f72eeb32ffd7eb06fb306d32e8fc8d33e608c3ff9fb0709a89a168c95145');assert.equal(sha(corrupted),'74ed421080439cca6616ba92e398b17f66d9eff661e8b5191597b9dd646b16c2');
  assert.deepEqual(reviewed.split('\n').flatMap((s,i)=>s!==corrupted.split('\n')[i]?[i+1]:[]),[42]);assert.equal(migrations.length,54);
 });
 await define(corrupted.replaceAll('\n','\r\n'));
 const oid=(await db.query("select 'public.enqueue_due_business_bill_reminders(timestamptz)'::regprocedure::oid as oid")).rows[0].oid;
 await check('actual guarded correction fixes only separator, preserves CRLF and OID and asserts full source catalog parity',async()=>{const receipt=(await apply()).bill_reminder_separator_correction;assert.equal(receipt.source_non_event_catalog_matches_under_assertion,true);assert.equal(await source(),reviewed.replaceAll('\n','\r\n'));assert.equal((await db.query("select 'public.enqueue_due_business_bill_reminders(timestamptz)'::regprocedure::oid as oid")).rows[0].oid,oid);});
 await check('already corrected source is accepted without altering its bytes',async()=>{const before=await source();await apply();assert.equal(await source(),before);});
 await check('actual guarded rollback restores exact previous display bytes and correction succeeds again',async()=>{await apply(rollback);assert.equal(await source(),corrupted.replaceAll('\n','\r\n'));await apply();assert.equal(await source(),reviewed.replaceAll('\n','\r\n'));});
 await check('unknown target body is rejected before any replacement',async()=>{const row=(await db.query("select pg_get_functiondef('public.enqueue_due_business_bill_reminders(timestamptz)'::regprocedure) as definition,prosrc from pg_proc where oid='public.enqueue_due_business_bill_reminders(timestamptz)'::regprocedure")).rows[0];const changed=row.prosrc+'\n-- unknown';await rejected(row.definition.replace(row.prosrc,changed),'BILL_SEPARATOR_UNREVIEWED_PUBLIC_FUNCTION_BASELINE');});
 await check('authenticated EXECUTE promotion is refused and rolled back',()=>rejected('grant execute on function public.enqueue_due_business_bill_reminders(timestamptz) to authenticated','UNREVIEWED_BILL_REMINDER_METADATA'));
 await check('unrelated public function grant drift is refused',()=>rejected('revoke execute on function public.get_my_business_invitations() from authenticated','BILL_SEPARATOR_UNREVIEWED_PUBLIC_FUNCTION_BASELINE'));
 await check('target overload collision is refused',()=>rejected('create function public.enqueue_due_business_bill_reminders(text) returns integer language sql as $$select 0$$','UNREVIEWED_BILL_REMINDER_OVERLOADS'));
 await check('target search path drift is refused',()=>rejected('alter function public.enqueue_due_business_bill_reminders(timestamptz) set search_path=public','UNREVIEWED_BILL_REMINDER_METADATA'));
 await check('unknown relevant function-DDL hook is refused without disabling it',()=>rejected("create function public.synthetic_unreviewed_ddl() returns event_trigger language plpgsql as $$begin return;end$$;create event trigger synthetic_unreviewed_ddl on ddl_command_end when tag in ('CREATE FUNCTION') execute function public.synthetic_unreviewed_ddl()",'UNREVIEWED_FUNCTION_DDL_EVENT_HOOK'));
 await check('ordinary SQL role cannot apply the correction',async()=>{await db.exec('set role authenticated');try{await apply();assert.fail('Ordinary role accepted');}catch(error){assert.notEqual(error.code,'ERR_ASSERTION');assert.equal(error.message,'BILL_SEPARATOR_REQUIRES_POSTGRES_ORIGIN_SQL_EDITOR');await db.exec('rollback;reset role');}});
 await db.exec("create function public.synthetic_auto_rls() returns event_trigger language plpgsql as $$begin return;end$$;create event trigger synthetic_auto_rls on ddl_command_end when tag in ('CREATE TABLE') execute function public.synthetic_auto_rls();");
 await check('irrelevant CREATE TABLE hook remains enabled and source event exclusion remains exact',async()=>{await apply(rollback);await apply();assert.equal((await db.query("select evtenabled from pg_event_trigger where evtname='synthetic_auto_rls'")).rows[0].evtenabled,'O');});
 const provider=JSON.parse(await readFile(path.join(root,'tests/fixtures/fr-2-reviewed-provider-hooks.json'),'utf8'));
 await db.exec('create role supabase_admin superuser');
 for(const h of provider.hooks)await db.exec(`create function extensions.${h.name}() returns event_trigger language plpgsql set search_path='' as $provider$${h.body}$provider$;alter function extensions.${h.name}() owner to supabase_admin;create event trigger ${h.name} on ${h.event} execute function extensions.${h.name}();alter event trigger ${h.name} owner to supabase_admin;`);
 await check('exact reviewed provider hooks stay enabled through real rollback and correction',async()=>{await apply(rollback);await apply();assert((await db.query('select evtenabled from pg_event_trigger')).rows.every(x=>x.evtenabled==='O'));});
 await check('provider hook body drift is refused',()=>rejected("create or replace function extensions.pgrst_ddl_watch() returns event_trigger language plpgsql set search_path='' as $$begin return;end$$;alter function extensions.pgrst_ddl_watch() owner to supabase_admin",'UNREVIEWED_FUNCTION_DDL_EVENT_HOOK'));
}catch(error){failure={code:error.code||'ASSERTION',problem:/^[A-Z_]+$/.test(error.message||'')?error.message:'LOCAL_SQL_OR_ASSERTION_REVIEW_REQUIRED'};}
finally{if(db)await db.close();}
const ok=!failure&&cases.length===14;
console.log(JSON.stringify({stage_step:'FR.2.4.E4.1_BILL_REMINDER_SEPARATOR_CANDIDATE',result:ok?'OFFLINE_ACTUAL_GUARDED_CORRECTION_AND_ROLLBACK_SCOPED_PASS':'OFFLINE_CORRECTION_REVIEW_REQUIRED',scope:'FULL54_MIGRATIONS_AND_ACTUAL_CORRECTION_WITH_RECONSTRUCTED_BODY_SYNTHETIC_HOOKS_NO_SCHEDULER_INVOCATION',node_version:process.version,migration_count:migrations?.length,tests:cases.length,pass:cases.filter(x=>x.result==='PASS').length,fail:cases.filter(x=>x.result==='FAIL').length,exit_code:ok?0:1,cases,failure,SQL_SHA256:Object.fromEntries(paths.map((p,i)=>[p,sha(i?rollback:correction)])),actual_hosted_SQL_or_provider_requests:0,scheduler_or_notification_dispatch_invoked:false,hosted_acceptance:false,findings_closed:[]},null,2));process.exitCode=ok?0:1;
