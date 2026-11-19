import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
if(!process.env.MUSHAVO_PGLITE_MODULE)throw Error('PINNED_PGLITE_MODULE_REQUIRED');
const {PGlite}=await import(pathToFileURL(process.env.MUSHAVO_PGLITE_MODULE).href);
const sql=fs.readFileSync(new URL('../supabase/diagnostics/security_fr_2_5_email_send_retry_time.sql',import.meta.url),'utf8');
let db;
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
const execute=async(email='current@example.invalid')=>{
 const r=await db.exec(sql.replace('OWNER_CONTROLLED_TEST_EMAIL privately','CURRENT_EMAIL privately').replace('OWNER_CONTROLLED_TEST_EMAIL',email));
 return r.flatMap(x=>x.rows||[]).find(x=>x.result)?.result;
};
const events=async(actor,seconds)=>{for(const n of seconds)await db.query("insert into mushavo_email_auth.send_events(user_id,reserved_at) values($1,statement_timestamp()-make_interval(secs=>$2))",[actor,n]);};
const snapshot=async()=>{
 const out={};for(const name of ['auth.users','mushavo_email_auth.account_state','mushavo_email_auth.send_events','mushavo_email_install.rollout_control'])out[name]=(await db.query('select to_jsonb(t)::text value from '+name+' t order by to_jsonb(t)::text')).rows;return out;
};
before(async()=>{
 db=new PGlite();
 await db.exec('create schema auth;create schema mushavo_email_auth;create schema mushavo_email_install;create table auth.users(id uuid primary key,email text);create table mushavo_email_auth.account_state(user_id uuid primary key,next_send_at timestamptz not null default \'-infinity\');create table mushavo_email_auth.send_events(user_id uuid,reserved_at timestamptz not null);create table mushavo_email_install.rollout_control(singleton boolean primary key,target_project text);');
});
beforeEach(async()=>{
 await db.exec("ROLLBACK;delete from mushavo_email_auth.send_events;delete from mushavo_email_auth.account_state;delete from auth.users;delete from mushavo_email_install.rollout_control;insert into mushavo_email_install.rollout_control values(true,'dczlddwbtgvfdujgcitb');");
 await db.query("insert into auth.users values($1,'current@example.invalid'),($2,'other@example.invalid')",[A,B]);
 await db.query('insert into mushavo_email_auth.account_state(user_id) values($1),($2)',[A,B]);
});
after(async()=>{await db?.close();});
test('no reservations and default negative-infinite cooldown are immediately rate-ready without writes',async()=>{
 const before=await snapshot(),r=await execute();assert.equal(r.result,'CODE_REQUEST_RATE_READY');assert.equal(r.retry_after_seconds,0);assert.equal(r.requests_in_rolling_hour,0);assert.equal(r.email_requests,0);assert.equal(r.hosted_acceptance,false);assert.deepEqual(await snapshot(),before);
});
test('four reservations do not consume the hourly fifth slot and account scope is exact',async()=>{
 await events(A,[400,300,200,100]);await events(B,[350,250,150,50,10]);const r=await execute('CURRENT@EXAMPLE.INVALID');assert.equal(r.result,'CODE_REQUEST_RATE_READY');assert.equal(r.requests_in_rolling_hour,4);assert(!JSON.stringify(r).includes(A));
});
test('five reservations wait until the oldest counted reservation expires, preserving all counters',async()=>{
 await events(A,[3000,2500,2000,1500,1000]);const before=await snapshot(),r=await execute();assert.equal(r.result,'CODE_REQUEST_RATE_WAIT');assert.equal(r.requests_in_rolling_hour,5);assert(r.retry_after_seconds>=598&&r.retry_after_seconds<=600);assert.deepEqual(await snapshot(),before);
});
test('overflow reservations use the fifth newest event rather than releasing too early',async()=>{
 await events(A,[3500,3000,2500,2000,1500,1000]);const r=await execute();assert.equal(r.result,'CODE_REQUEST_RATE_WAIT');assert(r.retry_after_seconds>=598&&r.retry_after_seconds<=600);
});
test('events older than the rolling-hour boundary no longer reserve slots',async()=>{
 await events(A,[4000,3600,300,200,100,90]);const r=await execute();assert.equal(r.requests_in_rolling_hour,4);assert.equal(r.result,'CODE_REQUEST_RATE_READY');
});
test('the later of account resend cooldown and hourly quota determines the retry time',async()=>{
 await events(A,[3500,3400,3300,3200,3100]);await db.query("update mushavo_email_auth.account_state set next_send_at=statement_timestamp()+interval '180 seconds' where user_id=$1",[A]);const r=await execute();assert(r.retry_after_seconds>=178&&r.retry_after_seconds<=180);
});
test('missing or duplicate account and wrong staging target return fixed review results',async()=>{
 assert.equal((await execute('missing@example.invalid')).result,'RATE_TARGET_OR_ACCOUNT_REVIEW_REQUIRED');
 await db.query("insert into auth.users values('00000000-0000-4000-8000-000000000003','CURRENT@example.invalid')");assert.equal((await execute()).result,'RATE_TARGET_OR_ACCOUNT_REVIEW_REQUIRED');
 await db.exec("delete from auth.users where id='00000000-0000-4000-8000-000000000003';update mushavo_email_install.rollout_control set target_project='foreign'");
 assert.equal((await execute()).result,'RATE_TARGET_OR_ACCOUNT_REVIEW_REQUIRED');
});
test('infinite retry data stays a fixed review result and local-time output is Johannesburg time',async()=>{
 await db.query("update mushavo_email_auth.account_state set next_send_at='infinity' where user_id=$1",[A]);assert.equal((await execute()).result,'RATE_TIME_REVIEW_REQUIRED');
 await db.query("update mushavo_email_auth.account_state set next_send_at=statement_timestamp()+interval '60 seconds' where user_id=$1",[A]);
 const r=await execute(),expected=(await db.query("select (next_send_at at time zone 'Africa/Johannesburg')::text value from mushavo_email_auth.account_state where user_id=$1",[A])).rows[0].value;
 assert.equal(new Date(r.retry_at_africa_johannesburg).getTime(),new Date(expected).getTime());assert(r.retry_after_seconds>=58&&r.retry_after_seconds<=60);
});

