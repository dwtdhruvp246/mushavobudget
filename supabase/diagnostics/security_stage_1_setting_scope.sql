-- Stage 1.2: metadata-only settings/parameter-permission scope, not a backup.
-- Owner verifies Dashboard project kttkospkblwvguuwnhjj before running.
-- Returns setting keys, scope, role/database names and permission metadata.
-- Never returns setting values, passwords, customer rows or function bodies.
-- Catalog errors are errors, never substituted with empty/PASS results.
begin transaction isolation level repeatable read read only;
set local search_path = pg_catalog;
set local statement_timeout = '30s';
set local lock_timeout = '3s';

with configuration as (
  select s.setdatabase, s.setrole, r.rolname as role_name,
    d.datname as database_name,
    case
      when s.setdatabase = 0 and s.setrole <> 0 then 'role_wide'
      when s.setdatabase <> 0 and s.setrole = 0 then 'database_wide'
      when s.setdatabase <> 0 and s.setrole <> 0 then 'role_in_database'
      else 'all_roles_all_databases'
    end as scope,
    (s.setrole = 0 or r.oid is not null) and
      (s.setdatabase = 0 or d.oid is not null) as identities_resolved,
    s.setconfig is not null as config_array_present,
    cardinality(s.setconfig) as setting_count,
    coalesce((select jsonb_agg(split_part(x.item, '=', 1) order by x.position)
      from unnest(s.setconfig) with ordinality as x(item, position)
      where position('=' in x.item) > 0
        and split_part(x.item, '=', 1) ~ '^[A-Za-z_][A-Za-z0-9_.]*$'), '[]'::jsonb) as setting_keys,
    (select count(*) from unnest(s.setconfig) as x(item)
      where x.item is null or position('=' in x.item) = 0
        or split_part(x.item, '=', 1) !~ '^[A-Za-z_][A-Za-z0-9_.]*$') as unrecognized_entries,
    s.setdatabase = 0 and s.setrole <> 0 and r.oid is not null
      and r.rolname !~ '^pg_' as role_wide_export_candidate,
    s.setdatabase <> 0 as database_scoped_requires_reconciliation
  from pg_db_role_setting s
  left join pg_roles r on r.oid = s.setrole
  left join pg_database d on d.oid = s.setdatabase
), scope_counts as (
  select scope, count(*) as records from configuration group by scope
), checks(check_name, status, details) as (
  select '01 Read-only settings-scope context', 'INFO', jsonb_build_object(
    'checked_at', current_timestamp,
    'server_version', current_setting('server_version'),
    'current_database', current_database(),
    'transaction_read_only', current_setting('transaction_read_only'),
    'transaction_isolation', current_setting('transaction_isolation'),
    'dashboard_project_identity', 'Owner verifies kttkospkblwvguuwnhjj; SQL does not prove project identity')
  union all
  select '02 Role database and combined setting scope without values', 'INFO', jsonb_build_object(
    'record_count', (select count(*) from configuration),
    'records_by_scope', coalesce((select jsonb_object_agg(scope, records) from scope_counts), '{}'::jsonb),
    'role_wide_export_candidate_records', (select count(*) from configuration where role_wide_export_candidate),
    'role_wide_export_candidate_known_setting_entries', coalesce((select sum(setting_count)
      from configuration where role_wide_export_candidate), 0),
    'incomplete_metadata_records', (select count(*) from configuration
      where not identities_resolved or not config_array_present or unrecognized_entries > 0),
    'records', coalesce((select jsonb_agg(jsonb_build_object(
      'scope', c.scope, 'role', c.role_name, 'database', c.database_name,
      'identities_resolved', c.identities_resolved,
      'config_array_present', c.config_array_present,
      'setting_count', c.setting_count, 'setting_keys', c.setting_keys,
      'unrecognized_entries', c.unrecognized_entries,
      'role_wide_export_candidate', c.role_wide_export_candidate,
      'database_scoped_requires_reconciliation', c.database_scoped_requires_reconciliation)
      order by c.scope, c.database_name, c.role_name) from configuration c), '[]'::jsonb),
    'scope', 'Keys/counts/scope only. Roles-only exports role-wide non-pg-role settings; database scopes, exact archived values and any unresolved metadata require separate private reconciliation.')
  union all
  select '03 Nondefault parameter permissions without parameter values', 'INFO', jsonb_build_object(
    'parameter_acl_records', (select count(*) from pg_parameter_acl),
    'parameters', coalesce((select jsonb_agg(jsonb_build_object(
      'parameter', a.parname, 'acl_is_null', a.paracl is null,
      'entries', coalesce((select jsonb_agg(jsonb_build_object(
        'grantor', grantor.rolname,
        'grantee', case when x.grantee = 0 then 'PUBLIC' else grantee.rolname end,
        'grantor_resolved', grantor.oid is not null,
        'grantee_resolved', x.grantee = 0 or grantee.oid is not null,
        'privilege', x.privilege_type, 'grant_option', x.is_grantable)
        order by grantor.rolname, grantee.rolname, x.privilege_type, x.is_grantable)
        from aclexplode(a.paracl) x
        left join pg_roles grantor on grantor.oid = x.grantor
        left join pg_roles grantee on grantee.oid = x.grantee), '[]'::jsonb))
      order by a.parname) from pg_parameter_acl a), '[]'::jsonb),
    'scope', 'Nondefault catalog permissions only; no parameter values. Null ACL is flagged and is not an empty/effective-default privilege proof. Exact exported ACL semantics and managed restore authority remain unverified.')
  union all
  select '04 Current builtin-to-builtin membership metadata', 'INFO', jsonb_build_object(
    'memberships', coalesce((select jsonb_agg(jsonb_build_object(
      'granted_role', parent.rolname, 'member', member.rolname,
      'grantor', grantor.rolname, 'grantor_resolved', grantor.oid is not null,
      'admin_option', m.admin_option, 'inherit_option', m.inherit_option,
      'set_option', m.set_option)
      order by parent.rolname, member.rolname, grantor.rolname)
      from pg_auth_members m join pg_roles parent on parent.oid = m.roleid
      join pg_roles member on member.oid = m.member
      left join pg_roles grantor on grantor.oid = m.grantor
      where parent.rolname ~ '^pg_' and member.rolname ~ '^pg_'), '[]'::jsonb),
    'scope', 'Current metadata for the roles-only omission category; not a command to restore managed builtin grants and not recovered destination behavior.')
  union all
  select '05 Private settings and recovery proof still required', 'REVIEW', jsonb_build_object(
    'backup_created_by_this_check', false,
    'restore_verified_by_this_check', false,
    'remaining', 'Privately reconcile exact role-wide and database-scoped archived values, parameter ACL semantics, omitted builtin/managed authority, credentials/keys, Storage bytes and provider configuration; live source drift and isolated recovery remain open. Google stays deferred.')
)
select check_name, status, details from checks order by check_name;
rollback;
