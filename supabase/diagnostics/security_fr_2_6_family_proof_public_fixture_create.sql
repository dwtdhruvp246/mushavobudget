-- Operator-only setup of public synthetic data. The first genuine HTTP run
-- verified the Owner member-removal control. No Auth session/user/proof writes
-- are needed for this follow-up; the runner signs in normally.
begin;
set local search_path=pg_catalog;
set local lock_timeout='1500ms';
set local statement_timeout='20s';
do $fixture$
declare
  v_owner uuid; v_member uuid; v_owner_email text; v_member_email text;
  v_family uuid; v_workspace uuid;
begin
  if not exists(select 1 from mushavo_email_install.rollout_control where singleton
    and target_project='dczlddwbtgvfdujgcitb' and mode='ACTIVE'
    and catalog_sha256='4646c0fe0367fe033b4594428f9c180eb96ca9b39ed2d1a2024bdc843804c3d7'
    and catalog_sha256=mushavo_email_install.catalog_identity()) then raise exception 'EXACT_CORRECTED_STAGING_CATALOG_REQUIRED'; end if;
  select u.id,u.email into strict v_owner,v_owner_email from auth.users u join public.profiles p on p.id=u.id
    where encode(sha256(convert_to(lower(u.email),'UTF8')),'hex')='78517e097a62a504568d89ea98e37c754446634cd03663e9edb9a6d5be5bab5d'
      and p.account_status='active' and not exists(select 1 from public.app_admins a where a.user_id=u.id);
  select u.id,u.email into strict v_member,v_member_email from auth.users u join public.profiles p on p.id=u.id
    where encode(sha256(convert_to(lower(u.email),'UTF8')),'hex')='e8afd004e7935fea5c2244534828c287c5d38854f21c10061b9d7f2faf071c71'
      and p.account_status='active' and not exists(select 1 from public.app_admins a where a.user_id=u.id);
  if v_owner=v_member or exists(select 1 from public.families where owner_id=v_owner
    or name='audit-family-proof-policy-20261107') then raise exception 'NEW_ISOLATED_FAMILY_FIXTURE_REQUIRED'; end if;
  insert into public.families(owner_id,owner_email,name,monthly_budget,currency)
    values(v_owner,lower(v_owner_email),'audit-family-proof-policy-20261107',0,'USD') returning id into v_family;
  insert into public.family_members(family_id,user_id,created_by,name,role,email,status)
    values(v_family,v_owner,v_owner,'Synthetic proof owner','Owner',lower(v_owner_email),'active'),
      (v_family,v_member,v_owner,'Synthetic proof member','Adult',lower(v_member_email),'active');
  select id into strict v_workspace from public.budget_workspaces where legacy_family_id=v_family
    and owner_id=v_owner and workspace_type='household' and name='audit-family-proof-policy-20261107';
  update public.workspace_subscriptions set entitlement_start_at=now()-interval '1 minute',
    paid_through_at=now()+interval '1 hour',member_limit=2
    where workspace_id=v_workspace and status='active'
      and plan_id in(select id from public.plans where code='household');
  if not found then raise exception 'SYNTHETIC_HOUSEHOLD_ENTITLEMENT_REQUIRED'; end if;
  if (select count(*) from public.family_members where family_id=v_family and status='active')<>2 then
    raise exception 'EXACT_TWO_TEST_MEMBERS_REQUIRED'; end if;
  perform set_config('mushavo.family_proof.safe_result',jsonb_build_object('fixture_name','audit-family-proof-policy-20261107',
    'family_id',v_family,'family_rows_created',1,'workspace_rows_created',1,'active_legacy_members',2,
    'fixture_entitlement_hours',1,'provider_charges',0,'Auth_rows_changed',0,
    'application_provisioning_acceptance',false)::text,true);
end;
$fixture$;
select current_setting('mushavo.family_proof.safe_result')::jsonb as safe_result;
commit;
