-- Managed proofs and documents from confirmed workspace closures use the
-- existing leased Storage cleanup worker. Completion requires its readback.
ALTER TABLE mushavo_account_deletion.requests
  ADD COLUMN erasure_committed_at timestamptz,
  ADD CONSTRAINT requests_erasure_receipt_scope CHECK (
    erasure_committed_at IS NULL OR (
      subject_id IS NULL AND cancelled_at IS NULL AND workspace_impact_token IS NULL
      AND workspace_impact_confirmed_at IS NULL AND erasure_committed_at >= created_at
      AND (completed_at IS NULL OR completed_at >= erasure_committed_at)
    )
  );

CREATE TABLE mushavo_account_deletion.file_cleanup_targets (
  bucket_id text NOT NULL CHECK (bucket_id IN ('payment-proofs','business-documents')),
  path text NOT NULL CHECK (public.fr32_is_managed_ordinary_upload(bucket_id,path)),
  request_id uuid NOT NULL REFERENCES mushavo_account_deletion.requests(id) ON DELETE RESTRICT,
  PRIMARY KEY (bucket_id,path)
);
CREATE INDEX file_cleanup_targets_request_idx
  ON mushavo_account_deletion.file_cleanup_targets(request_id);
ALTER TABLE mushavo_account_deletion.file_cleanup_targets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.file_cleanup_targets FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION mushavo_account_deletion.prepare_owned_file_cleanup(
  p_request_id uuid, p_subject uuid, p_workspace_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
DECLARE
  upload mushavo_file_ingest.ordinary_uploads%ROWTYPE;
BEGIN
  FOR upload IN
    SELECT candidate.* FROM mushavo_file_ingest.ordinary_uploads candidate
    WHERE candidate.workspace_id = ANY(p_workspace_ids)
      AND candidate.bucket_id IN ('payment-proofs','business-documents')
      AND candidate.state = 'linked' AND candidate.token IS NULL AND candidate.lease_until IS NULL
    ORDER BY candidate.bucket_id,candidate.path FOR UPDATE
  LOOP
    IF upload.bucket_id = 'payment-proofs' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.payment_records payment
        JOIN public.budget_workspaces workspace ON workspace.id = payment.workspace_id
        WHERE payment.proof_path = upload.path AND workspace.id = upload.workspace_id
          AND workspace.owner_id = p_subject AND payment.recorded_by IS NOT DISTINCT FROM upload.actor_id
          AND payment.proof_mime_type = upload.mime_type AND payment.proof_size_bytes = upload.byte_count
          AND (
            (workspace.workspace_type = 'personal' AND workspace.legacy_family_id IS NULL
              AND payment.visibility = 'personal' AND payment.family_id IS NULL
              AND payment.owner_id = p_subject AND split_part(upload.path,'/',1) = 'personal'
              AND split_part(upload.path,'/',2) = p_subject::text)
            OR (workspace.workspace_type IN ('family','household') AND payment.visibility = 'family'
              AND payment.family_id = workspace.legacy_family_id AND split_part(upload.path,'/',1) = 'families'
              AND split_part(upload.path,'/',2) = workspace.legacy_family_id::text)
          )
          AND NOT EXISTS (SELECT 1 FROM public.payment_records duplicate
            WHERE duplicate.proof_path = upload.path AND duplicate.id <> payment.id)
        FOR SHARE OF payment
      ) THEN CONTINUE; END IF;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.business_documents document
        JOIN public.budget_workspaces workspace ON workspace.id = document.workspace_id
        WHERE document.id = upload.attachment_id AND document.storage_path = upload.path
          AND workspace.id = upload.workspace_id AND workspace.workspace_type = 'business'
          AND workspace.owner_id = p_subject AND public.business_storage_workspace_id(upload.path) = workspace.id
          AND document.uploaded_by IS NOT DISTINCT FROM upload.actor_id
          AND document.parent_id = upload.parent_id AND document.parent_type = upload.parent_type
          AND document.mime_type = upload.mime_type AND document.size_bytes = upload.byte_count
          AND NOT EXISTS (SELECT 1 FROM public.business_documents duplicate
            WHERE duplicate.storage_path = upload.path AND duplicate.id <> document.id)
        FOR SHARE OF document
      ) THEN CONTINUE; END IF;
    END IF;

    PERFORM 1 FROM storage.objects object
    WHERE object.bucket_id = upload.bucket_id AND object.name = upload.path
      AND object.owner_id IS NULL AND object.owner IS NULL
      AND object.metadata->>'mimetype' = upload.mime_type
      AND COALESCE(object.metadata->>'size',object.metadata->>'contentLength') = upload.byte_count::text
    FOR SHARE;
    IF NOT FOUND THEN CONTINUE; END IF;

    INSERT INTO mushavo_account_deletion.file_cleanup_targets (bucket_id,path,request_id)
    VALUES (upload.bucket_id,upload.path,p_request_id);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION mushavo_account_deletion.prepare_owned_file_cleanup(uuid,uuid,uuid[])
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fr32_finish_ordinary_cleanup(p_bucket text,p_path text,p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $$
DECLARE
  target_request uuid;
BEGIN
  UPDATE mushavo_file_ingest.ordinary_uploads upload
  SET state = 'removed', token = NULL, lease_until = NULL
  WHERE upload.bucket_id = p_bucket AND upload.path = p_path
    AND upload.state = 'claimed' AND upload.token = p_token
    AND NOT mushavo_file_ingest.ordinary_upload_has_reference(p_bucket,p_path)
    AND NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = p_bucket AND name = p_path);
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT request_id INTO target_request FROM mushavo_account_deletion.file_cleanup_targets
  WHERE bucket_id = p_bucket AND path = p_path;
  IF NOT FOUND THEN RETURN true; END IF;

  -- Serialize acknowledgements of paths belonging to the same request.
  PERFORM 1 FROM mushavo_account_deletion.requests
  WHERE id = target_request AND erasure_committed_at IS NOT NULL AND completed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FR33_FILE_CLEANUP_RECEIPT_REQUIRED'; END IF;
  DELETE FROM mushavo_account_deletion.file_cleanup_targets
  WHERE bucket_id = p_bucket AND path = p_path AND request_id = target_request;
  DELETE FROM mushavo_file_ingest.ordinary_uploads WHERE bucket_id = p_bucket AND path = p_path;
  UPDATE mushavo_account_deletion.requests
  SET completed_at = CASE WHEN NOT EXISTS (
    SELECT 1 FROM mushavo_account_deletion.file_cleanup_targets WHERE request_id = target_request
  ) THEN greatest(clock_timestamp(),erasure_committed_at) END
  WHERE id = target_request;
  RETURN true;
