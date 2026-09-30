-- Read-only: no test accounts, support actions or membership changes are created.
with checks(label,passed) as (
  values
  ('Private support history exists',to_regclass('public.business_support_actions') is not null),
  ('Private transaction permits exist',to_regclass('public.business_support_permits') is not null),
  ('Support version exists',exists(select 1 from information_schema.columns where table_schema='public' and table_name='budget_workspaces' and column_name='business_support_version')),
  ('Support history has forced RLS',coalesce((select relrowsecurity and relforcerowsecurity from pg_class where oid=to_regclass('public.business_support_actions')),false)),
  ('Support permits have forced RLS',coalesce((select relrowsecurity and relforcerowsecurity from pg_class where oid=to_regclass('public.business_support_permits')),false)),
  ('Clients cannot write support history',not has_table_privilege('authenticated','public.business_support_actions','INSERT,UPDATE,DELETE')),
  ('Clients cannot read support history directly',not has_table_privilege('authenticated','public.business_support_actions','SELECT')),
  ('Clients cannot access support permits',not has_table_privilege('authenticated','public.business_support_permits','SELECT,INSERT,UPDATE,DELETE')),
  ('Support audit immutable trigger',exists(select 1 from pg_trigger where tgrelid='public.business_support_actions'::regclass and tgname='business_support_actions_immutable' and not tgisinternal and tgenabled<>'D')),
  ('Workspace support guard enabled',exists(select 1 from pg_trigger where tgrelid='public.budget_workspaces'::regclass and tgname='guard_business_workspace_support' and not tgisinternal and tgenabled<>'D')),
  ('Owner membership guard enabled',exists(select 1 from pg_trigger where tgrelid='public.workspace_members'::regclass and tgname='guard_business_owner_membership' and not tgisinternal and tgenabled<>'D')),
  ('Support snapshot available',to_regprocedure('public.admin_business_support_snapshot(uuid,integer)') is not null),
  ('Support status procedure available',to_regprocedure('public.admin_business_set_status(uuid,text,integer,text,text,uuid)') is not null),
  ('Ownership support procedure available',to_regprocedure('public.admin_business_transfer_owner(uuid,uuid,uuid,integer,text,text,text,uuid)') is not null),
  ('Snapshot authenticated grant',has_function_privilege('authenticated','public.admin_business_support_snapshot(uuid,integer)','EXECUTE')),
  ('Status authenticated grant',has_function_privilege('authenticated','public.admin_business_set_status(uuid,text,integer,text,text,uuid)','EXECUTE')),
  ('Ownership authenticated grant',has_function_privilege('authenticated','public.admin_business_transfer_owner(uuid,uuid,uuid,integer,text,text,text,uuid)','EXECUTE')),
  ('Anonymous support access blocked',not has_function_privilege('anon','public.admin_business_support_snapshot(uuid,integer)','EXECUTE') and not has_function_privilege('anon','public.admin_business_set_status(uuid,text,integer,text,text,uuid)','EXECUTE') and not has_function_privilege('anon','public.admin_business_transfer_owner(uuid,uuid,uuid,integer,text,text,text,uuid)','EXECUTE')),
  ('Client permit helper blocked',not has_function_privilege('authenticated','public.business_support_permitted(uuid,text)','EXECUTE') and not has_function_privilege('anon','public.business_support_permitted(uuid,text)','EXECUTE')),
  ('Existing Owner transfer preserved',position('business_support_permits' in pg_get_functiondef('public.transfer_business_ownership(uuid,uuid,text)'::regprocedure))>0),
  ('Business public purchase stays closed',not public.product_customer_purchase_enabled('business')),
  ('Business public creation stays closed',not public.product_customer_workspace_creation_enabled('business')),
  ('No leftover support permits',not exists(select 1 from public.business_support_permits)),
  ('All support actions belong to Business',not exists(select 1 from public.business_support_actions a join public.budget_workspaces w on w.id=a.workspace_id where w.workspace_type<>'business'))
)
select label as check_name,case when passed then 'PASS' else 'FAIL' end as result from checks order by label;
