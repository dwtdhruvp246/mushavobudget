begin;
set transaction read only;

do $$
begin
  if to_regclass('public.admin_user_invitations') is null then
    raise exception 'admin_user_invitations table is missing';
  end if;
  if to_regclass('public.admin_user_invitation_audit') is null then
    raise exception 'admin_user_invitation_audit table is missing';
  end if;
  if not exists (
    select 1 from pg_class
    where oid = 'public.admin_user_invitations'::regclass and relrowsecurity and relforcerowsecurity
  ) then
    raise exception 'admin_user_invitations RLS is not forced';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'admin_invitation_id'
  ) then
    raise exception 'profiles.admin_invitation_id is missing';
  end if;
  if has_table_privilege('authenticated', 'public.admin_user_invitations', 'INSERT')
     or has_table_privilege('authenticated', 'public.admin_user_invitations', 'UPDATE')
     or has_table_privilege('authenticated', 'public.admin_user_invitations', 'DELETE')
  then
    raise exception 'authenticated users have invitation write access';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.reserve_admin_user_invitation(uuid,text,text,text,uuid,text,text,text,date,date,text[],text,integer,boolean,boolean,numeric,text,date,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'authenticated users can execute the reservation RPC';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.reserve_admin_user_invitation(uuid,text,text,text,uuid,text,text,text,date,date,text[],text,integer,boolean,boolean,numeric,text,date,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'service_role cannot execute the reservation RPC';
  end if;
  if position(
    'admin_invitation' in pg_get_functiondef('public.handle_new_user_profile()'::regprocedure)
  ) = 0 then
    raise exception 'new-user trigger does not defer invited-user provisioning';
  end if;
end;
$$;

select
  'admin_user_invitation_foundation_ready' as check_name,
  true as passed;

rollback;
