-- Stage 7: protected per-user, per-device Web Push subscriptions.
-- This migration stores subscriptions only. It does not request browser
-- permission, deploy an Edge Function, create a Cron job, or send a push.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  device_label text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count integer not null default 0,
  disabled_at timestamptz,
  constraint push_subscriptions_endpoint_length_check
    check (char_length(endpoint) between 20 and 4096),
  constraint push_subscriptions_p256dh_length_check
    check (char_length(p256dh) between 16 and 1024),
  constraint push_subscriptions_auth_length_check
    check (char_length(auth) between 8 and 256),
  constraint push_subscriptions_device_label_length_check
    check (device_label is null or char_length(device_label) between 1 and 100),
  constraint push_subscriptions_user_agent_length_check
    check (user_agent is null or char_length(user_agent) between 1 and 1024),
  constraint push_subscriptions_failure_count_check
    check (failure_count >= 0)
);

create unique index if not exists push_subscriptions_endpoint_unique_idx
on public.push_subscriptions (endpoint);

create index if not exists push_subscriptions_user_active_idx
on public.push_subscriptions (user_id, updated_at desc)
where disabled_at is null;

create or replace function public.touch_push_subscription_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_push_subscription_updated_at_trigger
on public.push_subscriptions;

create trigger touch_push_subscription_updated_at_trigger
before update on public.push_subscriptions
for each row execute function public.touch_push_subscription_updated_at();

alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;

drop policy if exists "Users can read own push subscriptions"
on public.push_subscriptions;
create policy "Users can read own push subscriptions"
on public.push_subscriptions
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can insert own push subscriptions"
on public.push_subscriptions;
create policy "Users can insert own push subscriptions"
on public.push_subscriptions
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and last_success_at is null
  and failure_count = 0
  and disabled_at is null
);

drop policy if exists "Users can update own push subscriptions"
on public.push_subscriptions;
create policy "Users can update own push subscriptions"
on public.push_subscriptions
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete own push subscriptions"
on public.push_subscriptions;
create policy "Users can delete own push subscriptions"
on public.push_subscriptions
for delete
to authenticated
using (user_id = (select auth.uid()));

-- Anonymous visitors receive no privileges. Signed-in browser clients receive
-- only the operations/columns required by the Stage 8 device opt-in flow.
-- Delivery-health columns remain writable only by trusted server-side roles.
revoke all on table public.push_subscriptions from anon, authenticated;
grant select, delete on table public.push_subscriptions to authenticated;
grant insert (user_id, endpoint, p256dh, auth, device_label, user_agent)
on table public.push_subscriptions to authenticated;
grant update (p256dh, auth, device_label, user_agent)
on table public.push_subscriptions to authenticated;

revoke all on function public.touch_push_subscription_updated_at() from public;
