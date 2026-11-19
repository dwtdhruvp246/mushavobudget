ALTER TABLE mushavo_account_deletion.requests
  ADD COLUMN storage_before_auth_at timestamptz,
  ADD CONSTRAINT fr33_storage_before_auth_scope CHECK (
    storage_before_auth_at IS NULL OR (
      subject_id IS NOT NULL AND cancelled_at IS NULL AND completed_at IS NULL
      AND erasure_committed_at IS NULL AND workspace_impact_confirmed_at IS NOT NULL
      AND storage_before_auth_at >= workspace_impact_confirmed_at
    )
  );

CREATE FUNCTION mushavo_file_ingest.is_fr33_owned_logo_path(p_bucket text,p_path text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'pg_catalog'
AS $$
  SELECT coalesce(p_bucket = 'business-logos' AND p_path ~ (
    '^([a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}/){2}'
    || '[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}[.](png|jpg|webp)$'
  ), false);
$$;

ALTER TABLE mushavo_file_ingest.ordinary_uploads
  ADD COLUMN erasure_owner_id uuid,
  DROP CONSTRAINT ordinary_uploads_check,
  ADD CONSTRAINT ordinary_uploads_check CHECK (
    (erasure_object_id IS NULL AND erasure_object_version IS NULL AND erasure_owner_id IS NULL
      AND public.fr32_is_managed_ordinary_upload(bucket_id,path))
    OR (erasure_object_id IS NOT NULL AND actor_id IS NULL AND state IN ('ready','claimed','removed') AND (
      (erasure_owner_id IS NULL AND parent_type IS NOT DISTINCT FROM 'business_bill_payment'
        AND mushavo_file_ingest.is_fr33_legacy_bill_proof_path(bucket_id,path))
      OR (erasure_owner_id IS NOT NULL AND parent_type IS NOT DISTINCT FROM 'business_logo'
        AND mushavo_file_ingest.is_fr33_owned_logo_path(bucket_id,path)
        AND erasure_object_version IS NOT NULL AND split_part(path,'/',2) = erasure_owner_id::text)
    ))
  );

ALTER TABLE mushavo_account_deletion.file_cleanup_targets
  DROP CONSTRAINT file_cleanup_targets_check,
  ADD CONSTRAINT file_cleanup_targets_check CHECK (
    public.fr32_is_managed_ordinary_upload(bucket_id,path)
    OR mushavo_file_ingest.is_fr33_legacy_bill_proof_path(bucket_id,path)
    OR mushavo_file_ingest.is_fr33_owned_logo_path(bucket_id,path)
  );

CREATE FUNCTION mushavo_account_deletion.prepare_user_owned_logo_cleanup(
  p_request_id uuid,p_subject uuid,p_workspace_ids uuid[]
) RETURNS void LANGUAGE plpgsql
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
BEGIN
  WITH verified AS MATERIALIZED (
    SELECT object.id AS object_id,object.name,object.version,profile.workspace_id,
      object.metadata->>'mimetype' AS mime,
      coalesce(object.metadata->>'size',object.metadata->>'contentLength') AS bytes
    FROM public.business_profiles profile
    JOIN public.budget_workspaces workspace ON workspace.id = profile.workspace_id
    JOIN storage.objects object ON object.bucket_id = 'business-logos' AND object.name = profile.logo_storage_path
    JOIN storage.buckets bucket ON bucket.id = object.bucket_id
    WHERE profile.workspace_id = ANY(p_workspace_ids) AND workspace.workspace_type = 'business'
      AND workspace.owner_id = p_subject AND NOT bucket.public AND bucket.versioning_status = 'DISABLED'
      AND mushavo_file_ingest.is_fr33_owned_logo_path(object.bucket_id,object.name)
      AND split_part(object.name,'/',1) = workspace.id::text AND split_part(object.name,'/',2) = p_subject::text
      AND (object.owner_id = p_subject::text OR object.owner = p_subject)
      AND (object.owner_id IS NULL OR object.owner_id = p_subject::text)
      AND (object.owner IS NULL OR object.owner = p_subject) AND object.version IS NOT NULL
      AND object.metadata->>'mimetype' = CASE split_part(object.name,'.',2)
        WHEN 'png' THEN 'image/png' WHEN 'jpg' THEN 'image/jpeg' WHEN 'webp' THEN 'image/webp' END
      AND CASE WHEN coalesce(object.metadata->>'size',object.metadata->>'contentLength') ~ '^[0-9]{1,8}$'
        THEN coalesce(object.metadata->>'size',object.metadata->>'contentLength')::integer BETWEEN 1 AND 2097152
        ELSE false END
      AND NOT EXISTS (SELECT 1 FROM public.business_profiles other WHERE other.logo_storage_path = object.name
        AND other.workspace_id <> profile.workspace_id)
      AND NOT EXISTS (SELECT 1 FROM mushavo_file_ingest.logo_replacements replacement WHERE replacement.object_name = object.name)
      AND NOT EXISTS (SELECT 1 FROM mushavo_file_ingest.ordinary_uploads upload
        WHERE upload.bucket_id = object.bucket_id AND upload.path = object.name)
    FOR SHARE OF profile,object,bucket
  ), queued AS (
    INSERT INTO mushavo_file_ingest.ordinary_uploads (
      bucket_id,path,workspace_id,attachment_id,parent_type,parent_id,mime_type,byte_count,state,expires_at,
      erasure_object_id,erasure_object_version,erasure_owner_id
    )
    SELECT 'business-logos',name,workspace_id,split_part(split_part(name,'/',3),'.',1)::uuid,
      'business_logo',workspace_id,mime,bytes::integer,'ready',clock_timestamp(),object_id,version,p_subject
    FROM verified
    RETURNING bucket_id,path
  )
  INSERT INTO mushavo_account_deletion.file_cleanup_targets(bucket_id,path,request_id)
  SELECT bucket_id,path,p_request_id FROM queued;
END;
$$;
REVOKE ALL ON FUNCTION mushavo_account_deletion.prepare_user_owned_logo_cleanup(uuid,uuid,uuid[])
  FROM PUBLIC, anon, authenticated, service_role;

DO $migration$
DECLARE
  executor text := pg_get_functiondef('mushavo_account_deletion.execute_confirmed_request(uuid)'::regprocedure);
  claim text := pg_get_functiondef('public.fr32_claim_ordinary_cleanup(uuid,bigint,integer)'::regprocedure);
  finish text := pg_get_functiondef('public.fr32_finish_ordinary_cleanup(text,text,uuid)'::regprocedure);
  cancel text := pg_get_functiondef('public.fr33_cancel_account_deletion()'::regprocedure);
  processor text := pg_get_functiondef('mushavo_account_deletion.process_confirmed_requests()'::regprocedure);
  anchor text;
  before_auth text := $next$
  IF request.storage_before_auth_at IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM mushavo_account_deletion.file_cleanup_targets WHERE request_id = p_request_id) THEN
      RETURN jsonb_build_object('status','storage_before_auth');
    END IF;
    IF EXISTS (SELECT 1 FROM storage.objects object WHERE object.owner_id = subject::text OR object.owner = subject)
      OR EXISTS (SELECT 1 FROM public.budget_workspaces WHERE owner_id = subject)
      OR EXISTS (SELECT 1 FROM public.families WHERE owner_id = subject)
    THEN RAISE EXCEPTION 'FR33_PRE_AUTH_SCOPE_CHANGED'; END IF;
  ELSE
