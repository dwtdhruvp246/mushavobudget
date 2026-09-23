-- Complete an admin-created user invitation only after Supabase Auth has
-- authenticated the invitee. All workspace, entitlement, invoice, payment,
-- and invitation changes are committed in one transaction.

begin;

alter table public.admin_user_invitations
  add column if not exists quoted_base_amount numeric(12, 2),
  add column if not exists quoted_extra_member_amount numeric(12, 2),
  add column if not exists quoted_total_amount numeric(12, 2),
  add column if not exists provisioned_workspace_id uuid references public.budget_workspaces(id) on delete set null,
  add column if not exists completed_at timestamptz;

alter table public.admin_user_invitations
  drop constraint if exists admin_user_invitation_quote_check,
  add constraint admin_user_invitation_quote_check check (
    (quoted_base_amount is null and quoted_extra_member_amount is null and quoted_total_amount is null)
    or (
      quoted_base_amount >= 0
      and quoted_extra_member_amount >= 0
      and quoted_total_amount >= quoted_base_amount
    )
  );

create or replace function public.snapshot_admin_user_invitation_price()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_price public.plan_prices%rowtype;
begin
  select prices.* into v_price
  from public.plan_prices as prices
  where prices.plan_id = new.plan_id
    and prices.billing_period = new.billing_period
    and prices.currency = new.subscription_currency
    and prices.is_active
    and prices.effective_from <= now()
    and (prices.effective_until is null or prices.effective_until > now())
  order by prices.effective_from desc
  limit 1;

  if v_price.id is null then raise exception 'PLAN_PRICE_NOT_CONFIGURED'; end if;
  new.quoted_base_amount := v_price.amount;
  new.quoted_extra_member_amount := v_price.extra_member_amount;
  new.quoted_total_amount := v_price.amount;
  if new.payment_received and (
    new.payment_currency is distinct from new.subscription_currency
    or round(new.payment_amount, 2) is distinct from v_price.amount
  ) then
    raise exception 'ADMIN_INVITATION_PAYMENT_MUST_MATCH_PLAN_PRICE';
  end if;
  return new;
end;
$$;

drop trigger if exists snapshot_admin_user_invitation_price_trigger
on public.admin_user_invitations;
create trigger snapshot_admin_user_invitation_price_trigger
before insert or update of plan_id, billing_period, subscription_currency
on public.admin_user_invitations
for each row execute function public.snapshot_admin_user_invitation_price();

with invitation_prices as (
  select invitations.id, prices.amount, prices.extra_member_amount
  from public.admin_user_invitations as invitations
  join lateral (
    select plan_prices.amount, plan_prices.extra_member_amount
    from public.plan_prices
    where plan_prices.plan_id = invitations.plan_id
      and plan_prices.billing_period = invitations.billing_period
      and plan_prices.currency = invitations.subscription_currency
    order by
      (plan_prices.is_active
        and plan_prices.effective_from <= now()
        and (plan_prices.effective_until is null or plan_prices.effective_until > now())) desc,
      plan_prices.effective_from desc
    limit 1
  ) as prices on true
  where invitations.quoted_base_amount is null
)
update public.admin_user_invitations as invitations
set quoted_base_amount = invitation_prices.amount,
    quoted_extra_member_amount = invitation_prices.extra_member_amount,
    quoted_total_amount = invitation_prices.amount
from invitation_prices
where invitations.id = invitation_prices.id;

