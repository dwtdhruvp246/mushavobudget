-- Stage 3/10 | FR.2/8 | Batch V/Z: STAGING Explorer, query source LOGS.
-- ClickHouse SQL; one read-only query. Select the same fixed UTC window in the UI.
-- Replace only these two public email literals with the already selected operators.
WITH
  windowed AS (
    SELECT
      timestamp,
      source,
      coalesce(
        nullIf(log_attributes['auth_audit_event.actor_username'], ''),
        nullIf(log_attributes['auth_event.actor_username'], ''), ''
      ) AS selected_username,
      coalesce(
        nullIf(log_attributes['auth_audit_event.action'], ''),
        nullIf(log_attributes['auth_event.action'], ''), ''
      ) AS recorded_action,
      coalesce(
        nullIf(log_attributes['auth_audit_event.user_agent'], ''),
        nullIf(log_attributes['user_agent'], ''), ''
      ) AS recorded_agent
    FROM logs
    WHERE source IN ('auth_audit_logs', 'auth_logs')
      AND timestamp >= toDateTime64('2026-10-25 13:35:00', 6, 'UTC')
      AND timestamp < toDateTime64('2026-10-25 14:10:00', 6, 'UTC')
  ),
  selected AS (
    SELECT
      timestamp,
      source,
      if(lowerUTF8(selected_username) = lowerUTF8('PRIMARY_OPERATOR_EMAIL'),
         'PRIMARY', 'RECOVERY') AS slot,
      if(recorded_action IN (
        'login', 'logout', 'factor_in_progress', 'factor_unenrolled',
        'factor_deleted', 'factor_updated', 'challenge_created',
        'verification_attempted', 'mfa_code_login', 'token_revoked',
        'token_refreshed', 'user_modified', 'user_updated_password',
        'user_recovery_requested', 'user_reauthenticate_requested',
        'identity_linked', 'identity_unlinked'
      ), recorded_action, 'OTHER_OR_UNRECORDED') AS action,
      multiIf(
        recorded_agent = '', 'UNRECORDED',
        lowerUTF8(recorded_agent) IN ('node', 'undici'), 'NODE_OR_UNDICI',
        recorded_agent ILIKE '%PowerShell%', 'POWERSHELL',
        recorded_agent ILIKE 'Mozilla/%', 'BROWSER_LIKE',
        'OTHER_RECORDED_CLIENT'
      ) AS client_class
    FROM windowed
    WHERE lowerUTF8(selected_username) IN (
      lowerUTF8('PRIMARY_OPERATOR_EMAIL'), lowerUTF8('RECOVERY_OPERATOR_EMAIL')
    )
  )
SELECT concat(
  '{"progress_display":"Stage 3/10 | FR.2/8 | Batch V/Z",',
  '"result":"BATCH_V_EXTERNAL_AUTH_LOG_INSPECTION_COMPLETE","exit_code":0,',
  '"window_start_utc":"2026-10-25T13:35:00Z",',
  '"window_end_utc":"2026-10-25T14:10:00Z",',
  '"auth_service_rows_in_window":',
  toString((SELECT count() FROM windowed WHERE source = 'auth_logs')), ',',
  '"auth_audit_rows_in_window":',
  toString((SELECT count() FROM windowed WHERE source = 'auth_audit_logs')), ',',
  '"selected_username_matching_rows":',
  toString((SELECT count() FROM selected)), ',',
  '"details_truncated":',
  if((SELECT count() FROM selected) > 50, 'true', 'false'), ',',
  '"events":', toJSONString(groupArray(map(
    'UTC', toString(timestamp, 'UTC'), 'source', source,
    'slot', slot, 'action', action, 'client_class', client_class
  ))), ',',
  '"selected_operator_username_match_only":true,',
  '"exact_pending_factor_reference_verified":false,',
  '"human_or_client_origin_proven":false,',
  '"log_retention_completeness_verified":false,',
  '"raw_emails_IDs_IPs_user_agents_messages_or_credentials_printed":false,',
  '"factor_changes_requested":false,"committed_mode_change_requests":0,',
  '"quarantine_rechecked_by_this_log_query":false,',
  '"hosted_acceptance":false,"production_or_native_changed":false}'
) AS safe_json
FROM (
  SELECT timestamp, source, slot, action, client_class
  FROM selected
  ORDER BY timestamp DESC
  LIMIT 50
)
LIMIT 1;
