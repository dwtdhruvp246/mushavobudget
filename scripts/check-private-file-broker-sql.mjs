// Actual migration SQL with modeled existing ACL/session helpers in local
// PostgreSQL. This is not a genuine hosted JWT or CDN acceptance test.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from './fixtures/email-session-review-tools/node_modules/@electric-sql/pglite/dist/index.js';
const db = new PGlite(); let checks = 0;
const actor = '00000000-0000-4000-8000-000000000001';
const foreign = '00000000-0000-4000-8000-000000000002';
const buckets = ['payment-proofs', 'subscription-proofs', 'business-documents', 'business-logos'];
const rpc = await readFile(new URL('../supabase/migrations/20261108080556_private_file_download_context.sql', import.meta.url), 'utf8');
const policy = await readFile(new URL('../supabase/migrations/20261108080559_private_file_broker_only.sql', import.meta.url), 'utf8');
const check = (actual, expected, name) => { assert.equal(actual, expected, name); checks++; };
const count = async (bucket, name) => Number((await db.query('select count(*) n from public.private_file_download_context($1,$2)', [bucket, name])).rows[0].n);
const set = async (key, value) => db.query('select set_config($1,$2,false)', [key, value]);
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema storage;
    create table storage.objects(id uuid primary key,bucket_id text,name text,version text,updated_at timestamptz,metadata jsonb,owner_uid uuid);
    create function public.app_session_status() returns jsonb language sql stable as $$select jsonb_build_object('session_valid',current_setting('test.session_valid',true)='true')$$;
    create function storage.allow_any_operation(expected_operations text[]) returns boolean language sql stable as $$
      select regexp_replace(current_setting('storage.operation',true),'^storage\\.','') = any(expected_operations) $$;
    grant usage on schema public,storage to authenticated;
    grant select on storage.objects to authenticated;
    alter table storage.objects enable row level security;
    create policy modeled_existing_owner_or_member on storage.objects for select to authenticated using (
      owner_uid::text=current_setting('test.actor',true) or current_setting('test.member',true)='true');
    create policy modeled_existing_session on storage.objects as restrictive for all to authenticated using (
      current_setting('test.session_valid',true)='true');
    create policy modeled_existing_document_parent on storage.objects as restrictive for select to authenticated using (
      bucket_id<>'business-documents' or current_setting('test.parent_visible',true)='true');`);
  await db.exec(rpc); await db.exec(policy);
  for (const [index, bucket] of buckets.entries()) await db.query(`insert into storage.objects values($1,$2,$3,'v1',now(),$4,$5)`,
    ['00000000-0000-4000-8000-' + String(index + 10).padStart(12,'0'), bucket, 'personal/'+actor+'/file.png', JSON.stringify({ size: 68, mimetype: 'image/png', eTag: 'fixture' }), actor]);
  await set('test.actor',actor); await set('test.session_valid','true'); await set('test.member','false'); await set('test.parent_visible','true');
  await set('request.path','/rpc/private_file_download_context'); await set('storage.operation','');
  await db.exec('set role authenticated');
  for (const bucket of buckets) check(await count(bucket,'personal/'+actor+'/file.png'),1,bucket+' invoker intersects allowed owner');
  check(await count('other','personal/'+actor+'/file.png'),0,'unknown bucket');
  check(await count(buckets[0],'missing'),0,'missing object');
  await set('test.actor',foreign);
  for (const bucket of buckets) check(await count(bucket,'personal/'+actor+'/file.png'),0,bucket+' foreign denied');
  await set('test.member','true'); check(await count(buckets[0],'personal/'+actor+'/file.png'),1,'modeled active Family member');
  await set('test.member','false'); check(await count(buckets[0],'personal/'+actor+'/file.png'),0,'same modeled session removed');
  await set('test.actor',actor); await set('test.parent_visible','false');
  check(await count('business-documents','personal/'+actor+'/file.png'),0,'existing archived/parent guard remains restrictive');
  await set('test.parent_visible','true'); await set('test.session_valid','false');
  for (const bucket of buckets) check(await count(bucket,'personal/'+actor+'/file.png'),0,bucket+' current session invalid');
  await set('test.session_valid','true'); await set('request.path','/object/authenticated/payment-proofs/file');
  for (const operation of ['object.get_authenticated','storage.object.get_authenticated','object.sign','object.sign_many','render.image_authenticated','render.image_sign','s3.object.get','unknown.future.operation','']) {
    await set('storage.operation',operation);
    check(Number((await db.query('select count(*) n from storage.objects')).rows[0].n),0,'bytes/signing denied: '+operation);
  }
  for (const operation of ['object.list','object.list_v2','object.get_authenticated_info','object.head_authenticated_info','object.info_authenticated','object.upload','object.upload_update','object.delete','object.delete_many','object.copy','object.move']) {
    await set('storage.operation','storage.'+operation);
    check(Number((await db.query('select count(*) n from storage.objects')).rows[0].n),4,'authorized metadata/mutation SELECT preserved: '+operation);
  }
  await set('test.actor',foreign); await set('storage.operation','object.delete');
  check(Number((await db.query('select count(*) n from storage.objects')).rows[0].n),0,'mutation allowance does not bypass existing ACL');
  await db.exec('reset role');
  const grants = (await db.query(`select has_function_privilege('anon','public.private_file_download_context(text,text)','execute') a,
    has_function_privilege('authenticated','public.private_file_download_context(text,text)','execute') u,
    has_function_privilege('service_role','public.private_file_download_context(text,text)','execute') s,
    (select prosecdef from pg_proc where oid='public.private_file_download_context(text,text)'::regprocedure) d`)).rows[0];
  check(grants.a,false,'anon cannot execute'); check(grants.u,true,'authenticated can execute');
  check(grants.s,false,'service cannot use invoker RPC'); check(grants.d,false,'invoker retained');
  await db.query(`update storage.objects set metadata=$1 where bucket_id='payment-proofs'`,[JSON.stringify({size:'not-numeric',mimetype:'image/png'})]);
  await set('test.actor',actor); await set('request.path','/rpc/private_file_download_context'); await set('storage.operation',''); await db.exec('set role authenticated');
  check(await count('payment-proofs','personal/'+actor+'/file.png'),0,'malformed size safely denied');
  console.log(JSON.stringify({ scope:'LOCAL_ACTUAL_MIGRATION_SQL_MODELED_EXISTING_ACL_HELPERS', checks, pass:checks, fail:0, hosted_acceptance:false, exit_code:0 }));
} finally { await db.close(); }
