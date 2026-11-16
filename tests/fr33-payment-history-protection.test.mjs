import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { PGlite } from '../scripts/fixtures/email-session-review-tools/node_modules/@electric-sql/pglite/dist/index.js';

const migration = await readFile(new URL(
  '../supabase/migrations/20261116122201_fr33_protect_payment_history.sql', import.meta.url
), 'utf8');

test('account removal cannot cascade into surviving Family payments', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE TABLE public.families (id integer PRIMARY KEY);
    CREATE TABLE public.payment_items (
      id integer PRIMARY KEY,
      family_id integer REFERENCES public.families ON DELETE CASCADE,
      owner_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
      created_by uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE
    );
    CREATE TABLE public.payment_records (
      id integer PRIMARY KEY,
      payment_item_id integer NOT NULL REFERENCES public.payment_items ON DELETE CASCADE,
      owner_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
      recorded_by uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
      amount numeric NOT NULL,
      proof_path text
    );
    INSERT INTO public.families VALUES (1), (2);
  `);

  const ids = Array.from({ length: 7 }, (_, i) => `10000000-0000-4000-8000-00000000000${i + 1}`);
  const [owner, itemOwner, itemCreator, paymentOwner, recorder, personalOwner, unusedAccount] = ids;
  for (const id of ids) await db.query('INSERT INTO auth.users VALUES ($1)', [id]);
  await db.query(`INSERT INTO public.payment_items VALUES
    (1, 1, $1, $2), (2, 1, $3, $3), (3, NULL, $4, $4), (4, 2, $3, $3)`,
  [itemOwner, itemCreator, owner, personalOwner]);
  await db.query(`INSERT INTO public.payment_records VALUES
    (1, 1, $1, $1, 12.5, NULL), (2, 2, $2, $3, 15, 'family-proof.pdf'),
    (3, 3, $4, $4, 8, NULL), (4, 4, $1, $1, 20, NULL)`,
  [owner, paymentOwner, recorder, personalOwner]);

  const readRows = async () => (await db.query('SELECT * FROM public.payment_records ORDER BY id')).rows;
  const original = await readRows();
  await db.exec(`BEGIN; ${migration} COMMIT;`);
  await db.exec(`BEGIN; ${migration} COMMIT;`);
  assert.deepEqual(await readRows(), original);

  for (const [id, constraint] of [
    [itemOwner, 'payment_items_owner_id_fkey'], [itemCreator, 'payment_items_created_by_fkey'],
    [paymentOwner, 'payment_records_owner_id_fkey'], [recorder, 'payment_records_recorded_by_fkey']
  ]) {
    await assert.rejects(db.query('DELETE FROM auth.users WHERE id = $1', [id]), error =>
      ['23001', '23503'].includes(error.code) && error.constraint === constraint);
    assert.deepEqual(await readRows(), original);
  }

  await db.query('DELETE FROM auth.users WHERE id = $1', [unusedAccount]);
  await db.exec('DELETE FROM public.families WHERE id = 2');
  assert.deepEqual(await readRows(), original.filter(row => row.id !== 4));

  await db.exec('DELETE FROM public.payment_items WHERE id = 3');
  await db.query('DELETE FROM auth.users WHERE id = $1', [personalOwner]);
  assert.deepEqual(await readRows(), original.filter(row => row.id <= 2));
});
