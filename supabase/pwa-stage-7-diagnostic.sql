-- Stage 7 read-only diagnostic. Safe to run after the migration.

select
  to_regclass('public.push_subscriptions') as push_subscriptions_table,
  coalesce(classes.relrowsecurity, false) as rls_enabled,
  coalesce(classes.relforcerowsecurity, false) as rls_forced
from pg_class as classes
join pg_namespace as namespaces on namespaces.oid = classes.relnamespace
where namespaces.nspname = 'public'
  and classes.relname = 'push_subscriptions';

select
  columns.column_name,
  columns.data_type,
  columns.is_nullable,
  columns.column_default
from information_schema.columns as columns
where columns.table_schema = 'public'
  and columns.table_name = 'push_subscriptions'
order by columns.ordinal_position;

select
  indexes.indexname,
  indexes.indexdef
from pg_indexes as indexes
where indexes.schemaname = 'public'
  and indexes.tablename = 'push_subscriptions'
order by indexes.indexname;

select
  policies.policyname,
  policies.cmd,
  policies.roles,
  policies.qual,
  policies.with_check
from pg_policies as policies
where policies.schemaname = 'public'
  and policies.tablename = 'push_subscriptions'
order by policies.policyname;

select
  grants.grantee,
  grants.privilege_type
from information_schema.role_table_grants as grants
where grants.table_schema = 'public'
  and grants.table_name = 'push_subscriptions'
  and grants.grantee in ('anon', 'authenticated')
order by grants.grantee, grants.privilege_type;

select
  grants.grantee,
  grants.privilege_type,
  grants.column_name
from information_schema.column_privileges as grants
where grants.table_schema = 'public'
  and grants.table_name = 'push_subscriptions'
  and grants.grantee in ('anon', 'authenticated')
order by grants.grantee, grants.privilege_type, grants.column_name;

select count(*) as subscription_rows
from public.push_subscriptions;
