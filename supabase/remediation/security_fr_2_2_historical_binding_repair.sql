-- Select STAGING dczlddwbtgvfdujgcitb first. One fingerprinted historical record only.
BEGIN;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '3s';
SET LOCAL search_path = pg_catalog, public;
SET LOCAL TIME ZONE 'UTC';
LOCK TABLE public.payment_items, public.payment_records, public.payment_conversions
  IN SHARE ROW EXCLUSIVE MODE;

DO $repair$
DECLARE
  v_record_hash constant text := 'a75141260231d3a916ec2f0bf5a815437dd5b9cacfdde1fd659ff206f3e06615';
  v_parent_hash constant text := 'b805cc76f30048fbd07060f1d9a8467e72d8f18f03c4c7325dbfd409b4a79eea';
  v_id uuid;
  v_workspace uuid;
  v_owner uuid;
  v_email text;
  v_target_before jsonb;
  v_items_before jsonb;
  v_records_before jsonb;
  v_conversions_before jsonb;
  v_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)
  ) OR current_setting('session_replication_role') <> 'origin' THEN
    RAISE EXCEPTION 'REPAIR_REQUIRES_PRIVILEGED_ORIGIN_SQL_EDITOR';
  END IF;
  IF (SELECT count(*) FROM pg_class WHERE oid IN (
      'public.payment_items'::regclass,'public.payment_records'::regclass,
      'public.payment_conversions'::regclass) AND relkind='r') <> 3
     OR EXISTS (SELECT 1 FROM pg_rewrite WHERE ev_class='public.payment_records'::regclass)
     OR EXISTS (
       SELECT 1 FROM pg_constraint WHERE contype='f'
         AND confrelid='public.payment_records'::regclass
         AND (SELECT attnum FROM pg_attribute
              WHERE attrelid=confrelid AND attname='workspace_id')=ANY(confkey)
     ) THEN RAISE EXCEPTION 'UNREVIEWED_REPAIR_RELATION_OR_WORKSPACE_REFERENCE'; END IF;

  -- Only three source-reviewed triggers may fire on UPDATE workspace_id.
  IF (SELECT count(*) FROM pg_trigger t
      WHERE t.tgrelid='public.payment_records'::regclass AND NOT t.tgisinternal
        AND (t.tgtype::integer & 16)<>0
        AND (cardinality(t.tgattr::smallint[])=0 OR
          (SELECT attnum FROM pg_attribute
           WHERE attrelid=t.tgrelid AND attname='workspace_id')=ANY(t.tgattr::smallint[]))) <> 3 THEN
    RAISE EXCEPTION 'UNREVIEWED_REPAIR_UPDATE_TRIGGERS';
  END IF;
  IF (SELECT count(*) FROM (VALUES
      ('guard_payment_record_write_trigger','guard_workspace_finance_write',
       '783883ce4af23615f768a0990b6f2478',31,ARRAY[]::text[]),
      ('guard_suspended_account_write_trigger','guard_suspended_account_write',
       '83011cf2afe6be237b3b33da73ba08df',31,ARRAY[]::text[]),
      ('sync_payment_record_workspace_trigger','sync_payment_record_workspace',
       '8f568f342d4e928b4c27437ba7f544e5',23,ARRAY['payment_item_id','workspace_id']::text[])
    ) expected(trigger_name,fn,body_md5,event_bits,cols)
    JOIN pg_trigger t ON t.tgrelid='public.payment_records'::regclass AND t.tgname=expected.trigger_name
    JOIN pg_proc p ON p.oid=t.tgfoid
    JOIN pg_namespace n ON n.oid=p.pronamespace
    JOIN pg_language l ON l.oid=p.prolang
    WHERE t.tgtype=expected.event_bits AND t.tgenabled='O' AND NOT t.tgisinternal
      AND t.tgparentid=0 AND t.tgconstraint=0 AND t.tgnargs=0 AND t.tgqual IS NULL
      AND t.tgoldtable IS NULL AND t.tgnewtable IS NULL
      AND ARRAY(SELECT unnest(t.tgattr::smallint[]))=ARRAY(
        SELECT a.attnum FROM pg_attribute a
        WHERE a.attrelid=t.tgrelid AND a.attname=ANY(expected.cols) ORDER BY a.attnum
      )::smallint[]
      AND n.nspname='public' AND p.proname=expected.fn AND p.pronargs=0
      AND p.prokind='f' AND p.prorettype='trigger'::regtype AND l.lanname='plpgsql'
      AND p.prosecdef AND p.proconfig=ARRAY['search_path=public, pg_temp']::text[]
      AND md5(replace(p.prosrc,E'\r\n',E'\n'))=expected.body_md5
  ) <> 3 THEN RAISE EXCEPTION 'UNREVIEWED_REPAIR_UPDATE_GUARD'; END IF;

  IF (SELECT count(*) FROM auth.users
      WHERE email IN ('audit.owner@example.com','audit.outsider@example.com')) <> 2 THEN
    RAISE EXCEPTION 'REPAIR_ACTORS_MISSING_OR_AMBIGUOUS';
  END IF;
  SELECT r.id,i.workspace_id,r.owner_id,u.email,to_jsonb(r)
    INTO v_id,v_workspace,v_owner,v_email,v_target_before
  FROM public.payment_records r
  JOIN public.payment_items i ON i.id=r.payment_item_id
  JOIN auth.users u ON u.id=r.owner_id
  JOIN public.budget_workspaces pw ON pw.id=i.workspace_id
  JOIN public.budget_workspaces rw ON rw.id=r.workspace_id
  WHERE encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex')=v_record_hash
    AND encode(sha256(convert_to(to_jsonb(i)::text,'UTF8')),'hex')=v_parent_hash
    AND u.email IN ('audit.owner@example.com','audit.outsider@example.com')
    AND r.workspace_id IS DISTINCT FROM i.workspace_id
    AND pw.owner_id=r.owner_id AND pw.workspace_type='personal' AND pw.status='active'
    AND rw.owner_id IS DISTINCT FROM r.owner_id AND rw.workspace_type='personal'
    AND i.owner_id=r.owner_id AND i.created_by=r.owner_id AND r.recorded_by=r.owner_id
    AND i.family_id IS NULL AND r.family_id IS NULL
    AND i.visibility='personal' AND r.visibility='personal' AND i.status='inactive'
    AND i.amount=1 AND r.amount=1 AND i.currency='USD' AND r.currency='USD'
    AND i.name ~ '^AUDIT-S321-[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}-[01]$'
    AND i.notes IN ('Synthetic Stage 3 Personal isolation test','Synthetic permitted update')
    AND r.notes IN ('Synthetic paid record','Synthetic permitted paid update')
    AND i.created_at=TIMESTAMPTZ '2026-10-10T17:18:59.686741Z'
    AND r.created_at=TIMESTAMPTZ '2026-10-10T17:19:00.948861Z';
  IF v_id IS NULL OR (SELECT count(*) FROM public.payment_records r
      WHERE encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex')=v_record_hash) <> 1 THEN
    RAISE EXCEPTION 'EXACT_HISTORICAL_RECORD_OR_PARENT_CHANGED';
  END IF;
  IF (SELECT count(*) FROM public.payment_conversions c
      WHERE c.entity_type='payment_record' AND c.entity_id=v_id) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.payment_conversions c
       WHERE c.entity_type='payment_record' AND c.entity_id=v_id AND c.workspace_id=v_workspace)
     OR (SELECT count(*) FROM public.payment_records r JOIN public.payment_items i ON i.id=r.payment_item_id
         WHERE r.workspace_id IS DISTINCT FROM i.workspace_id) <> 1
     OR (SELECT count(*) FROM public.payment_conversions c JOIN public.payment_records r ON r.id=c.entity_id
         WHERE c.entity_type='payment_record' AND c.workspace_id IS DISTINCT FROM r.workspace_id) <> 1 THEN
    RAISE EXCEPTION 'HISTORICAL_LINKAGE_NO_LONGER_REVIEWED_SHAPE';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'::jsonb)
    INTO v_items_before FROM public.payment_items i;
  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb)
    INTO v_records_before FROM public.payment_records r WHERE r.id<>v_id;
  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]'::jsonb)
    INTO v_conversions_before FROM public.payment_conversions c;

  -- Administrative attribution only, transaction-local; normal guards stay enabled.
  PERFORM set_config('request.jwt.claim.sub',v_owner::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated','email',v_email)::text,true);
  UPDATE public.payment_records SET workspace_id=v_workspace WHERE id=v_id;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>1 OR (SELECT to_jsonb(r) FROM public.payment_records r WHERE id=v_id)
      IS DISTINCT FROM jsonb_set(v_target_before,'{workspace_id}',to_jsonb(v_workspace)) THEN
    RAISE EXCEPTION 'REPAIR_CHANGED_MORE_THAN_ONE_WORKSPACE_FIELD';
  END IF;
  IF (SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'::jsonb) FROM public.payment_items i)
      IS DISTINCT FROM v_items_before
     OR (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb)
         FROM public.payment_records r WHERE r.id<>v_id) IS DISTINCT FROM v_records_before
     OR (SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]'::jsonb) FROM public.payment_conversions c)
      IS DISTINCT FROM v_conversions_before THEN
    RAISE EXCEPTION 'NON_TARGET_PAYMENT_ROWS_CHANGED_REPAIR_ABORTED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payment_records r JOIN public.payment_items i ON i.id=r.payment_item_id
             WHERE r.workspace_id IS DISTINCT FROM i.workspace_id)
     OR EXISTS (SELECT 1 FROM public.payment_conversions c JOIN public.payment_records r ON r.id=c.entity_id
                WHERE c.entity_type='payment_record' AND c.workspace_id IS DISTINCT FROM r.workspace_id) THEN
    RAISE EXCEPTION 'REPAIR_WORKSPACE_CONSISTENCY_ASSERTION_FAILED';
  END IF;
END;
$repair$;
COMMIT;

SELECT jsonb_build_object(
  'stage_step','FR.2.2_EXACT_HISTORICAL_BINDING_REPAIR',
  'result','ONE_FINGERPRINTED_RECORD_WORKSPACE_REPAIRED_COMMITTED_NOT_FULL_ACCEPTANCE',
  'target_project','dczlddwbtgvfdujgcitb',
  'checked_UTC',clock_timestamp(),
  'project_selection_independently_verified',false,
  'records_repaired_under_exact_assertions',1,
  'only_target_workspace_id_changed',true,
  'all_items_other_records_and_all_conversions_compared_unchanged',true,
  'remaining_joined_workspace_mismatches_under_assertions',0,
  'unlinked_or_manual_conversions_deleted',false,
  'claims_context_transaction_local_not_genuine_Auth_acceptance',true,
  'canonical_schema_or_migration_integration_performed',false,
  'hosted_acceptance',false,
  'findings_closed','[]'::jsonb
) AS historical_binding_repair;
