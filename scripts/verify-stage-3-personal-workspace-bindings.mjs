// Local, reduced-schema source probe. This is not hosted application acceptance.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const modulePath = process.argv[2];
if (!modulePath) throw new Error('Supply the externally installed PGlite module path.');
const { PGlite } = await import(pathToFileURL(modulePath));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'supabase/migrations/20260901061500_currencyapi_multicurrency.sql'), 'utf8');
const suspension = await readFile(path.join(root, 'supabase/migrations/20260925090000_expiry_and_account_suspension.sql'), 'utf8');
function fn(text, name) {
  const result = text.match(new RegExp('create or replace function public\\.' + name + '\\([\\s\\S]*?\\$\\$;','i'));
  assert(result, 'Source function not found: ' + name); return result[0];
}
function trigger(name) {
  const result = source.match(new RegExp('create trigger ' + name + '[\\s\\S]*?;','i'));
  assert(result, 'Source trigger not found: ' + name); return result[0];
}
function policy(name) {
  const result = source.match(new RegExp('create policy "' + name + '"[\\s\\S]*?;','i'));
  assert(result, 'Source policy not found: ' + name); return result[0];
}
const db = new PGlite();
const owner = '00000000-0000-4000-8000-000000000001';
const outsider = '00000000-0000-4000-8000-000000000002';
const firstWorkspace = '00000000-0000-4000-8000-000000000010';
const secondWorkspace = '00000000-0000-4000-8000-000000000020';
const item = '00000000-0000-4000-8000-000000000100';
const record = '00000000-0000-4000-8000-000000000200';
try {
  await db.exec(`
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$select current_setting('request.jwt.claim.sub', true)::uuid$$;
    create function auth.role() returns text language sql stable as $$select 'authenticated'::text$$;
    create table public.app_admins(user_id uuid);
    create table public.families(id uuid, owner_id uuid);
    create table public.family_members(id uuid, family_id uuid, status text);
    create table public.budget_workspaces(id uuid primary key, owner_id uuid, workspace_type text,
      legacy_family_id uuid, status text);
    create table public.payment_items(id uuid primary key, owner_id uuid, created_by uuid, family_id uuid,
      responsible_member_id uuid, workspace_id uuid references public.budget_workspaces,
      visibility text, status text, keep_on_free boolean default false, amount numeric);
    create table public.payment_records(id uuid primary key, owner_id uuid, recorded_by uuid, family_id uuid,
      payment_item_id uuid references public.payment_items, workspace_id uuid references public.budget_workspaces,
      visibility text, amount numeric);
    create function public.is_active_family_participant(uuid) returns boolean language sql as $$select false$$;
    create function public.my_account_suspended() returns boolean language sql as $$select false$$;
    create function public.payment_plan_paused(uuid) returns boolean language sql as $$select false$$;
    create function public.effective_workspace_entitlement(uuid)
      returns table(workspace_id uuid, read_only boolean, effective_status text)
      language sql stable security definer set search_path=public,pg_temp as
      $$select id, false, 'active'::text from public.budget_workspaces
        where id=$1 and owner_id=auth.uid()$$;
    grant usage on schema public,auth to authenticated;
    grant select on app_admins,families,family_members to authenticated;
    grant select,insert,update,delete on payment_items,payment_records to authenticated;
    alter table payment_items enable row level security;
    alter table payment_records enable row level security;
    ${fn(source, 'sync_payment_workspace')}
    ${fn(source, 'sync_payment_record_workspace')}
    ${fn(suspension, 'guard_workspace_finance_write')}
    ${trigger('sync_payment_item_workspace_trigger')}
    ${trigger('sync_payment_record_workspace_trigger')}
    ${trigger('z_guard_payment_item_write_trigger')}
    ${trigger('guard_payment_record_write_trigger')}
    ${policy('Household participants can read payment items')}
    ${policy('Household owners can update payment items')}
    ${policy('Household participants can read payment records')}
    ${policy('Household owners can update payment records')}
    insert into budget_workspaces values
      ('${firstWorkspace}','${owner}','personal',null,'active'),
      ('${secondWorkspace}','${outsider}','personal',null,'active');
    select set_config('request.jwt.claim.sub','${owner}',false);
    insert into payment_items(id,owner_id,created_by,visibility,status,amount)
      values('${item}','${owner}','${owner}','personal','inactive',1);
    insert into payment_records(id,owner_id,recorded_by,payment_item_id,visibility,amount)
      values('${record}','${owner}','${owner}','${item}','personal',1);
    set role authenticated;
  `);
  const own = await db.query(`update payment_records set amount=2 where id='${record}' returning workspace_id`);
  assert.equal(own.rows.length, 1); assert.equal(own.rows[0].workspace_id, firstWorkspace);
  await db.exec(`select set_config('request.jwt.claim.sub','${outsider}',false)`);
  assert.equal((await db.query(`select id from payment_records where id='${record}'`)).rows.length, 0);
  assert.equal((await db.query(`update payment_records set amount=3 where id='${record}' returning id`)).rows.length, 0);
  await db.exec(`select set_config('request.jwt.claim.sub','${owner}',false)`);
  let itemDenied = false;
  try { await db.exec(`update payment_items set workspace_id='${secondWorkspace}' where id='${item}'`); }
  catch (e) { itemDenied = e.message === 'WORKSPACE_ACCESS_REQUIRED'; }
  assert.equal(itemDenied, true);
  const rebound = await db.query(`update payment_records set workspace_id='${secondWorkspace}' where id='${record}' returning workspace_id,payment_item_id`);
  assert.equal(rebound.rows[0].workspace_id, secondWorkspace);
  assert.equal(rebound.rows[0].payment_item_id, item);
  assert.equal((await db.query(`select workspace_id from payment_items where id='${item}'`)).rows[0].workspace_id, firstWorkspace);
  // Isolate the missing trigger coverage without editing source or hosted data.
  await db.exec(`reset role;
    drop trigger sync_payment_record_workspace_trigger on payment_records;
    create trigger sync_payment_record_workspace_trigger before insert or update of payment_item_id,workspace_id
      on payment_records for each row execute function public.sync_payment_record_workspace();
    set role authenticated;`);
  const normalized = await db.query(`update payment_records set workspace_id='${secondWorkspace}' where id='${record}' returning workspace_id`);
  assert.equal(normalized.rows[0].workspace_id, firstWorkspace);
  console.log(JSON.stringify({ stage_step: '3.2.1', result: 'REDUCED_SCHEMA_PAID_RECORD_WORKSPACE_GAP_REPRODUCED',
    selected_controls_passed: 6, current_source_direct_record_workspace_substitution_prevented: false,
    local_only_trigger_coverage_counterexample_normalizes_workspace: true,
    source_files_or_hosted_data_modified: false, hosted_behavior_or_complete_schema_verified: false }, null, 2));
} finally { await db.close(); }
