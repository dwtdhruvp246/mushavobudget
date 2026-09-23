-- Stage 6: first-party, privacy-conscious admin analytics foundation.
-- No IP address, user agent, page URL, payment reference, or event payload is stored.
begin;

-- Signup origin and invitation linkage are server-managed identity facts.
-- Existing table-wide grants would let a client relabel an unfinished invite.
revoke insert, update, delete on public.profiles from authenticated;
grant insert (id, full_name, email) on public.profiles to authenticated;
grant update (full_name, email, country_code) on public.profiles to authenticated;

create table if not exists public.analytics_activity_hours (
  user_id uuid not null references auth.users(id) on delete cascade,
  hour_start timestamptz not null,
  last_seen_at timestamptz not null,
  primary key (user_id, hour_start),
  constraint analytics_activity_hour_aligned check (
    hour_start = (date_trunc('hour', hour_start at time zone 'UTC') at time zone 'UTC')
  )
);

create index if not exists analytics_activity_hours_time_idx
on public.analytics_activity_hours (hour_start desc, user_id);

comment on table public.analytics_activity_hours is
  'At most one row per signed-in user per UTC hour while the application is visible. No device or page details.';

alter table public.analytics_activity_hours enable row level security;
revoke all on public.analytics_activity_hours from public, anon, authenticated;

create or replace function public.record_my_analytics_activity()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
begin
  if v_user_id is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  -- The Auth invite link temporarily signs a user in before setup is complete.
  if not exists (
    select 1 from public.profiles p where p.id = v_user_id
  ) or exists (
    select 1 from public.admin_user_invitations i
    where i.auth_user_id = v_user_id and i.status in ('pending_delivery', 'sent', 'accepted')
  ) or exists (
    select 1 from public.profiles p
    where p.id = v_user_id and p.signup_source = 'admin_invitation'
      and not exists (
        select 1 from public.admin_user_invitations i
        where i.id = p.admin_invitation_id and i.status = 'provisioned'
          and i.provisioned_workspace_id is not null
      )
  ) then return; end if;

  insert into public.analytics_activity_hours (user_id, hour_start, last_seen_at)
  values (v_user_id, date_trunc('hour', v_now at time zone 'UTC') at time zone 'UTC', v_now)
  on conflict (user_id, hour_start) do update
    set last_seen_at = greatest(public.analytics_activity_hours.last_seen_at, excluded.last_seen_at);

  update public.profiles set last_active_at = v_now
  where id = v_user_id and (last_active_at is null or last_active_at < v_now - interval '10 minutes');
end;
$$;

revoke all on function public.record_my_analytics_activity() from public, anon;
grant execute on function public.record_my_analytics_activity() to authenticated;

