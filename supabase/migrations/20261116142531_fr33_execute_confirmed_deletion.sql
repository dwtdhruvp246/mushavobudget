ALTER TABLE mushavo_account_deletion.requests ADD COLUMN completed_at timestamptz,
  ADD CONSTRAINT deletion_completion_consistent CHECK (
    completed_at IS NULL OR (subject_id IS NULL AND cancelled_at IS NULL
      AND workspace_impact_token IS NULL AND workspace_impact_confirmed_at IS NULL
      AND completed_at >= created_at)
  );

-- Only the erasure transaction can authorize payment deletion in its owned workspaces.
CREATE TABLE mushavo_account_deletion.owned_payment_delete_permits (
  transaction_id xid8 NOT NULL,
  workspace_id uuid NOT NULL,
  PRIMARY KEY (transaction_id, workspace_id)
);
ALTER TABLE mushavo_account_deletion.owned_payment_delete_permits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.owned_payment_delete_permits FROM PUBLIC, anon, authenticated, service_role;

DO $extend_finance_guard$
DECLARE
  definition text := replace(pg_get_functiondef('public.guard_workspace_finance_write()'::regprocedure), E'\r\n', E'\n');
  anchor text := E'  if public.my_account_suspended()';
BEGIN
  IF (length(definition) - length(replace(definition,anchor,''))) <> length(anchor) THEN
    RAISE EXCEPTION 'FR33_EXPECTED_FINANCE_DELETE_GUARD';
  END IF;
  EXECUTE replace(definition,anchor,
    E'  if tg_op = ''DELETE'' and tg_relid in (''public.payment_items''::regclass, ''public.payment_records''::regclass)\n'
    || E'    and exists (select 1 from mushavo_account_deletion.owned_payment_delete_permits permit\n'
    || E'      where permit.transaction_id = pg_current_xact_id_if_assigned() and permit.workspace_id = old.workspace_id) then\n'
    || E'    return old;\n  end if;\n' || anchor);
END;
$extend_finance_guard$;

-- Only reviewed ownership cascades may run. Unknown references are read for
-- detection, while every delete below names a specific root and owner.
CREATE FUNCTION mushavo_account_deletion.require_owned_workspace_cascades(p_root regclass, p_ids uuid[])
RETURNS void LANGUAGE plpgsql STABLE SET search_path TO pg_catalog SET row_security TO 'off'
AS $owned_refs$
DECLARE
  reference record;
  has_rows boolean;
  reviewed_columns text[];
BEGIN
  reviewed_columns := CASE p_root
    WHEN 'public.families'::regclass THEN ARRAY[
      'budget_workspaces.legacy_family_id','category_budgets.family_id','expenses.family_id',
      'family_invitations.family_id','family_members.family_id','notifications.family_id',
      'payment_items.family_id','payment_records.family_id'
    ]
    WHEN 'public.budget_workspaces'::regclass THEN ARRAY[
      'business_bill_schedules.workspace_id','business_categories.workspace_id','business_change_signals.workspace_id',
      'business_dimensions.workspace_id','business_documents.workspace_id','business_invitation_scopes.workspace_id',
      'business_member_permissions.workspace_id','business_member_scopes.workspace_id','business_profiles.workspace_id',
      'business_role_permissions.workspace_id','business_roles.workspace_id','business_setup_drafts.workspace_id',
      'business_suppliers.workspace_id','business_support_permits.workspace_id','business_team_operation_permits.workspace_id',
      'cashbook_accounts.workspace_id','cashbook_entries.workspace_id','notification_outbox.workspace_id',
      'payment_conversions.workspace_id','payment_items.workspace_id','payment_records.workspace_id',
      'subscription_entitlement_history.workspace_id','workspace_invitations.workspace_id',
      'workspace_members.workspace_id','workspace_settings.workspace_id','workspace_subscriptions.workspace_id'
    ]
  END;
  IF reviewed_columns IS NULL THEN RAISE EXCEPTION 'FR33_UNSUPPORTED_WORKSPACE_ROOT'; END IF;
  IF cardinality(p_ids) = 0 THEN RETURN; END IF;

  FOR reference IN
    SELECT n.nspname AS schema_name, child.relname AS relation_name, a.attname AS column_name,
      c.confdeltype AS delete_action, cardinality(c.conkey) = 1 AND cardinality(c.confkey) = 1
        AND root.attname = 'id' AND a.atttypid = 'uuid'::regtype AS supported
    FROM pg_constraint c JOIN pg_class child ON child.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = child.relnamespace
    LEFT JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    LEFT JOIN pg_attribute root ON root.attrelid = c.confrelid AND root.attnum = c.confkey[1]
    WHERE c.contype = 'f' AND c.conparentid = 0 AND c.confrelid = p_root
    ORDER BY n.nspname, child.relname, a.attname
  LOOP
    IF reference.supported IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'FR33_OWNED_WORKSPACE_REFERENCE_UNSUPPORTED';
    END IF;
    IF reference.schema_name = 'public' AND reference.delete_action = 'c'
      AND (reference.relation_name || '.' || reference.column_name) = ANY(reviewed_columns) THEN
      CONTINUE;
    END IF;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I = ANY($1))',
      reference.schema_name, reference.relation_name, reference.column_name) INTO has_rows USING p_ids;
    IF has_rows THEN
      RAISE EXCEPTION 'FR33_OWNED_WORKSPACE_DEPENDENCY_REVIEW_REQUIRED'
        USING DETAIL = format('%I.%I.%I',reference.schema_name,reference.relation_name,reference.column_name);
    END IF;
  END LOOP;
