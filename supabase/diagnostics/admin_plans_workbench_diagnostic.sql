-- Read-only deployment prerequisites. These do not replace live UI acceptance.
with functions as (
  select unnest(array[
    'public.admin_plan_workbench_snapshot(uuid)',
    'public.admin_save_plan_workbench(uuid,text,jsonb,jsonb,jsonb)',
    'public.admin_cancel_scheduled_plan_price(uuid,uuid,text)',
    'public.admin_plan_calculation_preview(text,numeric,numeric,integer,integer,integer,timestamp with time zone,timestamp with time zone,timestamp with time zone,text)'
  ]) as signature
), checks as (
  select 1 n,'Editor snapshot RPC' check_name,to_regprocedure('public.admin_plan_workbench_snapshot(uuid)') is not null ok
  union all select 2,'Atomic save RPC',to_regprocedure('public.admin_save_plan_workbench(uuid,text,jsonb,jsonb,jsonb)') is not null
  union all select 3,'Scheduled-price cancellation RPC',to_regprocedure('public.admin_cancel_scheduled_plan_price(uuid,uuid,text)') is not null
  union all select 4,'Calculation preview RPC',to_regprocedure('public.admin_plan_calculation_preview(text,numeric,numeric,integer,integer,integer,timestamp with time zone,timestamp with time zone,timestamp with time zone,text)') is not null
  union all select 5,'Protected functions use SECURITY DEFINER',(select count(*)=4 from functions f join pg_proc p on p.oid=to_regprocedure(f.signature) where p.prosecdef)
  union all select 6,'Protected functions check admin role and suspension',(select count(*)=4 from functions f join pg_proc p on p.oid=to_regprocedure(f.signature) where pg_get_functiondef(p.oid) like '%PLAN_MANAGEMENT_ACCESS_REQUIRED%' and pg_get_functiondef(p.oid) like '%my_account_suspended%')
  union all select 7,'Anonymous cannot execute editor functions',(select count(*)=4 from functions where to_regprocedure(signature) is not null and not has_function_privilege('anon',signature,'EXECUTE'))
  union all select 8,'Authenticated RPC grants exist',(select count(*)=4 from functions where to_regprocedure(signature) is not null and has_function_privilege('authenticated',signature,'EXECUTE'))
  union all select 9,'Fixed function search paths',(select count(*)=4 from functions f join pg_proc p on p.oid=to_regprocedure(f.signature) where array_to_string(p.proconfig,',') like '%search_path=public, pg_temp%')
  union all select 10,'Save detects stale editor tokens',pg_get_functiondef(to_regprocedure('public.admin_save_plan_workbench(uuid,text,jsonb,jsonb,jsonb)')) like '%PLAN_SETTINGS_CHANGED%'
  union all select 11,'Existing workspace types are protected',pg_get_functiondef(to_regprocedure('public.admin_save_plan_workbench(uuid,text,jsonb,jsonb,jsonb)')) like '%PLAN_WORKSPACE_TYPE_CANNOT_CHANGE%'
  union all select 12,'Free payment limit remains protected',pg_get_functiondef(to_regprocedure('public.admin_save_plan_workbench(uuid,text,jsonb,jsonb,jsonb)')) like '%FREE_PLAN_LIMIT_REQUIRED%'
  union all select 13,'Business public purchase stays closed',not public.product_customer_purchase_enabled('business')
  union all select 14,'Business public creation stays closed',not public.product_customer_workspace_creation_enabled('business')
  union all select 15,'Business seats match their billing configuration',not exists(select 1 from public.business_billing_settings b join public.plan_limits l on l.plan_id=b.plan_id and l.limit_code='included_member_seats' where l.limit_value is distinct from b.included_seats)
  union all select 16,'Current prices have no duplicate currency/cycle',not exists(select 1 from public.plan_prices where is_active and effective_from<=now() and (effective_until is null or effective_until>now()) group by plan_id,billing_period,currency having count(*)>1)
  union all select 17,'Family helper is private',not has_function_privilege('anon','public.family_extra_place_proration(timestamp with time zone,timestamp with time zone,timestamp with time zone)','EXECUTE') and not has_function_privilege('authenticated','public.family_extra_place_proration(timestamp with time zone,timestamp with time zone,timestamp with time zone)','EXECUTE')
  union all select 18,'Family May 30 example: 11.5 months',(public.family_extra_place_proration('2026-05-20 00:00+00','2027-05-20 00:00+00','2026-05-30 00:00+00')->>'factor')::numeric=11.5
  union all select 19,'Family June 10 example: 11 months',(public.family_extra_place_proration('2026-05-20 00:00+00','2027-05-20 00:00+00','2026-06-10 00:00+00')->>'factor')::numeric=11
  union all select 20,'Family July 2 example: 10.5 months',(public.family_extra_place_proration('2026-05-20 00:00+00','2027-05-20 00:00+00','2026-07-02 00:00+00')->>'factor')::numeric=10.5
  union all select 21,'Family August 13 example: 9 months',(public.family_extra_place_proration('2026-05-20 00:00+00','2027-05-20 00:00+00','2026-08-13 00:00+00')->>'factor')::numeric=9
  union all select 22,'Real Family quotes use the shared rule',pg_get_functiondef(to_regprocedure('public.family_extra_place_quote(uuid,integer)')) like '%family_extra_place_proration%'
)
select check_name,case when coalesce(ok,false) then 'PASS' else 'FAIL' end as result from checks order by n;
