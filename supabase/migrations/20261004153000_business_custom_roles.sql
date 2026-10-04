begin;

-- Stable role codes keep assignments intact when an owner renames a role.
create table public.business_roles (
  workspace_id uuid not null references public.budget_workspaces(id) on delete cascade,
  code text not null,
  name text not null check(char_length(btrim(name)) between 2 and 80),
  description text not null default '' check(char_length(description)<=500),
  scope_mode text not null check(scope_mode in ('legacy','own','assigned','all')),
  is_system boolean not null default false,
  status text not null default 'active' check(status in ('active','archived')),
  version integer not null default 1 check(version>0),
  primary key(workspace_id,code),
  check((is_system and scope_mode='legacy' and code in ('business_admin','finance_manager','team_manager','staff','contributor','viewer'))
    or (not is_system and scope_mode<>'legacy' and code ~ '^custom_[0-9a-f]{32}$'))
);
create unique index business_roles_name_unique on public.business_roles(workspace_id,lower(btrim(name))) where status='active';
alter table public.business_roles enable row level security;
alter table public.business_roles force row level security;
revoke all on public.business_roles from public,anon,authenticated;
grant select on public.business_roles to authenticated;
create policy business_roles_member_read on public.business_roles for select to authenticated
using(public.is_business_workspace_member(workspace_id));

create function public.seed_business_roles(p_workspace_id uuid)
returns void language sql security definer set search_path=public,pg_temp as $$
  insert into public.business_roles(workspace_id,code,name,scope_mode,is_system)
  select p_workspace_id,code,name,'legacy',true from (values
    ('business_admin','Admin'),('finance_manager','Finance Manager'),('team_manager','Team Manager'),
    ('staff','Staff'),('contributor','Contributor'),('viewer','Viewer')) as roles(code,name)
  where exists(select 1 from public.budget_workspaces where id=p_workspace_id and workspace_type='business')
  on conflict(workspace_id,code) do nothing;
$$;
select public.seed_business_roles(id) from public.budget_workspaces where workspace_type='business';
create function public.seed_business_roles_trigger()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin perform public.seed_business_roles(new.workspace_id);return new;end;
$$;
create trigger seed_business_roles_after_profile after insert on public.business_profiles
for each row execute function public.seed_business_roles_trigger();

alter table public.workspace_members drop constraint workspace_members_role_check;
alter table public.workspace_members add constraint workspace_members_role_check check(role in
  ('owner','family_head','family_member','business_owner','business_admin','finance_manager','team_manager','staff','contributor','viewer')
  or role ~ '^custom_[0-9a-f]{32}$');
alter table public.business_role_permissions drop constraint business_role_permissions_role_check;
alter table public.business_role_permissions add constraint business_role_permissions_role_check check(role in
  ('business_admin','finance_manager','team_manager','staff','contributor','viewer') or role ~ '^custom_[0-9a-f]{32}$');

create function public.business_role_valid(p_workspace_id uuid,p_role text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.business_roles where workspace_id=p_workspace_id and code=p_role and status='active');
$$;
create function public.business_role_scope_mode(p_workspace_id uuid)
returns text language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce((select r.scope_mode from public.workspace_members m join public.business_roles r
    on r.workspace_id=m.workspace_id and r.code=m.role where m.workspace_id=p_workspace_id
    and m.user_id=auth.uid() and m.status='active' and r.status='active'),'legacy');
$$;
create function public.business_role_editable_permission(p_code text)
returns boolean language sql immutable as $$
  select p_code in ('workspace.view','dimensions.view','categories.view','team.view','team.manage',
    'finance.view_all','finance.create','finance.record_payment','approvals.view','approvals.review',
    'budgets.view','budgets.manage','reports.view','reports.export','documents.view','documents.create','documents.manage');
