begin;

-- The product is launch-ready; each plan's availability remains the sales switch.
-- Existing Business plans remain closed until an administrator selects availability.
update public.product_release_controls set release_stage='stage_12',
  customer_purchase_enabled=true,customer_workspace_creation_enabled=true,updated_at=now()
where product_code='business';

create table public.business_public_purchases (
  request_id uuid primary key references public.subscription_renewal_requests(id) deferrable initially deferred,
  payment_id uuid not null unique references public.subscription_payments(id) deferrable initially deferred,
  owner_id uuid not null references auth.users(id),
  source_workspace_id uuid not null references public.budget_workspaces(id),
  plan_id uuid not null references public.plans(id),
  workspace_name text not null check(char_length(btrim(workspace_name)) between 2 and 120),
  settings_version integer not null, payment_instructions text not null,
  status text not null default 'pending_review' check(status in ('pending_review','approved','rejected')),
  provisioned_workspace_id uuid references public.budget_workspaces(id),
  created_at timestamptz not null default now(), reviewed_at timestamptz
);
create unique index business_public_purchase_pending_owner_idx on public.business_public_purchases(owner_id)
  where status='pending_review';
alter table public.business_public_purchases enable row level security;
alter table public.business_public_purchases force row level security;
revoke all on public.business_public_purchases from public,anon,authenticated;

create table public.business_public_provision_permits (
  transaction_id bigint not null,workspace_id uuid not null,owner_id uuid not null,actor_id uuid not null,
  primary key(transaction_id,workspace_id)
);
alter table public.business_public_provision_permits enable row level security;
alter table public.business_public_provision_permits force row level security;
revoke all on public.business_public_provision_permits from public,anon,authenticated;
create function public.business_public_provision_permit(p_workspace_id uuid,p_owner_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.business_public_provision_permits where transaction_id=txid_current()
    and workspace_id=p_workspace_id and owner_id=p_owner_id and actor_id=auth.uid());
$$;
revoke all on function public.business_public_provision_permit(uuid,uuid) from public,anon,authenticated;

-- Validate final transaction state, allowing prices and availability in one editor save.
create function public.business_public_price_ready(p_plan_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select b.pilot_enabled and b.included_seats between 1 and 100
   and exists(select 1 from public.supported_currencies c where c.code=b.currency and c.is_active)
   and char_length(btrim(b.payment_instructions))>0
   and ((b.monthly_base is not null and b.monthly_seat is not null) or (b.annual_base is not null and b.annual_seat is not null))
   and (b.monthly_base is null or (b.monthly_base>=0 and b.monthly_seat>=0 and b.monthly_base::text not in ('NaN','Infinity','-Infinity') and b.monthly_seat::text not in ('NaN','Infinity','-Infinity')))
   and (b.annual_base is null or (b.annual_base>=0 and b.annual_seat>=0 and b.annual_base::text not in ('NaN','Infinity','-Infinity') and b.annual_seat::text not in ('NaN','Infinity','-Infinity')))
   and ((b.monthly_base is null)=(b.monthly_seat is null)) and ((b.annual_base is null)=(b.annual_seat is null))
   from public.business_billing_settings b where b.plan_id=p_plan_id),false);
$$;
revoke all on function public.business_public_price_ready(uuid) from public,anon,authenticated;
create function public.validate_business_public_plan()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid:=(to_jsonb(new)->>(case when tg_table_name='plans' then 'id' else 'plan_id' end))::uuid;
begin
  if exists(select 1 from public.plans where id=v_id and workspace_type='business' and available_for_purchase)
    and (not exists(select 1 from public.plans where id=v_id and is_active) or not public.business_public_price_ready(v_id))
  then raise exception 'BUSINESS_PUBLIC_PRICING_REQUIRED'; end if;
  return new;
end;
$$;
revoke all on function public.validate_business_public_plan() from public,anon,authenticated;
create constraint trigger validate_business_public_plan_trigger after insert or update on public.plans
  deferrable initially deferred for each row execute function public.validate_business_public_plan();
