-- One fixed catalog SELECT. No scheduler commands, application rows or writes.
WITH job_relation AS (
  SELECT c.oid,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relowner,n.oid AS schema_oid
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='cron' AND c.relname='job'
), role_context AS (
  SELECT r.oid,r.rolsuper,r.rolbypassrls FROM pg_catalog.pg_roles r WHERE r.rolname=CURRENT_USER
)
SELECT pg_catalog.jsonb_build_object(
  'read_only_role',CURRENT_USER='supabase_read_only_user',
  'transaction_read_only',pg_catalog.current_setting('transaction_read_only'),
  'cron_schema_present',EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname='cron'),
  'cron_job_relation_present',EXISTS(SELECT 1 FROM job_relation),
  'cron_job_table_shape_matches',COALESCE((SELECT j.relkind IN ('r','p') AND
    (SELECT count(*)=2 FROM pg_catalog.pg_attribute a WHERE a.attrelid=j.oid AND NOT a.attisdropped AND
      ((a.attname='active' AND a.atttypid='pg_catalog.bool'::pg_catalog.regtype) OR
       (a.attname='command' AND a.atttypid='pg_catalog.text'::pg_catalog.regtype))) FROM job_relation j),false),
  'cron_schema_usage',COALESCE((SELECT pg_catalog.has_schema_privilege(j.schema_oid,'USAGE') FROM job_relation j),false),
  'cron_job_table_select',COALESCE((SELECT pg_catalog.has_table_privilege(j.oid,'SELECT') FROM job_relation j),false),
  'cron_job_rls_enabled',COALESCE((SELECT j.relrowsecurity FROM job_relation j),false),
  'cron_job_force_rls',COALESCE((SELECT j.relforcerowsecurity FROM job_relation j),false),
  'role_bypasses_job_rls',COALESCE((SELECT r.rolsuper OR r.rolbypassrls OR
    (r.oid=j.relowner AND NOT j.relforcerowsecurity) FROM job_relation j CROSS JOIN role_context r),false)
) AS edge_scheduler_access;
