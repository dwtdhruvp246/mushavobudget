-- Mushavo Budget PWA/Web Push Stage 0 diagnostic
-- Read-only catalogue inspection. This script does not create, alter, delete,
-- schedule, unschedule, enable or disable anything.
-- It returns one consolidated PASS/REVIEW result table.

with
old_push_tables(object_name) as (
  values
    ('push_subscriptions'),
    ('notification_outbox'),
    ('push_delivery_attempts'),
    ('notification_dispatch_runs')
),
old_push_functions(object_name) as (
  values
    ('claim_push_notification_outbox'),
    ('enqueue_due_payment_reminders'),
    ('save_push_subscription')
),
old_profile_columns(column_name) as (
  values
    ('reminder_time_local'),
    ('reminder_notifications_enabled'),
    ('detailed_notification_previews'),
    ('notification_preferences_updated_at')
),
compatibility_profile_columns(column_name) as (
  values ('timezone')
),
workspace_columns(column_name) as (
  values
    ('timezone'),
    ('reminder_enabled'),
    ('detailed_notification_previews')
),
expected_extensions(extension_name) as (
  values ('pg_cron'), ('pg_net'), ('supabase_vault')
),
expected_jobs(job_name, expectation) as (
  values
    ('mushavo-push-reminders-every-minute', 'Absent'),
    ('mushavo-currency-rates-twice-daily', 'Present')
),
expected_vault_names(secret_name, expectation) as (
  values
    ('mushavo_project_url', 'Absent'),
    ('mushavo_cron_secret', 'Absent'),
    ('mushavo_currency_sync_url', 'Present'),
    ('mushavo_currency_sync_secret', 'Present')
),
checks as (
  select
    10 as sort_order,
    'Old push table'::text as section,
    object_name::text as item,
    case when to_regclass('public.' || object_name) is null then 'Absent' else 'Present' end as observed,
    'Absent'::text as expected,
    case when to_regclass('public.' || object_name) is null then 'PASS' else 'REVIEW' end as stage_0_status,
    null::text as details
  from old_push_tables

  union all

  select
    20,
    'Old push function',
    expected.object_name,
    case when exists (
      select 1
      from pg_catalog.pg_proc as procedures
      join pg_catalog.pg_namespace as namespaces on namespaces.oid = procedures.pronamespace
      where namespaces.nspname = 'public'
        and procedures.proname = expected.object_name
    ) then 'Present' else 'Absent' end,
    'Absent',
    case when exists (
      select 1
      from pg_catalog.pg_proc as procedures
      join pg_catalog.pg_namespace as namespaces on namespaces.oid = procedures.pronamespace
      where namespaces.nspname = 'public'
        and procedures.proname = expected.object_name
    ) then 'REVIEW' else 'PASS' end,
    null::text
  from old_push_functions as expected

  union all

  select
    30,
    'In-app notification table',
    'public.notifications',
    case when to_regclass('public.notifications') is null then 'Absent' else 'Present' end,
    'Present',
    case when to_regclass('public.notifications') is null then 'REVIEW' else 'PASS' end,
    case when to_regclass('public.notifications') is null
      then 'The in-app bell depends on this table.'
      else 'Table exists; runtime bell test is still required.'
    end

  union all

  select
    40,
    'In-app notification policies',
    'public.notifications RLS policies',
    count(*)::text || ' policies',
    'At least 3 policies',
    case when count(*) >= 3 then 'PASS' else 'REVIEW' end,
    coalesce(string_agg(policyname, ', ' order by policyname), 'No policies found')
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'notifications'

  union all

  select
    50,
    'Old profile push field',
    expected.column_name,
    case when exists (
      select 1
      from information_schema.columns as actual
      where actual.table_schema = 'public'
        and actual.table_name = 'profiles'
        and actual.column_name = expected.column_name
    ) then 'Present' else 'Absent' end,
    'Absent',
    case when exists (
      select 1
      from information_schema.columns as actual
      where actual.table_schema = 'public'
        and actual.table_name = 'profiles'
        and actual.column_name = expected.column_name
    ) then 'REVIEW' else 'PASS' end,
    null::text
  from old_profile_columns as expected

  union all

  select
    55,
    'Current compatibility profile field',
    expected.column_name,
    case when exists (
      select 1
      from information_schema.columns as actual
      where actual.table_schema = 'public'
        and actual.table_name = 'profiles'
        and actual.column_name = expected.column_name
    ) then 'Present' else 'Absent' end,
    'Present',
    case when exists (
      select 1
      from information_schema.columns as actual
      where actual.table_schema = 'public'
        and actual.table_name = 'profiles'
        and actual.column_name = expected.column_name
    ) then 'PASS' else 'REVIEW' end,
    'Preserve this compatibility field; its presence alone does not enable Web Push.'
  from compatibility_profile_columns as expected

  union all

  select
    60,
    'Current workspace preference',
    expected.column_name,
    case when exists (
      select 1
      from information_schema.columns as actual
      where actual.table_schema = 'public'
        and actual.table_name = 'workspace_settings'
        and actual.column_name = expected.column_name
    ) then 'Present' else 'Absent' end,
    'Present',
    case when exists (
      select 1
      from information_schema.columns as actual
      where actual.table_schema = 'public'
        and actual.table_name = 'workspace_settings'
        and actual.column_name = expected.column_name
    ) then 'PASS' else 'REVIEW' end,
    'Preserve this workspace-level setting.'
  from workspace_columns as expected

  union all

  select
    70,
    'Existing scheduling extension',
    expected.extension_name,
    case when extensions.extname is null then 'Absent' else 'Present' end,
    'Present',
    case when extensions.extname is null then 'REVIEW' else 'PASS' end,
    case when extensions.extname is null then null else 'Version ' || extensions.extversion end
  from expected_extensions as expected
  left join pg_catalog.pg_extension as extensions
    on extensions.extname = expected.extension_name

  union all

  select
    80,
    'Scheduled job',
    expected.job_name,
    case when exists (select 1 from cron.job where jobname = expected.job_name) then 'Present' else 'Absent' end,
    expected.expectation,
    case
      when exists (select 1 from cron.job where jobname = expected.job_name) = (expected.expectation = 'Present') then 'PASS'
      else 'REVIEW'
    end,
    coalesce((
      select 'Schedule ' || jobs.schedule || '; active=' || jobs.active::text
      from cron.job as jobs
      where jobs.jobname = expected.job_name
      order by jobs.jobid desc
      limit 1
    ), 'No matching job')
  from expected_jobs as expected

  union all

  select
    90,
    'Vault secret name',
    expected.secret_name,
    case when exists (select 1 from vault.secrets where name = expected.secret_name) then 'Present' else 'Absent' end,
    expected.expectation,
    case
      when exists (select 1 from vault.secrets where name = expected.secret_name) = (expected.expectation = 'Present') then 'PASS'
      else 'REVIEW'
    end,
    'Secret values were not read.'
  from expected_vault_names as expected
)
select
  section,
  item,
  observed,
  expected,
  stage_0_status,
  details
from checks
order by sort_order, section, item;
