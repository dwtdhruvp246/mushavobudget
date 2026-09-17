-- Emergency rollback for Admin Operations 4.6 notifications.
-- Existing in-app notification rows are retained for audit history.

select cron.unschedule(jobid)
from cron.job
where jobname = 'mushavo-budget-dispatch-admin-notifications';

drop trigger if exists subscription_payments_notify_admins on public.subscription_payments;
drop trigger if exists support_tickets_notify_admins on public.support_tickets;
drop trigger if exists enquiries_notify_admins on public.enquiries;

drop function if exists public.notify_admins_on_subscription_payment();
drop function if exists public.notify_admins_on_support_ticket();
drop function if exists public.notify_admins_on_public_enquiry();
drop function if exists public.enqueue_admin_event_notification(text, uuid, uuid);
drop function if exists public.claim_admin_notification_outbox(integer, timestamptz);
drop function if exists public.record_admin_notification_outbox_result(uuid, boolean, boolean, text, timestamptz);
drop function if exists public.touch_admin_notification_outbox_updated_at();
drop table if exists public.admin_notification_outbox;
