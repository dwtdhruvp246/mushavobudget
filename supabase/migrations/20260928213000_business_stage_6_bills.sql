begin;

create table public.business_suppliers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.budget_workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  email text check (email is null or char_length(email) <= 320),
  notes text not null default '' check (char_length(notes) <= 1000),
  status text not null default 'active' check (status in ('active', 'archived')),
  version integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create unique index business_supplier_name_idx on public.business_suppliers(workspace_id, lower(name)) where status = 'active';

create table public.business_bill_schedules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.budget_workspaces(id) on delete cascade,
  supplier_id uuid not null,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  category_id uuid not null,
  dimension_id uuid,
  amount numeric(18,4) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  frequency text not null check (frequency in ('monthly', 'yearly')),
  interval_count integer not null default 1 check (interval_count between 1 and 12),
  starts_on date not null,
  ends_on date,
  remind_days_before integer not null default 3 check (remind_days_before between 0 and 30),
  status text not null default 'active' check (status in ('active', 'stopped')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  constraint business_bill_schedule_supplier_fk foreign key (workspace_id, supplier_id)
    references public.business_suppliers(workspace_id, id) on delete restrict,
  constraint business_bill_schedule_category_fk foreign key (workspace_id, category_id)
    references public.business_categories(workspace_id, id) on delete restrict,
  constraint business_bill_schedule_dimension_fk foreign key (workspace_id, dimension_id)
    references public.business_dimensions(workspace_id, id) on delete restrict,
  constraint business_bill_schedule_dates check (ends_on is null or ends_on >= starts_on)
);

create table public.business_bills (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.budget_workspaces(id) on delete restrict,
  supplier_id uuid not null,
  schedule_id uuid,
  occurrence_number integer,
  source_claim_id uuid,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  reference text check (reference is null or char_length(reference) <= 160),
  category_id uuid not null,
  dimension_id uuid,
  amount numeric(18,4) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  reporting_currency text not null check (reporting_currency ~ '^[A-Z]{3}$'),
  reporting_amount numeric(18,4) not null check (reporting_amount > 0),
  exchange_rate numeric(30,12) not null check (exchange_rate > 0),
  rate_effective_at timestamptz not null,
  rate_provider text not null check (rate_provider in ('identity', 'currencyapi')),
  due_on date not null,
  remind_days_before integer not null default 3 check (remind_days_before between 0 and 30),
  paid_amount numeric(18,4) not null default 0 check (paid_amount >= 0 and paid_amount <= amount),
  status text not null default 'open' check (status in ('open', 'paid', 'cancelled')),
  version integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, schedule_id, occurrence_number),
  unique (source_claim_id),
  constraint business_bill_supplier_fk foreign key (workspace_id, supplier_id)
    references public.business_suppliers(workspace_id, id) on delete restrict,
  constraint business_bill_schedule_fk foreign key (workspace_id, schedule_id)
    references public.business_bill_schedules(workspace_id, id) on delete restrict,
  constraint business_bill_category_fk foreign key (workspace_id, category_id)
    references public.business_categories(workspace_id, id) on delete restrict,
  constraint business_bill_dimension_fk foreign key (workspace_id, dimension_id)
    references public.business_dimensions(workspace_id, id) on delete restrict,
  constraint business_bill_claim_fk foreign key (workspace_id, source_claim_id)
    references public.business_expense_claims(workspace_id, id) on delete restrict,
  constraint business_bill_schedule_sequence check ((schedule_id is null) = (occurrence_number is null)),
  constraint business_bill_status_amount check (status <> 'paid' or paid_amount = amount)
);
create index business_bills_due_idx on public.business_bills(workspace_id, due_on) where status = 'open';
create unique index business_bill_supplier_reference_idx
  on public.business_bills(workspace_id, supplier_id, lower(reference))
  where reference is not null and status <> 'cancelled';

create table public.business_bill_payments (
  id uuid primary key,
  workspace_id uuid not null,
  bill_id uuid not null,
  amount numeric(18,4) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  reporting_amount numeric(18,4) not null check (reporting_amount > 0),
  reporting_currency text not null check (reporting_currency ~ '^[A-Z]{3}$'),
  exchange_rate numeric(30,12) not null check (exchange_rate > 0),
  rate_effective_at timestamptz not null,
  rate_provider text not null check (rate_provider in ('identity', 'currencyapi')),
  paid_at timestamptz not null,
  reference text not null check (char_length(btrim(reference)) between 2 and 160),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  constraint business_bill_payment_bill_fk foreign key (workspace_id, bill_id)
    references public.business_bills(workspace_id, id) on delete restrict
);
create index business_bill_payments_history_idx on public.business_bill_payments(workspace_id, bill_id, paid_at desc);

