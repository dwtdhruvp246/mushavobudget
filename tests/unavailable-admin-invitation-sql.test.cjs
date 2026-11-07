const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require(process.env.MUSHAVO_PGLITE_MODULE || '@electric-sql/pglite');
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const actorId = id(1), adminId = id(2), invitationId = id(3), planId = id(4);
async function database() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz, banned_until timestamptz, raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id), email text, full_name text, account_status text DEFAULT 'active', updated_at timestamptz DEFAULT now());
    CREATE TABLE public.app_admins(user_id uuid PRIMARY KEY REFERENCES auth.users(id), role text);
    CREATE FUNCTION public.is_platform_staff(text[]) RETURNS boolean LANGUAGE sql AS $$SELECT EXISTS(SELECT 1 FROM public.app_admins WHERE user_id=auth.uid() AND role=ANY($1))$$;
    CREATE TABLE public.plans(id uuid PRIMARY KEY, code text, display_name text, workspace_type text, is_active boolean);
    CREATE TABLE public.plan_prices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid REFERENCES public.plans(id), billing_period text, currency text, amount numeric, extra_member_amount numeric, is_active boolean, effective_from timestamptz, effective_until timestamptz);
    CREATE TABLE public.budget_workspaces(id uuid PRIMARY KEY, owner_id uuid REFERENCES auth.users(id), workspace_type text);
    CREATE SCHEMA mushavo_email_install;
    CREATE TABLE mushavo_email_install.rollout_control(singleton boolean, target_project text, mode text, catalog_sha256 text);
    CREATE TABLE mushavo_email_install.password_signin_policy(id int);
    CREATE FUNCTION mushavo_email_install.catalog_identity() RETURNS text LANGUAGE sql AS $$SELECT 'local-reviewed-catalog'::text$$;
    INSERT INTO mushavo_email_install.rollout_control VALUES(true,'dczlddwbtgvfdujgcitb','ACTIVE','local-reviewed-catalog');
  `);
  for (const name of ['20260922113000_admin_user_invitations.sql', '20260923100000_complete_admin_user_invitations.sql']) {
    await db.exec(fs.readFileSync(__dirname + '/../supabase/migrations/' + name, 'utf8'));
  }
  // Include the canonical launch trigger that the first two-migration fixture omitted.
  const launch = fs.readFileSync(__dirname + '/../supabase/migrations/20260927183000_business_stage_0_launch_lock.sql', 'utf8');
  const currentLaunch = fs.readFileSync(__dirname + '/../supabase/migrations/20261002060000_business_public_availability.sql', 'utf8');
  const launchFunction = currentLaunch.match(/create or replace function public\.enforce_business_admin_invitation_launch_control\(\)[\s\S]*?\$\$;/i)?.[0];
  const launchTrigger = launch.match(/create trigger enforce_business_admin_invitation_launch_control_trigger[\s\S]*?;/i)?.[0];
  assert.ok(launchFunction && launchTrigger);
  await db.exec(launchFunction + '\n' + launchTrigger);
  await db.exec(`
    INSERT INTO auth.users(id,email,email_confirmed_at) VALUES('${actorId}','ordinary@example.test',now()),('${adminId}','admin@example.test',now());
    INSERT INTO profiles(id,email,full_name) VALUES('${actorId}','ordinary@example.test','Original test account'),('${adminId}','admin@example.test','Original admin');
    INSERT INTO app_admins VALUES('${adminId}','super_admin');
    INSERT INTO plans VALUES('${planId}','free','Free','personal',true);
    INSERT INTO plan_prices(plan_id,billing_period,currency,amount,extra_member_amount,is_active,effective_from) VALUES('${planId}','monthly','USD',0,0,true,now()-interval '1 day');
    INSERT INTO budget_workspaces VALUES('${id(5)}','${actorId}','personal');
    SET request.jwt.claim.sub='${actorId}';
  `);
  return db;
}
const attempt = async (db, sql) => {
  try { return await db.exec(sql); }
  catch (error) { await db.exec('ROLLBACK'); throw error; }
};
test('real fixture SQL and source routines deny the matching identity in all three states, then remove only the fixture', async () => {
  const { unavailableInvitationSQL } = await import('../scripts/lib/unavailable-admin-invitation-sql.mjs');
  const pack = unavailableInvitationSQL({ actorId, adminId, invitationId }), db = await database();
  try {
    const before = (await db.query('SELECT row_to_json(p) value FROM profiles p ORDER BY id')).rows;
    const workspaces = (await db.query('SELECT * FROM budget_workspaces ORDER BY id')).rows;
    for (const phase of ['expired', 'cancelled', 'replaced']) {
      await attempt(db, pack[phase]);
      await assert.rejects(db.query('SELECT * FROM get_my_admin_user_invitation($1)', [invitationId]), /ADMIN_INVITATION_NOT_AVAILABLE/);
      await assert.rejects(db.query('SELECT complete_admin_user_invitation($1,ARRAY[\'USD\'],\'USD\')', [invitationId]),
        phase === 'expired' ? /ADMIN_INVITATION_EXPIRED/ : /ADMIN_INVITATION_NOT_AVAILABLE/);
    }
    assert.equal((await db.query("SELECT count(*)::int n FROM admin_user_invitation_audit WHERE safe_details->>'reason'='replaced'")).rows[0].n, 1);
    assert.deepEqual((await db.query('SELECT row_to_json(p) value FROM profiles p ORDER BY id')).rows, before);
    assert.deepEqual((await db.query('SELECT * FROM budget_workspaces ORDER BY id')).rows, workspaces);
    await attempt(db, pack.cleanup); await attempt(db, pack.cleanup);
    assert.equal((await db.query('SELECT count(*)::int n FROM admin_user_invitations')).rows[0].n, 0);
    assert.equal((await db.query('SELECT count(*)::int n FROM admin_user_invitation_audit')).rows[0].n, 0);
  } finally { await db.close(); }
});
test('fixture SQL fails closed for an existing invitation, staff actor, nonzero Free price, or catalog drift', async () => {
  const { unavailableInvitationSQL } = await import('../scripts/lib/unavailable-admin-invitation-sql.mjs');
  const pack = unavailableInvitationSQL({ actorId, adminId, invitationId }), db = await database();
  try {
    await db.exec("UPDATE mushavo_email_install.rollout_control SET catalog_sha256='drift'");
    await assert.rejects(attempt(db, pack.expired), /FIXTURE_CURRENT_PASSWORD_POLICY_CATALOG_REQUIRED/);
    await db.exec("UPDATE mushavo_email_install.rollout_control SET catalog_sha256='local-reviewed-catalog'");
    await db.exec(`INSERT INTO app_admins VALUES('${actorId}','admin_staff')`);
    await assert.rejects(attempt(db, pack.expired), /FIXTURE_EXISTING_ORDINARY_ACCOUNT_REQUIRED/);
    await db.exec(`DELETE FROM app_admins WHERE user_id='${actorId}'`);
    await db.exec('UPDATE plan_prices SET amount=1');
    await assert.rejects(attempt(db, pack.expired), /FIXTURE_ZERO_PRICE_FREE_PLAN_REQUIRED/);
    assert.equal((await db.query('SELECT count(*)::int n FROM admin_user_invitations')).rows[0].n, 0);
    await db.exec('UPDATE plan_prices SET amount=0');
    await attempt(db, pack.expired);
    await assert.rejects(attempt(db, pack.expired), /FIXTURE_REQUIRES_NO_EXISTING_RECIPIENT_INVITATION/);
    assert.equal((await db.query('SELECT count(*)::int n FROM admin_user_invitations')).rows[0].n, 1);
    await attempt(db, pack.cleanup);
  } finally { await db.close(); }
});
test('cleanup refuses a renamed, linked or provisioned row and never deletes an original account', async () => {
  const { unavailableInvitationSQL } = await import('../scripts/lib/unavailable-admin-invitation-sql.mjs');
  const pack = unavailableInvitationSQL({ actorId, adminId, invitationId }), db = await database();
  try {
    await attempt(db, pack.expired);
    await db.exec(`UPDATE admin_user_invitations SET full_name='Original real invitation' WHERE id='${invitationId}'`);
    await assert.rejects(attempt(db, pack.cleanup), /FIXTURE_IDENTITY_OR_UNPROVISIONED_STATE_REQUIRED/);
    await db.exec(`UPDATE admin_user_invitations SET full_name='AU02.04 temporary fixture ${invitationId}' WHERE id='${invitationId}'`);
    await db.exec(`UPDATE profiles SET admin_invitation_id='${invitationId}' WHERE id='${actorId}'`);
    await assert.rejects(attempt(db, pack.cleanup), /FIXTURE_IDENTITY_OR_UNPROVISIONED_STATE_REQUIRED/);
    await db.exec(`UPDATE profiles SET admin_invitation_id=NULL WHERE id='${actorId}'`);
    await db.exec(`UPDATE admin_user_invitations SET provisioned_workspace_id='${id(5)}' WHERE id='${invitationId}'`);
    await assert.rejects(attempt(db, pack.cleanup), /FIXTURE_IDENTITY_OR_UNPROVISIONED_STATE_REQUIRED/);
    await db.exec(`UPDATE admin_user_invitations SET provisioned_workspace_id=NULL WHERE id='${invitationId}'`);
    await attempt(db, pack.cleanup);
    assert.equal((await db.query('SELECT count(*)::int n FROM auth.users')).rows[0].n, 2);
    assert.equal((await db.query('SELECT count(*)::int n FROM budget_workspaces')).rows[0].n, 1);
  } finally { await db.close(); }
});
test('old guard reproduces the owner stop with the canonical launch trigger; repaired guard leaves Business launch protection enforced', async () => {
  const { unavailableInvitationSQL, reviewedBusinessTriggerClause } = await import('../scripts/lib/unavailable-admin-invitation-sql.mjs');
  const pack = unavailableInvitationSQL({ actorId, adminId, invitationId }), db = await database();
  try {
    await assert.rejects(attempt(db, pack.expired.replace(reviewedBusinessTriggerClause, '')), /FIXTURE_UNREVIEWED_INVITATION_TRIGGER/);
    assert.equal((await db.query('SELECT count(*)::int n FROM admin_user_invitations')).rows[0].n, 0);
    await attempt(db, pack.expired);
    const businessId = id(11);
    await db.exec(`INSERT INTO plans VALUES('${businessId}','business','Business','business',true);
      INSERT INTO plan_prices(plan_id,billing_period,currency,amount,extra_member_amount,is_active,effective_from)
      VALUES('${businessId}','monthly','USD',10,0,true,now()-interval '1 day')`);
    await assert.rejects(db.query(`UPDATE admin_user_invitations SET plan_id=$1 WHERE id=$2`, [businessId, invitationId]), /BUSINESS_MANUAL_GRANT_REQUIRED/);
    await attempt(db, pack.cleanup);
  } finally { await db.close(); }
});
test('unknown triggers and altered launch-handler bodies are still refused before any fixture write', async () => {
  const { unavailableInvitationSQL } = await import('../scripts/lib/unavailable-admin-invitation-sql.mjs');
  const pack = unavailableInvitationSQL({ actorId, adminId, invitationId }), db = await database();
  try {
    await db.exec(`CREATE FUNCTION public.unreviewed_fixture_hook() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$;
      CREATE TRIGGER unreviewed_fixture_hook BEFORE INSERT ON public.admin_user_invitations FOR EACH ROW EXECUTE FUNCTION public.unreviewed_fixture_hook()`);
    await assert.rejects(attempt(db, pack.expired), /FIXTURE_UNREVIEWED_INVITATION_TRIGGER/);
    await db.exec('DROP TRIGGER unreviewed_fixture_hook ON public.admin_user_invitations');
    await db.exec(`CREATE OR REPLACE FUNCTION public.enforce_business_admin_invitation_launch_control() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$BEGIN RETURN NEW; END$$`);
    await assert.rejects(attempt(db, pack.expired), /FIXTURE_UNREVIEWED_INVITATION_TRIGGER/);
    assert.equal((await db.query('SELECT count(*)::int n FROM admin_user_invitations')).rows[0].n, 0);
  } finally { await db.close(); }
});
