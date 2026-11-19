CREATE TABLE mushavo_account_deletion.retained_billing_records (
  record_type text NOT NULL CHECK (record_type IN (
    'invoice', 'renewal', 'payment', 'proof', 'review', 'quote', 'purchase',
    'grant', 'subscription', 'entitlement', 'audit', 'conversion'
  )),
  record_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  record jsonb NOT NULL,
  PRIMARY KEY (record_type, record_id)
);
CREATE INDEX retained_billing_workspace_idx
  ON mushavo_account_deletion.retained_billing_records (workspace_id);

CREATE TABLE mushavo_account_deletion.retained_subscription_proofs (
  path text PRIMARY KEY,
  proof_id uuid NOT NULL UNIQUE,
  workspace_id uuid NOT NULL,
  storage_object_id uuid NOT NULL UNIQUE,
  storage_object_version text NOT NULL,
  upload_record jsonb
);

ALTER TABLE mushavo_account_deletion.retained_billing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE mushavo_account_deletion.retained_subscription_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.retained_billing_records,
  mushavo_account_deletion.retained_subscription_proofs FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION mushavo_account_deletion.is_retained_subscription_proof(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (SELECT 1 FROM mushavo_account_deletion.retained_subscription_proofs proof WHERE proof.path = p_path);
$$;
REVOKE ALL ON FUNCTION mushavo_account_deletion.is_retained_subscription_proof(text) FROM PUBLIC, service_role;
GRANT EXECUTE ON FUNCTION mushavo_account_deletion.is_retained_subscription_proof(text) TO anon, authenticated;

CREATE POLICY fr33_retained_subscription_read ON storage.objects AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (bucket_id <> 'subscription-proofs' OR NOT mushavo_account_deletion.is_retained_subscription_proof(name));
CREATE POLICY fr33_retained_subscription_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (bucket_id <> 'subscription-proofs' OR NOT mushavo_account_deletion.is_retained_subscription_proof(name))
  WITH CHECK (bucket_id <> 'subscription-proofs' OR NOT mushavo_account_deletion.is_retained_subscription_proof(name));
CREATE POLICY fr33_retained_subscription_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (bucket_id <> 'subscription-proofs' OR NOT mushavo_account_deletion.is_retained_subscription_proof(name));
CREATE POLICY fr33_retained_subscription_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id <> 'subscription-proofs' OR NOT mushavo_account_deletion.is_retained_subscription_proof(name));

CREATE FUNCTION mushavo_account_deletion.archive_owned_workspace_billing(p_request_id uuid,p_workspace_ids uuid[])
RETURNS void LANGUAGE plpgsql
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
DECLARE
  deleting_account uuid;
  payment_ids uuid[];
  renewal_ids uuid[];
  proof record;
  object_row storage.objects%ROWTYPE;
  upload_row mushavo_file_ingest.subscription_uploads%ROWTYPE;
