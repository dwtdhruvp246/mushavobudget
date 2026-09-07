-- Allow any active published Family plan to be selected when starting a new family.
drop function if exists public.submit_family_plan_request(
  uuid, text, text, text, numeric, text, date, text, text, text, text, text, bigint
);
drop function if exists public.submit_family_plan_request(
  uuid, text, integer, text, text, numeric, text, date, text, text, text, text, text, bigint
);

create or replace function public.submit_family_plan_request(
  p_personal_workspace_id uuid,
  p_family_name text,
  p_total_member_count integer,
  p_plan_code text,
  p_billing_period text,
  p_currency text,
  p_amount numeric,
  p_payment_method text,
  p_payment_date date,
  p_reference_number text,
  p_notes text default null,
  p_proof_path text default null,
  p_proof_name text default null,
  p_proof_mime_type text default null,
  p_proof_size_bytes bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace public.budget_workspaces%rowtype;
  v_plan public.plans%rowtype;
  v_price public.plan_prices%rowtype;
  v_invoice_id uuid;
  v_request_id uuid;
  v_payment_id uuid;
  v_family_limit integer := 1;
  v_owned_count integer := 0;
  v_pending_count integer := 0;
  v_included integer := 4;
  v_extra integer := 0;
  v_total numeric(12,2);
  v_family_name text := nullif(btrim(p_family_name), '');
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if v_family_name is null then raise exception 'FAMILY_NAME_REQUIRED'; end if;
  if char_length(v_family_name) > 100 then raise exception 'FAMILY_NAME_TOO_LONG'; end if;
  if p_billing_period not in ('monthly', 'annual') then raise exception 'INVALID_BILLING_PERIOD'; end if;
  if nullif(btrim(p_payment_method), '') is null then raise exception 'PAYMENT_METHOD_REQUIRED'; end if;
  if nullif(btrim(p_reference_number), '') is null then raise exception 'PAYMENT_REFERENCE_REQUIRED'; end if;

  select * into v_workspace
  from public.budget_workspaces
  where id = p_personal_workspace_id
  for update;

  if v_workspace.id is null
     or v_workspace.owner_id <> auth.uid()
     or v_workspace.workspace_type <> 'personal'
  then
    raise exception 'PERSONAL_WORKSPACE_OWNER_REQUIRED';
  end if;
  if v_workspace.status = 'suspended' then raise exception 'WORKSPACE_SUSPENDED'; end if;

  select family_heads.family_limit into v_family_limit
  from public.family_heads
  where family_heads.user_id = auth.uid()
     or lower(family_heads.email) = lower(auth.jwt() ->> 'email')
  order by (family_heads.user_id = auth.uid()) desc
  limit 1;
  -- A Family plan purchase always permits the first family. The admin-set
  -- family_limit controls additional owned families after that first plan.
  v_family_limit := greatest(1, coalesce(v_family_limit, 1));

  select count(*)::integer into v_owned_count
  from public.families
  where owner_id = auth.uid();

  select count(*)::integer into v_pending_count
  from public.subscription_renewal_requests
  where requested_by = auth.uid()
    and provision_workspace_on_approval = true
    and status = 'pending_review';

  if v_pending_count > 0 then raise exception 'FAMILY_PLAN_REQUEST_ALREADY_PENDING'; end if;
  if v_owned_count + v_pending_count >= v_family_limit then
    raise exception 'FAMILY_LIMIT_REACHED';
  end if;

  select * into v_plan
  from public.plans
  where code = lower(btrim(p_plan_code)) and workspace_type = 'household' and is_active and available_for_purchase;
  if v_plan.id is null then raise exception 'PLAN_NOT_AVAILABLE'; end if;

  select * into v_price
  from public.plan_prices
  where plan_id = v_plan.id
    and billing_period = p_billing_period
    and currency = upper(p_currency)
    and is_active
    and effective_from <= now()
    and (effective_until is null or effective_until > now())
  order by effective_from desc
  limit 1;
  if v_price.id is null then raise exception 'PLAN_PRICE_NOT_CONFIGURED'; end if;

  select coalesce(limit_value, 4) into v_included
  from public.plan_limits
  where plan_id = v_plan.id and limit_code = 'included_member_seats';
  v_included := greatest(1, coalesce(v_included, 4));
  if p_total_member_count is null
     or p_total_member_count < v_included
     or p_total_member_count > 100
  then
    raise exception 'INVALID_FAMILY_MEMBER_COUNT';
  end if;
  v_extra := p_total_member_count - v_included;
  -- extra_member_amount is always the monthly per-person rate.
  -- Annual invoices charge that monthly rate for all 12 months.
  v_total := v_price.amount + (
    v_extra * v_price.extra_member_amount
    * case when p_billing_period = 'annual' then 12 else 1 end
  );
  if round(p_amount, 2) <> round(v_total, 2) then
    raise exception 'PAYMENT_AMOUNT_DOES_NOT_MATCH_INVOICE';
  end if;

  insert into public.subscription_invoices (
    workspace_id, invoice_number, plan_code, plan_name, billing_period, currency,
    base_amount, extra_member_amount, billable_member_count, included_member_count,
    extra_member_count, total_amount, created_by
  ) values (
    p_personal_workspace_id,
    'MB-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(gen_random_uuid()::text, 1, 6)),
    v_plan.code, v_plan.display_name, p_billing_period, v_price.currency,
    v_price.amount, v_price.extra_member_amount,
    p_total_member_count, v_included, v_extra, v_total, auth.uid()
  ) returning id into v_invoice_id;

  insert into public.subscription_renewal_requests (
    workspace_id, invoice_id, requested_plan_id, requested_by,
    requested_workspace_name, provision_workspace_on_approval
  ) values (
    p_personal_workspace_id, v_invoice_id, v_plan.id, auth.uid(), v_family_name, true
  ) returning id into v_request_id;

  insert into public.subscription_payments (
    renewal_request_id, workspace_id, submitted_by, amount, currency,
    payment_method, payment_date, reference_number, notes
  ) values (
    v_request_id, p_personal_workspace_id, auth.uid(), v_total, v_price.currency,
    btrim(p_payment_method), p_payment_date, btrim(p_reference_number), nullif(btrim(p_notes), '')
  ) returning id into v_payment_id;

  if p_proof_path is not null then
    if p_proof_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
       or p_proof_size_bytes is null
       or p_proof_size_bytes <= 0
       or p_proof_size_bytes > 10485760
    then
      raise exception 'INVALID_SUBSCRIPTION_PROOF';
    end if;
    if split_part(p_proof_path, '/', 1) <> 'workspaces'
       or split_part(p_proof_path, '/', 2) <> p_personal_workspace_id::text
       or split_part(p_proof_path, '/', 3) <> auth.uid()::text
    then
      raise exception 'INVALID_SUBSCRIPTION_PROOF_PATH';
    end if;
    insert into public.subscription_payment_proofs (
      payment_id, storage_path, original_name, mime_type, size_bytes, uploaded_by
    ) values (
      v_payment_id, p_proof_path,
      coalesce(nullif(btrim(p_proof_name), ''), 'payment-proof'),
      p_proof_mime_type, p_proof_size_bytes, auth.uid()
    );
  end if;

  insert into public.subscription_audit_events (
    workspace_id, actor_id, action, target_type, target_id, safe_details
  ) values (
    p_personal_workspace_id, auth.uid(), 'subscription.family_plan_submitted',
    'renewal_request', v_request_id,
    jsonb_build_object(
      'plan_code', 'household',
      'billing_period', p_billing_period,
      'currency', v_price.currency,
      'amount', v_total,
      'provisions_family', true
    )
  );
  return v_payment_id;
end;
$$;

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
  v_family_limit integer := 1;
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
  where id = v_payment.workspace_id;
  v_target_workspace_id := v_payment.workspace_id;

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
      if v_invoice.plan_code <> 'household'
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

      select family_heads.family_limit into v_family_limit
      from public.family_heads
      where family_heads.user_id = v_owner_id
         or lower(family_heads.email) = v_owner_email
      order by (family_heads.user_id = v_owner_id) desc
      limit 1
      for update;
      v_family_limit := greatest(1, coalesce(v_family_limit, 1));

      select count(*)::integer into v_owned_count
      from public.families
      where owner_id = v_owner_id;
      if v_owned_count >= v_family_limit then raise exception 'FAMILY_LIMIT_REACHED'; end if;

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
      workspace_id, plan_id, status, billing_period, entitlement_start_at, paid_through_at
    ) values (
      v_target_workspace_id, v_plan_id, 'active', v_invoice.billing_period, now(), v_paid_through
    )
    on conflict (workspace_id) do update
    set plan_id = excluded.plan_id,
        status = 'active',
        billing_period = excluded.billing_period,
        paid_through_at = excluded.paid_through_at,
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

    if v_invoice.plan_code = 'household' then
      update public.family_heads as heads
      set status = 'active',
          billing_status = 'paid',
          can_add_members = true,
          family_limit = greatest(heads.family_limit, 1),
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
               v_invoice.currency, true, 1,
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

revoke all on function public.submit_family_plan_request(
  uuid, text, integer, text, text, text, numeric, text, date, text, text, text, text, text, bigint
) from public;

grant execute on function public.submit_family_plan_request(
  uuid, text, integer, text, text, text, numeric, text, date, text, text, text, text, text, bigint
) to authenticated;
