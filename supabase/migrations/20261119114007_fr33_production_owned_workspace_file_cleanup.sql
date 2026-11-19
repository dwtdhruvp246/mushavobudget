SET LOCAL lock_timeout='3s';
-- Staging source 20261117090124 fr33_owned_business_logo_cleanup.
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


-- Staging source 20261117093913 fr33_owned_legacy_bill_proof_cleanup.
CREATE FUNCTION mushavo_file_ingest.is_fr33_legacy_bill_proof_path(p_bucket text,p_path text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'pg_catalog'
AS $$
  SELECT coalesce(p_bucket = 'business-documents' AND p_path ~ (
    '^workspaces/([a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}/){3}'
    || '[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}[.](pdf|png|csv|xlsx)$'
  ), false);
$$;

ALTER TABLE mushavo_file_ingest.ordinary_uploads
  ADD COLUMN erasure_object_id uuid,
  ADD COLUMN erasure_object_version text,
  DROP CONSTRAINT ordinary_uploads_check,
  ADD CONSTRAINT ordinary_uploads_check CHECK (
    (erasure_object_id IS NULL AND erasure_object_version IS NULL
      AND public.fr32_is_managed_ordinary_upload(bucket_id,path))
    OR (erasure_object_id IS NOT NULL AND actor_id IS NULL AND parent_type IS NOT DISTINCT FROM 'business_bill_payment'
      AND mushavo_file_ingest.is_fr33_legacy_bill_proof_path(bucket_id,path)
      AND state IN ('ready','claimed','removed'))
  );

ALTER TABLE mushavo_account_deletion.file_cleanup_targets
  DROP CONSTRAINT file_cleanup_targets_check,
  ADD CONSTRAINT file_cleanup_targets_check CHECK (
    public.fr32_is_managed_ordinary_upload(bucket_id,path)
    OR mushavo_file_ingest.is_fr33_legacy_bill_proof_path(bucket_id,path)
  );

CREATE FUNCTION mushavo_account_deletion.prepare_owned_legacy_bill_proof_cleanup(
  p_request_id uuid,p_workspace_ids uuid[]
) RETURNS void LANGUAGE plpgsql
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
BEGIN
  WITH verified AS MATERIALIZED (
    SELECT document.storage_path,document.workspace_id,document.id,document.parent_id,
      document.mime_type,document.size_bytes,object.id AS object_id,object.version
    FROM public.business_documents document
    JOIN public.business_bill_payments payment
      ON payment.id = document.parent_id AND payment.workspace_id = document.workspace_id
    JOIN storage.objects object ON object.bucket_id = 'business-documents' AND object.name = document.storage_path
    WHERE document.workspace_id = ANY(p_workspace_ids)
      AND document.parent_type = 'business_bill_payment' AND document.status = 'active'
      AND mushavo_file_ingest.is_fr33_legacy_bill_proof_path(object.bucket_id,object.name)
      AND split_part(object.name,'/',2) = document.workspace_id::text
      AND split_part(object.name,'/',3) = document.uploaded_by::text
      AND split_part(object.name,'/',4) = document.id::text
      AND object.owner_id IS NULL AND object.owner IS NULL
      AND document.size_bytes BETWEEN 1 AND 10485760
      AND object.metadata->>'mimetype' = document.mime_type
      AND COALESCE(object.metadata->>'size',object.metadata->>'contentLength') = document.size_bytes::text
      AND NOT EXISTS (SELECT 1 FROM public.business_documents other
        WHERE other.storage_path = document.storage_path AND other.id <> document.id)
      AND NOT EXISTS (SELECT 1 FROM mushavo_file_ingest.ordinary_uploads existing
        WHERE existing.bucket_id = object.bucket_id AND existing.path = object.name)
    FOR SHARE OF document,payment,object
  ), queued AS (
    INSERT INTO mushavo_file_ingest.ordinary_uploads (
      bucket_id,path,workspace_id,attachment_id,parent_type,parent_id,mime_type,byte_count,state,expires_at,
      erasure_object_id,erasure_object_version
    )
    SELECT 'business-documents',storage_path,workspace_id,id,'business_bill_payment',parent_id,
      mime_type,size_bytes,'ready',clock_timestamp(),object_id,version FROM verified
    RETURNING bucket_id,path
  )
  INSERT INTO mushavo_account_deletion.file_cleanup_targets(bucket_id,path,request_id)
  SELECT bucket_id,path,p_request_id FROM queued;
END;
$$;
REVOKE ALL ON FUNCTION mushavo_account_deletion.prepare_owned_legacy_bill_proof_cleanup(uuid,uuid[])
  FROM PUBLIC, anon, authenticated, service_role;

DO $migration$
DECLARE
  executor text := pg_get_functiondef('mushavo_account_deletion.execute_confirmed_request(uuid)'::regprocedure);
  claim text := pg_get_functiondef('public.fr32_claim_ordinary_cleanup(uuid,bigint,integer)'::regprocedure);
  prepare_anchor text := $old$  PERFORM mushavo_account_deletion.prepare_owned_logo_cleanup(p_request_id, workspace_ids);$old$;
  claim_anchor text := $old$    and not mushavo_file_ingest.ordinary_upload_has_reference(u.bucket_id,u.path)$old$;
  claim_guard text := $new$
    and (u.erasure_object_id is null or (
      exists (select 1 from mushavo_account_deletion.file_cleanup_targets target
        join mushavo_account_deletion.requests request on request.id = target.request_id
        where (target.bucket_id,target.path) = (u.bucket_id,u.path)
          and request.erasure_committed_at is not null and request.completed_at is null)
      and not exists (select 1 from storage.objects object where (object.bucket_id,object.name) = (u.bucket_id,u.path)
        and (object.id <> u.erasure_object_id or object.version is distinct from u.erasure_object_version
          or object.owner_id is not null or object.owner is not null))
    ))$new$;
  returning_anchor text := $old$returning u.bucket_id,u.path,u.token$old$;
  result_anchor text := $old$'object_name',path,'cleanup_token',token$old$;
BEGIN
  IF cardinality(string_to_array(executor,prepare_anchor)) <> 2
    OR cardinality(string_to_array(claim,claim_anchor)) <> 2
    OR cardinality(string_to_array(claim,returning_anchor)) <> 2
    OR cardinality(string_to_array(claim,result_anchor)) <> 2
  THEN RAISE EXCEPTION 'FR33_UNEXPECTED_LEGACY_PROOF_EXECUTOR_BASE'; END IF;
  executor := replace(executor,prepare_anchor,prepare_anchor ||
    E'\n  PERFORM mushavo_account_deletion.prepare_owned_legacy_bill_proof_cleanup(p_request_id, workspace_ids);');
  claim := replace(claim,claim_anchor,claim_anchor || claim_guard);
  claim := replace(claim,returning_anchor,returning_anchor || ',u.erasure_object_id');
  claim := replace(claim,result_anchor,result_anchor || ',''legacy_account_erasure'',erasure_object_id is not null');
  EXECUTE executor;
  EXECUTE claim;
END;
$migration$;


-- Staging source 20261117141318 fr33_user_owned_logo_before_auth.
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

NOTIFY pgrst,'reload schema';
