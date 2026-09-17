-- Admin Operations 4.6: private in-app and Web Push alerts for platform staff.
-- CurrencyAPI behavior is intentionally unchanged by this migration.

begin;

create table if not exists public.admin_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in (
    'subscription_payment_submitted', 'support_ticket_created', 'public_enquiry_created'
  )),
  source_id uuid not null,
  notification_type text not null check (notification_type ~ '^[a-z][a-z0-9_]{0,63}$'),
  scheduled_for timestamptz not null default now(),
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 240),
  target_url text not null check (
    target_url ~ '^/app[.]html[?]source=push&notification_id=[0-9a-fA-F-]{36}#admin/(finance|support|enquiries)$'
  ),
  idempotency_key text not null unique check (char_length(idempotency_key) between 1 and 300),
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'sent', 'retry', 'failed', 'cancelled')
  ),
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_notification_outbox_processing_claim_check
    check (status <> 'processing' or claimed_at is not null),
  constraint admin_notification_outbox_sent_timestamp_check
    check (status <> 'sent' or sent_at is not null)
);

create index if not exists admin_notification_outbox_claim_idx
on public.admin_notification_outbox(status, next_attempt_at, scheduled_for, created_at)
where status in ('pending', 'retry');

create index if not exists admin_notification_outbox_recipient_idx
on public.admin_notification_outbox(user_id, created_at desc);

create index if not exists admin_notification_outbox_source_idx
on public.admin_notification_outbox(source_type, source_id, created_at desc);

create or replace function public.touch_admin_notification_outbox_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists admin_notification_outbox_touch_updated_at
on public.admin_notification_outbox;
create trigger admin_notification_outbox_touch_updated_at
before update on public.admin_notification_outbox
for each row execute function public.touch_admin_notification_outbox_updated_at();

alter table public.admin_notification_outbox enable row level security;
alter table public.admin_notification_outbox force row level security;
revoke all on table public.admin_notification_outbox from public, anon, authenticated;
grant select, insert, update, delete on table public.admin_notification_outbox to service_role;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1 from pg_publication
    where pubname = 'supabase_realtime' and puballtables
  ) and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

