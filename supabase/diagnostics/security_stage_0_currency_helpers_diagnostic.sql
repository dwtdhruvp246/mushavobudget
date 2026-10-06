-- Read-only catalog check; no customer rows, tokens, cron bodies or secrets.
-- Expected after the fix: 10 PASS, 1 REVIEW, 1 CANNOT VERIFY (12 rows).
with helpers as (
  select to_regprocedure('public.store_api_payment_conversion(text,uuid,uuid,numeric,text,text,timestamp with time zone)')::oid as writer,
    to_regprocedure('public.currency_conversion_backfill_dates(integer)')::oid as dates
), callers as (
  select p.oid,p.proowner,p.prosecdef,p.proname
  from pg_proc p where p.pronamespace=to_regnamespace('public')
    and p.proname in ('lock_payment_record_conversion','lock_platform_payment_conversion',
      'lock_subscription_payment_conversion','backfill_currency_conversions','backfill_workspace_currency_conversions')
), frontend(signature) as (
  values ('latest_exchange_rate(text,text,timestamp with time zone)'),
    ('save_workspace_currency_settings(uuid,text,text[],text,boolean)'),
    ('exchange_rate_status(boolean)'),('backfill_currency_conversions()'),
    ('backfill_workspace_currency_conversions(uuid)'),('save_manual_payment_conversion(text,uuid,text,numeric,numeric)')
), public_lookups(signature) as (
  values ('get_public_plan_catalogue(text)'),('get_public_signup_currencies()')
), checks(check_name,status,details) as (
  select '01 Internal helpers are installed',case when writer is not null and dates is not null then 'PASS' else 'FAIL' end,
    jsonb_build_object('writer_present',writer is not null,'dates_present',dates is not null) from helpers
  union all
  select '02 Internal helpers retain protected definitions',
    case when (select count(*) from pg_proc where oid in (h.writer,h.dates) and prosecdef
      and 'search_path=public, pg_temp'=any(proconfig))=2 then 'PASS' else 'FAIL' end,
    jsonb_build_object('scope','SECURITY DEFINER and pinned search path only; function body is not retrieved') from helpers h
  union all
  select '03 Anonymous direct conversion writes are disabled',
    case when writer is not null and not has_function_privilege('anon',writer,'EXECUTE') then 'PASS' else 'FAIL' end,
    jsonb_build_object('scope','Effective EXECUTE, including PUBLIC/inherited grants') from helpers
  union all
  select '04 Signed-in direct conversion writes are disabled',
    case when writer is not null and not has_function_privilege('authenticated',writer,'EXECUTE') then 'PASS' else 'FAIL' end,
    jsonb_build_object('scope','Protected triggers and authorized RPCs perform legitimate conversion writes') from helpers
  union all
  select '05 Anonymous historical payment dates are disabled',
    case when dates is not null and not has_function_privilege('anon',dates,'EXECUTE') then 'PASS' else 'FAIL' end,
    jsonb_build_object('scope','Effective EXECUTE only') from helpers
  union all
  select '06 Signed-in direct historical backfill dates are disabled',
    case when dates is not null and not has_function_privilege('authenticated',dates,'EXECUTE') then 'PASS' else 'FAIL' end,
    jsonb_build_object('scope','Backend scheduler uses the service role') from helpers
  union all
  select '07 Backend currency helper access is retained',
    case when writer is not null and dates is not null
      and has_function_privilege('service_role',writer,'EXECUTE')
      and has_function_privilege('service_role',dates,'EXECUTE') then 'PASS' else 'FAIL' end,
    jsonb_build_object('scope','Service EXECUTE grants only; actual scheduled execution needs separate evidence') from helpers
  union all
  select '08 Protected trigger and backfill owners can still write conversions',
    case when h.writer is not null and count(distinct c.proname)=5
      and bool_and(c.prosecdef and has_function_privilege(c.proowner,h.writer,'EXECUTE')) then 'PASS' else 'FAIL' end,
    jsonb_build_object('caller_count',count(distinct c.proname),'scope','Caller ownership/EXECUTE metadata only')
    from helpers h left join callers c on true group by h.writer
  union all
  select '09 Signed-in currency entry points remain executable',
    case when bool_and(to_regprocedure('public.'||signature) is not null
      and has_function_privilege('authenticated',to_regprocedure('public.'||signature),'EXECUTE')) then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected_count',count(*),'scope','Existing function-body authorization remains required') from frontend
  union all
  select '10 Public signup and pricing entry points remain executable',
    case when bool_and(to_regprocedure('public.'||signature) is not null
      and has_function_privilege('anon',to_regprocedure('public.'||signature),'EXECUTE')) then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected_count',count(*)) from public_lookups
  union all
  select '11 Remaining anonymous SECURITY DEFINER inventory','REVIEW',
    coalesce(jsonb_agg(p.oid::regprocedure::text order by p.proname),'[]'::jsonb)
    from pg_proc p where p.pronamespace=to_regnamespace('public') and p.prosecdef
      and has_function_privilege('anon',p.oid,'EXECUTE')
  union all
  select '12 Live conversion workflows and historical integrity','CANNOT VERIFY',
    jsonb_build_object('required','Controlled allowed/denied payment, settings and scheduler checks; existing conversion integrity needs authorized review')
)
select check_name,status,details from checks order by check_name;
