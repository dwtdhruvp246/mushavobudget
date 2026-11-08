begin;set local search_path=pg_catalog;set local lock_timeout='1500ms';set local statement_timeout='20s';
do $cutover$
begin
 perform 1 from mushavo_email_install.rollout_control where singleton for update;
 if not exists(select 1 from mushavo_email_install.rollout_control where singleton and target_project='dczlddwbtgvfdujgcitb'
 and mode='ACTIVE' and catalog_sha256='01c7451bc24b5c575b220beee70fc7e9275dd0bf4ac2946fc26588b9ab3ba73d' and catalog_sha256=mushavo_email_install.catalog_identity()) then raise exception 'EXACT_BROKER_STAGING_CATALOG_REQUIRED';end if;
 if exists(select 1 from storage.objects where bucket_id in('payment-proofs','subscription-proofs','business-documents','business-logos'))
 or (select count(*) from storage.buckets where id in('payment-proofs','subscription-proofs','business-documents','business-logos') and not public)<>4
 then raise exception 'EMPTY_PRIVATE_BUCKET_CUTOVER_REQUIRED';end if;
 if exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='private_files_require_download_broker') then raise exception 'NEW_RESTRICTIVE_POLICY_MUST_BE_ABSENT';end if;
end;$cutover$;
-- Apply only after the new frontend and broker have been verified available
-- and all four private buckets are empty. This intersects, never replaces,
-- existing permissive and restrictive ownership/session/Business policies.
create policy private_files_require_download_broker
on storage.objects as restrictive for select to authenticated
using (
  bucket_id not in ('payment-proofs', 'subscription-proofs', 'business-documents', 'business-logos')
  or current_setting('request.path', true) = '/rpc/private_file_download_context'
  or storage.allow_any_operation(array[
    'object.list', 'object.list_v2', 'object.get_authenticated_info', 'object.head_authenticated_info', 'object.info_authenticated',
    'object.upload', 'object.upload_update', 'object.delete', 'object.delete_many', 'object.copy', 'object.move'
  ])
);
notify pgrst, 'reload schema';

do $rebind$
begin
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='private_files_require_download_broker'
 and permissive='RESTRICTIVE' and cmd='SELECT' and roles=array['authenticated']::name[]) then raise exception 'EXACT_RESTRICTIVE_POLICY_REQUIRED';end if;
 update mushavo_email_install.rollout_control set catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=now()
 where singleton and target_project='dczlddwbtgvfdujgcitb' and mode='ACTIVE' and catalog_sha256='01c7451bc24b5c575b220beee70fc7e9275dd0bf4ac2946fc26588b9ab3ba73d';
 if not found then raise exception 'EXACT_PRIOR_CATALOG_CONTROL_REQUIRED';end if;
end;$rebind$;commit;
