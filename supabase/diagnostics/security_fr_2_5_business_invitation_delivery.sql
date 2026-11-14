-- Staging only: dczlddwbtgvfdujgcitb. Read the existing failed invitation; no mail dispatch.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL search_path = pg_catalog;

WITH target AS (
  SELECT id, workspace_id, invitee_email, invitee_user_id,
         status, delivery_status, delivery_error_code
  FROM public.workspace_invitations
  WHERE id = '2cbc417b-930e-47b3-b7c3-ec0b551834d2'::uuid
)
SELECT jsonb_build_object(
  'invitation_found', EXISTS (SELECT 1 FROM target),
  'invitation_status', (SELECT status FROM target),
  'delivery_status', (SELECT delivery_status FROM target),
  'provider_status_or_code', (
    SELECT CASE
      WHEN delivery_error_code ~ '^[0-9]{3}$'
        OR delivery_error_code IN ('BUSINESS_INVITATION_EMAIL_FAILED', 'DELIVERY_FAILED')
      THEN delivery_error_code
      ELSE NULL
    END FROM target
  ),
  'recipient_linked_to_account', EXISTS (
    SELECT 1 FROM target WHERE invitee_user_id IS NOT NULL
  ),
  'recipient_auth_account_exists', EXISTS (
    SELECT 1 FROM auth.users AS u
    JOIN target AS t ON lower(u.email) = lower(t.invitee_email)
  ),
  'recipient_profile_exists', EXISTS (
    SELECT 1 FROM public.profiles AS p
    JOIN target AS t ON lower(p.email) = lower(t.invitee_email)
  ),
  'recipient_already_active_member', EXISTS (
    SELECT 1 FROM public.workspace_members AS m
    JOIN target AS t ON t.workspace_id = m.workspace_id
    JOIN auth.users AS u ON u.id = m.user_id
    WHERE m.status = 'active'
      AND lower(u.email) = lower(t.invitee_email)
  )
) AS safe_result;

ROLLBACK;