$next$;
  freeze_auth text := $next$
  IF EXISTS (
    SELECT 1 FROM mushavo_account_deletion.file_cleanup_targets target
    JOIN mushavo_file_ingest.ordinary_uploads upload ON (upload.bucket_id,upload.path) = (target.bucket_id,target.path)
    WHERE target.request_id = p_request_id AND upload.erasure_owner_id = subject
  ) THEN
    UPDATE auth.users SET banned_until = greatest(banned_until,clock_timestamp()+interval '100 years') WHERE id = subject;
    DELETE FROM auth.sessions WHERE user_id = subject;
    DELETE FROM auth.refresh_tokens WHERE user_id = subject::text;
    UPDATE mushavo_account_deletion.requests SET storage_before_auth_at = clock_timestamp()
    WHERE id = p_request_id AND subject_id = subject;
    RETURN jsonb_build_object('status','storage_before_auth');
  END IF;

  UPDATE mushavo_account_deletion.requests SET storage_before_auth_at = NULL WHERE id = p_request_id;
$next$;
BEGIN
  anchor := '  PERFORM id FROM public.families WHERE owner_id = subject ORDER BY id FOR UPDATE;';
  IF cardinality(string_to_array(executor,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_LOGO_EXECUTOR_SCOPE_MOVED'; END IF;
  executor := replace(executor,anchor,before_auth || anchor);
  anchor := '  PERFORM mushavo_account_deletion.prepare_owned_logo_cleanup(p_request_id, workspace_ids);';
  IF cardinality(string_to_array(executor,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_LOGO_PREPARE_MOVED'; END IF;
  executor := replace(executor,anchor,anchor ||
    E'\n  PERFORM mushavo_account_deletion.prepare_user_owned_logo_cleanup(p_request_id, subject, workspace_ids);');
  anchor := '      WHERE object.owner_id = subject::text OR object.owner = subject';
  IF cardinality(string_to_array(executor,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_LOGO_STORAGE_GUARD_MOVED'; END IF;
  executor := replace(executor,anchor,$next$      WHERE ((object.owner_id = subject::text OR object.owner = subject) AND NOT EXISTS (
        SELECT 1 FROM mushavo_account_deletion.file_cleanup_targets target
        JOIN mushavo_file_ingest.ordinary_uploads upload ON (upload.bucket_id,upload.path) = (target.bucket_id,target.path)
        WHERE target.request_id = p_request_id AND upload.bucket_id = object.bucket_id AND upload.path = object.name
          AND upload.erasure_owner_id = subject AND upload.erasure_object_id = object.id
          AND upload.erasure_object_version = object.version))$next$);
  anchor := '  dependencies := mushavo_account_deletion.review_dependencies(p_request_id);';
  IF cardinality(string_to_array(executor,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_LOGO_DEPENDENCY_GUARD_MOVED'; END IF;
  executor := replace(executor,anchor,E'  END IF;\n\n' || anchor);
  anchor := '  UPDATE mushavo_account_deletion.requests' || E'\n    SET workspace_impact_token = NULL, workspace_impact_confirmed_at = NULL';
  IF cardinality(string_to_array(executor,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_LOGO_AUTH_BOUNDARY_MOVED'; END IF;
  executor := replace(executor,anchor,freeze_auth || anchor);

  anchor := '          and request.erasure_committed_at is not null and request.completed_at is null)';
  IF cardinality(string_to_array(claim,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_LOGO_CLAIM_SCOPE_MOVED'; END IF;
  claim := replace(claim,anchor,$next$          and request.completed_at is null
          and (request.erasure_committed_at is not null OR request.storage_before_auth_at is not null))$next$);
  anchor := '          or object.owner_id is not null or object.owner is not null))';
  IF cardinality(string_to_array(claim,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_LOGO_CLAIM_OWNER_MOVED'; END IF;
  claim := replace(claim,anchor,$next$          or (object.owner_id is not null and object.owner_id is distinct from u.erasure_owner_id::text)
          or (object.owner is not null and object.owner is distinct from u.erasure_owner_id)))$next$);

  anchor := '  WHERE id = target_request AND erasure_committed_at IS NOT NULL AND completed_at IS NULL FOR UPDATE;';
  IF cardinality(string_to_array(finish,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_LOGO_FINISH_SCOPE_MOVED'; END IF;
  finish := replace(finish,anchor,$next$  WHERE id = target_request AND completed_at IS NULL
    AND (erasure_committed_at IS NOT NULL OR storage_before_auth_at IS NOT NULL) FOR UPDATE;$next$);
  anchor := '  WHERE id = target_request;';
  IF cardinality(string_to_array(finish,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_LOGO_FINISH_RECEIPT_MOVED'; END IF;
  finish := replace(finish,anchor,'  WHERE id = target_request AND erasure_committed_at IS NOT NULL;');

  anchor := '  UPDATE mushavo_account_deletion.requests';
  IF cardinality(string_to_array(cancel,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_LOGO_CANCEL_SCOPE_MOVED'; END IF;
  cancel := replace(cancel,anchor,$next$  IF EXISTS (SELECT 1 FROM mushavo_account_deletion.requests
    WHERE subject_id = subject AND storage_before_auth_at IS NOT NULL)
  THEN RAISE EXCEPTION 'FR33_ERASURE_ALREADY_STARTED'; END IF;
$next$ || anchor);
  anchor := '        WHEN ''files_pending'' THEN files_pending := files_pending+1;';
  IF cardinality(string_to_array(processor,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_LOGO_PROCESSOR_CASE_MOVED'; END IF;
  processor := replace(processor,anchor,anchor || $next$
        WHEN 'storage_before_auth' THEN
          retry_at := attempt_time+interval '1 minute';
          deferred := deferred+1;$next$);
  anchor := '    attempt_time := clock_timestamp();';
  IF cardinality(string_to_array(processor,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_LOGO_PROCESSOR_ATTEMPT_MOVED'; END IF;
  processor := replace(processor,anchor,anchor || E'\n    outcome := NULL;');
  anchor := 'VALUES (candidate.id,candidate.confirmed_at,attempt_time,candidate.attempt_count,retry_at,review_code)';
  IF cardinality(string_to_array(processor,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_LOGO_PROCESSOR_RETRY_MOVED'; END IF;
  processor := replace(processor,anchor,$next$VALUES (candidate.id,candidate.confirmed_at,attempt_time,
      CASE WHEN outcome = 'storage_before_auth' THEN 1 ELSE candidate.attempt_count END,retry_at,review_code)$next$);
  EXECUTE executor;
  EXECUTE claim;
  EXECUTE finish;
  EXECUTE cancel;
  EXECUTE processor;
END;
$migration$;
