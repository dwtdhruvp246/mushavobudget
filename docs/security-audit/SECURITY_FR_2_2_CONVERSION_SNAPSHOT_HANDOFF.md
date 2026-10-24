# FR.2.2 — read-only consistency and retained-manual snapshot

14 October 2026. [33-PASS owner outcome](SECURITY_FR_2_2_PERSONAL_RECHECK_OUTCOME.md). The next SQL reads aggregate consistency and a baseline checksum before more synthetic relinking writes. Select staging dczlddwbtgvfdujgcitb in the privileged Supabase SQL Editor. Run the complete query pasted in chat. No terminal/upload, historical rewrite or conversion deletion is requested.

Expected controls: two synthetic actor rows, two fully scoped retained USD1 manual conversion rows from two distinct known Family fixture names, READ ONLY on. Existing historical mismatch counts may remain; new unlinked conversion counts need review. These expected fixture controls are not an overall PASS or authorization test result. Fixed project text is not independent selection attestation. Snapshot rows are hashed privately, with UTC selected for consistent rendering; raw IDs/emails/data are not printed.

```sql
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
)
SELECT jsonb_build_object(
  'stage_step', 'FR.2.2_CONVERSION_SNAPSHOT',
  'scope', 'READ_ONLY_CONSISTENCY_COUNTS_AND_RETAINED_MANUAL_BASELINE',
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
  'audit_shape_is_provenance_or_cleanup_authorization', false,
  'historical_rows_repaired_or_conversions_deleted', false,
  'application_routines_invoked', 0,
  'raw_rows_identifiers_or_emails_printed', false,
  'hosted_acceptance', false
) AS conversion_snapshot;

ROLLBACK;
```

Send the one JSON result after completion. Diagnostic marker/owner/USD1 shape matches help scope review but do not conclusively identify the latest run or authorize deletion/repair. The manual snapshot hashes full scoped conversion rows plus fixture labels; it establishes a current baseline, not comparison with an unavailable earlier digest. Unexpected counts, duplicates or changed values require review before more fixture changes.

The actual query was executed in a fresh minimal synthetic PGlite 0.5.8 PostgreSQL 18.3 catalog fixture: record/conversion mismatch and orphan classification, two scoped Family manual rows, checksum, modified values and empty scope, read-only status and redacted output were checked. This is one final fixture execution, not full source-migration or hosted PostgreSQL 17 acceptance. An earlier verifier looked up an unquoted alias with uppercase USD1 even though PostgreSQL folds it to lowercase; the local assertion/alias spelling was corrected and the fresh final execution passed. No hosted SQL or dependency installation was performed. [Local receipt](security-fr-2-conversion-snapshot-local-check.json).
