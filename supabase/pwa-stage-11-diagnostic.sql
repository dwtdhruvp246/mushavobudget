-- PWA Stage 11 read-only checks plus a rolled-back duplicate/claim exercise.

select
  to_regclass('public.notification_outbox') is not null as outbox_table_exists,
  coalesce((
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = to_regclass('public.notification_outbox')
  ), false) as rls_enabled_and_forced,
  to_regprocedure('public.enqueue_due_payment_reminders(timestamp with time zone)') is not null
    as enqueue_function_exists,
  to_regprocedure('public.claim_notification_outbox(integer,timestamp with time zone)') is not null
    as claim_function_exists,
  to_regprocedure('public.record_notification_outbox_result(uuid,boolean,boolean,text,timestamp with time zone)') is not null
    as result_function_exists,
  not has_table_privilege('anon', 'public.notification_outbox', 'select')
    and not has_table_privilege('authenticated', 'public.notification_outbox', 'select')
    as browser_queue_access_blocked,
  not has_function_privilege('anon', 'public.enqueue_due_payment_reminders(timestamp with time zone)', 'execute')
    and not has_function_privilege('authenticated', 'public.enqueue_due_payment_reminders(timestamp with time zone)', 'execute')
    and has_function_privilege('service_role', 'public.enqueue_due_payment_reminders(timestamp with time zone)', 'execute')
    as enqueue_access_correct,
  not has_function_privilege('anon', 'public.claim_notification_outbox(integer,timestamp with time zone)', 'execute')
    and not has_function_privilege('authenticated', 'public.claim_notification_outbox(integer,timestamp with time zone)', 'execute')
    and has_function_privilege('service_role', 'public.claim_notification_outbox(integer,timestamp with time zone)', 'execute')
    as claim_access_correct;

select status, count(*) as queue_rows
from public.notification_outbox
group by status
order by status;

-- This transaction creates one synthetic queue row twice with the same key,
-- proves the unique key keeps one row, proves only the first claim returns it,
-- and then rolls everything back. It never calls Web Push.
begin;

with test_target as (
  select subscriptions.user_id, members.workspace_id
  from public.push_subscriptions as subscriptions
  join public.workspace_members as members
    on members.user_id = subscriptions.user_id
   and members.status = 'active'
  where subscriptions.disabled_at is null
  order by subscriptions.created_at
  limit 1
)
insert into public.notification_outbox (
  user_id, workspace_id, source_type, source_id, notification_type,
  scheduled_for, title, body, target_url, idempotency_key,
  status, attempt_count, next_attempt_at
)
select
  test_target.user_id,
  test_target.workspace_id,
  'payment',
  '00000000-0000-4000-8000-000000000011'::uuid,
  'stage_11_diagnostic',
  '2000-01-01 09:00:00+00'::timestamptz,
  'Mushavo Budget',
  'Stage 11 queue diagnostic.',
  '/app.html?source=push&payment_item=00000000-0000-4000-8000-000000000011#family/payments',
  'stage-11-diagnostic:' || test_target.user_id,
  'pending',
  0,
  '2000-01-01 09:00:00+00'::timestamptz
from test_target
on conflict (idempotency_key) do nothing;

with test_target as (
  select subscriptions.user_id, members.workspace_id
  from public.push_subscriptions as subscriptions
  join public.workspace_members as members
    on members.user_id = subscriptions.user_id
   and members.status = 'active'
  where subscriptions.disabled_at is null
  order by subscriptions.created_at
  limit 1
)
insert into public.notification_outbox (
  user_id, workspace_id, source_type, source_id, notification_type,
  scheduled_for, title, body, target_url, idempotency_key,
  status, attempt_count, next_attempt_at
)
select
  test_target.user_id,
  test_target.workspace_id,
  'payment',
  '00000000-0000-4000-8000-000000000011'::uuid,
  'stage_11_diagnostic',
  '2000-01-01 09:00:00+00'::timestamptz,
  'Mushavo Budget',
  'Stage 11 queue diagnostic.',
  '/app.html?source=push&payment_item=00000000-0000-4000-8000-000000000011#family/payments',
  'stage-11-diagnostic:' || test_target.user_id,
  'pending',
  0,
  '2000-01-01 09:00:00+00'::timestamptz
from test_target
on conflict (idempotency_key) do nothing;

select count(*) = 1 as duplicate_insert_was_ignored
from public.notification_outbox
where idempotency_key like 'stage-11-diagnostic:%';

select count(*) = 1 as first_claim_returned_one_row
from public.claim_notification_outbox(1, '2000-01-02 00:00:00+00'::timestamptz)
where idempotency_key like 'stage-11-diagnostic:%';

select count(*) = 0 as second_claim_returned_no_rows
from public.claim_notification_outbox(1, '2000-01-02 00:00:01+00'::timestamptz)
where idempotency_key like 'stage-11-diagnostic:%';

rollback;
