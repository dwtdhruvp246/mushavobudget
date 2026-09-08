Warning: truncated output (original token count: 63887)
Total output lines: 6507

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

drop policy if exists "Admins can manage audit logs" on public.admin_aud…33887 tokens truncated…_currency), v_rate.exchange_rate,
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

-- PWA Stage 7: protected per-user, per-device Web Push subscriptions.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  device_label text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count integer not null default 0,
  disabled_at timestamptz,
  constraint push_subscriptions_endpoint_length_check
    check (char_length(endpoint) between 20 and 4096),
  constraint push_subscriptions_p256dh_length_check
    check (char_length(p256dh) between 16 and 1024),
  constraint push_subscriptions_auth_length_check
    check (char_length(auth) between 8 and 256),
  constraint push_subscriptions_device_label_length_check
    check (device_label is null or char_length(device_label) between 1 and 100),
  constraint push_subscriptions_user_agent_length_check
    check (user_agent is null or char_length(user_agent) between 1 and 1024),
  constraint push_subscriptions_failure_count_check
    check (failure_count >= 0)
);

create unique index if not exists push_subscriptions_endpoint_unique_idx
on public.push_subscriptions (endpoint);

create index if not exists push_subscriptions_user_active_idx
on public.push_subscriptions (user_id, updated_at desc)
where disabled_at is null;

create or replace function public.touch_push_subscription_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_push_subscription_updated_at_trigger
on public.push_subscriptions;

create trigger touch_push_subscription_updated_at_trigger
before update on public.push_subscriptions
for each row execute function public.touch_push_subscription_updated_at();

alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;

drop policy if exists "Users can read own push subscriptions"
on public.push_subscriptions;
create policy "Users can read own push subscriptions"
on public.push_subscriptions
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can insert own push subscriptions"
on public.push_subscriptions;
create policy "Users can insert own push subscriptions"
on public.push_subscriptions
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and last_success_at is null
  and failure_count = 0
  and disabled_at is null
);

drop policy if exists "Users can update own push subscriptions"
on public.push_subscriptions;
create policy "Users can update own push subscriptions"
on public.push_subscriptions
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete own push subscriptions"
on public.push_subscriptions;
create policy "Users can delete own push subscriptions"
on public.push_subscriptions
for delete
to authenticated
using (user_id = (select auth.uid()));

-- Anonymous visitors receive no privileges. Signed-in browser clients receive
-- only the operations/columns required by the Stage 8 device opt-in flow.
-- Delivery-health columns remain writable only by trusted server-side roles.
revoke all on table public.push_subscriptions from anon, authenticated;
grant select, delete on table public.push_subscriptions to authenticated;
grant insert (user_id, endpoint, p256dh, auth, device_label, user_agent)
on table public.push_subscriptions to authenticated;
grant update (p256dh, auth, device_label, user_agent)
on table public.push_subscriptions to authenticated;

revoke all on function public.touch_push_subscription_updated_at() from public;

-- PWA Stage 9: durable per-user rate limiting for test notifications.
create table if not exists public.push_test_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_test_rate_limits enable row level security;
alter table public.push_test_rate_limits force row level security;

revoke all on table public.push_test_rate_limits from anon, authenticated;

