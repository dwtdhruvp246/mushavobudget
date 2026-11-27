-- Install on staging dczlddwbtgvfdujgcitb only. No seat values change during installation.
BEGIN;
SET LOCAL mushavo.email_rollout_project='dczlddwbtgvfdujgcitb';
SET LOCAL mushavo.email_rollout_action='INSTALL_BUSINESS_SEAT_EDITOR';
SET LOCAL statement_timeout='35s';
SET LOCAL lock_timeout='3s';
DO $preflight$
DECLARE expected text;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_setting('session_replication_role')<>'origin'
 OR coalesce(current_setting('role',true),'none') NOT IN ('none','postgres')
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'BUSINESS_SEATS_PRIVILEGED_ORIGIN_REQUIRED'; END IF;
 IF current_setting('mushavo.email_rollout_project',true) IS DISTINCT FROM 'dczlddwbtgvfdujgcitb'
 OR current_setting('mushavo.email_rollout_action',true) IS DISTINCT FROM 'INSTALL_BUSINESS_SEAT_EDITOR'
 THEN RAISE EXCEPTION 'BUSINESS_SEATS_TARGET_ACTION_REQUIRED'; END IF;
 IF EXISTS (
 SELECT 1 FROM pg_event_trigger e
 WHERE e.evtenabled IN ('O','A')
 AND (e.evttags IS NULL OR e.evttags && ARRAY['CREATE SCHEMA','CREATE TABLE','ALTER TABLE','CREATE INDEX','CREATE FUNCTION','ALTER FUNCTION','CREATE TRIGGER','CREATE POLICY','GRANT','REVOKE']::text[])
 AND NOT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  JOIN pg_language l ON l.oid=p.prolang JOIN pg_roles er ON er.oid=e.evtowner JOIN pg_roles pr ON pr.oid=p.proowner
  JOIN (VALUES
   ('pgrst_ddl_watch','ddl_command_end','de987df746eb39647098459e7993bd8595e592969b0cd647828a3d13d37cffe0'),
   ('pgrst_drop_watch','sql_drop','791b41f0632fc86e0fc86a303ec0fd710c4e2ecf947a23422dae2b7a2c122f1d')
  ) reviewed(name,event,body_sha256) ON e.evtname=reviewed.name AND e.evtevent=reviewed.event
  WHERE p.oid=e.evtfoid AND e.evtenabled='O' AND e.evttags IS NULL
  AND n.nspname='extensions' AND p.proname=reviewed.name
  AND er.rolname='supabase_admin' AND pr.rolname='supabase_admin'
  AND p.prokind='f' AND p.pronargs=0 AND p.pronargdefaults=0 AND p.prorettype='event_trigger'::regtype
  AND l.lanname='plpgsql' AND NOT p.prosecdef AND NOT p.proisstrict AND NOT p.proleakproof
  AND p.provolatile='v' AND p.proparallel='u' AND p.prosupport=0 AND p.proconfig=ARRAY['search_path=""']::text[]
  AND encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')=reviewed.body_sha256
 )
 AND NOT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  JOIN pg_language l ON l.oid=p.prolang JOIN pg_roles er ON er.oid=e.evtowner JOIN pg_roles pr ON pr.oid=p.proowner
  WHERE p.oid=e.evtfoid AND e.evtname='ensure_rls' AND e.evtevent='ddl_command_end' AND e.evtenabled='O'
  AND ARRAY(SELECT unnest(e.evttags) ORDER BY 1)=ARRAY['CREATE TABLE','CREATE TABLE AS','SELECT INTO']::text[]
  AND n.nspname='public' AND p.proname='rls_auto_enable' AND er.rolname='postgres' AND pr.rolname='postgres'
  AND p.prokind='f' AND p.pronargs=0 AND p.pronargdefaults=0 AND p.prorettype='event_trigger'::regtype
  AND l.lanname='plpgsql' AND p.prosecdef AND NOT p.proisstrict AND NOT p.proleakproof
  AND p.provolatile='v' AND p.proparallel='u' AND p.prosupport=0 AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
  AND (SELECT count(*) FROM pg_event_trigger WHERE evtfoid=p.oid)=1
  AND (SELECT count(*) FROM pg_proc WHERE pronamespace=p.pronamespace AND proname=p.proname)=1
  AND has_function_privilege('anon',p.oid,'EXECUTE') AND has_function_privilege('authenticated',p.oid,'EXECUTE')
  AND has_function_privilege('service_role',p.oid,'EXECUTE')
  AND octet_length(replace(p.prosrc,E'\r\n',E'\n'))=953
  AND encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='2782e98b348aca7d6f6f73c420fd78d2e094957dd7a52b0483d4c34f29d2a7a1'
 )
) THEN RAISE EXCEPTION 'EMAIL_ATOMIC_UNREVIEWED_DDL_HOOK'; END IF;
 PERFORM pg_advisory_xact_lock(20261017,2411);
 SELECT catalog_sha256 INTO expected FROM mushavo_email_install.rollout_control
 WHERE singleton AND target_project='dczlddwbtgvfdujgcitb' AND mode='ACTIVE' FOR UPDATE;
 IF expected IS NULL OR expected IS DISTINCT FROM mushavo_email_install.catalog_identity()
 THEN RAISE EXCEPTION 'BUSINESS_SEATS_CURRENT_CATALOG_REQUIRED'; END IF;
 IF to_regclass('mushavo_email_install.password_signin_policy') IS NULL
 THEN RAISE EXCEPTION 'PASSWORD_SIGNIN_POLICY_REQUIRED'; END IF;
