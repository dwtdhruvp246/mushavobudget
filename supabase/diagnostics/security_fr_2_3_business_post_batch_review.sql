-- Select STAGING dczlddwbtgvfdujgcitb in Supabase SQL Editor first.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
SET LOCAL TIME ZONE 'UTC';
SET LOCAL search_path = pg_catalog;

DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = current_user AND (rolsuper OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'POST_BATCH_REQUIRES_PRIVILEGED_SQL_EDITOR';
  END IF;
END;
$guard$;

WITH actors AS (
  SELECT id FROM auth.users
  WHERE email IN ('audit.owner@example.com', 'audit.outsider@example.com')
), record_counts AS (
  SELECT count(*) AS records_total,
    count(*) FILTER (WHERE i.id IS NULL) AS records_without_parent,
    count(*) FILTER (WHERE r.workspace_id IS NULL) AS null_record_workspaces,
    count(*) FILTER (WHERE i.id IS NOT NULL AND r.workspace_id IS DISTINCT FROM i.workspace_id)
      AS parent_workspace_mismatches,
    count(*) FILTER (
      WHERE i.id IS NOT NULL AND r.workspace_id IS DISTINCT FROM i.workspace_id
        AND r.owner_id = i.owner_id AND r.owner_id IN (SELECT id FROM actors)
        AND i.visibility = 'personal' AND i.status = 'inactive'
        AND i.name ~ '^AUDIT-S321-[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}-[01]$'
    ) AS mismatches_matching_prior_audit_item_shape
  FROM public.payment_records r
  LEFT JOIN public.payment_items i ON i.id = r.payment_item_id
), conversion_counts AS (
  SELECT count(*) AS payment_record_conversions_total,
    count(*) FILTER (WHERE r.id IS NULL) AS conversions_without_record,
    count(*) FILTER (WHERE r.id IS NOT NULL AND c.workspace_id IS DISTINCT FROM r.workspace_id)
      AS record_workspace_mismatches,
    count(*) FILTER (
      WHERE r.id IS NULL AND w.owner_id IN (SELECT id FROM actors)
        AND w.workspace_type = 'personal'
        AND c.rate_provider = 'identity' AND c.rate_source = 'identity'
        AND c.original_amount = 1 AND c.converted_amount = 1
        AND c.original_currency = 'USD' AND c.reporting_currency = 'USD'
        AND c.exchange_rate = 1 AND c.is_locked
    ) AS unlinked_rows_matching_audit_owner_usd1_identity_shape
  FROM public.payment_conversions c
  LEFT JOIN public.payment_records r ON r.id = c.entity_id
  LEFT JOIN public.budget_workspaces w ON w.id = c.workspace_id
  WHERE c.entity_type = 'payment_record'
), retained_manual AS (
  SELECT c.*, f.name AS fixture_family_name
  FROM public.payment_conversions c
  JOIN public.payment_records r ON r.id = c.entity_id
  JOIN public.payment_items i ON i.id = r.payment_item_id
  JOIN public.families f ON f.id = i.family_id
  JOIN public.budget_workspaces w ON w.legacy_family_id = f.id
  WHERE c.entity_type = 'payment_record'
    AND f.name IN ('AUDIT-S322-FAMILY-PRIMARY', 'AUDIT-S322-FAMILY-SECONDARY')
    AND f.owner_id IN (SELECT id FROM actors)
    AND w.workspace_type = 'household' AND w.status = 'active'
    AND w.owner_id = f.owner_id
    AND i.name = f.name || '-PAYMENT'
    AND i.owner_id = f.owner_id AND i.created_by = f.owner_id
    AND i.workspace_id = w.id AND i.visibility = 'family' AND i.status = 'inactive'
    AND i.amount = 1 AND i.currency = 'USD'
    AND r.owner_id = f.owner_id AND r.recorded_by = f.owner_id
    AND r.family_id = f.id AND r.workspace_id = w.id AND r.visibility = 'family'
    AND r.amount = 1 AND r.currency = 'USD'
    AND c.workspace_id = w.id AND c.entered_by = f.owner_id
    AND c.rate_provider = 'manual' AND c.rate_source = 'manual'
    AND c.original_amount = 1 AND c.converted_amount = 1
    AND c.original_currency = 'USD' AND c.reporting_currency = 'USD'
    AND c.exchange_rate = 1 AND c.is_locked
)
, business_scopes AS (
 SELECT w.*,CASE WHEN w.name='AUDIT-S332-BUSINESS-PRIMARY' THEN 'PRIMARY' ELSE 'SECONDARY' END AS fixture
 FROM public.budget_workspaces w JOIN auth.users u ON u.id=w.owner_id
 WHERE w.workspace_type='business' AND (
  (w.name='AUDIT-S332-BUSINESS-PRIMARY' AND u.email='audit.owner@example.com') OR
  (w.name='AUDIT-S332-BUSINESS-SECONDARY' AND u.email='audit.outsider@example.com'))
), retained_role AS (
 SELECT r.* FROM public.business_roles r JOIN business_scopes w ON w.id=r.workspace_id
 WHERE w.fixture='PRIMARY' AND encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex')=
 '24ccbd63efe40da23303d3a9c9e866fbcfe83452fa2331cb8ea9444f361a900f'
), retained_permissions AS (
 SELECT p.* FROM public.business_role_permissions p JOIN retained_role r
 ON r.workspace_id=p.workspace_id AND r.code=p.role
), retained_audit AS (
 SELECT a.* FROM public.business_audit_events a JOIN retained_role r ON r.workspace_id=a.workspace_id
 WHERE a.before_summary->>'code'=r.code OR a.after_summary->>'code'=r.code
), business_state AS (
 SELECT w.fixture,w.status='active' AS workspace_active,
  (SELECT count(*) FROM public.business_roles r WHERE r.workspace_id=w.id AND r.is_system AND r.status='active') AS builtin_roles,
  (SELECT count(*) FROM public.business_roles r WHERE r.workspace_id=w.id AND NOT r.is_system AND r.status='active') AS active_custom_roles,
  (SELECT count(*) FROM public.business_roles r WHERE r.workspace_id=w.id AND NOT r.is_system AND r.status='archived') AS archived_custom_roles,
  (SELECT count(*) FROM public.workspace_members m WHERE m.workspace_id=w.id AND m.status='active') AS active_members,
  (SELECT count(*) FROM public.workspace_members m WHERE m.workspace_id=w.id AND m.status='inactive') AS inactive_members,
  (SELECT count(*) FROM public.workspace_invitations i WHERE i.workspace_id=w.id AND i.status='pending') AS pending_invitations,
  (SELECT count(*) FROM public.workspace_invitations i WHERE i.workspace_id=w.id AND i.status='cancelled') AS cancelled_invitations,
  (SELECT count(*) FROM public.workspace_invitations i WHERE i.workspace_id=w.id AND i.status='accepted') AS accepted_invitations,
  (SELECT count(*) FROM public.business_member_permissions p WHERE p.workspace_id=w.id) AS member_overrides,
  (SELECT count(*) FROM public.business_expense_claims c WHERE c.workspace_id=w.id AND c.status='approved') AS approved_claims,
  (SELECT count(*) FROM public.business_expense_claims c WHERE c.workspace_id=w.id AND c.status='paid') AS paid_claims,
  (SELECT count(*) FROM public.business_expense_claims c WHERE c.workspace_id=w.id AND c.status='draft') AS draft_claims,
  (SELECT count(*) FROM public.business_budgets b WHERE b.workspace_id=w.id AND b.status='draft') AS draft_budgets,
  EXISTS(SELECT 1 FROM public.workspace_settings s WHERE s.workspace_id=w.id AND NOT s.reminder_enabled
   AND NOT s.conversion_enabled AND s.reporting_currency='USD' AND s.enabled_currencies=ARRAY['USD']) AS reminders_and_FX_disabled_USD
 FROM business_scopes w
), fingerprints AS (
 SELECT
  (SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(p) ORDER BY p.permission_code)::text,'UTF8')),'hex') FROM retained_permissions p) AS permissions_sha256,
  (SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(a) ORDER BY a.id)::text,'UTF8')),'hex') FROM retained_audit a) AS audit_sha256,
  (SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(c)-'payment_record_ref' ORDER BY c.id)::text,'UTF8')),'hex') FROM retained_manual c) AS manual_sha256
)
SELECT jsonb_build_object(
 'stage_step','FR.2.3_BUSINESS_POST_BATCH_REVIEW',
 'scope','READ_ONLY_POST_API_BUSINESS_COUNTS_RETAINED_FINGERPRINTS_AND_CONVERSION_CONSISTENCY',
 'checked_UTC',clock_timestamp(),'target_project','dczlddwbtgvfdujgcitb',
 'transaction_read_only',current_setting('transaction_read_only'),
 'synthetic_actor_rows_matched',(SELECT count(*) FROM actors),
 'matched_business_scopes',(SELECT count(*) FROM business_scopes),
 'all_business_workspaces_total',(SELECT count(*) FROM public.budget_workspaces WHERE workspace_type='business'),
 'business_state',coalesce((SELECT jsonb_agg(to_jsonb(b) ORDER BY fixture) FROM business_state b),'[]'::jsonb),
 'retained_old_role_fingerprint_rows_matched',(SELECT count(*) FROM retained_role),
 'retained_old_permission_rows',(SELECT count(*) FROM retained_permissions),
 'retained_old_permissions_sha256',(SELECT permissions_sha256 FROM fingerprints),
 'retained_old_permissions_fingerprint_matches',coalesce((SELECT permissions_sha256=
  'fb1812e78849d04b443c3f1de4792873730a5e1199826dddd46c438ef61d9f65' FROM fingerprints),false),
 'retained_old_audit_events',(SELECT count(*) FROM retained_audit),
 'retained_old_audit_sha256',(SELECT audit_sha256 FROM fingerprints),
 'retained_old_audit_fingerprint_matches',coalesce((SELECT audit_sha256=
  '74cbb242ff9a95d17858459699e5eeb57672b1bec870b33b251539dcee3ce6a2' FROM fingerprints),false),
 'retained_old_role_active_members',(SELECT count(*) FROM public.workspace_members m JOIN retained_role r ON r.workspace_id=m.workspace_id AND r.code=m.role WHERE m.status='active'),
 'retained_old_role_pending_invitations',(SELECT count(*) FROM public.workspace_invitations i JOIN retained_role r ON r.workspace_id=i.workspace_id AND r.code=i.role WHERE i.status='pending' AND i.expires_at>now()),
 'record_consistency',(SELECT to_jsonb(c) FROM record_counts c),
 'conversion_consistency',(SELECT to_jsonb(c) FROM conversion_counts c),
 'retained_family_manual_USD1_rows_matching_full_scope',(SELECT count(*) FROM retained_manual),
 'retained_manual_snapshot_sha256',(SELECT manual_sha256 FROM fingerprints),
 'retained_manual_original_column_baseline_matches',coalesce((SELECT manual_sha256=
  'd707a69847876b25aea7d1ac453b80175affd454712820aa6944fb0d6986ddd3' FROM fingerprints),false),
 'manual_baseline_excludes_only_derived_payment_record_ref',true,
 'reference_FK_validated',(SELECT convalidated FROM pg_constraint WHERE conrelid='public.payment_conversions'::regclass AND conname='payment_conversions_payment_record_ref_fkey'),
 'application_routines_invoked',0,'rows_accounts_settings_or_catalog_changed',false,
 'raw_rows_identifiers_emails_or_credentials_printed',false,
 'project_selection_independently_verified',false,'cleanup_authorization',false,
 'hosted_acceptance',false,'findings_closed','[]'::jsonb
) AS business_post_batch_review;
ROLLBACK;
