begin;
set local search_path=pg_catalog;
set local lock_timeout='1500ms';
set local statement_timeout='15s';
lock table public.notification_outbox in share row exclusive mode;
do $fixture$
declare v_workspace uuid;v_owner uuid;v_source uuid:=gen_random_uuid();
begin
 if not exists(select 1 from mushavo_email_install.rollout_control where singleton
  and target_project='dczlddwbtgvfdujgcitb' and mode='ACTIVE'
  and catalog_sha256='4646c0fe0367fe033b4594428f9c180eb96ca9b39ed2d1a2024bdc843804c3d7'
  and catalog_sha256=mushavo_email_install.catalog_identity()) then raise exception 'EXACT_STAGING_CATALOG_REQUIRED';end if;
 if exists(select 1 from public.notification_outbox) or exists(select 1 from public.admin_notification_outbox)
  or to_regclass('cron.job') is not null then raise exception 'EMPTY_QUEUES_AND_NO_DATABASE_SCHEDULER_REQUIRED';end if;
 select id,owner_id into strict v_workspace,v_owner from public.budget_workspaces
  where name='audit-batch-x-receipt-d7be160c2026' and status='suspended';
 if exists(select 1 from public.payment_items where id=v_source) then raise exception 'NONEXISTENT_SYNTHETIC_PAYMENT_REQUIRED';end if;
 insert into public.notification_outbox(user_id,workspace_id,source_type,source_id,notification_type,
  scheduled_for,title,body,target_url,idempotency_key,next_attempt_at)
 values(v_owner,v_workspace,'audit_backend',v_source,'audit_backend','1900-01-01T00:00:00Z',
  'Synthetic backend overlap audit','Bounded synthetic queue row with no real payment source',
  format('/app.html?source=push&workspace=%s&payment_item=%s#family/payments',v_workspace,v_source),
  'AUDIT-Y-INDEPENDENT-OVERLAP-20261107','1900-01-01T00:00:00Z');
end;
$fixture$;
select jsonb_build_object('fixture_count',count(*),'no_real_payment_bound',bool_and(not exists(
 select 1 from public.payment_items i where i.id=o.source_id)),
 'provider_dispatch_invoked',false)as safe_result from public.notification_outbox o
 where idempotency_key='AUDIT-Y-INDEPENDENT-OVERLAP-20261107';
commit;
