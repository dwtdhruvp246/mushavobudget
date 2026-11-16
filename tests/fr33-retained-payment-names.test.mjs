import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

import { PGlite } from '../scripts/fixtures/email-session-review-tools/node_modules/@electric-sql/pglite/dist/index.js';

const migration = await readFile(new URL(
  '../supabase/migrations/20261116124345_fr33_retained_payment_names.sql', import.meta.url
), 'utf8');
const billDetachment = await readFile(new URL(
  '../supabase/migrations/20261116130629_fr33_detach_bill_payment_recorders.sql', import.meta.url
), 'utf8');
const retainProofs = await readFile(new URL(
  '../supabase/migrations/20261116133213_fr33_retain_business_bill_proofs.sql', import.meta.url
), 'utf8');

test('retained names are captured by role and follow existing payment access', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  const ids = Array.from({length: 16}, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
  const [subject, owner, family, ownedFamily, member, payment, bill, workspace, ownedWorkspace,
    ownedPayment, ownedBill, request, otherBill, proofId, storageId, otherProof] = ids;
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE SCHEMA storage;
    CREATE SCHEMA mushavo_account_deletion;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    CREATE TABLE public.profiles (id uuid PRIMARY KEY, full_name text);
    CREATE TABLE public.families (id uuid PRIMARY KEY, owner_id uuid);
    CREATE TABLE public.family_members (id uuid PRIMARY KEY, family_id uuid, user_id uuid, name text, email text, status text);
    CREATE TABLE public.payment_records (id uuid PRIMARY KEY, family_id uuid, recorded_by uuid, paid_by_member_id uuid, visibility text);
    CREATE TABLE public.budget_workspaces (id uuid PRIMARY KEY, owner_id uuid, workspace_type text);
    CREATE TABLE public.business_bill_payments (id uuid PRIMARY KEY, workspace_id uuid,
      recorded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, amount numeric NOT NULL);
    CREATE TABLE public.business_documents (
      id uuid PRIMARY KEY, workspace_id uuid, parent_type text, parent_id uuid,
      uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, storage_path text, status text
    );
    CREATE TABLE storage.objects (id uuid PRIMARY KEY, bucket_id text, name text, owner_id text, owner uuid);
    CREATE FUNCTION public.fr32_is_managed_ordinary_upload(text, text) RETURNS boolean LANGUAGE sql
      AS $$ SELECT starts_with($2, 'managed/') $$;
    CREATE TABLE mushavo_account_deletion.requests (id uuid PRIMARY KEY, subject_id uuid, cancelled_at timestamptz,
      workspace_impact_token text, workspace_impact_confirmed_at timestamptz);
    CREATE FUNCTION mushavo_account_deletion.owned_workspace_impact(uuid) RETURNS jsonb LANGUAGE sql
      AS $$ SELECT jsonb_build_object('impact_token', md5($1::text)); $$;

    ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.business_bill_payments ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.payment_records, public.business_bill_payments TO authenticated;
    CREATE POLICY fixture_family_visibility ON public.payment_records FOR SELECT TO authenticated
      USING (id::text = current_setting('fr33.visible_family_payment', true));
    CREATE POLICY fixture_bill_visibility ON public.business_bill_payments FOR SELECT TO authenticated
      USING (id::text = current_setting('fr33.visible_bill_payment', true));

    INSERT INTO auth.users VALUES ('${subject}', 'subject@example.invalid'), ('${owner}', 'owner@example.invalid');
    INSERT INTO public.profiles VALUES ('${subject}', 'Actual Profile Name');
    INSERT INTO public.families VALUES ('${family}', '${owner}'), ('${ownedFamily}', '${subject}');
    INSERT INTO public.family_members VALUES ('${member}', '${family}', '${subject}', 'Actual Member Name', 'subject@example.invalid', 'inactive');
    INSERT INTO public.payment_records VALUES
      ('${payment}', '${family}', '${owner}', '${member}', 'family'),
      ('${ownedPayment}', '${ownedFamily}', '${subject}', NULL, 'family');
    INSERT INTO public.budget_workspaces VALUES
      ('${workspace}', '${owner}', 'business'), ('${ownedWorkspace}', '${subject}', 'business');
    INSERT INTO public.business_bill_payments VALUES
      ('${bill}', '${workspace}', '${subject}', 12.5), ('${ownedBill}', '${ownedWorkspace}', '${subject}', 14),
      ('${otherBill}', '${workspace}', '${owner}', 20);
    INSERT INTO mushavo_account_deletion.requests VALUES ('${request}', '${subject}', NULL, md5('${subject}'), now());
    ${migration}
    ${billDetachment}
    ${retainProofs}
  `);

  const capture = async () => (await db.query(
    'SELECT mushavo_account_deletion.capture_retained_payment_names($1) AS result', [request]
  )).rows[0].result;
  const detach = async () => (await db.query(
    'SELECT mushavo_account_deletion.detach_retained_business_bill_recorders($1) AS result', [request]
  )).rows[0].result;

  await t.test('a proof that still needs a storage handoff prevents all detachment changes', async () => {
    const clearRecorder = db.query('UPDATE public.business_bill_payments SET recorded_by = NULL WHERE id = $1', [bill]);
    await assert.rejects(clearRecorder, /FR33_BILL_PAYMENT_RECORDER_REQUIRED/);
    await assert.rejects(db.query('INSERT INTO public.business_bill_payments VALUES ($1, $2, NULL, 12)', [request, workspace]),
      /FR33_BILL_PAYMENT_RECORDER_REQUIRED/);
    await db.query('INSERT INTO public.business_documents VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [proofId, workspace, 'business_bill_payment', bill, subject, 'original.pdf', 'active']);
    await assert.rejects(db.query('UPDATE public.business_documents SET uploaded_by = NULL WHERE id = $1', [proofId]),
      /FR33_BILL_PROOF_UPLOADER_REQUIRED/);
    await db.query("INSERT INTO storage.objects VALUES ($1, 'business-documents', 'original.pdf', $2::text, ($2::text)::uuid)", [storageId, subject]);
    await assert.rejects(detach, /FR33_BILL_PROOF_STORAGE_HANDOFF_REQUIRED/);
    assert.deepEqual((await db.query('SELECT * FROM public.fr33_bill_payment_names')).rows, []);
    assert.equal((await db.query('SELECT recorded_by FROM public.business_bill_payments WHERE id = $1', [bill])).rows[0].recorded_by, subject);
    await db.query("UPDATE storage.objects SET owner_id = NULL, owner = NULL, name = 'managed/original.pdf' WHERE id = $1", [storageId]);
    await db.query("UPDATE public.business_documents SET storage_path = 'managed/original.pdf' WHERE id = $1", [proofId]);
    await assert.rejects(detach, /FR33_BILL_PROOF_INGESTION_HANDOFF_REQUIRED/);
    await db.query("UPDATE storage.objects SET name = 'original.pdf' WHERE id = $1", [storageId]);
    await db.query("UPDATE public.business_documents SET storage_path = 'original.pdf' WHERE id = $1", [proofId]);
    await db.query('INSERT INTO public.business_documents VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [otherProof, workspace, 'business_bill_payment', otherBill, subject, 'other.pdf', 'active']);
    await db.query("INSERT INTO storage.objects VALUES ($1, 'business-documents', 'other.pdf', NULL, NULL)", [otherProof]);
  });

  assert.deepEqual(await capture(), {family_payments: 1, business_bill_payments: 1});
  assert.deepEqual(await capture(), {family_payments: 1, business_bill_payments: 1});

  await db.exec('SET ROLE authenticated');
  await assert.rejects(capture, {code: '42501'});
  await assert.rejects(detach, {code: '42501'});
  await assert.rejects(db.exec('DELETE FROM public.fr33_family_payment_names'), {code: '42501'});
  assert.deepEqual((await db.query('SELECT * FROM public.fr33_family_payment_names')).rows, []);
  assert.deepEqual((await db.query('SELECT * FROM public.fr33_bill_payment_names')).rows, []);
  await db.exec(`SET fr33.visible_family_payment = '${payment}'; SET fr33.visible_bill_payment = '${bill}';`);
  assert.deepEqual((await db.query('SELECT * FROM public.fr33_family_payment_names')).rows,
    [{payment_id: payment, payer_name: 'Actual Member Name', recorder_name: null}]);
  assert.deepEqual((await db.query('SELECT * FROM public.fr33_bill_payment_names')).rows,
    [{payment_id: bill, recorder_name: 'Actual Profile Name'}]);

  await db.exec(`RESET ROLE; UPDATE public.profiles SET full_name = 'subject@example.invalid' WHERE id = '${subject}'`);
  await assert.rejects(capture, /FR33_RETAINED_PAYMENT_NAME_REQUIRED/);
  await db.exec(`UPDATE public.profiles SET full_name = 'Actual Profile Name' WHERE id = '${subject}'`);
  await t.test('detachment preserves both bill documents, including a proof uploaded for a different recorder', async () => {
    const objects = (await db.query('SELECT * FROM storage.objects ORDER BY id')).rows;
    assert.deepEqual(await detach(), {business_bill_payments_detached: 1, business_bill_proofs_retained: 2});
    assert.deepEqual(await detach(), {business_bill_payments_detached: 0, business_bill_proofs_retained: 0});
    const payments = (await db.query('SELECT id, recorded_by, amount FROM public.business_bill_payments ORDER BY id')).rows;
    assert.deepEqual(payments, [
      {id: bill, recorded_by: null, amount: '12.5'},
      {id: ownedBill, recorded_by: subject, amount: '14'},
      {id: otherBill, recorded_by: owner, amount: '20'}
    ]);
    const documents = (await db.query('SELECT id, uploaded_by, storage_path, status FROM public.business_documents ORDER BY id')).rows;
    assert.deepEqual(documents, [
      {id: proofId, uploaded_by: null, storage_path: 'original.pdf', status: 'active'},
      {id: otherProof, uploaded_by: null, storage_path: 'other.pdf', status: 'active'}
    ]);
    assert.deepEqual((await db.query('SELECT * FROM storage.objects ORDER BY id')).rows, objects);
    await assert.rejects(db.query('DELETE FROM auth.users WHERE id = $1', [subject]), error =>
      ['23001', '23503'].includes(error.code) && error.constraint === 'business_bill_payments_recorded_by_fkey');
    await db.query('DELETE FROM public.business_bill_payments WHERE id = $1', [ownedBill]);
  });
  await db.exec(`UPDATE mushavo_account_deletion.requests SET cancelled_at = now() WHERE id = '${request}'`);
  await assert.rejects(capture, /FR33_CONFIRMED_REQUEST_REQUIRED/);
  await db.exec(`DELETE FROM public.family_members WHERE id = '${member}'; DELETE FROM auth.users WHERE id = '${subject}'`);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM public.business_documents WHERE uploaded_by IS NULL')).rows[0].count, 2);
  assert.equal((await db.query('SELECT payer_name FROM public.fr33_family_payment_names')).rows[0].payer_name, 'Actual Member Name');
  assert.equal((await db.query('SELECT recorder_name FROM public.fr33_bill_payment_names')).rows[0].recorder_name, 'Actual Profile Name');
  await db.exec(`DELETE FROM public.payment_records WHERE id = '${payment}'; DELETE FROM public.business_bill_payments WHERE id = '${bill}'`);
  assert.deepEqual((await db.query('SELECT * FROM public.fr33_family_payment_names')).rows, []);
  assert.deepEqual((await db.query('SELECT * FROM public.fr33_bill_payment_names')).rows, []);
});

test('payment history displays saved names when the original account link is gone', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const business = await readFile(new URL('../business.js', import.meta.url), 'utf8');

  const attribution = app.slice(app.indexOf('function paymentRecordPeople('), app.indexOf('function currentFamilyMember()'));
  const name = runInNewContext(`${attribution}\npaymentRecordAttribution(record);`, {
    record: { visibility: 'family', recorded_by: null, paid_by_member_id: null,
      fr33_family_payment_names: { payer_name: 'Actual Payer', recorder_name: 'Actual Recorder' } },
    state: { members: [{ user_id: null, name: 'Unrelated Family Member' }] },
    memberById: () => undefined
  });
  assert.equal(name, 'Paid by Actual Payer · Recorded by Actual Recorder');
  assert.match(app, /select\("\*, fr33_family_payment_names\(payer_name,recorder_name\)"\)/);

  const bill = business.slice(business.indexOf('function renderBillDetail()'), business.indexOf('function openBillDetail('));
  const render = bill.slice(bill.indexOf('const recorder = item.fr33_bill_payment_names'), bill.indexOf('    return row;'));
  const emitted = [];
  runInNewContext(render, {
    item: { paid_at: 'date', reference: 'ref', payment_source: 'cash', amount: 12, currency: 'USD',
      fr33_bill_payment_names: { recorder_name: 'Actual Recorder' } },
    row: { append: (...nodes) => emitted.push(...nodes) },
    claimNode: (_tag, _className, value) => value,
    formatDateTime: value => value,
    sourceLabel: value => value,
    money: value => value
  });
  assert.deepEqual(emitted, [12, 'date · ref · cash · Recorded by Actual Recorder']);
  assert.equal(business.match(/fr33_bill_payment_names\(recorder_name\)/g)?.length, 2);
});
