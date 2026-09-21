-- Run after 20260921130000_notification_workspace_context.sql.
-- This diagnostic is read-only and always rolls back.

begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'workspace_id'
      and udt_name = 'uuid'
  ) then
    raise exception 'notifications.workspace_id is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_notification_workspace_context_trigger'
      and not tgisinternal
  ) then
    raise exception 'notification workspace trigger is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_payment_outbox_workspace_context_trigger'
      and not tgisinternal
  ) then
    raise exception 'payment outbox workspace trigger is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'link_admin_notification_workspace_context_trigger'
      and not tgisinternal
  ) then
    raise exception 'admin notification workspace trigger is missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'notification_outbox_target_url_check'
      and pg_get_constraintdef(oid) like '%workspace=%payment_item=%'
  ) then
    raise exception 'payment notification route constraint is not workspace-aware';
  end if;
end;
$$;

select
  'notification_workspace_context_ready' as check_name,
  true as passed;

rollback;
