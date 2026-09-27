-- Hidden Personal Cashbook test. This deliberately does not add plan pricing,
-- navigation, Family access, or Business access.
begin;

create table if not exists public.cashbook_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.budget_workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  account_type text not null check (account_type in ('cash', 'bank', 'mobile_money', 'other')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  opening_balance numeric(18, 4) not null default 0,
  opening_balance_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'active' and archived_at is null) or (status = 'archived' and archived_at is not null))
);

create unique index if not exists cashbook_accounts_active_name_unique_idx
on public.cashbook_accounts (workspace_id, lower(btrim(name)))
where status = 'active';

create index if not exists cashbook_accounts_workspace_idx
on public.cashbook_accounts (workspace_id, status, created_at);

create table if not exists public.cashbook_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.budget_workspaces(id) on delete cascade,
  account_id uuid not null references public.cashbook_accounts(id) on delete restrict,
  entry_type text not null check (entry_type in ('cash_in', 'cash_out', 'transfer_in', 'transfer_out')),
  amount numeric(18, 4) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  transaction_date date not null default current_date,
  description text not null check (char_length(btrim(description)) between 1 and 160),
  category text,
  notes text,
  -- Keep the paid-history identifier as an immutable audit reference without
  -- preventing Payments from deleting its own history. Browser writes are
  -- revoked and the linking RPC validates the live record before insertion.
  linked_payment_record_id uuid,
  transfer_group_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id) on delete restrict,
  reversal_reason text,
  check (
    (entry_type in ('cash_in', 'cash_out') and transfer_group_id is null)
    or (entry_type in ('transfer_in', 'transfer_out') and transfer_group_id is not null)
  ),
  check (linked_payment_record_id is null or entry_type = 'cash_out'),
  check (
    (reversed_at is null and reversed_by is null and reversal_reason is null)
    or (reversed_at is not null and reversed_by is not null and char_length(btrim(reversal_reason)) >= 3)
  )
);

create index if not exists cashbook_entries_workspace_date_idx
on public.cashbook_entries (workspace_id, transaction_date desc, created_at desc);

create index if not exists cashbook_entries_account_date_idx
on public.cashbook_entries (account_id, transaction_date desc, created_at desc);

create index if not exists cashbook_entries_transfer_group_idx
on public.cashbook_entries (transfer_group_id)
where transfer_group_id is not null;

create unique index if not exists cashbook_entries_active_payment_link_unique_idx
on public.cashbook_entries (linked_payment_record_id)
where linked_payment_record_id is not null and reversed_at is null;

create or replace function public.cashbook_can_access(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.budget_workspaces as workspaces
      where workspaces.id = p_workspace_id
        and workspaces.workspace_type = 'personal'
        and workspaces.owner_id = auth.uid()
        and workspaces.status = 'active'
    )
    and not public.my_account_suspended();
$$;

create or replace function public.touch_cashbook_account_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists cashbook_accounts_touch_updated_at on public.cashbook_accounts;
create trigger cashbook_accounts_touch_updated_at
before update on public.cashbook_accounts
for each row execute function public.touch_cashbook_account_updated_at();

alter table public.cashbook_accounts enable row level security;
alter table public.cashbook_entries enable row level security;

drop policy if exists "Owners can read Personal Cashbook accounts" on public.cashbook_accounts;
create policy "Owners can read Personal Cashbook accounts"
on public.cashbook_accounts for select to authenticated
using (public.cashbook_can_access(workspace_id));

drop policy if exists "Owners can read Personal Cashbook entries" on public.cashbook_entries;
create policy "Owners can read Personal Cashbook entries"
on public.cashbook_entries for select to authenticated
using (public.cashbook_can_access(workspace_id));

