-- Keep the named payer inside the payment's own Family workspace.
-- Existing payment history is unchanged; only new writes are checked.
create or replace function public.guard_payment_record_payer()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.visibility = 'family' and new.paid_by_member_id is not null
    and not exists (
      select 1
      from public.family_members as members
      where members.id = new.paid_by_member_id
        and members.family_id = new.family_id
        and members.status = 'active'
    ) then
    raise exception 'PAID_BY_MEMBER_NOT_IN_FAMILY';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_payment_record_payer() from public, anon, authenticated;

drop trigger if exists guard_payment_record_payer_trigger on public.payment_records;
create trigger guard_payment_record_payer_trigger
before insert or update of family_id, paid_by_member_id on public.payment_records
for each row execute function public.guard_payment_record_payer();

-- Existing installations may not have these tables in the Realtime publication.
-- The recipient's open app needs the notification INSERT to refresh immediately.
do $$
declare
  realtime_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables) then
    return;
  end if;
  foreach realtime_table in array array['notifications', 'family_invitations'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = realtime_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', realtime_table);
    end if;
  end loop;
end $$;
