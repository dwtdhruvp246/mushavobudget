begin;

do $$
declare v_function text;
begin
  if to_regclass('public.business_invitation_scopes') is null
     or to_regclass('public.business_team_operation_permits') is null then
    raise exception 'Business Stage 4 tables are missing';
  end if;
  if not exists (select 1 from pg_class where oid = 'public.business_invitation_scopes'::regclass and relrowsecurity and relforcerowsecurity)
     or not exists (select 1 from pg_class where oid = 'public.business_team_operation_permits'::regclass and relrowsecurity and relforcerowsecurity) then
    raise exception 'Business Stage 4 private tables do not force RLS';
  end if;
  if has_table_privilege('authenticated', 'public.business_invitation_scopes', 'INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.business_team_operation_permits', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Authenticated users have direct access to protected team tables';
  end if;
  foreach v_function in array array[
    'public.business_team_snapshot(uuid)',
    'public.create_business_invitation(uuid,text,text,uuid[])',
    'public.prepare_business_invitation_resend(uuid)',
    'public.edit_business_invitation(uuid,text,uuid[],integer)',
    'public.cancel_business_invitation(uuid)',
    'public.get_my_business_invitations()',
    'public.respond_business_invitation(uuid,boolean)',
    'public.update_business_member_access(uuid,uuid,text,uuid[])',
    'public.remove_business_member(uuid,uuid)',
    'public.transfer_business_ownership(uuid,uuid,text)'
  ] loop
    if to_regprocedure(v_function) is null then raise exception 'Missing Stage 4 RPC: %', v_function; end if;
    if not has_function_privilege('authenticated', v_function, 'EXECUTE') then raise exception 'Authenticated cannot execute %', v_function; end if;
    if has_function_privilege('anon', v_function, 'EXECUTE') then raise exception 'Anonymous can execute %', v_function; end if;
  end loop;
  if has_function_privilege('authenticated', 'public.record_business_invitation_delivery(uuid,uuid,boolean,text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.record_business_invitation_delivery(uuid,uuid,boolean,text)', 'EXECUTE') then
    raise exception 'Invitation delivery recorder privilege is unsafe';
  end if;
  if position('business_team_permit' in pg_get_functiondef('public.enforce_business_member_invitation_launch_control()'::regprocedure)) = 0
     or position('business_team_permit' in pg_get_functiondef('public.enforce_business_member_provision_launch_control()'::regprocedure)) = 0 then
    raise exception 'Stage 0 launch locks do not require protected Stage 4 permits';
  end if;
  if position('business_owner' in pg_get_functiondef('public.transfer_business_ownership(uuid,uuid,text)'::regprocedure)) = 0
     or position('p_confirmation_name' in pg_get_functiondef('public.transfer_business_ownership(uuid,uuid,text)'::regprocedure)) = 0 then
    raise exception 'Ownership transfer protections are missing';
  end if;
  if public.product_customer_workspace_creation_enabled('business')
     or public.product_customer_purchase_enabled('business') then
    raise exception 'Public Business launch controls were opened by Stage 4';
  end if;
end $$;

rollback;
