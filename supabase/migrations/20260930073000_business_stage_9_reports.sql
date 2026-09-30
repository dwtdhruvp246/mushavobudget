begin;

-- Reports never widen finance or Staff access. Non-finance managers/auditors
-- need an explicitly assigned tag; Staff/Contributors retain their own records.
create function public.business_report_scope(p_workspace_id uuid,p_dimension_id uuid,p_submitter_id uuid default null)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.business_claims_active(p_workspace_id)
    and public.business_has_permission(p_workspace_id,'reports.view')
    and ((public.business_has_permission(p_workspace_id,'finance.view_all')
      and not exists(select 1 from public.workspace_members m where m.workspace_id=p_workspace_id
        and m.user_id=auth.uid() and m.status='active' and m.role in ('staff','contributor'))
      and public.business_claim_in_scope(p_workspace_id,p_dimension_id))
      or p_submitter_id=auth.uid()
      or (p_dimension_id is not null and exists(select 1 from public.workspace_members m
        join public.business_member_scopes s on s.workspace_id=m.workspace_id and s.member_id=m.id
        where m.workspace_id=p_workspace_id and m.user_id=auth.uid() and m.status='active'
          and m.role not in ('staff','contributor') and s.dimension_id=p_dimension_id)));
$$;

create function public.business_report_rows(p_workspace_id uuid,p_from date,p_to date,p_mode text,
  p_currency text,p_category_id uuid,p_dimension_id uuid)
returns table(entry_key text,record_type text,record_id uuid,parent_id uuid,title text,event_date date,status text,
  original_amount numeric,currency text,reporting_amount numeric,reporting_currency text,exchange_rate numeric,
  rate_effective_at timestamptz,rate_provider text,category_id uuid,category_name text,dimension_id uuid,dimension_name text,
  person_name text,payment_source text,reference text,receipt_state text,due_state text,
  income_value numeric,paid_value numeric,commitment_value numeric,claim_value numeric,is_reimbursement boolean,
  can_open boolean)
