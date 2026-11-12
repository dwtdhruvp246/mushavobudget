// Run the exact candidate gate in disposable PostgreSQL with modeled existing policies.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "./fixtures/email-session-review-tools/node_modules/@electric-sql/pglite/dist/index.js";
import { FIXTURE_ID } from "../supabase/functions/validate-business-logo/handler.mjs";

const sql = await readFile(new URL("../supabase/diagnostics/security_fr_3_2_logo_fixture_upload_gate.sql", import.meta.url), "utf8");
const db = new PGlite();
const scopedPath = FIXTURE_ID + "/owner/logo.png";
const outsidePath = "other/owner/logo.png";
const denied = error => error.code === "42501";
const insert = (bucket, path) => db.query("insert into storage.objects values ($1,$2)", [bucket, path]);
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema storage;
    create table storage.objects(bucket_id text not null, name text not null, primary key(bucket_id,name));
    create table public.budget_workspaces(id uuid primary key, name text, workspace_type text);
    create table public.business_profiles(workspace_id uuid, logo_storage_path text);
    grant usage on schema storage to anon, authenticated, service_role;
    grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
    alter table storage.objects enable row level security;
    create policy modeled_existing_access on storage.objects for all to authenticated, anon using (true) with check (true);
  `);
  await assert.rejects(db.exec(sql), /FR3_LOGO_FIXTURE_NOT_EMPTY_OR_MISSING/);
  await db.exec("rollback");
  await db.query("insert into public.budget_workspaces values($1,'audit-fr3-logo-ingestion-20261112','business')", [FIXTURE_ID]);
  await db.query("insert into public.business_profiles values($1,null)", [FIXTURE_ID]);
  await insert("business-logos", scopedPath);
  await assert.rejects(db.exec(sql), /FR3_LOGO_FIXTURE_NOT_EMPTY_OR_MISSING/);
  await db.exec("rollback");
  await db.query("delete from storage.objects where name=$1", [scopedPath]);
  await db.exec(sql);

  await db.exec("set role authenticated");
  await assert.rejects(insert("business-logos", scopedPath), denied);
  await insert("business-logos", outsidePath);
  await insert("payment-proofs", scopedPath);
  await assert.rejects(db.query("update storage.objects set name=$1 where name=$2", [scopedPath, outsidePath]), denied);
  await db.exec("set role anon");
  await assert.rejects(insert("business-logos", scopedPath), denied);
  await db.exec("set role service_role");
  await insert("business-logos", scopedPath);
  await db.exec("set role authenticated");
  assert.equal((await db.query("update storage.objects set name='other/renamed.png' where bucket_id='business-logos' and name=$1", [scopedPath])).affectedRows, 0);
  assert.equal((await db.query("delete from storage.objects where bucket_id='business-logos' and name=$1", [scopedPath])).affectedRows, 1);
  console.log(JSON.stringify({ result: "LOCAL_LOGO_FIXTURE_GATE_PASS", hosted: false, exit_code: 0 }));
} finally {
  await db.close();
}
