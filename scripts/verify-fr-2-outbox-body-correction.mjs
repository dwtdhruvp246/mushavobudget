// Actual guarded SQL and trigger behavior in a minimal synthetic catalog only.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const installPath='supabase/remediation/security_fr_2_3_outbox_body_correction.sql';
const rollbackPath='supabase/remediation/security_fr_2_3_outbox_body_rollback.sql';
const install=fs.readFileSync(path.join(root,installPath),'utf8'),rollback=fs.readFileSync(path.join(root,rollbackPath),'utf8');
const bodies=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/fr-2-outbox-reviewed-bodies.json')));
const providers=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/fr-2-reviewed-provider-hooks.json')));
let db,engine,failure;const cases=[];
const md5=s=>createHash('md5').update(s).digest('hex'),sha=s=>createHash('sha256').update(s).digest('hex');
async function check(title,fn){try{await fn();cases.push({title,result:'PASS'});}catch(e){cases.push({title,result:'FAIL',code:e.code??'ASSERTION'});throw e;}}
async function define(body){await db.query(`create or replace function public.set_payment_outbox_workspace_context() returns trigger language plpgsql security definer set search_path=public,pg_temp as $body$${body}$body$`);}
async function source(){return(await db.query("select prosrc from pg_proc where oid='public.set_payment_outbox_workspace_context()'::regprocedure")).rows[0].prosrc;}
async function rows(){return(await db.query('select to_jsonb(x) row from notification_outbox x order by id')).rows.map(x=>x.row);}
async function repair(sql=install){const x=(await db.exec(sql)).find(x=>x.rows?.[0]?.outbox_body_correction||x.rows?.[0]?.outbox_body_rollback)?.rows[0];assert(x);return x.outbox_body_correction||x.outbox_body_rollback;}
async function rejectedMutation(ddl,expected){await db.exec('begin');try{await db.exec(ddl);await db.exec(install);assert.fail('Unreviewed state accepted');}catch(e){assert.notEqual(e.code,'ERR_ASSERTION');if(expected)assert.equal(e.message,expected);await db.exec('rollback');}}
async function add(workspace,type='payment',title='Synthetic untouched',url='/unchanged'){
 return(await db.query('insert into notification_outbox(workspace_id,source_type,source_id,title,target_url) values($1,$2,$3,$4,$5) returning title,target_url',[workspace,type,'d1000000-0000-4000-8000-000000000099',title,url])).rows[0];
}
try{
 const {PGlite}=await import(pathToFileURL(path.resolve(process.argv[2])));db=new PGlite();engine=(await db.query('select version() v')).rows[0].v;
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema extensions;
 create table budget_workspaces(id uuid primary key,workspace_type text,name text);
 create table workspace_settings(workspace_id uuid primary key,detailed_notification_previews boolean);
 create table notification_outbox(id uuid primary key default gen_random_uuid(),workspace_id uuid,source_type text,source_id uuid,target_url text,title text);
 alter table notification_outbox enable row level security;
 grant usage on schema public to anon,authenticated,service_role;
 grant select on notification_outbox to authenticated;
 create policy synthetic_read on notification_outbox for select to authenticated using(true);
 create function public.synthetic_unrelated() returns integer language sql as $$select 1$$;`);
 await define(bodies.reconstructed_deployed_CRLF);
 await db.exec('revoke all on function public.set_payment_outbox_workspace_context() from public,anon,authenticated;grant execute on function public.set_payment_outbox_workspace_context() to service_role;create trigger set_payment_outbox_workspace_context_trigger before insert or update of workspace_id,source_type,source_id,target_url,title on notification_outbox for each row execute function public.set_payment_outbox_workspace_context()');
 const ws=[1,2,3,4].map(n=>'d1000000-0000-4000-8000-'+String(n).padStart(12,'0'));
 for(const [i,type]of ['personal','household','business','personal'].entries()){
  await db.query('insert into budget_workspaces values($1,$2,$3)',[ws[i],type,i===3?'X'.repeat(150):'Synthetic '+type]);
  await db.query('insert into workspace_settings values($1,$2)',[ws[i],true]);
 }
 const originalOid=(await db.query("select 'public.set_payment_outbox_workspace_context()'::regprocedure::oid v")).rows[0].v;
 await add(ws[1]);const before=await rows();
 await check('reconstructed body matches all35 line hashes and both owner whole hashes; only separator line differs from migration',async()=>{
  const b=bodies.reconstructed_deployed_LF;assert.equal(md5(b),'12f6ae6147b24860005e0cd6b4e59a2a');assert.equal(sha(b),'d8b10220c422d168bf38c538916872a203bfe3c0c736f151ea4fa5d5ca2fbd39');assert.equal(Buffer.byteLength(b),1023);assert.equal(Buffer.byteLength(bodies.reconstructed_deployed_CRLF),1057);const old=bodies.historical_migration.split('\n'),live=b.split('\n');assert.deepEqual(live.map((l,i)=>l!==old[i]?i+1:null).filter(Boolean),[28]);for(const [i,l]of live.entries())assert.deepEqual({line_number:i+1,bytes:Buffer.byteLength(l),line_sha256:sha(l)},bodies.observed_line_fingerprints[i]);assert(install.split('').every(c=>c.charCodeAt(0)<128));assert(rollback.split('').every(c=>c.charCodeAt(0)<128));
 });
 await check('actual correction compiles, aligns exact migration hash and preserves all existing outbox rows and target OID',async()=>{const x=await repair();assert(x.reviewed_target_body_matches);assert.equal(x.observed_LF_body_md5,'097128330dee61398b475cf244293e30');assert.equal(await source(),bodies.historical_migration);assert.deepEqual(await rows(),before);assert.equal((await db.query("select 'public.set_payment_outbox_workspace_context()'::regprocedure::oid v")).rows[0].v,originalOid);});
 await check('exact repeated correction is idempotent with existing row preservation',async()=>{await repair();assert.deepEqual(await rows(),before);});
 await check('anonymous/authenticated execute denial and service-role grant remain unchanged',async()=>{assert.deepEqual((await db.query("select has_function_privilege('anon','public.set_payment_outbox_workspace_context()','EXECUTE') a,has_function_privilege('authenticated','public.set_payment_outbox_workspace_context()','EXECUTE') b,has_function_privilege('service_role','public.set_payment_outbox_workspace_context()','EXECUTE') c")).rows[0],{a:false,b:false,c:true});});
 await check('detailed Personal Family Business titles use the intended separator and retain the exact source route',async()=>{for(const [i,prefix]of ['Personal','Family','Business'].entries()){const x=await add(ws[i]);assert.equal(x.title,prefix+' \u00b7 Synthetic '+['personal','household','business'][i]);assert.equal(x.target_url,'/app.html?source=push&workspace='+ws[i]+'&payment_item=d1000000-0000-4000-8000-000000000099#family/payments');}});
 await check('default privacy preview remains generic when detailed previews are disabled',async()=>{await db.query('update workspace_settings set detailed_notification_previews=false where workspace_id=$1',[ws[0]]);assert.equal((await add(ws[0])).title,'Mushavo Budget');});
 await check('existing non-payment events bypass the helper transformation',async()=>{assert.deepEqual(await add(ws[0],'other'),{title:'Synthetic untouched',target_url:'/unchanged'});});
 await check('long detailed titles retain the existing80-character limit',async()=>{const x=await add(ws[3]);assert.equal([...x.title].length,80);assert(x.title.startsWith('Personal \u00b7 '));});
 await check('reviewed rollback restores exact prior CRLF body and preserves CURRENT messages',async()=>{const old=await rows();const x=await repair(rollback);assert.equal(x.observed_LF_body_md5,'12f6ae6147b24860005e0cd6b4e59a2a');assert.equal(await source(),bodies.reconstructed_deployed_CRLF);assert.deepEqual(await rows(),old);});
 await check('correction reinstalls after exact rollback without rewriting messages',async()=>{const old=await rows();await repair();assert.deepEqual(await rows(),old);});
 await check('known canonical-schema body is aligned to reviewed migration formatting without permission or row changes',async()=>{await define(bodies.canonical_schema);const old=await rows();await repair();assert.equal(await source(),bodies.historical_migration);assert.deepEqual(await rows(),old);});
 await check('reviewed historical LF body is accepted directly',async()=>{await define(bodies.historical_migration);await repair();assert.equal(await source(),bodies.historical_migration);});
 await check('unknown literal/body drift is rejected',()=>rejectedMutation("create or replace function public.set_payment_outbox_workspace_context() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin return new;end;$$",'UNREVIEWED_OUTBOX_FUNCTION_BODY_OR_METADATA'));
 await check('authenticated EXECUTE grant drift is rejected',()=>rejectedMutation('grant execute on function public.set_payment_outbox_workspace_context() to authenticated','UNREVIEWED_OUTBOX_FUNCTION_BODY_OR_METADATA'));
 await check('revoked existing service-role EXECUTE grant is rejected',()=>rejectedMutation('revoke execute on function public.set_payment_outbox_workspace_context() from service_role','UNREVIEWED_OUTBOX_FUNCTION_BODY_OR_METADATA'));
 await check('overload collision is rejected',()=>rejectedMutation('create function public.set_payment_outbox_workspace_context(text) returns text language sql as $$select $1$$','UNREVIEWED_OUTBOX_FUNCTION_COUNT'));
 await check('changed search path is rejected',()=>rejectedMutation('alter function public.set_payment_outbox_workspace_context() set search_path=public','UNREVIEWED_OUTBOX_FUNCTION_BODY_OR_METADATA'));
 await check('disabled trigger is rejected without enabling it',()=>rejectedMutation('alter table notification_outbox disable trigger set_payment_outbox_workspace_context_trigger','UNREVIEWED_OUTBOX_TRIGGER_BINDING'));
 await check('unexpected trigger UPDATE coverage is rejected',()=>rejectedMutation('create or replace trigger set_payment_outbox_workspace_context_trigger before insert or update of title on notification_outbox for each row execute function public.set_payment_outbox_workspace_context()','UNREVIEWED_OUTBOX_TRIGGER_BINDING'));
 await check('unexpected WHEN predicate is rejected',()=>rejectedMutation("create or replace trigger set_payment_outbox_workspace_context_trigger before insert or update of workspace_id,source_type,source_id,target_url,title on notification_outbox for each row when(new.source_type='payment') execute function public.set_payment_outbox_workspace_context()",'UNREVIEWED_OUTBOX_TRIGGER_BINDING'));
 await check('additional trigger association is rejected',()=>rejectedMutation('create trigger duplicate_context before insert on notification_outbox for each row execute function public.set_payment_outbox_workspace_context()','UNREVIEWED_OUTBOX_TRIGGER_BINDING'));
 await check('non-origin replication mode is rejected',()=>rejectedMutation("set local session_replication_role='replica'",'OUTBOX_CORRECTION_REQUIRES_PRIVILEGED_ORIGIN_SQL_EDITOR'));
 await check('ordinary SQL role cannot install the correction',async()=>{await db.exec('set role authenticated');try{await repair();assert.fail('Ordinary role installed');}catch(e){assert.notEqual(e.code,'ERR_ASSERTION');await db.exec('rollback;reset role');}});
 await check('unknown relevant CREATE FUNCTION hook stops the correction',()=>rejectedMutation('create function public.unreviewed_ddl() returns event_trigger language plpgsql as $$begin end;$$;create event trigger unreviewed_ddl on ddl_command_end when tag in (\'CREATE FUNCTION\') execute function public.unreviewed_ddl()','UNREVIEWED_FUNCTION_DDL_EVENT_HOOK'));
 await db.exec('create role supabase_admin superuser');
 for(const h of providers.hooks)await db.exec(`create function extensions.${h.name}() returns event_trigger language plpgsql set search_path='' as $provider$${h.body}$provider$;alter function extensions.${h.name}() owner to supabase_admin;create event trigger ${h.name} on ${h.event} execute function extensions.${h.name}();alter event trigger ${h.name} owner to supabase_admin`);
 await check('exact reviewed provider hooks remain enabled through rollback and correction',async()=>{const old=await rows();await repair(rollback);await repair();assert.deepEqual(await rows(),old);assert((await db.query('select evtenabled from pg_event_trigger')).rows.every(x=>x.evtenabled==='O'));});
 await check('provider hook body drift is rejected',()=>rejectedMutation("create or replace function extensions.pgrst_ddl_watch() returns event_trigger language plpgsql set search_path='' as $$begin end;$$;alter function extensions.pgrst_ddl_watch() owner to supabase_admin",'UNREVIEWED_FUNCTION_DDL_EVENT_HOOK'));
 await check('oversized outbox baseline stops before correction',()=>rejectedMutation("insert into notification_outbox(source_type) select 'other' from generate_series(1,1001)",'UNREVIEWED_OR_OVERSIZED_OUTBOX_RELATION'));
}catch(e){failure={code:e.code??'ASSERTION',problem:/^[A-Z_]+$/.test(e.message??'')?e.message:'LOCAL_SQL_OR_ASSERTION'};}
finally{if(db)await db.close();}
const ok=!failure&&cases.length===27;
console.log(JSON.stringify({stage_step:'FR.2.3_OUTBOX_BODY_CORRECTION_CANDIDATE',result:ok?'OFFLINE_ACTUAL_OUTBOX_CORRECTION_AND_TRIGGER_SCOPED_PASS':'OFFLINE_OUTBOX_CORRECTION_REVIEW',scope:'ACTUAL_CORRECTION_ROLLBACK_AND_KNOWN_TRIGGER_BODIES_IN_MINIMAL_SYNTHETIC_PGLITE_CATALOG_NOT_FULL_MIGRATIONS_OR_GENUINE_AUTH_DISPATCH',engine,node_version:process.version,tests:cases.length,pass:cases.filter(x=>x.result==='PASS').length,fail:cases.filter(x=>x.result==='FAIL').length,exit_code:ok?0:1,cases,failure,file_sha256:Object.fromEntries([installPath,rollbackPath,'scripts/verify-fr-2-outbox-body-correction.mjs'].map(f=>[f,sha(fs.readFileSync(path.join(root,f)))])),hosted_SQL_or_API_calls_run:0,Business_fixtures_created:0,actual_provider_dispatch_run:false,hosted_acceptance:false,findings_closed:[]},null,2));process.exitCode=ok?0:1;
