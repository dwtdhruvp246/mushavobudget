import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

import { PGlite } from '../scripts/fixtures/email-session-review-tools/node_modules/@electric-sql/pglite/dist/index.js';

const migration = await readFile(new URL(
  '../supabase/migrations/20261116124345_fr33_retained_payment_names.sql', import.meta.url
), 'utf8');

test('retained names are captured by role and follow existing payment access', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  const ids = Array.from({length: 12}, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
  const [subject, owner, family, ownedFamily, member, payment, bill, workspace, ownedWorkspace,
    ownedPayment, ownedBill, request] = ids;
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE SCHEMA mushavo_account_deletion;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    CREATE TABLE public.profiles (id uuid PRIMARY KEY, full_name text);
    CREATE TABLE public.families (id uuid PRIMARY KEY, owner_id uuid);
    CREATE TABLE public.family_members (id uuid PRIMARY KEY, family_id uuid, user_id uuid, name text, email text, status text);
    CREATE TABLE public.payment_records (id uuid PRIMARY KEY, family_id uuid, recorded_by uuid, paid_by_member_id uuid, visibility text);
    CREATE TABLE public.budget_workspaces (id uuid PRIMARY KEY, owner_id uuid, workspace_type text);
    CREATE TABLE public.business_bill_payments (id uuid PRIMARY KEY, workspace_id uuid, recorded_by uuid);
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
      ('${bill}', '${workspace}', '${subject}'), ('${ownedBill}', '${ownedWorkspace}', '${subject}');
    INSERT INTO mushavo_account_deletion.requests VALUES ('${request}', '${subject}', NULL, md5('${subject}'), now());
    ${migration}
  `);

  const capture = async () => (await db.query(
    'SELECT mushavo_account_deletion.capture_retained_payment_names($1) AS result', [request]
  )).rows[0].result;
  assert.deepEqual(await capture(), {family_payments: 1, business_bill_payments: 1});
  assert.deepEqual(await capture(), {family_payments: 1, business_bill_payments: 1});

  await db.exec('SET ROLE authenticated');
  await assert.rejects(capture, {code: '42501'});
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
  await db.exec(`UPDATE mushavo_account_deletion.requests SET cancelled_at = now() WHERE id = '${request}'`);
  await assert.rejects(capture, /FR33_CONFIRMED_REQUEST_REQUIRED/);
  await db.exec(`DELETE FROM public.family_members WHERE id = '${member}'; DELETE FROM auth.users WHERE id = '${subject}'`);
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
