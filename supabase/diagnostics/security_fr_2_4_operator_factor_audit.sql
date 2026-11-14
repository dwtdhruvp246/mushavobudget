-- Staging dczlddwbtgvfdujgcitb only. Auth audit metadata; no Auth API or factor write.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='20s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL mushavo.operator_primary_email='PRIMARY_EMAIL_REPLACE_LOCALLY';
SET LOCAL mushavo.operator_recovery_email='RECOVERY_EMAIL_REPLACE_LOCALLY';
DO $guard$
DECLARE a text:=lower(btrim(current_setting('mushavo.operator_primary_email')));
        b text:=lower(btrim(current_setting('mushavo.operator_recovery_email')));
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'FACTOR_AUDIT_PRIVILEGED_ORIGIN_REQUIRED'; END IF;
 IF current_setting('transaction_read_only')<>'on'
 OR to_regclass('mushavo_email_install.rollout_control') IS NULL
 THEN RAISE EXCEPTION 'FACTOR_AUDIT_CLOSED_STAGING_REQUIRED'; END IF;
 IF (SELECT count(*) FROM mushavo_email_install.rollout_control)<>1
 OR NOT EXISTS(SELECT 1 FROM mushavo_email_install.rollout_control
   WHERE singleton AND target_project='dczlddwbtgvfdujgcitb' AND mode='QUARANTINED')
 OR EXISTS(SELECT 1 FROM mushavo_email_install.acceptance_window)
 THEN RAISE EXCEPTION 'FACTOR_AUDIT_CLOSED_STAGING_REQUIRED'; END IF;
 IF a !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
 OR b !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' OR a=b
 OR a IN ('audit.owner@example.com','audit.outsider@example.com')
 OR b IN ('audit.owner@example.com','audit.outsider@example.com')
 OR (SELECT count(*) FROM auth.users WHERE lower(email)=a)<>1
 OR (SELECT count(*) FROM auth.users WHERE lower(email)=b)<>1
 THEN RAISE EXCEPTION 'FACTOR_AUDIT_TWO_EXISTING_DISTINCT_OPERATORS_REQUIRED'; END IF;
