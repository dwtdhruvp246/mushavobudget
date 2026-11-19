SET LOCAL lock_timeout='3s';
-- Staging source 20261118103004 fr33_transfer_user_owned_shared_payment_proofs.
-- Copy first, then re-link inside a database transaction, then remove the original through Storage.
CREATE TABLE mushavo_account_deletion.shared_proof_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES mushavo_account_deletion.requests(id) ON DELETE RESTRICT,
  bucket text NOT NULL CHECK (bucket IN ('payment-proofs','business-documents')),
  workspace_id uuid NOT NULL,
  record_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  source_path text NOT NULL,
  source_id uuid NOT NULL,
  source_version text NOT NULL,
  target_path text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf','image/png')),
  byte_count bigint NOT NULL CHECK (byte_count BETWEEN 1 AND 10485760),
  sha256 text CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  parent_type text,
  parent_id uuid,
  destination_id uuid,
  destination_version text,
  lease_token uuid,
  lease_until timestamptz,
  relink_transaction xid8,
  UNIQUE (bucket,source_path),
  UNIQUE (bucket,target_path),
  UNIQUE (bucket,record_id),
  CHECK (source_path <> target_path),
  CHECK ((lease_token IS NULL) = (lease_until IS NULL)),
  CHECK ((destination_id IS NULL) = (destination_version IS NULL))
);
CREATE INDEX fr33_shared_proof_request_idx ON mushavo_account_deletion.shared_proof_handoffs(request_id);
ALTER TABLE mushavo_account_deletion.shared_proof_handoffs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.shared_proof_handoffs FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION mushavo_account_deletion.proof_link_is_current(
  p_plan mushavo_account_deletion.shared_proof_handoffs, p_path text
)
RETURNS boolean LANGUAGE plpgsql
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
BEGIN
  IF p_plan.bucket = 'payment-proofs' THEN
    PERFORM 1 FROM public.payment_records payment
    JOIN public.budget_workspaces workspace ON workspace.id = payment.workspace_id
    JOIN public.payment_items item ON item.id = payment.payment_item_id
      AND item.workspace_id = workspace.id AND item.family_id = payment.family_id
    JOIN public.families family ON family.id = payment.family_id
      AND family.id = workspace.legacy_family_id AND family.owner_id = workspace.owner_id
    WHERE payment.id = p_plan.record_id AND payment.proof_path = p_path
      AND workspace.id = p_plan.workspace_id AND workspace.owner_id <> p_plan.subject_id
      AND workspace.workspace_type IN ('family','household') AND payment.visibility = 'family'
      AND payment.recorded_by = p_plan.subject_id AND payment.payment_item_id = p_plan.parent_id
      AND payment.proof_mime_type = p_plan.mime_type AND payment.proof_size_bytes = p_plan.byte_count
      AND split_part(p_path,'/',2) = family.id::text AND split_part(p_path,'/',3) = family.owner_id::text
      AND NOT EXISTS (SELECT 1 FROM public.payment_records other
        WHERE other.proof_path = p_path AND other.id <> payment.id)
    FOR UPDATE OF payment FOR SHARE OF workspace,item,family;
  ELSE
    PERFORM 1 FROM public.business_documents document
    JOIN public.budget_workspaces workspace ON workspace.id = document.workspace_id
    WHERE document.id = p_plan.record_id AND document.storage_path = p_path
      AND workspace.id = p_plan.workspace_id AND workspace.owner_id <> p_plan.subject_id
      AND workspace.workspace_type = 'business' AND document.status = 'active'
      AND document.uploaded_by = p_plan.subject_id AND document.parent_type = p_plan.parent_type
      AND document.parent_id = p_plan.parent_id AND document.checksum_sha256 IS NOT DISTINCT FROM p_plan.sha256
      AND split_part(p_path,'/',2) = workspace.id::text AND split_part(p_path,'/',4) = document.id::text
      AND document.mime_type = p_plan.mime_type AND document.size_bytes = p_plan.byte_count
      AND NOT EXISTS (SELECT 1 FROM public.business_documents other
        WHERE other.storage_path = p_path AND other.id <> document.id)
      AND ((document.parent_type = 'business_bill_payment' AND EXISTS (
        SELECT 1 FROM public.business_bill_payments payment WHERE payment.id = document.parent_id
          AND payment.workspace_id = document.workspace_id FOR SHARE
      )) OR (document.parent_type = 'expense_claim' AND EXISTS (
        SELECT 1 FROM public.business_expense_claims claim WHERE claim.id = document.parent_id
          AND claim.workspace_id = document.workspace_id AND claim.status = 'paid' FOR SHARE
      )))
    FOR UPDATE OF document FOR SHARE OF workspace;
  END IF;
  RETURN FOUND;
END;
$$;

CREATE FUNCTION mushavo_account_deletion.queue_shared_proof_handoffs(p_request_id uuid,p_subject uuid)
RETURNS boolean LANGUAGE plpgsql
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
DECLARE
  candidate record;
  plan mushavo_account_deletion.shared_proof_handoffs%ROWTYPE;
  nonce uuid;
  uuid_pattern constant text := '[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}';