$$;
create function public.business_role_owner_required(p_workspace_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.business_claims_active(p_workspace_id) or not exists(select 1 from public.budget_workspaces
    where id=p_workspace_id and owner_id=auth.uid() and workspace_type='business' and status='active')
    then raise exception 'BUSINESS_OWNER_REQUIRED';end if;
end;
$$;

create or replace function public.business_has_permission(p_workspace_id uuid,p_permission_code text)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_member public.workspace_members%rowtype;v_effect text;v_mode text;
begin
  if auth.uid() is null or public.my_account_suspended() or not exists(select 1 from public.business_permission_definitions
    where permission_code=p_permission_code) then return false;end if;
  if not public.business_claims_active(p_workspace_id) then return false;end if;
  select * into v_member from public.workspace_members where workspace_id=p_workspace_id and user_id=auth.uid() and status='active';
  if not found then return false;end if;
  if exists(select 1 from public.budget_workspaces where id=p_workspace_id and owner_id=auth.uid()) then return true;end if;
  if not public.business_role_valid(p_workspace_id,v_member.role) then return false;end if;
  v_mode:=public.business_role_scope_mode(p_workspace_id);
  -- Custom roles cannot obtain unsupported/owner-only actions through overrides.
  if v_mode<>'legacy' and (not public.business_role_editable_permission(p_permission_code)
    or (v_mode='own' and p_permission_code in ('finance.view_all','finance.record_payment','approvals.view','approvals.review','budgets.view','budgets.manage','team.manage','documents.manage')))
    then return false;end if;
  if p_permission_code='finance.record_payment' and not public.business_has_permission(p_workspace_id,'finance.view_all')
    or p_permission_code='approvals.review' and not public.business_has_permission(p_workspace_id,'approvals.view')
    or p_permission_code='documents.manage' and not public.business_has_permission(p_workspace_id,'documents.view')
    or p_permission_code='reports.export' and not public.business_has_permission(p_workspace_id,'reports.view')
    or p_permission_code='budgets.manage' and not public.business_has_permission(p_workspace_id,'budgets.view')
    or p_permission_code='team.manage' and not public.business_has_permission(p_workspace_id,'team.view') then return false;end if;
  select effect into v_effect from public.business_member_permissions where workspace_id=p_workspace_id
    and member_id=v_member.id and permission_code=p_permission_code;
  if v_effect='deny' then return false;end if;
  if v_effect='allow' then return true;end if;
  return exists(select 1 from public.business_role_permissions where workspace_id=p_workspace_id
    and role=v_member.role and permission_code=p_permission_code and enabled);
end;
$$;

create or replace function public.business_claim_in_scope(p_workspace_id uuid,p_dimension_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.workspace_members m left join public.business_roles r
    on r.workspace_id=m.workspace_id and r.code=m.role where m.workspace_id=p_workspace_id
    and m.user_id=auth.uid() and m.status='active' and (m.role='business_owner' or
      ((r.is_system or r.status='active') and (
        (r.scope_mode in ('legacy','all','own') and not exists(select 1 from public.business_member_scopes s
          where s.workspace_id=p_workspace_id and s.member_id=m.id))
        or exists(select 1 from public.business_member_scopes s where s.workspace_id=p_workspace_id
          and s.member_id=m.id and s.dimension_id=p_dimension_id)))))
$$;
create or replace function public.business_report_scope(p_workspace_id uuid,p_dimension_id uuid,p_submitter_id uuid default null)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.business_claims_active(p_workspace_id) and public.business_has_permission(p_workspace_id,'reports.view') and (
    (public.business_role_scope_mode(p_workspace_id)='own' and p_submitter_id=auth.uid()
      and public.business_claim_in_scope(p_workspace_id,p_dimension_id))
    or (public.business_role_scope_mode(p_workspace_id) in ('all','assigned')
      and public.business_claim_in_scope(p_workspace_id,p_dimension_id)
      and (public.business_has_permission(p_workspace_id,'finance.view_all') or p_submitter_id=auth.uid()
        or (p_dimension_id is not null and exists(select 1 from public.workspace_members m
          join public.business_member_scopes s on s.workspace_id=m.workspace_id and s.member_id=m.id
          where m.workspace_id=p_workspace_id and m.user_id=auth.uid() and m.status='active' and s.dimension_id=p_dimension_id))))
    or (public.business_role_scope_mode(p_workspace_id)='legacy' and (
      (public.business_has_permission(p_workspace_id,'finance.view_all') and not exists(select 1 from public.workspace_members m
        where m.workspace_id=p_workspace_id and m.user_id=auth.uid() and m.status='active' and m.role in ('staff','contributor'))
        and public.business_claim_in_scope(p_workspace_id,p_dimension_id)) or p_submitter_id=auth.uid()
      or (p_dimension_id is not null and exists(select 1 from public.workspace_members m join public.business_member_scopes s
        on s.workspace_id=m.workspace_id and s.member_id=m.id where m.workspace_id=p_workspace_id
        and m.user_id=auth.uid() and m.status='active' and m.role not in ('staff','contributor') and s.dimension_id=p_dimension_id)))))
$$;

create function public.business_check_role_assignment(p_workspace_id uuid,p_role text,p_scope_ids uuid[],p_member_id uuid default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_member public.workspace_members%rowtype;v_mode text;
begin
  if not public.business_team_can_manage(p_workspace_id) or not public.business_role_valid(p_workspace_id,p_role)
    then raise exception 'INVALID_BUSINESS_ROLE';end if;
  select scope_mode into v_mode from public.business_roles where workspace_id=p_workspace_id and code=p_role;
  if v_mode='assigned' and coalesce(array_length(p_scope_ids,1),0)=0 then raise exception 'BUSINESS_ASSIGNED_SCOPE_REQUIRED';end if;
  if exists(select 1 from public.budget_workspaces where id=p_workspace_id and owner_id=auth.uid()) then return;end if;
  select * into v_member from public.workspace_members where workspace_id=p_workspace_id and user_id=auth.uid() and status='active';
  if p_member_id=v_member.id then raise exception 'BUSINESS_SELF_ACCESS_CHANGE_BLOCKED';end if;
  if exists(select 1 from public.business_role_permissions p where p.workspace_id=p_workspace_id and p.role=p_role
    and p.enabled and not public.business_has_permission(p_workspace_id,p.permission_code)) then raise exception 'BUSINESS_PRIVILEGE_ESCALATION_BLOCKED';end if;
  if p_member_id is not null and exists(select 1 from public.workspace_members target join public.business_role_permissions p
    on p.workspace_id=target.workspace_id and p.role=target.role where target.workspace_id=p_workspace_id
    and target.id=p_member_id and p.enabled and not public.business_has_permission(p_workspace_id,p.permission_code))
    then raise exception 'BUSINESS_PRIVILEGE_ESCALATION_BLOCKED';end if;
  if p_member_id is not null and exists(select 1 from public.business_member_permissions p where p.workspace_id=p_workspace_id
    and p.member_id=p_member_id and p.effect='allow' and not public.business_has_permission(p_workspace_id,p.permission_code))
    then raise exception 'BUSINESS_PRIVILEGE_ESCALATION_BLOCKED';end if;
  if exists(select 1 from public.business_member_scopes where workspace_id=p_workspace_id and member_id=v_member.id)
    or public.business_role_scope_mode(p_workspace_id)='assigned' then
    if p_member_id is not null and (not exists(select 1 from public.business_member_scopes where workspace_id=p_workspace_id and member_id=p_member_id)
      or exists(select 1 from public.business_member_scopes target where target.workspace_id=p_workspace_id and target.member_id=p_member_id
        and not exists(select 1 from public.business_member_scopes mine where mine.workspace_id=p_workspace_id and mine.member_id=v_member.id
          and mine.dimension_id=target.dimension_id))) then raise exception 'BUSINESS_SCOPE_ESCALATION_BLOCKED';end if;
    if coalesce(array_length(p_scope_ids,1),0)=0 or exists(select 1 from unnest(p_scope_ids) scope_id
      where not exists(select 1 from public.business_member_scopes where workspace_id=p_workspace_id
        and member_id=v_member.id and dimension_id=scope_id)) then raise exception 'BUSINESS_SCOPE_ESCALATION_BLOCKED';end if;
  end if;
end;
$$;

create function public.business_roles_snapshot(p_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner boolean;v_roles jsonb;v_permissions jsonb;v_overrides jsonb;
begin
  if not public.business_claims_active(p_workspace_id) then raise exception 'BUSINESS_MEMBERSHIP_REQUIRED';end if;
  v_owner:=exists(select 1 from public.budget_workspaces where id=p_workspace_id and owner_id=auth.uid());
  select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object(
    'permissions',coalesce((select jsonb_agg(permission_code order by permission_code) from public.business_role_permissions
      where workspace_id=p_workspace_id and role=r.code and enabled),'[]'::jsonb),
    'members',(select count(*) from public.workspace_members where workspace_id=p_workspace_id and role=r.code and status='active'),
    'invitations',(select count(*) from public.workspace_invitations where workspace_id=p_workspace_id and role=r.code
      and status='pending' and expires_at>now())) order by r.is_system desc,r.name),'[]'::jsonb) into v_roles
  from public.business_roles r where r.workspace_id=p_workspace_id;
  select coalesce(jsonb_agg(to_jsonb(d)||jsonb_build_object('editable',public.business_role_editable_permission(d.permission_code))
    order by d.permission_group,d.display_name),'[]'::jsonb) into v_permissions from public.business_permission_definitions d;
  if v_owner then select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) into v_overrides from public.business_member_permissions p
    where workspace_id=p_workspace_id;else v_overrides:='[]'::jsonb;end if;
  return jsonb_build_object('roles',v_roles,'permissions',v_permissions,'overrides',v_overrides,'can_manage',v_owner);
