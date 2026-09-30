begin;

alter table public.budget_workspaces add column business_support_version integer not null default 1 check (business_support_version > 0);

-- Separate access/support history; no operating finance records are exposed here.
create table public.business_support_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.budget_workspaces(id) on delete restrict,
  request_id uuid not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('suspend','restore','transfer','recover')),
  reason text not null check (char_length(btrim(reason)) between 8 and 1000),
  before_summary jsonb not null,
  after_summary jsonb not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, request_id)
);
create index business_support_actions_workspace_idx on public.business_support_actions(workspace_id,created_at desc,id);
alter table public.business_support_actions enable row level security;
alter table public.business_support_actions force row level security;
revoke all on public.business_support_actions from public,anon,authenticated;
create trigger business_support_actions_immutable before update or delete on public.business_support_actions
for each row execute function public.prevent_business_audit_mutation();

create table public.business_support_permits (
  transaction_id bigint not null,
  workspace_id uuid not null references public.budget_workspaces(id) on delete cascade,
  actor_id uuid not null,
  operation text not null check (operation in ('status','ownership')),
  primary key(transaction_id,workspace_id,operation)
);
alter table public.business_support_permits enable row level security;
alter table public.business_support_permits force row level security;
revoke all on public.business_support_permits from public,anon,authenticated;
create function public.business_support_permitted(p_workspace_id uuid,p_operation text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.business_support_permits where transaction_id=txid_current()
    and workspace_id=p_workspace_id and actor_id=auth.uid() and operation=p_operation);
$$;

create function public.guard_business_workspace_support()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if old.workspace_type='business' then
    if new.id is distinct from old.id then raise exception 'BUSINESS_WORKSPACE_ID_IMMUTABLE'; end if;
    if new.workspace_type<>old.workspace_type then raise exception 'BUSINESS_WORKSPACE_TYPE_IMMUTABLE'; end if;
    if (new.status,new.suspension_reason) is distinct from (old.status,old.suspension_reason)
      and not public.business_support_permitted(old.id,'status') then raise exception 'BUSINESS_SUPPORT_STATUS_PROCEDURE_REQUIRED'; end if;
    if new.owner_id is distinct from old.owner_id and not public.business_support_permitted(old.id,'ownership')
      then raise exception 'BUSINESS_OWNERSHIP_PROCEDURE_REQUIRED'; end if;
    if new.business_support_version is distinct from old.business_support_version
      and not (public.business_support_permitted(old.id,'status') or public.business_support_permitted(old.id,'ownership'))
      then raise exception 'BUSINESS_SUPPORT_VERSION_PROTECTED'; end if;
  end if;
  return new;
end;
$$;
create trigger guard_business_workspace_support before update on public.budget_workspaces
for each row execute function public.guard_business_workspace_support();

create function public.guard_business_owner_membership()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_workspace uuid;
begin
  if tg_op='INSERT' then
    if new.role='business_owner' and exists(select 1 from public.budget_workspaces where id=new.workspace_id and workspace_type='business')
      and not public.business_support_permitted(new.workspace_id,'ownership')
      and not public.business_admin_test_permit(new.workspace_id,new.user_id) then raise exception 'BUSINESS_OWNERSHIP_PROCEDURE_REQUIRED'; end if;
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
create trigger guard_business_owner_membership before insert or update or delete on public.workspace_members
for each row execute function public.guard_business_owner_membership();

