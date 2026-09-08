-- PWA Stage 12 diagnostic. Secret values are never selected.

select
  exists (
    select 1 from vault.secrets where name = 'mushavo_budget_project_url'
  ) as project_url_secret_exists,
  exists (
    select 1 from vault.secrets where name = 'mushavo_budget_push_cron_secret'
  ) as cron_secret_exists,
  exists (
    select 1
    from cron.job
    where jobname = 'mushavo-budget-dispatch-push-reminders'
      and schedule = '*/15 * * * *'
      and active
  ) as dispatcher_cron_active;

select status, count(*) as queue_rows
from public.notification_outbox
group by status
order by status;

select
  jobid,
  runid,
  status,
  start_time,
  end_time,
  left(coalesce(return_message, ''), 200) as return_summary
from cron.job_run_details
where jobid = (
  select jobid
  from cron.job
  where jobname = 'mushavo-budget-dispatch-push-reminders'
)
order by start_time desc
limit 10;
