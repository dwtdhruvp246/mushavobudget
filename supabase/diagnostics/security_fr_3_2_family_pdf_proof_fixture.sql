-- Provision only the two verified ordinary test accounts in an empty Family fixture.
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
    and catalog_sha256 = 'c0c3fff907241a6bbcde1ab2be13d3879869338a869a37a08e6012f70c2ab8fd'
    and catalog_sha256=mushavo_email_install.catalog_identity()) then raise exception 'EXACT_CORRECTED_STAGING_CATALOG_REQUIRED'; end if;
  select u.id,u.email into strict v_owner,v_owner_email from auth.users u join public.profiles p on p.id=u.id
    where encode(sha256(convert_to(lower(u.email),'UTF8')),'hex')='78517e097a62a504568d89ea98e37c754446634cd03663e9edb9a6d5be5bab5d'
      and p.account_status='active' and not exists(select 1 from public.app_admins a where a.user_id=u.id);
  select u.id,u.email into strict v_member,v_member_email from auth.users u join public.profiles p on p.id=u.id
    where encode(sha256(convert_to(lower(u.email),'UTF8')),'hex')='e8afd004e7935fea5c2244534828c287c5d38854f21c10061b9d7f2faf071c71'
      and p.account_status='active' and not exists(select 1 from public.app_admins a where a.user_id=u.id);
  if v_owner <> 'ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' or v_member <> '660a1463-6589-4c4d-ab6c-8ee50161038f' or exists(select 1 from public.families where owner_id=v_owner
    or id='08e8f0ca-9cc4-4ea5-8544-b14a9b1cf37c' or name='audit-fr3-family-proof-20261113') then raise exception 'NEW_ISOLATED_FAMILY_FIXTURE_REQUIRED'; end if;
  insert into public.families(id,owner_id,owner_email,name,monthly_budget,currency)
    values('08e8f0ca-9cc4-4ea5-8544-b14a9b1cf37c',v_owner,lower(v_owner_email),'audit-fr3-family-proof-20261113',0,'USD') returning id into v_family;
  insert into public.family_members(family_id,user_id,created_by,name,role,email,status)
    values(v_family,v_owner,v_owner,'Synthetic proof owner','Owner',lower(v_owner_email),'active'),
      (v_family,v_member,v_owner,'Synthetic proof member','Adult',lower(v_member_email),'active');
  select id into strict v_workspace from public.budget_workspaces where legacy_family_id=v_family
    and owner_id=v_owner and workspace_type='household' and name='audit-fr3-family-proof-20261113';
  update public.workspace_subscriptions set entitlement_start_at=now()-interval '1 minute',
    paid_through_at=now()+interval '2 hours',member_limit=2
    where workspace_id=v_workspace and status='active'
      and plan_id in(select id from public.plans where code='household');
  if not found then raise exception 'SYNTHETIC_HOUSEHOLD_ENTITLEMENT_REQUIRED'; end if;
  if (select count(*) from public.family_members where family_id=v_family and status='active')<>2 then
    raise exception 'EXACT_TWO_TEST_MEMBERS_REQUIRED'; end if;
  perform set_config('mushavo.family_proof.safe_result',jsonb_build_object('fixture_name','audit-fr3-family-proof-20261113',
    'family_id',v_family,'workspace_id',v_workspace,'family_rows_created',1,'workspace_rows_created',1,'active_legacy_members',2,
    'fixture_entitlement_hours',2,'provider_charges',0,'Auth_rows_changed',0,
    'application_provisioning_acceptance',false)::text,true);
end;
$fixture$;
select current_setting('mushavo.family_proof.safe_result')::jsonb as safe_result;
commit;
