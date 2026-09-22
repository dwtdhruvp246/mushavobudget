-- Admin-created user invitation foundation.
-- Auth users are invited server-side, but workspaces and paid entitlements are
-- deliberately deferred until the invitee completes Stage 5 setup.

begin;

create table if not exists public.admin_user_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 3 and 320 and position('@' in email) > 1),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  plan_id uuid not null references public.plans(id) on delete restrict,
  plan_code text not null check (plan_code ~ '^[a-z][a-z0-9_]*$'),
  plan_name text not null,
  workspace_type text not null check (workspace_type in ('personal', 'household', 'business')),
  workspace_name text not null check (char_length(btrim(workspace_name)) between 1 and 100),
  billing_period text not null check (billing_period in ('monthly', 'annual')),
  subscription_currency text not null check (subscription_currency ~ '^[A-Z]{3}$'),
  entitlement_start_date date not null default current_date,
  paid_through_date date,
  enabled_currencies text[] not null default array[]::text[],
  default_currency text check (default_currency is null or default_currency ~ '^[A-Z]{3}$'),
  family_limit integer not null default 0 check (family_limit between 0 and 100),
  can_add_members boolean not null default false,
  payment_received boolean not null default false,
  payment_amount numeric(12, 2),
  payment_currency text check (payment_currency is null or payment_currency ~ '^[A-Z]{3}$'),
  payment_date date,
  payment_method text,
  payment_reference text,
  payment_notes text,
  status text not null default 'pending_delivery' check (
    status in ('pending_delivery', 'sent', 'failed', 'accepted', 'cancelled', 'expired', 'provisioned')
  ),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  invited_by uuid not null references auth.users(id) on delete restrict,
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  last_error_code text,
  sent_at timestamptz,
  accepted_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_user_invitation_currency_defaults_check check (
    (cardinality(enabled_currencies) = 0 and default_currency is null)
    or default_currency = any(enabled_currencies)
  ),
  constraint admin_user_invitation_paid_plan_expiry_check check (
    plan_code = 'free' or paid_through_date is not null
  ),
  constraint admin_user_invitation_date_order_check check (
    paid_through_date is null or paid_through_date >= entitlement_start_date
  ),
  constraint admin_user_invitation_payment_check check (
    (
      payment_received = false
      and payment_amount is null
      and payment_currency is null
      and payment_date is null
      and payment_method is null
      and payment_reference is null
      and payment_notes is null
    )
    or (
      payment_received = true
      and payment_amount > 0
      and payment_currency is not null
      and payment_date is not null
      and nullif(btrim(payment_method), '') is not null
    )
  )
);

create unique index if not exists admin_user_invitations_active_email_idx
on public.admin_user_invitations(lower(email))
where status in ('pending_delivery', 'sent');

create index if not exists admin_user_invitations_status_created_idx
on public.admin_user_invitations(status, created_at desc);

create index if not exists admin_user_invitations_invited_by_idx
on public.admin_user_invitations(invited_by, created_at desc);

create table if not exists public.admin_user_invitation_audit (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.admin_user_invitations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (
    action in ('created', 'email_sent', 'email_failed', 'accepted', 'cancelled', 'expired', 'provisioned')
  ),
  safe_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_user_invitation_audit_invitation_idx
on public.admin_user_invitation_audit(invitation_id, created_at desc);

alter table public.profiles
  add column if not exists country_code text,
  add column if not exists signup_source text not null default 'self_signup',
  add column if not exists admin_invitation_id uuid references public.admin_user_invitations(id) on delete set null;

alter table public.profiles
  drop constraint if exists profiles_country_code_check,
  add constraint profiles_country_code_check check (
    country_code is null or country_code ~ '^[A-Z]{2}$'
  ),
  drop constraint if exists profiles_signup_source_check,
  add constraint profiles_signup_source_check check (
    signup_source in ('self_signup', 'admin_invitation', 'family_invitation', 'google')
  );

create unique index if not exists profiles_admin_invitation_unique_idx
on public.profiles(admin_invitation_id)
where admin_invitation_id is not null;

create or replace function public.touch_admin_user_invitation_updated_at()
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

drop trigger if exists admin_user_invitations_touch_updated_at
on public.admin_user_invitations;
create trigger admin_user_invitations_touch_updated_at
before update on public.admin_user_invitations
for each row execute function public.touch_admin_user_invitation_updated_at();

-- Invitations create an Auth user so Supabase can deliver its secure invite
-- link. Do not provision that user's Personal workspace until Stage 5 accepts
-- and completes the invitation.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_country_code text;
  v_signup_source text;
  v_admin_invitation_id uuid;
begin
  v_country_code := upper(nullif(btrim(new.raw_user_meta_data ->> 'country_code'), ''));
  if v_country_code !~ '^[A-Z]{2}$' then v_country_code := null; end if;

  v_signup_source := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'signup_source'), ''), 'self_signup');
  if v_signup_source not in ('self_signup', 'admin_invitation', 'family_invitation', 'google') then
    v_signup_source := 'self_signup';
  end if;

  if coalesce(new.raw_user_meta_data ->> 'admin_invitation_id', '')
     ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  then
    v_admin_invitation_id := (new.raw_user_meta_data ->> 'admin_invitation_id')::uuid;
  end if;

  insert into public.profiles (
    id, full_name, email, country_code, signup_source, admin_invitation_id,
    last_active_at, updated_at
  ) values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Mushavo user'
    ),
    lower(new.email),
    v_country_code,
    v_signup_source,
    v_admin_invitation_id,
    case when v_signup_source = 'admin_invitation' then null else now() end,
    now()
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(nullif(btrim(public.profiles.full_name), ''), excluded.full_name),
      country_code = coalesce(public.profiles.country_code, excluded.country_code),
      signup_source = case
        when public.profiles.signup_source = 'self_signup' then excluded.signup_source
        else public.profiles.signup_source
      end,
      admin_invitation_id = coalesce(public.profiles.admin_invitation_id, excluded.admin_invitation_id),
      updated_at = now();

  update public.family_heads
  set user_id = new.id
  where lower(email) = lower(new.email)
    and (user_id is null or user_id = new.id);

  if v_signup_source <> 'admin_invitation' then
    perform public.provision_budget_user(new.id);
  end if;
  return new;
