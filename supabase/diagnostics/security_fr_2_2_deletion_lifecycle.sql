-- Select STAGING dczlddwbtgvfdujgcitb first. Metadata only; no payment deletion.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
SET LOCAL search_path = pg_catalog, public;
SET LOCAL TIME ZONE 'UTC';
DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname=current_user AND (rolsuper OR rolbypassrls)
  ) THEN RAISE EXCEPTION 'LIFECYCLE_REQUIRES_PRIVILEGED_SQL_EDITOR'; END IF;
END;
$guard$;
WITH selected AS (
  SELECT oid,relname,relkind,relrowsecurity,relforcerowsecurity
  FROM pg_class WHERE oid IN (
    'public.payment_records'::regclass,'public.payment_conversions'::regclass
  )
), delete_triggers AS (
  SELECT c.relname AS relation_name,t.tgname AS trigger_name,
    t.tgenabled::text AS enabled_mode,t.tgtype::integer AS event_bits,
    n.nspname AS function_schema,p.proname AS function_name,
    p.prosecdef AS security_definer,p.proconfig AS function_settings,
    md5(replace(p.prosrc,E'\r\n',E'\n')) AS function_lf_body_md5,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
  FROM pg_trigger t JOIN selected c ON c.oid=t.tgrelid
  JOIN pg_proc p ON p.oid=t.tgfoid
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE NOT t.tgisinternal AND (t.tgtype::integer & 8)<>0
), fk_rows AS (
  SELECT c.conname AS constraint_name,
    c.conrelid::regclass::text AS referencing_relation,
    c.confrelid::regclass::text AS referenced_relation,
    ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num,ord)
          JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num ORDER BY k.ord) AS referencing_columns,
    ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(num,ord)
          JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.num ORDER BY k.ord) AS referenced_columns,
    c.confdeltype::text AS delete_action_code,c.convalidated AS validated
  FROM pg_constraint c WHERE c.contype='f'
    AND (c.conrelid IN (SELECT oid FROM selected) OR c.confrelid IN (SELECT oid FROM selected))
), policies AS (
  SELECT c.relname AS relation_name,p.polname AS policy_name,
    p.polcmd::text AS command_code,p.polpermissive AS permissive,
    md5(COALESCE(pg_get_expr(p.polqual,p.polrelid),'')) AS using_md5,
    md5(COALESCE(pg_get_expr(p.polwithcheck,p.polrelid),'')) AS check_md5
  FROM pg_policy p JOIN selected c ON c.oid=p.polrelid
)
SELECT jsonb_build_object(
  'stage_step','FR.2.2_DELETION_LIFECYCLE_REVIEW',
  'scope','READ_ONLY_DELETE_TRIGGER_FK_POLICY_AND_GRANT_METADATA_NOT_DELETION_ACCEPTANCE',
  'target_project','dczlddwbtgvfdujgcitb',
  'checked_UTC',clock_timestamp(),
  'transaction_read_only',current_setting('transaction_read_only'),
  'selected_relations',(SELECT jsonb_agg(jsonb_build_object(
    'name',relname,'relation_kind',relkind::text,'RLS',relrowsecurity,
    'force_RLS',relforcerowsecurity,
    'authenticated_DELETE_grant',has_table_privilege('authenticated',oid,'DELETE'),
    'anon_DELETE_grant',has_table_privilege('anon',oid,'DELETE'),
    'rewrite_rule_count',(SELECT count(*) FROM pg_rewrite WHERE ev_class=s.oid)
  ) ORDER BY relname) FROM selected s),
  'delete_trigger_count',(SELECT count(*) FROM delete_triggers),
  'delete_triggers',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY relation_name,trigger_name)
    FROM (SELECT * FROM delete_triggers ORDER BY relation_name,trigger_name LIMIT 20) x),'[]'::jsonb),
  'delete_trigger_details_truncated',(SELECT count(*)>20 FROM delete_triggers),
  'FK_reference_count',(SELECT count(*) FROM fk_rows),
  'FK_references',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY referencing_relation,constraint_name)
    FROM (SELECT * FROM fk_rows ORDER BY referencing_relation,constraint_name LIMIT 50) x),'[]'::jsonb),
  'FK_details_truncated',(SELECT count(*)>50 FROM fk_rows),
  'selected_policy_fingerprints',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY relation_name,policy_name)
    FROM (SELECT * FROM policies ORDER BY relation_name,policy_name LIMIT 50) x),'[]'::jsonb),
  'policy_details_truncated',(SELECT count(*)>50 FROM policies),
  'project_selection_independently_verified',false,
  'application_routines_invoked',0,
  'payment_rows_function_bodies_credentials_or_actor_identifiers_printed',false,
  'rows_triggers_functions_policies_grants_accounts_or_settings_changed',false,
  'hosted_acceptance',false,
  'findings_closed','[]'::jsonb
) AS deletion_lifecycle_review;
ROLLBACK;