end;
$$;
create function public.save_business_role(p_workspace_id uuid,p_code text,p_name text,p_description text,p_scope_mode text,
  p_permissions text[],p_expected_version integer default null)
returns public.business_roles language plpgsql security definer set search_path=public,pg_temp as $$
declare v_role public.business_roles%rowtype;v_before jsonb;v_code text;
begin
  perform public.business_role_owner_required(p_workspace_id);
  perform 1 from public.budget_workspaces where id=p_workspace_id for update;
  if lower(btrim(p_name)) in ('owner','business owner') then raise exception 'BUSINESS_SYSTEM_ROLE_PROTECTED';end if;
  if p_permissions is null or exists(select 1 from unnest(p_permissions) code where not public.business_role_editable_permission(code))
    or not ('workspace.view'=any(p_permissions)) then raise exception 'INVALID_BUSINESS_ROLE_PERMISSION';end if;
  if 'finance.record_payment'=any(p_permissions) and not ('finance.view_all'=any(p_permissions))
    or 'approvals.review'=any(p_permissions) and not ('approvals.view'=any(p_permissions))
    or 'documents.manage'=any(p_permissions) and not ('documents.view'=any(p_permissions))
    or 'reports.export'=any(p_permissions) and not ('reports.view'=any(p_permissions))
    or 'budgets.manage'=any(p_permissions) and not ('budgets.view'=any(p_permissions))
    or 'team.manage'=any(p_permissions) and not ('team.view'=any(p_permissions))
    then raise exception 'BUSINESS_PERMISSION_DEPENDENCY_REQUIRED';end if;
  if p_code is null then
    v_code:='custom_'||replace(gen_random_uuid()::text,'-','');
    insert into public.business_roles(workspace_id,code,name,description,scope_mode)
    values(p_workspace_id,v_code,btrim(p_name),coalesce(p_description,''),p_scope_mode) returning * into v_role;
  else
    select * into v_role from public.business_roles where workspace_id=p_workspace_id and code=p_code and status='active' for update;
    if not found then raise exception 'INVALID_BUSINESS_ROLE';end if;
    if p_expected_version is distinct from v_role.version then raise exception 'BUSINESS_ROLE_CHANGED';end if;
    v_before:=to_jsonb(v_role)||jsonb_build_object('permissions',coalesce((select jsonb_agg(permission_code) from public.business_role_permissions
      where workspace_id=p_workspace_id and role=p_code and enabled),'[]'::jsonb));v_code:=p_code;
    if v_role.is_system and (p_name is distinct from v_role.name or p_scope_mode<>'legacy') then raise exception 'BUSINESS_SYSTEM_ROLE_PROTECTED';end if;
    if not v_role.is_system and p_scope_mode is distinct from v_role.scope_mode and (
      exists(select 1 from public.workspace_members where workspace_id=p_workspace_id and role=p_code and status='active')
      or exists(select 1 from public.workspace_invitations where workspace_id=p_workspace_id and role=p_code and status='pending' and expires_at>now()))
      then raise exception 'BUSINESS_ROLE_SCOPE_IN_USE';end if;
    update public.business_roles set name=btrim(p_name),description=coalesce(p_description,''),scope_mode=p_scope_mode,version=version+1
    where workspace_id=p_workspace_id and code=p_code returning * into v_role;
  end if;
  if v_role.scope_mode='own' and p_permissions && array['finance.view_all','finance.record_payment','approvals.view','approvals.review','budgets.view','budgets.manage','team.manage','documents.manage']
    then raise exception 'BUSINESS_OWN_RECORDS_PERMISSION_CONFLICT';end if;
  delete from public.business_role_permissions where workspace_id=p_workspace_id and role=v_code
    and public.business_role_editable_permission(permission_code);
  insert into public.business_role_permissions(workspace_id,role,permission_code,enabled,granted_by)
    select p_workspace_id,v_code,code,true,auth.uid() from (select distinct unnest(p_permissions) as code) p;
  perform public.business_record_audit_event(p_workspace_id,'business.role_saved','business_role',null,coalesce(v_before,'{}'::jsonb),
    to_jsonb(v_role)||jsonb_build_object('permissions',p_permissions));
  perform public.emit_business_change_signal(p_workspace_id,true);
  return v_role;