END;
$owned_refs$;

CREATE FUNCTION mushavo_account_deletion.execute_confirmed_request(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SET search_path TO pg_catalog SET row_security TO 'off'
AS $execute$
DECLARE
  request mushavo_account_deletion.requests%ROWTYPE;
  subject uuid;
  subject_email text;
  workspace_ids uuid[];
  family_ids uuid[];
  dependencies jsonb;
  completed timestamptz;
BEGIN
  SELECT * INTO request FROM mushavo_account_deletion.requests WHERE id = p_request_id;
  IF request.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object('status','completed','completed_at',request.completed_at);
  END IF;
  subject := request.subject_id;
  IF subject IS NULL THEN RAISE EXCEPTION 'FR33_CONFIRMED_REQUEST_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('fr33-account-deletion:' || subject::text, 0));
  SELECT * INTO STRICT request FROM mushavo_account_deletion.requests WHERE id = p_request_id FOR UPDATE;
  IF request.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object('status','completed','completed_at',request.completed_at);
  END IF;
  IF request.subject_id IS DISTINCT FROM subject OR request.cancelled_at IS NOT NULL
    OR request.workspace_impact_confirmed_at IS NULL THEN RAISE EXCEPTION 'FR33_CONFIRMED_REQUEST_REQUIRED'; END IF;
  SELECT account.email INTO subject_email FROM auth.users account WHERE id = subject FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FR33_DELETION_SUBJECT_MISSING'; END IF;
  IF EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = subject) THEN RAISE EXCEPTION 'FR33_STAFF_REVIEW_REQUIRED'; END IF;

  PERFORM id FROM public.families WHERE owner_id = subject ORDER BY id FOR UPDATE;
  SELECT ARRAY(SELECT id FROM public.families WHERE owner_id = subject ORDER BY id) INTO family_ids;
  PERFORM id FROM public.budget_workspaces WHERE owner_id = subject ORDER BY id FOR UPDATE;
  SELECT ARRAY(SELECT id FROM public.budget_workspaces WHERE owner_id = subject ORDER BY id) INTO workspace_ids;

  IF request.workspace_impact_token IS DISTINCT FROM
    mushavo_account_deletion.owned_workspace_impact(subject)->>'impact_token' THEN
    RAISE EXCEPTION 'FR33_WORKSPACE_IMPACT_CHANGED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.budget_workspaces workspace
    WHERE (workspace.legacy_family_id = ANY(family_ids) AND workspace.owner_id <> subject)
      OR (workspace.id = ANY(workspace_ids) AND (
        workspace.workspace_type NOT IN ('personal','family','household','business')
        OR (workspace.legacy_family_id IS NOT NULL AND NOT workspace.legacy_family_id = ANY(family_ids))
      ))
  ) OR EXISTS (SELECT 1 FROM public.family_heads head WHERE head.user_id = subject
      OR (subject_email IS NOT NULL AND lower(head.email) = lower(subject_email))) THEN
    RAISE EXCEPTION 'FR33_OWNED_WORKSPACE_SCOPE_REVIEW_REQUIRED';
  END IF;

  -- A legacy record attached to another workspace's item must never be erased by cascade.
  IF EXISTS (
    SELECT 1 FROM public.payment_records payment
    JOIN public.payment_items item ON item.id = payment.payment_item_id
    WHERE (payment.workspace_id = ANY(workspace_ids) OR payment.family_id = ANY(family_ids)
        OR item.workspace_id = ANY(workspace_ids) OR item.family_id = ANY(family_ids))
      AND (payment.workspace_id,payment.family_id) IS DISTINCT FROM (item.workspace_id,item.family_id)
  ) OR EXISTS (
    SELECT 1 FROM public.payment_records payment
    JOIN public.payment_conversions conversion ON conversion.payment_record_ref = payment.id
    WHERE (payment.workspace_id = ANY(workspace_ids) OR payment.family_id = ANY(family_ids))
      AND conversion.workspace_id IS DISTINCT FROM payment.workspace_id
  ) THEN RAISE EXCEPTION 'FR33_PAYMENT_WORKSPACE_SCOPE_REVIEW_REQUIRED'; END IF;

  IF EXISTS (SELECT 1 FROM public.payment_records WHERE proof_path IS NOT NULL
      AND (workspace_id = ANY(workspace_ids) OR family_id = ANY(family_ids)))
    OR EXISTS (SELECT 1 FROM public.business_documents WHERE workspace_id = ANY(workspace_ids))
    OR EXISTS (SELECT 1 FROM storage.objects object
      WHERE object.owner_id = subject::text OR object.owner = subject
        OR (object.bucket_id = 'payment-proofs' AND (
          (split_part(object.name,'/',1) = 'personal' AND split_part(object.name,'/',2) = subject::text)
          OR (split_part(object.name,'/',1) = 'families' AND split_part(object.name,'/',2) = ANY(family_ids::text[]))
        )) OR (object.bucket_id IN ('business-documents','business-logos','subscription-proofs')
          AND split_part(object.name,'/',1) = 'workspaces' AND split_part(object.name,'/',2) = ANY(workspace_ids::text[])))
    OR EXISTS (SELECT 1 FROM mushavo_file_ingest.ordinary_uploads WHERE workspace_id = ANY(workspace_ids) OR actor_id = subject)
    OR EXISTS (SELECT 1 FROM mushavo_file_ingest.subscription_uploads WHERE workspace_id = ANY(workspace_ids) OR uploader_id = subject)
    OR EXISTS (SELECT 1 FROM mushavo_file_ingest.business_uploads WHERE workspace_id = ANY(workspace_ids) OR uploader_id = subject)
  THEN RAISE EXCEPTION 'FR33_STORAGE_HANDOFF_REQUIRED'; END IF;

  PERFORM mushavo_account_deletion.require_owned_workspace_cascades('public.families'::regclass,family_ids);
  PERFORM mushavo_account_deletion.require_owned_workspace_cascades('public.budget_workspaces'::regclass,workspace_ids);
  PERFORM mushavo_account_deletion.detach_retained_family_memberships(p_request_id);
  IF EXISTS (SELECT 1 FROM public.business_bill_payments WHERE recorded_by = subject)
    OR EXISTS (SELECT 1 FROM public.business_documents WHERE uploaded_by = subject AND parent_type = 'business_bill_payment')
  THEN PERFORM mushavo_account_deletion.detach_retained_business_bill_recorders(p_request_id); END IF;

  DELETE FROM public.workspace_members member USING public.budget_workspaces workspace
  WHERE member.workspace_id = workspace.id AND workspace.workspace_type = 'business'
    AND workspace.owner_id <> subject AND member.user_id = subject AND member.role <> 'business_owner';

  INSERT INTO mushavo_account_deletion.owned_payment_delete_permits
    SELECT pg_current_xact_id(), unnest(workspace_ids);
  DELETE FROM public.families WHERE id = ANY(family_ids) AND owner_id = subject;
  DELETE FROM public.budget_workspaces WHERE id = ANY(workspace_ids) AND owner_id = subject;
  DELETE FROM mushavo_account_deletion.owned_payment_delete_permits WHERE transaction_id = pg_current_xact_id();

  dependencies := mushavo_account_deletion.review_dependencies(p_request_id);
  IF dependencies->>'status' IS DISTINCT FROM 'REVIEW_ONLY' OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(dependencies->'direct_dependencies') dep
    WHERE (
      (dep->>'schema' = 'auth' AND dep->>'column' = 'user_id' AND dep->>'on_delete' = 'CASCADE'
       AND dep->>'relation' IN ('identities','mfa_factors','mfa_recovery_code_sets','oauth_authorizations',
         'oauth_consents','one_time_tokens','sessions','webauthn_challenges','webauthn_credentials'))
      OR (dep->>'schema' = 'public' AND dep->>'on_delete' = 'CASCADE'
        AND ((dep->>'relation') || '.' || (dep->>'column')) IN ('profiles.id','notifications.user_id',
          'notification_outbox.user_id','push_subscriptions.user_id','push_test_rate_limits.user_id'))
      OR (dep->>'schema' = 'mushavo_email_auth' AND dep->>'relation' = 'account_state'
        AND dep->>'column' = 'user_id' AND dep->>'on_delete' = 'CASCADE')
      OR (dep->>'schema' = 'mushavo_file_ingest' AND dep->>'relation' = 'private_download_usage'
        AND dep->>'column' = 'user_id' AND dep->>'on_delete' = 'CASCADE')
      OR (dep->>'schema' = 'mushavo_account_deletion' AND dep->>'relation' = 'requests'
        AND dep->>'column' = 'subject_id' AND dep->>'on_delete' = 'SET NULL')
      OR (dep->>'schema' = 'public' AND dep->>'relation' = 'workspace_members'
        AND dep->>'column' = 'invited_by' AND dep->>'on_delete' = 'SET NULL')
    ) IS DISTINCT FROM true
  ) THEN RAISE EXCEPTION 'FR33_ACCOUNT_DEPENDENCY_REVIEW_REQUIRED'; END IF;

  UPDATE mushavo_account_deletion.requests
    SET workspace_impact_token = NULL, workspace_impact_confirmed_at = NULL
    WHERE subject_id = subject AND id <> p_request_id;
  DELETE FROM auth.users WHERE id = subject;
  IF NOT FOUND THEN RAISE EXCEPTION 'FR33_DELETION_SUBJECT_MISSING'; END IF;
  IF EXISTS (SELECT 1 FROM auth.sessions WHERE user_id = subject)
    OR EXISTS (SELECT 1 FROM auth.refresh_tokens WHERE user_id = subject::text)
  THEN RAISE EXCEPTION 'FR33_AUTH_SESSION_CLEANUP_REQUIRED'; END IF;

  UPDATE mushavo_account_deletion.requests
  SET completed_at = clock_timestamp(), workspace_impact_token = NULL, workspace_impact_confirmed_at = NULL
  WHERE id = p_request_id AND subject_id IS NULL AND cancelled_at IS NULL
  RETURNING completed_at INTO completed;
  IF NOT FOUND THEN RAISE EXCEPTION 'FR33_COMPLETION_RECEIPT_REQUIRED'; END IF;
  RETURN jsonb_build_object('status','completed','completed_at',completed);
END;
$execute$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.require_owned_workspace_cascades(regclass,uuid[]),
  mushavo_account_deletion.execute_confirmed_request(uuid) FROM PUBLIC, anon, authenticated, service_role;
