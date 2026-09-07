-- Stage 7 rollback. This deliberately refuses to remove stored subscriptions.
-- Run only when abandoning Stage 7 before Stage 8 has stored device data.

do $$
declare
  v_has_rows boolean := false;
begin
  if to_regclass('public.push_subscriptions') is not null then
    execute 'select exists (select 1 from public.push_subscriptions)'
      into v_has_rows;

    if v_has_rows then
      raise exception
        'ROLLBACK_STOPPED: public.push_subscriptions contains rows. Back up or intentionally remove them first.';
    end if;
  end if;
end;
$$;

drop table if exists public.push_subscriptions;
drop function if exists public.touch_push_subscription_updated_at();
