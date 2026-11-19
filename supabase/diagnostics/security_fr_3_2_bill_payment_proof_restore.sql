-- Restore the staged profile and term after the isolated bill-payment proof check.
begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
select pg_advisory_xact_lock(20261017,2411);
do $restore$
declare touched integer;
begin
 if not exists(select 1 from mushavo_email_install.rollout_control where singleton and mode='ACTIVE'
   and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='c06956b73f8f42cd8ef06bc25219875788e15c91ff9a9039d1fe04cd17a5e222' and catalog_sha256=mushavo_email_install.catalog_identity())
  or not exists(select 1 from public.budget_workspaces ws where ws.id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and ws.owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'
    and ws.status='suspended' and ws.business_support_version in (48,50))
  or public.fr3_bill_payment_proof_gate_ready() or public.fr3_lifecycle_trial_ready()
  or exists(select 1 from public.business_documents d where d.workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and d.status='active'
      and (d.id<>'ef6fb184-5e10-44b8-9d8a-a4ed532733c7' or d.parent_type<>'business_bill_payment' or d.parent_id<>'89fd5fb1-d177-4c3a-ad7a-3ba4ec34a120' or d.uploaded_by<>'ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'))
  or exists(select 1 from storage.objects o where o.bucket_id='business-documents' and o.name like 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/%'
    and not exists(select 1 from public.business_documents d where d.id='ef6fb184-5e10-44b8-9d8a-a4ed532733c7' and d.workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2'
     and d.parent_id='89fd5fb1-d177-4c3a-ad7a-3ba4ec34a120' and d.storage_path=o.name and d.status='active'))
 then raise exception 'EXACT_BILL_PAYMENT_PROOF_RESTORE_REQUIRED'; end if;
 update public.business_profiles set onboarding_status='in_progress'
  where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and onboarding_status='complete' and version=22;
 get diagnostics touched=row_count;
 if touched<>1 then raise exception 'EXACT_BILL_PROOF_ONBOARDING_RESTORE_REQUIRED'; end if;
 update public.workspace_subscriptions set paid_through_at='2026-11-14 00:00:00+00'
  where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and status='active' and version=1 and member_limit=1
  and paid_through_at='2026-11-15 10:09:41.784914+00'::timestamptz;
 get diagnostics touched=row_count;
 if touched<>1 then raise exception 'EXACT_BILL_PROOF_TERM_RESTORE_REQUIRED'; end if;
end;
$restore$;
commit;
