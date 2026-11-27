-- Staging candidate. Apply only to the isolated synthetic fixture after review.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '10s';
lock table storage.objects in share row exclusive mode;

do $$
begin
  if not exists (
    select 1
    from public.budget_workspaces w
    join public.business_profiles p on p.workspace_id = w.id
    where w.id = '8d9307e6-aada-4c9a-a8f5-43c57e0865e2'
      and w.workspace_type = 'business'
      and w.name = 'audit-fr3-logo-ingestion-20261112'
      and p.logo_storage_path is null
  ) or exists (
    select 1 from storage.objects
    where bucket_id = 'business-logos'
      and split_part(name, '/', 1) = '8d9307e6-aada-4c9a-a8f5-43c57e0865e2'
  ) then
    raise exception 'FR3_LOGO_FIXTURE_NOT_EMPTY_OR_MISSING';
  end if;
end;
$$;

create policy fr3_logo_fixture_validator_insert
  on storage.objects as restrictive for insert to authenticated, anon
  with check (
    bucket_id <> 'business-logos'
    or split_part(name, '/', 1) <> '8d9307e6-aada-4c9a-a8f5-43c57e0865e2'
  );

create policy fr3_logo_fixture_validator_update
  on storage.objects as restrictive for update to authenticated, anon
  using (
    bucket_id <> 'business-logos'
    or split_part(name, '/', 1) <> '8d9307e6-aada-4c9a-a8f5-43c57e0865e2'
  )
  with check (
    bucket_id <> 'business-logos'
    or split_part(name, '/', 1) <> '8d9307e6-aada-4c9a-a8f5-43c57e0865e2'
  );

-- The Edge Function calls this with its server credential before accepting bytes.
create function public.fr3_logo_fixture_gate_ready()
returns boolean
language sql stable security invoker set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.budget_workspaces w
    where w.id = '8d9307e6-aada-4c9a-a8f5-43c57e0865e2'
      and w.workspace_type = 'business' and w.status = 'active'
  ) and exists (
    select 1 from pg_class where oid = 'storage.objects'::regclass and relrowsecurity
  ) and (
    select count(*) = 2 from pg_policy p
    cross join (values (
      '((bucket_id <> ''business-logos''::text) OR (split_part(name, ''/''::text, 1) <> ''8d9307e6-aada-4c9a-a8f5-43c57e0865e2''::text))'
    )) as expected(expr)
    where p.polrelid = 'storage.objects'::regclass and not p.polpermissive
      and p.polroles @> array[to_regrole('anon')::oid, to_regrole('authenticated')::oid]
      and pg_get_expr(p.polwithcheck, p.polrelid) = expected.expr
      and (
        (p.polname = 'fr3_logo_fixture_validator_insert' and p.polcmd = 'a' and p.polqual is null)
        or (p.polname = 'fr3_logo_fixture_validator_update' and p.polcmd = 'w'
            and pg_get_expr(p.polqual, p.polrelid) = expected.expr)
      )
  );
$$;
revoke all on function public.fr3_logo_fixture_gate_ready() from public, anon, authenticated;
grant execute on function public.fr3_logo_fixture_gate_ready() to service_role;
commit;
