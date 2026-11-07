# Identify the recovery account eligibility condition

Stage 3/10 | FR.2/8 | Batch W/Z. 27 October 2026, FRE246.

Diagnostic source pin: `dd0bd1a33d598a592dbadb1e67d0a808d823c303`.

[Owner screenshot receipt](security-fr-2-batch-w-owner-recovery-window-eligibility-review.json) shows SQLSTATE P0001, **CONFIRMED_ACTIVE_RECOVERY_ACCOUNT_REQUIRED**, inline block line44 and zero result rows. In the supplied SQL this guard follows exact-account resolution and precedes any catalog/window read or controller write. The attempt does not open or change the window. The entire submitted query and current database/window state were not independently read back. The screenshot alone does not identify whether confirmation, a missing/nonactive profile or a current ban failed. Do not infer suspension or missing confirmation, force activation, create a replacement account or weaken the predicate from this combined error.

Next run only [the read-only diagnostic](../../supabase/diagnostics/security_fr_2_5_recovery_account_eligibility.sql) in the independently selected Supabase staging project **dczlddwbtgvfdujgcitb**, with the exact account already shown in the genuine recovery form. Its initial ROLLBACK clears a possibly aborted SQL Editor transaction. The next transaction is explicitly READ ONLY and ends in ROLLBACK. It returns a count, guarded booleans, a fixed profile-status classification and the stored target marker. No email, account UUID, ban timestamp, token, password, private hash or application row content is returned. A matching target marker is not independent proof of the physical project; select staging in the dashboard first.

The diagnostic performs no account/profile/confirmation/window/proof write or email request. A nonunique/missing account returns null eligibility fields and UNRESOLVED status. Keep the original genuine recovery form open and return the safe JSON before any matching-password save/code. Explicit confirmation that the recipient secret was saved in both staging environments remains outstanding; do not silently reapply it or request a duplicate deployment. The previous accepted ZIP/source, owner preparation pass and new deployment URL remain recorded at FRE245.

Source note: app.js contains normal ensureProfile provisioning after application entry. A missing-profile bootstrap issue is one possible explanation, not an owner-observed diagnosis. No runtime repair is selected before the actual flags arrive. Existing account activation/confirmation/security checks stay intact. The existing window12 tests and all prior suites are retained without rerun. This diagnostic adds no AU acceptance cases and does not establish hosted password/recovery acceptance.

Both deferred UI items remain deferred; V Admin MFA on hold. Full W/FR.2/Stage3/release/findings remain open. Production/native unchanged, APK deferred.

Complete diagnostic:

```sql
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
```
