-- Mushavo Budget complete Supabase schema
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email text;

create unique index if not exists profiles_email_unique_idx
on public.profiles (lower(email))
where email is not null;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Mushavo user'
    ),
    lower(new.email)
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(nullif(btrim(public.profiles.full_name), ''), excluded.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_user_profile();

insert into public.profiles (id, full_name, email)
select
  auth_users.id,
  coalesce(
    nullif(btrim(auth_users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(auth_users.email, '@', 1), ''),
    'Mushavo user'
  ),
  lower(auth_users.email)
from auth.users as auth_users
where auth_users.email is not null
on conflict (id) do update
set email = excluded.email;

create table if not exists public.app_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.family_heads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.family_heads
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists status text not null default 'active',
  add column if not exists billing_status text not null default 'unpaid',
  add column if not exists monthly_fee numeric(12, 2) not null default 0,
  add column if not exists fee_currency text not null default 'USD',
  add column if not exists can_add_members boolean not null default false,
  add column if not exists family_limit integer not null default 1,
  add column if not exists paid_until date,
  add column if not exists last_payment_at timestamptz;

alter table public.family_heads
  drop constraint if exists family_heads_status_check,
  add constraint family_heads_status_check check (status in ('active', 'suspended'));

alter table public.family_heads
  drop constraint if exists family_heads_billing_status_check,
  add constraint family_heads_billing_status_check check (billing_status in ('paid', 'unpaid', 'overdue'));

alter table public.family_heads
  drop constraint if exists family_heads_monthly_fee_check,
  add constraint family_heads_monthly_fee_check check (monthly_fee >= 0);

alter table public.family_heads
  drop constraint if exists family_heads_family_limit_check,
  add constraint family_heads_family_limit_check check (family_limit between 0 and 100);

alter table public.family_heads
  drop constraint if exists family_heads_fee_currency_check,
  add constraint family_heads_fee_currency_check check (fee_currency in ('USD', 'ZAR', 'EUR', 'GBP', 'CAD', 'AUD'));

create unique index if not exists app_admins_email_unique_idx
on public.app_admins (lower(email));

create unique index if not exists family_heads_email_unique_idx
on public.family_heads (lower(email));

create unique index if not exists family_heads_user_id_unique_idx
on public.family_heads (user_id)
where user_id is not null;

update public.family_heads as heads
set user_id = profiles.id
from public.profiles as profiles
where heads.user_id is null
  and profiles.email is not null
  and lower(heads.email) = lower(profiles.email);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Mushavo user'
    ),
    lower(new.email)
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(nullif(btrim(public.profiles.full_name), ''), excluded.full_name);

  update public.family_heads
  set user_id = new.id
  where lower(email) = lower(new.email)
    and (user_id is null or user_id = new.id);

  return new;
end;
$$;

create or replace function public.link_family_head_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.email := lower(btrim(new.email));
  select profiles.id
  into new.user_id
  from public.profiles
  where lower(profiles.email) = new.email
  limit 1;
  return new;
end;
$$;

drop trigger if exists before_family_head_write_link_profile on public.family_heads;
create trigger before_family_head_write_link_profile
before insert or update of email on public.family_heads
for each row execute function public.link_family_head_to_profile();

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_email text,
  name text not null,
  monthly_budget numeric(12, 2) not null default 0 check (monthly_budget >= 0),
  currency text not null default 'USD' check (currency in ('USD', 'ZAR', 'EUR', 'GBP', 'CAD', 'AUD')),
  created_at timestamptz not null default now()
);

alter table public.families
  add column if not exists owner_email text;

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'Adult' check (role in ('Owner', 'Adult', 'Child', 'Teen', 'Other')),
  monthly_allowance numeric(12, 2) not null default 0 check (monthly_allowance >= 0),
  spending_limit numeric(12, 2) not null default 0 check (spending_limit >= 0),
  avatar_color text not null default '#167D77',
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

alter table public.family_members
  add column if not exists spending_limit numeric(12, 2) not null default 0,
  add column if not exists avatar_color text not null default '#167D77',
  add column if not exists status text not null default 'active',
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists reminder_preference text not null default 'in_app';

alter table public.family_members
  drop constraint if exists family_members_spending_limit_check,
  add constraint family_members_spending_limit_check check (spending_limit >= 0);

alter table public.family_members
  drop constraint if exists family_members_status_check,
  add constraint family_members_status_check check (status in ('active', 'inactive'));

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid references public.family_members(id) on delete set null,
  paid_by_member_id uuid references public.family_members(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  note text,
  payment_method text,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.expenses
  add column if not exists paid_by_member_id uuid references public.family_members(id) on delete set null;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  family_head_id uuid not null references public.family_heads(id) on delete cascade,
  family_id uuid references public.families(id) on delete set null,
  recorded_by uuid not null references auth.users(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'USD' check (currency in ('USD', 'ZAR', 'EUR', 'GBP', 'CAD', 'AUD')),
  payment_method text not null default 'Cash' check (payment_method in ('Cash', 'EFT', 'Card', 'Bank deposit', 'Other')),
  payment_date date not null default current_date,
  billing_period_start date,
  billing_period_end date,
  reference_number text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.category_budgets (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  category text not null,
  monthly_limit numeric(12, 2) not null default 0 check (monthly_limit >= 0),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists category_budgets_family_category_unique_idx
on public.category_budgets (family_id, category);

create table if not exists public.payment_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  visibility text not null default 'family',
  responsible_member_id uuid references public.family_members(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null default 'Other',
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  recurrence_type text not null default 'monthly' check (recurrence_type in ('once', 'monthly', 'quarterly', 'yearly', 'custom', 'custom_days')),
  recurrence_interval integer not null default 1 check (recurrence_interval between 1 and 3650),
  due_day integer not null default 1 check (due_day between 1 and 31),
  start_date date not null default current_date,
  end_date date,
  reminder_days_before integer not null default 3 check (reminder_days_before between 0 and 30),
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_items
  alter column family_id drop not null,
  add column if not exists owner_id uuid references auth.users(id) on delete cascade,
  add column if not exists visibility text not null default 'family';

update public.payment_items
set owner_id = coalesce(owner_id, created_by),
    visibility = coalesce(visibility, case when family_id is null then 'personal' else 'family' end)
where owner_id is null or visibility is null;

alter table public.payment_items
  alter column owner_id set not null,
  drop constraint if exists payment_items_currency_check,
  add constraint payment_items_currency_check check (currency ~ '^[A-Z]{3}$'),
  drop constraint if exists payment_items_visibility_check,
  add constraint payment_items_visibility_check check (visibility in ('personal', 'family')),
  drop constraint if exists payment_items_scope_check,
  add constraint payment_items_scope_check check (
    (visibility = 'personal' and family_id is null and responsible_member_id is null)
    or
    (visibility = 'family' and family_id is not null)
  );

alter table public.payment_items
  drop constraint if exists payment_items_recurrence_type_check,
  add constraint payment_items_recurrence_type_check check (
    recurrence_type in ('once', 'monthly', 'quarterly', 'yearly', 'custom', 'custom_days')
  ),
  drop constraint if exists payment_items_recurrence_interval_check,
  add constraint payment_items_recurrence_interval_check check (
    recurrence_interval between 1 and 3650
  );

create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  visibility text not null default 'family',
  payment_item_id uuid not null references public.payment_items(id) on delete cascade,
  period_start date not null,
  due_date date not null,
  paid_by_member_id uuid references public.family_members(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text not null default 'EFT' check (payment_method in ('Cash', 'EFT', 'Card', 'Bank deposit', 'Other')),
  reference_number text,
  notes text,
  recorded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.payment_records
  alter column family_id drop not null,
  add column if not exists owner_id uuid references auth.users(id) on delete cascade,
  add column if not exists visibility text not null default 'family',
  add column if not exists proof_path text,
  add column if not exists proof_name text,
  add column if not exists proof_mime_type text,
  add column if not exists proof_size_bytes bigint;

update public.payment_records
set owner_id = coalesce(owner_id, recorded_by),
    visibility = coalesce(visibility, case when family_id is null then 'personal' else 'family' end)
where owner_id is null or visibility is null;

alter table public.payment_records
  alter column owner_id set not null,
  drop constraint if exists payment_records_visibility_check,
  add constraint payment_records_visibility_check check (visibility in ('personal', 'family')),
  drop constraint if exists payment_records_scope_check,
  add constraint payment_records_scope_check check (
    (visibility = 'personal' and family_id is null and paid_by_member_id is null)
    or
    (visibility = 'family' and family_id is not null)
  ),
  drop constraint if exists payment_records_proof_size_check,
  add constraint payment_records_proof_size_check check (
    proof_size_bytes is null or (proof_size_bytes > 0 and proof_size_bytes <= 10485760)
  ),
  drop constraint if exists payment_records_proof_type_check,
  add constraint payment_records_proof_type_check check (
    proof_mime_type is null or proof_mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  );

create table if not exists public.family_invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null,
  invitee_name text,
  role text not null default 'Adult' check (role in ('Adult', 'Child', 'Teen', 'Other')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists family_invitations_pending_unique_idx
on public.family_invitations (family_id, lower(invitee_email))
where status = 'pending';

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  created_by uuid references auth.users(id) on delete set null,
  family_id uuid references public.families(id) on delete cascade,
  invitation_id uuid references public.family_invitations(id) on delete cascade,
  type text not null default 'info',
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create table if not exists public.admin_support_notes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  note text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete set null,
  actor_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_admins_user_id_idx on public.app_admins(user_id);
create index if not exists family_heads_email_idx on public.family_heads(lower(email));
create index if not exists family_heads_status_idx on public.family_heads(status, billing_status);
create index if not exists families_owner_id_idx on public.families(owner_id);
create index if not exists families_owner_email_idx on public.families(lower(owner_email));
create index if not exists family_members_family_id_idx on public.family_members(family_id);
create index if not exists expenses_family_date_idx on public.expenses(family_id, expense_date desc);
create index if not exists expenses_member_id_idx on public.expenses(member_id);
create index if not exists expenses_paid_by_member_id_idx on public.expenses(paid_by_member_id);
create index if not exists payments_family_head_date_idx on public.payments(family_head_id, payment_date desc);
create index if not exists payments_recorded_by_idx on public.payments(recorded_by);
create index if not exists category_budgets_family_id_idx on public.category_budgets(family_id);
create index if not exists family_members_email_idx on public.family_members(lower(email));
create index if not exists payment_items_family_id_idx on public.payment_items(family_id);
create index if not exists payment_items_owner_id_idx on public.payment_items(owner_id);
create index if not exists payment_items_visibility_idx on public.payment_items(visibility);
create index if not exists payment_items_responsible_member_idx on public.payment_items(responsible_member_id);
create index if not exists payment_items_status_idx on public.payment_items(status, recurrence_type);
create index if not exists payment_records_family_period_idx on public.payment_records(family_id, period_start desc);
create index if not exists payment_records_owner_period_idx on public.payment_records(owner_id, period_start desc);
create index if not exists payment_records_visibility_idx on public.payment_records(visibility);
create index if not exists payment_records_item_period_idx on public.payment_records(payment_item_id, period_start);
create index if not exists payment_records_paid_by_idx on public.payment_records(paid_by_member_id);
create unique index if not exists payment_records_proof_path_unique_idx
on public.payment_records(proof_path)
where proof_path is not null;
create index if not exists family_invitations_invitee_email_idx on public.family_invitations(lower(invitee_email), status);
create index if not exists family_invitations_family_idx on public.family_invitations(family_id, created_at desc);
create index if not exists notifications_user_idx on public.notifications(user_id, read_at, created_at desc);
create index if not exists notifications_email_idx on public.notifications(lower(email), read_at, created_at desc);
create index if not exists admin_support_notes_family_idx on public.admin_support_notes(family_id, created_at desc);
create index if not exists admin_audit_logs_family_idx on public.admin_audit_logs(family_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.app_admins enable row level security;
alter table public.family_heads enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.expenses enable row level security;
alter table public.payments enable row level security;
alter table public.category_budgets enable row level security;
alter table public.payment_items enable row level security;
alter table public.payment_records enable row level security;
alter table public.family_invitations enable row level security;
alter table public.notifications enable row level security;
alter table public.admin_support_notes enable row level security;
alter table public.admin_audit_logs enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.app_admins to authenticated;
grant select, insert, update, delete on public.family_heads to authenticated;
grant select, insert, update, delete on public.families to authenticated;
grant select, insert, update, delete on public.family_members to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select, insert, update, delete on public.category_budgets to authenticated;
grant select, insert, update, delete on public.payment_items to authenticated;
grant select, insert, update, delete on public.payment_records to authenticated;
grant select, insert, update, delete on public.family_invitations to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.admin_support_notes to authenticated;
grant select, insert, update, delete on public.admin_audit_logs to authenticated;

revoke all on function public.handle_new_user_profile() from public;
revoke all on function public.link_family_head_to_profile() from public;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.app_admins
      where app_admins.user_id = auth.uid()
    );
$$;

revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated;

create or replace function public.has_active_family_plan()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.family_heads
      where lower(family_heads.email) = lower(auth.jwt() ->> 'email')
        and family_heads.status = 'active'
    );
$$;

create or replace function public.can_manage_family_members(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.families
      where families.id = p_family_id
        and families.owner_id = auth.uid()
    )
    and exists (
      select 1
      from public.family_heads
      where lower(family_heads.email) = lower(auth.jwt() ->> 'email')
        and family_heads.status = 'active'
        and family_heads.can_add_members = true
    );
$$;

create or replace function public.sync_family_head_subscription_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.budget_workspaces as workspaces
  set status = case when new.status = 'suspended' then 'suspended' else 'active' end,
      suspension_reason = case when new.status = 'suspended' then 'Administrative suspension' else null end,
      updated_at = now()
  from public.families
  where workspaces.legacy_family_id = families.id
    and lower(families.owner_email) = lower(new.email);

  update public.workspace_subscriptions as subscriptions
  set status = case when new.status = 'suspended' then 'suspended' else 'active' end,
      suspended_at = case when new.status = 'suspended' then now() else null end,
      suspension_reason = case when new.status = 'suspended' then 'Administrative suspension' else null end,
      updated_at = now(),
      version = subscriptions.version + 1
  from public.budget_workspaces as workspaces
  join public.families on families.id = workspaces.legacy_family_id
  where subscriptions.workspace_id = workspaces.id
    and lower(families.owner_email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists sync_family_head_subscription_status_trigger on public.family_heads;
create trigger sync_family_head_subscription_status_trigger
after update of status on public.family_heads
for each row when (old.status is distinct from new.status)
execute function public.sync_family_head_subscription_status();

create or replace function public.is_active_family_participant(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is not null
    and (
      exists (
        select 1
        from public.app_admins
        where app_admins.user_id = auth.uid()
      )
      or exists (
        select 1
        from public.families
        where families.id = p_family_id
          and families.owner_id = auth.uid()
      )
      or exists (
        select 1
        from public.family_members
        where family_members.family_id = p_family_id
          and family_members.status = 'active'
          and (
            family_members.user_id = auth.uid()
            or lower(family_members.email) = lower(auth.jwt() ->> 'email')
          )
      )
    );
$$;

create or replace function public.enforce_personal_payment_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_active_personal_count integer;
begin
  if new.visibility <> 'personal' or new.status = 'inactive' then
    return new;
  end if;

  if public.has_active_family_plan() then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.visibility = 'personal'
    and old.status <> 'inactive'
    and old.owner_id = new.owner_id
  then
    return new;
  end if;

  select count(*)::integer
  into v_active_personal_count
  from public.payment_items
  where payment_items.owner_id = auth.uid()
    and payment_items.visibility = 'personal'
    and payment_items.status <> 'inactive'
    and payment_items.id <> new.id;

  if v_active_personal_count >= 5 then
    raise exception 'PERSONAL_PAYMENT_LIMIT_REACHED';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_personal_payment_limit() from public;

drop trigger if exists enforce_personal_payment_limit_trigger on public.payment_items;
create trigger enforce_personal_payment_limit_trigger
before insert or update of visibility, owner_id, status
on public.payment_items
for each row
execute function public.enforce_personal_payment_limit();

create or replace function public.create_family_workspace(
  p_name text,
  p_monthly_budget numeric default 0,
  p_currency text default 'USD'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_family_id uuid;
  v_email text := lower(auth.jwt() ->> 'email');
  v_name text;
  v_family_limit integer;
  v_owned_count integer;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  select family_heads.family_limit
  into v_family_limit
  from public.family_heads
  where lower(family_heads.email) = v_email
    and family_heads.status = 'active'
  for update;

  if not found then
    raise exception 'ACTIVE_FAMILY_MEMBERSHIP_REQUIRED';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'FAMILY_NAME_REQUIRED';
  end if;
  if coalesce(p_monthly_budget, 0) < 0 then
    raise exception 'INVALID_MONTHLY_BUDGET';
  end if;
  if upper(coalesce(p_currency, '')) not in ('USD', 'ZAR', 'EUR', 'GBP', 'CAD', 'AUD') then
    raise exception 'INVALID_CURRENCY';
  end if;
  select count(*)::integer
  into v_owned_count
  from public.families
  where owner_id = auth.uid();

  if v_owned_count >= v_family_limit then
    raise exception 'FAMILY_LIMIT_REACHED';
  end if;

  select nullif(btrim(profiles.full_name), '')
  into v_name
  from public.profiles
  where profiles.id = auth.uid();

  insert into public.families (owner_id, owner_email, name, monthly_budget, currency)
  values (auth.uid(), v_email, btrim(p_name), coalesce(p_monthly_budget, 0), upper(p_currency))
  returning id into v_family_id;

  insert into public.family_members (
    family_id, user_id, created_by, name, role, email, avatar_color, status
  )
  values (
    v_family_id,
    auth.uid(),
    auth.uid(),
    coalesce(v_name, v_email, 'Family owner'),
    'Owner',
    v_email,
    '#2563EB',
    'active'
  );

  return v_family_id;
end;
$$;

create or replace function public.invite_family_member(
  p_family_id uuid,
  p_email text,
  p_role text default 'Adult'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(p_email));
  v_profile_id uuid;
  v_profile_name text;
  v_inviter_name text;
  v_family_name text;
  v_invitation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.can_manage_family_members(p_family_id) then
    raise exception 'MEMBER_MANAGEMENT_ACCESS_REQUIRED';
  end if;
  if nullif(v_email, '') is null then
    raise exception 'INVITEE_EMAIL_REQUIRED';
  end if;
  if p_role not in ('Adult', 'Child', 'Teen', 'Other') then
    raise exception 'INVALID_FAMILY_ROLE';
  end if;

  select families.name
  into v_family_name
  from public.families
  where families.id = p_family_id
    and families.owner_id = auth.uid();

  if v_family_name is null then
    raise exception 'FAMILY_OWNER_REQUIRED';
  end if;

  select profiles.id, profiles.full_name
  into v_profile_id, v_profile_name
  from public.profiles
  where lower(profiles.email) = v_email;

  if v_profile_id is null then
    raise exception 'USER_NOT_REGISTERED';
  end if;
  if v_profile_id = auth.uid() then
    raise exception 'CANNOT_INVITE_YOURSELF';
  end if;
  if exists (
    select 1
    from public.family_members
    where family_members.family_id = p_family_id
      and family_members.status = 'active'
      and (
        family_members.user_id = v_profile_id
        or lower(family_members.email) = v_email
      )
  ) then
    raise exception 'ALREADY_FAMILY_MEMBER';
  end if;
  if exists (
    select 1
    from public.family_invitations
    where family_invitations.family_id = p_family_id
      and lower(family_invitations.invitee_email) = v_email
      and family_invitations.status = 'pending'
  ) then
    raise exception 'INVITATION_ALREADY_PENDING';
  end if;

  insert into public.family_invitations (
    family_id, invited_by, invitee_email, invitee_name, role, status
  )
  values (
    p_family_id, auth.uid(), v_email, v_profile_name, p_role, 'pending'
  )
  returning id into v_invitation_id;

  select nullif(btrim(profiles.full_name), '')
  into v_inviter_name
  from public.profiles
  where profiles.id = auth.uid();

  insert into public.notifications (
    user_id, email, created_by, family_id, invitation_id, type, title, body
  )
  values (
    v_profile_id,
    v_email,
    auth.uid(),
    p_family_id,
    v_invitation_id,
    'family_invite',
    'Family invitation',
    coalesce(v_inviter_name, auth.jwt() ->> 'email', 'A family owner')
      || ' invited you to join ' || v_family_name || '.'
  );

  return v_invitation_id;
end;
$$;

create or replace function public.respond_to_family_invitation(
  p_invitation_id uuid,
  p_accept boolean
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.family_invitations%rowtype;
  v_member_id uuid;
  v_profile_name text;
  v_email text := lower(auth.jwt() ->> 'email');
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select *
  into v_invitation
  from public.family_invitations
  where family_invitations.id = p_invitation_id
    and lower(family_invitations.invitee_email) = v_email
    and family_invitations.status = 'pending'
  for update;

  if v_invitation.id is null then
    raise exception 'INVITATION_NOT_AVAILABLE';
  end if;

  if not coalesce(p_accept, false) then
    update public.family_invitations
    set status = 'rejected', responded_at = now()
    where id = v_invitation.id;
    return 'rejected';
  end if;

  select nullif(btrim(profiles.full_name), '')
  into v_profile_name
  from public.profiles
  where profiles.id = auth.uid();

  select family_members.id
  into v_member_id
  from public.family_members
  where family_members.family_id = v_invitation.family_id
    and (
      family_members.user_id = auth.uid()
      or lower(family_members.email) = v_email
    )
  limit 1
  for update;

  if v_member_id is null then
    insert into public.family_members (
      family_id, user_id, created_by, name, role, email, avatar_color, status
    )
    values (
      v_invitation.family_id,
      auth.uid(),
      v_invitation.invited_by,
      coalesce(v_invitation.invitee_name, v_profile_name, v_email, 'Family member'),
      v_invitation.role,
      v_email,
      '#10B981',
      'active'
    );
  else
    update public.family_members
    set user_id = auth.uid(),
        email = v_email,
        name = coalesce(v_invitation.invitee_name, v_profile_name, name),
        role = v_invitation.role,
        status = 'active'
    where id = v_member_id;
  end if;

  update public.family_invitations
  set status = 'accepted', responded_at = now()
  where id = v_invitation.id;

  return 'accepted';
end;
$$;

create or replace function public.remove_family_member(
  p_family_id uuid,
  p_member_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.family_members%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.can_manage_family_members(p_family_id) then
    raise exception 'MEMBER_MANAGEMENT_ACCESS_REQUIRED';
  end if;

  select *
  into v_member
  from public.family_members
  where family_members.id = p_member_id
    and family_members.family_id = p_family_id
  for update;

  if v_member.id is null then
    raise exception 'MEMBER_NOT_FOUND';
  end if;
  if v_member.role = 'Owner' or v_member.user_id = auth.uid() then
    raise exception 'CANNOT_REMOVE_FAMILY_OWNER';
  end if;

  update public.family_members
  set status = 'inactive'
  where id = v_member.id;

  return 'removed';
end;
$$;

create or replace function public.delete_family_workspace(p_family_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  delete from public.families
  where families.id = p_family_id
    and families.owner_id = auth.uid();

  if not found then
    raise exception 'FAMILY_NOT_FOUND';
  end if;

  return 'deleted';
end;
$$;

revoke all on function public.has_active_family_plan() from public;
revoke all on function public.can_manage_family_members(uuid) from public;
revoke all on function public.is_active_family_participant(uuid) from public;
revoke all on function public.create_family_workspace(text, numeric, text) from public;
revoke all on function public.invite_family_member(uuid, text, text) from public;
revoke all on function public.respond_to_family_invitation(uuid, boolean) from public;
revoke all on function public.remove_family_member(uuid, uuid) from public;
revoke all on function public.delete_family_workspace(uuid) from public;
grant execute on function public.has_active_family_plan() to authenticated;
grant execute on function public.is_active_family_participant(uuid) to authenticated;
grant execute on function public.create_family_workspace(text, numeric, text) to authenticated;
grant execute on function public.invite_family_member(uuid, text, text) to authenticated;
grant execute on function public.respond_to_family_invitation(uuid, boolean) to authenticated;
grant execute on function public.remove_family_member(uuid, uuid) to authenticated;
grant execute on function public.delete_family_workspace(uuid) to authenticated;

do $$
declare
  realtime_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
      and puballtables = true
  ) then
    return;
  end if;

  foreach realtime_table in array array[
    'profiles',
    'family_heads',
    'families',
    'family_members',
    'payment_items',
    'payment_records',
    'family_invitations',
    'notifications',
    'payments',
    'admin_support_notes'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = realtime_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', realtime_table);
    end if;
  end loop;
end $$;


drop policy if exists "Owners can read their families" on public.families;
drop policy if exists "Owners can create families" on public.families;
drop policy if exists "Owners can update their families" on public.families;
drop policy if exists "Owners can delete their families" on public.families;
drop policy if exists "Owners can read family members" on public.family_members;
drop policy if exists "Owners can create family members" on public.family_members;
drop policy if exists "Owners can update family members" on public.family_members;
drop policy if exists "Owners can delete family members" on public.family_members;
drop policy if exists "Owners can read expenses" on public.expenses;
drop policy if exists "Owners can create expenses" on public.expenses;
drop policy if exists "Owners can update expenses" on public.expenses;
drop policy if exists "Owners can delete expenses" on public.expenses;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users and admins can read profiles" on public.profiles;
create policy "Users and admins can read profiles"
on public.profiles for select
to authenticated
using (
  (select auth.uid()) = id
  or (select public.is_app_admin())
);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check (
  (select auth.uid()) = id
  and (
    email is null
    or lower(email) = lower((select auth.jwt() ->> 'email'))
  )
);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check (
  (select auth.uid()) = id
  and (
    email is null
    or lower(email) = lower((select auth.jwt() ->> 'email'))
  )
);

drop policy if exists "Admins can read own admin row" on public.app_admins;
create policy "Admins can read own admin row"
on public.app_admins for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Admins and matching heads can read head approvals" on public.family_heads;
drop policy if exists "Admins can read head approvals" on public.family_heads;
create policy "Admins and matching heads can read head approvals"
on public.family_heads for select
to authenticated
using (
  lower(email) = lower((select auth.jwt() ->> 'email'))
  or exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Admins can create head approvals" on public.family_heads;
create policy "Admins can create head approvals"
on public.family_heads for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Admins can update head approvals" on public.family_heads;
create policy "Admins can update head approvals"
on public.family_heads for update
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Admins can delete head approvals" on public.family_heads;
create policy "Admins can delete head approvals"
on public.family_heads for delete
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Approved heads and admins can read families" on public.families;
create policy "Approved heads and admins can read families"
on public.families for select
to authenticated
using (
  public.is_active_family_participant(families.id)
  or exists (
    select 1
    from public.family_invitations
    where family_invitations.family_id = families.id
      and lower(family_invitations.invitee_email) = lower((select auth.jwt() ->> 'email'))
      and family_invitations.status = 'pending'
  )
);

drop policy if exists "Approved heads can create families" on public.families;

drop policy if exists "Approved heads and admins can update families" on public.families;
create policy "Approved heads and admins can update families"
on public.families for update
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or owner_id = (select auth.uid())
)
with check (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or owner_id = (select auth.uid())
);

drop policy if exists "Approved heads and admins can delete families" on public.families;
create policy "Approved heads and admins can delete families"
on public.families for delete
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Approved heads and admins can read family members" on public.family_members;
create policy "Approved heads and admins can read family members"
on public.family_members for select
to authenticated
using (
  public.is_active_family_participant(family_members.family_id)
);

drop policy if exists "Approved heads and admins can create family members" on public.family_members;
drop policy if exists "Owners and invitees can create family members" on public.family_members;

drop policy if exists "Approved heads and admins can update family members" on public.family_members;
create policy "Approved heads and admins can update family members"
on public.family_members for update
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Approved heads and admins can delete family members" on public.family_members;
create policy "Approved heads and admins can delete family members"
on public.family_members for delete
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Approved heads and admins can read expenses" on public.expenses;
create policy "Approved heads and admins can read expenses"
on public.expenses for select
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.families
    where families.id = expenses.family_id
      and families.owner_id = (select auth.uid())
  )
);

drop policy if exists "Approved heads and admins can create expenses" on public.expenses;
create policy "Approved heads and admins can create expenses"
on public.expenses for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (
    exists (
      select 1
      from public.app_admins
      where app_admins.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.families
      where families.id = expenses.family_id
        and families.owner_id = (select auth.uid())
    )
  )
  and (
    member_id is null
    or exists (
      select 1
      from public.family_members
      where family_members.id = expenses.member_id
        and family_members.family_id = expenses.family_id
    )
  )
  and (
    paid_by_member_id is null
    or exists (
      select 1
      from public.family_members
      where family_members.id = expenses.paid_by_member_id
        and family_members.family_id = expenses.family_id
    )
  )
);

drop policy if exists "Approved heads and admins can update expenses" on public.expenses;
create policy "Approved heads and admins can update expenses"
on public.expenses for update
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.families
    where families.id = expenses.family_id
      and families.owner_id = (select auth.uid())
  )
)
with check (
  user_id = (select auth.uid())
  and (
    exists (
      select 1
      from public.app_admins
      where app_admins.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.families
      where families.id = expenses.family_id
        and families.owner_id = (select auth.uid())
    )
  )
  and (
    member_id is null
    or exists (
      select 1
      from public.family_members
      where family_members.id = expenses.member_id
        and family_members.family_id = expenses.family_id
    )
  )
  and (
    paid_by_member_id is null
    or exists (
      select 1
      from public.family_members
      where family_members.id = expenses.paid_by_member_id
        and family_members.family_id = expenses.family_id
    )
  )
);

drop policy if exists "Approved heads and admins can delete expenses" on public.expenses;
create policy "Approved heads and admins can delete expenses"
on public.expenses for delete
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.families
    where families.id = expenses.family_id
      and families.owner_id = (select auth.uid())
  )
);

drop policy if exists "Owners and admins can read category budgets" on public.category_budgets;
create policy "Owners and admins can read category budgets"
on public.category_budgets for select
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.families
    where families.id = category_budgets.family_id
      and families.owner_id = (select auth.uid())
  )
);

drop policy if exists "Owners and admins can create category budgets" on public.category_budgets;
create policy "Owners and admins can create category budgets"
on public.category_budgets for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (
    exists (
      select 1
      from public.app_admins
      where app_admins.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.families
      where families.id = category_budgets.family_id
        and families.owner_id = (select auth.uid())
    )
  )
);

drop policy if exists "Owners and admins can update category budgets" on public.category_budgets;
create policy "Owners and admins can update category budgets"
on public.category_budgets for update
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.families
    where families.id = category_budgets.family_id
      and families.owner_id = (select auth.uid())
  )
)
with check (
  created_by = (select auth.uid())
  and (
    exists (
      select 1
      from public.app_admins
      where app_admins.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.families
      where families.id = category_budgets.family_id
        and families.owner_id = (select auth.uid())
    )
  )
);

