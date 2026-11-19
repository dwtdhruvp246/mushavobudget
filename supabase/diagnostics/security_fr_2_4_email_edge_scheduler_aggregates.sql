-- Only after the fixed access probe confirms the selected table shape/grants.
-- Command text is compared inside PostgreSQL; it is never returned or executed.
SELECT pg_catalog.jsonb_build_object(
  'read_only_role',CURRENT_USER='supabase_read_only_user',
  'transaction_read_only',pg_catalog.current_setting('transaction_read_only'),
  'visible_jobs',count(*)::integer,
  'visible_active_jobs',count(*) FILTER(WHERE j.active)::integer,
  'visible_active_FX_text_matches',count(*) FILTER(WHERE j.active AND
    pg_catalog.strpos(pg_catalog.lower(j.command),'sync-exchange-rates')>0)::integer,
  'all_rows_visible_under_selected_rls_controls',COALESCE((SELECT NOT c.relrowsecurity OR r.rolsuper OR r.rolbypassrls OR
    (r.oid=c.relowner AND NOT c.relforcerowsecurity)
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN pg_catalog.pg_roles r
    WHERE n.nspname='cron' AND c.relname='job' AND c.relkind IN ('r','p') AND r.rolname=CURRENT_USER),false),
  'indirect_dynamic_or_external_callers_excluded',false
) AS edge_scheduler_aggregates FROM cron.job j;
