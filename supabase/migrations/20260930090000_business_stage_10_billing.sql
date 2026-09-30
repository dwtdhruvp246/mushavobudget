begin;

-- Private pilot settings. Historical catalogue prices are not approved Business prices.
create table public.business_billing_settings (
  plan_id uuid primary key references public.plans(id) on delete restrict,
  pilot_enabled boolean not null default false,
  included_seats integer check(included_seats between 1 and 100),
  currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'),
  monthly_base numeric(12,2) check(monthly_base>=0), annual_base numeric(12,2) check(annual_base>=0),
  monthly_seat numeric(12,2) check(monthly_seat>=0), annual_seat numeric(12,2) check(annual_seat>=0),
  payment_instructions text not null default '' check(char_length(payment_instructions)<=4000),
  version integer not null default 1, updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
insert into public.business_billing_settings(plan_id) select id from public.plans where workspace_type='business';
create function public.seed_business_billing_settings()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.workspace_type='business' then insert into public.business_billing_settings(plan_id) values(new.id) on conflict do nothing; end if;
  return new;
end;
$$;
create trigger seed_business_billing_settings_trigger after insert or update of workspace_type on public.plans
  for each row execute function public.seed_business_billing_settings();
revoke all on function public.seed_business_billing_settings() from public,anon,authenticated;
alter table public.workspace_subscriptions
  add column business_next_member_limit integer check(business_next_member_limit between 1 and 100),
  add column business_next_effective_at timestamptz;
alter table public.workspace_subscriptions add constraint business_next_capacity_pair check
  ((business_next_member_limit is null)=(business_next_effective_at is null));

create table public.business_subscription_quotes (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.budget_workspaces(id),
  owner_id uuid not null references auth.users(id), plan_id uuid not null references public.plans(id),
  kind text not null check(kind in ('renewal','extra_seats')), billing_period text not null check(billing_period in ('monthly','annual')),
  currency text not null check(currency ~ '^[A-Z]{3}$'), total_seats integer not null check(total_seats between 1 and 100),
  additional_seats integer not null default 0, included_seats integer not null,
  base_amount numeric(12,2) not null, seat_price numeric(12,2) not null, amount numeric(12,2) not null check(amount>=0),
  fraction numeric not null, term_start_at timestamptz not null, term_end_at timestamptz not null,
  original_expiry_at timestamptz, original_limit integer not null,
  subscription_version integer not null, settings_version integer not null,
  quoted_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '30 minutes',
  status text not null default 'quoted' check(status in ('quoted','submitted','approved','rejected','cancelled')),
  payment_id uuid unique references public.subscription_payments(id),
  unique(workspace_id,id), check(term_end_at>term_start_at)
);
create index business_subscription_quotes_workspace_idx on public.business_subscription_quotes(workspace_id,quoted_at desc);
alter table public.subscription_renewal_requests add column business_quote_id uuid unique;
alter table public.subscription_renewal_requests add constraint business_request_quote_workspace_fk
  foreign key(workspace_id,business_quote_id) references public.business_subscription_quotes(workspace_id,id);

alter table public.business_billing_settings enable row level security;
alter table public.business_billing_settings force row level security;
alter table public.business_subscription_quotes enable row level security;
alter table public.business_subscription_quotes force row level security;
revoke all on public.business_billing_settings,public.business_subscription_quotes from public,anon,authenticated;

create function public.business_billing_owner(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and not public.my_account_suspended() and exists(
    select 1 from public.budget_workspaces w join public.workspace_members m on m.workspace_id=w.id
    where w.id=p_workspace_id and w.workspace_type='business' and w.owner_id=auth.uid()
      and w.status<>'closed' and m.user_id=auth.uid() and m.role='business_owner' and m.status='active');
$$;
create function public.business_effective_member_limit(p_workspace_id uuid,p_for_invitation boolean default false)
returns integer language sql stable security definer set search_path=public,pg_temp as $$
  select case when s.business_next_effective_at<=now() then s.business_next_member_limit
    when p_for_invitation and s.business_next_member_limit is not null then least(s.member_limit,s.business_next_member_limit)
    else s.member_limit end from public.workspace_subscriptions s where s.workspace_id=p_workspace_id;
$$;
create function public.business_billing_usage(p_workspace_id uuid)
returns integer language sql stable security definer set search_path=public,pg_temp as $$
  select (select count(*) from public.workspace_members where workspace_id=p_workspace_id and status='active')::integer
    +(select count(*) from public.workspace_invitations where workspace_id=p_workspace_id and status='pending' and expires_at>now())::integer;
$$;
create function public.business_seat_proration(p_start timestamptz,p_end timestamptz,p_at timestamptz)
returns numeric language plpgsql immutable set search_path=public,pg_temp as $$
begin
  if p_start is null or p_end is null or p_at is null or not isfinite(p_start) or not isfinite(p_end) or not isfinite(p_at)
    or p_end<=p_start or p_at<p_start or p_at>=p_end then raise exception 'INVALID_BUSINESS_BILLING_TERM'; end if;
  return extract(epoch from(p_end-p_at))/extract(epoch from(p_end-p_start));
end;
$$;

create function public.admin_business_billing_settings()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if public.my_account_suspended() or not public.is_platform_staff(array['super_admin','admin_staff']) then raise exception 'BUSINESS_BILLING_ADMIN_REQUIRED'; end if;
  return coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('plan_name',p.display_name) order by p.sort_order)
    from public.business_billing_settings s join public.plans p on p.id=s.plan_id where p.workspace_type='business'),'[]'::jsonb);
