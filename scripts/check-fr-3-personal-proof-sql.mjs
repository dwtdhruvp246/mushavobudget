import assert from "node:assert/strict";
import { PGlite } from "./fixtures/email-session-review-tools/node_modules/@electric-sql/pglite/dist/index.js";
import { readFile } from "node:fs/promises";
import { WORKSPACE, OWNER, PAYMENT_ITEM, PREFIX } from "../supabase/functions/validate-payment-proof/handler.mjs";
const db = new PGlite();
const sql = await readFile(new URL("../supabase/diagnostics/security_fr_3_2_personal_proof_upload_gate.sql", import.meta.url), "utf8");
const path = PREFIX + "11111111-1111-4111-8111-111111111111.png";
const alternateItem = "22222222-2222-4222-8222-222222222222";
const addRecord = (item, object, size = 70) => db.query(
  "insert into public.payment_records values ($1,$2,$2,$3,'personal',null,$4,'fixture.png','image/png',$5)",
  [item, OWNER, WORKSPACE, object, size]);
const insertObject = name => db.query("insert into storage.objects values('payment-proofs',$1,'{\"mimetype\":\"image/png\",\"size\":70}')", [name]);
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema storage; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select current_setting('test.uid',true)::uuid$$;
    create table storage.objects(bucket_id text not null, name text not null, metadata jsonb, primary key(bucket_id,name));
    create table public.budget_workspaces(id uuid primary key, owner_id uuid, workspace_type text, status text);
    create table public.payment_items(id uuid primary key, owner_id uuid, workspace_id uuid, visibility text, family_id uuid, status text);
    create table public.payment_records(payment_item_id uuid, owner_id uuid, recorded_by uuid, workspace_id uuid, visibility text, family_id uuid,
      proof_path text, proof_name text, proof_mime_type text, proof_size_bytes bigint);
    grant usage on schema storage,auth to anon, authenticated, service_role;
    grant all on storage.objects to authenticated, service_role;
    grant select,insert,delete on public.payment_records to authenticated;
    grant select on public.payment_items to authenticated,service_role;
    grant select on public.budget_workspaces to service_role;
    alter table storage.objects enable row level security;
    create policy modeled_owner on storage.objects for all to authenticated using (true) with check (true);
  `);
  await db.query("insert into public.budget_workspaces values($1,$2,'personal','active')", [WORKSPACE, OWNER]);
  await db.exec(sql);
  await db.exec("set role service_role");
  assert.equal((await db.query("select fr3_personal_proof_gate_ready() ready")).rows[0].ready, false);
  await db.exec("reset role");
  await db.query("insert into public.payment_items values($1,$2,$3,'personal',null,'active')", [PAYMENT_ITEM, OWNER, WORKSPACE]);
  await db.query("select set_config('test.uid',$1,false)", [OWNER]);
  await db.exec("set role authenticated");
  await assert.rejects(insertObject(path), { code: "42501" });
  await insertObject("personal/" + OWNER + "/regular.png");
  await assert.rejects(addRecord(PAYMENT_ITEM, path), /FR3_PROOF_STORAGE_METADATA_MISMATCH/);
  await assert.rejects(addRecord(alternateItem, path), /FR3_PROOF_WRONG_PAYMENT_ITEM/);
  await db.exec("set role service_role");
  assert.equal((await db.query("select fr3_personal_proof_gate_ready() ready")).rows[0].ready, true);
  await insertObject(path);
  await db.exec("set role authenticated");
  await assert.rejects(addRecord(PAYMENT_ITEM, path, 71), /FR3_PROOF_STORAGE_METADATA_MISMATCH/);
  assert.equal((await addRecord(PAYMENT_ITEM, path)).affectedRows, 1);
  assert.equal((await db.query("delete from storage.objects where name=$1", [path])).affectedRows, 0);
  await db.exec("delete from public.payment_records; reset role");
  await db.query("delete from public.payment_items where id=$1", [PAYMENT_ITEM]);
  await db.exec("set role authenticated");
  assert.equal((await db.query("delete from storage.objects where name=$1", [path])).affectedRows, 1);
  await db.exec("set role service_role");
  assert.equal((await db.query("select fr3_personal_proof_gate_ready() ready")).rows[0].ready, false);
  console.log(JSON.stringify({ result: "PERSONAL_PROOF_SQL_SCOPE_PASS", exit_code: 0 }));
} finally { await db.close(); }
