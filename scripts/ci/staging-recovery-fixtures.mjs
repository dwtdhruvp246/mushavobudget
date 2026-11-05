import { need } from './staging-access.mjs';
export function recoveryFixtures(runId) {
  need(/^w(?:300|304)-[a-z0-9]{6,12}-[a-z0-9]{6}$/.test(runId), 'EXACT_RECOVERY_FIXTURE_RUN_REQUIRED');
  return { run_id: runId, A: `pkisgettingscammed+${runId}a@gmail.com`, B: `stilldhruvp246+${runId}b@gmail.com`,
    UNKNOWN: `pkisgettingscammed+${runId}unknown@gmail.com` };
}
export function recoveryTimestampSnapshotSQL(runId) {
  const f = recoveryFixtures(runId);
  return `SELECT jsonb_build_object(
 'result', 'BOUND_UNUSED_RECOVERY_TIMESTAMPS',
 'user_digest', encode(sha256(convert_to(u.id::text, 'UTF8')), 'hex'),
 'token_row_digest', encode(sha256(convert_to(t.id::text, 'UTF8')), 'hex'),
 'sent_at', to_char(u.recovery_sent_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
 'expires_at', to_char(t.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
) AS safe_result
FROM auth.users u JOIN auth.one_time_tokens t ON t.user_id = u.id
WHERE u.email = '${f.A}' AND u.raw_user_meta_data->>'mushavo_recovery_fixture' = '${runId}'
 AND u.created_at > now() - interval '1 day' AND u.email_confirmed_at IS NOT NULL
 AND u.recovery_sent_at > now() - interval '15 minutes' AND t.token_type = 'recovery_token'
 AND (t.expires_at IS NULL OR t.expires_at > now());`;
}

