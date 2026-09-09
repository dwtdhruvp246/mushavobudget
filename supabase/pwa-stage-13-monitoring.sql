-- PWA Stage 13 production health check.
-- This diagnostic is read-only and returns aggregate operational data only.
-- It never selects secrets, push endpoints, browser keys, user IDs, payment
-- names, notification bodies, or target URLs.

with
target_cron as (
  select jobid, active, schedule
  from cron.job
  where jobname = 'mushavo-budget-dispatch-push-reminders'
  order by jobid desc
  limit 1
),
cron_health as (
  select
    coalesce(bool_or(target_cron.active and target_cron.schedule = '*/15 * * * *'), false) as configured,
    max(runs.start_time) as latest_run_at,
    count(*) filter (
      where runs.start_time >= now() - interval '24 hours'
        and runs.status <> 'succeeded'
    ) as failed_runs_24h
  from target_cron
  left join cron.job_run_details as runs on runs.jobid = target_cron.jobid
),
outbox_health as (
  select
    count(*) filter (where status = 'sent' and sent_at >= now() - interval '24 hours') as sent_24h,
    count(*) filter (where status = 'cancelled' and updated_at >= now() - interval '24 hours') as cancelled_24h,
    count(*) filter (where status = 'failed' and updated_at >= now() - interval '24 hours') as failed_24h,
    count(*) filter (where status = 'retry') as retry_now,
    count(*) filter (
      where status = 'processing'
        and claimed_at <= now() - interval '15 minutes'
    ) as stale_processing,
    count(*) filter (
      where status in ('pending', 'retry')
        and scheduled_for <= now()
    ) as due_now,
    coalesce(
      floor(extract(epoch from (now() - min(scheduled_for) filter (
        where status in ('pending', 'retry') and scheduled_for <= now()
      ))) / 60)::bigint,
      0
    ) as oldest_due_minutes
  from public.notification_outbox
),
duplicate_health as (
  select count(*) as duplicate_keys
  from (
    select idempotency_key
    from public.notification_outbox
    group by idempotency_key
    having count(*) > 1
  ) as duplicates
),
subscription_health as (
  select
    count(*) filter (where disabled_at is null) as active_devices,
    count(distinct user_id) filter (where disabled_at is null) as users_with_active_device,
    count(*) filter (
      where disabled_at is null and failure_count > 0
    ) as active_devices_with_failures,
    count(*) filter (
      where disabled_at >= now() - interval '24 hours'
    ) as disabled_devices_24h
  from public.push_subscriptions
),
audience as (
  select count(distinct user_id) as active_workspace_users
  from public.workspace_members
  where status = 'active'
),
checks as (
  select
    10 as display_order,
    'Cron configuration'::text as check_name,
    case when configured then 'PASS' else 'ATTENTION' end::text as health,
    case when configured then 'Active every 15 minutes' else 'Missing, inactive, or wrong schedule' end::text as value,
    'Expected job: mushavo-budget-dispatch-push-reminders'::text as guidance
  from cron_health

  union all
  select
    20,
    'Latest Cron run',
    case
      when latest_run_at is null then 'ATTENTION'
      when latest_run_at < now() - interval '20 minutes' then 'ATTENTION'
      when failed_runs_24h > 0 then 'ATTENTION'
      else 'PASS'
    end,
    coalesce(to_char(latest_run_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS "UTC"'), 'No run recorded')
      || ' · failed in 24h: ' || failed_runs_24h,
    'A healthy 15-minute job normally ran within the last 20 minutes.'
  from cron_health

  union all
  select
    30,
    'Due queue age',
    case when oldest_due_minutes <= 20 then 'PASS' else 'ATTENTION' end,
    due_now || ' due · oldest ' || oldest_due_minutes || ' minute(s)',
    'Investigate when the oldest due pending/retry job exceeds 20 minutes.'
  from outbox_health

  union all
  select
    40,
    'Retry and failed jobs',
    case when retry_now = 0 and failed_24h = 0 then 'PASS' else 'ATTENTION' end,
    retry_now || ' retry now · ' || failed_24h || ' failed in 24h',
    'Retries may be temporary; failed rows require investigation.'
  from outbox_health

  union all
  select
    50,
    'Expired processing claims',
    case when stale_processing = 0 then 'PASS' else 'ATTENTION' end,
    stale_processing || ' older than 15 minutes',
    'The next dispatcher run should release an abandoned claim.'
  from outbox_health

  union all
  select
    60,
    'Duplicate prevention',
    case when duplicate_keys = 0 then 'PASS' else 'ATTENTION' end,
    duplicate_keys || ' duplicate idempotency key(s)',
    'Expected value: 0.'
  from duplicate_health

  union all
  select
    70,
    'Delivery summary (24h)',
    'INFO',
    sent_24h || ' sent · ' || cancelled_24h || ' cancelled',
    'Cancelled jobs include payments made inactive/paid and users with no active device.'
  from outbox_health

  union all
  select
    80,
    'Subscription health',
    case when active_devices_with_failures = 0 then 'PASS' else 'ATTENTION' end,
    active_devices || ' active · ' || active_devices_with_failures
      || ' active with failures · ' || disabled_devices_24h || ' disabled in 24h',
    'Permanent push-service 404/410 responses disable stale devices automatically.'
  from subscription_health

  union all
  select
    90,
    'Notification adoption',
    'INFO',
    users_with_active_device || ' of ' || active_workspace_users || ' active workspace user(s) · '
      || coalesce(
        round(100.0 * users_with_active_device / nullif(active_workspace_users, 0), 1)::text || '%',
        'not available'
      ),
    'Aggregate only; no user identity or endpoint is returned.'
  from subscription_health cross join audience
)
select check_name, health, value, guidance
from checks
order by display_order;
