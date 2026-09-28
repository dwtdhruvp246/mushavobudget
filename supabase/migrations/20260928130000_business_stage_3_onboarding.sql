-- Business Stage 3: owner-led setup and a first, non-financial draft.
begin;

create table if not exists public.business_setup_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.budget_workspaces(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense', 'bill')),
  description text not null check (char_length(btrim(description)) between 2 and 240),
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null references public.supported_currencies(code),
  record_date date not null,
  due_date date,
  category_id uuid not null,
  dimension_id uuid,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_setup_draft_category_fk
    foreign key (workspace_id, category_id)
    references public.business_categories(workspace_id, id) on delete restrict,
  constraint business_setup_draft_dimension_fk
    foreign key (workspace_id, dimension_id)
    references public.business_dimensions(workspace_id, id) on delete restrict,
  constraint business_setup_draft_due_date_check
    check ((kind = 'bill' and due_date is not null)
      or (kind <> 'bill' and due_date is null))
);

alter table public.business_setup_drafts enable row level security;
drop policy if exists "Business Owner reads setup drafts" on public.business_setup_drafts;
create policy "Business Owner reads setup drafts"
on public.business_setup_drafts for select to authenticated
using (
  public.is_business_workspace_member(workspace_id)
  and exists (select 1 from public.budget_workspaces
    where id = business_setup_drafts.workspace_id and owner_id = auth.uid())
  and exists (select 1 from public.workspace_subscriptions
    where workspace_id = business_setup_drafts.workspace_id
      and status = 'active' and paid_through_at > now())
);
revoke all on public.business_setup_drafts from public, anon, authenticated;
grant select on public.business_setup_drafts to authenticated;

drop trigger if exists require_business_workspace_row_trigger on public.business_setup_drafts;
create trigger require_business_workspace_row_trigger
before insert or update of workspace_id on public.business_setup_drafts
for each row execute function public.require_business_workspace_row();

-- The older shared currency RPC grants broader Business roles permission to
-- change settings. Business writes now use the owner-checked setup transaction.
drop policy if exists "Business settings updates require active membership"
on public.workspace_settings;
create policy "Business settings updates require protected RPC"
on public.workspace_settings as restrictive for update to authenticated
using (not exists (select 1 from public.budget_workspaces
  where id = workspace_settings.workspace_id and workspace_type = 'business'))
with check (not exists (select 1 from public.budget_workspaces
  where id = workspace_settings.workspace_id and workspace_type = 'business'));

drop policy if exists "Business workspace updates require protected RPC"
on public.budget_workspaces;
create policy "Business workspace updates require protected RPC"
on public.budget_workspaces as restrictive for update to authenticated
using (workspace_type <> 'business')
with check (workspace_type <> 'business');

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
  if exists (select 1 from public.budget_workspaces
    where id = p_workspace_id and workspace_type = 'business') then
    raise exception 'BUSINESS_SETTINGS_RPC_REQUIRED';
  end if;
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
    left join public.supported_currencies
      on supported_currencies.code = requested.code and supported_currencies.is_active
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

-- Completing setup is an Owner action, not a client-selected profile status.
revoke execute on function public.save_business_profile(
  uuid, text, text, text, text, text, text, text, text, text, jsonb,
  integer, integer, text, integer
) from public, anon, authenticated;

