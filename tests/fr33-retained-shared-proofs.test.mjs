import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { PGlite } from '../scripts/fixtures/email-session-review-tools/node_modules/@electric-sql/pglite/dist/index.js';

const migration = await readFile(new URL(
  '../supabase/migrations/20261116190818_fr33_retain_shared_proof_files.sql', import.meta.url
), 'utf8');

test('shared proof detachment verifies the object, scope and content metadata', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const ids = Array.from({ length: 15 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
  const [subject, owner, request, business, familyWorkspace, family, claim, attachment,
    payment, claimFile, familyFile, removed, billPayment, billAttachment, billFile] = ids;
  const claimPath = `workspaces/${business}/managed-upload-v1/${attachment}.pdf`;
  const familyPath = `families/${family}/managed-upload-v1/${payment}.pdf`;
  const removedPath = `personal/${subject}/managed-upload-v1/${removed}.pdf`;
  const billPath = `workspaces/${business}/managed-upload-v1/${billAttachment}.pdf`;

  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA storage;
    CREATE SCHEMA mushavo_account_deletion;
    CREATE SCHEMA mushavo_file_ingest;
    CREATE TABLE storage.objects (id uuid PRIMARY KEY, bucket_id text, name text, owner_id text, owner uuid, metadata jsonb);
    CREATE TABLE public.budget_workspaces (id uuid PRIMARY KEY, workspace_type text, owner_id uuid, legacy_family_id uuid);
    CREATE TABLE public.families (id uuid PRIMARY KEY, owner_id uuid);
    CREATE TABLE public.payment_records (id uuid PRIMARY KEY, family_id uuid, workspace_id uuid, recorded_by uuid,
      visibility text, proof_path text, proof_mime_type text, proof_size_bytes int);
    CREATE TABLE public.business_bill_payments (id uuid PRIMARY KEY, workspace_id uuid);
    CREATE TABLE public.business_expense_claims (id uuid PRIMARY KEY, workspace_id uuid, status text);
    CREATE TABLE public.business_documents (id uuid PRIMARY KEY, workspace_id uuid, uploaded_by uuid, parent_type text,
      parent_id uuid, mime_type text, size_bytes int, storage_path text, status text);
    CREATE TABLE mushavo_account_deletion.requests (id uuid PRIMARY KEY, subject_id uuid, cancelled_at timestamptz,
      workspace_impact_confirmed_at timestamptz, workspace_impact_token text);
    CREATE TABLE mushavo_file_ingest.ordinary_uploads (bucket_id text, path text, workspace_id uuid, actor_id uuid NOT NULL,
      attachment_id uuid, parent_type text, parent_id uuid, mime_type text, byte_count int,
      state text, expires_at timestamptz, token uuid, lease_until timestamptz, PRIMARY KEY(bucket_id,path));
    CREATE FUNCTION public.business_storage_workspace_id(text) RETURNS uuid LANGUAGE sql
      AS $$ SELECT nullif(split_part($1,'/',2),'')::uuid $$;
    CREATE FUNCTION mushavo_account_deletion.owned_workspace_impact(uuid) RETURNS jsonb LANGUAGE sql
      AS $$ SELECT '{"impact_token":"fixture"}'::jsonb $$;
    CREATE FUNCTION mushavo_file_ingest.ordinary_upload_has_reference(text,text) RETURNS boolean LANGUAGE sql
      AS $$ SELECT EXISTS(SELECT FROM public.payment_records WHERE proof_path=$2)
        OR EXISTS(SELECT FROM public.business_documents WHERE storage_path=$2) $$;
    CREATE FUNCTION mushavo_account_deletion.matches_managed_bill_proof_detachment(jsonb,jsonb) RETURNS boolean LANGUAGE sql
      AS $$ SELECT false $$;
    CREATE FUNCTION mushavo_file_ingest.bind_ordinary_upload() RETURNS trigger LANGUAGE plpgsql
      AS $binder$
declare
  old_row jsonb := to_jsonb(OLD);
  j jsonb := to_jsonb(NEW);
begin
  if tg_op = 'UPDATE' and tg_relid = 'public.business_documents'::regclass
    and mushavo_account_deletion.matches_managed_bill_proof_detachment(old_row,j) then
    return new;
  end if;
  IF NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by THEN
    RAISE EXCEPTION 'MANAGED_UPLOAD_REFERENCE_IMMUTABLE';
  END IF;
  RETURN NEW;
end;
$binder$;
    CREATE FUNCTION mushavo_account_deletion.require_bill_proof_uploader() RETURNS trigger LANGUAGE plpgsql
    AS $uploader$
BEGIN
  IF NEW.uploaded_by IS NULL THEN RAISE EXCEPTION 'UPLOADER_REQUIRED'; END IF;
  RETURN NEW;
END;
$uploader$;
    CREATE FUNCTION mushavo_account_deletion.execute_confirmed_request(p_request_id uuid) RETURNS void LANGUAGE plpgsql
    AS $executor$
BEGIN
  IF EXISTS (SELECT 1 FROM public.payment_records WHERE proof_path IS NOT NULL) THEN RETURN; END IF;
END;
$executor$;
    CREATE TRIGGER require_uploader BEFORE UPDATE OF uploaded_by ON public.business_documents FOR EACH ROW
      EXECUTE FUNCTION mushavo_account_deletion.require_bill_proof_uploader();
    CREATE TRIGGER zz_bind_ordinary_upload BEFORE UPDATE ON public.business_documents FOR EACH ROW
      EXECUTE FUNCTION mushavo_file_ingest.bind_ordinary_upload();

    INSERT INTO public.budget_workspaces VALUES ('${business}','business','${owner}',NULL),
      ('${familyWorkspace}','household','${owner}','${family}');
    INSERT INTO public.families VALUES ('${family}','${owner}');
    INSERT INTO public.business_expense_claims VALUES ('${claim}','${business}','paid');
    INSERT INTO public.business_bill_payments VALUES ('${billPayment}','${business}');
    INSERT INTO public.business_documents VALUES ('${attachment}','${business}','${subject}','expense_claim',
      '${claim}','application/pdf',25,'${claimPath}','active'),
      ('${billAttachment}','${business}','${subject}','business_bill_payment',
        '${billPayment}','application/pdf',32,'${billPath}','active');
    INSERT INTO public.payment_records VALUES ('${payment}','${family}','${familyWorkspace}','${subject}',
      'family','${familyPath}','application/pdf',29);
    INSERT INTO storage.objects VALUES
      ('${claimFile}','business-documents','${claimPath}',NULL,NULL,'{"mimetype":"application/pdf","size":25}'),
      ('${familyFile}','payment-proofs','${familyPath}',NULL,NULL,'{"mimetype":"application/pdf","size":29}'),
      ('${billFile}','business-documents','${billPath}',NULL,NULL,'{"mimetype":"application/pdf","size":32}');
    INSERT INTO mushavo_account_deletion.requests VALUES ('${request}','${subject}',NULL,now(),'fixture');
    INSERT INTO mushavo_file_ingest.ordinary_uploads VALUES
      ('business-documents','${claimPath}','${business}','${subject}','${attachment}','expense_claim',
        '${claim}','application/pdf',25,'linked',now(),NULL,NULL),
      ('business-documents','${billPath}','${business}','${subject}','${billAttachment}','business_bill_payment',
        '${billPayment}','application/pdf',32,'linked',now(),NULL,NULL),
      ('payment-proofs','${familyPath}','${familyWorkspace}','${subject}','${payment}',NULL,NULL,
        'application/pdf',29,'linked',now(),NULL,NULL),
      ('payment-proofs','${removedPath}','${familyWorkspace}','${subject}','${removed}',NULL,NULL,
        'application/pdf',29,'removed',now(),NULL,NULL);
    ${migration}
  `);

  const run = () => db.query('SELECT mushavo_account_deletion.execute_confirmed_request($1)', [request]);
  const read = async (query, args = []) => (await db.query(query, args)).rows;
  const documents = await read('SELECT * FROM public.business_documents ORDER BY id');

  await db.query('UPDATE storage.objects SET owner_id = $1 WHERE id = $2', [subject, claimFile]);
  await assert.rejects(run(), /FR33_CLAIM_PROOF_STORAGE_HANDOFF_REQUIRED/);
  assert.deepEqual(await read('SELECT * FROM public.business_documents ORDER BY id'), documents);
  assert.equal((await read('SELECT actor_id FROM mushavo_file_ingest.ordinary_uploads WHERE path = $1', [removedPath]))[0].actor_id, subject);
  await db.query('UPDATE storage.objects SET owner_id = NULL WHERE id = $1', [claimFile]);

  await db.query("UPDATE storage.objects SET metadata = metadata || '{\"size\":28}' WHERE id = $1", [familyFile]);
  await db.exec('BEGIN');
  await run();
  assert.equal((await read('SELECT actor_id FROM mushavo_file_ingest.ordinary_uploads WHERE path = $1', [familyPath]))[0].actor_id, subject);
  await db.exec('ROLLBACK');
  await db.query("UPDATE storage.objects SET metadata = metadata || '{\"size\":29}' WHERE id = $1", [familyFile]);

  const objectState = await read('SELECT * FROM storage.objects ORDER BY id');
  await run();
  assert.deepEqual(await read('SELECT * FROM storage.objects ORDER BY id'), objectState);
  assert.deepEqual(await read('SELECT * FROM public.business_documents ORDER BY id'), [
    { ...documents[0], uploaded_by: null }, documents[1]
  ]);
  assert.deepEqual(await read('SELECT actor_id FROM mushavo_file_ingest.ordinary_uploads ORDER BY path'), [
    { actor_id: null }, { actor_id: null }, { actor_id: null }
  ]);
  assert.deepEqual(await read('SELECT * FROM mushavo_account_deletion.retained_paid_claim_proofs'), []);
  await run();
  await assert.rejects(db.query('UPDATE public.business_documents SET uploaded_by = $1 WHERE id = $2', [owner, attachment]),
    /MANAGED_UPLOAD_REFERENCE_IMMUTABLE/);
});
