-- Staging maintenance boundary for the browser-trust upgrade.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
SET LOCAL mushavo.email_rollout_project='dczlddwbtgvfdujgcitb';
SET LOCAL mushavo.email_rollout_action='QUARANTINE_STAGING_EMAIL';
DO $trust_quarantine$
DECLARE expected text;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_setting('session_replication_role')<>'origin'
 OR coalesce(current_setting('role',true),'none') NOT IN ('none','postgres')
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_PRIVILEGED_ORIGIN_REQUIRED'; END IF;
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
 WHERE singleton AND target_project='dczlddwbtgvfdujgcitb' AND mode IN ('QUARANTINED','ACTIVE') FOR UPDATE;
 IF expected IS NULL OR expected IS DISTINCT FROM mushavo_email_install.catalog_identity()
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_KNOWN_STAGING_CATALOG_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='mushavo_email_auth.devices'::regclass AND attname='enrollment_method' AND NOT attisdropped)
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_ALREADY_INSTALLED'; END IF;
 PERFORM mushavo_email_install.quarantine();
 DELETE FROM mushavo_email_install.acceptance_window WHERE singleton AND target_project='dczlddwbtgvfdujgcitb';
END;
$trust_quarantine$;
COMMIT;

-- Staging only: permanent browser approval; keep application access QUARANTINED.
-- Select project dczlddwbtgvfdujgcitb in SQL Editor. The GUC below acknowledges the target; it is not independent identity proof.
BEGIN;
SET LOCAL statement_timeout='35s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
SET LOCAL mushavo.email_rollout_project='dczlddwbtgvfdujgcitb';
SET LOCAL mushavo.email_rollout_action='INSTALL_PERSISTENT_STAGING_BROWSER_TRUST';
DO $persistent_upgrade$
DECLARE expected text; before_catalog jsonb; previous_ack text:=coalesce(current_setting('mushavo.persistent_device_component',true),'');
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_setting('session_replication_role')<>'origin'
 OR coalesce(current_setting('role',true),'none') NOT IN ('none','postgres')
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_PRIVILEGED_ORIGIN_REQUIRED'; END IF;
 IF current_setting('mushavo.email_rollout_project',true) IS DISTINCT FROM 'dczlddwbtgvfdujgcitb'
 OR current_setting('mushavo.email_rollout_action',true) IS DISTINCT FROM 'INSTALL_PERSISTENT_STAGING_BROWSER_TRUST'
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_TARGET_ACTION_REQUIRED'; END IF;
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
 IF to_regclass('mushavo_email_install.rollout_control') IS NULL OR to_regclass('mushavo_email_install.acceptance_window') IS NULL
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_INSTALLED_STAGING_REQUIRED'; END IF;
 SELECT catalog_sha256 INTO expected FROM mushavo_email_install.rollout_control
 WHERE singleton AND target_project='dczlddwbtgvfdujgcitb' AND mode='QUARANTINED' FOR UPDATE;
 IF expected IS NULL OR expected IS DISTINCT FROM mushavo_email_install.catalog_identity()
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_QUARANTINED_CATALOG_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM mushavo_email_install.acceptance_window WHERE expires_at>clock_timestamp())
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_CLOSED_WINDOW_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner JOIN pg_language l ON l.oid=p.prolang
 WHERE p.oid=to_regprocedure('mushavo_email_auth.session_valid(uuid,uuid)') AND r.rolname='postgres' AND l.lanname='sql'
 AND p.prosecdef AND p.provolatile='s' AND NOT p.proisstrict AND NOT p.proleakproof AND p.proparallel='u'
 AND p.proconfig=ARRAY['search_path=pg_catalog']::text[] AND p.prorettype='boolean'::regtype
 AND NOT has_function_privilege('anon',p.oid,'EXECUTE') AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
 AND NOT has_function_privilege('service_role',p.oid,'EXECUTE')
 AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') IN ('1a9deca016cde542c78d89dae6a5d7e8b4cd2950a1bd6567c229421b3b36d302','404376091f90e14420daf1fd995fd8da0fcb614db75694824a4cca274625798e'))
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_BOUNDED_PREDICATE_REQUIRED'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE policyname='Email verified session required')<>82
 OR (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace
 AND position('PERFORM mushavo_email_auth.require_application_session();' in prosrc)>0)<>148
 OR (SELECT count(*) FROM pg_class WHERE relnamespace='mushavo_email_auth'::regnamespace AND relkind='r'
 AND relrowsecurity AND relforcerowsecurity AND relname IN ('account_state','send_events','challenges','devices','session_proofs'))<>5
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_GUARD_INVENTORY_REQUIRED'; END IF;
 before_catalog:=(SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),
 pg_get_functiondef(p.oid),r.rolname,p.proacl::text) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
 WHERE n.nspname IN ('public','storage','mushavo_email_auth','mushavo_email_install') AND p.prokind='f'
 AND p.oid NOT IN ('public.email_gate_verify_challenge(uuid,uuid,uuid,text,text)'::regprocedure,
 'public.email_gate_restore_device(uuid,uuid,text)'::regprocedure,'mushavo_email_auth.invalidate_user(uuid)'::regprocedure)
 AND NOT (n.nspname='public' AND p.proname='email_gate_register_link_device')),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname) FROM pg_policies p
 WHERE schemaname IN ('public','storage','mushavo_email_auth','mushavo_email_install')),
 'relations',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,r.rolname,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text)
 ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner
 WHERE n.nspname IN ('public','storage','mushavo_email_auth','mushavo_email_install') AND c.relkind IN ('r','p','v','m','f','S')),
 'schemas',(SELECT jsonb_agg(jsonb_build_array(n.nspname,n.nspowner,n.nspacl::text) ORDER BY n.nspname)
 FROM pg_namespace n WHERE n.nspname IN ('public','storage','mushavo_email_auth','mushavo_email_install')),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid))
 ORDER BY n.nspname,c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE NOT t.tgisinternal AND n.nspname IN ('public','auth','storage','mushavo_email_auth','mushavo_email_install')),
 'window',(SELECT jsonb_agg(to_jsonb(w)) FROM mushavo_email_install.acceptance_window w),
 'control',(SELECT jsonb_agg(jsonb_build_array(singleton,target_project,mode)) FROM mushavo_email_install.rollout_control)));
 PERFORM set_config('mushavo.persistent_device_component','VERIFIED_INSTALLER_OR_OFFLINE_REVIEW',true);
 EXECUTE $persistent_component$
