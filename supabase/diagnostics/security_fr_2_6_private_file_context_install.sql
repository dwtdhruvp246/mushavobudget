begin;
set local search_path=pg_catalog;
set local lock_timeout='1500ms';
set local statement_timeout='20s';
do $precondition$
begin
 perform 1 from mushavo_email_install.rollout_control where singleton for update;
 if not exists(select 1 from mushavo_email_install.rollout_control where singleton
  and target_project='dczlddwbtgvfdujgcitb' and mode='ACTIVE' and catalog_sha256='4646c0fe0367fe033b4594428f9c180eb96ca9b39ed2d1a2024bdc843804c3d7'
  and catalog_sha256=mushavo_email_install.catalog_identity()) then raise exception 'EXACT_STAGING_CATALOG_REQUIRED'; end if;
 if to_regprocedure('public.private_file_download_context(text,text)') is not null then raise exception 'NEW_RPC_MUST_BE_ABSENT'; end if;
 if (select count(*) from storage.buckets where id in ('payment-proofs','subscription-proofs','business-documents','business-logos') and not public)<>4
  or exists(select 1 from storage.objects where bucket_id in ('payment-proofs','subscription-proofs','business-documents','business-logos'))
  then raise exception 'EXACT_EMPTY_PRIVATE_BUCKETS_REQUIRED'; end if;
end;
$precondition$;
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

do $reviewed_rebind$
begin
 if (select prosecdef from pg_proc where oid='public.private_file_download_context(text,text)'::regprocedure)
  or has_function_privilege('anon','public.private_file_download_context(text,text)','execute')
  or has_function_privilege('service_role','public.private_file_download_context(text,text)','execute')
  or not has_function_privilege('authenticated','public.private_file_download_context(text,text)','execute')
  then raise exception 'EXACT_INVOKER_RPC_REQUIRED'; end if;
 update mushavo_email_install.rollout_control set catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=now()
  where singleton and target_project='dczlddwbtgvfdujgcitb' and mode='ACTIVE' and catalog_sha256='4646c0fe0367fe033b4594428f9c180eb96ca9b39ed2d1a2024bdc843804c3d7';
 if not found then raise exception 'EXACT_PREVIOUS_CONTROL_REQUIRED'; end if;
end;
$reviewed_rebind$;
commit;
