begin;
set local search_path=pg_catalog;
set local statement_timeout='10s';
set local lock_timeout='3s';
do $fixture$
begin
  if not exists (select 1 from mushavo_email_install.rollout_control where singleton and target_project='dczlddwbtgvfdujgcitb'
    and mode='ACTIVE' and catalog_sha256='2b811cd6eb5528f16d835d26e978284137e7f52fef427e323c6a3906b3f41f44' and catalog_sha256=mushavo_email_install.catalog_identity())
    or exists (select 1 from public.plan_prices where plan_id='21a10bd8-46c8-4b2c-9f04-783164611fa1')
    or exists (select 1 from public.subscription_payments where workspace_id='017513c6-ce57-48af-b902-9552faeb83dd')
  then raise exception 'SUBSCRIPTION_BROWSER_EMPTY_SCOPE_REQUIRED'; end if;
  update public.plans set code='audit_fr3_subscription_proof' where id='21a10bd8-46c8-4b2c-9f04-783164611fa1'
    and code='audit_fr3_subscription_proof_archived' and not is_active and not is_public and not available_for_purchase;
  if not found or not public.fr3_subscription_proof_gate_ready() then raise exception 'EXACT_SUBSCRIPTION_BROWSER_GATE_REQUIRED'; end if;
end;
$fixture$;
select public.fr3_subscription_proof_gate_ready() ready;
commit;