create or replace view public.cashbook_account_balances
with (security_invoker = true)
as
select
  accounts.id as account_id,
  accounts.workspace_id,
  accounts.name,
  accounts.account_type,
  accounts.currency,
  accounts.opening_balance,
  accounts.opening_balance_date,
  accounts.status,
  accounts.created_at,
  accounts.updated_at,
  case when accounts.opening_balance_date <= current_date then accounts.opening_balance else 0 end + coalesce(sum(
    case entries.entry_type
      when 'cash_in' then entries.amount
      when 'transfer_in' then entries.amount
      when 'cash_out' then -entries.amount
      when 'transfer_out' then -entries.amount
      else 0
    end
  ) filter (where entries.reversed_at is null and entries.transaction_date <= current_date), 0) as current_balance
from public.cashbook_accounts as accounts
left join public.cashbook_entries as entries on entries.account_id = accounts.id
group by accounts.id;

create or replace function public.create_cashbook_account(
  p_workspace_id uuid,
  p_name text,
  p_account_type text,
  p_currency text,
  p_opening_balance numeric default 0,
  p_opening_balance_date date default current_date
)
returns public.cashbook_accounts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.cashbook_accounts;
  v_currency text := upper(btrim(coalesce(p_currency, '')));
begin
  if not public.cashbook_can_access(p_workspace_id) then raise exception 'PERSONAL_CASHBOOK_ACCESS_REQUIRED'; end if;
  if nullif(btrim(p_name), '') is null or char_length(btrim(p_name)) > 80 then raise exception 'INVALID_CASHBOOK_ACCOUNT_NAME'; end if;
  if p_account_type not in ('cash', 'bank', 'mobile_money', 'other') then raise exception 'INVALID_CASHBOOK_ACCOUNT_TYPE'; end if;
  if p_opening_balance_date is null then raise exception 'OPENING_BALANCE_DATE_REQUIRED'; end if;
  if not exists (select 1 from public.supported_currencies where code = v_currency and is_active) then
    raise exception 'UNSUPPORTED_CURRENCY';
  end if;

  insert into public.cashbook_accounts (
    workspace_id, name, account_type, currency, opening_balance, opening_balance_date, created_by
  ) values (
    p_workspace_id, btrim(p_name), p_account_type, v_currency,
    round(coalesce(p_opening_balance, 0), 2), p_opening_balance_date, auth.uid()
  ) returning * into v_account;
  return v_account;
exception when unique_violation then
  raise exception 'CASHBOOK_ACCOUNT_NAME_ALREADY_EXISTS';
end;
$$;

create or replace function public.archive_cashbook_account(p_account_id uuid)
returns public.cashbook_accounts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_account public.cashbook_accounts;
begin
  select * into v_account from public.cashbook_accounts where id = p_account_id for update;
  if v_account.id is null or not public.cashbook_can_access(v_account.workspace_id) then
    raise exception 'PERSONAL_CASHBOOK_ACCESS_REQUIRED';
  end if;
  if v_account.status = 'archived' then return v_account; end if;
  update public.cashbook_accounts
  set status = 'archived', archived_at = now()
  where id = p_account_id returning * into v_account;
  return v_account;
end;
$$;

create or replace function public.create_cashbook_entry(
  p_workspace_id uuid,
  p_account_id uuid,
  p_direction text,
  p_amount numeric,
  p_transaction_date date,
  p_description text,
  p_category text default null,
  p_notes text default null
)
returns public.cashbook_entries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.cashbook_accounts;
  v_entry public.cashbook_entries;
