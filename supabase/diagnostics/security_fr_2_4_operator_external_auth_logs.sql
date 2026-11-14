-- Stage 3/10 | FR.2/8 | Batch V/Z: staging Explorer, query source Logs.
-- One SELECT; no CTEs, subqueries or settings changes. Use the same UTC UI range.
SELECT concat(
  '{"progress_display":"Stage 3/10 | FR.2/8 | Batch V/Z",',
  '"result":"BATCH_V_EXTERNAL_AUTH_LOG_INSPECTION_COMPLETE","exit_code":0,',
  '"window_start_utc":"2026-10-25T13:35:00Z",',
  '"window_end_utc":"2026-10-25T14:10:00Z",',
  '"selected_username_matching_rows":', toString(count()), ',',
  '"selected_auth_service_rows":', toString(countIf(source = 'auth_logs')), ',',
  '"selected_auth_audit_rows":', toString(countIf(source = 'auth_audit_logs')), ',',
  '"details_truncated":', if(count() > 50, 'true', 'false'), ',',
  '"event_columns":["UTC","source","slot","action","client_class"],',
  '"events":', toJSONString(arraySlice(arrayReverseSort(groupArray(tuple(
    toString(timestamp, 'UTC'),
    source,
    if(lowerUTF8(coalesce(
      nullIf(log_attributes['auth_audit_event.actor_username'], ''),
      nullIf(log_attributes['auth_event.actor_username'], ''), ''
    )) = lowerUTF8('PRIMARY_OPERATOR_EMAIL'), 'PRIMARY', 'RECOVERY'),
    if(coalesce(
      nullIf(log_attributes['auth_audit_event.action'], ''),
      nullIf(log_attributes['auth_event.action'], ''), ''
    ) IN (
      'login', 'logout', 'factor_in_progress', 'factor_unenrolled',
      'factor_deleted', 'factor_updated', 'challenge_created',
      'verification_attempted', 'mfa_code_login', 'token_revoked',
      'token_refreshed', 'user_modified', 'user_updated_password',
      'user_recovery_requested', 'user_reauthenticate_requested',
      'identity_linked', 'identity_unlinked'
    ), coalesce(
      nullIf(log_attributes['auth_audit_event.action'], ''),
      nullIf(log_attributes['auth_event.action'], ''), ''
    ), 'OTHER_OR_UNRECORDED'),
    multiIf(
      coalesce(nullIf(log_attributes['auth_audit_event.user_agent'], ''),
        nullIf(log_attributes['user_agent'], ''), '') = '', 'UNRECORDED',
      lowerUTF8(coalesce(nullIf(log_attributes['auth_audit_event.user_agent'], ''),
        nullIf(log_attributes['user_agent'], ''), '')) IN ('node', 'undici'), 'NODE_OR_UNDICI',
      coalesce(nullIf(log_attributes['auth_audit_event.user_agent'], ''),
        nullIf(log_attributes['user_agent'], ''), '') ILIKE '%PowerShell%', 'POWERSHELL',
      coalesce(nullIf(log_attributes['auth_audit_event.user_agent'], ''),
        nullIf(log_attributes['user_agent'], ''), '') ILIKE 'Mozilla/%', 'BROWSER_LIKE',
      'OTHER_RECORDED_CLIENT'
    )
  ))), 1, 50)), ',',
  '"selected_operator_username_match_only":true,',
  '"exact_pending_factor_reference_verified":false,',
  '"human_or_client_origin_proven":false,',
  '"log_retention_completeness_verified":false,',
  '"raw_emails_IDs_IPs_user_agents_messages_or_credentials_printed":false,',
  '"factor_changes_requested":false,"committed_mode_change_requests":0,',
  '"quarantine_rechecked_by_this_log_query":false,',
  '"hosted_acceptance":false,"production_or_native_changed":false}'
) AS safe_json
FROM logs
WHERE source IN ('auth_audit_logs', 'auth_logs')
  AND timestamp >= toDateTime64('2026-10-25 13:35:00', 6, 'UTC')
  AND timestamp < toDateTime64('2026-10-25 14:10:00', 6, 'UTC')
  AND lowerUTF8(coalesce(
    nullIf(log_attributes['auth_audit_event.actor_username'], ''),
    nullIf(log_attributes['auth_event.actor_username'], ''), ''
  )) IN (lowerUTF8('PRIMARY_OPERATOR_EMAIL'), lowerUTF8('RECOVERY_OPERATOR_EMAIL'))
LIMIT 1;
