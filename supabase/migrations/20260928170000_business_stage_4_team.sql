begin;

-- Business Stage 4: team invitations, scoped access, seat accounting,
-- immediate removal and protected ownership transfer.

alter table public.workspace_invitations
  add column if not exists delivery_status text not null default 'not_sent',
  add column if not exists last_sent_at timestamptz,
  add column if not exists delivery_error_code text,
  add column if not exists version integer not null default 1;

alter table public.workspace_invitations
  drop constraint if exists workspace_invitations_delivery_status_check,
  add constraint workspace_invitations_delivery_status_check
  check (delivery_status in ('not_sent', 'sent', 'failed'));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.workspace_invitations'::regclass
      and conname = 'workspace_invitations_workspace_id_id_key'
  ) then
    alter table public.workspace_invitations
      add constraint workspace_invitations_workspace_id_id_key unique (workspace_id, id);
  end if;
end $$;

create table if not exists public.business_invitation_scopes (
  invitation_id uuid not null,
  workspace_id uuid not null references public.budget_workspaces(id) on delete cascade,
  dimension_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (invitation_id, dimension_id),
  constraint business_invitation_scopes_invitation_fk
    foreign key (workspace_id, invitation_id)
    references public.workspace_invitations(workspace_id, id) on delete cascade,
  constraint business_invitation_scopes_dimension_fk
    foreign key (workspace_id, dimension_id)
    references public.business_dimensions(workspace_id, id) on delete cascade
);

create table if not exists public.business_team_operation_permits (
  transaction_id bigint not null,
  workspace_id uuid not null references public.budget_workspaces(id) on delete cascade,
  actor_id uuid,
  operation text not null check (operation in ('invitation_write', 'member_write')),
  created_at timestamptz not null default now(),
  primary key (transaction_id, workspace_id, operation)
);

alter table public.business_invitation_scopes enable row level security;
alter table public.business_invitation_scopes force row level security;
alter table public.business_team_operation_permits enable row level security;
alter table public.business_team_operation_permits force row level security;

revoke all on table public.business_invitation_scopes from public, anon, authenticated;
revoke all on table public.business_team_operation_permits from public, anon, authenticated;

-- Admin-granted Business workspaces are test workspaces. Give them enough
-- temporary capacity to test Stage 4 without publishing a customer seat count.
update public.workspace_subscriptions as subscriptions
set member_limit = greatest(subscriptions.member_limit, 10), updated_at = now()
where exists (
  select 1 from public.admin_subscription_grants as grants
  join public.budget_workspaces as workspaces on workspaces.id = grants.workspace_id
  where grants.workspace_id = subscriptions.workspace_id
    and grants.grant_kind = 'business_test'
    and workspaces.workspace_type = 'business'
);

create or replace function public.seed_business_stage_4_team_permissions()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.business_role_permissions(workspace_id, role, permission_code, enabled, granted_by)
  select new.workspace_id, roles.role, permissions.permission_code, true, workspaces.owner_id
  from public.budget_workspaces as workspaces
  cross join (values ('business_admin'), ('team_manager')) as roles(role)
  cross join (values ('team.view'), ('team.manage')) as permissions(permission_code)
  where workspaces.id = new.workspace_id and workspaces.workspace_type = 'business'
  on conflict (workspace_id, role, permission_code) do update set enabled = true, updated_at = now();
  return new;
end;
$$;

drop trigger if exists seed_business_stage_4_team_permissions_trigger on public.business_profiles;
create trigger seed_business_stage_4_team_permissions_trigger
after insert on public.business_profiles
for each row execute function public.seed_business_stage_4_team_permissions();

create or replace function public.business_team_permit(
  p_workspace_id uuid,
  p_operation text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.business_team_operation_permits
    where transaction_id = txid_current()
      and workspace_id = p_workspace_id
      and operation = p_operation
  );
$$;

create or replace function public.enforce_business_member_invitation_launch_control()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.budget_workspaces
    where id = new.workspace_id and workspace_type = 'business'
  ) and not public.product_customer_workspace_creation_enabled('business')
     and not public.business_team_permit(new.workspace_id, 'invitation_write')
  then
    raise exception 'BUSINESS_COMING_SOON';
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

