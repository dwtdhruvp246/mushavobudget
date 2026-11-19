-- Emergency compensating action only. Execute only after the bounded HTTP
-- account-suspension run attempted its change and an independent readback
-- confirms USER_A is still suspended. Do not use to reset unrelated accounts.
-- The modeled Admin session below is recovery tooling, not HTTP acceptance.
begin;
set local search_path=pg_catalog;
set local lock_timeout='1500ms';
set local statement_timeout='15s';
do $restore$
declare
  v_target uuid;
  v_admin uuid;
  v_session uuid:=gen_random_uuid();
begin
  if not exists(select 1 from mushavo_email_install.rollout_control
    where singleton and target_project='dczlddwbtgvfdujgcitb' and mode='ACTIVE'
      and catalog_sha256='e902fca1d972f7cb76a0cc7b8f5ca649f24dfd2ae198cc77a1d96526a82172e8'
      and catalog_sha256=mushavo_email_install.catalog_identity()) then
    raise exception 'EXACT_REVIEWED_STAGING_CATALOG_REQUIRED';
  end if;
  if md5(pg_get_functiondef('public.set_user_account_status(uuid,text)'::regprocedure))
    <> '36db915a64c75544a32afed531edb678' then raise exception 'REVIEWED_STATUS_ACTION_REQUIRED'; end if;
  select u.id into strict v_target from auth.users u join public.profiles p on p.id=u.id
    where encode(sha256(convert_to(lower(u.email),'UTF8')),'hex')='78517e097a62a504568d89ea98e37c754446634cd03663e9edb9a6d5be5bab5d'
      and p.account_status='suspended' and not exists(select 1 from public.app_admins a where a.user_id=u.id);
  select u.id into strict v_admin from auth.users u join public.app_admins a on a.user_id=u.id
    join public.profiles p on p.id=u.id
    where encode(sha256(convert_to(lower(u.email),'UTF8')),'hex')='b0fb88c55c65b5b9d5e02301b421c25d031af5e4995c91dad53dd27c5e3839de'
      and a.role='super_admin' and p.account_status='active';
  insert into auth.sessions(id,user_id,created_at,updated_at,aal,not_after,user_agent)
    values(v_session,v_admin,now(),now(),'aal1',now()+interval '5 minutes','Mushavo-Account-Suspension-Compensation/20261107');
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',v_admin::text,
    'session_id',v_session::text,'aal','aal1','exp',floor(extract(epoch from now()+interval '5 minutes'))::bigint)::text,true);
  execute 'set local role authenticated';
  perform public.set_user_account_status(v_target,'active');
  execute 'reset role';
  if not exists(select 1 from public.profiles where id=v_target and account_status='active') then
    raise exception 'EXACT_TARGET_RESTORATION_REQUIRED';
  end if;
  delete from auth.sessions where id=v_session and user_id=v_admin
    and user_agent='Mushavo-Account-Suspension-Compensation/20261107';
  if exists(select 1 from auth.sessions where id=v_session) then raise exception 'COMPENSATION_SESSION_CLEANUP_REQUIRED'; end if;
  perform set_config('mushavo.account_restore.safe_result',jsonb_build_object('target_slot','USER_A',
    'target_active',true,'modeled_recovery_sessions_removed',1,'security_version_decremented',false,
    'provider_requests',0,'HTTP_acceptance',false)::text,true);
end;
$restore$;
select current_setting('mushavo.account_restore.safe_result')::jsonb as safe_result;
commit;