export function expirySQL(runId, snapshot, restore = false) {
  const f = recoveryFixtures(runId);
  const timestamp = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/;
  need(snapshot?.result === 'BOUND_UNUSED_RECOVERY_TIMESTAMPS'
    && /^[a-f0-9]{64}$/.test(snapshot.user_digest || '') && /^[a-f0-9]{64}$/.test(snapshot.token_row_digest || '')
    && timestamp.test(snapshot.sent_at || '') && (snapshot.expires_at === null || timestamp.test(snapshot.expires_at || '')),
  'EXACT_UNUSED_RECOVERY_TIMESTAMP_SNAPSHOT_REQUIRED');
  const sent = `'${snapshot.sent_at}'::timestamptz`;
  const expires = snapshot.expires_at === null ? 'NULL::timestamptz' : `'${snapshot.expires_at}'::timestamptz`;
  const past = "'2000-01-01T00:00:00Z'::timestamptz";
  return `BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '20s';
DO $fixture$
DECLARE v_user uuid; v_token uuid;
BEGIN
 IF ${sent} <= now() - interval '15 minutes' OR ${sent} > now()
   OR (${expires} IS NOT NULL AND (${expires} <= now() OR ${expires} > ${sent} + interval '62 minutes'))
 THEN RAISE EXCEPTION 'RECOVERY_ORIGINAL_VALIDITY_WINDOW_REQUIRED'; END IF;
 SELECT u.id, t.id INTO STRICT v_user, v_token
 FROM auth.users u JOIN auth.one_time_tokens t ON t.user_id = u.id
 WHERE u.email = '${f.A}' AND u.raw_user_meta_data->>'mushavo_recovery_fixture' = '${runId}'
   AND u.created_at > now() - interval '1 day' AND u.email_confirmed_at IS NOT NULL
   AND encode(sha256(convert_to(u.id::text, 'UTF8')), 'hex') = '${snapshot.user_digest}'
   AND t.token_type = 'recovery_token'
   AND encode(sha256(convert_to(t.id::text, 'UTF8')), 'hex') = '${snapshot.token_row_digest}'
   AND u.recovery_sent_at = ${restore ? past : sent}
   AND t.expires_at IS NOT DISTINCT FROM ${restore ? past : expires}
 FOR UPDATE OF u, t;
 IF EXISTS(SELECT 1 FROM public.app_admins WHERE user_id = v_user)
 THEN RAISE EXCEPTION 'RECOVERY_FIXTURE_ROLE_REFUSED'; END IF;
 UPDATE auth.users SET recovery_sent_at = ${restore ? sent : past} WHERE id = v_user;
 UPDATE auth.one_time_tokens SET expires_at = ${restore ? expires : past} WHERE id = v_token;
END;
$fixture$;
SELECT jsonb_build_object('result', '${restore ? 'EXACT_UNUSED_RECOVERY_TIMESTAMPS_RESTORED' : 'EXACT_UNUSED_RECOVERY_TIMESTAMPS_BACKDATED'}',
 'fixture_only', true, 'token_values_returned', false) AS safe_result;
COMMIT;
`;
}
export function cleanupSQL(runId) {
  const f = recoveryFixtures(runId);
  const aliases = runId.startsWith('w304-') ? [f.A] : [f.A, f.B];
  const exactEmails = aliases.map(email => `'${email}'`).join(',');
  return `BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $fixture$
DECLARE v_users uuid[]; v_workspaces uuid[]; v_row record; v_count bigint; v_total integer;
BEGIN
 -- Metadata binds newly-created disposable fixtures only; it grants no access.
 SELECT array_agg(id) INTO v_users FROM auth.users WHERE email IN (${exactEmails})
   AND raw_user_meta_data->>'mushavo_recovery_fixture'='${runId}' AND created_at>now()-interval '1 day';
 v_total:=coalesce(cardinality(v_users),0);
 IF (SELECT count(*) FROM auth.users WHERE email IN (${exactEmails}))<>v_total
 THEN RAISE EXCEPTION 'RECOVERY_FIXTURE_IDENTITY_REVIEW_REQUIRED'; END IF;
 IF v_total>${aliases.length} THEN RAISE EXCEPTION 'RECOVERY_FIXTURE_BOUND_REQUIRED'; END IF;
 PERFORM 1 FROM auth.users WHERE id=ANY(v_users) FOR UPDATE;
 SELECT coalesce(array_agg(id),array[]::uuid[]) INTO v_workspaces FROM public.budget_workspaces WHERE owner_id=ANY(v_users);
 PERFORM 1 FROM public.budget_workspaces WHERE id=ANY(v_workspaces) FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.budget_workspaces WHERE id=ANY(v_workspaces)
     AND (workspace_type<>'personal' OR legacy_family_id IS NOT NULL OR status<>'active'))
   OR cardinality(v_workspaces)>v_total
   OR EXISTS(SELECT 1 FROM public.workspace_members WHERE (workspace_id=ANY(v_workspaces) OR user_id=ANY(v_users))
     AND (NOT (workspace_id=ANY(v_workspaces) AND user_id=ANY(v_users)) OR role<>'owner' OR status<>'active' OR invited_by IS NOT NULL))
   OR EXISTS(SELECT 1 FROM public.workspace_subscriptions s JOIN public.plans p ON p.id=s.plan_id
     WHERE s.workspace_id=ANY(v_workspaces) AND (p.code<>'free' OR s.status<>'active' OR s.paid_through_at IS NOT NULL))
   OR EXISTS(SELECT 1 FROM public.subscription_entitlement_history h JOIN public.plans p ON p.id=h.plan_id
     WHERE (h.workspace_id=ANY(v_workspaces) OR h.actor_id=ANY(v_users))
       AND (NOT h.workspace_id=ANY(v_workspaces) OR p.code<>'free' OR h.reason<>'Initial Free entitlement'))
 THEN RAISE EXCEPTION 'RECOVERY_FIXTURE_EMPTY_FREE_PERSONAL_STATE_REQUIRED'; END IF;
 -- Reject every unexpected incoming reference, including financial, shared,
 -- invitation, Admin, MFA and cross-account rows, before either deletion.
 FOR v_row IN SELECT c.conrelid AS child,c.confrelid AS parent,n.nspname AS schema_name,t.relname AS table_name,
     a.attname AS column_name FROM pg_constraint c
   JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
   JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
   WHERE c.contype='f' AND cardinality(c.conkey)=1
     AND c.confrelid IN ('auth.users'::regclass,'public.profiles'::regclass,'public.budget_workspaces'::regclass)
 LOOP
   EXECUTE format('SELECT count(*) FROM %s WHERE %I=ANY($1)',v_row.child::regclass,v_row.column_name)
     INTO v_count USING CASE WHEN v_row.parent='public.budget_workspaces'::regclass THEN v_workspaces ELSE v_users END;
   IF v_count>0 AND NOT (
      (v_row.schema_name='auth' AND v_row.table_name IN ('identities','sessions','one_time_tokens'))
      OR (v_row.schema_name='mushavo_email_auth' AND v_row.table_name='account_state')
      OR (v_row.schema_name='public' AND v_row.table_name IN ('profiles','budget_workspaces','workspace_members',
        'workspace_settings','workspace_subscriptions','subscription_entitlement_history','analytics_activity_hours')))
   THEN RAISE EXCEPTION 'RECOVERY_FIXTURE_UNEXPECTED_REFERENCE: %.%',v_row.schema_name,v_row.table_name; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM auth.identities WHERE user_id=ANY(v_users) AND provider<>'email')
 THEN RAISE EXCEPTION 'RECOVERY_FIXTURE_PASSWORD_IDENTITIES_REQUIRED'; END IF;
 DELETE FROM public.budget_workspaces WHERE id=ANY(v_workspaces) AND owner_id=ANY(v_users);
 DELETE FROM auth.users WHERE id=ANY(v_users) AND email IN (${exactEmails})
   AND raw_user_meta_data->>'mushavo_recovery_fixture'='${runId}';
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>v_total OR EXISTS(SELECT 1 FROM auth.users WHERE email IN (${exactEmails}))
   OR EXISTS(SELECT 1 FROM public.profiles WHERE id=ANY(v_users))
   OR EXISTS(SELECT 1 FROM auth.sessions WHERE user_id=ANY(v_users))
   OR EXISTS(SELECT 1 FROM auth.one_time_tokens WHERE user_id=ANY(v_users))
   OR EXISTS(SELECT 1 FROM public.budget_workspaces WHERE id=ANY(v_workspaces))
 THEN RAISE EXCEPTION 'RECOVERY_FIXTURE_CLEANUP_ABSENCE_REQUIRED'; END IF;
END;
$fixture$;
SELECT jsonb_build_object('result','EXACT_NEW_RECOVERY_FIXTURES_ABSENT',
 'existing_accounts_targeted',false,'financial_or_shared_rows_deleted',false,
 'Auth_audit_retained',true,'global_Auth_policy_changed',false) AS safe_result;
COMMIT;
`;
}
