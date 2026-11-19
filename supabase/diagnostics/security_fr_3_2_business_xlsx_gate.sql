-- Staging only. Reopen the validator for the XLSX fixture while CSV remains closed.
begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
select pg_advisory_xact_lock(20261017,2411);
do $preflight$
begin
  if not exists (select 1 from mushavo_email_install.rollout_control where singleton and mode='ACTIVE'
    and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='73e6cc191681fa1ea3f00875a5474db711a0dda6b52862ee876ddfefe8f8a022' and catalog_sha256=mushavo_email_install.catalog_identity())
    or (select md5(prosrc) from pg_proc where oid='public.fr3_business_table_gate_ready()'::regprocedure) is distinct from '16524ea451e46b7cc2522103d6cc2851'
    or not exists(select 1 from public.budget_workspaces w join public.workspace_subscriptions s on s.workspace_id=w.id
      where w.id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and w.owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and w.name='audit-fr3-logo-ingestion-20261112' and w.status='suspended'
        and w.business_support_version=28 and s.plan_id='0ccf35bb-43c7-4c1b-9148-0f352b85bd2a' and s.status='active' and s.version=1
        and s.member_limit=1 and s.paid_through_at='2026-11-14T00:00:00+00:00'::timestamptz and s.updated_at='2026-11-12T18:32:58.996201+00:00'::timestamptz)
    or not exists(select 1 from public.business_documents where id='90545cd6-af7c-464f-8864-45fb905f7f92' and workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and status='archived')
    or exists(select 1 from public.business_documents where id='90d83c56-a450-4fb2-9d45-bf4dc652b357')
    or exists(select 1 from storage.objects where bucket_id='business-documents' and name like 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/%')
  then raise exception 'EXACT_BUSINESS_XLSX_RETRY_BASELINE_REQUIRED'; end if;
end;
$preflight$;
create function public.fr3_business_table_gate_ready_for_type(p_mime_type text)
returns boolean
language sql
stable set search_path to 'pg_catalog'
as $function$

  select p_mime_type is not distinct from 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' and (select relrowsecurity from pg_class where oid='storage.objects'::regclass)
    and exists (select 1 from public.budget_workspaces w join public.workspace_subscriptions s on s.workspace_id=w.id
      where w.id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and w.owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'
      and w.name='audit-fr3-logo-ingestion-20261112' and w.status='active' and w.business_support_version=29
      and s.status='active' and s.paid_through_at>now())
    and (select count(*)=2 from pg_policy p
      cross join (values ($policy$((bucket_id <> 'business-documents'::text) OR (NOT (starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/90545cd6-af7c-464f-8864-45fb905f7f92/'::text) OR starts_with(name, 'workspaces/8d9307e6-aada-4c9a-a8f5-43c57e0865e2/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/90d83c56-a450-4fb2-9d45-bf4dc652b357/'::text))))$policy$)) v(expr)
      where p.polrelid='storage.objects'::regclass and not p.polpermissive
      and p.polroles @> array[to_regrole('anon')::oid,to_regrole('authenticated')::oid]
      and pg_get_expr(p.polwithcheck,p.polrelid)=v.expr
      and ((p.polname='fr3_business_table_server_insert' and p.polcmd='a' and p.polqual is null)
        or (p.polname='fr3_business_table_server_update' and p.polcmd='w' and pg_get_expr(p.polqual,p.polrelid)=v.expr)));

$function$;
revoke all on function public.fr3_business_table_gate_ready_for_type(text) from public, anon, authenticated;
grant execute on function public.fr3_business_table_gate_ready_for_type(text) to service_role;
update mushavo_email_install.rollout_control
set catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
where singleton and mode='ACTIVE' and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='73e6cc191681fa1ea3f00875a5474db711a0dda6b52862ee876ddfefe8f8a022';
notify pgrst,'reload schema';
commit;
