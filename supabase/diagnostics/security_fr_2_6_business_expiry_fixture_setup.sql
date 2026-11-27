-- Operator-only fixture preparation, not authorization acceptance.
-- Run only after local guards pass and immediately before the single pinned CI run.
-- No Auth, catalogue, pricing, Storage or ledger writes.
begin;
set local search_path=pg_catalog;
set local lock_timeout='1500ms';
set local statement_timeout='20s';
do $fixture$
declare v_workspace uuid; v_owner uuid; v_member uuid; v_member_row uuid; v_expiry timestamptz;
begin
  if not exists(select 1 from mushavo_email_install.rollout_control where singleton
    and target_project='dczlddwbtgvfdujgcitb' and mode='ACTIVE'
    and catalog_sha256='4646c0fe0367fe033b4594428f9c180eb96ca9b39ed2d1a2024bdc843804c3d7'
    and catalog_sha256=mushavo_email_install.catalog_identity()) then raise exception 'EXACT_STAGING_CATALOG_REQUIRED'; end if;
  select w.id,w.owner_id into strict v_workspace,v_owner
    from public.budget_workspaces w join auth.users u on u.id=w.owner_id
    where w.id='dcf3d122-e99f-4fe5-bbd1-03c3547629df'
      and w.name='audit-batch-x-receipt-d7be160c2026' and w.workspace_type='business'
      and w.status='suspended' and w.business_support_version=10
      and encode(sha256(convert_to(lower(u.email),'UTF8')),'hex')='78517e097a62a504568d89ea98e37c754446634cd03663e9edb9a6d5be5bab5d';
  select u.id,m.id into strict v_member,v_member_row from auth.users u join public.profiles p on p.id=u.id
    join public.workspace_members m on m.user_id=u.id and m.workspace_id=v_workspace
    where encode(sha256(convert_to(lower(u.email),'UTF8')),'hex')='e8afd004e7935fea5c2244534828c287c5d38854f21c10061b9d7f2faf071c71'
      and p.account_status='active' and m.status='inactive' and m.role='finance_manager'
      and not exists(select 1 from public.app_admins a where a.user_id=u.id);
  if not exists(select 1 from public.admin_subscription_grants where workspace_id=v_workspace and owner_id=v_owner
    and grant_kind='business_test' and reason='Generated staging receipt and spending request replay test')
    or (select count(*) from public.workspace_members where workspace_id=v_workspace and status='active')<>1
    or not exists(select 1 from public.workspace_members where workspace_id=v_workspace and user_id=v_owner
      and role='business_owner' and status='active')
    or exists(select 1 from public.workspace_invitations where workspace_id=v_workspace and status='pending')
    or exists(select 1 from public.business_member_scopes where workspace_id=v_workspace and member_id=v_member_row)
    or exists(select 1 from public.business_member_permissions where workspace_id=v_workspace and member_id=v_member_row)
    or exists(select 1 from auth.sessions where user_agent like 'Mushavo-Staging-Runner/%') then
    raise exception 'EXACT_IDLE_OWNER_ONLY_SYNTHETIC_FIXTURE_REQUIRED'; end if;
  v_expiry:=clock_timestamp()+interval '4 minutes';
  update public.workspace_subscriptions set paid_through_at=v_expiry,member_limit=2,version=version+1,updated_at=now()
    where workspace_id=v_workspace and status='active' and version=7 and member_limit=1
      and paid_through_at='2026-11-08T00:00:00Z' and entitlement_start_at='2026-11-06T00:00:00Z'
      and business_next_effective_at is null and business_next_member_limit is null;
  if not found then raise exception 'EXACT_ORIGINAL_SYNTHETIC_ENTITLEMENT_REQUIRED'; end if;
  perform set_config('mushavo.business_expiry.setup',jsonb_build_object('fixture_name','audit-batch-x-receipt-d7be160c2026',
    'expiry_at',v_expiry,'support_version',10,'subscription_version',8,'temporary_seats',2,
    'Auth_rows_changed',0,'ledger_rows_changed',0,'pricing_changed',false,'HTTP_acceptance',false)::text,true);
end;
$fixture$;
select current_setting('mushavo.business_expiry.setup')::jsonb as safe_result;
commit;
