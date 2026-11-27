-- STAGING dczlddwbtgvfdujgcitb only. ASCII transport; no outbox dispatch.
-- Prepared rollback only: restores the exact prior CRLF body; does not revert messages.
BEGIN;
SET LOCAL statement_timeout='20s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog,public;
SET LOCAL TIME ZONE 'UTC';
LOCK TABLE public.notification_outbox IN SHARE ROW EXCLUSIVE MODE;
DO $repair$
DECLARE
  v_oid oid;
  v_cost real;
  v_source text;
  v_rows jsonb;
  v_metadata jsonb;
  v_after_metadata jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
     OR current_setting('session_replication_role')<>'origin' THEN
    RAISE EXCEPTION 'OUTBOX_CORRECTION_REQUIRES_PRIVILEGED_ORIGIN_SQL_EDITOR';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.notification_outbox'::regclass AND relkind='r')
     OR EXISTS(SELECT 1 FROM pg_rewrite WHERE ev_class='public.notification_outbox'::regclass)
     OR (SELECT count(*) FROM public.notification_outbox)>1000 THEN
    RAISE EXCEPTION 'UNREVIEWED_OR_OVERSIZED_OUTBOX_RELATION';
  END IF;
  IF EXISTS(
    SELECT 1 FROM pg_event_trigger e
    WHERE e.evtenabled IN ('O','A')
      AND (e.evttags IS NULL OR 'CREATE FUNCTION'=ANY(e.evttags))
      AND NOT EXISTS(
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid=p.pronamespace
        JOIN pg_language l ON l.oid=p.prolang
        JOIN pg_roles er ON er.oid=e.evtowner
        JOIN pg_roles pr ON pr.oid=p.proowner
        JOIN (VALUES
          ('pgrst_ddl_watch','ddl_command_end','de987df746eb39647098459e7993bd8595e592969b0cd647828a3d13d37cffe0'),
          ('pgrst_drop_watch','sql_drop','791b41f0632fc86e0fc86a303ec0fd710c4e2ecf947a23422dae2b7a2c122f1d')
        ) reviewed(name,event,body_sha256)
          ON e.evtname=reviewed.name AND e.evtevent=reviewed.event
        WHERE p.oid=e.evtfoid AND e.evtenabled='O' AND e.evttags IS NULL
          AND n.nspname='extensions' AND p.proname=reviewed.name
          AND er.rolname='supabase_admin' AND pr.rolname='supabase_admin'
          AND p.prokind='f' AND p.pronargs=0 AND p.pronargdefaults=0
          AND p.prorettype='event_trigger'::regtype AND l.lanname='plpgsql'
          AND NOT p.prosecdef AND NOT p.proisstrict AND NOT p.proleakproof
          AND p.provolatile='v' AND p.proparallel='u' AND p.prosupport=0
          AND p.proconfig=ARRAY['search_path=""']::text[]
          AND encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')=reviewed.body_sha256
      )
  ) THEN RAISE EXCEPTION 'UNREVIEWED_FUNCTION_DDL_EVENT_HOOK'; END IF;
  IF (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace
      AND proname='set_payment_outbox_workspace_context')<>1 THEN
    RAISE EXCEPTION 'UNREVIEWED_OUTBOX_FUNCTION_COUNT';
  END IF;
  SELECT p.oid,p.procost INTO v_oid,v_cost FROM pg_proc p
    JOIN pg_language l ON l.oid=p.prolang JOIN pg_roles r ON r.oid=p.proowner
    WHERE p.pronamespace='public'::regnamespace AND p.proname='set_payment_outbox_workspace_context'
      AND p.prokind='f' AND p.pronargs=0 AND p.pronargdefaults=0 AND p.provariadic=0
      AND p.prorettype='trigger'::regtype AND NOT p.proretset AND l.lanname='plpgsql'
      AND p.prosecdef AND NOT p.proisstrict AND NOT p.proleakproof
      AND p.provolatile='v' AND p.proparallel='u' AND p.prosupport=0
      AND p.proconfig=ARRAY['search_path=public, pg_temp']::text[] AND r.rolname='postgres'
      AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
      AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
      AND has_function_privilege('service_role',p.oid,'EXECUTE')
      AND encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')
        IN ('708613b8e0202bdfd1c1b248da488eeef1f385bf3c594bf9ede8de6de22af7b5','82e9639b1855436682a9dcccd84372457a3b5e3c151bae049feee3a8ba81cd10','d8b10220c422d168bf38c538916872a203bfe3c0c736f151ea4fa5d5ca2fbd39');
  IF v_oid IS NULL THEN RAISE EXCEPTION 'UNREVIEWED_OUTBOX_FUNCTION_BODY_OR_METADATA'; END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE tgfoid=v_oid)<>1
     OR NOT EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgfoid=v_oid
       AND t.tgrelid='public.notification_outbox'::regclass
       AND t.tgname='set_payment_outbox_workspace_context_trigger'
       AND t.tgtype=23 AND t.tgenabled='O' AND NOT t.tgisinternal
       AND t.tgparentid=0 AND t.tgconstraint=0 AND t.tgnargs=0 AND t.tgqual IS NULL
       AND t.tgoldtable IS NULL AND t.tgnewtable IS NULL
       AND ARRAY(SELECT unnest(t.tgattr::smallint[]))=ARRAY(
         SELECT a.attnum FROM unnest(ARRAY['workspace_id','source_type','source_id','target_url','title'])
           WITH ORDINALITY k(name,ord)
         JOIN pg_attribute a ON a.attrelid=t.tgrelid AND a.attname=k.name AND NOT a.attisdropped
         ORDER BY k.ord)) THEN
    RAISE EXCEPTION 'UNREVIEWED_OUTBOX_TRIGGER_BINDING';
  END IF;
  v_source:=replace($body$
declare
  v_workspace_type text;
  v_workspace_name text;
  v_detailed_previews boolean := false;
begin
  if new.source_type <> 'payment' then return new; end if;

  select workspaces.workspace_type, workspaces.name,
         coalesce(settings.detailed_notification_previews, false)
  into v_workspace_type, v_workspace_name, v_detailed_previews
  from public.budget_workspaces as workspaces
  left join public.workspace_settings as settings
    on settings.workspace_id = workspaces.id
  where workspaces.id = new.workspace_id;

  new.target_url := format(
    '/app.html?source=push&workspace=%s&payment_item=%s#family/payments',
    new.workspace_id,
    new.source_id
  );
  new.title := case
    when v_detailed_previews then left(
      case v_workspace_type
        when 'household' then 'Family'
        when 'business' then 'Business'
        else 'Personal'
      end || ' __MUSHAVO_SEPARATOR__ ' || coalesce(nullif(btrim(v_workspace_name), ''), 'Workspace'),
      80
    )
    else 'Mushavo Budget'
  end;
  return new;
end;
$body$,'__MUSHAVO_SEPARATOR__',chr(9516)||chr(9558));
  v_source:=replace(v_source,E'\n',E'\r\n');
  IF md5(replace(v_source,E'\r\n',E'\n'))<>'12f6ae6147b24860005e0cd6b4e59a2a'
     OR encode(sha256(convert_to(replace(v_source,E'\r\n',E'\n'),'UTF8')),'hex')<>'d8b10220c422d168bf38c538916872a203bfe3c0c736f151ea4fa5d5ca2fbd39' THEN
    RAISE EXCEPTION 'OUTBOX_SOURCE_TEMPLATE_HASH_MISMATCH';
  END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb)
    INTO v_rows FROM public.notification_outbox x;
  SELECT jsonb_build_object(
    'public_functions',(SELECT jsonb_agg(
      to_jsonb(p)-CASE WHEN p.oid=v_oid THEN 'prosrc' ELSE '__no_column__' END
      ORDER BY p.oid) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace),
    'public_triggers',(SELECT jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY t.tgrelid,t.tgname)
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal),
    'public_relations',(SELECT jsonb_agg(jsonb_build_array(oid,relowner,relacl::text,
      relrowsecurity,relforcerowsecurity) ORDER BY oid)
      FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'),
    'public_policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.tablename,p.policyname)
      FROM pg_policies p WHERE p.schemaname='public')
  ) INTO v_metadata;
  IF (SELECT prosrc FROM pg_proc WHERE oid=v_oid) IS DISTINCT FROM v_source THEN
    EXECUTE format('CREATE OR REPLACE FUNCTION public.set_payment_outbox_workspace_context()
      RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER VOLATILE CALLED ON NULL INPUT
      PARALLEL UNSAFE COST %s SET search_path=public,pg_temp AS %L',v_cost,v_source);
  END IF;
  SELECT jsonb_build_object(
    'public_functions',(SELECT jsonb_agg(
      to_jsonb(p)-CASE WHEN p.oid=v_oid THEN 'prosrc' ELSE '__no_column__' END
      ORDER BY p.oid) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace),
    'public_triggers',(SELECT jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY t.tgrelid,t.tgname)
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal),
    'public_relations',(SELECT jsonb_agg(jsonb_build_array(oid,relowner,relacl::text,
      relrowsecurity,relforcerowsecurity) ORDER BY oid)
      FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'),
    'public_policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.tablename,p.policyname)
      FROM pg_policies p WHERE p.schemaname='public')
  ) INTO v_after_metadata;
  IF v_after_metadata IS DISTINCT FROM v_metadata
     OR (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb)
       FROM public.notification_outbox x) IS DISTINCT FROM v_rows
     OR (SELECT prosrc FROM pg_proc WHERE oid=v_oid) IS DISTINCT FROM v_source THEN
    RAISE EXCEPTION 'OUTBOX_CORRECTION_CHANGED_PROTECTED_ROWS_OR_METADATA';
  END IF;
