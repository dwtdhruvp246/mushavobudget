-- Stage 0: metadata only. No user rows, tokens, secrets, file paths, or cron bodies.
-- Run in Supabase SQL Editor as its normal administrative connection.
-- PASS certifies only the named catalog property, never end-to-end authorization.
-- REVIEW and CANNOT VERIFY are expected: this baseline does not implement later stages.
-- This single SELECT returns the rows directly in SQL Editor. It is also tested
-- inside a read-only transaction in scripts/verify-security-stage-0-sql.cjs.

with
expected_tables(name) as (
  values
    ('profiles'), ('app_admins'), ('family_heads'), ('families'), ('family_members'),
    ('expenses'), ('payments'), ('category_budgets'), ('payment_items'), ('payment_records'),
    ('family_invitations'), ('notifications'), ('admin_support_notes'), ('admin_audit_logs'),
    ('budget_workspaces'), ('workspace_members'), ('workspace_invitations'), ('workspace_settings'),
    ('plans'), ('plan_prices'), ('plan_features'), ('plan_limits'), ('workspace_subscriptions'),
    ('subscription_entitlement_history'), ('subscription_invoices'), ('subscription_renewal_requests'),
    ('subscription_payments'), ('subscription_payment_proofs'), ('subscription_payment_reviews'),
    ('subscription_audit_events'), ('supported_currencies'), ('admin_finance_settings'),
    ('exchange_rate_sync_runs'), ('exchange_rate_snapshots'), ('payment_conversions'), ('countries'),
    ('enquiries'), ('push_subscriptions'), ('push_test_rate_limits'), ('notification_outbox'),
    ('support_tickets'), ('support_ticket_messages'), ('admin_notification_outbox'),
    ('admin_user_invitations'), ('admin_user_invitation_audit'), ('analytics_activity_hours'),
    ('cashbook_accounts'), ('cashbook_entries'), ('product_release_controls'),
    ('business_permission_definitions'), ('business_profiles'), ('business_role_permissions'),
    ('business_member_permissions'), ('business_dimensions'), ('business_categories'),
    ('business_member_scopes'), ('business_documents'), ('business_audit_events'),
    ('business_admin_test_provisioning'), ('admin_subscription_grants'), ('business_setup_drafts'),
    ('business_invitation_scopes'), ('business_team_operation_permits'), ('business_expense_claims'),
    ('business_suppliers'), ('business_bill_schedules'), ('business_bills'), ('business_bill_payments'),
    ('business_income_receipts'), ('business_budgets'), ('business_spending_requests'),
    ('business_billing_settings'), ('business_subscription_quotes'), ('business_support_actions'),
    ('business_support_permits'), ('business_change_signals'), ('business_public_purchases'),
    ('business_public_provision_permits'), ('business_roles')
),
tables as (
  select e.name, c.oid, c.relrowsecurity, c.relforcerowsecurity
  from expected_tables e left join pg_class c
    on c.relnamespace = to_regnamespace('public') and c.relname = e.name and c.relkind in ('r','p')
),
roles as (
  select (select oid from pg_roles where rolname='anon') as anon,
         (select oid from pg_roles where rolname='authenticated') as authenticated
),
private_tables as (
  select * from tables where name in ('profiles','app_admins','payments','payment_records',
    'workspace_members','workspace_invitations','workspace_subscriptions','business_roles',
    'business_member_permissions','business_documents','analytics_activity_hours',
    'push_subscriptions','notification_outbox','admin_notification_outbox')
),
protected_writes as (
  select * from tables where name in ('business_roles','business_role_permissions',
    'business_member_permissions','business_team_operation_permits','business_support_permits',
    'business_public_provision_permits','business_change_signals','analytics_activity_hours')
),
required_rpc(signature) as (
  values ('business_roles_snapshot(uuid)'),
    ('save_business_role(uuid,text,text,text,text,text[],integer)'),
    ('archive_business_role(uuid,text,integer)'),
    ('update_business_member_role_access(uuid,uuid,text,uuid[],jsonb)'),
    ('create_business_invitation(uuid,text,text,uuid[])'),
    ('business_has_permission(uuid,text)'), ('my_account_suspended()')
),
rpc as (select signature, to_regprocedure('public.'||signature)::oid as oid from required_rpc),
private_helpers(signature) as (
  values ('business_check_role_assignment(uuid,text,uuid[],uuid)'),
    ('business_role_owner_required(uuid)'), ('seed_business_roles(uuid)')
),
helpers as (select signature, to_regprocedure('public.'||signature)::oid as oid from private_helpers),
expected_buckets(id) as (values ('payment-proofs'),('subscription-proofs'),('business-documents'),('business-logos')),
buckets as (
  select e.id, b.id is not null as present, b.public, b.file_size_limit, b.allowed_mime_types
  from expected_buckets e left join storage.buckets b on b.id=e.id
),
checks(check_name,status,details) as (
  select '01 API roles exist', case when anon is not null and authenticated is not null then 'PASS' else 'FAIL' end,
    jsonb_build_object('anon',anon is not null,'authenticated',authenticated is not null) from roles
  union all
  select '02 Expected application tables exist', case when count(*) filter(where oid is null)=0 then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected_count',count(*),'missing',coalesce(jsonb_agg(name order by name) filter(where oid is null),'[]'::jsonb)) from tables
  union all
  select '03 Expected application tables enable RLS', case when bool_and(oid is not null and relrowsecurity) then 'PASS' else 'FAIL' end,
    jsonb_build_object('missing_or_without_rls',coalesce(jsonb_agg(name order by name) filter(where oid is null or not relrowsecurity),'[]'::jsonb)) from tables
  union all
  select '04 Storage object RLS is enabled', case when coalesce((select relrowsecurity from pg_class where oid=to_regclass('storage.objects')),false) then 'PASS' else 'FAIL' end,
    jsonb_build_object('scope','RLS flag only; object authorization still needs direct tests')
  union all
  select '05 Required private buckets exist', case when bool_and(present) then 'PASS' else 'FAIL' end,
    jsonb_build_object('missing',coalesce(jsonb_agg(id order by id) filter(where not present),'[]'::jsonb)) from buckets
  union all
  select '06 Required buckets are private', case when bool_and(present and not public) then 'PASS' else 'FAIL' end,
    jsonb_build_object('missing_or_public',coalesce(jsonb_agg(id order by id) filter(where not present or public),'[]'::jsonb)) from buckets
  union all
  select '07 Required buckets have size and MIME limits', case when bool_and(present and coalesce(file_size_limit,0)>0 and coalesce(cardinality(allowed_mime_types),0)>0) then 'PASS' else 'FAIL' end,
    coalesce(jsonb_agg(jsonb_build_object('bucket',id,'max_bytes',file_size_limit,'mime_types',allowed_mime_types) order by id),'[]'::jsonb) from buckets
  union all
  select '08 Anonymous private-table SELECT privileges are absent',
    case when r.anon is null then 'CANNOT VERIFY' when bool_and(t.oid is not null and not has_any_column_privilege(r.anon,t.oid,'SELECT')) then 'PASS' else 'FAIL' end,
    jsonb_build_object('missing_or_granted',coalesce(jsonb_agg(t.name order by t.name) filter(where t.oid is null or has_any_column_privilege(r.anon,t.oid,'SELECT')),'[]'::jsonb))
    from private_tables t cross join roles r group by r.anon
  union all
  select '09 Authenticated protected direct-write privileges are absent',
    case when r.authenticated is null then 'CANNOT VERIFY' when bool_and(t.oid is not null and not has_any_column_privilege(r.authenticated,t.oid,'INSERT,UPDATE') and not has_table_privilege(r.authenticated,t.oid,'DELETE,TRUNCATE')) then 'PASS' else 'FAIL' end,
    jsonb_build_object('missing_or_granted',coalesce(jsonb_agg(t.name order by t.name) filter(where t.oid is null or has_any_column_privilege(r.authenticated,t.oid,'INSERT,UPDATE') or has_table_privilege(r.authenticated,t.oid,'DELETE,TRUNCATE')),'[]'::jsonb))
    from protected_writes t cross join roles r group by r.authenticated
  union all
  select '10 Profile column writes stay within the source allowlist',
    case when r.authenticated is null then 'CANNOT VERIFY' when to_regclass('public.profiles') is null then 'FAIL'
      when exists(select 1 from pg_attribute a where a.attrelid=to_regclass('public.profiles') and a.attnum>0 and not a.attisdropped
        and ((a.attname not in ('id','full_name','email') and has_column_privilege(r.authenticated,a.attrelid,a.attnum,'INSERT'))
          or (a.attname not in ('full_name','email','country_code') and has_column_privilege(r.authenticated,a.attrelid,a.attnum,'UPDATE')))) then 'FAIL' else 'PASS' end,
    jsonb_build_object('scope','Column privileges only; allowed email/id writes still need ownership and identity tests') from roles r
  union all
  select '11 Required protected RPCs are installed', case when bool_and(oid is not null) then 'PASS' else 'FAIL' end,
    jsonb_build_object('missing',coalesce(jsonb_agg(signature order by signature) filter(where oid is null),'[]'::jsonb)) from rpc
  union all
  select '12 Internal role helpers cannot be called by API roles',
    case when r.anon is null or r.authenticated is null then 'CANNOT VERIFY'
      when bool_and(h.oid is not null and not has_function_privilege(r.anon,h.oid,'EXECUTE') and not has_function_privilege(r.authenticated,h.oid,'EXECUTE')) then 'PASS' else 'FAIL' end,
    jsonb_build_object('missing_or_executable',coalesce(jsonb_agg(h.signature order by h.signature) filter(where h.oid is null or has_function_privilege(r.anon,h.oid,'EXECUTE') or has_function_privilege(r.authenticated,h.oid,'EXECUTE')),'[]'::jsonb))
    from helpers h cross join roles r group by r.anon,r.authenticated
  union all
  select '13 Business role catalog forces RLS', case when coalesce((select relrowsecurity and relforcerowsecurity from tables where name='business_roles'),false) then 'PASS' else 'FAIL' end,
    jsonb_build_object('scope','Catalog flags only; owner bypass and RPC behavior tested separately')
  union all
  select '14 SECURITY DEFINER search paths', 'REVIEW',
    coalesce(jsonb_agg(jsonb_build_object('function',p.oid::regprocedure::text,'search_path',
      (select value from unnest(p.proconfig) value where value like 'search_path=%' limit 1)) order by p.proname),'[]'::jsonb)
    from pg_proc p where p.pronamespace=to_regnamespace('public') and p.prosecdef
      and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
  union all
  select '15 Anonymous executable SECURITY DEFINER inventory', 'REVIEW',
    coalesce(jsonb_agg(p.oid::regprocedure::text order by p.proname),'[]'::jsonb)
    from pg_proc p cross join roles r where p.pronamespace=to_regnamespace('public') and p.prosecdef and has_function_privilege(r.anon,p.oid,'EXECUTE')
  union all
  select '16 Policy metadata inventory', 'REVIEW',
    coalesce(jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'policy',policyname,'roles',roles,'command',cmd,'permissive',permissive) order by schemaname,tablename,policyname),'[]'::jsonb)
    from pg_policies where schemaname in ('public','storage')
  union all
  select '17 Realtime publication metadata', 'REVIEW',
    jsonb_build_object('all_tables',coalesce((select puballtables from pg_publication where pubname='supabase_realtime'),false),
      'tables',coalesce((select jsonb_agg(schemaname||'.'||tablename order by schemaname,tablename) from pg_publication_tables where pubname='supabase_realtime'),'[]'::jsonb),
      'scope','No authenticated subscription or removal test is performed')
  union all
  select '18 Auth/profile/workspace cascade inventory', 'REVIEW',
    coalesce(jsonb_agg(jsonb_build_object('child',conrelid::regclass::text,'parent',confrelid::regclass::text,'constraint',conname,'on_delete',
      case confdeltype when 'c' then 'CASCADE' when 'n' then 'SET NULL' when 'r' then 'RESTRICT' when 'd' then 'SET DEFAULT' else 'NO ACTION' end) order by conname),'[]'::jsonb)
    from pg_constraint where contype='f' and confrelid in (to_regclass('auth.users'),to_regclass('public.profiles'),to_regclass('public.budget_workspaces'),to_regclass('public.families'))
  union all
  select '19 Anonymous enquiry INSERT privilege', 'REVIEW',
    jsonb_build_object('granted',coalesce((select has_any_column_privilege(r.anon,t.oid,'INSERT') from tables t where t.name='enquiries'),false),
      'finding','F09: grant metadata does not establish server-side quotas or challenge validation') from roles r
  union all
  select '20 Scheduler and migration-ledger availability', 'REVIEW',
    jsonb_build_object('cron_catalog_present',to_regclass('cron.job') is not null,'migration_ledger_present',to_regclass('supabase_migrations.schema_migrations') is not null,
      'scope','Manual SQL may not enter the CLI ledger. No cron command, secret or execution is read.')
  union all
  select '21 Live tenant isolation and account suspension', 'CANNOT VERIFY',
    jsonb_build_object('finding','F15','required','Controlled JWT/PostgREST/RPC/Storage/realtime allowed and denied tests in isolated staging')
  union all
  select '22 Admin MFA and Auth provider configuration', 'CANNOT VERIFY',
    jsonb_build_object('findings','F04,F08','required','Dashboard settings and server-enforced assurance checks; do not share tokens or MFA seeds')
  union all
  select '23 Database and Storage restore evidence', 'CANNOT VERIFY',
    jsonb_build_object('finding','F16','required','Separate database and object-byte backups plus an isolated restore drill')
  union all
  select '24 Store/native builds and privacy declarations', 'CANNOT VERIFY',
    jsonb_build_object('findings','F05,F10,F11,F14,F17,F20','required','Actual native configuration, release artifacts, provider/console evidence and real-device checks')
)
select check_name, status, details from checks order by check_name;
