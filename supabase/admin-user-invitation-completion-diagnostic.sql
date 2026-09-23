begin;

do $$
begin
  if to_regprocedure('public.get_my_admin_user_invitation(uuid)') is null then
    raise exception 'invitee invitation lookup RPC is missing';
  end if;
  if to_regprocedure('public.complete_admin_user_invitation(uuid,text[],text)') is null then
    raise exception 'invitation completion RPC is missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admin_user_invitations'
      and column_name = 'provisioned_workspace_id'
  ) then
    raise exception 'provisioned workspace link is missing';
  end if;
  if has_function_privilege('anon', 'public.get_my_admin_user_invitation(uuid)', 'EXECUTE') then
    raise exception 'anonymous users can read invitation setup data';
  end if;
  if has_function_privilege('anon', 'public.complete_admin_user_invitation(uuid,text[],text)', 'EXECUTE') then
    raise exception 'anonymous users can complete invitations';
  end if;
  if not has_function_privilege('authenticated', 'public.get_my_admin_user_invitation(uuid)', 'EXECUTE') then
    raise exception 'authenticated invitees cannot read their invitation';
  end if;
  if not has_function_privilege('authenticated', 'public.complete_admin_user_invitation(uuid,text[],text)', 'EXECUTE') then
    raise exception 'authenticated invitees cannot complete their invitation';
  end if;
end;
$$;

select
  'admin_user_invitation_completion_ready' as check_name,
  true as passed;

rollback;
