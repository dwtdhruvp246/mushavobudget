-- 1.4.1: metadata-only check of a NEW local recovery cluster.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SELECT jsonb_build_object(
 'server_version', current_setting('server_version'),
 'server_version_num', current_setting('server_version_num')::integer,
 'database', current_database(),
 'user', current_user,
 'data_directory', current_setting('data_directory'),
 'listen_addresses', current_setting('listen_addresses'),
 'port', current_setting('port')::integer,
 'connected_address', inet_server_addr()::text,
 'hba_parse_errors', (SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL),
 'hba_rule_count', (SELECT count(*) FROM pg_hba_file_rules WHERE error IS NULL),
 'all_hba_rules_scram', (SELECT coalesce(bool_and(auth_method = 'scram-sha-256'), false) FROM pg_hba_file_rules WHERE error IS NULL),
 'public_relation_count', (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')),
 'auth_schema_exists', EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='auth'),
 'storage_schema_exists', EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='storage'),
 'pgcrypto_available', EXISTS(SELECT 1 FROM pg_available_extensions WHERE name='pgcrypto'),
 'managed_extensions_available', (SELECT coalesce(jsonb_agg(name ORDER BY name), '[]'::jsonb) FROM pg_available_extensions WHERE name IN ('supabase_vault','pg_graphql','pg_cron','pg_net')),
 'synthetic_rows_restored', false,
 'full_platform_recovery_verified', false
);
ROLLBACK;