end;
$$;
create function public.save_business_billing_settings(p_plan_id uuid,p_expected_version integer,p_pilot_enabled boolean,p_included_seats integer,
  p_currency text,p_monthly_base numeric,p_annual_base numeric,p_monthly_seat numeric,p_annual_seat numeric,p_payment_instructions text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_old public.business_billing_settings%rowtype; v_new public.business_billing_settings%rowtype;
begin
  if public.my_account_suspended() or not public.is_platform_staff(array['super_admin','admin_staff']) then raise exception 'BUSINESS_BILLING_ADMIN_REQUIRED'; end if;
  if not exists(select 1 from public.plans where id=p_plan_id and workspace_type='business' and is_active)
    or p_currency is null or p_currency !~ '^[A-Z]{3}$' or not exists(select 1 from public.supported_currencies where code=p_currency and is_active)
    or p_included_seats is not null and p_included_seats not between 1 and 100
    or exists(select 1 from unnest(array[p_monthly_base,p_annual_base,p_monthly_seat,p_annual_seat]) price where price<0 or price::text='NaN')
    or char_length(coalesce(p_payment_instructions,''))>4000
    or (p_pilot_enabled and (p_included_seats is null or nullif(btrim(p_payment_instructions),'') is null
      or not ((p_monthly_base is not null and p_monthly_seat is not null) or (p_annual_base is not null and p_annual_seat is not null))))
  then raise exception 'INVALID_BUSINESS_BILLING_SETTINGS'; end if;
  insert into public.business_billing_settings(plan_id) values(p_plan_id) on conflict do nothing;
  select * into v_old from public.business_billing_settings where plan_id=p_plan_id for update;
  if p_expected_version is distinct from v_old.version then raise exception 'BUSINESS_BILLING_SETTINGS_CHANGED'; end if;
  update public.business_billing_settings set pilot_enabled=coalesce(p_pilot_enabled,false),included_seats=p_included_seats,currency=p_currency,
    monthly_base=p_monthly_base,annual_base=p_annual_base,monthly_seat=p_monthly_seat,annual_seat=p_annual_seat,
    payment_instructions=btrim(coalesce(p_payment_instructions,'')),version=version+1,updated_by=auth.uid(),updated_at=now()
    where plan_id=p_plan_id returning * into v_new;
  insert into public.plan_limits(plan_id,limit_code,limit_value) values(p_plan_id,'included_member_seats',p_included_seats)
    on conflict(plan_id,limit_code) do update set limit_value=excluded.limit_value;
  insert into public.subscription_audit_events(actor_id,action,target_type,target_id,safe_details)
    values(auth.uid(),'business.billing_settings_saved','plan',p_plan_id,jsonb_build_object('before',to_jsonb(v_old),'after',to_jsonb(v_new)));
  return to_jsonb(v_new);
end;
$$;

create function public.business_billing_snapshot(p_workspace_id uuid,p_offset integer default 0,p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_subscription public.workspace_subscriptions%rowtype; v_settings public.business_billing_settings%rowtype; v_history jsonb; v_total integer;
begin
  if not public.business_billing_owner(p_workspace_id) then raise exception 'BUSINESS_BILLING_OWNER_REQUIRED'; end if;
  select * into v_subscription from public.workspace_subscriptions where workspace_id=p_workspace_id;
  select * into v_settings from public.business_billing_settings where plan_id=v_subscription.plan_id;
  select count(*)::integer into v_total from public.subscription_payments where workspace_id=p_workspace_id;
  select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at desc),'[]'::jsonb) into v_history from (
    select p.id,p.created_at,p.amount,p.currency,p.status,p.payment_method,p.payment_date,p.reference_number,p.receipt_number,p.notes,
      i.invoice_number,i.plan_name,i.billing_period,i.billable_member_count,r.rejection_reason,r.reviewed_at,q.kind,q.term_start_at,q.term_end_at,
      q.total_seats,q.additional_seats,q.fraction,q.quoted_at,
      (select jsonb_agg(jsonb_build_object('path',d.storage_path,'name',d.original_name)) from public.subscription_payment_proofs d where d.payment_id=p.id) as proofs
    from public.subscription_payments p join public.subscription_renewal_requests r on r.id=p.renewal_request_id
      join public.subscription_invoices i on i.id=r.invoice_id left join public.business_subscription_quotes q on q.id=r.business_quote_id
    where p.workspace_id=p_workspace_id order by p.created_at desc,p.id
    offset greatest(0,coalesce(p_offset,0)) limit least(50,greatest(1,coalesce(p_limit,20)))
  ) h;
  return jsonb_build_object('subscription',to_jsonb(v_subscription),'settings',to_jsonb(v_settings),
    'current_limit',public.business_effective_member_limit(p_workspace_id),'invitation_limit',public.business_effective_member_limit(p_workspace_id,true),
    'usage',public.business_billing_usage(p_workspace_id),'history',v_history,'history_count',v_total,
    'suspended',exists(select 1 from public.budget_workspaces where id=p_workspace_id and status='suspended') or v_subscription.status='suspended',
    'pending',exists(select 1 from public.subscription_renewal_requests where workspace_id=p_workspace_id and status='pending_review'),
    'renewal_scheduled',coalesce(v_subscription.business_next_effective_at>now(),false),
    'plan_name',(select display_name from public.plans where id=v_subscription.plan_id));
