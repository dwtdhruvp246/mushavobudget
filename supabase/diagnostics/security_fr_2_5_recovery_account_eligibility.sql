-- Stage 3/10 | FR.2/8 | Batch W/Z. Select staging dczlddwbtgvfdujgcitb.
-- Replace only the placeholder with the account in the existing recovery form.
ROLLBACK;
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='10s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;

WITH target AS (
 SELECT u.email_confirmed_at,u.banned_until,
        p.id AS profile_id,p.account_status
 FROM auth.users u
 LEFT JOIN public.profiles p ON p.id=u.id
 WHERE lower(u.email)=lower('OWNER_CONTROLLED_RECOVERY_EMAIL')
), summary AS (
 SELECT count(*)::integer AS matching_accounts,
  coalesce(bool_and(email_confirmed_at IS NOT NULL),false) AS email_confirmed,
  coalesce(bool_and(profile_id IS NOT NULL),false) AS profile_exists,
  coalesce(bool_and(account_status='active'),false) AS profile_active,
  coalesce(bool_and(banned_until IS NULL
    OR banned_until<=statement_timestamp()),false) AS not_currently_banned
 FROM target
)
SELECT jsonb_build_object(
 'result','RECOVERY_ACCOUNT_ELIGIBILITY_READ_ONLY',
 'matching_accounts',matching_accounts,
 'email_confirmed',CASE WHEN matching_accounts=1 THEN email_confirmed END,
 'profile_exists',CASE WHEN matching_accounts=1 THEN profile_exists END,
 'profile_active',CASE WHEN matching_accounts=1 THEN profile_active END,
 'profile_status_class',CASE WHEN matching_accounts=1 THEN (
  SELECT CASE
   WHEN profile_id IS NULL THEN 'MISSING'
   WHEN account_status='active' THEN 'ACTIVE'
   WHEN account_status='suspended' THEN 'SUSPENDED'
   WHEN account_status IS NULL THEN 'NULL'
   ELSE 'OTHER_NONACTIVE'
  END FROM target
 ) ELSE 'UNRESOLVED' END,
 'not_currently_banned',CASE WHEN matching_accounts=1 THEN not_currently_banned END,
 'recorded_staging_target_matches',EXISTS(
  SELECT 1 FROM mushavo_email_install.rollout_control
  WHERE singleton AND target_project='dczlddwbtgvfdujgcitb'
 ),
 'settings_or_account_writes',0,
 'password_save_requested',false
) AS result
FROM summary;
ROLLBACK;
