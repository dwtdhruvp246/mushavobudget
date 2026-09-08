-- Stage 12 rollback. Unschedule first so no new invocation can start.
-- Run only when intentionally disabling automatic reminder delivery.

do $$
declare
  v_job_id bigint;
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    for v_job_id in execute
      'select jobid from cron.job where jobname = ''mushavo-budget-dispatch-push-reminders'''
    loop
      perform cron.unschedule(v_job_id);
    end loop;
  end if;
end;
$$;

-- Delete the deployed dispatch-push-reminders Edge Function separately only
-- after confirming that no invocation remains in progress. Stage 11 outbox
-- history and the existing test-push function are intentionally preserved.