-- Internal reviewed component. Execute only inside the guarded staging installer or isolated tests.
-- Trusted browser approvals have no application deadline; codes still expire after ten minutes.
DO $persistent_guard$
DECLARE item record; definition text;
BEGIN
 IF current_setting('mushavo.persistent_device_component',true) IS DISTINCT FROM 'VERIFIED_INSTALLER_OR_OFFLINE_REVIEW'
 OR current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('session_replication_role')<>'origin'
 OR coalesce(current_setting('role',true),'none') NOT IN ('none','postgres')
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_PRIVILEGED_COMPONENT_ACK_REQUIRED'; END IF;
 IF to_regclass('mushavo_email_auth.devices') IS NULL
 OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='mushavo_email_auth.devices'::regclass AND attname='enrollment_method' AND NOT attisdropped)
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_BASELINE_OR_FRESH_COMPONENT_REQUIRED'; END IF;
 FOR item IN SELECT key AS name,value AS hashes FROM jsonb_each('{"public.email_gate_verify_challenge":["779fc0fb51e755ece9e8baaedd6b7d94ca7c98d1055e327f11b936f31d19fe84","f94885f378ac01bced7dab7d1251760fa12517f709fe70bb54de54f1115dae58"],"public.email_gate_restore_device":["c12c491b7d422b8424b9b7b5111e034804b2490df5098cb7941d536aa41da7d1","afb4d32ab07c98d531b051a89a1e2bb24440dee8246b0339624070644539e154"],"mushavo_email_auth.invalidate_user":["51b4ff974087798d8c0cc00edf8a3d46e3147ee3e4cc9e95583983b5985be14e","ae3ac9596bb40e0b32fd78422d10c6b9292272cad0e3a70d20017eec015eb083"]}'::jsonb) LOOP
  SELECT prosrc INTO definition FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
   WHERE p.oid=to_regprocedure(item.name||CASE WHEN item.name='public.email_gate_verify_challenge' THEN '(uuid,uuid,uuid,text,text)' WHEN item.name='public.email_gate_restore_device' THEN '(uuid,uuid,text)' ELSE '(uuid)' END)
   AND r.rolname='postgres' AND p.prosecdef AND p.proconfig=ARRAY['search_path=pg_catalog'];
  IF definition IS NULL OR NOT item.hashes ? encode(sha256(convert_to(definition,'UTF8')),'hex')
  THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_ROUTINE_BASELINE_REQUIRED'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='mushavo_email_auth.devices'::regclass AND conname='devices_check'
  AND pg_get_constraintdef(oid)='CHECK ((expires_at = (verified_at + ''168:00:00''::interval)))')
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_EXPIRY_BASELINE_REQUIRED'; END IF;
END;
$persistent_guard$;
ALTER TABLE mushavo_email_auth.account_state ADD COLUMN security_changed_at timestamptz NOT NULL DEFAULT '-infinity';
-- A pre-upgrade email bearer must not reenroll a browser after an unknown older reset.
UPDATE mushavo_email_auth.account_state SET security_changed_at=clock_timestamp();
ALTER TABLE mushavo_email_auth.devices DROP CONSTRAINT devices_check;
ALTER TABLE mushavo_email_auth.devices ADD CONSTRAINT devices_approval_deadline_check
 CHECK(expires_at='infinity'::timestamptz OR expires_at=verified_at+interval '168 hours');