create constraint trigger validate_business_public_billing_trigger after insert or update on public.business_billing_settings
  deferrable initially deferred for each row execute function public.validate_business_public_plan();

create or replace function public.enforce_business_plan_launch_control()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.workspace_type='business' and new.available_for_purchase then
    if not public.product_customer_purchase_enabled('business') then raise exception 'BUSINESS_COMING_SOON'; end if;
    if lower(btrim(new.cta_label))='coming soon' then new.cta_label:='Choose plan'; end if;
  end if;
  return new;
end;
$$;

-- Mirror the approved billing rates into the existing public catalogue. Annual
-- Business seat rates are per annual term, unlike Family's monthly seat rate.
create function public.sync_business_public_prices(p_plan_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.business_billing_settings%rowtype;v_period text;v_base numeric;v_seat numeric;v_now timestamptz:=clock_timestamp();
begin
  if not exists(select 1 from public.plans where id=p_plan_id and workspace_type='business') then return; end if;
  select * into b from public.business_billing_settings where plan_id=p_plan_id;
  foreach v_period in array array['monthly','annual'] loop
    v_base:=case when v_period='monthly' then b.monthly_base else b.annual_base end;
    v_seat:=case when v_period='monthly' then b.monthly_seat else b.annual_seat end;
    if not exists(select 1 from public.plans where id=p_plan_id and is_active and available_for_purchase)
      or not public.business_public_price_ready(p_plan_id) or v_base is null or v_seat is null then
      update public.plan_prices set is_active=false,effective_until=v_now,updated_at=v_now
        where plan_id=p_plan_id and billing_period=v_period and is_active;
    elsif not exists(select 1 from public.plan_prices where plan_id=p_plan_id and billing_period=v_period
      and currency=b.currency and amount=v_base and extra_member_amount=v_seat and is_active
      and effective_from<=v_now and (effective_until is null or effective_until>v_now)) then
      update public.plan_prices set is_active=false,effective_until=v_now,updated_at=v_now
        where plan_id=p_plan_id and billing_period=v_period and is_active;
      insert into public.plan_prices(plan_id,billing_period,currency,amount,extra_member_amount,effective_from)
        values(p_plan_id,v_period,b.currency,v_base,v_seat,v_now);
    end if;
  end loop;
end;
$$;
create function public.signal_business_public_catalogue()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.sync_business_public_prices((to_jsonb(new)->>(case when tg_table_name='plans' then 'id' else 'plan_id' end))::uuid);
  return new;
end;
$$;
revoke all on function public.sync_business_public_prices(uuid),public.signal_business_public_catalogue() from public,anon,authenticated;
create trigger sync_business_public_plan_prices after update of available_for_purchase,is_active on public.plans
  for each row execute function public.signal_business_public_catalogue();
create trigger sync_business_public_billing_prices after insert or update on public.business_billing_settings
  for each row execute function public.signal_business_public_catalogue();

create function public.public_business_checkout_terms()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or public.my_account_suspended() then raise exception 'ACTIVE_ACCOUNT_REQUIRED'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('plan_id',p.id,'settings_version',b.version,
    'currency',b.currency,'included_seats',b.included_seats,'payment_instructions',b.payment_instructions))
    from public.plans p join public.business_billing_settings b on b.plan_id=p.id
    where p.workspace_type='business' and p.is_active and p.available_for_purchase and public.business_public_price_ready(p.id)),'[]'::jsonb);
end;
$$;
revoke all on function public.public_business_checkout_terms() from public,anon;
grant execute on function public.public_business_checkout_terms() to authenticated;