end;
$$;
create function public.archive_business_role(p_workspace_id uuid,p_code text,p_expected_version integer)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_role public.business_roles%rowtype;
begin
  perform public.business_role_owner_required(p_workspace_id);
  perform 1 from public.budget_workspaces where id=p_workspace_id for update;
  select * into v_role from public.business_roles where workspace_id=p_workspace_id and code=p_code and status='active' for update;
  if not found or v_role.is_system then raise exception 'BUSINESS_SYSTEM_ROLE_PROTECTED';end if;
  if v_role.version is distinct from p_expected_version then raise exception 'BUSINESS_ROLE_CHANGED';end if;
  if exists(select 1 from public.workspace_members where workspace_id=p_workspace_id and role=p_code and status='active')
    or exists(select 1 from public.workspace_invitations where workspace_id=p_workspace_id and role=p_code and status='pending' and expires_at>now())
    then raise exception 'BUSINESS_ROLE_IN_USE';end if;
  update public.business_roles set status='archived',version=version+1 where workspace_id=p_workspace_id and code=p_code;
  perform public.business_record_audit_event(p_workspace_id,'business.role_archived','business_role',null,to_jsonb(v_role),'{}'::jsonb);
  perform public.emit_business_change_signal(p_workspace_id,true);
end;
$$;