END;
$preflight$;

CREATE FUNCTION public.admin_set_business_seats(
 p_workspace_id uuid, p_total_seats integer, p_expected_version integer,
 p_confirmation_name text, p_reason text
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE w public.budget_workspaces%rowtype; s public.workspace_subscriptions%rowtype; used integer;
BEGIN
 PERFORM mushavo_email_auth.require_application_session();
 IF auth.uid() IS NULL OR public.my_account_suspended() OR NOT public.is_platform_staff(ARRAY['super_admin'])
 THEN RAISE EXCEPTION 'SUPER_ADMIN_REQUIRED'; END IF;
 IF p_total_seats IS NULL OR p_total_seats NOT BETWEEN 1 AND 100
 OR char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 1000
 THEN RAISE EXCEPTION 'INVALID_BUSINESS_SEAT_ALLOWANCE'; END IF;
 SELECT * INTO w FROM public.budget_workspaces WHERE id=p_workspace_id AND workspace_type='business' FOR UPDATE;
 IF w.id IS NULL OR w.status<>'active' THEN RAISE EXCEPTION 'ACTIVE_BUSINESS_WORKSPACE_REQUIRED'; END IF;
 IF btrim(coalesce(p_confirmation_name,''))<>w.name THEN RAISE EXCEPTION 'WORKSPACE_NAME_CONFIRMATION_REQUIRED'; END IF;
 SELECT * INTO s FROM public.workspace_subscriptions WHERE workspace_id=w.id FOR UPDATE;
 IF s.id IS NULL OR s.status<>'active' OR s.paid_through_at IS NULL OR s.paid_through_at<=now()
 THEN RAISE EXCEPTION 'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED'; END IF;
 IF p_expected_version IS DISTINCT FROM s.version THEN RAISE EXCEPTION 'SUBSCRIPTION_CHANGED_REFRESH_DETAILS'; END IF;
 IF s.business_next_effective_at>now() THEN RAISE EXCEPTION 'SCHEDULED_SEAT_CHANGE_REQUIRES_REVIEW'; END IF;
 IF EXISTS(SELECT 1 FROM public.subscription_payments WHERE workspace_id=w.id AND status='pending_review')
 OR EXISTS(SELECT 1 FROM public.subscription_renewal_requests WHERE workspace_id=w.id AND status='pending_review')
 THEN RAISE EXCEPTION 'RESOLVE_PENDING_BUSINESS_PAYMENT_FIRST'; END IF;
 used:=public.business_billing_usage(w.id);
 IF p_total_seats<used THEN RAISE EXCEPTION 'BUSINESS_CAPACITY_BELOW_USAGE'; END IF;
 IF p_total_seats=public.business_effective_member_limit(w.id) THEN RETURN p_total_seats; END IF;
 UPDATE public.workspace_subscriptions SET member_limit=p_total_seats,
 business_next_member_limit=NULL,business_next_effective_at=NULL,version=version+1,updated_at=now()
 WHERE workspace_id=w.id;
 UPDATE public.business_subscription_quotes SET status='cancelled' WHERE workspace_id=w.id AND status='quoted';
 INSERT INTO public.subscription_audit_events(workspace_id,actor_id,action,target_type,target_id,safe_details)
 VALUES(w.id,auth.uid(),'business.manual_seat_allowance','workspace_subscription',s.id,
 jsonb_build_object('before',CASE WHEN s.business_next_effective_at<=now() THEN s.business_next_member_limit ELSE s.member_limit END,
 'after',p_total_seats,'usage',used,'reason',btrim(p_reason),'payment_recorded',false));
 RETURN p_total_seats;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_business_seats(uuid,integer,integer,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_business_seats(uuid,integer,integer,text,text) TO authenticated;
UPDATE mushavo_email_install.rollout_control
 SET catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
 WHERE singleton AND target_project='dczlddwbtgvfdujgcitb' AND mode='ACTIVE';
NOTIFY pgrst,'reload schema';
COMMIT;