-- The Owner and finance roles can see Business payables; other roles need an
-- explicit finance grant, and optional member scopes apply to every role.
create function public.business_can_view_bill(p_workspace_id uuid, p_bill_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.business_claims_active(p_workspace_id)
    and public.business_has_permission(p_workspace_id, 'finance.view_all')
    and exists (select 1 from public.business_bills b
      where b.workspace_id = p_workspace_id and b.id = p_bill_id
        and public.business_claim_in_scope(p_workspace_id, b.dimension_id));
$$;

alter table public.business_suppliers enable row level security;
alter table public.business_bill_schedules enable row level security;
alter table public.business_bills enable row level security;
alter table public.business_bill_payments enable row level security;
alter table public.business_suppliers force row level security;
alter table public.business_bill_schedules force row level security;
alter table public.business_bills force row level security;
alter table public.business_bill_payments force row level security;
create policy "Business finance can read suppliers" on public.business_suppliers
for select to authenticated using (public.business_claims_active(workspace_id)
  and public.business_has_permission(workspace_id, 'finance.view_all'));
create policy "Business finance can read schedules" on public.business_bill_schedules
for select to authenticated using (public.business_claims_active(workspace_id)
  and public.business_has_permission(workspace_id, 'finance.view_all')
  and public.business_claim_in_scope(workspace_id, dimension_id));
create policy "Business finance can read bills" on public.business_bills
for select to authenticated using (public.business_can_view_bill(workspace_id, id));
create policy "Business finance can read bill payments" on public.business_bill_payments
for select to authenticated using (public.business_can_view_bill(workspace_id, bill_id));
do $$ declare v_name text;
begin
  foreach v_name in array array['business_suppliers','business_bill_schedules','business_bills','business_bill_payments'] loop
    execute format('create policy "Account must be active" on public.%I as restrictive for all to authenticated using (not public.my_account_suspended()) with check (not public.my_account_suspended())', v_name);
    execute format('create trigger guard_suspended_account_write_trigger before insert or update or delete on public.%I for each row execute function public.guard_suspended_account_write()', v_name);
    execute format('revoke all on public.%I from public, anon, authenticated', v_name);
    execute format('grant select on public.%I to authenticated', v_name);
  end loop;
end $$;

-- A recurring date is anchored to the selected start day. Dates at the end
-- of shorter months are clamped without drifting the next occurrence.
create function public.business_bill_occurrence_date(p_start date, p_frequency text, p_interval integer, p_index integer)
returns date language sql immutable set search_path = public, pg_temp as $$
  select (date_trunc('month', p_start::timestamp)::date
    + make_interval(months => p_index * p_interval * case when p_frequency = 'yearly' then 12 else 1 end))::date
    + least(extract(day from p_start)::integer,
      extract(day from ((date_trunc('month', p_start::timestamp)
        + make_interval(months => (p_index * p_interval * case when p_frequency = 'yearly' then 12 else 1 end) + 1))
        - interval '1 day'))::integer) - 1;
$$;

create function public.generate_business_bill_occurrences(p_reference_date date default current_date, p_workspace_id uuid default null)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row record;
declare v_rate record;
declare v_id uuid;
declare v_created integer := 0;
begin
  for v_row in
    select s.*, w.reporting_currency
    from public.business_bill_schedules s
    join public.workspace_settings w on w.workspace_id = s.workspace_id
    join public.budget_workspaces bw on bw.id = s.workspace_id and bw.status = 'active'
    join public.workspace_subscriptions sub on sub.workspace_id = s.workspace_id
      and sub.status = 'active' and sub.paid_through_at > now()
    where s.status = 'active' and (p_workspace_id is null or s.workspace_id = p_workspace_id)
  loop
    for v_index in 0..240 loop
      -- PG PL/pgSQL integer loop variable is local to the FOR loop.
      if public.business_bill_occurrence_date(v_row.starts_on, v_row.frequency,
          v_row.interval_count, v_index) > p_reference_date + 60 then exit; end if;
      if public.business_bill_occurrence_date(v_row.starts_on, v_row.frequency,
          v_row.interval_count, v_index) >= p_reference_date - 30
        and (v_row.ends_on is null or public.business_bill_occurrence_date(v_row.starts_on,
          v_row.frequency, v_row.interval_count, v_index) <= v_row.ends_on)
      then
        if not exists (select 1 from public.business_bills
          where workspace_id = v_row.workspace_id and schedule_id = v_row.id and occurrence_number = v_index) then
          select * into v_rate from public.latest_exchange_rate(v_row.currency, v_row.reporting_currency, now());
          if v_rate.exchange_rate is null then continue; end if;
          v_id := null;
          insert into public.business_bills (
            workspace_id, supplier_id, schedule_id, occurrence_number, title,
            category_id, dimension_id, amount, currency, reporting_currency,
            reporting_amount, exchange_rate, rate_effective_at, rate_provider,
            due_on, remind_days_before, created_by
          ) values (
            v_row.workspace_id, v_row.supplier_id, v_row.id, v_index, v_row.title,
            v_row.category_id, v_row.dimension_id, v_row.amount, v_row.currency,
            v_row.reporting_currency, round(v_row.amount * v_rate.exchange_rate,4),
            v_rate.exchange_rate, v_rate.rate_effective_at, v_rate.provider,
            public.business_bill_occurrence_date(v_row.starts_on, v_row.frequency,
              v_row.interval_count, v_index), v_row.remind_days_before, v_row.created_by
          ) on conflict (workspace_id, schedule_id, occurrence_number) do nothing
          returning id into v_id;
          if v_id is not null then
            v_created := v_created + 1;
            perform public.business_record_audit_event(v_row.workspace_id, 'bill.generated',
              'business_bill', v_id, '{}'::jsonb, jsonb_build_object('schedule_id', v_row.id));
          end if;
        end if;
      end if;
    end loop;
  end loop;
  return v_created;
end;
$$;

create function public.save_business_supplier(
  p_workspace_id uuid, p_supplier_id uuid, p_name text, p_email text, p_notes text, p_expected_version integer
)
returns public.business_suppliers language plpgsql security definer set search_path = public, pg_temp as $$
declare v_supplier public.business_suppliers%rowtype;
begin
  if not public.business_claims_active(p_workspace_id)
    or not public.business_has_permission(p_workspace_id,'finance.create')
    or not public.business_has_permission(p_workspace_id,'finance.view_all')
    then raise exception 'BUSINESS_BILL_ACCESS_REQUIRED'; end if;
  if char_length(btrim(coalesce(p_name,''))) not between 2 and 160
    or char_length(coalesce(p_email,'')) > 320 or char_length(coalesce(p_notes,'')) > 1000
    then raise exception 'INVALID_BUSINESS_SUPPLIER'; end if;
  if p_supplier_id is null then
    insert into public.business_suppliers(workspace_id,name,email,notes,created_by)
    values(p_workspace_id,btrim(p_name),nullif(btrim(p_email),''),coalesce(p_notes,''),auth.uid())
    returning * into v_supplier;
  else
    update public.business_suppliers set name=btrim(p_name),email=nullif(btrim(p_email),''),
      notes=coalesce(p_notes,''),version=version+1,updated_at=now()
    where workspace_id=p_workspace_id and id=p_supplier_id and status='active'
      and version=p_expected_version returning * into v_supplier;
    if not found then raise exception 'BUSINESS_SUPPLIER_CHANGED'; end if;
  end if;
  perform public.business_record_audit_event(p_workspace_id,'bill.supplier_saved',
    'business_supplier',v_supplier.id,'{}'::jsonb,jsonb_build_object('name',v_supplier.name));
  return v_supplier;
end;
$$;

create function public.create_business_bill(
  p_workspace_id uuid,p_supplier_id uuid,p_title text,p_reference text,
  p_category_id uuid,p_dimension_id uuid,p_amount numeric,p_currency text,
  p_due_on date,p_remind_days_before integer,p_source_claim_id uuid default null,
  p_allow_duplicate boolean default false
)
returns public.business_bills language plpgsql security definer set search_path = public, pg_temp as $$
declare v_bill public.business_bills%rowtype;
declare v_claim public.business_expense_claims%rowtype;
declare v_reporting text;
declare v_rate record;
declare v_currency text := upper(btrim(coalesce(p_currency,'')));
begin
  if not public.business_claims_active(p_workspace_id)
    or not public.business_has_permission(p_workspace_id,'finance.create')
    or not public.business_has_permission(p_workspace_id,'finance.view_all')
    or not public.business_claim_in_scope(p_workspace_id,p_dimension_id)
    then raise exception 'BUSINESS_BILL_ACCESS_REQUIRED'; end if;
  if p_amount is null or p_amount <= 0 or char_length(btrim(coalesce(p_title,''))) not between 2 and 160
    or p_due_on is null or p_remind_days_before not between 0 and 30
    or char_length(coalesce(p_reference,'')) > 160 then raise exception 'INVALID_BUSINESS_BILL'; end if;
  if not exists(select 1 from public.business_suppliers where id=p_supplier_id
    and workspace_id=p_workspace_id and status='active')
    or not exists(select 1 from public.business_categories where id=p_category_id
      and workspace_id=p_workspace_id and status='active' and category_type in ('expense','both'))
    then raise exception 'BUSINESS_BILL_SUPPLIER_OR_CATEGORY_REQUIRED'; end if;
  if p_dimension_id is not null and not exists(select 1 from public.business_dimensions
    where id=p_dimension_id and workspace_id=p_workspace_id and status='active')
    then raise exception 'BUSINESS_DIMENSION_REQUIRED'; end if;
  if p_source_claim_id is not null then
    select * into v_claim from public.business_expense_claims
      where id=p_source_claim_id and workspace_id=p_workspace_id for update;
    if not found or v_claim.kind <> 'company_expense' or v_claim.status <> 'approved'
      or v_claim.amount <> p_amount or v_claim.currency <> v_currency
      or v_claim.dimension_id is distinct from p_dimension_id
      or exists(select 1 from public.business_bills where source_claim_id=p_source_claim_id)
      then raise exception 'BUSINESS_BILL_CLAIM_LINK_INVALID'; end if;
  end if;
  if not p_allow_duplicate and exists(select 1 from public.business_bills
    where workspace_id=p_workspace_id and supplier_id=p_supplier_id and due_on=p_due_on
      and amount=p_amount and status <> 'cancelled')
    then raise exception 'BUSINESS_BILL_POSSIBLE_DUPLICATE'; end if;
  select reporting_currency into v_reporting from public.workspace_settings
    where workspace_id=p_workspace_id and v_currency=any(enabled_currencies);
  if v_reporting is null then raise exception 'BUSINESS_CURRENCY_NOT_ENABLED'; end if;
  select * into v_rate from public.latest_exchange_rate(v_currency,v_reporting,now());
  if v_rate.exchange_rate is null then raise exception 'BUSINESS_EXCHANGE_RATE_UNAVAILABLE'; end if;
  insert into public.business_bills(workspace_id,supplier_id,title,reference,category_id,dimension_id,
    amount,currency,reporting_currency,reporting_amount,exchange_rate,rate_effective_at,rate_provider,
    due_on,remind_days_before,source_claim_id,created_by)
  values(p_workspace_id,p_supplier_id,btrim(p_title),nullif(btrim(p_reference),''),
    p_category_id,p_dimension_id,p_amount,v_currency,v_reporting,
    round(p_amount*v_rate.exchange_rate,4),v_rate.exchange_rate,v_rate.rate_effective_at,
    v_rate.provider,p_due_on,p_remind_days_before,p_source_claim_id,auth.uid())
  returning * into v_bill;
  perform public.business_record_audit_event(p_workspace_id,'bill.created','business_bill',v_bill.id,
    '{}'::jsonb,jsonb_build_object('amount',v_bill.amount,'currency',v_bill.currency,
      'source_claim_id',p_source_claim_id));
  return v_bill;
end;
$$;

create function public.create_business_bill_schedule(
  p_workspace_id uuid,p_supplier_id uuid,p_title text,p_category_id uuid,p_dimension_id uuid,
  p_amount numeric,p_currency text,p_frequency text,p_interval_count integer,
  p_starts_on date,p_ends_on date,p_remind_days_before integer
)
returns public.business_bill_schedules language plpgsql security definer set search_path = public, pg_temp as $$
declare v_schedule public.business_bill_schedules%rowtype;
declare v_reporting text;
begin
  if not public.business_claims_active(p_workspace_id)
    or not public.business_has_permission(p_workspace_id,'finance.create')
    or not public.business_has_permission(p_workspace_id,'finance.view_all')
    or not public.business_claim_in_scope(p_workspace_id,p_dimension_id)
    then raise exception 'BUSINESS_BILL_ACCESS_REQUIRED'; end if;
  if p_frequency not in ('monthly','yearly') or p_interval_count not between 1 and 12
    or p_amount is null or p_amount <= 0 or char_length(btrim(coalesce(p_title,''))) not between 2 and 160
    or p_starts_on is null or p_starts_on < current_date - 30
    or (p_ends_on is not null and p_ends_on < p_starts_on)
    or p_remind_days_before not between 0 and 30
    then raise exception 'INVALID_BUSINESS_BILL_SCHEDULE'; end if;
  if not exists(select 1 from public.business_suppliers where id=p_supplier_id
    and workspace_id=p_workspace_id and status='active')
    or not exists(select 1 from public.business_categories where id=p_category_id
      and workspace_id=p_workspace_id and status='active' and category_type in ('expense','both'))
    then raise exception 'BUSINESS_BILL_SUPPLIER_OR_CATEGORY_REQUIRED'; end if;
  if p_dimension_id is not null and not exists(select 1 from public.business_dimensions
    where id=p_dimension_id and workspace_id=p_workspace_id and status='active')
    then raise exception 'BUSINESS_DIMENSION_REQUIRED'; end if;
  select reporting_currency into v_reporting from public.workspace_settings
    where workspace_id=p_workspace_id and upper(btrim(p_currency))=any(enabled_currencies);
  if v_reporting is null then raise exception 'BUSINESS_CURRENCY_NOT_ENABLED'; end if;
  insert into public.business_bill_schedules(workspace_id,supplier_id,title,category_id,
    dimension_id,amount,currency,frequency,interval_count,starts_on,ends_on,remind_days_before,created_by)
  values(p_workspace_id,p_supplier_id,btrim(p_title),p_category_id,p_dimension_id,p_amount,
    upper(btrim(p_currency)),p_frequency,p_interval_count,p_starts_on,p_ends_on,p_remind_days_before,auth.uid())
  returning * into v_schedule;
  perform public.generate_business_bill_occurrences(current_date,p_workspace_id);
  perform public.business_record_audit_event(p_workspace_id,'bill.schedule_created',
    'business_bill_schedule',v_schedule.id,'{}'::jsonb,jsonb_build_object('frequency',p_frequency));
  return v_schedule;
end;
$$;

create function public.stop_business_bill_schedule(p_workspace_id uuid,p_schedule_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_schedule public.business_bill_schedules%rowtype;
begin
  if not public.business_claims_active(p_workspace_id)
    or not public.business_has_permission(p_workspace_id,'finance.create')
    or not public.business_has_permission(p_workspace_id,'finance.view_all')
    then raise exception 'BUSINESS_BILL_ACCESS_REQUIRED'; end if;
  update public.business_bill_schedules set status='stopped'
    where workspace_id=p_workspace_id and id=p_schedule_id and status='active'
      and public.business_claim_in_scope(p_workspace_id,dimension_id)
    returning * into v_schedule;
  if not found then raise exception 'BUSINESS_BILL_SCHEDULE_NOT_FOUND'; end if;
  update public.business_bills set status='cancelled',version=version+1,updated_at=now()
    where workspace_id=p_workspace_id and schedule_id=p_schedule_id
      and status='open' and paid_amount=0 and due_on>current_date;
  perform public.business_record_audit_event(p_workspace_id,'bill.schedule_stopped',
    'business_bill_schedule',p_schedule_id,'{}'::jsonb,jsonb_build_object('status','stopped'));
end;
$$;

create function public.cancel_business_bill(p_workspace_id uuid,p_bill_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_bill public.business_bills%rowtype;
begin
  if not public.business_claims_active(p_workspace_id)
    or not public.business_has_permission(p_workspace_id,'finance.create')
    or not public.business_has_permission(p_workspace_id,'finance.view_all')
    then raise exception 'BUSINESS_BILL_ACCESS_REQUIRED'; end if;
  update public.business_bills set status='cancelled',version=version+1,updated_at=now()
    where workspace_id=p_workspace_id and id=p_bill_id and status='open' and paid_amount=0
      and public.business_claim_in_scope(p_workspace_id,dimension_id)
    returning * into v_bill;
  if not found then raise exception 'BUSINESS_BILL_CANNOT_CANCEL'; end if;
  perform public.business_record_audit_event(p_workspace_id,'bill.cancelled',
    'business_bill',p_bill_id,'{}'::jsonb,jsonb_build_object('status','cancelled'));
end;
$$;

create function public.record_business_bill_payment(
  p_workspace_id uuid,p_bill_id uuid,p_payment_id uuid,p_amount numeric,
  p_paid_at timestamptz,p_reference text
)
returns public.business_bill_payments language plpgsql security definer set search_path = public, pg_temp as $$
declare v_bill public.business_bills%rowtype;
declare v_payment public.business_bill_payments%rowtype;
declare v_rate record;
begin
  if not public.business_claims_active(p_workspace_id)
    or not public.business_has_permission(p_workspace_id,'finance.record_payment')
    or not public.business_has_permission(p_workspace_id,'finance.view_all')
    then raise exception 'BUSINESS_BILL_PAYMENT_ACCESS_REQUIRED'; end if;
  select * into v_bill from public.business_bills
    where id=p_bill_id and workspace_id=p_workspace_id for update;
  if not found or not public.business_claim_in_scope(p_workspace_id,v_bill.dimension_id)
    then raise exception 'BUSINESS_BILL_PAYMENT_ACCESS_REQUIRED'; end if;
  select * into v_payment from public.business_bill_payments
    where id=p_payment_id and workspace_id=p_workspace_id and bill_id=p_bill_id;
  if found then return v_payment; end if;
  if v_bill.status <> 'open' then raise exception 'BUSINESS_BILL_NOT_OPEN'; end if;
  if p_payment_id is null or p_amount is null or p_amount <= 0
    or p_amount > v_bill.amount-v_bill.paid_amount
    or p_paid_at is null or p_paid_at > now()+interval '5 minutes'
    or char_length(btrim(coalesce(p_reference,''))) not between 2 and 160
    then raise exception 'BUSINESS_BILL_PAYMENT_INVALID'; end if;
  select * into v_rate from public.latest_exchange_rate(v_bill.currency,v_bill.reporting_currency,p_paid_at);
  if v_rate.exchange_rate is null then raise exception 'BUSINESS_EXCHANGE_RATE_UNAVAILABLE'; end if;
  insert into public.business_bill_payments(id,workspace_id,bill_id,amount,currency,
    reporting_amount,reporting_currency,exchange_rate,rate_effective_at,rate_provider,
    paid_at,reference,recorded_by)
  values(p_payment_id,p_workspace_id,p_bill_id,p_amount,v_bill.currency,
    round(p_amount*v_rate.exchange_rate,4),v_bill.reporting_currency,v_rate.exchange_rate,
    v_rate.rate_effective_at,v_rate.provider,p_paid_at,btrim(p_reference),auth.uid())
  returning * into v_payment;
  update public.business_bills set paid_amount=paid_amount+p_amount,
    status=case when paid_amount+p_amount=amount then 'paid' else 'open' end,
    version=version+1,updated_at=now()
    where id=p_bill_id returning * into v_bill;
  perform public.business_record_audit_event(p_workspace_id,'bill.payment_recorded',
    'business_bill',p_bill_id,'{}'::jsonb,jsonb_build_object('payment_id',p_payment_id,
      'amount',p_amount,'remaining',v_bill.amount-v_bill.paid_amount));
  if v_bill.status='paid' and v_bill.source_claim_id is not null then
    update public.business_expense_claims set status='paid',paid_by=auth.uid(),
      paid_at=p_paid_at,payment_reference='Bill '||p_bill_id::text,version=version+1,updated_at=now()
      where id=v_bill.source_claim_id and workspace_id=p_workspace_id and status='approved';
    perform public.business_record_audit_event(p_workspace_id,'expense.paid',
      'business_expense_claim',v_bill.source_claim_id,
      jsonb_build_object('status','approved'),jsonb_build_object('status','paid','bill_id',p_bill_id));
  end if;
  return v_payment;
end;
$$;

-- Prevent a linked claim from being paid through the separate Stage 5 route.
create function public.guard_linked_claim_payment()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status='paid' and old.status <> 'paid'
    and exists(select 1 from public.business_bills
      where source_claim_id=old.id and workspace_id=old.workspace_id and status <> 'paid')
    then raise exception 'BUSINESS_CLAIM_LINKED_TO_BILL'; end if;
  return new;
end;
$$;
create trigger guard_linked_claim_payment_trigger
before update of status on public.business_expense_claims
for each row execute function public.guard_linked_claim_payment();

-- Bill payment totals own linked claim spending. This avoids counting the
-- same expense twice when the bill settles a claim.
create or replace function public.business_claim_summary(p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_summary record;
declare v_currency text;
declare v_finance boolean;
begin
  if not public.business_claims_active(p_workspace_id) then raise exception 'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED'; end if;
  v_finance := public.business_has_permission(p_workspace_id,'finance.view_all');
  select reporting_currency into v_currency from public.workspace_settings where workspace_id=p_workspace_id;
  select
    coalesce(sum(c.reporting_amount) filter (where c.status='paid'),0) as paid_amount,
    coalesce(sum(c.reporting_amount) filter (where c.status='approved'),0) as committed_amount,
    count(*) filter (where c.status='paid') as paid_count,
    count(*) filter (where c.status='submitted') as pending_count,
    count(*) filter (where c.status='submitted' and c.submitted_by<>auth.uid()) as review_count
  into v_summary from public.business_expense_claims c
  where c.workspace_id=p_workspace_id and public.business_can_view_claim(p_workspace_id,c.id)
    and not exists(select 1 from public.business_bills b
      where b.workspace_id=p_workspace_id and b.source_claim_id=c.id and b.status <> 'cancelled');
  return jsonb_build_object('reporting_currency',v_currency,'finance_visible',v_finance,
    'paid_amount',case when v_finance then v_summary.paid_amount else null end,
    'committed_amount',case when v_finance then v_summary.committed_amount else null end,
    'paid_count',case when v_finance then v_summary.paid_count else null end,
    'pending_count',case when v_finance then v_summary.pending_count else null end,
    'review_count',case when public.business_has_permission(p_workspace_id,'approvals.review')
      then v_summary.review_count else 0 end);
end;
$$;

create function public.business_bill_summary(p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_bills record;
declare v_paid numeric;
declare v_currency text;
begin
  if not public.business_claims_active(p_workspace_id)
    or not public.business_has_permission(p_workspace_id,'finance.view_all')
    then raise exception 'BUSINESS_BILL_ACCESS_REQUIRED'; end if;
  select reporting_currency into v_currency from public.workspace_settings where workspace_id=p_workspace_id;
  select count(*) filter(where b.status='open' and b.due_on<current_date) as overdue_count,
    count(*) filter(where b.status='open' and b.due_on between current_date and current_date+30) as due_count,
    coalesce(sum((b.amount-b.paid_amount)*b.exchange_rate) filter(where b.status='open'),0) as outstanding
  into v_bills from public.business_bills b
  where b.workspace_id=p_workspace_id and public.business_can_view_bill(p_workspace_id,b.id);
  select coalesce(sum(p.reporting_amount),0) into v_paid
  from public.business_bill_payments p
  where p.workspace_id=p_workspace_id and public.business_can_view_bill(p_workspace_id,p.bill_id);
  return jsonb_build_object('reporting_currency',v_currency,'overdue_count',v_bills.overdue_count,
    'due_count',v_bills.due_count,'outstanding',round(v_bills.outstanding,4),
    'paid_amount',v_paid);
end;
$$;

alter table public.business_documents drop constraint business_documents_parent_type_check;
alter table public.business_documents add constraint business_documents_parent_type_check
  check(parent_type in ('workspace','profile','dimension','category','expense_claim','business_bill','business_bill_payment'));
create or replace function public.validate_business_document_parent()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.parent_type in ('workspace','profile') then
    if new.parent_id<>new.workspace_id then raise exception 'BUSINESS_DOCUMENT_PARENT_MISMATCH'; end if;
  elsif new.parent_type='dimension' then
    if not exists(select 1 from public.business_dimensions where id=new.parent_id and workspace_id=new.workspace_id)
      then raise exception 'BUSINESS_DOCUMENT_PARENT_MISMATCH'; end if;
  elsif new.parent_type='category' then
    if not exists(select 1 from public.business_categories where id=new.parent_id and workspace_id=new.workspace_id)
      then raise exception 'BUSINESS_DOCUMENT_PARENT_MISMATCH'; end if;
  elsif new.parent_type='expense_claim' then
    if not exists(select 1 from public.business_expense_claims where id=new.parent_id and workspace_id=new.workspace_id)
      then raise exception 'BUSINESS_DOCUMENT_PARENT_MISMATCH'; end if;
  elsif new.parent_type='business_bill' then
    if not exists(select 1 from public.business_bills where id=new.parent_id and workspace_id=new.workspace_id)
      then raise exception 'BUSINESS_DOCUMENT_PARENT_MISMATCH'; end if;
  elsif new.parent_type='business_bill_payment' then
    if not exists(select 1 from public.business_bill_payments where id=new.parent_id and workspace_id=new.workspace_id)
      then raise exception 'BUSINESS_DOCUMENT_PARENT_MISMATCH'; end if;
  end if;
  return new;
end;
$$;

create function public.business_can_view_bill_document(p_workspace_id uuid,p_parent_type text,p_parent_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select case when p_parent_type='business_bill' then public.business_can_view_bill(p_workspace_id,p_parent_id)
    when p_parent_type='business_bill_payment' then exists(select 1 from public.business_bill_payments p
      where p.workspace_id=p_workspace_id and p.id=p_parent_id
        and public.business_can_view_bill(p_workspace_id,p.bill_id))
    else false end;
$$;
create function public.guard_business_bill_document_registration()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.parent_type in ('business_bill','business_bill_payment')
    and (not public.business_can_view_bill_document(new.workspace_id,new.parent_type,new.parent_id)
      or not public.business_has_permission(new.workspace_id,'documents.create'))
    then raise exception 'BUSINESS_BILL_DOCUMENT_ACCESS_REQUIRED'; end if;
  return new;
end;
$$;
create trigger guard_business_bill_document_registration_trigger
before insert on public.business_documents
for each row execute function public.guard_business_bill_document_registration();
create function public.guard_business_bill_proof_archive()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.status='active' and new.status='archived'
    and (old.parent_type='business_bill_payment'
      or (old.parent_type='business_bill' and exists(select 1 from public.business_bills
        where workspace_id=old.workspace_id and id=old.parent_id and paid_amount>0)))
    then raise exception 'BUSINESS_PAYMENT_PROOF_LOCKED'; end if;
  return new;
end;
$$;
create trigger guard_business_bill_proof_archive_trigger
before update of status on public.business_documents
for each row execute function public.guard_business_bill_proof_archive();
drop policy "Business members can read documents" on public.business_documents;
create policy "Business members can read documents" on public.business_documents for select to authenticated
using(status='active' and public.business_claims_active(workspace_id)
  and public.business_has_permission(workspace_id,'documents.view')
  and (case when parent_type='expense_claim' then public.business_can_view_claim(workspace_id,parent_id)
    when parent_type in ('business_bill','business_bill_payment')
      then public.business_can_view_bill_document(workspace_id,parent_type,parent_id)
    else true end));
drop policy "Business members can read registered private documents" on storage.objects;
create policy "Business members can read registered private documents" on storage.objects for select to authenticated
using(bucket_id='business-documents' and exists(select 1 from public.business_documents d
  where d.storage_path=storage.objects.name and d.status='active'
    and d.workspace_id=public.business_storage_workspace_id(storage.objects.name)
    and public.business_claims_active(d.workspace_id)
    and public.business_has_permission(d.workspace_id,'documents.view')
    and (case when d.parent_type='expense_claim' then public.business_can_view_claim(d.workspace_id,d.parent_id)
      when d.parent_type in ('business_bill','business_bill_payment')
        then public.business_can_view_bill_document(d.workspace_id,d.parent_type,d.parent_id)
      else true end)));

alter table public.notification_outbox drop constraint notification_outbox_target_url_check;
alter table public.notification_outbox add constraint notification_outbox_target_url_check
check(char_length(target_url) between 1 and 500 and (
  target_url ~ '^/app[.]html[?]source=push&payment_item=[0-9a-fA-F-]{36}#family/payments$'
  or target_url ~ '^/business[.]html[?]source=push&workspace=[0-9a-fA-F-]{36}&bill=[0-9a-fA-F-]{36}#business/bills$'
));

create function public.business_bill_reminder_allowed(p_bill_id uuid,p_recipient uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.business_bills b
    join public.budget_workspaces w on w.id=b.workspace_id
      and w.workspace_type='business' and w.status='active' and w.owner_id=p_recipient
    join public.workspace_subscriptions sub on sub.workspace_id=w.id
      and sub.status='active' and sub.paid_through_at>now()
    join public.workspace_settings settings on settings.workspace_id=w.id and settings.reminder_enabled
    join public.profiles recipient on recipient.id=p_recipient and recipient.account_status='active'
    join public.workspace_members member on member.workspace_id=w.id
      and member.user_id=p_recipient and member.status='active'
    where b.id=p_bill_id and b.status='open' and b.paid_amount<b.amount);
$$;

create function public.enqueue_due_business_bill_reminders(p_reference_time timestamptz default now())
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row record;
declare v_created uuid;
declare v_count integer := 0;
begin
  for v_row in
    select b.id,b.workspace_id,b.title,b.due_on,b.amount-b.paid_amount as remaining,
      b.currency,b.remind_days_before,w.owner_id,settings.detailed_notification_previews,
      timezone(zone.delivery_timezone,p_reference_time)::date as local_date,
      make_timestamptz(
        extract(year from timezone(zone.delivery_timezone,p_reference_time))::integer,
        extract(month from timezone(zone.delivery_timezone,p_reference_time))::integer,
        extract(day from timezone(zone.delivery_timezone,p_reference_time))::integer,
        extract(hour from settings.reminder_delivery_time)::integer,
        extract(minute from settings.reminder_delivery_time)::integer,
        0,
        zone.delivery_timezone) as delivery_at
    from public.business_bills b
    join public.budget_workspaces w on w.id=b.workspace_id and w.status='active'
    join public.workspace_subscriptions sub on sub.workspace_id=w.id
      and sub.status='active' and sub.paid_through_at>p_reference_time
    join public.workspace_settings settings on settings.workspace_id=w.id and settings.reminder_enabled
    join public.profiles recipient on recipient.id=w.owner_id and recipient.account_status='active'
    join public.workspace_members member on member.workspace_id=w.id
      and member.user_id=w.owner_id and member.status='active'
    left join pg_catalog.pg_timezone_names user_timezone on user_timezone.name=recipient.timezone
    left join pg_catalog.pg_timezone_names workspace_timezone on workspace_timezone.name=settings.timezone
    cross join lateral (select coalesce(user_timezone.name,workspace_timezone.name,'UTC') as delivery_timezone) zone
    where b.status='open' and b.paid_amount<b.amount
  loop
    if v_row.due_on < v_row.local_date
      or v_row.due_on > v_row.local_date + v_row.remind_days_before
      or v_row.delivery_at > p_reference_time then continue; end if;
    v_created := null;
    insert into public.notification_outbox(user_id,workspace_id,source_type,source_id,
      notification_type,scheduled_for,title,body,target_url,idempotency_key,
      status,attempt_count,next_attempt_at)
    values(v_row.owner_id,v_row.workspace_id,'business_bill',v_row.id,
      case when v_row.due_on=v_row.local_date then 'business_bill_due_today' else 'business_bill_due_soon' end,
      v_row.delivery_at,'Business bill reminder',
      case when v_row.detailed_notification_previews
        then left(v_row.title||' · '||v_row.currency||' '||
          trim(to_char(v_row.remaining,'FM999999999999990.00'))||' outstanding.',240)
        else 'A Business bill has an outstanding balance and is due soon.' end,
      '/business.html?source=push&workspace='||v_row.workspace_id||'&bill='||v_row.id||'#business/bills',
      'business_bill:'||v_row.id||':due:'||v_row.due_on||':reminder:'||v_row.local_date,
      'pending',0,v_row.delivery_at)
    on conflict(idempotency_key) do nothing returning id into v_created;
    if v_created is not null then
      insert into public.notifications(user_id,created_by,type,title,body,url)
      values(v_row.owner_id,null,'business_bill','Business bill reminder',
        'A Business bill has an outstanding balance and is due soon.',
        '/business.html?source=push&workspace='||v_row.workspace_id||'&bill='||v_row.id||'#business/bills');
      v_count := v_count+1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.generate_business_bill_occurrences(date,uuid) from public,anon,authenticated;
grant execute on function public.generate_business_bill_occurrences(date,uuid) to service_role;
revoke all on function public.business_bill_reminder_allowed(uuid,uuid) from public,anon,authenticated;
revoke all on function public.enqueue_due_business_bill_reminders(timestamptz) from public,anon,authenticated;
grant execute on function public.business_bill_reminder_allowed(uuid,uuid) to service_role;
grant execute on function public.enqueue_due_business_bill_reminders(timestamptz) to service_role;
revoke all on function public.business_bill_occurrence_date(date,text,integer,integer) from public,anon;
revoke all on function public.business_can_view_bill(uuid,uuid) from public,anon;
revoke all on function public.business_can_view_bill_document(uuid,text,uuid) from public,anon;
grant execute on function public.business_bill_occurrence_date(date,text,integer,integer) to authenticated;
grant execute on function public.business_can_view_bill(uuid,uuid) to authenticated;
grant execute on function public.business_can_view_bill_document(uuid,text,uuid) to authenticated;
do $$ declare v_signature text;
begin
  foreach v_signature in array array[
    'public.save_business_supplier(uuid,uuid,text,text,text,integer)',
    'public.create_business_bill(uuid,uuid,text,text,uuid,uuid,numeric,text,date,integer,uuid,boolean)',
    'public.create_business_bill_schedule(uuid,uuid,text,uuid,uuid,numeric,text,text,integer,date,date,integer)',
    'public.stop_business_bill_schedule(uuid,uuid)',
    'public.cancel_business_bill(uuid,uuid)',
    'public.record_business_bill_payment(uuid,uuid,uuid,numeric,timestamptz,text)',
    'public.business_bill_summary(uuid)'
  ] loop
    execute format('revoke all on function %s from public,anon',v_signature);
    execute format('grant execute on function %s to authenticated',v_signature);
  end loop;
end $$;
revoke all on function public.guard_linked_claim_payment() from public,anon,authenticated;
revoke all on function public.guard_business_bill_document_registration() from public,anon,authenticated;
revoke all on function public.guard_business_bill_proof_archive() from public,anon,authenticated;

notify pgrst, 'reload schema';
commit;
