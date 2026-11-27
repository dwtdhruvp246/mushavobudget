begin;
set local search_path=pg_catalog;
set local statement_timeout='10s';
set local lock_timeout='3s';
do $close$
begin
  if not public.fr3_subscription_proof_gate_ready()
    or not exists (select 1 from mushavo_email_install.rollout_control where singleton and mode='ACTIVE' and target_project='dczlddwbtgvfdujgcitb'
      and catalog_sha256='d24dd762582191f53351bda17d4501193acf81f751d40d5406aad0a441f5bc6e' and catalog_sha256=mushavo_email_install.catalog_identity())
    or exists (select 1 from public.subscription_renewal_requests where requested_plan_id='21a10bd8-46c8-4b2c-9f04-783164611fa1')
    or exists (select 1 from public.plan_prices where plan_id='21a10bd8-46c8-4b2c-9f04-783164611fa1')
    or exists (select 1 from storage.objects where bucket_id='subscription-proofs' and
      starts_with(name,'workspaces/017513c6-ce57-48af-b902-9552faeb83dd/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr3-subscription-proof/'))
  then raise exception 'EXACT_SUBSCRIPTION_CLEANUP_REQUIRED'; end if;
  update public.plans set code='audit_fr3_subscription_proof_archived' where id='21a10bd8-46c8-4b2c-9f04-783164611fa1'
    and code='audit_fr3_subscription_proof' and not is_active and not is_public and not available_for_purchase;
  if not found or public.fr3_subscription_proof_gate_ready() then raise exception 'EXACT_SUBSCRIPTION_MARKER_CLOSE_REQUIRED'; end if;
end;
$close$;
select not public.fr3_subscription_proof_gate_ready() as fixture_gate_closed;
commit;
