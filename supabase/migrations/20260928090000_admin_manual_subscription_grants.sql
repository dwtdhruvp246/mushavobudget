begin;

-- A short-lived, transaction-scoped permit allows a super-admin to create one
-- Business test workspace without opening the Stage 0 customer launch flags.
create table if not exists public.business_admin_test_provisioning (
  workspace_id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  admin_id uuid not null references auth.users(id) on delete cascade,
  transaction_id bigint not null,
  created_at timestamptz not null default now()
);

alter table public.business_admin_test_provisioning enable row level security;
revoke all on public.business_admin_test_provisioning from public, anon, authenticated;

create table if not exists public.admin_subscription_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.budget_workspaces(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete restrict,
  plan_id uuid not null references public.plans(id) on delete restrict,
  billing_period text not null check (billing_period in ('monthly', 'annual')),
  starts_on date not null,
  ends_on date not null check (ends_on > starts_on),
  grant_kind text not null check (grant_kind in ('manual', 'business_test')),
  reason text not null check (char_length(btrim(reason)) between 8 and 500),
  granted_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists admin_subscription_grants_workspace_idx
on public.admin_subscription_grants(workspace_id, created_at desc);

alter table public.admin_subscription_grants enable row level security;
drop policy if exists "Super admins can read manual grants" on public.admin_subscription_grants;
create policy "Super admins can read manual grants"
on public.admin_subscription_grants for select to authenticated
using (public.is_platform_staff(array['super_admin']) and not public.my_account_suspended());
revoke all on public.admin_subscription_grants from public, anon, authenticated;
grant select on public.admin_subscription_grants to authenticated;

create or replace function public.business_admin_test_permit(
  p_workspace_id uuid,
  p_owner_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_staff(array['super_admin'])
    and exists (
      select 1 from public.business_admin_test_provisioning as permits
      where permits.workspace_id = p_workspace_id
        and permits.owner_id = p_owner_id
        and permits.admin_id = auth.uid()
        and permits.transaction_id = txid_current()
    );
$$;

-- Preserve the public lock and all other Business guards. Only the exact
-- workspace/owner named in the current super-admin transaction may pass.
create or replace function public.enforce_business_workspace_launch_control()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.workspace_type = 'business'
     and not public.product_customer_workspace_creation_enabled('business')
     and not (
       tg_op = 'INSERT'
       and public.business_admin_test_permit(new.id, new.owner_id)
     )
  then
    raise exception 'BUSINESS_COMING_SOON';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_business_member_provision_launch_control()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner_id uuid;
begin
  select owner_id into v_owner_id
  from public.budget_workspaces
  where id = new.workspace_id and workspace_type = 'business';
  if v_owner_id is not null
     and not public.product_customer_workspace_creation_enabled('business')
     and not (
       tg_op = 'INSERT'
       and new.user_id = v_owner_id
       and new.role = 'business_owner'
       and public.business_admin_test_permit(new.workspace_id, v_owner_id)
     )
  then
    raise exception 'BUSINESS_COMING_SOON';
  end if;
  return new;
end;
$$;

create or replace function public.admin_grant_manual_subscription(
  p_owner_id uuid,
  p_workspace_id uuid,
  p_plan_id uuid,
  p_billing_period text,
  p_starts_on date,
  p_ends_on date,
  p_reason text,
  p_new_business_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner public.profiles%rowtype;
  v_plan public.plans%rowtype;
  v_workspace public.budget_workspaces%rowtype;
  v_subscription public.workspace_subscriptions%rowtype;
  v_grant_id uuid;
  v_end_at timestamptz;
  v_new_business boolean := p_workspace_id is null;
begin
  if not public.is_platform_staff(array['super_admin'])
     or public.my_account_suspended() then
    raise exception 'SUPER_ADMIN_REQUIRED';
  end if;
  if p_owner_id is null
     or p_billing_period is null
     or p_billing_period not in ('monthly', 'annual')
     or p_starts_on is null or p_ends_on is null
     or p_starts_on > current_date
     or p_ends_on <= current_date
     or p_ends_on > p_starts_on + 366
     or char_length(btrim(coalesce(p_reason, ''))) not between 8 and 500 then
    raise exception 'INVALID_MANUAL_GRANT';
  end if;

  select * into v_owner from public.profiles where id = p_owner_id for update;
  if not found or v_owner.account_status <> 'active'
     or not exists (select 1 from auth.users where id = p_owner_id)
     or (v_owner.signup_source = 'admin_invitation' and not exists (
       select 1 from public.admin_user_invitations
       where id = v_owner.admin_invitation_id and status = 'provisioned'
     )) then
    raise exception 'REGISTERED_ACTIVE_OWNER_REQUIRED';
  end if;

  select * into v_plan from public.plans where id = p_plan_id;
  if not found or not v_plan.is_active or v_plan.code = 'free' then
    raise exception 'ACTIVE_PAID_PLAN_REQUIRED';
  end if;

  if v_new_business then
    if v_plan.workspace_type <> 'business'
       or char_length(btrim(coalesce(p_new_business_name, ''))) not between 2 and 120
       or not exists (
         select 1 from public.budget_workspaces
         where owner_id = p_owner_id and workspace_type = 'personal' and status = 'active'
       ) then
      raise exception 'BUSINESS_TEST_WORKSPACE_REQUIRED';
    end if;

    v_workspace.id := gen_random_uuid();
    insert into public.business_admin_test_provisioning (
      workspace_id, owner_id, admin_id, transaction_id
    ) values (v_workspace.id, p_owner_id, auth.uid(), txid_current());

    insert into public.budget_workspaces (id, owner_id, workspace_type, name)
    values (v_workspace.id, p_owner_id, 'business', btrim(p_new_business_name))
    returning * into v_workspace;

    insert into public.workspace_members (workspace_id, user_id, role, status)
    values (v_workspace.id, p_owner_id, 'business_owner', 'active');

    insert into public.workspace_settings (
      workspace_id, base_currency, locale, timezone,
      default_payment_currency, enabled_currencies,
      reporting_currency, conversion_enabled
    )
    select v_workspace.id, settings.base_currency, settings.locale,
           settings.timezone, settings.default_payment_currency,
           settings.enabled_currencies, settings.reporting_currency,
           settings.conversion_enabled
    from public.budget_workspaces as personal
    join public.workspace_settings as settings on settings.workspace_id = personal.id
    where personal.owner_id = p_owner_id
      and personal.workspace_type = 'personal'
      and personal.status = 'active'
    limit 1;
    if not found then raise exception 'PERSONAL_WORKSPACE_SETTINGS_REQUIRED'; end if;
    delete from public.business_admin_test_provisioning
    where workspace_id = v_workspace.id and transaction_id = txid_current();
  else
    select * into v_workspace from public.budget_workspaces
    where id = p_workspace_id for update;
    if not found or v_workspace.owner_id <> p_owner_id
       or v_workspace.status <> 'active'
       or v_workspace.workspace_type <> v_plan.workspace_type then
      raise exception 'OWNED_ACTIVE_WORKSPACE_PLAN_REQUIRED';
    end if;
    if v_workspace.workspace_type = 'business' and not exists (
      select 1 from public.admin_subscription_grants
      where workspace_id = v_workspace.id and grant_kind = 'business_test'
    ) then
      raise exception 'BUSINESS_TEST_WORKSPACE_REQUIRED';
    end if;
  end if;

  if exists (
    select 1 from public.subscription_renewal_requests
    where workspace_id = v_workspace.id and status = 'pending_review'
  ) then
    raise exception 'PENDING_SUBSCRIPTION_REVIEW';
  end if;

  v_end_at := ((p_ends_on + 1)::timestamp at time zone 'UTC');

  insert into public.workspace_subscriptions (
    workspace_id, plan_id, status, billing_period,
    entitlement_start_at, paid_through_at
  ) values (
    v_workspace.id, v_plan.id, 'active', p_billing_period,
    p_starts_on::timestamp at time zone 'UTC', v_end_at
  )
  on conflict (workspace_id) do update set
    plan_id = excluded.plan_id,
    status = 'active',
    billing_period = excluded.billing_period,
    entitlement_start_at = excluded.entitlement_start_at,
    paid_through_at = excluded.paid_through_at,
    suspended_at = null,
    suspension_reason = null,
    version = public.workspace_subscriptions.version + 1,
    updated_at = now()
  returning * into v_subscription;

  -- Legacy Family access still consults family_heads. This marks entitlement
  -- active but does not invent a platform payment or a receipt.
  if v_plan.workspace_type = 'household' then
    insert into public.family_heads (
      user_id, email, full_name, created_by, status, billing_status,
      can_add_members, family_limit, paid_until
    ) values (
      p_owner_id, lower(v_owner.email), v_owner.full_name, auth.uid(),
      'active', 'paid', true, 1, p_ends_on
    )
    on conflict (lower(email)) do update set
      user_id = excluded.user_id,
      status = 'active',
      billing_status = 'paid',
      can_add_members = true,
      family_limit = greatest(public.family_heads.family_limit, 1),
      paid_until = p_ends_on;
  end if;

  insert into public.admin_subscription_grants (
    workspace_id, owner_id, plan_id, billing_period,
    starts_on, ends_on, grant_kind, reason, granted_by
  ) values (
    v_workspace.id, p_owner_id, v_plan.id, p_billing_period,
    p_starts_on, p_ends_on,
    case when v_plan.workspace_type = 'business' then 'business_test' else 'manual' end,
    btrim(p_reason), auth.uid()
  ) returning id into v_grant_id;

  insert into public.subscription_entitlement_history (
    workspace_id, subscription_id, plan_id, status,
    effective_from, effective_until, reason, actor_id
  ) values (
    v_workspace.id, v_subscription.id, v_plan.id, 'active',
    now(), v_end_at, 'Admin manual grant ' || v_grant_id::text, auth.uid()
  );
  insert into public.subscription_audit_events (
    workspace_id, actor_id, action, target_type, target_id, safe_details
  ) values (
    v_workspace.id, auth.uid(), 'subscription.manual_grant',
    'admin_subscription_grant', v_grant_id,
    jsonb_build_object('plan_code', v_plan.code, 'billing_period', p_billing_period,
      'starts_on', p_starts_on, 'ends_on', p_ends_on, 'business_test', v_plan.workspace_type = 'business')
  );
  if v_plan.workspace_type = 'business' then
    perform public.business_record_audit_event(
      v_workspace.id, 'business.test_subscription_granted', 'workspace', v_workspace.id,
      '{}'::jsonb, jsonb_build_object('grant_id', v_grant_id, 'ends_on', p_ends_on)
    );
  end if;
  insert into public.notifications (user_id, created_by, type, title, body)
  values (
    p_owner_id, auth.uid(), 'subscription', 'Manual plan access granted',
    case when v_plan.workspace_type = 'business'
      then 'A Business test workspace is ready. Open Business to explore your workspace.'
      else 'An administrator has updated your workspace subscription. Open Subscription to see your plan and expiry.'
    end
  );
  return v_workspace.id;
end;
$$;

revoke all on function public.business_admin_test_permit(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_grant_manual_subscription(uuid, uuid, uuid, text, date, date, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_grant_manual_subscription(uuid, uuid, uuid, text, date, date, text, text)
  to authenticated;

notify pgrst, 'reload schema';
commit;
