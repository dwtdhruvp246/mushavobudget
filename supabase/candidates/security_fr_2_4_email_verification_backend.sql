-- FR.2.4.E2 OFFLINE SOURCE CANDIDATE ONLY. Not a hosted installation handoff.
-- No public data policies or existing application functions are replaced here.
-- Service callers must validate the real Auth bearer and derive actor/session IDs.
BEGIN;
SET LOCAL statement_timeout='20s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
DO $guard$
BEGIN
 IF current_setting('mushavo.email_backend_review',true) IS DISTINCT FROM 'OFFLINE_SOURCE_CANDIDATE'
 THEN RAISE EXCEPTION 'EMAIL_BACKEND_OFFLINE_REVIEW_ACK_REQUIRED'; END IF;
 IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'EMAIL_BACKEND_PRIVILEGED_REVIEW_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='mushavo_email_auth')
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND left(p.proname,11)='email_gate_')
 THEN RAISE EXCEPTION 'EMAIL_BACKEND_NAMESPACE_ALREADY_EXISTS'; END IF;
 PERFORM id,user_id,not_after FROM auth.sessions LIMIT 0;
 PERFORM id,email_confirmed_at,encrypted_password,banned_until FROM auth.users LIMIT 0;
 PERFORM id,account_status FROM public.profiles LIMIT 0;
END;
$guard$;

