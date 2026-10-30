# Missing profile confirmed; inspect the provisioning trigger

Stage 3/10 | FR.2/8 | Batch W/Z. 27 October 2026, FRE247.

Diagnostic source pin: `c42fe2d06ed2bcd9d9bf40ffd91998c12152e817`.

[Owner result](security-fr-2-batch-w-owner-recovery-profile-missing.json) identifies the recovery-window blocker: one matched Auth account, confirmed email, no current ban, and no application profile. This is not an email-confirmation or password rejection. The diagnostic made no writes. The window is not ready, and no matching-password save/code is requested.

[Current source baseline](security-fr-2-batch-w-profile-provisioning-source-baseline.json) shows that signup already has **on_auth_user_created_create_profile**, an Auth INSERT/email-or-metadata UPDATE trigger calling **public.handle_new_user_profile()**. The last canonical function creates/synchronizes the profile, links legacy family records and normally provisions a Personal workspace. Admin invitation metadata and pending-setup workspace restrictions are significant; do not replay this Auth update path blindly or insert a replacement profile with unreviewed signup origin. The frontend also has an ensureProfile fallback. Source does not prove the current live trigger/function is present or explain whether the profile was manually removed. Treat the cause as unknown until metadata arrives.

Next [read-only metadata SQL](../../supabase/diagnostics/security_fr_2_5_profile_provisioning.sql) returns fixed classes/counts/booleans: Auth trigger state and event/column/function shape, reviewed normalized function-body/owner/language/config match, active-profile default match, enabled profile INSERT user-trigger count, recorded staging target and retained/current catalog equality. It includes no account selector and returns no mailbox, UUID, private catalog hash, arbitrary function source or password. Source function SHA256 is a public repository baseline literal, not a hash of a private value. A target marker does not replace independently selecting staging.

[Offline SQL check](security-fr-2-batch-w-profile-provisioning-local-check.json) passed with the exact reviewed function/trigger and modeled profile/control tables, including enabled-origin and disabled state projection. No Auth signup/provisioning, full migration replay or new test suite was run.

Owner: in Supabase staging project **dczlddwbtgvfdujgcitb**, run the complete READ ONLY SQL supplied in chat and return the safe JSON. It begins/ends with ROLLBACK, creates no object and changes no account/profile/status/confirmation/window or proof. Keep the genuine recovery form open and unchanged. Do not repeat the window or submit matching passwords yet. The result will distinguish an isolated profile gap from a missing/disabled/changed provisioning path and allow a concrete narrow repair to be prepared with actual source/trigger effects accounted for.

No global schema replay, user deletion/recreation, blanket account activation, manual confirmation, guard bypass, new inbox, settings update or deployment is requested. The accepted ZIP/runtime and earlier owner recipient preparation/new deployment remain retained. Both-environment recipient-secret save confirmation is still outstanding. Both deferred UI items remain deferred, V Admin MFA on hold, full W/FR.2/Stage3/release/findings open; production/native unchanged and APK deferred.

Complete SQL:

```sql
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
```