end;
$$;
create function public.admin_business_subscription_payment_detail(p_payment_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if public.my_account_suspended() or not public.is_platform_staff(array['super_admin','admin_staff','finance_staff','support_staff']) then raise exception 'FINANCE_REVIEW_ACCESS_REQUIRED'; end if;
  return (select to_jsonb(q) from public.subscription_payments p join public.subscription_renewal_requests r on r.id=p.renewal_request_id
    join public.business_subscription_quotes q on q.id=r.business_quote_id where p.id=p_payment_id and q.workspace_id=p.workspace_id);
end;
$$;

create function public.business_subscription_quote(p_workspace_id uuid,p_kind text,p_billing_period text,p_quantity integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.workspace_subscriptions%rowtype; c public.business_billing_settings%rowtype; q public.business_subscription_quotes%rowtype;
declare v_start timestamptz; v_end timestamptz; v_fraction numeric:=1; v_limit integer; v_seat numeric; v_base numeric; v_total integer; v_add integer:=0;
begin
  if not public.business_billing_owner(p_workspace_id) then raise exception 'BUSINESS_BILLING_OWNER_REQUIRED'; end if;
  perform 1 from public.budget_workspaces where id=p_workspace_id and status='active' for update;
  if not found then raise exception 'BUSINESS_BILLING_SUSPENDED'; end if;
  select * into s from public.workspace_subscriptions where workspace_id=p_workspace_id for update;
  if s.id is null or s.status='suspended' then raise exception 'BUSINESS_BILLING_SUSPENDED'; end if;
  select * into c from public.business_billing_settings where plan_id=s.plan_id;
  if c.plan_id is null or not c.pilot_enabled or c.included_seats is null
    or not exists(select 1 from public.plans where id=s.plan_id and is_active and workspace_type='business')
  then raise exception 'BUSINESS_BILLING_NOT_CONFIGURED'; end if;
  if p_kind is null or p_kind not in ('renewal','extra_seats') or p_quantity is null or p_quantity not between 1 and 100
    or p_billing_period is null or p_billing_period not in ('monthly','annual') then raise exception 'INVALID_BUSINESS_QUOTE'; end if;
  if exists(select 1 from public.subscription_renewal_requests where workspace_id=p_workspace_id and status='pending_review') then raise exception 'SUBSCRIPTION_REVIEW_ALREADY_PENDING'; end if;
  if s.business_next_effective_at>now() then raise exception 'BUSINESS_RENEWAL_ALREADY_SCHEDULED'; end if;
  v_limit:=public.business_effective_member_limit(p_workspace_id);
  v_base:=case when p_billing_period='monthly' then c.monthly_base else c.annual_base end;
  v_seat:=case when p_billing_period='monthly' then c.monthly_seat else c.annual_seat end;
  if v_base is null or v_seat is null then raise exception 'BUSINESS_BILLING_NOT_CONFIGURED'; end if;
  if p_kind='extra_seats' then
    if s.status<>'active' or s.paid_through_at<=now() or p_billing_period is distinct from s.billing_period then raise exception 'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED'; end if;
    v_total:=v_limit+p_quantity;v_add:=p_quantity;v_base:=0;
    if v_total>100 then raise exception 'INVALID_BUSINESS_QUOTE'; end if;
    v_start:=greatest(coalesce(s.billing_anchor_at,s.entitlement_start_at),s.entitlement_start_at);v_end:=s.paid_through_at;
    v_fraction:=public.business_seat_proration(v_start,v_end,now());
  else
    v_total:=p_quantity;
    if v_total<c.included_seats or v_total<public.business_billing_usage(p_workspace_id) then raise exception 'BUSINESS_CAPACITY_BELOW_USAGE'; end if;
    v_start:=greatest(now(),coalesce(s.paid_through_at,now()));
    v_end:=((v_start at time zone 'UTC')+case when p_billing_period='annual' then interval '1 year' else interval '1 month' end) at time zone 'UTC';
  end if;
  insert into public.business_subscription_quotes(workspace_id,owner_id,plan_id,kind,billing_period,currency,total_seats,additional_seats,included_seats,
    base_amount,seat_price,amount,fraction,term_start_at,term_end_at,original_expiry_at,original_limit,subscription_version,settings_version)
  values(p_workspace_id,auth.uid(),s.plan_id,p_kind,p_billing_period,c.currency,v_total,v_add,c.included_seats,v_base,v_seat,
    round(v_base+v_seat*case when p_kind='extra_seats' then v_add*v_fraction else greatest(v_total-c.included_seats,0) end,2),
    v_fraction,v_start,v_end,s.paid_through_at,v_limit,s.version,c.version) returning * into q;
  return to_jsonb(q)||jsonb_build_object('payment_instructions',c.payment_instructions,'plan_name',(select display_name from public.plans where id=s.plan_id),
    'remaining_seconds',extract(epoch from(v_end-now())),'term_seconds',extract(epoch from(v_end-v_start)));
end;
$$;

-- A private quote is required even while the public Business purchase gate stays closed.
create or replace function public.enforce_business_subscription_request_launch_control()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.plans where id=new.requested_plan_id and workspace_type='business') and not exists(
    select 1 from public.business_subscription_quotes q join public.business_billing_settings c on c.plan_id=q.plan_id
    where q.id=new.business_quote_id and q.workspace_id=new.workspace_id and q.plan_id=new.requested_plan_id
      and q.owner_id=new.requested_by and q.status='quoted' and q.expires_at>now() and c.pilot_enabled
      and c.version=q.settings_version and not coalesce(new.provision_workspace_on_approval,false))
  then raise exception 'BUSINESS_COMING_SOON'; end if;
  return new;
end;
$$;
create or replace function public.enforce_business_payment_approval_launch_control()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.status='approved' and old.status is distinct from 'approved'
    and exists(select 1 from public.subscription_renewal_requests r join public.plans p on p.id=r.requested_plan_id
      where r.id=new.renewal_request_id and p.workspace_type='business') and not exists(
      select 1 from public.subscription_renewal_requests r join public.business_subscription_quotes q on q.id=r.business_quote_id
      where r.id=new.renewal_request_id and q.payment_id=new.id and q.status='approved')
  then raise exception 'BUSINESS_COMING_SOON'; end if;
  return new;
end;
$$;

create function public.submit_business_subscription_payment(p_workspace_id uuid,p_quote_id uuid,p_payment_id uuid,
  p_payment_method text default null,p_payment_date date default null,p_reference_number text default null,p_notes text default null,
  p_proof_path text default null,p_proof_name text default null,p_proof_mime_type text default null,p_proof_size_bytes bigint default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.workspace_subscriptions%rowtype; q public.business_subscription_quotes%rowtype; c public.business_billing_settings%rowtype;
declare v_invoice uuid;v_request uuid;v_mime text;v_size bigint;
begin
  if not public.business_billing_owner(p_workspace_id) then raise exception 'BUSINESS_BILLING_OWNER_REQUIRED'; end if;
  perform 1 from public.budget_workspaces where id=p_workspace_id and status='active' for update;
  if not found then raise exception 'BUSINESS_BILLING_SUSPENDED'; end if;
  select * into s from public.workspace_subscriptions where workspace_id=p_workspace_id for update;
  select * into q from public.business_subscription_quotes where id=p_quote_id and workspace_id=p_workspace_id and owner_id=auth.uid() for update;
  if q.id is null or p_payment_id is null then raise exception 'INVALID_BUSINESS_QUOTE'; end if;
  if q.status='submitted' and q.payment_id=p_payment_id then return p_payment_id; end if;
  select * into c from public.business_billing_settings where plan_id=q.plan_id for share;
  if s.status='suspended' then raise exception 'BUSINESS_BILLING_SUSPENDED'; end if;
  if q.status<>'quoted' or q.expires_at<=now() or not c.pilot_enabled or c.version<>q.settings_version
    or s.version<>q.subscription_version or s.plan_id<>q.plan_id or s.paid_through_at is distinct from q.original_expiry_at
    or public.business_effective_member_limit(p_workspace_id)<>q.original_limit or s.business_next_effective_at>now()
  then raise exception 'BUSINESS_SUBSCRIPTION_QUOTE_CHANGED'; end if;
  if q.kind='extra_seats' and (s.status<>'active' or s.paid_through_at<=now()) then raise exception 'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED'; end if;
  if q.total_seats<public.business_billing_usage(p_workspace_id) then raise exception 'BUSINESS_CAPACITY_BELOW_USAGE'; end if;
  if exists(select 1 from public.subscription_renewal_requests where workspace_id=p_workspace_id and status='pending_review') then raise exception 'SUBSCRIPTION_REVIEW_ALREADY_PENDING'; end if;
  if q.amount>0 and (nullif(btrim(p_payment_method),'') is null or p_payment_date is null or p_payment_date>current_date
    or nullif(btrim(p_reference_number),'') is null or char_length(p_reference_number)>160 or char_length(p_payment_method)>100)
    or char_length(coalesce(p_notes,''))>2000 then raise exception 'PAYMENT_DETAILS_REQUIRED'; end if;
  if p_proof_path is not null then
    if q.amount=0 or split_part(p_proof_path,'/',1)<>'workspaces' or split_part(p_proof_path,'/',2)<>p_workspace_id::text
      or split_part(p_proof_path,'/',3)<>auth.uid()::text or p_proof_path like '%..%'
      or p_proof_mime_type not in ('image/jpeg','image/png','image/webp','application/pdf') or p_proof_size_bytes is null
      or p_proof_size_bytes not between 1 and 10485760 then raise exception 'INVALID_SUBSCRIPTION_PROOF_PATH'; end if;
    select metadata->>'mimetype',nullif(metadata->>'size','')::bigint into v_mime,v_size from storage.objects
      where bucket_id='subscription-proofs' and name=p_proof_path;
    if not found or v_mime is distinct from p_proof_mime_type or v_size is distinct from p_proof_size_bytes then raise exception 'SUBSCRIPTION_PROOF_NOT_FOUND'; end if;
  end if;
  insert into public.subscription_invoices(workspace_id,invoice_number,plan_code,plan_name,billing_period,currency,base_amount,extra_member_amount,
    billable_member_count,included_member_count,extra_member_count,total_amount,created_by)
  select p_workspace_id,'MB-B-'||upper(replace(p_payment_id::text,'-','')),code,display_name,q.billing_period,q.currency,q.base_amount,q.seat_price,
    q.total_seats,q.included_seats,case when q.kind='extra_seats' then q.additional_seats else greatest(q.total_seats-q.included_seats,0) end,q.amount,auth.uid()
    from public.plans where id=q.plan_id returning id into v_invoice;
  insert into public.subscription_renewal_requests(workspace_id,invoice_id,requested_plan_id,requested_by,business_quote_id)
    values(p_workspace_id,v_invoice,q.plan_id,auth.uid(),q.id) returning id into v_request;
  insert into public.subscription_payments(id,renewal_request_id,workspace_id,submitted_by,amount,currency,payment_method,payment_date,reference_number,notes)
    values(p_payment_id,v_request,p_workspace_id,auth.uid(),q.amount,q.currency,case when q.amount=0 then 'No payment required' else btrim(p_payment_method) end,
      case when q.amount=0 then current_date else p_payment_date end,case when q.amount=0 then 'NO-CHARGE-'||q.id else btrim(p_reference_number) end,nullif(btrim(p_notes),''));
  update public.business_subscription_quotes set status='submitted',payment_id=p_payment_id where id=q.id;
  if p_proof_path is not null then insert into public.subscription_payment_proofs(payment_id,storage_path,original_name,mime_type,size_bytes,uploaded_by)
    values(p_payment_id,p_proof_path,left(coalesce(nullif(p_proof_name,''),'Payment proof'),255),p_proof_mime_type,p_proof_size_bytes,auth.uid()); end if;
  insert into public.subscription_audit_events(workspace_id,actor_id,action,target_type,target_id,safe_details)
    values(p_workspace_id,auth.uid(),'business.billing_submitted','subscription_payment',p_payment_id,to_jsonb(q));
  return p_payment_id;
end;
$$;

-- Preserve the Personal/Family implementation without letting clients bypass Business review.
alter function public.review_subscription_payment(uuid,text,text) rename to review_subscription_payment_before_business_stage10;
revoke all on function public.review_subscription_payment_before_business_stage10(uuid,text,text) from public,anon,authenticated;
create function public.review_subscription_payment(p_payment_id uuid,p_decision text,p_reason text default null)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.subscription_payments%rowtype;r public.subscription_renewal_requests%rowtype;i public.subscription_invoices%rowtype;
declare q public.business_subscription_quotes%rowtype;s public.workspace_subscriptions%rowtype;w public.budget_workspaces%rowtype;
declare v_start timestamptz;v_end timestamptz;v_receipt text;
begin
  if public.my_account_suspended() or not public.is_platform_staff(array['super_admin','admin_staff','finance_staff']) then raise exception 'FINANCE_REVIEW_ACCESS_REQUIRED'; end if;
  if p_decision is null or p_decision not in ('approved','rejected') then raise exception 'INVALID_REVIEW_DECISION'; end if;
  select * into p from public.subscription_payments where id=p_payment_id;
  if p.id is null then raise exception 'SUBSCRIPTION_PAYMENT_NOT_FOUND'; end if;
  select * into w from public.budget_workspaces where id=p.workspace_id;
  if w.workspace_type<>'business' then return public.review_subscription_payment_before_business_stage10(p_payment_id,p_decision,p_reason); end if;
  select * into w from public.budget_workspaces where id=p.workspace_id for update;
  select * into s from public.workspace_subscriptions where workspace_id=w.id for update;
  select * into p from public.subscription_payments where id=p_payment_id for update;
  if p.status<>'pending_review' then return 'already_reviewed'; end if;
  select * into r from public.subscription_renewal_requests where id=p.renewal_request_id for update;
  select * into i from public.subscription_invoices where id=r.invoice_id for update;
  select * into q from public.business_subscription_quotes where id=r.business_quote_id for update;
  if q.id is null or q.status<>'submitted' or q.payment_id<>p.id or q.workspace_id<>w.id or r.workspace_id<>w.id
    or i.workspace_id<>w.id or p.amount<>q.amount or p.currency<>q.currency or i.total_amount<>q.amount
    or i.currency<>q.currency or i.billable_member_count<>q.total_seats or r.requested_plan_id<>q.plan_id
  then raise exception 'INVALID_BUSINESS_SUBSCRIPTION_PAYMENT'; end if;
  if p_decision='rejected' then
    if nullif(btrim(p_reason),'') is null then raise exception 'REJECTION_REASON_REQUIRED'; end if;
    update public.business_subscription_quotes set status='rejected' where id=q.id;
    update public.subscription_payments set status='rejected',updated_at=now() where id=p.id;
    update public.subscription_renewal_requests set status='rejected',rejection_reason=left(btrim(p_reason),2000),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=r.id;
    update public.subscription_invoices set status='rejected' where id=i.id;
  else
    if p.submitted_by=auth.uid() then raise exception 'BUSINESS_BILLING_SELF_REVIEW_FORBIDDEN'; end if;
    if w.status<>'active' or s.status='suspended' or exists(select 1 from public.profiles where id=w.owner_id and account_status<>'active')
    then raise exception 'BUSINESS_BILLING_SUSPENDED'; end if;
    if w.owner_id<>q.owner_id or s.plan_id<>q.plan_id or s.version<>q.subscription_version or s.paid_through_at is distinct from q.original_expiry_at
      or public.business_effective_member_limit(w.id)<>q.original_limit or s.business_next_effective_at>now()
    then raise exception 'BUSINESS_SUBSCRIPTION_QUOTE_CHANGED'; end if;
    if q.total_seats<public.business_billing_usage(w.id) then raise exception 'BUSINESS_CAPACITY_BELOW_USAGE'; end if;
    if q.kind='extra_seats' then
      if s.status<>'active' or s.paid_through_at<=now() then raise exception 'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED'; end if;
      v_start:=q.term_start_at;v_end:=q.term_end_at;
      update public.workspace_subscriptions set member_limit=q.total_seats,version=version+1,updated_at=now() where workspace_id=w.id;
    else
      v_start:=greatest(now(),coalesce(s.paid_through_at,now()));
      v_end:=((v_start at time zone 'UTC')+case when q.billing_period='annual' then interval '1 year' else interval '1 month' end) at time zone 'UTC';
      update public.workspace_subscriptions set status='active',paid_through_at=v_end,billing_period=q.billing_period,
        member_limit=case when v_start>now() then public.business_effective_member_limit(w.id) else q.total_seats end,
        business_next_member_limit=case when v_start>now() then q.total_seats end,business_next_effective_at=case when v_start>now() then v_start end,
        billing_anchor_at=v_start,version=version+1,updated_at=now() where workspace_id=w.id;
    end if;
    -- Store the actual approved term on the receipt, while preserving the original quotation time/amount.
    update public.business_subscription_quotes set status='approved',term_start_at=v_start,term_end_at=v_end where id=q.id;
    v_receipt:='MBR-B-'||upper(replace(p.id::text,'-',''));
    update public.subscription_payments set status='approved',receipt_number=v_receipt,updated_at=now() where id=p.id;
    update public.subscription_renewal_requests set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=r.id;
    update public.subscription_invoices set status='paid',paid_at=now() where id=i.id;
    insert into public.subscription_entitlement_history(workspace_id,subscription_id,plan_id,status,effective_from,effective_until,reason,actor_id)
      values(w.id,s.id,q.plan_id,'active',v_start,v_end,'Approved Business '||q.kind||' on '||i.invoice_number,auth.uid());
  end if;
  insert into public.subscription_payment_reviews(payment_id,reviewer_id,decision,reason) values(p.id,auth.uid(),p_decision,nullif(btrim(p_reason),''));
  insert into public.subscription_audit_events(workspace_id,actor_id,action,target_type,target_id,safe_details)
    values(w.id,auth.uid(),'business.billing_'||p_decision,'subscription_payment',p.id,jsonb_build_object('quote_id',q.id,'kind',q.kind,'seats',q.total_seats,'term_start',v_start,'term_end',v_end));
  insert into public.notifications(user_id,created_by,type,title,body,url) values(w.owner_id,auth.uid(),'subscription',
    case when p_decision='approved' then 'Business subscription payment approved' else 'Business subscription payment rejected' end,
    case when p_decision='approved' then 'View your subscription dates, purchased capacity and receipt in Business Billing.' else 'View the review reason in Business Billing.' end,'/business.html?workspace='||w.id||'#business/subscription');
  return p_decision;
end;
$$;

-- Business capacity is applied by its protected review and future-effective helper.
create or replace function public.apply_approved_subscription_member_limit()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_limit integer;v_used integer;
begin
  if new.status<>'approved' or old.status='approved' or exists(select 1 from public.budget_workspaces where id=new.workspace_id and workspace_type='business') then return new; end if;
  select i.billable_member_count into v_limit from public.subscription_renewal_requests r join public.subscription_invoices i on i.id=r.invoice_id where r.id=new.renewal_request_id;
  v_limit:=greatest(1,coalesce(v_limit,1));
  select count(*)::integer into v_used from public.workspace_members where workspace_id=new.workspace_id and status='active';
  if v_used>v_limit then raise exception 'APPROVED_MEMBER_LIMIT_BELOW_USAGE'; end if;
  update public.workspace_subscriptions set member_limit=v_limit,updated_at=now() where workspace_id=new.workspace_id;
  return new;
end;
$$;

-- Shared subscription rows remain RPC-only for Business; Personal/Family policies are unchanged.
do $$ declare t text;
begin
  foreach t in array array['subscription_invoices','subscription_renewal_requests','subscription_payments'] loop
    execute format('create policy business_billing_direct_write_guard on public.%I as restrictive for insert to authenticated with check
      (not exists(select 1 from public.budget_workspaces where id=workspace_id and workspace_type=''business''))',t);
    execute format('create policy business_billing_direct_update_guard on public.%I as restrictive for update to authenticated using
      (not exists(select 1 from public.budget_workspaces where id=workspace_id and workspace_type=''business'')) with check
      (not exists(select 1 from public.budget_workspaces where id=workspace_id and workspace_type=''business''))',t);
  end loop;
end $$;

revoke all on function public.business_effective_member_limit(uuid,boolean),public.business_billing_usage(uuid),public.business_seat_proration(timestamptz,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.business_billing_owner(uuid) from public,anon;
grant execute on function public.business_billing_owner(uuid) to authenticated;
do $$ declare sig text;
begin
  foreach sig in array array['admin_business_billing_settings()','admin_business_subscription_payment_detail(uuid)',
    'save_business_billing_settings(uuid,integer,boolean,integer,text,numeric,numeric,numeric,numeric,text)',
    'business_billing_snapshot(uuid,integer,integer)','business_subscription_quote(uuid,text,text,integer)',
    'submit_business_subscription_payment(uuid,uuid,uuid,text,date,text,text,text,text,text,bigint)','review_subscription_payment(uuid,text,text)'] loop
    execute format('revoke all on function public.%s from public,anon',sig);
    execute format('grant execute on function public.%s to authenticated',sig);
  end loop;
end $$;

create function public.reset_business_capacity_after_manual_grant()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.budget_workspaces where id=new.workspace_id and workspace_type='business') then
    update public.workspace_subscriptions set member_limit=greatest(public.business_effective_member_limit(new.workspace_id),
      public.business_billing_usage(new.workspace_id),coalesce((select included_seats from public.business_billing_settings where plan_id=new.plan_id),1)),
      business_next_member_limit=null,business_next_effective_at=null,billing_anchor_at=entitlement_start_at
      where workspace_id=new.workspace_id;
  end if;
  return new;
end;
$$;
create trigger reset_business_capacity_after_manual_grant_trigger after insert on public.admin_subscription_grants
  for each row execute function public.reset_business_capacity_after_manual_grant();
revoke all on function public.reset_business_capacity_after_manual_grant() from public,anon,authenticated;

create function public.business_subscription_proof_access(p_path text,p_write boolean default false)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_workspace uuid;v_type text;
begin
  if split_part(p_path,'/',1)<>'workspaces' or split_part(p_path,'/',2) !~ '^[0-9a-fA-F-]{36}$' then return false; end if;
  begin v_workspace:=split_part(p_path,'/',2)::uuid; exception when invalid_text_representation then return false; end;
  select workspace_type into v_type from public.budget_workspaces where id=v_workspace;
  if v_type is distinct from 'business' then return true; end if;
  if public.my_account_suspended() then return false; end if;
  if not p_write and public.is_platform_staff(array['super_admin','admin_staff','finance_staff','support_staff']) then return true; end if;
  return public.business_billing_owner(v_workspace) and (not p_write or
    (split_part(p_path,'/',3)=auth.uid()::text and exists(select 1 from public.budget_workspaces where id=v_workspace and status='active')
      and exists(select 1 from public.workspace_subscriptions s join public.business_billing_settings c on c.plan_id=s.plan_id
        where s.workspace_id=v_workspace and s.status<>'suspended' and c.pilot_enabled)));
end;
$$;
revoke all on function public.business_subscription_proof_access(text,boolean) from public,anon;
grant execute on function public.business_subscription_proof_access(text,boolean) to authenticated;
create policy business_subscription_proof_read_guard on storage.objects as restrictive for select to authenticated
  using(bucket_id<>'subscription-proofs' or public.business_subscription_proof_access(name));
create policy business_subscription_proof_upload_guard on storage.objects as restrictive for insert to authenticated
  with check(bucket_id<>'subscription-proofs' or public.business_subscription_proof_access(name,true));
create policy business_subscription_proof_delete_guard on storage.objects as restrictive for delete to authenticated
  using(bucket_id<>'subscription-proofs' or public.business_subscription_proof_access(name,true));
create policy business_entitlement_history_owner_guard on public.subscription_entitlement_history as restrictive for select to authenticated
  using(not exists(select 1 from public.budget_workspaces where id=workspace_id and workspace_type='business')
    or public.business_billing_owner(workspace_id) or public.is_platform_staff(array['super_admin','admin_staff','finance_staff','support_staff']));
create policy business_subscription_audit_owner_guard on public.subscription_audit_events as restrictive for select to authenticated
  using(not exists(select 1 from public.budget_workspaces where id=workspace_id and workspace_type='business')
    or public.business_billing_owner(workspace_id) or public.is_platform_staff(array['super_admin','admin_staff','finance_staff','support_staff']));

-- Replace the temporary test-seat floor with the purchased and reserved capacity.
-- Keep existing accepted members and live invitations when an older test grant
-- relied on the temporary floor rather than storing its capacity explicitly.
update public.workspace_subscriptions s set member_limit=public.business_billing_usage(s.workspace_id),updated_at=now()
where exists(select 1 from public.budget_workspaces where id=s.workspace_id and workspace_type='business')
  and s.member_limit<public.business_billing_usage(s.workspace_id);
create or replace function public.business_team_snapshot(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_can_view boolean;
  v_can_manage boolean;
  v_is_owner boolean;
  v_limit integer;
  v_active integer;
  v_pending integer;
  v_members jsonb;
  v_invitations jsonb;
begin
  if not public.business_claims_active(p_workspace_id) then
    raise exception 'BUSINESS_MEMBERSHIP_REQUIRED';
  end if;
  perform public.expire_business_invitations(p_workspace_id);
  select owner_id = auth.uid() into v_is_owner
  from public.budget_workspaces
  where id = p_workspace_id and workspace_type = 'business' and status = 'active';
  v_can_manage := public.business_team_can_manage(p_workspace_id);
  v_can_view := v_is_owner or public.business_has_permission(p_workspace_id, 'team.view') or v_can_manage;

  select public.business_effective_member_limit(p_workspace_id, true) into v_limit
  from public.workspace_subscriptions
  where workspace_id = p_workspace_id and status = 'active' and paid_through_at > now();
  select count(*)::integer into v_active from public.workspace_members
  where workspace_id = p_workspace_id and status = 'active';
  select count(*)::integer into v_pending from public.workspace_invitations
  where workspace_id = p_workspace_id and status = 'pending';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', members.id,
    'user_id', members.user_id,
    'full_name', coalesce(nullif(profiles.full_name, ''), profiles.email, 'Business member'),
    'email', case when v_can_view then profiles.email else null end,
    'role', members.role,
    'status', members.status,
    'joined_at', members.joined_at,
    'scope_ids', coalesce((select jsonb_agg(scopes.dimension_id order by scopes.dimension_id)
      from public.business_member_scopes as scopes where scopes.member_id = members.id), '[]'::jsonb)
  ) order by (members.role = 'business_owner') desc, members.joined_at), '[]'::jsonb)
  into v_members
  from public.workspace_members as members
  left join public.profiles on profiles.id = members.user_id
  where members.workspace_id = p_workspace_id
    and members.status = 'active'
    and (v_can_view or members.user_id = auth.uid());

  if v_can_manage then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', invitations.id,
      'email', invitations.invitee_email,
      'user_id', invitations.invitee_user_id,
      'role', invitations.role,
      'status', invitations.status,
      'expires_at', invitations.expires_at,
      'created_at', invitations.created_at,
      'last_sent_at', invitations.last_sent_at,
      'delivery_status', invitations.delivery_status,
      'version', invitations.version,
      'scope_ids', coalesce((select jsonb_agg(scopes.dimension_id order by scopes.dimension_id)
        from public.business_invitation_scopes as scopes where scopes.invitation_id = invitations.id), '[]'::jsonb)
    ) order by invitations.created_at desc), '[]'::jsonb)
    into v_invitations
    from public.workspace_invitations as invitations
    where invitations.workspace_id = p_workspace_id
      and invitations.status in ('pending', 'rejected', 'cancelled', 'expired');
  else
    v_invitations := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'members', v_members,
    'invitations', v_invitations,
    'capacity', jsonb_build_object(
      'limit', coalesce(v_limit, 1), 'active', v_active, 'pending', v_pending,
      'used', v_active + v_pending,
      'available', greatest(0, coalesce(v_limit, 1) - v_active - v_pending)
    ),
    'can_view', v_can_view,
    'can_manage', v_can_manage,
    'can_transfer', v_is_owner
  );