BEGIN
  FOR candidate IN
    WITH links AS (
      SELECT 'payment-proofs'::text bucket,payment.workspace_id,payment.id,payment.proof_path AS path,
        payment.proof_mime_type AS mime,payment.proof_size_bytes AS bytes,NULL::text AS sha256,
        NULL::text AS parent_type,payment.payment_item_id AS parent_id
      FROM public.payment_records payment WHERE payment.recorded_by = p_subject AND payment.visibility = 'family'
      UNION ALL
      SELECT 'business-documents',document.workspace_id,document.id,document.storage_path,
        document.mime_type,document.size_bytes,document.checksum_sha256,document.parent_type,document.parent_id
      FROM public.business_documents document WHERE document.uploaded_by = p_subject AND document.status = 'active'
        AND document.parent_type IN ('business_bill_payment','expense_claim')
    )
    SELECT links.*,object.id AS source_id,object.version FROM links
    JOIN public.budget_workspaces workspace ON workspace.id = links.workspace_id AND workspace.owner_id <> p_subject
    JOIN storage.objects object ON object.bucket_id = links.bucket AND object.name = links.path
    JOIN storage.buckets bucket ON bucket.id = object.bucket_id
    WHERE (object.owner_id = p_subject::text OR object.owner = p_subject)
      AND (object.owner_id IS NULL OR object.owner_id = p_subject::text)
      AND (object.owner IS NULL OR object.owner = p_subject)
      AND bucket.public IS FALSE AND bucket.versioning_status = 'DISABLED' AND bucket.lifecycle_configuration IS NULL
      AND object.version IS NOT NULL AND object.archived_at IS NULL AND object.is_delete_marker IS FALSE
      AND object.metadata->>'mimetype' = links.mime AND object.metadata->>'size' = links.bytes::text
      AND links.bytes BETWEEN 1 AND 10485760
      AND links.mime = CASE right(links.path,4) WHEN '.pdf' THEN 'application/pdf' WHEN '.png' THEN 'image/png' END
      AND (links.sha256 IS NULL OR links.sha256 ~ '^[0-9a-f]{64}$')
      AND (CASE links.bucket WHEN 'payment-proofs'
        THEN links.path ~ ('^families/' || uuid_pattern || '/' || uuid_pattern || '/' || p_subject || '/' || uuid_pattern || '[.](pdf|png)$')
        ELSE links.path ~ ('^workspaces/' || links.workspace_id || '/' || p_subject || '/' || links.id || '/' || uuid_pattern || '[.](pdf|png)$')
        END)
      AND NOT EXISTS (SELECT 1 FROM mushavo_file_ingest.ordinary_uploads upload
        WHERE upload.bucket_id = links.bucket AND upload.path = links.path)
      AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.shared_proof_handoffs queued
        WHERE queued.bucket = links.bucket AND queued.source_path = links.path)
    ORDER BY links.bucket,links.id FOR SHARE OF object,bucket
  LOOP
    nonce := gen_random_uuid();
    plan.request_id := p_request_id;
    plan.bucket := candidate.bucket;
    plan.workspace_id := candidate.workspace_id;
    plan.record_id := candidate.id;
    plan.subject_id := p_subject;
    plan.source_path := candidate.path;
    plan.source_id := candidate.source_id;
    plan.source_version := candidate.version;
    plan.mime_type := candidate.mime;
    plan.byte_count := candidate.bytes;
    plan.sha256 := candidate.sha256;
    plan.parent_type := candidate.parent_type;
    plan.parent_id := candidate.parent_id;
    plan.target_path := regexp_replace(candidate.path,'[^/]+$','managed-upload-v1/' ||
      CASE WHEN plan.bucket = 'payment-proofs' THEN nonce::text || '/' ELSE '' END ||
      gen_random_uuid()::text || right(candidate.path,4));
    IF NOT mushavo_account_deletion.proof_link_is_current(plan,plan.source_path) THEN CONTINUE; END IF;
    INSERT INTO mushavo_account_deletion.shared_proof_handoffs
      (request_id,bucket,workspace_id,record_id,subject_id,source_path,source_id,source_version,
       target_path,mime_type,byte_count,sha256,parent_type,parent_id)
    VALUES (plan.request_id,plan.bucket,plan.workspace_id,plan.record_id,plan.subject_id,plan.source_path,
      plan.source_id,plan.source_version,plan.target_path,plan.mime_type,plan.byte_count,
      plan.sha256,plan.parent_type,plan.parent_id);
  END LOOP;
  RETURN EXISTS (SELECT 1 FROM mushavo_account_deletion.shared_proof_handoffs WHERE request_id = p_request_id);
END;
$$;

CREATE FUNCTION mushavo_account_deletion.proof_path_is_locked(p_bucket text,p_path text,p_read boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (SELECT 1 FROM mushavo_account_deletion.shared_proof_handoffs plan
    WHERE plan.bucket = p_bucket AND (
      (plan.target_path = p_path AND (NOT p_read OR plan.destination_id IS NULL))
      OR (plan.source_path = p_path AND NOT p_read)
    ));
$$;
REVOKE ALL ON FUNCTION mushavo_account_deletion.proof_path_is_locked(text,text,boolean) FROM PUBLIC,service_role;
GRANT EXECUTE ON FUNCTION mushavo_account_deletion.proof_path_is_locked(text,text,boolean) TO anon,authenticated;
CREATE POLICY fr33_shared_proof_select ON storage.objects AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (NOT mushavo_account_deletion.proof_path_is_locked(bucket_id,name,true));
CREATE POLICY fr33_shared_proof_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (NOT mushavo_account_deletion.proof_path_is_locked(bucket_id,name,false));
CREATE POLICY fr33_shared_proof_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (NOT mushavo_account_deletion.proof_path_is_locked(bucket_id,name,false))
  WITH CHECK (NOT mushavo_account_deletion.proof_path_is_locked(bucket_id,name,false));
CREATE POLICY fr33_shared_proof_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (NOT mushavo_account_deletion.proof_path_is_locked(bucket_id,name,false));

CREATE FUNCTION mushavo_account_deletion.is_shared_proof_relink(p_relation regclass,p_old jsonb,p_new jsonb)
RETURNS boolean LANGUAGE sql STABLE
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM mushavo_account_deletion.shared_proof_handoffs plan
    CROSS JOIN LATERAL (SELECT CASE WHEN plan.bucket = 'payment-proofs' THEN 'proof_path' ELSE 'storage_path' END AS path) field
    WHERE p_relation = CASE WHEN plan.bucket = 'payment-proofs' THEN 'public.payment_records'::regclass
      ELSE 'public.business_documents'::regclass END
      AND plan.record_id = (p_old->>'id')::uuid AND plan.workspace_id = (p_old->>'workspace_id')::uuid
      AND plan.source_path = p_old->>field.path AND plan.target_path = p_new->>field.path
      AND p_old - field.path = p_new - field.path
      AND plan.relink_transaction = pg_current_xact_id_if_assigned()
  );
$$;

CREATE FUNCTION mushavo_account_deletion.guard_proof_handoff_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
DECLARE
  path_field text := CASE WHEN TG_TABLE_NAME = 'payment_records' THEN 'proof_path' ELSE 'storage_path' END;
  proof_bucket text := CASE WHEN TG_TABLE_NAME = 'payment_records' THEN 'payment-proofs' ELSE 'business-documents' END;
  context_fields text[] := ARRAY['id','workspace_id',path_field,'family_id','visibility','recorded_by',
    'payment_item_id','proof_mime_type','proof_size_bytes','parent_id','parent_type','status','uploaded_by',
    'mime_type','size_bytes','checksum_sha256'];
  old_row jsonb := to_jsonb(OLD);
  new_row jsonb := to_jsonb(NEW);
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NOT EXISTS (SELECT 1 FROM unnest(context_fields) AS field(name)
      WHERE old_row->field.name IS DISTINCT FROM new_row->field.name)
      OR mushavo_account_deletion.is_shared_proof_relink(TG_RELID,old_row,new_row)
    THEN RETURN NEW; END IF;
  END IF;
  IF mushavo_account_deletion.proof_path_is_locked(proof_bucket,old_row->>path_field,false)
    OR mushavo_account_deletion.proof_path_is_locked(proof_bucket,new_row->>path_field,false)
  THEN RAISE EXCEPTION 'FR33_PROOF_TRANSFER_IN_PROGRESS'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION mushavo_account_deletion.guard_proof_handoff_link() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER a_fr33_proof_handoff_link BEFORE INSERT OR UPDATE OR DELETE ON public.payment_records
  FOR EACH ROW EXECUTE FUNCTION mushavo_account_deletion.guard_proof_handoff_link();
