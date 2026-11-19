// Disposable catalog fixtures only. This does not connect to Supabase.
// node scripts/verify-stage-3-permission-baseline.mjs /absolute/path/to/@electric-sql/pglite/dist/index.js
// The fixture engine is supplied externally; repository dependencies are unchanged.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Supply the installed PGlite module path for disposable local fixtures.');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const sql = await readFile(new URL('../supabase/diagnostics/security_stage_3_permission_baseline.sql', import.meta.url), 'utf8');
const db = new PGlite();
const checks = [];
const privateTables = ['app_admins', 'payment_records', 'payments', 'profiles', 'workspace_invitations', 'workspace_members', 'workspace_subscriptions'];
const writer = 'public.store_api_payment_conversion(text,uuid,uuid,numeric,text,text,timestamptz)';
const dates = 'public.currency_conversion_backfill_dates(integer)';
async function run() {
  const batches = await db.exec(sql);
  const rows = batches.find(batch => batch.rows?.[0]?.check_name)?.rows;
  assert.equal(rows?.length, 8);
  return rows;
}
async function check(name, body) { await body(); checks.push(name); }
const status = (rows, number) => rows[number - 1].status;

try {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE ROLE inherited_reader;
    CREATE ROLE inherited_executor;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  `);
  for (const name of privateTables) {
    await db.exec(`CREATE TABLE public.${name} (id integer, secret text);
      INSERT INTO public.${name} VALUES (1, 'CUSTOMER_ROW_SENTINEL');
      ALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.${name} FORCE ROW LEVEL SECURITY;
      GRANT SELECT ON TABLE public.${name} TO authenticated;`);
  }
  await db.exec(`
    CREATE FUNCTION ${writer} RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
      AS $$ BEGIN RAISE EXCEPTION 'FUNCTION_BODY_SECRET_SENTINEL'; END; $$;
    CREATE FUNCTION ${dates} RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
      AS $$ BEGIN RAISE EXCEPTION 'FUNCTION_BODY_SECRET_SENTINEL'; END; $$;
    REVOKE ALL ON FUNCTION ${writer}, ${dates} FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION ${writer}, ${dates} TO service_role;
    CREATE FUNCTION public.fixture_default_execute() RETURNS integer LANGUAGE sql SECURITY DEFINER
      AS $$ SELECT 12345 $$;
    CREATE POLICY fixture_restricted ON public.profiles AS RESTRICTIVE TO authenticated USING (false);
    CREATE VIEW public.fixture_owner_view AS SELECT id FROM public.profiles;
    CREATE VIEW public.fixture_invoker_view WITH (security_invoker = true) AS SELECT id FROM public.profiles;
  `);
  await check('Eight ordered rows; read-only transaction and narrow positive metadata controls', async () => {
    const rows = await run();
    assert.equal(rows[0].details.transaction_read_only, 'on');
    assert.equal(rows[0].details.transaction_isolation, 'repeatable read');
    assert.deepEqual(rows.map(r => r.check_name.slice(0, 2)), ['01','02','03','04','05','06','07','08']);
    assert.equal(status(rows, 4), 'PASS');
    assert.equal(status(rows, 6), 'PASS');
    assert.equal(status(rows, 5), 'REVIEW'); // Missing selected routines do not become successful authorization.
  });
  await check('No customer rows, function bodies or setting values returned; application functions not invoked', async () => {
    const rows = await run();
    const output = JSON.stringify(rows);
    assert.equal(output.includes('CUSTOMER_ROW_SENTINEL'), false);
    assert.equal(output.includes('FUNCTION_BODY_SECRET_SENTINEL'), false);
    assert.equal(output.includes('search_path=public'), false);
    assert.equal(rows[7].details.application_routines_invoked, false);
    assert.equal((await db.query('SELECT count(*) AS n FROM public.profiles')).rows[0].n, 1);
  });
  await check('Column-only anonymous SELECT fails the private-table restriction', async () => {
    await db.exec('GRANT SELECT (id) ON public.profiles TO anon');
    assert.equal((await db.query("SELECT has_table_privilege('anon', 'public.profiles', 'SELECT') AS granted")).rows[0].granted, false);
    assert.equal(status(await run(), 4), 'FAIL');
    await db.exec('REVOKE SELECT (id) ON public.profiles FROM anon');
  });
  await check('Inherited anonymous SELECT fails the private-table restriction', async () => {
    await db.exec('GRANT SELECT ON public.profiles TO inherited_reader; GRANT inherited_reader TO anon');
    assert.equal(status(await run(), 4), 'FAIL');
    await db.exec('REVOKE inherited_reader FROM anon; REVOKE SELECT ON public.profiles FROM inherited_reader');
  });
  await check('PUBLIC SELECT fails the private-table restriction', async () => {
    await db.exec('GRANT SELECT ON public.profiles TO PUBLIC');
    assert.equal(status(await run(), 4), 'FAIL');
    await db.exec('REVOKE SELECT ON public.profiles FROM PUBLIC');
  });
  await check('Inherited signed-in helper EXECUTE fails the protected-helper restriction', async () => {
    await db.exec(`GRANT EXECUTE ON FUNCTION ${writer} TO inherited_executor; GRANT inherited_executor TO authenticated`);
    assert.equal(status(await run(), 6), 'FAIL');
    await db.exec(`REVOKE inherited_executor FROM authenticated; REVOKE EXECUTE ON FUNCTION ${writer} FROM inherited_executor`);
  });
  await check('Default PUBLIC function EXECUTE appears in the anonymous definer inventory', async () => {
    const inventory = (await run())[6].details;
    assert.ok(inventory.anon_executable_signatures.includes('public.fixture_default_execute()'));
    assert.equal(inventory.anon_executable_without_search_path_setting, 1);
  });
  await check('Disabled RLS fails the prior restriction baseline', async () => {
    await db.exec('ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY');
    assert.equal(status(await run(), 4), 'FAIL');
    await db.exec('ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY');
  });
  await check('View invoker metadata and restrictive-policy counts are reported without behavior claims', async () => {
    const details = (await run())[2].details;
    assert.equal(details.view_like_relations.find(v => v.name === 'fixture_owner_view').security_invoker_option, false);
    assert.equal(details.view_like_relations.find(v => v.name === 'fixture_invoker_view').security_invoker_option, true);
    assert.equal(details.selected_relations.find(t => t.name === 'profiles').restrictive_policy_count, 1);
  });
  await check('Missing helper is explicit and cannot produce a false PASS', async () => {
    await db.exec(`DROP FUNCTION ${dates}`);
    const rows = await run();
    assert.equal(status(rows, 6), 'FAIL');
    assert.equal(rows[5].details.records.find(r => r.signature.startsWith('currency_conversion')).present, false);
  });
  await check('Missing protected table is explicit and cannot produce a false PASS', async () => {
    await db.exec('DROP TABLE public.payment_records');
    const rows = await run();
    assert.equal(status(rows, 4), 'FAIL');
    assert.equal(rows[3].details.records.find(r => r.table === 'payment_records').present, false);
  });
  await check('Missing API role produces review/failure metadata rather than an exception or false PASS', async () => {
    await db.exec('DROP OWNED BY anon; DROP ROLE anon');
    const rows = await run();
    assert.equal(status(rows, 2), 'REVIEW');
    assert.equal(status(rows, 4), 'FAIL');
    assert.equal(status(rows, 6), 'FAIL');
  });
  console.log(JSON.stringify({
    stage_step: '3.1.1', result: 'DISPOSABLE_PERMISSION_BASELINE_FIXTURES_PASS',
    server_version: (await db.query('SHOW server_version')).rows[0].server_version,
    checks_passed: checks.length, checks, hosted_connection_performed: false,
    application_authorization_verified: false, repository_dependencies_changed: false
  }, null, 2));
} finally {
  await db.close();
}
