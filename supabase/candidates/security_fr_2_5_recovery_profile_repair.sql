-- Stage 3/10 | FR.2/8 | Batch W/Z: restore only the selected ordinary account's missing profile.
-- Independently select staging dczlddwbtgvfdujgcitb. Replace only the email placeholder.
ROLLBACK;
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
SET LOCAL mushavo.recovery_profile_email='OWNER_CONTROLLED_RECOVERY_EMAIL';
DO $profile_repair$
DECLARE actor uuid; actors uuid[]; person record; control_row record;
 inserted integer:=0; action text;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('session_replication_role')<>'origin'
 OR coalesce(current_setting('role',true),'none') NOT IN ('none','postgres')
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'PROFILE_REPAIR_PRIVILEGED_UNCLAIMED_ORIGIN_REQUIRED'; END IF;
 IF auth.uid() IS NOT NULL OR coalesce(auth.role(),'')<>''
 THEN RAISE EXCEPTION 'PROFILE_REPAIR_PRIVILEGED_UNCLAIMED_ORIGIN_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(20261017,2411);
 SELECT * INTO control_row FROM mushavo_email_install.rollout_control WHERE singleton FOR UPDATE;
 IF NOT FOUND OR control_row.target_project IS DISTINCT FROM 'dczlddwbtgvfdujgcitb'
 OR control_row.mode IS NULL OR control_row.mode NOT IN ('ACTIVE','QUARANTINED')
 OR control_row.catalog_sha256 IS NULL
 OR control_row.catalog_sha256 IS DISTINCT FROM mushavo_email_install.catalog_identity()
 THEN RAISE EXCEPTION 'PROFILE_REPAIR_CURRENT_STAGING_CATALOG_REQUIRED'; END IF;
 IF (SELECT count(*) FROM pg_attribute a JOIN pg_attrdef d
 ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE a.attrelid='public.profiles'::regclass AND NOT a.attisdropped
 AND a.atttypid='text'::regtype AND a.attnotnull
 AND ((a.attname='account_status' AND pg_get_expr(d.adbin,d.adrelid)='''active''::text')
 OR (a.attname='signup_source' AND pg_get_expr(d.adbin,d.adrelid)='''self_signup''::text')))<>2
 THEN RAISE EXCEPTION 'PROFILE_REPAIR_NORMAL_DEFAULTS_REQUIRED'; END IF;
 IF (SELECT count(*) FROM pg_trigger t WHERE t.tgrelid='public.profiles'::regclass
 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND (t.tgtype::integer & 4)<>0)<>1
 OR NOT EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
 JOIN pg_roles r ON r.oid=p.proowner JOIN pg_language l ON l.oid=p.prolang
 WHERE t.tgrelid='public.profiles'::regclass AND NOT t.tgisinternal
 AND t.tgname='guard_suspended_account_write_trigger' AND t.tgenabled='O' AND t.tgtype=31
 AND t.tgqual IS NULL AND t.tgconstraint=0 AND NOT t.tgdeferrable AND NOT t.tginitdeferred
 AND cardinality(t.tgattr::smallint[])=0 AND octet_length(t.tgargs)=0
 AND p.oid=to_regprocedure('public.guard_suspended_account_write()')
 AND r.rolname='postgres' AND l.lanname='plpgsql' AND p.prosecdef
 AND p.prokind='f' AND p.pronargs=0 AND p.prorettype='trigger'::regtype
 AND p.proconfig=ARRAY['search_path=public, pg_temp']::text[]
 AND encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')=
 '9dc598f3a439dfb382b2df4811d91850d3dd8dc47c89158a8fba4cfe603bcf41')
 THEN RAISE EXCEPTION 'PROFILE_REPAIR_REVIEWED_INSERT_GUARD_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_index i
 WHERE i.indexrelid=to_regclass('public.profiles_email_unique_idx')
 AND i.indrelid='public.profiles'::regclass AND i.indisunique AND i.indisvalid AND i.indisready
 AND i.indnkeyatts=1 AND i.indnatts=1
 AND pg_get_expr(i.indexprs,i.indrelid)='lower(email)'
 AND pg_get_expr(i.indpred,i.indrelid)='(email IS NOT NULL)')
 THEN RAISE EXCEPTION 'PROFILE_REPAIR_EMAIL_UNIQUENESS_REQUIRED'; END IF;
 SELECT array_agg(id) INTO actors FROM auth.users
 WHERE lower(email)=lower(btrim(current_setting('mushavo.recovery_profile_email',true)));
 IF coalesce(cardinality(actors),0)<>1
 THEN RAISE EXCEPTION 'EXACTLY_ONE_RECOVERY_ACCOUNT_REQUIRED'; END IF;
 actor:=actors[1];
 SELECT u.id,u.email,u.email_confirmed_at,u.banned_until,
 u.raw_user_meta_data->>'full_name' AS full_name,
 u.raw_user_meta_data->>'signup_source' AS signup_source,
 u.raw_user_meta_data->>'admin_invitation_id' AS admin_invitation_id
 INTO person FROM auth.users u WHERE u.id=actor
 AND lower(u.email)=lower(btrim(current_setting('mushavo.recovery_profile_email',true))) FOR UPDATE;
 IF NOT FOUND OR person.email_confirmed_at IS NULL
 OR (person.banned_until IS NOT NULL AND person.banned_until>clock_timestamp())
 THEN RAISE EXCEPTION 'PROFILE_REPAIR_CONFIRMED_NONBANNED_ACCOUNT_REQUIRED'; END IF;
 IF coalesce(nullif(btrim(person.signup_source),''),'self_signup')<>'self_signup'
 OR coalesce(nullif(btrim(person.admin_invitation_id),''),'')<>''
 OR EXISTS(SELECT 1 FROM public.admin_user_invitations i
 WHERE i.auth_user_id=actor OR lower(i.email)=lower(person.email))
 OR EXISTS(SELECT 1 FROM public.app_admins a WHERE a.user_id=actor)
 THEN RAISE EXCEPTION 'PROFILE_REPAIR_ORDINARY_SELF_SIGNUP_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM public.profiles p WHERE lower(p.email)=lower(person.email) AND p.id<>actor)
 THEN RAISE EXCEPTION 'PROFILE_REPAIR_EMAIL_COLLISION_REVIEW_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id=actor) THEN
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor
  AND account_status='active' AND signup_source='self_signup' AND lower(email)=lower(person.email))
  THEN RAISE EXCEPTION 'PROFILE_REPAIR_EXISTING_PROFILE_REVIEW_REQUIRED'; END IF;
 ELSE
  BEGIN
   INSERT INTO public.profiles(id,full_name,email)
   VALUES(actor,coalesce(nullif(btrim(person.full_name),''),
    nullif(split_part(person.email,'@',1),''),'Mushavo user'),lower(person.email))
   ON CONFLICT(id) DO NOTHING;
   GET DIAGNOSTICS inserted=ROW_COUNT;
  EXCEPTION WHEN unique_violation THEN
   RAISE EXCEPTION 'PROFILE_REPAIR_EMAIL_COLLISION_REVIEW_REQUIRED';
  END;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor AND account_status='active'
 AND signup_source='self_signup' AND lower(email)=lower(person.email))
 OR control_row.catalog_sha256 IS DISTINCT FROM mushavo_email_install.catalog_identity()
 THEN RAISE EXCEPTION 'PROFILE_REPAIR_FINAL_STATE_REQUIRED'; END IF;
 action:=CASE WHEN inserted=1 THEN 'CREATED' ELSE 'ALREADY_PRESENT_UNCHANGED' END;
 PERFORM set_config('mushavo.recovery_profile_result',jsonb_build_object(
 'result','RECOVERY_PROFILE_READY','profile_action',action,'inserted_profiles',inserted,
 'profile_active',true,'existing_profiles_changed',0,'Auth_password_confirmation_or_ban_writes',0,
 'workspace_membership_or_subscription_writes',0,'application_proof_created',false,
 'test_window_changed',false,'normal_signup_path_changed',false,
 'password_save_requested',false,'hosted_acceptance',false)::text,true);
END;
$profile_repair$;
SELECT current_setting('mushavo.recovery_profile_result')::jsonb AS result;
COMMIT;
