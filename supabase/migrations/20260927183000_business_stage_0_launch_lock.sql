-- Business Stage 0: keep the unfinished product visible but impossible to purchase or provision.
begin;

create table if not exists public.product_release_controls (
  product_code text primary key check (product_code ~ '^[a-z][a-z0-9_]*$'),
  release_stage text not null check (release_stage ~ '^stage_[0-9]+$'),
  customer_purchase_enabled boolean not null default false,
  customer_workspace_creation_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.product_release_controls (
  product_code, release_stage, customer_purchase_enabled,
  customer_workspace_creation_enabled, updated_at
) values ('business', 'stage_0', false, false, now())
on conflict (product_code) do update
set release_stage = excluded.release_stage,
    customer_purchase_enabled = excluded.customer_purchase_enabled,
    customer_workspace_creation_enabled = excluded.customer_workspace_creation_enabled,
    updated_at = now();

alter table public.product_release_controls enable row level security;
revoke all on table public.product_release_controls from public, anon, authenticated;

create or replace function public.product_customer_purchase_enabled(p_product_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select controls.customer_purchase_enabled
    from public.product_release_controls as controls
    where controls.product_code = lower(btrim(p_product_code))
  ), false);
$$;

create or replace function public.product_customer_workspace_creation_enabled(p_product_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select controls.customer_workspace_creation_enabled
    from public.product_release_controls as controls
    where controls.product_code = lower(btrim(p_product_code))
  ), false);
$$;

revoke all on function public.product_customer_purchase_enabled(text) from public, anon, authenticated;
revoke all on function public.product_customer_workspace_creation_enabled(text) from public, anon, authenticated;

update public.plans
set available_for_purchase = false,
    is_featured = false,
    cta_label = 'Coming soon',
    description = 'Business income, expenses, bills, budgets, approvals and team controls are being prepared.',
    marketing_summary = 'A dedicated finance workspace for businesses is coming soon.',
    updated_at = now()
where workspace_type = 'business';

-- No included-seat count is approved yet. Admins can configure one later,
-- but Stage 0 must never inherit the historical six-person placeholder.
insert into public.plan_limits (plan_id, limit_code, limit_value)
select plans.id, 'included_member_seats', null
from public.plans as plans
where plans.workspace_type = 'business'
on conflict (plan_id, limit_code) do update set limit_value = null;

create or replace function public.enforce_business_plan_launch_control()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.workspace_type = 'business'
     and not public.product_customer_purchase_enabled('business')
  then
    new.available_for_purchase := false;
    new.is_featured := false;
    new.cta_label := 'Coming soon';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_business_plan_launch_control_trigger on public.plans;
create trigger enforce_business_plan_launch_control_trigger
before insert or update of workspace_type, available_for_purchase, is_featured, cta_label
on public.plans
for each row execute function public.enforce_business_plan_launch_control();

create or replace function public.enforce_business_workspace_launch_control()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.workspace_type = 'business'
     and not public.product_customer_workspace_creation_enabled('business')
  then
    raise exception 'BUSINESS_COMING_SOON';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_business_workspace_launch_control_trigger on public.budget_workspaces;
create trigger enforce_business_workspace_launch_control_trigger
before insert or update of workspace_type on public.budget_workspaces
for each row execute function public.enforce_business_workspace_launch_control();

create or replace function public.enforce_business_subscription_request_launch_control()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_type text;
begin
  select plans.workspace_type into v_workspace_type
  from public.plans
  where plans.id = new.requested_plan_id;
  if v_workspace_type = 'business'
     and not public.product_customer_purchase_enabled('business')
  then
    raise exception 'BUSINESS_COMING_SOON';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_business_subscription_request_launch_control_trigger
on public.subscription_renewal_requests;
create trigger enforce_business_subscription_request_launch_control_trigger
before insert or update of requested_plan_id on public.subscription_renewal_requests
for each row execute function public.enforce_business_subscription_request_launch_control();

create or replace function public.enforce_business_admin_invitation_launch_control()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_type text;
begin
  select plans.workspace_type into v_workspace_type
  from public.plans
  where plans.id = new.plan_id;
  if v_workspace_type = 'business'
     and new.status in ('pending_delivery', 'sent')
     and not public.product_customer_purchase_enabled('business')
  then
    raise exception 'BUSINESS_COMING_SOON';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_business_admin_invitation_launch_control_trigger
on public.admin_user_invitations;
create trigger enforce_business_admin_invitation_launch_control_trigger
before insert or update of plan_id, status on public.admin_user_invitations
for each row execute function public.enforce_business_admin_invitation_launch_control();

create or replace function public.enforce_business_payment_approval_launch_control()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_type text;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    select plans.workspace_type into v_workspace_type
    from public.subscription_renewal_requests as requests
    join public.plans on plans.id = requests.requested_plan_id
    where requests.id = new.renewal_request_id;
    if v_workspace_type = 'business'
       and not public.product_customer_purchase_enabled('business')
    then
      raise exception 'BUSINESS_COMING_SOON';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_business_payment_approval_launch_control_trigger
on public.subscription_payments;
create trigger enforce_business_payment_approval_launch_control_trigger
before update of status on public.subscription_payments
for each row execute function public.enforce_business_payment_approval_launch_control();

create or replace function public.enforce_business_member_invitation_launch_control()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.budget_workspaces as workspaces
    where workspaces.id = new.workspace_id and workspaces.workspace_type = 'business'
  ) and not public.product_customer_workspace_creation_enabled('business')
  then
    raise exception 'BUSINESS_COMING_SOON';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_business_member_invitation_launch_control_trigger
on public.workspace_invitations;
create trigger enforce_business_member_invitation_launch_control_trigger
before insert or update of workspace_id on public.workspace_invitations
for each row execute function public.enforce_business_member_invitation_launch_control();

-- Unpublished plans remain visible, but public visitors must not receive an
-- unapproved seat number or historical price through the catalogue RPC.
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
    case when plans.workspace_type = 'business' and not plans.available_for_purchase then null else coalesce((
      select limits.limit_value
      from public.plan_limits as limits
      where limits.plan_id = plans.id and limits.limit_code = 'included_member_seats'
    ), 1) end,
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
    case when plans.available_for_purchase then coalesce((
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
    ), '[]'::jsonb) else '[]'::jsonb end,
    case when plans.available_for_purchase then coalesce((
      select array_agg(distinct currencies.currency order by currencies.currency)
      from public.plan_prices as currencies
      where currencies.plan_id = plans.id
        and currencies.is_active
        and currencies.effective_from <= now()
        and (currencies.effective_until is null or currencies.effective_until > now())
    ), array[]::text[]) else array[]::text[] end
  from public.plans
  where plans.is_active and plans.is_public
  order by plans.sort_order, plans.display_name;
$$;

revoke all on function public.enforce_business_plan_launch_control() from public, anon, authenticated;
revoke all on function public.enforce_business_workspace_launch_control() from public, anon, authenticated;
revoke all on function public.enforce_business_subscription_request_launch_control() from public, anon, authenticated;
revoke all on function public.enforce_business_admin_invitation_launch_control() from public, anon, authenticated;
revoke all on function public.enforce_business_payment_approval_launch_control() from public, anon, authenticated;
revoke all on function public.enforce_business_member_invitation_launch_control() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
