-- Run after 20260928130000_business_stage_3_onboarding.sql.
-- Expected SQL Editor result: "Success. No rows returned".
begin;

do $$
declare
  v_rpc text;
begin
  if to_regclass('public.business_setup_drafts') is null then
    raise exception 'BUSINESS_STAGE_3_DRAFT_TABLE_MISSING';
  end if;
  if not exists (
    select 1 from pg_class where oid = 'public.business_setup_drafts'::regclass
      and relrowsecurity
  ) then
    raise exception 'BUSINESS_STAGE_3_DRAFT_RLS_DISABLED';
  end if;
  if has_table_privilege('authenticated', 'public.business_setup_drafts', 'INSERT')
     or has_table_privilege('authenticated', 'public.business_setup_drafts', 'UPDATE')
     or has_table_privilege('authenticated', 'public.business_setup_drafts', 'DELETE')
     or has_table_privilege('anon', 'public.business_setup_drafts', 'SELECT') then
    raise exception 'BUSINESS_STAGE_3_DRAFT_PRIVILEGES_INCORRECT';
  end if;
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.business_setup_drafts'::regclass
      and conname = 'business_setup_draft_category_fk' and contype = 'f'
  ) or not exists (
    select 1 from pg_constraint where conrelid = 'public.business_setup_drafts'::regclass
      and conname = 'business_setup_draft_dimension_fk' and contype = 'f'
  ) then
    raise exception 'BUSINESS_STAGE_3_WORKSPACE_FKS_MISSING';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.business_setup_drafts'::regclass
      and tgname = 'require_business_workspace_row_trigger'
      and tgenabled <> 'D'
  ) then
    raise exception 'BUSINESS_STAGE_3_WORKSPACE_TRIGGER_MISSING';
  end if;
  if not exists (select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workspace_settings'
      and policyname = 'Business settings updates require protected RPC'
      and permissive = 'RESTRICTIVE')
     or not exists (select 1 from pg_policies
       where schemaname = 'public' and tablename = 'budget_workspaces'
         and policyname = 'Business workspace updates require protected RPC'
         and permissive = 'RESTRICTIVE') then
    raise exception 'BUSINESS_STAGE_3_DIRECT_SETTINGS_WRITE_EXPOSED';
  end if;
  foreach v_rpc in array array[
    'save_business_setup(uuid,text,text,text[],text,integer,integer,integer,timestamptz)',
    'save_business_setup_draft(uuid,text,text,numeric,text,date,date,uuid,uuid,integer)',
    'complete_business_onboarding(uuid)'
  ] loop
    if to_regprocedure('public.' || v_rpc) is null
       or not has_function_privilege('authenticated', 'public.' || v_rpc, 'EXECUTE')
       or has_function_privilege('anon', 'public.' || v_rpc, 'EXECUTE') then
      raise exception 'BUSINESS_STAGE_3_RPC_NOT_PROTECTED: %', v_rpc;
    end if;
  end loop;
  if has_function_privilege('authenticated',
    'public.business_setup_owner_required(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated',
       'public.save_business_profile(uuid,text,text,text,text,text,text,text,text,text,jsonb,integer,integer,text,integer)',
       'EXECUTE') then
    raise exception 'BUSINESS_STAGE_3_LEGACY_BYPASS_EXPOSED';
  end if;
  if not exists (select 1 from pg_proc
    where oid = to_regprocedure('public.business_has_permission(uuid,text)')
      and prosrc like '%paid_through_at > now()%')
     or not exists (select 1 from pg_proc
       where oid = to_regprocedure('public.save_workspace_currency_settings(uuid,text,text[],text,boolean)')
         and prosrc like '%BUSINESS_SETTINGS_RPC_REQUIRED%') then
    raise exception 'BUSINESS_STAGE_3_EXPIRY_OR_SETTINGS_GUARD_MISSING';
  end if;
  if exists (select 1 from public.product_release_controls
    where product_code = 'business'
      and (customer_purchase_enabled or customer_workspace_creation_enabled))
     or exists (select 1 from public.plans
       where workspace_type = 'business' and available_for_purchase) then
    raise exception 'BUSINESS_PUBLIC_PURCHASE_LOCK_OPEN';
  end if;
end $$;

rollback;
