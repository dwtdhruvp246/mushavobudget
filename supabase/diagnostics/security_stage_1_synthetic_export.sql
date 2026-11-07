-- 1.4.2: STAGING ONLY. Private JSON output; never paste results into chat.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';
DO $guard$
DECLARE owner_uuid uuid;
BEGIN
 IF current_database() <> 'postgres' OR current_setting('server_version_num')::integer / 10000 <> 17 THEN
   RAISE EXCEPTION 'STAGING_DATABASE_OR_VERSION_MISMATCH';
 END IF;
 IF (SELECT count(*) FROM auth.users) <> 2 OR
    (SELECT count(*) FROM auth.users WHERE email IN ('audit.owner@example.com','audit.outsider@example.com')) <> 2 OR
    (SELECT count(DISTINCT email) FROM auth.users) <> 2 THEN
   RAISE EXCEPTION 'EXPECTED_TWO_SYNTHETIC_AUTH_USERS_REQUIRED';
 END IF;
 SELECT id INTO owner_uuid FROM auth.users WHERE email='audit.owner@example.com';
 IF (SELECT count(*) FROM public.payment_items) <> 1 OR NOT EXISTS (
   SELECT 1 FROM public.payment_items i JOIN public.budget_workspaces w ON w.id=i.workspace_id
   WHERE i.name='AUDIT-S135-OWNER-ONLY' AND i.owner_id=owner_uuid AND i.created_by=owner_uuid
   AND i.visibility='personal' AND i.family_id IS NULL AND i.amount=20 AND i.currency='USD'
   AND w.owner_id=owner_uuid AND w.workspace_type='personal'
 ) THEN RAISE EXCEPTION 'EXPECTED_SYNTHETIC_PAYMENT_ITEM_REQUIRED'; END IF;
 IF (SELECT count(*) FROM public.payment_records) <> 1 OR NOT EXISTS (
   SELECT 1 FROM public.payment_records r JOIN public.payment_items i ON i.id=r.payment_item_id
   WHERE r.owner_id=owner_uuid AND r.recorded_by=owner_uuid AND r.visibility='personal'
   AND r.family_id IS NULL AND r.amount=20 AND r.currency='USD'
 ) THEN RAISE EXCEPTION 'EXPECTED_SYNTHETIC_PAID_RECORD_REQUIRED'; END IF;
 IF (SELECT count(*) FROM public.budget_workspaces) <> 2 OR
    (SELECT count(DISTINCT owner_id) FROM public.budget_workspaces WHERE workspace_type='personal'
     AND owner_id IN (SELECT id FROM auth.users)) <> 2 THEN
   RAISE EXCEPTION 'EXPECTED_TWO_PERSONAL_WORKSPACES_REQUIRED';
 END IF;
END $guard$;
SELECT jsonb_build_object(
 'stage_step','1.4.2', 'project','dczlddwbtgvfdujgcitb',
 'database',current_database(), 'server_version',current_setting('server_version'),
 'synthetic_guard_passed',true,
 'auth_identities',(SELECT jsonb_agg(jsonb_build_object('id',id,'email',email) ORDER BY email) FROM auth.users),
 'payment_items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.payment_items i),
 'payment_records',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.payment_records r),
 'workspaces',(SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM public.budget_workspaces w),
 'public_relations',(SELECT coalesce(jsonb_agg(jsonb_build_object(
   'name',c.relname,'kind',c.relkind,'rls_enabled',c.relrowsecurity,'rls_forced',c.relforcerowsecurity
 ) ORDER BY c.relname),'[]'::jsonb) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')
 AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')),
 'policy_roles',(SELECT coalesce(jsonb_agg(role_name ORDER BY role_name),'[]'::jsonb) FROM (
 SELECT DISTINCT CASE WHEN r=0 THEN 'PUBLIC' ELSE pg_get_userbyid(r) END AS role_name
 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 CROSS JOIN LATERAL unnest(p.polroles) r WHERE n.nspname='public') roles),
 'included_auth_passwords',false, 'full_platform_backup',false
);
ROLLBACK;
