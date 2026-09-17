-- Admin Operations 4.6 diagnostic. No secret values or user identities are selected.

select
  to_regclass('public.admin_notification_outbox') is not null as outbox_exists,
  coalesce((
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.admin_notification_outbox'::regclass
  ), false) as outbox_rls_forced,
  not has_table_privilege('authenticated', 'public.admin_notification_outbox', 'SELECT')
    and not has_table_privilege('authenticated', 'public.admin_notification_outbox', 'INSERT')
    and not has_table_privilege('authenticated', 'public.admin_notification_outbox', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.admin_notification_outbox', 'DELETE')
    as browser_queue_access_blocked,
  has_table_privilege('service_role', 'public.admin_notification_outbox', 'SELECT')
    and has_table_privilege('service_role', 'public.admin_notification_outbox', 'INSERT')
    and has_table_privilege('service_role', 'public.admin_notification_outbox', 'UPDATE')
    and has_table_privilege('service_role', 'public.admin_notification_outbox', 'DELETE')
    as service_queue_access_enabled,
  to_regprocedure('public.enqueue_admin_event_notification(text,uuid,uuid)') is not null
    as enqueue_function_exists,
  to_regprocedure('public.claim_admin_notification_outbox(integer,timestamp with time zone)') is not null
    as claim_function_exists,
  to_regprocedure('public.record_admin_notification_outbox_result(uuid,boolean,boolean,text,timestamp with time zone)') is not null
    as result_function_exists,
  (
    exists (
      select 1 from pg_publication
      where pubname = 'supabase_realtime' and puballtables
    ) or exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    )
  ) as notifications_realtime_enabled,
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.subscription_payments'::regclass
      and tgname = 'subscription_payments_notify_admins'
      and not tgisinternal
  ) as payment_trigger_exists,
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.support_tickets'::regclass
      and tgname = 'support_tickets_notify_admins'
      and not tgisinternal
  ) as support_trigger_exists,
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.enquiries'::regclass
      and tgname = 'enquiries_notify_admins'
      and not tgisinternal
  ) as enquiry_trigger_exists;

select
  count(*) filter (where status = 'pending') as pending,
  count(*) filter (where status = 'processing') as processing,
  count(*) filter (where status = 'retry') as retry,
  count(*) filter (where status = 'sent') as sent,
  count(*) filter (where status = 'failed') as failed,
  count(*) filter (where status = 'cancelled') as cancelled,
  count(*) - count(distinct idempotency_key) as duplicate_idempotency_keys
from public.admin_notification_outbox;

select
  exists (
    select 1 from cron.job
    where jobname = 'mushavo-budget-dispatch-admin-notifications'
      and schedule = '*/5 * * * *'
      and active
  ) as admin_notification_cron_active;
