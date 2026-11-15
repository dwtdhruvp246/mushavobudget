-- Staging only. Route synthetic invoices through the real submission and review procedures.
begin;
set local search_path = pg_catalog;
set local lock_timeout = '3s';
set local statement_timeout = '35s';
select pg_advisory_xact_lock(20261017, 2411);

do $preflight$
begin
  if not exists (
    select 1 from mushavo_email_install.rollout_control where singleton
      and target_project='dczlddwbtgvfdujgcitb' and mode='ACTIVE' and catalog_sha256='116c02342531453cc20286196121730dbb8ce9e64c70396f28192ad5c90f447d'
      and catalog_sha256=mushavo_email_install.catalog_identity()
  ) or not exists (
    select 1 from public.budget_workspaces where id='017513c6-ce57-48af-b902-9552faeb83dd' and owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'
      and workspace_type='personal' and status='active'
  ) or not exists (
    select 1 from public.budget_workspaces w join public.workspace_subscriptions s on s.workspace_id=w.id
    where w.id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and w.owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and w.name='audit-fr3-logo-ingestion-20261112'
      and w.status='suspended' and w.business_support_version=52 and s.version=1
      and s.plan_id='0ccf35bb-43c7-4c1b-9148-0f352b85bd2a' and s.paid_through_at='2026-11-14 00:00:00+00'
  ) or exists (
    select 1 from public.subscription_renewal_requests where workspace_id in ('017513c6-ce57-48af-b902-9552faeb83dd','8d9307e6-aada-4c9a-a8f5-43c57e0865e2') and status='pending_review'
  ) or exists (select 1 from public.families where owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' or id='4851a173-3f8d-4d30-b841-cb57d3613c54')
  then raise exception 'FR32_EXACT_STAGING_FIXTURES_REQUIRED'; end if;
end;
$preflight$;

create table public.fr32_subscription_flow_scope (
  lane text primary key,
  workspace_id uuid not null references public.budget_workspaces(id),
  plan_id uuid not null references public.plans(id),
  expires_at timestamptz not null
);
create table public.fr32_subscription_flow_files (
  lane text primary key references public.fr32_subscription_flow_scope(lane),
  path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf','image/png')),
  size_bytes bigint not null check (size_bytes between 1 and 2097152),
  state text not null check (state in ('reserved','ready','linked'))
);
alter table public.fr32_subscription_flow_scope enable row level security;
alter table public.fr32_subscription_flow_scope force row level security;
alter table public.fr32_subscription_flow_files enable row level security;
alter table public.fr32_subscription_flow_files force row level security;
revoke all on public.fr32_subscription_flow_scope, public.fr32_subscription_flow_files from public,anon,authenticated,service_role;

insert into public.plans(id,code,display_name,workspace_type,is_public,available_for_purchase) values
 ('166ec33c-162d-4f47-8c2b-d5d462491707','audit_fr32_personal','Synthetic FR.3.2 Personal','personal',false,false),
 ('d840e33d-01f3-44cb-bbac-59be071c3139','audit_fr32_household','Synthetic FR.3.2 Family','household',false,true),
 ('0b8eacc8-eae9-4b83-89f8-d8684fe05c9a','audit_fr32_business','Synthetic FR.3.2 Business','business',false,false);
insert into public.plan_prices(plan_id,billing_period,currency,amount,extra_member_amount,effective_until) values
 ('166ec33c-162d-4f47-8c2b-d5d462491707','monthly','USD',1,0,now()+interval '2 hours'),
 ('d840e33d-01f3-44cb-bbac-59be071c3139','monthly','USD',1,2,now()+interval '2 hours');
update public.business_billing_settings set pilot_enabled=true,included_seats=1,monthly_base=1,monthly_seat=1,
  payment_instructions='Synthetic FR.3.2 test only. No transfer.'
where plan_id='0b8eacc8-eae9-4b83-89f8-d8684fe05c9a' and not pilot_enabled;
update public.workspace_subscriptions set plan_id='0b8eacc8-eae9-4b83-89f8-d8684fe05c9a'
where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and plan_id='0ccf35bb-43c7-4c1b-9148-0f352b85bd2a' and version=1;

insert into public.families(id,owner_id,owner_email,name,monthly_budget,currency)
  select '4851a173-3f8d-4d30-b841-cb57d3613c54',id,lower(email),'audit-fr32-subscription-flow-20261115',0,'USD'
  from auth.users where id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184';
insert into public.family_members(family_id,user_id,created_by,name,role,email,status)
  select '4851a173-3f8d-4d30-b841-cb57d3613c54',id,id,'Synthetic billing owner','Owner',lower(email),'active'
  from auth.users where id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184';
update public.workspace_subscriptions s set plan_id='d840e33d-01f3-44cb-bbac-59be071c3139', billing_period='monthly',
  entitlement_start_at=now()-interval '1 minute',billing_anchor_at=now()-interval '1 minute',
  paid_through_at=now()+interval '1 month'-interval '1 minute',member_limit=4
from public.budget_workspaces w where w.id=s.workspace_id and w.owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and w.legacy_family_id='4851a173-3f8d-4d30-b841-cb57d3613c54';

insert into public.fr32_subscription_flow_scope(lane,workspace_id,plan_id,expires_at)
select v.lane,v.workspace,v.plan,now()+interval '2 hours'
from (
  select 'personal', '017513c6-ce57-48af-b902-9552faeb83dd'::uuid, '166ec33c-162d-4f47-8c2b-d5d462491707'::uuid
  union all select 'family-plan', '017513c6-ce57-48af-b902-9552faeb83dd', 'd840e33d-01f3-44cb-bbac-59be071c3139'
  union all select 'family-renewal', w.id, 'd840e33d-01f3-44cb-bbac-59be071c3139' from public.budget_workspaces w where w.legacy_family_id='4851a173-3f8d-4d30-b841-cb57d3613c54' and w.owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'
  union all select 'family-extra', w.id, 'd840e33d-01f3-44cb-bbac-59be071c3139' from public.budget_workspaces w where w.legacy_family_id='4851a173-3f8d-4d30-b841-cb57d3613c54' and w.owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'
  union all select 'business', '8d9307e6-aada-4c9a-a8f5-43c57e0865e2', '0b8eacc8-eae9-4b83-89f8-d8684fe05c9a'
) v(lane,workspace,plan);

create policy fr32_subscription_flow_insert on storage.objects as restrictive for insert to anon,authenticated
with check (bucket_id<>'subscription-proofs' or split_part(name,'/',4) not like 'fr32-billing-%');
create policy fr32_subscription_flow_update on storage.objects as restrictive for update to anon,authenticated
using (bucket_id<>'subscription-proofs' or split_part(name,'/',4) not like 'fr32-billing-%')
with check (bucket_id<>'subscription-proofs' or split_part(name,'/',4) not like 'fr32-billing-%');

create function public.fr32_subscription_scope_allowed(p_lane text,p_workspace uuid,p_plan uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $fn$
  select auth.uid()='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'::uuid and exists (
    select 1 from public.fr32_subscription_flow_scope s join public.plans p on p.id=s.plan_id
    where s.lane=p_lane and s.workspace_id=p_workspace and s.plan_id=p_plan and s.expires_at>now()
      and p.is_active and not p.is_public
  )
$fn$;
revoke all on function public.fr32_subscription_scope_allowed(text,uuid,uuid) from public,anon,authenticated,service_role;

create function public.fr32_subscription_flow_ready(p_lane text)
returns uuid language sql stable security definer set search_path=pg_catalog as $fn$
  select s.workspace_id from public.fr32_subscription_flow_scope s
    join public.budget_workspaces w on w.id=s.workspace_id join public.plans p on p.id=s.plan_id
    where s.lane=p_lane and s.expires_at>now() and w.owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and w.status='active'
      and p.is_active and not p.is_public
      and (select relrowsecurity from pg_class where oid='storage.objects'::regclass)
      and (select count(*)=2 from pg_policy where polrelid='storage.objects'::regclass and not polpermissive
        and polname in ('fr32_subscription_flow_insert','fr32_subscription_flow_update'))
      and exists (select 1 from pg_trigger where tgrelid='public.subscription_payment_proofs'::regclass
        and tgname='z_fr32_subscription_flow_proof' and tgenabled='O')
$fn$;
revoke all on function public.fr32_subscription_flow_ready(text) from public,anon,authenticated;
grant execute on function public.fr32_subscription_flow_ready(text) to service_role;

create function public.fr32_subscription_flow_file(p_path text,p_type text,p_size bigint,p_verify boolean)
returns boolean language plpgsql security definer set search_path=pg_catalog as $fn$
declare
  v_lane text := substring(split_part(p_path,'/',4) from 14);
  v_workspace uuid;
  v_metadata jsonb;
begin
  v_workspace := public.fr32_subscription_flow_ready(v_lane);
  if v_workspace is null or p_size is null or p_size not between 1 and 2097152
    or p_type is null or p_type not in ('application/pdf','image/png')
    or p_path !~ ('^workspaces/'||v_workspace||'/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr32-billing-'||v_lane
      ||'/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.]'||case when p_type='application/pdf' then 'pdf' else 'png' end||'$')
  then return false; end if;

  if not p_verify then
    insert into public.fr32_subscription_flow_files(lane,path,mime_type,size_bytes,state)
      values(v_lane,p_path,p_type,p_size,'reserved') on conflict(lane) do nothing;
  else
    select metadata into v_metadata from storage.objects where bucket_id='subscription-proofs' and name=p_path for share;
    if not found or v_metadata->>'mimetype' is distinct from p_type
      or coalesce(v_metadata->>'size',v_metadata->>'contentLength') is distinct from p_size::text
    then return false; end if;
    update public.fr32_subscription_flow_files set state='ready'
      where lane=v_lane and path=p_path and mime_type=p_type and size_bytes=p_size and state='reserved';
  end if;
  return exists (select 1 from public.fr32_subscription_flow_files
    where lane=v_lane and path=p_path and mime_type=p_type and size_bytes=p_size
      and (not p_verify or state in ('ready','linked')));
end;
$fn$;
revoke all on function public.fr32_subscription_flow_file(text,text,bigint,boolean) from public,anon,authenticated;
grant execute on function public.fr32_subscription_flow_file(text,text,bigint,boolean) to service_role;

create function public.fr32_subscription_flow_guard()
returns trigger language plpgsql security definer set search_path=pg_catalog as $fn$
declare
  v_scope public.fr32_subscription_flow_scope%rowtype;
  v_file public.fr32_subscription_flow_files%rowtype;
  v_payment public.subscription_payments%rowtype;
  v_request public.subscription_renewal_requests%rowtype;
  v_metadata jsonb;
begin
  if tg_op='UPDATE' and split_part(old.storage_path,'/',4) like 'fr32-billing-%' then
    if (new.payment_id,new.storage_path,new.mime_type,new.size_bytes,new.uploaded_by) is distinct from
      (old.payment_id,old.storage_path,old.mime_type,old.size_bytes,old.uploaded_by)
    then raise exception 'FR32_SUBSCRIPTION_PROOF_IMMUTABLE'; end if;
    return new;
  end if;
  if split_part(new.storage_path,'/',4) not like 'fr32-billing-%' then return new; end if;

  select * into v_file from public.fr32_subscription_flow_files where path=new.storage_path for update;
  select * into v_scope from public.fr32_subscription_flow_scope where lane=v_file.lane;
  select * into v_payment from public.subscription_payments where id=new.payment_id;
  select * into v_request from public.subscription_renewal_requests where id=v_payment.renewal_request_id;
  if v_file.state is distinct from 'ready'
    or v_file.mime_type is distinct from new.mime_type or v_file.size_bytes is distinct from new.size_bytes
    or v_payment.workspace_id is distinct from v_scope.workspace_id
    or v_payment.submitted_by is distinct from new.uploaded_by or new.uploaded_by is distinct from 'ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'::uuid
    or v_request.requested_plan_id is distinct from v_scope.plan_id
    or v_payment.reference_number is distinct from ('FR32-SYNTHETIC-20261115-'||v_scope.lane)
    or public.fr32_subscription_scope_allowed(v_scope.lane,v_scope.workspace_id,v_scope.plan_id) is not true
  then raise exception 'FR32_SUBSCRIPTION_PROOF_SCOPE_REQUIRED'; end if;

  select metadata into v_metadata from storage.objects where bucket_id='subscription-proofs' and name=new.storage_path for share;
  if not found or v_metadata->>'mimetype' is distinct from new.mime_type
    or coalesce(v_metadata->>'size',v_metadata->>'contentLength') is distinct from new.size_bytes::text
  then raise exception 'FR32_SUBSCRIPTION_STORAGE_METADATA_MISMATCH'; end if;

  update public.fr32_subscription_flow_files set state='linked' where lane=v_file.lane and state='ready';
  return new;
end;
$fn$;
revoke all on function public.fr32_subscription_flow_guard() from public,anon,authenticated,service_role;
create trigger z_fr32_subscription_flow_proof before insert or update on public.subscription_payment_proofs
for each row execute function public.fr32_subscription_flow_guard();

-- Scope the private catalog and suppress only the isolated synthetic notification.
do $extend$
declare
  v_proc regprocedure;
  v_source text;
  v_old text;
  v_new text;
begin
  for v_proc in
    select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace
      and proname in ('submit_subscription_renewal','submit_family_plan_request','family_extra_place_quote','notify_admins_on_subscription_payment')
  loop
    v_source := pg_get_functiondef(v_proc);
    case (select proname from pg_proc where oid=v_proc)
      when 'submit_subscription_renewal' then
        v_old := 'if v_plan.id is null then raise exception ''PLAN_NOT_AVAILABLE''; end if;';
        v_new := v_old || '
  if v_plan.code in (''audit_fr32_personal'',''audit_fr32_household'') and (
    public.fr32_subscription_scope_allowed(case when v_plan.code=''audit_fr32_personal'' then ''personal'' else ''family-renewal'' end,p_workspace_id,v_plan.id) is not true
    or p_reference_number is distinct from (''FR32-SYNTHETIC-20261115-''||case when v_plan.code=''audit_fr32_personal'' then ''personal'' else ''family-renewal'' end)
    or split_part(coalesce(p_proof_path,''''),''/'',4) is distinct from (''fr32-billing-''||case when v_plan.code=''audit_fr32_personal'' then ''personal'' else ''family-renewal'' end)
  ) then raise exception ''PLAN_NOT_AVAILABLE''; end if;';
      when 'submit_family_plan_request' then
        v_old := 'if v_plan.id is null then raise exception ''PLAN_NOT_AVAILABLE''; end if;';
        v_new := v_old || '
  if v_plan.code=''audit_fr32_household'' and (
    public.fr32_subscription_scope_allowed(''family-plan'',p_personal_workspace_id,v_plan.id) is not true
    or p_reference_number is distinct from ''FR32-SYNTHETIC-20261115-family-plan''
    or split_part(coalesce(p_proof_path,''''),''/'',4) <> ''fr32-billing-family-plan''
  ) then raise exception ''PLAN_NOT_AVAILABLE''; end if;';
      when 'family_extra_place_quote' then
        v_old := 'id = v_subscription.plan_id and code = ''household''';
        v_new := 'id = v_subscription.plan_id and (code = ''household'' or
      (code=''audit_fr32_household'' and public.fr32_subscription_scope_allowed(''family-extra'',p_workspace_id,id) is true))';
      when 'notify_admins_on_subscription_payment' then
        v_old := 'if new.status = ''pending_review'' then';
        v_new := 'if new.status = ''pending_review'' and not (
    new.submitted_by=''ca7bdcf2-e69d-42e2-8ae8-79cac6de2184''::uuid and exists (
      select 1 from public.fr32_subscription_flow_scope s
      join public.subscription_renewal_requests r on r.id=new.renewal_request_id and r.requested_plan_id=s.plan_id
      where s.workspace_id=new.workspace_id and new.reference_number=''FR32-SYNTHETIC-20261115-''||s.lane
    )
  ) then';
    end case;
    if (length(v_source)-length(replace(v_source,v_old,'')))/length(v_old)<>1 then raise exception 'EXPECTED_BILLING_ROUTINE_SOURCE_REQUIRED'; end if;
    execute replace(v_source,v_old,v_new);
  end loop;
  if (select count(*) from public.fr32_subscription_flow_scope)<>5 or not exists (
    select 1 from public.business_billing_settings where plan_id='0b8eacc8-eae9-4b83-89f8-d8684fe05c9a' and pilot_enabled and included_seats=1
  ) then raise exception 'FR32_BILLING_FIXTURES_INCOMPLETE'; end if;
end;
$extend$;

update mushavo_email_install.rollout_control set catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
  where singleton and target_project='dczlddwbtgvfdujgcitb' and mode='ACTIVE' and catalog_sha256='116c02342531453cc20286196121730dbb8ce9e64c70396f28192ad5c90f447d';
notify pgrst,'reload schema';
commit;
