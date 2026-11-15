-- Staging only. Apply a shared budget after the current session and file context are authorized.
begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
set local statement_timeout='20s';
select pg_advisory_xact_lock(20261017,2411);

do $preflight$
begin
  if not exists(select 1 from mushavo_email_install.rollout_control where singleton and mode='ACTIVE'
      and target_project='dczlddwbtgvfdujgcitb' and catalog_sha256='0dfaee08c574ea6eab6750c2c5f87edb6007996477b67f5771ff7720e79f2ddc' and catalog_sha256=mushavo_email_install.catalog_identity())
    or (select count(*) from storage.buckets where id in ('payment-proofs','subscription-proofs','business-documents','business-logos') and not public)<>4
  then raise exception 'EXACT_PRIVATE_DOWNLOAD_STAGING_BASELINE_REQUIRED'; end if;
end;
$preflight$;

create table mushavo_file_ingest.private_download_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started timestamptz not null,
  requests integer not null check (requests between 1 and 60),
  byte_count integer not null check (byte_count between 1 and 67108864)
);
alter table mushavo_file_ingest.private_download_usage enable row level security;
alter table mushavo_file_ingest.private_download_usage force row level security;
revoke all on mushavo_file_ingest.private_download_usage from public,anon,authenticated,service_role;

create function public.reserve_private_file_download(p_user uuid,p_bucket text,p_path text,p_size integer)
returns boolean language plpgsql security definer set search_path=pg_catalog as $body$
declare
  request_window timestamptz := date_trunc('minute',clock_timestamp());
  request_limit constant integer := 60;
  byte_limit constant integer := 67108864;
  bucket_limit integer;
begin
  bucket_limit := case p_bucket
    when 'business-logos' then 2097152
    when 'business-documents' then 10485760
    when 'payment-proofs' then 10485760
    when 'subscription-proofs' then 10485760
    else 0 end;
  if p_user is null or p_path is null or p_size is null or p_size not between 1 and bucket_limit
    or not exists (select 1 from storage.objects o where o.bucket_id=p_bucket and o.name=p_path
      and o.metadata->>'size'=p_size::text)
  then return false; end if;

  insert into mushavo_file_ingest.private_download_usage as u(user_id,window_started,requests,byte_count)
    values(p_user,request_window,1,p_size)
  on conflict(user_id) do update set
    window_started=request_window,
    requests=case when u.window_started<request_window then 1 else u.requests+1 end,
    byte_count=case when u.window_started<request_window then p_size else u.byte_count+p_size end
  where u.window_started<request_window or (u.window_started=request_window
    and u.requests<request_limit and u.byte_count<=byte_limit-p_size);
  return found;
end;
$body$;
revoke all on function public.reserve_private_file_download(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.reserve_private_file_download(uuid,text,text,integer) to service_role;

update mushavo_email_install.rollout_control set catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
where singleton and catalog_sha256='0dfaee08c574ea6eab6750c2c5f87edb6007996477b67f5771ff7720e79f2ddc' and mode='ACTIVE' and target_project='dczlddwbtgvfdujgcitb';
notify pgrst,'reload schema';
commit;
