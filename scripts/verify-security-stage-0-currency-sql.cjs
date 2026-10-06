// Isolated PostgreSQL only; actual source currency functions/DDL, synthetic data.
const { PGlite } = require(process.env.MUSHAVO_PGLITE_MODULE || '@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname,'..');
const source = readFileSync(path.join(root,'supabase/schema.sql'),'utf8');
const migration = readFileSync(path.join(root,'supabase/migrations/20261006050000_security_stage_0_currency_helpers.sql'),'utf8');
const diagnostic = readFileSync(path.join(root,'supabase/diagnostics/security_stage_0_currency_helpers_diagnostic.sql'),'utf8');
function definition(name) {
  const starts = [...source.matchAll(new RegExp('create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.'+name+'\\s*\\(','gi'))];
  assert(starts.length,'Missing source function '+name);
  const tail = source.slice(starts.at(-1).index);
  const open = /\bas\s+(\$[\w]*\$)/i.exec(tail);
  const end = tail.indexOf(open[1],open.index+open[0].length);
  return tail.slice(0,end+open[1].length+1);
}
const user = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const admin = '00000000-0000-0000-0000-000000000003';
const workspace = '10000000-0000-0000-0000-000000000001';
const otherWorkspace = '10000000-0000-0000-0000-000000000002';
const oldPayment = '20000000-0000-0000-0000-000000000001';
const newPayment = '20000000-0000-0000-0000-000000000002';
const helper = 'public.store_api_payment_conversion(text,uuid,uuid,numeric,text,text,timestamptz)';
async function asRole(db,role,subject,sql) {
  await db.exec(`set role ${role}; set "request.jwt.claim.role"='${role}'; set "request.jwt.claim.sub"='${subject || ''}';`);
  try { return await db.query(sql); }
  finally { await db.exec('reset role; reset "request.jwt.claim.role"; reset "request.jwt.claim.sub";'); }
}
async function fixture() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create role trusted_converter; create schema auth;
    grant usage on schema public,auth to anon,authenticated,service_role,trusted_converter;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
    create table auth.users(id uuid primary key);
    insert into auth.users values('${user}'),('${other}'),('${admin}');
    create table budget_workspaces(id uuid primary key,owner_id uuid,workspace_type text);
    insert into budget_workspaces values('${workspace}','${user}','personal'),('${otherWorkspace}','${other}','personal');
    create table app_admins(user_id uuid,role text); insert into app_admins values('${admin}','finance_staff');
    create table workspace_members(workspace_id uuid,user_id uuid,status text,role text);
    create table workspace_settings(workspace_id uuid primary key,base_currency text default 'USD',
      default_payment_currency text default 'USD',enabled_currencies text[] default array['USD','INR'],
      reporting_currency text default 'INR',conversion_enabled boolean default true,updated_at timestamptz default now());
    insert into workspace_settings(workspace_id) values('${workspace}'),('${otherWorkspace}');
    create table supported_currencies(code text,name text,is_active boolean);
    insert into supported_currencies values('USD','US Dollar',true),('INR','Indian Rupee',true);
    create table payment_records(id uuid primary key,workspace_id uuid,amount numeric,currency text,payment_date date);
    create table payments(id uuid primary key,amount numeric,currency text,payment_date date);
    create table subscription_payments(id uuid primary key,amount numeric,currency text,payment_date date,status text);
    insert into payment_records values('${oldPayment}','${otherWorkspace}',50,'USD',current_date-1);
    create table plans(id uuid primary key,code text,display_name text,description text,marketing_summary text,
      workspace_type text,is_featured boolean,available_for_purchase boolean,cta_label text,sort_order integer,is_active boolean,is_public boolean);
    insert into plans values(gen_random_uuid(),'free','Free','','','personal',false,true,'Select',1,true,true);
    create table plan_limits(plan_id uuid,limit_code text,limit_value integer);
    create table plan_features(plan_id uuid,feature_code text,enabled boolean);
    create table plan_prices(plan_id uuid,billing_period text,currency text,amount numeric,extra_member_amount numeric,
      effective_from timestamptz,effective_until timestamptz,is_active boolean);`);
  // Real conversion tables, constraints, indexes and default admin settings.
  await db.exec(source.slice(source.indexOf('create table if not exists public.admin_finance_settings ('),source.indexOf('create or replace function public.latest_exchange_rate(')));
  for (const name of ['is_platform_staff','is_workspace_owner','latest_exchange_rate','store_api_payment_conversion',
    'currency_conversion_backfill_dates','backfill_currency_conversions','backfill_workspace_currency_conversions',
    'lock_payment_record_conversion','lock_platform_payment_conversion','lock_subscription_payment_conversion',
    'save_workspace_currency_settings','save_manual_payment_conversion','exchange_rate_status',
    'get_public_signup_currencies','get_public_plan_catalogue']) await db.exec(definition(name));
  // Reproduce Supabase direct default grants surviving the old PUBLIC-only REVOKE.
  await db.exec(`grant execute on all functions in schema public to anon,authenticated,service_role;
    revoke all on function ${helper}, public.currency_conversion_backfill_dates(integer) from public;
    grant execute on function public.currency_conversion_backfill_dates(integer) to service_role;
    alter function lock_payment_record_conversion() owner to trusted_converter;
    grant select on workspace_settings to trusted_converter;
    create trigger conversion_on_payment after insert on payment_records for each row execute function lock_payment_record_conversion();
    create trigger conversion_on_platform after insert on payments for each row execute function lock_platform_payment_conversion();
    create trigger conversion_on_subscription after insert or update on subscription_payments for each row execute function lock_subscription_payment_conversion();
    alter table payment_records enable row level security;
    create policy owner_rows on payment_records to authenticated using(public.is_workspace_owner(workspace_id)) with check(public.is_workspace_owner(workspace_id));
    grant insert,select on payment_records to authenticated;
    insert into exchange_rate_sync_runs(id,trigger_source,status,completed_at) values('30000000-0000-0000-0000-000000000001','scheduled','success',now());
    insert into exchange_rate_snapshots(base_currency,quote_currency,rate,provider_effective_at,sync_run_id)
      values('USD','INR',90,current_date-2,'30000000-0000-0000-0000-000000000001');`);
  return db;
}
async function metadata(db) {
  const result = await db.exec('begin transaction read only;\n'+diagnostic+'\nrollback;');
  return result.flatMap(r=>r.rows || []).filter(r=>r.check_name);
}
(async () => {
  const db = await fixture();
  try {
    const before = await metadata(db);
    assert.equal(before.length,12);
    for (const number of ['03','04','05','06']) assert.equal(before.find(r=>r.check_name.startsWith(number)).status,'FAIL');
    const forged = `select public.store_api_payment_conversion('payment_record','${oldPayment}','${otherWorkspace}',999999,'USD','USD',now())`;
    await asRole(db,'anon',null,forged);
    const inserted = (await db.query('select original_amount,converted_amount,is_locked from payment_conversions')).rows[0];
    assert.equal(Number(inserted.original_amount),999999);
    assert.equal(inserted.is_locked,true);
    assert.equal((await asRole(db,'anon',null,'select * from currency_conversion_backfill_dates(7)')).rows.length,1);
    await db.exec('delete from payment_conversions;'); // Synthetic reproduction only.
    console.log('REPRODUCED in fixture: direct anonymous conversion writer trusts supplied amount; historical dates exposed despite old PUBLIC revoke.');

    await db.exec(migration);
    const rows = await metadata(db);
    for (let i=1;i<=10;i++) assert.equal(rows.find(r=>r.check_name.startsWith(String(i).padStart(2,'0'))).status,'PASS');
    assert.equal(rows[10].status,'REVIEW');assert.equal(rows[11].status,'CANNOT VERIFY');
    for (const [role,subject] of [['anon',null],['authenticated',user],['authenticated',other],['authenticated',admin]]) {
      await assert.rejects(asRole(db,role,subject,forged),e=>e.code==='42501');
      await assert.rejects(asRole(db,role,subject,'select * from currency_conversion_backfill_dates(7)'),e=>e.code==='42501');
    }
    assert.equal((await db.query('select count(*) as n from payment_conversions')).rows[0].n,0);
    await asRole(db,'authenticated',user,`insert into payment_records values('${newPayment}','${workspace}',40,'USD',current_date)`);
    const conversion = (await db.query('select original_amount,converted_amount,rate_provider from payment_conversions where entity_id=$1',[newPayment])).rows[0];
    assert.equal(Number(conversion.original_amount),40);assert.equal(Number(conversion.converted_amount),3600);
    assert.equal(conversion.rate_provider,'currencyapi');
    await assert.rejects(asRole(db,'authenticated',user,`select backfill_workspace_currency_conversions('${otherWorkspace}')`),/CURRENCY_SETTINGS_ACCESS_REQUIRED/);
    await asRole(db,'authenticated',other,`select backfill_workspace_currency_conversions('${otherWorkspace}')`);
    assert.equal((await db.query('select count(*) as n from payment_conversions')).rows[0].n,2);
    await assert.rejects(asRole(db,'authenticated',user,'select backfill_currency_conversions()'),/FINANCE_CURRENCY_ACCESS_REQUIRED/);
    await asRole(db,'authenticated',admin,'select backfill_currency_conversions()');
    await asRole(db,'service_role',null,'select * from currency_conversion_backfill_dates(7)');
    await asRole(db,'service_role',null,'select backfill_currency_conversions()');
    await asRole(db,'authenticated',user,`select save_workspace_currency_settings('${workspace}','USD',array['USD','INR'],'INR',true)`);
    const manual = `select save_manual_payment_conversion('payment_record','${newPayment}','INR',91,3640)`;
    await assert.rejects(asRole(db,'authenticated',other,manual),/CURRENCY_SETTINGS_ACCESS_REQUIRED/);
    await asRole(db,'authenticated',user,manual);
    await asRole(db,'service_role',null,'select backfill_currency_conversions()');
    assert.equal(Number((await db.query('select converted_amount from payment_conversions where entity_id=$1',[newPayment])).rows[0].converted_amount),3640);
    await db.exec(`insert into payments values(gen_random_uuid(),10,'USD',current_date);
      insert into subscription_payments values(gen_random_uuid(),15,'USD',current_date,'pending');
      update subscription_payments set status='approved';`);
    assert.equal((await db.query("select count(*) as n from payment_conversions where entity_type in ('platform_payment','subscription_payment')")).rows[0].n,2);
    assert.equal((await asRole(db,'authenticated',user,"select * from latest_exchange_rate('USD','INR',now())")).rows.length,1);
    await asRole(db,'authenticated',user,'select exchange_rate_status(false)');
    assert.equal((await asRole(db,'anon',null,'select * from get_public_signup_currencies()')).rows.length,2);
    assert.equal((await asRole(db,'anon',null,"select * from get_public_plan_catalogue('USD')")).rows.length,1);
    await db.exec(migration);
    assert.equal((await metadata(db)).filter(r=>r.status==='PASS').length,10);
    console.log('PASS: raw helper calls denied for guest/member/admin; real source triggers, distinct trusted owner, authorized backfills/settings/manual conversion, scheduler role, public lookups and repeat apply work.');

    await db.exec(`create role legacy_currency_reader; grant legacy_currency_reader to authenticated;
      grant execute on function ${helper} to legacy_currency_reader;
      grant execute on function currency_conversion_backfill_dates(integer) to anon;`);
    await assert.rejects(db.exec(migration),/EXECUTE_STILL_INHERITED/);
    await db.exec('rollback;');
    assert.equal((await db.query("select has_function_privilege('anon','public.currency_conversion_backfill_dates(integer)','EXECUTE') as allowed")).rows[0].allowed,true);
    await db.exec('revoke legacy_currency_reader from authenticated; alter function lock_platform_payment_conversion() owner to authenticated;');
    await assert.rejects(db.exec(migration),/CALLER_OWNER_UNTRUSTED/);
    await db.exec('rollback;');
    assert.equal((await db.query("select has_function_privilege('anon','public.currency_conversion_backfill_dates(integer)','EXECUTE') as allowed")).rows[0].allowed,true);
    await db.exec('alter function lock_platform_payment_conversion() owner to postgres; drop function currency_conversion_backfill_dates(integer);');
    await assert.rejects(db.exec(migration),/PREREQUISITE_MISSING/);
    await db.exec('rollback;');
    assert.equal((await metadata(db))[0].status,'FAIL');
    console.log('PASS: inherited access, untrusted caller owner and missing helper abort safely; missing helper becomes diagnostic FAIL instead of a query crash.');
  } finally { await db.close(); }
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
