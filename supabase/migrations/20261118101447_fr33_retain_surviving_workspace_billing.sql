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

  FOREACH guard IN ARRAY ARRAY['public.fr3_guard_subscription_proof()'::regprocedure,
    'public.fr32_subscription_flow_guard()'::regprocedure,
    'mushavo_file_ingest.bind_managed_subscription_upload()'::regprocedure]
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
