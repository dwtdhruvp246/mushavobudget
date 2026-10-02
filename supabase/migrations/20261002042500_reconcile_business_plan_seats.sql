begin;

-- Older catalogue edits could change included seats independently of private
-- Business billing settings. Billing settings remain authoritative, including
-- NULL when the pilot's seat configuration is intentionally unset.
do $$
begin
  perform p.id from public.plans p
    join public.business_billing_settings b on b.plan_id=p.id
    where p.workspace_type='business' order by p.id for update of p;
  perform b.plan_id from public.business_billing_settings b
    join public.plans p on p.id=b.plan_id
    where p.workspace_type='business' order by b.plan_id for update of b;
end;
$$;

insert into public.subscription_audit_events
  (actor_id,action,target_type,target_id,safe_details)
select auth.uid(),'plan.business_seats_reconciled','plan',b.plan_id,
  jsonb_build_object('catalogue_seats_before',l.limit_value,
    'catalogue_seats_after',b.included_seats,'source','business_billing_settings',
    'purchased_workspace_seats_unchanged',true)
from public.business_billing_settings b
join public.plans p on p.id=b.plan_id and p.workspace_type='business'
left join public.plan_limits l on l.plan_id=b.plan_id and l.limit_code='included_member_seats'
where l.plan_id is null or l.limit_value is distinct from b.included_seats;

insert into public.plan_limits(plan_id,limit_code,limit_value)
select b.plan_id,'included_member_seats',b.included_seats
from public.business_billing_settings b
join public.plans p on p.id=b.plan_id and p.workspace_type='business'
on conflict(plan_id,limit_code) do update set limit_value=excluded.limit_value
where public.plan_limits.limit_value is distinct from excluded.limit_value;

notify pgrst, 'reload schema';
commit;
