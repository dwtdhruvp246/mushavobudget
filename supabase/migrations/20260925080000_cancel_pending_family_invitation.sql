begin;

-- A deleted invite removes the record and its linked notification. Preserve
-- the record as cancelled instead, so it can no longer be accepted and the
-- family's reserved seat becomes available immediately.
drop policy if exists "Family owners can cancel invitations" on public.family_invitations;
revoke delete on public.family_invitations from authenticated;

create or replace function public.cancel_family_invitation(p_invitation_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.family_invitations%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;

  select invitations.* into v_invitation
  from public.family_invitations as invitations
  join public.families as families on families.id = invitations.family_id
  where invitations.id = p_invitation_id
    and families.owner_id = auth.uid()
    and invitations.status = 'pending'
  for update of invitations;

  if v_invitation.id is null then raise exception 'INVITATION_NOT_AVAILABLE'; end if;
  if not public.can_manage_family_members(v_invitation.family_id) then
    raise exception 'WORKSPACE_READ_ONLY';
  end if;

  update public.family_invitations
  set status = 'cancelled', responded_at = now()
  where id = v_invitation.id;

  delete from public.notifications
  where invitation_id = v_invitation.id and type = 'family_invite';

  return 'cancelled';
end;
$$;

revoke all on function public.cancel_family_invitation(uuid) from public, anon, authenticated;
grant execute on function public.cancel_family_invitation(uuid) to authenticated;

commit;