drop policy if exists "Owners and admins can delete category budgets" on public.category_budgets;
create policy "Owners and admins can delete category budgets"
on public.category_budgets for delete
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.families
    where families.id = category_budgets.family_id
      and families.owner_id = (select auth.uid())
  )
);

drop policy if exists "Admins can read payments" on public.payments;
create policy "Admins can read payments"
on public.payments for select
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Admins can create payments" on public.payments;
create policy "Admins can create payments"
on public.payments for insert
to authenticated
with check (
  recorded_by = (select auth.uid())
  and exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Admins can update payments" on public.payments;
create policy "Admins can update payments"
on public.payments for update
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
)
with check (
  recorded_by = (select auth.uid())
  and exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Admins can delete payments" on public.payments;
create policy "Admins can delete payments"
on public.payments for delete
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Members can read their household" on public.families;

drop policy if exists "Matching members can read family members" on public.family_members;

drop policy if exists "Household participants can read payment items" on public.payment_items;
create policy "Household participants can read payment items"
on public.payment_items for select
to authenticated
using (
  (
    payment_items.visibility = 'personal'
    and payment_items.owner_id = (select auth.uid())
  )
  or (
    payment_items.visibility = 'family'
    and public.is_active_family_participant(payment_items.family_id)
  )
);

drop policy if exists "Household owners can create payment items" on public.payment_items;
create policy "Household owners can create payment items"
on public.payment_items for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and owner_id = (select auth.uid())
  and (
    (
      visibility = 'personal'
      and family_id is null
      and responsible_member_id is null
    )
    or (
      visibility = 'family'
      and public.is_active_family_participant(payment_items.family_id)
    )
  )
  and (
    responsible_member_id is null
    or exists (
      select 1
      from public.family_members
      where family_members.id = payment_items.responsible_member_id
        and family_members.family_id = payment_items.family_id
    )
  )
);

drop policy if exists "Household owners can update payment items" on public.payment_items;
create policy "Household owners can update payment items"
on public.payment_items for update
to authenticated
using (
  (
    payment_items.visibility = 'personal'
    and payment_items.owner_id = (select auth.uid())
  )
  or (
    payment_items.visibility = 'family'
    and payment_items.owner_id = (select auth.uid())
    and public.is_active_family_participant(payment_items.family_id)
  )
  or
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.families
    where families.id = payment_items.family_id
      and families.owner_id = (select auth.uid())
  )
)
with check (
  owner_id = (select auth.uid())
  and
  (
    (
      visibility = 'personal'
      and family_id is null
      and responsible_member_id is null
    )
    or (
      visibility = 'family'
      and public.is_active_family_participant(payment_items.family_id)
    )
  )
  and (
    responsible_member_id is null
    or exists (
      select 1
      from public.family_members
      where family_members.id = payment_items.responsible_member_id
        and family_members.family_id = payment_items.family_id
    )
  )
);

drop policy if exists "Household owners can delete payment items" on public.payment_items;
create policy "Household owners can delete payment items"
on public.payment_items for delete
to authenticated
using (
  (
    payment_items.visibility = 'personal'
    and payment_items.owner_id = (select auth.uid())
  )
  or
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.families
    where families.id = payment_items.family_id
      and families.owner_id = (select auth.uid())
  )
);

drop policy if exists "Household participants can read payment records" on public.payment_records;
create policy "Household participants can read payment records"
on public.payment_records for select
to authenticated
using (
  (
    payment_records.visibility = 'personal'
    and payment_records.owner_id = (select auth.uid())
  )
  or (
    payment_records.visibility = 'family'
    and public.is_active_family_participant(payment_records.family_id)
  )
);

drop policy if exists "Household participants can create payment records" on public.payment_records;
create policy "Household participants can create payment records"
on public.payment_records for insert
to authenticated
with check (
  recorded_by = (select auth.uid())
  and owner_id = (select auth.uid())
  and exists (
    select 1
    from public.payment_items
    where payment_items.id = payment_records.payment_item_id
      and coalesce(payment_items.family_id::text, '') = coalesce(payment_records.family_id::text, '')
      and payment_items.visibility = payment_records.visibility
  )
  and (
    (
      visibility = 'personal'
      and family_id is null
    )
    or (
      visibility = 'family'
      and public.is_active_family_participant(payment_records.family_id)
    )
  )
);

drop policy if exists "Household owners can update payment records" on public.payment_records;
create policy "Household owners can update payment records"
on public.payment_records for update
to authenticated
using (
  (
    payment_records.visibility = 'personal'
    and payment_records.owner_id = (select auth.uid())
  )
  or (
    payment_records.visibility = 'family'
    and payment_records.owner_id = (select auth.uid())
    and public.is_active_family_participant(payment_records.family_id)
  )
  or
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.families
    where families.id = payment_records.family_id
      and families.owner_id = (select auth.uid())
  )
)
with check (
  owner_id = (select auth.uid())
  and (
    (
      visibility = 'personal'
      and family_id is null
    )
    or (
      visibility = 'family'
      and public.is_active_family_participant(payment_records.family_id)
    )
  )
);

drop policy if exists "Household owners can delete payment records" on public.payment_records;
create policy "Household owners can delete payment records"
on public.payment_records for delete
to authenticated
using (
  (
    payment_records.visibility = 'personal'
    and payment_records.owner_id = (select auth.uid())
  )
  or
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.families
    where families.id = payment_records.family_id
      and families.owner_id = (select auth.uid())
  )
);

drop policy if exists "Family owners can create invitations" on public.family_invitations;

