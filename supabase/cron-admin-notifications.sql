-- Invoke the protected admin notification dispatcher every five minutes.
-- Run only after the migration and dispatch-admin-notifications Edge Function
-- are deployed. The existing Stage 12 Vault values and CRON_SECRET are reused.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'mushavo_budget_project_url'
  ) then
    raise exception 'VAULT_PROJECT_URL_REQUIRED';
  end if;
  if not exists (
    select 1 from vault.secrets where name = 'mushavo_budget_push_cron_secret'
  ) then
    raise exception 'VAULT_CRON_SECRET_REQUIRED';
  end if;
end;
$$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'mushavo-budget-dispatch-admin-notifications';

select cron.schedule(
  'mushavo-budget-dispatch-admin-notifications',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'mushavo_budget_project_url'
    ) || '/functions/v1/dispatch-admin-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-mushavo-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'mushavo_budget_push_cron_secret'
      )
    ),
    body := '{"source":"cron"}'::jsonb
  ) as request_id;
  $$
);
