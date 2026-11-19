-- Install server-side reconciliation for tracked Business logo replacements on staging.
begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
set local statement_timeout='20s';
select pg_advisory_xact_lock(20261017,2411);

do $scope$
begin
  if not exists(select 1 from mushavo_email_install.rollout_control where singleton and mode='ACTIVE'
    and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='4fb5bedf8ff8dd4ebd5bbef1ba416f8d89efec8886b9fb1af1c50880999ba2be' and catalog_sha256=mushavo_email_install.catalog_identity())
    or not exists(select 1 from public.budget_workspaces w join public.business_profiles p on p.workspace_id=w.id
      join public.workspace_subscriptions s on s.workspace_id=w.id
      where w.id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and w.owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and w.status='suspended' and w.business_support_version=56
        and p.version=23 and p.logo_storage_path is null and s.version=1 and s.paid_through_at='2026-11-14 00:00:00+00')
    or exists(select 1 from storage.objects where bucket_id='business-logos' and split_part(name,'/',1)='8d9307e6-aada-4c9a-a8f5-43c57e0865e2')
  then raise exception 'EXACT_LOGO_REPLACEMENT_STAGING_BASELINE_REQUIRED'; end if;
end;
$scope$;

create table mushavo_file_ingest.logo_cleanup_settings (
  workspace_id uuid primary key references public.budget_workspaces(id),
  enabled boolean not null default false,
  delay_seconds integer not null default 3600 check(delay_seconds between 10 and 86400)
);
create table mushavo_file_ingest.logo_replacements (
  object_name text primary key,
  workspace_id uuid not null references mushavo_file_ingest.logo_cleanup_settings(workspace_id),
  due_at timestamptz not null,
  state text not null check(state in ('queued','claimed','removed')),
  token uuid,
  lease_until timestamptz,
  attempts integer not null default 0,
  check(split_part(object_name,'/',1)=workspace_id::text),
  check(object_name ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}/[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}/[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}[.](png|jpg|webp)$')
);
create index logo_replacement_next_due on mushavo_file_ingest.logo_replacements(due_at) where state<>'removed';
create table mushavo_file_ingest.logo_cleanup_dispatch (
  nonce uuid primary key,
  issued_at timestamptz not null
);
alter table mushavo_file_ingest.logo_cleanup_settings enable row level security;
alter table mushavo_file_ingest.logo_replacements enable row level security;
alter table mushavo_file_ingest.logo_cleanup_dispatch enable row level security;
alter table mushavo_file_ingest.logo_cleanup_settings force row level security;
alter table mushavo_file_ingest.logo_replacements force row level security;
alter table mushavo_file_ingest.logo_cleanup_dispatch force row level security;
revoke all on mushavo_file_ingest.logo_cleanup_settings,mushavo_file_ingest.logo_replacements,mushavo_file_ingest.logo_cleanup_dispatch
  from public,anon,authenticated,service_role;

create function mushavo_file_ingest.record_logo_replacement()
returns trigger language plpgsql security definer set search_path=pg_catalog as $body$
declare
  v_delay integer;
  v_state text;
begin
  if new.logo_storage_path is not distinct from old.logo_storage_path then return new; end if;
  select delay_seconds into v_delay from mushavo_file_ingest.logo_cleanup_settings where workspace_id=new.workspace_id and enabled;

  -- A cleanup lease permanently retires the path. Lock any earlier queue entry
  -- so a concurrent scheduled claim cannot delete a logo being selected again.
  if new.logo_storage_path is not null then
    select state into v_state from mushavo_file_ingest.logo_replacements where object_name=new.logo_storage_path for update;
    if v_state in ('claimed','removed') then raise exception 'BUSINESS_LOGO_PATH_RETIRED'; end if;
    if v_state='queued' then
      delete from mushavo_file_ingest.logo_replacements where object_name=new.logo_storage_path;
    end if;
  end if;

  if v_delay is not null and old.logo_storage_path is not null then
    insert into mushavo_file_ingest.logo_replacements(object_name,workspace_id,due_at,state)
      values(old.logo_storage_path,new.workspace_id,clock_timestamp()+make_interval(secs=>v_delay),'queued');
  end if;
  return new;
