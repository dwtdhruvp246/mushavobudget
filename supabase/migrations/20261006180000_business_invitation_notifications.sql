begin;

alter table public.notifications add column if not exists business_invitation_id uuid
  references public.workspace_invitations(id) on delete cascade;
create unique index if not exists notifications_business_invitation_unique
  on public.notifications(business_invitation_id) where business_invitation_id is not null;

-- Server-created invitation metadata is immutable to clients; Mark read remains available.
create or replace function public.guard_business_invitation_notification()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' and new.business_invitation_id is not null then
      raise exception 'BUSINESS_INVITATION_NOTIFICATION_SERVER_MANAGED';
    elsif tg_op = 'UPDATE' then
      if (old.business_invitation_id is not null or new.business_invitation_id is not null)
        and (to_jsonb(new) - 'read_at') is distinct from (to_jsonb(old) - 'read_at') then
        raise exception 'BUSINESS_INVITATION_NOTIFICATION_SERVER_MANAGED';
      end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_business_invitation_notification_trigger on public.notifications;
create trigger guard_business_invitation_notification_trigger before insert or update
  on public.notifications for each row execute function public.guard_business_invitation_notification();

create or replace function public.sync_business_invitation_notification()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_name text; v_inviter text; v_role text; v_pending boolean;
begin
  select name into v_name from public.budget_workspaces
    where id = new.workspace_id and workspace_type = 'business';
  if not found then return new; end if;
  select coalesce(nullif(full_name, ''), email) into v_inviter from public.profiles where id = new.invited_by;
  select name into v_role from public.business_roles where workspace_id = new.workspace_id and code = new.role;
  v_pending := new.status = 'pending' and (new.expires_at is null or new.expires_at > now());
  insert into public.notifications(user_id, email, created_by, workspace_id, business_invitation_id, type, title, body, url, read_at)
  values(new.invitee_user_id, lower(new.invitee_email), new.invited_by, new.workspace_id, new.id,
    'business_invite', case when v_pending then 'Business workspace invitation' else 'Business invitation ' || case when new.status = 'pending' then 'expired' else new.status end end,
    case when v_pending then coalesce(v_inviter, 'A Business owner') || ' invited you to join ' || v_name
      || ' as ' || coalesce(v_role, initcap(replace(new.role, '_', ' '))) || '. Accept or decline this request.'
      else 'Your invitation to join ' || v_name || ' is ' || case when new.status = 'pending' then 'expired' else new.status end || '.' end,
    case when v_pending then format('/business.html?invitation=%s#business/team', new.id) else null end,
    case when v_pending then null else now() end)
  on conflict (business_invitation_id) where business_invitation_id is not null do update
    set user_id = excluded.user_id, email = excluded.email, created_by = excluded.created_by,
      workspace_id = excluded.workspace_id, type = excluded.type, title = excluded.title,
      body = excluded.body, url = excluded.url, read_at = excluded.read_at;
  return new;
end;
$$;
revoke all on function public.guard_business_invitation_notification(), public.sync_business_invitation_notification()
  from public, anon, authenticated;
drop trigger if exists sync_business_invitation_notification_trigger on public.workspace_invitations;
create trigger sync_business_invitation_notification_trigger
  after insert or update of invitee_user_id, invitee_email, role, status, expires_at
  on public.workspace_invitations for each row execute function public.sync_business_invitation_notification();

-- Include existing pending requests without rewriting invitation rows or memberships.
insert into public.notifications(user_id, email, created_by, workspace_id, business_invitation_id, type, title, body, url)
select i.invitee_user_id, lower(i.invitee_email), i.invited_by, i.workspace_id, i.id,
  'business_invite', 'Business workspace invitation',
  coalesce(nullif(p.full_name, ''), p.email, 'A Business owner') || ' invited you to join ' || w.name
    || ' as ' || coalesce(r.name, initcap(replace(i.role, '_', ' '))) || '. Accept or decline this request.',
  format('/business.html?invitation=%s#business/team', i.id)
from public.workspace_invitations i
join public.budget_workspaces w on w.id = i.workspace_id and w.workspace_type = 'business'
left join public.profiles p on p.id = i.invited_by
left join public.business_roles r on r.workspace_id = i.workspace_id and r.code = i.role
where i.status = 'pending' and (i.expires_at is null or i.expires_at > now())
on conflict (business_invitation_id) where business_invitation_id is not null do nothing;

notify pgrst, 'reload schema';
commit;
