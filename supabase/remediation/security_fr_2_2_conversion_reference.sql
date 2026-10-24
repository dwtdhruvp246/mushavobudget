-- STAGING dczlddwbtgvfdujgcitb only. Existing orphan rows are preserved.
BEGIN;
SET LOCAL statement_timeout='20s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog,public;
SET LOCAL TIME ZONE 'UTC';
LOCK TABLE public.payment_records,public.payment_conversions IN ACCESS EXCLUSIVE MODE;
DO $lifecycle$
DECLARE
  v_existing integer;
  v_ref smallint;
  v_fk oid;
  v_index oid;
  v_helper oid;
  v_guard oid;
  v_records jsonb;
  v_conversions jsonb;
  v_metadata jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
     OR current_setting('session_replication_role')<>'origin' THEN
    RAISE EXCEPTION 'LIFECYCLE_REQUIRES_PRIVILEGED_ORIGIN_SQL_EDITOR';
  END IF;
  IF (SELECT count(*) FROM pg_class WHERE oid IN ('public.payment_records'::regclass,
      'public.payment_conversions'::regclass) AND relkind='r' AND relrowsecurity AND NOT relforcerowsecurity)<>2
     OR EXISTS(SELECT 1 FROM pg_rewrite WHERE ev_class IN ('public.payment_records'::regclass,
       'public.payment_conversions'::regclass)) THEN
    RAISE EXCEPTION 'UNREVIEWED_LIFECYCLE_RELATIONS';
  END IF;
  if exists (
    select 1 from pg_event_trigger e
    where e.evtenabled in ('O','A')
      and (e.evttags is null or e.evttags && array['ALTER TABLE','CREATE INDEX','DROP INDEX','CREATE FUNCTION','CREATE TRIGGER','DROP FUNCTION','DROP TRIGGER']::text[])
      and not exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        join pg_language l on l.oid = p.prolang
        join pg_roles er on er.oid = e.evtowner
        join pg_roles pr on pr.oid = p.proowner
        join (values
          ('pgrst_ddl_watch', 'ddl_command_end', 'de987df746eb39647098459e7993bd8595e592969b0cd647828a3d13d37cffe0'),
          ('pgrst_drop_watch', 'sql_drop', '791b41f0632fc86e0fc86a303ec0fd710c4e2ecf947a23422dae2b7a2c122f1d')
        ) as reviewed(name, event, body_sha256)
          on e.evtname = reviewed.name and e.evtevent = reviewed.event
        where p.oid = e.evtfoid
          and e.evtenabled = 'O' and e.evttags is null
          and n.nspname = 'extensions' and p.proname = reviewed.name
          and er.rolname = 'supabase_admin' and pr.rolname = 'supabase_admin'
          and p.prokind = 'f' and p.pronargs = 0 and p.pronargdefaults = 0
          and p.prorettype = 'event_trigger'::regtype and l.lanname = 'plpgsql'
          and not p.prosecdef and not p.proisstrict and not p.proleakproof
          and p.provolatile = 'v' and p.proparallel = 'u' and p.prosupport = 0
          and p.proconfig = array['search_path=""']::text[]
          and encode(sha256(convert_to(replace(p.prosrc, E'\r\n', E'\n'), 'UTF8')), 'hex')
              = reviewed.body_sha256
      )
  ) then
    raise exception 'UNREVIEWED_TRIGGER_DDL_EVENT_HOOK';
  end if;

  IF (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND (tgtype::integer & 8)<>0
      AND tgrelid IN ('public.payment_records'::regclass,'public.payment_conversions'::regclass))<>2
     OR (SELECT count(*) FROM (VALUES
       ('guard_payment_record_write_trigger','guard_workspace_finance_write','783883ce4af23615f768a0990b6f2478'),
       ('guard_suspended_account_write_trigger','guard_suspended_account_write','83011cf2afe6be237b3b33da73ba08df')
     ) e(tg,fn,body)
     JOIN pg_trigger t ON t.tgrelid='public.payment_records'::regclass AND t.tgname=e.tg
     JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace
     JOIN pg_language l ON l.oid=p.prolang
     WHERE t.tgtype=31 AND t.tgenabled='O' AND NOT t.tgisinternal
       AND t.tgparentid=0 AND t.tgconstraint=0 AND t.tgnargs=0 AND t.tgqual IS NULL
       AND cardinality(t.tgattr::smallint[])=0 AND t.tgoldtable IS NULL AND t.tgnewtable IS NULL
       AND n.nspname='public' AND p.proname=e.fn AND p.pronargs=0
       AND p.prorettype='trigger'::regtype AND p.prokind='f' AND l.lanname='plpgsql'
       AND p.prosecdef AND p.proconfig=ARRAY['search_path=public, pg_temp']::text[]
       AND md5(replace(p.prosrc,E'\r\n',E'\n'))=e.body)<>2 THEN
    RAISE EXCEPTION 'UNREVIEWED_LIFECYCLE_DELETE_GUARDS';
  END IF;
  IF (SELECT count(*) FROM pg_constraint c WHERE c.contype='f'
      AND (c.conrelid IN ('public.payment_records'::regclass,'public.payment_conversions'::regclass)
        OR c.confrelid IN ('public.payment_records'::regclass,'public.payment_conversions'::regclass))
      AND NOT(c.conrelid='public.payment_conversions'::regclass AND c.conname='payment_conversions_payment_record_ref_fkey'))<>8 THEN
    RAISE EXCEPTION 'UNREVIEWED_LIFECYCLE_FK_GRAPH';
  END IF;
  IF (SELECT count(*) FROM (VALUES
      ('payment_conversions_entered_by_fkey','payment_conversions','entered_by','auth.users','n'),
      ('payment_conversions_workspace_id_fkey','payment_conversions','workspace_id','public.budget_workspaces','c'),
      ('payment_records_family_id_fkey','payment_records','family_id','public.families','c'),
      ('payment_records_owner_id_fkey','payment_records','owner_id','auth.users','c'),
      ('payment_records_paid_by_member_id_fkey','payment_records','paid_by_member_id','public.family_members','n'),
      ('payment_records_payment_item_id_fkey','payment_records','payment_item_id','public.payment_items','c'),
      ('payment_records_recorded_by_fkey','payment_records','recorded_by','auth.users','c'),
      ('payment_records_workspace_id_fkey','payment_records','workspace_id','public.budget_workspaces','c')
    ) e(name,rel,col,target,action)
    JOIN pg_constraint c ON c.conrelid=to_regclass('public.'||e.rel) AND c.conname=e.name
    WHERE c.contype='f' AND c.confrelid=to_regclass(e.target) AND c.confdeltype=e.action::"char"
      AND c.convalidated AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute
        WHERE attrelid=c.conrelid AND attname=e.col)]::smallint[]
      AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute
        WHERE attrelid=c.confrelid AND attname='id')]::smallint[])<>8 THEN
    RAISE EXCEPTION 'UNREVIEWED_LIFECYCLE_FK_DEFINITIONS';
  END IF;
  SELECT attnum INTO v_ref FROM pg_attribute WHERE attrelid='public.payment_conversions'::regclass
    AND attname='payment_record_ref' AND NOT attisdropped;
  SELECT oid INTO v_fk FROM pg_constraint WHERE conrelid='public.payment_conversions'::regclass
    AND conname='payment_conversions_payment_record_ref_fkey';
  v_index:=to_regclass('public.payment_conversions_payment_record_ref_idx');
  v_helper:=to_regprocedure('public.guard_reserved_payment_record_id()');
  SELECT oid INTO v_guard FROM pg_trigger WHERE tgrelid='public.payment_records'::regclass
    AND tgname='guard_reserved_payment_record_id_trigger';
  IF EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace
      AND proname='guard_reserved_payment_record_id' AND oid IS DISTINCT FROM v_helper) THEN
    RAISE EXCEPTION 'UNREVIEWED_RESERVED_RECORD_FUNCTION_OVERLOAD';
  END IF;
  v_existing:=(v_ref IS NOT NULL)::integer+(v_fk IS NOT NULL)::integer+(v_index IS NOT NULL)::integer
    +(v_helper IS NOT NULL)::integer+(v_guard IS NOT NULL)::integer;
  IF v_existing NOT IN (0,5) THEN RAISE EXCEPTION 'PARTIAL_OR_UNREVIEWED_LIFECYCLE_OBJECTS'; END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb) INTO v_records FROM public.payment_records x;
  SELECT COALESCE(jsonb_agg(to_jsonb(x)-'payment_record_ref' ORDER BY x.id),'[]'::jsonb)
    INTO v_conversions FROM public.payment_conversions x;
  SELECT jsonb_build_object(
    'relations',(SELECT jsonb_agg(jsonb_build_array(oid,relowner,relacl::text,relrowsecurity,relforcerowsecurity) ORDER BY oid)
      FROM pg_class WHERE oid IN ('public.payment_records'::regclass,'public.payment_conversions'::regclass)),
    'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.tablename,p.policyname) FROM pg_policies p
      WHERE p.schemaname='public' AND p.tablename IN ('payment_records','payment_conversions')),
    'triggers',(SELECT jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY t.tgrelid,t.tgname) FROM pg_trigger t
      WHERE NOT t.tgisinternal AND NOT(t.tgrelid='public.payment_records'::regclass AND t.tgname='guard_reserved_payment_record_id_trigger') AND t.tgrelid IN ('public.payment_records'::regclass,'public.payment_conversions'::regclass))
  ) INTO v_metadata;

  IF v_existing=0 THEN
    ALTER TABLE public.payment_conversions ADD COLUMN payment_record_ref uuid
      GENERATED ALWAYS AS(CASE WHEN entity_type='payment_record' THEN entity_id ELSE NULL::uuid END) STORED;
    ALTER TABLE public.payment_conversions ADD CONSTRAINT payment_conversions_payment_record_ref_fkey
      FOREIGN KEY(payment_record_ref) REFERENCES public.payment_records(id) ON DELETE CASCADE NOT VALID;
    CREATE INDEX payment_conversions_payment_record_ref_idx ON public.payment_conversions(payment_record_ref)
      WHERE payment_record_ref IS NOT NULL;
    SELECT attnum INTO v_ref FROM pg_attribute WHERE attrelid='public.payment_conversions'::regclass
      AND attname='payment_record_ref' AND NOT attisdropped;
    SELECT oid INTO v_fk FROM pg_constraint WHERE conrelid='public.payment_conversions'::regclass
      AND conname='payment_conversions_payment_record_ref_fkey';
    v_index:=to_regclass('public.payment_conversions_payment_record_ref_idx');
    CREATE FUNCTION public.guard_reserved_payment_record_id() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $reserved$
