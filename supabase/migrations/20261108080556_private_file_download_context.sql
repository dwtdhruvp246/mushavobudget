-- This function deliberately runs as the authenticated caller. Existing
-- ownership, Family membership, Business parent scope and staff policies apply.
create function public.private_file_download_context(p_bucket_id text, p_object_name text)
returns table (
  object_id uuid, bucket_id text, object_name text, object_version text,
  size_bytes bigint, mime_type text
)
language sql stable security invoker
set search_path = pg_catalog
as $function$
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

revoke all on function public.private_file_download_context(text, text) from public, anon, service_role;
grant execute on function public.private_file_download_context(text, text) to authenticated;
notify pgrst, 'reload schema';