create or replace function public.enqueue_admin_event_notification(
  p_event_type text,
  p_source_id uuid,
  p_actor_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin record;
  v_notification_id uuid;
  v_outbox_id uuid;
  v_title text;
  v_body text;
  v_target_tab text;
  v_roles text[];
  v_idempotency_key text;
  v_enqueued integer := 0;
begin
  if p_event_type = 'subscription_payment_submitted' then
    v_title := 'Subscription payment needs review';
    v_body := 'A workspace owner submitted a subscription payment for review.';
    v_target_tab := 'finance';
    v_roles := array['super_admin', 'admin_staff', 'finance_staff'];
  elsif p_event_type = 'support_ticket_created' then
    v_title := 'New support ticket';
    v_body := 'A customer submitted a new support request.';
    v_target_tab := 'support';
    v_roles := array['super_admin', 'admin_staff', 'support_staff'];
  elsif p_event_type = 'public_enquiry_created' then
    v_title := 'New public enquiry';
    v_body := 'A new enquiry was submitted from the Mushavo Budget website.';
    v_target_tab := 'enquiries';
    v_roles := array['super_admin', 'admin_staff', 'support_staff'];
  else
    raise exception 'UNSUPPORTED_ADMIN_NOTIFICATION_EVENT';
  end if;

  for v_admin in
    select admins.user_id
    from public.app_admins as admins
    where admins.role = any(v_roles)
      and (p_actor_id is null or admins.user_id <> p_actor_id)
    order by admins.user_id
  loop
    v_idempotency_key := format('admin:%s:%s:%s', p_event_type, p_source_id, v_admin.user_id);
    v_outbox_id := null;
    if exists (
      select 1 from public.admin_notification_outbox
      where idempotency_key = v_idempotency_key
    ) then
      continue;
    end if;

    v_notification_id := gen_random_uuid();
    insert into public.notifications (
      id, user_id, created_by, type, title, body, url
    ) values (
      v_notification_id,
      v_admin.user_id,
      null,
      p_event_type,
      v_title,
      v_body,
      format('/app.html?notification_id=%s#admin/%s', v_notification_id, v_target_tab)
    );

    insert into public.admin_notification_outbox (
      notification_id, user_id, source_type, source_id, notification_type,
      title, body, target_url, idempotency_key
    ) values (
      v_notification_id,
      v_admin.user_id,
      p_event_type,
      p_source_id,
      p_event_type,
      v_title,
      v_body,
      format('/app.html?source=push&notification_id=%s#admin/%s', v_notification_id, v_target_tab),
      v_idempotency_key
    )
    on conflict (idempotency_key) do nothing
    returning id into v_outbox_id;

    if v_outbox_id is null then
      delete from public.notifications where id = v_notification_id;
    else
      v_enqueued := v_enqueued + 1;
    end if;
  end loop;

  return v_enqueued;
end;
$$;

create or replace function public.notify_admins_on_subscription_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'pending_review' then
    perform public.enqueue_admin_event_notification(
      'subscription_payment_submitted', new.id, new.submitted_by
    );
  end if;
  return new;
end;
$$;

drop trigger if exists subscription_payments_notify_admins
on public.subscription_payments;
create trigger subscription_payments_notify_admins
after insert on public.subscription_payments
for each row execute function public.notify_admins_on_subscription_payment();

create or replace function public.notify_admins_on_support_ticket()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'open' and new.customer_id = new.created_by then
    perform public.enqueue_admin_event_notification(
      'support_ticket_created', new.id, new.created_by
    );
  end if;
  return new;
end;
$$;

drop trigger if exists support_tickets_notify_admins
on public.support_tickets;
create trigger support_tickets_notify_admins
after insert on public.support_tickets
for each row execute function public.notify_admins_on_support_ticket();

create or replace function public.notify_admins_on_public_enquiry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'new' and new.source = 'website' then
    perform public.enqueue_admin_event_notification(
      'public_enquiry_created', new.id, null
    );
  end if;
  return new;
end;
$$;

drop trigger if exists enquiries_notify_admins
on public.enquiries;
create trigger enquiries_notify_admins
after insert on public.enquiries
for each row execute function public.notify_admins_on_public_enquiry();

create or replace function public.claim_admin_notification_outbox(
  p_batch_size integer default 25,
  p_reference_time timestamptz default now()
)
returns setof public.admin_notification_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.admin_notification_outbox
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
    from public.admin_notification_outbox as outbox
    where outbox.status in ('pending', 'retry')
      and outbox.attempt_count < 3
      and outbox.scheduled_for <= p_reference_time
      and outbox.next_attempt_at <= p_reference_time
    order by outbox.scheduled_for, outbox.created_at, outbox.id
    for update skip locked
    limit greatest(1, least(coalesce(p_batch_size, 25), 100))
  )
  update public.admin_notification_outbox as outbox
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

create or replace function public.record_admin_notification_outbox_result(
  p_outbox_id uuid,
  p_succeeded boolean,
  p_permanent_failure boolean default false,
  p_error text default null,
  p_reference_time timestamptz default now()
)
returns public.admin_notification_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result public.admin_notification_outbox%rowtype;
begin
  update public.admin_notification_outbox as outbox
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

revoke all on function public.touch_admin_notification_outbox_updated_at()
from public, anon, authenticated;
revoke all on function public.enqueue_admin_event_notification(text, uuid, uuid)
from public, anon, authenticated;
revoke all on function public.notify_admins_on_subscription_payment()
from public, anon, authenticated;
revoke all on function public.notify_admins_on_support_ticket()
from public, anon, authenticated;
revoke all on function public.notify_admins_on_public_enquiry()
from public, anon, authenticated;
revoke all on function public.claim_admin_notification_outbox(integer, timestamptz)
from public, anon, authenticated;
revoke all on function public.record_admin_notification_outbox_result(uuid, boolean, boolean, text, timestamptz)
from public, anon, authenticated;

grant execute on function public.claim_admin_notification_outbox(integer, timestamptz)
to service_role;
grant execute on function public.record_admin_notification_outbox_result(uuid, boolean, boolean, text, timestamptz)
to service_role;

commit;