CREATE TRIGGER a_fr33_proof_handoff_link BEFORE INSERT OR UPDATE OR DELETE ON public.business_documents
  FOR EACH ROW EXECUTE FUNCTION mushavo_account_deletion.guard_proof_handoff_link();

CREATE FUNCTION mushavo_account_deletion.proof_handoff_is_active(p_request_id uuid,p_subject uuid)
RETURNS boolean LANGUAGE sql STABLE
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM mushavo_account_deletion.requests request
    JOIN mushavo_account_deletion.processor_control control ON control.singleton
    WHERE request.id = p_request_id AND request.subject_id = p_subject AND request.cancelled_at IS NULL
      AND request.completed_at IS NULL AND request.erasure_committed_at IS NULL AND request.storage_before_auth_at IS NULL
      AND request.workspace_impact_confirmed_at >= control.confirmed_since
      AND (control.fixture_request_id IS NULL OR control.fixture_request_id = p_request_id)
      AND request.workspace_impact_token = mushavo_account_deletion.owned_workspace_impact(p_subject)->>'impact_token'
  );
$$;

CREATE FUNCTION public.fr33_claim_shared_proof_handoff()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
SET lock_timeout TO '2s'
AS $$
  WITH next AS (
    SELECT plan.id FROM mushavo_account_deletion.shared_proof_handoffs plan
    WHERE (plan.lease_until IS NULL OR plan.lease_until <= clock_timestamp())
      AND mushavo_account_deletion.proof_handoff_is_active(plan.request_id,plan.subject_id)
    ORDER BY plan.lease_until NULLS FIRST,plan.id
    LIMIT 1 FOR UPDATE SKIP LOCKED
  ), leased AS (
    UPDATE mushavo_account_deletion.shared_proof_handoffs plan
    SET lease_token = gen_random_uuid(),lease_until = clock_timestamp()+interval '2 minutes'
    FROM next WHERE plan.id = next.id
    RETURNING plan.id,plan.bucket,plan.source_path,plan.source_version,plan.target_path,plan.mime_type,
      plan.byte_count,plan.sha256,plan.lease_token,(plan.destination_id IS NOT NULL) AS relinked
  )
  SELECT to_jsonb(leased) FROM leased;
$$;