create or replace function public.enforce_business_subscription_request_launch_control()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.business_public_purchases x
    where x.request_id=new.id and x.source_workspace_id=new.workspace_id
      and x.owner_id=new.requested_by and x.plan_id=new.requested_plan_id
      and x.status='pending_review' and new.provision_workspace_on_approval) then return new; end if;
  if exists(select 1 from public.plans where id=new.requested_plan_id and workspace_type='business') and not exists(
    select 1 from public.business_subscription_quotes q join public.business_billing_settings c on c.plan_id=q.plan_id
    where q.id=new.business_quote_id and q.workspace_id=new.workspace_id and q.plan_id=new.requested_plan_id
      and q.owner_id=new.requested_by and q.status='quoted' and q.expires_at>now() and c.pilot_enabled
      and c.version=q.settings_version and not coalesce(new.provision_workspace_on_approval,false))
  then raise exception 'BUSINESS_COMING_SOON'; end if;
  return new;
end;
$$;

create or replace function public.enforce_business_workspace_launch_control()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.workspace_type = 'business'
     and (tg_op='INSERT' or old.workspace_type is distinct from new.workspace_type)
     and not public.business_public_provision_permit(new.id,new.owner_id)
     and not (
       tg_op = 'INSERT'
       and public.business_admin_test_permit(new.id, new.owner_id)
     )
  then
    raise exception 'BUSINESS_SUBSCRIPTION_APPROVAL_REQUIRED';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_business_member_provision_launch_control()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner_id uuid;
begin
  select owner_id into v_owner_id
  from public.budget_workspaces
  where id = new.workspace_id and workspace_type = 'business';
  if v_owner_id is not null
     and not public.product_customer_workspace_creation_enabled('business')
     and not (tg_op='INSERT' and new.user_id=v_owner_id and new.role='business_owner' and public.business_public_provision_permit(new.workspace_id,v_owner_id))
     and not public.business_team_permit(new.workspace_id, 'member_write')
     and not (
       tg_op = 'INSERT'
       and new.user_id = v_owner_id
       and new.role = 'business_owner'
       and public.business_admin_test_permit(new.workspace_id, v_owner_id)
     )
  then
    raise exception 'BUSINESS_COMING_SOON';
  end if;
  return new;
end;
$$;

create or replace function public.guard_business_owner_membership()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_workspace uuid;
begin
  if tg_op='INSERT' then
    if new.role='business_owner' and exists(select 1 from public.budget_workspaces where id=new.workspace_id and workspace_type='business')
      and not public.business_support_permitted(new.workspace_id,'ownership')
      and not public.business_admin_test_permit(new.workspace_id,new.user_id)
      and not public.business_public_provision_permit(new.workspace_id,new.user_id) then raise exception 'BUSINESS_OWNERSHIP_PROCEDURE_REQUIRED'; end if;
    return new;
  end if;
  v_workspace:=old.workspace_id;
  if exists(select 1 from public.budget_workspaces where id=v_workspace and workspace_type='business')
    and (old.role='business_owner' or (tg_op='UPDATE' and new.role='business_owner'))
    and not public.business_support_permitted(v_workspace,'ownership')
    and (tg_op='DELETE' or (new.role,new.status,new.user_id,new.workspace_id) is distinct from (old.role,old.status,old.user_id,old.workspace_id))
    then raise exception 'BUSINESS_OWNERSHIP_PROCEDURE_REQUIRED'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

-- Business onboarding uses an approved public purchase or the existing registered
-- account manual grant. Legacy Personal/Family invite setup cannot bypass it.
create or replace function public.enforce_business_admin_invitation_launch_control()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.status in ('pending_delivery','sent') and exists(select 1 from public.plans where id=new.plan_id and workspace_type='business')
  then raise exception 'BUSINESS_MANUAL_GRANT_REQUIRED'; end if;
  return new;
end;
$$;
revoke all on function public.enforce_business_admin_invitation_launch_control() from public,anon,authenticated;

