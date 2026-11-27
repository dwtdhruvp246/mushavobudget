-- Compensating isolation only after the pinned HTTP finance run attempted
-- activation and independent readback confirms this exact fixture is active.
-- These modeled sessions are recovery tooling, not real HTTP acceptance.
-- Retain the synthetic finance/audit records; never delete Storage metadata.
begin;
set local search_path=pg_catalog;
set local lock_timeout='1500ms';
set local statement_timeout='20s';
do $isolate$
declare
  v_workspace uuid;
  v_owner uuid;
  v_other uuid;
  v_admin uuid;
  v_support integer;
  v_sub_version integer;
  v_seats integer;
  v_id uuid;
  v_owner_session uuid:=gen_random_uuid();
  v_admin_session uuid:=gen_random_uuid();
begin
  if not exists(select 1 from mushavo_email_install.rollout_control
    where singleton and target_project='dczlddwbtgvfdujgcitb' and mode='ACTIVE'
      and catalog_sha256='e902fca1d972f7cb76a0cc7b8f5ca649f24dfd2ae198cc77a1d96526a82172e8'
      and catalog_sha256=mushavo_email_install.catalog_identity()) then raise exception 'EXACT_STAGING_CATALOG_REQUIRED'; end if;
  select w.id,w.owner_id,w.business_support_version into strict v_workspace,v_owner,v_support
    from public.budget_workspaces w join auth.users u on u.id=w.owner_id
    where w.name='audit-batch-x-receipt-d7be160c2026' and w.workspace_type='business'
      and w.status='active' and w.business_support_version=7
      and encode(sha256(convert_to(lower(u.email),'UTF8')),'hex')='78517e097a62a504568d89ea98e37c754446634cd03663e9edb9a6d5be5bab5d';
  if not exists(select 1 from public.admin_subscription_grants g where g.workspace_id=v_workspace and g.owner_id=v_owner
    and g.grant_kind='business_test' and g.reason='Generated staging receipt and spending request replay test') then
    raise exception 'EXACT_ORIGINAL_SYNTHETIC_GRANT_REQUIRED'; end if;
  select id into strict v_other from auth.users
    where encode(sha256(convert_to(lower(email),'UTF8')),'hex')='e8afd004e7935fea5c2244534828c287c5d38854f21c10061b9d7f2faf071c71';
  select u.id into strict v_admin from auth.users u join public.app_admins a on a.user_id=u.id
    join public.profiles p on p.id=u.id
    where encode(sha256(convert_to(lower(u.email),'UTF8')),'hex')='b0fb88c55c65b5b9d5e02301b421c25d031af5e4995c91dad53dd27c5e3839de'
      and a.role='super_admin' and p.account_status='active';
  select member_limit,version into strict v_seats,v_sub_version from public.workspace_subscriptions
    where workspace_id=v_workspace and status='active' and member_limit in(1,2) and version between 3 and 5;
  if exists(select 1 from public.workspace_members where workspace_id=v_workspace and status='active' and user_id not in(v_owner,v_other))
    or exists(select 1 from public.workspace_invitations where workspace_id=v_workspace and status='pending' and invitee_user_id is distinct from v_other)
    then raise exception 'EXACT_TWO_ACTOR_CLEANUP_REQUIRED'; end if;
  insert into auth.sessions(id,user_id,created_at,updated_at,aal,not_after,user_agent)
    values(v_owner_session,v_owner,now(),now(),'aal1',now()+interval '5 minutes','Mushavo-Finance-Isolation-Compensation/20261107'),
      (v_admin_session,v_admin,now(),now(),'aal1',now()+interval '5 minutes','Mushavo-Finance-Isolation-Compensation/20261107');
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',v_owner::text,
    'session_id',v_owner_session::text,'aal','aal1','exp',floor(extract(epoch from now()+interval '5 minutes'))::bigint)::text,true);
  execute 'set local role authenticated';
  for v_id in select id from public.workspace_invitations where workspace_id=v_workspace and status='pending' and invitee_user_id=v_other loop
    perform public.cancel_business_invitation(v_id);
  end loop;
  for v_id in select id from public.workspace_members where workspace_id=v_workspace and status='active' and user_id=v_other loop
    perform public.remove_business_member(v_workspace,v_id);
  end loop;
  execute 'reset role';
  if (select count(*) from public.workspace_members where workspace_id=v_workspace and status='active')<>1
    or exists(select 1 from public.workspace_invitations where workspace_id=v_workspace and status='pending') then
    raise exception 'OWNER_ONLY_WITH_NO_PENDING_INVITATIONS_REQUIRED'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',v_admin::text,
    'session_id',v_admin_session::text,'aal','aal1','exp',floor(extract(epoch from now()+interval '5 minutes'))::bigint)::text,true);
  execute 'set local role authenticated';
  if v_seats=2 then perform public.admin_set_business_seats(v_workspace,1,v_sub_version,
    'audit-batch-x-receipt-d7be160c2026','Compensate interrupted synthetic finance test'); end if;
  perform public.admin_business_set_status(v_workspace,'suspended',v_support,'audit-batch-x-receipt-d7be160c2026',
    'Compensate interrupted synthetic finance test',gen_random_uuid());
  execute 'reset role';
  delete from auth.sessions where id in(v_owner_session,v_admin_session)
    and user_agent='Mushavo-Finance-Isolation-Compensation/20261107';
  if exists(select 1 from auth.sessions where id in(v_owner_session,v_admin_session)) then raise exception 'MODELED_SESSION_CLEANUP_REQUIRED'; end if;
  if not exists(select 1 from public.budget_workspaces where id=v_workspace and status='suspended') then
    raise exception 'EXACT_FIXTURE_ISOLATION_REQUIRED'; end if;
  perform set_config('mushavo.finance_isolate.safe_result',jsonb_build_object('fixture_suspended',true,
    'temporary_member_removed',true,'original_one_seat_restored',true,'modeled_sessions_removed',2,
    'finance_records_deleted',0,'provider_requests',0,'HTTP_acceptance',false)::text,true);
end;
$isolate$;
select current_setting('mushavo.finance_isolate.safe_result')::jsonb as safe_result;
commit;