create function public.admin_business_support_snapshot(p_workspace_id uuid,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.budget_workspaces%rowtype;s public.workspace_subscriptions%rowtype;v_members jsonb;v_actions jsonb;
begin
  if public.my_account_suspended() or not public.is_platform_staff(array['super_admin','admin_staff','finance_staff','support_staff'])
    then raise exception 'BUSINESS_SUPPORT_ADMIN_REQUIRED'; end if;
  if p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'INVALID_SUPPORT_OFFSET'; end if;
  select * into w from public.budget_workspaces where id=p_workspace_id and workspace_type='business';
  if w.id is null then raise exception 'BUSINESS_WORKSPACE_NOT_FOUND'; end if;
  select * into s from public.workspace_subscriptions where workspace_id=w.id;
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'user_id',m.user_id,'role',m.role,'name',p.full_name,
    'email',p.email,'account_status',p.account_status,'platform_staff',exists(select 1 from public.app_admins a where a.user_id=m.user_id))
    order by m.role,m.joined_at,m.id),'[]') into v_members from public.workspace_members m
    left join public.profiles p on p.id=m.user_id where m.workspace_id=w.id and m.status='active';
  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.created_at desc,rows.id),'[]') into v_actions from
    (select a.id,a.actor_id,p.email as actor_email,a.action,a.reason,a.before_summary,a.after_summary,a.created_at
      from public.business_support_actions a left join public.profiles p on p.id=a.actor_id
      where a.workspace_id=w.id order by a.created_at desc,a.id offset p_offset limit 20) rows;
  return jsonb_build_object('workspace',jsonb_build_object('id',w.id,'name',w.name,'status',w.status,'owner_id',w.owner_id,
    'suspension_reason',w.suspension_reason,'version',w.business_support_version),'subscription',to_jsonb(s),
    'owner', (select jsonb_build_object('id',p.id,'name',p.full_name,'email',p.email,'account_status',p.account_status) from public.profiles p where p.id=w.owner_id),
    'plan_name',(select display_name from public.plans where id=s.plan_id),
    'current_limit',public.business_effective_member_limit(w.id),'invitation_limit',public.business_effective_member_limit(w.id,true),
    'usage',public.business_billing_usage(w.id),'members',v_members,'actions',v_actions,
    'action_count',(select count(*) from public.business_support_actions where workspace_id=w.id),
    'pending_payment',exists(select 1 from public.subscription_payments where workspace_id=w.id and status='pending_review'),
    'can_suspend',public.is_platform_staff(array['super_admin','admin_staff']),
    'can_transfer',public.is_platform_staff(array['super_admin']));
end;
$$;

