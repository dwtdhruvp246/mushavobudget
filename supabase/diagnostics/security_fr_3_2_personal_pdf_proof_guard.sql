-- Staging only. Accept normalized PDF proof for the existing synthetic Personal item.
begin;
set local search_path = pg_catalog;
set local lock_timeout = '3s';
set local statement_timeout = '20s';
lock table public.payment_items, public.payment_records, storage.objects in share row exclusive mode;
do $preflight$
begin
  perform pg_advisory_xact_lock(20261017, 2411);
  perform 1 from mushavo_email_install.rollout_control where singleton for update;
  if not exists (
    select 1 from mushavo_email_install.rollout_control where singleton
      and target_project = 'dczlddwbtgvfdujgcitb' and mode = 'ACTIVE'
      and catalog_sha256 = '883073da9ab6b3d9bb93527cec684d550ab36da3cb5471629401b5baf889968c' and catalog_sha256 = mushavo_email_install.catalog_identity()
  ) or (select md5(prosrc) from pg_proc where oid = 'public.fr3_guard_personal_proof_link()'::regprocedure)
    is distinct from '09744ed2150b428181c3c54cd33befde'
    or exists (select 1 from public.payment_items where id = '97eaee71-6a2e-4653-8eb5-ca0653f101fa')
    or exists (select 1 from public.payment_records where payment_item_id = '97eaee71-6a2e-4653-8eb5-ca0653f101fa')
    or exists (select 1 from storage.objects where bucket_id = 'payment-proofs' and starts_with(name, 'personal/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr3-proof/97eaee71-6a2e-4653-8eb5-ca0653f101fa/'))
  then raise exception 'FR3_PDF_EMPTY_STAGING_SCOPE_REQUIRED'; end if;
end;
$preflight$;

create or replace function public.fr3_guard_personal_proof_link()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $guard$
declare
  fixture constant uuid := '97eaee71-6a2e-4653-8eb5-ca0653f101fa';
  owner_id constant uuid := 'ca7bdcf2-e69d-42e2-8ae8-79cac6de2184';
  workspace_id constant uuid := '017513c6-ce57-48af-b902-9552faeb83dd';
  prefix constant text := 'personal/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr3-proof/97eaee71-6a2e-4653-8eb5-ca0653f101fa/';
  object_metadata jsonb;
begin
  if new.payment_item_id <> fixture then
    if starts_with(new.proof_path, prefix) then raise exception 'FR3_PROOF_WRONG_PAYMENT_ITEM'; end if;
    return new;
  end if;
  if auth.uid() is distinct from owner_id or new.owner_id is distinct from owner_id
    or new.recorded_by is distinct from owner_id or new.workspace_id is distinct from workspace_id
    or new.visibility is distinct from 'personal' or new.family_id is not null
  then raise exception 'FR3_PROOF_WRONG_PERSONAL_SCOPE'; end if;

  if new.proof_path is null then
    if new.proof_name is not null or new.proof_mime_type is not null or new.proof_size_bytes is not null
      then raise exception 'FR3_PROOF_METADATA_WITHOUT_FILE'; end if;
    return new;
  end if;
  if not starts_with(new.proof_path, prefix)
    or substring(new.proof_path from length(prefix) + 1) !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}[.](png|pdf)$'
    or new.proof_mime_type is distinct from (case when right(new.proof_path, 4) = '.pdf' then 'application/pdf' else 'image/png' end)
    or new.proof_size_bytes is null or new.proof_size_bytes not between 1 and 2097152
    or new.proof_name is null or length(new.proof_name) not between 1 and 160
    or right(new.proof_name, 4) is distinct from right(new.proof_path, 4)
  then raise exception 'FR3_PROOF_VALIDATED_FORMAT_REQUIRED'; end if;
  select o.metadata into object_metadata from storage.objects o
    where o.bucket_id = 'payment-proofs' and o.name = new.proof_path for share;
  if not found or object_metadata->>'mimetype' is distinct from new.proof_mime_type
    or coalesce(object_metadata->>'size', object_metadata->>'contentLength') is distinct from new.proof_size_bytes::text
  then raise exception 'FR3_PROOF_STORAGE_METADATA_MISMATCH'; end if;
  return new;
end;
$guard$;

do $stamp$
begin
  update mushavo_email_install.rollout_control
  set catalog_sha256 = mushavo_email_install.catalog_identity(), changed_at = clock_timestamp()
  where singleton and target_project = 'dczlddwbtgvfdujgcitb' and mode = 'ACTIVE'
    and catalog_sha256 = '883073da9ab6b3d9bb93527cec684d550ab36da3cb5471629401b5baf889968c';
  if not found then raise exception 'FR3_PDF_CATALOG_CHANGED'; end if;
end;
$stamp$;
notify pgrst, 'reload schema';
commit;
