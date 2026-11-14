-- Staging only. Reopen the isolated unpaid bill test after the claim preview passed.
begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
select pg_advisory_xact_lock(20261017,2411);
do $preflight$
begin
 if not exists(select 1 from mushavo_email_install.rollout_control where singleton and mode='ACTIVE'
   and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='b2842e6dc21ff7713090abfcea29b8ff39414b3c056d03e55b5c5893b43f7bc0' and catalog_sha256=mushavo_email_install.catalog_identity())
   or (select md5(prosrc) from pg_proc where oid='public.fr3_business_attachment_gate_ready()'::regprocedure) is distinct from '6b5007bf4a4429a6ec65332e2408962b'
   or not exists(select 1 from public.budget_workspaces w join public.workspace_subscriptions s on s.workspace_id=w.id
       join public.business_profiles bp on bp.workspace_id=w.id
       where w.id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and w.status='suspended' and w.owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and w.business_support_version=42
       and s.paid_through_at='2026-11-14 16:22:12.821429+00' and s.paid_through_at>now() and bp.onboarding_status='complete' and bp.version=20)
   or not exists(select 1 from public.business_documents where id='7b7e5da1-ff93-44a0-91e0-2dd6a400cac3' and workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and parent_id='454e6059-4b4c-4998-aa9d-ea932b15ca50' and status='archived')
   or exists(select 1 from public.business_documents where id='c877b770-3bb6-4e0c-aae3-a6a10f3234f6' or workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and status='active')
   or exists(select 1 from storage.objects where bucket_id='business-documents' and name like 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/%')
 then raise exception 'EXACT_BILL_BROWSER_BASELINE_REQUIRED'; end if;
end;
$preflight$;
CREATE OR REPLACE FUNCTION public.fr3_business_attachment_gate_ready()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select (select relrowsecurity from pg_class where oid='storage.objects'::regclass)
    and exists(select 1 from public.budget_workspaces w join public.workspace_subscriptions s on s.workspace_id=w.id
      where w.id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and w.owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and w.name='audit-fr3-logo-ingestion-20261112'
        and w.status='active' and w.business_support_version=43 and s.status='active' and s.paid_through_at>now())
    and (select count(*)=2 from pg_policy p
      cross join (values ($policy$((bucket_id <> 'business-documents'::text) OR (NOT (starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/7d488239-ba6e-440e-8be1-5e255b2ead79/'::text) OR starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/c877b770-3bb6-4e0c-aae3-a6a10f3234f6/'::text) OR starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/7b7e5da1-ff93-44a0-91e0-2dd6a400cac3/'::text))))$policy$)) v(expr)
      where p.polrelid='storage.objects'::regclass and not p.polpermissive
      and p.polroles @> array[to_regrole('anon')::oid,to_regrole('authenticated')::oid]
      and pg_get_expr(p.polwithcheck,p.polrelid)=v.expr
      and ((p.polname='fr3_business_attachment_server_insert' and p.polcmd='a' and p.polqual is null)
        or (p.polname='fr3_business_attachment_server_update' and p.polcmd='w' and pg_get_expr(p.polqual,p.polrelid)=v.expr)));
$function$;
update mushavo_email_install.rollout_control set catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
where singleton and mode='ACTIVE' and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='b2842e6dc21ff7713090abfcea29b8ff39414b3c056d03e55b5c5893b43f7bc0';
commit;
