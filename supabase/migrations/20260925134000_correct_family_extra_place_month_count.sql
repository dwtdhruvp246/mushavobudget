begin;

-- Correct the remaining-full-month count for Family extra places. The prior
-- function counted the renewal-date boundary as another month and therefore
-- added one full month to every quote.
create or replace function public.family_extra_place_quote(p_workspace_id uuid, p_count integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_workspace public.budget_workspaces%rowtype;
  v_subscription public.workspace_subscriptions%rowtype;
  v_price public.plan_prices%rowtype;
  v_currency text;
  v_anchor timestamptz;
  v_month_index integer := 0;
  v_month_start timestamptz;
  v_next_month timestamptz;
  v_full_month_end timestamptz;
  v_full_months integer := 0;
  v_first_half boolean;
  v_amount numeric(12,2);
begin
  if auth.uid() is null or public.my_account_suspended() then raise exception 'WORKSPACE_OWNER_REQUIRED'; end if;
  if p_count is null or p_count < 1 or p_count > 100 then raise exception 'INVALID_EXTRA_PLACE_COUNT'; end if;
  select * into v_workspace from public.budget_workspaces where id = p_workspace_id;
  if v_workspace.id is null or v_workspace.owner_id <> auth.uid()
     or v_workspace.workspace_type <> 'household' or v_workspace.status <> 'active'
     or not public.can_manage_family_members(v_workspace.legacy_family_id)
  then raise exception 'ACTIVE_FAMILY_SUBSCRIPTION_REQUIRED'; end if;
  select * into v_subscription from public.workspace_subscriptions where workspace_id = p_workspace_id;
  if v_subscription.id is null or v_subscription.status <> 'active'
     or v_subscription.paid_through_at is null or v_subscription.paid_through_at <= now()
     or v_subscription.billing_period not in ('monthly', 'annual')
     or v_subscription.member_limit + p_count > 100
     or not exists (select 1 from public.plans where id = v_subscription.plan_id and code = 'household')
  then raise exception 'ACTIVE_FAMILY_SUBSCRIPTION_REQUIRED'; end if;

  -- A Family plan's own activation date anchors every calendar month. Use
  -- anchor + N months, so a plan started on the 31st does not drift in February.
  v_anchor := coalesce(v_subscription.billing_anchor_at, v_subscription.entitlement_start_at);
  v_month_start := v_anchor;
  if v_month_start > now() then raise exception 'INVALID_FAMILY_BILLING_ANCHOR'; end if;
  while v_month_index < 1200 loop
    v_next_month := v_anchor + make_interval(months => v_month_index + 1);
    exit when v_next_month > now();
    v_month_index := v_month_index + 1;
    v_month_start := v_next_month;
  end loop;
  if v_next_month <= now() then raise exception 'INVALID_FAMILY_BILLING_ANCHOR'; end if;
  v_first_half := now() < v_month_start + ((v_next_month - v_month_start) / 2);
  -- v_next_month starts the first complete billing month after the current
  -- partial month. Count that month only when its end is within this term.
  -- Counting v_next_month itself would incorrectly include the renewal-date
  -- boundary and overcharge every quote by one full month.
  while v_month_index < 1199 loop
    v_full_month_end := v_anchor + make_interval(months => v_month_index + 2);
    exit when v_full_month_end > v_subscription.paid_through_at;
    v_full_months := v_full_months + 1;
    v_month_index := v_month_index + 1;
  end loop;

  select invoices.currency into v_currency
  from public.subscription_invoices invoices
  join public.subscription_renewal_requests requests on requests.invoice_id = invoices.id
  where requests.workspace_id = p_workspace_id and requests.status = 'approved'
  order by requests.reviewed_at desc nulls last limit 1;
  if v_currency is null then
    select base_currency into v_currency from public.workspace_settings where workspace_id = p_workspace_id;
  end if;
  select * into v_price from public.plan_prices
  where plan_id = v_subscription.plan_id and billing_period = v_subscription.billing_period
    and currency = v_currency and is_active and effective_from <= now()
    and (effective_until is null or effective_until > now())
  order by effective_from desc limit 1;
  if v_price.id is null then raise exception 'PLAN_PRICE_NOT_CONFIGURED'; end if;
  v_amount := round(p_count * v_price.extra_member_amount
    * (v_full_months + case when v_first_half then 0.5 else 0 end), 2);
  return jsonb_build_object(
    'workspace_id', p_workspace_id, 'additional_count', p_count,
    'current_limit', v_subscription.member_limit,
    'target_limit', v_subscription.member_limit + p_count,
    'billing_period', v_subscription.billing_period,
    'currency', v_currency, 'monthly_price', v_price.extra_member_amount,
    'current_half_charge', v_first_half,
    'full_months_remaining', v_full_months,
    'amount', v_amount, 'paid_through_at', v_subscription.paid_through_at,
    'billing_anchor_at', v_anchor
  );
end;
$$;

notify pgrst, 'reload schema';
commit;
