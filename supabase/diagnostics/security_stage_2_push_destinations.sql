-- 2.3.1: read-only Web Push destination inventory.
-- Use the ACTUAL Mushavo Budget project: kttkospkblwvguuwnhjj.
-- Manually verify the Dashboard project URL before running the whole script.
-- Returns aggregate counts only; no endpoint URLs, device keys or user identifiers.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';

WITH source_rows AS (
  SELECT endpoint, disabled_at IS NULL AS active
  FROM public.push_subscriptions
),
shapes AS (
  SELECT endpoint, active,
         lower(substring(endpoint FROM '^[Hh][Tt][Tt][Pp][Ss]://([^/?#]*)')) AS authority
  FROM source_rows
),
classified AS (
  SELECT endpoint, active, authority,
    CASE
      WHEN authority IN ('fcm.googleapis.com', 'android.googleapis.com')
        THEN 'google_host_family'
      WHEN authority IN ('updates.push.services.mozilla.com', 'updates-push.services.mozaws.net')
        THEN 'mozilla_host_family'
      WHEN authority = 'push.apple.com'
        OR authority ~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+push\.apple\.com$'
        THEN 'apple_host_family'
      WHEN authority = 'notify.windows.com'
        OR authority ~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+notify\.windows\.com$'
        THEN 'microsoft_host_family'
      ELSE 'other_or_unrecognized_authority'
    END AS host_family
  FROM shapes
),
family_counts AS (
  SELECT host_family, count(*) AS total,
         count(*) FILTER (WHERE active) AS active,
         count(*) FILTER (WHERE NOT active) AS disabled
  FROM classified
  GROUP BY host_family
),
inventory AS (
  SELECT count(*) AS total, count(*) FILTER (WHERE active) AS active,
         count(*) FILTER (WHERE NOT active) AS disabled,
         count(*) FILTER (WHERE authority IS NULL OR authority = '') AS missing_https_authority_shape,
         count(*) FILTER (WHERE endpoint ~ '[[:space:][:cntrl:]]') AS whitespace_or_control,
         count(*) FILTER (WHERE position(chr(92) IN endpoint) > 0) AS backslash,
         count(*) FILTER (WHERE position('@' IN authority) > 0) AS authority_credentials,
         count(*) FILTER (WHERE position(':' IN regexp_replace(authority, '^.*@', '')) > 0) AS explicit_port_or_ipv6_authority,
         count(*) FILTER (WHERE position('%' IN authority) > 0) AS encoded_authority,
         count(*) FILTER (WHERE position('#' IN endpoint) > 0) AS fragment,
         count(*) FILTER (WHERE char_length(endpoint) NOT BETWEEN 20 AND 4096) AS outside_existing_length_bounds
  FROM classified
),
results AS (
  SELECT 1 AS position, '01 Read-only production review context' AS check_name,
         'INFO' AS status, jsonb_build_object(
    'checked_at', transaction_timestamp(),
    'intended_actual_project', 'kttkospkblwvguuwnhjj',
    'staging_reference_not_used_for_this_inventory', 'dczlddwbtgvfdujgcitb',
    'project_identity', 'Owner verifies Dashboard URL; SQL labels do not establish hosted identity',
    'current_database', current_database(),
    'server_version', current_setting('server_version'),
    'transaction_read_only', current_setting('transaction_read_only')
  ) AS details

  UNION ALL

  SELECT 2, '02 Subscription table and effective endpoint grants', 'INFO',
         jsonb_build_object(
    'rls_enabled', c.relrowsecurity,
    'rls_forced', c.relforcerowsecurity,
    'anon_effective_endpoint_insert', has_column_privilege('anon', c.oid, 'endpoint', 'INSERT'),
    'authenticated_effective_endpoint_insert', has_column_privilege('authenticated', c.oid, 'endpoint', 'INSERT'),
    'authenticated_effective_endpoint_update', has_column_privilege('authenticated', c.oid, 'endpoint', 'UPDATE'),
    'scope', 'Effective column privileges include table grants; RLS authorization and endpoint validation are separate'
  )
  FROM pg_catalog.pg_class c
  WHERE c.oid = 'public.push_subscriptions'::regclass

  UNION ALL

  SELECT 3, '03 Aggregate stored destination shapes', 'REVIEW',
         jsonb_build_object(
    'total_subscriptions', i.total,
    'active_subscriptions', i.active,
    'disabled_subscriptions', i.disabled,
    'host_family_counts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'host_family', f.host_family, 'total', f.total,
        'active', f.active, 'disabled', f.disabled
      ) ORDER BY f.host_family)
      FROM family_counts f
    ), '[]'::jsonb),
    'shape_counts', jsonb_build_object(
      'missing_https_authority_shape', i.missing_https_authority_shape,
      'whitespace_or_control', i.whitespace_or_control,
      'backslash', i.backslash,
      'authority_credentials', i.authority_credentials,
      'explicit_port_or_ipv6_authority', i.explicit_port_or_ipv6_authority,
      'encoded_authority', i.encoded_authority,
      'fragment', i.fragment,
      'outside_existing_length_bounds', i.outside_existing_length_bounds
    ),
    'scope', 'Fixed host-family labels and overlapping shape counts only; not URL validation, an allowlist or proof of provider legitimacy, DNS safety or delivery'
  )
  FROM inventory i

  UNION ALL

  SELECT 4, '04 Review boundary', 'INFO', jsonb_build_object(
    'schema_or_rows_modified', false,
    'notifications_or_http_requests_sent', false,
    'endpoint_urls_keys_user_or_device_identifiers_returned', false,
    'hosted_sender_code_parity_verified', false,
    'dns_private_network_redirect_or_rebinding_safety_verified', false,
    'legitimate_provider_delivery_verified', false,
    'finding_f12_closed', false,
    'next', 'Review compatibility and transport behavior before preparing sender restrictions; unavailable hosted tests carry to final re-audit'
  )
)
SELECT check_name, status, details
FROM results
ORDER BY position;

ROLLBACK;
