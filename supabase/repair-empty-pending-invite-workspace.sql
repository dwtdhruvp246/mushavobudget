-- Optional repair for ONE test invitee whose empty Free personal workspace was
-- created before the invitation guard was applied. Run the read-only
-- pending-invitation-workspace-diagnostic.sql first. Replace BOTH values.
-- This script refuses to delete any workspace with payments or other data.
begin;

do $$
declare
  v_email text := lower(btrim('replace-with-invitee@example.com'));
  v_user_id uuid := '00000000-0000-0000-0000-000000000000';
  v_workspace_id uuid;
  v_fk record;
  v_has_rows boolean;
begin
  if not exists (
    select 1 from auth.users as users
    join public.profiles as profiles on profiles.id = users.id
    join public.admin_user_invitations as invitations
      on invitations.id = profiles.admin_invitation_id
      and invitations.auth_user_id = users.id
    where users.id = v_user_id and lower(users.email) = v_email
      and profiles.signup_source = 'admin_invitation'
      and invitations.status in ('pending_delivery', 'sent')
      and invitations.provisioned_workspace_id is null
  ) then
    raise exception 'Not an unfinished invitation for that exact email and UUID';
  end if;

  if (select count(*) from public.budget_workspaces where owner_id = v_user_id) <> 1 then
    raise exception 'Expected exactly one workspace; review this account manually';
  end if;
  select id into v_workspace_id from public.budget_workspaces
  where owner_id = v_user_id and workspace_type = 'personal'
    and status = 'active' and legacy_family_id is null
  for update;
  if v_workspace_id is null then
    raise exception 'Workspace is not an active personal workspace';
  end if;
  if (select count(*) from public.workspace_members where workspace_id = v_workspace_id) <> 1
     or not exists (
       select 1 from public.workspace_members
       where workspace_id = v_workspace_id and user_id = v_user_id and role = 'owner'
     ) then
    raise exception 'Workspace membership requires manual review';
  end if;
  if (select count(*) from public.workspace_subscriptions where workspace_id = v_workspace_id) <> 1
     or not exists (
       select 1 from public.workspace_subscriptions as subscriptions
       join public.plans as plans on plans.id = subscriptions.plan_id
       where subscriptions.workspace_id = v_workspace_id and plans.code = 'free'
     ) then
    raise exception 'Workspace plan requires manual review';
  end if;
  if exists (
    select 1 from public.subscription_entitlement_history as history
    where history.workspace_id = v_workspace_id
      and (history.reason is distinct from 'Initial Free entitlement'
           or history.actor_id is distinct from v_user_id)
  ) then
    raise exception 'Workspace entitlement history requires manual review';
  end if;

  -- Inspect every other foreign key referencing this workspace, including
  -- later-added tables and references that would become null on deletion.
  for v_fk in
    select constraint_row.conrelid::regclass as table_name,
           attribute.attname as column_name,
           cardinality(constraint_row.conkey) as column_count
    from pg_catalog.pg_constraint as constraint_row
    left join pg_catalog.pg_attribute as attribute
      on attribute.attrelid = constraint_row.conrelid
      and attribute.attnum = constraint_row.conkey[1]
    where constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.budget_workspaces'::regclass
      and constraint_row.conrelid not in (
        'public.workspace_members'::regclass,
        'public.workspace_settings'::regclass,
        'public.workspace_subscriptions'::regclass,
        'public.subscription_entitlement_history'::regclass
      )
  loop
    if v_fk.column_count <> 1 or v_fk.column_name is null then
      raise exception 'A complex workspace reference requires manual review';
    end if;
    execute format('select exists (select 1 from %s where %I = $1)',
                   v_fk.table_name, v_fk.column_name)
      into v_has_rows using v_workspace_id;
    if v_has_rows then
      raise exception 'Workspace data in % requires manual review', v_fk.table_name;
    end if;
  end loop;

  delete from public.budget_workspaces
  where id = v_workspace_id and owner_id = v_user_id;
end;
$$;

commit;
