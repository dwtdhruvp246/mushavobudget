-- After a successful HTTP run restores members/seats and suspends the fixture,
-- put back the original exact expiry. No Auth, pricing, catalogue, ledger or Storage mutation.
begin;
set local search_path=pg_catalog;
set local lock_timeout='1500ms';
set local statement_timeout='15s';
do $restore$
declare v_workspace uuid; v_member uuid;
begin
  if not exists(select 1 from mushavo_email_install.rollout_control where singleton
    and target_project='dczlddwbtgvfdujgcitb' and mode='ACTIVE'
    and catalog_sha256='4646c0fe0367fe033b4594428f9c180eb96ca9b39ed2d1a2024bdc843804c3d7'
    and catalog_sha256=mushavo_email_install.catalog_identity()) then raise exception 'EXACT_STAGING_CATALOG_REQUIRED'; end if;
  select w.id into strict v_workspace from public.budget_workspaces w join auth.users u on u.id=w.owner_id
    where w.id='dcf3d122-e99f-4fe5-bbd1-03c3547629df' and w.name='audit-batch-x-receipt-d7be160c2026'
      and w.workspace_type='business' and w.status='suspended' and w.business_support_version=12
      and encode(sha256(convert_to(lower(u.email),'UTF8')),'hex')='78517e097a62a504568d89ea98e37c754446634cd03663e9edb9a6d5be5bab5d';
  select id into strict v_member from auth.users
    where encode(sha256(convert_to(lower(email),'UTF8')),'hex')='e8afd004e7935fea5c2244534828c287c5d38854f21c10061b9d7f2faf071c71';
  if (select count(*) from public.workspace_members where workspace_id=v_workspace and status='active')<>1
    or exists(select 1 from public.workspace_members where workspace_id=v_workspace and user_id=v_member and status='active')
    or exists(select 1 from public.workspace_invitations where workspace_id=v_workspace and status='pending')
    or exists(select 1 from public.business_member_scopes s join public.workspace_members m on m.id=s.member_id
      where s.workspace_id=v_workspace and m.user_id=v_member)
    or exists(select 1 from public.business_member_permissions p join public.workspace_members m on m.id=p.member_id
      where p.workspace_id=v_workspace and m.user_id=v_member)
    or exists(select 1 from auth.sessions where user_agent like 'Mushavo-Staging-Runner/%') then
    raise exception 'COMPLETED_HTTP_CLEANUP_AND_ISOLATION_REQUIRED'; end if;
  update public.workspace_subscriptions set paid_through_at='2026-11-08T00:00:00Z',version=version+1,updated_at=now()
    where workspace_id=v_workspace and status='active' and member_limit=1 and version=10
      and paid_through_at='2026-11-09T00:00:00Z' and entitlement_start_at='2026-11-06T00:00:00Z';
  if not found then raise exception 'EXACT_TEMPORARY_CLEANUP_TERM_REQUIRED'; end if;
  perform set_config('mushavo.business_expiry.restore',jsonb_build_object('original_term_restored',true,
    'fixture_suspended',true,'original_seats',1,'original_paid_through_at','2026-11-08T00:00:00Z',
    'subscription_version',11,'Auth_rows_changed',0,'ledger_rows_changed',0,'HTTP_acceptance',false)::text,true);
end;
$restore$;
select current_setting('mushavo.business_expiry.restore')::jsonb as safe_result;
commit;