BEGIN
  IF cardinality(p_workspace_ids) = 0 THEN RETURN; END IF;
  SELECT request.subject_id INTO STRICT deleting_account
  FROM mushavo_account_deletion.requests request
  WHERE request.id = p_request_id AND request.subject_id IS NOT NULL
    AND request.cancelled_at IS NULL AND request.workspace_impact_confirmed_at IS NOT NULL;
  IF EXISTS (
    SELECT 1 FROM unnest(p_workspace_ids) requested(id)
    LEFT JOIN public.budget_workspaces workspace ON workspace.id = requested.id
    WHERE workspace.owner_id IS DISTINCT FROM deleting_account
  ) THEN RAISE EXCEPTION 'FR33_BILLING_WORKSPACE_SCOPE_CHANGED'; END IF;

  -- Children cannot enter the archive scope while their billing parents are locked.
  PERFORM invoice.id FROM public.subscription_invoices invoice
  WHERE invoice.workspace_id = ANY(p_workspace_ids) ORDER BY invoice.id FOR UPDATE;
  SELECT ARRAY(SELECT renewal.id FROM public.subscription_renewal_requests renewal
    WHERE renewal.workspace_id = ANY(p_workspace_ids) ORDER BY renewal.id FOR UPDATE) INTO renewal_ids;
  SELECT ARRAY(SELECT payment.id FROM public.subscription_payments payment
    WHERE payment.workspace_id = ANY(p_workspace_ids) ORDER BY payment.id FOR UPDATE) INTO payment_ids;
  PERFORM quote.id FROM public.business_subscription_quotes quote
  WHERE quote.workspace_id = ANY(p_workspace_ids) ORDER BY quote.id FOR UPDATE;
  PERFORM subscription.id FROM public.workspace_subscriptions subscription
  WHERE subscription.workspace_id = ANY(p_workspace_ids) ORDER BY subscription.id FOR UPDATE;
  PERFORM review.id FROM public.subscription_payment_reviews review
  WHERE review.payment_id = ANY(payment_ids) ORDER BY review.id FOR UPDATE;
  PERFORM purchase.request_id FROM public.business_public_purchases purchase
  WHERE purchase.source_workspace_id = ANY(p_workspace_ids) ORDER BY purchase.request_id FOR UPDATE;
  PERFORM grant_record.id FROM public.admin_subscription_grants grant_record
  WHERE grant_record.workspace_id = ANY(p_workspace_ids) ORDER BY grant_record.id FOR UPDATE;
  PERFORM history.id FROM public.subscription_entitlement_history history
  WHERE history.workspace_id = ANY(p_workspace_ids) ORDER BY history.id FOR UPDATE;
  PERFORM event.id FROM public.subscription_audit_events event
  WHERE event.workspace_id = ANY(p_workspace_ids) ORDER BY event.id FOR UPDATE;
  PERFORM conversion.id FROM public.payment_conversions conversion
  WHERE conversion.entity_type = 'subscription_payment' AND conversion.entity_id = ANY(payment_ids)
  ORDER BY conversion.id FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.subscription_payments payment
    JOIN public.subscription_renewal_requests renewal ON renewal.id = payment.renewal_request_id
    WHERE (payment.id = ANY(payment_ids) OR renewal.id = ANY(renewal_ids))
      AND payment.workspace_id <> renewal.workspace_id
  ) OR EXISTS (
    SELECT 1 FROM public.subscription_renewal_requests renewal
    JOIN public.subscription_invoices invoice ON invoice.id = renewal.invoice_id
    WHERE (renewal.id = ANY(renewal_ids) OR invoice.workspace_id = ANY(p_workspace_ids))
      AND (renewal.workspace_id <> invoice.workspace_id OR (renewal.provisioned_workspace_id IS NOT NULL
        AND NOT renewal.provisioned_workspace_id = ANY(p_workspace_ids)))
  ) OR EXISTS (
    SELECT 1 FROM public.business_subscription_quotes quote
    JOIN public.subscription_payments payment ON payment.id = quote.payment_id
    WHERE (quote.workspace_id = ANY(p_workspace_ids) OR payment.id = ANY(payment_ids))
      AND quote.workspace_id <> payment.workspace_id
  ) OR EXISTS (
    SELECT 1 FROM public.business_public_purchases purchase
    WHERE (purchase.source_workspace_id = ANY(p_workspace_ids) OR purchase.provisioned_workspace_id = ANY(p_workspace_ids)
        OR purchase.payment_id = ANY(payment_ids) OR purchase.request_id = ANY(renewal_ids))
      AND NOT (purchase.owner_id = deleting_account AND purchase.source_workspace_id = ANY(p_workspace_ids)
        AND (purchase.provisioned_workspace_id IS NULL OR purchase.provisioned_workspace_id = ANY(p_workspace_ids))
        AND EXISTS (SELECT 1 FROM public.subscription_payments payment
          WHERE payment.id = purchase.payment_id AND payment.workspace_id = purchase.source_workspace_id
            AND payment.renewal_request_id = purchase.request_id))
  ) OR EXISTS (
    SELECT 1 FROM public.subscription_entitlement_history history
    JOIN public.workspace_subscriptions subscription ON subscription.id = history.subscription_id
    WHERE (history.workspace_id = ANY(p_workspace_ids) OR subscription.workspace_id = ANY(p_workspace_ids))
      AND history.workspace_id <> subscription.workspace_id
  ) OR EXISTS (
    SELECT 1 FROM public.payment_conversions conversion
    WHERE conversion.entity_type = 'subscription_payment' AND (
      (conversion.entity_id = ANY(payment_ids) AND (conversion.payment_record_ref IS NOT NULL OR
        (conversion.workspace_id IS NOT NULL AND NOT conversion.workspace_id = ANY(p_workspace_ids))))
      OR (conversion.workspace_id = ANY(p_workspace_ids) AND NOT conversion.entity_id = ANY(payment_ids))
    )
  ) THEN RAISE EXCEPTION 'FR33_BILLING_WORKSPACE_SCOPE_CHANGED'; END IF;

  -- A new FK can introduce a cascade beyond the billing tables archived here.
  IF EXISTS (
    SELECT 1 FROM pg_constraint fk
    WHERE fk.contype = 'f' AND fk.conparentid = 0 AND fk.confrelid IN (
      'public.subscription_invoices'::regclass, 'public.subscription_renewal_requests'::regclass,
      'public.subscription_payments'::regclass, 'public.subscription_payment_proofs'::regclass,
      'public.subscription_payment_reviews'::regclass, 'public.admin_subscription_grants'::regclass,
      'public.business_subscription_quotes'::regclass, 'public.business_public_purchases'::regclass,
      'public.subscription_audit_events'::regclass, 'public.subscription_entitlement_history'::regclass,
      'public.workspace_subscriptions'::regclass, 'public.payment_conversions'::regclass
    ) AND NOT EXISTS (
      SELECT 1 FROM (VALUES
        ('public.subscription_renewal_requests'::regclass,'public.subscription_invoices'::regclass,'invoice_id','id'),
        ('public.subscription_renewal_requests'::regclass,'public.business_subscription_quotes'::regclass,'workspace_id,business_quote_id','workspace_id,id'),
        ('public.subscription_payments'::regclass,'public.subscription_renewal_requests'::regclass,'renewal_request_id','id'),
        ('public.subscription_payment_proofs'::regclass,'public.subscription_payments'::regclass,'payment_id','id'),
        ('public.subscription_payment_reviews'::regclass,'public.subscription_payments'::regclass,'payment_id','id'),
        ('public.business_subscription_quotes'::regclass,'public.subscription_payments'::regclass,'payment_id','id'),
        ('public.business_public_purchases'::regclass,'public.subscription_payments'::regclass,'payment_id','id'),
        ('public.business_public_purchases'::regclass,'public.subscription_renewal_requests'::regclass,'request_id','id'),
        ('public.subscription_entitlement_history'::regclass,'public.workspace_subscriptions'::regclass,'subscription_id','id')
      ) known(child,parent,columns,parent_columns)
      WHERE known.child=fk.conrelid AND known.parent=fk.confrelid AND known.columns=(
        SELECT string_agg(attribute.attname,',' ORDER BY key.position)
        FROM unnest(fk.conkey) WITH ORDINALITY AS key(number,position)
        JOIN pg_attribute attribute ON attribute.attrelid=fk.conrelid AND attribute.attnum=key.number
      ) AND known.parent_columns=(
        SELECT string_agg(attribute.attname,',' ORDER BY key.position)
        FROM unnest(fk.confkey) WITH ORDINALITY AS key(number,position)
        JOIN pg_attribute attribute ON attribute.attrelid=fk.confrelid AND attribute.attnum=key.number
      )
    )
  ) THEN RAISE EXCEPTION 'FR33_BILLING_DEPENDENCY_REVIEW_REQUIRED'; END IF;

  FOR proof IN
    SELECT link.*,payment.workspace_id
    FROM public.subscription_payment_proofs link
    JOIN public.subscription_payments payment ON payment.id = link.payment_id
    WHERE payment.id = ANY(payment_ids) ORDER BY link.storage_path,link.id FOR UPDATE OF link
  LOOP
    SELECT object.* INTO object_row
    FROM storage.objects object JOIN storage.buckets bucket ON bucket.id = object.bucket_id
    WHERE object.bucket_id = 'subscription-proofs' AND object.name = proof.storage_path
      AND bucket.public IS FALSE AND bucket.versioning_status = 'DISABLED' AND bucket.lifecycle_configuration IS NULL
      AND object.owner_id IS NULL AND object.owner IS NULL AND object.version IS NOT NULL
      AND object.metadata->>'mimetype' = proof.mime_type
      AND coalesce(object.metadata->>'size',object.metadata->>'contentLength') = proof.size_bytes::text
    FOR SHARE OF object,bucket;
    IF NOT FOUND OR proof.size_bytes NOT BETWEEN 1 AND 2097152
      OR proof.storage_path !~ '^workspaces/[a-f0-9-]{36}/[a-f0-9-]{36}/([a-z0-9-]+/){1,2}[a-f0-9-]{36}[.](pdf|png)$'
      OR split_part(proof.storage_path,'/',2) <> proof.workspace_id::text
      OR split_part(proof.storage_path,'/',3) <> proof.uploaded_by::text
      OR proof.mime_type IS DISTINCT FROM (CASE WHEN right(proof.storage_path,4) = '.pdf'
        THEN 'application/pdf' ELSE 'image/png' END)
      OR EXISTS (SELECT 1 FROM public.subscription_payment_proofs other
        WHERE other.storage_path = proof.storage_path AND other.id <> proof.id)
    THEN RAISE EXCEPTION 'FR33_BILLING_PROOF_RETENTION_UNVERIFIED'; END IF;

    SELECT * INTO upload_row FROM mushavo_file_ingest.subscription_uploads upload
    WHERE upload.path = proof.storage_path FOR UPDATE;
    IF FOUND AND (upload_row.state <> 'linked' OR upload_row.cleanup_token IS NOT NULL
      OR upload_row.lease_until IS NOT NULL OR upload_row.workspace_id <> proof.workspace_id
      OR upload_row.uploader_id <> proof.uploaded_by OR upload_row.mime_type <> proof.mime_type
      OR upload_row.byte_count <> proof.size_bytes)
    THEN RAISE EXCEPTION 'FR33_BILLING_PROOF_RETENTION_UNVERIFIED'; END IF;

    INSERT INTO mushavo_account_deletion.retained_subscription_proofs
      (path,proof_id,workspace_id,storage_object_id,storage_object_version,upload_record)
    VALUES (proof.storage_path,proof.id,proof.workspace_id,object_row.id,object_row.version,
      CASE WHEN upload_row.path IS NOT NULL THEN to_jsonb(upload_row) END);
  END LOOP;

  INSERT INTO mushavo_account_deletion.retained_billing_records (record_type,record_id,workspace_id,record)
  SELECT 'invoice',i.id,i.workspace_id,to_jsonb(i) FROM public.subscription_invoices i WHERE i.workspace_id = ANY(p_workspace_ids)
  UNION ALL SELECT 'renewal',r.id,r.workspace_id,to_jsonb(r) FROM public.subscription_renewal_requests r WHERE r.id = ANY(renewal_ids)
  UNION ALL SELECT 'payment',p.id,p.workspace_id,to_jsonb(p) FROM public.subscription_payments p WHERE p.id = ANY(payment_ids)
  UNION ALL SELECT 'proof',f.id,p.workspace_id,to_jsonb(f) FROM public.subscription_payment_proofs f
    JOIN public.subscription_payments p ON p.id=f.payment_id WHERE p.id = ANY(payment_ids)
  UNION ALL SELECT 'review',r.id,p.workspace_id,to_jsonb(r) FROM public.subscription_payment_reviews r
    JOIN public.subscription_payments p ON p.id=r.payment_id WHERE p.id = ANY(payment_ids)
  UNION ALL SELECT 'quote',q.id,q.workspace_id,to_jsonb(q) FROM public.business_subscription_quotes q WHERE q.workspace_id = ANY(p_workspace_ids)
  UNION ALL SELECT 'purchase',p.request_id,p.source_workspace_id,to_jsonb(p) FROM public.business_public_purchases p WHERE p.source_workspace_id = ANY(p_workspace_ids)
  UNION ALL SELECT 'grant',g.id,g.workspace_id,to_jsonb(g) FROM public.admin_subscription_grants g WHERE g.workspace_id = ANY(p_workspace_ids)
  UNION ALL SELECT 'subscription',s.id,s.workspace_id,to_jsonb(s) FROM public.workspace_subscriptions s WHERE s.workspace_id = ANY(p_workspace_ids)
  UNION ALL SELECT 'entitlement',h.id,h.workspace_id,to_jsonb(h) FROM public.subscription_entitlement_history h WHERE h.workspace_id = ANY(p_workspace_ids)
  UNION ALL SELECT 'audit',a.id,a.workspace_id,to_jsonb(a) FROM public.subscription_audit_events a WHERE a.workspace_id = ANY(p_workspace_ids)
  UNION ALL SELECT 'conversion',c.id,p.workspace_id,to_jsonb(c) FROM public.payment_conversions c
    JOIN public.subscription_payments p ON p.id=c.entity_id
    WHERE c.entity_type = 'subscription_payment' AND p.id = ANY(payment_ids);

  DELETE FROM mushavo_file_ingest.subscription_uploads upload
  USING mushavo_account_deletion.retained_subscription_proofs retained
  WHERE retained.path = upload.path AND retained.workspace_id = ANY(p_workspace_ids);
  DELETE FROM mushavo_file_ingest.subscription_uploads upload
  WHERE upload.workspace_id = ANY(p_workspace_ids) AND upload.state = 'removed'
    AND upload.cleanup_token IS NULL AND upload.lease_until IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.subscription_payment_proofs live_proof WHERE live_proof.storage_path = upload.path)
    AND NOT EXISTS (SELECT 1 FROM storage.objects object WHERE object.bucket_id = 'subscription-proofs' AND object.name = upload.path);

  DELETE FROM public.business_public_purchases WHERE source_workspace_id = ANY(p_workspace_ids);
  DELETE FROM public.subscription_payment_reviews WHERE payment_id = ANY(payment_ids);
  DELETE FROM public.subscription_payment_proofs WHERE payment_id = ANY(payment_ids);
  DELETE FROM public.payment_conversions WHERE entity_type = 'subscription_payment' AND entity_id = ANY(payment_ids);
  -- Unlink the original purchase cycle after preserving both sides of it.
  UPDATE public.business_subscription_quotes SET payment_id = NULL
  WHERE workspace_id = ANY(p_workspace_ids) AND payment_id IS NOT NULL;
  DELETE FROM public.subscription_payments WHERE id = ANY(payment_ids);
  DELETE FROM public.subscription_renewal_requests WHERE id = ANY(renewal_ids);
  DELETE FROM public.business_subscription_quotes WHERE workspace_id = ANY(p_workspace_ids);
  DELETE FROM public.subscription_invoices WHERE workspace_id = ANY(p_workspace_ids);
  DELETE FROM public.admin_subscription_grants WHERE workspace_id = ANY(p_workspace_ids);
  DELETE FROM public.subscription_audit_events WHERE workspace_id = ANY(p_workspace_ids);
  DELETE FROM public.subscription_entitlement_history WHERE workspace_id = ANY(p_workspace_ids);
