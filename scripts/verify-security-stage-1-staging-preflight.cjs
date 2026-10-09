// Disposable synthetic PostgreSQL only; never a hosted target/identity test.
const { PGlite } = require(process.env.MUSHAVO_PGLITE_MODULE || '@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const sql = readFileSync(path.join(__dirname,'../supabase/diagnostics/security_stage_1_staging_preflight.sql'),'utf8');
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema auth; create schema storage;
      create table auth.users(id int, email text);
      create table storage.buckets(id text);
      create table storage.objects(id int, name text);
      create table fixture_write_guard(id int);`);
    // The test write guard must not itself affect public scope emptiness.
    await db.exec('alter table fixture_write_guard set schema auth');
    const run = async () => (await db.exec(sql)).flatMap(x=>x.rows||[]).filter(x=>x.check_name);
    const countRow = rows=>rows.find(x=>x.check_name.startsWith('03 '));
    let rows = await run();assert.equal(rows.length,4);
    assert.equal(rows[0].details.transaction_read_only,'on');assert.equal(rows[0].details.transaction_isolation,'repeatable read');
    assert.equal(countRow(rows).status,'PASS');assert.equal(rows[3].status,'REVIEW');
    assert.match(rows[0].details.project_identity_scope,/does not establish/);
    assert.equal(rows[3].details.schema_or_data_created_by_this_check,false);
    await db.exec(`create table public.fixture_private(id int, customer_secret text);
      create function public.fixture_private_routine() returns text language sql as $$select 'PRIVATE_FUNCTION_BODY'$$;
      insert into auth.users values(1,'PRIVATE_EMAIL');
      insert into storage.buckets values('PRIVATE_BUCKET');
      insert into storage.objects values(1,'PRIVATE_OBJECT_PATH');`);
    rows=await run();assert.equal(countRow(rows).status,'REVIEW');
    for(const k of ['public_nonextension_relations','public_nonextension_routines','auth_users','storage_buckets','storage_objects'])assert.equal(countRow(rows).details[k],1);
    assert.equal(JSON.stringify(rows).includes('PRIVATE_'),false);
    await db.exec(`delete from auth.users;delete from storage.buckets;delete from storage.objects;
      drop table public.fixture_private;`);
    // Synthetic extension-owned catalog dependency in this disposable DB only.
    await db.exec(`insert into pg_depend(classid,objid,objsubid,refclassid,refobjid,refobjsubid,deptype)
      select 'pg_proc'::regclass,'public.fixture_private_routine()'::regprocedure,0,
        'pg_extension'::regclass,oid,0,'e' from pg_extension where extname='plpgsql';`);
    rows=await run();assert.equal(countRow(rows).details.public_nonextension_routines,0);assert.equal(countRow(rows).status,'PASS');
    await assert.rejects(db.exec(sql.replace('rollback;','insert into auth.fixture_write_guard values(7); rollback;')),/read.only/i);
    await db.exec('rollback');assert.equal((await db.query('select count(*)::int as n from auth.fixture_write_guard')).rows[0].n,0);
    await db.exec('create role fixture_no_access; set role fixture_no_access');
    await assert.rejects(run(),/permission denied/i);await db.exec('rollback; reset role');
    await db.exec('drop table storage.objects');await assert.rejects(run(),/does not exist/i);await db.exec('rollback');
    console.log(JSON.stringify({stage_step:'1.3',result:'SYNTHETIC_STAGING_PREFLIGHT_FIXTURE_PASS',checks:4,
      cases:['empty scoped counts','nonempty each count','private value omission','extension-owned exclusion','read-only write denial','permission error not zero','missing table not zero'],
      hosted_project_identity_or_execution_verified:false}));
  } finally { await db.close(); }
})().catch(()=>{console.error('Synthetic staging preflight fixture failed. No hosted project was accessed.');process.exitCode=1;});
