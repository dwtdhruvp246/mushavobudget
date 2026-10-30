# Inspect account code-request retry time

**Stage 3/10 | FR.2/8 | Batch W/Z.** The owner now reports **Too many requests. Try again later.** [Owner receipt](security-fr-2-batch-w-owner-code-request-rate-message.json).

In the reviewed client this exact wording maps to RATE_LIMIT returned by email_gate_begin_challenge. The canonical routine permits5 reservations per account in a rolling hour and separately enforces60 seconds between reservations. It inserts a reservation before attempting mail; failed delivery leaves that reservation counted. Rate-denied calls do not insert another reservation. The earlier failed sends can therefore explain this rate message, but the current live count/deadline has not been read. It is not evidence that the recipient setting, provider, session proof or signout behavior has passed.

## One next action

Pause Send email code/retry clicks. In the **staging Supabase SQL Editor**, run the read-only query below with the current controlled test mailbox substituted privately, then return its JSON. Do not change identities, clear counters, reopen an application window or rotate credentials to get around the limit.

The chat version supplies the currently reported private mailbox; the public source keeps OWNER_CONTROLLED_TEST_EMAIL as a placeholder. Query source pin **5f8bd52a15173cb3f54ab76d99276bdd2eb448ee**, [local8/8](security-fr-2-batch-w-email-send-retry-time-local-checks.json). The query reads recorded target metadata and one uniquely matched account, filters the same rolling-hour boundary as the canonical code, then chooses the later of the60-second resend deadline and the fifth-newest reservation plus one hour. That fifth-newest rule also handles unexpected overflow safely. It returns the retry time in **Africa/Johannesburg** time. It makes no counter/account/settings/proof writes and sends no email.

```sql
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

```

Return the JSON as-is. RATE_TARGET_OR_ACCOUNT_REVIEW_REQUIRED and RATE_TIME_REVIEW_REQUIRED are fixed review results; do not send raw Auth rows. RATE_READY refers only to the measured rate guard; recipient-secret installation before490ba810, actual provider dispatch/inbox delivery and the current account's application proof remain separate pending evidence. Do not repeatedly click while waiting. No automatic retry or mail send is scheduled by this query.

The earlier generic Verification is unavailable message has not been assigned a trigger/request result. Preserve it as open without inferring its cause from this rate message. Owner preparation/source3+29, four-recipient encrypted packet/readback and ZIP e7de4e1b90d46a1503be5cf77fe7974b32d650fd526cb473c39002fe8cf1675b remain accepted at preparation scope. New deployment490ba810 is owner-reported; independent public parity was inaccessible, both-channel recipient-secret save timing is still unconfirmed, actual current-mailbox delivery and canonical signout/reload remain pending.

This is the existing AU05.07 rate-error scope inside frozen31; it adds no acceptance case and does not complete AU05.07 or W. AU05.03 owner PASS is preserved without repetition. Keep the stage prefix visible in every progress update. V Admin MFA ON HOLD, password-mismatch visibility deferred, full W/FR.2/Stage3/release/findings open, production/native unchanged, APK deferred.
