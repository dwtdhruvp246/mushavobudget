-- Restore the synthetic fixture and enable scheduled logo replacement cleanup for staging workspaces.
begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
set local statement_timeout='20s';
select pg_advisory_xact_lock(20261017,2411);

do $preflight$
begin
  if not exists(select 1 from mushavo_email_install.rollout_control where singleton and mode='ACTIVE'
    and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='0b9a32fb826cf3dfb6e0630715ada753e04be36dc668b60a168bd65717f83d86' and catalog_sha256=mushavo_email_install.catalog_identity())
    or not exists(select 1 from public.budget_workspaces w join public.business_profiles p on p.workspace_id=w.id
      where w.id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and w.owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and w.status='suspended' and w.business_support_version=60
        and p.version=29 and p.logo_storage_path is null)
    or (select count(*) from mushavo_file_ingest.logo_replacements r where r.workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and r.state='removed' and r.attempts=1
      and not exists(select 1 from storage.objects o where o.bucket_id='business-logos' and o.name=r.object_name))<>4
    or exists(select 1 from storage.objects o where o.bucket_id='business-logos' and split_part(o.name,'/',1)='8d9307e6-aada-4c9a-a8f5-43c57e0865e2')
  then raise exception 'EXACT_LOGO_REPLACEMENT_CLOSEOUT_REQUIRED'; end if;

  update public.workspace_subscriptions set paid_through_at='2026-11-14 00:00:00+00'
  where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and version=1 and paid_through_at='2026-11-15 17:23:10.819932+00';
  if not found then raise exception 'EXACT_LOGO_FIXTURE_TERM_RESTORE_REQUIRED'; end if;
  update mushavo_file_ingest.logo_cleanup_settings set enabled=false,delay_seconds=3600
  where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and enabled;
  if not found then raise exception 'EXACT_LOGO_FIXTURE_CLEANUP_SETTING_REQUIRED'; end if;
end;
$preflight$;

create table mushavo_file_ingest.logo_cleanup_rollout (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false
);
alter table mushavo_file_ingest.logo_cleanup_rollout enable row level security;
alter table mushavo_file_ingest.logo_cleanup_rollout force row level security;
revoke all on mushavo_file_ingest.logo_cleanup_rollout from public,anon,authenticated,service_role;
insert into mushavo_file_ingest.logo_cleanup_rollout(enabled) values(true);

CREATE OR REPLACE FUNCTION mushavo_file_ingest.record_logo_replacement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_delay integer;
  v_state text;
begin
  if new.logo_storage_path is not distinct from old.logo_storage_path then return new; end if;
  -- Older imported profile paths are ignored if their ownership cannot be derived.
  if old.logo_storage_path is not null and split_part(old.logo_storage_path,'/',1)=new.workspace_id::text
    and old.logo_storage_path ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}/[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}/[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}[.](png|jpg|webp)$'
    and exists(select 1 from mushavo_file_ingest.logo_cleanup_rollout where singleton and enabled)
  then
    insert into mushavo_file_ingest.logo_cleanup_settings(workspace_id,enabled) values(new.workspace_id,true)
      on conflict(workspace_id) do nothing;
  end if;
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

  if v_delay is not null and old.logo_storage_path is not null
    and split_part(old.logo_storage_path,'/',1)=new.workspace_id::text and old.logo_storage_path ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}/[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}/[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}[.](png|jpg|webp)$'
  then
    insert into mushavo_file_ingest.logo_replacements(object_name,workspace_id,due_at,state)
      values(old.logo_storage_path,new.workspace_id,clock_timestamp()+make_interval(secs=>v_delay),'queued');
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.fr32_logo_replacement_mode()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  select exists(
    select 1 from mushavo_file_ingest.logo_replacements r
    join mushavo_file_ingest.logo_cleanup_settings l on l.workspace_id=r.workspace_id and l.enabled
    where r.due_at<=statement_timestamp()
      and (r.state='queued' or (r.state='claimed' and r.lease_until<statement_timestamp()))
  )
$function$;

update mushavo_email_install.rollout_control set catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
where singleton and catalog_sha256='0b9a32fb826cf3dfb6e0630715ada753e04be36dc668b60a168bd65717f83d86' and mode='ACTIVE' and target_project='dczlddwbtgvfdujgcitb';
notify pgrst,'reload schema';
commit;
