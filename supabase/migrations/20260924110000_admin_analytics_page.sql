-- Stage 7: aggregate-only filtered analytics for signed-in administrators.
-- The Stage 6 activity table remains inaccessible directly to browser roles.
begin;

create or replace function public.admin_analytics_page(
  p_from date,
  p_to date,
  p_country text default null,
  p_plan text default null,
  p_workspace_type text default null,
  p_subscription_status text default null,
  p_billing_period text default null,
  p_currency text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'UTC')::date;
  v_monthly boolean;
  v_report_currency text;
  v_result jsonb;
begin
  if not public.is_app_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_from is null or p_to is null or p_from > p_to or p_to > v_today
      or p_from < date '2020-01-01' then
    raise exception 'INVALID_ANALYTICS_DATE_RANGE';
  end if;
  if (p_country is not null and p_country <> 'unknown' and p_country !~ '^[A-Z]{2}$')
    or (p_plan is not null and p_plan !~ '^[a-z][a-z0-9_]*$')
    or (p_workspace_type is not null and p_workspace_type not in ('personal', 'household', 'business'))
    or (p_subscription_status is not null and p_subscription_status not in ('active', 'suspended', 'expired'))
    or (p_billing_period is not null and p_billing_period not in ('monthly', 'annual'))
    or (p_currency is not null and p_currency !~ '^[A-Z]{3}$') then
    raise exception 'INVALID_ANALYTICS_FILTER';
  end if;

  v_monthly := p_to - p_from > 90;
  select coalesce((select reporting_currency from public.admin_finance_settings where id = 1), 'USD')
    into v_report_currency;

  with eligible_users as (
    select p.id, p.country_code, p.signup_source,
      case when p.signup_source = 'admin_invitation' then i.completed_at else p.created_at end as joined_at
    from public.profiles p
    left join public.admin_user_invitations i on i.id = p.admin_invitation_id
    where p.signup_source <> 'admin_invitation'
       or (i.status = 'provisioned' and i.provisioned_workspace_id is not null and i.completed_at is not null)
  ), candidates as (
    select w.id, w.owner_id, w.workspace_type, w.status as workspace_status,
      s.status as subscription_status, s.billing_period, s.paid_through_at,
      plan.code as plan_code, plan.display_name as plan_name,
      coalesce(invoice.currency, settings.default_payment_currency) as billing_currency
    from public.budget_workspaces w
    join eligible_users owner on owner.id = w.owner_id
    join public.workspace_subscriptions s on s.workspace_id = w.id
    join public.plans plan on plan.id = s.plan_id
    left join public.workspace_settings settings on settings.workspace_id = w.id
    left join lateral (
      select i.currency from public.subscription_invoices i
      where i.workspace_id = w.id order by i.issued_at desc, i.id desc limit 1
    ) invoice on true
    where (p_country is null or coalesce(owner.country_code, 'unknown') = p_country)
      and (p_plan is null or plan.code = p_plan)
      and (p_workspace_type is null or w.workspace_type = p_workspace_type)
      and (p_subscription_status is null or s.status = p_subscription_status)
      and (p_billing_period is null or s.billing_period = p_billing_period)
      and (p_currency is null or coalesce(invoice.currency, settings.default_payment_currency) = p_currency
        or exists (select 1 from public.subscription_payments cp
          where cp.workspace_id = w.id and cp.status = 'approved' and cp.currency = p_currency))
  ), users_in_scope as (
    select u.* from eligible_users u
    where (p_country is null or coalesce(u.country_code, 'unknown') = p_country)
      and ((p_plan is null and p_workspace_type is null and p_subscription_status is null
            and p_billing_period is null and p_currency is null)
        or exists (select 1 from candidates w where w.owner_id = u.id))
  ), activity as (
    select a.user_id, a.hour_start, a.last_seen_at
    from public.analytics_activity_hours a join users_in_scope u on u.id = a.user_id
    where a.hour_start >= (p_from::timestamp at time zone 'UTC')
      and a.hour_start < ((p_to + 1)::timestamp at time zone 'UTC')
  ), revenue as (
    select sp.id, sp.workspace_id, sp.amount, sp.currency,
      coalesce(r.created_at, sp.updated_at) as received_at, w.plan_code,
      coalesce(owner.country_code, 'unknown') as country_code,
      case when sp.currency = v_report_currency then sp.amount
        else conversion.converted_amount end as converted_amount
    from public.subscription_payments sp
    join candidates w on w.id = sp.workspace_id
    join eligible_users owner on owner.id = w.owner_id
    left join public.subscription_payment_reviews r on r.payment_id = sp.id and r.decision = 'approved'
    left join public.payment_conversions conversion on conversion.entity_type = 'subscription_payment'
      and conversion.entity_id = sp.id and conversion.reporting_currency = v_report_currency
      and conversion.is_locked and conversion.original_currency = sp.currency
    where sp.status = 'approved'
      and (p_currency is null or sp.currency = p_currency)
      and coalesce(r.created_at, sp.updated_at) >= (p_from::timestamp at time zone 'UTC')
      and coalesce(r.created_at, sp.updated_at) < ((p_to + 1)::timestamp at time zone 'UTC')
  ), months as (
    select series::date as date
    from generate_series(
      case when v_monthly then date_trunc('month', p_from::timestamp) else p_from::timestamp end,
      p_to::timestamp,
      case when v_monthly then interval '1 month' else interval '1 day' end
    ) series
  ), paid_workspaces as (
    select distinct w.id, w.owner_id, w.plan_code, w.billing_period, w.paid_through_at
    from candidates w where w.workspace_status = 'active' and w.subscription_status = 'active'
      and w.plan_code <> 'free' and w.paid_through_at::date >= v_today
  ), run_rate as (
    select invoice.currency,
      sum(case when w.billing_period = 'annual' then invoice.total_amount / 12
        else invoice.total_amount end)::numeric(14,2) as amount
    from paid_workspaces w
    join lateral (
      select i.currency, i.total_amount from public.subscription_invoices i
      where i.workspace_id = w.id and i.status = 'paid' and i.plan_code = w.plan_code
        and i.billing_period = w.billing_period
      order by i.paid_at desc nulls last, i.issued_at desc, i.id desc limit 1
    ) invoice on true
    where p_currency is null or invoice.currency = p_currency
    group by invoice.currency
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to, 'generated_at', now(),
    'granularity', case when v_monthly then 'month' else 'day' end,
    'reporting_currency', v_report_currency,
    'filters', jsonb_build_object(
      'countries', coalesce((select jsonb_agg(code order by code) from (
        select distinct coalesce(country_code, 'unknown') as code from eligible_users
      ) c), '[]'::jsonb),
      'plans', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'name', display_name)
        order by sort_order, code) from public.plans), '[]'::jsonb),
      'currencies', coalesce((select jsonb_agg(code order by code)
        from public.supported_currencies where is_active), '[]'::jsonb)
    ),
    'users', jsonb_build_object(
      'total', (select count(*) from users_in_scope),
      'new', (select count(*) from users_in_scope where joined_at >= (p_from::timestamp at time zone 'UTC')
        and joined_at < ((p_to + 1)::timestamp at time zone 'UTC')),
      'active', (select count(distinct user_id) from activity),
      'never_active', (select count(*) from users_in_scope u where not exists
        (select 1 from public.analytics_activity_hours a where a.user_id = u.id)),
      'active_last_7_days', (select count(distinct a.user_id) from public.analytics_activity_hours a
        join users_in_scope u on u.id = a.user_id where a.last_seen_at >= now() - interval '7 days'),
      'active_last_30_days', (select count(distinct a.user_id) from public.analytics_activity_hours a
        join users_in_scope u on u.id = a.user_id where a.last_seen_at >= now() - interval '30 days'),
      'active_last_90_days', (select count(distinct a.user_id) from public.analytics_activity_hours a
        join users_in_scope u on u.id = a.user_id where a.last_seen_at >= now() - interval '90 days')
    ),
    'paid_customers', (select count(distinct owner_id) from paid_workspaces),
    'owner_users', (select count(distinct owner_id) from candidates where workspace_status = 'active'),
    'active_workspaces', (select count(*) from candidates where workspace_status = 'active'),
    'renewals_due', (select count(*) from paid_workspaces
      where paid_through_at < now() + interval '30 days'),
    'pending_reviews', (select count(*) from public.subscription_payments sp
      join candidates w on w.id = sp.workspace_id where sp.status = 'pending_review'
        and (p_currency is null or sp.currency = p_currency)),
    'trend', coalesce((select jsonb_agg(jsonb_build_object(
      'date', m.date,
      'signups', (select count(*) from users_in_scope u
        where u.joined_at >= (m.date::timestamp at time zone 'UTC')
          and u.joined_at < ((m.date + case when v_monthly then interval '1 month' else interval '1 day' end)::timestamp at time zone 'UTC')),
      'active', (select count(distinct a.user_id) from activity a
        where a.hour_start >= (m.date::timestamp at time zone 'UTC')
          and a.hour_start < ((m.date + case when v_monthly then interval '1 month' else interval '1 day' end)::timestamp at time zone 'UTC'))
      ) order by m.date) from months m), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(jsonb_build_object(
      'code', c.country_code, 'users', c.users, 'new', c.new_users, 'paying', c.paying)
      order by c.users desc, c.country_code) from (
        select coalesce(u.country_code, 'unknown') country_code, count(*) users,
          count(*) filter (where u.joined_at >= (p_from::timestamp at time zone 'UTC')
            and u.joined_at < ((p_to + 1)::timestamp at time zone 'UTC')) as new_users,
          count(*) filter (where exists (select 1 from paid_workspaces w where w.owner_id = u.id)) as paying
        from users_in_scope u group by 1
      ) c), '[]'::jsonb),
    'signup_sources', coalesce((select jsonb_agg(jsonb_build_object('source', source,
      'users', total) order by source) from (
      select signup_source source, count(*) total from users_in_scope group by 1
    ) s), '[]'::jsonb),
    'plans', coalesce((select jsonb_agg(jsonb_build_object('code', plan_code,
      'count', total) order by total desc, plan_code) from (
      select plan_code, count(*) total from candidates where workspace_status = 'active' group by 1
    ) s), '[]'::jsonb),
    'subscription_statuses', coalesce((select jsonb_agg(jsonb_build_object('status', status,
      'count', total) order by status) from (
      select subscription_status status, count(*) total from candidates group by 1
    ) s), '[]'::jsonb),
    'billing_periods', coalesce((select jsonb_agg(jsonb_build_object('period', billing_period,
      'count', total) order by billing_period) from (
      select billing_period, count(*) total from candidates group by 1
    ) s), '[]'::jsonb),
    'workspace_types', coalesce((select jsonb_agg(jsonb_build_object('type', workspace_type,
      'count', total) order by workspace_type) from (
      select workspace_type, count(*) total from candidates where workspace_status = 'active' group by 1
    ) s), '[]'::jsonb),
    'revenue_by_currency', coalesce((select jsonb_agg(jsonb_build_object('currency', currency,
      'amount', amount, 'payments', payments) order by currency) from (
      select currency, sum(amount)::numeric(14,2) amount, count(*) payments from revenue group by currency
    ) s), '[]'::jsonb),
    'revenue_by_month', coalesce((select jsonb_agg(jsonb_build_object('date', date,
      'currency', currency, 'amount', amount) order by date, currency) from (
      select date_trunc('month', received_at at time zone 'UTC')::date date, currency,
        sum(amount)::numeric(14,2) amount from revenue group by 1, 2
    ) s), '[]'::jsonb),
    'revenue_by_plan', coalesce((select jsonb_agg(jsonb_build_object('plan', plan_code,
      'currency', currency, 'amount', amount) order by plan_code, currency) from (
      select plan_code, currency, sum(amount)::numeric(14,2) amount from revenue group by 1, 2
    ) s), '[]'::jsonb),
    'revenue_by_country', coalesce((select jsonb_agg(jsonb_build_object('country', country_code,
      'currency', currency, 'amount', amount) order by country_code, currency) from (
      select country_code, currency, sum(amount)::numeric(14,2) amount from revenue group by 1, 2
    ) s), '[]'::jsonb),
    'run_rate_by_currency', coalesce((select jsonb_agg(to_jsonb(s) order by currency)
      from run_rate s), '[]'::jsonb),
    'reporting_total', (select coalesce(sum(converted_amount), 0)::numeric(14,2)
      from revenue where converted_amount is not null),
    'reporting_missing', (select count(*) from revenue where converted_amount is null),
    'workspace_currencies', coalesce((select jsonb_agg(jsonb_build_object('currency', currency,
      'workspaces', total) order by total desc, currency) from (
      select settings.default_payment_currency currency, count(*) total
      from candidates w join public.workspace_settings settings on settings.workspace_id = w.id
      where w.workspace_status = 'active' group by 1
    ) s), '[]'::jsonb),
    'enabled_currencies', coalesce((select jsonb_agg(jsonb_build_object('currency', currency,
      'workspaces', total) order by total desc, currency) from (
      select codes.currency, count(distinct w.id) total
      from candidates w join public.workspace_settings settings on settings.workspace_id = w.id
      cross join lateral unnest(settings.enabled_currencies) as codes(currency)
      where w.workspace_status = 'active' group by 1
    ) s), '[]'::jsonb),
    'workspace_engagement', jsonb_build_object(
      'payment_items', (select count(*) from public.payment_items item
        join candidates w on w.id = item.workspace_id where w.workspace_status = 'active'),
      'active_members', (select count(*) from public.workspace_members member
        join candidates w on w.id = member.workspace_id
        where w.workspace_status = 'active' and member.status = 'active'),
      'without_payments', (select count(*) from candidates w
        where w.workspace_status = 'active' and not exists
          (select 1 from public.payment_items item where item.workspace_id = w.id))
    ),
    'payment_statuses', coalesce((select jsonb_agg(jsonb_build_object('status', status,
      'count', total) order by status) from (
      select sp.status, count(*) total from public.subscription_payments sp
      join candidates w on w.id = sp.workspace_id
      where p_currency is null or sp.currency = p_currency group by 1
    ) s), '[]'::jsonb),
    'operations', jsonb_build_object(
      'invitations_waiting', (select count(*) from public.admin_user_invitations
        where status in ('pending_delivery', 'sent', 'accepted')),
      'invitations_failed', (select count(*) from public.admin_user_invitations where status = 'failed'),
      'invitations_sent', (select count(*) from public.admin_user_invitations
        where sent_at is not null and status <> 'cancelled'),
      'invitations_accepted', (select count(*) from public.admin_user_invitations
        where accepted_at is not null and status in ('accepted', 'provisioned')),
      'pending_reviews_global', (select count(*) from public.subscription_payments where status = 'pending_review'),
      'support_open', (select count(*) from public.support_tickets where status in ('open', 'in_progress', 'waiting_customer')),
      'enquiries_open', (select count(*) from public.enquiries where status in ('new', 'in_progress')),
      'last_exchange_rate_success_at', (select max(completed_at) from public.exchange_rate_sync_runs where status = 'success')
    )
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.admin_analytics_page(date,date,text,text,text,text,text,text)
  from public, anon;
grant execute on function public.admin_analytics_page(date,date,text,text,text,text,text,text)
  to authenticated;

notify pgrst, 'reload schema';
commit;
