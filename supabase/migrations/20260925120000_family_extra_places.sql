begin;

-- Extra places are a change to the existing term, never a renewal. The
-- invoice, payment and finance review still use the existing audit trail.
alter table public.workspace_subscriptions add column if not exists billing_anchor_at timestamptz;
update public.workspace_subscriptions subscriptions
set billing_anchor_at = coalesce((
  select min(history.effective_from)
  from public.subscription_entitlement_history history
  where history.workspace_id = subscriptions.workspace_id
    and history.reason like 'Approved subscription payment %'
), subscriptions.entitlement_start_at)
where billing_anchor_at is null;

alter table public.subscription_renewal_requests
  add column if not exists purchase_kind text not null default 'renewal'
    check (purchase_kind in ('renewal', 'extra_places')),
  add column if not exists seat_count integer,
  add column if not exists seat_original_limit integer,
  add column if not exists seat_expiry_at timestamptz;

alter table public.subscription_payments
  drop constraint if exists subscription_payments_amount_check;
alter table public.subscription_payments
  add constraint subscription_payments_amount_check check (amount >= 0);

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

create or replace function public.submit_family_extra_places(
  p_workspace_id uuid, p_count integer, p_expected_amount numeric,
  p_payment_method text default null, p_payment_date date default null,
  p_reference_number text default null, p_notes text default null,
  p_proof_path text default null, p_proof_name text default null,
  p_proof_mime_type text default null, p_proof_size_bytes bigint default null
)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_quote jsonb;
  v_subscription public.workspace_subscriptions%rowtype;
  v_plan public.plans%rowtype;
  v_invoice_id uuid;
  v_request_id uuid;
  v_payment_id uuid;
  v_amount numeric(12,2);
begin
  -- Serialize quotes, other seat requests and renewal submissions on this
  -- subscription. Approval verifies the same term and original limit again.
  select * into v_subscription from public.workspace_subscriptions
  where workspace_id = p_workspace_id for update;
  v_quote := public.family_extra_place_quote(p_workspace_id, p_count);
  v_amount := (v_quote->>'amount')::numeric;
  if p_expected_amount is null or round(p_expected_amount,2) <> v_amount then
    raise exception 'SEAT_QUOTE_CHANGED';
  end if;
  if exists (select 1 from public.subscription_renewal_requests
      where workspace_id = p_workspace_id and status = 'pending_review')
  then raise exception 'SUBSCRIPTION_REVIEW_ALREADY_PENDING'; end if;
  if v_amount > 0 and (nullif(btrim(p_payment_method),'') is null
      or p_payment_date is null or nullif(btrim(p_reference_number),'') is null)
  then raise exception 'PAYMENT_DETAILS_REQUIRED'; end if;
  if v_amount = 0 and p_proof_path is not null then raise exception 'NO_PAYMENT_PROOF_REQUIRED'; end if;
  select * into v_plan from public.plans where id = v_subscription.plan_id;

  insert into public.subscription_invoices (
    workspace_id, invoice_number, plan_code, plan_name, billing_period, currency,
    base_amount, extra_member_amount, billable_member_count, included_member_count,
    extra_member_count, total_amount, created_by
  ) values (
    p_workspace_id, 'MB-S-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(gen_random_uuid()::text,1,6)),
    v_plan.code, v_plan.display_name, v_subscription.billing_period,
    v_quote->>'currency', 0, (v_quote->>'monthly_price')::numeric,
    (v_quote->>'target_limit')::integer, (v_quote->>'current_limit')::integer,
    p_count, v_amount, auth.uid()
  ) returning id into v_invoice_id;
  insert into public.subscription_renewal_requests (
    workspace_id, invoice_id, requested_plan_id, requested_by, purchase_kind,
    seat_count, seat_original_limit, seat_expiry_at
  ) values (
    p_workspace_id, v_invoice_id, v_plan.id, auth.uid(), 'extra_places',
    p_count, (v_quote->>'current_limit')::integer, v_subscription.paid_through_at
  ) returning id into v_request_id;
  insert into public.subscription_payments (
    renewal_request_id, workspace_id, submitted_by, amount, currency,
    payment_method, payment_date, reference_number, notes
  ) values (
    v_request_id, p_workspace_id, auth.uid(), v_amount, v_quote->>'currency',
    case when v_amount = 0 then 'No payment required' else btrim(p_payment_method) end,
    case when v_amount = 0 then current_date else p_payment_date end,
    case when v_amount = 0 then 'NO-CHARGE-' || v_request_id else btrim(p_reference_number) end,
    nullif(btrim(p_notes),'')
  ) returning id into v_payment_id;
  if p_proof_path is not null then
    if p_proof_mime_type not in ('image/jpeg','image/png','image/webp','application/pdf')
       or p_proof_size_bytes is null or p_proof_size_bytes <= 0 or p_proof_size_bytes > 10485760
       or split_part(p_proof_path,'/',1) <> 'workspaces'
       or split_part(p_proof_path,'/',2) <> p_workspace_id::text
       or split_part(p_proof_path,'/',3) <> auth.uid()::text
    then raise exception 'INVALID_SUBSCRIPTION_PROOF_PATH'; end if;
    insert into public.subscription_payment_proofs (
      payment_id, storage_path, original_name, mime_type, size_bytes, uploaded_by
    ) values (
      v_payment_id, p_proof_path, coalesce(nullif(btrim(p_proof_name),''),'payment-proof'),
      p_proof_mime_type, p_proof_size_bytes, auth.uid()
    );
  end if;
  insert into public.subscription_audit_events (
    workspace_id, actor_id, action, target_type, target_id, safe_details
  ) values (p_workspace_id, auth.uid(), 'family.places_requested', 'renewal_request', v_request_id, v_quote);
  return v_payment_id;