end;
$$;

create or replace function public.create_business_invitation(
  p_workspace_id uuid,
  p_email text,
  p_role text,
  p_scope_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(p_email));
  v_user_id uuid;
  v_invitation_id uuid;
  v_limit integer;
  v_used integer;
begin
  if not public.business_team_can_manage(p_workspace_id) then raise exception 'BUSINESS_TEAM_ACCESS_REQUIRED'; end if;
  perform 1 from public.budget_workspaces where id=p_workspace_id and status='active' for update;
  if not found then raise exception 'BUSINESS_TEAM_ACCESS_REQUIRED'; end if;
  perform 1 from public.workspace_subscriptions where workspace_id=p_workspace_id for update;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'INVALID_INVITATION_EMAIL'; end if;
  if p_role not in ('business_admin', 'finance_manager', 'team_manager', 'staff', 'contributor', 'viewer') then
    raise exception 'INVALID_BUSINESS_ROLE';
  end if;
  if lower(coalesce(auth.jwt() ->> 'email', '')) = v_email then raise exception 'CANNOT_INVITE_YOURSELF'; end if;
  perform public.expire_business_invitations(p_workspace_id);

  select profiles.id into v_user_id from public.profiles where lower(profiles.email) = v_email limit 1;
  if exists (select 1 from public.workspace_members where workspace_id = p_workspace_id and status = 'active'
    and (user_id = v_user_id or user_id in (select id from public.profiles where lower(email) = v_email))) then
    raise exception 'ALREADY_BUSINESS_MEMBER';
  end if;
  if exists (select 1 from public.workspace_invitations where workspace_id = p_workspace_id
    and lower(invitee_email) = v_email and status = 'pending') then
    raise exception 'INVITATION_ALREADY_PENDING';
  end if;
  if coalesce(array_length(p_scope_ids, 1), 0) > 20 or exists (
    select 1 from unnest(coalesce(p_scope_ids, '{}'::uuid[])) as scope_id
    where not exists (select 1 from public.business_dimensions
      where id = scope_id and workspace_id = p_workspace_id and status = 'active')
  ) then raise exception 'INVALID_BUSINESS_SCOPE'; end if;

  select public.business_effective_member_limit(p_workspace_id, true) into v_limit from public.workspace_subscriptions
  where workspace_id = p_workspace_id and status = 'active' and paid_through_at > now() for update;
  if v_limit is null then raise exception 'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED'; end if;
  select (select count(*) from public.workspace_members where workspace_id = p_workspace_id and status = 'active')
    + (select count(*) from public.workspace_invitations where workspace_id = p_workspace_id and status = 'pending')
  into v_used;
  if v_used >= v_limit then raise exception 'BUSINESS_SEAT_LIMIT_REACHED'; end if;

  insert into public.business_team_operation_permits(transaction_id, workspace_id, actor_id, operation)
  values (txid_current(), p_workspace_id, auth.uid(), 'invitation_write')
  on conflict do nothing;
  insert into public.workspace_invitations(
    workspace_id, invited_by, invitee_email, invitee_user_id, role,
    status, expires_at, delivery_status
  ) values (
    p_workspace_id, auth.uid(), v_email, v_user_id, p_role,
    'pending', now() + interval '7 days', 'not_sent'
  ) returning id into v_invitation_id;
  delete from public.business_team_operation_permits
  where transaction_id = txid_current() and workspace_id = p_workspace_id and operation = 'invitation_write';

  insert into public.business_invitation_scopes(invitation_id, workspace_id, dimension_id)
  select v_invitation_id, p_workspace_id, distinct_scope
  from unnest(coalesce(p_scope_ids, '{}'::uuid[])) as distinct_scope;

  perform public.business_record_audit_event(p_workspace_id, 'team.invitation_created',
    'workspace_invitation', v_invitation_id, '{}'::jsonb,
    jsonb_build_object('email', v_email, 'role', p_role, 'scope_count', coalesce(array_length(p_scope_ids, 1), 0)));
  return jsonb_build_object('invitation_id', v_invitation_id, 'email', v_email,
    'invitee_user_id', v_user_id, 'existing_user', v_user_id is not null);
