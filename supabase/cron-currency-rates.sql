-- Mushavo Budget CurrencyAPI schedule
-- Run this only after replacing the two placeholders below.
-- Never put CURRENCYAPI_API_KEY in this file or in Postgres.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-exchange-rates',
  'mushavo_currency_sync_url',
  'Mushavo CurrencyAPI Edge Function URL'
)
where not exists (
  select 1 from vault.secrets where name = 'mushavo_currency_sync_url'
);

select vault.create_secret(
  'REPLACE_WITH_THE_SAME_RANDOM_CURRENCY_SYNC_SECRET_USED_BY_THE_EDGE_FUNCTION',
  'mushavo_currency_sync_secret',
  'Authentication secret for the twice-daily currency sync'
)
where not exists (
  select 1 from vault.secrets where name = 'mushavo_currency_sync_secret'
);

select cron.unschedule(jobid)
from cron.job
where jobname = 'mushavo-currency-rates-twice-daily';

select cron.schedule(
  'mushavo-currency-rates-twice-daily',
  '15 0,12 * * *',
  $job$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'mushavo_currency_sync_url'
      limit 1
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'mushavo_currency_sync_secret'
        limit 1
      )
    ),
    body := jsonb_build_object('source', 'supabase_cron', 'scheduled_at', now())
  ) as request_id;
  $job$
);

-- Verification queries (safe: they do not reveal either secret).
select jobid, jobname, schedule, active
from cron.job
where jobname = 'mushavo-currency-rates-twice-daily';

select status, started_at, completed_at, provider_effective_at, rates_stored, safe_error_summary
from public.exchange_rate_sync_runs
order by started_at desc
limit 10;
