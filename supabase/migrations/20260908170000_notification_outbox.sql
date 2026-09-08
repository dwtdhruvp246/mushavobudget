-- PWA Stage 11: idempotent payment-reminder outbox and atomic claiming.
-- This migration creates queue rows and in-app bell notifications. It does not
-- create Cron, invoke an Edge Function, or send an operating-system push.

alter table public.workspace_settings
  add column if not exists reminder_delivery_time time not null default time '09:00';

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.budget_workspaces(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  notification_type text not null,
  scheduled_for timestamptz not null,
  title text not null,
  body text not null,
  target_url text not null,
  idempotency_key text not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null,
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_outbox_source_type_check
    check (source_type ~ '^[a-z][a-z0-9_]{0,63}$'),
  constraint notification_outbox_notification_type_check
    check (notification_type ~ '^[a-z][a-z0-9_]{0,63}$'),
  constraint notification_outbox_title_length_check
    check (char_length(title) between 1 and 80),
  constraint notification_outbox_body_length_check
    check (char_length(body) between 1 and 240),
  constraint notification_outbox_target_url_check
    check (
      char_length(target_url) between 1 and 500
      and target_url ~ '^/app[.]html[?]source=push&payment_item=[0-9a-fA-F-]{36}#family/payments$'
    ),
  constraint notification_outbox_idempotency_key_length_check
    check (char_length(idempotency_key) between 1 and 300),
  constraint notification_outbox_status_check
    check (status in ('pending', 'processing', 'sent', 'retry', 'failed', 'cancelled')),
  constraint notification_outbox_attempt_count_check
    check (attempt_count between 0 and 3),
  constraint notification_outbox_last_error_length_check
    check (last_error is null or char_length(last_error) <= 500),
  constraint notification_outbox_processing_claim_check
    check (status <> 'processing' or claimed_at is not null),
  constraint notification_outbox_sent_timestamp_check
    check (status <> 'sent' or sent_at is not null)
);

create unique index if not exists notification_outbox_idempotency_key_unique_idx
on public.notification_outbox (idempotency_key);

create index if not exists notification_outbox_claim_idx
on public.notification_outbox (status, next_attempt_at, scheduled_for, created_at)
where status in ('pending', 'retry');

create index if not exists notification_outbox_user_created_idx
on public.notification_outbox (user_id, created_at desc);

create index if not exists notification_outbox_source_idx
on public.notification_outbox (source_type, source_id, created_at desc);

create or replace function public.touch_notification_outbox_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_notification_outbox_updated_at_trigger
on public.notification_outbox;

create trigger touch_notification_outbox_updated_at_trigger
before update on public.notification_outbox
for each row execute function public.touch_notification_outbox_updated_at();

alter table public.notification_outbox enable row level security;
alter table public.notification_outbox force row level security;

-- Browser clients never read or mutate the delivery queue. The bell copy is
-- available through the established notifications table and its existing RLS.
revoke all on table public.notification_outbox from anon, authenticated;
grant select, insert, update, delete on table public.notification_outbox to service_role;

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

create or replace function public.claim_notification_outbox(
  p_batch_size integer default 25,
  p_reference_time timestamptz default now()
)
returns setof public.notification_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Release abandoned claims after 15 minutes so a terminated dispatcher does
  -- not leave jobs permanently stuck. A third abandoned attempt fails closed.
  update public.notification_outbox
  set
    status = case when attempt_count >= 3 then 'failed' else 'retry' end,
    next_attempt_at = case when attempt_count >= 3 then next_attempt_at else p_reference_time end,
    claimed_at = case when attempt_count >= 3 then claimed_at else null end,
    last_error = 'Dispatcher claim expired before completion.'
  where status = 'processing'
    and claimed_at <= p_reference_time - interval '15 minutes';

  return query
  with candidates as (
    select outbox.id
    from public.notification_outbox as outbox
    where outbox.status in ('pending', 'retry')
      and outbox.attempt_count < 3
      and outbox.scheduled_for <= p_reference_time
      and outbox.next_attempt_at <= p_reference_time
    order by outbox.scheduled_for, outbox.created_at, outbox.id
    for update skip locked
    limit greatest(1, least(coalesce(p_batch_size, 25), 100))
  )
  update public.notification_outbox as outbox
  set
    status = 'processing',
    attempt_count = outbox.attempt_count + 1,
    claimed_at = p_reference_time,
    last_error = null
  from candidates
  where outbox.id = candidates.id
  returning outbox.*;
end;
$$;

create or replace function public.record_notification_outbox_result(
  p_outbox_id uuid,
  p_succeeded boolean,
  p_permanent_failure boolean default false,
  p_error text default null,
  p_reference_time timestamptz default now()
)
returns public.notification_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result public.notification_outbox%rowtype;
begin
  update public.notification_outbox as outbox
  set
    status = case
      when p_succeeded then 'sent'
      when p_permanent_failure or outbox.attempt_count >= 3 then 'failed'
      else 'retry'
    end,
    next_attempt_at = case
      when p_succeeded or p_permanent_failure or outbox.attempt_count >= 3 then outbox.next_attempt_at
      when outbox.attempt_count = 1 then p_reference_time + interval '5 minutes'
      else p_reference_time + interval '30 minutes'
    end,
    claimed_at = case
      when p_succeeded or p_permanent_failure or outbox.attempt_count >= 3 then outbox.claimed_at
      else null
    end,
    sent_at = case when p_succeeded then p_reference_time else null end,
    last_error = case
      when p_succeeded then null
      else left(regexp_replace(coalesce(nullif(btrim(p_error), ''), 'Push delivery failed.'), E'[\\r\\n\\t]+', ' ', 'g'), 500)
    end
  where outbox.id = p_outbox_id
    and outbox.status = 'processing'
  returning outbox.* into v_result;

  return v_result;
end;
$$;

revoke all on function public.touch_notification_outbox_updated_at()
from public, anon, authenticated;
revoke all on function public.enqueue_due_payment_reminders(timestamptz)
from public, anon, authenticated;
revoke all on function public.claim_notification_outbox(integer, timestamptz)
from public, anon, authenticated;
revoke all on function public.record_notification_outbox_result(uuid, boolean, boolean, text, timestamptz)
from public, anon, authenticated;

grant execute on function public.enqueue_due_payment_reminders(timestamptz)
to service_role;
grant execute on function public.claim_notification_outbox(integer, timestamptz)
to service_role;
grant execute on function public.record_notification_outbox_result(uuid, boolean, boolean, text, timestamptz)
to service_role;
