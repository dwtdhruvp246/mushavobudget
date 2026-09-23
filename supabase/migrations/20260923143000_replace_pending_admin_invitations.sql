-- Replace an unfinished invitation without deleting its Auth identity; allow an
-- email-verified invitee to choose ordinary Free signup instead.
begin;

alter table public.admin_user_invitations
  drop constraint if exists admin_user_invitations_auth_user_id_key;
create unique index if not exists admin_user_invitations_active_auth_user_idx
  on public.admin_user_invitations(auth_user_id)
  where auth_user_id is not null and status in ('pending_delivery', 'sent');

create or replace function public.reserve_admin_user_invitation(
  p_actor_id uuid,
  p_email text,
  p_full_name text,
  p_country_code text,
  p_plan_id uuid,
  p_workspace_name text,
  p_billing_period text,
  p_subscription_currency text,
  p_entitlement_start_date date,
  p_paid_through_date date,
  p_enabled_currencies text[],
  p_default_currency text,
  p_family_limit integer,
  p_can_add_members boolean,
  p_payment_received boolean,
  p_payment_amount numeric,
  p_payment_currency text,
  p_payment_date date,
  p_payment_method text,
  p_payment_reference text,
  p_payment_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan public.plans%rowtype;
  v_invitation_id uuid;
  v_email text := lower(btrim(p_email));
  v_country_code text := upper(nullif(btrim(p_country_code), ''));
  v_subscription_currency text := upper(btrim(p_subscription_currency));
  v_payment_currency text := upper(nullif(btrim(p_payment_currency), ''));
  v_default_currency text := upper(nullif(btrim(p_default_currency), ''));
  v_enabled_currencies text[] := array[]::text[];
  v_existing_user_id uuid;
  v_previous_invitation_id uuid;
begin
  if not exists (
    select 1 from public.app_admins
    where user_id = p_actor_id and role in ('super_admin', 'admin_staff')
  ) then
    raise exception 'ADMIN_USER_INVITATION_ACCESS_REQUIRED';
  end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'INVALID_INVITATION_EMAIL';
  end if;
  if nullif(btrim(p_full_name), '') is null or char_length(btrim(p_full_name)) > 120 then
    raise exception 'INVALID_INVITATION_NAME';
  end if;
  if v_country_code is not null and v_country_code !~ '^[A-Z]{2}$' then
    raise exception 'INVALID_COUNTRY_CODE';
  end if;
  if p_billing_period not in ('monthly', 'annual') then raise exception 'INVALID_BILLING_PERIOD'; end if;
  if nullif(btrim(p_workspace_name), '') is null or char_length(btrim(p_workspace_name)) > 100 then
    raise exception 'INVALID_WORKSPACE_NAME';
  end if;
  if p_family_limit is null or p_family_limit < 0 or p_family_limit > 100 then
    raise exception 'INVALID_FAMILY_LIMIT';
  end if;

  select * into v_plan from public.plans
  where id = p_plan_id and is_active;
  if v_plan.id is null then raise exception 'PLAN_NOT_AVAILABLE'; end if;
  if v_plan.code = 'free' and coalesce(p_payment_received, false) then
    raise exception 'FREE_PLAN_REQUIRES_NO_PAYMENT';
  end if;

  if not exists (
    select 1 from public.supported_currencies
    where code = v_subscription_currency and is_active
  ) then
    raise exception 'UNSUPPORTED_CURRENCY';
  end if;
  if not exists (
    select 1 from public.plan_prices
    where plan_id = v_plan.id
      and billing_period = p_billing_period
      and currency = v_subscription_currency
      and is_active
      and effective_from <= now()
      and (effective_until is null or effective_until > now())
  ) then
    raise exception 'PLAN_PRICE_NOT_CONFIGURED';
  end if;

  select coalesce(array_agg(distinct requested.code order by requested.code), array[]::text[])
  into v_enabled_currencies
  from (
    select upper(btrim(value)) as code
    from unnest(coalesce(p_enabled_currencies, array[]::text[])) as values_list(value)
  ) as requested
  join public.supported_currencies as currencies
    on currencies.code = requested.code and currencies.is_active;

  if cardinality(v_enabled_currencies) <> cardinality(coalesce(p_enabled_currencies, array[]::text[])) then
    raise exception 'INVALID_ENABLED_CURRENCIES';
  end if;
  if cardinality(v_enabled_currencies) > 20 then raise exception 'TOO_MANY_ENABLED_CURRENCIES'; end if;
  if cardinality(v_enabled_currencies) = 0 and v_default_currency is not null then
    raise exception 'DEFAULT_CURRENCY_MUST_BE_ENABLED';
  end if;
  if cardinality(v_enabled_currencies) > 0
     and (v_default_currency is null or not (v_default_currency = any(v_enabled_currencies)))
  then
    raise exception 'DEFAULT_CURRENCY_MUST_BE_ENABLED';
  end if;
  if v_plan.code <> 'free' and p_paid_through_date is null then
    raise exception 'SUBSCRIPTION_EXPIRY_REQUIRED';
  end if;
  if p_paid_through_date is not null
     and p_paid_through_date < coalesce(p_entitlement_start_date, current_date)
  then
    raise exception 'INVALID_SUBSCRIPTION_DATE_RANGE';
  end if;
  if coalesce(p_payment_received, false) then
    if p_payment_amount is null or p_payment_amount <= 0
       or v_payment_currency is null
       or p_payment_date is null
       or nullif(btrim(p_payment_method), '') is null
    then
      raise exception 'INCOMPLETE_INVITATION_PAYMENT';
    end if;
    if not exists (
      select 1 from public.supported_currencies
      where code = v_payment_currency and is_active
    ) then
      raise exception 'UNSUPPORTED_CURRENCY';
    end if;
  end if;
  -- Serialize replacements for the same email before changing the active row.
  perform pg_advisory_xact_lock(hashtextextended(v_email, 0));
  select profiles.id, profiles.admin_invitation_id
  into v_existing_user_id, v_previous_invitation_id
  from public.profiles as profiles
  join auth.users as users on users.id = profiles.id and lower(users.email) = v_email
  where lower(profiles.email) = v_email
  order by profiles.id
  limit 1;
  -- Completion locks the invitation row first. Wait for that row before
  -- deciding whether this identity is still unfinished.
  if v_previous_invitation_id is not null then
    perform 1 from public.admin_user_invitations
    where id = v_previous_invitation_id for update;
    select profiles.id, profiles.admin_invitation_id
    into v_existing_user_id, v_previous_invitation_id
    from public.profiles as profiles
    join auth.users as users on users.id = profiles.id and lower(users.email) = v_email
    where lower(profiles.email) = v_email
    order by profiles.id
    limit 1;
  end if;

  if v_existing_user_id is not null and (
    not exists (
      select 1 from public.admin_user_invitations as previous
      where previous.id = v_previous_invitation_id
        and previous.auth_user_id = v_existing_user_id
        and previous.status <> 'provisioned'
    )
    or not exists (
      select 1 from public.profiles as profiles
      where profiles.id = v_existing_user_id and profiles.signup_source = 'admin_invitation'
    )
    or exists (
      select 1 from public.budget_workspaces as workspaces
      where workspaces.owner_id = v_existing_user_id
    )
  ) then
    raise exception 'USER_ALREADY_REGISTERED';
  end if;
  if exists (
    select 1 from public.admin_user_invitations
    where lower(email) = v_email and status = 'pending_delivery'
  ) then
    raise exception 'ADMIN_INVITATION_DELIVERY_IN_PROGRESS';
  end if;
  with replaced as (
    update public.admin_user_invitations
    set status = 'cancelled', cancelled_at = now()
    where lower(email) = v_email and status = 'sent'
    returning id
  )
  insert into public.admin_user_invitation_audit (invitation_id, actor_id, action, safe_details)
  select id, p_actor_id, 'cancelled', jsonb_build_object('reason', 'replaced')
  from replaced;
  if (
    select count(*) from public.admin_user_invitations
    where invited_by = p_actor_id and created_at >= now() - interval '1 hour'
  ) >= 20 then
    raise exception 'ADMIN_INVITATION_RATE_LIMITED';
  end if;

  insert into public.admin_user_invitations (
    email, full_name, country_code, plan_id, plan_code, plan_name,
    workspace_type, workspace_name, billing_period, subscription_currency,
    entitlement_start_date, paid_through_date, enabled_currencies, default_currency,
    family_limit, can_add_members, payment_received, payment_amount,
    payment_currency, payment_date, payment_method, payment_reference,
    payment_notes, invited_by, auth_user_id
  ) values (
    v_email, btrim(p_full_name), v_country_code, v_plan.id, v_plan.code, v_plan.display_name,
    v_plan.workspace_type, btrim(p_workspace_name), p_billing_period, v_subscription_currency,
    coalesce(p_entitlement_start_date, current_date), p_paid_through_date,
    v_enabled_currencies, v_default_currency, p_family_limit, coalesce(p_can_add_members, false),
    coalesce(p_payment_received, false),
    case when p_payment_received then p_payment_amount else null end,
    case when p_payment_received then v_payment_currency else null end,
    case when p_payment_received then p_payment_date else null end,
    case when p_payment_received then nullif(btrim(p_payment_method), '') else null end,
    case when p_payment_received then nullif(btrim(p_payment_reference), '') else null end,
    case when p_payment_received then nullif(btrim(p_payment_notes), '') else null end,
    p_actor_id, v_existing_user_id
  ) returning id into v_invitation_id;

  if v_existing_user_id is not null then
    update public.profiles
    set admin_invitation_id = v_invitation_id, updated_at = now()
    where id = v_existing_user_id;
  end if;

  insert into public.admin_user_invitation_audit (invitation_id, actor_id, action, safe_details)
  values (
    v_invitation_id, p_actor_id, 'created',
    jsonb_build_object(
      'plan_code', v_plan.code,
      'workspace_type', v_plan.workspace_type,
      'billing_period', p_billing_period,
      'payment_received', coalesce(p_payment_received, false),
      'replaced_previous', v_existing_user_id is not null
    )
  );
  return v_invitation_id;
end;
$$;

create or replace function public.has_my_unfinished_admin_invitation()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles as profiles
    join auth.users as users on users.id = profiles.id
    join public.admin_user_invitations as invitations
      on invitations.id = profiles.admin_invitation_id
    where profiles.id = auth.uid()
      and profiles.signup_source = 'admin_invitation'
      and invitations.auth_user_id = profiles.id
      and invitations.status = 'sent'
      and lower(invitations.email) = lower(users.email)
      and not exists (
        select 1 from public.budget_workspaces as workspaces
        where workspaces.owner_id = profiles.id
      )
  );