BEGIN
  IF TG_RELID<>'public.payment_records'::regclass OR TG_WHEN<>'BEFORE'
     OR TG_LEVEL<>'ROW' OR TG_OP NOT IN ('INSERT','UPDATE') THEN
    RAISE EXCEPTION 'RESERVED_RECORD_GUARD_REQUIRES_TRIGGER_CONTEXT';
  END IF;
  IF TG_OP='UPDATE' AND NEW.id IS NOT DISTINCT FROM OLD.id THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM public.payment_conversions
    WHERE entity_type='payment_record' AND entity_id=NEW.id) THEN
    RAISE EXCEPTION 'PAYMENT_RECORD_ID_RESERVED_BY_CONVERSION';
  END IF;
  RETURN NEW;
END;
$reserved$;
    REVOKE ALL ON FUNCTION public.guard_reserved_payment_record_id() FROM PUBLIC,anon,authenticated,service_role;
    CREATE TRIGGER guard_reserved_payment_record_id_trigger BEFORE INSERT OR UPDATE OF id
      ON public.payment_records FOR EACH ROW EXECUTE FUNCTION public.guard_reserved_payment_record_id();
    v_helper:=to_regprocedure('public.guard_reserved_payment_record_id()');
    SELECT oid INTO v_guard FROM pg_trigger WHERE tgrelid='public.payment_records'::regclass
      AND tgname='guard_reserved_payment_record_id_trigger';
  END IF;

  IF NOT EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid='public.payment_conversions'::regclass AND a.attnum=v_ref AND a.atttypid='uuid'::regtype
        AND a.attgenerated='s' AND NOT a.attnotnull AND NOT a.attisdropped AND a.attidentity=''
        AND btrim(regexp_replace(pg_get_expr(d.adbin,d.adrelid),'[[:space:]]+',' ','g'))=
          'CASE WHEN (entity_type = ''payment_record''::text) THEN entity_id ELSE NULL::uuid END')
     OR NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.oid=v_fk AND c.contype='f'
       AND c.conrelid='public.payment_conversions'::regclass AND c.confrelid='public.payment_records'::regclass
       AND c.conkey=ARRAY[v_ref]::smallint[] AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute
         WHERE attrelid=c.confrelid AND attname='id')]::smallint[]
       AND c.confdeltype='c' AND c.confupdtype='a' AND c.confmatchtype='s'
       AND NOT c.condeferrable AND NOT c.condeferred)
     OR NOT EXISTS(SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_am am ON am.oid=c.relam
       WHERE i.indexrelid=v_index AND i.indrelid='public.payment_conversions'::regclass
         AND i.indisvalid AND i.indisready AND NOT i.indisunique AND i.indnkeyatts=1 AND i.indnatts=1
         AND ARRAY(SELECT unnest(i.indkey::smallint[]))=ARRAY[v_ref]::smallint[] AND i.indexprs IS NULL
         AND am.amname='btree' AND pg_get_expr(i.indpred,i.indrelid)='(payment_record_ref IS NOT NULL)')
     OR (SELECT count(*) FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
       WHERE t.tgconstraint=v_fk AND t.tgisinternal AND t.tgenabled='O'
         AND p.pronamespace='pg_catalog'::regnamespace
         AND p.proname IN ('RI_FKey_cascade_del','RI_FKey_noaction_upd','RI_FKey_check_ins','RI_FKey_check_upd'))<>4 THEN
    RAISE EXCEPTION 'UNREVIEWED_LIFECYCLE_REFERENCE_DEFINITION';
  END IF;

  IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
      JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid=v_helper AND p.pronamespace='public'::regnamespace
        AND p.prokind='f' AND p.pronargs=0 AND p.prorettype='trigger'::regtype AND l.lanname='plpgsql'
        AND p.prosecdef AND p.proconfig=ARRAY['search_path=pg_catalog']::text[] AND (r.rolsuper OR r.rolbypassrls)
        AND md5(replace(p.prosrc,E'\r\n',E'\n'))='ae4585ba13c461c6de1b42123ad9c3fc')
     OR has_function_privilege('anon',v_helper,'EXECUTE')
     OR has_function_privilege('authenticated',v_helper,'EXECUTE')
     OR has_function_privilege('service_role',v_helper,'EXECUTE')
     OR NOT EXISTS(SELECT 1 FROM pg_trigger t WHERE t.oid=v_guard AND t.tgfoid=v_helper
       AND t.tgtype=23 AND t.tgenabled='O' AND NOT t.tgisinternal AND t.tgparentid=0 AND t.tgconstraint=0
       AND t.tgnargs=0 AND t.tgqual IS NULL AND t.tgoldtable IS NULL AND t.tgnewtable IS NULL
       AND ARRAY(SELECT unnest(t.tgattr::smallint[]))=ARRAY[(SELECT attnum FROM pg_attribute
         WHERE attrelid=t.tgrelid AND attname='id')]::smallint[]) THEN
    RAISE EXCEPTION 'UNREVIEWED_RESERVED_RECORD_ID_GUARD';
  END IF;

  IF (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb) FROM public.payment_records x)
       IS DISTINCT FROM v_records
     OR (SELECT COALESCE(jsonb_agg(to_jsonb(x)-'payment_record_ref' ORDER BY x.id),'[]'::jsonb)
         FROM public.payment_conversions x) IS DISTINCT FROM v_conversions
     OR jsonb_build_object(
       'relations',(SELECT jsonb_agg(jsonb_build_array(oid,relowner,relacl::text,relrowsecurity,relforcerowsecurity) ORDER BY oid)
         FROM pg_class WHERE oid IN ('public.payment_records'::regclass,'public.payment_conversions'::regclass)),
       'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.tablename,p.policyname) FROM pg_policies p
         WHERE p.schemaname='public' AND p.tablename IN ('payment_records','payment_conversions')),
       'triggers',(SELECT jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY t.tgrelid,t.tgname) FROM pg_trigger t
         WHERE NOT t.tgisinternal AND NOT(t.tgrelid='public.payment_records'::regclass AND t.tgname='guard_reserved_payment_record_id_trigger') AND t.tgrelid IN ('public.payment_records'::regclass,'public.payment_conversions'::regclass))
     ) IS DISTINCT FROM v_metadata THEN
    RAISE EXCEPTION 'LIFECYCLE_CHANGED_BASE_ROWS_OR_EXISTING_PERMISSIONS';
  END IF;
END;
$lifecycle$;
COMMIT;

SELECT jsonb_build_object(
  'stage_step','FR.2.2_CONVERSION_REFERENCE_INSTALL',
  'result','GENERATED_RECORD_REFERENCE_AND_CASCADE_FK_INSTALLED_NOT_HOSTED_API_ACCEPTANCE',
  'target_project','dczlddwbtgvfdujgcitb','checked_UTC',clock_timestamp(),
  'project_selection_independently_verified',false,
  'existing_record_and_original_conversion_columns_compared_unchanged',true,
  'baseline_projection_excludes_only_new_payment_record_ref',true,
  'existing_unlinked_or_manual_conversions_deleted',false,
  'legacy_conversion_ID_reuse_guard_installed',true,
  'new_helper_direct_execute_revoked_for_API_roles',true,
  'existing_DELETE_guards_RLS_policies_and_table_grants_compared_unchanged',true,
  'constraint_validated',(SELECT convalidated FROM pg_constraint WHERE conrelid='public.payment_conversions'::regclass
    AND conname='payment_conversions_payment_record_ref_fkey'),
  'hosted_API_deletion_checks_run',0,'hosted_acceptance',false,'findings_closed','[]'::jsonb
) AS conversion_reference_installation;
