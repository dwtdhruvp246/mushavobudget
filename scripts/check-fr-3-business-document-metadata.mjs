import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "./fixtures/email-session-review-tools/node_modules/@electric-sql/pglite/dist/index.js";

const db = new PGlite();
const run = (sql, values) => db.query(sql, values);
const workspace = "10000000-0000-4000-8000-000000000000";
const document = "20000000-0000-4000-8000-000000000000";
const owner = "30000000-0000-4000-8000-000000000000";
const path = `workspaces/${workspace}/${owner}/${document}/receipt.pdf`;
const register = (mime = "application/pdf", size = 791) => run(
  "select (public.register_business_document($1,$2,'workspace',$2,$3,'receipt.pdf',$4,$5)).id",
  [document, workspace, path, mime, size]
);
try {
  await db.exec(`
    create schema auth;
    create schema storage;
    create schema mushavo_email_auth;
    create function auth.uid() returns uuid language sql stable as $$select '${owner}'::uuid$$;
    create function mushavo_email_auth.require_application_session() returns void language plpgsql as $$begin return; end$$;
    create function public.business_claims_active(uuid) returns boolean language sql as $$select true$$;
    create function public.business_has_permission(uuid,text) returns boolean language sql as $$select true$$;
    create function public.business_record_audit_event(uuid,text,text,uuid,jsonb,jsonb) returns uuid language sql as $$select $4$$;
    create table public.business_expense_claims(id uuid, workspace_id uuid, submitted_by uuid, status text);
    create table public.business_documents (
      id uuid primary key, workspace_id uuid, parent_type text, parent_id uuid, storage_path text,
      original_name text, mime_type text, size_bytes bigint, checksum_sha256 text, uploaded_by uuid
    );
    create table storage.objects(bucket_id text, name text, metadata jsonb, primary key (bucket_id,name));
  `);
  const migration = await readFile(new URL("../supabase/diagnostics/security_fr_3_2_business_document_metadata.sql", import.meta.url), "utf8");
  const start = migration.indexOf("CREATE OR REPLACE FUNCTION public.register_business_document(");
  const end = migration.indexOf("\ncreate policy fr3_business_document_server_insert", start);
  assert.ok(start >= 0 && end > start, "expected exact registration function");
  await db.exec(migration.slice(start, end));
  await assert.rejects(register(), /BUSINESS_DOCUMENT_UPLOAD_NOT_FOUND/);
  let failures = 1;
  const put = metadata => run(
    "insert into storage.objects values ('business-documents',$1,$2::jsonb) on conflict (bucket_id,name) do update set metadata=excluded.metadata",
    [path, JSON.stringify(metadata)]
  );
  for (const metadata of [
    {}, { size: 791 }, { mimetype: "application/pdf" },
    { mimetype: "application/pdf", size: "unknown" },
    { mimetype: "application/pdf", size: 10485761 },
    { mimetype: "application/pdf", size: 792 },
    { mimetype: "image/png", size: 791 },
  ]) {
    await put(metadata);
    await assert.rejects(register(), /BUSINESS_DOCUMENT_METADATA_MISMATCH/);
    failures++;
  }
  for (const [mime, size] of [["application/pdf", 791], ["image/png", 68], ["text/csv", 20],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 4050]]) {
    await put({ mimetype: mime, contentLength: size });
    assert.equal((await register(mime,size)).rows[0].id, document);
    await run("delete from public.business_documents where id=$1", [document]);
  }
  console.log(JSON.stringify({ rejected_cases: failures, matching_formats: 4, exit_code: 0 }));
} finally {
  await db.close();
}
