ALTER TABLE mushavo_account_deletion.file_cleanup_targets
  DROP CONSTRAINT file_cleanup_targets_bucket_id_check,
  ADD CONSTRAINT file_cleanup_targets_bucket_id_check
    CHECK (bucket_id IN ('payment-proofs','business-documents','business-logos'));

CREATE FUNCTION mushavo_account_deletion.prepare_owned_logo_cleanup(p_request_id uuid,p_workspace_ids uuid[])
RETURNS void LANGUAGE plpgsql
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
DECLARE
  upload mushavo_file_ingest.ordinary_uploads%ROWTYPE;
BEGIN
  -- Retire replacement history already verified by the logo cleanup worker.
  DELETE FROM mushavo_file_ingest.logo_replacements replacement
  WHERE replacement.workspace_id = ANY(p_workspace_ids) AND replacement.state = 'removed'
    AND NOT mushavo_file_ingest.ordinary_upload_has_reference('business-logos',replacement.object_name)
    AND NOT EXISTS (SELECT 1 FROM storage.objects object
      WHERE object.bucket_id = 'business-logos' AND object.name = replacement.object_name);
  DELETE FROM mushavo_file_ingest.logo_cleanup_settings settings
  WHERE settings.workspace_id = ANY(p_workspace_ids)
    AND NOT EXISTS (SELECT 1 FROM mushavo_file_ingest.logo_replacements replacement
      WHERE replacement.workspace_id = settings.workspace_id);

  FOR upload IN
    SELECT candidate.* FROM mushavo_file_ingest.ordinary_uploads candidate
    WHERE candidate.workspace_id = ANY(p_workspace_ids) AND candidate.bucket_id = 'business-logos'
      AND candidate.state = 'linked' AND candidate.token IS NULL AND candidate.lease_until IS NULL
    ORDER BY candidate.path FOR UPDATE
  LOOP
    CONTINUE WHEN upload.mime_type <> 'image/png'
      OR upload.path IS DISTINCT FROM (upload.workspace_id||'/'||upload.actor_id||'/'||upload.attachment_id||'.png')
      OR EXISTS (SELECT 1 FROM mushavo_file_ingest.logo_replacements replacement WHERE replacement.object_name = upload.path);

    PERFORM 1 FROM public.business_profiles profile
    JOIN public.budget_workspaces workspace ON workspace.id = profile.workspace_id
    WHERE profile.workspace_id = upload.workspace_id AND profile.logo_storage_path = upload.path
      AND workspace.workspace_type = 'business'
      AND NOT EXISTS (SELECT 1 FROM public.business_profiles other
        WHERE other.logo_storage_path = upload.path AND other.workspace_id <> profile.workspace_id)
    FOR SHARE OF profile;
    IF NOT FOUND THEN CONTINUE; END IF;

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
REVOKE ALL ON FUNCTION mushavo_account_deletion.prepare_owned_logo_cleanup(uuid,uuid[])
  FROM PUBLIC, anon, authenticated, service_role;

DO $migration$
DECLARE
  body text := pg_get_functiondef('mushavo_account_deletion.execute_confirmed_request(uuid)'::regprocedure);
  prepare_anchor text := $old$  PERFORM mushavo_account_deletion.prepare_owned_file_cleanup(p_request_id, subject, workspace_ids);$old$;
  storage_anchor text := $old$    OR EXISTS (SELECT 1 FROM storage.objects object$old$;
  logo_gate text := $new$    OR EXISTS (SELECT 1 FROM public.business_profiles profile
      WHERE profile.workspace_id = ANY(workspace_ids) AND profile.logo_storage_path IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.file_cleanup_targets target
          WHERE target.request_id = p_request_id AND target.bucket_id = 'business-logos' AND target.path = profile.logo_storage_path))
    OR EXISTS (SELECT 1 FROM storage.objects logo
      WHERE logo.bucket_id = 'business-logos' AND split_part(logo.name,'/',1) = ANY(workspace_ids::text[])
        AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.file_cleanup_targets target
          WHERE target.request_id = p_request_id AND target.bucket_id = logo.bucket_id AND target.path = logo.name))
$new$;
  retirement_anchor text := $old$  DELETE FROM mushavo_account_deletion.owned_payment_delete_permits WHERE transaction_id = pg_current_xact_id();$old$;
  retirement text := $new$
  -- Logo replacement triggers only handle profile updates. Closure deleted the profile.
  UPDATE mushavo_file_ingest.ordinary_uploads upload SET state = 'ready', expires_at = clock_timestamp()
  FROM mushavo_account_deletion.file_cleanup_targets target
  WHERE target.request_id = p_request_id AND target.bucket_id = 'business-logos'
    AND (upload.bucket_id,upload.path) = (target.bucket_id,target.path) AND upload.state = 'linked'
    AND NOT mushavo_file_ingest.ordinary_upload_has_reference(target.bucket_id,target.path);
$new$;
BEGIN
  IF cardinality(string_to_array(body,prepare_anchor)) <> 2
    OR cardinality(string_to_array(body,storage_anchor)) <> 2
    OR cardinality(string_to_array(body,retirement_anchor)) <> 2
  THEN RAISE EXCEPTION 'FR33_UNEXPECTED_LOGO_EXECUTOR_BASE'; END IF;
  body := replace(body,prepare_anchor,prepare_anchor || E'\n  PERFORM mushavo_account_deletion.prepare_owned_logo_cleanup(p_request_id, workspace_ids);');
  body := replace(body,storage_anchor,logo_gate || storage_anchor);
  body := replace(body,retirement_anchor,retirement_anchor || retirement);
  EXECUTE body;
END;
$migration$;
