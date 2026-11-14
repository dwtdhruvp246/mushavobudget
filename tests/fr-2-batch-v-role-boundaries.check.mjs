import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { installationSQL } from '../scripts/install-fr-2-email-batch-h.mjs';
import { handoffSQL } from '../scripts/lib/email-registration-handoff-sql.mjs';
import { prepareReviewedEmailPlatform } from '../scripts/lib/email-reviewed-platform-fixture.mjs';
import { windowHandoffSQL } from '../scripts/lib/email-window-handoff-sql.mjs';
import { localDatabase } from '../scripts/lib/stage-3-local-db.mjs';

const uuid = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const actors = ['super_admin', 'admin_staff', 'finance_staff', 'support_staff', null].map((role, index) =>
  ({ role, user: uuid(index + 1), session: uuid(index + 11), email: `batch-v-${index}@example.invalid` }));
const [superAdmin] = actors;
const customer = uuid(21), ticket = uuid(22);
const sql = name => readFile(new URL(`../supabase/candidates/${name}.sql`, import.meta.url), 'utf8');

test('current staged SQL distinguishes platform roles and denies direct privilege changes', { timeout: 60000 }, async t => {
  assert(process.env.MUSHAVO_PGLITE_MODULE, 'PINNED_PGLITE_MODULE_REQUIRED');
  const { db } = await localDatabase(process.env.MUSHAVO_PGLITE_MODULE, { preparePlatform: prepareReviewedEmailPlatform });
  try {
    await db.exec((await handoffSQL()).write);
    await db.exec((await installationSQL()).write);
    await db.exec((await windowHandoffSQL()).write);
    await db.exec(await sql('security_fr_2_5_persistent_device_handoff'));
    await db.exec(await sql('security_fr_2_5_password_signin_upgrade'));
    await db.exec(await sql('security_fr_2_5_business_seats'));
    for (const { role, user, session, email } of actors) {
      await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [user, email]);
      await db.query('insert into auth.sessions(id,user_id) values($1,$2)', [session, user]);
      if (role) await db.query('insert into public.app_admins(user_id,email,role) values($1,$2,$3)', [user, email, role]);
    }
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'customer@example.invalid',now())", [customer]);
    await db.query("insert into public.support_tickets(id,customer_id,created_by,subject,description) values($1,$2,$2,'Fixture ticket','Isolated test')", [ticket, customer]);

    const originalRoles = await db.query('select user_id,role from public.app_admins order by user_id');
    const originalFinance = await db.query('select * from public.admin_finance_settings');
    async function asActor(actor, operation) {
      await db.exec('begin');
      try {
        await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({
          sub: actor.user, session_id: actor.session, exp: Math.floor(Date.now() / 1000) + 3600,
          role: 'authenticated', aal: 'aal1', user_metadata: { role: 'super_admin' }
        })]);
        await db.exec('set local role authenticated');
        return await operation();
      } finally { await db.exec('rollback'); }
    }

    for (const actor of actors) {
      const role = actor.role;
      const canManagePlans = ['super_admin', 'admin_staff'].includes(role);
      const canManageFinance = ['super_admin', 'admin_staff', 'finance_staff'].includes(role);
      const canReadSupport = ['super_admin', 'admin_staff', 'support_staff'].includes(role);
      await t.test(role || 'ordinary account with forged user metadata', async () => {
        await asActor(actor, async () => {
          const { rows: [{ gate }] } = await db.query('select public.app_session_status() as gate');
          assert.deepEqual(gate, { contract: 1, policy: 'PASSWORD_ONLY_ALL_USERS', session_valid: true,
            admin_authorized: role !== null, role });
          assert.deepEqual((await db.query('select role from public.app_admins')).rows, role ? [{ role }] : []);
          assert.equal((await db.query('select id from public.admin_finance_settings where id=1')).rows.length, Number(canManageFinance));
          assert.equal((await db.query('select id from public.support_tickets where id=$1', [ticket])).rows.length, Number(canReadSupport));
          assert.equal((await db.query("update public.app_admins set role='super_admin' where user_id=$1 returning user_id", [actor.user])).rows.length, 0);
          assert.equal((await db.query('delete from public.app_admins where user_id=$1 returning user_id', [actor.user])).rows.length, 0);
        });
        const preview = () => db.query("select public.admin_plan_calculation_preview('personal',10,0,1,1,1,'2026-11-01','2026-12-01','2026-11-15','monthly') as result");
        if (canManagePlans) {
          const { rows: [{ result }] } = await asActor(actor, preview);
          assert.equal(result.preview_only, true);
          assert.equal(result.subscription_total, 10);
        } else await assert.rejects(asActor(actor, preview), /PLAN_MANAGEMENT_ACCESS_REQUIRED/);
        const finance = () => db.query("select (public.save_admin_finance_currency_settings('USD',array['USD'],false)).id as id");
        if (canManageFinance) assert.deepEqual((await asActor(actor, finance)).rows, [{ id: 1 }]);
        else await assert.rejects(asActor(actor, finance), /FINANCE_CURRENCY_ACCESS_REQUIRED/);
        await assert.rejects(asActor(actor, () => db.query("select public.admin_set_business_seats(null,0,null,'','')")),
          role === 'super_admin' ? /INVALID_BUSINESS_SEAT_ALLOWANCE/ : /SUPER_ADMIN_REQUIRED/);
        await assert.rejects(asActor(actor, () => db.query("select public.set_user_account_status($1,'suspended')", [superAdmin.user])),
          canManagePlans ? /INVALID_ACCOUNT_STATUS/ : /ADMIN_REQUIRED/);
      });
    }
    await assert.rejects(asActor(actors.at(-1), () => db.query(
      "insert into public.app_admins(user_id,email,role) values($1,$2,'super_admin')", [actors.at(-1).user, actors.at(-1).email])),
    error => error.code === '42501' && /row-level security/.test(error.message));
    assert.deepEqual(await db.query('select user_id,role from public.app_admins order by user_id'), originalRoles);
    assert.deepEqual(await db.query('select * from public.admin_finance_settings'), originalFinance);
  } finally { await db.close(); }
});
