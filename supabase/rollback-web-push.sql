-- Mushavo Budget Web Push rollback
-- Run this once in the Supabase SQL Editor if the Web Push migration was
-- previously applied. It preserves the existing in-app notification inbox.

do $$
declare
  reminder_job_id bigint;
begin
  if to_regclass('cron.job') is not null then
    execute $query$
      select jobid
      from cron.job
      where jobname = 'mushavo-push-reminders-every-minute'
      limit 1
    $query$ into reminder_job_id;

    if reminder_job_id is not null then
      perform cron.unschedule(reminder_job_id);
    end if;
  end if;
end;
$$;

drop function if exists public.claim_push_notification_outbox(integer);
drop function if exists public.enqueue_due_payment_reminders(timestamptz);
drop function if exists public.save_push_subscription(text, text, text, jsonb, text);

drop table if exists public.push_delivery_attempts cascade;
drop table if exists public.notification_outbox cascade;
drop table if exists public.notification_dispatch_runs cascade;
drop table if exists public.push_subscriptions cascade;

drop index if exists public.notifications_notification_key_unique_idx;

alter table if exists public.notifications
  drop column if exists notification_key,
  drop column if exists payment_item_id,
  drop column if exists url,
  drop column if exists data;

alter table if exists public.profiles
  drop column if exists timezone,
  drop column if exists reminder_time_local,
  drop column if exists reminder_notifications_enabled,
  drop column if exists detailed_notification_previews,
  drop column if exists notification_preferences_updated_at;

do $$
begin
  if to_regclass('vault.secrets') is not null then
    execute $query$
      delete from vault.secrets
      where name in ('mushavo_project_url', 'mushavo_cron_secret')
    $query$;
  end if;
end;
$$;
