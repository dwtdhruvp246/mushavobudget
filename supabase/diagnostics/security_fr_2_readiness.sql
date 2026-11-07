-- FR.2.1: owner must select STAGING dczlddwbtgvfdujgcitb in the dashboard.
-- Metadata and aggregate counts only. No application routine is invoked.
begin transaction read only;
set local statement_timeout = '15s';
set local lock_timeout = '3s';

do $guard$
begin
  if not exists (
    select 1 from pg_roles where rolname = current_user and (rolsuper or rolbypassrls)
  ) then
    raise exception 'READINESS_REQUIRES_DEFAULT_PRIVILEGED_SQL_EDITOR_ROLE';
  end if;
end;
$guard$;

with expected_functions(name, body_lf_md5) as (
  values
    ('sync_payment_record_workspace', '8f568f342d4e928b4c27437ba7f544e5'),
    ('guard_workspace_finance_write', '783883ce4af23615f768a0990b6f2478'),
    ('set_payment_outbox_workspace_context', '85794a38ffbe61b56bab8aff4b0a3319')
), function_rows as (
  select e.name, p.oid is not null as present,
    l.lanname as language, p.prorettype::regtype::text as return_type,
    p.prosecdef as security_definer,
    'search_path=public, pg_temp' = any(coalesce(p.proconfig, '{}'::text[])) as reviewed_search_path,
    md5(replace(p.prosrc, E'\r\n', E'\n')) as observed_lf_body_md5,
    e.body_lf_md5 as reviewed_lf_body_md5,
    coalesce(md5(replace(p.prosrc, E'\r\n', E'\n')) = e.body_lf_md5, false) as lf_body_matches,
    case when p.oid is not null then has_function_privilege('anon', p.oid, 'EXECUTE') end as anon_execute,
    case when p.oid is not null then has_function_privilege('authenticated', p.oid, 'EXECUTE') end as authenticated_execute
  from expected_functions e
  left join pg_proc p on p.pronamespace = 'public'::regnamespace
    and p.proname = e.name and p.pronargs = 0 and p.prokind = 'f'
  left join pg_language l on l.oid = p.prolang
), expected_triggers(relation_name, trigger_name) as (
  values
    ('payment_records', 'sync_payment_record_workspace_trigger'),
    ('payment_records', 'guard_payment_record_write_trigger'),
    ('payment_items', 'z_guard_payment_item_write_trigger'),
    ('notification_outbox', 'set_payment_outbox_workspace_context_trigger')
), trigger_rows as (
  select e.relation_name, e.trigger_name, t.oid is not null as present,
    t.tgenabled::text as enabled_mode, t.tgtype::integer as event_bits,
    n.nspname as function_schema, p.proname as function_name,
    coalesce((select jsonb_agg(a.attname order by a.attnum)
      from pg_attribute a where a.attrelid = t.tgrelid
        and a.attnum = any(t.tgattr::smallint[])), '[]'::jsonb) as update_columns,
    case when t.oid is not null then cardinality(t.tgattr::smallint[]) = 0 end as empty_update_column_list
  from expected_triggers e
  left join pg_trigger t on t.tgrelid = to_regclass('public.' || e.relation_name)
    and t.tgname = e.trigger_name and not t.tgisinternal
  left join pg_proc p on p.oid = t.tgfoid
  left join pg_namespace n on n.oid = p.pronamespace
), selected_tables(name) as (
  values ('payment_items'), ('payment_records'), ('payment_conversions'),
    ('budget_workspaces'), ('workspace_members'), ('workspace_invitations'),
    ('business_role_permissions'), ('business_member_permissions'), ('business_member_scopes')
), table_rows as (
  select s.name, c.oid is not null as present,
    c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls
  from selected_tables s
  left join pg_class c on c.oid = to_regclass('public.' || s.name)
), policy_rows as (
  select tablename, policyname, permissive, roles, cmd,
    md5(coalesce(qual, '')) as using_md5,
    md5(coalesce(with_check, '')) as check_md5
  from pg_policies where schemaname = 'public'
    and tablename in (select name from selected_tables)
), record_counts as (
  select count(*) as records_total,
    count(*) filter (where i.id is null) as records_without_parent,
    count(*) filter (where r.workspace_id is null) as records_with_null_workspace,
    count(*) filter (where i.id is not null and r.workspace_id is distinct from i.workspace_id) as parent_workspace_mismatches
  from public.payment_records r left join public.payment_items i on i.id = r.payment_item_id
), conversion_counts as (
  select count(*) as payment_record_conversions_total,
    count(*) filter (where r.id is null) as conversions_without_record,
    count(*) filter (where r.id is not null and c.workspace_id is distinct from r.workspace_id) as record_workspace_mismatches
  from public.payment_conversions c left join public.payment_records r on r.id = c.entity_id
  where c.entity_type = 'payment_record'
), operators as (
  select count(distinct a.user_id) as active_super_users_with_verified_totp
  from public.app_admins a join public.profiles p on p.id = a.user_id
  join auth.mfa_factors f on f.user_id = a.user_id
  where a.role = 'super_admin' and p.account_status = 'active'
    and f.factor_type = 'totp' and f.status = 'verified'
)
select jsonb_build_object(
  'stage_step', 'FR.2.1',
  'scope', 'READ_ONLY_SELECTED_CATALOG_AND_AGGREGATE_COUNTS_NOT_AUTHORIZATION_ACCEPTANCE',
  'target_project', 'dczlddwbtgvfdujgcitb',
  'project_selection_independently_verified', false,
  'source_pin', '12286dcbade07309bfb8ffe919224252f6cb8bff',
  'checked_UTC', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'transaction_read_only', current_setting('transaction_read_only'),
  'executing_database_role', current_user,
  'selected_functions', (select jsonb_agg(to_jsonb(f) order by f.name) from function_rows f),
  'selected_triggers', (select jsonb_agg(to_jsonb(t) order by t.relation_name, t.trigger_name) from trigger_rows t),
  'selected_tables', (select jsonb_agg(to_jsonb(t) order by t.name) from table_rows t),
  'selected_policy_fingerprints', (select coalesce(jsonb_agg(to_jsonb(p) order by p.tablename, p.policyname), '[]'::jsonb) from policy_rows p),
  'record_consistency_counts', (select to_jsonb(r) from record_counts r),
  'conversion_consistency_counts', (select to_jsonb(c) from conversion_counts c),
  'operator_metadata', (select to_jsonb(o) from operators o),
  'admin_candidate_helpers_present', (select count(*) from pg_proc
    where pronamespace = 'public'::regnamespace and proname in ('admin_mfa_satisfied', 'platform_admin_authorized', 'admin_mfa_status')),
  'Auth_settings_or_recovery_verified', false,
  'application_routines_invoked', 0,
  'rows_accounts_factors_or_permissions_changed', false,
  'raw_rows_function_bodies_emails_or_secrets_printed', false,
  'hosted_acceptance', false,
  'findings_closed', '[]'::jsonb
) as fr2_readiness;

rollback;
