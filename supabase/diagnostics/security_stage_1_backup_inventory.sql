-- Stage 1.2: read-only backup-scope inventory, not an export or restore test.
-- Owner verifies project kttkospkblwvguuwnhjj in the Dashboard before running.
-- No user identifiers, emails, object paths, row contents, passwords, function
-- bodies, cron commands, webhook URLs, or decrypted Vault values are returned.
-- Requires the intended project's postgres SQL Editor role and standard
-- Supabase auth.users/storage.buckets/storage.objects tables. Report errors;
-- do not replace a failed or unavailable result with zero or PASS.
begin transaction isolation level repeatable read read only;
set local statement_timeout = '30s';
set local lock_timeout = '3s';

with namespaces as (
  select oid, nspname from pg_namespace
  where nspname <> 'information_schema' and nspname !~ '^pg_'
), schema_inventory as (
  select n.nspname as schema_name,
    count(c.oid) filter (where c.relkind in ('r','p')) as table_count,
    count(c.oid) filter (where c.relkind in ('v','m')) as view_count,
    count(c.oid) filter (where c.relkind = 'S') as sequence_count,
    count(c.oid) filter (where c.relkind = 'f') as foreign_table_count,
    count(c.oid) filter (where c.relrowsecurity) as rls_relation_count,
    (select count(*) from pg_proc p where p.pronamespace = n.oid) as routine_count
  from namespaces n left join pg_class c on c.relnamespace = n.oid
  group by n.oid, n.nspname
), bucket_objects as (
  select bucket_id, count(*) as object_count,
    coalesce(sum(case
      when length(metadata ->> 'size') <= 20
        and (metadata ->> 'size') ~ '^[0-9]+$'
      then (metadata ->> 'size')::numeric end), 0) as recorded_bytes,
    count(*) filter (where not coalesce(
      length(metadata ->> 'size') <= 20
        and (metadata ->> 'size') ~ '^[0-9]+$', false)) as unknown_size_count
  from storage.objects group by bucket_id
), checks(check_name, status, details) as (
  select '01 Read-only execution context', 'INFO', jsonb_build_object(
    'checked_at', current_timestamp,
    'transaction_read_only', current_setting('transaction_read_only'),
    'transaction_isolation', current_setting('transaction_isolation'),
    'dashboard_project_identity', 'Owner must verify kttkospkblwvguuwnhjj; not proved by this SQL')
  union all
  select '02 Deployed PostgreSQL and database size', 'INFO', jsonb_build_object(
    'server_version', current_setting('server_version'),
    'server_version_num', current_setting('server_version_num'),
    'database_bytes', pg_database_size(current_database()),
    'scope', 'Database disk size is not exported artifact size')
  union all
  select '03 Non-system schema scope', 'INFO', coalesce(
    jsonb_agg(to_jsonb(s) order by s.schema_name), '[]'::jsonb)
  from schema_inventory s
  union all
  select '04 Installed extensions', 'INFO', coalesce(jsonb_agg(
    jsonb_build_object('name', e.extname, 'version', e.extversion,
      'schema', n.nspname) order by e.extname), '[]'::jsonb)
  from pg_extension e join pg_namespace n on n.oid = e.extnamespace
  union all
  select '05 Role attributes without passwords', 'INFO', coalesce(jsonb_agg(
    jsonb_build_object('role', rolname, 'login', rolcanlogin,
      'superuser', rolsuper, 'bypass_rls', rolbypassrls,
      'create_role', rolcreaterole, 'create_database', rolcreatedb)
    order by rolname), '[]'::jsonb)
  from pg_roles where rolname !~ '^pg_'
  union all
  select '06 Privilege and membership coverage indicators', 'INFO', jsonb_build_object(
    'role_membership_count', (select count(*) from pg_auth_members),
    'explicit_schema_acl_count', (select count(*) from pg_namespace
      where oid in (select oid from namespaces) and nspacl is not null),
    'explicit_relation_acl_count', (select count(*) from pg_class
      where relnamespace in (select oid from namespaces) and relacl is not null),
    'explicit_column_acl_count', (select count(*) from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      where c.relnamespace in (select oid from namespaces) and a.attacl is not null),
    'explicit_routine_acl_count', (select count(*) from pg_proc
      where pronamespace in (select oid from namespaces) and proacl is not null),
    'default_acl_count', (select count(*) from pg_default_acl),
    'scope', 'Counts only; exact grants and restored effective access require later comparison')
  union all
  select '07 Auth user count', 'INFO', jsonb_build_object(
    'user_count', count(*),
    'scope', 'Count only; credentials, identities, sessions and Auth configuration are not inventoried here')
  from auth.users
  union all
  select '08 Storage bucket configuration', 'INFO', coalesce(jsonb_agg(
    jsonb_build_object('bucket', id, 'public', public,
      'file_size_limit', file_size_limit, 'allowed_mime_types', allowed_mime_types)
    order by id), '[]'::jsonb)
  from storage.buckets
  union all
  select '09 Storage object metadata totals', 'INFO', jsonb_build_object(
    'by_bucket', coalesce((select jsonb_agg(to_jsonb(b) order by b.bucket_id)
      from bucket_objects b), '[]'::jsonb),
    'scope', 'Recorded size metadata only; actual file bytes and integrity not checked',
    'empty_buckets', 'Listed in check 08; only buckets containing object metadata appear here')
  union all
  select '10 Managed schema trigger and policy dependencies', 'INFO', jsonb_build_object(
    'triggers', coalesce((select jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'table', c.relname, 'trigger', t.tgname,
      'function_schema', fn.nspname, 'function', p.proname)
      order by n.nspname, c.relname, t.tgname)
      from pg_trigger t join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_proc p on p.oid = t.tgfoid
      join pg_namespace fn on fn.oid = p.pronamespace
      where not t.tgisinternal and n.nspname in ('auth','storage','realtime')),
      '[]'::jsonb),
    'policies', coalesce((select jsonb_agg(jsonb_build_object(
      'schema', schemaname, 'table', tablename, 'policy', policyname)
      order by schemaname, tablename, policyname) from pg_policies
      where schemaname in ('auth','storage','realtime')), '[]'::jsonb),
    'scope', 'Metadata includes platform objects; classification/custom definitions require separate coverage')
  union all
  select '11 Publication configuration indicators', 'INFO', coalesce(jsonb_agg(
    jsonb_build_object('publication', p.pubname, 'all_tables', p.puballtables,
      'listed_table_count', (select count(*) from pg_publication_tables t
        where t.pubname = p.pubname)) order by p.pubname), '[]'::jsonb)
  from pg_publication p
  union all
  select '12 Scheduler encryption and migration dependency presence', 'INFO', jsonb_build_object(
    'cron_jobs_table', to_regclass('cron.job') is not null,
    'vault_secrets_table', to_regclass('vault.secrets') is not null,
    'migration_history_table', to_regclass('supabase_migrations.schema_migrations') is not null,
    'database_webhooks_schema', to_regnamespace('supabase_functions') is not null,
    'pgsodium_extension', exists(select 1 from pg_extension where extname = 'pgsodium'),
    'scope', 'Presence only, not usage; no schedules, commands, secret values or key material retrieved')
  union all
  select '13 Backup and configuration completeness', 'REVIEW', jsonb_build_object(
    'backup_created_by_this_check', false,
    'restore_verified_by_this_check', false,
    'remaining', 'Exact export scope/grants/managed customizations, file bytes, foreign/large objects, encryption dependencies, Auth and SMTP settings, Edge Functions/dependencies/secrets, provider configuration, protected off-site storage and isolated recovery proof')
)
select check_name, status, details from checks order by check_name;
rollback;
