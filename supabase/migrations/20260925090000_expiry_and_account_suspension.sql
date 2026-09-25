begin;

-- Free plan choices are stored independently of payment status. A renewal
-- restores every schedule that the owner did not pause manually.
alter table public.payment_items add column if not exists keep_on_free boolean not null default false;

create or replace function public.personal_payment_plan_access(p_workspace_id uuid)
returns table (payment_item_id uuid, plan_paused boolean, selected_for_free boolean)
language sql stable security definer set search_path = public, pg_temp
as $$
  with budget as (
    select w.id, coalesce(l.limit_value, 5) as free_limit,
      (p.code = 'free' or s.status = 'expired'
       or (s.paid_through_at is not null and s.paid_through_at < now())) as free_mode
    from public.budget_workspaces w
    join public.workspace_subscriptions s on s.workspace_id = w.id
    join public.plans p on p.id = s.plan_id
    left join public.plans f on f.code = 'free'
    left join public.plan_limits l on l.plan_id = f.id and l.limit_code = 'active_planned_payments'
    where w.id = p_workspace_id and w.workspace_type = 'personal'
      and (public.is_workspace_member(w.id) or auth.role() = 'service_role')
  ), ranked as (
    select i.id, i.keep_on_free,
      row_number() over (order by i.keep_on_free desc, i.created_at, i.id) as place,
      b.free_limit, b.free_mode
    from public.payment_items i join budget b on b.id = i.workspace_id
    where i.status = 'active'
  )
  select id, free_mode and place > free_limit, keep_on_free from ranked;
$$;