CREATE FUNCTION public.fr33_shared_proof_handoff_step(p_id uuid,p_token uuid,p_step text,p_digest text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
SET lock_timeout TO '2s'
AS $$
DECLARE
  plan mushavo_account_deletion.shared_proof_handoffs%ROWTYPE;
  source storage.objects%ROWTYPE;
  destination storage.objects%ROWTYPE;
  row_count bigint;
BEGIN
  SELECT * INTO plan FROM mushavo_account_deletion.shared_proof_handoffs WHERE id = p_id;
  IF NOT FOUND OR plan.lease_token IS DISTINCT FROM p_token OR p_token IS NULL THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('fr33-account-deletion:' || plan.subject_id::text,0));
  SELECT * INTO plan FROM mushavo_account_deletion.shared_proof_handoffs WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR plan.lease_token IS DISTINCT FROM p_token OR plan.lease_until <= clock_timestamp()
    OR NOT mushavo_account_deletion.proof_handoff_is_active(plan.request_id,plan.subject_id)
  THEN RETURN false; END IF;

  SELECT object.* INTO source FROM storage.objects object WHERE object.bucket_id = plan.bucket
    AND object.name = plan.source_path FOR SHARE;
  IF source.id IS NOT NULL AND (source.id IS DISTINCT FROM plan.source_id OR source.version IS DISTINCT FROM plan.source_version
    OR (source.owner_id IS NULL AND source.owner IS NULL)
    OR (source.owner_id IS NOT NULL AND source.owner_id <> plan.subject_id::text)
    OR (source.owner IS NOT NULL AND source.owner <> plan.subject_id))
  THEN RETURN false; END IF;

  IF p_step = 'copy' THEN
    RETURN plan.destination_id IS NULL AND source.id IS NOT NULL
      AND mushavo_account_deletion.proof_link_is_current(plan,plan.source_path);
  END IF;
  SELECT object.* INTO destination
  FROM storage.objects object JOIN storage.buckets bucket ON bucket.id = object.bucket_id
  WHERE object.bucket_id = plan.bucket AND object.name = plan.target_path
    AND object.owner_id IS NULL AND object.owner IS NULL AND object.version IS NOT NULL
    AND object.archived_at IS NULL AND object.is_delete_marker IS FALSE
    AND bucket.public IS FALSE AND bucket.versioning_status = 'DISABLED' AND bucket.lifecycle_configuration IS NULL
    AND object.metadata->>'mimetype' = plan.mime_type AND object.metadata->>'size' = plan.byte_count::text
  FOR SHARE OF object,bucket;
  IF destination.id IS NULL THEN RETURN false; END IF;

  IF p_step = 'relink' THEN
    IF plan.destination_id IS NOT NULL OR source.id IS NULL OR p_digest IS NULL OR p_digest !~ '^[0-9a-f]{64}$'
      OR (plan.sha256 IS NOT NULL AND plan.sha256 <> p_digest)
      OR NOT mushavo_account_deletion.proof_link_is_current(plan,plan.source_path)
      OR mushavo_file_ingest.ordinary_upload_has_reference(plan.bucket,plan.target_path)
    THEN RETURN false; END IF;
    INSERT INTO mushavo_file_ingest.ordinary_uploads
      (bucket_id,path,workspace_id,attachment_id,parent_type,parent_id,actor_id,mime_type,byte_count,state,expires_at)
    VALUES (plan.bucket,plan.target_path,plan.workspace_id,
      CASE WHEN plan.bucket = 'business-documents' THEN plan.record_id END,
      plan.parent_type,CASE WHEN plan.bucket = 'business-documents' THEN plan.parent_id END,
      plan.subject_id,plan.mime_type,plan.byte_count,'linked',clock_timestamp());
    UPDATE mushavo_account_deletion.shared_proof_handoffs SET relink_transaction = pg_current_xact_id() WHERE id = p_id;
    IF plan.bucket = 'payment-proofs' THEN
      UPDATE public.payment_records SET proof_path = plan.target_path WHERE id = plan.record_id;
    ELSE
      UPDATE public.business_documents SET storage_path = plan.target_path WHERE id = plan.record_id;
    END IF;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    IF row_count <> 1 THEN RAISE EXCEPTION 'FR33_SHARED_PROOF_LINK_CHANGED'; END IF;
    UPDATE mushavo_account_deletion.shared_proof_handoffs
    SET destination_id = destination.id,destination_version = destination.version,relink_transaction = NULL,
      lease_token = NULL,lease_until = NULL
    WHERE id = p_id;
    RETURN true;
  END IF;

  IF (destination.id,destination.version) IS DISTINCT FROM (plan.destination_id,plan.destination_version)
    OR NOT mushavo_account_deletion.proof_link_is_current(plan,plan.target_path)
    OR mushavo_file_ingest.ordinary_upload_has_reference(plan.bucket,plan.source_path)
  THEN RETURN false; END IF;
  IF p_step = 'remove' THEN RETURN true; END IF;
  IF p_step = 'finish' AND source.id IS NULL THEN
    DELETE FROM mushavo_account_deletion.shared_proof_handoffs WHERE id = p_id;
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.fr33_claim_shared_proof_handoff(),
  public.fr33_shared_proof_handoff_step(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fr33_claim_shared_proof_handoff(),
  public.fr33_shared_proof_handoff_step(uuid,uuid,text,text) TO service_role;
REVOKE ALL ON FUNCTION mushavo_account_deletion.proof_link_is_current(mushavo_account_deletion.shared_proof_handoffs,text),
  mushavo_account_deletion.queue_shared_proof_handoffs(uuid,uuid),
  mushavo_account_deletion.proof_handoff_is_active(uuid,uuid),
  mushavo_account_deletion.is_shared_proof_relink(regclass,jsonb,jsonb) FROM PUBLIC, anon, authenticated, service_role;

DO $migration$
DECLARE
  function_id regprocedure;
  definition text;
  anchor text;
BEGIN
  FOREACH function_id IN ARRAY ARRAY['public.guard_workspace_finance_write()'::regprocedure,
    'mushavo_file_ingest.bind_ordinary_upload()'::regprocedure]
  LOOP
    definition := pg_get_functiondef(function_id);
    anchor := E'\nbegin\n';
    IF cardinality(string_to_array(definition,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_SHARED_PROOF_GUARD_CHANGED'; END IF;
    EXECUTE replace(definition,anchor,anchor ||
      E'  IF TG_OP = ''UPDATE'' AND mushavo_account_deletion.is_shared_proof_relink(TG_RELID,to_jsonb(OLD),to_jsonb(NEW))\n' ||
      E'  THEN RETURN NEW; END IF;\n');
  END LOOP;
  definition := pg_get_functiondef('mushavo_account_deletion.execute_confirmed_request(uuid)'::regprocedure);
  anchor := '  PERFORM mushavo_account_deletion.prepare_shared_proof_retention(p_request_id);';
  IF cardinality(string_to_array(definition,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_SHARED_PROOF_EXECUTOR_CHANGED'; END IF;
  EXECUTE replace(definition,anchor,
    E'  IF mushavo_account_deletion.queue_shared_proof_handoffs(p_request_id,subject) THEN\n' ||
    E'    RETURN jsonb_build_object(''status'',''proof_transfer_pending'');\n  END IF;\n\n' || anchor);

  definition := pg_get_functiondef('mushavo_account_deletion.process_confirmed_requests()'::regprocedure);
  anchor := '        WHEN ''storage_before_auth'' THEN';
  IF cardinality(string_to_array(definition,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_SHARED_PROOF_PROCESSOR_CHANGED'; END IF;
  definition := replace(definition,anchor,'        WHEN ''storage_before_auth'', ''proof_transfer_pending'' THEN');
  anchor := 'CASE WHEN outcome = ''storage_before_auth'' THEN 1';
  IF cardinality(string_to_array(definition,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_SHARED_PROOF_RETRY_CHANGED'; END IF;
  EXECUTE replace(definition,anchor,'CASE WHEN outcome IN (''storage_before_auth'', ''proof_transfer_pending'') THEN 1');

  definition := pg_get_functiondef('public.fr33_cancel_account_deletion()'::regprocedure);
  anchor := 'WHERE subject_id = subject AND storage_before_auth_at IS NOT NULL)';
  IF cardinality(string_to_array(definition,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_SHARED_PROOF_CANCEL_CHANGED'; END IF;
  EXECUTE replace(definition,anchor,anchor || E'\n    OR EXISTS (SELECT 1 FROM mushavo_account_deletion.shared_proof_handoffs plan WHERE plan.subject_id = subject)');
END;
$migration$;


-- Staging source 20261118103501 fr33_bind_transferred_family_proof_record.
DO $migration$
DECLARE
  definition text := pg_get_functiondef('public.fr33_shared_proof_handoff_step(uuid,uuid,text,text)'::regprocedure);
  anchor text := 'CASE WHEN plan.bucket = ''business-documents'' THEN plan.record_id END,';
BEGIN
  IF cardinality(string_to_array(definition,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_SHARED_PROOF_JOURNAL_CHANGED'; END IF;
  EXECUTE replace(definition,anchor,'plan.record_id,');
END;
$migration$;


-- Staging source 20261118103817 fr33_support_legacy_family_proof_media.
ALTER TABLE mushavo_account_deletion.shared_proof_handoffs
  DROP CONSTRAINT shared_proof_handoffs_mime_type_check,
  ADD CONSTRAINT shared_proof_handoffs_mime_type_check CHECK (
    mime_type IN ('application/pdf','image/png') OR (bucket = 'payment-proofs' AND mime_type IN ('image/jpeg','image/webp'))
  );

DO $migration$
DECLARE
  definition text := pg_get_functiondef('mushavo_account_deletion.queue_shared_proof_handoffs(uuid,uuid)'::regprocedure);
  anchor text;
BEGIN
  anchor := 'CASE right(links.path,4) WHEN ''.pdf'' THEN ''application/pdf'' WHEN ''.png'' THEN ''image/png'' END';
  IF cardinality(string_to_array(definition,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_SHARED_PROOF_FORMAT_ANCHOR_CHANGED'; END IF;
  definition := replace(definition,anchor,
    E'CASE substring(links.path from ''[.][a-z]+$'')\n' ||
    E'        WHEN ''.pdf'' THEN ''application/pdf'' WHEN ''.png'' THEN ''image/png''\n' ||
    E'        WHEN ''.jpg'' THEN ''image/jpeg'' WHEN ''.jpeg'' THEN ''image/jpeg'' WHEN ''.webp'' THEN ''image/webp'' END');
  anchor := $anchor$|| p_subject || '/' || uuid_pattern || '[.](pdf|png)$')$anchor$;
  IF cardinality(string_to_array(definition,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_SHARED_PROOF_FAMILY_PATH_ANCHOR_CHANGED'; END IF;
  definition := replace(definition,anchor,replace(anchor,'(pdf|png)','(pdf|png|jpe?g|webp)'));
  anchor := 'right(candidate.path,4)';
  IF cardinality(string_to_array(definition,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_SHARED_PROOF_EXTENSION_ANCHOR_CHANGED'; END IF;
  EXECUTE replace(definition,anchor,'substring(candidate.path from ''[.][a-z]+$'')');
END;
$migration$;


-- Staging source 20261118121258 fr33_retain_legacy_subscription_proofs.
-- Copy legacy subscription proof bytes through Storage before changing ownership or access.
CREATE FUNCTION mushavo_account_deletion.legacy_subscription_proof_path(p_path text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'pg_catalog' AS $$
  SELECT coalesce(p_path ~ '^workspaces/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/(proof/)?[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.](pdf|png|jpe?g|webp)$',false);
$$;

CREATE FUNCTION mushavo_account_deletion.subscription_proof_shape(p_path text,p_mime text,p_bytes bigint)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'pg_catalog' AS $$
  SELECT coalesce(
    CASE WHEN mushavo_account_deletion.legacy_subscription_proof_path(p_path)
      OR p_path ~ '^workspaces/[0-9a-f-]{36}/[0-9a-f-]{36}/(proof/)?fr33-retained-v1/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.](pdf|png|jpe?g|webp)$'
    THEN p_bytes BETWEEN 1 AND 10485760 AND p_mime = CASE substring(p_path from '[.][a-z]+$')
      WHEN '.pdf' THEN 'application/pdf' WHEN '.png' THEN 'image/png' WHEN '.jpg' THEN 'image/jpeg'
      WHEN '.jpeg' THEN 'image/jpeg' WHEN '.webp' THEN 'image/webp' END
    ELSE p_bytes BETWEEN 1 AND 2097152 AND p_path ~ '^workspaces/[a-f0-9-]{36}/[a-f0-9-]{36}/([a-z0-9-]+/){1,2}[a-f0-9-]{36}[.](pdf|png)$'
      AND p_mime = CASE WHEN right(p_path,4) = '.pdf' THEN 'application/pdf' ELSE 'image/png' END END,false);
$$;

CREATE FUNCTION mushavo_account_deletion.handoff_path_has_reference(p_bucket text,p_path text)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'pg_catalog' SET row_security TO 'off' AS $$
  SELECT CASE WHEN p_bucket = 'subscription-proofs' THEN EXISTS (
    SELECT 1 FROM public.subscription_payment_proofs proof WHERE proof.storage_path = p_path
  ) ELSE mushavo_file_ingest.ordinary_upload_has_reference(p_bucket,p_path) END;
$$;

CREATE FUNCTION mushavo_account_deletion.can_read_detached_subscription_proof(p_proof uuid,p_payment uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog' SET row_security TO 'off' AS $$
  SELECT EXISTS (
    SELECT 1 FROM mushavo_account_deletion.retained_billing_actors actor
    JOIN public.subscription_payments payment ON payment.id = p_payment AND payment.workspace_id = actor.workspace_id
    JOIN public.budget_workspaces workspace ON workspace.id = payment.workspace_id AND workspace.owner_id = auth.uid()
    WHERE actor.relation_name = 'subscription_payment_proofs' AND actor.field_name = 'uploaded_by' AND actor.record_id = p_proof
  );
$$;
REVOKE ALL ON FUNCTION mushavo_account_deletion.legacy_subscription_proof_path(text),
  mushavo_account_deletion.subscription_proof_shape(text,text,bigint),
  mushavo_account_deletion.handoff_path_has_reference(text,text),
  mushavo_account_deletion.can_read_detached_subscription_proof(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION mushavo_account_deletion.can_read_detached_subscription_proof(uuid,uuid) TO authenticated;
CREATE POLICY fr33_workspace_owner_read_detached_subscription_proof ON public.subscription_payment_proofs
  FOR SELECT TO authenticated USING (
    uploaded_by IS NULL AND mushavo_account_deletion.can_read_detached_subscription_proof(id,payment_id)
  );

-- The copied proof is managed by the deletion worker and never writable by an app user.
CREATE POLICY fr33_subscription_handoff_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO anon,authenticated
  WITH CHECK (bucket_id <> 'subscription-proofs' OR name !~ '(^|/)fr33-retained-v1/');
CREATE POLICY fr33_subscription_handoff_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated
  USING (bucket_id <> 'subscription-proofs' OR name !~ '(^|/)fr33-retained-v1/')
  WITH CHECK (bucket_id <> 'subscription-proofs' OR name !~ '(^|/)fr33-retained-v1/');
CREATE POLICY fr33_subscription_handoff_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated
  USING (bucket_id <> 'subscription-proofs' OR name !~ '(^|/)fr33-retained-v1/');

ALTER TABLE mushavo_account_deletion.shared_proof_handoffs
  DROP CONSTRAINT shared_proof_handoffs_bucket_check,
  ADD CONSTRAINT shared_proof_handoffs_bucket_check CHECK (bucket IN ('payment-proofs','business-documents','subscription-proofs')),
  DROP CONSTRAINT shared_proof_handoffs_mime_type_check,
  ADD CONSTRAINT shared_proof_handoffs_mime_type_check CHECK (
    mime_type IN ('application/pdf','image/png') OR
    (bucket IN ('payment-proofs','subscription-proofs') AND mime_type IN ('image/jpeg','image/webp'))
  );

DO $migration$
DECLARE definition text := pg_get_functiondef('mushavo_account_deletion.proof_link_is_current(mushavo_account_deletion.shared_proof_handoffs,text)'::regprocedure);
BEGIN
  IF cardinality(string_to_array(definition,$before0$  ELSE
    PERFORM 1 FROM public.business_documents$before0$)) <> 2 THEN RAISE EXCEPTION 'FR33_SUBSCRIPTION_HANDOFF_ANCHOR_CHANGED'; END IF;
  definition := replace(definition,$before0$  ELSE
    PERFORM 1 FROM public.business_documents$before0$,$after0$  ELSIF p_plan.bucket = 'subscription-proofs' THEN
    PERFORM 1 FROM public.subscription_payment_proofs proof
    JOIN public.subscription_payments payment ON payment.id = proof.payment_id
    JOIN public.subscription_renewal_requests renewal ON renewal.id = payment.renewal_request_id AND renewal.workspace_id = payment.workspace_id
    JOIN public.subscription_invoices invoice ON invoice.id = renewal.invoice_id AND invoice.workspace_id = payment.workspace_id
    JOIN public.budget_workspaces workspace ON workspace.id = payment.workspace_id
    WHERE proof.id = p_plan.record_id AND proof.storage_path = p_path
      AND payment.id = p_plan.parent_id AND payment.workspace_id = p_plan.workspace_id
      AND proof.uploaded_by = p_plan.subject_id AND proof.mime_type = p_plan.mime_type AND proof.size_bytes = p_plan.byte_count
      AND payment.status IN ('approved','rejected') AND renewal.status IN ('approved','rejected','cancelled')
      AND invoice.status IN ('paid','rejected','cancelled')
      AND split_part(p_path,'/',2) = payment.workspace_id::text AND split_part(p_path,'/',3) = p_plan.subject_id::text
      AND mushavo_account_deletion.subscription_proof_shape(p_path,proof.mime_type,proof.size_bytes)
    FOR UPDATE OF proof FOR SHARE OF workspace,payment,renewal,invoice;
  ELSE
    PERFORM 1 FROM public.business_documents$after0$);
  EXECUTE definition;
END;
$migration$;

DO $migration$
DECLARE definition text := pg_get_functiondef('mushavo_account_deletion.queue_shared_proof_handoffs(uuid,uuid)'::regprocedure);
BEGIN
  IF cardinality(string_to_array(definition,$before0$        AND document.parent_type IN ('business_bill_payment','expense_claim')
    )$before0$)) <> 2 THEN RAISE EXCEPTION 'FR33_SUBSCRIPTION_HANDOFF_ANCHOR_CHANGED'; END IF;
  definition := replace(definition,$before0$        AND document.parent_type IN ('business_bill_payment','expense_claim')
    )$before0$,$after0$        AND document.parent_type IN ('business_bill_payment','expense_claim')
      UNION ALL
      SELECT 'subscription-proofs',payment.workspace_id,proof.id,proof.storage_path,proof.mime_type,proof.size_bytes,
        NULL::text,'subscription_payment',payment.id
      FROM public.subscription_payment_proofs proof JOIN public.subscription_payments payment ON payment.id = proof.payment_id
      WHERE proof.uploaded_by = p_subject AND payment.status IN ('approved','rejected')
    )$after0$);
  IF cardinality(string_to_array(definition,$before1$workspace.id = links.workspace_id AND workspace.owner_id <> p_subject$before1$)) <> 2 THEN RAISE EXCEPTION 'FR33_SUBSCRIPTION_HANDOFF_ANCHOR_CHANGED'; END IF;
  definition := replace(definition,$before1$workspace.id = links.workspace_id AND workspace.owner_id <> p_subject$before1$,$after1$workspace.id = links.workspace_id AND (workspace.owner_id <> p_subject OR links.bucket = 'subscription-proofs')$after1$);
  IF cardinality(string_to_array(definition,$before2$        ELSE links.path ~ ('^workspaces/'$before2$)) <> 2 THEN RAISE EXCEPTION 'FR33_SUBSCRIPTION_HANDOFF_ANCHOR_CHANGED'; END IF;
  definition := replace(definition,$before2$        ELSE links.path ~ ('^workspaces/'$before2$,$after2$        WHEN 'subscription-proofs' THEN mushavo_account_deletion.legacy_subscription_proof_path(links.path)
          AND NOT EXISTS (SELECT 1 FROM mushavo_file_ingest.subscription_uploads upload WHERE upload.path = links.path)
        ELSE links.path ~ ('^workspaces/'$after2$);
  IF cardinality(string_to_array(definition,$before3$regexp_replace(candidate.path,'[^/]+$','managed-upload-v1/' ||$before3$)) <> 2 THEN RAISE EXCEPTION 'FR33_SUBSCRIPTION_HANDOFF_ANCHOR_CHANGED'; END IF;
  definition := replace(definition,$before3$regexp_replace(candidate.path,'[^/]+$','managed-upload-v1/' ||$before3$,$after3$regexp_replace(candidate.path,'[^/]+$',
      CASE WHEN candidate.bucket = 'subscription-proofs' THEN 'fr33-retained-v1/' ELSE 'managed-upload-v1/' END ||$after3$);
  EXECUTE definition;
END;
$migration$;

DO $migration$
DECLARE definition text := pg_get_functiondef('mushavo_account_deletion.is_shared_proof_relink(regclass,jsonb,jsonb)'::regprocedure);
BEGIN
  IF cardinality(string_to_array(definition,$before0$CASE WHEN plan.bucket = 'payment-proofs' THEN 'public.payment_records'::regclass
      ELSE 'public.business_documents'::regclass END$before0$)) <> 2 THEN RAISE EXCEPTION 'FR33_SUBSCRIPTION_HANDOFF_ANCHOR_CHANGED'; END IF;
  definition := replace(definition,$before0$CASE WHEN plan.bucket = 'payment-proofs' THEN 'public.payment_records'::regclass
      ELSE 'public.business_documents'::regclass END$before0$,$after0$CASE plan.bucket WHEN 'payment-proofs' THEN 'public.payment_records'::regclass
      WHEN 'subscription-proofs' THEN 'public.subscription_payment_proofs'::regclass
      ELSE 'public.business_documents'::regclass END$after0$);
  IF cardinality(string_to_array(definition,$before1$plan.record_id = (p_old->>'id')::uuid AND plan.workspace_id = (p_old->>'workspace_id')::uuid$before1$)) <> 2 THEN RAISE EXCEPTION 'FR33_SUBSCRIPTION_HANDOFF_ANCHOR_CHANGED'; END IF;
  definition := replace(definition,$before1$plan.record_id = (p_old->>'id')::uuid AND plan.workspace_id = (p_old->>'workspace_id')::uuid$before1$,$after1$plan.record_id = (p_old->>'id')::uuid AND (
        (plan.bucket = 'subscription-proofs' AND plan.parent_id = (p_old->>'payment_id')::uuid)
        OR (plan.bucket <> 'subscription-proofs' AND plan.workspace_id = (p_old->>'workspace_id')::uuid)
      )$after1$);
  EXECUTE definition;
END;
$migration$;

DO $migration$
DECLARE definition text := pg_get_functiondef('mushavo_account_deletion.guard_proof_handoff_link()'::regprocedure);
BEGIN
  IF cardinality(string_to_array(definition,$before0$CASE WHEN TG_TABLE_NAME = 'payment_records' THEN 'payment-proofs' ELSE 'business-documents' END$before0$)) <> 2 THEN RAISE EXCEPTION 'FR33_SUBSCRIPTION_HANDOFF_ANCHOR_CHANGED'; END IF;
  definition := replace(definition,$before0$CASE WHEN TG_TABLE_NAME = 'payment_records' THEN 'payment-proofs' ELSE 'business-documents' END$before0$,$after0$CASE TG_TABLE_NAME WHEN 'payment_records' THEN 'payment-proofs'
    WHEN 'subscription_payment_proofs' THEN 'subscription-proofs' ELSE 'business-documents' END$after0$);
  IF cardinality(string_to_array(definition,$before1$'payment_item_id','proof_mime_type'$before1$)) <> 2 THEN RAISE EXCEPTION 'FR33_SUBSCRIPTION_HANDOFF_ANCHOR_CHANGED'; END IF;
  definition := replace(definition,$before1$'payment_item_id','proof_mime_type'$before1$,$after1$'payment_id','payment_item_id','proof_mime_type'$after1$);
  EXECUTE definition;
END;
$migration$;

DO $migration$
DECLARE definition text := pg_get_functiondef('public.fr33_shared_proof_handoff_step(uuid,uuid,text,text)'::regprocedure);
BEGIN
  IF cardinality(string_to_array(definition,$before0$mushavo_file_ingest.ordinary_upload_has_reference(plan.bucket,plan.target_path)$before0$)) <> 2 THEN RAISE EXCEPTION 'FR33_SUBSCRIPTION_HANDOFF_ANCHOR_CHANGED'; END IF;
  definition := replace(definition,$before0$mushavo_file_ingest.ordinary_upload_has_reference(plan.bucket,plan.target_path)$before0$,$after0$mushavo_account_deletion.handoff_path_has_reference(plan.bucket,plan.target_path)$after0$);
  IF cardinality(string_to_array(definition,$before1$mushavo_file_ingest.ordinary_upload_has_reference(plan.bucket,plan.source_path)$before1$)) <> 2 THEN RAISE EXCEPTION 'FR33_SUBSCRIPTION_HANDOFF_ANCHOR_CHANGED'; END IF;
  definition := replace(definition,$before1$mushavo_file_ingest.ordinary_upload_has_reference(plan.bucket,plan.source_path)$before1$,$after1$mushavo_account_deletion.handoff_path_has_reference(plan.bucket,plan.source_path)$after1$);
  IF cardinality(string_to_array(definition,$before2$    INSERT INTO mushavo_file_ingest.ordinary_uploads
      (bucket_id,path,workspace_id,attachment_id,parent_type,parent_id,actor_id,mime_type,byte_count,state,expires_at)
    VALUES (plan.bucket,plan.target_path,plan.workspace_id,
      plan.record_id,
      plan.parent_type,CASE WHEN plan.bucket = 'business-documents' THEN plan.parent_id END,
      plan.subject_id,plan.mime_type,plan.byte_count,'linked',clock_timestamp());
$before2$)) <> 2 THEN RAISE EXCEPTION 'FR33_SUBSCRIPTION_HANDOFF_ANCHOR_CHANGED'; END IF;
  definition := replace(definition,$before2$    INSERT INTO mushavo_file_ingest.ordinary_uploads
      (bucket_id,path,workspace_id,attachment_id,parent_type,parent_id,actor_id,mime_type,byte_count,state,expires_at)
    VALUES (plan.bucket,plan.target_path,plan.workspace_id,
      plan.record_id,
      plan.parent_type,CASE WHEN plan.bucket = 'business-documents' THEN plan.parent_id END,
      plan.subject_id,plan.mime_type,plan.byte_count,'linked',clock_timestamp());
$before2$,$after2$    IF plan.bucket <> 'subscription-proofs' THEN
      INSERT INTO mushavo_file_ingest.ordinary_uploads
        (bucket_id,path,workspace_id,attachment_id,parent_type,parent_id,actor_id,mime_type,byte_count,state,expires_at)
      VALUES (plan.bucket,plan.target_path,plan.workspace_id,
        plan.record_id,
        plan.parent_type,CASE WHEN plan.bucket = 'business-documents' THEN plan.parent_id END,
        plan.subject_id,plan.mime_type,plan.byte_count,'linked',clock_timestamp());
    END IF;
$after2$);
  IF cardinality(string_to_array(definition,$before3$    ELSE
      UPDATE public.business_documents SET storage_path$before3$)) <> 2 THEN RAISE EXCEPTION 'FR33_SUBSCRIPTION_HANDOFF_ANCHOR_CHANGED'; END IF;
  definition := replace(definition,$before3$    ELSE
      UPDATE public.business_documents SET storage_path$before3$,$after3$    ELSIF plan.bucket = 'subscription-proofs' THEN
      UPDATE public.subscription_payment_proofs SET storage_path = plan.target_path WHERE id = plan.record_id AND payment_id = plan.parent_id;
    ELSE
      UPDATE public.business_documents SET storage_path$after3$);
  EXECUTE definition;
END;
$migration$;

DO $migration$
DECLARE definition text := pg_get_functiondef('mushavo_account_deletion.archive_owned_workspace_billing(uuid,uuid[])'::regprocedure);
BEGIN
  IF cardinality(string_to_array(definition,$before0$IF NOT FOUND OR proof.size_bytes NOT BETWEEN 1 AND 2097152
      OR proof.storage_path !~ '^workspaces/[a-f0-9-]{36}/[a-f0-9-]{36}/([a-z0-9-]+/){1,2}[a-f0-9-]{36}[.](pdf|png)$'
$before0$)) <> 2 THEN RAISE EXCEPTION 'FR33_SUBSCRIPTION_HANDOFF_ANCHOR_CHANGED'; END IF;
  definition := replace(definition,$before0$IF NOT FOUND OR proof.size_bytes NOT BETWEEN 1 AND 2097152
      OR proof.storage_path !~ '^workspaces/[a-f0-9-]{36}/[a-f0-9-]{36}/([a-z0-9-]+/){1,2}[a-f0-9-]{36}[.](pdf|png)$'
$before0$,$after0$IF NOT FOUND OR NOT mushavo_account_deletion.subscription_proof_shape(proof.storage_path,proof.mime_type,proof.size_bytes)
$after0$);
  IF cardinality(string_to_array(definition,$before1$      OR proof.mime_type IS DISTINCT FROM (CASE WHEN right(proof.storage_path,4) = '.pdf'
        THEN 'application/pdf' ELSE 'image/png' END)
$before1$)) <> 2 THEN RAISE EXCEPTION 'FR33_SUBSCRIPTION_HANDOFF_ANCHOR_CHANGED'; END IF;
  definition := replace(definition,$before1$      OR proof.mime_type IS DISTINCT FROM (CASE WHEN right(proof.storage_path,4) = '.pdf'
        THEN 'application/pdf' ELSE 'image/png' END)
$before1$,$after1$$after1$);
  EXECUTE definition;
END;
$migration$;

DO $migration$
DECLARE definition text := pg_get_functiondef('mushavo_account_deletion.retain_subject_billing(uuid)'::regprocedure);
BEGIN
  IF cardinality(string_to_array(definition,$before0$IF NOT FOUND OR proof_row.size_bytes NOT BETWEEN 1 AND 2097152
          OR proof_row.storage_path !~ '^workspaces/[a-f0-9-]{36}/[a-f0-9-]{36}/([a-z0-9-]+/){1,2}[a-f0-9-]{36}[.](pdf|png)$'
$before0$)) <> 2 THEN RAISE EXCEPTION 'FR33_SUBSCRIPTION_HANDOFF_ANCHOR_CHANGED'; END IF;
  definition := replace(definition,$before0$IF NOT FOUND OR proof_row.size_bytes NOT BETWEEN 1 AND 2097152
          OR proof_row.storage_path !~ '^workspaces/[a-f0-9-]{36}/[a-f0-9-]{36}/([a-z0-9-]+/){1,2}[a-f0-9-]{36}[.](pdf|png)$'
$before0$,$after0$IF NOT FOUND OR NOT mushavo_account_deletion.subscription_proof_shape(proof_row.storage_path,proof_row.mime_type,proof_row.size_bytes)
$after0$);
  IF cardinality(string_to_array(definition,$before1$          OR proof_row.mime_type IS DISTINCT FROM (CASE WHEN right(proof_row.storage_path,4) = '.pdf'
            THEN 'application/pdf' ELSE 'image/png' END)
$before1$)) <> 2 THEN RAISE EXCEPTION 'FR33_SUBSCRIPTION_HANDOFF_ANCHOR_CHANGED'; END IF;
  definition := replace(definition,$before1$          OR proof_row.mime_type IS DISTINCT FROM (CASE WHEN right(proof_row.storage_path,4) = '.pdf'
            THEN 'application/pdf' ELSE 'image/png' END)
$before1$,$after1$$after1$);
  EXECUTE definition;
END;
$migration$;

CREATE TRIGGER a_fr33_proof_handoff_link BEFORE INSERT OR UPDATE OR DELETE ON public.subscription_payment_proofs
FOR EACH ROW EXECUTE FUNCTION mushavo_account_deletion.guard_proof_handoff_link();


-- Staging source 20261118122039 fr33_retry_billing_and_proof_holds.
ALTER TABLE mushavo_account_deletion.processor_attempts DROP CONSTRAINT processor_attempts_check,
  ADD CONSTRAINT processor_attempts_check CHECK (
    retry_at IS NULL OR (retry_at > attempted_at AND
      (review_code IS NULL OR review_code IN ('FR33_BILLING_IN_REVIEW','FR33_SURVIVING_BILLING_PROOF_HANDOFF_REQUIRED','FR33_BILLING_PROOF_RETENTION_UNVERIFIED')))
  );

-- Preserve open billing decisions and retry confirmed erasure after review or proof repair.
CREATE FUNCTION mushavo_account_deletion.has_unfinished_subject_billing(p_subject uuid,p_owned_workspaces uuid[])
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'pg_catalog' SET row_security TO 'off' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscription_renewal_requests renewal
    JOIN public.subscription_invoices invoice ON invoice.id=renewal.invoice_id AND invoice.workspace_id=renewal.workspace_id
    LEFT JOIN public.subscription_payments payment ON payment.renewal_request_id=renewal.id AND payment.workspace_id=renewal.workspace_id
    WHERE (renewal.status='pending_review' OR payment.status='pending_review')
      AND (renewal.workspace_id=ANY(p_owned_workspaces) OR renewal.requested_by=p_subject OR invoice.created_by=p_subject
        OR payment.submitted_by=p_subject OR EXISTS (
          SELECT 1 FROM public.subscription_payment_proofs proof WHERE proof.payment_id=payment.id AND proof.uploaded_by=p_subject
        ))
  );
$$;
REVOKE ALL ON FUNCTION mushavo_account_deletion.has_unfinished_subject_billing(uuid,uuid[]) FROM PUBLIC,anon,authenticated,service_role;

DO $migration$
DECLARE
  executor text := pg_get_functiondef('mushavo_account_deletion.execute_confirmed_request(uuid)'::regprocedure);
  processor text := pg_get_functiondef('mushavo_account_deletion.process_confirmed_requests()'::regprocedure);
  anchor text := '  IF mushavo_account_deletion.queue_shared_proof_handoffs(p_request_id,subject) THEN';
BEGIN
  IF cardinality(string_to_array(executor,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_BILLING_HOLD_EXECUTOR_ANCHOR_CHANGED'; END IF;
  EXECUTE replace(executor,anchor,
    E'  IF mushavo_account_deletion.has_unfinished_subject_billing(subject,workspace_ids) THEN\n' ||
    E'    RAISE EXCEPTION ''FR33_BILLING_IN_REVIEW'';\n  END IF;\n\n' || anchor);

  anchor := '    IF review_code IS NOT NULL THEN review := review+1; END IF;';
  IF cardinality(string_to_array(processor,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_BILLING_HOLD_PROCESSOR_ANCHOR_CHANGED'; END IF;
  EXECUTE replace(processor,anchor,anchor || E'\n' || $retry$
    IF review_code IN ('FR33_BILLING_IN_REVIEW','FR33_SURVIVING_BILLING_PROOF_HANDOFF_REQUIRED','FR33_BILLING_PROOF_RETENTION_UNVERIFIED') THEN
      retry_at := attempt_time+interval '1 day';
    END IF;$retry$);
END;
$migration$;

REVOKE ALL ON FUNCTION public.fr33_claim_shared_proof_handoff(),
  public.fr33_shared_proof_handoff_step(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
