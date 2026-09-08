-- Stage 11 rollback. Run only when intentionally removing the scheduled
-- reminder queue before Stage 12 Cron/dispatcher is enabled.
-- Existing in-app notifications are retained.

drop function if exists public.record_notification_outbox_result(uuid, boolean, boolean, text, timestamptz);
drop function if exists public.claim_notification_outbox(integer, timestamptz);
drop function if exists public.enqueue_due_payment_reminders(timestamptz);
drop function if exists public.touch_notification_outbox_updated_at();
drop table if exists public.notification_outbox;

alter table public.workspace_settings
  drop column if exists reminder_delivery_time;
