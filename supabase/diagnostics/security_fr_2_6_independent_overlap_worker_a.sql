begin;
set local search_path=pg_catalog;
set local lock_timeout='1500ms';
set local statement_timeout='30s';
do $worker$
declare v_job uuid;v_count integer;v_started timestamptz:=clock_timestamp();
begin
 if not pg_try_advisory_xact_lock(49007,20261107) then raise exception 'CONTROL_LOCK_BUSY';end if;
 select id into strict v_job from public.notification_outbox
  where idempotency_key='AUDIT-Y-INDEPENDENT-OVERLAP-20261107' and source_type='audit_backend'
   and title='Synthetic backend overlap audit' and status='pending'
   and scheduled_for='1900-01-01T00:00:00Z';
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 execute 'set local role service_role';
 select count(*) into v_count from public.claim_notification_outbox(1,'1900-01-01T00:00:00Z') where id=v_job;
 if v_count<>1 then raise exception 'EXACT_FIRST_WORKER_CLAIM_REQUIRED';end if;
 perform pg_sleep(20);
 perform set_config('mushavo.overlap.worker_a',jsonb_build_object('worker','A',
  'backend_hash',md5(pg_backend_pid()::text),'started_at',v_started,'hold_finished_at',clock_timestamp(),
  'exact_fixture_claimed',v_count=1,'provider_requests',0)::text,true);
end;
$worker$;
select current_setting('mushavo.overlap.worker_a')::jsonb as safe_result;
commit;