create function public.admin_business_set_status(p_workspace_id uuid,p_status text,p_expected_version integer,
  p_confirmation_name text,p_reason text,p_request_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.budget_workspaces%rowtype;a public.business_support_actions%rowtype;v_id uuid;v_action text;
begin
  if public.my_account_suspended() or not public.is_platform_staff(array['super_admin','admin_staff'])
    then raise exception 'BUSINESS_SUPPORT_STATUS_ADMIN_REQUIRED'; end if;
  if p_request_id is null or p_status is null or p_status not in ('active','suspended')
    or char_length(btrim(coalesce(p_reason,''))) not between 8 and 1000 then raise exception 'INVALID_BUSINESS_SUPPORT_ACTION'; end if;
  select * into w from public.budget_workspaces where id=p_workspace_id and workspace_type='business' for update;
  if w.id is null then raise exception 'BUSINESS_WORKSPACE_NOT_FOUND'; end if;
  v_action:=case when p_status='active' then 'restore' else 'suspend' end;
  select * into a from public.business_support_actions where workspace_id=w.id and request_id=p_request_id;
  if a.id is not null then
    if a.actor_id<>auth.uid() or a.action<>v_action then raise exception 'SUPPORT_REQUEST_ALREADY_USED'; end if;
    return a.id;
  end if;
  if w.status='closed' then raise exception 'CLOSED_BUSINESS_WORKSPACE'; end if;
  if p_expected_version is distinct from w.business_support_version or btrim(coalesce(p_confirmation_name,''))<>w.name
    then raise exception 'BUSINESS_SUPPORT_STATE_CHANGED'; end if;
  if w.status=p_status then raise exception 'BUSINESS_STATUS_ALREADY_SET'; end if;
  insert into public.business_support_permits values(txid_current(),w.id,auth.uid(),'status') on conflict do nothing;
  update public.budget_workspaces set status=p_status,suspension_reason=case when p_status='suspended' then btrim(p_reason) else null end,
    business_support_version=business_support_version+1,updated_at=now() where id=w.id;
  insert into public.business_support_actions(workspace_id,request_id,actor_id,action,reason,before_summary,after_summary)
    values(w.id,p_request_id,auth.uid(),v_action,btrim(p_reason),jsonb_build_object('status',w.status,'version',w.business_support_version),
      jsonb_build_object('status',p_status,'version',w.business_support_version+1)) returning id into v_id;
  delete from public.business_support_permits where transaction_id=txid_current() and workspace_id=w.id and operation='status';
  insert into public.notifications(user_id,created_by,type,title,body,url) values(w.owner_id,auth.uid(),'account',
    case when p_status='active' then 'Business workspace restored' else 'Business workspace suspended' end,
    case when p_status='active' then 'Workspace access was restored. Account and subscription restrictions still apply.' else 'Your Business workspace was suspended. Contact platform support.' end,'/business.html#business/subscription');
  return v_id;
end;
$$;

create function public.admin_business_transfer_owner(p_workspace_id uuid,p_new_owner_member_id uuid,p_expected_owner_id uuid,
  p_expected_version integer,p_confirmation_name text,p_confirmation_email text,p_reason text,p_request_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.budget_workspaces%rowtype;m public.workspace_members%rowtype;p public.profiles%rowtype;
declare a public.business_support_actions%rowtype;v_id uuid;v_action text;
begin
  if public.my_account_suspended() or not public.is_platform_staff(array['super_admin']) then raise exception 'SUPER_ADMIN_REQUIRED'; end if;
  if p_request_id is null or char_length(btrim(coalesce(p_reason,''))) not between 8 and 1000 then raise exception 'INVALID_BUSINESS_SUPPORT_ACTION'; end if;
  select * into w from public.budget_workspaces where id=p_workspace_id and workspace_type='business' for update;
  if w.id is null then raise exception 'BUSINESS_WORKSPACE_NOT_FOUND'; end if;
  select * into a from public.business_support_actions where workspace_id=w.id and request_id=p_request_id;
  if a.id is not null then
    if a.actor_id<>auth.uid() or a.action not in ('transfer','recover') or a.after_summary->>'member_id' is distinct from p_new_owner_member_id::text
      then raise exception 'SUPPORT_REQUEST_ALREADY_USED'; end if;
    return a.id;
  end if;
  if w.status='closed' then raise exception 'CLOSED_BUSINESS_WORKSPACE'; end if;
  if p_expected_version is distinct from w.business_support_version or p_expected_owner_id is distinct from w.owner_id
    or btrim(coalesce(p_confirmation_name,''))<>w.name then raise exception 'BUSINESS_SUPPORT_STATE_CHANGED'; end if;
  perform 1 from public.workspace_subscriptions where workspace_id=w.id for update;
  if exists(select 1 from public.subscription_payments where workspace_id=w.id and status='pending_review')
    then raise exception 'RESOLVE_PENDING_BUSINESS_PAYMENT_FIRST'; end if;
  select * into m from public.workspace_members where id=p_new_owner_member_id and workspace_id=w.id and status='active' for update;
  if m.id is null or m.user_id=w.owner_id or m.role='business_owner' then raise exception 'ACTIVE_EXISTING_BUSINESS_MEMBER_REQUIRED'; end if;
  select * into p from public.profiles where id=m.user_id for update;
  if p.id is null or p.account_status<>'active' or not exists(select 1 from auth.users where id=p.id)
    or exists(select 1 from public.app_admins where user_id=p.id )
    or (p.signup_source='admin_invitation' and not exists(select 1 from public.admin_user_invitations where id=p.admin_invitation_id and status='provisioned'))
    then raise exception 'REGISTERED_ACTIVE_NON_PLATFORM_OWNER_REQUIRED'; end if;
  if lower(btrim(coalesce(p_confirmation_email,'')))<>lower(p.email) or p.email is null then raise exception 'NEW_OWNER_EMAIL_CONFIRMATION_REQUIRED'; end if;
  v_action:=case when exists(select 1 from public.workspace_members where workspace_id=w.id and user_id=w.owner_id and role='business_owner' and status='active')
    and exists(select 1 from public.profiles where id=w.owner_id and account_status='active') then 'transfer' else 'recover' end;
  insert into public.business_support_permits values(txid_current(),w.id,auth.uid(),'ownership') on conflict do nothing;
  -- Remove old Owner privileges, including any member overrides, without rewriting history.
  delete from public.business_member_permissions where workspace_id=w.id and member_id in
    (select id from public.workspace_members where workspace_id=w.id and (user_id=w.owner_id or role='business_owner'));
  delete from public.business_member_scopes where workspace_id=w.id and member_id in
    (select id from public.workspace_members where workspace_id=w.id and (user_id=w.owner_id or role='business_owner'));
  update public.workspace_members set role='viewer',updated_at=now() where workspace_id=w.id and (user_id=w.owner_id or role='business_owner');
  update public.workspace_members set role='business_owner',updated_at=now() where id=m.id;
  update public.budget_workspaces set owner_id=m.user_id,business_support_version=business_support_version+1,updated_at=now() where id=w.id;
  update public.business_subscription_quotes set status='cancelled' where workspace_id=w.id and status='quoted';
  insert into public.business_support_actions(workspace_id,request_id,actor_id,action,reason,before_summary,after_summary)
    values(w.id,p_request_id,auth.uid(),v_action,btrim(p_reason),jsonb_build_object('owner_id',w.owner_id,'version',w.business_support_version),
      jsonb_build_object('owner_id',m.user_id,'member_id',m.id,'previous_owner_role','viewer','version',w.business_support_version+1)) returning id into v_id;
  perform public.business_record_audit_event(w.id,'support.ownership_changed','workspace',w.id,
    jsonb_build_object('owner_id',w.owner_id),jsonb_build_object('owner_id',m.user_id,'previous_owner_role','viewer'),btrim(p_reason));
  delete from public.business_support_permits where transaction_id=txid_current() and workspace_id=w.id and operation='ownership';
  insert into public.notifications(user_id,created_by,type,title,body,url)
    select uid,auth.uid(),'account','Business ownership changed','Platform support changed the Business Owner. Account and subscription restrictions still apply.','/business.html#business/subscription'
    from (select w.owner_id as uid union select m.user_id) recipients;
  return v_id;
end;
$$;

-- Keep the existing Owner-to-member transfer working behind the same ownership guard.
create or replace function public.transfer_business_ownership(
  p_workspace_id uuid,
  p_new_owner_member_id uuid,
  p_confirmation_name text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace public.budget_workspaces%rowtype;
  v_current_owner public.workspace_members%rowtype;
  v_new_owner public.workspace_members%rowtype;
begin
  if public.my_account_suspended() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into v_workspace from public.budget_workspaces
  where id = p_workspace_id and workspace_type = 'business' and status = 'active' and owner_id = auth.uid() for update;
  if not found then raise exception 'BUSINESS_OWNER_REQUIRED'; end if;
  if btrim(coalesce(p_confirmation_name, '')) <> v_workspace.name then raise exception 'OWNERSHIP_CONFIRMATION_MISMATCH'; end if;
  perform 1 from public.workspace_subscriptions where workspace_id=p_workspace_id for update;
  if exists(select 1 from public.subscription_payments where workspace_id=p_workspace_id and status='pending_review') then raise exception 'RESOLVE_PENDING_BUSINESS_PAYMENT_FIRST'; end if;
  if not exists (select 1 from public.workspace_subscriptions where workspace_id = p_workspace_id and status = 'active' and paid_through_at > now()) then
    raise exception 'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED';
  end if;
  select * into v_current_owner from public.workspace_members
  where workspace_id = p_workspace_id and user_id = auth.uid() and status = 'active' for update;
  select * into v_new_owner from public.workspace_members
  where id = p_new_owner_member_id and workspace_id = p_workspace_id and status = 'active' and user_id <> auth.uid() for update;
  if not found or v_new_owner.role = 'business_owner' then raise exception 'INVALID_NEW_BUSINESS_OWNER'; end if;
  insert into public.business_support_permits values(txid_current(),p_workspace_id,auth.uid(),'ownership') on conflict do nothing;
  if v_current_owner.id is null or v_current_owner.role<>'business_owner' then raise exception 'BUSINESS_OWNER_MEMBERSHIP_REQUIRED'; end if;
  if not exists(select 1 from public.profiles where id=v_new_owner.user_id and account_status='active')
    or exists(select 1 from public.app_admins where user_id=v_new_owner.user_id) then raise exception 'REGISTERED_ACTIVE_NON_PLATFORM_OWNER_REQUIRED'; end if;
  update public.workspace_members set role = 'business_admin', updated_at = now() where id = v_current_owner.id;
  update public.workspace_members set role = 'business_owner', updated_at = now() where id = v_new_owner.id;
  update public.budget_workspaces set owner_id = v_new_owner.user_id, business_support_version=business_support_version+1, updated_at = now() where id = p_workspace_id;
  perform public.business_record_audit_event(p_workspace_id, 'team.ownership_transferred',
    'workspace', p_workspace_id, jsonb_build_object('owner_id', auth.uid()),
    jsonb_build_object('owner_id', v_new_owner.user_id));
  delete from public.business_support_permits where transaction_id=txid_current() and workspace_id=p_workspace_id and operation='ownership';
  update public.business_subscription_quotes set status='cancelled' where workspace_id=p_workspace_id and status='quoted';
  return 'transferred';
end;
$$;

revoke all on function public.business_support_permitted(uuid,text),public.guard_business_workspace_support(),public.guard_business_owner_membership() from public,anon,authenticated;
revoke all on function public.admin_business_support_snapshot(uuid,integer),public.admin_business_set_status(uuid,text,integer,text,text,uuid),public.admin_business_transfer_owner(uuid,uuid,uuid,integer,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_business_support_snapshot(uuid,integer),public.admin_business_set_status(uuid,text,integer,text,text,uuid),public.admin_business_transfer_owner(uuid,uuid,uuid,integer,text,text,text,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
