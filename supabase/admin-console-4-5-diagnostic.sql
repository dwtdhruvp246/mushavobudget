-- Mushavo Budget 4.5 admin/support diagnostic.
-- Returns aggregate checks only; no ticket text, user identity, or internal note is selected.

select
  to_regclass('public.support_tickets') is not null as support_tickets_exists,
  to_regclass('public.support_ticket_messages') is not null as support_ticket_messages_exists,
  coalesce((select relrowsecurity from pg_class where oid = 'public.support_tickets'::regclass), false) as ticket_rls_enabled,
  coalesce((select relrowsecurity from pg_class where oid = 'public.support_ticket_messages'::regclass), false) as message_rls_enabled,
  (
    select count(*) >= 4
    from pg_policies
    where schemaname = 'public' and tablename = 'support_tickets'
  ) as ticket_policies_present,
  (
    select count(*) >= 2
    from pg_policies
    where schemaname = 'public' and tablename = 'support_ticket_messages'
  ) as message_policies_present,
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.support_tickets'::regclass
      and tgname = 'support_tickets_touch_updated_at'
      and not tgisinternal
  ) as ticket_timestamp_trigger_present,
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.support_ticket_messages'::regclass
      and tgname = 'support_ticket_messages_touch_ticket'
      and not tgisinternal
  ) as message_timeline_trigger_present;
