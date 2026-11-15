-- Staging only. Restore the archived billing fixture and keep linked synthetic receipts.
begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
select pg_advisory_xact_lock(20261017,2411);
do $verify$
begin
  if not exists(select 1 from mushavo_email_install.rollout_control where singleton and mode='ACTIVE'
    and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='db545acd2fe42d1a9421061b416e21ab5f1a477314b954047f4171dccafee42c' and catalog_sha256=mushavo_email_install.catalog_identity())
    or not exists(select 1 from public.budget_workspaces where id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and status='suspended' and business_support_version=56)
    or (select count(*) from public.fr32_subscription_flow_files f
      join public.subscription_payment_proofs pr on pr.storage_path=f.path
      join public.subscription_payments p on p.id=pr.payment_id
      join public.subscription_renewal_requests r on r.id=p.renewal_request_id
      join public.subscription_invoices i on i.id=r.invoice_id
      join storage.objects o on o.bucket_id='subscription-proofs' and o.name=f.path
      where f.state='linked' and f.lane in ('business-extra','business-purchase')
        and p.reference_number='FR32-SYNTHETIC-20261115-'||f.lane and p.submitted_by='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'
        and p.status='rejected' and r.status='rejected' and i.status='rejected'
        and exists(select 1 from public.subscription_payment_reviews rev where rev.payment_id=p.id and decision='rejected'))<>2
    or exists(select 1 from public.plans where workspace_type='business' and available_for_purchase)
  then raise exception 'EXACT_BUSINESS_BILLING_STAGING_RESULT_REQUIRED'; end if;

  update public.workspace_subscriptions set plan_id='0ccf35bb-43c7-4c1b-9148-0f352b85bd2a',paid_through_at='2026-11-14 00:00:00+00',
    entitlement_start_at='2026-11-12 00:00:00+00',billing_anchor_at='2026-11-12 00:00:00+00'
    where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and plan_id='0b8eacc8-eae9-4b83-89f8-d8684fe05c9a' and version=1 and member_limit=1
      and paid_through_at='2026-12-15 15:15:55.809888+00' and entitlement_start_at='2026-11-15 15:15:55.809888+00'
      and billing_anchor_at='2026-11-15 15:15:55.809888+00';
  if not found then raise exception 'EXACT_BUSINESS_SUBSCRIPTION_RESTORE_REQUIRED'; end if;
  update public.business_billing_settings set pilot_enabled=false where plan_id='0b8eacc8-eae9-4b83-89f8-d8684fe05c9a' and pilot_enabled;
  update public.plans set is_active=false where id='0b8eacc8-eae9-4b83-89f8-d8684fe05c9a' and not available_for_purchase and not is_public;
  update public.fr32_subscription_flow_scope set expires_at=least(expires_at,now())
  where lane in ('business-extra','business-purchase');
end;
$verify$;
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
    if (length(source)-length(replace(source,entry.new_fragment,'')))/length(entry.new_fragment)<>1 then
      raise exception 'EXPECTED_BUSINESS_BILLING_ROUTINE_REQUIRED';
    end if;
    execute replace(source,entry.new_fragment,entry.old_fragment);
  end loop;
end;
$apply$;
update mushavo_email_install.rollout_control set catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
where singleton and catalog_sha256='db545acd2fe42d1a9421061b416e21ab5f1a477314b954047f4171dccafee42c' and mode='ACTIVE' and target_project='dczlddwbtgvfdujgcitb';
notify pgrst,'reload schema';
commit;
