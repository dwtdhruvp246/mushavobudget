-- Run after 20260928090000_admin_manual_subscription_grants.sql.
-- Silent success in Supabase SQL Editor: "Success. No rows returned".
begin;

do $$
declare
  v_table text;
  v_function text;
begin
  foreach v_table in array array[
    'business_admin_test_provisioning', 'admin_subscription_grants'
  ] loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'ADMIN_GRANT_TABLE_MISSING: %', v_table;
    end if;
    if not exists (
      select 1 from pg_class
      where oid = to_regclass('public.' || v_table) and relrowsecurity
    ) then
      raise exception 'ADMIN_GRANT_RLS_DISABLED: %', v_table;
    end if;
    if has_table_privilege('authenticated', format('public.%I', v_table), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'DELETE') then
      raise exception 'ADMIN_GRANT_DIRECT_WRITE_EXPOSED: %', v_table;
    end if;
  end loop;

  v_function := 'public.admin_grant_manual_subscription(uuid,uuid,uuid,text,date,date,text,text)';
  if to_regprocedure(v_function) is null
     or not has_function_privilege('authenticated', v_function, 'EXECUTE') then
    raise exception 'ADMIN_GRANT_RPC_UNAVAILABLE';
  end if;
  if has_function_privilege('anon', v_function, 'EXECUTE')
     or has_function_privilege('authenticated', 'public.business_admin_test_permit(uuid,uuid)', 'EXECUTE') then
    raise exception 'ADMIN_GRANT_INTERNAL_FUNCTION_EXPOSED';
  end if;
  if not exists (
    select 1 from pg_proc
    where oid = to_regprocedure(v_function) and prosecdef
  ) then
    raise exception 'ADMIN_GRANT_RPC_NOT_PROTECTED';
  end if;
  if exists (select 1 from public.product_release_controls
    where product_code = 'business'
      and (customer_purchase_enabled or customer_workspace_creation_enabled))
     or exists (select 1 from public.plans
       where workspace_type = 'business' and available_for_purchase) then
    raise exception 'BUSINESS_PUBLIC_LAUNCH_LOCK_OPEN';
  end if;
  if not exists (
    select 1 from pg_proc
    where oid = to_regprocedure('public.enforce_business_workspace_launch_control()')
      and prosrc like '%business_admin_test_permit%'
  ) or not exists (
    select 1 from pg_proc
    where oid = to_regprocedure('public.enforce_business_member_provision_launch_control()')
      and prosrc like '%business_admin_test_permit%'
  ) then
    raise exception 'BUSINESS_TEST_SCOPED_PROVISIONING_MISSING';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_subscription_grants'
      and cmd = 'SELECT' and qual like '%super_admin%'
  ) then
    raise exception 'ADMIN_GRANT_AUDIT_READ_POLICY_MISSING';
  end if;
end $$;

rollback;
