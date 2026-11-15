import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { PGlite } from '../scripts/fixtures/email-session-review-tools/node_modules/@electric-sql/pglite/dist/index.js';
const migration = await readFile(new URL(
  '../supabase/migrations/20261115195000_fr33_account_deletion_requests.sql',
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
    CREATE TABLE public.budget_workspaces (id uuid, owner_id uuid, workspace_type text);
    CREATE TABLE public.workspace_members (user_id uuid, workspace_id uuid);
    CREATE TABLE public.family_heads (user_id uuid);
    CREATE TABLE public.family_members (user_id uuid);
    INSERT INTO auth.users VALUES ('${owner}'), ('${other}');
    INSERT INTO auth.sessions VALUES ('${session}', '${owner}', now()), ('${otherSession}', '${other}', now());
    INSERT INTO auth.mfa_amr_claims VALUES ('${session}', 'password', now()), ('${otherSession}', 'password', now() - interval '1 hour');
  `);
  await db.exec(migration);

  const call = async name => (await db.query(`SELECT public.${name}() AS payload`)).rows[0].payload;
  const status = () => call('fr33_account_deletion_status');
  const request = () => call('fr33_request_account_deletion');
  const cancel = () => call('fr33_cancel_account_deletion');
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
      INSERT INTO public.budget_workspaces VALUES ('${workspace}', '${owner}', 'business');
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
    const rows = (await db.query('SELECT cancelled_at FROM mushavo_account_deletion.requests')).rows;
    assert.equal(rows.length, 2);
    assert.equal(rows.filter(row => row.cancelled_at === null).length, 1);
  });
});
