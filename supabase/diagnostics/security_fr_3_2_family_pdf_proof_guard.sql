-- Staging only. Allow validated PDF metadata for the existing Family proof fixture.
begin;
set local search_path = pg_catalog;
set local lock_timeout = '3s';
set local statement_timeout = '20s';
lock table public.families, public.payment_items, public.payment_records, storage.objects in share row exclusive mode;
do $preflight$
begin
  perform pg_advisory_xact_lock(20261017, 2411);
  perform 1 from mushavo_email_install.rollout_control where singleton for update;
  if not exists (
    select 1 from mushavo_email_install.rollout_control where singleton
      and target_project = 'dczlddwbtgvfdujgcitb' and mode = 'ACTIVE'
      and catalog_sha256 = '99243c5a8cd04c9f7fc666be599abfedb9f5c02079c03e298a044e1f0fb96323' and catalog_sha256 = mushavo_email_install.catalog_identity()
  ) or (select md5(prosrc) from pg_proc where oid = 'public.fr3_guard_family_proof_link()'::regprocedure)
    is distinct from 'ebb45f8aec507ae24ac2505b648fbec8'
    or exists (select 1 from public.families where id = '08e8f0ca-9cc4-4ea5-8544-b14a9b1cf37c')
    or exists (select 1 from public.payment_items where id = '0986f8bc-7905-4ec8-b023-a00f10a18d88')
    or exists (select 1 from public.payment_records where payment_item_id = '0986f8bc-7905-4ec8-b023-a00f10a18d88')
    or exists (select 1 from storage.objects where bucket_id = 'payment-proofs'
      and starts_with(name, 'families/08e8f0ca-9cc4-4ea5-8544-b14a9b1cf37c/'))
  then raise exception 'FR3_FAMILY_PDF_EMPTY_STAGING_SCOPE_REQUIRED'; end if;
end;
$preflight$;

create or replace function public.fr3_guard_family_proof_link()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $guard$
declare
  actor uuid := auth.uid();
  expected_prefix text;
  object_metadata jsonb;
begin
  if new.payment_item_id is distinct from '0986f8bc-7905-4ec8-b023-a00f10a18d88'::uuid then
    if starts_with(new.proof_path, 'families/08e8f0ca-9cc4-4ea5-8544-b14a9b1cf37c/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr3-proof/0986f8bc-7905-4ec8-b023-a00f10a18d88/') or starts_with(new.proof_path, 'families/08e8f0ca-9cc4-4ea5-8544-b14a9b1cf37c/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/660a1463-6589-4c4d-ab6c-8ee50161038f/fr3-proof/0986f8bc-7905-4ec8-b023-a00f10a18d88/') then raise exception 'FR3_FAMILY_WRONG_PAYMENT_ITEM'; end if;
    return new;
  end if;
  -- Leave ordinary metadata-only updates to the underlying finance and RLS rules.
  if tg_op = 'UPDATE' and (new.payment_item_id,new.workspace_id,new.family_id,new.visibility,new.owner_id,
    new.recorded_by,new.proof_path,new.proof_name,new.proof_mime_type,new.proof_size_bytes) is not distinct from
    (old.payment_item_id,old.workspace_id,old.family_id,old.visibility,old.owner_id,
    old.recorded_by,old.proof_path,old.proof_name,old.proof_mime_type,old.proof_size_bytes) then return new; end if;

  if actor is null or actor not in ('ca7bdcf2-e69d-42e2-8ae8-79cac6de2184','660a1463-6589-4c4d-ab6c-8ee50161038f')
    or new.owner_id is distinct from actor or new.recorded_by is distinct from actor
    or new.family_id is distinct from '08e8f0ca-9cc4-4ea5-8544-b14a9b1cf37c'::uuid or new.visibility is distinct from 'family'
    or not public.is_active_family_participant('08e8f0ca-9cc4-4ea5-8544-b14a9b1cf37c')
    or not exists (
      select 1 from public.payment_items i join public.budget_workspaces w on w.id = i.workspace_id
      where i.id = '0986f8bc-7905-4ec8-b023-a00f10a18d88' and i.workspace_id = new.workspace_id and i.family_id = new.family_id
        and i.owner_id = 'ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and i.visibility = 'family' and i.status = 'active'
        and w.legacy_family_id = new.family_id and w.owner_id = i.owner_id
        and w.workspace_type = 'household' and w.status = 'active'
    )
  then raise exception 'FR3_FAMILY_WRONG_PROOF_SCOPE'; end if;

  if new.proof_path is null then
    if new.proof_name is not null or new.proof_mime_type is not null or new.proof_size_bytes is not null
      then raise exception 'FR3_FAMILY_METADATA_WITHOUT_FILE'; end if;
    return new;
  end if;
  expected_prefix := 'families/08e8f0ca-9cc4-4ea5-8544-b14a9b1cf37c/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/' || actor::text || '/fr3-proof/0986f8bc-7905-4ec8-b023-a00f10a18d88/';
  if not starts_with(new.proof_path, expected_prefix)
    or substring(new.proof_path from length(expected_prefix) + 1) !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}[.](png|pdf)$'
    or new.proof_mime_type is distinct from (case when right(new.proof_path, 4) = '.pdf' then 'application/pdf' else 'image/png' end)
    or new.proof_size_bytes is null or new.proof_size_bytes not between 1 and 2097152
    or new.proof_name is null or length(new.proof_name) not between 1 and 160
    or right(new.proof_name, 4) is distinct from right(new.proof_path, 4)
  then raise exception 'FR3_FAMILY_VALIDATED_FORMAT_REQUIRED'; end if;

  select o.metadata into object_metadata from storage.objects o
  where o.bucket_id = 'payment-proofs' and o.name = new.proof_path for share;
  if not found or object_metadata->>'mimetype' is distinct from new.proof_mime_type
    or coalesce(object_metadata->>'size', object_metadata->>'contentLength') is distinct from new.proof_size_bytes::text
  then raise exception 'FR3_FAMILY_STORAGE_METADATA_MISMATCH'; end if;
  return new;
end;
$guard$;

do $stamp$
begin
  update mushavo_email_install.rollout_control
  set catalog_sha256 = mushavo_email_install.catalog_identity(), changed_at = clock_timestamp()
  where singleton and target_project = 'dczlddwbtgvfdujgcitb' and mode = 'ACTIVE'
    and catalog_sha256 = '99243c5a8cd04c9f7fc666be599abfedb9f5c02079c03e298a044e1f0fb96323';
  if not found then raise exception 'FR3_FAMILY_PDF_CATALOG_CHANGED'; end if;
end;
$stamp$;
notify pgrst, 'reload schema';
commit;
