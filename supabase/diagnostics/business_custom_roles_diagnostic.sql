-- Read-only deployment checks. Run after the custom-role migration.
with checks as (
  select '01 Role catalog exists' as check_name, to_regclass('public.business_roles') is not null as passed
  union all select '02 Role catalog uses RLS', coalesce((select relrowsecurity and relforcerowsecurity from pg_class where oid=to_regclass('public.business_roles')),false)
  union all select '03 Authenticated direct role writes blocked', not has_table_privilege('authenticated','public.business_roles','INSERT,UPDATE,DELETE')
  union all select '04 Anonymous role reads blocked', not has_table_privilege('anon','public.business_roles','SELECT')
  union all select '05 Every business has six built-in roles', not exists(select 1 from public.budget_workspaces w where w.workspace_type='business'
    and (select count(*) from public.business_roles r where r.workspace_id=w.id and r.is_system and r.status='active')<>6)
  union all select '06 Role names are unique per business', not exists(select workspace_id,lower(btrim(name)) from public.business_roles where status='active'
    group by workspace_id,lower(btrim(name)) having count(*)>1)
  union all select '07 Active custom memberships use active same-business roles', not exists(select 1 from public.workspace_members m where m.role like 'custom_%' and m.status='active'
    and not exists(select 1 from public.business_roles r where r.workspace_id=m.workspace_id and r.code=m.role and r.status='active'))
  union all select '08 Pending custom invitations use active same-business roles', not exists(select 1 from public.workspace_invitations i
    where i.role like 'custom_%' and i.status='pending' and i.expires_at>now()
    and not exists(select 1 from public.business_roles r where r.workspace_id=i.workspace_id and r.code=i.role and r.status='active'))
  union all select '09 Assigned-scope members have at least one tag', not exists(select 1 from public.workspace_members m join public.business_roles r
    on r.workspace_id=m.workspace_id and r.code=m.role where m.status='active' and r.scope_mode='assigned'
    and not exists(select 1 from public.business_member_scopes s where s.workspace_id=m.workspace_id and s.member_id=m.id))
  union all select '10 Own-record roles have no company finance or review grants', not exists(select 1 from public.business_roles r join public.business_role_permissions p
    on p.workspace_id=r.workspace_id and p.role=r.code where r.scope_mode='own' and p.enabled
    and p.permission_code in ('finance.view_all','finance.record_payment','approvals.view','approvals.review','budgets.view','budgets.manage','team.manage','documents.manage'))
  union all select '11 Export grants also have report-view grants', not exists(select 1 from public.business_role_permissions p where p.enabled and p.permission_code='reports.export'
    and not exists(select 1 from public.business_role_permissions v where v.workspace_id=p.workspace_id and v.role=p.role and v.permission_code='reports.view' and v.enabled))
  union all select '12 Snapshot RPC is installed', to_regprocedure('public.business_roles_snapshot(uuid)') is not null
  union all select '13 Save RPC is installed', to_regprocedure('public.save_business_role(uuid,text,text,text,text,text[],integer)') is not null
  union all select '14 Archive RPC is installed', to_regprocedure('public.archive_business_role(uuid,text,integer)') is not null
  union all select '15 Atomic member access RPC is installed', to_regprocedure('public.update_business_member_role_access(uuid,uuid,text,uuid[],jsonb)') is not null
  union all select '16 Anonymous role saves are blocked', not has_function_privilege('anon','public.save_business_role(uuid,text,text,text,text,text[],integer)','EXECUTE')
  union all select '17 Internal assignment helper is private', not has_function_privilege('authenticated','public.business_check_role_assignment(uuid,text,uuid[],uuid)','EXECUTE')
  union all select '18 Member role guard is attached', exists(select 1 from pg_trigger where tgrelid='public.workspace_members'::regclass and tgfoid='public.enforce_business_member_role_compatibility()'::regprocedure and not tgisinternal)
  union all select '19 Invitation role guard is attached', exists(select 1 from pg_trigger where tgrelid='public.workspace_invitations'::regclass and tgname='business_invitation_custom_role_guard' and not tgisinternal)
  union all select '20 New businesses seed role metadata', exists(select 1 from pg_trigger where tgrelid='public.business_profiles'::regclass and tgname='seed_business_roles_after_profile' and not tgisinternal)
)
select check_name, passed, case when passed then 'PASS' else 'FAIL — review before using custom roles' end as result from checks order by check_name;