language sql stable security definer set search_path=public,pg_temp as $$
  with raw as (
    select 'income:'||i.id as entry_key,'income'::text as record_type,i.id as record_id,null::uuid as parent_id,
      i.title,i.received_on as event_date,i.status,i.amount as original_amount,i.currency,i.reporting_amount,i.reporting_currency,
      i.exchange_rate,i.rate_effective_at,i.rate_provider,i.category_id,i.dimension_id,
      i.received_from as person_name,i.payment_source,i.reference,'not_required'::text as receipt_state,''::text as due_state,
      true as income,false as paid,false as committed,false as claimed,false as is_reimbursement,
      public.business_can_view_income(p_workspace_id,i.id) as can_open
    from public.business_income_receipts i where i.workspace_id=p_workspace_id and i.status='received'
      and public.business_report_scope(p_workspace_id,i.dimension_id)
    union all
    select 'claim:'||c.id,case when c.kind='reimbursement' then 'reimbursement' else 'company_expense' end,c.id,null::uuid,
      c.title,case when c.status='paid' then timezone(s.timezone,c.paid_at)::date else c.expense_date end,c.status,
      c.amount,c.currency,c.reporting_amount,c.reporting_currency,c.exchange_rate,c.rate_effective_at,c.rate_provider,
      c.category_id,c.dimension_id,coalesce(p.full_name,'Member'),
      case when c.status='paid' then c.payment_source else c.employee_payment_source end,coalesce(c.payment_reference,''),
      case when exists(select 1 from public.business_documents d where d.workspace_id=p_workspace_id
        and d.parent_type='expense_claim' and d.parent_id=c.id and d.status='active') then 'present' else 'missing' end,'',
      false,c.status='paid',c.status='approved',false,c.kind='reimbursement',public.business_can_view_claim(p_workspace_id,c.id)
    from public.business_expense_claims c join public.workspace_settings s on s.workspace_id=c.workspace_id
      left join public.profiles p on p.id=c.submitted_by
    where c.workspace_id=p_workspace_id and c.status<>'rejected'
      and public.business_report_scope(p_workspace_id,c.dimension_id,c.submitted_by)
      and not exists(select 1 from public.business_bills b where b.workspace_id=p_workspace_id and b.source_claim_id=c.id and b.status<>'cancelled')
    union all
    -- Claims are an informational register by expense date, never a second payment.
    select 'employee_claim:'||c.id,'employee_claim',c.id,null::uuid,c.title,c.expense_date,c.status,
      c.amount,c.currency,c.reporting_amount,c.reporting_currency,c.exchange_rate,c.rate_effective_at,c.rate_provider,
      c.category_id,c.dimension_id,coalesce(p.full_name,'Member'),c.employee_payment_source,coalesce(c.payment_reference,''),
      'not_required','',false,false,false,true,true,public.business_can_view_claim(p_workspace_id,c.id)
    from public.business_expense_claims c left join public.profiles p on p.id=c.submitted_by
      where c.workspace_id=p_workspace_id and c.kind='reimbursement'
        and public.business_report_scope(p_workspace_id,c.dimension_id,c.submitted_by)
    union all
    select 'bill:'||b.id,'bill',b.id,null::uuid,b.title,b.due_on,b.status,b.amount-b.paid_amount,b.currency,
      round((b.amount-b.paid_amount)*b.exchange_rate,4),b.reporting_currency,b.exchange_rate,b.rate_effective_at,b.rate_provider,
      b.category_id,b.dimension_id,v.name,'unspecified',coalesce(b.reference,''),'not_required',
      case when b.due_on<timezone(s.timezone,now())::date then 'overdue' else 'due' end,
      false,false,true,false,false,public.business_can_view_bill(p_workspace_id,b.id)
    from public.business_bills b join public.business_suppliers v on v.workspace_id=b.workspace_id and v.id=b.supplier_id
      join public.workspace_settings s on s.workspace_id=b.workspace_id
      where b.workspace_id=p_workspace_id and b.status='open' and public.business_report_scope(p_workspace_id,b.dimension_id)
    union all
    select 'bill_payment:'||p.id,'bill_payment',p.id,p.bill_id,b.title,timezone(s.timezone,p.paid_at)::date,'paid',
      p.amount,p.currency,p.reporting_amount,p.reporting_currency,p.exchange_rate,p.rate_effective_at,p.rate_provider,
      b.category_id,b.dimension_id,v.name,p.payment_source,p.reference,
      case when exists(select 1 from public.business_documents d where d.workspace_id=p_workspace_id
        and d.parent_type='business_bill_payment' and d.parent_id=p.id and d.status='active') then 'present' else 'missing' end,'',
      false,true,false,false,false,public.business_can_view_bill(p_workspace_id,b.id)
    from public.business_bill_payments p join public.business_bills b on b.workspace_id=p.workspace_id and b.id=p.bill_id
      join public.business_suppliers v on v.workspace_id=b.workspace_id and v.id=b.supplier_id
      join public.workspace_settings s on s.workspace_id=p.workspace_id
      where p.workspace_id=p_workspace_id and public.business_report_scope(p_workspace_id,b.dimension_id)
    union all
    -- Invoice checks include fully paid bills, independently of payment proofs.
    select 'bill_invoice:'||b.id,'bill_invoice',b.id,null::uuid,b.title,b.due_on,b.status,b.amount,b.currency,
      b.reporting_amount,b.reporting_currency,b.exchange_rate,b.rate_effective_at,b.rate_provider,b.category_id,b.dimension_id,
      v.name,'unspecified',coalesce(b.reference,''),
      case when exists(select 1 from public.business_documents d where d.workspace_id=p_workspace_id
        and d.parent_type='business_bill' and d.parent_id=b.id and d.status='active') then 'present' else 'missing' end,'',
      false,false,false,false,false,public.business_can_view_bill(p_workspace_id,b.id)
    from public.business_bills b join public.business_suppliers v on v.workspace_id=b.workspace_id and v.id=b.supplier_id
      where b.workspace_id=p_workspace_id and b.status<>'cancelled' and public.business_report_scope(p_workspace_id,b.dimension_id)
    union all
    select 'request:'||r.id,'spending_request',r.id,null::uuid,r.title,r.planned_on,r.status,r.amount,r.currency,
      r.reporting_amount,r.reporting_currency,r.exchange_rate,r.rate_effective_at,r.rate_provider,r.category_id,r.dimension_id,
      coalesce(p.full_name,'Member'),'unspecified','Request','not_required','',false,false,true,false,false,
      public.business_can_view_request(p_workspace_id,r.id)
    from public.business_spending_requests r left join public.profiles p on p.id=r.submitted_by
      where r.workspace_id=p_workspace_id and r.status='approved' and public.business_report_scope(p_workspace_id,r.dimension_id,r.submitted_by)
        and not exists(select 1 from public.business_bills b where b.workspace_id=p_workspace_id and b.source_request_id=r.id and b.status<>'cancelled')
  ), valued as (
    select r.*,case when p_mode='original' then r.original_amount else r.reporting_amount end as value
    from raw r where (p_from is null or r.event_date>=p_from) and (p_to is null or r.event_date<=p_to)
      and (coalesce(p_currency,'')='' or r.currency=p_currency)
      and (p_category_id is null or r.category_id=p_category_id) and (p_dimension_id is null or r.dimension_id=p_dimension_id)
  ) select r.entry_key,r.record_type,r.record_id,r.parent_id,r.title,r.event_date,r.status,r.original_amount,r.currency,
    r.reporting_amount,r.reporting_currency,r.exchange_rate,r.rate_effective_at,r.rate_provider,r.category_id,c.name,r.dimension_id,
    coalesce(d.name,'No organisation tag'),coalesce(r.person_name,''),r.payment_source,r.reference,r.receipt_state,r.due_state,
    case when r.income then r.value else 0 end,case when r.paid then r.value else 0 end,
    case when r.committed then r.value else 0 end,case when r.claimed then r.value else 0 end,r.is_reimbursement,r.can_open
    from valued r join public.business_categories c on c.workspace_id=p_workspace_id and c.id=r.category_id
      left join public.business_dimensions d on d.workspace_id=p_workspace_id and d.id=r.dimension_id;