ALTER TABLE mushavo_email_auth.devices ALTER COLUMN origin_challenge_id DROP NOT NULL;
ALTER TABLE mushavo_email_auth.devices ADD COLUMN enrollment_method text NOT NULL DEFAULT 'email_code'
 CHECK(enrollment_method IN ('email_code','signup_link'));
-- No Auth-session FK: trusted-browser approval must survive sign-out/session deletion.
ALTER TABLE mushavo_email_auth.devices ADD COLUMN origin_link_session uuid;
ALTER TABLE mushavo_email_auth.devices ADD CONSTRAINT devices_enrollment_origin_check CHECK(
 (enrollment_method='email_code' AND origin_challenge_id IS NOT NULL AND origin_link_session IS NULL)
 OR (enrollment_method='signup_link' AND origin_challenge_id IS NULL AND origin_link_session IS NOT NULL));
CREATE UNIQUE INDEX email_link_device_once_per_session ON mushavo_email_auth.devices(user_id,origin_link_session,security_version)
 WHERE enrollment_method='signup_link';
-- Preserve valid existing approvals; expired/revoked/version-invalid approvals are not resurrected.
UPDATE mushavo_email_auth.devices d SET expires_at='infinity'
 FROM mushavo_email_auth.account_state a
 WHERE a.user_id=d.user_id AND a.security_version=d.security_version
 AND d.revoked_at IS NULL AND d.expires_at>clock_timestamp();