create or replace function public.payment_plan_paused(p_payment_item_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce((select plan_paused from public.personal_payment_plan_access(
    (select workspace_id from public.payment_items where id = p_payment_item_id)
  ) where payment_item_id = p_payment_item_id), false);
$$;

create or replace function public.payment_reminder_allowed(p_payment_item_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce((select i.status = 'active' and w.status = 'active'
      and (s.status = 'active' or (w.workspace_type = 'personal' and s.status = 'expired'))
      and (w.workspace_type = 'personal' or s.paid_through_at is null or s.paid_through_at >= now())
      and not public.payment_plan_paused(i.id)
    from public.payment_items i
    join public.budget_workspaces w on w.id = i.workspace_id
    join public.workspace_subscriptions s on s.workspace_id = w.id
    where i.id = p_payment_item_id
      and (public.is_workspace_member(w.id) or auth.role() = 'service_role')), false);
$$;

create or replace function public.set_personal_free_payment_selection(p_workspace_id uuid, p_payment_ids uuid[])
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_limit integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.budget_workspaces
    where id = p_workspace_id and workspace_type = 'personal' and owner_id = auth.uid() and status = 'active'
  ) then raise exception 'WORKSPACE_OWNER_REQUIRED'; end if;
  select coalesce(l.limit_value, 5) into v_limit
  from public.plans p left join public.plan_limits l
    on l.plan_id = p.id and l.limit_code = 'active_planned_payments' where p.code = 'free';
  if cardinality(p_payment_ids) > v_limit
     or cardinality(p_payment_ids) <> (select count(distinct id) from unnest(p_payment_ids) as selected(id))
     or exists (select 1 from unnest(p_payment_ids) as selected(id)
       where not exists (select 1 from public.payment_items i
         where i.id = selected.id and i.workspace_id = p_workspace_id and i.status = 'active'))
  then raise exception 'INVALID_FREE_PAYMENT_SELECTION'; end if;
  update public.payment_items set keep_on_free = id = any(p_payment_ids)
  where workspace_id = p_workspace_id and status = 'active'
    and keep_on_free is distinct from (id = any(p_payment_ids));
end;
$$;

-- Suspensions are account-wide and are checked on every protected write.
alter table public.profiles add column if not exists account_status text not null default 'active'
  check (account_status in ('active', 'suspended'));

create or replace function public.guard_account_status_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if old.account_status is distinct from new.account_status
     and not public.is_platform_staff(array['super_admin', 'admin_staff'])
     and auth.role() <> 'service_role' then
    raise exception 'ADMIN_REQUIRED';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_account_status_change_trigger on public.profiles;
create trigger guard_account_status_change_trigger before update on public.profiles
for each row execute function public.guard_account_status_change();

create or replace function public.set_user_account_status(p_user_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_staff(array['super_admin', 'admin_staff']) then raise exception 'ADMIN_REQUIRED'; end if;
  if p_status not in ('active', 'suspended') or p_user_id = auth.uid()
     or exists (select 1 from public.app_admins where user_id = p_user_id)
  then raise exception 'INVALID_ACCOUNT_STATUS'; end if;
  update public.profiles set account_status = p_status where id = p_user_id;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
end;
$$;

create or replace function public.my_account_suspended()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce((select account_status = 'suspended' from public.profiles where id = auth.uid()), false);
$$;

-- An existing Auth token must not retain direct table access after suspension.
do $$
declare v_table text;
begin
  foreach v_table in array array[
    'profiles', 'families', 'family_members', 'family_invitations',
    'payment_items', 'payment_records', 'notifications', 'budget_workspaces',
    'workspace_members', 'workspace_invitations', 'workspace_settings', 'workspace_subscriptions',
    'subscription_renewal_requests', 'subscription_payments', 'support_tickets', 'support_ticket_messages'
  ] loop
    execute format('drop policy if exists "Account must be active" on public.%I', v_table);
    execute format('create policy "Account must be active" on public.%I as restrictive for all to authenticated using (not public.my_account_suspended()) with check (not public.my_account_suspended())', v_table);
  end loop;
end;
$$;

create or replace function public.guard_suspended_account_write()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' and public.my_account_suspended() then
    raise exception 'ACCOUNT_SUSPENDED';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Definer RPCs can bypass RLS, so the account check must also run on writes.
do $$
declare v_table text;
begin
  foreach v_table in array array[
    'profiles', 'families', 'family_members', 'family_invitations',
    'payment_items', 'payment_records', 'notifications', 'budget_workspaces',
    'workspace_members', 'workspace_invitations', 'workspace_settings', 'workspace_subscriptions',
    'subscription_renewal_requests', 'subscription_payments', 'support_tickets', 'support_ticket_messages'
  ] loop
    execute format('drop trigger if exists guard_suspended_account_write_trigger on public.%I', v_table);
    execute format('create trigger guard_suspended_account_write_trigger before insert or update or delete on public.%I for each row execute function public.guard_suspended_account_write()', v_table);
  end loop;
end;
$$;

create or replace function public.guard_workspace_finance_write()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_workspace_id uuid; v_entitlement record; v_item_id uuid;
begin
  if public.my_account_suspended() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  v_workspace_id := case when tg_op = 'DELETE' then old.workspace_id else new.workspace_id end;
  if tg_table_name = 'payment_records' then
    v_item_id := case when tg_op = 'DELETE' then old.payment_item_id else new.payment_item_id end;
    select workspace_id into v_workspace_id from public.payment_items where id = v_item_id;
    if v_workspace_id is null and tg_op = 'DELETE' then v_workspace_id := old.workspace_id; end if;
  elsif tg_op <> 'INSERT' then
    v_item_id := old.id;
  end if;
  select * into v_entitlement from public.effective_workspace_entitlement(v_workspace_id);
  if v_entitlement.workspace_id is null then raise exception 'WORKSPACE_ACCESS_REQUIRED'; end if;
  if v_entitlement.read_only or v_entitlement.effective_status = 'suspended' then
    raise exception 'WORKSPACE_READ_ONLY';
  end if;
  if v_item_id is not null and public.payment_plan_paused(v_item_id) then
    if tg_table_name = 'payment_records'
       and not (tg_op = 'DELETE' and pg_trigger_depth() > 1)
    then raise exception 'PAYMENT_PAUSED_BY_PLAN'; end if;
    if tg_op = 'UPDATE' and (to_jsonb(new) - 'keep_on_free') is distinct from (to_jsonb(old) - 'keep_on_free')
    then raise exception 'PAYMENT_PAUSED_BY_PLAN'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Keep the existing limit trigger's protection for inserts and reactivation.
revoke all on function public.personal_payment_plan_access(uuid) from public, anon, authenticated;
revoke all on function public.payment_plan_paused(uuid) from public, anon, authenticated;
revoke all on function public.payment_reminder_allowed(uuid) from public, anon, authenticated;
revoke all on function public.set_personal_free_payment_selection(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.set_user_account_status(uuid, text) from public, anon, authenticated;
revoke all on function public.my_account_suspended() from public, anon, authenticated;
grant execute on function public.personal_payment_plan_access(uuid) to authenticated, service_role;
grant execute on function public.payment_plan_paused(uuid) to authenticated, service_role;
grant execute on function public.payment_reminder_allowed(uuid) to authenticated, service_role;
grant execute on function public.set_personal_free_payment_selection(uuid, uuid[]) to authenticated;
grant execute on function public.set_user_account_status(uuid, text) to authenticated;
grant execute on function public.my_account_suspended() to authenticated;

-- Override the enqueue query so paused and expired workspace payments never enter the outbox.
create or replace function public.enqueue_due_payment_reminders(
  p_reference_time timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate record;
  v_outbox_id uuid;
  v_enqueued integer := 0;
begin
  for v_candidate in
    with eligible_items as (
      select
        items.id,
        items.workspace_id,
        items.family_id,
        items.owner_id,
        items.visibility,
        items.responsible_member_id,
        items.name,
        items.amount,
        items.currency,
        items.recurrence_type,
        greatest(items.recurrence_interval, 1) as recurrence_interval,
        items.due_day,
        items.start_date,
        items.end_date,
        items.reminder_days_before,
        workspaces.owner_id as workspace_owner_id,
        settings.timezone as workspace_timezone,
        settings.reminder_delivery_time,
        settings.detailed_notification_previews,
        case
          when items.visibility = 'personal' then items.owner_id
          when items.responsible_member_id is null then workspaces.owner_id
          else responsible_members.user_id
        end as recipient_id
      from public.payment_items as items
      join public.budget_workspaces as workspaces
        on workspaces.id = items.workspace_id
       and workspaces.status = 'active'
      join public.workspace_settings as settings
        on settings.workspace_id = items.workspace_id
       and settings.reminder_enabled
      left join public.family_members as responsible_members
        on responsible_members.id = items.responsible_member_id
       and responsible_members.family_id = items.family_id
       and responsible_members.status = 'active'
      where items.status = 'active'
        and public.payment_reminder_allowed(items.id)
    ),
    timezone_items as (
      select
        eligible_items.*,
        coalesce(user_timezones.name, workspace_timezones.name, 'UTC') as delivery_timezone
      from eligible_items
      left join public.profiles as recipient_profiles
        on recipient_profiles.id = eligible_items.recipient_id
      left join pg_catalog.pg_timezone_names as user_timezones
        on user_timezones.name = recipient_profiles.timezone
      left join pg_catalog.pg_timezone_names as workspace_timezones
        on workspace_timezones.name = eligible_items.workspace_timezone
      where eligible_items.recipient_id is not null
        and recipient_profiles.account_status = 'active'
        and exists (
          select 1
          from public.workspace_members
          where workspace_members.workspace_id = eligible_items.workspace_id
            and workspace_members.user_id = eligible_items.recipient_id
            and workspace_members.status = 'active'
        )
    ),
    recipient_items as (
      select
        timezone_items.*,
        timezone(timezone_items.delivery_timezone, p_reference_time)::date as local_date
      from timezone_items
    ),
    possible_due_dates as (
      select
        recipient_items.*,
        due_days.due_date::date,
        case
          when recipient_items.recurrence_type = 'custom_days'
            then due_days.due_date::date
          else date_trunc('month', due_days.due_date)::date
        end as period_start,
        (due_days.due_date::date - recipient_items.local_date) as days_until_due
      from recipient_items
      cross join lateral generate_series(
        recipient_items.local_date,
        recipient_items.local_date + recipient_items.reminder_days_before,
        interval '1 day'
      ) as due_days(due_date)
      where due_days.due_date::date >= recipient_items.start_date
        and (recipient_items.end_date is null or due_days.due_date::date <= recipient_items.end_date)
        and (
          (
            recipient_items.recurrence_type = 'custom_days'
            and mod(
              due_days.due_date::date - recipient_items.start_date,
              recipient_items.recurrence_interval
            ) = 0
          )
          or
          (
            recipient_items.recurrence_type <> 'custom_days'
            and due_days.due_date::date = (
              date_trunc('month', due_days.due_date)::date
              + least(
                  recipient_items.due_day,
                  extract(day from (
                    date_trunc('month', due_days.due_date)
                    + interval '1 month - 1 day'
                  ))::integer
                ) - 1
            )
            and (
              extract(year from due_days.due_date)::integer * 12
              + extract(month from due_days.due_date)::integer
              - extract(year from recipient_items.start_date)::integer * 12
              - extract(month from recipient_items.start_date)::integer
            ) >= 0
            and mod(
              extract(year from due_days.due_date)::integer * 12
              + extract(month from due_days.due_date)::integer
              - extract(year from recipient_items.start_date)::integer * 12
              - extract(month from recipient_items.start_date)::integer,
              case recipient_items.recurrence_type
                when 'once' then 2147483647
                when 'monthly' then 1
                when 'quarterly' then 3
                when 'yearly' then 12
                when 'custom' then recipient_items.recurrence_interval
              end
            ) = 0
            and (
              recipient_items.recurrence_type <> 'once'
              or date_trunc('month', due_days.due_date)::date =
                 date_trunc('month', recipient_items.start_date)::date
            )
          )
        )
    ),
    unpaid_occurrences as (
      select possible_due_dates.*
      from possible_due_dates
      where coalesce((
        select sum(records.amount)
        from public.payment_records as records
        where records.payment_item_id = possible_due_dates.id
          and records.period_start = possible_due_dates.period_start
      ), 0) < possible_due_dates.amount
    )
    select
      unpaid_occurrences.*,
      make_timestamptz(
        extract(year from unpaid_occurrences.local_date)::integer,
        extract(month from unpaid_occurrences.local_date)::integer,
        extract(day from unpaid_occurrences.local_date)::integer,
        extract(hour from unpaid_occurrences.reminder_delivery_time)::integer,
        extract(minute from unpaid_occurrences.reminder_delivery_time)::integer,
        extract(second from unpaid_occurrences.reminder_delivery_time)::double precision,
        unpaid_occurrences.delivery_timezone
      ) as delivery_at,
      case unpaid_occurrences.days_until_due
        when 0 then 'payment_due_today'
        when 1 then 'payment_due_tomorrow'
        else 'payment_due_soon'
      end as reminder_type,
      case
        when unpaid_occurrences.detailed_notification_previews then 'Payment reminder'
        else 'Mushavo Budget'
      end as reminder_title,
      case
        when not unpaid_occurrences.detailed_notification_previews
          then case unpaid_occurrences.days_until_due
            when 0 then 'You have a payment due today.'
            when 1 then 'You have a payment due tomorrow.'
            else 'You have a payment due soon.'
          end
        else left(
          unpaid_occurrences.name || ' - ' || unpaid_occurrences.currency || ' '
          || trim(to_char(unpaid_occurrences.amount, 'FM999999999999990.00')) || ' is due '
          || case unpaid_occurrences.days_until_due
            when 0 then 'today.'
            when 1 then 'tomorrow.'
            else 'in ' || unpaid_occurrences.days_until_due || ' days.'
          end,
          240
        )
      end as reminder_body,
      '/app.html?source=push&payment_item=' || unpaid_occurrences.id || '#family/payments'
        as payment_target_url,
      'payment:' || unpaid_occurrences.id
        || ':due-date:' || unpaid_occurrences.due_date
        || ':reminder-date:' || unpaid_occurrences.local_date
        as reminder_idempotency_key
    from unpaid_occurrences
    order by delivery_at, id
  loop
    v_outbox_id := null;

    insert into public.notification_outbox (
      user_id,
      workspace_id,
      source_type,
      source_id,
      notification_type,
      scheduled_for,
      title,
      body,
      target_url,
      idempotency_key,
      status,
      attempt_count,
      next_attempt_at
    ) values (
      v_candidate.recipient_id,
      v_candidate.workspace_id,
      'payment',
      v_candidate.id,
      v_candidate.reminder_type,
      v_candidate.delivery_at,
      v_candidate.reminder_title,
      v_candidate.reminder_body,
      v_candidate.payment_target_url,
      v_candidate.reminder_idempotency_key,
      'pending',
      0,
      v_candidate.delivery_at
    )
    on conflict (idempotency_key) do nothing
    returning id into v_outbox_id;

    if v_outbox_id is not null then
      insert into public.notifications (
        user_id,
        created_by,
        family_id,
        type,
        title,
        body,
        url
      ) values (
        v_candidate.recipient_id,
        null,
        v_candidate.family_id,
        v_candidate.reminder_type,
        v_candidate.reminder_title,
        v_candidate.reminder_body,
        v_candidate.payment_target_url
      );
      v_enqueued := v_enqueued + 1;
    end if;
  end loop;

  return v_enqueued;
end;
$$;

commit;
