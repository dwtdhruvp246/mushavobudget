-- Apply only after the exact managed browser build is verified on staging.
begin;
set local search_path=pg_catalog;
set local lock_timeout='5s';
set local statement_timeout='20s';
select pg_advisory_xact_lock(20261017,2411);
do $guard$
begin
  if not exists(select 1 from mushavo_email_install.rollout_control where singleton and target_project='dczlddwbtgvfdujgcitb'
     and mode='ACTIVE' and catalog_sha256='af118fe1c094334487bb742c1c13e7dce6e87c95d3e89b348a573d5f9d3e6c29' and catalog_sha256=mushavo_email_install.catalog_identity())
     or (select count(*) from storage.buckets where id in ('payment-proofs','subscription-proofs','business-documents','business-logos') and not public)<>4
     or not exists(select 1 from pg_class where oid='storage.objects'::regclass and relrowsecurity)
  then raise exception 'ORDINARY_UPLOAD_CUTOVER_STAGING_BASELINE_REQUIRED'; end if;
end;
$guard$;

-- Maintain existing object read and legacy delete policies. New writes to these
-- four staging buckets enter through the authenticated server validators.
create policy fr32_staging_private_server_insert on storage.objects as restrictive for insert to anon,authenticated
with check (bucket_id not in ('payment-proofs','subscription-proofs','business-documents','business-logos'));
create policy fr32_staging_private_server_update on storage.objects as restrictive for update to anon,authenticated
using (bucket_id not in ('payment-proofs','subscription-proofs','business-documents','business-logos'))
with check (bucket_id not in ('payment-proofs','subscription-proofs','business-documents','business-logos'));

CREATE OR REPLACE FUNCTION public.fr32_finish_logo_replacement(p_object text, p_token uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
begin
  update mushavo_file_ingest.logo_replacements r
    set state='removed', token=null, lease_until=null
    where r.object_name=p_object and r.state='claimed' and r.token=p_token
      and not exists(select 1 from public.business_profiles p where p.logo_storage_path=r.object_name)
      and not exists(select 1 from storage.objects o where o.bucket_id='business-logos' and o.name=r.object_name);
  if not found then return false; end if;
  update mushavo_file_ingest.ordinary_uploads set state='removed'
    where bucket_id='business-logos' and path=p_object and state='linked';
  return true;
end;
$function$;
-- Reconcile the retired managed logo whose physical removal already settled.
update mushavo_file_ingest.ordinary_uploads u set state='removed'
where u.bucket_id='business-logos' and u.state='linked'
  and u.attachment_id='f3320000-9e41-45bc-bfe3-bf7c9f6e7260'
  and exists(select 1 from mushavo_file_ingest.logo_replacements r where r.object_name=u.path and r.state='removed')
  and not exists(select 1 from public.business_profiles p where p.logo_storage_path=u.path)
  and not exists(select 1 from storage.objects o where o.bucket_id=u.bucket_id and o.name=u.path);
update mushavo_file_ingest.logo_cleanup_settings set enabled=false
where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and enabled
  and exists(select 1 from mushavo_file_ingest.logo_replacements r where r.workspace_id=logo_cleanup_settings.workspace_id
    and split_part(r.object_name,'/',3)='f3320000-9e41-45bc-bfe3-bf7c9f6e7260.png' and r.state='removed');

update mushavo_email_install.rollout_control set catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
where singleton and catalog_sha256='af118fe1c094334487bb742c1c13e7dce6e87c95d3e89b348a573d5f9d3e6c29' and mode='ACTIVE' and target_project='dczlddwbtgvfdujgcitb';
notify pgrst,'reload schema';
commit;
