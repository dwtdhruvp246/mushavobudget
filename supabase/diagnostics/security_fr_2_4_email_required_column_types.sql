-- Select STAGING dczlddwbtgvfdujgcitb. Metadata only; do not alter Auth tables.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
SET LOCAL search_path = pg_catalog;
SET LOCAL TIME ZONE 'UTC';
DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname=current_user AND (rolsuper OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'EMAIL_COLUMN_REVIEW_REQUIRES_PRIVILEGED_SQL_EDITOR';
  END IF;
END;
$guard$;
WITH required(ord,relation_name,column_name,expected_type) AS (
  VALUES
    (1,'auth.users','id','uuid'),
    (2,'auth.users','email_confirmed_at','timestamptz'),
    (3,'auth.users','encrypted_password','text'),
    (4,'auth.users','banned_until','timestamptz'),
    (5,'auth.sessions','id','uuid'),
    (6,'auth.sessions','user_id','uuid'),
    (7,'auth.sessions','not_after','timestamptz'),
    (8,'public.profiles','id','uuid'),
    (9,'public.profiles','account_status','text')
), details AS (
  SELECT x.ord,x.relation_name,x.column_name,x.expected_type,
    to_regclass(x.relation_name) IS NOT NULL AS relation_present,
    a.attnum IS NOT NULL AS column_present,
    n.nspname AS actual_type_schema,t.typname AS actual_type_name,
    format_type(a.atttypid,a.atttypmod) AS actual_formatted_type,
    t.typtype::text AS type_kind,
    CASE WHEN t.typtype='d' THEN
      jsonb_build_object('schema',bn.nspname,'name',bt.typname)
      ELSE NULL END AS immediate_domain_base_type,
    a.attnotnull AS not_null,
    coalesce(a.atttypid=to_regtype(x.expected_type),false)
      AS matches_exact_expected_type
  FROM required x
  LEFT JOIN pg_attribute a
    ON a.attrelid=to_regclass(x.relation_name)
    AND a.attname=x.column_name AND a.attnum>0 AND NOT a.attisdropped
  LEFT JOIN pg_type t ON t.oid=a.atttypid
  LEFT JOIN pg_namespace n ON n.oid=t.typnamespace
  LEFT JOIN pg_type bt ON bt.oid=t.typbasetype
  LEFT JOIN pg_namespace bn ON bn.oid=bt.typnamespace
)
SELECT jsonb_build_object(
  'stage_step','FR.2.4.E4.15_COLUMN_TYPE_REVIEW',
  'scope','READ_ONLY_NINE_REQUIRED_COLUMN_TYPES_NOT_VALUES_OR_COMPATIBILITY_ACCEPTANCE',
  'target_project','dczlddwbtgvfdujgcitb',
  'checked_UTC',clock_timestamp(),
  'result',CASE WHEN bool_and(matches_exact_expected_type)
    THEN 'ALL_NINE_EXACT_TYPES_MATCH_NOT_INSTALLATION_APPROVAL'
    ELSE 'REQUIRED_COLUMN_METADATA_REVIEW_REQUIRED' END,
  'required_columns',count(*),
  'present_columns',count(*) FILTER(WHERE column_present),
  'exact_type_matches',count(*) FILTER(WHERE matches_exact_expected_type),
  'missing_columns',count(*) FILTER(WHERE NOT column_present),
  'present_but_different_type',count(*) FILTER(
    WHERE column_present AND NOT matches_exact_expected_type
  ),
  'column_details',jsonb_agg(to_jsonb(d)-'ord' ORDER BY ord),
  'transaction_read_only',current_setting('transaction_read_only'),
  'application_rows_read',false,
  'column_values_defaults_credentials_or_function_bodies_printed',false,
  'application_or_hook_functions_invoked',0,
  'Auth_tables_types_functions_or_settings_persistently_changed',false,
  'installer_registered_or_invoked',false,
  'project_selection_independently_verified',false,
  'type_compatibility_or_hosted_authorization_accepted',false,
  'live_activation_approved',false,
  'hosted_acceptance',false,
  'findings_closed','[]'::jsonb
) AS email_required_column_type_review
FROM details d;
ROLLBACK;
