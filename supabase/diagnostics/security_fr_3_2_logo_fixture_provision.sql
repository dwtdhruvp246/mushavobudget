-- Exact, disposable staging fixture. Existing Auth accounts and fixtures are preserved.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';
set local search_path = pg_catalog;

do $$
declare
  fixture constant uuid := 'dc22360d-4b49-4bd4-9131-8633f7e821ff';
  fixture_name constant text := 'audit-fr3-logo-ingestion-20261112';
  owner_id uuid;
  plan_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('mushavo-fr3-logo-fixture'));
  if current_setting('session_replication_role') <> 'origin'
    or exists (select 1 from public.budget_workspaces w where w.id = fixture or w.name = fixture_name)
    or exists (select 1 from storage.objects o where o.bucket_id = 'business-logos' and split_part(o.name, '/', 1) = fixture::text)
  then raise exception 'FR3_EXPECTED_EMPTY_FIXTURE'; end if;

  select w.owner_id into strict owner_id
  from public.budget_workspaces w
  join public.profiles p on p.id = w.owner_id and p.account_status = 'active'
  join auth.users u on u.id = w.owner_id and u.email_confirmed_at is not null
  where w.id = 'dcf3d122-e99f-4fe5-bbd1-03c3547629df'
    and w.name = 'audit-batch-x-receipt-d7be160c2026' and w.status = 'suspended'
    and not exists (select 1 from public.app_admins a where a.user_id = w.owner_id);
  select p.id into strict plan_id from public.plans p
  where p.code = 'business' and p.workspace_type = 'business' and p.is_active;

  -- Satisfy the existing exact transaction/actor permit for synthetic seeding.
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  insert into public.business_public_provision_permits(transaction_id, workspace_id, owner_id, actor_id)
  values(txid_current(), fixture, owner_id, owner_id);
  insert into public.budget_workspaces(id, owner_id, workspace_type, name, status)
  values(fixture, owner_id, 'business', fixture_name, 'active');
  insert into public.workspace_members(workspace_id, user_id, role, status)
  values(fixture, owner_id, 'business_owner', 'active');
  delete from public.business_public_provision_permits p
  where p.transaction_id = txid_current() and p.workspace_id = fixture;

  insert into public.workspace_subscriptions(workspace_id, plan_id, status, paid_through_at, member_limit, billing_period)
  values(fixture, plan_id, 'active', now() + interval '3 hours', 1, 'monthly');
  insert into public.workspace_settings(workspace_id, reminder_enabled, conversion_enabled,
    base_currency, reporting_currency, default_payment_currency, enabled_currencies)
  values(fixture, false, false, 'USD', 'USD', 'USD', array['USD']);

  if not exists (select 1 from public.business_profiles p where p.workspace_id = fixture
    and p.trading_name = fixture_name and p.logo_storage_path is null)
    or not exists (select 1 from public.workspace_members m where m.workspace_id = fixture
      and m.user_id = owner_id and m.role = 'business_owner' and m.status = 'active')
  then raise exception 'FR3_EMPTY_OWNER_FIXTURE_REQUIRED'; end if;
end;
$$;
commit;