create or replace function public.business_team_can_manage(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_business_workspace_member(p_workspace_id)
    and exists (
      select 1 from public.workspace_subscriptions
      where workspace_id = p_workspace_id and status = 'active' and paid_through_at > now()
    )
    and (
      exists (
        select 1 from public.budget_workspaces
        where id = p_workspace_id and owner_id = auth.uid()
      )
      or public.business_has_permission(p_workspace_id, 'team.manage')
    );
$$;

create or replace function public.expire_business_invitations(p_workspace_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.workspace_invitations as invitations
  set status = 'expired', responded_at = now(), updated_at = now(), version = version + 1
  where invitations.status = 'pending'
    and invitations.expires_at <= now()
    and (p_workspace_id is null or invitations.workspace_id = p_workspace_id)
    and exists (
      select 1 from public.budget_workspaces
      where id = invitations.workspace_id and workspace_type = 'business'
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

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
  if not public.is_business_workspace_member(p_workspace_id) then
    raise exception 'BUSINESS_MEMBERSHIP_REQUIRED';
  end if;
  perform public.expire_business_invitations(p_workspace_id);
  select owner_id = auth.uid() into v_is_owner
  from public.budget_workspaces
  where id = p_workspace_id and workspace_type = 'business' and status = 'active';
  v_can_manage := public.business_team_can_manage(p_workspace_id);
  v_can_view := v_is_owner or public.business_has_permission(p_workspace_id, 'team.view') or v_can_manage;

  select case when exists (
      select 1 from public.admin_subscription_grants
      where workspace_id = p_workspace_id and grant_kind = 'business_test'
    ) then greatest(member_limit, 10) else member_limit end into v_limit
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

  select case when exists (
      select 1 from public.admin_subscription_grants
      where workspace_id = p_workspace_id and grant_kind = 'business_test'
    ) then greatest(member_limit, 10) else member_limit end into v_limit from public.workspace_subscriptions
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

create or replace function public.record_business_invitation_delivery(
  p_invitation_id uuid,
  p_invitee_user_id uuid,
  p_succeeded boolean,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  update public.workspace_invitations
  set invitee_user_id = coalesce(p_invitee_user_id, invitee_user_id),
      delivery_status = case when p_succeeded then 'sent' else 'failed' end,
      last_sent_at = case when p_succeeded then now() else last_sent_at end,
      delivery_error_code = case when p_succeeded then null else left(coalesce(p_error_code, 'DELIVERY_FAILED'), 100) end,
      updated_at = now(), version = version + 1
  where id = p_invitation_id and status = 'pending';
  if not found then raise exception 'BUSINESS_INVITATION_NOT_AVAILABLE'; end if;
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
  if p_role not in ('business_admin', 'finance_manager', 'team_manager', 'staff', 'contributor', 'viewer') then raise exception 'INVALID_BUSINESS_ROLE'; end if;
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

create or replace function public.cancel_business_invitation(p_invitation_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_invitation public.workspace_invitations%rowtype;
begin
  select * into v_invitation from public.workspace_invitations
  where id = p_invitation_id and status = 'pending' for update;
  if not found or not public.business_team_can_manage(v_invitation.workspace_id) then raise exception 'BUSINESS_INVITATION_NOT_AVAILABLE'; end if;
  update public.workspace_invitations set status = 'cancelled', responded_at = now(), updated_at = now(), version = version + 1
  where id = p_invitation_id;
  perform public.business_record_audit_event(v_invitation.workspace_id, 'team.invitation_cancelled',
    'workspace_invitation', p_invitation_id, '{}'::jsonb, jsonb_build_object('email', v_invitation.invitee_email));
  return 'cancelled';
end;
$$;

create or replace function public.get_my_business_invitations()
returns table (
  invitation_id uuid, workspace_id uuid, workspace_name text, inviter_name text,
  role text, status text, expires_at timestamptz, scope_names text[]
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.expire_business_invitations(null);
  return query
  select invitations.id, invitations.workspace_id, workspaces.name,
    coalesce(nullif(inviter.full_name, ''), inviter.email, 'Business owner'),
    invitations.role, invitations.status, invitations.expires_at,
    coalesce(array_agg(dimensions.name order by dimensions.name) filter (where dimensions.id is not null), '{}'::text[])
  from public.workspace_invitations as invitations
  join public.budget_workspaces as workspaces on workspaces.id = invitations.workspace_id and workspaces.workspace_type = 'business'
  left join public.profiles as inviter on inviter.id = invitations.invited_by
  left join public.business_invitation_scopes as scopes on scopes.invitation_id = invitations.id
  left join public.business_dimensions as dimensions on dimensions.id = scopes.dimension_id
  where (invitations.invitee_user_id = auth.uid()
      or lower(invitations.invitee_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
    and invitations.status = 'pending'
  group by invitations.id, workspaces.name, inviter.full_name, inviter.email
  order by invitations.created_at desc;
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
begin
  if auth.uid() is null or public.my_account_suspended() then raise exception 'AUTHENTICATION_REQUIRED'; end if;
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
  select case when exists (
      select 1 from public.admin_subscription_grants
      where workspace_id = v_invitation.workspace_id and grant_kind = 'business_test'
    ) then greatest(member_limit, 10) else member_limit end into v_limit from public.workspace_subscriptions
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
  select * into v_member from public.workspace_members where id = p_member_id and workspace_id = p_workspace_id and status = 'active' for update;
  if not found or v_member.role = 'business_owner' then raise exception 'INVALID_BUSINESS_MEMBER'; end if;
  if p_role not in ('business_admin', 'finance_manager', 'team_manager', 'staff', 'contributor', 'viewer') then raise exception 'INVALID_BUSINESS_ROLE'; end if;
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
  delete from public.business_member_permissions where workspace_id = p_workspace_id and member_id = p_member_id;
  delete from public.business_member_scopes where workspace_id = p_workspace_id and member_id = p_member_id;
  update public.workspace_members set status = 'inactive', removed_at = now(), updated_at = now() where id = p_member_id;
  perform public.business_record_audit_event(p_workspace_id, 'team.member_removed',
    'workspace_member', p_member_id, jsonb_build_object('role', v_member.role), jsonb_build_object('status', 'inactive'));
  return 'removed';
end;
$$;

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
  if not exists (select 1 from public.workspace_subscriptions where workspace_id = p_workspace_id and status = 'active' and paid_through_at > now()) then
    raise exception 'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED';
  end if;
  select * into v_current_owner from public.workspace_members
  where workspace_id = p_workspace_id and user_id = auth.uid() and status = 'active' for update;
  select * into v_new_owner from public.workspace_members
  where id = p_new_owner_member_id and workspace_id = p_workspace_id and status = 'active' and user_id <> auth.uid() for update;
  if not found or v_new_owner.role = 'business_owner' then raise exception 'INVALID_NEW_BUSINESS_OWNER'; end if;
  update public.workspace_members set role = 'business_admin', updated_at = now() where id = v_current_owner.id;
  update public.workspace_members set role = 'business_owner', updated_at = now() where id = v_new_owner.id;
  update public.budget_workspaces set owner_id = v_new_owner.user_id, updated_at = now() where id = p_workspace_id;
  perform public.business_record_audit_event(p_workspace_id, 'team.ownership_transferred',
    'workspace', p_workspace_id, jsonb_build_object('owner_id', auth.uid()),
    jsonb_build_object('owner_id', v_new_owner.user_id));
  return 'transferred';
end;
$$;

-- Delegated team roles can manage members, while ownership and billing stay
-- protected by owner-only RPC checks.
insert into public.business_role_permissions(workspace_id, role, permission_code, enabled, granted_by)
select workspaces.id, roles.role, permissions.permission_code, true, workspaces.owner_id
from public.budget_workspaces as workspaces
cross join (values ('business_admin'), ('team_manager')) as roles(role)
cross join (values ('team.view'), ('team.manage')) as permissions(permission_code)
where workspaces.workspace_type = 'business'
on conflict (workspace_id, role, permission_code) do update set enabled = true, updated_at = now();

revoke all on function public.business_team_permit(uuid, text) from public, anon, authenticated;
revoke all on function public.expire_business_invitations(uuid) from public, anon, authenticated;
revoke all on function public.record_business_invitation_delivery(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.record_business_invitation_delivery(uuid, uuid, boolean, text) to service_role;

do $$ declare v_signature text;
begin
  foreach v_signature in array array[
    'public.business_team_snapshot(uuid)',
    'public.create_business_invitation(uuid,text,text,uuid[])',
    'public.prepare_business_invitation_resend(uuid)',
    'public.edit_business_invitation(uuid,text,uuid[],integer)',
    'public.cancel_business_invitation(uuid)',
    'public.get_my_business_invitations()',
    'public.respond_business_invitation(uuid,boolean)',
    'public.update_business_member_access(uuid,uuid,text,uuid[])',
    'public.remove_business_member(uuid,uuid)',
    'public.transfer_business_ownership(uuid,uuid,text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', v_signature);
    execute format('grant execute on function %s to authenticated', v_signature);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
