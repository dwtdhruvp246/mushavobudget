-- Compensation only when CI never activated the fixture (no new member or session).
-- Normal completion restores through real authenticated Admin/Owner operations.
begin;
set local search_path=pg_catalog;
set local lock_timeout='1500ms';
set local statement_timeout='20s';
do $restore$
declare v_workspace uuid;
begin
  if not exists(select 1 from mushavo_email_install.rollout_control where singleton
    and target_project='dczlddwbtgvfdujgcitb' and mode='ACTIVE'
    and catalog_sha256='4646c0fe0367fe033b4594428f9c180eb96ca9b39ed2d1a2024bdc843804c3d7'
    and catalog_sha256=mushavo_email_install.catalog_identity()) then raise exception 'EXACT_STAGING_CATALOG_REQUIRED'; end if;
  select w.id into strict v_workspace from public.budget_workspaces w join auth.users u on u.id=w.owner_id
    where w.id='dcf3d122-e99f-4fe5-bbd1-03c3547629df' and w.name='audit-batch-x-receipt-d7be160c2026'
      and w.workspace_type='business' and w.status='suspended' and w.business_support_version=10
      and encode(sha256(convert_to(lower(u.email),'UTF8')),'hex')='78517e097a62a504568d89ea98e37c754446634cd03663e9edb9a6d5be5bab5d';
  if exists(select 1 from public.workspace_members where workspace_id=v_workspace and status='active' and role<>'business_owner')
    or exists(select 1 from public.workspace_invitations where workspace_id=v_workspace and status='pending')
    or exists(select 1 from auth.sessions where user_agent like 'Mushavo-Staging-Runner/%') then
    raise exception 'UNTOUCHED_IDLE_FIXTURE_REQUIRED'; end if;
  update public.workspace_subscriptions set paid_through_at='2026-11-08T00:00:00Z',member_limit=1,version=version+1,updated_at=now()
    where workspace_id=v_workspace and status='active' and version=8 and member_limit=2
      and paid_through_at>'2026-11-07T00:00:00Z' and paid_through_at<'2026-11-08T00:00:00Z'
      and entitlement_start_at='2026-11-06T00:00:00Z';
  if not found then raise exception 'EXACT_TEMPORARY_EXPIRY_ENTITLEMENT_REQUIRED'; end if;
  perform set_config('mushavo.business_expiry.restore',jsonb_build_object('untouched_fixture_restored',true,
    'fixture_suspended',true,'original_seats',1,'original_paid_through_at','2026-11-08T00:00:00Z',
    'Auth_rows_changed',0,'ledger_rows_changed',0,'HTTP_acceptance',false)::text,true);
end;
$restore$;
select current_setting('mushavo.business_expiry.restore')::jsonb as safe_result;
commit;
