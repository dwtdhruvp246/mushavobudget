-- Cloudflare signs each production invocation. Its signing key never enters Postgres.
CREATE TABLE mushavo_account_deletion.storage_worker_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  production_enabled boolean NOT NULL DEFAULT false,
  rehearsal_path text CHECK (rehearsal_path ~
    '^personal/[a-f0-9-]{36}/managed-upload-v1/[a-f0-9-]{36}/[a-f0-9-]{36}[.]png$'),
  rehearsal_seed boolean NOT NULL DEFAULT false,
  CHECK (NOT production_enabled OR rehearsal_path IS NULL),
  CHECK (NOT rehearsal_seed OR rehearsal_path IS NOT NULL)
);
INSERT INTO mushavo_account_deletion.storage_worker_control DEFAULT VALUES;
ALTER TABLE mushavo_account_deletion.storage_worker_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.storage_worker_control FROM PUBLIC,anon,authenticated,service_role;


CREATE TABLE mushavo_account_deletion.storage_worker_invocations (
  nonce uuid PRIMARY KEY,
  signed_at timestamptz NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE mushavo_account_deletion.storage_worker_invocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.storage_worker_invocations FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.fr33_begin_storage_job(p_nonce uuid,p_epoch bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog AS $$
DECLARE
  ctl mushavo_account_deletion.storage_worker_control%ROWTYPE;
  now_epoch bigint := extract(epoch FROM clock_timestamp())::bigint;
  operation text;
BEGIN
  IF p_nonce IS NULL OR p_epoch IS NULL OR p_epoch NOT BETWEEN now_epoch-60 AND now_epoch+10 THEN
    RETURN NULL;
  END IF;
  SELECT * INTO STRICT ctl FROM mushavo_account_deletion.storage_worker_control WHERE singleton FOR SHARE;
  IF ctl.production_enabled AND EXISTS (SELECT 1 FROM mushavo_account_deletion.processor_control
    WHERE singleton AND confirmed_since IS NOT NULL AND fixture_request_id IS NULL)
  THEN operation := 'reconcile';
  ELSIF ctl.rehearsal_path IS NOT NULL AND NOT ctl.production_enabled
    AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.processor_control WHERE confirmed_since IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.requests)
  THEN operation := CASE WHEN ctl.rehearsal_seed THEN 'rehearsal_seed' ELSE 'rehearsal' END;
  ELSE RETURN NULL;
  END IF;

  INSERT INTO mushavo_account_deletion.storage_worker_invocations(nonce,signed_at)
    VALUES(p_nonce,to_timestamp(p_epoch)) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN NULL; END IF;
  DELETE FROM mushavo_account_deletion.storage_worker_invocations WHERE accepted_at<clock_timestamp()-interval '1 day';
  RETURN jsonb_build_object('operation',operation,'rehearsal_path',ctl.rehearsal_path);
END;
$$;
REVOKE ALL ON FUNCTION public.fr33_begin_storage_job(uuid,bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.fr33_begin_storage_job(uuid,bigint) TO service_role;
CREATE FUNCTION public.fr33_claim_storage_rehearsal(p_nonce uuid,p_epoch bigint,p_path text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog AS $$
DECLARE
  batch jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.storage_worker_control
      WHERE singleton AND NOT production_enabled AND rehearsal_path=p_path)
    OR EXISTS (SELECT 1 FROM mushavo_account_deletion.processor_control WHERE confirmed_since IS NOT NULL)
    OR EXISTS (SELECT 1 FROM mushavo_file_ingest.ordinary_uploads WHERE (bucket_id,path) IS DISTINCT FROM ('payment-proofs',p_path))
    OR mushavo_file_ingest.ordinary_upload_has_reference('payment-proofs',p_path)
  THEN RAISE EXCEPTION 'FR33_STORAGE_REHEARSAL_NOT_ISOLATED'; END IF;
  batch := public.fr32_claim_ordinary_cleanup(p_nonce,p_epoch,1);
  IF jsonb_typeof(batch) IS DISTINCT FROM 'array' OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(batch) item
    WHERE item->>'bucket_id' IS DISTINCT FROM 'payment-proofs' OR item->>'object_name' IS DISTINCT FROM p_path
  ) THEN RAISE EXCEPTION 'FR33_STORAGE_REHEARSAL_CLAIM_SCOPE_CHANGED'; END IF;
  RETURN batch;
END;
$$;
REVOKE ALL ON FUNCTION public.fr33_claim_storage_rehearsal(uuid,bigint,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.fr33_claim_storage_rehearsal(uuid,bigint,text) TO service_role;

GRANT EXECUTE ON FUNCTION
  public.fr32_ordinary_cleanup_due(),public.fr32_claim_ordinary_cleanup(uuid,bigint,integer),
  public.fr32_finish_ordinary_cleanup(text,text,uuid),public.fr32_logo_replacement_mode(),
  public.fr32_claim_logo_replacements(uuid,bigint,integer),public.fr32_finish_logo_replacement(text,uuid),
  public.managed_subscription_cleanup_due(),public.claim_managed_subscription_cleanup(uuid,bigint,integer),
  public.finish_managed_subscription_cleanup(text,uuid),public.fr33_claim_shared_proof_handoff(),
  public.fr33_shared_proof_handoff_step(uuid,uuid,text,text),public.fr33_billing_archive_expiry_step(uuid,uuid)
TO service_role;

NOTIFY pgrst,'reload schema';
