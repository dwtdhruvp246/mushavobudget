-- STAGING dczlddwbtgvfdujgcitb ONLY. Read-only; no MFA reset or deletion.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL mushavo.operator_primary_email='PRIMARY_EMAIL_REPLACE_LOCALLY';
SET LOCAL mushavo.operator_recovery_email='RECOVERY_EMAIL_REPLACE_LOCALLY';
DO $guard$
DECLARE a text:=lower(btrim(current_setting('mushavo.operator_primary_email')));
        b text:=lower(btrim(current_setting('mushavo.operator_recovery_email')));
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'FACTOR_REVIEW_REQUIRES_PRIVILEGED_SQL_EDITOR'; END IF;
 IF a !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
 OR b !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' OR a=b
 OR a IN ('audit.owner@example.com','audit.outsider@example.com')
 OR b IN ('audit.owner@example.com','audit.outsider@example.com')
 THEN RAISE EXCEPTION 'TWO_DISTINCT_NON_AUDIT_EMAILS_REQUIRED'; END IF;
END;
$guard$;
WITH requested(slot,email) AS (VALUES
 ('PRIMARY',lower(btrim(current_setting('mushavo.operator_primary_email')))),
 ('RECOVERY',lower(btrim(current_setting('mushavo.operator_recovery_email'))))
), selected_factors AS (
 SELECT r.slot,f.id,f.user_id,f.factor_type,f.status,f.friendly_name,
        f.created_at,f.updated_at
 FROM requested r
 JOIN auth.users u ON lower(u.email)=r.email
 JOIN auth.mfa_factors f ON f.user_id=u.id
), factor_details AS (
 SELECT slot,factor_type::text AS factor_type,status::text AS status,
        created_at AS created_UTC,updated_at AS updated_UTC,
        friendly_name=('Mushavo staging '||slot) AS matches_expected_setup_label,
        created_at BETWEEN '2026-10-15T05:49:34Z'::timestamptz
                       AND '2026-10-15T06:00:41Z'::timestamptz
          AS created_in_failed_run_window,
        encode(sha256(convert_to(jsonb_build_object(
          'id',id,'user_id',user_id,'factor_type',factor_type,
          'status',status,'friendly_name',friendly_name,
          'created_at',created_at,'updated_at',updated_at
        )::text,'UTF8')),'hex') AS metadata_sha256
 FROM selected_factors
), accounts AS (
 SELECT r.slot,
  (SELECT count(*) FROM auth.users u WHERE lower(u.email)=r.email) AS auth_users,
  (SELECT count(*) FROM public.profiles p JOIN auth.users u ON u.id=p.id
    WHERE lower(u.email)=r.email AND p.account_status='active') AS active_profiles,
  (SELECT count(*) FROM public.app_admins a JOIN auth.users u ON u.id=a.user_id
    WHERE lower(u.email)=r.email) AS platform_roles,
  (SELECT count(*) FROM selected_factors f WHERE f.slot=r.slot) AS factor_count,
  (SELECT count(*) FROM selected_factors f WHERE f.slot=r.slot
    AND f.factor_type='totp' AND f.status='verified') AS verified_TOTP,
  (SELECT count(*) FROM selected_factors f WHERE f.slot=r.slot
    AND f.factor_type='totp' AND f.status='unverified') AS unverified_TOTP,
  (SELECT count(*)>5 FROM selected_factors f WHERE f.slot=r.slot) AS details_truncated,
  COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY created_UTC,metadata_sha256)
    FROM (SELECT * FROM factor_details f WHERE f.slot=r.slot
          ORDER BY created_UTC,metadata_sha256 LIMIT 5) x),'[]'::jsonb) AS factors
 FROM requested r
)
SELECT jsonb_build_object(
 'stage_step','FR.2.4_OPERATOR_FACTOR_REVIEW',
 'scope','READ_ONLY_FACTOR_STATUS_AFTER_INCOMPLETE_ENROLLMENT',
 'target_project','dczlddwbtgvfdujgcitb',
 'checked_UTC',clock_timestamp(),
 'transaction_read_only',current_setting('transaction_read_only'),
 'accounts',(SELECT jsonb_agg(to_jsonb(a) ORDER BY slot) FROM accounts a),
 'factor_secrets_or_secret_hashes_read_or_printed',false,
 'actor_factor_identifiers_or_emails_printed',false,
 'accounts_roles_factors_or_settings_changed',false,
 'application_routines_invoked',0,
 'time_or_label_correlation_proves_provenance_or_authorizes_cleanup',false,
 'project_selection_independently_verified',false,
 'hosted_MFA_or_Admin_acceptance',false,
 'findings_closed','[]'::jsonb
) AS factor_setup_review;
ROLLBACK;
