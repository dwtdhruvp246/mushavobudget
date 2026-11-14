begin;
set local search_path=pg_catalog;
set local lock_timeout='1500ms';
set local statement_timeout='15s';
do $cleanup$
declare v_count integer;v_deleted integer;
begin
 select count(*) into v_count from public.notification_outbox o
  join public.budget_workspaces w on w.id=o.workspace_id and w.owner_id=o.user_id
  where o.idempotency_key='AUDIT-Y-INDEPENDENT-OVERLAP-20261107'
   and o.source_type='audit_backend' and o.title='Synthetic backend overlap audit'
   and o.scheduled_for='1900-01-01T00:00:00Z'
   and w.name='audit-batch-x-receipt-d7be160c2026'
   and not exists(select 1 from public.payment_items i where i.id=o.source_id);
 if v_count<>1 then raise exception 'EXACT_SYNTHETIC_OVERLAP_FIXTURE_REQUIRED';end if;
 delete from public.notification_outbox o using public.budget_workspaces w
  where w.id=o.workspace_id and w.owner_id=o.user_id
   and o.idempotency_key='AUDIT-Y-INDEPENDENT-OVERLAP-20261107'
   and o.source_type='audit_backend' and o.title='Synthetic backend overlap audit'
   and o.scheduled_for='1900-01-01T00:00:00Z'
   and w.name='audit-batch-x-receipt-d7be160c2026'
   and not exists(select 1 from public.payment_items i where i.id=o.source_id);
 get diagnostics v_deleted=row_count;
 if v_deleted<>1 then raise exception 'EXACT_ONE_SYNTHETIC_ROW_CLEANUP_REQUIRED';end if;
 perform set_config('mushavo.overlap.cleanup',jsonb_build_object('deleted_fixture_rows',v_deleted,
  'remaining_normal_queue_rows',(select count(*)from public.notification_outbox),
  'remaining_admin_queue_rows',(select count(*)from public.admin_notification_outbox))::text,true);
end;
$cleanup$;
select current_setting('mushavo.overlap.cleanup')::jsonb as safe_result;
commit;
