// Run only against disposable PostgreSQL. No Supabase credentials or network.
const { PGlite } = require(process.env.MUSHAVO_PGLITE_MODULE || '@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const sql = readFileSync(path.join(__dirname, '../supabase/diagnostics/security_stage_0_diagnostic.sql'), 'utf8');
const names = [...sql.slice(sql.indexOf('expected_tables(name)'), sql.indexOf('tables as (')).matchAll(/\('([a-z_]+)'\)/g)].map(m => m[1]);
const functions = [...sql.slice(sql.indexOf('required_rpc(signature)'), sql.indexOf('expected_buckets(id)')).matchAll(/\('([a-z_]+\([^']*\))'\)/g)].map(m => m[1]);
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema storage; create schema auth;
      create table auth.users(id uuid primary key);
      create table storage.buckets(id text primary key, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid); alter table storage.objects enable row level security;
      insert into storage.buckets values ('payment-proofs',false,1048576,array['application/pdf']),
        ('subscription-proofs',false,1048576,array['application/pdf']),('business-documents',false,1048576,array['application/pdf']),
        ('business-logos',false,2097152,array['image/png']);
      grant usage on schema public to anon,authenticated;`);
    for (const name of names) await db.exec(`create table public.${name}(id uuid); alter table public.${name} enable row level security;`);
    await db.exec(`alter table public.profiles add column full_name text, add column email text, add column country_code text, add column is_admin boolean;
      grant insert(id,full_name,email), update(full_name,email,country_code) on profiles to authenticated;
      alter table public.business_roles force row level security;`);
    for (const signature of functions) await db.exec(`create function public.${signature} returns void language sql security definer set search_path=public,pg_temp as $$select$$; revoke all on function public.${signature} from public,anon,authenticated;`);
    const run = async () => {
      const result = await db.exec('begin transaction read only;\n' + sql + '\nrollback;');
      return result.flatMap(item => item.rows || []).filter(row => row.check_name);
    };
    const status = (rows, number) => rows.find(row => row.check_name.startsWith(number + ' '))?.status;
    let rows = await run();
    assert.equal(rows.length, 24);
    for (let number = 1; number <= 13; number++) assert.equal(status(rows,String(number).padStart(2,'0')), 'PASS');
    assert.equal(status(rows,'19'),'REVIEW'); assert.equal(status(rows,'21'),'CANNOT VERIFY');
    await db.exec('alter table payments disable row level security;');
    assert.equal(status(await run(),'03'),'FAIL');
    await db.exec('alter table payments enable row level security; grant select(id) on payments to public;');
    assert.equal(status(await run(),'08'),'FAIL');
    await db.exec('revoke select(id) on payments from public; grant update(id) on business_roles to authenticated;');
    assert.equal(status(await run(),'09'),'FAIL');
    await db.exec('revoke update(id) on business_roles from authenticated; grant update(is_admin) on profiles to authenticated;');
    assert.equal(status(await run(),'10'),'FAIL');
    await db.exec('revoke update(is_admin) on profiles from authenticated; grant execute on function business_role_owner_required(uuid) to public;');
    assert.equal(status(await run(),'12'),'FAIL');
    await db.exec("revoke execute on function business_role_owner_required(uuid) from public; update storage.buckets set public=true where id='business-logos';");
    assert.equal(status(await run(),'06'),'FAIL');
    await db.exec("update storage.buckets set public=false where id='business-logos'; drop table payments;");
    rows = await run(); assert.equal(status(rows,'02'),'FAIL'); assert.equal(status(rows,'08'),'FAIL');
    // Missing tables must produce FAIL rows rather than crash the whole report.
    assert(rows.find(row => row.check_name.startsWith('02 ')).details.missing.includes('payments'));
    await assert.rejects(db.exec('begin transaction read only; insert into profiles(id) values(gen_random_uuid());'), /read.only/i);
    await db.exec('rollback;');
    console.log('PASS: 24-row diagnostic executes read-only; missing tables, disabled RLS, inherited/column grants, profile escalation, callable helpers and public buckets are detected. REVIEW/unknown items never become PASS.');
  } finally { await db.close(); }
})().catch(error => { console.error(error.stack); process.exitCode=1; });
