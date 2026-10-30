-- Select STAGING dczlddwbtgvfdujgcitb in Supabase SQL Editor first.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
SET LOCAL TIME ZONE 'UTC';

DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = current_user AND (rolsuper OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'SNAPSHOT_REQUIRES_PRIVILEGED_SQL_EDITOR';
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
), mismatch_details AS (
  SELECT r.id, jsonb_build_object(
    'record_fingerprint_sha256', encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex'),
    'parent_fingerprint_sha256', encode(sha256(convert_to(to_jsonb(i)::text,'UTF8')),'hex'),
    'record_created_UTC', r.created_at,
    'parent_created_UTC', i.created_at,
    'prior_audit_name_shape', i.name ~ '^AUDIT-S321-[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}-[01]$',
    'prior_audit_item_notes', i.notes IN ('Synthetic Stage 3 Personal isolation test','Synthetic permitted update'),
    'prior_audit_record_notes', r.notes IN ('Synthetic paid record','Synthetic permitted paid update'),
    'item_owner_creator_record_owner_recorder_agree', i.owner_id=r.owner_id AND i.created_by=r.owner_id AND r.recorded_by=r.owner_id,
    'owner_is_retained_actor', r.owner_id IN (SELECT id FROM actors),
    'parent_workspace_active_owned_personal', pw.owner_id=r.owner_id AND pw.workspace_type='personal' AND pw.status='active',
    'record_workspace_owned_by_record_owner', rw.owner_id=r.owner_id,
    'record_workspace_type', CASE WHEN rw.workspace_type IN ('personal','household','business') THEN rw.workspace_type ELSE 'OTHER_OR_MISSING' END,
    'personal_inactive_USD1_shape', i.family_id IS NULL AND r.family_id IS NULL AND i.visibility='personal' AND r.visibility='personal' AND i.status='inactive' AND i.amount=1 AND r.amount=1 AND i.currency='USD' AND r.currency='USD',
    'linked_payment_record_conversions', (SELECT count(*) FROM public.payment_conversions c WHERE c.entity_type='payment_record' AND c.entity_id=r.id),
    'linked_conversion_workspace_matches_parent', (SELECT count(*) FROM public.payment_conversions c WHERE c.entity_type='payment_record' AND c.entity_id=r.id AND c.workspace_id=i.workspace_id),
    'linked_conversion_workspace_mismatches_record', (SELECT count(*) FROM public.payment_conversions c WHERE c.entity_type='payment_record' AND c.entity_id=r.id AND c.workspace_id IS DISTINCT FROM r.workspace_id)
  ) AS detail
  FROM public.payment_records r
  JOIN public.payment_items i ON i.id=r.payment_item_id
  LEFT JOIN public.budget_workspaces pw ON pw.id=i.workspace_id
  LEFT JOIN public.budget_workspaces rw ON rw.id=r.workspace_id
  WHERE r.workspace_id IS DISTINCT FROM i.workspace_id
), orphan_details AS (
  SELECT c.id, jsonb_build_object(
    'conversion_fingerprint_sha256', encode(sha256(convert_to(to_jsonb(c)::text,'UTF8')),'hex'),
    'created_UTC',c.created_at,
    'rate_effective_UTC',c.rate_effective_at,
    'workspace_active_personal',w.workspace_type='personal' AND w.status='active',
    'workspace_owner_is_retained_actor',w.owner_id IN (SELECT id FROM actors),
    'locked_USD1_identity_shape',c.rate_provider='identity' AND c.rate_source='identity' AND c.original_amount=1 AND c.converted_amount=1 AND c.original_currency='USD' AND c.reporting_currency='USD' AND c.exchange_rate=1 AND c.is_locked,
    'entered_by_is_null',c.entered_by IS NULL,
    'created_in_owner_personal_recheck_window',c.created_at >= '2026-10-14T04:30:00Z'::timestamptz AND c.created_at < '2026-10-14T04:37:00Z'::timestamptz
  ) AS detail
  FROM public.payment_conversions c
  LEFT JOIN public.payment_records r ON r.id=c.entity_id
  LEFT JOIN public.budget_workspaces w ON w.id=c.workspace_id
  WHERE c.entity_type='payment_record' AND r.id IS NULL
)
SELECT jsonb_build_object(
  'stage_step', 'FR.2.2_HISTORICAL_REVIEW',
  'scope', 'READ_ONLY_POST_CLEANUP_COUNTS_FINGERPRINTS_AND_BOUNDED_HISTORICAL_LINKAGE',
  'target_project', 'dczlddwbtgvfdujgcitb',
  'project_selection_independently_verified', false,
  'checked_UTC', clock_timestamp(),
  'transaction_read_only', current_setting('transaction_read_only'),
  'synthetic_actor_rows_matched', (SELECT count(*) FROM actors),
  'record_consistency', (SELECT to_jsonb(x) FROM record_counts x),
  'conversion_consistency', (SELECT to_jsonb(x) FROM conversion_counts x),
  'retained_family_manual_USD1_rows_matching_full_scope', (SELECT count(*) FROM retained_manual),
  'retained_family_fixture_names_matched', (SELECT count(DISTINCT fixture_family_name) FROM retained_manual),
  'retained_manual_snapshot_sha256', CASE WHEN (SELECT count(*) FROM retained_manual) > 0 THEN
    encode(sha256(convert_to(
      (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id)::text FROM retained_manual c),
      'UTF8'
    )), 'hex') ELSE NULL END,
  'completed_relink_marker_items_remaining', (SELECT count(*) FROM public.payment_items WHERE name LIKE 'AUDIT-FR22-RELINK-5f93bfbe-5830-457d-b3a4-c1088d4711fd%'),
  'record_parent_mismatch_details', COALESCE((SELECT jsonb_agg(detail ORDER BY id) FROM (SELECT * FROM mismatch_details ORDER BY id LIMIT 20) x),'[]'::jsonb),
  'record_parent_mismatch_details_truncated', (SELECT count(*)>20 FROM mismatch_details),
  'unlinked_conversion_details', COALESCE((SELECT jsonb_agg(detail ORDER BY id) FROM (SELECT * FROM orphan_details ORDER BY id LIMIT 20) x),'[]'::jsonb),
  'unlinked_conversion_details_truncated', (SELECT count(*)>20 FROM orphan_details),
  'paired_parent_and_conversion_workspace_mismatch_records', (SELECT count(DISTINCT r.id) FROM public.payment_records r JOIN public.payment_items i ON i.id=r.payment_item_id JOIN public.payment_conversions c ON c.entity_type='payment_record' AND c.entity_id=r.id WHERE r.workspace_id IS DISTINCT FROM i.workspace_id AND c.workspace_id IS DISTINCT FROM r.workspace_id),
  'audit_shape_is_provenance_or_cleanup_authorization', false,
  'creation_window_correlation_proves_deleted_record_provenance', false,
  'historical_rows_repaired_or_conversions_deleted', false,
  'application_routines_invoked', 0,
  'raw_rows_identifiers_or_emails_printed', false,
  'hosted_acceptance', false
) AS historical_review;

ROLLBACK;