END $guard$;
DO $audit$
DECLARE report jsonb; table_status text; ip_expression text:='NULL::text';
BEGIN
 table_status:=CASE
 WHEN to_regclass('auth.audit_log_entries') IS NULL THEN 'ABSENT'
 WHEN NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('auth.audit_log_entries') AND relkind IN ('r','p')) THEN 'UNREVIEWED_SCHEMA'
 WHEN (SELECT count(*) FROM pg_attribute a JOIN pg_type t ON t.oid=a.atttypid
       WHERE a.attrelid=to_regclass('auth.audit_log_entries') AND NOT a.attisdropped
       AND ((a.attname='id' AND t.typname='uuid')
         OR (a.attname='payload' AND t.typname IN ('json','jsonb'))
         OR (a.attname='created_at' AND t.typname='timestamptz')))<>3 THEN 'UNREVIEWED_SCHEMA'
 ELSE 'AVAILABLE' END;
 IF table_status='AVAILABLE' THEN
  IF EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_type t ON t.oid=a.atttypid
    WHERE a.attrelid=to_regclass('auth.audit_log_entries') AND NOT a.attisdropped
    AND a.attname='ip_address' AND t.typname IN ('text','varchar'))
  THEN ip_expression:='nullif(btrim(a.ip_address::text),'''')'; END IF;
  EXECUTE replace($query$
   WITH requested(slot,email) AS (VALUES
    ('PRIMARY',lower(btrim(current_setting('mushavo.operator_primary_email')))),
    ('RECOVERY',lower(btrim(current_setting('mushavo.operator_recovery_email'))))
   ), actors AS (SELECT r.slot,r.email,u.id FROM requested r JOIN auth.users u ON lower(u.email)=r.email),
   reviewed_factor AS (
    SELECT f.id FROM actors r JOIN auth.mfa_factors f ON f.user_id=r.id
    WHERE r.slot='RECOVERY' AND f.factor_type::text='totp' AND f.status::text='unverified'
    AND f.friendly_name='Mushavo staging RECOVERY'
    AND f.created_at='2026-10-25T14:03:03.118678Z'::timestamptz
    AND encode(sha256(convert_to(jsonb_build_object('id',f.id,'user_id',f.user_id,
       'factor_type',f.factor_type,'status',f.status,'friendly_name',f.friendly_name,
       'created_at',f.created_at,'updated_at',f.updated_at)::text,'UTF8')),'hex')=
       '6c694294cb8273bce316aa86fd706e32a8028f2e3fba3ac65d4e75f98e6854cc'
   ), eligible AS MATERIALIZED (
    SELECT r.slot,r.email,r.id AS selected_actor,a.id,a.created_at,
     a.payload::jsonb AS private_payload,__PRIVATE_IP_EXPRESSION__ AS private_ip,
     lower(a.payload::jsonb->>'actor_id')=r.id::text AS actor_match,
     lower(a.payload::jsonb#>>'{traits,user_id}')=r.id::text AS subject_match,
     EXISTS(SELECT 1 FROM reviewed_factor f WHERE lower(a.payload::jsonb#>>'{traits,factor_id}')=f.id::text) AS factor_match
    FROM auth.audit_log_entries a JOIN actors r ON
      lower(a.payload::jsonb->>'actor_id')=r.id::text
      OR lower(a.payload::jsonb#>>'{traits,user_id}')=r.id::text
      OR (r.slot='RECOVERY' AND EXISTS(SELECT 1 FROM reviewed_factor f
          WHERE lower(a.payload::jsonb#>>'{traits,factor_id}')=f.id::text))
    WHERE a.created_at>='2026-10-25T13:35:00Z'::timestamptz
      AND a.created_at<='2026-10-25T14:10:00Z'::timestamptz
   ), bounded AS (SELECT * FROM eligible ORDER BY created_at DESC,id DESC,slot LIMIT 51),
   displayed AS (SELECT * FROM bounded ORDER BY created_at DESC,id DESC,slot LIMIT 50),
   safe_events AS (
    SELECT d.created_at,d.id,d.slot,jsonb_build_object(
     'slot',d.slot,'created_utc',d.created_at,
     'action',CASE WHEN d.private_payload->>'action' IN (
       'login','logout','factor_in_progress','factor_unenrolled','factor_deleted','factor_updated',
       'challenge_created','verification_attempted','mfa_code_login','user_modified',
       'user_updated_password','user_recovery_requested','token_revoked','token_refreshed',
       'user_reauthenticate_requested','identity_linked','identity_unlinked')
       THEN d.private_payload->>'action' ELSE 'OTHER' END,
     'actor_is_selected_account',coalesce(d.actor_match,false),
     'subject_is_selected_account',coalesce(d.subject_match,false),
     'matches_current_reviewed_recovery_factor',d.factor_match,
     'actor_username_matches_selected_email',CASE WHEN d.private_payload->>'actor_username' IS NULL THEN NULL
       ELSE lower(d.private_payload->>'actor_username')=d.email END,
     'factor_id_reference_present',nullif(d.private_payload#>>'{traits,factor_id}','') IS NOT NULL,
     'session_id_reference_present',nullif(d.private_payload#>>'{traits,session_id}','') IS NOT NULL,
     'same_IP_as_prior_selected_login',CASE WHEN d.private_ip IS NULL OR prior.private_ip IS NULL THEN NULL
       ELSE d.private_ip=prior.private_ip END
    ) AS event
    FROM displayed d LEFT JOIN LATERAL (
     SELECT p.private_ip FROM eligible p WHERE p.selected_actor=d.selected_actor AND p.actor_match
      AND p.private_payload->>'action'='login' AND p.created_at<=d.created_at
     ORDER BY p.created_at DESC,p.id DESC LIMIT 1
    ) prior ON true
   )
   SELECT jsonb_build_object('table_status','AVAILABLE',
    'reviewed_RECOVERY_factor_currently_matches',EXISTS(SELECT 1 FROM reviewed_factor),
    'selected_matching_rows_capped',(SELECT count(*) FROM bounded),
    'details_truncated',(SELECT count(*)>50 FROM bounded),
    'events',coalesce((SELECT jsonb_agg(event ORDER BY created_at,id,slot) FROM safe_events),'[]'::jsonb),
    'current_operator_session_counts',(SELECT jsonb_agg(jsonb_build_object('slot',r.slot,
       'sessions',(SELECT count(*) FROM auth.sessions s WHERE s.user_id=r.id)) ORDER BY r.slot) FROM actors r))
  $query$,'__PRIVATE_IP_EXPRESSION__',ip_expression) INTO report;
 ELSE
  report:=jsonb_build_object('table_status',table_status,
    'reviewed_RECOVERY_factor_currently_matches',NULL,'selected_matching_rows_capped',NULL,
    'details_truncated',false,'events','[]'::jsonb,'current_operator_session_counts',NULL);
 END IF;
 report:=report||jsonb_build_object(
  'target_project','dczlddwbtgvfdujgcitb','window_start_utc','2026-10-25T13:35:00Z',
  'window_end_utc','2026-10-25T14:10:00Z','event_limit',50,
  'raw_payloads_IDs_emails_IPs_or_credentials_printed',false,
  'human_or_client_origin_proven',false,'database_audit_retention_completeness_verified',false,
  'absence_of_removal_event_proves_no_cleanup',false,
  'Auth_API_or_factor_or_mode_or_setting_write',false);
 PERFORM set_config('mushavo.factor_audit_review',report::text,true);
END $audit$;
DO $closed$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM mushavo_email_install.rollout_control
    WHERE singleton AND target_project='dczlddwbtgvfdujgcitb' AND mode='QUARANTINED')
 OR EXISTS(SELECT 1 FROM mushavo_email_install.acceptance_window)
 THEN RAISE EXCEPTION 'FACTOR_AUDIT_FINAL_QUARANTINE_REQUIRED'; END IF;
END $closed$;
SELECT jsonb_build_object(
 'stage_step','FR.2.4.E5.35_BATCH_V_ADMIN_MFA_OPERATOR_FACTOR_AND_CATALOG_REVIEW',
 'progress_display','Stage 3/10 | FR.2/8 | Batch V/Z',
 'result','BATCH_V_READ_ONLY_AUTH_AUDIT_INSPECTION_COMPLETE',
 'audit_review',current_setting('mushavo.factor_audit_review')::jsonb,
 'quarantined_before_and_after_verified',true,'transaction_read_only',current_setting('transaction_read_only'),
 'Auth_requests',0,'factor_changes_requested',false,'committed_mode_change_requests',0,
 'hosted_acceptance',false,'production_or_native_changed',false,'findings_closed','[]'::jsonb,
 'checked_UTC',clock_timestamp(),'exit_code',0) AS factor_audit_review;
ROLLBACK;
