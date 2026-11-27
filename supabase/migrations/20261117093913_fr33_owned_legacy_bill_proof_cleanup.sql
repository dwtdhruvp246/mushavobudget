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
