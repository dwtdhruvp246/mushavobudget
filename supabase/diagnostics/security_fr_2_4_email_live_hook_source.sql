-- Select STAGING dczlddwbtgvfdujgcitb in SQL Editor first.
-- Read-only. Returns one previously fingerprinted hook body for source review only.
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
    RAISE EXCEPTION 'EMAIL_HOOK_REVIEW_REQUIRES_PRIVILEGED_SQL_EDITOR';
  END IF;
END;
$guard$;
WITH functions AS (
  SELECT p.*, l.lanname, r.rolname AS function_owner,
    replace(p.prosrc,E'\r\n',E'\n') AS lf_body
  FROM pg_proc p
  JOIN pg_language l ON l.oid=p.prolang
  JOIN pg_roles r ON r.oid=p.proowner
  WHERE p.pronamespace='public'::regnamespace
    AND p.proname='rls_auto_enable'
), candidate AS (
  SELECT f.*, e.evtname, e.evtevent, e.evtenabled,
    er.rolname AS hook_owner,
    ARRAY(SELECT unnest(e.evttags) ORDER BY 1) AS tags
  FROM functions f
  JOIN pg_event_trigger e ON e.evtfoid=f.oid
  JOIN pg_roles er ON er.oid=e.evtowner
  WHERE e.evtname='ensure_rls'
), checked AS (
  SELECT c.*,
    (SELECT count(*) FROM functions)=1
    AND (SELECT count(*) FROM pg_event_trigger WHERE evtfoid=c.oid)=1
    AND c.prokind='f' AND c.pronargs=0 AND c.pronargdefaults=0
    AND c.prorettype='event_trigger'::regtype AND c.lanname='plpgsql'
    AND c.function_owner='postgres' AND c.hook_owner='postgres'
    AND c.prosecdef AND NOT c.proisstrict AND NOT c.proleakproof
    AND c.provolatile='v' AND c.proparallel='u' AND c.prosupport=0
    AND c.proconfig=ARRAY['search_path=pg_catalog']::text[]
    AND c.evtevent='ddl_command_end' AND c.evtenabled='O'
    AND c.tags=ARRAY['CREATE TABLE','CREATE TABLE AS','SELECT INTO']::text[]
    AND octet_length(c.lf_body)=953
    AND md5(c.lf_body)='99be20677b456ea8d3be47bdd44fb369'
    AND NOT (c.lf_body ~* '(password|secret|token|credential|api[_-]?key|authorization|bearer|https?://|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+)')
    AS source_can_be_returned
  FROM candidate c
), inventory AS (
  SELECT e.evtname AS name, e.evtevent AS event,
    e.evtenabled::text AS enabled_mode, e.evttags AS tags,
    n.nspname AS function_schema, p.proname AS function_name,
    er.rolname AS hook_owner, pr.rolname AS function_owner,
    md5(replace(p.prosrc,E'\r\n',E'\n')) AS lf_body_md5
  FROM pg_event_trigger e
  JOIN pg_proc p ON p.oid=e.evtfoid
  JOIN pg_namespace n ON n.oid=p.pronamespace
  JOIN pg_roles er ON er.oid=e.evtowner
  JOIN pg_roles pr ON pr.oid=p.proowner
)
SELECT jsonb_build_object(
  'stage_step','FR.2.4.E4.12_LIVE_HOOK_SOURCE_REVIEW',
  'scope','READ_ONLY_CATALOG_AND_SINGLE_PINNED_HOOK_SOURCE_NOT_INSTALLATION',
  'target_project','dczlddwbtgvfdujgcitb',
  'checked_UTC',clock_timestamp(),
  'result',CASE WHEN coalesce((SELECT bool_and(source_can_be_returned) FROM checked),false)
    THEN 'PINNED_HOOK_SOURCE_RETURNED_FOR_REVIEW'
    ELSE 'HOOK_METADATA_REVIEW_REQUIRED_SOURCE_WITHHELD' END,
  'transaction_read_only',current_setting('transaction_read_only'),
  'session_replication_role',current_setting('session_replication_role'),
  'selected_function_overloads',(SELECT count(*) FROM functions),
  'selected_hook_bindings',(SELECT count(*) FROM candidate),
  'selected_hook',(
    SELECT jsonb_build_object(
      'name',evtname,'event',evtevent,'enabled_mode',evtenabled::text,
      'tags',tags,'function_schema','public','function_name',proname,
      'function_owner',function_owner,'hook_owner',hook_owner,
      'language',lanname,'security_definer',prosecdef,
      'search_path_settings',proconfig,
      'identity_arguments',pg_get_function_identity_arguments(oid),
      'lf_body_bytes',octet_length(lf_body),'lf_body_md5',md5(lf_body),
      'lf_body_sha256',encode(sha256(convert_to(lf_body,'UTF8')),'hex'),
      'anon_execute',has_function_privilege('anon',oid,'EXECUTE'),
      'authenticated_execute',has_function_privilege('authenticated',oid,'EXECUTE'),
      'service_role_execute',has_function_privilege('service_role',oid,'EXECUTE'),
      'pinned_source_returned',coalesce(source_can_be_returned,false),
      'lf_function_body_for_review',CASE WHEN source_can_be_returned THEN lf_body ELSE NULL END
    ) FROM checked ORDER BY oid LIMIT 1
  ),
  'event_hook_count',(SELECT count(*) FROM inventory),
  'event_hook_inventory',coalesce((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY name)
    FROM (SELECT * FROM inventory ORDER BY name LIMIT 20) x
  ),'[]'::jsonb),
  'event_hook_inventory_truncated',(SELECT count(*)>20 FROM inventory),
  'private_installer_namespace_present',to_regnamespace('mushavo_email_install') IS NOT NULL,
  'email_backend_namespace_present',to_regnamespace('mushavo_email_auth') IS NOT NULL,
  'project_selection_independently_verified',false,
  'prior_MD5_pin_is_provenance_or_safety_acceptance',false,
  'application_rows_read',false,
  'application_or_hook_functions_invoked',0,
  'installer_invoked',false,
  'hooks_disabled_or_changed',false,
  'rows_roles_grants_Auth_or_settings_persistently_changed',false,
  'live_activation_approved',false,
  'hosted_acceptance',false,
  'findings_closed','[]'::jsonb
) AS email_live_hook_source_review;
ROLLBACK;
