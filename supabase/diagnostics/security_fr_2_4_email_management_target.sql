-- One fixed catalog-only SELECT for the dedicated read-only Management API.
-- Counts/types/state only: this does NOT replace the privileged fingerprint guard.
WITH relations AS (
 SELECT n.nspname AS schema_name,c.relname,c.relkind,c.relrowsecurity,c.reloptions
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('public','storage') AND c.relkind IN ('r','p','v','m')
), required_columns(relation_name,column_name,type_name,type_modifier,not_null) AS (
 VALUES ('auth.users','id','uuid',-1,true),
 ('auth.users','email_confirmed_at','timestamptz',-1,false),
 ('auth.users','encrypted_password','varchar',259,false),
 ('auth.users','banned_until','timestamptz',-1,false),
 ('auth.sessions','id','uuid',-1,true),
 ('auth.sessions','user_id','uuid',-1,true),
 ('auth.sessions','not_after','timestamptz',-1,false),
 ('public.profiles','id','uuid',-1,true),
 ('public.profiles','account_status','text',-1,true)
), checks AS (
 SELECT
 (SELECT count(*)=278 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.prokind='f' AND p.prorettype<>'pg_catalog.event_trigger'::pg_catalog.regtype)
   AS selected_routine_count_matches,
 (SELECT count(*)=166 AND count(*) FILTER(WHERE NOT p.polpermissive)=50
   FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
   JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','storage'))
   AS selected_policy_counts_match,
 (SELECT count(*)=81 AND coalesce(bool_and(relrowsecurity),false) FROM relations
   WHERE schema_name='public' AND relkind IN ('r','p')) AS public_table_count_and_rls_match,
 (SELECT count(*)=8 AND coalesce(bool_and(relrowsecurity),false) FROM relations
   WHERE schema_name='storage' AND relkind IN ('r','p')) AS observed_storage_tables_have_rls,
 (SELECT count(*)=1 AND coalesce(bool_and(relname='cashbook_account_balances'
   AND coalesce(reloptions @> ARRAY['security_invoker=true']::text[],false)),false)
   FROM relations WHERE schema_name='public' AND relkind IN ('v','m')) AS public_view_invoker_metadata_matches,
 (SELECT count(*)=9 FROM required_columns x JOIN pg_catalog.pg_attribute a
   ON a.attrelid=pg_catalog.to_regclass(x.relation_name) AND a.attname=x.column_name
   AND a.attnum>0 AND NOT a.attisdropped AND a.atttypid=pg_catalog.to_regtype(x.type_name)
   AND a.atttypmod=x.type_modifier AND a.attnotnull=x.not_null) AS required_auth_and_profile_column_types_present,
 (SELECT count(*)=7 FROM pg_catalog.pg_event_trigger) AS event_hook_count_matches,
 pg_catalog.to_regnamespace('mushavo_email_auth') IS NULL
   AND pg_catalog.to_regnamespace('mushavo_email_install') IS NULL
   AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND left(p.proname,11)='email_gate_')
   AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polname='Email verified session required')
   AS email_backend_installer_and_guards_absent
)
SELECT pg_catalog.jsonb_build_object(
 'checks',pg_catalog.to_jsonb(c),
 'read_only_role',current_user='supabase_read_only_user',
 'transaction_read_only',pg_catalog.current_setting('transaction_read_only')
) AS staging_target_preflight FROM checks c;
