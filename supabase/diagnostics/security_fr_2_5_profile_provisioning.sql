-- Stage 3/10 | FR.2/8 | Batch W/Z. Read metadata in staging dczlddwbtgvfdujgcitb.
ROLLBACK;
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='10s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;

WITH profile_trigger AS (
 SELECT t.* FROM pg_trigger t
 WHERE t.tgrelid=to_regclass('auth.users')
 AND t.tgname='on_auth_user_created_create_profile'
 AND NOT t.tgisinternal
)
SELECT jsonb_build_object(
 'result','PROFILE_PROVISIONING_METADATA_READ_ONLY',
 'auth_profile_trigger_state',coalesce((
  SELECT CASE tgenabled
   WHEN 'O' THEN 'ENABLED_ORIGIN'
   WHEN 'A' THEN 'ENABLED_ALWAYS'
   WHEN 'D' THEN 'DISABLED'
   WHEN 'R' THEN 'REPLICA_ONLY'
   ELSE 'OTHER'
  END FROM profile_trigger
 ),'MISSING'),
 'auth_profile_trigger_shape_matches_source',EXISTS(
  SELECT 1 FROM profile_trigger t
  WHERE t.tgtype=21
  AND t.tgfoid=to_regprocedure('public.handle_new_user_profile()')
  AND ARRAY(
   SELECT a.attname::text FROM pg_attribute a
   WHERE a.attrelid=t.tgrelid
   AND a.attnum=ANY(t.tgattr::smallint[])
   ORDER BY a.attname
  )=ARRAY['email','raw_user_meta_data']::text[]
 ),
 'profile_function_matches_reviewed_source',EXISTS(
  SELECT 1 FROM pg_proc p
  JOIN pg_roles r ON r.oid=p.proowner
  JOIN pg_language l ON l.oid=p.prolang
  WHERE p.oid=to_regprocedure('public.handle_new_user_profile()')
  AND r.rolname='postgres' AND l.lanname='plpgsql'
  AND p.prokind='f' AND p.pronargs=0
  AND p.prorettype='trigger'::regtype AND p.prosecdef
  AND p.proconfig=ARRAY['search_path=public, pg_temp']::text[]
  AND encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')=
   '0c70136bcb3e2ebce36bd1829ad83f8e168e774f072faf5d16ca42e1cc502c03'
 ),
 'profile_active_default_matches_source',EXISTS(
  SELECT 1 FROM pg_attribute a
  JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
  WHERE a.attrelid=to_regclass('public.profiles')
  AND a.attname='account_status' AND NOT a.attisdropped
  AND a.atttypid='text'::regtype AND a.attnotnull
  AND pg_get_expr(d.adbin,d.adrelid)='''active''::text'
 ),
 'enabled_profile_insert_user_triggers',(
  SELECT count(*) FROM pg_trigger t
  WHERE t.tgrelid=to_regclass('public.profiles')
  AND NOT t.tgisinternal AND t.tgenabled IN ('O','A')
  AND (t.tgtype::integer & 4)<>0
 ),
 'recorded_staging_target_matches',EXISTS(
  SELECT 1 FROM mushavo_email_install.rollout_control
  WHERE singleton AND target_project='dczlddwbtgvfdujgcitb'
 ),
 'retained_catalog_matches_current',EXISTS(
  SELECT 1 FROM mushavo_email_install.rollout_control
  WHERE singleton AND target_project='dczlddwbtgvfdujgcitb'
  AND catalog_sha256=mushavo_email_install.catalog_identity()
 ),
 'settings_or_account_writes',0,
 'password_save_requested',false
) AS result;
ROLLBACK;
