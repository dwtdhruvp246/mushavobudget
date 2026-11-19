import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "./fixtures/email-session-review-tools/node_modules/@electric-sql/pglite/dist/index.js";
import { OWNER, WORKSPACE, DOCUMENT, PREFIX } from "../supabase/functions/validate-business-bill-payment-proof/scope.mjs";

const db = new PGlite();
const path = PREFIX + "48db369c-4c42-495a-8feb-9843b4a82a26.pdf";
const query = async (text,args = []) => (await db.query(text,args)).rows[0];
const charge = (size,who = OWNER,name = path) => query("select public.fr3_reserve_trial_download($1,$2,$3) as allowed",[who,name,size]);
try {
  await db.exec(`
    create schema mushavo_file_ingest;
    create table mushavo_file_ingest.trial_download_usage (
      user_id uuid primary key, window_started timestamptz not null,
      requests integer not null check (requests between 1 and 2),
      byte_count integer not null check (byte_count between 1 and 4096)
    );
    create table public.business_documents (id uuid primary key, workspace_id uuid, uploaded_by uuid,
      storage_path text, size_bytes bigint, status text);
    create function public.fr3_lifecycle_trial_ready() returns boolean language sql as $$ select false $$;
    create function public.fr3_bill_payment_proof_gate_ready() returns boolean language sql as $$ select true $$;
  `);
  const sql = await readFile(new URL("../supabase/diagnostics/security_fr_3_2_bill_payment_proof_trial.sql",import.meta.url),"utf8");
  const extract = sql.match(/CREATE OR REPLACE FUNCTION public\.fr3_reserve_trial_download\([\s\S]*?\$function\$;/i)?.[0];
  assert.ok(extract,"Expected the authoritative download RPC");
  await db.exec(extract);
  await query("insert into public.business_documents values($1,$2,$3,$4,3000,'active')",[DOCUMENT,WORKSPACE,OWNER,path]);
  assert.equal((await charge(3000,"452ee181-6f46-4125-ad39-e42940bae3d9")).allowed,false);
  assert.equal((await charge(1)).allowed,false);
  assert.equal((await charge(3000,OWNER,path+"0")).allowed,false);
  assert.equal((await charge(3000)).allowed,true);
  assert.equal((await charge(3000)).allowed,false);
  assert.deepEqual(await query("select requests,byte_count from mushavo_file_ingest.trial_download_usage"),{requests:1,byte_count:3000});
  await db.exec("update public.business_documents set size_bytes=791");
  await db.exec("update mushavo_file_ingest.trial_download_usage set window_started=now()-interval '2 minutes 1 second'");
  assert.equal((await charge(791)).allowed,true);
  assert.equal((await charge(791)).allowed,true);
  assert.equal((await charge(791)).allowed,false);
  assert.deepEqual(await query("select requests,byte_count from mushavo_file_ingest.trial_download_usage"),{requests:2,byte_count:1582});
  await db.exec("update public.business_documents set status='archived'");
  assert.equal((await charge(791)).allowed,false);
  console.log(JSON.stringify({result:"DOWNLOAD_BUDGET_SCOPED_POSTGRES_PASS",checks:11,exit_code:0}));
} finally { await db.close(); }