create function public.submit_business_plan_request(p_personal_workspace_id uuid,p_business_name text,p_total_member_count integer,
  p_plan_code text,p_billing_period text,p_currency text,p_amount numeric,p_expected_settings_version integer,
  p_payment_method text,p_payment_date date,p_reference_number text,p_notes text default null,
  p_proof_path text default null,p_proof_name text default null,p_proof_mime_type text default null,p_proof_size_bytes bigint default null,p_submission_id uuid default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.budget_workspaces%rowtype;p public.plans%rowtype;b public.business_billing_settings%rowtype;
  v_base numeric;v_rate numeric;v_amount numeric;v_invoice uuid;v_request uuid:=gen_random_uuid();v_payment uuid:=coalesce(p_submission_id,gen_random_uuid());v_mime text;v_size bigint;
begin
  if auth.uid() is null or public.my_account_suspended() then raise exception 'ACTIVE_ACCOUNT_REQUIRED'; end if;
  select * into w from public.budget_workspaces where id=p_personal_workspace_id for update;
  if w.id is null or w.owner_id<>auth.uid() or w.workspace_type<>'personal' or w.status<>'active' then raise exception 'PERSONAL_WORKSPACE_OWNER_REQUIRED'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and account_status='active') then raise exception 'ACTIVE_ACCOUNT_REQUIRED'; end if;
  if exists(select 1 from public.business_public_purchases where payment_id=v_payment and owner_id=auth.uid() and source_workspace_id=w.id) then return v_payment; end if;
  if exists(select 1 from public.subscription_payments where id=v_payment) then raise exception 'INVALID_SUBMISSION_ID'; end if;
  if char_length(btrim(coalesce(p_business_name,''))) not between 2 and 120 then raise exception 'BUSINESS_NAME_REQUIRED'; end if;
  if exists(select 1 from public.business_public_purchases where owner_id=auth.uid() and status='pending_review') then raise exception 'BUSINESS_PLAN_REQUEST_ALREADY_PENDING'; end if;
  if (select count(*) from public.budget_workspaces where owner_id=auth.uid() and workspace_type='business')>=100 then raise exception 'BUSINESS_ACCOUNT_CAP_REACHED'; end if;
  select * into p from public.plans where code=lower(btrim(p_plan_code)) for share;
  if p.id is null or p.workspace_type<>'business' or not p.is_active or not p.available_for_purchase
    or not public.product_customer_purchase_enabled('business') then raise exception 'BUSINESS_COMING_SOON'; end if;
  select * into b from public.business_billing_settings where plan_id=p.id for share;
  if not public.business_public_price_ready(p.id) then raise exception 'BUSINESS_PUBLIC_PRICING_REQUIRED'; end if;
  if p_expected_settings_version is distinct from b.version then raise exception 'BUSINESS_BILLING_SETTINGS_CHANGED'; end if;
  if p_billing_period is null or p_billing_period not in ('monthly','annual') or upper(p_currency) is distinct from b.currency then raise exception 'BUSINESS_BILLING_PRICE_UNSET'; end if;
  v_base:=case when p_billing_period='monthly' then b.monthly_base else b.annual_base end;
  v_rate:=case when p_billing_period='monthly' then b.monthly_seat else b.annual_seat end;
  if v_base is null or v_rate is null then raise exception 'BUSINESS_BILLING_PRICE_UNSET'; end if;
  if p_total_member_count is null or p_total_member_count<b.included_seats or p_total_member_count>100 then raise exception 'INVALID_BUSINESS_MEMBER_COUNT'; end if;
  v_amount:=round(v_base+greatest(p_total_member_count-b.included_seats,0)*v_rate,2);
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or round(p_amount,2)<>v_amount then raise exception 'PAYMENT_AMOUNT_DOES_NOT_MATCH_INVOICE'; end if;
  if nullif(btrim(p_payment_method),'') is null or nullif(btrim(p_reference_number),'') is null or p_payment_date is null
    or p_payment_date>current_date then raise exception 'BUSINESS_PAYMENT_DETAILS_REQUIRED'; end if;
  if p_proof_path is not null then
    if split_part(p_proof_path,'/',1)<>'workspaces' or split_part(p_proof_path,'/',2)<>w.id::text
      or split_part(p_proof_path,'/',3)<>auth.uid()::text or p_proof_path like '%..%'
      or p_proof_mime_type is null or p_proof_mime_type not in ('image/jpeg','image/png','image/webp','application/pdf')
      or p_proof_size_bytes is null or p_proof_size_bytes not between 1 and 10485760 then raise exception 'INVALID_SUBSCRIPTION_PROOF_PATH'; end if;
    select metadata->>'mimetype',coalesce((metadata->>'size')::bigint,(metadata->>'contentLength')::bigint) into v_mime,v_size
      from storage.objects where bucket_id='subscription-proofs' and name=p_proof_path;
    if not found or v_mime is distinct from p_proof_mime_type or v_size is distinct from p_proof_size_bytes then raise exception 'SUBSCRIPTION_PROOF_NOT_FOUND'; end if;
  end if;
  insert into public.subscription_invoices(workspace_id,invoice_number,plan_code,plan_name,billing_period,currency,
    base_amount,extra_member_amount,billable_member_count,included_member_count,extra_member_count,total_amount,created_by)
  values(w.id,'MB-B-'||upper(replace(v_payment::text,'-','')),p.code,p.display_name,p_billing_period,b.currency,
    v_base,v_rate,p_total_member_count,b.included_seats,p_total_member_count-b.included_seats,v_amount,auth.uid()) returning id into v_invoice;
  insert into public.business_public_purchases(request_id,payment_id,owner_id,source_workspace_id,plan_id,workspace_name,settings_version,payment_instructions)
    values(v_request,v_payment,auth.uid(),w.id,p.id,btrim(p_business_name),b.version,b.payment_instructions);
  insert into public.subscription_renewal_requests(id,workspace_id,invoice_id,requested_plan_id,requested_by,requested_workspace_name,provision_workspace_on_approval)
    values(v_request,w.id,v_invoice,p.id,auth.uid(),btrim(p_business_name),true);
  insert into public.subscription_payments(id,renewal_request_id,workspace_id,submitted_by,amount,currency,payment_method,payment_date,reference_number,notes)
    values(v_payment,v_request,w.id,auth.uid(),v_amount,b.currency,left(btrim(p_payment_method),100),p_payment_date,left(btrim(p_reference_number),255),left(nullif(btrim(p_notes),''),2000));
  if p_proof_path is not null then insert into public.subscription_payment_proofs(payment_id,storage_path,original_name,mime_type,size_bytes,uploaded_by)
    values(v_payment,p_proof_path,left(coalesce(nullif(p_proof_name,''),'Payment proof'),255),p_proof_mime_type,p_proof_size_bytes,auth.uid()); end if;
  insert into public.subscription_audit_events(workspace_id,actor_id,action,target_type,target_id,safe_details)
    values(w.id,auth.uid(),'business.public_purchase_submitted','renewal_request',v_request,jsonb_build_object('plan_id',p.id,'settings_version',b.version,'total_seats',p_total_member_count));
  return v_payment;
