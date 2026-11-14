-- Exact canonical definitions from supabase/schema.sql, blob a4bc3ef765a937d94b6b908bb19cdf94d42d939f.
-- Auth claim helpers and application tables are separately modeled in the local check.
create or replace function public.my_account_suspended()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce((select account_status = 'suspended' from public.profiles where id = auth.uid()), false);
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

create trigger guard_suspended_account_write_trigger
before insert or update or delete on public.profiles
for each row execute function public.guard_suspended_account_write();