END;
$$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.archive_owned_workspace_billing(uuid,uuid[])
  FROM PUBLIC, anon, authenticated, service_role;

DO $migration$
DECLARE
  executor text := pg_get_functiondef('mushavo_account_deletion.execute_confirmed_request(uuid)'::regprocedure);
  claim text := pg_get_functiondef('public.claim_managed_subscription_cleanup(uuid,bigint,integer)'::regprocedure);
  finish text := pg_get_functiondef('public.finish_managed_subscription_cleanup(text,uuid)'::regprocedure);
  anchor text;
BEGIN
  anchor := '  PERFORM mushavo_account_deletion.prepare_owned_legacy_bill_proof_cleanup(p_request_id, workspace_ids);';
  IF cardinality(string_to_array(executor,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_BILLING_EXECUTOR_ANCHOR_CHANGED'; END IF;
  executor := replace(executor,anchor,anchor ||
    E'\n  PERFORM mushavo_account_deletion.archive_owned_workspace_billing(p_request_id, workspace_ids);');

  anchor := 'AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.file_cleanup_targets target' || E'\n            ' ||
    'WHERE target.request_id = p_request_id AND target.bucket_id = object.bucket_id AND target.path = object.name)))';
  IF cardinality(string_to_array(executor,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_BILLING_STORAGE_ANCHOR_CHANGED'; END IF;
  executor := replace(executor,anchor,$next$AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.retained_subscription_proofs retained
            WHERE object.bucket_id = 'subscription-proofs' AND retained.path = object.name
              AND retained.workspace_id = ANY(workspace_ids) AND retained.storage_object_id = object.id
              AND retained.storage_object_version = object.version AND object.owner_id IS NULL AND object.owner IS NULL)
          AND NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.file_cleanup_targets target
            WHERE target.request_id = p_request_id AND target.bucket_id = object.bucket_id AND target.path = object.name)))$next$);

  anchor := 'and not exists(select 1 from public.subscription_payment_proofs pr where pr.storage_path=u.path)';
  IF cardinality(string_to_array(claim,anchor)) <> 2 OR cardinality(string_to_array(finish,anchor)) <> 2
  THEN RAISE EXCEPTION 'FR33_BILLING_CLEANUP_ANCHOR_CHANGED'; END IF;
  claim := replace(claim,anchor,anchor || E'\n      and not mushavo_account_deletion.is_retained_subscription_proof(u.path)');
  finish := replace(finish,anchor,anchor || E'\n      and not mushavo_account_deletion.is_retained_subscription_proof(u.path)');
  EXECUTE executor;
  EXECUTE claim;
  EXECUTE finish;
END;
$migration$;
