-- Staging only. Exercise two isolated Business billing paths with a private plan.
begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
set local statement_timeout='20s';
select pg_advisory_xact_lock(20261017,2411);
do $preflight$
begin
  if not exists(select 1 from mushavo_email_install.rollout_control where singleton and mode='ACTIVE'
    and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='4fb5bedf8ff8dd4ebd5bbef1ba416f8d89efec8886b9fb1af1c50880999ba2be' and catalog_sha256=mushavo_email_install.catalog_identity())
    or not exists(select 1 from public.budget_workspaces where id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and status='suspended' and business_support_version=54)
    or not exists(select 1 from public.workspace_subscriptions where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and version=1
      and status='active' and plan_id='0ccf35bb-43c7-4c1b-9148-0f352b85bd2a' and paid_through_at='2026-11-14 00:00:00+00'
      and billing_anchor_at='2026-11-12 00:00:00+00' and entitlement_start_at='2026-11-12 00:00:00+00' and member_limit=1)
    or not exists(select 1 from public.budget_workspaces where id='017513c6-ce57-48af-b902-9552faeb83dd' and owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and status='active')
    or exists(select 1 from public.plans where workspace_type='business' and available_for_purchase)
    or exists(select 1 from public.business_public_purchases where owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and status='pending_review')
    or exists(select 1 from public.subscription_renewal_requests where workspace_id in ('8d9307e6-aada-4c9a-a8f5-43c57e0865e2','017513c6-ce57-48af-b902-9552faeb83dd') and status='pending_review')
    or exists(select 1 from public.fr32_subscription_flow_scope where lane in ('business-purchase','business-extra'))
  then raise exception 'EXACT_BUSINESS_BILLING_STAGING_BASELINE_REQUIRED'; end if;
end;
$preflight$;
update public.plans set is_active=true where id='0b8eacc8-eae9-4b83-89f8-d8684fe05c9a' and not is_public and not available_for_purchase;
update public.business_billing_settings set pilot_enabled=true where plan_id='0b8eacc8-eae9-4b83-89f8-d8684fe05c9a'
  and not pilot_enabled and included_seats=1 and monthly_base=1 and monthly_seat=1;
update public.workspace_subscriptions set plan_id='0b8eacc8-eae9-4b83-89f8-d8684fe05c9a',
  entitlement_start_at=now()-interval '1 minute', billing_anchor_at=now()-interval '1 minute',
  paid_through_at=now()+interval '1 month'-interval '1 minute'
where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and plan_id='0ccf35bb-43c7-4c1b-9148-0f352b85bd2a' and version=1;
insert into public.fr32_subscription_flow_scope(lane,workspace_id,plan_id,expires_at) values
  ('business-purchase','017513c6-ce57-48af-b902-9552faeb83dd','0b8eacc8-eae9-4b83-89f8-d8684fe05c9a',now()+interval '2 hours'),
  ('business-extra','8d9307e6-aada-4c9a-a8f5-43c57e0865e2','0b8eacc8-eae9-4b83-89f8-d8684fe05c9a',now()+interval '2 hours');
do $apply$
declare entry record; source text;
begin
  for entry in select * from (values
    ('public.submit_business_plan_request(uuid,text,integer,text,text,text,numeric,integer,text,date,text,text,text,text,text,bigint,uuid)'::regprocedure,$old$or not p.available_for_purchase$old$,$new$or (p.code<>'audit_fr32_business' and not p.available_for_purchase)
    or (p.code='audit_fr32_business' and (public.fr32_subscription_scope_allowed('business-purchase',w.id,p.id) is true
      and p_reference_number='FR32-SYNTHETIC-20261115-business-purchase'
      and split_part(coalesce(p_proof_path,''),'/',4)='fr32-billing-business-purchase') is not true)$new$),
    ('public.notify_admins_on_subscription_payment()'::regprocedure,$old$if new.status = 'pending_review' then$old$,$new$if new.status = 'pending_review' and not (
    new.submitted_by='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and exists (
      select 1 from public.fr32_subscription_flow_scope f
      join public.subscription_renewal_requests r on r.id=new.renewal_request_id and r.requested_plan_id=f.plan_id
      where f.lane in ('business-purchase','business-extra')
        and f.workspace_id=new.workspace_id and new.reference_number='FR32-SYNTHETIC-20261115-'||f.lane
    )
  ) then$new$)
  ) v(signature,old_fragment,new_fragment)
  loop
    source:=pg_get_functiondef(entry.signature);
    if (length(source)-length(replace(source,entry.old_fragment,'')))/length(entry.old_fragment)<>1 then
      raise exception 'EXPECTED_BUSINESS_BILLING_ROUTINE_REQUIRED';
    end if;
    execute replace(source,entry.old_fragment,entry.new_fragment);
  end loop;
end;
$apply$;
do $verify$
begin
  if public.fr32_subscription_flow_ready('business-purchase') is distinct from '017513c6-ce57-48af-b902-9552faeb83dd'::uuid
    or public.fr32_subscription_flow_ready('business-extra') is not null
    or public.business_public_price_ready('0b8eacc8-eae9-4b83-89f8-d8684fe05c9a') is not true
  then raise exception 'EXACT_PRIVATE_BILLING_TERM_REQUIRED'; end if;
end;
$verify$;
update mushavo_email_install.rollout_control set catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
where singleton and catalog_sha256='4fb5bedf8ff8dd4ebd5bbef1ba416f8d89efec8886b9fb1af1c50880999ba2be' and mode='ACTIVE' and target_project='dczlddwbtgvfdujgcitb';
notify pgrst,'reload schema';
commit;
