-- Allow the exact synthetic Family term to satisfy the existing active owner check.
begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
select pg_advisory_xact_lock(20261017,2411);
do $fixture$
declare
  old_fragment text := $old$entitlement.plan_code = 'household'$old$;
  stage_fragment text := $new$(entitlement.plan_code = 'household' or (
          entitlement.plan_code = 'audit_fr32_household'
          and public.fr32_subscription_scope_allowed('family-extra',workspaces.id,'d840e33d-01f3-44cb-bbac-59be071c3139') is true
        ))$new$;
  v_source text;
begin
  if not exists (
    select 1 from mushavo_email_install.rollout_control where singleton and target_project='dczlddwbtgvfdujgcitb'
      and mode='ACTIVE' and catalog_sha256='7998b0bc6074ac872c4ca169910db6d0f1e04a6e85e9f4562a450988645bffdd' and catalog_sha256=mushavo_email_install.catalog_identity()
  ) or public.fr32_subscription_flow_ready('family-extra') is null
  then raise exception 'EXACT_ACTIVE_FAMILY_EXTRA_FIXTURE_REQUIRED'; end if;
  v_source := pg_get_functiondef('public.can_manage_family_members(uuid)'::regprocedure);
  if (length(v_source)-length(replace(v_source,old_fragment,'')))/length(old_fragment)<>1 then
    raise exception 'EXPECTED_FAMILY_ENTITLEMENT_CHECK_REQUIRED';
  end if;
  execute replace(v_source,old_fragment,stage_fragment);
  update mushavo_email_install.rollout_control set catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
    where singleton and catalog_sha256='7998b0bc6074ac872c4ca169910db6d0f1e04a6e85e9f4562a450988645bffdd';
end;
$fixture$;
notify pgrst,'reload schema';
commit;
