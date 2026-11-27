-- Compensating cleanup only if the exact named synthetic Family remains after
-- the pinned HTTP run, with independent confirmation that its test files are
-- gone. Never delete Storage metadata with SQL. No existing Family is selected.
begin;
set local search_path=pg_catalog;
set local lock_timeout='1500ms';
set local statement_timeout='15s';
do $cleanup$
declare v_family uuid; v_workspace uuid;
begin
  if not exists(select 1 from mushavo_email_install.rollout_control where singleton
    and target_project='dczlddwbtgvfdujgcitb' and mode='ACTIVE'
    and catalog_sha256='4646c0fe0367fe033b4594428f9c180eb96ca9b39ed2d1a2024bdc843804c3d7'
    and catalog_sha256=mushavo_email_install.catalog_identity()) then raise exception 'EXACT_CORRECTED_STAGING_CATALOG_REQUIRED'; end if;
  select f.id,w.id into strict v_family,v_workspace from public.families f
    join public.budget_workspaces w on w.legacy_family_id=f.id join auth.users u on u.id=f.owner_id
    where f.name='audit-family-proof-policy-20261107' and w.workspace_type='household'
      and encode(sha256(convert_to(lower(u.email),'UTF8')),'hex')='78517e097a62a504568d89ea98e37c754446634cd03663e9edb9a6d5be5bab5d';
  if exists(select 1 from storage.objects where bucket_id='payment-proofs'
    and name like 'families/'||v_family::text||'/%') then raise exception 'PHYSICAL_STORAGE_API_CLEANUP_FIRST'; end if;
  if exists(select 1 from public.payment_items where workspace_id=v_workspace)
    or exists(select 1 from public.payment_records where workspace_id=v_workspace)
    or exists(select 1 from public.admin_subscription_grants where workspace_id=v_workspace) then
    raise exception 'EXACT_EMPTY_SYNTHETIC_FAMILY_REQUIRED'; end if;
  delete from public.families where id=v_family and name='audit-family-proof-policy-20261107';
  if exists(select 1 from public.budget_workspaces where id=v_workspace) then raise exception 'SYNTHETIC_WORKSPACE_CASCADE_REQUIRED'; end if;
  perform set_config('mushavo.family_cleanup.safe_result',jsonb_build_object('synthetic_family_removed',true,
    'synthetic_workspace_removed',true,'Storage_metadata_modified_by_SQL',false,'HTTP_acceptance',false)::text,true);
end;
$cleanup$;
select current_setting('mushavo.family_cleanup.safe_result')::jsonb as safe_result;
commit;
