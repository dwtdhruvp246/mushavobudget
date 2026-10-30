-- STAGING ONLY: dczlddwbtgvfdujgcitb. Read-only post-stop metadata.
-- No IDs, addresses, user agents, tokens or raw Auth rows are returned.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL search_path = pg_catalog;

WITH expected_accounts(slot, email) AS (
  VALUES
    ('ordinary_test_user'::text, 'stilldhruvp246@gmail.com'::text),
    ('super_admin'::text, 'admin@mushavobudget.com'::text)
),
accounts AS (
  SELECT e.slot, u.id
  FROM expected_accounts e
  LEFT JOIN auth.users u ON lower(u.email) = e.email
),
marked_fixtures AS (
  SELECT i.id
  FROM public.admin_user_invitations i
  JOIN accounts recipient ON recipient.id = i.auth_user_id
    AND recipient.slot = 'ordinary_test_user'
  JOIN accounts inviter ON inviter.id = i.invited_by
    AND inviter.slot = 'super_admin'
  WHERE i.full_name = 'AU02.04 temporary fixture ' || i.id::text
    AND i.workspace_name = i.full_name
),
marked_audits AS (
  SELECT a.id
  FROM public.admin_user_invitation_audit a
  JOIN accounts inviter ON inviter.id = a.actor_id
    AND inviter.slot = 'super_admin'
  WHERE a.safe_details ->> 'fixture' = 'AU02.04'
    AND a.safe_details ->> 'run_id' = a.invitation_id::text
),
session_rows AS (
  SELECT a.slot, a.id AS account_id, s.id AS session_id, s.created_at,
    lower(coalesce(to_jsonb(s) ->> 'user_agent', '')) AS agent
  FROM accounts a
  LEFT JOIN auth.sessions s ON s.user_id = a.id
),
counts AS (
  SELECT slot,
    bool_or(account_id IS NOT NULL) AS account_found,
    count(session_id) AS current_session_rows,
    count(session_id) FILTER (
      WHERE agent IN ('node', 'undici')
    ) AS node_or_undici_agent_rows,
    min(greatest(0, floor(extract(epoch FROM (now() - created_at)))))
      FILTER (WHERE session_id IS NOT NULL AND agent IN ('node', 'undici'))
      AS newest_node_or_undici_session_age_seconds
  FROM session_rows
  GROUP BY slot
)
SELECT jsonb_build_object(
  'progress_display', 'Stage 3/10 | FR.2/8 | Batch W/Z',
  'result', 'POST_STOP_FIXTURE_AND_SESSION_METADATA_ONLY',
  'remaining_marked_fixture_rows', (SELECT count(*) FROM marked_fixtures),
  'remaining_marked_fixture_audit_rows', (SELECT count(*) FROM marked_audits),
  'accounts', (
    SELECT jsonb_object_agg(slot, jsonb_build_object(
      'account_found', account_found,
      'current_session_rows', current_session_rows,
      'node_or_undici_agent_rows', node_or_undici_agent_rows,
      'newest_node_or_undici_session_age_seconds',
        newest_node_or_undici_session_age_seconds
    )) FROM counts
  ),
  'session_counts_identify_failed_run_sessions', false,
  'HTTP_failure_cause_established', false,
  'email_requests', 0,
  'SQL_or_settings_writes', 0,
  'hosted_denial_acceptance', false,
  'full_lettered_batch_W_complete', false
) AS safe_result;

ROLLBACK;
