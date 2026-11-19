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
