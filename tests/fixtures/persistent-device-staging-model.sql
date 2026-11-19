-- Offline model only. catalog_identity and bounded session_valid use the reviewed installed definitions.
-- Application guards/policies are synthetic counts; this is not a hosted catalog acceptance test.
CREATE SCHEMA mushavo_email_install;
CREATE TABLE mushavo_email_install.rollout_control(singleton boolean PRIMARY KEY DEFAULT true,target_project text,mode text,catalog_sha256 text,changed_at timestamptz DEFAULT clock_timestamp());
CREATE TABLE mushavo_email_install.acceptance_window(singleton boolean PRIMARY KEY DEFAULT true,target_project text,allowed_users uuid[],opened_at timestamptz,expires_at timestamptz);
ALTER TABLE mushavo_email_install.rollout_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE mushavo_email_install.rollout_control FORCE ROW LEVEL SECURITY;
ALTER TABLE mushavo_email_install.acceptance_window ENABLE ROW LEVEL SECURITY;
ALTER TABLE mushavo_email_install.acceptance_window FORCE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA mushavo_email_install FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA mushavo_email_install FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION mushavo_email_install.catalog_identity() RETURNS text
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $catalog$
 SELECT encode(sha256(convert_to(jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_array(n.nspname,p.proname,
   pg_get_function_identity_arguments(p.oid),pg_get_functiondef(p.oid),r.rolname,p.proacl::text,
   has_function_privilege('anon',p.oid,'EXECUTE'),
   has_function_privilege('authenticated',p.oid,'EXECUTE'),
   has_function_privilege('service_role',p.oid,'EXECUTE'))
   ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
   WHERE n.nspname IN ('public','storage','mushavo_email_auth','mushavo_email_install') AND p.prokind='f'),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname)
   FROM pg_policies p WHERE schemaname IN ('public','storage','mushavo_email_auth','mushavo_email_install')),
 'relations',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relkind,r.rolname,
   c.relrowsecurity,c.relforcerowsecurity,c.relacl::text,c.reloptions) ORDER BY n.nspname,c.relname)
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner
   WHERE n.nspname IN ('public','storage','mushavo_email_auth','mushavo_email_install') AND c.relkind IN ('r','p','v','m','f','S')),
 'schemas',(SELECT jsonb_agg(jsonb_build_array(n.nspname,r.rolname,n.nspacl::text,
   has_schema_privilege('anon',n.oid,'USAGE'),has_schema_privilege('authenticated',n.oid,'USAGE'),
   has_schema_privilege('service_role',n.oid,'USAGE')) ORDER BY n.nspname)
   FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner
   WHERE n.nspname IN ('public','storage','mushavo_email_auth','mushavo_email_install')),
 'columns',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,a.attname,
   a.atttypid::regtype::text,a.atttypmod,a.attnotnull,a.attidentity,a.attgenerated,
   pg_get_expr(d.adbin,d.adrelid)) ORDER BY n.nspname,c.relname,a.attnum)
   FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
   WHERE a.attnum>0 AND NOT a.attisdropped AND c.relkind IN ('r','p','v','m','f')
   AND n.nspname IN ('public','auth','storage','mushavo_email_auth','mushavo_email_install')),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,k.conname,
   pg_get_constraintdef(k.oid),k.convalidated) ORDER BY n.nspname,c.relname,k.conname)
   FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname IN ('public','auth','storage','mushavo_email_auth','mushavo_email_install')),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid))
   ORDER BY n.nspname,c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
   JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE NOT t.tgisinternal AND n.nspname IN ('public','auth','storage','mushavo_email_auth','mushavo_email_install')),
 'hooks',(SELECT jsonb_agg(jsonb_build_array(e.evtname,e.evtevent,e.evtenabled,e.evttags,
   er.rolname,pg_get_functiondef(p.oid),pr.rolname,p.proacl::text) ORDER BY e.evtname)
   FROM pg_event_trigger e JOIN pg_proc p ON p.oid=e.evtfoid
   JOIN pg_roles er ON er.oid=e.evtowner JOIN pg_roles pr ON pr.oid=p.proowner)
 )::text,'UTF8')),'hex');
$catalog$;
REVOKE ALL ON FUNCTION mushavo_email_install.catalog_identity() FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION mushavo_email_auth.session_valid(p_user uuid,p_session uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
 SELECT EXISTS(SELECT 1 FROM mushavo_email_auth.session_proofs proof
  JOIN mushavo_email_auth.account_state a ON a.user_id=proof.user_id
  JOIN auth.users u ON u.id=proof.user_id
  JOIN auth.sessions s ON s.id=proof.session_id AND s.user_id=u.id
  JOIN public.profiles p ON p.id=u.id
  WHERE proof.user_id=p_user AND proof.session_id=p_session
  AND proof.security_version=a.security_version AND u.email_confirmed_at IS NOT NULL
  AND p.account_status='active' AND (u.banned_until IS NULL OR u.banned_until<=statement_timestamp())
  AND (s.not_after IS NULL OR s.not_after>statement_timestamp()))
 AND EXISTS(SELECT 1 FROM mushavo_email_install.rollout_control
   WHERE singleton AND target_project='dczlddwbtgvfdujgcitb' AND mode='ACTIVE')
 AND EXISTS(SELECT 1 FROM mushavo_email_install.acceptance_window w
   WHERE w.singleton AND w.target_project='dczlddwbtgvfdujgcitb' AND p_user=ANY(w.allowed_users)
   AND w.opened_at<=clock_timestamp() AND w.expires_at>clock_timestamp());
$body$;

CREATE FUNCTION mushavo_email_install.quarantine() RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog SET lock_timeout='3s' AS $quarantine$
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('session_replication_role')<>'origin'
 OR coalesce(current_setting('role',true),'none') NOT IN ('none','postgres')
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'EMAIL_STAGING_PRIVILEGED_ORIGIN_REQUIRED'; END IF;
 IF current_setting('mushavo.email_rollout_project',true) IS DISTINCT FROM 'dczlddwbtgvfdujgcitb'
 THEN RAISE EXCEPTION 'EMAIL_STAGING_TARGET_ACK_REQUIRED'; END IF;
 IF current_setting('mushavo.email_rollout_action',true) IS DISTINCT FROM 'QUARANTINE_STAGING_EMAIL'
 THEN RAISE EXCEPTION 'EMAIL_STAGING_ACTION_ACK_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(20261017,2411);
 UPDATE mushavo_email_install.rollout_control SET mode='QUARANTINED',changed_at=clock_timestamp()
 WHERE singleton AND target_project='dczlddwbtgvfdujgcitb' AND mode IN ('ACTIVE','QUARANTINED')
 AND catalog_sha256 IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'EMAIL_STAGING_ACTIVE_INSTALLATION_REQUIRED'; END IF;
 RETURN jsonb_build_object('result','STAGING_EMAIL_QUARANTINED','guards_retained',true,
   'proofs_and_application_data_retained',true,'hosted_acceptance',false);
END;
$quarantine$;
REVOKE ALL ON FUNCTION mushavo_email_install.quarantine() FROM PUBLIC,anon,authenticated,service_role;
