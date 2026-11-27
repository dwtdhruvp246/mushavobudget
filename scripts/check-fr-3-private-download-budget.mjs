import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "./fixtures/email-session-review-tools/node_modules/@electric-sql/pglite/dist/index.js";

const db = new PGlite();
const first = "abc41049-4bc2-4d5e-af65-4987257cebaf";
const second = "7c0af494-b30e-428f-bc2a-bc1067911381";
const files = [
  ["business-logos", "logo/a.png", 100],
  ["business-documents", "document/a.pdf", 10485760],
  ["payment-proofs", "personal/a.pdf", 10485760],
  ["subscription-proofs", "subscription/a.pdf", 10485760],
];
const last = user => db.query("select requests,byte_count from mushavo_file_ingest.private_download_usage where user_id=$1",[user]);
const charge = async (user, [bucket,path,size]) => (await db.query(
  "select public.reserve_private_file_download($1,$2,$3,$4) as ok",[user,bucket,path,size]
)).rows[0].ok;
const reset = async () => db.exec("update mushavo_file_ingest.private_download_usage set window_started=now()-interval '2 minutes'");

try {
  await db.exec("create role anon; create role authenticated; create role service_role; create schema auth; create schema storage; create schema mushavo_file_ingest; create table auth.users(id uuid primary key); create table storage.objects(bucket_id text,name text,metadata jsonb)");
  await db.query("insert into auth.users values ($1),($2)",[first,second]);
  for (const [bucket,path,size] of files) {
    await db.query("insert into storage.objects values ($1,$2,jsonb_build_object('size',$3::integer))",[bucket,path,size]);
  }
  const q = await readFile(new URL("../supabase/diagnostics/security_fr_3_2_private_download_budget_staging.sql",import.meta.url),"utf8");
  const block = q.match(/create table mushavo_file_ingest\.private_download_usage[\s\S]*?grant execute on function public\.reserve_private_file_download\(uuid,text,text,integer\) to service_role;/)?.[0];
  assert.ok(block);
  await db.exec(block);
  const grants = await db.query("select has_function_privilege('authenticated','public.reserve_private_file_download(uuid,text,text,integer)','EXECUTE') as public_call,has_function_privilege('service_role','public.reserve_private_file_download(uuid,text,text,integer)','EXECUTE') as server_call");
  assert.deepEqual(grants.rows,[{public_call:false,server_call:true}]);
  assert.equal(await charge(first, ["business-logos","logo/a.png",101]),false);
  assert.equal(await charge(first, ["public","logo/a.png",100]),false);
  assert.equal(await charge(first, ["payment-proofs","personal/unavailable.pdf",100]),false);
  for (const file of files) assert.equal(await charge(first,file),true);
  assert.equal((await last(first)).rows[0].requests,4);
  assert.equal((await last(first)).rows[0].byte_count,31457380);
  for (const index of [1,2,3]) assert.equal(await charge(first,files[index]),true);
  assert.equal(await charge(first,files[1]),false);
  assert.equal(await charge(second,files[1]),true);
  await reset();
  for (let count=0; count<60; count++) assert.equal(await charge(first,files[0]),true);
  assert.equal(await charge(first,files[0]),false);
  assert.deepEqual((await last(first)).rows,[{requests:60,byte_count:6000}]);
  await reset();
  assert.equal(await charge(first,files[0]),true);
  assert.deepEqual((await last(first)).rows,[{requests:1,byte_count:100}]);
  console.log("Shared download limits pass across all four private buckets");
} finally {await db.close();}