end;
$body$;
revoke all on function mushavo_file_ingest.record_logo_replacement() from public,anon,authenticated,service_role;
create trigger z_fr32_business_logo_replacement before update of logo_storage_path on public.business_profiles
for each row execute function mushavo_file_ingest.record_logo_replacement();

create function public.fr32_claim_logo_replacements(p_nonce uuid,p_epoch bigint,p_limit integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $body$
declare
  v_now timestamptz := clock_timestamp();
  v_batch jsonb;
begin
  if p_nonce is null or p_epoch not between extract(epoch from v_now)::bigint-90 and extract(epoch from v_now)::bigint+30
    or p_epoch is null or p_limit is null or p_limit not between 1 and 20 then return null; end if;

  -- Dispatch records remain for longer than the maximum signature age.
  delete from mushavo_file_ingest.logo_cleanup_dispatch where issued_at<v_now-interval '1 day';
  insert into mushavo_file_ingest.logo_cleanup_dispatch(nonce,issued_at) values(p_nonce,v_now) on conflict do nothing;
  if not found then return null; end if;

  with due as (
    select r.object_name from mushavo_file_ingest.logo_replacements r
    join mushavo_file_ingest.logo_cleanup_settings l on l.workspace_id=r.workspace_id and l.enabled
    where r.due_at<=v_now and (r.state='queued' or (r.state='claimed' and r.lease_until<v_now))
      and not exists(select 1 from public.business_profiles p where p.logo_storage_path=r.object_name)
    order by r.due_at,r.object_name limit p_limit for update of r skip locked
  ), taken as (
    update mushavo_file_ingest.logo_replacements r
      set state='claimed', token=gen_random_uuid(), lease_until=v_now+interval '1 minute', attempts=attempts+1
    from due where r.object_name=due.object_name
    returning r.object_name,r.token
  ) select coalesce(jsonb_agg(jsonb_build_object('object_name',object_name,'cleanup_token',token)),'[]'::jsonb) into v_batch from taken;
  return v_batch;
end;
$body$;
revoke all on function public.fr32_claim_logo_replacements(uuid,bigint,integer) from public,anon,authenticated;
grant execute on function public.fr32_claim_logo_replacements(uuid,bigint,integer) to service_role;

create function public.fr32_finish_logo_replacement(p_object text,p_token uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog as $body$
begin
  update mushavo_file_ingest.logo_replacements r
    set state='removed', token=null, lease_until=null
    where r.object_name=p_object and r.state='claimed' and r.token=p_token
      and not exists(select 1 from public.business_profiles p where p.logo_storage_path=r.object_name)
      and not exists(select 1 from storage.objects o where o.bucket_id='business-logos' and o.name=r.object_name);
  return found;
end;
$body$;
revoke all on function public.fr32_finish_logo_replacement(text,uuid) from public,anon,authenticated;
grant execute on function public.fr32_finish_logo_replacement(text,uuid) to service_role;

create function public.fr32_logo_replacement_mode()
returns boolean language sql stable security definer set search_path=pg_catalog as $body$
  select exists(select 1 from mushavo_file_ingest.logo_cleanup_settings where enabled)
$body$;
revoke all on function public.fr32_logo_replacement_mode() from public,anon,authenticated;
grant execute on function public.fr32_logo_replacement_mode() to service_role;

insert into mushavo_file_ingest.logo_cleanup_settings(workspace_id,enabled,delay_seconds)
values('8d9307e6-aada-4c9a-a8f5-43c57e0865e2',true,10);
update public.workspace_subscriptions set paid_through_at=now()+interval '2 hours'
where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and version=1 and paid_through_at='2026-11-14 00:00:00+00';

update mushavo_email_install.rollout_control set catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
where singleton and target_project='dczlddwbtgvfdujgcitb' and mode='ACTIVE' and catalog_sha256='4fb5bedf8ff8dd4ebd5bbef1ba416f8d89efec8886b9fb1af1c50880999ba2be';
notify pgrst,'reload schema';
commit;
