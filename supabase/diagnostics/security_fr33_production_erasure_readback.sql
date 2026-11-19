BEGIN;
SELECT
  mushavo_account_deletion.process_confirmed_requests()->>'status' AS processor_status,
  (SELECT active FROM cron.job WHERE jobname='mushavo-fr33-account-erasure') AS cron_active,
  (SELECT enabled FROM mushavo_account_deletion.retention_control WHERE singleton) AS support_retention_enabled,
  (SELECT enabled FROM mushavo_account_deletion.billing_expiry_control WHERE singleton) AS billing_expiry_enabled,
  (SELECT count(*) FROM mushavo_account_deletion.requests) AS request_count,
  (SELECT count(*) FROM mushavo_account_deletion.file_cleanup_targets) AS file_cleanup_targets,
  (SELECT count(*) FROM mushavo_account_deletion.shared_proof_handoffs) AS shared_proof_handoffs,
  (SELECT count(*) FROM auth.users WHERE email LIKE 'fr33-%@example.invalid') AS rehearsal_accounts_left,
  (SELECT count(*) FROM public.payment_records) AS production_payments,
  (SELECT count(*) FROM storage.objects WHERE bucket_id='business-logos' AND (owner_id IS NOT NULL OR owner IS NOT NULL)) AS production_owned_logos,
  NOT has_function_privilege('authenticated','public.fr33_submit_account_deletion(text)','execute') AS user_submit_closed,
  NOT has_function_privilege('authenticated','public.fr33_list_assigned_support_archive(uuid)','execute') AS support_archive_closed,
  NOT has_function_privilege('service_role','public.fr33_claim_shared_proof_handoff()','execute') AS proof_handoff_closed,
  NOT has_function_privilege('service_role','public.fr33_billing_archive_expiry_step(uuid,uuid)','execute') AS archive_expiry_closed;
ROLLBACK;