-- Existing invitation and member RPC definitions follow, retaining seat limits,
-- optimistic edits, delivery audit, notifications and ownership safeguards.

create function public.business_roles_scope(p_workspace_id uuid,p_role text)
returns text language sql stable security definer set search_path=public,pg_temp as $$
select scope_mode from public.business_roles where workspace_id=p_workspace_id and code=p_role and status='active';
$$;
create or replace function public.enforce_business_member_role_compatibility()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_type text;
begin
  select workspace_type into v_workspace_type
  from public.budget_workspaces where id = new.workspace_id;
  if v_workspace_type = 'business' and new.role <> 'business_owner' and not public.business_role_valid(new.workspace_id,new.role) then
    raise exception 'INVALID_BUSINESS_ROLE';
  elsif v_workspace_type = 'household' and new.role not in ('owner', 'family_head', 'family_member') then
    raise exception 'INVALID_HOUSEHOLD_ROLE';
  elsif v_workspace_type = 'personal' and new.role <> 'owner' then
    raise exception 'INVALID_PERSONAL_ROLE';
  end if;
  return new;
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
  perform public.business_check_role_assignment(p_workspace_id,p_role,p_scope_ids,null);
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

create or replace function public.edit_business_invitation(
  p_invitation_id uuid,
  p_role text,
  p_scope_ids uuid[],
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_invitation public.workspace_invitations%rowtype;
begin
  select * into v_invitation from public.workspace_invitations
  where id = p_invitation_id and status = 'pending' for update;
  if not found or not public.business_team_can_manage(v_invitation.workspace_id) then raise exception 'BUSINESS_INVITATION_NOT_AVAILABLE'; end if;
  if v_invitation.version <> p_expected_version then raise exception 'BUSINESS_INVITATION_CHANGED'; end if;
  perform 1 from public.budget_workspaces where id=v_invitation.workspace_id for update;
  perform public.business_check_role_assignment(v_invitation.workspace_id,p_role,p_scope_ids,null);
  if coalesce(array_length(p_scope_ids, 1), 0) > 20 or exists (
    select 1 from unnest(coalesce(p_scope_ids, '{}'::uuid[])) as scope_id
    where not exists (select 1 from public.business_dimensions where id = scope_id
      and workspace_id = v_invitation.workspace_id and status = 'active')
  ) then raise exception 'INVALID_BUSINESS_SCOPE'; end if;
  update public.workspace_invitations set role = p_role, updated_at = now(), version = version + 1
  where id = p_invitation_id returning * into v_invitation;
  delete from public.business_invitation_scopes where invitation_id = p_invitation_id;
  insert into public.business_invitation_scopes(invitation_id, workspace_id, dimension_id)
  select p_invitation_id, v_invitation.workspace_id, distinct_scope
  from unnest(coalesce(p_scope_ids, '{}'::uuid[])) as distinct_scope;
  perform public.business_record_audit_event(v_invitation.workspace_id, 'team.invitation_edited',
    'workspace_invitation', p_invitation_id, '{}'::jsonb,
    jsonb_build_object('role', p_role, 'scope_count', coalesce(array_length(p_scope_ids, 1), 0)));
  return jsonb_build_object('id', v_invitation.id, 'version', v_invitation.version);
end;
$$;

create or replace function public.update_business_member_access(
  p_workspace_id uuid,
  p_member_id uuid,
  p_role text,
  p_scope_ids uuid[] default '{}'::uuid[]
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_member public.workspace_members%rowtype;
begin
  if not public.business_team_can_manage(p_workspace_id) then raise exception 'BUSINESS_TEAM_ACCESS_REQUIRED'; end if;
  perform 1 from public.budget_workspaces where id=p_workspace_id for update;
  select * into v_member from public.workspace_members where id = p_member_id and workspace_id = p_workspace_id and status = 'active' for update;
  if not found or v_member.role = 'business_owner' then raise exception 'INVALID_BUSINESS_MEMBER'; end if;
  perform public.business_check_role_assignment(p_workspace_id,p_role,p_scope_ids,p_member_id);
  if coalesce(array_length(p_scope_ids, 1), 0) > 20 or exists (
    select 1 from unnest(coalesce(p_scope_ids, '{}'::uuid[])) as scope_id
    where not exists (select 1 from public.business_dimensions where id = scope_id and workspace_id = p_workspace_id and status = 'active')
  ) then raise exception 'INVALID_BUSINESS_SCOPE'; end if;
  update public.workspace_members set role = p_role, updated_at = now() where id = p_member_id;
  delete from public.business_member_scopes where member_id = p_member_id;
  insert into public.business_member_scopes(workspace_id, member_id, dimension_id, assigned_by)
  select p_workspace_id, p_member_id, distinct_scope, auth.uid()
  from unnest(coalesce(p_scope_ids, '{}'::uuid[])) as distinct_scope;
  perform public.business_record_audit_event(p_workspace_id, 'team.member_access_updated',
    'workspace_member', p_member_id, jsonb_build_object('role', v_member.role), jsonb_build_object('role', p_role));
  return 'updated';
end;
$$;

create or replace function public.set_business_role_permission(
  p_workspace_id uuid,
  p_role text,
  p_permission_code text,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.my_account_suspended() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if not public.is_business_workspace_member(p_workspace_id) or not exists (
    select 1 from public.budget_workspaces
    where id = p_workspace_id and workspace_type = 'business'
      and status = 'active' and owner_id = auth.uid()
  ) then raise exception 'BUSINESS_OWNER_REQUIRED'; end if;
  perform public.business_role_owner_required(p_workspace_id);
  if not public.business_role_valid(p_workspace_id,p_role)
     or not exists (
       select 1 from public.business_permission_definitions
       where permission_code = p_permission_code
     )
     or not public.business_role_editable_permission(p_permission_code)
     or (public.business_roles_scope(p_workspace_id,p_role)='own' and p_permission_code in ('finance.view_all','finance.record_payment','approvals.view','approvals.review','budgets.view','budgets.manage','team.manage','documents.manage')) then
    raise exception 'INVALID_BUSINESS_ROLE_PERMISSION';
  end if;

  perform 1 from public.budget_workspaces where id=p_workspace_id for update;
  insert into public.business_role_permissions (
    workspace_id, role, permission_code, enabled, granted_by
  ) values (p_workspace_id, p_role, p_permission_code, coalesce(p_enabled, false), auth.uid())
  on conflict (workspace_id, role, permission_code) do update
  set enabled = excluded.enabled, granted_by = excluded.granted_by;

  update public.business_roles set version=version+1 where workspace_id=p_workspace_id and code=p_role;
  perform public.business_record_audit_event(
    p_workspace_id, 'business.role_permission_changed', 'business_role_permission', null,
    '{}'::jsonb,
    jsonb_build_object('role', p_role, 'permission_code', p_permission_code, 'enabled', coalesce(p_enabled, false))
  );
end;
$$;

create or replace function public.set_business_member_permission(
  p_workspace_id uuid,
  p_member_id uuid,
  p_permission_code text,
  p_effect text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.workspace_members%rowtype;
begin
  if public.my_account_suspended() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if not public.is_business_workspace_member(p_workspace_id) or not exists (
    select 1 from public.budget_workspaces
    where id = p_workspace_id and workspace_type = 'business'
      and status = 'active' and owner_id = auth.uid()
  ) then raise exception 'BUSINESS_OWNER_REQUIRED'; end if;
  perform public.business_role_owner_required(p_workspace_id);
  select * into v_member from public.workspace_members
  where id = p_member_id and workspace_id = p_workspace_id and status = 'active';
  if not found or v_member.role = 'business_owner' then raise exception 'INVALID_BUSINESS_MEMBER'; end if;
  if not exists (
    select 1 from public.business_permission_definitions
    where permission_code = p_permission_code
  ) or not public.business_role_editable_permission(p_permission_code)
    or (p_permission_code='workspace.view' and p_effect='deny')
    or (p_effect='allow' and public.business_roles_scope(p_workspace_id,v_member.role)='own' and p_permission_code in ('finance.view_all','finance.record_payment','approvals.view','approvals.review','budgets.view','budgets.manage','team.manage','documents.manage')) then
    raise exception 'INVALID_BUSINESS_PERMISSION';
  end if;

  if p_effect is null then
    delete from public.business_member_permissions
    where workspace_id = p_workspace_id and member_id = p_member_id
      and permission_code = p_permission_code;
  elsif p_effect in ('allow', 'deny') then
    insert into public.business_member_permissions (
      workspace_id, member_id, permission_code, effect, granted_by
    ) values (p_workspace_id, p_member_id, p_permission_code, p_effect, auth.uid())
    on conflict (workspace_id, member_id, permission_code) do update
    set effect = excluded.effect, granted_by = excluded.granted_by;
  else
    raise exception 'INVALID_BUSINESS_PERMISSION_EFFECT';
  end if;

  perform public.business_record_audit_event(
    p_workspace_id, 'business.member_permission_changed', 'workspace_member', p_member_id,
    '{}'::jsonb,
    jsonb_build_object('permission_code', p_permission_code, 'effect', p_effect)
  );
end;
$$;

create or replace function public.business_report_data(p_workspace_id uuid,p_from date,p_to date,p_mode text,p_currency text,
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
      and m.user_id=auth.uid() and m.status='active' and (m.role in ('staff','contributor') or public.business_role_scope_mode(p_workspace_id) in ('own','assigned')))
    and not exists(select 1 from public.workspace_members m join public.business_member_scopes s on s.workspace_id=m.workspace_id and s.member_id=m.id
      where m.workspace_id=p_workspace_id and m.user_id=auth.uid() and m.status='active') then 'workspace'
    when exists(select 1 from public.workspace_members m join public.business_member_scopes s on s.workspace_id=m.workspace_id and s.member_id=m.id
      where m.workspace_id=p_workspace_id and m.user_id=auth.uid() and m.status='active' and m.role not in ('staff','contributor') and public.business_role_scope_mode(p_workspace_id)<>'own')
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
create function public.validate_business_invitation_role()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.budget_workspaces where id=new.workspace_id and workspace_type='business') then
    if not public.business_role_valid(new.workspace_id,new.role) then raise exception 'INVALID_BUSINESS_ROLE';end if;
  elsif new.role like 'custom_%' then raise exception 'INVALID_BUSINESS_ROLE';end if;
  return new;
end;
$$;
create trigger business_invitation_custom_role_guard before insert or update of role,workspace_id on public.workspace_invitations
for each row execute function public.validate_business_invitation_role();
revoke all on function public.seed_business_roles(uuid),public.seed_business_roles_trigger(),public.business_role_valid(uuid,text),
  public.business_role_scope_mode(uuid),public.business_role_editable_permission(text),public.business_role_owner_required(uuid),
  public.business_check_role_assignment(uuid,text,uuid[],uuid),public.business_roles_scope(uuid,text),public.validate_business_invitation_role()
  from public,anon,authenticated;
revoke all on function public.business_roles_snapshot(uuid),public.save_business_role(uuid,text,text,text,text,text[],integer),
  public.archive_business_role(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.business_roles_snapshot(uuid),public.save_business_role(uuid,text,text,text,text,text[],integer),
  public.archive_business_role(uuid,text,integer) to authenticated;

create or replace function public.prepare_business_invitation_resend(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_invitation public.workspace_invitations%rowtype;
begin
  select * into v_invitation from public.workspace_invitations
  where id = p_invitation_id and status = 'pending' for update;
  if not found or not public.business_team_can_manage(v_invitation.workspace_id) then
    raise exception 'BUSINESS_INVITATION_NOT_AVAILABLE';
  end if;
  if not public.business_role_valid(v_invitation.workspace_id,v_invitation.role) then raise exception 'INVALID_BUSINESS_ROLE';end if;
  if v_invitation.last_sent_at > now() - interval '1 minute' then raise exception 'BUSINESS_INVITATION_RATE_LIMITED'; end if;
  update public.workspace_invitations set expires_at = now() + interval '7 days', updated_at = now(),
    delivery_status = 'not_sent', delivery_error_code = null, version = version + 1
  where id = p_invitation_id;
  perform public.business_record_audit_event(v_invitation.workspace_id, 'team.invitation_resent',
    'workspace_invitation', v_invitation.id, '{}'::jsonb, jsonb_build_object('email', v_invitation.invitee_email));
  return jsonb_build_object('invitation_id', v_invitation.id, 'email', v_invitation.invitee_email,
    'invitee_user_id', v_invitation.invitee_user_id, 'existing_user', v_invitation.invitee_user_id is not null);
end;
$$;

create or replace function public.remove_business_member(p_workspace_id uuid, p_member_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_member public.workspace_members%rowtype;
begin
  if not public.business_team_can_manage(p_workspace_id) then raise exception 'BUSINESS_TEAM_ACCESS_REQUIRED'; end if;
  select * into v_member from public.workspace_members where id = p_member_id and workspace_id = p_workspace_id and status = 'active' for update;
  if not found or v_member.role = 'business_owner' or v_member.user_id = auth.uid() then raise exception 'INVALID_BUSINESS_MEMBER'; end if;
  perform public.business_check_role_assignment(p_workspace_id,v_member.role,coalesce((select array_agg(dimension_id)
    from public.business_member_scopes where workspace_id=p_workspace_id and member_id=p_member_id),'{}'::uuid[]),p_member_id);
  delete from public.business_member_permissions where workspace_id = p_workspace_id and member_id = p_member_id;
  delete from public.business_member_scopes where workspace_id = p_workspace_id and member_id = p_member_id;
  update public.workspace_members set status = 'inactive', removed_at = now(), updated_at = now() where id = p_member_id;
  perform public.business_record_audit_event(p_workspace_id, 'team.member_removed',
    'workspace_member', p_member_id, jsonb_build_object('role', v_member.role), jsonb_build_object('status', 'inactive'));
  return 'removed';
end;
$$;

-- Role/scope and individual exceptions are committed together or rolled back together.
create function public.update_business_member_role_access(p_workspace_id uuid,p_member_id uuid,p_role text,p_scope_ids uuid[],p_overrides jsonb)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare v_item jsonb;
begin
  perform public.business_role_owner_required(p_workspace_id);
  if p_overrides is null or jsonb_typeof(p_overrides)<>'array' or jsonb_array_length(p_overrides)>50
    then raise exception 'INVALID_BUSINESS_PERMISSION';end if;
  perform public.update_business_member_access(p_workspace_id,p_member_id,p_role,p_scope_ids);
  for v_item in select value from jsonb_array_elements(p_overrides) loop
    if not public.business_role_editable_permission(v_item->>'permission_code')
      or coalesce(v_item->>'effect','') not in ('','allow','deny') then raise exception 'INVALID_BUSINESS_PERMISSION';end if;
    perform public.set_business_member_permission(p_workspace_id,p_member_id,v_item->>'permission_code',nullif(v_item->>'effect',''));
  end loop;
  perform public.emit_business_change_signal(p_workspace_id,true);
  return 'updated';
end;
$$;
revoke all on function public.update_business_member_role_access(uuid,uuid,text,uuid[],jsonb) from public,anon,authenticated;
grant execute on function public.update_business_member_role_access(uuid,uuid,text,uuid[],jsonb) to authenticated;

-- Existing grants whose required view was disabled already had no usable access.
-- Keep stored role settings consistent with the enforced dependencies.
update public.business_role_permissions p set enabled=false where p.enabled and exists(
  select 1 from (values ('reports.export','reports.view'),('budgets.manage','budgets.view'),
    ('team.manage','team.view'),('finance.record_payment','finance.view_all'),('approvals.review','approvals.view'),
    ('documents.manage','documents.view')) dependencies(action,required)
  where p.permission_code=dependencies.action and not exists(select 1 from public.business_role_permissions v
    where v.workspace_id=p.workspace_id and v.role=p.role and v.permission_code=dependencies.required and v.enabled));

notify pgrst, 'reload schema';
commit;