end;
$$;

create or replace function public.respond_business_invitation(p_invitation_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.workspace_invitations%rowtype;
  v_member_id uuid;
  v_limit integer;
  v_active integer;
  v_workspace uuid;
begin
  if auth.uid() is null or public.my_account_suspended() then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select workspace_id into v_workspace from public.workspace_invitations where id=p_invitation_id and status='pending'
    and (invitee_user_id=auth.uid() or lower(invitee_email)=lower(coalesce(auth.jwt()->>'email','')));
  if not found then raise exception 'BUSINESS_INVITATION_NOT_AVAILABLE'; end if;
  perform 1 from public.budget_workspaces where id=v_workspace and status='active' for update;
  if not found then raise exception 'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED'; end if;
  perform 1 from public.workspace_subscriptions where workspace_id=v_workspace and status='active' and paid_through_at>now() for update;
  if not found then raise exception 'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED'; end if;
  select * into v_invitation from public.workspace_invitations
  where id = p_invitation_id and status = 'pending'
    and expires_at > now()
    and (invitee_user_id = auth.uid() or lower(invitee_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  for update;
  if not found then raise exception 'BUSINESS_INVITATION_NOT_AVAILABLE'; end if;
  if not p_accept then
    update public.workspace_invitations set status = 'rejected', responded_at = now(), updated_at = now(), version = version + 1
    where id = p_invitation_id;
    perform public.business_record_audit_event(v_invitation.workspace_id, 'team.invitation_declined',
      'workspace_invitation', p_invitation_id, '{}'::jsonb, '{}'::jsonb);
    return v_invitation.workspace_id;
  end if;
  select public.business_effective_member_limit(v_invitation.workspace_id, true) into v_limit from public.workspace_subscriptions
  where workspace_id = v_invitation.workspace_id and status = 'active' and paid_through_at > now() for update;
  if v_limit is null then raise exception 'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED'; end if;
  select count(*)::integer into v_active from public.workspace_members
  where workspace_id = v_invitation.workspace_id and status = 'active';
  if v_active >= v_limit then raise exception 'BUSINESS_SEAT_LIMIT_REACHED'; end if;

  insert into public.business_team_operation_permits(transaction_id, workspace_id, actor_id, operation)
  values (txid_current(), v_invitation.workspace_id, auth.uid(), 'member_write') on conflict do nothing;
  insert into public.workspace_members(workspace_id, user_id, role, status, invited_by, joined_at, removed_at)
  values (v_invitation.workspace_id, auth.uid(), v_invitation.role, 'active', v_invitation.invited_by, now(), null)
  on conflict (workspace_id, user_id) do update set role = excluded.role, status = 'active',
    invited_by = excluded.invited_by, joined_at = now(), removed_at = null, updated_at = now()
  returning id into v_member_id;
  delete from public.business_team_operation_permits
  where transaction_id = txid_current() and workspace_id = v_invitation.workspace_id and operation = 'member_write';
  insert into public.business_member_scopes(workspace_id, member_id, dimension_id, assigned_by)
  select v_invitation.workspace_id, v_member_id, scopes.dimension_id, v_invitation.invited_by
  from public.business_invitation_scopes as scopes where scopes.invitation_id = p_invitation_id
  on conflict do nothing;
  update public.workspace_invitations set status = 'accepted', invitee_user_id = auth.uid(),
    responded_at = now(), updated_at = now(), version = version + 1 where id = p_invitation_id;
  perform public.business_record_audit_event(v_invitation.workspace_id, 'team.invitation_accepted',
    'workspace_member', v_member_id, '{}'::jsonb, jsonb_build_object('role', v_invitation.role));
  return v_invitation.workspace_id;
end;
$$;

notify pgrst, 'reload schema';
commit;
