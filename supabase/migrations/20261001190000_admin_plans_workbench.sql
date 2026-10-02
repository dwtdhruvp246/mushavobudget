begin;

-- One role-checked snapshot supplies the editor and its optimistic save token.
create or replace function public.admin_plan_workbench_snapshot(p_plan_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_data jsonb; v_history jsonb;
begin
  if auth.uid() is null or public.my_account_suspended() or not public.is_platform_staff(array['super_admin','admin_staff']) then raise exception 'PLAN_MANAGEMENT_ACCESS_REQUIRED'; end if;
  select jsonb_build_object('plan',to_jsonb(p),
    'prices',coalesce((select jsonb_agg(to_jsonb(x) order by x.effective_from,x.id) from public.plan_prices x where x.plan_id=p.id),'[]'::jsonb),
    'features',coalesce((select jsonb_agg(to_jsonb(x) order by x.feature_code) from public.plan_features x where x.plan_id=p.id),'[]'::jsonb),
    'limits',coalesce((select jsonb_agg(to_jsonb(x) order by x.limit_code) from public.plan_limits x where x.plan_id=p.id),'[]'::jsonb),
    'business',case when p.workspace_type='business' then (select to_jsonb(x) from public.business_billing_settings x where x.plan_id=p.id) else null end)
    into v_data from public.plans p where p.id=p_plan_id;
  if v_data is null then raise exception 'PLAN_NOT_FOUND'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_history from (
    select a.id,a.action,a.created_at,a.actor_id,a.safe_details from public.subscription_audit_events a
    where (a.target_type='plan' and a.target_id=p_plan_id)
      or (a.target_type='plan_price' and a.target_id in(select id from public.plan_prices where plan_id=p_plan_id))
    order by a.created_at desc limit 50) x;
  return v_data||jsonb_build_object('edit_token',md5(v_data::text),'history',v_history,
    'subscriber_count',(select count(*) from public.workspace_subscriptions where plan_id=p_plan_id),
    'purchase_enabled',public.product_customer_purchase_enabled('business'),
    'creation_enabled',public.product_customer_workspace_creation_enabled('business'));
end;
$$;

-- Plan definition, an optional price, and pilot billing save in one transaction.
create or replace function public.admin_save_plan_workbench(p_plan_id uuid,p_edit_token text,p_definition jsonb,p_business jsonb default null,p_price jsonb default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_old public.plans%rowtype; v_id uuid; v_seats integer; v_price_id uuid; v_start timestamptz; v_now timestamptz:=clock_timestamp(); v_period text; v_currency text; v_amount numeric; v_extra numeric; v_business public.business_billing_settings%rowtype; v_features text[];
begin
  if auth.uid() is null or public.my_account_suspended() or not public.is_platform_staff(array['super_admin','admin_staff']) then raise exception 'PLAN_MANAGEMENT_ACCESS_REQUIRED'; end if;
  if p_definition is null or jsonb_typeof(p_definition)<>'object' then raise exception 'INVALID_PLAN_DEFINITION'; end if;
  if p_plan_id is not null then
    select * into v_old from public.plans where id=p_plan_id for update;
    if v_old.id is null then raise exception 'PLAN_NOT_FOUND'; end if;
    if p_edit_token is distinct from public.admin_plan_workbench_snapshot(p_plan_id)->>'edit_token' then raise exception 'PLAN_SETTINGS_CHANGED'; end if;
    if p_definition->>'workspace_type' is distinct from v_old.workspace_type then raise exception 'PLAN_WORKSPACE_TYPE_CANNOT_CHANGE'; end if;
  end if;
  if p_definition->>'workspace_type'='business' and coalesce((p_definition->>'available_for_purchase')::boolean,false)
    and not public.product_customer_purchase_enabled('business') then raise exception 'BUSINESS_PUBLIC_PURCHASE_CLOSED'; end if;
  if p_definition->>'code'='free' and (p_definition->>'workspace_type'<>'personal' or (p_definition->>'active_payment_limit')::integer is distinct from 5) then raise exception 'FREE_PLAN_LIMIT_REQUIRED'; end if;
  if p_business is not null and p_definition->>'workspace_type'<>'business' then raise exception 'BUSINESS_PLAN_REQUIRED'; end if;
  if p_price is not null and (p_definition->>'workspace_type'='business' or p_definition->>'code'='free') then raise exception 'PLAN_PRICE_NOT_APPLICABLE'; end if;
  v_seats:=coalesce((p_definition->>'included_member_seats')::integer,1);
  -- Business capacity has one authoritative editor: the private billing settings.
  if p_definition->>'workspace_type'='business' and p_plan_id is not null then
    select * into v_business from public.business_billing_settings where plan_id=p_plan_id for update;
    v_seats:=coalesce(v_business.included_seats,1);
  end if;
  if p_definition->'feature_codes' is null or jsonb_typeof(p_definition->'feature_codes')<>'array' then raise exception 'INVALID_PLAN_FEATURES'; end if;
  select coalesce(array_agg(value),array[]::text[]) into v_features from jsonb_array_elements_text(p_definition->'feature_codes');
  v_id:=public.save_plan_definition(p_plan_id,p_definition->>'code',p_definition->>'display_name',p_definition->>'description',p_definition->>'marketing_summary',
    p_definition->>'workspace_type',v_seats,(p_definition->>'active_payment_limit')::integer,(p_definition->>'is_active')::boolean,
    (p_definition->>'is_public')::boolean,(p_definition->>'is_featured')::boolean,(p_definition->>'available_for_purchase')::boolean,
    p_definition->>'cta_label',(p_definition->>'sort_order')::integer,v_features);
  if p_definition->>'workspace_type'='business' then
    if p_business is not null then
      perform public.save_business_billing_settings(v_id,coalesce(v_business.version,1),(p_business->>'pilot_enabled')::boolean,(p_business->>'included_seats')::integer,
        p_business->>'currency',(p_business->>'monthly_base')::numeric,(p_business->>'annual_base')::numeric,(p_business->>'monthly_seat')::numeric,
        (p_business->>'annual_seat')::numeric,p_business->>'payment_instructions');
    else
      -- A descriptive edit must not replace unset/approved Business seat configuration.
      insert into public.plan_limits(plan_id,limit_code,limit_value) values(v_id,'included_member_seats',v_business.included_seats)
        on conflict(plan_id,limit_code) do update set limit_value=excluded.limit_value;
    end if;
  end if;
  if p_price is not null then
    v_period:=p_price->>'billing_period';v_currency:=upper(btrim(p_price->>'currency'));
    v_amount:=(p_price->>'amount')::numeric;v_extra:=(p_price->>'extra_member_amount')::numeric;
    if v_period not in('monthly','annual') or v_period is null or not exists(select 1 from public.supported_currencies where code=v_currency and is_active)
      or v_amount is null or v_amount<=0 or v_amount::text in('NaN','Infinity','-Infinity') or v_extra is null or v_extra<0 or v_extra::text in('NaN','Infinity','-Infinity')
      then raise exception 'INVALID_PLAN_PRICE'; end if;
    v_start:=coalesce(nullif(p_price->>'effective_from','')::timestamptz,v_now);
    if not isfinite(v_start) or v_start<v_now-interval '1 minute' or v_start>v_now+interval '366 days' then raise exception 'INVALID_PRICE_START'; end if;
    v_start:=greatest(v_start,v_now);
    if exists(select 1 from public.plan_prices where plan_id=v_id and currency=v_currency and billing_period=v_period and is_active and effective_from>v_now) then raise exception 'SCHEDULED_PRICE_EXISTS'; end if;
    update public.plan_prices set effective_until=v_start,updated_at=v_now
      where plan_id=v_id and currency=v_currency and billing_period=v_period and is_active and effective_from<=v_start and (effective_until is null or effective_until>v_start);
    insert into public.plan_prices(plan_id,billing_period,currency,amount,extra_member_amount,effective_from)
      values(v_id,v_period,v_currency,v_amount,v_extra,v_start) returning id into v_price_id;
    insert into public.subscription_audit_events(actor_id,action,target_type,target_id,safe_details)
      values(auth.uid(),'plan.price_saved','plan_price',v_price_id,jsonb_build_object('plan_code',p_definition->>'code','effective_from',v_start,'amount',v_amount,'currency',v_currency,'billing_period',v_period));
  end if;
  insert into public.subscription_audit_events(actor_id,action,target_type,target_id,safe_details)
    values(auth.uid(),'plan.workbench_saved','plan',v_id,jsonb_build_object('before',case when p_plan_id is null then null else to_jsonb(v_old) end,'after',(select to_jsonb(p) from public.plans p where id=v_id),'subscriber_effect','Features and payment limits apply on access refresh; paid dates, existing workspace seats and issued invoices are preserved.'));
  return public.admin_plan_workbench_snapshot(v_id);
end;
$$;

create or replace function public.admin_cancel_scheduled_plan_price(p_plan_id uuid,p_price_id uuid,p_edit_token text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_price public.plan_prices%rowtype;
begin
  if auth.uid() is null or public.my_account_suspended() or not public.is_platform_staff(array['super_admin','admin_staff']) then raise exception 'PLAN_MANAGEMENT_ACCESS_REQUIRED'; end if;
  perform 1 from public.plans where id=p_plan_id for update;
  if p_edit_token is distinct from public.admin_plan_workbench_snapshot(p_plan_id)->>'edit_token' then raise exception 'PLAN_SETTINGS_CHANGED'; end if;
  select * into v_price from public.plan_prices where id=p_price_id and plan_id=p_plan_id for update;
  if v_price.id is null or not v_price.is_active or v_price.effective_from<=now() then raise exception 'SCHEDULED_PRICE_REQUIRED'; end if;
  update public.plan_prices set is_active=false,updated_at=clock_timestamp() where id=v_price.id;
  update public.plan_prices set effective_until=null,updated_at=clock_timestamp()
    where plan_id=p_plan_id and billing_period=v_price.billing_period and currency=v_price.currency and is_active and effective_until=v_price.effective_from;
  insert into public.subscription_audit_events(actor_id,action,target_type,target_id,safe_details)
    values(auth.uid(),'plan.scheduled_price_cancelled','plan_price',v_price.id,jsonb_build_object('effective_from',v_price.effective_from));
  return public.admin_plan_workbench_snapshot(p_plan_id);
end;
$$;

-- Pure billing arithmetic shared by actual Family quotes and the admin preview.
create or replace function public.family_extra_place_proration(p_start timestamptz,p_end timestamptz,p_at timestamptz)
returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
declare v_index integer:=0;v_month_start timestamptz:=p_start;v_next timestamptz;v_boundaries integer:=0;v_half boolean;
begin
  if p_start is null or p_end is null or p_at is null or not isfinite(p_start) or not isfinite(p_end) or not isfinite(p_at) or p_end<=p_start or p_at<p_start or p_at>=p_end then raise exception 'INVALID_FAMILY_BILLING_ANCHOR'; end if;
  loop
    v_next:=((p_start at time zone 'UTC')+make_interval(months=>v_index+1)) at time zone 'UTC';exit when v_next>p_at;
    v_index:=v_index+1;v_month_start:=v_next;if v_index>=1200 then raise exception 'INVALID_FAMILY_BILLING_ANCHOR'; end if;
  end loop;
  v_half:=p_at<(((v_month_start at time zone 'UTC')+(v_next-v_month_start)/2) at time zone 'UTC');
  while v_next<=p_end loop
    v_boundaries:=v_boundaries+1;v_index:=v_index+1;v_next:=((p_start at time zone 'UTC')+make_interval(months=>v_index+1)) at time zone 'UTC';
    if v_index>=1200 then raise exception 'INVALID_FAMILY_BILLING_ANCHOR'; end if;
  end loop;
  return jsonb_build_object('full_months_remaining',greatest(v_boundaries-1,0),'current_half_charge',v_half,'factor',greatest(v_boundaries-1,0)+case when v_half then 0.5 else 0 end);
end;
$$;

create or replace function public.admin_plan_calculation_preview(p_workspace_type text,p_base numeric,p_seat_price numeric,p_included integer,p_total integer,p_extra integer,p_start timestamptz,p_end timestamptz,p_at timestamptz,p_period text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_factor numeric;v_family jsonb;v_full numeric;
begin
  if auth.uid() is null or public.my_account_suspended() or not public.is_platform_staff(array['super_admin','admin_staff']) then raise exception 'PLAN_MANAGEMENT_ACCESS_REQUIRED'; end if;
  if p_workspace_type not in('personal','household','business') or p_period not in('monthly','annual') or p_base is null or p_base<0 or p_seat_price is null or p_seat_price<0
    or p_included is null or p_included not between 1 and 100 or p_total is null or p_total not between 1 and 100 or p_extra is null or p_extra not between 1 and 100
    or p_base::text in('NaN','Infinity','-Infinity') or p_seat_price::text in('NaN','Infinity','-Infinity') then raise exception 'INVALID_PREVIEW_VALUES'; end if;
  v_full:=round(p_base+greatest(p_total-p_included,0)*p_seat_price*case when p_workspace_type='household' and p_period='annual' then 12 else 1 end,2);
  if p_workspace_type='business' then v_factor:=public.business_seat_proration(p_start,p_end,p_at);
  elsif p_workspace_type='household' then v_family:=public.family_extra_place_proration(p_start,p_end,p_at);v_factor:=(v_family->>'factor')::numeric;
  else v_factor:=0;end if;
  return jsonb_build_object('subscription_total',v_full,'extra_seat_total',round(p_extra*p_seat_price*v_factor,2),'factor',v_factor,'family',v_family,'expiry',p_end,'preview_only',true);
end;
$$;

revoke all on function public.admin_plan_workbench_snapshot(uuid) from public,anon;
revoke all on function public.admin_save_plan_workbench(uuid,text,jsonb,jsonb,jsonb) from public,anon;
revoke all on function public.admin_cancel_scheduled_plan_price(uuid,uuid,text) from public,anon;
revoke all on function public.admin_plan_calculation_preview(text,numeric,numeric,integer,integer,integer,timestamptz,timestamptz,timestamptz,text) from public,anon;
revoke all on function public.family_extra_place_proration(timestamptz,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.admin_plan_workbench_snapshot(uuid),public.admin_save_plan_workbench(uuid,text,jsonb,jsonb,jsonb),public.admin_cancel_scheduled_plan_price(uuid,uuid,text),public.admin_plan_calculation_preview(text,numeric,numeric,integer,integer,integer,timestamptz,timestamptz,timestamptz,text) to authenticated;

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
  select (x->>'full_months_remaining')::integer,(x->>'current_half_charge')::boolean into v_full_months,v_first_half from (select public.family_extra_place_proration(v_anchor,v_subscription.paid_through_at,now()) as x) q;

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
-- Cached clients use the same plan lock and cannot discard scheduled prices.
create or replace function public.save_plan_price(
  p_plan_code text,
  p_billing_period text,
  p_currency text,
  p_amount numeric,
  p_extra_member_amount numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan_id uuid;
  v_price_id uuid;
begin
  if auth.uid() is null or public.my_account_suspended() or not public.is_platform_staff(array['super_admin', 'admin_staff']) then raise exception 'PLAN_MANAGEMENT_ACCESS_REQUIRED'; end if;
  if p_billing_period is null or p_billing_period not in ('monthly', 'annual') then raise exception 'INVALID_BILLING_PERIOD'; end if;
  if p_amount is null or p_extra_member_amount is null or p_amount <= 0 or p_extra_member_amount < 0 or p_amount::text in ('NaN','Infinity','-Infinity') or p_extra_member_amount::text in ('NaN','Infinity','-Infinity') or not exists(select 1 from public.supported_currencies where code=upper(p_currency) and is_active) then raise exception 'INVALID_PLAN_PRICE'; end if;
  select id into v_plan_id from public.plans where code = lower(p_plan_code) and code <> 'free' and workspace_type<>'business' for update;
  if v_plan_id is null then raise exception 'PAID_PLAN_NOT_FOUND'; end if;

  if exists(select 1 from public.plan_prices where plan_id=v_plan_id and billing_period=p_billing_period and currency=upper(p_currency) and is_active and effective_from>now()) then raise exception 'SCHEDULED_PRICE_EXISTS'; end if;

  update public.plan_prices set is_active = false, effective_until = now(), updated_at = now()
  where plan_id = v_plan_id and billing_period = p_billing_period and currency = upper(p_currency) and is_active;

  insert into public.plan_prices (plan_id, billing_period, currency, amount, extra_member_amount)
  values (v_plan_id, p_billing_period, upper(p_currency), p_amount, p_extra_member_amount)
  returning id into v_price_id;

  insert into public.subscription_audit_events (actor_id, action, target_type, target_id, safe_details)
  values (auth.uid(), 'plan.price_saved', 'plan_price', v_price_id,
          jsonb_build_object('plan_code', lower(p_plan_code), 'billing_period', p_billing_period, 'currency', upper(p_currency)));
  return v_price_id;
end;
$$;

-- Owner billing snapshots refresh when their private plan settings change.
create or replace function public.signal_business_plan_billing_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_workspace uuid;
begin
  if new is not distinct from old then return new; end if;
  for v_workspace in select distinct workspace_id from public.workspace_subscriptions where plan_id=new.plan_id
    loop perform public.emit_business_change_signal(v_workspace,false); end loop;
  return new;
end;
$$;
revoke all on function public.signal_business_plan_billing_change() from public,anon,authenticated;
drop trigger if exists signal_business_plan_billing_change_trigger on public.business_billing_settings;
create trigger signal_business_plan_billing_change_trigger after update on public.business_billing_settings
for each row execute function public.signal_business_plan_billing_change();

notify pgrst, 'reload schema';
commit;
