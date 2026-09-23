-- An invitation signs the recipient into Auth before they finish setup. The
-- normal app bootstrap must not provision its Free workspace in the interim.
begin;

create or replace function public.provision_my_budget_workspace()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;

  if exists (
    select 1 from public.admin_user_invitations as invitations
    where invitations.auth_user_id = v_user_id
      and invitations.status = 'sent'
  ) then
    raise exception 'ADMIN_INVITATION_SETUP_REQUIRED';
  end if;

  return public.provision_budget_user(v_user_id);
end;
$$;

commit;
