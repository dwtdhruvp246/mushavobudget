begin;
set local search_path = pg_catalog;
set local lock_timeout = '1500ms';
set local statement_timeout = '20s';

do $audit$
declare
  v_workspace uuid;
  v_owner uuid;
  v_job uuid := gen_random_uuid();
  v_source uuid := gen_random_uuid();
  v_time timestamptz := '1900-01-01T00:00:00Z';
  v_role text;
  v_call text;
  v_denials integer;
  v_claims integer;
  v_before text;
  v_after text;
  v_status text;
  v_stale_status text;
  v_attempt integer;
  v_checks jsonb := '{}'::jsonb;
begin
  if not exists(select 1 from mushavo_email_install.rollout_control r
    where r.singleton and r.target_project='dczlddwbtgvfdujgcitb'
      and r.mode='ACTIVE' and r.catalog_sha256=mushavo_email_install.catalog_identity()) then
    raise exception 'CURRENT_STAGING_CATALOG_REQUIRED';
  end if;
  select id,owner_id into strict v_workspace,v_owner from public.budget_workspaces
    where name='audit-batch-x-receipt-d7be160c2026' and status='suspended';
  if exists(select 1 from public.notification_outbox
    where (status in ('pending','retry') and scheduled_for<=v_time+interval '16 minutes'
      and next_attempt_at<=v_time+interval '16 minutes')
      or (status='processing' and claimed_at<=v_time+interval '1 minute')) then
    raise exception 'EMPTY_HISTORICAL_TIME_SLICE_REQUIRED';
  end if;
  select md5(coalesce(jsonb_agg(to_jsonb(o) order by id)::text,'[]')) into v_before
    from public.notification_outbox o;

  foreach v_role in array array['anon','authenticated'] loop
    v_denials := 0;
    perform set_config('request.jwt.claims',jsonb_build_object('role',v_role)::text,true);
    execute format('set local role %I',v_role);
    foreach v_call in array array[
      format('select public.claim_notification_outbox(1,%L::timestamptz)',v_time),
      format('select public.claim_admin_notification_outbox(1,%L::timestamptz)',v_time),
      format('select public.record_notification_outbox_result(%L::uuid,true,false,null,%L::timestamptz)',v_job,v_time),
      format('select public.record_admin_notification_outbox_result(%L::uuid,true,false,null,%L::timestamptz)',v_job,v_time),
      format('select public.enqueue_due_payment_reminders(%L::timestamptz)',v_time),
      format('select public.enqueue_due_business_bill_reminders(%L::timestamptz)',v_time),
      format('select public.generate_business_bill_occurrences(%L::date,%L::uuid)',v_time::date,v_workspace),
      format('select public.business_bill_reminder_allowed(%L::uuid,%L::uuid)',v_source,v_owner),
      format('select public.business_billing_usage(%L::uuid)',v_workspace),
      format('select public.claim_push_test_rate_limit(%L::uuid,60)',v_owner)
    ] loop
      begin
        execute v_call;
        raise exception 'UNEXPECTED_BACKEND_EXECUTE_GRANT';
      exception when insufficient_privilege then
        v_denials := v_denials+1;
      end;
    end loop;
    execute 'reset role';
    v_checks := v_checks || jsonb_build_object(v_role||'_ten_backend_calls_denied',v_denials=10);
  end loop;

  insert into public.notification_outbox(id,user_id,workspace_id,source_type,source_id,
    notification_type,scheduled_for,title,body,target_url,idempotency_key,next_attempt_at)
  values(v_job,v_owner,v_workspace,'audit_backend',v_source,'audit_backend',v_time,
    'Synthetic backend lease audit','Rolled-back synthetic queue row',
    format('/app.html?source=push&workspace=%s&payment_item=%s#family/payments',v_workspace,v_source),
    'audit-batch-y-backend-lease-'||v_job::text,v_time);
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  execute 'set local role service_role';
  select count(*) into v_claims from public.claim_notification_outbox(1,v_time) where id=v_job;
  v_checks := v_checks || jsonb_build_object('service_claims_exact_fixture',v_claims=1);
  select count(*) into v_claims from public.claim_notification_outbox(1,v_time);
  v_checks := v_checks || jsonb_build_object('unexpired_claim_not_reclaimed',v_claims=0);
  select count(*) into v_claims from public.claim_notification_outbox(1,v_time+interval '16 minutes')
    where id=v_job and attempt_count=2 and claimed_at=v_time+interval '16 minutes';
  v_checks := v_checks || jsonb_build_object('expired_claim_reclaimed_once',v_claims=1);
  -- Old attempt/time must not change a newer claim, even with an earlier
  -- completion reference time. Legacy unbound callers must fail closed.
  begin
    perform public.record_notification_outbox_result(v_job,true,false,null,v_time+interval '1 minute');
    raise exception 'LEGACY_UNBOUND_RESULT_WAS_ACCEPTED';
  exception when raise_exception then
    if sqlerrm <> 'OUTBOX_CLAIM_REQUIRED' then raise; end if;
  end;
  v_checks := v_checks || jsonb_build_object('legacy_unbound_result_denied',true);
  perform public.record_notification_outbox_result(v_job,true,false,null,v_time+interval '1 minute',1,v_time);
  select status,attempt_count into v_status,v_attempt from public.notification_outbox where id=v_job;
  v_checks := v_checks || jsonb_build_object('stale_completion_preserves_new_claim',v_status='processing' and v_attempt=2);
  v_stale_status := v_status;
  perform public.record_notification_outbox_result(v_job,true,false,null,v_time+interval '17 minutes',2,v_time+interval '16 minutes');
  select status into v_status from public.notification_outbox where id=v_job;
  v_checks := v_checks || jsonb_build_object('current_claim_result_succeeds',v_status='sent');
  perform public.record_notification_outbox_result(v_job,false,false,'Synthetic replay',v_time+interval '18 minutes',2,v_time+interval '16 minutes');
  select status into v_status from public.notification_outbox where id=v_job;
  v_checks := v_checks || jsonb_build_object('terminal_completion_replay_noop',v_status='sent');
  execute 'reset role';
  select md5(coalesce(jsonb_agg(to_jsonb(o) order by id)::text,'[]')) into v_after
    from public.notification_outbox o where id<>v_job;
  v_checks := v_checks || jsonb_build_object('non_target_rows_unchanged',v_before=v_after);
  perform set_config('mushavo.batch_y.safe_result',jsonb_build_object(
    'project','dczlddwbtgvfdujgcitb','checks',v_checks,
    'source_claim_attempt',1,'newer_claim_attempt',v_attempt,
    'status_after_stale_completion',v_stale_status,'status_after_current_completion',v_status,
    'external_delivery_requests',0,'committed_writes',0,'overlapping_transactions_tested',false,
    'non_target_checksum_before',v_before,'non_target_checksum_after',v_after)::text,true);
end;
$audit$;
select current_setting('mushavo.batch_y.safe_result')::jsonb as safe_result;
rollback;