create or replace function public.claim_push_test_rate_limit(
  p_user_id uuid,
  p_cooldown_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_claimed boolean := false;
  v_cooldown integer := greatest(30, least(coalesce(p_cooldown_seconds, 60), 3600));
begin
  if p_user_id is null then
    return false;
  end if;

  insert into public.push_test_rate_limits as limits (
    user_id,
    last_requested_at,
    updated_at
  )
  values (
    p_user_id,
    now(),
    now()
  )
  on conflict (user_id) do update
  set
    last_requested_at = excluded.last_requested_at,
    updated_at = excluded.updated_at
  where limits.last_requested_at <= now() - make_interval(secs => v_cooldown)
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

revoke all on function public.claim_push_test_rate_limit(uuid, integer)
from public, anon, authenticated;
grant execute on function public.claim_push_test_rate_limit(uuid, integer)
to service_role;

-- PWA Stage 11: idempotent payment-reminder outbox and atomic claiming.
-- This migration creates queue rows and in-app bell notifications. It does not
-- create Cron, invoke an Edge Function, or send an operating-system push.

alter table public.workspace_settings
  add column if not exists reminder_delivery_time time not null default time '09:00';

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.budget_workspaces(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  notification_type text not null,
  scheduled_for timestamptz not null,
  title text not null,
  body text not null,
  target_url text not null,
  idempotency_key text not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null,
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_outbox_source_type_check
    check (source_type ~ '^[a-z][a-z0-9_]{0,63}$'),
  constraint notification_outbox_notification_type_check
    check (notification_type ~ '^[a-z][a-z0-9_]{0,63}$'),
  constraint notification_outbox_title_length_check
    check (char_length(title) between 1 and 80),
  constraint notification_outbox_body_length_check
    check (char_length(body) between 1 and 240),
  constraint notification_outbox_target_url_check
    check (
      char_length(target_url) between 1 and 500
      and target_url ~ '^/app[.]html[?]source=push&payment_item=[0-9a-fA-F-]{36}#family/payments$'
    ),
  constraint notification_outbox_idempotency_key_length_check
    check (char_length(idempotency_key) between 1 and 300),
  constraint notification_outbox_status_check
    check (status in ('pending', 'processing', 'sent', 'retry', 'failed', 'cancelled')),
  constraint notification_outbox_attempt_count_check
    check (attempt_count between 0 and 3),
  constraint notification_outbox_last_error_length_check
    check (last_error is null or char_length(last_error) <= 500),
  constraint notification_outbox_processing_claim_check
    check (status <> 'processing' or claimed_at is not null),
  constraint notification_outbox_sent_timestamp_check
    check (status <> 'sent' or sent_at is not null)
);

create unique index if not exists notification_outbox_idempotency_key_unique_idx
on public.notification_outbox (idempotency_key);

create index if not exists notification_outbox_claim_idx
on public.notification_outbox (status, next_attempt_at, scheduled_for, created_at)
where status in ('pending', 'retry');

create index if not exists notification_outbox_user_created_idx
on public.notification_outbox (user_id, created_at desc);

create index if not exists notification_outbox_source_idx
on public.notification_outbox (source_type, source_id, created_at desc);

create or replace function public.touch_notification_outbox_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_notification_outbox_updated_at_trigger
on public.notification_outbox;

create trigger touch_notification_outbox_updated_at_trigger
before update on public.notification_outbox
for each row execute function public.touch_notification_outbox_updated_at();

alter table public.notification_outbox enable row level security;
alter table public.notification_outbox force row level security;

-- Browser clients never read or mutate the delivery queue. The bell copy is
-- available through the established notifications table and its existing RLS.
revoke all on table public.notification_outbox from anon, authenticated;
grant select, insert, update, delete on table public.notification_outbox to service_role;

create or replace function public.enqueue_due_payment_reminders(
  p_reference_time timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate record;
  v_outbox_id uuid;
  v_enqueued integer := 0;
begin
  for v_candidate in
    with eligible_items as (
      select
        items.id,
        items.workspace_id,
        items.family_id,
        items.owner_id,
        items.visibility,
        items.responsible_member_id,
        items.name,
        items.amount,
        items.currency,
        items.recurrence_type,
        greatest(items.recurrence_interval, 1) as recurrence_interval,
        items.due_day,
        items.start_date,
        items.end_date,
        items.reminder_days_before,
        workspaces.owner_id as workspace_owner_id,
        settings.timezone as workspace_timezone,
        settings.reminder_delivery_time,
        settings.detailed_notification_previews,
        case
          when items.visibility = 'personal' then items.owner_id
          when items.responsible_member_id is null then workspaces.owner_id
          else responsible_members.user_id
        end as recipient_id
      from public.payment_items as items
      join public.budget_workspaces as workspaces
        on workspaces.id = items.workspace_id
       and workspaces.status = 'active'
      join public.workspace_settings as settings
        on settings.workspace_id = items.workspace_id
       and settings.reminder_enabled
      left join public.family_members as responsible_members
        on responsible_members.id = items.responsible_member_id
       and responsible_members.family_id = items.family_id
       and responsible_members.status = 'active'
      where items.status = 'active'
    ),
    timezone_items as (
      select
        eligible_items.*,
        coalesce(user_timezones.name, workspace_timezones.name, 'UTC') as delivery_timezone
      from eligible_items
      left join public.profiles as recipient_profiles
        on recipient_profiles.id = eligible_items.recipient_id
      left join pg_catalog.pg_timezone_names as user_timezones
        on user_timezones.name = recipient_profiles.timezone
      left join pg_catalog.pg_timezone_names as workspace_timezones
        on workspace_timezones.name = eligible_items.workspace_timezone
      where eligible_items.recipient_id is not null
        and exists (
          select 1
          from public.workspace_members
          where workspace_members.workspace_id = eligible_items.workspace_id
            and workspace_members.user_id = eligible_items.recipient_id
            and workspace_members.status = 'active'
        )
    ),
    recipient_items as (
      select
        timezone_items.*,
        timezone(timezone_items.delivery_timezone, p_reference_time)::date as local_date
      from timezone_items
    ),
    possible_due_dates as (
      select
        recipient_items.*,
        due_days.due_date::date,
        case
          when recipient_items.recurrence_type = 'custom_days'
            then due_days.due_date::date
          else date_trunc('month', due_days.due_date)::date
        end as period_start,
        (due_days.due_date::date - recipient_items.local_date) as days_until_due
      from recipient_items
      cross join lateral generate_series(
        recipient_items.local_date,
        recipient_items.local_date + recipient_items.reminder_days_before,
        interval '1 day'
      ) as due_days(due_date)
      where due_days.due_date::date >= recipient_items.start_date
        and (recipient_items.end_date is null or due_days.due_date::date <= recipient_items.end_date)
        and (
          (
            recipient_items.recurrence_type = 'custom_days'
            and mod(
              due_days.due_date::date - recipient_items.start_date,
              recipient_items.recurrence_interval
            ) = 0
          )
          or
          (
            recipient_items.recurrence_type <> 'custom_days'
            and due_days.due_date::date = (
              date_trunc('month', due_days.due_date)::date
              + least(
                  recipient_items.due_day,
                  extract(day from (
                    date_trunc('month', due_days.due_date)
                    + interval '1 month - 1 day'
                  ))::integer
                ) - 1
            )
            and (
              extract(year from due_days.due_date)::integer * 12
              + extract(month from due_days.due_date)::integer
              - extract(year from recipient_items.start_date)::integer * 12
              - extract(month from recipient_items.start_date)::integer
            ) >= 0
            and mod(
              extract(year from due_days.due_date)::integer * 12
              + extract(month from due_days.due_date)::integer
              - extract(year from recipient_items.start_date)::integer * 12
              - extract(month from recipient_items.start_date)::integer,
              case recipient_items.recurrence_type
                when 'once' then 2147483647
                when 'monthly' then 1
                when 'quarterly' then 3
                when 'yearly' then 12
                when 'custom' then recipient_items.recurrence_interval
              end
            ) = 0
            and (
              recipient_items.recurrence_type <> 'once'
              or date_trunc('month', due_days.due_date)::date =
                 date_trunc('month', recipient_items.start_date)::date
            )
          )
        )
    ),
    unpaid_occurrences as (
      select possible_due_dates.*
      from possible_due_dates
      where coalesce((
        select sum(records.amount)
        from public.payment_records as records
        where records.payment_item_id = possible_due_dates.id
          and records.period_start = possible_due_dates.period_start
      ), 0) < possible_due_dates.amount
    )
    select
      unpaid_occurrences.*,
      make_timestamptz(
        extract(year from unpaid_occurrences.local_date)::integer,
        extract(month from unpaid_occurrences.local_date)::integer,
        extract(day from unpaid_occurrences.local_date)::integer,
        extract(hour from unpaid_occurrences.reminder_delivery_time)::integer,
        extract(minute from unpaid_occurrences.reminder_delivery_time)::integer,
        extract(second from unpaid_occurrences.reminder_delivery_time)::double precision,
        unpaid_occurrences.delivery_timezone
      ) as delivery_at,
      case unpaid_occurrences.days_until_due
        when 0 then 'payment_due_today'
        when 1 then 'payment_due_tomorrow'
        else 'payment_due_soon'
      end as reminder_type,
      case
        when unpaid_occurrences.detailed_notification_previews then 'Payment reminder'
        else 'Mushavo Budget'
      end as reminder_title,
      case
        when not unpaid_occurrences.detailed_notification_previews
          then case unpaid_occurrences.days_until_due
            when 0 then 'You have a payment due today.'
            when 1 then 'You have a payment due tomorrow.'
            else 'You have a payment due soon.'
          end
        else left(
          unpaid_occurrences.name || ' - ' || unpaid_occurrences.currency || ' '
          || trim(to_char(unpaid_occurrences.amount, 'FM999999999999990.00')) || ' is due '
          || case unpaid_occurrences.days_until_due
            when 0 then 'today.'
            when 1 then 'tomorrow.'
            else 'in ' || unpaid_occurrences.days_until_due || ' days.'
          end,
          240
        )
      end as reminder_body,
      '/app.html?source=push&payment_item=' || unpaid_occurrences.id || '#family/payments'
        as payment_target_url,
      'payment:' || unpaid_occurrences.id
        || ':due-date:' || unpaid_occurrences.due_date
        || ':reminder-date:' || unpaid_occurrences.local_date
        as reminder_idempotency_key
    from unpaid_occurrences
    order by delivery_at, id
  loop
    v_outbox_id := null;

    insert into public.notification_outbox (
      user_id,
      workspace_id,
      source_type,
      source_id,
      notification_type,
      scheduled_for,
      title,
      body,
      target_url,
      idempotency_key,
      status,
      attempt_count,
      next_attempt_at
    ) values (
      v_candidate.recipient_id,
      v_candidate.workspace_id,
      'payment',
      v_candidate.id,
      v_candidate.reminder_type,
      v_candidate.delivery_at,
      v_candidate.reminder_title,
      v_candidate.reminder_body,
      v_candidate.payment_target_url,
      v_candidate.reminder_idempotency_key,
      'pending',
      0,
      v_candidate.delivery_at
    )
    on conflict (idempotency_key) do nothing
    returning id into v_outbox_id;

    if v_outbox_id is not null then
      insert into public.notifications (
        user_id,
        created_by,
        family_id,
        type,
        title,
        body,
        url
      ) values (
        v_candidate.recipient_id,
        null,
        v_candidate.family_id,
        v_candidate.reminder_type,
        v_candidate.reminder_title,
        v_candidate.reminder_body,
        v_candidate.payment_target_url
      );
      v_enqueued := v_enqueued + 1;
    end if;
  end loop;

  return v_enqueued;
end;
$$;

create or replace function public.claim_notification_outbox(
  p_batch_size integer default 25,
  p_reference_time timestamptz default now()
)
returns setof public.notification_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Release abandoned claims after 15 minutes so a terminated dispatcher does
  -- not leave jobs permanently stuck. A third abandoned attempt fails closed.
  update public.notification_outbox
  set
    status = case when attempt_count >= 3 then 'failed' else 'retry' end,
    next_attempt_at = case when attempt_count >= 3 then next_attempt_at else p_reference_time end,
    claimed_at = case when attempt_count >= 3 then claimed_at else null end,
    last_error = 'Dispatcher claim expired before completion.'
  where status = 'processing'
    and claimed_at <= p_reference_time - interval '15 minutes';

  return query
  with candidates as (
    select outbox.id
    from public.notification_outbox as outbox
    where outbox.status in ('pending', 'retry')
      and outbox.attempt_count < 3
      and outbox.scheduled_for <= p_reference_time
      and outbox.next_attempt_at <= p_reference_time
    order by outbox.scheduled_for, outbox.created_at, outbox.id
    for update skip locked
    limit greatest(1, least(coalesce(p_batch_size, 25), 100))
  )
  update public.notification_outbox as outbox
  set
    status = 'processing',
    attempt_count = outbox.attempt_count + 1,
    claimed_at = p_reference_time,
    last_error = null
  from candidates
  where outbox.id = candidates.id
  returning outbox.*;
end;
$$;

create or replace function public.record_notification_outbox_result(
  p_outbox_id uuid,
  p_succeeded boolean,
  p_permanent_failure boolean default false,
  p_error text default null,
  p_reference_time timestamptz default now()
)
returns public.notification_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result public.notification_outbox%rowtype;
begin
  update public.notification_outbox as outbox
  set
    status = case
      when p_succeeded then 'sent'
      when p_permanent_failure or outbox.attempt_count >= 3 then 'failed'
      else 'retry'
    end,
    next_attempt_at = case
      when p_succeeded or p_permanent_failure or outbox.attempt_count >= 3 then outbox.next_attempt_at
      when outbox.attempt_count = 1 then p_reference_time + interval '5 minutes'
      else p_reference_time + interval '30 minutes'
    end,
    claimed_at = case
      when p_succeeded or p_permanent_failure or outbox.attempt_count >= 3 then outbox.claimed_at
      else null
    end,
    sent_at = case when p_succeeded then p_reference_time else null end,
    last_error = case
      when p_succeeded then null
      else left(regexp_replace(coalesce(nullif(btrim(p_error), ''), 'Push delivery failed.'), E'[\\r\\n\\t]+', ' ', 'g'), 500)
    end
  where outbox.id = p_outbox_id
    and outbox.status = 'processing'
  returning outbox.* into v_result;

  return v_result;
end;
$$;

revoke all on function public.touch_notification_outbox_updated_at()
from public, anon, authenticated;
revoke all on function public.enqueue_due_payment_reminders(timestamptz)
from public, anon, authenticated;
revoke all on function public.claim_notification_outbox(integer, timestamptz)
from public, anon, authenticated;
revoke all on function public.record_notification_outbox_result(uuid, boolean, boolean, text, timestamptz)
from public, anon, authenticated;

grant execute on function public.enqueue_due_payment_reminders(timestamptz)
to service_role;
grant execute on function public.claim_notification_outbox(integer, timestamptz)
to service_role;
grant execute on function public.record_notification_outbox_result(uuid, boolean, boolean, text, timestamptz)
to service_role;
