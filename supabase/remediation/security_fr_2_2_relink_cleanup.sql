-- Exact completed synthetic relink run only. Select STAGING dczlddwbtgvfdujgcitb first.
BEGIN;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '3s';
SET LOCAL search_path = pg_catalog, public;
SET LOCAL TIME ZONE 'UTC';
LOCK TABLE public.payment_items, public.payment_records, public.payment_conversions
  IN SHARE ROW EXCLUSIVE MODE;

DO $cleanup$
DECLARE
  v_marker constant text := 'AUDIT-FR22-RELINK-5f93bfbe-5830-457d-b3a4-c1088d4711fd';
  v_items uuid[];
  v_records uuid[];
  v_conversions uuid[];
  v_i_before jsonb;
  v_r_before jsonb;
  v_c_before jsonb;
  v_count integer;
  v_names integer;
  v_actor record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND (rolsuper OR rolbypassrls))
     OR current_setting('session_replication_role') <> 'origin' THEN
    RAISE EXCEPTION 'CLEANUP_REQUIRES_PRIVILEGED_ORIGIN_SQL_EDITOR';
  END IF;
  IF (SELECT count(*) FROM pg_class WHERE oid IN (
      'public.payment_items'::regclass, 'public.payment_records'::regclass,
      'public.payment_conversions'::regclass) AND relkind = 'r') <> 3 THEN
    RAISE EXCEPTION 'UNREVIEWED_CLEANUP_RELATIONS';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.contype = 'f' AND c.confrelid IN (
      'public.payment_items'::regclass, 'public.payment_records'::regclass,
      'public.payment_conversions'::regclass)
    AND NOT (
      c.conrelid = 'public.payment_records'::regclass
      AND c.confrelid = 'public.payment_items'::regclass
      AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = c.conrelid AND attname = 'payment_item_id')]::smallint[]
      AND c.confkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = c.confrelid AND attname = 'id')]::smallint[]
      AND c.confdeltype = 'c' AND c.convalidated
    )
  ) THEN RAISE EXCEPTION 'UNREVIEWED_CLEANUP_INBOUND_REFERENCE'; END IF;
  IF (SELECT count(*) FROM pg_trigger t WHERE NOT t.tgisinternal
      AND t.tgrelid IN ('public.payment_items'::regclass, 'public.payment_records'::regclass,
                       'public.payment_conversions'::regclass)
      AND (t.tgtype::integer & 8) <> 0) <> 4 THEN
    RAISE EXCEPTION 'UNREVIEWED_CLEANUP_DELETE_TRIGGERS';
  END IF;
  IF (SELECT count(*) FROM (VALUES
      ('payment_items','guard_suspended_account_write_trigger','guard_suspended_account_write','83011cf2afe6be237b3b33da73ba08df',31),
      ('payment_items','guard_payment_item_delete_trigger','guard_workspace_finance_write','783883ce4af23615f768a0990b6f2478',11),
      ('payment_records','guard_suspended_account_write_trigger','guard_suspended_account_write','83011cf2afe6be237b3b33da73ba08df',31),
      ('payment_records','guard_payment_record_write_trigger','guard_workspace_finance_write','783883ce4af23615f768a0990b6f2478',31)
    ) AS expected(rel, trigger_name, fn, body_md5, event_bits)
    JOIN pg_trigger t ON t.tgrelid = to_regclass('public.' || expected.rel) AND t.tgname = expected.trigger_name
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE t.tgtype = expected.event_bits AND t.tgenabled = 'O' AND NOT t.tgisinternal
      AND t.tgparentid = 0 AND t.tgconstraint = 0 AND t.tgnargs = 0 AND t.tgqual IS NULL
      AND cardinality(t.tgattr::smallint[]) = 0
      AND t.tgoldtable IS NULL AND t.tgnewtable IS NULL
      AND n.nspname = 'public' AND p.proname = expected.fn AND p.pronargs = 0
      AND p.prokind = 'f' AND p.prorettype = 'trigger'::regtype AND l.lanname = 'plpgsql'
      AND p.prosecdef AND p.proconfig = ARRAY['search_path=public, pg_temp']::text[]
      AND md5(replace(p.prosrc, E'\r\n', E'\n')) = expected.body_md5
  ) <> 4 THEN RAISE EXCEPTION 'UNREVIEWED_CLEANUP_DELETE_GUARD'; END IF;
  IF (SELECT count(*) FROM auth.users WHERE email IN ('audit.owner@example.com','audit.outsider@example.com')) <> 2 THEN
    RAISE EXCEPTION 'CLEANUP_ACTORS_MISSING_OR_AMBIGUOUS';
  END IF;

  WITH expected(email, suffix) AS (VALUES
    ('audit.owner@example.com','-1-A'), ('audit.owner@example.com','-1-B'),
    ('audit.outsider@example.com','-2-A'), ('audit.outsider@example.com','-2-B')
  )
  SELECT array_agg(i.id ORDER BY i.id), count(DISTINCT i.name)
    INTO v_items, v_names
  FROM expected e JOIN auth.users u ON u.email = e.email
  JOIN public.payment_items i ON i.name = v_marker || e.suffix
  JOIN public.budget_workspaces w ON w.id = i.workspace_id
  WHERE i.owner_id = u.id AND i.created_by = u.id
    AND w.owner_id = u.id AND w.workspace_type = 'personal' AND w.status = 'active'
    AND i.family_id IS NULL AND i.visibility = 'personal' AND i.status = 'inactive'
    AND i.amount = 1 AND i.currency = 'USD' AND i.recurrence_type = 'once'
    AND i.start_date = DATE '2026-10-14'
    AND i.notes = 'Synthetic FR2 relink fixture retained for exact cleanup'
    AND i.created_at BETWEEN TIMESTAMPTZ '2026-10-14 05:27:00+00' AND TIMESTAMPTZ '2026-10-14 05:29:00+00';
  IF cardinality(v_items) IS DISTINCT FROM 4 OR v_names <> 4
     OR (SELECT count(*) FROM public.payment_items WHERE name LIKE v_marker || '-%') <> 4 THEN
    RAISE EXCEPTION 'EXACT_RUN_ITEMS_NOT_FOUR_MATCHING_FIXTURES';
  END IF;
  SELECT array_agg(r.id ORDER BY r.id), count(DISTINCT r.owner_id)
    INTO v_records, v_names
  FROM public.payment_records r JOIN public.payment_items i ON i.id = r.payment_item_id
  WHERE i.id = ANY(v_items) AND right(i.name, 2) = '-A'
    AND r.owner_id = i.owner_id AND r.recorded_by = i.owner_id AND r.workspace_id = i.workspace_id
    AND r.family_id IS NULL AND r.visibility = 'personal' AND r.amount = 1 AND r.currency = 'USD'
    AND r.period_start = DATE '2026-10-14' AND r.due_date = DATE '2026-10-14'
    AND r.payment_date = DATE '2026-10-14' AND r.payment_method = 'Other'
    AND r.reference_number IS NULL AND r.proof_path IS NULL AND r.proof_name IS NULL
    AND r.proof_mime_type IS NULL AND r.proof_size_bytes IS NULL AND r.paid_by_member_id IS NULL
    AND r.notes = 'Synthetic FR2 relink record retained for exact cleanup'
    AND r.created_at BETWEEN TIMESTAMPTZ '2026-10-14 05:27:00+00' AND TIMESTAMPTZ '2026-10-14 05:29:00+00';
  IF cardinality(v_records) IS DISTINCT FROM 2 OR v_names <> 2
     OR (SELECT count(*) FROM public.payment_records WHERE payment_item_id = ANY(v_items)) <> 2 THEN
    RAISE EXCEPTION 'EXACT_RUN_RECORDS_NOT_TWO_RESTORED_FIXTURES';
  END IF;
  SELECT array_agg(c.id ORDER BY c.id), count(DISTINCT c.entity_id)
    INTO v_conversions, v_names
  FROM public.payment_conversions c JOIN public.payment_records r ON r.id = c.entity_id
  WHERE c.entity_type = 'payment_record' AND r.id = ANY(v_records)
    AND c.workspace_id = r.workspace_id AND c.rate_provider = 'identity' AND c.rate_source = 'identity'
    AND c.original_amount = 1 AND c.original_currency = 'USD' AND c.reporting_currency = 'USD'
    AND c.exchange_rate = 1 AND c.converted_amount = 1 AND c.is_locked
    AND c.entered_by IS NULL
    AND c.created_at BETWEEN TIMESTAMPTZ '2026-10-14 05:27:00+00' AND TIMESTAMPTZ '2026-10-14 05:29:00+00';
  IF cardinality(v_conversions) IS DISTINCT FROM 2 OR v_names <> 2
     OR (SELECT count(*) FROM public.payment_conversions WHERE entity_type = 'payment_record' AND entity_id = ANY(v_records)) <> 2 THEN
    RAISE EXCEPTION 'EXACT_RUN_CONVERSIONS_NOT_TWO_LINKED_IDENTITIES';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]') INTO v_i_before
    FROM public.payment_items i WHERE NOT (i.id = ANY(v_items));
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]') INTO v_r_before
    FROM public.payment_records r WHERE NOT (r.id = ANY(v_records));
  SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]') INTO v_c_before
    FROM public.payment_conversions c WHERE NOT (c.id = ANY(v_conversions));

  DELETE FROM public.payment_conversions WHERE id = ANY(v_conversions);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 2 THEN RAISE EXCEPTION 'EXACT_CONVERSION_DELETE_COUNT_FAILED'; END IF;
  FOR v_actor IN SELECT id, email FROM auth.users WHERE email IN ('audit.owner@example.com','audit.outsider@example.com') LOOP
    -- Transaction-local administrative fixture attribution, not a real Auth/JWT session.
    PERFORM set_config('request.jwt.claim.sub', v_actor.id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub',v_actor.id,'role','authenticated','email',v_actor.email)::text, true);
    DELETE FROM public.payment_records WHERE id = ANY(v_records) AND owner_id = v_actor.id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN RAISE EXCEPTION 'EXACT_ACTOR_RECORD_DELETE_COUNT_FAILED'; END IF;
    DELETE FROM public.payment_items WHERE id = ANY(v_items) AND owner_id = v_actor.id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 2 THEN RAISE EXCEPTION 'EXACT_ACTOR_ITEM_DELETE_COUNT_FAILED'; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.payment_items WHERE id = ANY(v_items))
     OR EXISTS (SELECT 1 FROM public.payment_records WHERE id = ANY(v_records))
     OR EXISTS (SELECT 1 FROM public.payment_conversions WHERE id = ANY(v_conversions)
                OR (entity_type = 'payment_record' AND entity_id = ANY(v_records))) THEN
    RAISE EXCEPTION 'EXACT_RUN_RESIDUAL_ROWS_FOUND';
  END IF;
  IF v_i_before IS DISTINCT FROM (SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]') FROM public.payment_items i)
     OR v_r_before IS DISTINCT FROM (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]') FROM public.payment_records r)
     OR v_c_before IS DISTINCT FROM (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]') FROM public.payment_conversions c) THEN
    RAISE EXCEPTION 'UNEXPECTED_NON_TARGET_PAYMENT_ROW_CHANGE_ROLLBACK';
  END IF;
END;
$cleanup$;
COMMIT;

SELECT jsonb_build_object(
  'stage_step', 'FR.2.2_EXACT_RELINK_CLEANUP',
  'result', 'EXACT_SYNTHETIC_RUN_CLEANUP_COMMITTED_NOT_FULL_ACCEPTANCE',
  'target_project', 'dczlddwbtgvfdujgcitb',
  'project_selection_independently_verified', false,
  'run_marker', 'AUDIT-FR22-RELINK-5f93bfbe-5830-457d-b3a4-c1088d4711fd',
  'checked_UTC', clock_timestamp(),
  'items_deleted_under_exact_count_assertions', 4,
  'records_deleted_under_exact_count_assertions', 2,
  'linked_identity_conversions_deleted_under_exact_count_assertions', 2,
  'non_target_payment_rows_compared_unchanged_in_transaction', true,
  'earlier_unlinked_or_manual_conversions_targeted', false,
  'claims_context_transaction_local_not_genuine_Auth_acceptance', true,
  'historical_binding_repair_performed', false,
  'hosted_acceptance', false,
  'findings_closed', '[]'::jsonb
) AS relink_cleanup;