$$;

-- Only the authenticated owner of a still-unfinished invitation may choose
-- ordinary signup. Cancelling and provisioning happen in one transaction.
create or replace function public.complete_self_signup_from_admin_invitation(
  p_full_name text,
  p_enabled_currencies text[],
  p_default_currency text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_invitation_id uuid;
  v_enabled_currencies text[];
  v_default_currency text := upper(nullif(btrim(p_default_currency), ''));
  v_workspace_id uuid;
begin
  if v_user_id is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if nullif(btrim(p_full_name), '') is null or char_length(btrim(p_full_name)) > 120 then
    raise exception 'INVALID_SIGNUP_NAME';
  end if;

  select lower(users.email) into v_email from auth.users as users where users.id = v_user_id;
  if v_email is null then raise exception 'AUTHENTICATED_USER_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_email, 0));

  select profiles.admin_invitation_id into v_invitation_id
  from public.profiles as profiles
  where profiles.id = v_user_id
    and lower(profiles.email) = v_email
    and profiles.signup_source = 'admin_invitation';
  if v_invitation_id is not null then
    perform 1 from public.admin_user_invitations
    where id = v_invitation_id for update;
  end if;
  select profiles.admin_invitation_id into v_invitation_id
  from public.profiles as profiles
  where profiles.id = v_user_id
    and lower(profiles.email) = v_email
    and profiles.signup_source = 'admin_invitation'
  for update;
  if v_invitation_id is null or not exists (
    select 1 from public.admin_user_invitations as invitations
    where invitations.id = v_invitation_id
      and invitations.auth_user_id = v_user_id
      and lower(invitations.email) = v_email
      and invitations.status = 'sent'
  ) then
    raise exception 'ADMIN_INVITATION_NOT_AVAILABLE';
  end if;
  if exists (
    select 1 from public.budget_workspaces as workspaces
    where workspaces.owner_id = v_user_id
  ) then
    raise exception 'USER_ALREADY_REGISTERED';
  end if;
  if cardinality(coalesce(p_enabled_currencies, array[]::text[])) < 1
     or cardinality(p_enabled_currencies) > 20 then
    raise exception 'INVALID_ENABLED_CURRENCIES';
  end if;
  select coalesce(array_agg(currencies.code order by currencies.code), array[]::text[])
  into v_enabled_currencies
  from (select distinct upper(btrim(item)) as code from unnest(p_enabled_currencies) as item) as requested
  join public.supported_currencies as currencies on currencies.code = requested.code and currencies.is_active;
  if cardinality(v_enabled_currencies) <> cardinality(p_enabled_currencies)
     or v_default_currency is null or not (v_default_currency = any(v_enabled_currencies)) then
    raise exception 'INVALID_ENABLED_CURRENCIES';
  end if;

  update public.admin_user_invitations
  set status = 'cancelled', cancelled_at = now()
  where id = v_invitation_id and status = 'sent';
  insert into public.admin_user_invitation_audit (invitation_id, actor_id, action, safe_details)
  values (v_invitation_id, v_user_id, 'cancelled', '{"reason":"self_signup"}'::jsonb);

  update public.profiles
  set full_name = btrim(p_full_name), signup_source = 'self_signup',
      admin_invitation_id = null, last_active_at = now(), updated_at = now()
  where id = v_user_id;

  v_workspace_id := public.provision_budget_user(v_user_id);
  update public.workspace_settings
  set base_currency = v_default_currency, default_payment_currency = v_default_currency,
      reporting_currency = v_default_currency, enabled_currencies = v_enabled_currencies,
      updated_at = now()
  where workspace_id = v_workspace_id;
  return v_workspace_id;
end;
$$;

revoke all on function public.complete_self_signup_from_admin_invitation(text, text[], text)
from public, anon, authenticated;
grant execute on function public.complete_self_signup_from_admin_invitation(text, text[], text)
to authenticated;
revoke all on function public.has_my_unfinished_admin_invitation() from public, anon, authenticated;
grant execute on function public.has_my_unfinished_admin_invitation() to authenticated;

notify pgrst, 'reload schema';
commit;