drop policy if exists "Invitation participants can read invitations" on public.family_invitations;
create policy "Invitation participants can read invitations"
on public.family_invitations for select
to authenticated
using (
  invited_by = (select auth.uid())
  or lower(invitee_email) = lower((select auth.jwt() ->> 'email'))
  or exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Invitees can respond to invitations" on public.family_invitations;

drop policy if exists "Family owners can cancel invitations" on public.family_invitations;
create policy "Family owners can cancel invitations"
on public.family_invitations for delete
to authenticated
using (
  invited_by = (select auth.uid())
  or exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
on public.notifications for select
to authenticated
using (
  user_id = (select auth.uid())
  or lower(email) = lower((select auth.jwt() ->> 'email'))
  or created_by = (select auth.uid())
);

drop policy if exists "Users can create relevant notifications" on public.notifications;
create policy "Users can create relevant notifications"
on public.notifications for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (
    user_id = (select auth.uid())
    or email is not null
    or exists (
      select 1
      from public.app_admins
      where app_admins.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
on public.notifications for update
to authenticated
using (
  user_id = (select auth.uid())
  or lower(email) = lower((select auth.jwt() ->> 'email'))
)
with check (
  user_id = (select auth.uid())
  or lower(email) = lower((select auth.jwt() ->> 'email'))
);

drop policy if exists "Admins can manage support notes" on public.admin_support_notes;
create policy "Admins can manage support notes"
on public.admin_support_notes for all
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
)
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Admins can manage audit logs" on public.admin_audit_logs;
create policy "Admins can manage audit logs"
on public.admin_audit_logs for all
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
)
with check (
  actor_id = (select auth.uid())
  and exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

-- Private proof-of-payment files. Paths are structured as:
-- personal/{user_id}/{file}
-- families/{family_id}/{family_owner_id}/{uploader_id}/{file}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload permitted payment proofs" on storage.objects;
create policy "Users can upload permitted payment proofs"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'payment-proofs'
  and (
    (
      (storage.foldername(name))[1] = 'personal'
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
    or (
      (storage.foldername(name))[1] = 'families'
      and (storage.foldername(name))[4] = (select auth.uid())::text
      and exists (
        select 1
        from public.families
        where families.id = ((storage.foldername(name))[2])::uuid
          and families.owner_id::text = (storage.foldername(name))[3]
          and public.is_active_family_participant(families.id)
      )
    )
  )
);

drop policy if exists "Users can read permitted payment proofs" on storage.objects;
create policy "Users can read permitted payment proofs"
on storage.objects for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (
    (
      (storage.foldername(name))[1] = 'personal'
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
    or (
      (storage.foldername(name))[1] = 'families'
      and public.is_active_family_participant(((storage.foldername(name))[2])::uuid)
    )
    or exists (
      select 1
      from public.app_admins
      where app_admins.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Owners can delete payment proofs" on storage.objects;
create policy "Owners can delete payment proofs"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (
    (
      (storage.foldername(name))[1] = 'personal'
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
    or (
      (storage.foldername(name))[1] = 'families'
      and (storage.foldername(name))[3] = (select auth.uid())::text
    )
    or exists (
      select 1
      from public.app_admins
      where app_admins.user_id = (select auth.uid())
    )
  )
);

-- After your admin account signs up, run this once in the Supabase SQL Editor:
-- insert into public.app_admins (user_id, email)
-- select id, lower(email)
-- from auth.users
-- where lower(email) = lower('YOUR_ADMIN_EMAIL@example.com')
-- on conflict (user_id) do nothing;

-- ============================================================================
-- Workspace and subscription foundation (compatibility layer)
--
-- Existing families, payment items, payment records, and family invitations are
-- retained.  The records below provide one generalized workspace/subscription
-- source of truth and link legacy household rows to it without destructive
-- renames.
-- ============================================================================

alter table public.profiles
  add column if not exists timezone text not null default 'Africa/Harare',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists last_active_at timestamptz;

alter table public.app_admins
  add column if not exists role text not null default 'super_admin';

alter table public.app_admins
  drop constraint if exists app_admins_role_check,
  add constraint app_admins_role_check check (
    role in ('super_admin', 'admin_staff', 'finance_staff', 'support_staff')
  );

create table if not exists public.budget_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  legacy_family_id uuid unique references public.families(id) on delete cascade,
  workspace_type text not null check (workspace_type in ('personal', 'household', 'business')),
  name text not null,
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  suspension_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create unique index if not exists budget_workspaces_personal_owner_unique_idx
on public.budget_workspaces(owner_id)
where workspace_type = 'personal' and status <> 'closed';

create index if not exists budget_workspaces_owner_idx
on public.budget_workspaces(owner_id, workspace_type, status);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.budget_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in (
    'owner', 'family_head', 'family_member', 'business_owner',
    'business_admin', 'finance_manager', 'contributor', 'viewer'
  )),
  status text not null default 'active' check (status in ('active', 'inactive')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx
on public.workspace_members(user_id, status, workspace_id);

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.budget_workspaces(id) on delete cascade,
  legacy_invitation_id uuid unique references public.family_invitations(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete restrict,
  invitee_email text not null,
  invitee_user_id uuid references auth.users(id) on delete set null,
  role text not null,
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'rejected', 'cancelled', 'expired')
  ),
  expires_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists workspace_invitations_pending_email_idx
on public.workspace_invitations(workspace_id, lower(invitee_email))
where status = 'pending';

create table if not exists public.workspace_settings (
  workspace_id uuid primary key references public.budget_workspaces(id) on delete cascade,
  base_currency text not null default 'USD' check (base_currency ~ '^[A-Z]{3}$'),
  locale text not null default 'en-ZW',
  timezone text not null default 'Africa/Harare',
  reminder_enabled boolean not null default true,
  detailed_notification_previews boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  display_name text not null,
  description text not null default '',
  workspace_type text not null check (workspace_type in ('personal', 'household', 'business')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.plans
  add column if not exists marketing_summary text not null default '',
  add column if not exists is_public boolean not null default false,
  add column if not exists is_featured boolean not null default false,
  add column if not exists available_for_purchase boolean not null default true,
  add column if not exists cta_label text not null default 'Choose plan';

create table if not exists public.plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  billing_period text not null check (billing_period in ('monthly', 'annual')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount numeric(12, 2) not null check (amount >= 0),
  extra_member_amount numeric(12, 2) not null default 0 check (extra_member_amount >= 0),
  is_active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, billing_period, currency, effective_from)
);

create index if not exists plan_prices_lookup_idx
on public.plan_prices(plan_id, billing_period, currency, is_active, effective_from desc);

create table if not exists public.plan_features (
  plan_id uuid not null references public.plans(id) on delete cascade,
  feature_code text not null,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (plan_id, feature_code)
);

create table if not exists public.plan_limits (
  plan_id uuid not null references public.plans(id) on delete cascade,
  limit_code text not null,
  limit_value integer,
  created_at timestamptz not null default now(),
  primary key (plan_id, limit_code),
  check (limit_value is null or limit_value >= 0)
);

create table if not exists public.workspace_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.budget_workspaces(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'suspended', 'expired')),
  billing_period text check (billing_period in ('monthly', 'annual')),
  entitlement_start_at timestamptz not null default now(),
  paid_through_at timestamptz,
  suspended_at timestamptz,
  suspension_reason text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.plan_prices.extra_member_amount is
  'Monthly price per additional person. Multiply by 12 for annual billing.';

create table if not exists public.subscription_entitlement_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.budget_workspaces(id) on delete cascade,
  subscription_id uuid references public.workspace_subscriptions(id) on delete set null,
  plan_id uuid not null references public.plans(id) on delete restrict,
  status text not null,
  effective_from timestamptz not null,
  effective_until timestamptz,
  reason text not null,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.budget_workspaces(id) on delete restrict,
  invoice_number text not null unique,
  plan_code text not null,
  plan_name text not null,
  billing_period text not null check (billing_period in ('monthly', 'annual')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  base_amount numeric(12, 2) not null check (base_amount >= 0),
  extra_member_amount numeric(12, 2) not null default 0 check (extra_member_amount >= 0),
  billable_member_count integer not null default 1 check (billable_member_count >= 1),
  included_member_count integer not null default 1 check (included_member_count >= 1),
  extra_member_count integer not null default 0 check (extra_member_count >= 0),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected', 'cancelled')),
  issued_at timestamptz not null default now(),
  paid_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on column public.subscription_invoices.extra_member_amount is
  'Snapshot of the monthly price per additional person used for this invoice.';

create table if not exists public.subscription_renewal_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.budget_workspaces(id) on delete restrict,
  invoice_id uuid not null unique references public.subscription_invoices(id) on delete restrict,
  requested_plan_id uuid not null references public.plans(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending_review' check (
    status in ('pending_review', 'approved', 'rejected', 'cancelled')
  ),
  rejection_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  renewal_request_id uuid not null unique references public.subscription_renewal_requests(id) on delete restrict,
  workspace_id uuid not null references public.budget_workspaces(id) on delete restrict,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  payment_method text not null,
  payment_date date not null,
  reference_number text not null,
  notes text,
  status text not null default 'pending_review' check (
    status in ('pending_review', 'approved', 'rejected')
  ),
  receipt_number text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.subscription_payments(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.subscription_payment_reviews (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.subscription_payments(id) on delete restrict,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('approved', 'rejected')),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.subscription_audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.budget_workspaces(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  safe_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists subscription_renewal_status_idx
on public.subscription_renewal_requests(status, created_at desc);
create unique index if not exists subscription_renewal_one_pending_plan_idx
on public.subscription_renewal_requests(workspace_id, requested_plan_id)
where status = 'pending_review';
create index if not exists subscription_payments_status_idx
on public.subscription_payments(status, created_at desc);
create index if not exists subscription_invoices_workspace_idx
on public.subscription_invoices(workspace_id, created_at desc);
create index if not exists subscription_audit_workspace_idx
on public.subscription_audit_events(workspace_id, created_at desc);

insert into public.plans (code, display_name, description, workspace_type, is_active, sort_order)
values
  ('free', 'Free', 'Five active personal payment items with core tracking.', 'personal', true, 10),
  ('personal', 'Personal', 'Unlimited personal payments and full Finance analytics.', 'personal', true, 20),
  ('household', 'Household', 'Shared household finance for four people, with additional seats available.', 'household', true, 30),
  ('business', 'Business', 'Team budgeting and expense control for an owner plus five team members.', 'business', true, 40)
on conflict (code) do update
set display_name = excluded.display_name,
    description = excluded.description,
    workspace_type = excluded.workspace_type,
    sort_order = excluded.sort_order;

insert into public.plan_features (plan_id, feature_code, enabled)
select plans.id, features.feature_code, features.enabled
from public.plans
cross join lateral (
  values
    ('finance.analytics', plans.code <> 'free'),
    ('payments.recurring', true),
    ('receipts.upload', true),
    ('reports.advanced', plans.code <> 'free'),
    ('export.csv', plans.code <> 'free'),
    ('export.pdf', plans.code in ('household', 'business')),
    ('members.invite', plans.code in ('household', 'business')),
    ('approvals.enabled', plans.code = 'business'),
    ('audit.full_history', plans.code = 'business')
) as features(feature_code, enabled)
on conflict (plan_id, feature_code) do update set enabled = excluded.enabled;

insert into public.plan_limits (plan_id, limit_code, limit_value)
select plans.id, limits.limit_code, limits.limit_value
from public.plans
cross join lateral (
  values
    ('active_planned_payments', case when plans.code = 'free' then 5 else null end),
    ('included_member_seats', case plans.code when 'free' then 1 when 'personal' then 1 when 'household' then 4 when 'business' then 6 end),
    ('owned_workspaces', case when plans.code in ('free', 'personal') then 1 else null end)
) as limits(limit_code, limit_value)
on conflict (plan_id, limit_code) do update set limit_value = excluded.limit_value;

insert into public.plan_prices (plan_id, billing_period, currency, amount, extra_member_amount, is_active)
select plans.id, periods.billing_period, 'USD', 0, 0, true
from public.plans
cross join (values ('monthly'), ('annual')) as periods(billing_period)
where plans.code = 'free'
  and not exists (
    select 1 from public.plan_prices
    where plan_prices.plan_id = plans.id
      and plan_prices.billing_period = periods.billing_period
      and plan_prices.currency = 'USD'
  );

create or replace function public.is_platform_staff(p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.app_admins
    where app_admins.user_id = auth.uid()
      and (p_roles is null or app_admins.role = any(p_roles))
  );
$$;

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and (
    public.is_platform_staff(null)
    or exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = p_workspace_id
        and workspace_members.user_id = auth.uid()
        and workspace_members.status = 'active'
    )
  );
$$;

create or replace function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and (
    public.is_platform_staff(array['super_admin', 'admin_staff'])
    or exists (
      select 1 from public.budget_workspaces
      where budget_workspaces.id = p_workspace_id
        and budget_workspaces.owner_id = auth.uid()
    )
  );
$$;

create or replace function public.provision_budget_user(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
  v_plan_id uuid;
  v_name text;
begin
  select coalesce(nullif(btrim(profiles.full_name), ''), 'Personal budget')
  into v_name
  from public.profiles
  where profiles.id = p_user_id;

  insert into public.budget_workspaces (owner_id, workspace_type, name)
  values (p_user_id, 'personal', coalesce(v_name, 'Personal budget') || '''s budget')
  on conflict (owner_id) where workspace_type = 'personal' and status <> 'closed'
  do update set updated_at = now()
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (v_workspace_id, p_user_id, 'owner', 'active')
  on conflict (workspace_id, user_id) do update
  set role = 'owner', status = 'active', removed_at = null, updated_at = now();

  insert into public.workspace_settings (workspace_id, base_currency, locale, timezone)
  values (v_workspace_id, 'USD', 'en-ZW', 'Africa/Harare')
  on conflict (workspace_id) do nothing;

  select id into v_plan_id from public.plans where code = 'free';
  insert into public.workspace_subscriptions (workspace_id, plan_id, status, billing_period, paid_through_at)
  values (v_workspace_id, v_plan_id, 'active', null, null)
  on conflict (workspace_id) do nothing;

  insert into public.subscription_entitlement_history (
    workspace_id, subscription_id, plan_id, status, effective_from, reason, actor_id
  )
  select v_workspace_id, subscriptions.id, v_plan_id, 'active', subscriptions.entitlement_start_at,
         'Initial Free entitlement', p_user_id
  from public.workspace_subscriptions as subscriptions
  where subscriptions.workspace_id = v_workspace_id
    and not exists (
      select 1 from public.subscription_entitlement_history
      where subscription_entitlement_history.workspace_id = v_workspace_id
    );

  return v_workspace_id;
end;
$$;

create or replace function public.provision_my_budget_workspace()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  return public.provision_budget_user(auth.uid());
end;
$$;

-- Remove the former Free-user household bootstrap if an earlier schema version
-- created it. Family creation must go through create_family_workspace(), which
-- requires an active family_heads membership and enforces the admin-set limit.
drop function if exists public.create_household_subscription_workspace(text, numeric, text);

-- Reconcile every historical Auth user before linking legacy households.
select public.provision_budget_user(auth_users.id)
from auth.users as auth_users
where auth_users.email is not null;

insert into public.budget_workspaces (
  owner_id, legacy_family_id, workspace_type, name, status, created_at, updated_at
)
select families.owner_id, families.id, 'household', families.name,
       case when coalesce(heads.status, 'active') = 'suspended' then 'suspended' else 'active' end,
       families.created_at, now()
from public.families
left join public.family_heads as heads
  on lower(heads.email) = lower(families.owner_email)
on conflict (legacy_family_id) do update
set name = excluded.name,
    owner_id = excluded.owner_id,
    updated_at = now();

insert into public.workspace_members (workspace_id, user_id, role, status, joined_at)
select workspaces.id, workspaces.owner_id, 'family_head', 'active', workspaces.created_at
from public.budget_workspaces as workspaces
where workspaces.workspace_type = 'household'
on conflict (workspace_id, user_id) do update
set role = 'family_head', status = 'active', removed_at = null, updated_at = now();

insert into public.workspace_members (workspace_id, user_id, role, status, invited_by, joined_at, removed_at)
select workspaces.id, members.user_id, 'family_member', members.status, members.created_by,
       members.created_at, case when members.status = 'inactive' then members.created_at else null end
from public.family_members as members
join public.budget_workspaces as workspaces on workspaces.legacy_family_id = members.family_id
where members.user_id is not null
  and members.user_id <> workspaces.owner_id
on conflict (workspace_id, user_id) do update
set status = excluded.status,
    removed_at = excluded.removed_at,
    updated_at = now();

insert into public.workspace_settings (workspace_id, base_currency, locale, timezone)
select workspaces.id, families.currency, 'en-ZW', 'Africa/Harare'
from public.budget_workspaces as workspaces
join public.families on families.id = workspaces.legacy_family_id
on conflict (workspace_id) do update set base_currency = excluded.base_currency;

insert into public.workspace_invitations (
  workspace_id, legacy_invitation_id, invited_by, invitee_email, invitee_user_id,
  role, status, responded_at, created_at, updated_at
)
select workspaces.id, invitations.id, invitations.invited_by, lower(invitations.invitee_email), profiles.id,
       'family_member', invitations.status, invitations.responded_at, invitations.created_at, now()
from public.family_invitations as invitations
join public.budget_workspaces as workspaces on workspaces.legacy_family_id = invitations.family_id
left join public.profiles on lower(profiles.email) = lower(invitations.invitee_email)
on conflict (legacy_invitation_id) do update
set status = excluded.status,
    responded_at = excluded.responded_at,
    invitee_user_id = excluded.invitee_user_id,
    updated_at = now();

insert into public.workspace_subscriptions (
  workspace_id, plan_id, status, billing_period, entitlement_start_at, paid_through_at,
  suspended_at, suspension_reason
)
select workspaces.id, plans.id,
       case when workspaces.status = 'suspended' then 'suspended' else 'active' end,
       'monthly', workspaces.created_at,
       case when heads.paid_until is null then null else (heads.paid_until + time '23:59:59') at time zone 'Africa/Harare' end,
       case when workspaces.status = 'suspended' then now() else null end,
       case when workspaces.status = 'suspended' then 'Migrated administrative suspension' else null end
from public.budget_workspaces as workspaces
join public.plans on plans.code = 'household'
left join public.families on families.id = workspaces.legacy_family_id
left join public.family_heads as heads on lower(heads.email) = lower(families.owner_email)
where workspaces.workspace_type = 'household'
on conflict (workspace_id) do nothing;

alter table public.payment_items
  add column if not exists workspace_id uuid references public.budget_workspaces(id) on delete cascade;

alter table public.payment_records
  add column if not exists workspace_id uuid references public.budget_workspaces(id) on delete cascade;

update public.payment_items as items
set workspace_id = case
  when items.visibility = 'family' then (
    select workspaces.id from public.budget_workspaces as workspaces
    where workspaces.legacy_family_id = items.family_id
  )
  else (
    select workspaces.id from public.budget_workspaces as workspaces
    where workspaces.owner_id = items.owner_id and workspaces.workspace_type = 'personal' and workspaces.status <> 'closed'
    limit 1
  )
end
where items.workspace_id is null;

update public.payment_records as records
set workspace_id = coalesce(
  (select items.workspace_id from public.payment_items as items where items.id = records.payment_item_id),
  (select workspaces.id from public.budget_workspaces as workspaces
   where workspaces.owner_id = records.owner_id and workspaces.workspace_type = 'personal' and workspaces.status <> 'closed' limit 1)
)
where records.workspace_id is null;

create index if not exists payment_items_workspace_idx on public.payment_items(workspace_id, status);
create index if not exists payment_records_workspace_idx on public.payment_records(workspace_id, period_start desc);

create or replace function public.sync_payment_workspace()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.visibility = 'family' then
    select id into new.workspace_id from public.budget_workspaces
    where legacy_family_id = new.family_id;
  else
    select id into new.workspace_id from public.budget_workspaces
    where owner_id = new.owner_id and workspace_type = 'personal' and status <> 'closed'
    limit 1;
  end if;
  if new.workspace_id is null then raise exception 'WORKSPACE_NOT_PROVISIONED'; end if;
  return new;
end;
$$;

drop trigger if exists sync_payment_item_workspace_trigger on public.payment_items;
create trigger sync_payment_item_workspace_trigger
before insert or update of family_id, owner_id, visibility on public.payment_items
for each row execute function public.sync_payment_workspace();

create or replace function public.sync_payment_record_workspace()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select workspace_id into new.workspace_id from public.payment_items where id = new.payment_item_id;
  if new.workspace_id is null then raise exception 'WORKSPACE_NOT_PROVISIONED'; end if;
  return new;
end;
$$;

drop trigger if exists sync_payment_record_workspace_trigger on public.payment_records;
create trigger sync_payment_record_workspace_trigger
before insert or update of payment_item_id on public.payment_records
for each row execute function public.sync_payment_record_workspace();

create or replace function public.guard_workspace_finance_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
  v_entitlement record;
begin
  v_workspace_id := case when tg_op = 'DELETE' then old.workspace_id else new.workspace_id end;
  if tg_table_name = 'payment_records' and tg_op <> 'DELETE' then
    select workspace_id into v_workspace_id from public.payment_items where id = new.payment_item_id;
  end if;
  select * into v_entitlement from public.effective_workspace_entitlement(v_workspace_id);
  if v_entitlement.workspace_id is null then raise exception 'WORKSPACE_ACCESS_REQUIRED'; end if;
  if v_entitlement.read_only or v_entitlement.effective_status = 'suspended' then
    raise exception 'WORKSPACE_READ_ONLY';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists guard_payment_item_delete_trigger on public.payment_items;
create trigger guard_payment_item_delete_trigger
before delete on public.payment_items
for each row execute function public.guard_workspace_finance_write();

drop trigger if exists z_guard_payment_item_write_trigger on public.payment_items;
create trigger z_guard_payment_item_write_trigger
before insert or update on public.payment_items
for each row execute function public.guard_workspace_finance_write();

drop trigger if exists guard_payment_record_write_trigger on public.payment_records;
create trigger guard_payment_record_write_trigger
before insert or update or delete on public.payment_records
for each row execute function public.guard_workspace_finance_write();

create or replace function public.effective_workspace_entitlement(p_workspace_id uuid)
returns table (
  workspace_id uuid,
  workspace_type text,
  plan_code text,
  plan_name text,
  effective_status text,
  read_only boolean,
  finance_analytics boolean,
  active_payment_limit integer,
  included_member_seats integer,
  paid_through_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with source as (
    select workspaces.id, workspaces.workspace_type, workspaces.status as workspace_status,
           subscriptions.status as subscription_status, subscriptions.paid_through_at,
           plans.id as plan_id, plans.code, plans.display_name,
           (subscriptions.paid_through_at is not null and subscriptions.paid_through_at < now()) as elapsed
    from public.budget_workspaces as workspaces
    join public.workspace_subscriptions as subscriptions on subscriptions.workspace_id = workspaces.id
    join public.plans on plans.id = subscriptions.plan_id
    where workspaces.id = p_workspace_id
      and public.is_workspace_member(workspaces.id)
  ), effective as (
    select source.*,
      case
        when workspace_status = 'suspended' or subscription_status = 'suspended' then 'suspended'
        when elapsed and workspace_type = 'personal' then 'active'
        when elapsed then 'expired'
        when subscription_status = 'expired' and workspace_type = 'personal' then 'active'
        else subscription_status
      end as resolved_status,
      case
        when (elapsed or subscription_status = 'expired') and workspace_type = 'personal' then 'free'
        else code
      end as resolved_plan_code
    from source
  )
  select effective.id, effective.workspace_type, resolved_plans.code, resolved_plans.display_name,
         effective.resolved_status,
         (effective.resolved_status in ('expired', 'suspended') and effective.workspace_type <> 'personal') as read_only,
         coalesce(features.enabled, false), limits.limit_value, seats.limit_value,
         effective.paid_through_at
  from effective
  join public.plans as resolved_plans on resolved_plans.code = effective.resolved_plan_code
  left join public.plan_features as features on features.plan_id = resolved_plans.id and features.feature_code = 'finance.analytics'
  left join public.plan_limits as limits on limits.plan_id = resolved_plans.id and limits.limit_code = 'active_planned_payments'
  left join public.plan_limits as seats on seats.plan_id = resolved_plans.id and seats.limit_code = 'included_member_seats';
$$;

create or replace function public.workspace_has_feature(p_workspace_id uuid, p_feature_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select features.enabled
    from public.effective_workspace_entitlement(p_workspace_id) as entitlement
    join public.plans on plans.code = entitlement.plan_code
    join public.plan_features as features on features.plan_id = plans.id
    where features.feature_code = p_feature_code
      and entitlement.effective_status = 'active'
      and not entitlement.read_only
  ), false);
$$;

create or replace function public.enforce_personal_payment_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer;
  v_active_count integer;
  v_read_only boolean;
begin
  if new.status = 'inactive' then return new; end if;
  if new.workspace_id is null then
    if new.visibility = 'family' then
      select id into new.workspace_id from public.budget_workspaces
      where legacy_family_id = new.family_id;
    else
      select id into new.workspace_id from public.budget_workspaces
      where owner_id = new.owner_id and workspace_type = 'personal' and status <> 'closed'
      limit 1;
    end if;
  end if;
  if new.workspace_id is null then raise exception 'WORKSPACE_NOT_PROVISIONED'; end if;

  select entitlement.active_payment_limit, entitlement.read_only
  into v_limit, v_read_only
  from public.effective_workspace_entitlement(new.workspace_id) as entitlement;

  if v_read_only then raise exception 'WORKSPACE_READ_ONLY'; end if;
  if v_limit is null then return new; end if;

  if tg_op = 'UPDATE'
     and old.workspace_id = new.workspace_id
     and old.status <> 'inactive'
  then
    return new;
  end if;

  select count(*)::integer into v_active_count
  from public.payment_items
  where payment_items.workspace_id = new.workspace_id
    and payment_items.status <> 'inactive'
    and payment_items.id <> new.id;

  if v_active_count >= v_limit then raise exception 'PERSONAL_PAYMENT_LIMIT_REACHED'; end if;
  return new;
end;
$$;

drop trigger if exists enforce_personal_payment_limit_trigger on public.payment_items;
create trigger enforce_personal_payment_limit_trigger
before insert or update of workspace_id, visibility, owner_id, status
on public.payment_items
for each row execute function public.enforce_personal_payment_limit();

create or replace function public.workspace_billable_member_count(p_workspace_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select greatest(1,
    (select count(*)::integer from public.workspace_members where workspace_id = p_workspace_id and status = 'active')
    +
    (select count(*)::integer from public.workspace_invitations where workspace_id = p_workspace_id and status = 'pending')
  )
  where public.is_workspace_member(p_workspace_id);
$$;

create or replace function public.submit_subscription_renewal(
  p_workspace_id uuid,
  p_plan_code text,
  p_billing_period text,
  p_currency text,
  p_amount numeric,
  p_payment_method text,
  p_payment_date date,
  p_reference_number text,
  p_notes text default null,
  p_proof_path text default null,
  p_proof_name text default null,
  p_proof_mime_type text default null,
  p_proof_size_bytes bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace public.budget_workspaces%rowtype;
  v_plan public.plans%rowtype;
  v_price public.plan_prices%rowtype;
  v_invoice_id uuid;
  v_request_id uuid;
  v_payment_id uuid;
  v_members integer;
  v_included integer;
  v_extra integer;
  v_total numeric(12,2);
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select * into v_workspace from public.budget_workspaces where id = p_workspace_id for update;
  if v_workspace.id is null or v_workspace.owner_id <> auth.uid() then raise exception 'WORKSPACE_OWNER_REQUIRED'; end if;
  if v_workspace.status = 'suspended' then raise exception 'WORKSPACE_SUSPENDED'; end if;
  if p_billing_period not in ('monthly', 'annual') then raise exception 'INVALID_BILLING_PERIOD'; end if;

  select * into v_plan from public.plans where code = lower(p_plan_code) and is_active and available_for_purchase;
  if v_plan.id is null then raise exception 'PLAN_NOT_AVAILABLE'; end if;
  if v_plan.workspace_type <> v_workspace.workspace_type then raise exception 'PLAN_WORKSPACE_TYPE_MISMATCH'; end if;
  if v_plan.code = 'free' then raise exception 'FREE_PLAN_REQUIRES_NO_PAYMENT'; end if;
  if exists (
    select 1
    from public.subscription_renewal_requests as requests
    where requests.workspace_id = p_workspace_id
      and requests.status = 'pending_review'
  ) then
    raise exception 'SUBSCRIPTION_REVIEW_ALREADY_PENDING';
  end if;

  select * into v_price
  from public.plan_prices
  where plan_id = v_plan.id
    and billing_period = p_billing_period
    and currency = upper(p_currency)
    and is_active
    and effective_from <= now()
    and (effective_until is null or effective_until > now())
  order by effective_from desc
  limit 1;
  if v_price.id is null then raise exception 'PLAN_PRICE_NOT_CONFIGURED'; end if;

  v_members := public.workspace_billable_member_count(p_workspace_id);
  select coalesce(limit_value, 1) into v_included
  from public.plan_limits where plan_id = v_plan.id and limit_code = 'included_member_seats';
  v_extra := greatest(0, v_members - coalesce(v_included, 1));
  -- extra_member_amount is always the monthly per-person rate.
  -- Annual invoices charge that monthly rate for all 12 months.
  v_total := v_price.amount + (
    v_extra * v_price.extra_member_amount
    * case when p_billing_period = 'annual' then 12 else 1 end
  );
  if round(p_amount, 2) <> round(v_total, 2) then raise exception 'PAYMENT_AMOUNT_DOES_NOT_MATCH_INVOICE'; end if;
  if nullif(btrim(p_reference_number), '') is null then raise exception 'PAYMENT_REFERENCE_REQUIRED'; end if;

  insert into public.subscription_invoices (
    workspace_id, invoice_number, plan_code, plan_name, billing_period, currency,
    base_amount, extra_member_amount, billable_member_count, included_member_count,
    extra_member_count, total_amount, created_by
  ) values (
    p_workspace_id, 'MB-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(gen_random_uuid()::text, 1, 6)),
    v_plan.code, v_plan.display_name, p_billing_period, v_price.currency,
    v_price.amount, v_price.extra_member_amount, v_members, coalesce(v_included, 1),
    v_extra, v_total, auth.uid()
  ) returning id into v_invoice_id;

  insert into public.subscription_renewal_requests (
    workspace_id, invoice_id, requested_plan_id, requested_by
  ) values (p_workspace_id, v_invoice_id, v_plan.id, auth.uid())
  returning id into v_request_id;

  insert into public.subscription_payments (
    renewal_request_id, workspace_id, submitted_by, amount, currency,
    payment_method, payment_date, reference_number, notes
  ) values (
    v_request_id, p_workspace_id, auth.uid(), v_total, v_price.currency,
    btrim(p_payment_method), p_payment_date, btrim(p_reference_number), nullif(btrim(p_notes), '')
  ) returning id into v_payment_id;

  if p_proof_path is not null then
    if p_proof_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
       or p_proof_size_bytes is null or p_proof_size_bytes <= 0 or p_proof_size_bytes > 10485760
    then raise exception 'INVALID_SUBSCRIPTION_PROOF'; end if;
    if split_part(p_proof_path, '/', 1) <> 'workspaces'
       or split_part(p_proof_path, '/', 2) <> p_workspace_id::text
       or split_part(p_proof_path, '/', 3) <> auth.uid()::text
    then raise exception 'INVALID_SUBSCRIPTION_PROOF_PATH'; end if;
    insert into public.subscription_payment_proofs (
      payment_id, storage_path, original_name, mime_type, size_bytes, uploaded_by
    ) values (
      v_payment_id, p_proof_path, coalesce(nullif(btrim(p_proof_name), ''), 'payment-proof'),
      p_proof_mime_type, p_proof_size_bytes, auth.uid()
    );
  end if;

  insert into public.subscription_audit_events (
    workspace_id, actor_id, action, target_type, target_id, safe_details
  ) values (
    p_workspace_id, auth.uid(), 'subscription.payment_submitted', 'renewal_request', v_request_id,
    jsonb_build_object('plan_code', v_plan.code, 'billing_period', p_billing_period, 'currency', v_price.currency, 'amount', v_total)
  );
  return v_payment_id;
end;
$$;

create or replace function public.review_subscription_payment(
  p_payment_id uuid,
  p_decision text,
  p_reason text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.subscription_payments%rowtype;
  v_request public.subscription_renewal_requests%rowtype;
  v_invoice public.subscription_invoices%rowtype;
  v_subscription public.workspace_subscriptions%rowtype;
  v_start timestamptz;
  v_paid_through timestamptz;
  v_plan_id uuid;
  v_owner_id uuid;
begin
  if not public.is_platform_staff(array['super_admin', 'admin_staff', 'finance_staff']) then
    raise exception 'FINANCE_REVIEW_ACCESS_REQUIRED';
  end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'INVALID_REVIEW_DECISION'; end if;

  select * into v_payment from public.subscription_payments where id = p_payment_id for update;
  if v_payment.id is null then raise exception 'SUBSCRIPTION_PAYMENT_NOT_FOUND'; end if;
  if v_payment.status <> 'pending_review' then return 'already_reviewed'; end if;
  select * into v_request from public.subscription_renewal_requests where id = v_payment.renewal_request_id for update;
  select * into v_invoice from public.subscription_invoices where id = v_request.invoice_id for update;
  select owner_id into v_owner_id from public.budget_workspaces where id = v_payment.workspace_id;

  if p_decision = 'rejected' then
    if nullif(btrim(p_reason), '') is null then raise exception 'REJECTION_REASON_REQUIRED'; end if;
    update public.subscription_payments set status = 'rejected', updated_at = now() where id = v_payment.id;
    update public.subscription_renewal_requests
      set status = 'rejected', rejection_reason = btrim(p_reason), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
      where id = v_request.id;
    update public.subscription_invoices set status = 'rejected' where id = v_invoice.id;
  else
    select * into v_subscription from public.workspace_subscriptions where workspace_id = v_payment.workspace_id for update;
    v_plan_id := v_request.requested_plan_id;
    v_start := greatest(now(), coalesce(v_subscription.paid_through_at, now()));
    v_paid_through := case
      when v_invoice.billing_period = 'annual' then v_start + interval '1 year'
      else v_start + interval '1 month'
    end;

    insert into public.workspace_subscriptions (
      workspace_id, plan_id, status, billing_period, entitlement_start_at, paid_through_at
    ) values (
      v_payment.workspace_id, v_plan_id, 'active', v_invoice.billing_period, now(), v_paid_through
    )
    on conflict (workspace_id) do update
    set plan_id = excluded.plan_id,
        status = 'active',
        billing_period = excluded.billing_period,
        paid_through_at = excluded.paid_through_at,
        suspended_at = null,
        suspension_reason = null,
        version = public.workspace_subscriptions.version + 1,
        updated_at = now()
    returning * into v_subscription;

    update public.subscription_payments
      set status = 'approved', receipt_number = 'MBR-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'), updated_at = now()
      where id = v_payment.id;
    update public.subscription_renewal_requests
      set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
      where id = v_request.id;
    update public.subscription_invoices set status = 'paid', paid_at = now() where id = v_invoice.id;

    insert into public.subscription_entitlement_history (
      workspace_id, subscription_id, plan_id, status, effective_from, effective_until, reason, actor_id
    ) values (
      v_payment.workspace_id, v_subscription.id, v_plan_id, 'active', now(), v_paid_through,
      'Approved subscription payment ' || v_invoice.invoice_number, auth.uid()
    );

    if v_invoice.plan_code = 'household' then
      update public.family_heads as heads
      set status = 'active',
          billing_status = 'paid',
          can_add_members = true,
          family_limit = greatest(heads.family_limit, 1),
          paid_until = (v_paid_through at time zone 'Africa/Harare')::date,
          last_payment_at = now(),
          monthly_fee = case when v_invoice.billing_period = 'monthly' then v_invoice.base_amount else heads.monthly_fee end,
          fee_currency = v_invoice.currency,
          user_id = v_owner_id
      where lower(heads.email) = lower((select email from public.profiles where id = v_owner_id));

      if not found then
        insert into public.family_heads (
          user_id, email, full_name, created_by, status, billing_status,
          monthly_fee, fee_currency, can_add_members, family_limit, paid_until, last_payment_at
        )
        select v_owner_id, lower(profiles.email), profiles.full_name, auth.uid(), 'active', 'paid',
               case when v_invoice.billing_period = 'monthly' then v_invoice.base_amount else 0 end,
               v_invoice.currency, true, 1,
               (v_paid_through at time zone 'Africa/Harare')::date, now()
        from public.profiles where profiles.id = v_owner_id;
      end if;
    end if;
  end if;

  insert into public.subscription_payment_reviews (payment_id, reviewer_id, decision, reason)
  values (v_payment.id, auth.uid(), p_decision, nullif(btrim(p_reason), ''));

  insert into public.notifications (user_id, created_by, type, title, body)
  values (
    v_owner_id, auth.uid(), 'subscription',
    case when p_decision = 'approved' then 'Subscription payment approved' else 'Subscription payment rejected' end,
    case when p_decision = 'approved'
      then 'Your subscription is active. Your receipt is available in Subscription.'
      else 'Your subscription payment needs attention. Open Subscription to view the review reason.'
    end
  );

  insert into public.subscription_audit_events (
    workspace_id, actor_id, action, target_type, target_id, safe_details
  ) values (
    v_payment.workspace_id, auth.uid(), 'subscription.payment_' || p_decision,
    'subscription_payment', v_payment.id, jsonb_build_object('decision', p_decision)
  );
  return p_decision;
end;
$$;

create or replace function public.save_plan_price(
  p_plan_code text,
  p_billing_period text,
  p_currency text,
  p_amount numeric,
  p_extra_member_amount numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan_id uuid;
  v_price_id uuid;
begin
  if not public.is_platform_staff(array['super_admin', 'admin_staff']) then raise exception 'PLAN_MANAGEMENT_ACCESS_REQUIRED'; end if;
  if p_billing_period not in ('monthly', 'annual') then raise exception 'INVALID_BILLING_PERIOD'; end if;
  if p_amount <= 0 or p_extra_member_amount < 0 then raise exception 'INVALID_PLAN_PRICE'; end if;
  select id into v_plan_id from public.plans where code = lower(p_plan_code) and code <> 'free';
  if v_plan_id is null then raise exception 'PAID_PLAN_NOT_FOUND'; end if;

  update public.plan_prices set is_active = false, effective_until = now(), updated_at = now()
  where plan_id = v_plan_id and billing_period = p_billing_period and currency = upper(p_currency) and is_active;

  insert into public.plan_prices (plan_id, billing_period, currency, amount, extra_member_amount)
  values (v_plan_id, p_billing_period, upper(p_currency), p_amount, p_extra_member_amount)
  returning id into v_price_id;

  insert into public.subscription_audit_events (actor_id, action, target_type, target_id, safe_details)
  values (auth.uid(), 'plan.price_saved', 'plan_price', v_price_id,
          jsonb_build_object('plan_code', lower(p_plan_code), 'billing_period', p_billing_period, 'currency', upper(p_currency)));
  return v_price_id;
end;
$$;

-- Keep Auth/profile provisioning and legacy family records synchronized.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, email, last_active_at, updated_at)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(split_part(new.email, '@', 1), ''), 'Mushavo user'),
    lower(new.email), now(), now()
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(nullif(btrim(public.profiles.full_name), ''), excluded.full_name),
      updated_at = now();

  update public.family_heads set user_id = new.id
  where lower(email) = lower(new.email) and (user_id is null or user_id = new.id);

  perform public.provision_budget_user(new.id);
  return new;
end;
$$;

create or replace function public.sync_legacy_family_invitation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
  v_user_id uuid;
begin
  select id into v_workspace_id from public.budget_workspaces where legacy_family_id = new.family_id;
  select id into v_user_id from public.profiles where lower(email) = lower(new.invitee_email) limit 1;
  if v_workspace_id is not null then
    insert into public.workspace_invitations (
      workspace_id, legacy_invitation_id, invited_by, invitee_email, invitee_user_id,
      role, status, responded_at, created_at, updated_at
    ) values (
      v_workspace_id, new.id, new.invited_by, lower(new.invitee_email), v_user_id,
      'family_member', new.status, new.responded_at, new.created_at, now()
    )
    on conflict (legacy_invitation_id) do update
    set status = excluded.status, responded_at = excluded.responded_at,
        invitee_user_id = excluded.invitee_user_id, updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists sync_legacy_family_invitation_trigger on public.family_invitations;
create trigger sync_legacy_family_invitation_trigger
after insert or update of status, responded_at, invitee_email on public.family_invitations
for each row execute function public.sync_legacy_family_invitation();

create or replace function public.enforce_approved_additional_seat()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
  v_plan_id uuid;
  v_included integer;
  v_target_count integer;
begin
  if new.status <> 'accepted' or old.status = 'accepted' then return new; end if;
  select id into v_workspace_id from public.budget_workspaces where legacy_family_id = new.family_id;
  if v_workspace_id is null then return new; end if;

  select plans.id into v_plan_id
  from public.workspace_subscriptions as subscriptions
  join public.plans on plans.id = subscriptions.plan_id
  where subscriptions.workspace_id = v_workspace_id;
  select coalesce(limit_value, 1) into v_included
  from public.plan_limits where plan_id = v_plan_id and limit_code = 'included_member_seats';

  select count(*)::integer into v_target_count
  from public.workspace_members
  where workspace_id = v_workspace_id and status = 'active';

  if v_target_count > coalesce(v_included, 1)
     and not exists (
       select 1
       from public.subscription_invoices as invoices
       join public.workspace_subscriptions as subscriptions on subscriptions.workspace_id = invoices.workspace_id
       where invoices.workspace_id = v_workspace_id
         and invoices.status = 'paid'
         and invoices.billable_member_count >= v_target_count
         and subscriptions.status = 'active'
         and (subscriptions.paid_through_at is null or subscriptions.paid_through_at >= now())
     )
  then
    raise exception 'ADDITIONAL_SEAT_PAYMENT_REQUIRED';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_approved_additional_seat_trigger on public.family_invitations;
create trigger enforce_approved_additional_seat_trigger
before update of status on public.family_invitations
for each row execute function public.enforce_approved_additional_seat();

create or replace function public.sync_legacy_family_workspace()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
  v_plan_id uuid;
begin
  insert into public.budget_workspaces (
    owner_id, legacy_family_id, workspace_type, name, status, created_at, updated_at
  ) values (
    new.owner_id, new.id, 'household', new.name, 'active', new.created_at, now()
  )
  on conflict (legacy_family_id) do update
  set owner_id = excluded.owner_id, name = excluded.name, updated_at = now()
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (v_workspace_id, new.owner_id, 'family_head', 'active')
  on conflict (workspace_id, user_id) do update
  set role = 'family_head', status = 'active', removed_at = null, updated_at = now();

  insert into public.workspace_settings (workspace_id, base_currency, locale, timezone)
  values (v_workspace_id, new.currency, 'en-ZW', 'Africa/Harare')
  on conflict (workspace_id) do update set base_currency = excluded.base_currency, updated_at = now();

  select id into v_plan_id from public.plans where code = 'household';
  insert into public.workspace_subscriptions (workspace_id, plan_id, status, billing_period)
  values (v_workspace_id, v_plan_id, 'active', 'monthly')
  on conflict (workspace_id) do nothing;
  return new;
end;
$$;

drop trigger if exists sync_legacy_family_workspace_trigger on public.families;
create trigger sync_legacy_family_workspace_trigger
after insert or update of name, owner_id, currency on public.families
for each row execute function public.sync_legacy_family_workspace();

create or replace function public.sync_legacy_family_member()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
  v_owner_id uuid;
begin
  if new.user_id is null then return new; end if;
  select id, owner_id into v_workspace_id, v_owner_id
  from public.budget_workspaces where legacy_family_id = new.family_id;
  if v_workspace_id is null then return new; end if;
  insert into public.workspace_members (
    workspace_id, user_id, role, status, invited_by, joined_at, removed_at
  ) values (
    v_workspace_id, new.user_id,
    case when new.user_id = v_owner_id or new.role = 'Owner' then 'family_head' else 'family_member' end,
    new.status, new.created_by, new.created_at,
    case when new.status = 'inactive' then now() else null end
  )
  on conflict (workspace_id, user_id) do update
  set role = excluded.role, status = excluded.status, removed_at = excluded.removed_at, updated_at = now();
  return new;
end;
$$;

drop trigger if exists sync_legacy_family_member_trigger on public.family_members;
create trigger sync_legacy_family_member_trigger
after insert or update of user_id, role, status on public.family_members
for each row execute function public.sync_legacy_family_member();

create or replace function public.can_manage_family_members(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.families
      where families.id = p_family_id and families.owner_id = auth.uid()
    )
    and exists (
      select 1
      from public.budget_workspaces as workspaces
      cross join lateral public.effective_workspace_entitlement(workspaces.id) as entitlement
      where workspaces.legacy_family_id = p_family_id
        and entitlement.plan_code = 'household'
        and entitlement.effective_status = 'active'
        and not entitlement.read_only
    );
$$;

-- Generalized workspace Row Level Security.
alter table public.budget_workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.plans enable row level security;
alter table public.plan_prices enable row level security;
alter table public.plan_features enable row level security;
alter table public.plan_limits enable row level security;
alter table public.workspace_subscriptions enable row level security;
alter table public.subscription_entitlement_history enable row level security;
alter table public.subscription_invoices enable row level security;
alter table public.subscription_renewal_requests enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.subscription_payment_proofs enable row level security;
alter table public.subscription_payment_reviews enable row level security;
alter table public.subscription_audit_events enable row level security;

drop policy if exists "Members can read authorized workspaces" on public.budget_workspaces;
create policy "Members can read authorized workspaces" on public.budget_workspaces for select to authenticated
using (public.is_workspace_member(id));
drop policy if exists "Owners and admins can update workspaces" on public.budget_workspaces;
create policy "Owners and admins can update workspaces" on public.budget_workspaces for update to authenticated
using (public.is_workspace_owner(id)) with check (public.is_workspace_owner(id));

drop policy if exists "Members can read workspace membership" on public.workspace_members;
create policy "Members can read workspace membership" on public.workspace_members for select to authenticated
using (public.is_workspace_member(workspace_id));
drop policy if exists "Owners can manage workspace membership" on public.workspace_members;
create policy "Owners can manage workspace membership" on public.workspace_members for all to authenticated
using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));

drop policy if exists "Invitation participants can read workspace invitations" on public.workspace_invitations;
create policy "Invitation participants can read workspace invitations" on public.workspace_invitations for select to authenticated
using (public.is_workspace_owner(workspace_id) or lower(invitee_email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "Members can read workspace settings" on public.workspace_settings;
create policy "Members can read workspace settings" on public.workspace_settings for select to authenticated
using (public.is_workspace_member(workspace_id));
drop policy if exists "Owners can update workspace settings" on public.workspace_settings;
create policy "Owners can update workspace settings" on public.workspace_settings for update to authenticated
using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));

drop policy if exists "Authenticated users can read active plans" on public.plans;
create policy "Authenticated users can read active plans" on public.plans for select to authenticated
using (is_active or public.is_platform_staff(null));
drop policy if exists "Admins can manage plans" on public.plans;
create policy "Admins can manage plans" on public.plans for all to authenticated
using (public.is_platform_staff(array['super_admin', 'admin_staff']))
with check (public.is_platform_staff(array['super_admin', 'admin_staff']));

drop policy if exists "Authenticated users can read active plan prices" on public.plan_prices;
create policy "Authenticated users can read active plan prices" on public.plan_prices for select to authenticated
using (is_active or public.is_platform_staff(null));
drop policy if exists "Admins can manage plan prices" on public.plan_prices;
create policy "Admins can manage plan prices" on public.plan_prices for all to authenticated
using (public.is_platform_staff(array['super_admin', 'admin_staff']))
with check (public.is_platform_staff(array['super_admin', 'admin_staff']));

drop policy if exists "Authenticated users can read plan features" on public.plan_features;
create policy "Authenticated users can read plan features" on public.plan_features for select to authenticated using (true);
drop policy if exists "Admins can manage plan features" on public.plan_features;
create policy "Admins can manage plan features" on public.plan_features for all to authenticated
using (public.is_platform_staff(array['super_admin', 'admin_staff']))
with check (public.is_platform_staff(array['super_admin', 'admin_staff']));

drop policy if exists "Authenticated users can read plan limits" on public.plan_limits;
create policy "Authenticated users can read plan limits" on public.plan_limits for select to authenticated using (true);
drop policy if exists "Admins can manage plan limits" on public.plan_limits;
create policy "Admins can manage plan limits" on public.plan_limits for all to authenticated
using (public.is_platform_staff(array['super_admin', 'admin_staff']))
with check (public.is_platform_staff(array['super_admin', 'admin_staff']));

drop policy if exists "Members can read workspace subscriptions" on public.workspace_subscriptions;
create policy "Members can read workspace subscriptions" on public.workspace_subscriptions for select to authenticated
using (public.is_workspace_member(workspace_id));
drop policy if exists "Members can read entitlement history" on public.subscription_entitlement_history;
create policy "Members can read entitlement history" on public.subscription_entitlement_history for select to authenticated
using (public.is_workspace_member(workspace_id));
drop policy if exists "Owners can read subscription invoices" on public.subscription_invoices;
create policy "Owners can read subscription invoices" on public.subscription_invoices for select to authenticated
using (public.is_workspace_owner(workspace_id) or public.is_platform_staff(array['finance_staff', 'support_staff']));
drop policy if exists "Owners can read renewal requests" on public.subscription_renewal_requests;
create policy "Owners can read renewal requests" on public.subscription_renewal_requests for select to authenticated
using (public.is_workspace_owner(workspace_id) or public.is_platform_staff(array['finance_staff', 'support_staff']));
drop policy if exists "Owners can read subscription payments" on public.subscription_payments;
create policy "Owners can read subscription payments" on public.subscription_payments for select to authenticated
using (public.is_workspace_owner(workspace_id) or public.is_platform_staff(array['finance_staff', 'support_staff']));
drop policy if exists "Owners can read subscription proofs" on public.subscription_payment_proofs;
create policy "Owners can read subscription proofs" on public.subscription_payment_proofs for select to authenticated
using (
  uploaded_by = auth.uid()
  or public.is_platform_staff(array['super_admin', 'admin_staff', 'finance_staff', 'support_staff'])
);
drop policy if exists "Finance staff can read reviews" on public.subscription_payment_reviews;
create policy "Finance staff can read reviews" on public.subscription_payment_reviews for select to authenticated
using (public.is_platform_staff(array['super_admin', 'admin_staff', 'finance_staff', 'support_staff']))
;
drop policy if exists "Members can read subscription audit" on public.subscription_audit_events;
create policy "Members can read subscription audit" on public.subscription_audit_events for select to authenticated
using (workspace_id is not null and public.is_workspace_member(workspace_id));

revoke all on function public.is_platform_staff(text[]) from public;
revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_owner(uuid) from public;
revoke all on function public.provision_budget_user(uuid) from public;
revoke all on function public.provision_my_budget_workspace() from public;
revoke all on function public.effective_workspace_entitlement(uuid) from public;
revoke all on function public.workspace_has_feature(uuid, text) from public;
revoke all on function public.workspace_billable_member_count(uuid) from public;
revoke all on function public.submit_subscription_renewal(uuid, text, text, text, numeric, text, date, text, text, text, text, text, bigint) from public;
revoke all on function public.review_subscription_payment(uuid, text, text) from public;
revoke all on function public.save_plan_price(text, text, text, numeric, numeric) from public;

grant execute on function public.provision_my_budget_workspace() to authenticated;
grant execute on function public.effective_workspace_entitlement(uuid) to authenticated;
grant execute on function public.workspace_has_feature(uuid, text) to authenticated;
grant execute on function public.workspace_billable_member_count(uuid) to authenticated;
grant execute on function public.submit_subscription_renewal(uuid, text, text, text, numeric, text, date, text, text, text, text, text, bigint) to authenticated;
grant execute on function public.review_subscription_payment(uuid, text, text) to authenticated;
grant execute on function public.save_plan_price(text, text, text, numeric, numeric) to authenticated;

alter table public.notifications add column if not exists url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'subscription-proofs', 'subscription-proofs', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners can upload subscription proofs" on storage.objects;
create policy "Owners can upload subscription proofs" on storage.objects for insert to authenticated
with check (
  bucket_id = 'subscription-proofs'
  and (storage.foldername(name))[1] = 'workspaces'
  and (storage.foldername(name))[3] = auth.uid()::text
  and public.is_workspace_owner(((storage.foldername(name))[2])::uuid)
);

drop policy if exists "Owners and finance staff can read subscription proofs" on storage.objects;
create policy "Owners and finance staff can read subscription proofs" on storage.objects for select to authenticated
using (
  bucket_id = 'subscription-proofs'
  and (
    public.is_workspace_owner(((storage.foldername(name))[2])::uuid)
    or public.is_platform_staff(array['super_admin', 'admin_staff', 'finance_staff', 'support_staff'])
  )
);

drop policy if exists "Owners can delete unsubmitted subscription proofs" on storage.objects;
create policy "Owners can delete unsubmitted subscription proofs" on storage.objects for delete to authenticated
using (
  bucket_id = 'subscription-proofs'
  and (storage.foldername(name))[3] = auth.uid()::text
  and public.is_workspace_owner(((storage.foldername(name))[2])::uuid)
  and not exists (
    select 1 from public.subscription_payment_proofs
    where subscription_payment_proofs.storage_path = name
  )
);

-- Price and entitlement mutations must use audited RPCs, not direct browser writes.
drop policy if exists "Admins can manage plans" on public.plans;
drop policy if exists "Admins can manage plan prices" on public.plan_prices;
drop policy if exists "Admins can manage plan features" on public.plan_features;
drop policy if exists "Admins can manage plan limits" on public.plan_limits;

do $$
declare
  realtime_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables = true
     )
  then
    foreach realtime_table in array array[
      'budget_workspaces', 'workspace_members', 'workspace_invitations',
      'workspace_subscriptions', 'subscription_renewal_requests',
      'subscription_invoices', 'subscription_payments',
      'subscription_entitlement_history', 'plans', 'plan_prices'
    ]
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = realtime_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', realtime_table);
      end if;
    end loop;
  end if;
end $$;

-- ============================================================================
-- Family-plan onboarding from a Personal workspace
--
-- A Free user may submit a Household plan payment without already owning a
-- family. No family or Household workspace is created while the request is
-- pending. Approval provisions the family atomically and activates its paid
-- Household entitlement; rejection leaves the Personal workspace unchanged.
-- ============================================================================

alter table public.family_heads
  drop constraint if exists family_heads_fee_currency_check;
alter table public.family_heads
  add constraint family_heads_fee_currency_check check (fee_currency ~ '^[A-Z]{3}$');

alter table public.families
  drop constraint if exists families_currency_check;
alter table public.families
  add constraint families_currency_check check (currency ~ '^[A-Z]{3}$');

alter table public.subscription_renewal_requests
  add column if not exists requested_workspace_name text,
  add column if not exists provision_workspace_on_approval boolean not null default false,
  add column if not exists provisioned_workspace_id uuid references public.budget_workspaces(id) on delete set null;

alter table public.subscription_renewal_requests
  drop constraint if exists subscription_renewal_family_name_check;

alter table public.subscription_renewal_requests
  add constraint subscription_renewal_family_name_check check (
    not provision_workspace_on_approval
    or nullif(btrim(requested_workspace_name), '') is not null
  );

create index if not exists subscription_renewal_provisioning_idx
on public.subscription_renewal_requests(requested_by, status, provision_workspace_on_approval)
where provision_workspace_on_approval = true;

drop function if exists public.submit_family_plan_request(
  uuid, text, text, text, numeric, text, date, text, text, text, text, text, bigint
);
drop function if exists public.submit_family_plan_request(
  uuid, text, integer, text, text, numeric, text, date, text, text, text, text, text, bigint
);

create or replace function public.submit_family_plan_request(
  p_personal_workspace_id uuid,
  p_family_name text,
  p_total_member_count integer,
  p_plan_code text,
  p_billing_period text,
  p_currency text,
  p_amount numeric,
  p_payment_method text,
  p_payment_date date,
  p_reference_number text,
  p_notes text default null,
  p_proof_path text default null,
  p_proof_name text default null,
  p_proof_mime_type text default null,
  p_proof_size_bytes bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace public.budget_workspaces%rowtype;
  v_plan public.plans%rowtype;
  v_price public.plan_prices%rowtype;
  v_invoice_id uuid;
  v_request_id uuid;
  v_payment_id uuid;
  v_family_limit integer := 1;
  v_owned_count integer := 0;
  v_pending_count integer := 0;
  v_included integer := 4;
  v_extra integer := 0;
  v_total numeric(12,2);
  v_family_name text := nullif(btrim(p_family_name), '');
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if v_family_name is null then raise exception 'FAMILY_NAME_REQUIRED'; end if;
  if char_length(v_family_name) > 100 then raise exception 'FAMILY_NAME_TOO_LONG'; end if;
  if p_billing_period not in ('monthly', 'annual') then raise exception 'INVALID_BILLING_PERIOD'; end if;
  if nullif(btrim(p_payment_method), '') is null then raise exception 'PAYMENT_METHOD_REQUIRED'; end if;
  if nullif(btrim(p_reference_number), '') is null then raise exception 'PAYMENT_REFERENCE_REQUIRED'; end if;

  select * into v_workspace
  from public.budget_workspaces
  where id = p_personal_workspace_id
  for update;

  if v_workspace.id is null
     or v_workspace.owner_id <> auth.uid()
     or v_workspace.workspace_type <> 'personal'
  then
    raise exception 'PERSONAL_WORKSPACE_OWNER_REQUIRED';
  end if;
  if v_workspace.status = 'suspended' then raise exception 'WORKSPACE_SUSPENDED'; end if;

  select family_heads.family_limit into v_family_limit
  from public.family_heads
  where family_heads.user_id = auth.uid()
     or lower(family_heads.email) = lower(auth.jwt() ->> 'email')
  order by (family_heads.user_id = auth.uid()) desc
  limit 1;
  -- A Family plan purchase always permits the first family. The admin-set
  -- family_limit controls additional owned families after that first plan.
  v_family_limit := greatest(1, coalesce(v_family_limit, 1));

  select count(*)::integer into v_owned_count
  from public.families
  where owner_id = auth.uid();

  select count(*)::integer into v_pending_count
  from public.subscription_renewal_requests
  where requested_by = auth.uid()
    and provision_workspace_on_approval = true
    and status = 'pending_review';

  if v_pending_count > 0 then raise exception 'FAMILY_PLAN_REQUEST_ALREADY_PENDING'; end if;
  if v_owned_count + v_pending_count >= v_family_limit then
    raise exception 'FAMILY_LIMIT_REACHED';
  end if;

  select * into v_plan
  from public.plans
  where code = lower(btrim(p_plan_code)) and workspace_type = 'household' and is_active and available_for_purchase;
  if v_plan.id is null then raise exception 'PLAN_NOT_AVAILABLE'; end if;

  select * into v_price
  from public.plan_prices
  where plan_id = v_plan.id
    and billing_period = p_billing_period
    and currency = upper(p_currency)
    and is_active
    and effective_from <= now()
    and (effective_until is null or effective_until > now())
  order by effective_from desc
  limit 1;
  if v_price.id is null then raise exception 'PLAN_PRICE_NOT_CONFIGURED'; end if;

  select coalesce(limit_value, 4) into v_included
  from public.plan_limits
  where plan_id = v_plan.id and limit_code = 'included_member_seats';
  v_included := greatest(1, coalesce(v_included, 4));
  if p_total_member_count is null
     or p_total_member_count < v_included
     or p_total_member_count > 100
  then
    raise exception 'INVALID_FAMILY_MEMBER_COUNT';
  end if;
  v_extra := p_total_member_count - v_included;
  -- extra_member_amount is always the monthly per-person rate.
  -- Annual invoices charge that monthly rate for all 12 months.
  v_total := v_price.amount + (
    v_extra * v_price.extra_member_amount
    * case when p_billing_period = 'annual' then 12 else 1 end
  );
  if round(p_amount, 2) <> round(v_total, 2) then
    raise exception 'PAYMENT_AMOUNT_DOES_NOT_MATCH_INVOICE';
  end if;

  insert into public.subscription_invoices (
    workspace_id, invoice_number, plan_code, plan_name, billing_period, currency,
    base_amount, extra_member_amount, billable_member_count, included_member_count,
    extra_member_count, total_amount, created_by
  ) values (
    p_personal_workspace_id,
    'MB-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(gen_random_uuid()::text, 1, 6)),
    v_plan.code, v_plan.display_name, p_billing_period, v_price.currency,
    v_price.amount, v_price.extra_member_amount,
    p_total_member_count, v_included, v_extra, v_total, auth.uid()
  ) returning id into v_invoice_id;

  insert into public.subscription_renewal_requests (
    workspace_id, invoice_id, requested_plan_id, requested_by,
    requested_workspace_name, provision_workspace_on_approval
  ) values (
    p_personal_workspace_id, v_invoice_id, v_plan.id, auth.uid(), v_family_name, true
  ) returning id into v_request_id;

  insert into public.subscription_payments (
    renewal_request_id, workspace_id, submitted_by, amount, currency,
    payment_method, payment_date, reference_number, notes
  ) values (
    v_request_id, p_personal_workspace_id, auth.uid(), v_total, v_price.currency,
    btrim(p_payment_method), p_payment_date, btrim(p_reference_number), nullif(btrim(p_notes), '')
  ) returning id into v_payment_id;

  if p_proof_path is not null then
    if p_proof_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
       or p_proof_size_bytes is null
       or p_proof_size_bytes <= 0
       or p_proof_size_bytes > 10485760
    then
      raise exception 'INVALID_SUBSCRIPTION_PROOF';
    end if;
    if split_part(p_proof_path, '/', 1) <> 'workspaces'
       or split_part(p_proof_path, '/', 2) <> p_personal_workspace_id::text
       or split_part(p_proof_path, '/', 3) <> auth.uid()::text
    then
      raise exception 'INVALID_SUBSCRIPTION_PROOF_PATH';
    end if;
    insert into public.subscription_payment_proofs (
      payment_id, storage_path, original_name, mime_type, size_bytes, uploaded_by
    ) values (
      v_payment_id, p_proof_path,
      coalesce(nullif(btrim(p_proof_name), ''), 'payment-proof'),
      p_proof_mime_type, p_proof_size_bytes, auth.uid()
    );
  end if;

  insert into public.subscription_audit_events (
    workspace_id, actor_id, action, target_type, target_id, safe_details
  ) values (
    p_personal_workspace_id, auth.uid(), 'subscription.family_plan_submitted',
    'renewal_request', v_request_id,
    jsonb_build_object(
      'plan_code', 'household',
      'billing_period', p_billing_period,
      'currency', v_price.currency,
      'amount', v_total,
      'provisions_family', true
    )
  );
  return v_payment_id;
end;
$$;

create or replace function public.review_subscription_payment(
  p_payment_id uuid,
  p_decision text,
  p_reason text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.subscription_payments%rowtype;
  v_request public.subscription_renewal_requests%rowtype;
  v_invoice public.subscription_invoices%rowtype;
  v_subscription public.workspace_subscriptions%rowtype;
  v_start timestamptz;
  v_paid_through timestamptz;
  v_plan_id uuid;
  v_owner_id uuid;
  v_target_workspace_id uuid;
  v_family_id uuid;
  v_family_limit integer := 1;
  v_owned_count integer := 0;
  v_owner_email text;
  v_owner_name text;
  v_family_currency text;
begin
  if not public.is_platform_staff(array['super_admin', 'admin_staff', 'finance_staff']) then
    raise exception 'FINANCE_REVIEW_ACCESS_REQUIRED';
  end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'INVALID_REVIEW_DECISION'; end if;

  select * into v_payment
  from public.subscription_payments
  where id = p_payment_id
  for update;
  if v_payment.id is null then raise exception 'SUBSCRIPTION_PAYMENT_NOT_FOUND'; end if;
  if v_payment.status <> 'pending_review' then return 'already_reviewed'; end if;

  select * into v_request
  from public.subscription_renewal_requests
  where id = v_payment.renewal_request_id
  for update;
  select * into v_invoice
  from public.subscription_invoices
  where id = v_request.invoice_id
  for update;
  select owner_id into v_owner_id
  from public.budget_workspaces
  where id = v_payment.workspace_id;
  v_target_workspace_id := v_payment.workspace_id;

  if p_decision = 'rejected' then
    if nullif(btrim(p_reason), '') is null then raise exception 'REJECTION_REASON_REQUIRED'; end if;
    update public.subscription_payments
      set status = 'rejected', updated_at = now()
      where id = v_payment.id;
    update public.subscription_renewal_requests
      set status = 'rejected', rejection_reason = btrim(p_reason),
          reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
      where id = v_request.id;
    update public.subscription_invoices
      set status = 'rejected'
      where id = v_invoice.id;
  else
    if v_request.provision_workspace_on_approval then
      if v_invoice.plan_code <> 'household'
         or nullif(btrim(v_request.requested_workspace_name), '') is null
      then
        raise exception 'INVALID_FAMILY_PLAN_REQUEST';
      end if;

      select lower(profiles.email),
             coalesce(nullif(btrim(profiles.full_name), ''), split_part(profiles.email, '@', 1), 'Family owner')
      into v_owner_email, v_owner_name
      from public.profiles
      where profiles.id = v_owner_id;
      if v_owner_email is null then raise exception 'OWNER_PROFILE_REQUIRED'; end if;

      select family_heads.family_limit into v_family_limit
      from public.family_heads
      where family_heads.user_id = v_owner_id
         or lower(family_heads.email) = v_owner_email
      order by (family_heads.user_id = v_owner_id) desc
      limit 1
      for update;
      v_family_limit := greatest(1, coalesce(v_family_limit, 1));

      select count(*)::integer into v_owned_count
      from public.families
      where owner_id = v_owner_id;
      if v_owned_count >= v_family_limit then raise exception 'FAMILY_LIMIT_REACHED'; end if;

      v_family_currency := v_invoice.currency;

      insert into public.families (
        owner_id, owner_email, name, monthly_budget, currency
      ) values (
        v_owner_id, v_owner_email, btrim(v_request.requested_workspace_name), 0, v_family_currency
      ) returning id into v_family_id;

      insert into public.family_members (
        family_id, user_id, created_by, name, role, email, avatar_color, status
      ) values (
        v_family_id, v_owner_id, auth.uid(), v_owner_name, 'Owner',
        v_owner_email, '#2563EB', 'active'
      );

      select id into v_target_workspace_id
      from public.budget_workspaces
      where legacy_family_id = v_family_id;
      if v_target_workspace_id is null then raise exception 'FAMILY_WORKSPACE_PROVISION_FAILED'; end if;

      update public.subscription_invoices
        set workspace_id = v_target_workspace_id
        where id = v_invoice.id;
      update public.subscription_payments
        set workspace_id = v_target_workspace_id, updated_at = now()
        where id = v_payment.id;
      update public.subscription_renewal_requests
        set workspace_id = v_target_workspace_id,
            provisioned_workspace_id = v_target_workspace_id,
            updated_at = now()
        where id = v_request.id;
      update public.subscription_audit_events
        set workspace_id = v_target_workspace_id
        where target_type = 'renewal_request'
          and target_id = v_request.id;
    end if;

    select * into v_subscription
    from public.workspace_subscriptions
    where workspace_id = v_target_workspace_id
    for update;
    v_plan_id := v_request.requested_plan_id;
    v_start := greatest(now(), coalesce(v_subscription.paid_through_at, now()));
    v_paid_through := case
      when v_invoice.billing_period = 'annual' then v_start + interval '1 year'
      else v_start + interval '1 month'
    end;

    insert into public.workspace_subscriptions (
      workspace_id, plan_id, status, billing_period, entitlement_start_at, paid_through_at
    ) values (
      v_target_workspace_id, v_plan_id, 'active', v_invoice.billing_period, now(), v_paid_through
    )
    on conflict (workspace_id) do update
    set plan_id = excluded.plan_id,
        status = 'active',
        billing_period = excluded.billing_period,
        paid_through_at = excluded.paid_through_at,
        suspended_at = null,
        suspension_reason = null,
        version = public.workspace_subscriptions.version + 1,
        updated_at = now()
    returning * into v_subscription;

    update public.subscription_payments
      set status = 'approved',
          receipt_number = 'MBR-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
          updated_at = now()
      where id = v_payment.id;
    update public.subscription_renewal_requests
      set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
      where id = v_request.id;
    update public.subscription_invoices
      set status = 'paid', paid_at = now()
      where id = v_invoice.id;

    insert into public.subscription_entitlement_history (
      workspace_id, subscription_id, plan_id, status,
      effective_from, effective_until, reason, actor_id
    ) values (
      v_target_workspace_id, v_subscription.id, v_plan_id, 'active', now(), v_paid_through,
      'Approved subscription payment ' || v_invoice.invoice_number, auth.uid()
    );

    if v_invoice.plan_code = 'household' then
      update public.family_heads as heads
      set status = 'active',
          billing_status = 'paid',
          can_add_members = true,
          family_limit = greatest(heads.family_limit, 1),
          paid_until = (v_paid_through at time zone 'Africa/Harare')::date,
          last_payment_at = now(),
          monthly_fee = case when v_invoice.billing_period = 'monthly' then v_invoice.base_amount else heads.monthly_fee end,
          fee_currency = v_invoice.currency,
          user_id = v_owner_id
      where lower(heads.email) = lower((select email from public.profiles where id = v_owner_id));

      if not found then
        insert into public.family_heads (
          user_id, email, full_name, created_by, status, billing_status,
          monthly_fee, fee_currency, can_add_members, family_limit,
          paid_until, last_payment_at
        )
        select v_owner_id, lower(profiles.email), profiles.full_name, auth.uid(), 'active', 'paid',
               case when v_invoice.billing_period = 'monthly' then v_invoice.base_amount else 0 end,
               v_invoice.currency, true, 1,
               (v_paid_through at time zone 'Africa/Harare')::date, now()
        from public.profiles
        where profiles.id = v_owner_id;
      end if;
    end if;
  end if;

  insert into public.subscription_payment_reviews (
    payment_id, reviewer_id, decision, reason
  ) values (
    v_payment.id, auth.uid(), p_decision, nullif(btrim(p_reason), '')
  );

  insert into public.notifications (
    user_id, created_by, type, title, body, url
  ) values (
    v_owner_id, auth.uid(), 'subscription',
    case
      when p_decision = 'approved' and v_request.provision_workspace_on_approval then 'Family plan approved'
      when p_decision = 'approved' then 'Subscription payment approved'
      else 'Subscription payment rejected'
    end,
    case
      when p_decision = 'approved' and v_request.provision_workspace_on_approval
        then btrim(v_request.requested_workspace_name) || ' is ready. Open the workspace switcher to start using it.'
      when p_decision = 'approved'
        then 'Your subscription is active. Your receipt is available in Subscription.'
      else 'Your subscription payment needs attention. Open Subscription to view the review reason.'
    end,
    '#family/subscription'
  );

  insert into public.subscription_audit_events (
    workspace_id, actor_id, action, target_type, target_id, safe_details
  ) values (
    v_target_workspace_id, auth.uid(), 'subscription.payment_' || p_decision,
    'subscription_payment', v_payment.id,
    jsonb_build_object(
      'decision', p_decision,
      'provisioned_family', p_decision = 'approved' and v_request.provision_workspace_on_approval
    )
  );
  return p_decision;
end;
$$;

revoke all on function public.submit_family_plan_request(
  uuid, text, integer, text, text, text, numeric, text, date, text, text, text, text, text, bigint
) from public;

grant execute on function public.submit_family_plan_request(
  uuid, text, integer, text, text, text, numeric, text, date, text, text, text, text, text, bigint
) to authenticated;

-- ============================================================================
-- Paid member capacity, approval monitoring, and complete finance workflow
-- ============================================================================

alter table public.workspace_subscriptions
  add column if not exists member_limit integer not null default 1;

alter table public.workspace_subscriptions
  drop constraint if exists workspace_subscriptions_member_limit_check;
alter table public.workspace_subscriptions
  add constraint workspace_subscriptions_member_limit_check
  check (member_limit between 1 and 100);

comment on column public.workspace_subscriptions.member_limit is
  'Current paid total people capacity for this workspace, including its owner.';

update public.workspace_subscriptions as subscriptions
set member_limit = greatest(
  1,
  coalesce(subscriptions.member_limit, 1),
  coalesce(
    (
      select invoices.billable_member_count
      from public.subscription_invoices as invoices
      where invoices.workspace_id = subscriptions.workspace_id
        and invoices.status = 'paid'
      order by invoices.paid_at desc nulls last, invoices.created_at desc
      limit 1
    ),
    (
      select limits.limit_value
      from public.plan_limits as limits
      where limits.plan_id = subscriptions.plan_id
        and limits.limit_code = 'included_member_seats'
    ),
    1
  ),
  coalesce((
    select count(*)::integer
    from public.workspace_members as members
    where members.workspace_id = subscriptions.workspace_id
      and members.status = 'active'
  ), 0) + coalesce((
    select count(*)::integer
    from public.workspace_invitations as invitations
    where invitations.workspace_id = subscriptions.workspace_id
      and invitations.status = 'pending'
  ), 0)
);

create or replace function public.workspace_member_usage(p_workspace_id uuid)
returns table (
  workspace_id uuid,
  active_member_count integer,
  pending_invitation_count integer,
  used_member_count integer,
  member_limit integer,
  available_member_count integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_active integer := 0;
  v_pending integer := 0;
  v_limit integer := 1;
begin
  if not public.is_workspace_member(p_workspace_id)
     and not public.is_platform_staff(null)
  then
    return;
  end if;

  select count(*)::integer into v_active
  from public.workspace_members
  where workspace_members.workspace_id = p_workspace_id
    and workspace_members.status = 'active';

  select count(*)::integer into v_pending
  from public.workspace_invitations
  where workspace_invitations.workspace_id = p_workspace_id
    and workspace_invitations.status = 'pending';

  select coalesce(subscriptions.member_limit, 1) into v_limit
  from public.workspace_subscriptions as subscriptions
  where subscriptions.workspace_id = p_workspace_id;
  v_limit := greatest(1, coalesce(v_limit, 1));

  return query select
    p_workspace_id,
    v_active,
    v_pending,
    v_active + v_pending,
    v_limit,
    greatest(0, v_limit - v_active - v_pending);
end;
$$;

create or replace function public.admin_subscription_monitor()
returns table (
  workspace_id uuid,
  family_id uuid,
  workspace_name text,
  workspace_type text,
  owner_id uuid,
  owner_email text,
  plan_code text,
  plan_name text,
  subscription_status text,
  billing_period text,
  paid_through_at timestamptz,
  member_limit integer,
  active_member_count integer,
  pending_invitation_count integer,
  used_member_count integer,
  available_member_count integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    workspaces.id,
    workspaces.legacy_family_id,
    workspaces.name,
    workspaces.workspace_type,
    workspaces.owner_id,
    profiles.email,
    plans.code,
    plans.display_name,
    subscriptions.status,
    subscriptions.billing_period,
    subscriptions.paid_through_at,
    greatest(1, coalesce(subscriptions.member_limit, 1)),
    coalesce(member_totals.active_count, 0),
    coalesce(invitation_totals.pending_count, 0),
    coalesce(member_totals.active_count, 0) + coalesce(invitation_totals.pending_count, 0),
    greatest(
      0,
      greatest(1, coalesce(subscriptions.member_limit, 1))
        - coalesce(member_totals.active_count, 0)
        - coalesce(invitation_totals.pending_count, 0)
    )
  from public.budget_workspaces as workspaces
  left join public.profiles on profiles.id = workspaces.owner_id
  left join public.workspace_subscriptions as subscriptions
    on subscriptions.workspace_id = workspaces.id
  left join public.plans on plans.id = subscriptions.plan_id
  left join lateral (
    select count(*)::integer as active_count
    from public.workspace_members
    where workspace_members.workspace_id = workspaces.id
      and workspace_members.status = 'active'
  ) as member_totals on true
  left join lateral (
    select count(*)::integer as pending_count
    from public.workspace_invitations
    where workspace_invitations.workspace_id = workspaces.id
      and workspace_invitations.status = 'pending'
  ) as invitation_totals on true
  where public.is_platform_staff(null);
$$;

create or replace function public.invite_family_member(
  p_family_id uuid,
  p_email text,
  p_role text default 'Adult'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(p_email));
  v_profile_id uuid;
  v_profile_name text;
  v_inviter_name text;
  v_family_name text;
  v_invitation_id uuid;
  v_workspace_id uuid;
  v_member_limit integer := 1;
  v_active_count integer := 0;
  v_pending_count integer := 0;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.can_manage_family_members(p_family_id) then
    raise exception 'MEMBER_MANAGEMENT_ACCESS_REQUIRED';
  end if;
  if nullif(v_email, '') is null then raise exception 'INVITEE_EMAIL_REQUIRED'; end if;
  if p_role not in ('Adult', 'Child', 'Teen', 'Other') then
    raise exception 'INVALID_FAMILY_ROLE';
  end if;

  select families.name, workspaces.id
  into v_family_name, v_workspace_id
  from public.families
  join public.budget_workspaces as workspaces on workspaces.legacy_family_id = families.id
  where families.id = p_family_id
    and families.owner_id = auth.uid();
  if v_family_name is null or v_workspace_id is null then
    raise exception 'FAMILY_OWNER_REQUIRED';
  end if;

  select profiles.id, profiles.full_name
  into v_profile_id, v_profile_name
  from public.profiles
  where lower(profiles.email) = v_email;
  if v_profile_id is null then raise exception 'USER_NOT_REGISTERED'; end if;
  if v_profile_id = auth.uid() then raise exception 'CANNOT_INVITE_YOURSELF'; end if;

  if exists (
    select 1 from public.family_members
    where family_members.family_id = p_family_id
      and family_members.status = 'active'
      and (family_members.user_id = v_profile_id or lower(family_members.email) = v_email)
  ) then
    raise exception 'ALREADY_FAMILY_MEMBER';
  end if;
  if exists (
    select 1 from public.family_invitations
    where family_invitations.family_id = p_family_id
      and lower(family_invitations.invitee_email) = v_email
      and family_invitations.status = 'pending'
  ) then
    raise exception 'INVITATION_ALREADY_PENDING';
  end if;

  select subscriptions.member_limit into v_member_limit
  from public.workspace_subscriptions as subscriptions
  where subscriptions.workspace_id = v_workspace_id
    and subscriptions.status = 'active'
    and (subscriptions.paid_through_at is null or subscriptions.paid_through_at >= now())
  for update;
  if v_member_limit is null then raise exception 'ACTIVE_FAMILY_SUBSCRIPTION_REQUIRED'; end if;

  select count(*)::integer into v_active_count
  from public.workspace_members
  where workspace_members.workspace_id = v_workspace_id
    and workspace_members.status = 'active';
  select count(*)::integer into v_pending_count
  from public.workspace_invitations
  where workspace_invitations.workspace_id = v_workspace_id
    and workspace_invitations.status = 'pending';
  if v_active_count + v_pending_count >= v_member_limit then
    raise exception 'MEMBER_LIMIT_REACHED';
  end if;

  insert into public.family_invitations (
    family_id, invited_by, invitee_email, invitee_name, role, status
  ) values (
    p_family_id, auth.uid(), v_email, v_profile_name, p_role, 'pending'
  ) returning id into v_invitation_id;

  select nullif(btrim(profiles.full_name), '') into v_inviter_name
  from public.profiles where profiles.id = auth.uid();

  insert into public.notifications (
    user_id, email, created_by, family_id, invitation_id, type, title, body
  ) values (
    v_profile_id, v_email, auth.uid(), p_family_id, v_invitation_id,
    'family_invite', 'Family invitation',
    coalesce(v_inviter_name, auth.jwt() ->> 'email', 'A family owner')
      || ' invited you to join ' || v_family_name || '.'
  );
  return v_invitation_id;
end;
$$;

create or replace function public.enforce_approved_additional_seat()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
  v_member_limit integer := 1;
  v_active_count integer := 0;
begin
  if new.status <> 'accepted' or old.status = 'accepted' then return new; end if;

  select workspaces.id, subscriptions.member_limit
  into v_workspace_id, v_member_limit
  from public.budget_workspaces as workspaces
  join public.workspace_subscriptions as subscriptions on subscriptions.workspace_id = workspaces.id
  where workspaces.legacy_family_id = new.family_id
  for update of subscriptions;
  if v_workspace_id is null then return new; end if;

  select count(*)::integer into v_active_count
  from public.workspace_members
  where workspace_members.workspace_id = v_workspace_id
    and workspace_members.status = 'active';
  if v_active_count > greatest(1, coalesce(v_member_limit, 1)) then
    raise exception 'MEMBER_LIMIT_REACHED';
  end if;
  return new;
end;
$$;

drop function if exists public.submit_subscription_renewal(
  uuid, text, text, text, numeric, text, date, text, text, text, text, text, bigint
);

create or replace function public.submit_subscription_renewal(
  p_workspace_id uuid,
  p_plan_code text,
  p_total_member_count integer,
  p_billing_period text,
  p_currency text,
  p_amount numeric,
  p_payment_method text,
  p_payment_date date,
  p_reference_number text,
  p_notes text default null,
  p_proof_path text default null,
  p_proof_name text default null,
  p_proof_mime_type text default null,
  p_proof_size_bytes bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace public.budget_workspaces%rowtype;
  v_plan public.plans%rowtype;
  v_price public.plan_prices%rowtype;
  v_invoice_id uuid;
  v_request_id uuid;
  v_payment_id uuid;
  v_current_usage integer := 1;
  v_current_limit integer := 1;
  v_requested_members integer := 1;
  v_included integer := 1;
  v_extra integer := 0;
  v_total numeric(12,2);
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select * into v_workspace from public.budget_workspaces where id = p_workspace_id for update;
  if v_workspace.id is null or v_workspace.owner_id <> auth.uid() then
    raise exception 'WORKSPACE_OWNER_REQUIRED';
  end if;
  if v_workspace.status = 'suspended' then raise exception 'WORKSPACE_SUSPENDED'; end if;
  if p_billing_period not in ('monthly', 'annual') then raise exception 'INVALID_BILLING_PERIOD'; end if;

  select * into v_plan from public.plans where code = lower(p_plan_code) and is_active and available_for_purchase;
  if v_plan.id is null then raise exception 'PLAN_NOT_AVAILABLE'; end if;
  if v_plan.workspace_type <> v_workspace.workspace_type then raise exception 'PLAN_WORKSPACE_TYPE_MISMATCH'; end if;
  if v_plan.code = 'free' then raise exception 'FREE_PLAN_REQUIRES_NO_PAYMENT'; end if;
  if exists (
    select 1
    from public.subscription_renewal_requests as requests
    where requests.workspace_id = p_workspace_id
      and requests.status = 'pending_review'
  ) then
    raise exception 'SUBSCRIPTION_REVIEW_ALREADY_PENDING';
  end if;

  select * into v_price
  from public.plan_prices
  where plan_id = v_plan.id
    and billing_period = p_billing_period
    and currency = upper(p_currency)
    and is_active
    and effective_from <= now()
    and (effective_until is null or effective_until > now())
  order by effective_from desc
  limit 1;
  if v_price.id is null then raise exception 'PLAN_PRICE_NOT_CONFIGURED'; end if;

  v_current_usage := public.workspace_billable_member_count(p_workspace_id);
  select coalesce(subscriptions.member_limit, 1) into v_current_limit
  from public.workspace_subscriptions as subscriptions
  where subscriptions.workspace_id = p_workspace_id;
  select coalesce(limits.limit_value, 1) into v_included
  from public.plan_limits as limits
  where limits.plan_id = v_plan.id and limits.limit_code = 'included_member_seats';
  v_included := greatest(1, coalesce(v_included, 1));

  if v_plan.code in ('household', 'business') then
    v_requested_members := coalesce(
      p_total_member_count,
      greatest(v_current_usage, v_current_limit, v_included)
    );
    if v_requested_members < greatest(v_current_usage, v_included) then
      raise exception 'MEMBER_LIMIT_BELOW_CURRENT_USAGE';
    end if;
    if v_requested_members > 100 then raise exception 'INVALID_FAMILY_MEMBER_COUNT'; end if;
  else
    v_requested_members := 1;
  end if;

  v_extra := greatest(0, v_requested_members - v_included);
  v_total := v_price.amount + (
    v_extra * v_price.extra_member_amount
    * case when p_billing_period = 'annual' then 12 else 1 end
  );
  if round(p_amount, 2) <> round(v_total, 2) then
    raise exception 'PAYMENT_AMOUNT_DOES_NOT_MATCH_INVOICE';
  end if;
  if nullif(btrim(p_payment_method), '') is null then raise exception 'PAYMENT_METHOD_REQUIRED'; end if;
  if nullif(btrim(p_reference_number), '') is null then raise exception 'PAYMENT_REFERENCE_REQUIRED'; end if;

  insert into public.subscription_invoices (
    workspace_id, invoice_number, plan_code, plan_name, billing_period, currency,
    base_amount, extra_member_amount, billable_member_count, included_member_count,
    extra_member_count, total_amount, created_by
  ) values (
    p_workspace_id,
    'MB-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(gen_random_uuid()::text, 1, 6)),
    v_plan.code, v_plan.display_name, p_billing_period, v_price.currency,
    v_price.amount, v_price.extra_member_amount, v_requested_members, v_included,
    v_extra, v_total, auth.uid()
  ) returning id into v_invoice_id;

  insert into public.subscription_renewal_requests (
    workspace_id, invoice_id, requested_plan_id, requested_by
  ) values (p_workspace_id, v_invoice_id, v_plan.id, auth.uid())
  returning id into v_request_id;

  insert into public.subscription_payments (
    renewal_request_id, workspace_id, submitted_by, amount, currency,
    payment_method, payment_date, reference_number, notes
  ) values (
    v_request_id, p_workspace_id, auth.uid(), v_total, v_price.currency,
    btrim(p_payment_method), p_payment_date, btrim(p_reference_number), nullif(btrim(p_notes), '')
  ) returning id into v_payment_id;

  if p_proof_path is not null then
    if p_proof_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
       or p_proof_size_bytes is null or p_proof_size_bytes <= 0 or p_proof_size_bytes > 10485760
    then raise exception 'INVALID_SUBSCRIPTION_PROOF'; end if;
    if split_part(p_proof_path, '/', 1) <> 'workspaces'
       or split_part(p_proof_path, '/', 2) <> p_workspace_id::text
       or split_part(p_proof_path, '/', 3) <> auth.uid()::text
    then raise exception 'INVALID_SUBSCRIPTION_PROOF_PATH'; end if;
    insert into public.subscription_payment_proofs (
      payment_id, storage_path, original_name, mime_type, size_bytes, uploaded_by
    ) values (
      v_payment_id, p_proof_path, coalesce(nullif(btrim(p_proof_name), ''), 'payment-proof'),
      p_proof_mime_type, p_proof_size_bytes, auth.uid()
    );
  end if;

  insert into public.subscription_audit_events (
    workspace_id, actor_id, action, target_type, target_id, safe_details
  ) values (
    p_workspace_id, auth.uid(), 'subscription.payment_submitted', 'renewal_request', v_request_id,
    jsonb_build_object(
      'plan_code', v_plan.code,
      'billing_period', p_billing_period,
      'currency', v_price.currency,
      'amount', v_total,
      'member_limit', v_requested_members
    )
  );
  return v_payment_id;
end;
$$;

create or replace function public.apply_approved_subscription_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_limit integer := 1;
  v_active_count integer := 0;
begin
  if new.status <> 'approved' or old.status = 'approved' then return new; end if;

  select invoices.billable_member_count into v_member_limit
  from public.subscription_renewal_requests as requests
  join public.subscription_invoices as invoices on invoices.id = requests.invoice_id
  where requests.id = new.renewal_request_id;
  v_member_limit := greatest(1, coalesce(v_member_limit, 1));

  select count(*)::integer into v_active_count
  from public.workspace_members
  where workspace_members.workspace_id = new.workspace_id
    and workspace_members.status = 'active';
  if v_active_count > v_member_limit then
    raise exception 'APPROVED_MEMBER_LIMIT_BELOW_USAGE';
  end if;

  update public.workspace_subscriptions
  set member_limit = v_member_limit, updated_at = now()
  where workspace_id = new.workspace_id;
  return new;
end;
$$;

drop trigger if exists apply_approved_subscription_member_limit_trigger
on public.subscription_payments;
create trigger apply_approved_subscription_member_limit_trigger
after update of status on public.subscription_payments
for each row execute function public.apply_approved_subscription_member_limit();

revoke all on function public.workspace_member_usage(uuid) from public;
grant execute on function public.workspace_member_usage(uuid) to authenticated;

revoke all on function public.admin_subscription_monitor() from public;
grant execute on function public.admin_subscription_monitor() to authenticated;

revoke all on function public.invite_family_member(uuid, text, text) from public;
grant execute on function public.invite_family_member(uuid, text, text) to authenticated;

revoke all on function public.submit_subscription_renewal(
  uuid, text, integer, text, text, numeric, text, date, text, text, text, text, text, bigint
) from public;
grant execute on function public.submit_subscription_renewal(
  uuid, text, integer, text, text, numeric, text, date, text, text, text, text, text, bigint
) to authenticated;

drop policy if exists "Approved heads and admins can delete families" on public.families;
drop policy if exists "Owners and admins can delete families" on public.families;
create policy "Owners and admins can delete families"
on public.families for delete
to authenticated
using (
  owner_id = (select auth.uid())
  or exists (
    select 1 from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

-- ============================================================================
-- Native multi-currency reporting and CurrencyAPI exchange-rate foundation
-- ============================================================================

create table if not exists public.supported_currencies (
  code text primary key check (code ~ '^[A-Z]{3}$'),
  name text not null,
  decimal_digits smallint not null default 2 check (decimal_digits between 0 and 4),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.supported_currencies (code, name, decimal_digits) values
  ('AED', 'United Arab Emirates Dirham', 2), ('AUD', 'Australian Dollar', 2),
  ('BDT', 'Bangladeshi Taka', 2), ('BWP', 'Botswana Pula', 2),
  ('BRL', 'Brazilian Real', 2), ('CAD', 'Canadian Dollar', 2),
  ('CHF', 'Swiss Franc', 2), ('CNY', 'Chinese Yuan', 2),
  ('DKK', 'Danish Krone', 2), ('EGP', 'Egyptian Pound', 2),
  ('EUR', 'Euro', 2), ('GBP', 'British Pound', 2),
  ('GHS', 'Ghanaian Cedi', 2), ('HKD', 'Hong Kong Dollar', 2),
  ('INR', 'Indian Rupee', 2), ('JPY', 'Japanese Yen', 0),
  ('KES', 'Kenyan Shilling', 2), ('KWD', 'Kuwaiti Dinar', 3),
  ('MUR', 'Mauritian Rupee', 2), ('MZN', 'Mozambican Metical', 2),
  ('NAD', 'Namibian Dollar', 2), ('NGN', 'Nigerian Naira', 2),
  ('NOK', 'Norwegian Krone', 2), ('NZD', 'New Zealand Dollar', 2),
  ('OMR', 'Omani Rial', 3), ('PKR', 'Pakistani Rupee', 2),
  ('PLN', 'Polish Zloty', 2), ('QAR', 'Qatari Riyal', 2),
  ('SAR', 'Saudi Riyal', 2), ('SEK', 'Swedish Krona', 2),
  ('SGD', 'Singapore Dollar', 2), ('SZL', 'Swazi Lilangeni', 2),
  ('THB', 'Thai Baht', 2), ('TRY', 'Turkish Lira', 2),
  ('TZS', 'Tanzanian Shilling', 2), ('UGX', 'Ugandan Shilling', 0),
  ('USD', 'US Dollar', 2), ('ZAR', 'South African Rand', 2),
  ('ZMW', 'Zambian Kwacha', 2), ('ZWG', 'Zimbabwe Gold', 2)
on conflict (code) do update
set name = excluded.name,
    decimal_digits = excluded.decimal_digits,
    updated_at = now();

-- Current global payment currencies. Historical codes, funds, metals and crypto are excluded.
insert into public.supported_currencies (code, name, decimal_digits) values
  ('AED', 'United Arab Emirates Dirham', 2),
  ('AFN', 'Afghan Afghani', 2),
  ('ALL', 'Albanian Lek', 2),
  ('AMD', 'Armenian Dram', 2),
  ('AOA', 'Angolan Kwanza', 2),
  ('ARS', 'Argentine Peso', 2),
  ('AUD', 'Australian Dollar', 2),
  ('AWG', 'Aruban Florin', 2),
  ('AZN', 'Azerbaijani Manat', 2),
  ('BAM', 'Bosnia-Herzegovina Convertible Mark', 2),
  ('BBD', 'Barbadian Dollar', 2),
  ('BDT', 'Bangladeshi Taka', 2),
  ('BHD', 'Bahraini Dinar', 3),
  ('BIF', 'Burundian Franc', 0),
  ('BMD', 'Bermudan Dollar', 2),
  ('BND', 'Brunei Dollar', 2),
  ('BOB', 'Bolivian Boliviano', 2),
  ('BRL', 'Brazilian Real', 2),
  ('BSD', 'Bahamian Dollar', 2),
  ('BTN', 'Bhutanese Ngultrum', 2),
  ('BWP', 'Botswanan Pula', 2),
  ('BYN', 'Belarusian Ruble', 2),
  ('BZD', 'Belize Dollar', 2),
  ('CAD', 'Canadian Dollar', 2),
  ('CDF', 'Congolese Franc', 2),
  ('CHF', 'Swiss Franc', 2),
  ('CLP', 'Chilean Peso', 0),
  ('CNY', 'Chinese Yuan', 2),
  ('COP', 'Colombian Peso', 2),
  ('CRC', 'Costa Rican Colón', 2),
  ('CUP', 'Cuban Peso', 2),
  ('CVE', 'Cape Verdean Escudo', 2),
  ('CZK', 'Czech Koruna', 2),
  ('DJF', 'Djiboutian Franc', 0),
  ('DKK', 'Danish Krone', 2),
  ('DOP', 'Dominican Peso', 2),
  ('DZD', 'Algerian Dinar', 2),
  ('EGP', 'Egyptian Pound', 2),
  ('ERN', 'Eritrean Nakfa', 2),
  ('ETB', 'Ethiopian Birr', 2),
  ('EUR', 'Euro', 2),
  ('FJD', 'Fijian Dollar', 2),
  ('FKP', 'Falkland Islands Pound', 2),
  ('GBP', 'British Pound', 2),
  ('GEL', 'Georgian Lari', 2),
  ('GHS', 'Ghanaian Cedi', 2),
  ('GIP', 'Gibraltar Pound', 2),
  ('GMD', 'Gambian Dalasi', 2),
  ('GNF', 'Guinean Franc', 0),
  ('GTQ', 'Guatemalan Quetzal', 2),
  ('GYD', 'Guyanese Dollar', 2),
  ('HKD', 'Hong Kong Dollar', 2),
  ('HNL', 'Honduran Lempira', 2),
  ('HTG', 'Haitian Gourde', 2),
  ('HUF', 'Hungarian Forint', 2),
  ('IDR', 'Indonesian Rupiah', 2),
  ('ILS', 'Israeli New Shekel', 2),
  ('INR', 'Indian Rupee', 2),
  ('IQD', 'Iraqi Dinar', 3),
  ('IRR', 'Iranian Rial', 2),
  ('ISK', 'Icelandic Króna', 0),
  ('JMD', 'Jamaican Dollar', 2),
  ('JOD', 'Jordanian Dinar', 3),
  ('JPY', 'Japanese Yen', 0),
  ('KES', 'Kenyan Shilling', 2),
  ('KGS', 'Kyrgyz Som', 2),
  ('KHR', 'Cambodian Riel', 2),
  ('KMF', 'Comorian Franc', 0),
  ('KPW', 'North Korean Won', 2),
  ('KRW', 'South Korean Won', 0),
  ('KWD', 'Kuwaiti Dinar', 3),
  ('KYD', 'Cayman Islands Dollar', 2),
  ('KZT', 'Kazakhstani Tenge', 2),
  ('LAK', 'Laotian Kip', 2),
  ('LBP', 'Lebanese Pound', 2),
  ('LKR', 'Sri Lankan Rupee', 2),
  ('LRD', 'Liberian Dollar', 2),
  ('LSL', 'Lesotho Loti', 2),
  ('LYD', 'Libyan Dinar', 3),
  ('MAD', 'Moroccan Dirham', 2),
  ('MDL', 'Moldovan Leu', 2),
  ('MGA', 'Malagasy Ariary', 2),
  ('MKD', 'Macedonian Denar', 2),
  ('MMK', 'Myanmar Kyat', 2),
  ('MNT', 'Mongolian Tugrik', 2),
  ('MOP', 'Macanese Pataca', 2),
  ('MRU', 'Mauritanian Ouguiya', 2),
  ('MUR', 'Mauritian Rupee', 2),
  ('MVR', 'Maldivian Rufiyaa', 2),
  ('MWK', 'Malawian Kwacha', 2),
  ('MXN', 'Mexican Peso', 2),
  ('MYR', 'Malaysian Ringgit', 2),
  ('MZN', 'Mozambican Metical', 2),
  ('NAD', 'Namibian Dollar', 2),
  ('NGN', 'Nigerian Naira', 2),
  ('NIO', 'Nicaraguan Córdoba', 2),
  ('NOK', 'Norwegian Krone', 2),
  ('NPR', 'Nepalese Rupee', 2),
  ('NZD', 'New Zealand Dollar', 2),
  ('OMR', 'Omani Rial', 3),
  ('PAB', 'Panamanian Balboa', 2),
  ('PEN', 'Peruvian Sol', 2),
  ('PGK', 'Papua New Guinean Kina', 2),
  ('PHP', 'Philippine Peso', 2),
  ('PKR', 'Pakistani Rupee', 2),
  ('PLN', 'Polish Zloty', 2),
  ('PYG', 'Paraguayan Guarani', 0),
  ('QAR', 'Qatari Riyal', 2),
  ('RON', 'Romanian Leu', 2),
  ('RSD', 'Serbian Dinar', 2),
  ('RUB', 'Russian Ruble', 2),
  ('RWF', 'Rwandan Franc', 0),
  ('SAR', 'Saudi Riyal', 2),
  ('SBD', 'Solomon Islands Dollar', 2),
  ('SCR', 'Seychellois Rupee', 2),
  ('SDG', 'Sudanese Pound', 2),
  ('SEK', 'Swedish Krona', 2),
  ('SGD', 'Singapore Dollar', 2),
  ('SHP', 'St. Helena Pound', 2),
  ('SLE', 'Sierra Leonean Leone', 2),
  ('SOS', 'Somali Shilling', 2),
  ('SRD', 'Surinamese Dollar', 2),
  ('SSP', 'South Sudanese Pound', 2),
  ('STN', 'São Tomé and Príncipe Dobra', 2),
  ('SVC', 'Salvadoran Colón', 2),
  ('SYP', 'Syrian Pound', 2),
  ('SZL', 'Eswatini Lilangeni', 2),
  ('THB', 'Thai Baht', 2),
  ('TJS', 'Tajikistani Somoni', 2),
  ('TMT', 'Turkmenistani Manat', 2),
  ('TND', 'Tunisian Dinar', 3),
  ('TOP', 'Tongan Paʻanga', 2),
  ('TRY', 'Turkish Lira', 2),
  ('TTD', 'Trinidad and Tobago Dollar', 2),
  ('TWD', 'New Taiwan Dollar', 2),
  ('TZS', 'Tanzanian Shilling', 2),
  ('UAH', 'Ukrainian Hryvnia', 2),
  ('UGX', 'Ugandan Shilling', 0),
  ('USD', 'US Dollar', 2),
  ('UYU', 'Uruguayan Peso', 2),
  ('UZS', 'Uzbekistani Som', 2),
  ('VES', 'Venezuelan Bolívar', 2),
  ('VND', 'Vietnamese Dong', 0),
  ('VUV', 'Vanuatu Vatu', 0),
  ('WST', 'Samoan Tala', 2),
  ('XAF', 'Central African CFA Franc', 0),
  ('XCD', 'East Caribbean Dollar', 2),
  ('XCG', 'Caribbean Guilder', 2),
  ('XOF', 'West African CFA Franc', 0),
  ('XPF', 'CFP Franc', 0),
  ('YER', 'Yemeni Rial', 2),
  ('ZAR', 'South African Rand', 2),
  ('ZMW', 'Zambian Kwacha', 2),
  ('ZWG', 'Zimbabwe Gold', 2)
on conflict (code) do update
set name = excluded.name,
    decimal_digits = excluded.decimal_digits,
    is_active = true,
    updated_at = now();

-- Preserve historical catalogue rows for old records, but hide them from new selections.
update public.supported_currencies
set is_active = false,
    updated_at = now()
where code in ('ANG', 'BGN', 'CUC', 'HRK', 'MRO', 'SLL', 'STD', 'VEF', 'ZMK', 'ZWL');

alter table public.workspace_settings
  add column if not exists default_payment_currency text,
  add column if not exists enabled_currencies text[],
  add column if not exists reporting_currency text,
  add column if not exists conversion_enabled boolean not null default false;

update public.workspace_settings
set default_payment_currency = coalesce(default_payment_currency, base_currency, 'USD'),
    reporting_currency = coalesce(reporting_currency, base_currency, 'USD'),
    enabled_currencies = coalesce(enabled_currencies, array[coalesce(base_currency, 'USD')]::text[])
where default_payment_currency is null
   or reporting_currency is null
   or enabled_currencies is null;

alter table public.workspace_settings
  alter column default_payment_currency set default 'USD',
  alter column default_payment_currency set not null,
  alter column enabled_currencies set default array['USD']::text[],
  alter column enabled_currencies set not null,
  alter column reporting_currency set default 'USD',
  alter column reporting_currency set not null,
  drop constraint if exists workspace_settings_currency_codes_check,
  add constraint workspace_settings_currency_codes_check check (
    default_payment_currency ~ '^[A-Z]{3}$'
    and reporting_currency ~ '^[A-Z]{3}$'
    and cardinality(enabled_currencies) between 1 and 160
    and default_payment_currency = any(enabled_currencies)
    and reporting_currency = any(enabled_currencies)
  );

-- These UPDATE OF triggers may already exist when the complete schema is
-- reapplied. PostgreSQL will not change the type of a referenced column until
-- the trigger definition is removed. They are recreated below after every
-- currency amount column has its final numeric type.
drop trigger if exists lock_payment_record_conversion_trigger on public.payment_records;
drop trigger if exists lock_platform_payment_conversion_trigger on public.payments;
drop trigger if exists lock_subscription_payment_conversion_trigger on public.subscription_payments;

alter table public.payment_records
  add column if not exists currency text;
update public.payment_records as records
set currency = coalesce(records.currency, items.currency, 'USD')
from public.payment_items as items
where items.id = records.payment_item_id
  and records.currency is null;
update public.payment_records set currency = 'USD' where currency is null;
alter table public.payment_records
  alter column currency set default 'USD',
  alter column currency set not null,
  drop constraint if exists payment_records_currency_check,
  add constraint payment_records_currency_check check (currency ~ '^[A-Z]{3}$'),
  alter column amount type numeric(18,4) using amount::numeric(18,4);

alter table public.payment_items
  alter column amount type numeric(18,4) using amount::numeric(18,4);

alter table public.category_budgets add column if not exists currency text;
update public.category_budgets as budgets
set currency = coalesce(budgets.currency, families.currency, 'USD')
from public.families
where families.id = budgets.family_id and budgets.currency is null;
update public.category_budgets set currency = 'USD' where currency is null;
alter table public.category_budgets
  alter column currency set default 'USD',
  alter column currency set not null,
  drop constraint if exists category_budgets_currency_check,
  add constraint category_budgets_currency_check check (currency ~ '^[A-Z]{3}$'),
  alter column monthly_limit type numeric(18,4) using monthly_limit::numeric(18,4);

alter table public.expenses add column if not exists currency text;
update public.expenses as expense_rows
set currency = coalesce(expense_rows.currency, families.currency, 'USD')
from public.families
where families.id = expense_rows.family_id and expense_rows.currency is null;
update public.expenses set currency = 'USD' where currency is null;
alter table public.expenses
  alter column currency set default 'USD',
  alter column currency set not null,
  drop constraint if exists expenses_currency_check,
  add constraint expenses_currency_check check (currency ~ '^[A-Z]{3}$'),
  alter column amount type numeric(18,4) using amount::numeric(18,4);

alter table public.payments
  drop constraint if exists payments_currency_check,
  add constraint payments_currency_check check (currency ~ '^[A-Z]{3}$'),
  alter column amount type numeric(18,4) using amount::numeric(18,4);

alter table public.subscription_payments
  alter column amount type numeric(18,4) using amount::numeric(18,4);

create table if not exists public.admin_finance_settings (
  id smallint primary key default 1 check (id = 1),
  reporting_currency text not null default 'USD' check (reporting_currency ~ '^[A-Z]{3}$'),
  enabled_receipt_currencies text[] not null default array['USD']::text[],
  conversion_enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(enabled_receipt_currencies) between 1 and 40),
  check (reporting_currency = any(enabled_receipt_currencies))
);
insert into public.admin_finance_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.exchange_rate_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'currencyapi' check (provider = 'currencyapi'),
  requested_base_currency text not null default 'USD' check (requested_base_currency ~ '^[A-Z]{3}$'),
  trigger_source text not null check (trigger_source in ('scheduled', 'admin_manual')),
  status text not null default 'running' check (status in ('running', 'success', 'partial_failure', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  provider_effective_at timestamptz,
  rates_stored integer not null default 0 check (rates_stored >= 0),
  safe_error_summary text,
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists exchange_rate_one_running_provider_idx
on public.exchange_rate_sync_runs(provider) where status = 'running';
create index if not exists exchange_rate_sync_runs_status_idx
on public.exchange_rate_sync_runs(provider, status, started_at desc);

create table if not exists public.exchange_rate_snapshots (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'currencyapi' check (provider = 'currencyapi'),
  base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  quote_currency text not null check (quote_currency ~ '^[A-Z]{3}$'),
  rate numeric(30,12) not null check (rate > 0 and rate < 1000000000000),
  provider_effective_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  sync_run_id uuid not null references public.exchange_rate_sync_runs(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (provider, base_currency, quote_currency, provider_effective_at)
);
create index if not exists exchange_rate_snapshot_lookup_idx
on public.exchange_rate_snapshots(provider, base_currency, quote_currency, provider_effective_at desc);

create table if not exists public.payment_conversions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('payment_record', 'platform_payment', 'subscription_payment')),
  entity_id uuid not null,
  workspace_id uuid references public.budget_workspaces(id) on delete cascade,
  original_amount numeric(18,4) not null check (original_amount >= 0),
  original_currency text not null check (original_currency ~ '^[A-Z]{3}$'),
  reporting_currency text not null check (reporting_currency ~ '^[A-Z]{3}$'),
  exchange_rate numeric(30,12) not null check (exchange_rate > 0),
  converted_amount numeric(18,4) not null check (converted_amount >= 0),
  rate_effective_at timestamptz not null,
  rate_provider text not null check (rate_provider in ('currencyapi', 'manual', 'identity')),
  rate_source text not null check (rate_source in ('api', 'manual', 'identity')),
  is_locked boolean not null default true,
  entered_by uuid references auth.users(id) on delete set null,
  entered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id, reporting_currency)
);
create index if not exists payment_conversions_workspace_idx
on public.payment_conversions(workspace_id, entity_type, reporting_currency, rate_effective_at desc);

create or replace function public.latest_exchange_rate(
  p_source_currency text,
  p_target_currency text,
  p_at timestamptz default now()
)
returns table (exchange_rate numeric, rate_effective_at timestamptz, provider text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with requested as (
    select upper(p_source_currency) as source_currency,
           upper(p_target_currency) as target_currency,
           coalesce(p_at, now()) as requested_at
  ), source_rate as (
    select snapshots.rate, snapshots.provider_effective_at
    from public.exchange_rate_snapshots as snapshots, requested
    where snapshots.provider = 'currencyapi'
      and snapshots.base_currency = 'USD'
      and snapshots.quote_currency = requested.source_currency
      and snapshots.provider_effective_at <= requested.requested_at
    order by snapshots.provider_effective_at desc
    limit 1
  ), target_rate as (
    select snapshots.rate, snapshots.provider_effective_at
    from public.exchange_rate_snapshots as snapshots, requested
    where snapshots.provider = 'currencyapi'
      and snapshots.base_currency = 'USD'
      and snapshots.quote_currency = requested.target_currency
      and snapshots.provider_effective_at <= requested.requested_at
    order by snapshots.provider_effective_at desc
    limit 1
  )
  select
    case
      when requested.source_currency = requested.target_currency then 1::numeric
      else target_values.rate / source_values.rate
    end,
    case
      when requested.source_currency = requested.target_currency then requested.requested_at
      else least(source_values.provider_effective_at, target_values.provider_effective_at)
    end,
    case when requested.source_currency = requested.target_currency then 'identity' else 'currencyapi' end
  from requested
  left join lateral (
    select 1::numeric as rate, requested.requested_at as provider_effective_at
    where requested.source_currency = 'USD'
    union all select source_rate.rate, source_rate.provider_effective_at from source_rate
    limit 1
  ) as source_values on true
  left join lateral (
    select 1::numeric as rate, requested.requested_at as provider_effective_at
    where requested.target_currency = 'USD'
    union all select target_rate.rate, target_rate.provider_effective_at from target_rate
    limit 1
  ) as target_values on true
  where requested.source_currency = requested.target_currency
     or (source_values.rate is not null and target_values.rate is not null);
$$;

create or replace function public.save_workspace_currency_settings(
  p_workspace_id uuid,
  p_default_payment_currency text,
  p_enabled_currencies text[],
  p_reporting_currency text,
  p_conversion_enabled boolean
)
returns public.workspace_settings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_default text := upper(btrim(p_default_payment_currency));
  v_reporting text := upper(btrim(p_reporting_currency));
  v_enabled text[];
  v_result public.workspace_settings%rowtype;
  v_can_manage boolean := false;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select public.is_workspace_owner(p_workspace_id)
    or exists (
      select 1 from public.workspace_members
      where workspace_id = p_workspace_id and user_id = auth.uid() and status = 'active'
        and role in ('business_owner', 'business_admin', 'finance_manager')
    ) into v_can_manage;
  if not v_can_manage then raise exception 'CURRENCY_SETTINGS_ACCESS_REQUIRED'; end if;

  select array_agg(distinct upper(btrim(code)) order by upper(btrim(code)))
  into v_enabled from unnest(coalesce(p_enabled_currencies, array[]::text[])) as code;
  if v_enabled is null or cardinality(v_enabled) = 0 or cardinality(v_enabled) > 160 then
    raise exception 'INVALID_ENABLED_CURRENCIES';
  end if;
  if not (v_default = any(v_enabled)) or not (v_reporting = any(v_enabled)) then
    raise exception 'DEFAULT_AND_REPORTING_CURRENCY_MUST_BE_ENABLED';
  end if;
  if exists (
    select 1 from unnest(v_enabled) as requested(code)
    left join public.supported_currencies on supported_currencies.code = requested.code and supported_currencies.is_active
    where supported_currencies.code is null
  ) then raise exception 'UNSUPPORTED_CURRENCY'; end if;

  insert into public.workspace_settings (
    workspace_id, base_currency, default_payment_currency, enabled_currencies,
    reporting_currency, conversion_enabled, updated_at
  ) values (
    p_workspace_id, v_reporting, v_default, v_enabled,
    v_reporting, coalesce(p_conversion_enabled, false), now()
  )
  on conflict (workspace_id) do update
  set base_currency = excluded.base_currency,
      default_payment_currency = excluded.default_payment_currency,
      enabled_currencies = excluded.enabled_currencies,
      reporting_currency = excluded.reporting_currency,
      conversion_enabled = excluded.conversion_enabled,
      updated_at = now()
  returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.save_admin_finance_currency_settings(
  p_reporting_currency text,
  p_enabled_receipt_currencies text[],
  p_conversion_enabled boolean
)
returns public.admin_finance_settings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reporting text := upper(btrim(p_reporting_currency));
  v_enabled text[];
  v_result public.admin_finance_settings%rowtype;
begin
  if not public.is_platform_staff(array['super_admin', 'admin_staff', 'finance_staff']) then
    raise exception 'FINANCE_CURRENCY_ACCESS_REQUIRED';
  end if;
  select array_agg(distinct upper(btrim(code)) order by upper(btrim(code)))
  into v_enabled from unnest(coalesce(p_enabled_receipt_currencies, array[]::text[])) as code;
  if v_enabled is null or cardinality(v_enabled) = 0 or not (v_reporting = any(v_enabled)) then
    raise exception 'INVALID_ENABLED_CURRENCIES';
  end if;
  if exists (
    select 1 from unnest(v_enabled) as requested(code)
    left join public.supported_currencies on supported_currencies.code = requested.code and supported_currencies.is_active
    where supported_currencies.code is null
  ) then raise exception 'UNSUPPORTED_CURRENCY'; end if;
  update public.admin_finance_settings
  set reporting_currency = v_reporting,
      enabled_receipt_currencies = v_enabled,
      conversion_enabled = coalesce(p_conversion_enabled, true),
      updated_by = auth.uid(),
      updated_at = now()
  where id = 1
  returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.exchange_rate_status(p_include_admin_details boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_last_attempt public.exchange_rate_sync_runs%rowtype;
  v_last_success public.exchange_rate_sync_runs%rowtype;
  v_admin boolean := public.is_platform_staff(array['super_admin', 'admin_staff', 'finance_staff']);
begin
  select * into v_last_attempt from public.exchange_rate_sync_runs
  where provider = 'currencyapi' order by started_at desc limit 1;
  select * into v_last_success from public.exchange_rate_sync_runs
  where provider = 'currencyapi' and status in ('success', 'partial_failure')
  order by completed_at desc nulls last limit 1;
  return jsonb_build_object(
    'provider', 'currencyapi',
    'last_attempt_at', v_last_attempt.started_at,
    'last_attempt_status', v_last_attempt.status,
    'last_success_at', v_last_success.completed_at,
    'provider_effective_at', v_last_success.provider_effective_at,
    'currencies_updated', coalesce(v_last_success.rates_stored, 0),
    'stale_hours', case when v_last_success.completed_at is null then null else extract(epoch from (now() - v_last_success.completed_at)) / 3600 end,
    'safe_error_summary', case when p_include_admin_details and v_admin then v_last_attempt.safe_error_summary else null end,
    'next_schedule_utc', '00:15 and 12:15 UTC'
  );
end;
$$;

create or replace function public.validate_payment_record_currency()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_item_currency text;
begin
  select currency into v_item_currency from public.payment_items where id = new.payment_item_id;
  if v_item_currency is null then raise exception 'PAYMENT_ITEM_NOT_FOUND'; end if;
  new.currency := coalesce(new.currency, v_item_currency);
  if upper(new.currency) <> upper(v_item_currency) then raise exception 'PARTIAL_PAYMENT_CURRENCY_MISMATCH'; end if;
  new.currency := upper(new.currency);
  return new;
end;
$$;
drop trigger if exists validate_payment_record_currency_trigger on public.payment_records;
create trigger validate_payment_record_currency_trigger
before insert or update of payment_item_id, currency on public.payment_records
for each row execute function public.validate_payment_record_currency();

create or replace function public.store_api_payment_conversion(
  p_entity_type text,
  p_entity_id uuid,
  p_workspace_id uuid,
  p_original_amount numeric,
  p_original_currency text,
  p_reporting_currency text,
  p_payment_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_rate record;
begin
  select * into v_rate from public.latest_exchange_rate(p_original_currency, p_reporting_currency, p_payment_at);
  if v_rate.exchange_rate is null then return; end if;
  insert into public.payment_conversions (
    entity_type, entity_id, workspace_id, original_amount, original_currency,
    reporting_currency, exchange_rate, converted_amount, rate_effective_at,
    rate_provider, rate_source, is_locked
  ) values (
    p_entity_type, p_entity_id, p_workspace_id, p_original_amount, upper(p_original_currency),
    upper(p_reporting_currency), v_rate.exchange_rate,
    round(p_original_amount * v_rate.exchange_rate, 4), v_rate.rate_effective_at,
    v_rate.provider, case when v_rate.provider = 'identity' then 'identity' else 'api' end, true
  )
  on conflict (entity_type, entity_id, reporting_currency) do nothing;
end;
$$;

create or replace function public.lock_payment_record_conversion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_settings public.workspace_settings%rowtype;
begin
  select * into v_settings from public.workspace_settings where workspace_id = new.workspace_id;
  if coalesce(v_settings.conversion_enabled, false) then
    perform public.store_api_payment_conversion(
      'payment_record', new.id, new.workspace_id, new.amount, new.currency,
      v_settings.reporting_currency, new.payment_date::timestamptz + interval '23 hours 59 minutes'
    );
  end if;
  return new;
end;
$$;
drop trigger if exists lock_payment_record_conversion_trigger on public.payment_records;
create trigger lock_payment_record_conversion_trigger
after insert or update of amount, currency, payment_date on public.payment_records
for each row execute function public.lock_payment_record_conversion();

create or replace function public.lock_platform_payment_conversion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_settings public.admin_finance_settings%rowtype;
begin
  select * into v_settings from public.admin_finance_settings where id = 1;
  if coalesce(v_settings.conversion_enabled, false) then
    perform public.store_api_payment_conversion(
      'platform_payment', new.id, null, new.amount, new.currency,
      v_settings.reporting_currency, new.payment_date::timestamptz + interval '23 hours 59 minutes'
    );
  end if;
  return new;
end;
$$;
drop trigger if exists lock_platform_payment_conversion_trigger on public.payments;
create trigger lock_platform_payment_conversion_trigger
after insert or update of amount, currency, payment_date on public.payments
for each row execute function public.lock_platform_payment_conversion();

create or replace function public.lock_subscription_payment_conversion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_settings public.admin_finance_settings%rowtype;
begin
  if new.status <> 'approved' then return new; end if;
  select * into v_settings from public.admin_finance_settings where id = 1;
  if coalesce(v_settings.conversion_enabled, false) then
    perform public.store_api_payment_conversion(
      'subscription_payment', new.id, null, new.amount, new.currency,
      v_settings.reporting_currency, new.payment_date::timestamptz + interval '23 hours 59 minutes'
    );
  end if;
  return new;
end;
$$;
drop trigger if exists lock_subscription_payment_conversion_trigger on public.subscription_payments;
create trigger lock_subscription_payment_conversion_trigger
after insert or update of status, amount, currency, payment_date on public.subscription_payments
for each row execute function public.lock_subscription_payment_conversion();

create or replace function public.backfill_currency_conversions()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_count integer := 0; v_row record;
begin
  if auth.role() <> 'service_role' and not public.is_platform_staff(array['super_admin', 'admin_staff', 'finance_staff']) then
    raise exception 'FINANCE_CURRENCY_ACCESS_REQUIRED';
  end if;
  for v_row in
    select records.*, settings.reporting_currency
    from public.payment_records as records
    join public.workspace_settings as settings on settings.workspace_id = records.workspace_id
    where settings.conversion_enabled
  loop
    perform public.store_api_payment_conversion('payment_record', v_row.id, v_row.workspace_id,
      v_row.amount, v_row.currency, v_row.reporting_currency,
      v_row.payment_date::timestamptz + interval '23 hours 59 minutes');
    v_count := v_count + 1;
  end loop;
  for v_row in select payments.*, settings.reporting_currency
    from public.payments cross join public.admin_finance_settings as settings
    where settings.id = 1 and settings.conversion_enabled
  loop
    perform public.store_api_payment_conversion('platform_payment', v_row.id, null,
      v_row.amount, v_row.currency, v_row.reporting_currency,
      v_row.payment_date::timestamptz + interval '23 hours 59 minutes');
    v_count := v_count + 1;
  end loop;
  for v_row in select payments.*, settings.reporting_currency
    from public.subscription_payments as payments cross join public.admin_finance_settings as settings
    where settings.id = 1 and settings.conversion_enabled and payments.status = 'approved'
  loop
    perform public.store_api_payment_conversion('subscription_payment', v_row.id, null,
      v_row.amount, v_row.currency, v_row.reporting_currency,
      v_row.payment_date::timestamptz + interval '23 hours 59 minutes');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.backfill_workspace_currency_conversions(p_workspace_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_count integer := 0; v_row record; v_settings public.workspace_settings%rowtype;
begin
  if not public.is_workspace_owner(p_workspace_id)
     and not exists (
       select 1 from public.workspace_members
       where workspace_id = p_workspace_id and user_id = auth.uid() and status = 'active'
         and role in ('business_owner', 'business_admin', 'finance_manager')
     )
  then raise exception 'CURRENCY_SETTINGS_ACCESS_REQUIRED'; end if;
  select * into v_settings from public.workspace_settings where workspace_id = p_workspace_id;
  if not coalesce(v_settings.conversion_enabled, false) then return 0; end if;
  for v_row in
    select * from public.payment_records where workspace_id = p_workspace_id
  loop
    perform public.store_api_payment_conversion(
      'payment_record', v_row.id, p_workspace_id, v_row.amount, v_row.currency,
      v_settings.reporting_currency, v_row.payment_date::timestamptz + interval '23 hours 59 minutes'
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.currency_conversion_backfill_dates(p_limit integer default 7)
returns table (payment_date date)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with missing_dates as (
    select records.payment_date
    from public.payment_records as records
    join public.workspace_settings as settings
      on settings.workspace_id = records.workspace_id and settings.conversion_enabled
    left join public.payment_conversions as conversions
      on conversions.entity_type = 'payment_record'
     and conversions.entity_id = records.id
     and conversions.reporting_currency = settings.reporting_currency
    where conversions.id is null
    union
    select payments.payment_date
    from public.payments cross join public.admin_finance_settings as settings
    left join public.payment_conversions as conversions
      on conversions.entity_type = 'platform_payment'
     and conversions.entity_id = payments.id
     and conversions.reporting_currency = settings.reporting_currency
    where settings.id = 1 and settings.conversion_enabled and conversions.id is null
    union
    select payments.payment_date
    from public.subscription_payments as payments
    cross join public.admin_finance_settings as settings
    left join public.payment_conversions as conversions
      on conversions.entity_type = 'subscription_payment'
     and conversions.entity_id = payments.id
     and conversions.reporting_currency = settings.reporting_currency
    where settings.id = 1 and settings.conversion_enabled
      and payments.status = 'approved' and conversions.id is null
  )
  select missing_dates.payment_date
  from missing_dates
  where missing_dates.payment_date < current_date
  order by missing_dates.payment_date desc
  limit greatest(0, least(coalesce(p_limit, 7), 31));
$$;

create or replace function public.save_manual_payment_conversion(
  p_entity_type text,
  p_entity_id uuid,
  p_reporting_currency text,
  p_exchange_rate numeric,
  p_converted_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
  v_amount numeric;
  v_currency text;
  v_id uuid;
begin
  if p_exchange_rate <= 0 or p_converted_amount <= 0 then raise exception 'INVALID_MANUAL_RATE'; end if;
  if p_entity_type = 'payment_record' then
    select workspace_id, amount, currency into v_workspace_id, v_amount, v_currency
    from public.payment_records where id = p_entity_id;
    if not public.is_workspace_owner(v_workspace_id)
       and not exists (select 1 from public.workspace_members where workspace_id = v_workspace_id and user_id = auth.uid() and status = 'active' and role in ('business_owner', 'business_admin', 'finance_manager'))
    then raise exception 'CURRENCY_SETTINGS_ACCESS_REQUIRED'; end if;
  elsif p_entity_type = 'platform_payment' then
    if not public.is_platform_staff(array['super_admin', 'admin_staff', 'finance_staff']) then raise exception 'FINANCE_CURRENCY_ACCESS_REQUIRED'; end if;
    select amount, currency into v_amount, v_currency from public.payments where id = p_entity_id;
  elsif p_entity_type = 'subscription_payment' then
    if not public.is_platform_staff(array['super_admin', 'admin_staff', 'finance_staff']) then raise exception 'FINANCE_CURRENCY_ACCESS_REQUIRED'; end if;
    select amount, currency into v_amount, v_currency from public.subscription_payments where id = p_entity_id and status = 'approved';
  else raise exception 'INVALID_CONVERSION_ENTITY'; end if;
  if v_amount is null then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if abs(round(v_amount * p_exchange_rate, 4) - round(p_converted_amount, 4)) > 0.01 then
    raise exception 'MANUAL_CONVERSION_INCONSISTENT';
  end if;
  insert into public.payment_conversions (
    entity_type, entity_id, workspace_id, original_amount, original_currency,
    reporting_currency, exchange_rate, converted_amount, rate_effective_at,
    rate_provider, rate_source, is_locked, entered_by
  ) values (
    p_entity_type, p_entity_id, v_workspace_id, v_amount, upper(v_currency),
    upper(p_reporting_currency), p_exchange_rate, p_converted_amount, now(),
    'manual', 'manual', true, auth.uid()
  ) on conflict (entity_type, entity_id, reporting_currency) do update
  set exchange_rate = excluded.exchange_rate,
      converted_amount = excluded.converted_amount,
      rate_effective_at = excluded.rate_effective_at,
      rate_provider = 'manual', rate_source = 'manual', is_locked = true,
      entered_by = auth.uid(), entered_at = now(), updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

alter table public.supported_currencies enable row level security;
alter table public.admin_finance_settings enable row level security;
alter table public.exchange_rate_sync_runs enable row level security;
alter table public.exchange_rate_snapshots enable row level security;
alter table public.payment_conversions enable row level security;

drop policy if exists "Authenticated users can read supported currencies" on public.supported_currencies;
create policy "Authenticated users can read supported currencies" on public.supported_currencies
for select to authenticated using (is_active or public.is_platform_staff(null));

drop policy if exists "Finance staff can read admin currency settings" on public.admin_finance_settings;
create policy "Finance staff can read admin currency settings" on public.admin_finance_settings
for select to authenticated using (public.is_platform_staff(array['super_admin', 'admin_staff', 'finance_staff']));

drop policy if exists "Finance staff can read rate sync diagnostics" on public.exchange_rate_sync_runs;
create policy "Finance staff can read rate sync diagnostics" on public.exchange_rate_sync_runs
for select to authenticated using (public.is_platform_staff(array['super_admin', 'admin_staff', 'finance_staff']));

drop policy if exists "Authenticated users can read exchange rates" on public.exchange_rate_snapshots;
create policy "Authenticated users can read exchange rates" on public.exchange_rate_snapshots
for select to authenticated using (true);

drop policy if exists "Authorized users can read payment conversions" on public.payment_conversions;
create policy "Authorized users can read payment conversions" on public.payment_conversions
for select to authenticated using (
  (workspace_id is not null and public.is_workspace_member(workspace_id))
  or (workspace_id is null and public.is_platform_staff(array['super_admin', 'admin_staff', 'finance_staff']))
);

grant select on public.supported_currencies, public.exchange_rate_snapshots to authenticated;
grant select on public.admin_finance_settings, public.exchange_rate_sync_runs, public.payment_conversions to authenticated;
revoke all on function public.store_api_payment_conversion(text, uuid, uuid, numeric, text, text, timestamptz) from public;
revoke all on function public.backfill_currency_conversions() from public;
grant execute on function public.backfill_currency_conversions() to service_role;
grant execute on function public.backfill_currency_conversions() to authenticated;
grant execute on function public.backfill_workspace_currency_conversions(uuid) to authenticated;
revoke all on function public.currency_conversion_backfill_dates(integer) from public;
grant execute on function public.currency_conversion_backfill_dates(integer) to service_role;
grant execute on function public.latest_exchange_rate(text, text, timestamptz) to authenticated;
grant execute on function public.save_workspace_currency_settings(uuid, text, text[], text, boolean) to authenticated;
grant execute on function public.save_admin_finance_currency_settings(text, text[], boolean) to authenticated;
grant execute on function public.exchange_rate_status(boolean) to authenticated;
grant execute on function public.save_manual_payment_conversion(text, uuid, text, numeric, numeric) to authenticated;

-- Keep newly provisioned legacy rows aligned with the family's selected currency.
create or replace function public.align_workspace_currency_defaults()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.base_currency := upper(coalesce(nullif(new.base_currency, ''), 'USD'));
  if new.base_currency <> 'USD'
     and coalesce(new.default_payment_currency, 'USD') = 'USD'
     and coalesce(new.reporting_currency, 'USD') = 'USD'
     and coalesce(new.enabled_currencies, array['USD']::text[]) = array['USD']::text[]
  then
    new.default_payment_currency := new.base_currency;
    new.reporting_currency := new.base_currency;
    new.enabled_currencies := array[new.base_currency]::text[];
  end if;
  return new;
end;
$$;
drop trigger if exists align_workspace_currency_defaults_trigger on public.workspace_settings;
create trigger align_workspace_currency_defaults_trigger
before insert on public.workspace_settings
for each row execute function public.align_workspace_currency_defaults();

create or replace function public.validate_workspace_transaction_currency()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_enabled text[];
begin
  new.currency := upper(coalesce(nullif(new.currency, ''), 'USD'));
  select settings.enabled_currencies into v_enabled
  from public.workspace_settings as settings
  where settings.workspace_id = new.workspace_id;
  if v_enabled is null or not (new.currency = any(v_enabled)) then
    raise exception 'PAYMENT_CURRENCY_NOT_ENABLED';
  end if;
  if not exists (
    select 1 from public.supported_currencies
    where code = new.currency and is_active
  ) then raise exception 'UNSUPPORTED_CURRENCY'; end if;
  return new;
end;
$$;
drop trigger if exists zz_validate_workspace_transaction_currency_trigger on public.payment_items;
create trigger zz_validate_workspace_transaction_currency_trigger
before insert or update of workspace_id, currency on public.payment_items
for each row execute function public.validate_workspace_transaction_currency();

create or replace function public.validate_budget_expense_currency()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_budget_currency text;
begin
  new.currency := upper(coalesce(nullif(new.currency, ''), 'USD'));
  if not exists (select 1 from public.supported_currencies where code = new.currency and is_active) then
    raise exception 'UNSUPPORTED_CURRENCY';
  end if;
  if tg_table_name = 'expenses' then
    select budgets.currency into v_budget_currency
    from public.category_budgets as budgets
    where budgets.family_id = new.family_id and budgets.category = new.category;
    if v_budget_currency is not null and v_budget_currency <> new.currency then
      raise exception 'EXPENSE_BUDGET_CURRENCY_MISMATCH';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists validate_category_budget_currency_trigger on public.category_budgets;
create trigger validate_category_budget_currency_trigger
before insert or update of currency on public.category_budgets
for each row execute function public.validate_budget_expense_currency();
drop trigger if exists validate_expense_currency_trigger on public.expenses;
create trigger validate_expense_currency_trigger
before insert or update of family_id, category, currency on public.expenses
for each row execute function public.validate_budget_expense_currency();

-- ============================================================================
-- Public website plan catalogue and enquiry workflow
-- ============================================================================

alter table public.plans
  add column if not exists marketing_summary text not null default '',
  add column if not exists is_public boolean not null default false,
  add column if not exists is_featured boolean not null default false,
  add column if not exists available_for_purchase boolean not null default true,
  add column if not exists cta_label text not null default 'Choose plan';

update public.plans
set is_public = true,
    marketing_summary = case code
      when 'free' then 'Essential payment tracking for a personal workspace.'
      when 'personal' then 'Unlimited personal payment planning with complete reports.'
      when 'household' then 'Shared payment responsibility for a family, with additional places when needed.'
      when 'business' then 'Team payment control, approval features, and deeper history for a business workspace.'
      else coalesce(nullif(marketing_summary, ''), description)
    end,
    is_featured = code = 'household',
    cta_label = case code when 'free' then 'Start free' when 'household' then 'Start a Family plan' else 'Choose plan' end
where code in ('free', 'personal', 'household', 'business')
  and marketing_summary = '';

create or replace function public.get_public_plan_catalogue(p_currency text default 'USD')
returns table (
  plan_id uuid,
  code text,
  display_name text,
  description text,
  marketing_summary text,
  workspace_type text,
  is_featured boolean,
  available_for_purchase boolean,
  cta_label text,
  sort_order integer,
  included_member_seats integer,
  active_payment_limit integer,
  features jsonb,
  prices jsonb,
  available_currencies text[]
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    plans.id,
    plans.code,
    plans.display_name,
    plans.description,
    coalesce(nullif(plans.marketing_summary, ''), plans.description),
    plans.workspace_type,
    plans.is_featured,
    plans.available_for_purchase,
    plans.cta_label,
    plans.sort_order,
    coalesce((
      select limits.limit_value
      from public.plan_limits as limits
      where limits.plan_id = plans.id and limits.limit_code = 'included_member_seats'
    ), 1),
    (
      select limits.limit_value
      from public.plan_limits as limits
      where limits.plan_id = plans.id and limits.limit_code = 'active_planned_payments'
    ),
    coalesce((
      select jsonb_agg(jsonb_build_object('code', feature_rows.feature_code, 'enabled', feature_rows.enabled) order by feature_rows.feature_code)
      from public.plan_features as feature_rows
      where feature_rows.plan_id = plans.id and feature_rows.enabled
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'billing_period', current_prices.billing_period,
          'currency', current_prices.currency,
          'amount', current_prices.amount,
          'extra_member_amount', current_prices.extra_member_amount,
          'effective_from', current_prices.effective_from
        ) order by current_prices.billing_period
      )
      from public.plan_prices as current_prices
      where current_prices.plan_id = plans.id
        and current_prices.currency = upper(coalesce(nullif(p_currency, ''), 'USD'))
        and current_prices.is_active
        and current_prices.effective_from <= now()
        and (current_prices.effective_until is null or current_prices.effective_until > now())
    ), '[]'::jsonb),
    coalesce((
      select array_agg(distinct currencies.currency order by currencies.currency)
      from public.plan_prices as currencies
      where currencies.plan_id = plans.id
        and currencies.is_active
        and currencies.effective_from <= now()
        and (currencies.effective_until is null or currencies.effective_until > now())
    ), array[]::text[])
  from public.plans
  where plans.is_active and plans.is_public
  order by plans.sort_order, plans.display_name;
$$;

create or replace function public.save_plan_definition(
  p_plan_id uuid,
  p_code text,
  p_display_name text,
  p_description text,
  p_marketing_summary text,
  p_workspace_type text,
  p_included_member_seats integer,
  p_active_payment_limit integer,
  p_is_active boolean,
  p_is_public boolean,
  p_is_featured boolean,
  p_available_for_purchase boolean,
  p_cta_label text,
  p_sort_order integer,
  p_feature_codes text[] default array[]::text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan_id uuid;
  v_code text := lower(btrim(p_code));
  v_name text := nullif(btrim(p_display_name), '');
begin
  if not public.is_platform_staff(array['super_admin', 'admin_staff']) then
    raise exception 'PLAN_MANAGEMENT_ACCESS_REQUIRED';
  end if;
  if v_code !~ '^[a-z][a-z0-9_]*$' then raise exception 'INVALID_PLAN_CODE'; end if;
  if v_name is null or char_length(v_name) > 80 then raise exception 'INVALID_PLAN_NAME'; end if;
  if p_workspace_type not in ('personal', 'household', 'business') then raise exception 'INVALID_WORKSPACE_TYPE'; end if;
  if p_included_member_seats is null or p_included_member_seats < 1 or p_included_member_seats > 100 then raise exception 'INVALID_INCLUDED_MEMBER_SEATS'; end if;
  if p_active_payment_limit is not null and (p_active_payment_limit < 1 or p_active_payment_limit > 100000) then raise exception 'INVALID_PAYMENT_LIMIT'; end if;
  if char_length(coalesce(p_description, '')) > 500 or char_length(coalesce(p_marketing_summary, '')) > 500 then raise exception 'PLAN_DESCRIPTION_TOO_LONG'; end if;
  if char_length(coalesce(p_cta_label, '')) > 60 then raise exception 'PLAN_CTA_TOO_LONG'; end if;

  if p_plan_id is null then
    insert into public.plans (
      code, display_name, description, marketing_summary, workspace_type,
      is_active, is_public, is_featured, available_for_purchase, cta_label, sort_order
    ) values (
      v_code, v_name, coalesce(btrim(p_description), ''), coalesce(btrim(p_marketing_summary), ''), p_workspace_type,
      coalesce(p_is_active, true), coalesce(p_is_public, false), coalesce(p_is_featured, false),
      coalesce(p_available_for_purchase, true), coalesce(nullif(btrim(p_cta_label), ''), 'Choose plan'), coalesce(p_sort_order, 0)
    ) returning id into v_plan_id;
  else
    select id into v_plan_id from public.plans where id = p_plan_id for update;
    if v_plan_id is null then raise exception 'PLAN_NOT_FOUND'; end if;
    if exists (select 1 from public.plans where id = v_plan_id and code <> v_code) then
      raise exception 'PLAN_CODE_CANNOT_CHANGE';
    end if;
    update public.plans
    set display_name = v_name,
        description = coalesce(btrim(p_description), ''),
        marketing_summary = coalesce(btrim(p_marketing_summary), ''),
        workspace_type = p_workspace_type,
        is_active = coalesce(p_is_active, true),
        is_public = coalesce(p_is_public, false),
        is_featured = coalesce(p_is_featured, false),
        available_for_purchase = coalesce(p_available_for_purchase, true),
        cta_label = coalesce(nullif(btrim(p_cta_label), ''), 'Choose plan'),
        sort_order = coalesce(p_sort_order, 0),
        updated_at = now()
    where id = v_plan_id;
  end if;

  if coalesce(p_is_featured, false) then
    update public.plans set is_featured = false, updated_at = now()
    where workspace_type = p_workspace_type and id <> v_plan_id and is_featured;
  end if;

  insert into public.plan_limits (plan_id, limit_code, limit_value)
  values (v_plan_id, 'included_member_seats', p_included_member_seats)
  on conflict (plan_id, limit_code) do update set limit_value = excluded.limit_value;

  if p_active_payment_limit is null then
    delete from public.plan_limits where plan_id = v_plan_id and limit_code = 'active_planned_payments';
  else
    insert into public.plan_limits (plan_id, limit_code, limit_value)
    values (v_plan_id, 'active_planned_payments', p_active_payment_limit)
    on conflict (plan_id, limit_code) do update set limit_value = excluded.limit_value;
  end if;

  update public.plan_features set enabled = false where plan_id = v_plan_id;
  insert into public.plan_features (plan_id, feature_code, enabled)
  select v_plan_id, selected.feature_code, true
  from unnest(coalesce(p_feature_codes, array[]::text[])) as selected(feature_code)
  where selected.feature_code ~ '^[a-z][a-z0-9_.-]*$'
  on conflict (plan_id, feature_code) do update set enabled = true;

  insert into public.subscription_audit_events (actor_id, action, target_type, target_id, safe_details)
  values (auth.uid(), 'plan.definition_saved', 'plan', v_plan_id, jsonb_build_object('plan_code', v_code));
  return v_plan_id;
end;
$$;

create table if not exists public.countries (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{2}$'),
  name text not null check (char_length(name) between 2 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) between 5 and 254),
  country_name text not null check (char_length(country_name) between 2 and 100),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  country_id uuid references public.countries(id) on delete set null,
  enquiry_type text not null check (enquiry_type in ('support', 'sales', 'subscription_renewal', 'setup_help', 'country_availability', 'partnership')),
  message text not null check (char_length(message) between 10 and 5000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved', 'archived')),
  source text not null default 'website' check (source in ('website', 'admin')),
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists enquiries_status_created_idx on public.enquiries(status, created_at desc);
create index if not exists enquiries_email_created_idx on public.enquiries(lower(email), created_at desc);
create index if not exists enquiries_country_created_idx on public.enquiries(country_id, created_at desc);

create or replace function public.normalize_enquiry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.full_name := trim(new.full_name);
  new.email := lower(trim(new.email));
  new.country_code := upper(trim(new.country_code));
  new.country_name := trim(new.country_name);
  new.message := trim(new.message);
  new.updated_at := now();

  if new.country_id is null then
    select id into new.country_id from public.countries where code = new.country_code limit 1;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    new.handled_by := auth.uid();
    if new.status in ('resolved', 'archived') then
      new.handled_at := now();
    else
      new.handled_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_enquiry_trigger on public.enquiries;
create trigger normalize_enquiry_trigger
before insert or update on public.enquiries
for each row execute function public.normalize_enquiry();

alter table public.countries enable row level security;
alter table public.enquiries enable row level security;
drop policy if exists "Staff can read countries" on public.countries;
create policy "Staff can read countries" on public.countries
for select to authenticated
using (public.is_platform_staff(array['super_admin', 'admin_staff', 'support_staff']));
drop policy if exists "Staff can read enquiries" on public.enquiries;
drop policy if exists "Public can submit enquiries" on public.enquiries;
create policy "Public can submit enquiries" on public.enquiries
for insert to anon, authenticated
with check (
  status = 'new'
  and source = 'website'
  and handled_by is null
  and handled_at is null
  and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  and country_code = any (string_to_array('AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW', ' '))
);
create policy "Staff can read enquiries" on public.enquiries
for select to authenticated
using (public.is_platform_staff(array['super_admin', 'admin_staff', 'support_staff']));
drop policy if exists "Staff can update enquiries" on public.enquiries;
create policy "Staff can update enquiries" on public.enquiries
for update to authenticated
using (public.is_platform_staff(array['super_admin', 'admin_staff', 'support_staff']))
with check (public.is_platform_staff(array['super_admin', 'admin_staff', 'support_staff']));

revoke all on public.countries from anon, authenticated;
revoke all on public.enquiries from anon, authenticated;
grant select on public.countries to authenticated;
grant select, update on public.enquiries to authenticated;
grant insert (full_name, email, country_name, country_code, enquiry_type, message)
on public.enquiries to anon, authenticated;
revoke all on function public.get_public_plan_catalogue(text) from public;
grant execute on function public.get_public_plan_catalogue(text) to anon, authenticated;
revoke all on function public.save_plan_definition(uuid, text, text, text, text, text, integer, integer, boolean, boolean, boolean, boolean, text, integer, text[]) from public;
grant execute on function public.save_plan_definition(uuid, text, text, text, text, text, integer, integer, boolean, boolean, boolean, boolean, text, integer, text[]) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables = true)
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'enquiries'
     )
  then
    alter publication supabase_realtime add table public.enquiries;
  end if;
end $$;

-- New-account currency preferences. Signup can read only this safe catalogue;
-- selected codes are revalidated before the personal workspace is provisioned.
create or replace function public.get_public_signup_currencies()
returns table (code text, name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select currencies.code, currencies.name
  from public.supported_currencies as currencies
  where currencies.is_active
  order by currencies.code;
$$;

create or replace function public.provision_budget_user(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
  v_plan_id uuid;
  v_name text;
  v_metadata jsonb := '{}'::jsonb;
  v_default_currency text := 'USD';
  v_enabled_currencies text[] := array[]::text[];
begin
  select
    coalesce(nullif(btrim(profiles.full_name), ''), 'Personal budget'),
    coalesce(users.raw_user_meta_data, '{}'::jsonb)
  into v_name, v_metadata
  from public.profiles as profiles
  join auth.users as users on users.id = profiles.id
  where profiles.id = p_user_id;

  v_default_currency := upper(coalesce(nullif(btrim(v_metadata ->> 'default_currency'), ''), 'USD'));
  if not exists (
    select 1 from public.supported_currencies
    where supported_currencies.code = v_default_currency and supported_currencies.is_active
  ) then
    select currencies.code into v_default_currency
    from public.supported_currencies as currencies
    where currencies.is_active
    order by (currencies.code = 'USD') desc, currencies.code
    limit 1;
  end if;

  select coalesce(array_agg(requested.code order by requested.code), array[]::text[])
  into v_enabled_currencies
  from (
    select distinct upper(btrim(metadata_values.value)) as code
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(v_metadata -> 'enabled_currencies') = 'array'
          then v_metadata -> 'enabled_currencies'
        else '[]'::jsonb
      end
    ) as metadata_values(value)
    where upper(btrim(metadata_values.value)) ~ '^[A-Z]{3}$'
  ) as requested
  join public.supported_currencies as currencies
    on currencies.code = requested.code and currencies.is_active;

  if v_default_currency is null then raise exception 'NO_SUPPORTED_CURRENCIES_AVAILABLE'; end if;
  if not (v_default_currency = any(v_enabled_currencies)) then
    v_enabled_currencies := array_append(v_enabled_currencies, v_default_currency);
  end if;
  select array_agg(distinct code order by code)
  into v_enabled_currencies
  from unnest(v_enabled_currencies) as selected(code);

  insert into public.budget_workspaces (owner_id, workspace_type, name)
  values (p_user_id, 'personal', coalesce(v_name, 'Personal budget') || '''s budget')
  on conflict (owner_id) where workspace_type = 'personal' and status <> 'closed'
  do update set updated_at = now()
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (v_workspace_id, p_user_id, 'owner', 'active')
  on conflict (workspace_id, user_id) do update
  set role = 'owner', status = 'active', removed_at = null, updated_at = now();

  insert into public.workspace_settings (
    workspace_id, base_currency, locale, timezone, default_payment_currency,
    enabled_currencies, reporting_currency, conversion_enabled
  ) values (
    v_workspace_id, v_default_currency, 'en-ZW', 'Africa/Harare', v_default_currency,
    v_enabled_currencies, v_default_currency, true
  )
  on conflict (workspace_id) do nothing;

  select id into v_plan_id from public.plans where code = 'free';
  insert into public.workspace_subscriptions (workspace_id, plan_id, status, billing_period, paid_through_at)
  values (v_workspace_id, v_plan_id, 'active', null, null)
  on conflict (workspace_id) do nothing;

  insert into public.subscription_entitlement_history (
    workspace_id, subscription_id, plan_id, status, effective_from, reason, actor_id
  )
  select v_workspace_id, subscriptions.id, v_plan_id, 'active', subscriptions.entitlement_start_at,
         'Initial Free entitlement', p_user_id
  from public.workspace_subscriptions as subscriptions
  where subscriptions.workspace_id = v_workspace_id
    and not exists (
      select 1 from public.subscription_entitlement_history
      where subscription_entitlement_history.workspace_id = v_workspace_id
    );

  return v_workspace_id;
end;
$$;

revoke all on function public.get_public_signup_currencies() from public;
grant execute on function public.get_public_signup_currencies() to anon, authenticated;
revoke all on function public.provision_budget_user(uuid) from public;
