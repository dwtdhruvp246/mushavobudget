begin;

-- The Every N days form option was released after some production databases
-- had already applied the original payment_items constraint. Reassert the
-- current accepted values so those databases can save custom day schedules.
alter table public.payment_items
  drop constraint if exists payment_items_recurrence_type_check,
  add constraint payment_items_recurrence_type_check check (
    recurrence_type in ('once', 'monthly', 'quarterly', 'yearly', 'custom', 'custom_days')
  ),
  drop constraint if exists payment_items_recurrence_interval_check,
  add constraint payment_items_recurrence_interval_check check (
    recurrence_interval between 1 and 3650
  );

comment on constraint payment_items_recurrence_type_check on public.payment_items is
  'Accepted payment schedules, including custom day intervals.';

comment on constraint payment_items_recurrence_interval_check on public.payment_items is
  'Repeat interval from 1 through 3650; the app limits month intervals to 120.';

commit;
