-- Tracked support tickets for workspace customers and authorized platform staff.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete restrict,
  workspace_id uuid references public.budget_workspaces(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  assigned_admin_id uuid references auth.users(id) on delete set null,
  subject text not null check (char_length(btrim(subject)) between 3 and 140),
  description text not null check (char_length(btrim(description)) between 3 and 4000),
  category text not null default 'other' check (category in (
    'account_access', 'subscription_payment', 'notifications', 'technical', 'other'
  )),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_customer_idx
on public.support_tickets(customer_id, updated_at desc);

create index if not exists support_tickets_workspace_idx
on public.support_tickets(workspace_id, updated_at desc);

create index if not exists support_tickets_queue_idx
on public.support_tickets(status, priority, updated_at desc);

create index if not exists support_ticket_messages_ticket_idx
on public.support_ticket_messages(ticket_id, created_at);

create or replace function public.touch_support_ticket_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  new.resolved_at = case
    when new.status in ('resolved', 'closed') then coalesce(old.resolved_at, now())
    else null
  end;
  return new;
end;
$$;

drop trigger if exists support_tickets_touch_updated_at on public.support_tickets;
create trigger support_tickets_touch_updated_at
before update on public.support_tickets
for each row execute function public.touch_support_ticket_updated_at();

create or replace function public.touch_support_ticket_from_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.support_tickets
  set
    updated_at = now(),
    status = case when customer_id = new.author_id and status = 'waiting_customer' then 'open' else status end
  where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists support_ticket_messages_touch_ticket on public.support_ticket_messages;
create trigger support_ticket_messages_touch_ticket
after insert on public.support_ticket_messages
for each row execute function public.touch_support_ticket_from_message();

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

drop policy if exists "Customers and support staff can read tickets" on public.support_tickets;
create policy "Customers and support staff can read tickets"
on public.support_tickets for select to authenticated
using (
  customer_id = (select auth.uid())
  or public.is_platform_staff(array['super_admin', 'admin_staff', 'support_staff'])
);

drop policy if exists "Customers and support staff can create tickets" on public.support_tickets;
create policy "Customers and support staff can create tickets"
on public.support_tickets for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (
      customer_id = (select auth.uid())
      and (workspace_id is null or public.is_workspace_member(workspace_id))
      and assigned_admin_id is null
      and status = 'open'
      and resolved_at is null
    )
    or public.is_platform_staff(array['super_admin', 'admin_staff', 'support_staff'])
  )
);

drop policy if exists "Support staff can update tickets" on public.support_tickets;
create policy "Support staff can update tickets"
on public.support_tickets for update to authenticated
using (public.is_platform_staff(array['super_admin', 'admin_staff', 'support_staff']))
with check (public.is_platform_staff(array['super_admin', 'admin_staff', 'support_staff']));

drop policy if exists "Administrators can delete tickets" on public.support_tickets;
create policy "Administrators can delete tickets"
on public.support_tickets for delete to authenticated
using (public.is_platform_staff(array['super_admin', 'admin_staff']));

drop policy if exists "Customers and support staff can read ticket messages" on public.support_ticket_messages;
create policy "Customers and support staff can read ticket messages"
on public.support_ticket_messages for select to authenticated
using (
  public.is_platform_staff(array['super_admin', 'admin_staff', 'support_staff'])
  or (
    not is_internal
    and exists (
      select 1 from public.support_tickets
      where support_tickets.id = support_ticket_messages.ticket_id
        and support_tickets.customer_id = (select auth.uid())
    )
  )
);

drop policy if exists "Customers and support staff can add ticket messages" on public.support_ticket_messages;
create policy "Customers and support staff can add ticket messages"
on public.support_ticket_messages for insert to authenticated
with check (
  author_id = (select auth.uid())
  and (
    public.is_platform_staff(array['super_admin', 'admin_staff', 'support_staff'])
    or (
      not is_internal
      and exists (
        select 1 from public.support_tickets
        where support_tickets.id = support_ticket_messages.ticket_id
          and support_tickets.customer_id = (select auth.uid())
          and support_tickets.status not in ('closed')
      )
    )
  )
);

grant select, insert on public.support_tickets to authenticated;
grant update, delete on public.support_tickets to authenticated;
grant select, insert on public.support_ticket_messages to authenticated;

revoke all on function public.touch_support_ticket_updated_at() from public, anon, authenticated;
revoke all on function public.touch_support_ticket_from_message() from public, anon, authenticated;
