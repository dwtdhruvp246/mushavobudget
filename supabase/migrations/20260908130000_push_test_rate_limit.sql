-- Stage 9: durable per-user rate limiting for authenticated test pushes.
-- This migration does not schedule or send notifications.

create table if not exists public.push_test_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_test_rate_limits enable row level security;
alter table public.push_test_rate_limits force row level security;

-- Browser clients never need direct access. Only the service-role Edge
-- Function may claim a test-send window through the function below.
revoke all on table public.push_test_rate_limits from anon, authenticated;

create or replace function public.claim_push_test_rate_limit(
  p_user_id uuid,
  p_cooldown_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_claimed boolean := false;
  v_cooldown integer := greatest(30, least(coalesce(p_cooldown_seconds, 60), 3600));
begin
  if p_user_id is null then
    return false;
  end if;

  insert into public.push_test_rate_limits as limits (
    user_id,
    last_requested_at,
    updated_at
  )
  values (
    p_user_id,
    now(),
    now()
  )
  on conflict (user_id) do update
  set
    last_requested_at = excluded.last_requested_at,
    updated_at = excluded.updated_at
  where limits.last_requested_at <= now() - make_interval(secs => v_cooldown)
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

revoke all on function public.claim_push_test_rate_limit(uuid, integer)
from public, anon, authenticated;
grant execute on function public.claim_push_test_rate_limit(uuid, integer)
to service_role;