create or replace function public.get_my_admin_user_invitation(p_invitation_id uuid)
returns table (
  invitation_id uuid,
  email text,
  full_name text,
  country_code text,
  plan_code text,
  plan_name text,
  workspace_type text,
  workspace_name text,
  billing_period text,
  subscription_currency text,
  entitlement_start_date date,
  paid_through_date date,
  enabled_currencies text[],
  default_currency text,
  payment_received boolean,
  invitation_status text,
  provisioned_workspace_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
begin
  if v_user_id is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select lower(users.email) into v_user_email
  from auth.users as users
  where users.id = v_user_id;

  return query
  select
    invitations.id,
    invitations.email,
    invitations.full_name,
    invitations.country_code,
    invitations.plan_code,
    invitations.plan_name,
    invitations.workspace_type,
    invitations.workspace_name,
    invitations.billing_period,
    invitations.subscription_currency,
    invitations.entitlement_start_date,
    invitations.paid_through_date,
    invitations.enabled_currencies,
    invitations.default_currency,
    invitations.payment_received,
    invitations.status,
    invitations.provisioned_workspace_id
  from public.admin_user_invitations as invitations
  where invitations.id = p_invitation_id
    and invitations.auth_user_id = v_user_id
    and lower(invitations.email) = v_user_email
    and invitations.status in ('sent', 'provisioned')
    and (
      invitations.status = 'provisioned'
      or invitations.expires_at is null
      or invitations.expires_at > now()
    );

  if not found then raise exception 'ADMIN_INVITATION_NOT_AVAILABLE'; end if;
end;
$$;

create or replace function public.complete_admin_user_invitation(
  p_invitation_id uuid,
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
  v_user_email text;
  v_profile_invitation_id uuid;
  v_invitation public.admin_user_invitations%rowtype;
  v_plan public.plans%rowtype;
  v_enabled_currencies text[] := array[]::text[];
  v_default_currency text := upper(nullif(btrim(p_default_currency), ''));
  v_workspace_id uuid;
  v_existing_workspace_id uuid;
  v_family_id uuid;
  v_subscription_id uuid;
  v_invoice_id uuid;
  v_request_id uuid;
  v_payment_id uuid;
  v_base_amount numeric(12, 2);
  v_extra_member_amount numeric(12, 2);
  v_total_amount numeric(12, 2);
  v_included_member_count integer := 1;
  v_family_head_rows integer := 0;
  v_invoice_number text;
  v_receipt_number text;
begin
  if v_user_id is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;

  select lower(users.email) into v_user_email
  from auth.users as users
  where users.id = v_user_id;
  if v_user_email is null then raise exception 'AUTHENTICATED_USER_NOT_FOUND'; end if;

  select invitations.* into v_invitation
  from public.admin_user_invitations as invitations
  where invitations.id = p_invitation_id
  for update;
  if v_invitation.id is null then raise exception 'ADMIN_INVITATION_NOT_AVAILABLE'; end if;
  if v_invitation.auth_user_id is distinct from v_user_id
     or lower(v_invitation.email) is distinct from v_user_email
  then
    raise exception 'ADMIN_INVITATION_IDENTITY_MISMATCH';
  end if;
  if v_invitation.status = 'provisioned' and v_invitation.provisioned_workspace_id is not null then
    return v_invitation.provisioned_workspace_id;
  end if;
  if v_invitation.status <> 'sent' then raise exception 'ADMIN_INVITATION_NOT_AVAILABLE'; end if;
  if v_invitation.expires_at is not null and v_invitation.expires_at <= now() then
    raise exception 'ADMIN_INVITATION_EXPIRED';
  end if;

  select profiles.admin_invitation_id into v_profile_invitation_id
  from public.profiles as profiles
  where profiles.id = v_user_id;
  if v_profile_invitation_id is distinct from v_invitation.id then
    raise exception 'ADMIN_INVITATION_IDENTITY_MISMATCH';
  end if;

  if cardinality(coalesce(p_enabled_currencies, array[]::text[])) < 1
     or cardinality(coalesce(p_enabled_currencies, array[]::text[])) > 20
  then
    raise exception 'INVALID_ENABLED_CURRENCIES';
  end if;

  select coalesce(array_agg(requested.code order by requested.code), array[]::text[])
  into v_enabled_currencies
  from (
    select distinct upper(btrim(values_list.value)) as code
    from unnest(coalesce(p_enabled_currencies, array[]::text[])) as values_list(value)
    where upper(btrim(values_list.value)) ~ '^[A-Z]{3}$'
  ) as requested
  join public.supported_currencies as currencies
    on currencies.code = requested.code and currencies.is_active;

  if cardinality(v_enabled_currencies) <> cardinality(p_enabled_currencies) then
    raise exception 'INVALID_ENABLED_CURRENCIES';
  end if;
  if v_default_currency is null or not (v_default_currency = any(v_enabled_currencies)) then
    raise exception 'DEFAULT_CURRENCY_MUST_BE_ENABLED';
  end if;

  select plans.* into v_plan
  from public.plans as plans
  where plans.id = v_invitation.plan_id
    and plans.code = v_invitation.plan_code
    and plans.workspace_type = v_invitation.workspace_type;
  if v_plan.id is null then raise exception 'ADMIN_INVITATION_PLAN_CHANGED'; end if;

  select greatest(1, coalesce(limits.limit_value, 1))
  into v_included_member_count
  from public.plan_limits as limits
  where limits.plan_id = v_plan.id
    and limits.limit_code = 'included_member_seats';
  v_included_member_count := coalesce(v_included_member_count, 1);

  select workspaces.id into v_existing_workspace_id
  from public.budget_workspaces as workspaces
  where workspaces.owner_id = v_user_id
    and workspaces.status <> 'closed'
  limit 1;
  if v_existing_workspace_id is not null then
    raise exception 'ADMIN_INVITATION_ACCOUNT_ALREADY_PROVISIONED';
  end if;

  if v_plan.code <> 'free' then
    v_base_amount := v_invitation.quoted_base_amount;
    v_extra_member_amount := v_invitation.quoted_extra_member_amount;
    v_total_amount := v_invitation.quoted_total_amount;
    if v_base_amount is null or v_extra_member_amount is null or v_total_amount is null then
      select prices.amount, prices.extra_member_amount, prices.amount
      into v_base_amount, v_extra_member_amount, v_total_amount
      from public.plan_prices as prices
      where prices.plan_id = v_plan.id
        and prices.billing_period = v_invitation.billing_period
        and prices.currency = v_invitation.subscription_currency
        and prices.is_active
        and prices.effective_from <= now()
        and (prices.effective_until is null or prices.effective_until > now())
      order by prices.effective_from desc
      limit 1;
    end if;
    if v_total_amount is null then raise exception 'ADMIN_INVITATION_PRICE_UNAVAILABLE'; end if;
    if v_invitation.payment_received and (
      v_invitation.payment_currency is distinct from v_invitation.subscription_currency
      or round(v_invitation.payment_amount, 2) is distinct from v_total_amount
    ) then
      raise exception 'ADMIN_INVITATION_PAYMENT_MUST_MATCH_PLAN_PRICE';
    end if;
  end if;

  update public.profiles
  set full_name = v_invitation.full_name,
      email = v_invitation.email,
      country_code = v_invitation.country_code,
      signup_source = 'admin_invitation',
      admin_invitation_id = v_invitation.id,
      last_active_at = now(),
      updated_at = now()
  where id = v_user_id;
  if not found then raise exception 'ADMIN_INVITATION_PROFILE_NOT_FOUND'; end if;

  if v_invitation.workspace_type = 'household' then
    update public.family_heads as heads
    set user_id = v_user_id,
        email = v_invitation.email,
        full_name = v_invitation.full_name,
        status = 'active',
        billing_status = case when v_invitation.payment_received then 'paid' else 'unpaid' end,
        monthly_fee = case when v_invitation.billing_period = 'monthly' then coalesce(v_base_amount, 0) else 0 end,
        fee_currency = v_invitation.subscription_currency,
        can_add_members = v_invitation.can_add_members,
        family_limit = greatest(1, v_invitation.family_limit),
        paid_until = v_invitation.paid_through_date,
        last_payment_at = case when v_invitation.payment_received then now() else heads.last_payment_at end
    where heads.user_id = v_user_id or lower(heads.email) = v_user_email;
    get diagnostics v_family_head_rows = row_count;

    if v_family_head_rows = 0 then
      insert into public.family_heads (
        user_id, email, full_name, created_by, status, billing_status,
        monthly_fee, fee_currency, can_add_members, family_limit,
        paid_until, last_payment_at
      ) values (
        v_user_id, v_invitation.email, v_invitation.full_name, v_invitation.invited_by,
        'active', case when v_invitation.payment_received then 'paid' else 'unpaid' end,
        case when v_invitation.billing_period = 'monthly' then coalesce(v_base_amount, 0) else 0 end,
        v_invitation.subscription_currency, v_invitation.can_add_members,
        greatest(1, v_invitation.family_limit), v_invitation.paid_through_date,
        case when v_invitation.payment_received then now() else null end
      );
    end if;

    insert into public.families (owner_id, owner_email, name, monthly_budget, currency)
    values (
      v_user_id, v_invitation.email, v_invitation.workspace_name, 0,
      v_default_currency
    ) returning id into v_family_id;

    insert into public.family_members (
      family_id, user_id, created_by, name, role, email, avatar_color, status
    ) values (
      v_family_id, v_user_id, v_invitation.invited_by, v_invitation.full_name,
      'Owner', v_invitation.email, '#2563EB', 'active'
    );

    select workspaces.id into v_workspace_id
    from public.budget_workspaces as workspaces
    where workspaces.legacy_family_id = v_family_id;
    if v_workspace_id is null then raise exception 'FAMILY_WORKSPACE_PROVISION_FAILED'; end if;
  else
    insert into public.budget_workspaces (owner_id, workspace_type, name, status)
    values (v_user_id, v_invitation.workspace_type, v_invitation.workspace_name, 'active')
    returning id into v_workspace_id;

    insert into public.workspace_members (workspace_id, user_id, role, status, invited_by)
    values (
      v_workspace_id,
      v_user_id,
      case when v_invitation.workspace_type = 'business' then 'business_owner' else 'owner' end,
      'active',
      v_invitation.invited_by
    );
  end if;

  insert into public.workspace_settings (
    workspace_id, base_currency, locale, timezone,
    default_payment_currency, enabled_currencies, reporting_currency,
    conversion_enabled
  ) values (
    v_workspace_id, v_default_currency, 'en-ZW', 'Africa/Harare',
    v_default_currency, v_enabled_currencies, v_default_currency, true
  )
  on conflict (workspace_id) do update
  set base_currency = excluded.base_currency,
      default_payment_currency = excluded.default_payment_currency,
      enabled_currencies = excluded.enabled_currencies,
      reporting_currency = excluded.reporting_currency,
      conversion_enabled = true,
      updated_at = now();

  insert into public.workspace_subscriptions (
    workspace_id, plan_id, status, billing_period,
    entitlement_start_at, paid_through_at, member_limit
  ) values (
    v_workspace_id, v_plan.id, 'active',
    case when v_plan.code = 'free' then null else v_invitation.billing_period end,
    v_invitation.entitlement_start_date::timestamptz,
    case when v_plan.code = 'free' then null else v_invitation.paid_through_date::timestamptz end,
    v_included_member_count
  )
  on conflict (workspace_id) do update
  set plan_id = excluded.plan_id,
      status = 'active',
      billing_period = excluded.billing_period,
      entitlement_start_at = excluded.entitlement_start_at,
      paid_through_at = excluded.paid_through_at,
      member_limit = excluded.member_limit,
      suspended_at = null,
      suspension_reason = null,
      version = public.workspace_subscriptions.version + 1,
      updated_at = now()
  returning id into v_subscription_id;

  insert into public.subscription_entitlement_history (
    workspace_id, subscription_id, plan_id, status,
    effective_from, effective_until, reason, actor_id
  ) values (
    v_workspace_id, v_subscription_id, v_plan.id, 'active',
    v_invitation.entitlement_start_date::timestamptz,
    case when v_plan.code = 'free' then null else v_invitation.paid_through_date::timestamptz end,
    'Admin invitation ' || v_invitation.id::text,
    v_invitation.invited_by
  );

  if v_plan.code <> 'free' then
    v_invoice_number := 'MBI-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')
      || '-' || upper(substr(gen_random_uuid()::text, 1, 6));
    insert into public.subscription_invoices (
      workspace_id, invoice_number, plan_code, plan_name, billing_period, currency,
      base_amount, extra_member_amount, billable_member_count, included_member_count,
      extra_member_count, total_amount, status, issued_at, paid_at, created_by
    ) values (
      v_workspace_id, v_invoice_number, v_plan.code, v_plan.display_name,
      v_invitation.billing_period, v_invitation.subscription_currency,
      v_base_amount, v_extra_member_amount, 1, v_included_member_count, 0, v_total_amount,
      case when v_invitation.payment_received then 'paid' else 'pending' end,
      now(), case when v_invitation.payment_received then now() else null end,
      v_invitation.invited_by
    ) returning id into v_invoice_id;

    if v_invitation.payment_received then
      insert into public.subscription_renewal_requests (
        workspace_id, invoice_id, requested_plan_id, requested_by,
        status, reviewed_by, reviewed_at
      ) values (
        v_workspace_id, v_invoice_id, v_plan.id, v_user_id,
        'approved', v_invitation.invited_by, now()
      ) returning id into v_request_id;

      v_receipt_number := 'MBR-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')
        || '-' || upper(substr(gen_random_uuid()::text, 1, 6));
      insert into public.subscription_payments (
        renewal_request_id, workspace_id, submitted_by, amount, currency,
        payment_method, payment_date, reference_number, notes,
        status, receipt_number
      ) values (
        v_request_id, v_workspace_id, v_user_id,
        v_invitation.payment_amount, v_invitation.payment_currency,
        v_invitation.payment_method, v_invitation.payment_date,
        coalesce(nullif(btrim(v_invitation.payment_reference), ''), 'ADMIN-INV-' || upper(substr(v_invitation.id::text, 1, 8))),
        v_invitation.payment_notes, 'approved', v_receipt_number
      ) returning id into v_payment_id;

      insert into public.subscription_payment_reviews (
        payment_id, reviewer_id, decision, reason
      ) values (
        v_payment_id, v_invitation.invited_by, 'approved',
        'Payment recorded by administrator before invitation acceptance.'
      );
    end if;
  end if;

  insert into public.subscription_audit_events (
    workspace_id, actor_id, action, target_type, target_id, safe_details
  ) values (
    v_workspace_id, v_invitation.invited_by, 'admin_invitation_provisioned',
    'admin_user_invitation', v_invitation.id,
    jsonb_build_object(
      'plan_code', v_plan.code,
      'workspace_type', v_invitation.workspace_type,
      'payment_recorded', v_invitation.payment_received
    )
  );

  update public.admin_user_invitations
  set status = 'provisioned',
      accepted_at = coalesce(accepted_at, now()),
      completed_at = now(),
      provisioned_workspace_id = v_workspace_id,
      last_error_code = null
  where id = v_invitation.id;

  insert into public.admin_user_invitation_audit (
    invitation_id, actor_id, action, safe_details
  ) values
    (v_invitation.id, v_user_id, 'accepted', jsonb_build_object('identity_verified', true)),
    (v_invitation.id, v_user_id, 'provisioned', jsonb_build_object(
      'workspace_id', v_workspace_id,
      'workspace_type', v_invitation.workspace_type,
      'plan_code', v_plan.code
    ));

  return v_workspace_id;
end;
$$;

revoke all on function public.snapshot_admin_user_invitation_price()
from public, anon, authenticated;
revoke all on function public.get_my_admin_user_invitation(uuid)
from public, anon, authenticated;
revoke all on function public.complete_admin_user_invitation(uuid, text[], text)
from public, anon, authenticated;

grant execute on function public.get_my_admin_user_invitation(uuid)
to authenticated;
grant execute on function public.complete_admin_user_invitation(uuid, text[], text)
to authenticated;

notify pgrst, 'reload schema';
commit;