begin
  if not public.cashbook_can_access(p_workspace_id) then raise exception 'PERSONAL_CASHBOOK_ACCESS_REQUIRED'; end if;
  select * into v_account from public.cashbook_accounts
  where id = p_account_id and workspace_id = p_workspace_id and status = 'active';
  if v_account.id is null then raise exception 'ACTIVE_CASHBOOK_ACCOUNT_REQUIRED'; end if;
  if p_direction not in ('cash_in', 'cash_out') then raise exception 'INVALID_CASHBOOK_DIRECTION'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'CASHBOOK_AMOUNT_MUST_BE_POSITIVE'; end if;
  if p_transaction_date is null then raise exception 'CASHBOOK_DATE_REQUIRED'; end if;
  if nullif(btrim(p_description), '') is null or char_length(btrim(p_description)) > 160 then
    raise exception 'INVALID_CASHBOOK_DESCRIPTION';
  end if;

  insert into public.cashbook_entries (
    workspace_id, account_id, entry_type, amount, currency, transaction_date,
    description, category, notes, created_by
  ) values (
    p_workspace_id, p_account_id, p_direction, round(p_amount, 2), v_account.currency,
    p_transaction_date, btrim(p_description), nullif(btrim(p_category), ''),
    nullif(btrim(p_notes), ''), auth.uid()
  ) returning * into v_entry;
  return v_entry;
end;
$$;

create or replace function public.create_cashbook_payment_entry(
  p_workspace_id uuid,
  p_account_id uuid,
  p_payment_record_id uuid,
  p_notes text default null,
  p_replace_manual_entry_id uuid default null
)
returns public.cashbook_entries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.cashbook_accounts;
  v_record public.payment_records;
  v_item public.payment_items;
  v_entry public.cashbook_entries;
  v_replaced integer;
begin
  if not public.cashbook_can_access(p_workspace_id) then raise exception 'PERSONAL_CASHBOOK_ACCESS_REQUIRED'; end if;
  select * into v_account from public.cashbook_accounts
  where id = p_account_id and workspace_id = p_workspace_id and status = 'active';
  if v_account.id is null then raise exception 'ACTIVE_CASHBOOK_ACCOUNT_REQUIRED'; end if;

  select * into v_record from public.payment_records
  where id = p_payment_record_id and workspace_id = p_workspace_id
    and visibility = 'personal' and owner_id = auth.uid();
  if v_record.id is null then raise exception 'PERSONAL_PAYMENT_RECORD_REQUIRED'; end if;
  select * into v_item from public.payment_items
  where id = v_record.payment_item_id and workspace_id = p_workspace_id and visibility = 'personal';
  if v_item.id is null then raise exception 'PERSONAL_PAYMENT_ITEM_REQUIRED'; end if;
  if v_account.currency <> v_record.currency then raise exception 'CASHBOOK_ACCOUNT_CURRENCY_MISMATCH'; end if;

  if p_replace_manual_entry_id is not null then
    update public.cashbook_entries
    set reversed_at = now(), reversed_by = auth.uid(), reversal_reason = 'Converted to linked paid payment'
    where id = p_replace_manual_entry_id
      and workspace_id = p_workspace_id and account_id = p_account_id
      and entry_type = 'cash_out' and linked_payment_record_id is null and reversed_at is null
      and amount = v_record.amount and currency = v_record.currency
      and transaction_date = v_record.payment_date;
    get diagnostics v_replaced = row_count;
    if v_replaced <> 1 then raise exception 'MATCHING_MANUAL_CASH_OUT_REQUIRED'; end if;
  end if;

  insert into public.cashbook_entries (
    workspace_id, account_id, entry_type, amount, currency, transaction_date,
    description, category, notes, linked_payment_record_id, created_by
  ) values (
    p_workspace_id, p_account_id, 'cash_out', v_record.amount, v_record.currency,
    v_record.payment_date, v_item.name, nullif(btrim(v_item.category), ''),
    nullif(btrim(p_notes), ''), v_record.id, auth.uid()
  ) returning * into v_entry;
  return v_entry;
exception when unique_violation then
  raise exception 'PAYMENT_ALREADY_LINKED_TO_CASHBOOK';
end;
$$;

