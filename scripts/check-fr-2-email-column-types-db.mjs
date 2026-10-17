import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const {PGlite}=await import(pathToFileURL(process.env.MUSHAVO_EMAIL_UI_PGLITE));
const db=new PGlite();test.after(()=>db.close());
await db.exec('create role authenticated;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,encrypted_password text,banned_until timestamptz);create table auth.sessions(id uuid,user_id uuid,not_after timestamptz);create table public.profiles(id uuid,account_status text);');
const sql=await readFile(path.join(root,'supabase/diagnostics/security_fr_2_4_email_required_column_types.sql'),'utf8');
async function run(){try{const rs=await db.exec(sql);return rs.find(x=>x.rows?.[0]?.email_required_column_type_review).rows[0].email_required_column_type_review;}catch(e){await db.exec('rollback');throw e;}}
test('Actual read-only query returns exactly nine exact modeled column types',async()=>{
 const x=await run();assert.equal(x.required_columns,9);assert.equal(x.present_columns,9);assert.equal(x.exact_type_matches,9);assert.equal(x.missing_columns,0);assert.equal(x.present_but_different_type,0);assert.equal(x.transaction_read_only,'on');assert.equal(x.result,'ALL_NINE_EXACT_TYPES_MATCH_NOT_INSTALLATION_APPROVAL');
});
test('A varchar password field is reported with its typmod without declaring compatibility',async()=>{
 try{await db.exec('alter table auth.users alter column encrypted_password type varchar(255)');const x=await run();assert.equal(x.exact_type_matches,8);assert.equal(x.present_but_different_type,1);assert.equal(x.missing_columns,0);const row=x.column_details.find(x=>x.column_name==='encrypted_password');assert.equal(row.actual_type_name,'varchar');assert.equal(row.actual_formatted_type,'character varying(255)');assert.equal(row.matches_exact_expected_type,false);assert.equal(x.type_compatibility_or_hosted_authorization_accepted,false);}
 finally{await db.exec('alter table auth.users alter column encrypted_password type text');}
});
test('Missing columns remain explicit and do not become type mismatches',async()=>{
 try{await db.exec('alter table auth.sessions rename column not_after to fixture_absent');const x=await run();assert.equal(x.present_columns,8);assert.equal(x.missing_columns,1);assert.equal(x.present_but_different_type,0);assert.equal(x.column_details.find(x=>x.column_name==='not_after').column_present,false);}
 finally{await db.exec('alter table auth.sessions rename column fixture_absent to not_after');}
});
test('A domain is reported separately from its immediate base type',async()=>{
 try{await db.exec('create domain public.fixture_status as text;alter table public.profiles alter column account_status type public.fixture_status');const x=await run();const row=x.column_details.find(x=>x.column_name==='account_status');assert.equal(row.type_kind,'d');assert.deepEqual(row.immediate_domain_base_type,{schema:'pg_catalog',name:'text'});assert.equal(row.matches_exact_expected_type,false);}
 finally{await db.exec('alter table public.profiles alter column account_status type text;drop domain public.fixture_status');}
});
test('Private row values are absent from results and settings/catalog remain unchanged',async()=>{
 await db.query('insert into auth.users(id,encrypted_password) values($1,$2)',['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','PRIVATE_PASSWORD_SENTINEL']);
 const snapshot=async()=>JSON.stringify((await db.query('select (select jsonb_agg(to_jsonb(a) order by attrelid,attnum) from pg_attribute a) attributes,(select jsonb_agg(to_jsonb(t) order by oid) from pg_type t) types,(select jsonb_agg(to_jsonb(u) order by id) from auth.users u) private_fixture')).rows);
 const before=await snapshot(),settings=(await db.query("select current_setting('search_path') path,current_setting('statement_timeout') timeout,current_setting('TimeZone') zone")).rows;
 const x=await run();assert(!JSON.stringify(x).includes('PRIVATE_PASSWORD_SENTINEL'));assert(!JSON.stringify(x).includes('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'));assert.equal(x.application_rows_read,false);assert.equal(await snapshot(),before);assert.deepEqual((await db.query("select current_setting('search_path') path,current_setting('statement_timeout') timeout,current_setting('TimeZone') zone")).rows,settings);
});
test('The ordinary role is refused before metadata collection',async()=>{
 try{await db.exec('set role authenticated');await assert.rejects(run(),/EMAIL_COLUMN_REVIEW_REQUIRES_PRIVILEGED_SQL_EDITOR/);}
 finally{await db.exec('rollback;reset role');}
});
