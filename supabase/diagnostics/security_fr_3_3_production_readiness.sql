-- Operator read-only gate for the FR.3.3 production rollout.
-- Run against the intended Supabase project. Every service must be independently verified in that project.
BEGIN READ ONLY;
WITH proof_inventory AS (
  SELECT bucket_id, count(*) AS object_count,
    count(*) FILTER (WHERE owner_id IS NOT NULL OR owner IS NOT NULL) AS owner_bound_count
  FROM storage.objects
  WHERE bucket_id IN ('subscription-proofs','payment-proofs','business-documents','business-logos')
  GROUP BY bucket_id
)
SELECT
  to_regprocedure('mushavo_email_auth.require_application_session()') IS NOT NULL AS session_guard_present,
  to_regprocedure('public.app_session_status()') IS NOT NULL AS session_status_present,
  to_regprocedure('public.private_file_download_context(text,text)') IS NOT NULL AS private_download_context_present,
  to_regclass('mushavo_file_ingest.ordinary_uploads') IS NOT NULL AS ordinary_upload_tracking_present,
  to_regclass('mushavo_file_ingest.subscription_uploads') IS NOT NULL AS subscription_upload_tracking_present,
  to_regprocedure('mushavo_account_deletion.execute_confirmed_request(uuid)') IS NOT NULL AS erasure_executor_present,
  to_regprocedure('mushavo_account_deletion.process_confirmed_requests()') IS NOT NULL AS scheduler_processor_present,
  to_regprocedure('public.fr33_claim_shared_proof_handoff()') IS NOT NULL AS proof_handoff_claim_present,
  to_regprocedure('mushavo_account_deletion.process_retention_batch(integer)') IS NOT NULL AS retention_processor_present,
  to_regprocedure('public.fr33_list_assigned_support_archive(uuid)') IS NOT NULL AS assigned_support_archive_list_present,
  to_regprocedure('public.fr33_assigned_support_archive(uuid,integer)') IS NOT NULL AS assigned_support_archive_present,
  to_regprocedure('mushavo_account_deletion.preview_archived_invoice_retention(uuid,date,date,date,date)') IS NOT NULL AS billing_retention_preview_present,
  to_regprocedure('mushavo_account_deletion.preview_zw_invoice_retention(uuid,date,date,date,date,text,date,date)') IS NOT NULL AS zw_billing_retention_preview_present,
  to_regprocedure('mushavo_account_deletion.prepare_billing_archive_expiry(uuid,date,jsonb)') IS NOT NULL AS billing_expiry_preparation_present,
  to_regprocedure('public.fr33_billing_archive_expiry_step(uuid,uuid)') IS NOT NULL AS billing_expiry_worker_present,
  (
    SELECT count(*) FROM storage.buckets
    WHERE id IN ('subscription-proofs','payment-proofs','business-documents','business-logos')
      AND public IS FALSE
  ) AS expected_private_buckets_present,
  (SELECT jsonb_object_agg(bucket_id,jsonb_build_object('objects',object_count,'owner_bound',owner_bound_count)) FROM proof_inventory) AS proof_inventory;
ROLLBACK;
