-- STAGING dczlddwbtgvfdujgcitb only. Replace the two email placeholders privately.
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
 THEN RAISE EXCEPTION 'IDENTITY_CHECK_REQUIRES_PRIVILEGED_SQL_EDITOR'; END IF;
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
), status AS (
 SELECT r.slot,
  (SELECT count(*) FROM auth.users u WHERE lower(u.email)=r.email) AS auth_users,
  (SELECT count(*) FROM auth.users u WHERE lower(u.email)=r.email AND u.email_confirmed_at IS NOT NULL) AS email_confirmation_timestamps,
  (SELECT count(*) FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE lower(u.email)=r.email AND p.account_status='active') AS active_profiles,
  (SELECT count(*) FROM public.app_admins a JOIN auth.users u ON u.id=a.user_id WHERE lower(u.email)=r.email) AS platform_roles,
  (SELECT count(*) FROM auth.mfa_factors f JOIN auth.users u ON u.id=f.user_id WHERE lower(u.email)=r.email AND f.factor_type='totp' AND f.status='verified') AS verified_totp_factors,
  (SELECT count(*) FROM public.payment_items p JOIN auth.users u ON u.id=p.owner_id WHERE lower(u.email)=r.email) AS owned_payment_items,
  (SELECT count(*) FROM public.payment_records p JOIN auth.users u ON u.id=p.owner_id WHERE lower(u.email)=r.email) AS owned_payment_records,
  (SELECT count(*) FROM public.budget_workspaces w JOIN auth.users u ON u.id=w.owner_id WHERE lower(u.email)=r.email AND w.workspace_type IN ('household','business')) AS owned_Family_or_Business,
  (SELECT count(*) FROM public.workspace_members m JOIN auth.users u ON u.id=m.user_id JOIN public.budget_workspaces w ON w.id=m.workspace_id WHERE lower(u.email)=r.email AND m.status='active' AND w.workspace_type IN ('household','business')) AS active_Family_or_Business_memberships
 FROM requested r
)
SELECT jsonb_build_object(
 'stage_step','FR.2.4_OPERATOR_IDENTITY_CHECK',
 'scope','READ_ONLY_AUTH_IDENTITY_STATUS_BEFORE_MFA_OR_ADMIN_ROLE_ASSIGNMENT',
 'checked_UTC',clock_timestamp(),'target_project','dczlddwbtgvfdujgcitb',
 'transaction_read_only',current_setting('transaction_read_only'),
 'accounts',(SELECT jsonb_agg(to_jsonb(s) ORDER BY slot) FROM status s),
 'ready_for_private_MFA_preparation',(SELECT bool_and(auth_users=1 AND email_confirmation_timestamps=1 AND active_profiles=1 AND platform_roles=0 AND owned_payment_items=0 AND owned_payment_records=0 AND owned_Family_or_Business=0 AND active_Family_or_Business_memberships=0) FROM status),
 'email_delivery_mailbox_independence_or_account_control_verified',false,
 'genuine_signin_MFA_recovery_or_Admin_acceptance_verified',false,
 'application_routines_invoked',0,'accounts_roles_factors_or_data_changed',false,
 'identifiers_emails_passwords_tokens_or_factor_secrets_printed',false,
 'project_selection_independently_verified',false,
 'hosted_acceptance',false,'findings_closed','[]'::jsonb
) AS operator_identity_check;
ROLLBACK;
