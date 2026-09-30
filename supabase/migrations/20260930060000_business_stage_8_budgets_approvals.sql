begin;

-- Budgets are planning targets in the immutable workspace reporting currency.
-- Overlapping category/organisation targets are independent; never add them up.
create table public.business_budgets (
  id uuid primary key,
  workspace_id uuid not null references public.budget_workspaces(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  category_id uuid,
  dimension_id uuid,
  starts_on date not null,
  ends_on date not null check (ends_on>=starts_on),
  period_type text not null check (period_type in ('monthly','custom')),
  planned_amount numeric(18,4) not null check (planned_amount>0),
  reporting_currency text not null check (reporting_currency ~ '^[A-Z]{3}$'),
  status text not null default 'draft' check (status in ('draft','active','closed','archived')),
  version integer not null default 1 check (version>0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  transition_reason text,
  unique(workspace_id,id),
  constraint business_budget_category_fk foreign key(workspace_id,category_id)
    references public.business_categories(workspace_id,id) on delete restrict,
  constraint business_budget_dimension_fk foreign key(workspace_id,dimension_id)
    references public.business_dimensions(workspace_id,id) on delete restrict
);
create index business_budgets_period_idx on public.business_budgets(workspace_id,status,starts_on,ends_on);

create table public.business_spending_requests (
  id uuid primary key,
  workspace_id uuid not null references public.budget_workspaces(id) on delete restrict,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  description text not null check (char_length(btrim(description)) between 2 and 2000),
  category_id uuid not null,
  dimension_id uuid,
  amount numeric(18,4) not null check (amount>0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  reporting_currency text not null check (reporting_currency ~ '^[A-Z]{3}$'),
  reporting_amount numeric(18,4) not null check (reporting_amount>0),
  exchange_rate numeric(30,12) not null check (exchange_rate>0),
  rate_effective_at timestamptz not null,
  rate_provider text not null check (rate_provider in ('identity','currencyapi')),
  planned_on date not null,
  status text not null default 'draft' check (status in
    ('draft','submitted','changes_requested','approved','rejected','cancelled','committed','fulfilled')),
  version integer not null default 1 check (version>0),
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_reason text,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,id),
  constraint business_request_category_fk foreign key(workspace_id,category_id)
    references public.business_categories(workspace_id,id) on delete restrict,
  constraint business_request_dimension_fk foreign key(workspace_id,dimension_id)
    references public.business_dimensions(workspace_id,id) on delete restrict,
  constraint business_request_cancel_reason check (status<>'cancelled' or
    (cancelled_at is not null and cancelled_by is not null and char_length(btrim(cancel_reason)) between 2 and 1000))
);
create index business_requests_queue_idx on public.business_spending_requests(workspace_id,status,planned_on);
alter table public.business_bills add column source_request_id uuid,
  add constraint business_bill_request_fk foreign key(workspace_id,source_request_id)
    references public.business_spending_requests(workspace_id,id) on delete restrict,
  add constraint business_bill_single_source check (source_request_id is null or source_claim_id is null);
create unique index business_bill_request_active_idx on public.business_bills(workspace_id,source_request_id)
  where source_request_id is not null and status<>'cancelled';

-- Non-finance users need an explicitly assigned organisation scope for budgets.
-- A budgets.view grant never exposes a company-wide total to Staff/Team Managers.
create function public.business_budget_scope(p_workspace_id uuid,p_dimension_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.business_claims_active(p_workspace_id)
    and public.business_claim_in_scope(p_workspace_id,p_dimension_id)
    and (public.business_has_permission(p_workspace_id,'finance.view_all')
      or (p_dimension_id is not null and exists(select 1 from public.workspace_members m
        join public.business_member_scopes s on s.workspace_id=m.workspace_id and s.member_id=m.id
        where m.workspace_id=p_workspace_id and m.user_id=auth.uid() and m.status='active'
          and s.dimension_id=p_dimension_id)));
$$;
create function public.business_can_view_budget(p_workspace_id uuid,p_budget_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.business_has_permission(p_workspace_id,'budgets.view')
    and exists(select 1 from public.business_budgets b where b.workspace_id=p_workspace_id and b.id=p_budget_id
      and public.business_budget_scope(p_workspace_id,b.dimension_id));
$$;
create function public.business_can_view_request(p_workspace_id uuid,p_request_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.business_claims_active(p_workspace_id) and exists(select 1 from public.business_spending_requests r
    where r.workspace_id=p_workspace_id and r.id=p_request_id
      and (r.submitted_by=auth.uid() or (public.business_claim_in_scope(p_workspace_id,r.dimension_id)
        and (public.business_has_permission(p_workspace_id,'finance.view_all')
          or public.business_has_permission(p_workspace_id,'approvals.view')
          or public.business_has_permission(p_workspace_id,'approvals.review')))));
$$;
do $$ declare v_table text;
begin
  foreach v_table in array array['business_budgets','business_spending_requests'] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('alter table public.%I force row level security',v_table);
    execute format('create policy "Active account required" on public.%I as restrictive for all to authenticated
      using(not public.my_account_suspended()) with check(not public.my_account_suspended())',v_table);
    execute format('create trigger guard_suspended_account_write_trigger before insert or update or delete
      on public.%I for each row execute function public.guard_suspended_account_write()',v_table);
    execute format('revoke all on public.%I from public,anon,authenticated',v_table);
    execute format('grant select on public.%I to authenticated',v_table);
  end loop;
end $$;
create policy "Scoped budget reads" on public.business_budgets for select to authenticated
  using(public.business_can_view_budget(workspace_id,id));
create policy "Own or scoped request reads" on public.business_spending_requests for select to authenticated
  using(public.business_can_view_request(workspace_id,id));

create or replace function public.lock_business_claim_reporting_currency()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.reporting_currency is distinct from old.reporting_currency and (
    exists(select 1 from public.business_expense_claims where workspace_id=old.workspace_id)
    or exists(select 1 from public.business_bills where workspace_id=old.workspace_id)
    or exists(select 1 from public.business_bill_schedules where workspace_id=old.workspace_id)
    or exists(select 1 from public.business_income_receipts where workspace_id=old.workspace_id)
    or exists(select 1 from public.business_budgets where workspace_id=old.workspace_id)
    or exists(select 1 from public.business_spending_requests where workspace_id=old.workspace_id))
    then raise exception 'BUSINESS_REPORTING_CURRENCY_LOCKED'; end if;
  return new;
end;
$$;

create function public.save_business_budget(p_workspace_id uuid,p_budget_id uuid,p_expected_version integer,
  p_name text,p_category_id uuid,p_dimension_id uuid,p_starts_on date,p_ends_on date,
  p_period_type text,p_planned_amount numeric)
returns public.business_budgets language plpgsql security definer set search_path=public,pg_temp as $$
declare v_budget public.business_budgets%rowtype;
declare v_settings public.workspace_settings%rowtype;
declare v_day integer;
begin
  if not public.business_has_permission(p_workspace_id,'budgets.manage')
    or not public.business_has_permission(p_workspace_id,'budgets.view')
    or not public.business_budget_scope(p_workspace_id,p_dimension_id)
    then raise exception 'BUSINESS_BUDGET_ACCESS_REQUIRED'; end if;
  select * into v_settings from public.workspace_settings where workspace_id=p_workspace_id for share;
  if not found then raise exception 'BUSINESS_SETUP_INCOMPLETE'; end if;
  perform pg_advisory_xact_lock(hashtextextended('business-budget:'||p_workspace_id::text,0));
  if p_budget_id is null or p_planned_amount is null or p_planned_amount<=0 or p_planned_amount>99999999999999
    or char_length(btrim(coalesce(p_name,''))) not between 2 and 160
    or p_starts_on is null or p_ends_on is null or p_ends_on<p_starts_on
    or p_ends_on-p_starts_on>3660 or p_period_type is null or p_period_type not in ('monthly','custom')
    then raise exception 'INVALID_BUSINESS_BUDGET'; end if;
  if p_period_type='monthly' then
    select period_start_day into v_day from public.business_profiles where workspace_id=p_workspace_id;
    if extract(day from p_starts_on)<>coalesce(v_day,1)
      or p_ends_on<>(p_starts_on+interval '1 month')::date-1
      then raise exception 'BUSINESS_MONTHLY_PERIOD_REQUIRED'; end if;
  end if;
  if p_category_id is not null and not exists(select 1 from public.business_categories
    where workspace_id=p_workspace_id and id=p_category_id and status='active' and category_type in ('expense','both'))
    then raise exception 'BUSINESS_EXPENSE_CATEGORY_REQUIRED'; end if;
  if p_dimension_id is not null and not exists(select 1 from public.business_dimensions
    where workspace_id=p_workspace_id and id=p_dimension_id and status='active')
    then raise exception 'BUSINESS_DIMENSION_REQUIRED'; end if;
  select * into v_budget from public.business_budgets where id=p_budget_id for update;
  if found then
    if v_budget.workspace_id<>p_workspace_id or not public.business_can_view_budget(p_workspace_id,p_budget_id)
      then raise exception 'BUSINESS_BUDGET_ACCESS_REQUIRED'; end if;
    if p_expected_version is null then return v_budget; end if;
    if v_budget.version<>p_expected_version or v_budget.status<>'draft'
      then raise exception 'BUSINESS_BUDGET_CHANGED'; end if;
    update public.business_budgets set name=btrim(p_name),category_id=p_category_id,dimension_id=p_dimension_id,
      starts_on=p_starts_on,ends_on=p_ends_on,period_type=p_period_type,planned_amount=p_planned_amount,
      version=version+1,updated_at=now() where id=p_budget_id returning * into v_budget;
  else
    if p_expected_version is not null then raise exception 'BUSINESS_BUDGET_CHANGED'; end if;
    insert into public.business_budgets(id,workspace_id,name,category_id,dimension_id,starts_on,ends_on,
      period_type,planned_amount,reporting_currency,created_by)
    values(p_budget_id,p_workspace_id,btrim(p_name),p_category_id,p_dimension_id,p_starts_on,p_ends_on,
      p_period_type,p_planned_amount,v_settings.reporting_currency,auth.uid()) returning * into v_budget;
  end if;
  perform public.business_record_audit_event(p_workspace_id,'budget.saved','business_budget',v_budget.id,
    '{}'::jsonb,jsonb_build_object('planned',v_budget.planned_amount,'starts_on',v_budget.starts_on,
      'ends_on',v_budget.ends_on,'category_id',v_budget.category_id,'dimension_id',v_budget.dimension_id));
  return v_budget;
end;
$$;
create function public.transition_business_budget(p_workspace_id uuid,p_budget_id uuid,p_expected_version integer,
  p_status text,p_reason text default null)
returns public.business_budgets language plpgsql security definer set search_path=public,pg_temp as $$
declare v_budget public.business_budgets%rowtype;
begin
  if not public.business_can_view_budget(p_workspace_id,p_budget_id)
    or not public.business_has_permission(p_workspace_id,'budgets.manage')
    then raise exception 'BUSINESS_BUDGET_ACCESS_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('business-budget:'||p_workspace_id::text,0));
  select * into v_budget from public.business_budgets where workspace_id=p_workspace_id and id=p_budget_id for update;
  if v_budget.version is distinct from p_expected_version or p_status is null or not (
    (v_budget.status='draft' and p_status in ('active','archived'))
    or (v_budget.status='active' and p_status='closed') or (v_budget.status='closed' and p_status='archived'))
    then raise exception 'BUSINESS_BUDGET_CHANGED'; end if;
  if p_status<>'active' and char_length(btrim(coalesce(p_reason,''))) not between 2 and 1000
    then raise exception 'BUSINESS_DECISION_REASON_REQUIRED'; end if;
  if p_status='active' and ((v_budget.category_id is not null and not exists(select 1 from public.business_categories
    where workspace_id=p_workspace_id and id=v_budget.category_id and status='active' and category_type in ('expense','both')))
    or (v_budget.dimension_id is not null and not exists(select 1 from public.business_dimensions
    where workspace_id=p_workspace_id and id=v_budget.dimension_id and status='active')))
    then raise exception 'BUSINESS_BUDGET_SCOPE_INACTIVE'; end if;
  if p_status='active' and exists(select 1 from public.business_budgets b
    where b.workspace_id=p_workspace_id and b.id<>p_budget_id and b.status='active'
      and b.category_id is not distinct from v_budget.category_id and b.dimension_id is not distinct from v_budget.dimension_id
      and b.starts_on<=v_budget.ends_on and b.ends_on>=v_budget.starts_on)
    then raise exception 'BUSINESS_BUDGET_PERIOD_OVERLAP'; end if;
  update public.business_budgets set status=p_status,transition_reason=nullif(btrim(p_reason),''),
    version=version+1,updated_at=now() where id=p_budget_id returning * into v_budget;
  perform public.business_record_audit_event(p_workspace_id,'budget.status_changed','business_budget',p_budget_id,
    '{}'::jsonb,jsonb_build_object('status',p_status),p_reason);
  return v_budget;
end;
$$;

create function public.save_business_spending_request(p_workspace_id uuid,p_request_id uuid,p_expected_version integer,
  p_title text,p_description text,p_category_id uuid,p_dimension_id uuid,p_amount numeric,p_currency text,p_planned_on date)
returns public.business_spending_requests language plpgsql security definer set search_path=public,pg_temp as $$
declare v_request public.business_spending_requests%rowtype;
declare v_settings public.workspace_settings%rowtype;
declare v_rate record;
declare v_currency text:=upper(btrim(coalesce(p_currency,'')));
begin
  if not public.business_claims_active(p_workspace_id) or not public.business_has_permission(p_workspace_id,'finance.create')
    or not public.business_claim_in_scope(p_workspace_id,p_dimension_id)
    then raise exception 'BUSINESS_REQUEST_ACCESS_REQUIRED'; end if;
  select * into v_settings from public.workspace_settings where workspace_id=p_workspace_id for share;
  if not found then raise exception 'BUSINESS_SETUP_INCOMPLETE'; end if;
  if p_request_id is null or p_amount is null or p_amount<=0 or p_amount>99999999999999 or p_planned_on is null
    or char_length(btrim(coalesce(p_title,''))) not between 2 and 160
    or char_length(btrim(coalesce(p_description,''))) not between 2 and 2000
    then raise exception 'INVALID_BUSINESS_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_request from public.business_spending_requests where id=p_request_id for update;
  if found then
    if v_request.workspace_id<>p_workspace_id or v_request.submitted_by<>auth.uid()
      then raise exception 'BUSINESS_REQUEST_ACCESS_REQUIRED'; end if;
    if p_expected_version is null then return v_request; end if;
    if v_request.version<>p_expected_version or v_request.status not in ('draft','changes_requested')
      then raise exception 'BUSINESS_REQUEST_CHANGED'; end if;
  elsif p_expected_version is not null then raise exception 'BUSINESS_REQUEST_CHANGED'; end if;
  if not exists(select 1 from public.business_categories where workspace_id=p_workspace_id and id=p_category_id
    and status='active' and category_type in ('expense','both')) then raise exception 'BUSINESS_EXPENSE_CATEGORY_REQUIRED'; end if;
  if p_dimension_id is not null and not exists(select 1 from public.business_dimensions where workspace_id=p_workspace_id
    and id=p_dimension_id and status='active') then raise exception 'BUSINESS_DIMENSION_REQUIRED'; end if;
  if not v_currency=any(v_settings.enabled_currencies) then raise exception 'BUSINESS_CURRENCY_NOT_ENABLED'; end if;
  select * into v_rate from public.latest_exchange_rate(v_currency,v_settings.reporting_currency,now());
  if v_rate.exchange_rate is null then raise exception 'BUSINESS_EXCHANGE_RATE_UNAVAILABLE'; end if;
  if v_request.id is null then
    insert into public.business_spending_requests(id,workspace_id,submitted_by,title,description,category_id,dimension_id,
      amount,currency,reporting_currency,reporting_amount,exchange_rate,rate_effective_at,rate_provider,planned_on)
    values(p_request_id,p_workspace_id,auth.uid(),btrim(p_title),btrim(p_description),p_category_id,p_dimension_id,
      p_amount,v_currency,v_settings.reporting_currency,round(p_amount*v_rate.exchange_rate,4),v_rate.exchange_rate,
      v_rate.rate_effective_at,v_rate.provider,p_planned_on) returning * into v_request;
  else
    update public.business_spending_requests set title=btrim(p_title),description=btrim(p_description),
      category_id=p_category_id,dimension_id=p_dimension_id,amount=p_amount,currency=v_currency,
      reporting_amount=round(p_amount*v_rate.exchange_rate,4),exchange_rate=v_rate.exchange_rate,
      rate_effective_at=v_rate.rate_effective_at,rate_provider=v_rate.provider,planned_on=p_planned_on,
      version=version+1,updated_at=now() where id=p_request_id returning * into v_request;
  end if;
  perform public.business_record_audit_event(p_workspace_id,'request.saved','business_spending_request',p_request_id,
    '{}'::jsonb,jsonb_build_object('amount',v_request.amount,'currency',v_request.currency,'planned_on',v_request.planned_on));
  return v_request;
end;
$$;
create function public.transition_business_request(p_workspace_id uuid,p_request_id uuid,p_expected_version integer,
  p_action text,p_reason text default null)
returns public.business_spending_requests language plpgsql security definer set search_path=public,pg_temp as $$
declare v_request public.business_spending_requests%rowtype;
declare v_before text;
begin
  if not public.business_can_view_request(p_workspace_id,p_request_id) then raise exception 'BUSINESS_REQUEST_ACCESS_REQUIRED'; end if;
  select * into v_request from public.business_spending_requests where workspace_id=p_workspace_id and id=p_request_id for update;
  if v_request.version is distinct from p_expected_version then raise exception 'BUSINESS_REQUEST_CHANGED'; end if;
  v_before:=v_request.status;
  if p_action='submit' then
    if v_request.submitted_by<>auth.uid() or v_request.status not in ('draft','changes_requested')
      or not public.business_has_permission(p_workspace_id,'finance.create')
      or not public.business_claim_in_scope(p_workspace_id,v_request.dimension_id)
      then raise exception 'BUSINESS_REQUEST_CHANGED'; end if;
    update public.business_spending_requests set status='submitted',submitted_at=now(),review_reason=null,
      reviewed_by=null,reviewed_at=null,version=version+1,updated_at=now() where id=p_request_id returning * into v_request;
  elsif p_action in ('approved','rejected','changes_requested') then
    if not public.business_has_permission(p_workspace_id,'approvals.review')
      or not public.business_claim_in_scope(p_workspace_id,v_request.dimension_id)
      then raise exception 'BUSINESS_REVIEW_ACCESS_REQUIRED'; end if;
    if v_request.submitted_by=auth.uid() then raise exception 'BUSINESS_SELF_APPROVAL_FORBIDDEN'; end if;
    if v_request.status<>'submitted' then raise exception 'BUSINESS_REQUEST_CHANGED'; end if;
    if (p_action<>'approved' and char_length(btrim(coalesce(p_reason,''))) not between 2 and 1000)
      or char_length(coalesce(p_reason,''))>1000 then raise exception 'BUSINESS_DECISION_REASON_REQUIRED'; end if;
    update public.business_spending_requests set status=p_action,review_reason=nullif(btrim(p_reason),''),
      reviewed_by=auth.uid(),reviewed_at=now(),version=version+1,updated_at=now() where id=p_request_id returning * into v_request;
    insert into public.notifications(user_id,created_by,type,title,body) values(v_request.submitted_by,auth.uid(),
      'business_request','Business spending request reviewed','Your spending request was '||replace(p_action,'_',' ')||'.');
  elsif p_action='cancel' then
    if v_request.status not in ('draft','submitted','changes_requested','approved')
      or not (v_request.submitted_by=auth.uid() or
        (public.business_has_permission(p_workspace_id,'approvals.review') and public.business_claim_in_scope(p_workspace_id,v_request.dimension_id)))
      then raise exception 'BUSINESS_REQUEST_CANNOT_CANCEL'; end if;
    if char_length(btrim(coalesce(p_reason,''))) not between 2 and 1000 then raise exception 'BUSINESS_DECISION_REASON_REQUIRED'; end if;
    if exists(select 1 from public.business_bills where workspace_id=p_workspace_id and source_request_id=p_request_id and status<>'cancelled')
      then raise exception 'BUSINESS_REQUEST_LINKED_TO_BILL'; end if;
    update public.business_spending_requests set status='cancelled',cancel_reason=btrim(p_reason),cancelled_by=auth.uid(),
      cancelled_at=now(),version=version+1,updated_at=now() where id=p_request_id returning * into v_request;
  else raise exception 'INVALID_BUSINESS_REQUEST_ACTION'; end if;
  perform public.business_record_audit_event(p_workspace_id,'request.'||p_action,'business_spending_request',p_request_id,
    jsonb_build_object('status',v_before),jsonb_build_object('status',v_request.status),p_reason);
  return v_request;
end;
$$;

-- Consistent lock order: bills before requests. Request decisions never lock bills.
-- Linking is serialized with an advisory lock before creating the new bill.
create function public.guard_business_request_bill_link()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_request public.business_spending_requests%rowtype;
begin
  if tg_op='UPDATE' and old.source_request_id is not null and new.source_request_id is distinct from old.source_request_id
    then raise exception 'BUSINESS_REQUEST_LINK_LOCKED'; end if;
  if new.source_request_id is null then return new; end if;
  select * into v_request from public.business_spending_requests where workspace_id=new.workspace_id and id=new.source_request_id for update;
  if not found or v_request.status not in ('approved','committed','fulfilled')
    or new.source_claim_id is not null or new.amount<>v_request.amount or new.currency<>v_request.currency
    or new.category_id<>v_request.category_id or new.dimension_id is distinct from v_request.dimension_id
    or new.reporting_currency<>v_request.reporting_currency or new.reporting_amount<>v_request.reporting_amount
    or new.exchange_rate<>v_request.exchange_rate or new.rate_effective_at<>v_request.rate_effective_at
    or new.rate_provider<>v_request.rate_provider
    then raise exception 'BUSINESS_REQUEST_BILL_LINK_INVALID'; end if;
  return new;
end;
$$;
create trigger guard_business_request_bill_link_trigger before insert or update of source_request_id,amount,currency,category_id,dimension_id,reporting_currency,reporting_amount,exchange_rate,rate_effective_at,rate_provider
  on public.business_bills for each row execute function public.guard_business_request_bill_link();
create function public.sync_business_request_bill_state()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_status text;
declare v_changed uuid;
begin
  if new.source_request_id is null then return new; end if;
  v_status:=case when new.status='paid' then 'fulfilled' when new.status='cancelled' then 'approved' else 'committed' end;
  update public.business_spending_requests set status=v_status,version=version+1,updated_at=now()
    where workspace_id=new.workspace_id and id=new.source_request_id and status<>v_status returning id into v_changed;
  if v_changed is not null then
    perform public.business_record_audit_event(new.workspace_id,'request.bill_state','business_spending_request',new.source_request_id,
      '{}'::jsonb,jsonb_build_object('status',v_status,'bill_id',new.id));
  end if;
  return new;
end;
$$;
create trigger sync_business_request_bill_state_trigger after insert or update of source_request_id,status
  on public.business_bills for each row execute function public.sync_business_request_bill_state();
create function public.create_business_bill_from_request(p_workspace_id uuid,p_request_id uuid,p_supplier_id uuid,
  p_reference text,p_due_on date,p_remind_days_before integer default 3)
returns public.business_bills language plpgsql security definer set search_path=public,pg_temp as $$
declare v_request public.business_spending_requests%rowtype;
declare v_bill public.business_bills%rowtype;
begin
  if not public.business_can_view_request(p_workspace_id,p_request_id)
    or not public.business_has_permission(p_workspace_id,'finance.create')
    or not public.business_has_permission(p_workspace_id,'finance.view_all')
    then raise exception 'BUSINESS_REQUEST_ACCESS_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('request-bill:'||p_request_id::text,0));
  select * into v_request from public.business_spending_requests where workspace_id=p_workspace_id and id=p_request_id;
  if not public.business_claim_in_scope(p_workspace_id,v_request.dimension_id) then raise exception 'BUSINESS_SCOPE_ACCESS_REQUIRED'; end if;
  select * into v_bill from public.business_bills where workspace_id=p_workspace_id and source_request_id=p_request_id and status<>'cancelled';
  if found then return v_bill; end if;
  if v_request.status<>'approved' then raise exception 'BUSINESS_REQUEST_CHANGED'; end if;
  v_bill:=public.create_business_bill(p_workspace_id,p_supplier_id,v_request.title,p_reference,v_request.category_id,
    v_request.dimension_id,v_request.amount,v_request.currency,p_due_on,p_remind_days_before,null,false);
  update public.business_bills set source_request_id=p_request_id,reporting_currency=v_request.reporting_currency,
    reporting_amount=v_request.reporting_amount,exchange_rate=v_request.exchange_rate,
    rate_effective_at=v_request.rate_effective_at,rate_provider=v_request.rate_provider
    where id=v_bill.id returning * into v_bill;
  perform public.business_record_audit_event(p_workspace_id,'request.bill_linked','business_spending_request',p_request_id,
    '{}'::jsonb,jsonb_build_object('bill_id',v_bill.id));
  return v_bill;
end;
$$;

create function public.business_request_feed(p_workspace_id uuid,p_search text default '',p_status text default '',
  p_offset integer default 0,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if not public.business_claims_active(p_workspace_id) then raise exception 'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED'; end if;
  if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 or char_length(coalesce(p_search,''))>160
    then raise exception 'INVALID_BUSINESS_ACTIVITY_FILTER'; end if;
  with visible as materialized(select r.*,coalesce(p.full_name,'Member') as submitter_name,
    (select b.id from public.business_bills b where b.workspace_id=p_workspace_id and b.source_request_id=r.id and b.status<>'cancelled') as bill_id
    from public.business_spending_requests r left join public.profiles p on p.id=r.submitted_by
    where r.workspace_id=p_workspace_id and public.business_can_view_request(p_workspace_id,r.id)),
  matched as materialized(select * from visible where (coalesce(p_search,'')='' or strpos(lower(title||' '||description),lower(p_search))>0)
    and (coalesce(p_status,'')='' or status=p_status)),
  page as(select * from matched order by created_at desc,id offset p_offset limit p_limit)
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id) from page),'[]'::jsonb),
    'total_count',(select count(*) from matched),
    'review_count',(select count(*) from visible where status='submitted' and submitted_by<>auth.uid()
      and public.business_has_permission(p_workspace_id,'approvals.review') and public.business_claim_in_scope(p_workspace_id,dimension_id))) into v_result;
  return v_result;
end;
$$;
create function public.business_request_detail(p_workspace_id uuid,p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not public.business_can_view_request(p_workspace_id,p_request_id) then raise exception 'BUSINESS_REQUEST_ACCESS_REQUIRED'; end if;
  return jsonb_build_object('request',(select to_jsonb(r) from public.business_spending_requests r where r.workspace_id=p_workspace_id and r.id=p_request_id),
    'bill_id',(select id from public.business_bills where workspace_id=p_workspace_id and source_request_id=p_request_id and status<>'cancelled'),
    'history',coalesce((select jsonb_agg(jsonb_build_object('action',action,'actor_id',actor_id,'reason',reason,'created_at',created_at)
      order by created_at,id) from public.business_audit_events where workspace_id=p_workspace_id
        and target_type='business_spending_request' and target_id=p_request_id),'[]'::jsonb));
end;
$$;

-- Internal budget sources use the budget's explicit scope rather than the
-- caller's general finance role. Scope-limited budget users see exact sources
-- for that budget only, including supplier payments they cannot edit.
create function public.business_budget_rows(p_workspace_id uuid,p_budget_id uuid)
returns table(entry_key text,record_type text,record_id uuid,parent_id uuid,title text,event_date date,
  status text,amount numeric,currency text,reporting_amount numeric,paid_value numeric,commitment_value numeric)
language sql stable security definer set search_path=public,pg_temp as $$
  with scope as(select * from public.business_budgets where workspace_id=p_workspace_id and id=p_budget_id
    and public.business_can_view_budget(p_workspace_id,p_budget_id)),
  rows as(
    select 'request:'||r.id as entry_key,'spending_request'::text as record_type,r.id as record_id,null::uuid as parent_id,
      r.title,r.planned_on as event_date,r.status,r.amount,r.currency,r.reporting_amount,0::numeric as paid_value,r.reporting_amount as commitment_value,
      r.category_id,r.dimension_id from public.business_spending_requests r where r.workspace_id=p_workspace_id and r.status='approved'
      and not exists(select 1 from public.business_bills b where b.workspace_id=p_workspace_id and b.source_request_id=r.id and b.status<>'cancelled')
    union all
    select 'claim:'||c.id,case when c.kind='reimbursement' then 'employee_cost' else 'company_expense' end,c.id,null::uuid,
      c.title,case when c.status='paid' then timezone(s.timezone,c.paid_at)::date else c.expense_date end,c.status,c.amount,c.currency,c.reporting_amount,
      case when c.status='paid' then c.reporting_amount else 0 end,case when c.status='approved' then c.reporting_amount else 0 end,c.category_id,c.dimension_id
    from public.business_expense_claims c join public.workspace_settings s on s.workspace_id=c.workspace_id
      where c.workspace_id=p_workspace_id and c.status in ('approved','paid') and not exists(select 1 from public.business_bills b
        where b.workspace_id=p_workspace_id and b.source_claim_id=c.id and b.status<>'cancelled')
    union all
    select 'bill:'||b.id,'bill',b.id,null::uuid,b.title,b.due_on,b.status,b.amount-b.paid_amount,b.currency,
      round((b.amount-b.paid_amount)*b.exchange_rate,4),0::numeric,round((b.amount-b.paid_amount)*b.exchange_rate,4),b.category_id,b.dimension_id
      from public.business_bills b where b.workspace_id=p_workspace_id and b.status='open'
    union all
    select 'bill_payment:'||p.id,'bill_payment',p.id,p.bill_id,b.title,timezone(s.timezone,p.paid_at)::date,'paid',p.amount,p.currency,
      p.reporting_amount,p.reporting_amount,0::numeric,b.category_id,b.dimension_id from public.business_bill_payments p
      join public.business_bills b on b.workspace_id=p.workspace_id and b.id=p.bill_id
      join public.workspace_settings s on s.workspace_id=p.workspace_id where p.workspace_id=p_workspace_id
  ) select r.entry_key,r.record_type,r.record_id,r.parent_id,r.title,r.event_date,r.status,r.amount,r.currency,r.reporting_amount,r.paid_value,r.commitment_value
  from rows r cross join scope b where r.event_date between b.starts_on and b.ends_on
    and (b.category_id is null or r.category_id=b.category_id) and (b.dimension_id is null or r.dimension_id=b.dimension_id);
$$;
create function public.business_budget_totals(p_workspace_id uuid,p_budget_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('paid',coalesce(sum(paid_value),0),'committed',coalesce(sum(commitment_value),0),
    'source_count',count(*)) from public.business_budget_rows(p_workspace_id,p_budget_id);
$$;
create function public.business_budget_feed(p_workspace_id uuid,p_status text default '',p_offset integer default 0,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if not public.business_claims_active(p_workspace_id) then raise exception 'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED'; end if;
  if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 then raise exception 'INVALID_BUSINESS_ACTIVITY_FILTER'; end if;
  with visible as materialized(select b.*,public.business_budget_totals(p_workspace_id,b.id) as totals
    from public.business_budgets b where b.workspace_id=p_workspace_id and public.business_can_view_budget(p_workspace_id,b.id)),
  matched as materialized(select * from visible where coalesce(p_status,'')='' or status=p_status),
  page as(select * from matched order by starts_on desc,created_at desc,id offset p_offset limit p_limit)
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page) order by starts_on desc,created_at desc,id) from page),'[]'::jsonb),
    'total_count',(select count(*) from matched),'warning_count',(select count(*) from visible
      where status='active' and timezone((select timezone from public.workspace_settings where workspace_id=p_workspace_id),now())::date between starts_on and ends_on
        and (coalesce((totals->>'paid')::numeric,0)+coalesce((totals->>'committed')::numeric,0))>=planned_amount*0.8)) into v_result;
  return v_result;
end;
$$;
create function public.business_budget_detail(p_workspace_id uuid,p_budget_id uuid,p_offset integer default 0,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if not public.business_can_view_budget(p_workspace_id,p_budget_id) then raise exception 'BUSINESS_BUDGET_ACCESS_REQUIRED'; end if;
  if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 then raise exception 'INVALID_BUSINESS_ACTIVITY_FILTER'; end if;
  with rows as materialized(select * from public.business_budget_rows(p_workspace_id,p_budget_id)),
  page as(select * from rows order by event_date desc,entry_key offset p_offset limit p_limit)
  select jsonb_build_object('budget',(select to_jsonb(b) from public.business_budgets b where b.workspace_id=p_workspace_id and b.id=p_budget_id),
    'totals',public.business_budget_totals(p_workspace_id,p_budget_id),
    'items',coalesce((select jsonb_agg(to_jsonb(page) order by event_date desc,entry_key) from page),'[]'::jsonb)) into v_result;
  return v_result;
end;
$$;

create function public.set_business_workflow_permission(p_workspace_id uuid,p_role text,p_permission_code text,p_enabled boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.business_claims_active(p_workspace_id) then raise exception 'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED'; end if;
  if p_permission_code is null or p_permission_code not in ('approvals.view','approvals.review','budgets.view','budgets.manage')
    then raise exception 'INVALID_BUSINESS_PERMISSION'; end if;
  perform public.set_business_role_permission(p_workspace_id,p_role,p_permission_code,p_enabled);
end;
$$;

-- Extend Stage 7 activity. Requests are context/commitments, never actual payments.
create or replace function public.business_transaction_rows(p_workspace_id uuid)
returns table(entry_key text,record_type text,record_id uuid,parent_id uuid,title text,
  event_date date,status text,amount numeric,currency text,reporting_amount numeric,
  reporting_currency text,payment_source text,payer_name text,reference text,
  category_id uuid,dimension_id uuid,income_value numeric,paid_value numeric,
  commitment_value numeric,created_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
  select 'income:'||i.id,'income',i.id,null::uuid,i.title,i.received_on,i.status,i.amount,i.currency,
    i.reporting_amount,i.reporting_currency,i.payment_source,i.received_from,i.reference,i.category_id,i.dimension_id,
    case when i.status='received' then i.reporting_amount else 0 end,0::numeric,0::numeric,i.created_at
  from public.business_income_receipts i where i.workspace_id=p_workspace_id and public.business_can_view_income(p_workspace_id,i.id)
  union all
  select 'claim:'||c.id,case when c.kind='reimbursement' and c.status='paid' then 'reimbursement'
    when c.kind='reimbursement' then 'employee_cost' else 'company_expense' end,c.id,null::uuid,c.title,
    case when c.status='paid' then timezone(s.timezone,c.paid_at)::date else c.expense_date end,
    c.status,c.amount,c.currency,c.reporting_amount,c.reporting_currency,
    case when c.status='paid' then c.payment_source else c.employee_payment_source end,
    coalesce(p.full_name,'Member'),coalesce(c.payment_reference,''),c.category_id,c.dimension_id,0::numeric,
    case when c.status='paid' then c.reporting_amount else 0 end,
    case when c.status='approved' then c.reporting_amount else 0 end,c.created_at
  from public.business_expense_claims c join public.workspace_settings s on s.workspace_id=c.workspace_id
    left join public.profiles p on p.id=c.submitted_by
  where c.workspace_id=p_workspace_id and public.business_can_view_claim(p_workspace_id,c.id)
    and not exists(select 1 from public.business_bills b where b.workspace_id=p_workspace_id and b.source_claim_id=c.id and b.status<>'cancelled')
  union all
  select 'bill:'||b.id,'bill',b.id,null::uuid,b.title,b.due_on,b.status,
    b.amount-b.paid_amount,b.currency,round((b.amount-b.paid_amount)*b.exchange_rate,4),
    b.reporting_currency,'unspecified',v.name,coalesce(b.reference,''),b.category_id,b.dimension_id,
    0::numeric,0::numeric,case when b.status='open' then round((b.amount-b.paid_amount)*b.exchange_rate,4) else 0 end,b.created_at
  from public.business_bills b join public.business_suppliers v on v.workspace_id=b.workspace_id and v.id=b.supplier_id
  where b.workspace_id=p_workspace_id and b.status<>'paid' and public.business_can_view_bill(p_workspace_id,b.id)
  union all
  select 'bill_payment:'||p.id,'bill_payment',p.id,p.bill_id,b.title,timezone(s.timezone,p.paid_at)::date,
    'paid',p.amount,p.currency,p.reporting_amount,p.reporting_currency,p.payment_source,v.name,p.reference,
    b.category_id,b.dimension_id,0::numeric,p.reporting_amount,0::numeric,p.created_at
  from public.business_bill_payments p join public.business_bills b on b.workspace_id=p.workspace_id and b.id=p.bill_id
    join public.workspace_settings s on s.workspace_id=p.workspace_id
    join public.business_suppliers v on v.workspace_id=b.workspace_id and v.id=b.supplier_id
  where p.workspace_id=p_workspace_id and public.business_can_view_bill(p_workspace_id,p.bill_id)
  union all
  select 'request:'||r.id,'spending_request',r.id,null::uuid,r.title,r.planned_on,r.status,r.amount,r.currency,r.reporting_amount,
    r.reporting_currency,'unspecified',coalesce(p.full_name,'Member'),'Request',r.category_id,r.dimension_id,
    0::numeric,0::numeric,case when r.status='approved' and not exists(select 1 from public.business_bills b
      where b.workspace_id=p_workspace_id and b.source_request_id=r.id and b.status<>'cancelled') then r.reporting_amount else 0 end,r.created_at
  from public.business_spending_requests r left join public.profiles p on p.id=r.submitted_by
    where r.workspace_id=p_workspace_id and public.business_can_view_request(p_workspace_id,r.id);
$$;

do $$ declare v_signature text;
begin
  foreach v_signature in array array[
    'public.business_budget_scope(uuid,uuid)','public.business_can_view_budget(uuid,uuid)','public.business_can_view_request(uuid,uuid)',
    'public.save_business_budget(uuid,uuid,integer,text,uuid,uuid,date,date,text,numeric)',
    'public.transition_business_budget(uuid,uuid,integer,text,text)',
    'public.save_business_spending_request(uuid,uuid,integer,text,text,uuid,uuid,numeric,text,date)',
    'public.transition_business_request(uuid,uuid,integer,text,text)',
    'public.create_business_bill_from_request(uuid,uuid,uuid,text,date,integer)',
    'public.business_request_feed(uuid,text,text,integer,integer)','public.business_request_detail(uuid,uuid)',
    'public.business_budget_feed(uuid,text,integer,integer)','public.business_budget_detail(uuid,uuid,integer,integer)',
    'public.set_business_workflow_permission(uuid,text,text,boolean)'
  ] loop
    execute format('revoke all on function %s from public,anon',v_signature);
    execute format('grant execute on function %s to authenticated',v_signature);
  end loop;
end $$;
revoke all on function public.business_budget_rows(uuid,uuid) from public,anon,authenticated;
revoke all on function public.business_budget_totals(uuid,uuid) from public,anon,authenticated;
revoke all on function public.guard_business_request_bill_link() from public,anon,authenticated;
revoke all on function public.sync_business_request_bill_state() from public,anon,authenticated;
revoke all on function public.business_transaction_rows(uuid) from public,anon,authenticated;
notify pgrst, 'reload schema';
commit;
