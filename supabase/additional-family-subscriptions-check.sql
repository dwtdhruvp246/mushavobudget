-- Read-only deployment check. No private values returned.
select
  position('FAMILY_ACCOUNT_CAP_REACHED' in pg_get_functiondef(
    'public.submit_family_plan_request(uuid,text,integer,text,text,text,numeric,text,date,text,text,text,text,text,bigint)'::regprocedure)) > 0 as additional_purchase_enabled,
  position('v_owned_count + 1' in pg_get_functiondef(
    'public.review_subscription_payment(uuid,text,text)'::regprocedure)) > 0 as approval_grants_family_place;