$$;

-- One immutable statement snapshot supplies totals and all its source rows.
-- Fingerprints detect changes between the summary, drill-down and export RPCs.
create function public.business_report_data(p_workspace_id uuid,p_from date,p_to date,p_mode text,p_currency text,
  p_category_id uuid,p_dimension_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb; declare v_metadata jsonb; declare v_settings public.workspace_settings%rowtype; declare v_access text;
begin
  if not public.business_claims_active(p_workspace_id) then raise exception 'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED'; end if;
  if not public.business_has_permission(p_workspace_id,'reports.view') then raise exception 'BUSINESS_REPORT_ACCESS_REQUIRED'; end if;
  if p_mode is null or p_mode not in ('reporting','original') or (p_from is not null and p_to is not null and p_from>p_to)
    or (coalesce(p_currency,'')<>'' and p_currency !~ '^[A-Z]{3}$') or (p_mode='original' and coalesce(p_currency,'')='')
    then raise exception 'INVALID_BUSINESS_REPORT_FILTER'; end if;
  if p_category_id is not null and not exists(select 1 from public.business_categories where workspace_id=p_workspace_id and id=p_category_id)
    then raise exception 'INVALID_BUSINESS_REPORT_FILTER'; end if;
  if p_dimension_id is not null and not exists(select 1 from public.business_dimensions where workspace_id=p_workspace_id and id=p_dimension_id)
    then raise exception 'INVALID_BUSINESS_REPORT_FILTER'; end if;
  select * into v_settings from public.workspace_settings where workspace_id=p_workspace_id;
  v_access:=case when public.business_has_permission(p_workspace_id,'finance.view_all')
    and not exists(select 1 from public.workspace_members m where m.workspace_id=p_workspace_id
      and m.user_id=auth.uid() and m.status='active' and m.role in ('staff','contributor'))
    and not exists(select 1 from public.workspace_members m join public.business_member_scopes s on s.workspace_id=m.workspace_id and s.member_id=m.id
      where m.workspace_id=p_workspace_id and m.user_id=auth.uid() and m.status='active') then 'workspace'
    when exists(select 1 from public.workspace_members m join public.business_member_scopes s on s.workspace_id=m.workspace_id and s.member_id=m.id
      where m.workspace_id=p_workspace_id and m.user_id=auth.uid() and m.status='active' and m.role not in ('staff','contributor'))
      then 'assigned_scopes' else 'own_records' end;
  with rows as materialized(select * from public.business_report_rows(p_workspace_id,p_from,p_to,p_mode,p_currency,p_category_id,p_dimension_id)),
  spending as materialized(select * from rows where paid_value>0 or commitment_value>0),
  category_groups as(select category_id as id,category_name as name,sum(paid_value) as paid,sum(commitment_value) as committed from spending group by category_id,category_name),
  dimension_groups as(select dimension_id as id,dimension_name as name,sum(paid_value) as paid,sum(commitment_value) as committed from spending group by dimension_id,dimension_name),
  budgets as (
    select b.*,greatest(b.starts_on,coalesce(p_from,b.starts_on)) as activity_from,least(b.ends_on,coalesce(p_to,b.ends_on)) as activity_to,
      coalesce((select sum(r.paid_value) from spending r where r.event_date between b.starts_on and b.ends_on
        and (b.category_id is null or r.category_id=b.category_id) and (b.dimension_id is null or r.dimension_id=b.dimension_id)),0) as paid,
      coalesce((select sum(r.commitment_value) from spending r where r.event_date between b.starts_on and b.ends_on
        and (b.category_id is null or r.category_id=b.category_id) and (b.dimension_id is null or r.dimension_id=b.dimension_id)),0) as committed
    from public.business_budgets b where b.workspace_id=p_workspace_id and p_mode='reporting' and b.status in ('active','closed')
      and public.business_can_view_budget(p_workspace_id,b.id)
      and public.business_report_scope(p_workspace_id,b.dimension_id)
      and (p_from is null or b.ends_on>=p_from) and (p_to is null or b.starts_on<=p_to)
      and (p_category_id is null or b.category_id=p_category_id) and (p_dimension_id is null or b.dimension_id=p_dimension_id)
  ) select jsonb_build_object(
    'rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.event_date desc,r.entry_key) from rows r),'[]'::jsonb),
    'currencies',coalesce((select jsonb_agg(c.currency order by c.currency) from (select distinct currency from rows) c),'[]'::jsonb),
    'summary',jsonb_build_object('income',coalesce((select sum(income_value) from rows),0),
      'paid',coalesce((select sum(paid_value) from rows),0),'committed',coalesce((select sum(commitment_value) from rows),0),
      'due_count',(select count(*) from rows where due_state='due'),'overdue_count',(select count(*) from rows where due_state='overdue'),
      'due_amount',coalesce((select sum(commitment_value) from rows where due_state='due'),0),
      'overdue_amount',coalesce((select sum(commitment_value) from rows where due_state='overdue'),0),
      'missing_count',(select count(*) from rows where receipt_state='missing'),
      'claim_count',(select count(*) from rows where record_type='employee_claim'),
      'claimed',coalesce((select sum(claim_value) from rows),0),
      'reimbursed',coalesce((select sum(paid_value) from rows where is_reimbursement),0),
      'approved_reimbursements',coalesce((select sum(commitment_value) from rows where is_reimbursement),0)),
    'categories',coalesce((select jsonb_agg(to_jsonb(g) order by g.paid+g.committed desc,g.name,g.id) from category_groups g),'[]'::jsonb),
    'dimensions',coalesce((select jsonb_agg(to_jsonb(g) order by g.paid+g.committed desc,g.name,g.id) from dimension_groups g),'[]'::jsonb),
    'budgets',coalesce((select jsonb_agg(to_jsonb(b) order by b.starts_on desc,b.id) from budgets b),'[]'::jsonb)) into v_result;
  v_metadata:=jsonb_build_object('workspace_id',p_workspace_id,'workspace_name',(select name from public.budget_workspaces where id=p_workspace_id),
      'generated_at',now(),'timezone',v_settings.timezone,'today',timezone(v_settings.timezone,now())::date,
      'from',p_from,'to',p_to,'mode',p_mode,'original_currency',coalesce(p_currency,''),
      'currency',case when p_mode='original' then p_currency else v_settings.reporting_currency end,
      'reporting_currency',v_settings.reporting_currency,'access',v_access,
      'category_id',p_category_id,'dimension_id',p_dimension_id,
      'can_export',public.business_has_permission(p_workspace_id,'reports.export'));
  return v_result||jsonb_build_object('metadata',v_metadata,'fingerprint',md5((v_result||(v_metadata-'generated_at'))::text));
end;
$$;

create function public.business_report_selection(p_data jsonb,p_section text,p_group_type text,p_group_id uuid,p_budget_id uuid)
returns setof jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_budget jsonb;
begin
  if p_section is null or p_section not in ('ledger','actuals','income','paid','committed','bills','due','overdue',
    'missing','employee_claims','reimbursements','approved_reimbursements','budget_paid','budget_committed','budget_activity','budget_plan')
    or p_group_type is null or p_group_type not in ('','category','dimension')
    or (p_group_type='' and p_group_id is not null)
    then raise exception 'INVALID_BUSINESS_REPORT_FILTER'; end if;
  if p_section like 'budget_%' then
    if p_group_type<>'' then raise exception 'INVALID_BUSINESS_REPORT_FILTER'; end if;
    select b into v_budget from jsonb_array_elements(p_data->'budgets') b where b->>'id'=p_budget_id::text;
    if v_budget is null then raise exception 'BUSINESS_BUDGET_ACCESS_REQUIRED'; end if;
  elsif p_budget_id is not null then raise exception 'INVALID_BUSINESS_REPORT_FILTER'; end if;
  if p_section='budget_plan' then
    return next jsonb_build_object('entry_key','budget:'||(v_budget->>'id'),'record_type','budget','record_id',v_budget->'id',
      'title',v_budget->'name','event_date',v_budget->'starts_on','status',v_budget->'status',
      'original_amount',v_budget->'planned_amount','currency',v_budget->'reporting_currency',
      'reporting_amount',v_budget->'planned_amount','reporting_currency',v_budget->'reporting_currency',
      'exchange_rate',1,'rate_effective_at',v_budget->'created_at','rate_provider','identity',
      'category_id',v_budget->'category_id','dimension_id',v_budget->'dimension_id','income_value',0,'paid_value',0,
      'commitment_value',0,'claim_value',0,'receipt_state','not_required','can_open',true,
      'period_end',v_budget->'ends_on','activity_from',v_budget->'activity_from','activity_to',v_budget->'activity_to');
    return;
  end if;
  return query select r from jsonb_array_elements(p_data->'rows') r where
    (p_group_type='' or (p_group_type='category' and (r->>'category_id')::uuid is not distinct from p_group_id)
      or (p_group_type='dimension' and (r->>'dimension_id')::uuid is not distinct from p_group_id))
    and (case p_section
      when 'ledger' then (r->>'income_value')::numeric>0 or (r->>'paid_value')::numeric>0 or (r->>'commitment_value')::numeric>0
      when 'actuals' then (r->>'income_value')::numeric>0 or (r->>'paid_value')::numeric>0
      when 'income' then (r->>'income_value')::numeric>0 when 'paid' then (r->>'paid_value')::numeric>0
      when 'committed' then (r->>'commitment_value')::numeric>0
      when 'bills' then r->>'due_state' in ('due','overdue')
      when 'due' then r->>'due_state'='due' when 'overdue' then r->>'due_state'='overdue'
      when 'missing' then r->>'receipt_state'='missing' when 'employee_claims' then r->>'record_type'='employee_claim'
      when 'reimbursements' then (r->>'is_reimbursement')::boolean and (r->>'paid_value')::numeric>0
      when 'approved_reimbursements' then (r->>'is_reimbursement')::boolean and (r->>'commitment_value')::numeric>0
      when 'budget_paid' then (r->>'paid_value')::numeric>0
      when 'budget_activity' then (r->>'paid_value')::numeric>0 or (r->>'commitment_value')::numeric>0
      when 'budget_committed' then (r->>'commitment_value')::numeric>0 else false end)
    and (v_budget is null or ((r->>'event_date')::date between (v_budget->>'starts_on')::date and (v_budget->>'ends_on')::date
      and (v_budget->>'category_id' is null or r->>'category_id'=v_budget->>'category_id')
      and (v_budget->>'dimension_id' is null or r->>'dimension_id'=v_budget->>'dimension_id')))
    order by r->>'event_date' desc,r->>'entry_key';
end;
$$;

create function public.business_report_summary(p_workspace_id uuid,p_from date default null,p_to date default null,
  p_mode text default 'reporting',p_currency text default '',p_category_id uuid default null,p_dimension_id uuid default null)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select public.business_report_data(p_workspace_id,p_from,p_to,p_mode,p_currency,p_category_id,p_dimension_id)-'rows';
$$;

create function public.business_report_records(p_workspace_id uuid,p_section text,p_expected_fingerprint text,
  p_from date default null,p_to date default null,p_mode text default 'reporting',p_currency text default '',
  p_category_id uuid default null,p_dimension_id uuid default null,p_group_type text default '',p_group_id uuid default null,
  p_budget_id uuid default null,p_offset integer default 0,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_data jsonb; declare v_result jsonb;
begin
  if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 then raise exception 'INVALID_BUSINESS_REPORT_FILTER'; end if;
  v_data:=public.business_report_data(p_workspace_id,p_from,p_to,p_mode,p_currency,p_category_id,p_dimension_id);
  if p_expected_fingerprint is null or p_expected_fingerprint<>v_data->>'fingerprint' then raise exception 'BUSINESS_REPORT_CHANGED'; end if;
  with rows as materialized(select r from public.business_report_selection(v_data,p_section,p_group_type,p_group_id,p_budget_id) r),
  page as(select r from rows offset p_offset limit p_limit)
  select jsonb_build_object('metadata',v_data->'metadata','fingerprint',v_data->'fingerprint',
    'items',coalesce((select jsonb_agg(r) from page),'[]'::jsonb),'total_count',(select count(*) from rows),
    'totals',jsonb_build_object('income',coalesce((select sum((r->>'income_value')::numeric) from rows),0),
      'paid',coalesce((select sum((r->>'paid_value')::numeric) from rows),0),
      'committed',coalesce((select sum((r->>'commitment_value')::numeric) from rows),0),
      'claimed',coalesce((select sum((r->>'claim_value')::numeric) from rows),0))) into v_result;
  return v_result;
end;
$$;

create function public.business_report_csv_cell(p_value text,p_numeric boolean default false)
returns text language sql immutable security definer set search_path=public,pg_temp as $$
  select '"'||replace(case when not p_numeric and (coalesce(p_value,'') ~ '^[[:space:]]*[=+@-]'
      or coalesce(p_value,'') ~ E'^[\\t\\r\\n]') then ''''||p_value else coalesce(p_value,'') end,'"','""')||'"';
$$;
create function public.business_report_export(p_workspace_id uuid,p_section text,p_expected_fingerprint text,p_export_id uuid,
  p_format text default 'csv',p_from date default null,p_to date default null,p_mode text default 'reporting',
  p_currency text default '',p_category_id uuid default null,p_dimension_id uuid default null,
  p_group_type text default '',p_group_id uuid default null,p_budget_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_data jsonb; declare v_items jsonb; declare v_count integer; declare v_csv text;
begin
  v_data:=public.business_report_data(p_workspace_id,p_from,p_to,p_mode,p_currency,p_category_id,p_dimension_id);
  if not public.business_has_permission(p_workspace_id,'reports.export') then raise exception 'BUSINESS_REPORT_EXPORT_REQUIRED'; end if;
  if p_export_id is null or p_format is null or p_format not in ('csv','print') then raise exception 'INVALID_BUSINESS_REPORT_FILTER'; end if;
  if p_expected_fingerprint is null or p_expected_fingerprint<>v_data->>'fingerprint' then raise exception 'BUSINESS_REPORT_CHANGED'; end if;
  select coalesce(jsonb_agg(r),'[]'::jsonb),count(*) into v_items,v_count
    from public.business_report_selection(v_data,p_section,p_group_type,p_group_id,p_budget_id) r;
  if v_count>10000 then raise exception 'BUSINESS_REPORT_EXPORT_TOO_LARGE'; end if;
  if p_format='csv' then
    select 'Record key,Record type,Record ID,Parent ID,Title,Date,Status,Original amount,Original currency,Reporting amount,Reporting currency,Exchange rate,Rate effective at,Rate provider,Category,Organisation tag,Person,Payment source,Reference,Receipt state,Income contribution,Paid contribution,Commitment contribution,Claimed contribution,View currency'||E'\r\n'||coalesce(string_agg(concat_ws(',',public.business_report_csv_cell(cell->>'entry_key'),public.business_report_csv_cell(cell->>'record_type'),
        public.business_report_csv_cell(cell->>'record_id'),public.business_report_csv_cell(cell->>'parent_id'),
        public.business_report_csv_cell(cell->>'title'),public.business_report_csv_cell(cell->>'event_date'),
        public.business_report_csv_cell(cell->>'status'),public.business_report_csv_cell(cell->>'original_amount',true),
        public.business_report_csv_cell(cell->>'currency'),public.business_report_csv_cell(cell->>'reporting_amount',true),
        public.business_report_csv_cell(cell->>'reporting_currency'),public.business_report_csv_cell(cell->>'exchange_rate',true),
        public.business_report_csv_cell(cell->>'rate_effective_at'),public.business_report_csv_cell(cell->>'rate_provider'),
        public.business_report_csv_cell(cell->>'category_name'),public.business_report_csv_cell(cell->>'dimension_name'),
        public.business_report_csv_cell(cell->>'person_name'),public.business_report_csv_cell(cell->>'payment_source'),
        public.business_report_csv_cell(cell->>'reference'),public.business_report_csv_cell(cell->>'receipt_state'),
        public.business_report_csv_cell(cell->>'income_value',true),public.business_report_csv_cell(cell->>'paid_value',true),
        public.business_report_csv_cell(cell->>'commitment_value',true),public.business_report_csv_cell(cell->>'claim_value',true),
        public.business_report_csv_cell(v_data->'metadata'->>'currency'))||E'\r\n','' order by ordinality),'') into v_csv
      from jsonb_array_elements(v_items) with ordinality as cells(cell,ordinality);
  end if;
  perform public.business_record_audit_event(p_workspace_id,'report.exported','business_report',null,'{}'::jsonb,
    jsonb_build_object('section',p_section,'format',p_format,'from',p_from,'to',p_to,'currency_mode',p_mode,
      'currency',p_currency,'category_id',p_category_id,'dimension_id',p_dimension_id,'group_type',p_group_type,
      'group_id',p_group_id,'budget_id',p_budget_id,'row_count',v_count,'fingerprint',p_expected_fingerprint),null,p_export_id);
  return (v_data-'rows')||jsonb_build_object('section',p_section,'items',case when p_format='print' then v_items else '[]'::jsonb end,
    'total_count',v_count,'csv',v_csv);
end;
$$;

-- Extend the existing Owner-only workflow permission editor to report access.
create or replace function public.set_business_workflow_permission(p_workspace_id uuid,p_role text,p_permission_code text,p_enabled boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.business_claims_active(p_workspace_id) then raise exception 'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED'; end if;
  if p_permission_code is null or p_permission_code not in ('approvals.view','approvals.review','budgets.view','budgets.manage','reports.view','reports.export')
    then raise exception 'INVALID_BUSINESS_PERMISSION'; end if;
  perform public.set_business_role_permission(p_workspace_id,p_role,p_permission_code,p_enabled);
end;
$$;
do $$ declare v_signature text;
begin
  foreach v_signature in array array[
    'public.business_report_scope(uuid,uuid,uuid)',
    'public.business_report_summary(uuid,date,date,text,text,uuid,uuid)',
    'public.business_report_records(uuid,text,text,date,date,text,text,uuid,uuid,text,uuid,uuid,integer,integer)',
    'public.business_report_export(uuid,text,text,uuid,text,date,date,text,text,uuid,uuid,text,uuid,uuid)'
  ] loop
    execute format('revoke all on function %s from public,anon',v_signature);
    execute format('grant execute on function %s to authenticated',v_signature);
  end loop;
end $$;
revoke all on function public.business_report_rows(uuid,date,date,text,text,uuid,uuid) from public,anon,authenticated;
revoke all on function public.business_report_data(uuid,date,date,text,text,uuid,uuid) from public,anon,authenticated;
revoke all on function public.business_report_selection(jsonb,text,text,uuid,uuid) from public,anon,authenticated;
revoke all on function public.business_report_csv_cell(text,boolean) from public,anon,authenticated;
notify pgrst, 'reload schema';
commit;
