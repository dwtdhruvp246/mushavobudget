-- Read-only pilot prerequisites; does not replace cross-device acceptance tests.
with checks(label,passed) as (values
 ('Signal table exists',to_regclass('public.business_change_signals') is not null),
 ('Signals have forced RLS',(select relrowsecurity and relforcerowsecurity from pg_class where oid='public.business_change_signals'::regclass)),
 ('Only neutral counter fields',(select count(*)=4 from information_schema.columns where table_schema='public' and table_name='business_change_signals')),
 ('Authenticated signal read grant',has_table_privilege('authenticated','public.business_change_signals','SELECT')),
 ('Signal writes blocked',not has_table_privilege('authenticated','public.business_change_signals','INSERT,UPDATE,DELETE')),
 ('Anonymous signal access blocked',not has_table_privilege('anon','public.business_change_signals','SELECT,INSERT,UPDATE,DELETE')),
 ('Emitter client execution blocked',not has_function_privilege('authenticated','public.emit_business_change_signal(uuid,boolean)','EXECUTE')),
 ('Trigger client execution blocked',not has_function_privilege('authenticated','public.signal_business_row_change()','EXECUTE')),
 ('Signal membership policy',exists(select 1 from pg_policies where schemaname='public' and tablename='business_change_signals' and policyname='business_signal_members_read')),
 ('Realtime publication present',exists(select 1 from pg_publication where pubname='supabase_realtime')),
 ('Signals published',exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='business_change_signals')),
 ('All change triggers enabled',(select count(*)=22 from pg_trigger where tgname='business_realtime_signal' and not tgisinternal and tgenabled<>'D')),
 ('Account suspension change trigger',exists(select 1 from pg_trigger where tgname='business_realtime_account_signal' and not tgisinternal and tgenabled<>'D')),
 ('Personal and Family have no signals',not exists(select 1 from public.business_change_signals s join public.budget_workspaces w on w.id=s.workspace_id where w.workspace_type<>'business')),
 ('Existing Businesses seeded',not exists(select 1 from public.budget_workspaces w where w.workspace_type='business' and not exists(select 1 from public.business_change_signals s where s.workspace_id=w.id))),
 ('Stage 10 billing available',to_regprocedure('public.business_billing_snapshot(uuid,integer,integer)') is not null),
 ('Stage 11 support available',to_regprocedure('public.admin_business_support_snapshot(uuid,integer)') is not null),
 ('Business public purchase closed',not public.product_customer_purchase_enabled('business')),
 ('Business public creation closed',not public.product_customer_workspace_creation_enabled('business')),
 ('No support permits left behind',not exists(select 1 from public.business_support_permits))
)
select label as check_name,case when coalesce(passed,false) then 'PASS' else 'FAIL' end as result from checks order by label;
