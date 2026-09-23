begin;

do $$
begin
  if to_regprocedure('public.has_my_unfinished_admin_invitation()') is null
     or to_regprocedure('public.complete_self_signup_from_admin_invitation(text,text[],text)') is null
  then
    raise exception 'invitation replacement signup functions are missing';
  end if;
  if has_function_privilege('anon', 'public.has_my_unfinished_admin_invitation()', 'EXECUTE')
     or has_function_privilege('anon', 'public.complete_self_signup_from_admin_invitation(text,text[],text)', 'EXECUTE')
  then
    raise exception 'anonymous users can reach invitation self-signup functions';
  end if;
  if not has_function_privilege('authenticated', 'public.has_my_unfinished_admin_invitation()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.complete_self_signup_from_admin_invitation(text,text[],text)', 'EXECUTE')
  then
    raise exception 'authenticated invitees cannot finish personal signup';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'admin_user_invitations_active_auth_user_idx'
  ) then
    raise exception 'one-active-invitation-per-Auth-user index is missing';
  end if;
end;
$$;

select 'admin_invitation_replacement_ready' as check_name, true as passed;
rollback;
