// Disposable PostgreSQL fixture only; no Supabase credentials or network.
const { PGlite } = require(process.env.MUSHAVO_PGLITE_MODULE || '@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const sql = readFileSync(path.join(__dirname,
  '../supabase/diagnostics/security_stage_1_backup_inventory.sql'), 'utf8');

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema auth; create schema storage;
      create table auth.users(id uuid, email text, encrypted_password text);
      create table storage.buckets(id text primary key, public boolean,
        file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(bucket_id text, name text, metadata jsonb);
      create function public.fixture_profile_hook() returns trigger language plpgsql
        as $$begin return new; end$$;
      create trigger fixture_profile_hook after insert on auth.users
        for each row execute function public.fixture_profile_hook();
      alter table storage.objects enable row level security;
      create policy fixture_object_policy on storage.objects using (false);
      insert into auth.users values (gen_random_uuid(),
        'PRIVATE_EMAIL_SENTINEL', 'PRIVATE_PASSWORD_SENTINEL');
      insert into storage.buckets values
        ('fixture-files',false,1024,array['application/pdf']),
        ('fixture-empty',false,null,null);
      insert into storage.objects values
        ('fixture-files','PRIVATE_PATH_SENTINEL','{"size":12}'),
        ('fixture-files','PRIVATE_PATH_SENTINEL','{"size":"8"}'),
        ('fixture-files','PRIVATE_PATH_SENTINEL','{}'),
        ('fixture-files','PRIVATE_PATH_SENTINEL','{"size":"invalid"}'),
        ('fixture-files','PRIVATE_PATH_SENTINEL','{"size":-1}'),
        ('fixture-files','PRIVATE_PATH_SENTINEL','{"size":"99999999999999999999999999999"}');
    `);
    const run = async () => (await db.exec(sql))
      .flatMap(result => result.rows || []).filter(row => row.check_name);
    const row = (rows, prefix) => rows.find(item => item.check_name.startsWith(prefix));
    const rows = await run();
    assert.equal(rows.length, 13);
    assert.equal(rows.filter(item => item.status === 'INFO').length, 12);
    assert.equal(row(rows, '13 ').status, 'REVIEW');
    assert.equal(row(rows, '01 ').details.transaction_read_only, 'on');
    assert.equal(row(rows, '01 ').details.transaction_isolation, 'repeatable read');
    assert.equal(row(rows, '07 ').details.user_count, 1);
    assert.equal(row(rows, '08 ').details.length, 2);
    const objects = row(rows, '09 ').details.by_bucket[0];
    assert.equal(objects.object_count, 6);
    assert.equal(Number(objects.recorded_bytes), 20);
    assert.equal(objects.unknown_size_count, 4);
    assert.equal(row(rows, '10 ').details.triggers[0].function_schema, 'public');
    assert.equal(row(rows, '10 ').details.policies.length, 1);
    assert.equal(row(rows, '12 ').details.cron_jobs_table, false);
    assert.equal(row(rows, '13 ').details.backup_created_by_this_check, false);
    assert(!JSON.stringify(rows).includes('PRIVATE_'));
    // Prove aggregate reads did not mutate rows, and empty inventories stay
    // explicit rather than pretending a backup or restore passed.
    assert.equal((await db.query('select count(*) as n from storage.objects')).rows[0].n, 6);
    await db.exec('delete from storage.objects; delete from storage.buckets; delete from auth.users;');
    const empty = await run();
    assert.equal(row(empty, '07 ').details.user_count, 0);
    assert.deepEqual(row(empty, '08 ').details, []);
    assert.deepEqual(row(empty, '09 ').details.by_bucket, []);
    assert.equal(row(empty, '13 ').status, 'REVIEW');
    await assert.rejects(db.exec(
      'begin transaction read only; insert into auth.users(id) values(gen_random_uuid());'),
      /read.only/i);
    await db.exec('rollback;');
    console.log('PASS: disposable PostgreSQL inventory returns 12 INFO + 1 REVIEW; read-only context, aggregates, empty scope, unknown sizes, managed dependencies and private-value omission checked. No hosted backup/restore proof.');
  } finally { await db.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
