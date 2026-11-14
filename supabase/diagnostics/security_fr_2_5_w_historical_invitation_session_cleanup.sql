-- Staging project dczlddwbtgvfdujgcitb only.
-- The two digests identify the October 30 AU02.04 checker sessions.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $cleanup$
DECLARE
  target_sessions uuid[];
  target_users uuid[];
  other_sessions_before uuid[];
  other_sessions_after uuid[];
  deleted_sessions integer;
BEGIN
  WITH expected(session_digest, actor_digest, created_at, email) AS (
    VALUES
    ('31d0336e3c8f9744eebc5ac58cdbea3ffb60648cec703bfc8ca38c1cdb93c4f2',
     '67829935113cbfe306e34f75329184201161a67e2942279b03b875085976c126',
     '2026-10-30T08:37:55.141782Z'::timestamptz, 'stilldhruvp246@gmail.com'),
    ('7af501323c1b2c1be6c7734ce251e1bba6618c92c5d5b3760114e2969f8e0157',
     '720ab358b87cbcf8ebbd3367164b324b966006be939d10cfc9993e647e9776c9',
     '2026-10-30T08:38:07.755991Z'::timestamptz, 'admin@mushavobudget.com')
  ), locked AS (
    SELECT s.id, s.user_id
    FROM expected e
    JOIN auth.sessions s ON s.created_at = e.created_at
      AND encode(sha256(convert_to(s.id::text, 'UTF8')), 'hex') = e.session_digest
    JOIN auth.users u ON u.id = s.user_id
      AND encode(sha256(convert_to(u.id::text, 'UTF8')), 'hex') = e.actor_digest
      AND lower(u.email) = e.email
    WHERE s.user_agent ILIKE '%node%' OR s.user_agent ILIKE '%undici%'
    FOR UPDATE OF s
  )
  SELECT array_agg(id ORDER BY id), array_agg(DISTINCT user_id)
    INTO target_sessions, target_users
  FROM locked;

  IF coalesce(cardinality(target_sessions), 0) <> 2
      OR coalesce(cardinality(target_users), 0) <> 2 THEN
    RAISE EXCEPTION 'EXACT_TWO_HISTORICAL_TEST_SESSIONS_REQUIRED';
  END IF;

  IF (SELECT count(*) FROM pg_constraint WHERE contype = 'f' AND confrelid = 'auth.sessions'::regclass) <> 4
    OR EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE contype = 'f' AND confrelid = 'auth.sessions'::regclass
        AND (confdeltype <> 'c' OR conrelid NOT IN (
          'auth.refresh_tokens'::regclass, 'auth.mfa_amr_claims'::regclass,
          'mushavo_email_auth.challenges'::regclass, 'mushavo_email_auth.session_proofs'::regclass
        ))
    )
    OR EXISTS (
      SELECT 1 FROM pg_constraint WHERE contype = 'f' AND confrelid IN (
        'auth.refresh_tokens'::regclass, 'auth.mfa_amr_claims'::regclass,
        'mushavo_email_auth.challenges'::regclass, 'mushavo_email_auth.session_proofs'::regclass
      )
    )
    OR EXISTS (
      SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (
        'auth.sessions'::regclass, 'auth.refresh_tokens'::regclass, 'auth.mfa_amr_claims'::regclass,
        'mushavo_email_auth.challenges'::regclass, 'mushavo_email_auth.session_proofs'::regclass
      )
    ) THEN
    RAISE EXCEPTION 'HISTORICAL_SESSION_CASCADE_REVIEW_REQUIRED';
  END IF;

  IF (SELECT count(*) FROM auth.refresh_tokens WHERE session_id = ANY(target_sessions)) <> 2 THEN
    RAISE EXCEPTION 'HISTORICAL_TEST_REFRESH_TOKEN_COUNT_CHANGED';
  END IF;

  SELECT coalesce(array_agg(id ORDER BY id), ARRAY[]::uuid[]) INTO other_sessions_before
  FROM auth.sessions
  WHERE user_id = ANY(target_users) AND NOT (id = ANY(target_sessions));

  DELETE FROM auth.sessions WHERE id = ANY(target_sessions);
  GET DIAGNOSTICS deleted_sessions = ROW_COUNT;

  SELECT coalesce(array_agg(id ORDER BY id), ARRAY[]::uuid[]) INTO other_sessions_after
  FROM auth.sessions WHERE user_id = ANY(target_users);

  IF deleted_sessions <> 2 OR other_sessions_before IS DISTINCT FROM other_sessions_after
    OR EXISTS (SELECT 1 FROM auth.refresh_tokens WHERE session_id = ANY(target_sessions))
    OR EXISTS (SELECT 1 FROM auth.mfa_amr_claims WHERE session_id = ANY(target_sessions))
    OR EXISTS (SELECT 1 FROM mushavo_email_auth.challenges WHERE session_id = ANY(target_sessions))
    OR EXISTS (SELECT 1 FROM mushavo_email_auth.session_proofs WHERE session_id = ANY(target_sessions)) THEN
    RAISE EXCEPTION 'HISTORICAL_TEST_SESSION_CLEANUP_READBACK_REQUIRED';
  END IF;
END;
$cleanup$;

SELECT jsonb_build_object(
  'result', 'EXACT_HISTORICAL_TEST_SESSIONS_REVOKED',
  'revoked_test_sessions', 2,
  'linked_refresh_tokens_removed', 2,
  'other_sessions_preserved', true
) AS safe_result;
COMMIT;
