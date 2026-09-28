-- Preserve the existing workspace-aware Family reminder target while allowing
-- the new Business bill reminder deep link introduced in Stage 6.
begin;

alter table public.notification_outbox
  drop constraint if exists notification_outbox_target_url_check;

alter table public.notification_outbox
  add constraint notification_outbox_target_url_check
  check (char_length(target_url) between 1 and 500 and (
    target_url ~ '^/app[.]html[?]source=push&workspace=[0-9a-fA-F-]{36}&payment_item=[0-9a-fA-F-]{36}#family/payments$'
    or target_url ~ '^/business[.]html[?]source=push&workspace=[0-9a-fA-F-]{36}&bill=[0-9a-fA-F-]{36}#business/bills$'
  ));

notify pgrst, 'reload schema';
commit;