end;
$$;
revoke all on function public.submit_business_plan_request(uuid,text,integer,text,text,text,numeric,integer,text,date,text,text,text,text,text,bigint,uuid) from public,anon;
grant execute on function public.submit_business_plan_request(uuid,text,integer,text,text,text,numeric,integer,text,date,text,text,text,text,text,bigint,uuid) to authenticated;

-- Delegate existing Personal/Family and private Business billing unchanged.
alter function public.review_subscription_payment(uuid,text,text) rename to review_subscription_payment_before_business_public;
revoke all on function public.review_subscription_payment_before_business_public(uuid,text,text) from public,anon,authenticated;
alter table public.business_subscription_quotes drop constraint business_subscription_quotes_kind_check;
alter table public.business_subscription_quotes add constraint business_subscription_quotes_kind_check check(kind in ('renewal','extra_seats','purchase'));
create function public.review_subscription_payment(p_payment_id uuid,p_decision text,p_reason text default null)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare x public.business_public_purchases%rowtype;p public.subscription_payments%rowtype;r public.subscription_renewal_requests%rowtype;
 i public.subscription_invoices%rowtype;s public.workspace_subscriptions%rowtype;w public.budget_workspaces%rowtype;
 v_workspace uuid:=gen_random_uuid();v_quote uuid:=gen_random_uuid();v_start timestamptz;v_end timestamptz;
