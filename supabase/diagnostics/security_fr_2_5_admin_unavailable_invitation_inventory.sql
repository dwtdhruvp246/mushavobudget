-- Stage 3/10 | FR.2/8 | Batch W/Z | AU02.04 preparation.
-- Run only in staging project dczlddwbtgvfdujgcitb.
-- Counts only: no emails, IDs, links, tokens, Auth writes or completion calls.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL search_path = pg_catalog;

WITH classified AS (
  SELECT
    CASE
      WHEN i.status = 'cancelled' AND EXISTS (
        SELECT 1
        FROM public.admin_user_invitation_audit AS a
        WHERE a.invitation_id = i.id
          AND a.action = 'cancelled'
          AND a.safe_details ->> 'reason' = 'replaced'
      ) THEN 'replaced'
      WHEN i.status = 'cancelled' THEN 'cancelled'
      ELSE 'expired'
    END AS variant,
    (
      i.plan_code = 'free'
      AND i.workspace_type = 'personal'
      AND i.payment_received = false
      AND i.provisioned_workspace_id IS NULL
    ) AS free_personal_unprovisioned,
    (
      u.id IS NOT NULL
      AND lower(u.email) = lower(i.email)
      AND u.email_confirmed_at IS NOT NULL
    ) AS confirmed_matching_recipient
  FROM public.admin_user_invitations AS i
  LEFT JOIN auth.users AS u ON u.id = i.auth_user_id
  WHERE i.status IN ('cancelled', 'expired')
     OR (i.status = 'sent' AND i.expires_at <= now())
),
variants(variant) AS (
  VALUES ('expired'::text), ('cancelled'::text), ('replaced'::text)
),
counts AS (
  SELECT
    v.variant,
    count(c.variant) AS existing_invitations,
    count(c.variant) FILTER (
      WHERE c.free_personal_unprovisioned
    ) AS free_personal_unprovisioned,
    count(c.variant) FILTER (
      WHERE c.free_personal_unprovisioned
        AND c.confirmed_matching_recipient
    ) AS with_confirmed_matching_recipient
  FROM variants AS v
  LEFT JOIN classified AS c ON c.variant = v.variant
  GROUP BY v.variant
)
SELECT jsonb_build_object(
  'progress_display', 'Stage 3/10 | FR.2/8 | Batch W/Z',
  'result', 'ADMIN_UNAVAILABLE_INVITATION_INVENTORY_ONLY',
  'variants', (
    SELECT jsonb_object_agg(
      variant,
      jsonb_build_object(
        'existing_invitations', existing_invitations,
        'free_personal_unprovisioned', free_personal_unprovisioned,
        'with_confirmed_matching_recipient', with_confirmed_matching_recipient
      )
    )
    FROM counts
  ),
  'recipient_password_signin_tested', false,
  'hosted_denial_checks_executed', false,
  'email_requests', 0,
  'completion_RPC_calls', 0,
  'SQL_or_settings_writes', 0,
  'full_lettered_batch_W_complete', false
) AS safe_result;

ROLLBACK;
