-- Production has no staging subscription fixture triggers. Preserve the
-- installed managed-upload guard and all existing production guards.
DO $fr33_production_guards$
BEGIN
  IF to_regprocedure('public.fr3_guard_subscription_proof()') IS NOT NULL
    OR to_regprocedure('public.fr32_subscription_flow_guard()') IS NOT NULL THEN
    RAISE EXCEPTION 'FR33_PRODUCTION_PROOF_GUARD_INVENTORY_CHANGED';
  END IF;
END;
$fr33_production_guards$;
SET LOCAL lock_timeout='3s';
-- Staging source 20261118075342 fr33_archive_deleted_customer_support.
CREATE TABLE mushavo_account_deletion.retained_support_records (
  record_type text NOT NULL CHECK (record_type IN ('ticket', 'message')),
  record_id uuid NOT NULL,
  ticket_id uuid NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  record jsonb NOT NULL,
  PRIMARY KEY (record_type, record_id)
);

CREATE INDEX retained_support_records_ticket_idx
  ON mushavo_account_deletion.retained_support_records (ticket_id);

ALTER TABLE mushavo_account_deletion.retained_support_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.retained_support_records
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION mushavo_account_deletion.archive_deleted_customer_support(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
DECLARE
  deleting_customer_id uuid;
  tickets uuid[];
  copied bigint;
  removed bigint;
BEGIN
  SELECT request.subject_id INTO STRICT deleting_customer_id
  FROM mushavo_account_deletion.requests request
  WHERE request.id = p_request_id AND request.subject_id IS NOT NULL
    AND request.cancelled_at IS NULL AND request.workspace_impact_confirmed_at IS NOT NULL;

  -- These locks also prevent a new message from attaching to a ticket being archived.
  SELECT ARRAY(
    SELECT ticket.id FROM public.support_tickets ticket
    WHERE ticket.customer_id = deleting_customer_id ORDER BY ticket.id FOR UPDATE
  ) INTO tickets;
  IF cardinality(tickets) = 0 THEN RETURN; END IF;

  -- Review any new ticket or message dependencies before allowing the cascade.
  IF EXISTS (
    SELECT 1 FROM pg_constraint fk
    WHERE fk.contype = 'f' AND fk.conparentid = 0
      AND fk.confrelid IN ('public.support_tickets'::regclass, 'public.support_ticket_messages'::regclass)
      AND (
        fk.confrelid = 'public.support_tickets'::regclass
        AND fk.conrelid = 'public.support_ticket_messages'::regclass
        AND fk.confdeltype = 'c'
        AND fk.conkey = ARRAY[(SELECT attnum FROM pg_attribute
          WHERE attrelid = fk.conrelid AND attname = 'ticket_id')]
        AND fk.confkey = ARRAY[(SELECT attnum FROM pg_attribute
          WHERE attrelid = fk.confrelid AND attname = 'id')]
      ) IS DISTINCT FROM true
  ) THEN RAISE EXCEPTION 'FR33_SUPPORT_HISTORY_DEPENDENCY_REVIEW_REQUIRED'; END IF;

  PERFORM message.id FROM public.support_ticket_messages message
  WHERE message.ticket_id = ANY(tickets) ORDER BY message.id FOR UPDATE;

  INSERT INTO mushavo_account_deletion.retained_support_records
    (record_type, record_id, ticket_id, record)
  SELECT 'ticket', ticket.id, ticket.id, to_jsonb(ticket)
  FROM public.support_tickets ticket WHERE ticket.id = ANY(tickets)
  UNION ALL
  SELECT 'message', message.id, message.ticket_id, to_jsonb(message)
  FROM public.support_ticket_messages message WHERE message.ticket_id = ANY(tickets);
  GET DIAGNOSTICS copied = ROW_COUNT;

  IF copied <> cardinality(tickets) + (
    SELECT count(*) FROM public.support_ticket_messages WHERE ticket_id = ANY(tickets)
  ) THEN RAISE EXCEPTION 'FR33_SUPPORT_HISTORY_ARCHIVE_INCOMPLETE'; END IF;

  DELETE FROM public.support_tickets WHERE id = ANY(tickets) AND customer_id = deleting_customer_id;
  GET DIAGNOSTICS removed = ROW_COUNT;
  IF removed <> cardinality(tickets) OR EXISTS (
    SELECT 1 FROM public.support_ticket_messages WHERE ticket_id = ANY(tickets)
  ) THEN RAISE EXCEPTION 'FR33_SUPPORT_HISTORY_ARCHIVE_INCOMPLETE'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.archive_deleted_customer_support(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

DO $migration$
DECLARE
  executor text := pg_get_functiondef('mushavo_account_deletion.execute_confirmed_request(uuid)'::regprocedure);
  anchor text := '  PERFORM mushavo_account_deletion.require_owned_workspace_cascades(''public.families''::regclass,family_ids);';
BEGIN
  IF cardinality(string_to_array(executor, anchor)) <> 2
  THEN RAISE EXCEPTION 'FR33_SUPPORT_ERASURE_ANCHOR_CHANGED'; END IF;
  EXECUTE replace(executor, anchor,
    '  PERFORM mushavo_account_deletion.archive_deleted_customer_support(p_request_id);' || E'\n' || anchor);
END;
$migration$;


-- Staging source 20261118093652 fr33_archive_owned_workspace_billing.
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


-- Staging source 20261118101447 fr33_retain_surviving_workspace_billing.
-- Retain historical platform billing in workspaces that are not closing.
CREATE TABLE mushavo_account_deletion.retained_billing_actors (
  relation_name text NOT NULL,
  record_id uuid NOT NULL,
  field_name text NOT NULL,
  workspace_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  detached_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  detach_transaction xid8,
  proof_upload jsonb,
  PRIMARY KEY (relation_name, record_id, field_name)
);
ALTER TABLE mushavo_account_deletion.retained_billing_actors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.retained_billing_actors FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION mushavo_account_deletion.is_billing_actor_detach(
  p_relation text, p_field text, p_old jsonb, p_new jsonb
)
RETURNS boolean LANGUAGE sql STABLE
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
  SELECT p_old->>p_field IS NOT NULL AND p_new->>p_field IS NULL
    AND p_old - p_field = p_new - p_field
    AND EXISTS (
      SELECT 1 FROM mushavo_account_deletion.retained_billing_actors actor
      WHERE actor.relation_name = p_relation AND actor.field_name = p_field
        AND actor.record_id = coalesce(p_old->>'id', p_old->>'request_id')::uuid
        AND actor.actor_id = (p_old->>p_field)::uuid
        AND actor.detach_transaction = pg_current_xact_id_if_assigned()
    );
$$;
REVOKE ALL ON FUNCTION mushavo_account_deletion.is_billing_actor_detach(text,text,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION mushavo_account_deletion.guard_billing_actor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
DECLARE
  actor_field text := TG_ARGV[0];
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF to_jsonb(NEW)->>actor_field IS NULL THEN RAISE not_null_violation USING COLUMN = actor_field; END IF;
  ELSIF to_jsonb(OLD)->>actor_field IS NULL OR to_jsonb(NEW)->>actor_field IS NULL THEN
    IF (to_jsonb(OLD)->>actor_field) IS DISTINCT FROM (to_jsonb(NEW)->>actor_field)
      AND NOT mushavo_account_deletion.is_billing_actor_detach(TG_TABLE_NAME,actor_field,to_jsonb(OLD),to_jsonb(NEW))
    THEN RAISE EXCEPTION 'FR33_BILLING_ACTOR_IMMUTABLE'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION mushavo_account_deletion.guard_billing_actor()
  FROM PUBLIC, anon, authenticated, service_role;

DO $migration$
DECLARE
  actor_field record;
  guard regprocedure;
  definition text;
  anchor text := E'\nbegin\n';
BEGIN
  FOR actor_field IN SELECT * FROM (VALUES
    ('subscription_invoices','created_by'),
    ('subscription_renewal_requests','requested_by'),
    ('subscription_payments','submitted_by'),
    ('subscription_payment_proofs','uploaded_by'),
    ('subscription_payment_reviews','reviewer_id'),
    ('business_subscription_quotes','owner_id'),
    ('business_public_purchases','owner_id'),
    ('admin_subscription_grants','owner_id'),
    ('admin_subscription_grants','granted_by')
  ) AS field(relation_name,column_name)
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', actor_field.relation_name,actor_field.column_name);
    EXECUTE format('CREATE TRIGGER a_fr33_billing_actor_%1$I BEFORE INSERT OR UPDATE OF %1$I ON public.%2$I
      FOR EACH ROW EXECUTE FUNCTION mushavo_account_deletion.guard_billing_actor(%1$L)',
      actor_field.column_name,actor_field.relation_name);
  END LOOP;

  FOREACH guard IN ARRAY ARRAY['mushavo_file_ingest.bind_managed_subscription_upload()'::regprocedure]
  LOOP
    definition := pg_get_functiondef(guard);
    IF cardinality(string_to_array(definition,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_BILLING_PROOF_GUARD_CHANGED'; END IF;
    EXECUTE replace(definition,anchor,anchor ||
      E'  IF TG_OP = ''UPDATE'' AND mushavo_account_deletion.is_billing_actor_detach(\n' ||
      E'    TG_TABLE_NAME,''uploaded_by'',to_jsonb(OLD),to_jsonb(NEW)) THEN RETURN NEW; END IF;\n');
  END LOOP;
END;
$migration$;

CREATE FUNCTION mushavo_account_deletion.retain_subject_billing(p_request_id uuid)
RETURNS void LANGUAGE plpgsql
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
DECLARE
  subject uuid;
  actor_field record;
  billing record;
  proof_row public.subscription_payment_proofs%ROWTYPE;
  upload_row mushavo_file_ingest.subscription_uploads%ROWTYPE;
  txn xid8 := pg_current_xact_id();
  scope_query text;
  updated_rows bigint;
BEGIN
  SELECT request.subject_id INTO STRICT subject
  FROM mushavo_account_deletion.requests request
  WHERE request.id = p_request_id AND request.subject_id IS NOT NULL
    AND request.cancelled_at IS NULL AND request.workspace_impact_confirmed_at IS NOT NULL
  FOR UPDATE;

  -- Each attribution is reviewed against its actual workspace and the billing state that uses it.
  -- A live request can still rely on the requesting or paying account for approval.
  FOR actor_field IN SELECT * FROM (VALUES
    ('subscription_invoices','id','created_by','entry.workspace_id','', $scope$entry.status IN ('paid','rejected','cancelled')
      AND NOT EXISTS (SELECT 1 FROM public.subscription_renewal_requests active
        WHERE active.invoice_id = entry.id AND (active.workspace_id <> entry.workspace_id OR active.status = 'pending_review'))$scope$),
    ('subscription_renewal_requests','id','requested_by','entry.workspace_id',
      'JOIN public.subscription_invoices invoice ON invoice.id = entry.invoice_id',
      $scope$invoice.workspace_id = entry.workspace_id AND entry.status IN ('approved','rejected','cancelled')
        AND (entry.provisioned_workspace_id IS NULL OR entry.provisioned_workspace_id = entry.workspace_id
          OR EXISTS (SELECT 1 FROM public.budget_workspaces provisioned
            WHERE provisioned.id = entry.provisioned_workspace_id AND provisioned.owner_id = workspace.owner_id))
        AND NOT EXISTS (SELECT 1 FROM public.subscription_payments active WHERE active.renewal_request_id = entry.id
          AND (active.workspace_id <> entry.workspace_id OR active.status = 'pending_review'))$scope$),
    ('subscription_payments','id','submitted_by','entry.workspace_id',
      'JOIN public.subscription_renewal_requests renewal ON renewal.id = entry.renewal_request_id',
      $scope$renewal.workspace_id = entry.workspace_id AND entry.status IN ('approved','rejected')
        AND renewal.status IN ('approved','rejected','cancelled')$scope$),
    ('subscription_payment_proofs','id','uploaded_by','payment.workspace_id',
      'JOIN public.subscription_payments payment ON payment.id = entry.payment_id
       JOIN public.subscription_renewal_requests renewal ON renewal.id = payment.renewal_request_id',
      $scope$renewal.workspace_id = payment.workspace_id AND payment.status IN ('approved','rejected')
        AND renewal.status IN ('approved','rejected','cancelled')$scope$),
    ('subscription_payment_reviews','id','reviewer_id','payment.workspace_id',
      'JOIN public.subscription_payments payment ON payment.id = entry.payment_id',
      $scope$payment.status IN ('approved','rejected')$scope$),
    ('business_subscription_quotes','id','owner_id','entry.workspace_id','',
      $scope$entry.status IN ('approved','rejected','cancelled') AND (entry.payment_id IS NULL OR EXISTS (
        SELECT 1 FROM public.subscription_payments payment WHERE payment.id = entry.payment_id
          AND payment.workspace_id = entry.workspace_id AND payment.status IN ('approved','rejected')))$scope$),
    ('business_public_purchases','request_id','owner_id','entry.source_workspace_id',
      'JOIN public.subscription_payments payment ON payment.id = entry.payment_id
       JOIN public.subscription_renewal_requests renewal ON renewal.id = entry.request_id',
      $scope$entry.status IN ('approved','rejected') AND payment.renewal_request_id = renewal.id
        AND payment.workspace_id = entry.source_workspace_id AND renewal.workspace_id = entry.source_workspace_id
        AND payment.status IN ('approved','rejected') AND renewal.status IN ('approved','rejected')
        AND (entry.provisioned_workspace_id IS NULL OR EXISTS (
          SELECT 1 FROM public.budget_workspaces provisioned WHERE provisioned.id = entry.provisioned_workspace_id
            AND provisioned.owner_id = workspace.owner_id))$scope$),
    ('admin_subscription_grants','id','owner_id','entry.workspace_id','','true'),
    ('admin_subscription_grants','id','granted_by','entry.workspace_id','','true')
  ) AS field(relation_name,id_field,column_name,workspace_field,parent_join,eligible)
  LOOP
    scope_query := format(
      'SELECT entry.%1$I AS id, workspace.id AS workspace_id, (%2$s) IS TRUE AS eligible
       FROM public.%3$I entry %4$s
       JOIN public.budget_workspaces workspace ON workspace.id = %5$s
       WHERE entry.%6$I = $1 AND workspace.owner_id <> $1
       ORDER BY entry.%1$I FOR UPDATE OF entry FOR SHARE OF workspace',
      actor_field.id_field,actor_field.eligible,actor_field.relation_name,
      actor_field.parent_join,actor_field.workspace_field,actor_field.column_name);
    FOR billing IN EXECUTE scope_query USING subject LOOP
      IF NOT billing.eligible THEN RAISE EXCEPTION 'FR33_SURVIVING_BILLING_REVIEW_REQUIRED'; END IF;
      upload_row := NULL;
      IF actor_field.relation_name = 'subscription_payment_proofs' THEN
        SELECT * INTO STRICT proof_row FROM public.subscription_payment_proofs WHERE id = billing.id;
        PERFORM object.id FROM storage.objects object JOIN storage.buckets bucket ON bucket.id = object.bucket_id
        WHERE object.bucket_id = 'subscription-proofs' AND object.name = proof_row.storage_path
          AND bucket.public IS FALSE AND object.owner_id IS NULL AND object.owner IS NULL AND object.version IS NOT NULL
          AND object.metadata->>'mimetype' = proof_row.mime_type
          AND coalesce(object.metadata->>'size',object.metadata->>'contentLength') = proof_row.size_bytes::text
        FOR SHARE OF object,bucket;
        IF NOT FOUND OR proof_row.size_bytes NOT BETWEEN 1 AND 2097152
          OR proof_row.storage_path !~ '^workspaces/[a-f0-9-]{36}/[a-f0-9-]{36}/([a-z0-9-]+/){1,2}[a-f0-9-]{36}[.](pdf|png)$'
          OR split_part(proof_row.storage_path,'/',2) <> billing.workspace_id::text
          OR split_part(proof_row.storage_path,'/',3) <> subject::text
          OR proof_row.mime_type IS DISTINCT FROM (CASE WHEN right(proof_row.storage_path,4) = '.pdf'
            THEN 'application/pdf' ELSE 'image/png' END)
          OR EXISTS (SELECT 1 FROM public.subscription_payment_proofs other
            WHERE other.storage_path = proof_row.storage_path AND other.id <> proof_row.id)
        THEN RAISE EXCEPTION 'FR33_SURVIVING_BILLING_PROOF_HANDOFF_REQUIRED'; END IF;

        SELECT * INTO upload_row FROM mushavo_file_ingest.subscription_uploads WHERE path = proof_row.storage_path FOR UPDATE;
        IF (NOT FOUND AND split_part(proof_row.storage_path,'/',4) = 'managed-proof-v1')
          OR (upload_row.path IS NOT NULL AND (upload_row.state <> 'linked' OR upload_row.cleanup_token IS NOT NULL
            OR upload_row.lease_until IS NOT NULL OR upload_row.workspace_id <> billing.workspace_id
            OR upload_row.uploader_id <> subject OR upload_row.mime_type <> proof_row.mime_type OR upload_row.byte_count <> proof_row.size_bytes))
        THEN RAISE EXCEPTION 'FR33_SURVIVING_BILLING_PROOF_HANDOFF_REQUIRED'; END IF;
      END IF;

      INSERT INTO mushavo_account_deletion.retained_billing_actors
        (relation_name,record_id,field_name,workspace_id,actor_id,detach_transaction,proof_upload)
      VALUES (actor_field.relation_name,billing.id,actor_field.column_name,billing.workspace_id,subject,txn,
        CASE WHEN upload_row.path IS NOT NULL THEN to_jsonb(upload_row) END);
      EXECUTE format('UPDATE public.%I SET %I = NULL WHERE %I = $1 AND %I = $2',
        actor_field.relation_name,actor_field.column_name,actor_field.id_field,actor_field.column_name)
        USING billing.id,subject;
      GET DIAGNOSTICS updated_rows = ROW_COUNT;
      IF updated_rows <> 1 THEN
        RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'FR33_SURVIVING_BILLING_SCOPE_CHANGED';
      END IF;
      IF upload_row.path IS NOT NULL THEN
        -- The still-linked proof protects the Storage object independently of the upload ledger.
        DELETE FROM mushavo_file_ingest.subscription_uploads WHERE path = upload_row.path AND uploader_id = subject;
      END IF;
    END LOOP;
  END LOOP;

  DELETE FROM mushavo_file_ingest.subscription_uploads discarded
  WHERE discarded.uploader_id = subject AND discarded.state = 'removed'
    AND discarded.cleanup_token IS NULL AND discarded.lease_until IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.subscription_payment_proofs proof WHERE proof.storage_path = discarded.path)
    AND NOT EXISTS (SELECT 1 FROM storage.objects object WHERE object.bucket_id = 'subscription-proofs' AND object.name = discarded.path);

  UPDATE mushavo_account_deletion.retained_billing_actors SET detach_transaction = NULL
  WHERE detach_transaction = txn;
END;
$$;
REVOKE ALL ON FUNCTION mushavo_account_deletion.retain_subject_billing(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

DO $migration$
DECLARE
  executor text := pg_get_functiondef('mushavo_account_deletion.execute_confirmed_request(uuid)'::regprocedure);
  archive text := pg_get_functiondef('mushavo_account_deletion.archive_owned_workspace_billing(uuid,uuid[])'::regprocedure);
  anchor text;
BEGIN
  anchor := '  PERFORM mushavo_account_deletion.archive_owned_workspace_billing(p_request_id, workspace_ids);';
  IF cardinality(string_to_array(executor,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_BILLING_EXECUTOR_ANCHOR_CHANGED'; END IF;
  executor := replace(executor,anchor,anchor || E'\n  PERFORM mushavo_account_deletion.retain_subject_billing(p_request_id);');
  anchor := '      OR (dep->>''schema'' = ''public'' AND dep->>''relation'' = ''workspace_members''';
  IF cardinality(string_to_array(executor,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_BILLING_DEPENDENCY_ANCHOR_CHANGED'; END IF;
  executor := replace(executor,anchor,
    E'      OR (dep->>''schema'' = ''public'' AND dep->>''on_delete'' = ''SET NULL''\n' ||
    E'        AND ((dep->>''relation'') || ''.'' || (dep->>''column'')) IN (''subscription_audit_events.actor_id'',\n' ||
    E'          ''subscription_entitlement_history.actor_id'',''subscription_renewal_requests.reviewed_by'',\n' ||
    E'          ''payment_conversions.entered_by''))\n' || anchor);
  EXECUTE executor;

  anchor := '    SELECT link.*,payment.workspace_id';
  IF cardinality(string_to_array(archive,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_BILLING_ARCHIVE_PROOF_ANCHOR_CHANGED'; END IF;
  archive := replace(archive,anchor,anchor ||
    ', coalesce(link.uploaded_by,actor.actor_id) AS original_uploader, actor.proof_upload AS original_upload');
  anchor := '    WHERE payment.id = ANY(payment_ids) ORDER BY link.storage_path,link.id FOR UPDATE OF link';
  IF cardinality(string_to_array(archive,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_BILLING_ARCHIVE_LOCK_ANCHOR_CHANGED'; END IF;
  archive := replace(archive,anchor,
    E'    LEFT JOIN mushavo_account_deletion.retained_billing_actors actor\n' ||
    E'      ON actor.relation_name = ''subscription_payment_proofs'' AND actor.field_name = ''uploaded_by''\n' ||
    E'      AND actor.record_id = link.id AND actor.workspace_id = payment.workspace_id\n' || anchor);
  anchor := 'split_part(proof.storage_path,''/'',3) <> proof.uploaded_by::text';
  IF cardinality(string_to_array(archive,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_BILLING_ARCHIVE_PATH_ANCHOR_CHANGED'; END IF;
  archive := replace(archive,anchor,'split_part(proof.storage_path,''/'',3) IS DISTINCT FROM proof.original_uploader::text');
  anchor := 'upload_row.uploader_id <> proof.uploaded_by';
  IF cardinality(string_to_array(archive,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_BILLING_ARCHIVE_UPLOADER_ANCHOR_CHANGED'; END IF;
  archive := replace(archive,anchor,'upload_row.uploader_id IS DISTINCT FROM proof.original_uploader');
  anchor := 'CASE WHEN upload_row.path IS NOT NULL THEN to_jsonb(upload_row) END);';
  IF cardinality(string_to_array(archive,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_BILLING_ARCHIVE_UPLOAD_ANCHOR_CHANGED'; END IF;
  archive := replace(archive,anchor,'CASE WHEN upload_row.path IS NOT NULL THEN to_jsonb(upload_row) ELSE proof.original_upload END);');
  EXECUTE archive;
END;
$migration$;

NOTIFY pgrst,'reload schema';
