-- Staging candidate. Apply only to the isolated synthetic fixture after review.
begin;
lock table storage.objects in share row exclusive mode;

do $$
begin
  if not exists (
    select 1
    from public.budget_workspaces w
    join public.business_profiles p on p.workspace_id = w.id
    where w.id = 'dc22360d-4b49-4bd4-9131-8633f7e821ff'
      and w.workspace_type = 'business'
      and w.name = 'audit-fr3-logo-ingestion-20261112'
      and p.logo_storage_path is null
  ) or exists (
    select 1 from storage.objects
    where bucket_id = 'business-logos'
      and split_part(name, '/', 1) = 'dc22360d-4b49-4bd4-9131-8633f7e821ff'
  ) then
    raise exception 'FR3_LOGO_FIXTURE_NOT_EMPTY_OR_MISSING';
  end if;
end;
$$;

create policy fr3_logo_fixture_validator_insert
  on storage.objects as restrictive for insert to authenticated, anon
  with check (
    bucket_id <> 'business-logos'
    or split_part(name, '/', 1) <> 'dc22360d-4b49-4bd4-9131-8633f7e821ff'
  );

create policy fr3_logo_fixture_validator_update
  on storage.objects as restrictive for update to authenticated, anon
  using (
    bucket_id <> 'business-logos'
    or split_part(name, '/', 1) <> 'dc22360d-4b49-4bd4-9131-8633f7e821ff'
  )
  with check (
    bucket_id <> 'business-logos'
    or split_part(name, '/', 1) <> 'dc22360d-4b49-4bd4-9131-8633f7e821ff'
  );
commit;