create or replace function public.create_cashbook_transfer(
  p_workspace_id uuid,
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_source_amount numeric,
  p_destination_amount numeric,
  p_transaction_date date,
  p_description text default 'Account transfer',
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source public.cashbook_accounts;
  v_destination public.cashbook_accounts;
  v_transfer_id uuid := gen_random_uuid();
begin
  if not public.cashbook_can_access(p_workspace_id) then raise exception 'PERSONAL_CASHBOOK_ACCESS_REQUIRED'; end if;
  if p_source_account_id = p_destination_account_id then raise exception 'TRANSFER_ACCOUNTS_MUST_DIFFER'; end if;
  select * into v_source from public.cashbook_accounts
  where id = p_source_account_id and workspace_id = p_workspace_id and status = 'active';
  select * into v_destination from public.cashbook_accounts
  where id = p_destination_account_id and workspace_id = p_workspace_id and status = 'active';
  if v_source.id is null or v_destination.id is null then raise exception 'ACTIVE_CASHBOOK_ACCOUNTS_REQUIRED'; end if;
  if p_source_amount is null or p_source_amount <= 0 or p_destination_amount is null or p_destination_amount <= 0 then
    raise exception 'TRANSFER_AMOUNTS_MUST_BE_POSITIVE';
  end if;
  if v_source.currency = v_destination.currency and round(p_source_amount, 2) <> round(p_destination_amount, 2) then
    raise exception 'SAME_CURRENCY_TRANSFER_AMOUNTS_MUST_MATCH';
  end if;
  if p_transaction_date is null then raise exception 'CASHBOOK_DATE_REQUIRED'; end if;
  if nullif(btrim(p_description), '') is null or char_length(btrim(p_description)) > 160 then
    raise exception 'INVALID_CASHBOOK_DESCRIPTION';
  end if;

  insert into public.cashbook_entries (
    workspace_id, account_id, entry_type, amount, currency, transaction_date,
    description, notes, transfer_group_id, created_by
  ) values
  (p_workspace_id, v_source.id, 'transfer_out', round(p_source_amount, 2), v_source.currency,
   p_transaction_date, btrim(p_description), nullif(btrim(p_notes), ''), v_transfer_id, auth.uid()),
  (p_workspace_id, v_destination.id, 'transfer_in', round(p_destination_amount, 2), v_destination.currency,
   p_transaction_date, btrim(p_description), nullif(btrim(p_notes), ''), v_transfer_id, auth.uid());
  return v_transfer_id;
end;
$$;

create or replace function public.reverse_cashbook_entry(p_entry_id uuid, p_reason text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entry public.cashbook_entries;
  v_count integer;
begin
  select * into v_entry from public.cashbook_entries where id = p_entry_id for update;
  if v_entry.id is null or not public.cashbook_can_access(v_entry.workspace_id) then
    raise exception 'PERSONAL_CASHBOOK_ACCESS_REQUIRED';
  end if;
  if v_entry.reversed_at is not null then raise exception 'CASHBOOK_ENTRY_ALREADY_REVERSED'; end if;
  if nullif(btrim(p_reason), '') is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'CASHBOOK_REVERSAL_REASON_REQUIRED';
  end if;

  update public.cashbook_entries
  set reversed_at = now(), reversed_by = auth.uid(), reversal_reason = btrim(p_reason)
  where workspace_id = v_entry.workspace_id
    and reversed_at is null
    and (id = v_entry.id or (v_entry.transfer_group_id is not null and transfer_group_id = v_entry.transfer_group_id));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.cashbook_report(
  p_workspace_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (
  account_id uuid,
  account_name text,
  currency text,
  opening_balance numeric,
  opening_adjustment numeric,
  cash_in numeric,
  cash_out numeric,
  transfer_in numeric,
  transfer_out numeric,
  closing_balance numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.cashbook_can_access(p_workspace_id) then raise exception 'PERSONAL_CASHBOOK_ACCESS_REQUIRED'; end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then raise exception 'INVALID_CASHBOOK_REPORT_RANGE'; end if;
  return query
  select
    accounts.id,
    accounts.name,
    accounts.currency,
    (case when accounts.opening_balance_date < p_start_date then accounts.opening_balance else 0 end)
      + coalesce(sum(case entries.entry_type
          when 'cash_in' then entries.amount when 'transfer_in' then entries.amount
          when 'cash_out' then -entries.amount when 'transfer_out' then -entries.amount else 0 end)
        filter (where entries.reversed_at is null and entries.transaction_date < p_start_date), 0) as opening_balance,
    case when accounts.opening_balance_date between p_start_date and p_end_date then accounts.opening_balance else 0 end as opening_adjustment,
    coalesce(sum(entries.amount) filter (where entries.reversed_at is null and entries.entry_type = 'cash_in'
      and entries.transaction_date between p_start_date and p_end_date), 0) as cash_in,
    coalesce(sum(entries.amount) filter (where entries.reversed_at is null and entries.entry_type = 'cash_out'
      and entries.transaction_date between p_start_date and p_end_date), 0) as cash_out,
    coalesce(sum(entries.amount) filter (where entries.reversed_at is null and entries.entry_type = 'transfer_in'
      and entries.transaction_date between p_start_date and p_end_date), 0) as transfer_in,
    coalesce(sum(entries.amount) filter (where entries.reversed_at is null and entries.entry_type = 'transfer_out'
      and entries.transaction_date between p_start_date and p_end_date), 0) as transfer_out,
    (case when accounts.opening_balance_date <= p_end_date then accounts.opening_balance else 0 end)
      + coalesce(sum(case entries.entry_type
          when 'cash_in' then entries.amount when 'transfer_in' then entries.amount
          when 'cash_out' then -entries.amount when 'transfer_out' then -entries.amount else 0 end)
        filter (where entries.reversed_at is null and entries.transaction_date <= p_end_date), 0) as closing_balance
  from public.cashbook_accounts as accounts
  left join public.cashbook_entries as entries on entries.account_id = accounts.id
  where accounts.workspace_id = p_workspace_id
  group by accounts.id
  order by accounts.status, accounts.created_at;
end;
$$;

revoke all on table public.cashbook_accounts from public, anon, authenticated;
revoke all on table public.cashbook_entries from public, anon, authenticated;
revoke all on table public.cashbook_account_balances from public, anon, authenticated;
grant select on table public.cashbook_accounts to authenticated;
grant select on table public.cashbook_entries to authenticated;
grant select on table public.cashbook_account_balances to authenticated;

revoke all on function public.cashbook_can_access(uuid) from public, anon, authenticated;
revoke all on function public.touch_cashbook_account_updated_at() from public, anon, authenticated;
revoke all on function public.create_cashbook_account(uuid, text, text, text, numeric, date) from public, anon, authenticated;
revoke all on function public.archive_cashbook_account(uuid) from public, anon, authenticated;
revoke all on function public.create_cashbook_entry(uuid, uuid, text, numeric, date, text, text, text) from public, anon, authenticated;
revoke all on function public.create_cashbook_payment_entry(uuid, uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.create_cashbook_transfer(uuid, uuid, uuid, numeric, numeric, date, text, text) from public, anon, authenticated;
revoke all on function public.reverse_cashbook_entry(uuid, text) from public, anon, authenticated;
revoke all on function public.cashbook_report(uuid, date, date) from public, anon, authenticated;

grant execute on function public.cashbook_can_access(uuid) to authenticated;
grant execute on function public.create_cashbook_account(uuid, text, text, text, numeric, date) to authenticated;
grant execute on function public.archive_cashbook_account(uuid) to authenticated;
grant execute on function public.create_cashbook_entry(uuid, uuid, text, numeric, date, text, text, text) to authenticated;
grant execute on function public.create_cashbook_payment_entry(uuid, uuid, uuid, text, uuid) to authenticated;
grant execute on function public.create_cashbook_transfer(uuid, uuid, uuid, numeric, numeric, date, text, text) to authenticated;
grant execute on function public.reverse_cashbook_entry(uuid, text) to authenticated;
grant execute on function public.cashbook_report(uuid, date, date) to authenticated;

notify pgrst, 'reload schema';
commit;
