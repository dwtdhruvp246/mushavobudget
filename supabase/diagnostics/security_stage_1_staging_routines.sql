-- 1.3.2: metadata only; manually verify staging Dashboard identity first.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';
SELECT '01 Public nonextension routine metadata' AS check_name,
       'REVIEW' AS status,
       COALESCE(jsonb_agg(jsonb_build_object(
         'signature', p.oid::regprocedure::text,
         'kind', p.prokind,
         'return_type', pg_catalog.format_type(p.prorettype, NULL),
         'language', l.lanname,
         'owner', pg_catalog.pg_get_userbyid(p.proowner),
         'security_definer', p.prosecdef
       ) ORDER BY p.oid::regprocedure::text), '[]'::jsonb) AS details
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
JOIN pg_catalog.pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'public'
AND NOT EXISTS (
 SELECT 1 FROM pg_catalog.pg_depend d
 WHERE d.classid = 'pg_catalog.pg_proc'::regclass
 AND d.objid = p.oid AND d.deptype = 'e'
);
SELECT '02 Event trigger metadata' AS check_name, 'REVIEW' AS status,
 COALESCE(jsonb_agg(jsonb_build_object(
   'name', e.evtname, 'event', e.evtevent, 'enabled', e.evtenabled,
   'routine', e.evtfoid::regprocedure::text,
   'owner', pg_catalog.pg_get_userbyid(e.evtowner), 'tags', e.evttags
 ) ORDER BY e.evtname), '[]'::jsonb) AS details
FROM pg_catalog.pg_event_trigger e;
SELECT '03 Review boundary' AS check_name, 'INFO' AS status,
 jsonb_build_object(
  'intended_staging_reference', 'dczlddwbtgvfdujgcitb',
  'production_reference_to_avoid', 'kttkospkblwvguuwnhjj',
  'function_bodies_or_setting_values_returned', false,
  'schema_or_data_modified', false,
  'routine_behavior_or_hosted_identity_verified', false
 ) AS details;
ROLLBACK;