CREATE OR REPLACE FUNCTION public.email_gate_verify_challenge(
 p_user uuid,p_session uuid,p_challenge uuid,p_code_mac text,p_device_digest text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v bigint; c mushavo_email_auth.challenges; d uuid; t timestamptz;
BEGIN
 IF p_code_mac IS NULL OR p_code_mac !~ '^[0-9a-f]{64}$'
 OR (p_device_digest IS NOT NULL AND p_device_digest !~ '^[0-9a-f]{64}$')
 THEN RETURN jsonb_build_object('result','INVALID'); END IF;
 v:=mushavo_email_auth.lock_actor(p_user,p_session);
 SELECT * INTO c FROM mushavo_email_auth.challenges WHERE id=p_challenge
  AND user_id=p_user AND session_id=p_session FOR UPDATE;
 IF NOT FOUND OR c.security_version<>v OR c.state<>'ready' OR c.expires_at<=clock_timestamp()
 THEN RETURN jsonb_build_object('result','UNAVAILABLE'); END IF;
 IF c.remember_device IS DISTINCT FROM (p_device_digest IS NOT NULL)
 THEN RETURN jsonb_build_object('result','INVALID'); END IF;
 IF c.attempts>=5 THEN RETURN jsonb_build_object('result','LOCKED'); END IF;
 IF NOT mushavo_email_auth.same_digest(c.code_mac,p_code_mac) THEN
  UPDATE mushavo_email_auth.challenges SET attempts=attempts+1,
   state=CASE WHEN attempts+1>=5 THEN 'locked' ELSE state END WHERE id=c.id;
  RETURN jsonb_build_object('result',CASE WHEN c.attempts+1>=5 THEN 'LOCKED' ELSE 'CODE_REJECTED' END);
 END IF;
 IF p_device_digest IS NOT NULL AND EXISTS(SELECT 1 FROM mushavo_email_auth.devices WHERE credential_digest=p_device_digest)
 THEN RETURN jsonb_build_object('result','INVALID'); END IF;
 t:=clock_timestamp();
 IF c.remember_device THEN
  INSERT INTO mushavo_email_auth.devices(user_id,credential_digest,security_version,origin_challenge_id,verified_at,expires_at)
   VALUES(p_user,p_device_digest,v,c.id,t,'infinity'::timestamptz) RETURNING id INTO d;
 END IF;
 INSERT INTO mushavo_email_auth.session_proofs(session_id,user_id,security_version,source,verified_at,established_at,device_id)
  VALUES(p_session,p_user,v,'email',t,t,d)
 ON CONFLICT(session_id) DO UPDATE SET user_id=excluded.user_id,security_version=excluded.security_version,
  source=excluded.source,verified_at=excluded.verified_at,established_at=excluded.established_at,device_id=excluded.device_id;
 UPDATE mushavo_email_auth.challenges SET state='used',consumed_at=t WHERE id=c.id;
 RETURN jsonb_build_object('result','VERIFIED','device_persistent',d IS NOT NULL,'device_expires_at',NULL);
END;
$body$;

CREATE OR REPLACE FUNCTION public.email_gate_restore_device(p_user uuid,p_session uuid,p_device_digest text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v bigint; d mushavo_email_auth.devices;
BEGIN
 IF p_device_digest IS NULL OR p_device_digest !~ '^[0-9a-f]{64}$' THEN RETURN jsonb_build_object('result','INVALID'); END IF;
 v:=mushavo_email_auth.lock_actor(p_user,p_session);
 SELECT * INTO d FROM mushavo_email_auth.devices WHERE user_id=p_user AND credential_digest=p_device_digest
  AND security_version=v AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('result','CODE_REQUIRED'); END IF;
 INSERT INTO mushavo_email_auth.session_proofs(session_id,user_id,security_version,source,verified_at,established_at,device_id)
  VALUES(p_session,p_user,v,'device',d.verified_at,clock_timestamp(),d.id)
 ON CONFLICT(session_id) DO UPDATE SET user_id=excluded.user_id,security_version=excluded.security_version,
  source=excluded.source,verified_at=excluded.verified_at,established_at=excluded.established_at,device_id=excluded.device_id;
 RETURN jsonb_build_object('result','APPROVED','device_persistent',d.expires_at='infinity'::timestamptz,
  'device_expires_at',CASE WHEN isfinite(d.expires_at) THEN d.expires_at ELSE NULL END);
END;
$body$;

CREATE OR REPLACE FUNCTION mushavo_email_auth.invalidate_user(p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
BEGIN
 -- Track a reset even before this account has enrolled its first browser.
 INSERT INTO mushavo_email_auth.account_state AS existing(user_id,security_changed_at)
 VALUES(p_user,clock_timestamp()) ON CONFLICT(user_id) DO UPDATE
 SET security_version=existing.security_version+1,security_changed_at=excluded.security_changed_at;
 UPDATE mushavo_email_auth.devices SET revoked_at=coalesce(revoked_at,clock_timestamp()) WHERE user_id=p_user;
 UPDATE mushavo_email_auth.challenges SET state='superseded'
  WHERE user_id=p_user AND state IN ('pending_delivery','ready');
 DELETE FROM mushavo_email_auth.session_proofs WHERE user_id=p_user;
END;
$body$;

-- Gateway validates the exact bearer with Auth and derives these values from fresh signed email AMR.
-- The digest comes from the secure HttpOnly browser cookie, never a JS/device-fingerprint flag.
CREATE FUNCTION public.email_gate_register_link_device(
 p_user uuid,p_session uuid,p_device_digest text,p_proof_at timestamptz,p_allow_new boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v bigint; t timestamptz; confirmed timestamptz; changed timestamptz; d mushavo_email_auth.devices;
BEGIN
 t:=clock_timestamp();
 IF p_allow_new IS NULL OR p_device_digest IS NULL OR p_device_digest !~ '^[0-9a-f]{64}$' OR p_proof_at IS NULL
 OR NOT isfinite(p_proof_at) OR p_proof_at<t-interval '5 minutes' OR p_proof_at>t+interval '30 seconds'
 THEN RETURN jsonb_build_object('result','LINK_PROOF_REQUIRED'); END IF;
 v:=mushavo_email_auth.lock_actor(p_user,p_session);
 SELECT email_confirmed_at INTO STRICT confirmed FROM auth.users WHERE id=p_user;
 SELECT security_changed_at INTO STRICT changed FROM mushavo_email_auth.account_state WHERE user_id=p_user;
 IF p_proof_at<changed OR abs(extract(epoch FROM(confirmed-p_proof_at)))>120
 THEN RETURN jsonb_build_object('result','LINK_PROOF_REQUIRED'); END IF;
 SELECT * INTO d FROM mushavo_email_auth.devices
 WHERE user_id=p_user AND origin_link_session=p_session AND security_version=v AND enrollment_method='signup_link' FOR UPDATE;
 IF FOUND THEN
  IF d.revoked_at IS NULL AND d.expires_at='infinity'::timestamptz
   AND mushavo_email_auth.same_digest(d.credential_digest,p_device_digest)
  THEN RETURN jsonb_build_object('result','TRUSTED','persistent',true); END IF;
  RETURN jsonb_build_object('result','LINK_ALREADY_REGISTERED');
 END IF;
 IF NOT p_allow_new THEN RETURN jsonb_build_object('result','PENDING_REQUIRED'); END IF;
 IF EXISTS(SELECT 1 FROM mushavo_email_auth.devices WHERE credential_digest=p_device_digest)
 THEN RETURN jsonb_build_object('result','INVALID'); END IF;
 INSERT INTO mushavo_email_auth.devices(user_id,credential_digest,security_version,origin_challenge_id,
  verified_at,expires_at,enrollment_method,origin_link_session)
 VALUES(p_user,p_device_digest,v,NULL,t,'infinity','signup_link',p_session);
 -- No application proof is created here. Normal password sign-in restores this browser's proof.
 RETURN jsonb_build_object('result','TRUSTED','persistent',true);
END;
$body$;
REVOKE ALL ON FUNCTION public.email_gate_register_link_device(uuid,uuid,text,timestamptz,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.email_gate_register_link_device(uuid,uuid,text,timestamptz,boolean) TO service_role;
-- CREATE OR REPLACE preserves the existing ACLs of verify/restore/invalidate. Explicitly reassert them.
REVOKE ALL ON FUNCTION public.email_gate_verify_challenge(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.email_gate_verify_challenge(uuid,uuid,uuid,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.email_gate_restore_device(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.email_gate_restore_device(uuid,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION mushavo_email_auth.invalidate_user(uuid) FROM PUBLIC,anon,authenticated,service_role;
$persistent_component$;
 PERFORM set_config('mushavo.persistent_device_component',previous_ack,true);
 IF (SELECT count(*) FROM pg_policies WHERE policyname='Email verified session required')<>82
 OR (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace
 AND position('PERFORM mushavo_email_auth.require_application_session();' in prosrc)>0)<>148
 OR (SELECT count(*) FROM pg_class WHERE relnamespace='mushavo_email_auth'::regnamespace AND relkind='r'
 AND relrowsecurity AND relforcerowsecurity AND relname IN ('account_state','send_events','challenges','devices','session_proofs'))<>5
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_GUARD_INVENTORY_REQUIRED'; END IF;
 IF before_catalog IS DISTINCT FROM (SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),
 pg_get_functiondef(p.oid),r.rolname,p.proacl::text) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
 WHERE n.nspname IN ('public','storage','mushavo_email_auth','mushavo_email_install') AND p.prokind='f'
 AND p.oid NOT IN ('public.email_gate_verify_challenge(uuid,uuid,uuid,text,text)'::regprocedure,
 'public.email_gate_restore_device(uuid,uuid,text)'::regprocedure,'mushavo_email_auth.invalidate_user(uuid)'::regprocedure)
 AND NOT (n.nspname='public' AND p.proname='email_gate_register_link_device')),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname) FROM pg_policies p
 WHERE schemaname IN ('public','storage','mushavo_email_auth','mushavo_email_install')),
 'relations',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,r.rolname,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text)
 ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner
 WHERE n.nspname IN ('public','storage','mushavo_email_auth','mushavo_email_install') AND c.relkind IN ('r','p','v','m','f','S')),
 'schemas',(SELECT jsonb_agg(jsonb_build_array(n.nspname,n.nspowner,n.nspacl::text) ORDER BY n.nspname)
 FROM pg_namespace n WHERE n.nspname IN ('public','storage','mushavo_email_auth','mushavo_email_install')),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid))
 ORDER BY n.nspname,c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE NOT t.tgisinternal AND n.nspname IN ('public','auth','storage','mushavo_email_auth','mushavo_email_install')),
 'window',(SELECT jsonb_agg(to_jsonb(w)) FROM mushavo_email_install.acceptance_window w),
 'control',(SELECT jsonb_agg(jsonb_build_array(singleton,target_project,mode)) FROM mushavo_email_install.rollout_control)))
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_PROTECTED_CATALOG_CHANGED'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c CROSS JOIN unnest(ARRAY['anon','authenticated','service_role']) r
 WHERE c.relnamespace='mushavo_email_auth'::regnamespace AND c.relkind='r'
 AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity
 OR has_table_privilege(r,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')))
 OR has_function_privilege('anon','public.email_gate_register_link_device(uuid,uuid,text,timestamptz,boolean)','EXECUTE')
 OR has_function_privilege('authenticated','public.email_gate_register_link_device(uuid,uuid,text,timestamptz,boolean)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.email_gate_register_link_device(uuid,uuid,text,timestamptz,boolean)','EXECUTE')
 THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_PRIVATE_AUTHORITY_REQUIRED'; END IF;
 UPDATE mushavo_email_install.rollout_control SET catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
 WHERE singleton AND target_project='dczlddwbtgvfdujgcitb' AND mode='QUARANTINED';
 IF NOT FOUND THEN RAISE EXCEPTION 'PERSISTENT_DEVICE_QUARANTINE_LOST'; END IF;
END;
$persistent_upgrade$;
NOTIFY pgrst,'reload schema';
SELECT jsonb_build_object('result','PERSISTENT_BROWSER_TRUST_INSTALLED_QUARANTINED',
 'guarded_RPCs',148,'restrictive_policies',82,'application_access_opened',false,'hosted_acceptance',false,
 'catalog_identity_matched',catalog_sha256=mushavo_email_install.catalog_identity()) AS result
 FROM mushavo_email_install.rollout_control WHERE singleton AND mode='QUARANTINED';
COMMIT;