END;
$$;

DO $migration$
DECLARE
  body text := pg_get_functiondef('mushavo_account_deletion.execute_confirmed_request(uuid)'::regprocedure);
  old_storage_gate text := $old$
  IF EXISTS (SELECT 1 FROM public.payment_records WHERE proof_path IS NOT NULL
      AND (workspace_id = ANY(workspace_ids) OR family_id = ANY(family_ids)))
    OR EXISTS (SELECT 1 FROM public.business_documents WHERE workspace_id = ANY(workspace_ids))
    OR EXISTS (SELECT 1 FROM storage.objects object
      WHERE object.owner_id = subject::text OR object.owner = subject
        OR (object.bucket_id = 'payment-proofs' AND (
          (split_part(object.name,'/',1) = 'personal' AND split_part(object.name,'/',2) = subject::text)
          OR (split_part(object.name,'/',1) = 'families' AND split_part(object.name,'/',2) = ANY(family_ids::text[]))
        )) OR (object.bucket_id IN ('business-documents','business-logos','subscription-proofs')
          AND split_part(object.name,'/',1) = 'workspaces' AND split_part(object.name,'/',2) = ANY(workspace_ids::text[])))
    OR EXISTS (SELECT 1 FROM mushavo_file_ingest.ordinary_uploads WHERE workspace_id = ANY(workspace_ids) OR actor_id = subject)
