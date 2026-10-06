-- Stage 0: live inventory exposed two internal currency helpers to anon.
-- The source conversion writer trusts its protected caller; users must reach
-- it through payment triggers or authorized backfill/settings workflows.
-- No rows, function bodies, currency calculations or native assets change.
begin;

do $$
declare
  v_store oid := to_regprocedure('public.store_api_payment_conversion(text,uuid,uuid,numeric,text,text,timestamp with time zone)');
  v_dates oid := to_regprocedure('public.currency_conversion_backfill_dates(integer)');
  v_name text;
  v_owner record;
begin
  if v_store is null or v_dates is null
    or not exists(select 1 from pg_roles where rolname='anon')
    or not exists(select 1 from pg_roles where rolname='authenticated')
    or not exists(select 1 from pg_roles where rolname='service_role') then
    raise exception 'SECURITY_STAGE_0_CURRENCY_PREREQUISITE_MISSING';
  end if;

  foreach v_name in array array['lock_payment_record_conversion','lock_platform_payment_conversion',
    'lock_subscription_payment_conversion','backfill_currency_conversions','backfill_workspace_currency_conversions'] loop
    if not exists(select 1 from pg_proc where pronamespace=to_regnamespace('public')
      and proname=v_name and prosecdef) then
      raise exception 'SECURITY_STAGE_0_PROTECTED_CURRENCY_CALLER_MISSING: %',v_name;
    end if;
  end loop;

  revoke execute on function public.store_api_payment_conversion(text,uuid,uuid,numeric,text,text,timestamptz)
    from public,anon,authenticated restrict;
  revoke execute on function public.currency_conversion_backfill_dates(integer)
    from public,anon,authenticated restrict;
  grant execute on function public.store_api_payment_conversion(text,uuid,uuid,numeric,text,text,timestamptz),
    public.currency_conversion_backfill_dates(integer) to service_role;

  -- SECURITY DEFINER callers run as their owners. Explicitly retain the
  -- protected trigger/backfill path even if those functions use distinct owners.
  for v_owner in select distinct r.oid,r.rolname from pg_proc p join pg_roles r on r.oid=p.proowner
    where p.pronamespace=to_regnamespace('public') and p.prosecdef
      and p.proname in ('lock_payment_record_conversion','lock_platform_payment_conversion',
        'lock_subscription_payment_conversion','backfill_currency_conversions','backfill_workspace_currency_conversions') loop
    if pg_has_role('anon',v_owner.oid,'USAGE') or pg_has_role('authenticated',v_owner.oid,'USAGE') then
      raise exception 'SECURITY_STAGE_0_CURRENCY_CALLER_OWNER_UNTRUSTED';
    end if;
    execute format('grant execute on function public.store_api_payment_conversion(text,uuid,uuid,numeric,text,text,timestamptz) to %I',v_owner.rolname);
  end loop;

  if has_function_privilege('anon',v_store,'EXECUTE')
    or has_function_privilege('authenticated',v_store,'EXECUTE')
    or has_function_privilege('anon',v_dates,'EXECUTE')
    or has_function_privilege('authenticated',v_dates,'EXECUTE') then
    raise exception 'SECURITY_STAGE_0_CURRENCY_HELPER_EXECUTE_STILL_INHERITED';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