create or replace function public.business_setup_owner_required(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_business_workspace_member(p_workspace_id)
     or not exists (select 1 from public.budget_workspaces
       where id = p_workspace_id and workspace_type = 'business'
         and status = 'active' and owner_id = auth.uid())
     or not exists (
       select 1 from public.workspace_subscriptions as subscriptions
       where subscriptions.workspace_id = p_workspace_id
         and subscriptions.status = 'active'
         and subscriptions.paid_through_at > now()
     ) then
    raise exception 'BUSINESS_ACTIVE_OWNER_REQUIRED';
  end if;
end;
$$;

create or replace function public.save_business_setup(
  p_workspace_id uuid,
  p_trading_name text,
  p_base_currency text,
  p_enabled_currencies text[],
  p_timezone text,
  p_financial_year_start_month integer,
  p_period_start_day integer,
  p_expected_profile_version integer,
  p_expected_settings_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.business_profiles%rowtype;
  v_settings public.workspace_settings%rowtype;
  v_enabled text[];
  v_base text := upper(btrim(coalesce(p_base_currency, '')));
  v_name text := btrim(coalesce(p_trading_name, ''));
begin
  perform public.business_setup_owner_required(p_workspace_id);
  if char_length(v_name) not between 2 and 120
     or p_financial_year_start_month is null or p_financial_year_start_month not between 1 and 12
     or p_period_start_day is null or p_period_start_day not between 1 and 28
     or p_timezone is null
     or not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'INVALID_BUSINESS_SETUP';
  end if;
  select array_agg(distinct upper(btrim(code)) order by upper(btrim(code)))
  into v_enabled from unnest(coalesce(p_enabled_currencies, array[]::text[])) as code;
  if v_enabled is null or cardinality(v_enabled) not between 1 and 160
     or not (v_base = any(v_enabled))
     or exists (
       select 1 from unnest(v_enabled) as requested(code)
       left join public.supported_currencies as currencies
         on currencies.code = requested.code and currencies.is_active
       where currencies.code is null
     ) then
    raise exception 'INVALID_BUSINESS_CURRENCIES';
  end if;
  if exists (select 1 from public.business_setup_drafts
    where workspace_id = p_workspace_id and not (currency = any(v_enabled))) then
    raise exception 'BUSINESS_DRAFT_CURRENCY_IN_USE';
  end if;

  select * into v_profile from public.business_profiles
  where workspace_id = p_workspace_id for update;
  if not found or p_expected_profile_version is distinct from v_profile.version then
    raise exception 'BUSINESS_SETUP_CHANGED';
  end if;
  select * into v_settings from public.workspace_settings
  where workspace_id = p_workspace_id for update;
  if not found or p_expected_settings_updated_at is distinct from v_settings.updated_at then
    raise exception 'BUSINESS_SETUP_CHANGED';
  end if;

  update public.business_profiles
  set trading_name = v_name,
      financial_year_start_month = p_financial_year_start_month,
      period_start_day = p_period_start_day,
      onboarding_status = case when onboarding_status = 'complete' then 'complete' else 'in_progress' end
  where workspace_id = p_workspace_id
  returning * into v_profile;
  update public.budget_workspaces
  set name = v_name, updated_at = now()
  where id = p_workspace_id;
  update public.workspace_settings
  set base_currency = v_base, default_payment_currency = v_base,
      reporting_currency = v_base, enabled_currencies = v_enabled,
      timezone = p_timezone, updated_at = now()
  where workspace_id = p_workspace_id
  returning * into v_settings;

  perform public.business_record_audit_event(
    p_workspace_id, 'business.setup_saved', 'business_profile', p_workspace_id,
    '{}'::jsonb,
    jsonb_build_object('trading_name', v_name, 'base_currency', v_base,
      'timezone', p_timezone, 'period_start_day', p_period_start_day,
      'financial_year_start_month', p_financial_year_start_month)
  );
  return jsonb_build_object('profile', to_jsonb(v_profile), 'settings', to_jsonb(v_settings));
end;
$$;

create or replace function public.save_business_setup_draft(
  p_workspace_id uuid,
  p_kind text,
  p_description text,
  p_amount numeric,
  p_currency text,
  p_record_date date,
  p_due_date date,
  p_category_id uuid,
  p_dimension_id uuid,
  p_expected_version integer
)
returns public.business_setup_drafts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_previous public.business_setup_drafts%rowtype;
  v_result public.business_setup_drafts%rowtype;
  v_currency text := upper(btrim(coalesce(p_currency, '')));
begin
  perform public.business_setup_owner_required(p_workspace_id);
  if p_kind not in ('income', 'expense', 'bill')
     or char_length(btrim(coalesce(p_description, ''))) not between 2 and 240
     or p_amount is null or p_amount <= 0 or p_amount > 999999999999.99
     or p_amount <> round(p_amount, 2)
     or p_record_date is null
     or (p_kind = 'bill' and p_due_date is null)
     or (p_kind <> 'bill' and p_due_date is not null)
     or not exists (select 1 from public.supported_currencies
       where code = v_currency and is_active)
     or not exists (select 1 from public.workspace_settings
       where workspace_id = p_workspace_id and v_currency = any(enabled_currencies))
     or not exists (select 1 from public.business_categories
       where workspace_id = p_workspace_id and id = p_category_id and status = 'active'
         and category_type in (
           case when p_kind = 'income' then 'income' else 'expense' end, 'both'
         ))
     or (p_dimension_id is not null and not exists (
       select 1 from public.business_dimensions
       where workspace_id = p_workspace_id and id = p_dimension_id and status = 'active'
     )) then
    raise exception 'INVALID_BUSINESS_SETUP_DRAFT';
  end if;

  perform 1 from public.budget_workspaces
  where id = p_workspace_id for update;
  select * into v_previous from public.business_setup_drafts
  where workspace_id = p_workspace_id for update;
  if (found and p_expected_version is distinct from v_previous.version)
     or (not found and p_expected_version is not null) then
    raise exception 'BUSINESS_SETUP_DRAFT_CHANGED';
  end if;
  insert into public.business_setup_drafts (
    workspace_id, kind, description, amount, currency, record_date,
    due_date, category_id, dimension_id, created_by
  ) values (
    p_workspace_id, p_kind, btrim(p_description), p_amount, v_currency,
    p_record_date, p_due_date, p_category_id, p_dimension_id, auth.uid()
  )
  on conflict (workspace_id) do update set
    kind = excluded.kind, description = excluded.description,
    amount = excluded.amount, currency = excluded.currency,
    record_date = excluded.record_date, due_date = excluded.due_date,
    category_id = excluded.category_id, dimension_id = excluded.dimension_id,
    version = public.business_setup_drafts.version + 1, updated_at = now()
  returning * into v_result;
  perform public.business_record_audit_event(
    p_workspace_id, 'business.setup_draft_saved', 'business_setup_draft', v_result.id,
    '{}'::jsonb,
    jsonb_build_object('kind', v_result.kind, 'version', v_result.version,
      'status', 'draft', 'included_in_financial_totals', false)
  );
  return v_result;
end;
$$;

create or replace function public.complete_business_onboarding(p_workspace_id uuid)
returns public.business_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.business_profiles%rowtype;
begin
  perform public.business_setup_owner_required(p_workspace_id);
  select * into v_profile from public.business_profiles
  where workspace_id = p_workspace_id for update;
  if not found or v_profile.onboarding_status = 'not_started'
     or char_length(btrim(coalesce(v_profile.trading_name, ''))) < 2
     or not exists (select 1 from public.workspace_settings
       where workspace_id = p_workspace_id and
         base_currency = any(enabled_currencies))
     or not exists (select 1 from public.business_categories
       where workspace_id = p_workspace_id and status = 'active') then
    raise exception 'BUSINESS_SETUP_INCOMPLETE';
  end if;
  if v_profile.onboarding_status <> 'complete' then
    update public.business_profiles set onboarding_status = 'complete'
    where workspace_id = p_workspace_id returning * into v_profile;
    perform public.business_record_audit_event(
      p_workspace_id, 'business.onboarding_completed', 'business_profile',
      p_workspace_id, '{}'::jsonb, '{"status":"complete"}'::jsonb
    );
  end if;
  return v_profile;
end;
$$;

-- Stage 2's permission helper checked membership but did not check expiry.
-- The Owner's renewal route reads the subscription through its own policy.
create or replace function public.business_has_permission(
  p_workspace_id uuid, p_permission_code text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.workspace_members%rowtype;
  v_effect text;
begin
  if auth.uid() is null or public.my_account_suspended() then return false; end if;
  if not exists (select 1 from public.business_permission_definitions
    where permission_code = p_permission_code) then return false; end if;
  if not exists (select 1 from public.budget_workspaces
    where id = p_workspace_id and workspace_type = 'business' and status = 'active') then
    return false;
  end if;
  if not exists (
    select 1 from public.workspace_subscriptions
    where workspace_id = p_workspace_id and status = 'active'
      and paid_through_at > now()
  ) then return false; end if;

  select * into v_member from public.workspace_members
  where workspace_id = p_workspace_id
    and user_id = auth.uid() and status = 'active';
  if not found then return false; end if;
  if exists (select 1 from public.budget_workspaces
    where id = p_workspace_id and owner_id = auth.uid()) then return true; end if;

  select effect into v_effect from public.business_member_permissions
  where workspace_id = p_workspace_id and member_id = v_member.id
    and permission_code = p_permission_code;
  if v_effect = 'deny' then return false; end if;
  if v_effect = 'allow' then return true; end if;
  return exists (select 1 from public.business_role_permissions
    where workspace_id = p_workspace_id and role = v_member.role
      and permission_code = p_permission_code and enabled);
end;
$$;

revoke all on function public.business_setup_owner_required(uuid) from public, anon, authenticated;
revoke all on function public.save_business_setup(uuid, text, text, text[], text, integer, integer, integer, timestamptz)
  from public, anon, authenticated;
revoke all on function public.save_business_setup_draft(uuid, text, text, numeric, text, date, date, uuid, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.complete_business_onboarding(uuid) from public, anon, authenticated;
grant execute on function public.save_business_setup(uuid, text, text, text[], text, integer, integer, integer, timestamptz) to authenticated;
grant execute on function public.save_business_setup_draft(uuid, text, text, numeric, text, date, date, uuid, uuid, integer) to authenticated;
grant execute on function public.complete_business_onboarding(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
