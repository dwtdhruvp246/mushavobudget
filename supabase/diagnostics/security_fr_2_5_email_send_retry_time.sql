-- Read-only rate timing for one owner-controlled account on the recorded staging project.
-- Replace OWNER_CONTROLLED_TEST_EMAIL privately. No counters, accounts or settings are changed.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '5s';

WITH selected AS (
  SELECT id FROM auth.users
  WHERE lower(email) = lower(btrim('OWNER_CONTROLLED_TEST_EMAIL'))
), guard AS (
  SELECT (SELECT count(*) FROM selected) = 1
    AND EXISTS (
      SELECT 1 FROM mushavo_email_install.rollout_control
      WHERE singleton AND target_project = 'dczlddwbtgvfdujgcitb'
    ) AS ready
), actor AS (
  SELECT id FROM selected WHERE (SELECT ready FROM guard)
), recent AS (
  SELECT e.reserved_at
  FROM mushavo_email_auth.send_events e JOIN actor a ON a.id = e.user_id
  WHERE e.reserved_at > statement_timestamp() - interval '1 hour'
), timing AS (
  SELECT greatest(
    statement_timestamp(),
    (SELECT max(s.next_send_at) FROM mushavo_email_auth.account_state s JOIN actor a ON a.id = s.user_id),
    (SELECT reserved_at + interval '1 hour' FROM recent ORDER BY reserved_at DESC OFFSET 4 LIMIT 1)
  ) AS next_at
)
SELECT CASE
  WHEN NOT (SELECT ready FROM guard)
    THEN jsonb_build_object('result', 'RATE_TARGET_OR_ACCOUNT_REVIEW_REQUIRED')
  WHEN NOT isfinite(next_at)
    THEN jsonb_build_object('result', 'RATE_TIME_REVIEW_REQUIRED')
  ELSE jsonb_build_object(
    'result', CASE WHEN next_at > statement_timestamp() THEN 'CODE_REQUEST_RATE_WAIT' ELSE 'CODE_REQUEST_RATE_READY' END,
    'requests_in_rolling_hour', (SELECT count(*) FROM recent),
    'limit_per_hour', 5,
    'retry_after_seconds', greatest(0, ceil(extract(epoch FROM next_at - statement_timestamp()))),
    'retry_at_africa_johannesburg', next_at AT TIME ZONE 'Africa/Johannesburg',
    'email_requests', 0,
    'settings_or_account_writes', 0,
    'hosted_acceptance', false
  )
END AS result
FROM timing;

ROLLBACK;

