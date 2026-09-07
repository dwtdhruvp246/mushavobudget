begin;

alter table public.payment_items
  drop constraint if exists payment_items_recurrence_type_check,
  add constraint payment_items_recurrence_type_check check (
    recurrence_type in ('once', 'monthly', 'quarterly', 'yearly', 'custom', 'custom_days')
  ),
  drop constraint if exists payment_items_recurrence_interval_check,
  add constraint payment_items_recurrence_interval_check check (
    recurrence_interval between 1 and 3650
  );

commit;
