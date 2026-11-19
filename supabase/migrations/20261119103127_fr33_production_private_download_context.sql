-- Install the authorization and download-budget RPCs while keeping all current
-- Storage RLS policies and clients in place. The private-file Edge switch is separate.
CREATE SCHEMA mushavo_file_ingest;
REVOKE ALL ON SCHEMA mushavo_file_ingest FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE mushavo_file_ingest.private_download_usage (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started timestamptz NOT NULL,
  requests integer NOT NULL CHECK (requests BETWEEN 1 AND 60),
  byte_count bigint NOT NULL CHECK (byte_count BETWEEN 1 AND 67108864)
);
ALTER TABLE mushavo_file_ingest.private_download_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE mushavo_file_ingest.private_download_usage FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.private_file_download_context(p_bucket_id text, p_object_name text)
 RETURNS TABLE(object_id uuid, bucket_id text, object_name text, object_version text, size_bytes bigint, mime_type text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select o.id, o.bucket_id, o.name,
    coalesce(o.version, '') || ':' || o.updated_at::text || ':' || coalesce(o.metadata->>'eTag', ''),
    (o.metadata->>'size')::bigint, o.metadata->>'mimetype'
  from storage.objects o
  where o.bucket_id = p_bucket_id and o.name = p_object_name
    and p_bucket_id in ('payment-proofs', 'subscription-proofs', 'business-documents', 'business-logos')
    and (select public.app_session_status()->>'session_valid') = 'true'
    and case when o.metadata->>'size' ~ '^[0-9]{1,8}$'
      then (o.metadata->>'size')::bigint between 1 and
        case when p_bucket_id = 'business-logos' then 2097152 else 10485760 end
      else false end
    and o.metadata->>'mimetype' = any(case when p_bucket_id = 'business-logos'
      then array['image/png', 'image/jpeg', 'image/webp']
      when p_bucket_id = 'business-documents' then array['image/png', 'image/jpeg', 'image/webp', 'application/pdf',
        'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
      else array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] end);
$function$;

CREATE FUNCTION public.reserve_private_file_download(p_user uuid, p_bucket text, p_path text, p_size integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
$function$;

REVOKE ALL ON FUNCTION public.private_file_download_context(text,text),
  public.reserve_private_file_download(uuid,text,text,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.private_file_download_context(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_private_file_download(uuid,text,text,integer) TO service_role;
NOTIFY pgrst, 'reload schema';