end;
$$;

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
  if exists (select 1 from public.profiles where lower(email) = v_email) then
    raise exception 'USER_ALREADY_REGISTERED';
  end if;
  if exists (
    select 1 from public.admin_user_invitations
    where lower(email) = v_email and status in ('pending_delivery', 'sent')
  ) then
    raise exception 'ADMIN_INVITATION_ALREADY_ACTIVE';
  end if;
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
    payment_notes, invited_by
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
    p_actor_id
  ) returning id into v_invitation_id;

  insert into public.admin_user_invitation_audit (invitation_id, actor_id, action, safe_details)
  values (
    v_invitation_id, p_actor_id, 'created',
    jsonb_build_object(
      'plan_code', v_plan.code,
      'workspace_type', v_plan.workspace_type,
      'billing_period', p_billing_period,
      'payment_received', coalesce(p_payment_received, false)
    )
  );
  return v_invitation_id;
end;
$$;

create or replace function public.record_admin_user_invitation_delivery(
  p_invitation_id uuid,
  p_auth_user_id uuid,
  p_succeeded boolean,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid;
begin
  update public.admin_user_invitations
  set
    status = case when p_succeeded then 'sent' else 'failed' end,
    auth_user_id = case when p_succeeded then p_auth_user_id else auth_user_id end,
    attempt_count = attempt_count + 1,
    last_error_code = case when p_succeeded then null else left(coalesce(p_error_code, 'INVITATION_EMAIL_SEND_FAILED'), 100) end,
    sent_at = case when p_succeeded then now() else sent_at end
  where id = p_invitation_id
    and status = 'pending_delivery'
  returning invited_by into v_actor_id;

  if v_actor_id is null then raise exception 'ADMIN_INVITATION_NOT_PENDING'; end if;
  insert into public.admin_user_invitation_audit (invitation_id, actor_id, action, safe_details)
  values (
    p_invitation_id,
    v_actor_id,
    case when p_succeeded then 'email_sent' else 'email_failed' end,
    case when p_succeeded
      then jsonb_build_object('auth_user_linked', p_auth_user_id is not null)
      else jsonb_build_object('error_code', left(coalesce(p_error_code, 'INVITATION_EMAIL_SEND_FAILED'), 100))
    end
  );
end;
$$;

alter table public.admin_user_invitations enable row level security;
alter table public.admin_user_invitations force row level security;
alter table public.admin_user_invitation_audit enable row level security;
alter table public.admin_user_invitation_audit force row level security;

drop policy if exists "Authorized admins can read user invitations"
on public.admin_user_invitations;
create policy "Authorized admins can read user invitations"
on public.admin_user_invitations for select
to authenticated
using (public.is_platform_staff(array['super_admin', 'admin_staff']));

drop policy if exists "Authorized admins can read user invitation audit"
on public.admin_user_invitation_audit;
create policy "Authorized admins can read user invitation audit"
on public.admin_user_invitation_audit for select
to authenticated
using (public.is_platform_staff(array['super_admin', 'admin_staff']));

revoke all on table public.admin_user_invitations from public, anon, authenticated;
revoke all on table public.admin_user_invitation_audit from public, anon, authenticated;
grant select on table public.admin_user_invitations to authenticated;
grant select on table public.admin_user_invitation_audit to authenticated;

revoke all on function public.touch_admin_user_invitation_updated_at()
from public, anon, authenticated;
revoke all on function public.reserve_admin_user_invitation(
  uuid, text, text, text, uuid, text, text, text, date, date,
  text[], text, integer, boolean, boolean, numeric, text, date, text, text, text
) from public, anon, authenticated;
revoke all on function public.record_admin_user_invitation_delivery(uuid, uuid, boolean, text)
from public, anon, authenticated;

grant execute on function public.reserve_admin_user_invitation(
  uuid, text, text, text, uuid, text, text, text, date, date,
  text[], text, integer, boolean, boolean, numeric, text, date, text, text, text
) to service_role;
grant execute on function public.record_admin_user_invitation_delivery(uuid, uuid, boolean, text)
to service_role;

notify pgrst, 'reload schema';
commit;
