# Restore the missing recovery profile, then open its existing test window

Stage 3/10 | FR.2/8 | Batch W/Z. 27 October 2026, FRE248.

[Owner provisioning metadata](security-fr-2-batch-w-owner-profile-provisioning-pass.json) reports enabled-origin/correct-shape/correct-source Auth signup trigger, normal active-profile default and retained/current staging catalog equality. There is one enabled profile INSERT user trigger. Source identifies the expected trigger as the existing suspension guard; its live identity was not individually returned by the count. The [repair candidate](../../supabase/candidates/security_fr_2_5_recovery_profile_repair.sql) therefore requires that sole trigger's exact name/shape/function/config/source before any insert. A different trigger refuses and rolls back. The earlier [account result](security-fr-2-batch-w-owner-recovery-profile-missing.json) remains confirmed/nonbanned with no profile. The historical cause of that gap is unknown; do not call the normal signup path globally broken or repaired from these metadata results.

[Contract](security-fr-2-batch-w-recovery-profile-repair-contract.json), [source identities](security-fr-2-batch-w-recovery-profile-repair-source-manifest.json), [14/14 local checks](security-fr-2-batch-w-recovery-profile-repair-local-checks.json). The actual repair runs offline with the original suspension guard, backend/device functions and existing recovery-window controller/candidate. Checks cover normal defaults, retries without overwriting an existing profile, unconfirmed/banned/suspended/invitation/platform accounts, collisions, privileges/API claims, source/default/index drift, insertion-side-effect refusal, rollback, and later window success without creating proof. Full hosted Auth/schema/session behavior is not reproduced. The old window12 and other prior suites are not rerun.

The repair selects the exact confirmed ordinary account, checks current staging catalog and source defaults, reads only the needed Auth identity/metadata fields, and inserts at most one missing profile with the same three fields used by normal app fallback: id, derived full_name and email. It preserves the normal status/origin/timestamp defaults, all existing profiles, suspension guard, Auth credentials/confirmation/ban/metadata, workspace/subscription/member/family records and all application proofs/device approvals/window rows. It does not replay the full Auth signup function, which can provision a workspace or link legacy family records. An existing active matching self-signup profile is preserved; other existing profiles and invitation/platform identities are refused. No catalog restamping, DDL, trigger disablement, fake session proof or global resume.

Owner steps:

1. Independently select Supabase staging project **dczlddwbtgvfdujgcitb**. Run the complete profile-repair SQL supplied in chat with the same recovery email already in the genuine form. Expected safe result **RECOVERY_PROFILE_READY**, profile_action CREATED or ALREADY_PRESENT_UNCHANGED, inserted_profiles1 or0. An error means stop and return the fixed error; do not bypass its checks.
2. After that success, rerun the **unchanged earlier recovery-window SQL** in its existing SQL Editor tab for the same email. Its source is2c2befd448de7b0737fe651f7f457c913144e0ea, candidate SHA256600082e01d6eef21a1a36f1c7b57e9ee853c0dab1552bf7e957773bae97a2d2c; the complete query remains in the [window handoff](SECURITY_FR_2_5_BATCH_W_RECIPIENT_PASS_AND_RECOVERY_WINDOW.md). It rechecks current actor/catalog and at most one actor/1800-second window, reuses an exact active deadline, refuses other active actors and atomically reopens an expired window. Expected **RECOVERY_SINGLE_ACCOUNT_WINDOW_READY**.
3. Return both safe results. Keep the genuine recovery form open and unchanged. Stop before matching-password save/code/continuation. No password, link, code, raw profile record or private packet should be shared.

No new ZIP, upload or SQL sidecar install. The current accepted deployment/runtime remains retained. Both-environment recipient-secret save confirmation is still pending for the later delivery step. Both UI deferrals remain deferred; V Admin MFA on hold; full W/FR.2/Stage3/release/findings open. Production/native unchanged and APK deferred.

Complete profile-repair SQL template:

```sql
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
```
