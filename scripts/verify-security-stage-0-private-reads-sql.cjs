// Disposable PostgreSQL only. No customer rows, live credentials or network.
const { PGlite } = require(process.env.MUSHAVO_PGLITE_MODULE || '@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const migration = readFileSync(path.join(__dirname,'../supabase/migrations/20261006043000_security_stage_0_private_reads.sql'),'utf8');
const tables = ['app_admins','payment_records','payments','profiles','workspace_invitations','workspace_members','workspace_subscriptions'];
const first = '00000000-0000-0000-0000-000000000001';
const second = '00000000-0000-0000-0000-000000000002';

async function fixture() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated,service_role;`);
  for (const name of tables) {
    await db.exec(`create table public.${name}(id uuid primary key,owner_id uuid,note text);
      alter table public.${name} enable row level security;
      create policy owner_read on public.${name} for select to authenticated using(owner_id=auth.uid());
      insert into public.${name} values('${first}','${first}','first'),('${second}','${second}','second');
      grant select on public.${name} to anon,authenticated,service_role;`);
  }
  await db.exec(`grant update(note) on profiles to authenticated;
    create policy owner_update on profiles for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
    create table plans(id integer); insert into plans values(1);
    grant select on plans to anon;
    create table enquiries(note text); grant insert(note) on enquiries to anon;
    create function private_profile_count() returns bigint language sql security definer set search_path=public,pg_temp as $$
      select count(*) from profiles where owner_id=auth.uid() $$;
    revoke all on function private_profile_count() from public,anon;
    grant execute on function private_profile_count() to authenticated;`);
  return db;
}

async function asRole(db,role,subject,sql) {
  await db.exec(`set role ${role}; set "request.jwt.claim.sub"='${subject || ''}';`);
  try { return await db.query(sql); }
  finally { await db.exec('reset role; reset "request.jwt.claim.sub";'); }
}

async function snapshot(db) {
  return (await db.query(`select r.rolname,c.relname,a.attname,
      has_table_privilege(r.oid,c.oid,'SELECT') as table_select,
      has_column_privilege(r.oid,c.oid,a.attnum,'SELECT') as readable,
      has_column_privilege(r.oid,c.oid,a.attnum,'UPDATE') as updatable
    from pg_roles r cross join pg_class c join pg_attribute a on a.attrelid=c.oid
    where r.rolname in ('authenticated','service_role') and c.relnamespace='public'::regnamespace
      and c.relname=any($1::text[]) and a.attnum>0 and not a.attisdropped
    order by r.rolname,c.relname,a.attnum`,[tables])).rows;
}

(async () => {
  let db = await fixture();
  try {
    // Simulate direct grants, PUBLIC inheritance, and explicit column grants.
    await db.exec(`revoke select on workspace_members from anon,authenticated,service_role;
      grant select on workspace_members to public;
      grant select(note) on profiles to anon;
      grant select(note) on workspace_invitations to public;`);
    const before = await snapshot(db);
    const policies = (await db.query('select * from pg_policies order by tablename,policyname')).rows;
    await db.exec(migration);
    assert.deepEqual(await snapshot(db),before);
    assert.deepEqual((await db.query('select * from pg_policies order by tablename,policyname')).rows,policies);
    for (const name of tables) {
      for (const sql of [`select * from ${name}`,`select id from ${name}`,`select note from ${name}`]) {
        await assert.rejects(asRole(db,'anon',null,sql),error=>error.code==='42501');
      }
      for (const subject of [first,second]) {
        assert.deepEqual((await asRole(db,'authenticated',subject,`select id from ${name}`)).rows,[{id:subject}]);
      }
      assert.equal((await asRole(db,'service_role',null,`select * from ${name}`)).rows.length,2);
    }
    assert.equal((await asRole(db,'authenticated',first,`select private_profile_count() as count`)).rows[0].count,1);
    assert.equal((await asRole(db,'authenticated',first,`update profiles set note='allowed' where id='${first}' returning note`)).rows[0].note,'allowed');
    assert.equal((await asRole(db,'authenticated',first,`update profiles set note='forbidden' where id='${second}' returning id`)).rows.length,0);
    assert.deepEqual((await asRole(db,'anon',null,'select * from plans')).rows,[{id:1}]);
    await asRole(db,'anon',null,"insert into enquiries(note) values('public contact still works')");
    await db.exec(migration); // Safe to reapply without broadening effective access.
    assert.deepEqual(await snapshot(db),before);
    console.log('PASS: seven anonymous table/column reads denied; signed-in owner/other-user RLS, server reads, writes, public pricing/contact, RPC and idempotency preserved.');
  } finally { await db.close(); }

  db = await fixture();
  try {
    await db.exec(`revoke select on workspace_invitations from anon,authenticated,service_role;
      grant select(id,owner_id) on workspace_invitations to public;
      grant select(note) on workspace_invitations to anon;`);
    const before = await snapshot(db);
    await db.exec(migration);
    assert.deepEqual(await snapshot(db),before);
    assert.deepEqual((await asRole(db,'authenticated',first,'select id,owner_id from workspace_invitations')).rows,[{id:first,owner_id:first}]);
    await assert.rejects(asRole(db,'authenticated',first,'select note from workspace_invitations'),error=>error.code==='42501');
    await assert.rejects(asRole(db,'anon',null,'select note from workspace_invitations'),error=>error.code==='42501');
    console.log('PASS: existing PUBLIC column-only access preserved for authenticated/service_role without granting hidden columns.');
  } finally { await db.close(); }

  for (const failure of ['inherited','missing','rls_disabled']) {
    db = await fixture();
    try {
      if (failure==='inherited') await db.exec('create role legacy_reader; grant legacy_reader to anon; grant select on workspace_subscriptions to legacy_reader;');
      if (failure==='missing') await db.exec('drop table workspace_subscriptions;');
      if (failure==='rls_disabled') await db.exec('alter table workspace_subscriptions disable row level security;');
      await assert.rejects(db.exec(migration),new RegExp(failure==='inherited'?'ANON_SELECT_STILL_INHERITED':'TABLE_MISSING_OR_RLS_DISABLED'));
      await db.exec('rollback;');
      // The last-table failure must undo changes already made to earlier tables.
      assert.equal((await db.query("select has_table_privilege('anon','app_admins','SELECT') as readable")).rows[0].readable,true);
    } finally { await db.close(); }
  }
  console.log('PASS: unexpected inherited access, missing tables and disabled RLS abort atomically; no membership/CASCADE changes.');
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
