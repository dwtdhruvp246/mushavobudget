-- Stage 1.2: source metadata for recovery-scope reconciliation, not a backup.
-- Owner checks Dashboard project kttkospkblwvguuwnhjj before running.
-- No customer rows, role passwords, role-setting values, routine bodies,
-- scheduler commands, Vault values, foreign-server options or key material.
-- Catalog role names/memberships and extension table names are metadata.
-- A failed/unavailable query must be reported, not replaced with zero/PASS.
begin transaction isolation level repeatable read read only;
set local statement_timeout = '30s';
set local lock_timeout = '3s';

with namespaces as (
  select oid, nspname from pg_namespace
  where nspname <> 'information_schema' and nspname !~ '^pg_'
), ownership as (
  select n.nspname as schema_name, 'schema' as object_kind,
    n.nspowner as owner_id from pg_namespace n
  where n.oid in (select oid from namespaces)
  union all
  select n.nspname, c.relkind::text, c.relowner
  from pg_class c join namespaces n on n.oid = c.relnamespace
  where c.relkind in ('r','p','v','m','S','f')
  union all
  select n.nspname, 'routine', p.proowner
  from pg_proc p join namespaces n on n.oid = p.pronamespace
), ownership_counts as (
  select o.schema_name, o.object_kind, r.rolname as owner,
    count(*) as object_count
  from ownership o join pg_roles r on r.oid = o.owner_id
  group by o.schema_name, o.object_kind, r.rolname
), extension_relations as (
  select e.oid as extension_id, e.extname, c.oid as relation_id,
    n.nspname as schema_name, c.relname as relation_name,
    c.relkind, c.relpersistence,
    c.oid = any(coalesce(e.extconfig, '{}'::oid[])) as registered_config_table
  from pg_extension e join pg_depend d
    on d.refclassid = 'pg_extension'::regclass and d.refobjid = e.oid
    and d.classid = 'pg_class'::regclass and d.objsubid = 0 and d.deptype = 'e'
  join pg_class c on c.oid = d.objid
  join pg_namespace n on n.oid = c.relnamespace
), checks(check_name, status, details) as (
  select '01 Read-only recovery dependency context', 'INFO', jsonb_build_object(
    'checked_at', current_timestamp,
    'server_version', current_setting('server_version'),
    'transaction_read_only', current_setting('transaction_read_only'),
    'transaction_isolation', current_setting('transaction_isolation'),
    'dashboard_project_identity', 'Owner must verify kttkospkblwvguuwnhjj; SQL does not prove project identity')
  union all
  select '02 Role attributes and exact memberships without secrets', 'INFO', jsonb_build_object(
    'non_system_roles', coalesce((select jsonb_agg(jsonb_build_object(
      'role', r.rolname, 'login', r.rolcanlogin, 'inherit', r.rolinherit,
      'superuser', r.rolsuper, 'bypass_rls', r.rolbypassrls,
      'create_role', r.rolcreaterole, 'create_database', r.rolcreatedb,
      'replication', r.rolreplication, 'connection_limit', r.rolconnlimit,
      'setting_count', coalesce(array_length(r.rolconfig, 1), 0)) order by r.rolname)
      from pg_roles r where r.rolname !~ '^pg_'), '[]'::jsonb),
    'memberships', coalesce((select jsonb_agg(jsonb_build_object(
      'granted_role', parent.rolname, 'member', member.rolname,
      'grantor', grantor.rolname, 'admin_option', m.admin_option,
      'inherit_option', m.inherit_option, 'set_option', m.set_option)
      order by parent.rolname, member.rolname, grantor.rolname)
      from pg_auth_members m join pg_roles parent on parent.oid = m.roleid
      join pg_roles member on member.oid = m.member
      join pg_roles grantor on grantor.oid = m.grantor), '[]'::jsonb),
    'role_database_setting_records', (select count(*) from pg_db_role_setting),
    'configuration_parameter_acl_records', (select count(*) from pg_parameter_acl),
    'scope', 'Role metadata only; no passwords/settings values. Managed-role classification and private recoverable export remain required; do not restore platform roles blindly.')
  union all
  select '03 Non-system schema object ownership totals', 'INFO', coalesce(
    jsonb_agg(to_jsonb(o) order by o.schema_name, o.object_kind, o.owner), '[]'::jsonb)
  from ownership_counts o
  union all
  select '04 Extension members and registered configuration tables', 'INFO', coalesce(
    jsonb_agg(jsonb_build_object(
      'extension', e.extname, 'version', e.extversion,
      'registered_config_table_count', coalesce(array_length(e.extconfig, 1), 0),
      'registered_config_tables', coalesce((select jsonb_agg(jsonb_build_object(
        'schema', n.nspname, 'table', c.relname,
        'relation_kind', c.relkind, 'persistence', c.relpersistence,
        'filter_present', e.extcondition[x.position::integer] <> '')
        order by x.position)
        from unnest(e.extconfig) with ordinality as x(relation_id, position)
        join pg_class c on c.oid = x.relation_id
        join pg_namespace n on n.oid = c.relnamespace), '[]'::jsonb),
      'relation_member_count', (select count(*) from extension_relations x where x.extension_id = e.oid),
      'unlogged_relation_member_count', (select count(*) from extension_relations x
        where x.extension_id = e.oid and x.relpersistence = 'u'))
      order by e.extname), '[]'::jsonb)
  from pg_extension e
  union all
  select '05 Foreign large-object and extension-table indicators', 'INFO', jsonb_build_object(
    'foreign_tables', (select count(*) from pg_foreign_table),
    'foreign_servers', (select count(*) from pg_foreign_server),
    'user_mappings', (select count(*) from pg_user_mappings),
    'large_objects', (select count(*) from pg_largeobject_metadata),
    'extension_tables_in_non_system_schemas', coalesce((select jsonb_agg(jsonb_build_object(
      'extension', x.extname, 'schema', x.schema_name, 'table', x.relation_name,
      'relation_kind', x.relkind, 'persistence', x.relpersistence,
      'registered_config_table', x.registered_config_table)
      order by x.extname, x.schema_name, x.relation_name)
      from extension_relations x where x.relkind in ('r','p','f')
      and x.schema_name <> 'information_schema' and x.schema_name !~ '^pg_'), '[]'::jsonb),
    'scope', 'Source catalog counts at this time, not the earlier export snapshot. No object bytes or server/mapping options retrieved; extension-owned table absence from TOC definitions requires classification.')
  union all
  select '06 Publication definitions and mapping types', 'INFO', jsonb_build_object(
    'publication_count', (select count(*) from pg_publication),
    'publications', coalesce((select jsonb_agg(jsonb_build_object(
      'publication', p.pubname, 'all_tables', p.puballtables,
      'publish_via_partition_root', p.pubviaroot,
      'direct_relation_mapping_count', (select count(*) from pg_publication_rel r where r.prpubid = p.oid),
      'schema_mapping_count', (select count(*) from pg_publication_namespace n where n.pnpubid = p.oid),
      'expanded_table_count', (select count(*) from pg_publication_tables t where t.pubname = p.pubname))
      order by p.pubname) from pg_publication p), '[]'::jsonb),
    'scope', 'Definitions, direct relation mappings and expanded partition/schema table counts are different categories. S1E42 reported broad TOC PUBLICATION count 31 includes its 29 TABLE entries; it is not 31 definitions.')
  union all
  select '07 Recovery dependencies still require evidence', 'REVIEW', jsonb_build_object(
    'backup_created_by_this_check', false,
    'restore_verified_by_this_check', false,
    'remaining', 'Private selected global-role/grant/configuration recovery artifact, exact managed/extension/customization definitions and filters, scheduler/Vault/key dependencies, actual Storage file bytes, Auth/SMTP/Edge/provider recovery configuration and backup operating decisions; Google route remains deferred.')
)
select check_name, status, details from checks order by check_name;
rollback;
