begin;
set local search_path=pg_catalog;
set local lock_timeout='1500ms';
set local statement_timeout='20s';
do $audit$
declare
  v_workspace uuid;
  v_owner uuid;
  v_notification uuid;
  v_job uuid:=gen_random_uuid();
  v_source uuid:=gen_random_uuid();
  v_time timestamptz:='1900-01-01T00:00:00Z';
  v_status text;
  v_count integer;
  v_before text;
  v_after text;
  v_notice_before text;
  v_notice_after text;
  v_checks jsonb:='{}'::jsonb;
  v_role text;
  v_call text;
  v_denials integer;
begin
  if not exists(select 1 from mushavo_email_install.rollout_control r
    where r.singleton and r.target_project='dczlddwbtgvfdujgcitb'
      and r.mode='ACTIVE' and r.catalog_sha256=mushavo_email_install.catalog_identity()) then
    raise exception 'CURRENT_STAGING_CATALOG_REQUIRED';
  end if;
  select id,owner_id into strict v_workspace,v_owner from public.budget_workspaces
    where name='audit-batch-x-receipt-d7be160c2026' and status='suspended';
  select n.id,md5(to_jsonb(n)::text) into v_notification,v_notice_before from public.notifications n
    where n.user_id=v_owner and not exists(select 1 from public.admin_notification_outbox o where o.notification_id=n.id)
    order by n.created_at desc limit 1;
  if v_notification is null then raise exception 'EXISTING_OWNER_NOTICE_REFERENCE_REQUIRED'; end if;
  if exists(select 1 from public.admin_notification_outbox
    where (status in ('pending','retry') and scheduled_for<=v_time+interval '16 minutes'
      and next_attempt_at<=v_time+interval '16 minutes')
      or (status='processing' and claimed_at<=v_time+interval '1 minute')) then
    raise exception 'EMPTY_HISTORICAL_TIME_SLICE_REQUIRED';
  end if;
  select md5(coalesce(jsonb_agg(to_jsonb(o) order by id)::text,'[]')) into v_before from public.admin_notification_outbox o;
  foreach v_role in array array['anon','authenticated'] loop
    v_denials:=0;
    perform set_config('request.jwt.claims',jsonb_build_object('role',v_role)::text,true);
    execute format('set local role %I',v_role);
    foreach v_call in array array[
      format('select public.record_notification_outbox_result(%L::uuid,true,false,null,%L::timestamptz,1,%L::timestamptz)',v_job,v_time,v_time),
      format('select public.record_admin_notification_outbox_result(%L::uuid,true,false,null,%L::timestamptz,1,%L::timestamptz)',v_job,v_time,v_time)
    ] loop
      begin execute v_call; raise exception 'UNEXPECTED_BACKEND_EXECUTE_GRANT';
      exception when insufficient_privilege then v_denials:=v_denials+1; end;
    end loop;
    execute 'reset role';
    v_checks:=v_checks||jsonb_build_object(v_role||'_new_result_signatures_denied',v_denials=2);
  end loop;
  -- The existing notice is referenced only. The chosen source bypasses the
  -- subscription workspace-link trigger and never changes that notice.
  insert into public.admin_notification_outbox(id,notification_id,user_id,source_type,source_id,
    notification_type,scheduled_for,title,body,target_url,idempotency_key,next_attempt_at)
  values(v_job,v_notification,v_owner,'support_ticket_created',v_source,'audit_backend',v_time,
    'Synthetic Admin lease audit','Rolled-back synthetic queue row',
    format('/app.html?source=push&notification_id=%s#admin/support',v_notification),
    'audit-batch-y-admin-lease-'||v_job::text,v_time);
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  execute 'set local role service_role';
  select count(*) into v_count from public.claim_admin_notification_outbox(1,v_time) where id=v_job;
  v_checks:=v_checks||jsonb_build_object('service_claims_exact_admin_fixture',v_count=1);
  select count(*) into v_count from public.claim_admin_notification_outbox(1,v_time);
  v_checks:=v_checks||jsonb_build_object('unexpired_admin_claim_not_reclaimed',v_count=0);
  select count(*) into v_count from public.claim_admin_notification_outbox(1,v_time+interval '16 minutes')
    where id=v_job and attempt_count=2 and claimed_at=v_time+interval '16 minutes';
  v_checks:=v_checks||jsonb_build_object('expired_admin_claim_reclaimed_once',v_count=1);
  begin
    perform public.record_admin_notification_outbox_result(v_job,true,false,null,v_time+interval '1 minute');
    raise exception 'LEGACY_UNBOUND_RESULT_WAS_ACCEPTED';
  exception when raise_exception then
    if sqlerrm<>'OUTBOX_CLAIM_REQUIRED' then raise; end if;
  end;
  v_checks:=v_checks||jsonb_build_object('legacy_unbound_admin_result_denied',true);
  perform public.record_admin_notification_outbox_result(v_job,true,false,null,v_time+interval '1 minute',1,v_time);
  select status into v_status from public.admin_notification_outbox where id=v_job;
  v_checks:=v_checks||jsonb_build_object('stale_admin_completion_preserves_new_claim',v_status='processing');
  perform public.record_admin_notification_outbox_result(v_job,true,false,null,v_time+interval '17 minutes',2,v_time+interval '16 minutes');
  select status into v_status from public.admin_notification_outbox where id=v_job;
  v_checks:=v_checks||jsonb_build_object('current_admin_claim_result_succeeds',v_status='sent');
  perform public.record_admin_notification_outbox_result(v_job,false,false,'Synthetic replay',v_time+interval '18 minutes',2,v_time+interval '16 minutes');
  select status into v_status from public.admin_notification_outbox where id=v_job;
  v_checks:=v_checks||jsonb_build_object('terminal_admin_completion_replay_noop',v_status='sent');
  execute 'reset role';
  select md5(coalesce(jsonb_agg(to_jsonb(o) order by id)::text,'[]')) into v_after
    from public.admin_notification_outbox o where id<>v_job;
  v_checks:=v_checks||jsonb_build_object('non_target_admin_queue_rows_unchanged',v_before=v_after);
  select md5(to_jsonb(n)::text) into v_notice_after from public.notifications n where n.id=v_notification;
  v_checks:=v_checks||jsonb_build_object('existing_owner_notice_unchanged',v_notice_before=v_notice_after);
  perform set_config('mushavo.batch_y.admin_safe_result',jsonb_build_object('project','dczlddwbtgvfdujgcitb',
    'checks',v_checks,'external_delivery_requests',0,'committed_writes',0,
    'overlapping_transactions_tested',false,'existing_notice_written',false,
    'non_target_checksum_before',v_before,'non_target_checksum_after',v_after)::text,true);
end;
$audit$;
select current_setting('mushavo.batch_y.admin_safe_result')::jsonb as safe_result;
rollback;