CREATE SCHEMA mushavo_email_auth;
REVOKE ALL ON SCHEMA mushavo_email_auth FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE mushavo_email_auth.account_state (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 security_version bigint NOT NULL DEFAULT 1 CHECK(security_version>0),
 next_send_at timestamptz NOT NULL DEFAULT '-infinity'
);
CREATE TABLE mushavo_email_auth.send_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES mushavo_email_auth.account_state(user_id) ON DELETE CASCADE,
 reserved_at timestamptz NOT NULL
);
CREATE INDEX email_send_actor_time ON mushavo_email_auth.send_events(user_id,reserved_at);
CREATE TABLE mushavo_email_auth.challenges (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES mushavo_email_auth.account_state(user_id) ON DELETE CASCADE,
 session_id uuid NOT NULL REFERENCES auth.sessions(id) ON DELETE CASCADE,
 security_version bigint NOT NULL CHECK(security_version>0),
 code_mac text NOT NULL CHECK(code_mac ~ '^[0-9a-f]{64}$'),
 key_version text NOT NULL CHECK(key_version ~ '^[A-Za-z0-9_-]{1,32}$'),
 remember_device boolean NOT NULL,
 state text NOT NULL CHECK(state IN ('pending_delivery','ready','used','superseded','failed','locked')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 issued_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 delivered_at timestamptz,
 consumed_at timestamptz,
 CHECK(expires_at=issued_at+interval '10 minutes')
);
CREATE INDEX email_challenge_actor_session ON mushavo_email_auth.challenges(user_id,session_id,state);
CREATE TABLE mushavo_email_auth.devices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES mushavo_email_auth.account_state(user_id) ON DELETE CASCADE,
 credential_digest text NOT NULL UNIQUE CHECK(credential_digest ~ '^[0-9a-f]{64}$'),
 security_version bigint NOT NULL CHECK(security_version>0),
 origin_challenge_id uuid NOT NULL,
 verified_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 CHECK(expires_at=verified_at+interval '168 hours')
);
CREATE INDEX email_device_actor ON mushavo_email_auth.devices(user_id);
CREATE TABLE mushavo_email_auth.session_proofs (
 session_id uuid PRIMARY KEY REFERENCES auth.sessions(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES mushavo_email_auth.account_state(user_id) ON DELETE CASCADE,
 security_version bigint NOT NULL CHECK(security_version>0),
 source text NOT NULL CHECK(source IN ('email','device')),
 verified_at timestamptz NOT NULL,
 established_at timestamptz NOT NULL,
 device_id uuid REFERENCES mushavo_email_auth.devices(id) ON DELETE CASCADE
);
CREATE INDEX email_proof_actor ON mushavo_email_auth.session_proofs(user_id);
DO $rls$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['account_state','send_events','challenges','devices','session_proofs'] LOOP
  EXECUTE format('ALTER TABLE mushavo_email_auth.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE mushavo_email_auth.%I FORCE ROW LEVEL SECURITY',t);
 END LOOP;
END;
$rls$;
REVOKE ALL ON ALL TABLES IN SCHEMA mushavo_email_auth FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION mushavo_email_auth.same_digest(a text,b text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT SET search_path=pg_catalog AS $body$
DECLARE x bytea; y bytea; difference integer:=0; i integer;
BEGIN
 IF a !~ '^[0-9a-f]{64}$' OR b !~ '^[0-9a-f]{64}$' THEN RETURN false; END IF;
 x:=decode(a,'hex'); y:=decode(b,'hex');
 FOR i IN 0..31 LOOP difference:=difference | (get_byte(x,i) # get_byte(y,i)); END LOOP;
 RETURN difference=0;
END;
$body$;

-- Serialize mutations by actor. The Auth session must exist and belong to actor.
CREATE FUNCTION mushavo_email_auth.lock_actor(p_user uuid,p_session uuid) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v bigint;
BEGIN
 IF p_user IS NULL OR p_session IS NULL THEN RAISE EXCEPTION 'EMAIL_ACTOR_SESSION_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users u JOIN auth.sessions s ON s.user_id=u.id
  JOIN public.profiles p ON p.id=u.id WHERE u.id=p_user AND s.id=p_session
  AND u.email_confirmed_at IS NOT NULL AND p.account_status='active'
  AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp())
  AND (s.not_after IS NULL OR s.not_after>clock_timestamp()))
 THEN RAISE EXCEPTION 'EMAIL_ACTIVE_AUTH_SESSION_REQUIRED'; END IF;
 INSERT INTO mushavo_email_auth.account_state(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
 SELECT security_version INTO STRICT v FROM mushavo_email_auth.account_state
  WHERE user_id=p_user FOR UPDATE;
 PERFORM 1 FROM auth.users u JOIN auth.sessions s ON s.user_id=u.id
  JOIN public.profiles p ON p.id=u.id WHERE u.id=p_user AND s.id=p_session
  AND u.email_confirmed_at IS NOT NULL AND p.account_status='active'
  AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp())
  AND (s.not_after IS NULL OR s.not_after>clock_timestamp()) FOR KEY SHARE OF s;
 IF NOT FOUND THEN RAISE EXCEPTION 'EMAIL_ACTIVE_AUTH_SESSION_REQUIRED'; END IF;
 RETURN v;
END;
$body$;

CREATE FUNCTION mushavo_email_auth.session_valid(p_user uuid,p_session uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
 SELECT EXISTS(SELECT 1 FROM mushavo_email_auth.session_proofs proof
  JOIN mushavo_email_auth.account_state a ON a.user_id=proof.user_id
  JOIN auth.users u ON u.id=proof.user_id
  JOIN auth.sessions s ON s.id=proof.session_id AND s.user_id=u.id
  JOIN public.profiles p ON p.id=u.id
  WHERE proof.user_id=p_user AND proof.session_id=p_session
  AND proof.security_version=a.security_version AND u.email_confirmed_at IS NOT NULL
  AND p.account_status='active' AND (u.banned_until IS NULL OR u.banned_until<=statement_timestamp())
  AND (s.not_after IS NULL OR s.not_after>statement_timestamp()));
$body$;

CREATE FUNCTION mushavo_email_auth.invalidate_user(p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
BEGIN
 UPDATE mushavo_email_auth.account_state SET security_version=security_version+1 WHERE user_id=p_user;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE mushavo_email_auth.devices SET revoked_at=coalesce(revoked_at,clock_timestamp()) WHERE user_id=p_user;
 UPDATE mushavo_email_auth.challenges SET state='superseded'
  WHERE user_id=p_user AND state IN ('pending_delivery','ready');
 DELETE FROM mushavo_email_auth.session_proofs WHERE user_id=p_user;
END;
$body$;

CREATE FUNCTION public.email_gate_begin_challenge(
 p_user uuid,p_session uuid,p_challenge uuid,p_code_mac text,p_key_version text,p_remember boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v bigint; a mushavo_email_auth.account_state; t timestamptz;
BEGIN
 IF p_challenge IS NULL OR p_code_mac IS NULL OR p_code_mac !~ '^[0-9a-f]{64}$'
 OR p_key_version IS NULL OR p_key_version !~ '^[A-Za-z0-9_-]{1,32}$' OR p_remember IS NULL
 THEN RETURN jsonb_build_object('result','INVALID'); END IF;
 v:=mushavo_email_auth.lock_actor(p_user,p_session); t:=clock_timestamp();
 SELECT * INTO STRICT a FROM mushavo_email_auth.account_state WHERE user_id=p_user;
 IF a.next_send_at>t THEN RETURN jsonb_build_object('result','COOLDOWN'); END IF;
 DELETE FROM mushavo_email_auth.send_events WHERE user_id=p_user AND reserved_at<=t-interval '1 hour';
 IF (SELECT count(*) FROM mushavo_email_auth.send_events WHERE user_id=p_user)>=5
 THEN RETURN jsonb_build_object('result','RATE_LIMIT'); END IF;
 IF EXISTS(SELECT 1 FROM mushavo_email_auth.challenges WHERE id=p_challenge)
 THEN RETURN jsonb_build_object('result','INVALID'); END IF;
 UPDATE mushavo_email_auth.challenges SET state='superseded'
  WHERE user_id=p_user AND session_id=p_session AND state IN ('pending_delivery','ready');
 INSERT INTO mushavo_email_auth.challenges(id,user_id,session_id,security_version,code_mac,key_version,
  remember_device,state,issued_at,expires_at)
 VALUES(p_challenge,p_user,p_session,v,p_code_mac,p_key_version,p_remember,'pending_delivery',t,t+interval '10 minutes');
 INSERT INTO mushavo_email_auth.send_events(user_id,reserved_at) VALUES(p_user,t);
 UPDATE mushavo_email_auth.account_state SET next_send_at=t+interval '60 seconds' WHERE user_id=p_user;
 RETURN jsonb_build_object('result','PENDING_DELIVERY','challenge_id',p_challenge,'expires_at',t+interval '10 minutes');
END;
$body$;

CREATE FUNCTION public.email_gate_set_delivery(p_user uuid,p_session uuid,p_challenge uuid,p_delivered boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v bigint;
BEGIN
 IF p_delivered IS NULL THEN RETURN jsonb_build_object('result','INVALID'); END IF;
 v:=mushavo_email_auth.lock_actor(p_user,p_session);
 UPDATE mushavo_email_auth.challenges SET state=CASE WHEN p_delivered THEN 'ready' ELSE 'failed' END,
  delivered_at=CASE WHEN p_delivered THEN clock_timestamp() ELSE NULL END
 WHERE id=p_challenge AND user_id=p_user AND session_id=p_session AND security_version=v
  AND state='pending_delivery' AND expires_at>clock_timestamp();
 IF NOT FOUND THEN RETURN jsonb_build_object('result','UNAVAILABLE'); END IF;
 RETURN jsonb_build_object('result',CASE WHEN p_delivered THEN 'READY' ELSE 'DELIVERY_FAILED' END);
END;
$body$;

-- Only the trusted mail adapter can read this bounded context; no expected MAC/code is returned.
CREATE FUNCTION public.email_gate_challenge_context(p_user uuid,p_session uuid,p_challenge uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
 SELECT jsonb_build_object('key_version',c.key_version,'remember_device',c.remember_device,'expires_at',c.expires_at)
 FROM mushavo_email_auth.challenges c
 JOIN mushavo_email_auth.account_state a ON a.user_id=c.user_id AND a.security_version=c.security_version
 JOIN auth.users u ON u.id=c.user_id JOIN public.profiles p ON p.id=u.id
 JOIN auth.sessions s ON s.id=c.session_id AND s.user_id=u.id
 WHERE c.id=p_challenge AND c.user_id=p_user AND c.session_id=p_session
  AND c.state='ready' AND c.expires_at>statement_timestamp() AND c.attempts<5
  AND u.email_confirmed_at IS NOT NULL AND p.account_status='active'
  AND (u.banned_until IS NULL OR u.banned_until<=statement_timestamp())
  AND (s.not_after IS NULL OR s.not_after>statement_timestamp());
$body$;

CREATE FUNCTION public.email_gate_verify_challenge(
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
   VALUES(p_user,p_device_digest,v,c.id,t,t+interval '168 hours') RETURNING id INTO d;
 END IF;
 INSERT INTO mushavo_email_auth.session_proofs(session_id,user_id,security_version,source,verified_at,established_at,device_id)
  VALUES(p_session,p_user,v,'email',t,t,d)
 ON CONFLICT(session_id) DO UPDATE SET user_id=excluded.user_id,security_version=excluded.security_version,
  source=excluded.source,verified_at=excluded.verified_at,established_at=excluded.established_at,device_id=excluded.device_id;
 UPDATE mushavo_email_auth.challenges SET state='used',consumed_at=t WHERE id=c.id;
 RETURN jsonb_build_object('result','VERIFIED','device_expires_at',CASE WHEN d IS NOT NULL THEN t+interval '168 hours' END);
END;
$body$;

CREATE FUNCTION public.email_gate_restore_device(p_user uuid,p_session uuid,p_device_digest text)
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
 RETURN jsonb_build_object('result','APPROVED','device_expires_at',d.expires_at);
END;
$body$;

CREATE FUNCTION public.email_gate_revoke_device(p_user uuid,p_session uuid,p_device_digest text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE d uuid;
BEGIN
 PERFORM mushavo_email_auth.lock_actor(p_user,p_session);
 IF NOT mushavo_email_auth.session_valid(p_user,p_session) THEN RETURN jsonb_build_object('result','VERIFICATION_REQUIRED'); END IF;
 UPDATE mushavo_email_auth.devices SET revoked_at=coalesce(revoked_at,clock_timestamp())
  WHERE user_id=p_user AND credential_digest=p_device_digest RETURNING id INTO d;
 IF NOT FOUND THEN RETURN jsonb_build_object('result','NOT_FOUND'); END IF;
 DELETE FROM mushavo_email_auth.session_proofs WHERE user_id=p_user AND device_id=d;
 RETURN jsonb_build_object('result','REVOKED');
END;
$body$;

CREATE FUNCTION public.email_gate_revoke_all(p_user uuid,p_session uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
BEGIN
 PERFORM mushavo_email_auth.lock_actor(p_user,p_session);
 IF NOT mushavo_email_auth.session_valid(p_user,p_session) THEN RETURN jsonb_build_object('result','VERIFICATION_REQUIRED'); END IF;
 PERFORM mushavo_email_auth.invalidate_user(p_user);
 RETURN jsonb_build_object('result','REVOKED');
END;
$body$;

CREATE FUNCTION public.email_gate_session_status(p_user uuid,p_session uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
 SELECT mushavo_email_auth.session_valid(p_user,p_session);
$body$;

CREATE FUNCTION mushavo_email_auth.on_credentials_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
BEGIN
 IF NEW.email IS DISTINCT FROM OLD.email OR NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password
 OR NEW.banned_until IS DISTINCT FROM OLD.banned_until THEN
  PERFORM mushavo_email_auth.invalidate_user(NEW.id);
 END IF;
 RETURN NEW;
END;
$body$;
CREATE TRIGGER email_gate_credentials_changed AFTER UPDATE OF email,encrypted_password,banned_until ON auth.users
 FOR EACH ROW EXECUTE FUNCTION mushavo_email_auth.on_credentials_changed();
CREATE FUNCTION mushavo_email_auth.on_profile_suspended() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
BEGIN
 IF NEW.account_status IS DISTINCT FROM OLD.account_status AND NEW.account_status<>'active'
 THEN PERFORM mushavo_email_auth.invalidate_user(NEW.id); END IF;
 RETURN NEW;
END;
$body$;
CREATE TRIGGER email_gate_profile_suspended AFTER UPDATE OF account_status ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION mushavo_email_auth.on_profile_suspended();

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mushavo_email_auth FROM PUBLIC,anon,authenticated,service_role;
DO $acl$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND left(p.proname,11)='email_gate_' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END;
$acl$;
COMMIT;