$old$;
  new_storage_gate text := $new$
  PERFORM mushavo_account_deletion.prepare_owned_file_cleanup(p_request_id, subject, workspace_ids);
  IF EXISTS (SELECT 1 FROM public.payment_records payment WHERE payment.proof_path IS NOT NULL
      AND (payment.workspace_id = ANY(workspace_ids) OR payment.family_id = ANY(family_ids))
      AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.file_cleanup_targets target
        WHERE target.request_id = p_request_id AND target.bucket_id = 'payment-proofs' AND target.path = payment.proof_path))
    OR EXISTS (SELECT 1 FROM public.business_documents document WHERE document.workspace_id = ANY(workspace_ids)
      AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.file_cleanup_targets target
        WHERE target.request_id = p_request_id AND target.bucket_id = 'business-documents' AND target.path = document.storage_path))
    OR EXISTS (SELECT 1 FROM storage.objects object
      WHERE object.owner_id = subject::text OR object.owner = subject
        OR (((object.bucket_id = 'payment-proofs' AND (
          (split_part(object.name,'/',1) = 'personal' AND split_part(object.name,'/',2) = subject::text)
          OR (split_part(object.name,'/',1) = 'families' AND split_part(object.name,'/',2) = ANY(family_ids::text[]))
        )) OR (object.bucket_id IN ('business-documents','business-logos','subscription-proofs')
          AND split_part(object.name,'/',1) = 'workspaces' AND split_part(object.name,'/',2) = ANY(workspace_ids::text[])))
          AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.file_cleanup_targets target
            WHERE target.request_id = p_request_id AND target.bucket_id = object.bucket_id AND target.path = object.name)))
    OR EXISTS (SELECT 1 FROM mushavo_file_ingest.ordinary_uploads upload
      WHERE (upload.workspace_id = ANY(workspace_ids) OR upload.actor_id = subject)
        AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.file_cleanup_targets target
          WHERE target.request_id = p_request_id AND target.bucket_id = upload.bucket_id AND target.path = upload.path))
$new$;
  completed_return text := $old$    RETURN jsonb_build_object('status','completed','completed_at',request.completed_at);
  END IF;$old$;
  pending_return text := $new$
  IF request.erasure_committed_at IS NOT NULL THEN
    RETURN jsonb_build_object('status','files_pending');
  END IF;$new$;
  review_start text := $old$  dependencies := mushavo_account_deletion.review_dependencies(p_request_id);$old$;
  files_ready text := $new$  IF EXISTS (
    SELECT 1 FROM mushavo_account_deletion.file_cleanup_targets target
    LEFT JOIN mushavo_file_ingest.ordinary_uploads upload
      ON (upload.bucket_id,upload.path) = (target.bucket_id,target.path)
    WHERE target.request_id = p_request_id AND (
      upload.state IS DISTINCT FROM 'ready' OR upload.token IS NOT NULL OR upload.lease_until IS NOT NULL
      OR upload.expires_at > clock_timestamp()
      OR mushavo_file_ingest.ordinary_upload_has_reference(target.bucket_id,target.path)
    )
  ) THEN RAISE EXCEPTION 'FR33_OWNED_FILE_CLEANUP_NOT_READY'; END IF;

  UPDATE mushavo_file_ingest.ordinary_uploads upload SET actor_id = NULL
  FROM mushavo_account_deletion.file_cleanup_targets target
  WHERE target.request_id = p_request_id AND (upload.bucket_id,upload.path) = (target.bucket_id,target.path);

$new$;
  receipt_update text := $old$  UPDATE mushavo_account_deletion.requests
  SET completed_at = clock_timestamp(), workspace_impact_token = NULL, workspace_impact_confirmed_at = NULL$old$;
  pending_receipt text := $new$  IF EXISTS (SELECT 1 FROM mushavo_account_deletion.file_cleanup_targets WHERE request_id = p_request_id) THEN
    UPDATE mushavo_account_deletion.requests
    SET erasure_committed_at = clock_timestamp(), workspace_impact_token = NULL, workspace_impact_confirmed_at = NULL
    WHERE id = p_request_id AND subject_id IS NULL AND completed_at IS NULL AND cancelled_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'FR33_COMPLETION_RECEIPT_REQUIRED'; END IF;
    RETURN jsonb_build_object('status','files_pending');
  END IF;

$new$;
BEGIN
  IF cardinality(string_to_array(body,old_storage_gate)) <> 2
    OR cardinality(string_to_array(body,completed_return)) <> 3
    OR cardinality(string_to_array(body,review_start)) <> 2
    OR cardinality(string_to_array(body,receipt_update)) <> 2
  THEN RAISE EXCEPTION 'FR33_UNEXPECTED_OWNED_FILE_EXECUTOR_BASE'; END IF;
  body := replace(body,old_storage_gate,new_storage_gate);
  body := replace(body,completed_return,completed_return || pending_return);
  body := replace(body,review_start,files_ready || review_start);
  body := replace(body,receipt_update,pending_receipt || receipt_update);
  EXECUTE body;
END;
$migration$;
