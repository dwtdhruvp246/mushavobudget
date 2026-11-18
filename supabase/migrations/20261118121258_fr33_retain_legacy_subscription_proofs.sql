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