end;
$$;

revoke all on function public.family_extra_place_quote(uuid, integer) from public, anon, authenticated;
revoke all on function public.submit_family_extra_places(uuid, integer, numeric, text, date, text, text, text, text, text, bigint) from public, anon, authenticated;
grant execute on function public.family_extra_place_quote(uuid, integer) to authenticated;
grant execute on function public.submit_family_extra_places(uuid, integer, numeric, text, date, text, text, text, text, text, bigint) to authenticated;

create or replace function public.review_subscription_payment(
  p_payment_id uuid,
  p_decision text,
  p_reason text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.subscription_payments%rowtype;
  v_request public.subscription_renewal_requests%rowtype;
  v_invoice public.subscription_invoices%rowtype;
  v_subscription public.workspace_subscriptions%rowtype;
  v_start timestamptz;
  v_paid_through timestamptz;
  v_plan_id uuid;
  v_owner_id uuid;
  v_target_workspace_id uuid;
  v_family_id uuid;
  v_owned_count integer := 0;
  v_owner_email text;
  v_owner_name text;
  v_family_currency text;
begin
  if not public.is_platform_staff(array['super_admin', 'admin_staff', 'finance_staff']) then
    raise exception 'FINANCE_REVIEW_ACCESS_REQUIRED';
  end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'INVALID_REVIEW_DECISION'; end if;

  select * into v_payment
  from public.subscription_payments
  where id = p_payment_id
  for update;
  if v_payment.id is null then raise exception 'SUBSCRIPTION_PAYMENT_NOT_FOUND'; end if;
  if v_payment.status <> 'pending_review' then return 'already_reviewed'; end if;

  select * into v_request
  from public.subscription_renewal_requests
  where id = v_payment.renewal_request_id
  for update;
  select * into v_invoice
  from public.subscription_invoices
  where id = v_request.invoice_id
  for update;
  select owner_id into v_owner_id
  from public.budget_workspaces
  where id = v_payment.workspace_id
  for update;
  v_target_workspace_id := v_payment.workspace_id;

  if v_request.purchase_kind = 'extra_places' then
    if v_invoice.workspace_id <> v_payment.workspace_id
       or v_invoice.total_amount <> v_payment.amount
       or v_invoice.extra_member_count <> v_request.seat_count
       or v_invoice.billable_member_count <> v_request.seat_original_limit + v_request.seat_count
    then raise exception 'INVALID_EXTRA_PLACE_INVOICE'; end if;

    if p_decision = 'rejected' then
      if nullif(btrim(p_reason),'') is null then raise exception 'REJECTION_REASON_REQUIRED'; end if;
      update public.subscription_payments set status = 'rejected', updated_at = now()
      where id = v_payment.id;
      update public.subscription_renewal_requests
      set status = 'rejected', rejection_reason = btrim(p_reason),
          reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
      where id = v_request.id;
      update public.subscription_invoices set status = 'rejected' where id = v_invoice.id;
    else
      select * into v_subscription from public.workspace_subscriptions
      where workspace_id = v_payment.workspace_id for update;
      if v_subscription.status <> 'active'
         or v_subscription.paid_through_at <= now()
         or v_subscription.paid_through_at is distinct from v_request.seat_expiry_at
         or v_subscription.member_limit is distinct from v_request.seat_original_limit
         or v_subscription.plan_id <> v_request.requested_plan_id
         or exists (select 1 from public.budget_workspaces
           where id = v_payment.workspace_id and status <> 'active')
         or exists (select 1 from public.profiles
           where id = v_owner_id and account_status <> 'active')
      then raise exception 'FAMILY_SEAT_PURCHASE_CHANGED'; end if;

      -- The existing approval trigger sets member_limit from the invoice.
      -- In particular, paid_through_at and billing_anchor_at do not change.
      update public.subscription_payments
      set status = 'approved',
          receipt_number = 'MBR-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
          updated_at = now()
      where id = v_payment.id;
      update public.subscription_renewal_requests
      set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
      where id = v_request.id;
      update public.subscription_invoices set status = 'paid', paid_at = now()
      where id = v_invoice.id;
      insert into public.subscription_entitlement_history (
        workspace_id, subscription_id, plan_id, status,
        effective_from, effective_until, reason, actor_id
      ) values (
        v_payment.workspace_id, v_subscription.id, v_subscription.plan_id, 'active',
        now(), v_subscription.paid_through_at,
        'Approved ' || v_request.seat_count || ' additional Family place(s) on ' || v_invoice.invoice_number,
        auth.uid()
      );
    end if;
    insert into public.subscription_payment_reviews (payment_id, reviewer_id, decision, reason)
    values (v_payment.id, auth.uid(), p_decision, nullif(btrim(p_reason),''));
    insert into public.notifications (user_id, created_by, type, title, body, url)
    values (v_owner_id, auth.uid(), 'subscription',
      case when p_decision = 'approved' then 'Family places approved' else 'Family places request rejected' end,
      case when p_decision = 'approved'
        then v_request.seat_count || ' more Family place(s) are ready. You can invite members now.'
        else 'Your Family places request needs attention. View the reason in Subscription.' end,
      case when p_decision = 'approved' then '#family/members' else '#family/subscription' end);
    insert into public.subscription_audit_events (
      workspace_id, actor_id, action, target_type, target_id, safe_details
    ) values (v_payment.workspace_id, auth.uid(), 'family.places_' || p_decision,
      'subscription_payment', v_payment.id,
      jsonb_build_object('added_places', v_request.seat_count,
        'total_places', v_invoice.billable_member_count,
        'same_expiry', v_request.seat_expiry_at));
    return p_decision;
  end if;

  if p_decision = 'rejected' then
    if nullif(btrim(p_reason), '') is null then raise exception 'REJECTION_REASON_REQUIRED'; end if;
    update public.subscription_payments
      set status = 'rejected', updated_at = now()
      where id = v_payment.id;
    update public.subscription_renewal_requests
      set status = 'rejected', rejection_reason = btrim(p_reason),
          reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
      where id = v_request.id;
    update public.subscription_invoices
      set status = 'rejected'
      where id = v_invoice.id;
  else
    if v_request.provision_workspace_on_approval then
      if not exists (select 1 from public.plans where id = v_request.requested_plan_id and workspace_type = 'household')
         or nullif(btrim(v_request.requested_workspace_name), '') is null
      then
        raise exception 'INVALID_FAMILY_PLAN_REQUEST';
      end if;

      select lower(profiles.email),
             coalesce(nullif(btrim(profiles.full_name), ''), split_part(profiles.email, '@', 1), 'Family owner')
      into v_owner_email, v_owner_name
      from public.profiles
      where profiles.id = v_owner_id;
      if v_owner_email is null then raise exception 'OWNER_PROFILE_REQUIRED'; end if;

      -- Lock the head row too, serializing against direct family creation.
      perform 1 from public.family_heads
      where user_id = v_owner_id or lower(email) = v_owner_email
      for update;

      select count(*)::integer into v_owned_count
      from public.families
      where owner_id = v_owner_id;
      if v_owned_count >= 100 then raise exception 'FAMILY_ACCOUNT_CAP_REACHED'; end if;

      v_family_currency := v_invoice.currency;

      insert into public.families (
        owner_id, owner_email, name, monthly_budget, currency
      ) values (
        v_owner_id, v_owner_email, btrim(v_request.requested_workspace_name), 0, v_family_currency
      ) returning id into v_family_id;

      insert into public.family_members (
        family_id, user_id, created_by, name, role, email, avatar_color, status
      ) values (
        v_family_id, v_owner_id, auth.uid(), v_owner_name, 'Owner',
        v_owner_email, '#2563EB', 'active'
      );

      select id into v_target_workspace_id
      from public.budget_workspaces
      where legacy_family_id = v_family_id;
      if v_target_workspace_id is null then raise exception 'FAMILY_WORKSPACE_PROVISION_FAILED'; end if;

      update public.subscription_invoices
        set workspace_id = v_target_workspace_id
        where id = v_invoice.id;
      update public.subscription_payments
        set workspace_id = v_target_workspace_id, updated_at = now()
        where id = v_payment.id;
      update public.subscription_renewal_requests
        set workspace_id = v_target_workspace_id,
            provisioned_workspace_id = v_target_workspace_id,
            updated_at = now()
        where id = v_request.id;
      update public.subscription_audit_events
        set workspace_id = v_target_workspace_id
        where target_type = 'renewal_request'
          and target_id = v_request.id;
    end if;

    select * into v_subscription
    from public.workspace_subscriptions
    where workspace_id = v_target_workspace_id
    for update;
    v_plan_id := v_request.requested_plan_id;
    v_start := greatest(now(), coalesce(v_subscription.paid_through_at, now()));
    v_paid_through := case
      when v_invoice.billing_period = 'annual' then v_start + interval '1 year'
      else v_start + interval '1 month'
    end;

    insert into public.workspace_subscriptions (
      workspace_id, plan_id, status, billing_period, entitlement_start_at, paid_through_at, billing_anchor_at
    ) values (
      v_target_workspace_id, v_plan_id, 'active', v_invoice.billing_period, now(), v_paid_through, now()
    )
    on conflict (workspace_id) do update
    set plan_id = excluded.plan_id,
        status = 'active',
        billing_period = excluded.billing_period,
        paid_through_at = excluded.paid_through_at,
        billing_anchor_at = case
          when public.workspace_subscriptions.paid_through_at is null
            or public.workspace_subscriptions.paid_through_at <= now()
          then excluded.billing_anchor_at
          else coalesce(public.workspace_subscriptions.billing_anchor_at, excluded.billing_anchor_at)
        end,
        suspended_at = null,
        suspension_reason = null,
        version = public.workspace_subscriptions.version + 1,
        updated_at = now()
    returning * into v_subscription;

    update public.subscription_payments
      set status = 'approved',
          receipt_number = 'MBR-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
          updated_at = now()
      where id = v_payment.id;
    update public.subscription_renewal_requests
      set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
      where id = v_request.id;
    update public.subscription_invoices
      set status = 'paid', paid_at = now()
      where id = v_invoice.id;

    insert into public.subscription_entitlement_history (
      workspace_id, subscription_id, plan_id, status,
      effective_from, effective_until, reason, actor_id
    ) values (
      v_target_workspace_id, v_subscription.id, v_plan_id, 'active', now(), v_paid_through,
      'Approved subscription payment ' || v_invoice.invoice_number, auth.uid()
    );

    if exists (select 1 from public.plans where id = v_plan_id and workspace_type = 'household') then
      update public.family_heads as heads
      set status = 'active',
          billing_status = 'paid',
          can_add_members = true,
          family_limit = greatest(heads.family_limit, 1, case when v_request.provision_workspace_on_approval then v_owned_count + 1 else 1 end),
          paid_until = (v_paid_through at time zone 'Africa/Harare')::date,
          last_payment_at = now(),
          monthly_fee = case when v_invoice.billing_period = 'monthly' then v_invoice.base_amount else heads.monthly_fee end,
          fee_currency = v_invoice.currency,
          user_id = v_owner_id
      where lower(heads.email) = lower((select email from public.profiles where id = v_owner_id));

      if not found then
        insert into public.family_heads (
          user_id, email, full_name, created_by, status, billing_status,
          monthly_fee, fee_currency, can_add_members, family_limit,
          paid_until, last_payment_at
        )
        select v_owner_id, lower(profiles.email), profiles.full_name, auth.uid(), 'active', 'paid',
               case when v_invoice.billing_period = 'monthly' then v_invoice.base_amount else 0 end,
               v_invoice.currency, true, greatest(1, v_owned_count + 1),
               (v_paid_through at time zone 'Africa/Harare')::date, now()
        from public.profiles
        where profiles.id = v_owner_id;
      end if;
    end if;
  end if;

  insert into public.subscription_payment_reviews (
    payment_id, reviewer_id, decision, reason
  ) values (
    v_payment.id, auth.uid(), p_decision, nullif(btrim(p_reason), '')
  );

  insert into public.notifications (
    user_id, created_by, type, title, body, url
  ) values (
    v_owner_id, auth.uid(), 'subscription',
    case
      when p_decision = 'approved' and v_request.provision_workspace_on_approval then 'Family plan approved'
      when p_decision = 'approved' then 'Subscription payment approved'
      else 'Subscription payment rejected'
    end,
    case
      when p_decision = 'approved' and v_request.provision_workspace_on_approval
        then btrim(v_request.requested_workspace_name) || ' is ready. Open the workspace switcher to start using it.'
      when p_decision = 'approved'
        then 'Your subscription is active. Your receipt is available in Subscription.'
      else 'Your subscription payment needs attention. Open Subscription to view the review reason.'
    end,
    '#family/subscription'
  );

  insert into public.subscription_audit_events (
    workspace_id, actor_id, action, target_type, target_id, safe_details
  ) values (
    v_target_workspace_id, auth.uid(), 'subscription.payment_' || p_decision,
    'subscription_payment', v_payment.id,
    jsonb_build_object(
      'decision', p_decision,
      'provisioned_family', p_decision = 'approved' and v_request.provision_workspace_on_approval
    )
  );
  return p_decision;
end;
$$;

notify pgrst, 'reload schema';
commit;