begin
  if public.my_account_suspended() or not public.is_platform_staff(array['super_admin','admin_staff','finance_staff']) then raise exception 'FINANCE_REVIEW_ACCESS_REQUIRED'; end if;
  if p_decision is null or p_decision not in ('approved','rejected') then raise exception 'INVALID_REVIEW_DECISION'; end if;
  select * into x from public.business_public_purchases where payment_id=p_payment_id;
  if not found then return public.review_subscription_payment_before_business_public(p_payment_id,p_decision,p_reason); end if;
  select * into w from public.budget_workspaces where id=x.source_workspace_id for update;
  select * into x from public.business_public_purchases where payment_id=p_payment_id for update;
  select * into p from public.subscription_payments where id=p_payment_id for update;
  if p.status<>'pending_review' then return 'already_reviewed'; end if;
  select * into r from public.subscription_renewal_requests where id=x.request_id for update;
  select * into i from public.subscription_invoices where id=r.invoice_id for update;
  if x.status<>'pending_review' or x.owner_id<>w.owner_id or w.workspace_type<>'personal' or x.owner_id<>p.submitted_by
    or p.renewal_request_id<>x.request_id or p.workspace_id<>x.source_workspace_id or r.workspace_id<>x.source_workspace_id
    or r.requested_plan_id<>x.plan_id or not r.provision_workspace_on_approval or i.workspace_id<>x.source_workspace_id
    or i.total_amount<>p.amount or i.currency<>p.currency or i.billable_member_count not between 1 and 100
  then raise exception 'INVALID_BUSINESS_SUBSCRIPTION_PAYMENT'; end if;
  if p_decision='rejected' then
    if nullif(btrim(p_reason),'') is null then raise exception 'REJECTION_REASON_REQUIRED'; end if;
    update public.business_public_purchases set status='rejected',reviewed_at=now() where request_id=x.request_id;
    update public.subscription_payments set status='rejected',updated_at=now() where id=p.id;
    update public.subscription_renewal_requests set status='rejected',rejection_reason=left(btrim(p_reason),2000),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=r.id;
    update public.subscription_invoices set status='rejected' where id=i.id;
  else
    if auth.uid()=x.owner_id then raise exception 'BUSINESS_BILLING_SELF_REVIEW_FORBIDDEN'; end if;
    if w.status<>'active' or not exists(select 1 from public.profiles where id=x.owner_id and account_status='active') then raise exception 'BUSINESS_BILLING_SUSPENDED'; end if;
    if (select count(*) from public.budget_workspaces where owner_id=x.owner_id and workspace_type='business')>=100 then raise exception 'BUSINESS_ACCOUNT_CAP_REACHED'; end if;
    -- A previously submitted invoice remains reviewable when new sales close.
    insert into public.business_public_provision_permits values(txid_current(),v_workspace,x.owner_id,auth.uid());
    insert into public.budget_workspaces(id,owner_id,workspace_type,name) values(v_workspace,x.owner_id,'business',x.workspace_name);
    insert into public.workspace_members(workspace_id,user_id,role,status) values(v_workspace,x.owner_id,'business_owner','active');
    insert into public.workspace_settings(workspace_id,base_currency,locale,timezone,default_payment_currency,enabled_currencies,reporting_currency,conversion_enabled)
    select v_workspace,i.currency,coalesce(locale,'en'),coalesce(timezone,'Africa/Harare'),i.currency,array[i.currency],i.currency,true
      from public.workspace_settings where workspace_id=x.source_workspace_id;
    if not found then raise exception 'PERSONAL_WORKSPACE_SETTINGS_REQUIRED'; end if;
    v_start:=clock_timestamp();v_end:=((v_start at time zone 'UTC')+case when i.billing_period='annual' then interval '1 year' else interval '1 month' end) at time zone 'UTC';
    insert into public.workspace_subscriptions(workspace_id,plan_id,status,billing_period,entitlement_start_at,billing_anchor_at,paid_through_at,member_limit)
      values(v_workspace,x.plan_id,'active',i.billing_period,v_start,v_start,v_end,i.billable_member_count) returning * into s;
    insert into public.business_subscription_quotes(id,workspace_id,owner_id,plan_id,kind,billing_period,currency,total_seats,additional_seats,included_seats,
      base_amount,seat_price,amount,fraction,term_start_at,term_end_at,original_expiry_at,original_limit,subscription_version,settings_version,status,payment_id)
      values(v_quote,v_workspace,x.owner_id,x.plan_id,'purchase',i.billing_period,i.currency,i.billable_member_count,i.extra_member_count,i.included_member_count,
      i.base_amount,i.extra_member_amount,i.total_amount,1,v_start,v_end,null,i.billable_member_count,s.version,x.settings_version,'approved',p.id);
    update public.subscription_invoices set workspace_id=v_workspace,status='paid',paid_at=now() where id=i.id;
    update public.subscription_renewal_requests set workspace_id=v_workspace,business_quote_id=v_quote,provisioned_workspace_id=v_workspace,
      status='approved',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=r.id;
    update public.subscription_payments set workspace_id=v_workspace,status='approved',receipt_number='MBR-B-'||upper(replace(p.id::text,'-','')),updated_at=now() where id=p.id;
    update public.business_public_purchases set status='approved',provisioned_workspace_id=v_workspace,reviewed_at=now() where request_id=x.request_id;
    insert into public.subscription_entitlement_history(workspace_id,subscription_id,plan_id,status,effective_from,effective_until,reason,actor_id)
      values(v_workspace,s.id,x.plan_id,'active',v_start,v_end,'Approved Business purchase on '||i.invoice_number,auth.uid());
    delete from public.business_public_provision_permits where transaction_id=txid_current() and workspace_id=v_workspace;
  end if;
  insert into public.subscription_payment_reviews(payment_id,reviewer_id,decision,reason) values(p.id,auth.uid(),p_decision,nullif(btrim(p_reason),''));
  insert into public.subscription_audit_events(workspace_id,actor_id,action,target_type,target_id,safe_details)
    values(case when p_decision='approved' then v_workspace else x.source_workspace_id end,auth.uid(),'business.public_purchase_'||p_decision,'subscription_payment',p.id,jsonb_build_object('request_id',x.request_id,'total_seats',i.billable_member_count));
  insert into public.notifications(user_id,created_by,type,title,body,url) values(x.owner_id,auth.uid(),'subscription',
    case when p_decision='approved' then 'Business plan approved' else 'Business payment rejected' end,
    case when p_decision='approved' then x.workspace_name||' is ready. Open your Business workspace to complete setup.' else 'Open Subscription to view the review reason.' end,
    case when p_decision='approved' then '/business.html?workspace='||v_workspace||'#business/dashboard' else '#personal/subscription' end);
  return p_decision;
end;
$$;
revoke all on function public.review_subscription_payment(uuid,text,text) from public,anon;
grant execute on function public.review_subscription_payment(uuid,text,text) to authenticated;

comment on column public.plan_prices.extra_member_amount is 'Family: monthly price per extra person (multiply by 12 annually). Business: extra-seat price for the selected billing term.';
comment on column public.subscription_invoices.extra_member_amount is 'Captured extra-person rate: Family monthly; Business per selected billing term.';

-- Initialise prices without opening any plan automatically.
do $$ declare v_plan uuid; begin
 for v_plan in select id from public.plans where workspace_type='business' loop perform public.sync_business_public_prices(v_plan); end loop;
end; $$;
notify pgrst, 'reload schema';
commit;
