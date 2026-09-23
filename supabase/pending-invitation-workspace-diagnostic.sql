-- Read only. Replace the email below, then run in Supabase SQL Editor.
-- A pending invitation should have no active workspace. If it does, preserve
-- the rows for review; this query does not delete any workspace or user data.
with target as (
  select lower(btrim('replace-with-invitee@example.com')) as email
), invited_user as (
  select users.id, users.email, users.email_confirmed_at
  from auth.users as users
  join target on lower(users.email) = target.email
)
select
  users.id as auth_user_id,
  users.email,
  users.email_confirmed_at is not null as email_verified,
  profiles.signup_source,
  profiles.admin_invitation_id,
  invitations.status as invitation_status,
  invitations.completed_at,
  invitations.provisioned_workspace_id,
  workspaces.id as existing_workspace_id,
  workspaces.workspace_type,
  workspaces.status as workspace_status,
  plans.code as existing_workspace_plan
from invited_user as users
left join public.profiles as profiles on profiles.id = users.id
left join lateral (
  select invitations.*
  from public.admin_user_invitations as invitations
  where invitations.auth_user_id = users.id
     or lower(invitations.email) = lower(users.email)
  order by invitations.created_at desc
  limit 1
) as invitations on true
left join public.budget_workspaces as workspaces on workspaces.owner_id = users.id
left join public.workspace_subscriptions as subscriptions
  on subscriptions.workspace_id = workspaces.id
left join public.plans as plans on plans.id = subscriptions.plan_id
order by workspaces.created_at nulls last;
