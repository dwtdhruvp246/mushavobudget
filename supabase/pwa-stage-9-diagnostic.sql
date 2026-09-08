-- Stage 9 read-only diagnostic. Safe to run after the migration.

select
  to_regclass('public.push_test_rate_limits') is not null as rate_limit_table_exists,
  coalesce(classes.relrowsecurity, false) as rls_enabled,
  coalesce(classes.relforcerowsecurity, false) as rls_forced
from pg_class as classes
join pg_namespace as namespaces on namespaces.oid = classes.relnamespace
where namespaces.nspname = 'public'
  and classes.relname = 'push_test_rate_limits';

select
  to_regprocedure('public.claim_push_test_rate_limit(uuid,integer)') is not null
    as claim_function_exists,
  has_function_privilege(
    'anon',
    'public.claim_push_test_rate_limit(uuid,integer)',
    'EXECUTE'
  ) as anonymous_execute_allowed,
  has_function_privilege(
    'authenticated',
    'public.claim_push_test_rate_limit(uuid,integer)',
    'EXECUTE'
  ) as authenticated_execute_allowed,
  has_function_privilege(
    'service_role',
    'public.claim_push_test_rate_limit(uuid,integer)',
    'EXECUTE'
  ) as service_role_execute_allowed;

select count(*) as rate_limit_rows
from public.push_test_rate_limits;
