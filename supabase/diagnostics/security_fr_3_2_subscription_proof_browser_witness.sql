-- Staging-only witness. The real renewal routine runs in a subtransaction.
begin;
set local search_path = pg_catalog;
set local lock_timeout = '3s';
set local statement_timeout = '20s';
select pg_advisory_xact_lock(20261017, 2411);

do $preflight$
begin
  if not exists (
    select 1 from mushavo_email_install.rollout_control
    where singleton and target_project = 'dczlddwbtgvfdujgcitb' and mode = 'ACTIVE'
      and catalog_sha256 = 'd24dd762582191f53351bda17d4501193acf81f751d40d5406aad0a441f5bc6e'
      and catalog_sha256 = mushavo_email_install.catalog_identity()
  ) or to_regprocedure('public.fr3_subscription_proof_browser_witness(text,text,bigint)') is not null
    or (select md5(prosrc) from pg_proc where oid =
      'public.submit_subscription_renewal(uuid,text,integer,text,text,numeric,text,date,text,text,text,text,text,bigint)'::regprocedure)
      is distinct from 'eba948bce02157a78f8cc19d9b33f157'
  then raise exception 'EXACT_SUBSCRIPTION_BROWSER_BASELINE_REQUIRED'; end if;
end;
$preflight$;

create function public.fr3_subscription_proof_browser_witness(
  p_path text, p_name text, p_size bigint
) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $witness$
declare
  fixture_workspace constant uuid := '017513c6-ce57-48af-b902-9552faeb83dd';
  fixture_owner constant uuid := 'ca7bdcf2-e69d-42e2-8ae8-79cac6de2184';
  fixture_plan constant uuid := '21a10bd8-46c8-4b2c-9f04-783164611fa1';
  fixture_code constant text := 'audit_fr3_subscription_proof';
  fixture_ref constant text := 'AUDIT-FR3-SUBSCRIPTION-BROWSER-20261114';
  fixture_prefix constant text := 'workspaces/017513c6-ce57-48af-b902-9552faeb83dd/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr3-subscription-proof/';
  receipt jsonb;
  v_payment_id uuid;
  v_request_id uuid;
  v_invoice_id uuid;
begin
  perform mushavo_email_auth.require_application_session();
  if auth.uid() is distinct from fixture_owner or current_setting('role', true) is distinct from 'authenticated' then
    raise exception 'SUBSCRIPTION_PROOF_FIXTURE_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if not public.fr3_subscription_proof_gate_ready() then
    return null;
  end if;
  if p_path is null and p_name is null and p_size is null then
    return jsonb_build_object('plan_id',fixture_plan,'code',fixture_code,'currency','USD','amount',1);
  end if;
  if p_path is null or not starts_with(p_path, fixture_prefix)
    or substring(p_path from length(fixture_prefix)+1) !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}[.]pdf$'
    or p_name is distinct from 'synthetic-subscription-proof.pdf' or p_size is null or p_size not between 1 and 2097152
  then raise exception 'SUBSCRIPTION_PROOF_BROWSER_INPUT_REQUIRED'; end if;

  begin
    update public.plans set is_active = true where id = fixture_plan and code = fixture_code and not is_active
      and not is_public and not available_for_purchase;
    if not found then raise exception 'SUBSCRIPTION_PROOF_BROWSER_PLAN_REQUIRED'; end if;
    insert into public.plan_prices (plan_id,billing_period,currency,amount,effective_from)
    values (fixture_plan,'monthly','USD',1,now()-interval '1 minute');

    v_payment_id := public.submit_subscription_renewal(fixture_workspace,fixture_code,1,'monthly','USD',1,
      'Other',current_date,fixture_ref,null,p_path,p_name,'application/pdf',p_size);
    select req.id,inv.id into v_request_id,v_invoice_id
      from public.subscription_payments pay
      join public.subscription_renewal_requests req on req.id = pay.renewal_request_id
      join public.subscription_invoices inv on inv.id = req.invoice_id
      join public.subscription_payment_proofs proof on proof.payment_id = pay.id
      where pay.id = v_payment_id and pay.workspace_id = fixture_workspace and pay.submitted_by = fixture_owner
        and pay.reference_number = fixture_ref and pay.status = 'pending_review' and pay.amount = 1 and pay.currency = 'USD'
        and req.requested_plan_id = fixture_plan and inv.total_amount = 1 and proof.uploaded_by = fixture_owner
        and proof.storage_path = p_path and proof.original_name = p_name and proof.mime_type = 'application/pdf'
        and proof.size_bytes = p_size;
    if not found then raise exception 'EXACT_SUBSCRIPTION_BROWSER_LINK_REQUIRED'; end if;
    receipt := jsonb_build_object('payment_linked',true,'proof_size',p_size,'proof_mime','application/pdf',
      'notification_rows_before_rollback',(select count(*) from public.admin_notification_outbox where source_id=v_payment_id));
    raise exception 'SUBSCRIPTION_BROWSER_WITNESS_COMPLETE' using errcode = 'MB001';
  exception when sqlstate 'MB001' then
    if receipt is null then raise; end if;
  end;

  if exists (select 1 from public.subscription_payments p where p.id=v_payment_id)
    or exists (select 1 from public.subscription_renewal_requests r where r.id=v_request_id)
    or exists (select 1 from public.subscription_invoices i where i.id=v_invoice_id)
    or exists (select 1 from public.subscription_payment_proofs p where p.payment_id=v_payment_id)
    or exists (select 1 from public.subscription_audit_events a where a.target_id=v_request_id)
    or exists (select 1 from public.plan_prices pp where pp.plan_id=fixture_plan)
    or exists (select 1 from public.admin_notification_outbox n where n.source_id=v_payment_id)
    or not public.fr3_subscription_proof_gate_ready()
  then raise exception 'SUBSCRIPTION_BROWSER_ROLLBACK_REQUIRED'; end if;
  return receipt || jsonb_build_object('rolled_back',true);
end;
$witness$;
revoke all on function public.fr3_subscription_proof_browser_witness(text,text,bigint) from public, anon, authenticated, service_role;
grant execute on function public.fr3_subscription_proof_browser_witness(text,text,bigint) to authenticated;

do $stamp$
begin
  update mushavo_email_install.rollout_control set
    catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
  where singleton and target_project='dczlddwbtgvfdujgcitb' and mode='ACTIVE'
    and catalog_sha256='d24dd762582191f53351bda17d4501193acf81f751d40d5406aad0a441f5bc6e';
  if not found then raise exception 'SUBSCRIPTION_BROWSER_CATALOG_CHANGED'; end if;
end;
$stamp$;
notify pgrst,'reload schema';
commit;