-- Data is returned only through this admin-checked RPC; direct row access stays closed.
-- Dates are inclusive UTC dates. The caller can request at most one year at a time.
create or replace function public.admin_analytics_foundation(
  p_from date default (current_date - 29),
  p_to date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.is_app_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to > current_date
     or p_to - p_from > 365 then
    raise exception 'INVALID_ANALYTICS_DATE_RANGE';
  end if;

  with eligible_users as (
    select p.id, p.country_code, p.signup_source,
      case when p.signup_source = 'admin_invitation' then i.completed_at else p.created_at end as joined_at
    from public.profiles p
    left join public.admin_user_invitations i on i.id = p.admin_invitation_id
    where p.signup_source <> 'admin_invitation'
       or (i.status = 'provisioned' and i.provisioned_workspace_id is not null and i.completed_at is not null)
  ), active_users as (
    select distinct a.user_id
    from public.analytics_activity_hours a
    where a.hour_start >= (p_from::timestamp at time zone 'UTC')
      and a.hour_start < ((p_to + 1)::timestamp at time zone 'UTC')
  ), approved_revenue as (
    select sp.id, sp.amount, sp.currency, sp.workspace_id,
      coalesce(r.created_at, sp.updated_at) as recognized_at
    from public.subscription_payments sp
    left join public.subscription_payment_reviews r on r.payment_id = sp.id and r.decision = 'approved'
    where sp.status = 'approved'
  ), current_plan_counts as (
    select plan.code, plan.display_name, count(*)::integer as workspace_count
    from public.workspace_subscriptions s
    join public.budget_workspaces w on w.id = s.workspace_id and w.status = 'active'
    join public.plans plan on plan.id = s.plan_id
    where s.status = 'active'
      and (plan.code = 'free' or s.paid_through_at is null or s.paid_through_at::date >= current_date)
    group by plan.code, plan.display_name
  ), monthly_run_rate as (
    select paid_invoice.currency, sum(case when s.billing_period = 'annual'
      then paid_invoice.amount / 12 else paid_invoice.amount end)::numeric(14, 2) as amount
    from public.workspace_subscriptions s
    join public.budget_workspaces w on w.id = s.workspace_id and w.status = 'active'
    join public.plans plan on plan.id = s.plan_id and plan.code <> 'free'
    join lateral (
      select i.total_amount as amount, i.currency from public.subscription_invoices i
      where i.workspace_id = s.workspace_id and i.status = 'paid'
        and i.plan_code = plan.code and i.billing_period = s.billing_period
      order by i.paid_at desc nulls last, i.issued_at desc
      limit 1
    ) paid_invoice on true
    where s.status = 'active' and s.billing_period in ('monthly', 'annual')
      and s.paid_through_at::date >= current_date
    group by paid_invoice.currency
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'generated_at', now(),
    'users', jsonb_build_object(
      'total', (select count(*) from eligible_users),
      'new', (select count(*) from eligible_users
        where joined_at >= (p_from::timestamp at time zone 'UTC')
          and joined_at < ((p_to + 1)::timestamp at time zone 'UTC')),
      'active_in_range', (select count(*) from active_users),
      'active_last_24_hours', (select count(distinct a.user_id)
        from public.analytics_activity_hours a join eligible_users u on u.id = a.user_id
        where a.last_seen_at >= now() - interval '24 hours')
    ),
    'daily', coalesce((select jsonb_agg(jsonb_build_object(
      'date', days.day::date, 'signups', (select count(*) from eligible_users u
        where u.joined_at >= (days.day::date::timestamp at time zone 'UTC')
          and u.joined_at < ((days.day::date + 1)::timestamp at time zone 'UTC')),
      'active_users', (select count(distinct a.user_id) from public.analytics_activity_hours a
        join eligible_users u on u.id = a.user_id
        where a.hour_start >= (days.day::date::timestamp at time zone 'UTC')
          and a.hour_start < ((days.day::date + 1)::timestamp at time zone 'UTC'))
    ) order by days.day)
      from generate_series(p_from, p_to, interval '1 day') as days(day)), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(jsonb_build_object(
      'code', country, 'users', users) order by users desc, country)
      from (select coalesce(country_code, 'unknown') country, count(*) users
        from eligible_users group by 1) by_country), '[]'::jsonb),
    'signup_sources', coalesce((select jsonb_agg(jsonb_build_object(
      'source', signup_source, 'users', users) order by signup_source)
      from (select signup_source, count(*) users from eligible_users group by signup_source) by_source), '[]'::jsonb),
    'plans', coalesce((select jsonb_agg(to_jsonb(c) order by c.workspace_count desc, c.code)
      from current_plan_counts c), '[]'::jsonb),
    'workspaces', coalesce((select jsonb_agg(jsonb_build_object(
      'type', workspace_type, 'status', status, 'count', total) order by workspace_type, status)
      from (select workspace_type, status, count(*) total from public.budget_workspaces
        group by workspace_type, status) w), '[]'::jsonb),
    'revenue_by_currency', coalesce((select jsonb_agg(jsonb_build_object(
      'currency', currency, 'collected', collected, 'payments', payments) order by currency)
      from (select currency, sum(amount)::numeric(14, 2) collected, count(*) payments
        from approved_revenue where recognized_at >= (p_from::timestamp at time zone 'UTC')
          and recognized_at < ((p_to + 1)::timestamp at time zone 'UTC') group by currency) r), '[]'::jsonb),
    'monthly_run_rate_by_currency', coalesce((select jsonb_agg(to_jsonb(m) order by m.currency)
      from monthly_run_rate m), '[]'::jsonb),
    'workspace_default_currencies', coalesce((select jsonb_agg(jsonb_build_object(
      'currency', currency, 'workspaces', workspaces) order by currency)
      from (select ws.default_payment_currency currency, count(*) workspaces
        from public.workspace_settings ws join public.budget_workspaces w on w.id = ws.workspace_id
        where w.status = 'active' group by ws.default_payment_currency) c), '[]'::jsonb),
    'operations', jsonb_build_object(
      'invitations_waiting', (select count(*) from public.admin_user_invitations
        where status in ('pending_delivery', 'sent', 'accepted')),
      'invitations_failed', (select count(*) from public.admin_user_invitations where status = 'failed'),
      'payments_pending_review', (select count(*) from public.subscription_payments where status = 'pending_review'),
      'last_exchange_rate_success_at', (select max(completed_at) from public.exchange_rate_sync_runs
        where status = 'success'),
      'expired_subscriptions', (select count(*) from public.workspace_subscriptions s
        join public.plans p on p.id = s.plan_id
        where p.code <> 'free' and (s.status = 'expired' or s.paid_through_at < now()))
    )
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.admin_analytics_foundation(date, date) from public, anon;
grant execute on function public.admin_analytics_foundation(date, date) to authenticated;

notify pgrst, 'reload schema';
commit;
