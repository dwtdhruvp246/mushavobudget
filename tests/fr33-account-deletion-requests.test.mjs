import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { PGlite } from '../scripts/fixtures/email-session-review-tools/node_modules/@electric-sql/pglite/dist/index.js';
const migration = await readFile(new URL(
  '../supabase/migrations/20261115195000_fr33_account_deletion_requests.sql',
  import.meta.url
), 'utf8');

const reviewMigration = await readFile(new URL(
  '../supabase/migrations/20261116104500_fr33_deletion_dependency_review.sql',
  import.meta.url
), 'utf8');

const impactMigration = await readFile(new URL(
  '../supabase/migrations/20261116111000_fr33_confirm_owned_workspace_impact.sql',
  import.meta.url
), 'utf8');

const workspaceReview = await readFile(new URL(
  '../supabase/diagnostics/security_fr_3_3_owned_workspace_dependency_review.sql',
  import.meta.url
), 'utf8');

const owner = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const session = '10000000-0000-4000-8000-000000000003';
const otherSession = '10000000-0000-4000-8000-000000000004';
const workspace = '10000000-0000-4000-8000-000000000005';

test('deletion requests are private, idempotent, cancellable and held for review', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE SCHEMA mushavo_email_auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE TABLE auth.sessions (id uuid, user_id uuid, created_at timestamptz);
    CREATE TABLE auth.mfa_amr_claims (session_id uuid, authentication_method text, created_at timestamptz);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
    AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE
    AS $$ SELECT jsonb_build_object('session_id', current_setting('request.jwt.claim.session', true)) $$;
    CREATE FUNCTION mushavo_email_auth.require_application_session() RETURNS void LANGUAGE plpgsql STABLE
    AS $$ BEGIN
      IF NOT EXISTS (
        SELECT FROM auth.sessions WHERE id = (auth.jwt()->>'session_id')::uuid AND user_id = auth.uid()
      ) THEN RAISE insufficient_privilege; END IF;
    END; $$;
    CREATE TABLE public.app_admins (user_id uuid);
    CREATE TABLE public.budget_workspaces (
      id uuid, owner_id uuid, workspace_type text, name text, status text, legacy_family_id uuid
    );
    CREATE TABLE public.families (id uuid PRIMARY KEY, owner_id uuid, name text);
    CREATE TABLE public.workspace_members (user_id uuid, workspace_id uuid);
    CREATE TABLE public.family_heads (user_id uuid);
    CREATE TABLE public.family_members (user_id uuid);
    INSERT INTO auth.users VALUES ('${owner}'), ('${other}');
    INSERT INTO auth.sessions VALUES ('${session}', '${owner}', now()), ('${otherSession}', '${other}', now());
    INSERT INTO auth.mfa_amr_claims VALUES ('${session}', 'password', now()), ('${otherSession}', 'password', now() - interval '1 hour');
  `);
  await db.exec(migration);
  await db.exec(`
    ALTER TABLE auth.users ADD COLUMN external_ref text UNIQUE;
    CREATE SCHEMA storage;
    CREATE TABLE storage.objects (owner_id text, owner uuid, name text);
    CREATE SCHEMA mushavo_file_ingest;
    CREATE TABLE mushavo_file_ingest.ordinary_uploads (actor_id uuid);
    CREATE TABLE mushavo_file_ingest.subscription_uploads (uploader_id uuid);
    CREATE TABLE mushavo_file_ingest.business_uploads (uploader_id uuid);
    CREATE TABLE public.fixture_billing (owner_id uuid REFERENCES auth.users (id) ON DELETE RESTRICT);
    CREATE TABLE public.fixture_payments (recorded_by uuid REFERENCES auth.users (id) ON DELETE CASCADE);
    INSERT INTO public.fixture_billing VALUES ('${owner}'), ('${other}');
    INSERT INTO public.fixture_payments VALUES ('${owner}'), ('${owner}'), ('${other}');
    INSERT INTO storage.objects VALUES
      ('${owner}', NULL, 'owned'),
      (NULL, '${owner}', 'legacy'),
      ('${other}', '${owner}', 'conflict'),
      ('${other}', '${other}', 'other');
    INSERT INTO mushavo_file_ingest.ordinary_uploads VALUES ('${owner}'), ('${other}');
    INSERT INTO mushavo_file_ingest.subscription_uploads VALUES ('${owner}');
    INSERT INTO mushavo_file_ingest.business_uploads VALUES ('${other}');
  `);
  await db.exec(reviewMigration);
  await db.exec(impactMigration);

  const call = async name => (await db.query(`SELECT public.${name}() AS payload`)).rows[0].payload;
  const status = () => call('fr33_account_deletion_status');
  const request = () => call('fr33_request_account_deletion');
  const cancel = () => call('fr33_cancel_account_deletion');
  const impact = () => call('fr33_account_deletion_impact');
  const submit = async token => (await db.query(
    'SELECT public.fr33_submit_account_deletion($1) AS payload', [token]
  )).rows[0].payload;
  const review = async id => (await db.query(
    'SELECT mushavo_account_deletion.review_dependencies($1) AS payload', [id]
  )).rows[0].payload;
  const actor = (subject, sessionId) => db.exec(`
    RESET ROLE;
    SET request.jwt.claim.sub = '${subject}';
    SET request.jwt.claim.session = '${sessionId}';
    SET ROLE authenticated;
  `);

  await t.test('anonymous and service callers have no request or status grants', async () => {
    await db.exec('SET ROLE anon');
    await assert.rejects(request, {code: '42501'});
    await assert.rejects(status, {code: '42501'});
    await assert.rejects(impact, {code: '42501'});
    await assert.rejects(() => submit('a'.repeat(64)), {code: '42501'});
    await db.exec('RESET ROLE; SET ROLE service_role');
    await assert.rejects(cancel, {code: '42501'});
    await db.exec('RESET ROLE');
  });
  await t.test('signed-in user can submit and read one durable request', async () => {
    await actor(owner, session);
    assert.equal((await status()).status, 'none');
    const open = await request();
    assert.equal(open.status, 'retention_review');
    assert.ok(open.request_id);
    assert.deepEqual(await request(), open);
    assert.deepEqual(await status(), open);
    await assert.rejects(db.exec('SELECT * FROM mushavo_account_deletion.requests'), {code: '42501'});
  });
  await t.test('operator inventory counts exact request dependencies and protects the details', async () => {
    const id = (await status()).request_id;
    await assert.rejects(review(id), {code: '42501'});
    await db.exec('RESET ROLE; SET ROLE service_role');
    await assert.rejects(review(id), {code: '42501'});
    await db.exec('RESET ROLE; SET ROLE anon');
    await assert.rejects(review(id), {code: '42501'});
    await db.exec('RESET ROLE');

    const result = await review(id);
    assert.equal(result.status, 'REVIEW_ONLY');
    assert.equal(result.restrictive_references_with_rows, 1);
    assert.equal(result.cascading_references_with_rows, 1);
    assert.deepEqual(result.direct_dependencies
      .filter(entry => entry.relation.startsWith('fixture_'))
      .map(entry => [entry.relation, entry.on_delete, entry.matching_rows]), [
        ['fixture_billing', 'RESTRICT', 1], ['fixture_payments', 'CASCADE', 2]
      ]);
    assert.deepEqual(result.storage, {
      objects_with_subject_owner: 3, conflicting_owner_metadata: 1,
      ordinary_upload_ledger_rows: 1, subscription_upload_ledger_rows: 1, business_upload_ledger_rows: 0
    });
    assert.ok(!JSON.stringify(result).includes(owner));
    assert.ok(!JSON.stringify(result).includes(other));
    assert.ok(!JSON.stringify(result).includes('"conflict"'));

    await db.exec('CREATE TABLE public.unknown_reference (value text REFERENCES auth.users (external_ref))');
    assert.equal((await review(id)).status, 'INCOMPLETE_DIRECT_INVENTORY');
    assert.equal((await review(id)).unsupported_direct_references, 1);
    await db.exec('DROP TABLE public.unknown_reference');
    assert.deepEqual(await review(other), { status: 'REQUEST_UNAVAILABLE' });
    await actor(owner, session);
  });
  await t.test('other accounts cannot see or cancel the request, and stale verification denies submission', async () => {
    await actor(other, otherSession);
    assert.equal((await status()).status, 'none');
    assert.equal((await cancel()).status, 'none');
    await assert.rejects(request, /ACCOUNT_DELETION_FRESH_PASSWORD_REQUIRED/);
    await actor(other, session);
    await assert.rejects(status, {code: '42501'});
  });
  await t.test('ownership, former membership and staff access take precedence over retention review', async () => {
    await db.exec(`
      RESET ROLE;
      INSERT INTO public.budget_workspaces (id,owner_id,workspace_type) VALUES ('${workspace}', '${owner}', 'business');
    `);
    await actor(owner, session);
    assert.equal((await status()).status, 'ownership_review');
    await db.exec(`
      RESET ROLE;
      UPDATE public.budget_workspaces SET owner_id = '${other}';
      INSERT INTO public.workspace_members VALUES ('${owner}', '${workspace}');
    `);
    await actor(owner, session);
    assert.equal((await status()).status, 'shared_records_review');
    await db.exec(`RESET ROLE; INSERT INTO public.app_admins VALUES ('${owner}')`);
    await actor(owner, session);
    assert.equal((await status()).status, 'staff_review');
  });
  await t.test('cancel is repeatable and permits a new request with a new identifier', async () => {
    const prior = (await status()).request_id;
    assert.equal((await cancel()).status, 'none');
    assert.equal((await cancel()).status, 'none');
    assert.notEqual((await request()).request_id, prior);
    await db.exec('RESET ROLE');
    assert.deepEqual(await review(prior), { status: 'REQUEST_UNAVAILABLE' });
    const rows = (await db.query('SELECT cancelled_at FROM mushavo_account_deletion.requests')).rows;
    assert.equal(rows.length, 2);
    assert.equal(rows.filter(row => row.cancelled_at === null).length, 1);
  });
  await t.test('owned Family and Business scope is confirmed without including other members’ workspaces', async () => {
    const modernFamily = '10000000-0000-4000-8000-000000000010';
    const oldFamily = '10000000-0000-4000-8000-000000000011';
    const familyAlias = '10000000-0000-4000-8000-000000000012';
    const business = '10000000-0000-4000-8000-000000000013';
    await db.exec(`
      DELETE FROM public.app_admins WHERE user_id = '${owner}';
      INSERT INTO public.families VALUES
        ('${modernFamily}', '${owner}', 'Legacy alias'),
        ('${oldFamily}', '${owner}', 'Legacy Family');
      INSERT INTO public.budget_workspaces VALUES
        ('${familyAlias}', '${owner}', 'household', 'Active Family', 'active', '${modernFamily}'),
        ('${business}', '${owner}', 'business', 'Active Business', 'active', NULL);
      UPDATE public.budget_workspaces SET name = 'Someone else''s Business', status = 'active' WHERE id = '${workspace}';
    `);

    await actor(owner, session);
    await cancel();
    const before = await impact();
    assert.deepEqual(before.workspaces.map(row => row.name), ['Active Business', 'Legacy Family', 'Active Family']);
    assert.ok(before.workspaces.every(row => !('id' in row) && !('legacy_family_id' in row)));
    await assert.rejects(() => submit(null), /ACCOUNT_DELETION_IMPACT_CONFIRMATION_REQUIRED/);

    await actor(other, otherSession);
    assert.deepEqual((await impact()).workspaces.map(row => row.name), ["Someone else's Business"]);
    await assert.rejects(() => submit(before.impact_token), /ACCOUNT_DELETION_FRESH_PASSWORD_REQUIRED/);

    await db.exec(`RESET ROLE; UPDATE public.budget_workspaces SET name = 'Renamed Business' WHERE id = '${business}'`);
    await actor(owner, session);
    await assert.rejects(() => submit(before.impact_token), /ACCOUNT_DELETION_IMPACT_CHANGED/);
    assert.equal((await status()).status, 'none');

    const after = await impact();
    const first = await submit(after.impact_token);
    assert.equal(first.status, 'ownership_review');
    assert.deepEqual(await submit(after.impact_token), first);
    await db.exec('RESET ROLE');
    const receipt = (await db.query(`SELECT workspace_impact_token, workspace_impact_confirmed_at
      FROM mushavo_account_deletion.requests WHERE id = $1`, [first.request_id])).rows[0];
    assert.equal(receipt.workspace_impact_token, after.impact_token);
    assert.ok(receipt.workspace_impact_confirmed_at);

    await db.exec(`UPDATE public.families SET owner_id = '${other}' WHERE id = '${modernFamily}'`);
    await actor(owner, session);
    await assert.rejects(impact, /ACCOUNT_DELETION_OWNERSHIP_REVIEW_REQUIRED/);
    await assert.rejects(() => submit(after.impact_token), /ACCOUNT_DELETION_OWNERSHIP_REVIEW_REQUIRED/);
    await db.exec('RESET ROLE');
  });

  await t.test('owned workspace dependency review excludes other owners and requires current confirmation', async () => {
    const modernFamily = '10000000-0000-4000-8000-000000000010';
    const familyWorkspace = '10000000-0000-4000-8000-000000000012';
    const business = '10000000-0000-4000-8000-000000000013';
    const sharedFamily = '10000000-0000-4000-8000-000000000014';
    const ownerItem = '10000000-0000-4000-8000-000000000015';
    const sharedItem = '10000000-0000-4000-8000-000000000016';
    const payer = '10000000-0000-4000-8000-000000000017';
    await db.exec(`
      UPDATE public.families SET owner_id = '${owner}' WHERE id = '${modernFamily}';
      ALTER TABLE public.budget_workspaces ADD PRIMARY KEY (id);
      ALTER TABLE mushavo_file_ingest.ordinary_uploads ADD COLUMN workspace_id uuid;
      ALTER TABLE mushavo_file_ingest.subscription_uploads ADD COLUMN workspace_id uuid;
      ALTER TABLE mushavo_file_ingest.business_uploads ADD COLUMN workspace_id uuid;
      UPDATE mushavo_file_ingest.ordinary_uploads SET workspace_id =
        CASE WHEN actor_id = '${owner}' THEN '${familyWorkspace}'::uuid ELSE '${workspace}'::uuid END;
      UPDATE mushavo_file_ingest.subscription_uploads SET workspace_id = '${workspace}';
      UPDATE mushavo_file_ingest.business_uploads SET workspace_id = '${business}';
      CREATE TABLE public.fixture_family_records (family_id uuid REFERENCES public.families (id) ON DELETE CASCADE);
      CREATE TABLE public.fixture_workspace_records (workspace_id uuid REFERENCES public.budget_workspaces (id) ON DELETE RESTRICT);
      INSERT INTO public.fixture_family_records VALUES ('${modernFamily}');
      INSERT INTO public.fixture_workspace_records VALUES ('${business}'), ('${workspace}'), ('${workspace}');
      INSERT INTO public.families VALUES ('${sharedFamily}', '${other}', 'Shared Family');
      ALTER TABLE auth.users ADD COLUMN email text;
      UPDATE auth.users SET email = 'fixture@example.invalid' WHERE id = '${owner}';
      CREATE TABLE public.profiles (id uuid PRIMARY KEY, full_name text);
      ALTER TABLE public.family_members ADD COLUMN id uuid, ADD COLUMN created_by uuid,
        ADD COLUMN family_id uuid, ADD COLUMN name text, ADD COLUMN email text;
      INSERT INTO public.family_members VALUES
        ('${owner}', '${payer}', '${other}', '${sharedFamily}', 'Fixture Name', 'fixture@example.invalid');
      CREATE TABLE public.payment_items (id uuid PRIMARY KEY, owner_id uuid, created_by uuid);
      CREATE TABLE public.payment_records (
        family_id uuid, payment_item_id uuid, paid_by_member_id uuid, owner_id uuid,
        recorded_by uuid, proof_path text
      );
      INSERT INTO public.payment_items VALUES
        ('${ownerItem}', '${owner}', '${owner}'), ('${sharedItem}', '${other}', '${other}');
      INSERT INTO public.payment_records VALUES
        ('${modernFamily}', '${ownerItem}', NULL, '${owner}', '${owner}', 'owned-proof'),
        ('${sharedFamily}', '${sharedItem}', '${payer}', '${other}', '${owner}', 'shared-proof'),
        ('${sharedFamily}', '${ownerItem}', NULL, '${other}', '${other}', NULL),
        ('${sharedFamily}', '${sharedItem}', NULL, '${other}', '${other}', NULL),
        (NULL, '${ownerItem}', NULL, '${owner}', '${owner}', 'personal-proof');
      CREATE TABLE public.business_bill_payments (workspace_id uuid, recorded_by uuid);
      CREATE TABLE public.business_income_receipts (workspace_id uuid, recorded_by uuid, voided_by uuid);
      CREATE TABLE public.business_expense_claims (
        workspace_id uuid, status text, submitted_by uuid, paid_by uuid, reviewed_by uuid
      );
      INSERT INTO public.business_bill_payments VALUES
        ('${business}', '${owner}'), ('${workspace}', '${owner}'), ('${workspace}', '${other}');
      INSERT INTO public.business_income_receipts VALUES
        ('${business}', '${owner}', '${owner}'), ('${workspace}', '${other}', '${owner}');
      INSERT INTO public.business_expense_claims VALUES
        ('${business}', 'paid', '${owner}', '${other}', NULL),
        ('${workspace}', 'paid', '${owner}', '${owner}', '${owner}'),
        ('${workspace}', 'draft', '${owner}', NULL, NULL);
    `);
    await db.exec(workspaceReview);
    const reviewWorkspace = async id => (await db.query(
      'SELECT mushavo_account_deletion.review_owned_workspace_dependencies($1) AS payload', [id]
    )).rows[0].payload;

    await actor(owner, session);
    await cancel();
    const unconfirmed = await request();
    await assert.rejects(() => reviewWorkspace(unconfirmed.request_id), { code: '42501' });
    await db.exec('RESET ROLE');
    assert.deepEqual(await reviewWorkspace(unconfirmed.request_id), { status: 'WORKSPACE_IMPACT_NOT_CONFIRMED' });

    await actor(owner, session);
    const confirmed = await submit((await impact()).impact_token);
    await db.exec('RESET ROLE');
    const report = await reviewWorkspace(confirmed.request_id);
    assert.equal(report.status, 'REVIEW_ONLY');
    assert.equal(report.owned_workspaces, 2);
    assert.equal(report.owned_legacy_families, 2);
    assert.equal(report.memberships_in_other_workspaces, 1);
    assert.deepEqual(report.file_ledger_rows, { ordinary: 1, subscription: 0, business: 1 });
    assert.deepEqual(report.payments_in_other_workspaces, {
      family_payments: 2,
      family_payments_with_linked_proof: 1,
      business_bill_payments: 1,
      business_income_receipts: 1,
      business_paid_claims: 1
    });
    assert.deepEqual(report.historical_payment_names, {
      family_recordings_without_name: 0,
      family_payers_without_name: 0,
      profile_name_available: false
    });
    assert.ok(!JSON.stringify(report).includes('Fixture Name'));

    await db.exec(`UPDATE public.family_members SET name = 'fixture@example.invalid' WHERE id = '${payer}'`);
    assert.deepEqual((await reviewWorkspace(confirmed.request_id)).historical_payment_names, {
      family_recordings_without_name: 1,
      family_payers_without_name: 1,
      profile_name_available: false
    });
    await db.exec(`INSERT INTO public.profiles VALUES ('${owner}', 'Fixture Profile Name')`);
    const profileFallback = await reviewWorkspace(confirmed.request_id);
    assert.deepEqual(profileFallback.historical_payment_names, {
      family_recordings_without_name: 0,
      family_payers_without_name: 0,
      profile_name_available: true
    });
    assert.ok(!JSON.stringify(profileFallback).includes('Fixture Profile Name'));
    const rows = Object.fromEntries(report.direct_dependencies.map(row => [row.relation, [row.on_delete, row.matching_rows]]));
    assert.deepEqual(rows, { fixture_family_records: ['CASCADE', 1], fixture_workspace_records: ['RESTRICT', 1] });
    assert.ok(!JSON.stringify(report).includes(business));
    assert.ok(!JSON.stringify(report).includes(owner));

    await db.exec('SET ROLE service_role');
    await assert.rejects(() => reviewWorkspace(confirmed.request_id), { code: '42501' });
    await db.exec('RESET ROLE');
    await db.exec(`UPDATE public.budget_workspaces SET status = 'closed' WHERE id = '${business}'`);
    assert.deepEqual(await reviewWorkspace(confirmed.request_id), { status: 'WORKSPACE_IMPACT_CHANGED' });

    await actor(owner, session);
    await cancel();
    await db.exec('RESET ROLE');
    assert.deepEqual(await reviewWorkspace(confirmed.request_id), { status: 'REQUEST_UNAVAILABLE' });
  });

});