END;
$repair$;
COMMIT;
SELECT jsonb_build_object(
  'stage_step','FR.2.3_OUTBOX_BODY_ROLLBACK',
  'result','REVIEWED_PRIOR_OUTBOX_BODY_RESTORED_NOT_BUSINESS_ACCEPTANCE',
  'target_project','dczlddwbtgvfdujgcitb','checked_UTC',clock_timestamp(),
  'project_selection_independently_verified',false,
  'observed_LF_body_md5',(SELECT md5(replace(prosrc,E'\r\n',E'\n')) FROM pg_proc
    WHERE oid='public.set_payment_outbox_workspace_context()'::regprocedure),
  'reviewed_target_body_matches',(SELECT md5(replace(prosrc,E'\r\n',E'\n'))='12f6ae6147b24860005e0cd6b4e59a2a' FROM pg_proc
    WHERE oid='public.set_payment_outbox_workspace_context()'::regprocedure),
  'only_reviewed_target_body_change_permitted_under_assertions',true,
  'outbox_rows_compared_unchanged_in_transaction',true,
  'public_function_metadata_grants_policies_relations_and_triggers_compared_unchanged',true,
  'target_outbox_function_or_dispatch_invoked_by_this_script',false,
  'Business_fixture_rows_created',0,'hosted_Business_API_checks_run',0,
  'hosted_acceptance',false,'findings_closed','[]'::jsonb,
  'production_or_native_changed',false
) AS outbox_body_rollback;
