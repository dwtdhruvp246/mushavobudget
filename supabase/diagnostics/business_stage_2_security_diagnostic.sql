-- Run after 20260928070000_business_stage_2_security_foundation.sql.
-- Success is intentionally silent (Supabase displays "Success. No rows returned").

begin;

do $$
declare
  v_missing text[];
begin
  select array_agg(required_table order by required_table)
  into v_missing
  from unnest(array[
    'business_permission_definitions',
    'business_profiles',
    'business_role_permissions',
    'business_member_permissions',
    'business_dimensions',
    'business_categories',
    'business_member_scopes',
    'business_documents',
    'business_audit_events'
  ]) as required(required_table)
  where to_regclass('public.' || required_table) is null;

  if v_missing is not null then
    raise exception 'BUSINESS_STAGE_2_MISSING_TABLES: %', array_to_string(v_missing, ', ');
  end if;
end $$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'business_profiles', 'business_role_permissions', 'business_member_permissions',
    'business_dimensions', 'business_categories', 'business_member_scopes',
    'business_documents', 'business_audit_events'
  ] loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = v_table
        and column_name = 'workspace_id'
        and is_nullable = 'NO'
    ) then
      raise exception 'BUSINESS_STAGE_2_WORKSPACE_SCOPE_MISSING: %', v_table;
    end if;

    if not exists (
      select 1
      from pg_class
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
        and pg_class.relname = v_table
        and pg_class.relrowsecurity
    ) then
      raise exception 'BUSINESS_STAGE_2_RLS_DISABLED: %', v_table;
    end if;

    if has_table_privilege('authenticated', format('public.%I', v_table), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'DELETE') then
      raise exception 'BUSINESS_STAGE_2_DIRECT_WRITE_GRANT: %', v_table;
    end if;
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.workspace_members'::regclass
      and conname = 'workspace_members_workspace_id_id_key'
      and contype = 'u'
  ) then
    raise exception 'BUSINESS_STAGE_2_MEMBER_COMPOSITE_KEY_MISSING';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.business_member_permissions'::regclass
      and conname = 'business_member_permissions_member_fk'
      and contype = 'f'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.business_member_scopes'::regclass
      and conname = 'business_member_scopes_member_fk'
      and contype = 'f'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.business_member_scopes'::regclass
      and conname = 'business_member_scopes_dimension_fk'
      and contype = 'f'
  ) then
    raise exception 'BUSINESS_STAGE_2_COMPOSITE_SCOPE_FK_MISSING';
  end if;
end $$;

do $$
declare
  v_permission text;
begin
  foreach v_permission in array array[
    'workspace.view', 'profile.manage', 'settings.manage',
    'dimensions.view', 'dimensions.manage',
    'categories.view', 'categories.manage',
    'team.view', 'team.manage',
    'finance.view_all', 'finance.create', 'finance.record_payment',
    'approvals.view', 'approvals.review',
    'budgets.view', 'budgets.manage',
    'reports.view', 'reports.export',
    'documents.view', 'documents.create', 'documents.manage',
    'audit.view', 'subscription.view', 'subscription.manage'
  ] loop
    if not exists (
      select 1 from public.business_permission_definitions
      where permission_code = v_permission
    ) then
      raise exception 'BUSINESS_STAGE_2_PERMISSION_MISSING: %', v_permission;
    end if;
  end loop;

  if exists (
    select 1 from public.business_role_permissions
    where role <> 'business_owner' and permission_code = 'subscription.manage' and enabled
  ) then
    raise exception 'BUSINESS_STAGE_2_OWNER_BILLING_RULE_BROKEN';
  end if;

  if exists (
    select 1 from public.business_role_permissions
    where role = 'staff' and permission_code = 'finance.view_all' and enabled
  ) then
    raise exception 'BUSINESS_STAGE_2_STAFF_TOTALS_RULE_BROKEN';
  end if;
end $$;

do $$
declare
  v_rpc text;
begin
  foreach v_rpc in array array[
    'save_business_profile(uuid,text,text,text,text,text,text,text,text,text,jsonb,integer,integer,text,integer)',
    'save_business_dimension(uuid,uuid,text,text,text,text,uuid,text,integer)',
    'save_business_category(uuid,uuid,text,text,text,text,text,text,integer)',
    'set_business_role_permission(uuid,text,text,boolean)',
    'set_business_member_permission(uuid,uuid,text,text)',
    'assign_business_member_scope(uuid,uuid,uuid,boolean)',
    'register_business_document(uuid,uuid,text,uuid,text,text,text,bigint,text)',
    'archive_business_document(uuid,uuid,text)'
  ] loop
    if to_regprocedure('public.' || v_rpc) is null then
      raise exception 'BUSINESS_STAGE_2_RPC_MISSING: %', v_rpc;
    end if;
    if not has_function_privilege('authenticated', 'public.' || v_rpc, 'EXECUTE') then
      raise exception 'BUSINESS_STAGE_2_RPC_NOT_CALLABLE: %', v_rpc;
    end if;
  end loop;

  if has_function_privilege(
    'authenticated',
    'public.business_record_audit_event(uuid,text,text,uuid,jsonb,jsonb,text,uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'BUSINESS_STAGE_2_AUDIT_WRITER_EXPOSED';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workspace_members'
      and policyname = 'Business membership requires active membership'
      and permissive = 'RESTRICTIVE'
  ) or (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workspace_members'
      and policyname in (
        'Business membership inserts require protected RPC',
        'Business membership updates require protected RPC',
        'Business membership deletes require protected RPC'
      )
      and permissive = 'RESTRICTIVE'
  ) <> 3 then
    raise exception 'BUSINESS_STAGE_2_SHARED_MEMBERSHIP_ISOLATION_MISSING';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.business_audit_events'::regclass
      and tgname = 'prevent_business_audit_mutation_trigger'
      and not tgisinternal
      and tgenabled <> 'D'
  ) then
    raise exception 'BUSINESS_STAGE_2_AUDIT_IMMUTABILITY_MISSING';
  end if;

  if not exists (
    select 1 from storage.buckets
    where id = 'business-documents'
      and public = false
      and file_size_limit = 10485760
  ) then
    raise exception 'BUSINESS_STAGE_2_PRIVATE_BUCKET_MISSING';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Business members can read registered private documents'
  ) then
    raise exception 'BUSINESS_STAGE_2_PRIVATE_DOCUMENT_POLICY_MISSING';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.product_release_controls
    where product_code = 'business'
      and customer_purchase_enabled = false
      and customer_workspace_creation_enabled = false
  ) then
    raise exception 'BUSINESS_STAGE_0_LAUNCH_LOCK_NOT_ACTIVE';
  end if;

  if exists (
    select 1 from public.plans
    where workspace_type = 'business' and available_for_purchase
  ) then
    raise exception 'BUSINESS_STAGE_0_PURCHASE_LOCK_NOT_ACTIVE';
  end if;
end $$;

rollback;
