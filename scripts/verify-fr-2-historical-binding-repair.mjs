import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {localDatabase} from './lib/stage-3-local-db.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sourceSQL=fs.readFileSync(path.join(root,'supabase/remediation/security_fr_2_2_historical_binding_repair.sql'),'utf8');
const uid=n=>'f1000000-0000-4000-8000-'+String(n).padStart(12,'0');
const item=n=>'f2000000-0000-4000-8000-'+String(n).padStart(12,'0');
const rec=n=>'f3000000-0000-4000-8000-'+String(n).padStart(12,'0');
const cases=[];let db,migrations,engine,failure;
const check=async(title,fn)=>{try{await fn();cases.push({title,result:'PASS'});}catch(e){cases.push({title,result:'FAIL'});throw e;}};
const owner=async n=>db.exec(`select set_config('request.jwt.claim.sub','${uid(n)}',false);select set_config('request.jwt.claim.role','authenticated',false);select set_config('request.jwt.claims','{"sub":"${uid(n)}","role":"authenticated"}',false)`);
const state=async()=> (await db.query(`select jsonb_build_object('items',(select jsonb_agg(to_jsonb(i) order by id) from payment_items i),'records',(select jsonb_agg(to_jsonb(r) order by id) from payment_records r),'conversions',(select jsonb_agg(to_jsonb(c) order by id) from payment_conversions c)) value`)).rows[0].value;
try{
 ({db,migrations}=await localDatabase(process.argv[2]));engine=(await db.query('select version() value')).rows[0].value;await db.exec("set time zone 'UTC'");
 await db.exec(`insert into auth.users(id,email,raw_user_meta_data) values('${uid(1)}','audit.owner@example.com','{}'),('${uid(2)}','audit.outsider@example.com','{}')`);
 const ws=(await db.query("select id,owner_id from budget_workspaces where workspace_type='personal'")).rows;const w=n=>ws.find(x=>x.owner_id===uid(n)).id;
 for(let n=1;n<=5;n++){
  const actor=n===3||n===5?2:1;await owner(actor);
  await db.exec(`insert into payment_items(id,owner_id,created_by,name,workspace_id,family_id,visibility,status,amount,currency,recurrence_type,start_date,notes,created_at) values('${item(n)}','${uid(actor)}','${uid(actor)}','${n===1?'AUDIT-S321-00000000-0000-4000-8000-000000000001-0':'Retained-'+n}','${w(actor)}',null,'personal','inactive',1,'USD','once','2026-10-10','Synthetic permitted update','2026-10-10T17:18:59.686741Z');insert into payment_records(id,owner_id,recorded_by,payment_item_id,workspace_id,family_id,visibility,amount,currency,period_start,due_date,payment_date,payment_method,notes,created_at) values('${rec(n)}','${uid(actor)}','${uid(actor)}','${item(n)}','${w(actor)}',null,'personal',1,'USD','2026-10-10','2026-10-10','2026-10-10','Other','Synthetic permitted paid update','2026-10-10T17:19:00.948861Z')`);
 }
 await owner(1);await db.exec(`update payment_records set workspace_id='${w(2)}' where id='${rec(1)}'`);
 await db.exec('create or replace trigger sync_payment_record_workspace_trigger before insert or update of payment_item_id,workspace_id on payment_records for each row execute function sync_payment_record_workspace()');
 await db.exec(`update payment_conversions set rate_provider='manual',rate_source='manual',entered_by='${uid(1)}' where entity_type='payment_record' and entity_id='${rec(2)}';update payment_conversions set rate_provider='manual',rate_source='manual',entered_by='${uid(2)}' where entity_type='payment_record' and entity_id='${rec(3)}';insert into payment_conversions(entity_type,entity_id,workspace_id,original_amount,original_currency,reporting_currency,exchange_rate,converted_amount,rate_effective_at,rate_provider,rate_source,is_locked) values('payment_record','${rec(901)}','${w(1)}',1,'USD','USD',1,1,now(),'identity','identity',true),('payment_record','${rec(902)}','${w(2)}',1,'USD','USD',1,1,now(),'identity','identity',true);select set_config('request.jwt.claim.sub','',false);select set_config('request.jwt.claim.role','',false);select set_config('request.jwt.claims','',false)`);
 const original=await state();
 const fingerprint=async table=> (await db.query(`select encode(sha256(convert_to(to_jsonb(x)::text,'UTF8')),'hex') value from ${table} x where id='${table==='payment_records'?rec(1):item(1)}'`)).rows[0].value;
 await db.exec("set time zone 'UTC'");
 const rHash=await fingerprint('payment_records'),iHash=await fingerprint('payment_items');
 const sql=sourceSQL.replace('a75141260231d3a916ec2f0bf5a815437dd5b9cacfdde1fd659ff206f3e06615',rHash).replace('b805cc76f30048fbd07060f1d9a8467e72d8f18f03c4c7325dbfd409b4a79eea',iHash);
 async function rejected(mutate,expected,alternateSQL=sql){await db.exec('begin');try{await owner(1);await mutate();try{await db.exec(alternateSQL);assert.fail('Unsafe repair accepted');}catch(e){assert.notEqual(e.code,'ERR_ASSERTION');if(expected)assert.equal(e.message,expected);await db.exec('rollback');}assert.deepEqual(await state(),original);}catch(e){await db.exec('rollback');throw e;}}
 await check('changed target full-row fingerprint rejects',()=>rejected(()=>db.exec(`update payment_records set notes='Changed target' where id='${rec(1)}'`),'EXACT_HISTORICAL_RECORD_OR_PARENT_CHANGED'));
 await check('changed parent fingerprint rejects',()=>rejected(()=>db.exec(`update payment_items set notes='Changed parent' where id='${item(1)}'`),'EXACT_HISTORICAL_RECORD_OR_PARENT_CHANGED'));
 await check('missing linked conversion stops repair',()=>rejected(()=>db.exec(`delete from payment_conversions where entity_type='payment_record' and entity_id='${rec(1)}'`),'HISTORICAL_LINKAGE_NO_LONGER_REVIEWED_SHAPE'));
 await check('linked conversion drift to wrong workspace stops repair',()=>rejected(()=>db.exec(`update payment_conversions set workspace_id='${w(2)}' where entity_type='payment_record' and entity_id='${rec(1)}'`),'HISTORICAL_LINKAGE_NO_LONGER_REVIEWED_SHAPE'));
 await check('extra workspace update trigger rejects',()=>rejected(()=>db.exec('create function repair_extra() returns trigger language plpgsql as $$begin return new;end;$$;create trigger repair_extra before update on payment_records for each row execute function repair_extra()'),'UNREVIEWED_REPAIR_UPDATE_TRIGGERS'));
 await check('old sync coverage rejects rather than bypasses',()=>rejected(()=>db.exec('create or replace trigger sync_payment_record_workspace_trigger before insert or update of payment_item_id on payment_records for each row execute function sync_payment_record_workspace()'),'UNREVIEWED_REPAIR_UPDATE_TRIGGERS'));
 await check('finance guard function drift rejects',()=>rejected(()=>db.exec('create or replace function guard_workspace_finance_write() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin return new;end;$$'),'UNREVIEWED_REPAIR_UPDATE_GUARD'));
 await check('ordinary SQL role rejected',()=>rejected(()=>db.exec('set local role authenticated')));
 await check('non-origin session rejected',()=>rejected(()=>db.exec("set local session_replication_role='replica'"),'REPAIR_REQUIRES_PRIVILEGED_ORIGIN_SQL_EDITOR'));
 await check('suspended fixture owner normal guard prevents update',()=>rejected(async()=>{await db.exec(`select set_config('request.jwt.claim.role','service_role',true);update profiles set account_status='suspended' where id='${uid(1)}'`);await owner(1);},'ACCOUNT_SUSPENDED'));
 await check('actual guarded repair changes only one workspace and preserves all conversions, orphans and other payment rows',async()=>{await db.exec(sql);const after=await state();assert.deepEqual(after.items,original.items);assert.deepEqual(after.conversions,original.conversions);assert.deepEqual(after.records,original.records.map(x=>x.id===rec(1)?{...x,workspace_id:w(1)}:x));assert.equal(after.conversions.filter(x=>x.rate_provider==='manual').length,2);assert.equal(after.conversions.filter(x=>[rec(901),rec(902)].includes(x.entity_id)).length,2);assert.equal((await db.query("select current_setting('request.jwt.claim.sub',true) value")).rows[0].value,'');});
 await check('replay stops without broadening target',async()=>{const before=await state();try{await db.exec(sql);assert.fail('Replay accepted');}catch(e){assert.equal(e.message,'EXACT_HISTORICAL_RECORD_OR_PARENT_CHANGED');await db.exec('rollback');}assert.deepEqual(await state(),before);});
}catch(e){failure={code:e.code??'ASSERTION',problem:e.message};}
finally{if(db)await db.close();}
const pass=cases.filter(x=>x.result==='PASS').length;console.log(JSON.stringify({stage_step:'FR.2.2_EXACT_HISTORICAL_BINDING_REPAIR_CANDIDATE',scope:'GUARDED_REPAIR_SQL_WITH_ONLY_TWO_OWNER_ROW_HASH_LITERALS_SUBSTITUTED_FOR_SYNTHETIC_FIXTURE_HASHES_IN_FULL_SOURCE_PGLITE_CATALOG_NOT_HOSTED_AUTH_OR_POSTGRESQL17',engine,source_migrations_compiled:migrations?.length??0,node_version:process.version,tests:cases.length,pass,fail:cases.length-pass,exit_code:failure?1:0,query_sha256:createHash('sha256').update(sourceSQL).digest('hex'),cases,failure,manual_rows_scope:'TWO_PERSONAL_MANUAL_STANDINS_NOT_REAL_FAMILY_BASELINE',hosted_requests_run:0,hosted_acceptance:false},null,2));process.exitCode=failure?1:0;
