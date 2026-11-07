begin;
set local search_path=pg_catalog;
set local lock_timeout='1500ms';
set local statement_timeout='5s';
do $worker$
declare v_job uuid;v_visible integer;v_count integer;v_overlap boolean;v_started timestamptz:=clock_timestamp();
begin
 select id into strict v_job from public.notification_outbox
  where idempotency_key='AUDIT-Y-INDEPENDENT-OVERLAP-20261107' and source_type='audit_backend'
   and title='Synthetic backend overlap audit' and scheduled_for='1900-01-01T00:00:00Z';
 v_overlap:=not pg_try_advisory_xact_lock(49007,20261107);
 if v_overlap then
  select count(*) into v_visible from public.notification_outbox where id=v_job and status='pending';
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  execute 'set local role service_role';
  select count(*) into v_count from public.claim_notification_outbox(1,'1900-01-01T00:00:00Z');
 end if;
 perform set_config('mushavo.overlap.worker_b',jsonb_build_object('worker','B',
  'backend_hash',md5(pg_backend_pid()::text),'started_at',v_started,'finished_at',clock_timestamp(),
  'overlap_observed',v_overlap,'pending_candidate_visible_before_claim',v_visible,
  'claimed_count',v_count,'claim_call_attempted',v_overlap,'provider_requests',0)::text,true);
end;
$worker$;
select current_setting('mushavo.overlap.worker_b')::jsonb as safe_result;
commit;
