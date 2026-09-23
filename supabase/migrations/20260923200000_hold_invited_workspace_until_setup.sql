-- Pending invitations cannot create a workspace through any Free provisioning path.
-- This remains true while an invitation is being replaced, cancelled, or expired.
begin;

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
  -- An invitee has an Auth identity before completing setup. Never create a
  -- Free workspace for that identity, including while a replacement email is
  -- pending or after a failed/expired invitation. The explicit self-signup
  -- completion RPC changes the profile only after cancelling the invitation.
  if exists (
    select 1 from public.admin_user_invitations as invitations
    where invitations.auth_user_id = p_user_id
      and invitations.status in ('pending_delivery', 'sent')
  ) or exists (
    select 1 from public.profiles as profiles
    where profiles.id = p_user_id
      and profiles.signup_source = 'admin_invitation'
      and not exists (
        select 1 from public.admin_user_invitations as invitations
        where invitations.id = profiles.admin_invitation_id
          and invitations.auth_user_id = p_user_id
          and invitations.status = 'provisioned'
          and invitations.provisioned_workspace_id is not null
      )
  ) then
    raise exception 'ADMIN_INVITATION_SETUP_REQUIRED';
  end if;

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

create or replace function public.provision_my_budget_workspace()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if exists (
    select 1 from public.admin_user_invitations as invitations
    where invitations.auth_user_id = v_user_id
      and invitations.status in ('pending_delivery', 'sent')
  ) or exists (
    select 1 from public.profiles as profiles
    where profiles.id = v_user_id
      and profiles.signup_source = 'admin_invitation'
      and not exists (
        select 1 from public.admin_user_invitations as invitations
        where invitations.id = profiles.admin_invitation_id
          and invitations.auth_user_id = v_user_id
          and invitations.status = 'provisioned'
          and invitations.provisioned_workspace_id is not null
      )
  ) then
    raise exception 'ADMIN_INVITATION_SETUP_REQUIRED';
  end if;
  return public.provision_budget_user(v_user_id);
end;
$$;

revoke all on function public.provision_budget_user(uuid) from public, anon, authenticated;

commit;
