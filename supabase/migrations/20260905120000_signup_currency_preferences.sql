-- Initialize each new personal workspace from the currencies selected at signup.
-- Safe to rerun. Existing workspace settings are never overwritten.

alter table public.workspace_settings
  drop constraint if exists workspace_settings_currency_codes_check,
  add constraint workspace_settings_currency_codes_check check (
    default_payment_currency ~ '^[A-Z]{3}$'
    and reporting_currency ~ '^[A-Z]{3}$'
    and cardinality(enabled_currencies) between 1 and 160
    and default_payment_currency = any(enabled_currencies)
    and reporting_currency = any(enabled_currencies)
  );

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

  if v_default_currency is null then
    raise exception 'NO_SUPPORTED_CURRENCIES_AVAILABLE';
  end if;
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

revoke all on function public.get_public_signup_currencies() from public;
grant execute on function public.get_public_signup_currencies() to anon, authenticated;
revoke all on function public.provision_budget_user(uuid) from public;
grant execute on function public.save_workspace_currency_settings(uuid, text, text[], text, boolean) to authenticated;
