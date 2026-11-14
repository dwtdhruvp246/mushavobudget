begin;
set local search_path=pg_catalog;
set local statement_timeout='10s';
set local lock_timeout='3s';
do $fixture$
begin
  if not exists (select 1 from mushavo_email_install.rollout_control where singleton and target_project='dczlddwbtgvfdujgcitb'
    and mode='ACTIVE' and catalog_sha256='d24dd762582191f53351bda17d4501193acf81f751d40d5406aad0a441f5bc6e' and catalog_sha256=mushavo_email_install.catalog_identity())
    or exists (select 1 from public.plans where id='21a10bd8-46c8-4b2c-9f04-783164611fa1' or code='audit_fr3_subscription_proof')
  then raise exception 'EXACT_SUBSCRIPTION_CATALOG_REQUIRED'; end if;
  insert into public.plans(id,code,display_name,workspace_type,is_active,is_public,available_for_purchase)
  values('21a10bd8-46c8-4b2c-9f04-783164611fa1','audit_fr3_subscription_proof','Staging subscription proof audit','personal',false,false,false);
  if not public.fr3_subscription_proof_gate_ready() then raise exception 'EXACT_SUBSCRIPTION_PROOF_GATE_REQUIRED'; end if;
end;
$fixture$;
select public.fr3_subscription_proof_gate_ready() as ready;
commit;
