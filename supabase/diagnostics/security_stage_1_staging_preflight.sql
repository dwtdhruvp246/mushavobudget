-- Stage 1.3: intended staging dczlddwbtgvfdujgcitb ONLY.
-- Owner verifies Dashboard URL/project name before pasting. SQL cannot prove
-- the hosted project reference; the literals below are labels, not assertions.
-- Catalog metadata and aggregate counts only; no customer rows, passwords,
-- object paths, function bodies, scheduler commands or Vault values returned.
-- Requires standard Supabase auth.users/storage.buckets/storage.objects.
-- A missing relation/permission error is not replaced with zero or PASS.
begin transaction isolation level repeatable read read only;
set local statement_timeout = '30s';
set local lock_timeout = '3s';

with public_relations as (
  select c.oid from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p','v','m','S','f')
    and not exists (select 1 from pg_depend d
      where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'e')
), public_routines as (
  select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and not exists (select 1 from pg_depend d
    where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
), counts as (
  select (select count(*) from public_relations) as public_nonextension_relations,
    (select count(*) from public_routines) as public_nonextension_routines,
    (select count(*) from auth.users) as auth_users,
    (select count(*) from storage.buckets) as storage_buckets,
    (select count(*) from storage.objects) as storage_objects
), checks(check_name,status,details) as (
  select '01 Read-only context and owner target confirmation', 'INFO', jsonb_build_object(
    'checked_at', current_timestamp, 'current_database', current_database(),
    'transaction_read_only', current_setting('transaction_read_only'),
    'transaction_isolation', current_setting('transaction_isolation'),
    'intended_staging_reference', 'dczlddwbtgvfdujgcitb',
    'production_reference_to_avoid', 'kttkospkblwvguuwnhjj',
    'project_identity_scope', 'Owner verifies Dashboard URL; SQL does not establish hosted project identity')
  union all
  select '02 PostgreSQL and installed extensions', 'INFO', jsonb_build_object(
    'server_version', current_setting('server_version'),
    'server_version_num', current_setting('server_version_num'),
    'extensions', coalesce((select jsonb_agg(jsonb_build_object(
      'name', e.extname, 'version', e.extversion, 'schema', n.nspname) order by e.extname)
      from pg_extension e join pg_namespace n on n.oid = e.extnamespace), '[]'::jsonb))
  union all
  select '03 Scoped fresh-target aggregate counts',
    case when public_nonextension_relations = 0 and public_nonextension_routines = 0
      and auth_users = 0 and storage_buckets = 0 and storage_objects = 0
      then 'PASS' else 'REVIEW' end,
    to_jsonb(counts) || jsonb_build_object('scope',
      'Counts in selected public/Auth/Storage scope only; zero is not all-schema emptiness or isolation proof. Unexpected counts require review before writes.')
  from counts
  union all
  select '04 Isolation and initialization remain pending', 'REVIEW', jsonb_build_object(
    'remaining', 'Owner target identity, hosted/source schema parity, isolated frontend/Auth/Storage/Edge credentials and safe dispatch destinations must be verified before migration/test writes.',
    'schema_or_data_created_by_this_check', false,
    'production_rows_imported_by_this_check', false,
    'dispatch_or_restore_verified_by_this_check', false)
)
select check_name,status,details from checks order by check_name;
rollback;
