begin;

create table public.business_income_receipts (
  id uuid primary key,
  workspace_id uuid not null references public.budget_workspaces(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  received_from text not null default '' check (char_length(received_from)<=160),
  reference text not null check (char_length(btrim(reference)) between 2 and 160),
  description text not null default '' check (char_length(description)<=2000),
  category_id uuid not null,
  dimension_id uuid,
  amount numeric(18,4) not null check (amount>0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  reporting_currency text not null check (reporting_currency ~ '^[A-Z]{3}$'),
  reporting_amount numeric(18,4) not null check (reporting_amount>0),
  exchange_rate numeric(30,12) not null check (exchange_rate>0),
  rate_effective_at timestamptz not null,
  rate_provider text not null check (rate_provider in ('identity','currencyapi')),
  received_on date not null,
  payment_source text not null check (payment_source in ('cash','bank_transfer','mobile_money','card','other')),
  status text not null default 'received' check (status in ('received','voided')),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete restrict,
  void_reason text check (char_length(btrim(void_reason)) between 2 and 1000),
  unique(workspace_id,id),
  constraint business_income_category_fk foreign key(workspace_id,category_id)
    references public.business_categories(workspace_id,id) on delete restrict,
  constraint business_income_dimension_fk foreign key(workspace_id,dimension_id)
    references public.business_dimensions(workspace_id,id) on delete restrict,
  constraint business_income_void_state check (
    (status='received' and voided_at is null and voided_by is null and void_reason is null)
    or (status='voided' and voided_at is not null and voided_by is not null and void_reason is not null))
);
create index business_income_date_idx on public.business_income_receipts(workspace_id,received_on desc);

alter table public.business_expense_claims
  add column employee_payment_source text not null default 'unspecified'
    check(employee_payment_source in ('unspecified','cash','bank_transfer','mobile_money','card','other')),
  add column payment_source text not null default 'unspecified'
    check(payment_source in ('unspecified','cash','bank_transfer','mobile_money','card','other'));
alter table public.business_bill_payments
  add column payment_source text not null default 'unspecified'
    check(payment_source in ('unspecified','cash','bank_transfer','mobile_money','card','other'));

create function public.business_can_view_income(p_workspace_id uuid,p_income_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.business_claims_active(p_workspace_id)
    and public.business_has_permission(p_workspace_id,'finance.view_all')
    and exists(select 1 from public.business_income_receipts i
      where i.workspace_id=p_workspace_id and i.id=p_income_id
        and public.business_claim_in_scope(p_workspace_id,i.dimension_id));
$$;
alter table public.business_income_receipts enable row level security;
alter table public.business_income_receipts force row level security;
create policy "Scoped Business finance can read income" on public.business_income_receipts
for select to authenticated using(public.business_can_view_income(workspace_id,id));
create policy "Active account required for income" on public.business_income_receipts as restrictive
for all to authenticated using(not public.my_account_suspended()) with check(not public.my_account_suspended());
create trigger guard_suspended_account_write_trigger before insert or update or delete
on public.business_income_receipts for each row execute function public.guard_suspended_account_write();
revoke all on public.business_income_receipts from public,anon,authenticated;
grant select on public.business_income_receipts to authenticated;

-- Extend the existing currency lock to bills and income. Historical conversion
-- snapshots cannot be combined with a newly selected reporting currency.
create or replace function public.lock_business_claim_reporting_currency()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.reporting_currency is distinct from old.reporting_currency and (
    exists(select 1 from public.business_expense_claims where workspace_id=old.workspace_id)
    or exists(select 1 from public.business_bills where workspace_id=old.workspace_id)
    or exists(select 1 from public.business_bill_schedules where workspace_id=old.workspace_id)
    or exists(select 1 from public.business_income_receipts where workspace_id=old.workspace_id))
    then raise exception 'BUSINESS_REPORTING_CURRENCY_LOCKED'; end if;
  return new;
end;
$$;

create function public.record_business_income(
  p_workspace_id uuid,p_income_id uuid,p_title text,p_received_from text,p_reference text,
  p_description text,p_category_id uuid,p_dimension_id uuid,p_amount numeric,
  p_currency text,p_received_on date,p_payment_source text
)
returns public.business_income_receipts language plpgsql security definer set search_path=public,pg_temp as $$
declare v_income public.business_income_receipts%rowtype;
declare v_settings public.workspace_settings%rowtype;
declare v_rate record;
declare v_currency text:=upper(btrim(coalesce(p_currency,'')));
begin
  if not public.business_claims_active(p_workspace_id)
    or not public.business_has_permission(p_workspace_id,'finance.view_all')
    or not public.business_has_permission(p_workspace_id,'finance.create')
    or not public.business_claim_in_scope(p_workspace_id,p_dimension_id)
    then raise exception 'BUSINESS_INCOME_ACCESS_REQUIRED'; end if;
  -- Serialize retries and hold reporting settings while capturing the rate.
  select * into v_settings from public.workspace_settings where workspace_id=p_workspace_id for share;
  if not found then raise exception 'BUSINESS_SETUP_INCOMPLETE'; end if;
  if p_income_id is null then raise exception 'INVALID_BUSINESS_INCOME'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_income_id::text,0));
  select * into v_income from public.business_income_receipts where id=p_income_id;
  if found then
    if v_income.workspace_id<>p_workspace_id or not public.business_can_view_income(p_workspace_id,v_income.id)
      then raise exception 'BUSINESS_INCOME_ACCESS_REQUIRED'; end if;
    return v_income;
  end if;
  if p_amount is null or p_amount<=0 or p_amount>99999999999999
    or p_received_on is null or p_received_on>timezone(v_settings.timezone,now())::date
    or char_length(btrim(coalesce(p_title,''))) not between 2 and 160
    or char_length(btrim(coalesce(p_reference,''))) not between 2 and 160
    or char_length(coalesce(p_received_from,''))>160 or char_length(coalesce(p_description,''))>2000
    or p_payment_source is null or p_payment_source not in ('cash','bank_transfer','mobile_money','card','other')
    then raise exception 'INVALID_BUSINESS_INCOME'; end if;
  if not exists(select 1 from public.business_categories where workspace_id=p_workspace_id
    and id=p_category_id and status='active' and category_type in ('income','both'))
    then raise exception 'BUSINESS_INCOME_CATEGORY_REQUIRED'; end if;
  if p_dimension_id is not null and not exists(select 1 from public.business_dimensions
    where workspace_id=p_workspace_id and id=p_dimension_id and status='active')
    then raise exception 'BUSINESS_DIMENSION_REQUIRED'; end if;
  if not v_currency=any(v_settings.enabled_currencies) then raise exception 'BUSINESS_CURRENCY_NOT_ENABLED'; end if;
  select * into v_rate from public.latest_exchange_rate(v_currency,v_settings.reporting_currency,now());
  if v_rate.exchange_rate is null then raise exception 'BUSINESS_EXCHANGE_RATE_UNAVAILABLE'; end if;
  insert into public.business_income_receipts(id,workspace_id,title,received_from,reference,description,
    category_id,dimension_id,amount,currency,reporting_currency,reporting_amount,
    exchange_rate,rate_effective_at,rate_provider,received_on,payment_source,recorded_by)
  values(p_income_id,p_workspace_id,btrim(p_title),btrim(coalesce(p_received_from,'')),btrim(p_reference),
    coalesce(p_description,''),p_category_id,p_dimension_id,p_amount,v_currency,v_settings.reporting_currency,
    round(p_amount*v_rate.exchange_rate,4),v_rate.exchange_rate,v_rate.rate_effective_at,
    v_rate.provider,p_received_on,p_payment_source,auth.uid()) returning * into v_income;
  perform public.business_record_audit_event(p_workspace_id,'income.received','business_income',v_income.id,
    '{}'::jsonb,jsonb_build_object('amount',v_income.amount,'currency',v_income.currency,
      'reporting_amount',v_income.reporting_amount,'payment_source',v_income.payment_source),null,p_income_id);
  return v_income;
end;
$$;

create function public.void_business_income(p_workspace_id uuid,p_income_id uuid,p_reason text)
returns public.business_income_receipts language plpgsql security definer set search_path=public,pg_temp as $$
declare v_income public.business_income_receipts%rowtype;
begin
  if not public.business_can_view_income(p_workspace_id,p_income_id)
    or not public.business_has_permission(p_workspace_id,'finance.record_payment')
    then raise exception 'BUSINESS_INCOME_ACCESS_REQUIRED'; end if;
  if char_length(btrim(coalesce(p_reason,''))) not between 2 and 1000 then raise exception 'BUSINESS_VOID_REASON_REQUIRED'; end if;
  select * into v_income from public.business_income_receipts
    where workspace_id=p_workspace_id and id=p_income_id for update;
  if v_income.status='voided' then return v_income; end if;
  update public.business_income_receipts set status='voided',voided_at=now(),voided_by=auth.uid(),void_reason=btrim(p_reason)
    where id=p_income_id returning * into v_income;
  perform public.business_record_audit_event(p_workspace_id,'income.voided','business_income',p_income_id,
    jsonb_build_object('status','received'),jsonb_build_object('status','voided'),p_reason);
  return v_income;
end;
$$;

-- These wrappers keep the Stage 5/6 transitions and permissions intact and
-- capture funding metadata in the same transaction as the financial action.
create function public.save_business_expense_entry(
  p_workspace_id uuid,p_claim_id uuid,p_expected_version integer,p_kind text,
  p_title text,p_description text,p_category_id uuid,p_dimension_id uuid,
  p_amount numeric,p_currency text,p_expense_date date,p_employee_payment_source text
)
returns public.business_expense_claims language plpgsql security definer set search_path=public,pg_temp as $$
declare v_claim public.business_expense_claims%rowtype;
begin
  if p_employee_payment_source is null or p_employee_payment_source not in
    ('unspecified','cash','bank_transfer','mobile_money','card','other') then raise exception 'BUSINESS_PAYMENT_SOURCE_REQUIRED'; end if;
  if p_claim_id is null then
    v_claim:=public.create_business_claim(p_workspace_id,p_kind,p_title,p_description,p_category_id,
      p_dimension_id,p_amount,p_currency,p_expense_date);
  else
    v_claim:=public.save_business_claim_draft(p_workspace_id,p_claim_id,p_expected_version,
      p_title,p_description,p_category_id,p_dimension_id,p_amount,p_currency,p_expense_date);
  end if;
  update public.business_expense_claims set employee_payment_source=
    case when v_claim.kind='reimbursement' then p_employee_payment_source else 'unspecified' end
    where id=v_claim.id returning * into v_claim;
  perform public.business_record_audit_event(p_workspace_id,'expense.funding_recorded','business_expense_claim',v_claim.id,
    '{}'::jsonb,jsonb_build_object('employee_payment_source',v_claim.employee_payment_source));
  return v_claim;
end;
$$;

create function public.record_business_claim_payment_with_source(
  p_workspace_id uuid,p_claim_id uuid,p_expected_version integer,
  p_paid_at timestamptz,p_payment_reference text,p_payment_source text
)
returns public.business_expense_claims language plpgsql security definer set search_path=public,pg_temp as $$
declare v_claim public.business_expense_claims%rowtype;
begin
  if p_payment_source is null or p_payment_source not in ('cash','bank_transfer','mobile_money','card','other')
    then raise exception 'BUSINESS_PAYMENT_SOURCE_REQUIRED'; end if;
  v_claim:=public.record_business_claim_payment(p_workspace_id,p_claim_id,p_expected_version,p_paid_at,p_payment_reference);
  update public.business_expense_claims set payment_source=p_payment_source
    where id=v_claim.id returning * into v_claim;
  perform public.business_record_audit_event(p_workspace_id,'expense.payment_source','business_expense_claim',v_claim.id,
    '{}'::jsonb,jsonb_build_object('payment_source',p_payment_source));
  return v_claim;
end;
$$;

create function public.record_business_bill_payment_with_source(
  p_workspace_id uuid,p_bill_id uuid,p_payment_id uuid,p_amount numeric,
  p_paid_at timestamptz,p_reference text,p_payment_source text
)
returns public.business_bill_payments language plpgsql security definer set search_path=public,pg_temp as $$
declare v_payment public.business_bill_payments%rowtype;
begin
  if p_payment_source is null or p_payment_source not in ('cash','bank_transfer','mobile_money','card','other')
    then raise exception 'BUSINESS_PAYMENT_SOURCE_REQUIRED'; end if;
  -- The bill lock also serializes retries, so a previously recorded source
  -- is returned unchanged rather than rewritten by a later retry.
  if not public.business_can_view_bill(p_workspace_id,p_bill_id)
    or not public.business_has_permission(p_workspace_id,'finance.record_payment')
    then raise exception 'BUSINESS_PAYMENT_ACCESS_REQUIRED'; end if;
  perform 1 from public.business_bills where workspace_id=p_workspace_id and id=p_bill_id for update;
  if exists(select 1 from public.business_bill_payments where workspace_id=p_workspace_id and id=p_payment_id)
    then return public.record_business_bill_payment(p_workspace_id,p_bill_id,p_payment_id,p_amount,p_paid_at,p_reference); end if;
  v_payment:=public.record_business_bill_payment(p_workspace_id,p_bill_id,p_payment_id,p_amount,p_paid_at,p_reference);
  update public.business_bill_payments set payment_source=p_payment_source
    where id=v_payment.id returning * into v_payment;
  perform public.business_record_audit_event(p_workspace_id,'bill.payment_source','business_bill',p_bill_id,
    '{}'::jsonb,jsonb_build_object('payment_id',p_payment_id,'payment_source',p_payment_source));
  return v_payment;
end;
$$;

-- This internal feed has an explicit permission predicate for every source;
-- no Personal, Family, platform-billing, or other workspace table is read.
create function public.business_transaction_rows(p_workspace_id uuid)
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
  where p.workspace_id=p_workspace_id and public.business_can_view_bill(p_workspace_id,p.bill_id);
$$;

create function public.business_transaction_feed(
  p_workspace_id uuid,p_search text default '',p_kind text default '',p_status text default '',
  p_currency text default '',p_category_id uuid default null,p_dimension_id uuid default null,
  p_from date default null,p_to date default null,p_payment_source text default '',
  p_offset integer default 0,p_limit integer default 50
)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
declare v_finance boolean;
declare v_currency text;
begin
  if not public.business_claims_active(p_workspace_id) then raise exception 'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED'; end if;
  if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100
    or char_length(coalesce(p_search,''))>160 or (p_from is not null and p_to is not null and p_from>p_to)
    then raise exception 'INVALID_BUSINESS_ACTIVITY_FILTER'; end if;
  v_finance:=public.business_has_permission(p_workspace_id,'finance.view_all');
  select reporting_currency into v_currency from public.workspace_settings where workspace_id=p_workspace_id;
  with matched as materialized (
    select * from public.business_transaction_rows(p_workspace_id) r
    where (coalesce(p_search,'')='' or strpos(lower(r.title||' '||r.reference||' '||r.payer_name),lower(p_search))>0)
      and (coalesce(p_kind,'')='' or r.record_type=p_kind)
      and (coalesce(p_status,'')='' or r.status=p_status)
      and (coalesce(p_currency,'')='' or r.currency=p_currency)
      and (p_category_id is null or r.category_id=p_category_id)
      and (p_dimension_id is null or r.dimension_id=p_dimension_id)
      and (p_from is null or r.event_date>=p_from) and (p_to is null or r.event_date<=p_to)
      and (coalesce(p_payment_source,'')='' or r.payment_source=p_payment_source)
  ), page as (
    select * from matched order by event_date desc,created_at desc,entry_key
      offset p_offset limit p_limit
  )
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page) order by event_date desc,created_at desc,entry_key) from page),'[]'::jsonb),
    'total_count',(select count(*) from matched),'finance_visible',v_finance,'reporting_currency',v_currency,
    'paid_count',case when v_finance then (select count(*) from matched where paid_value>0) else null end,
    'income',case when v_finance then (select coalesce(sum(income_value),0) from matched) else null end,
    'paid',case when v_finance then (select coalesce(sum(paid_value),0) from matched) else null end,
    'committed',case when v_finance then (select coalesce(sum(commitment_value),0) from matched) else null end)
    into v_result;
  return v_result;
end;
$$;

revoke all on function public.business_transaction_rows(uuid) from public,anon,authenticated;
revoke all on function public.business_can_view_income(uuid,uuid) from public,anon;
grant execute on function public.business_can_view_income(uuid,uuid) to authenticated;
do $$ declare v_signature text;
begin
  foreach v_signature in array array[
    'public.record_business_income(uuid,uuid,text,text,text,text,uuid,uuid,numeric,text,date,text)',
    'public.void_business_income(uuid,uuid,text)',
    'public.save_business_expense_entry(uuid,uuid,integer,text,text,text,uuid,uuid,numeric,text,date,text)',
    'public.record_business_claim_payment_with_source(uuid,uuid,integer,timestamptz,text,text)',
    'public.record_business_bill_payment_with_source(uuid,uuid,uuid,numeric,timestamptz,text,text)',
    'public.business_transaction_feed(uuid,text,text,text,text,uuid,uuid,date,date,text,integer,integer)'
  ] loop
    execute format('revoke all on function %s from public,anon',v_signature);
    execute format('grant execute on function %s to authenticated',v_signature);
  end loop;
end $$;
notify pgrst, 'reload schema';
commit;
