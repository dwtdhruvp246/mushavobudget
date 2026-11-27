-- Staging only. Rebind the gate after a runner error ended before any upload.
begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
select pg_advisory_xact_lock(20261017,2411);
do $preflight$
begin
  if not exists (select 1 from mushavo_email_install.rollout_control where singleton and mode='ACTIVE'
    and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='48c4d12ad65b5d30c054c8283cf13c3425ea9c3d299b9ab2da0461023f552014'
    and catalog_sha256=mushavo_email_install.catalog_identity())
    or (select md5(prosrc) from pg_proc where oid='public.fr3_business_table_gate_ready()'::regprocedure) is distinct from '4dcb4ec5510521e1f2caf7f31ffda7ab'
    or not exists(select 1 from public.budget_workspaces w join public.workspace_subscriptions s on s.workspace_id=w.id
       where w.id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and w.owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and w.name='audit-fr3-logo-ingestion-20261112'
         and w.status='suspended' and w.business_support_version=26 and s.paid_through_at='2026-11-14 15:36:19.579823+00' and s.paid_through_at>now())
    or exists(select 1 from public.business_documents where id in ('90545cd6-af7c-464f-8864-45fb905f7f92','90d83c56-a450-4fb2-9d45-bf4dc652b357'))
    or exists(select 1 from storage.objects where bucket_id='business-documents' and name like 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/%')
  then raise exception 'EXACT_BUSINESS_TABLE_RETRY_BASELINE_REQUIRED'; end if;
end;
$preflight$;
CREATE OR REPLACE FUNCTION public.fr3_business_table_gate_ready()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select (select relrowsecurity from pg_class where oid='storage.objects'::regclass)
    and exists (select 1 from public.budget_workspaces w join public.workspace_subscriptions s on s.workspace_id=w.id
      where w.id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and w.owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'
      and w.name='audit-fr3-logo-ingestion-20261112' and w.status='active' and w.business_support_version=27
      and s.status='active' and s.paid_through_at>now())
    and (select count(*)=2 from pg_policy p
      cross join (values ($policy$((bucket_id <> 'business-documents'::text) OR (NOT (starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/90545cd6-af7c-464f-8864-45fb905f7f92/'::text) OR starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/90d83c56-a450-4fb2-9d45-bf4dc652b357/'::text))))$policy$)) v(expr)
      where p.polrelid='storage.objects'::regclass and not p.polpermissive
      and p.polroles @> array[to_regrole('anon')::oid,to_regrole('authenticated')::oid]
      and pg_get_expr(p.polwithcheck,p.polrelid)=v.expr
      and ((p.polname='fr3_business_table_server_insert' and p.polcmd='a' and p.polqual is null)
        or (p.polname='fr3_business_table_server_update' and p.polcmd='w' and pg_get_expr(p.polqual,p.polrelid)=v.expr)));
$function$;
update mushavo_email_install.rollout_control
set catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
where singleton and mode='ACTIVE' and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='48c4d12ad65b5d30c054c8283cf13c3425ea9c3d299b9ab2da0461023f552014';
commit;
