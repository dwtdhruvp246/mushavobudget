-- Staging only. Reserve one controlled Personal payment item's proof namespace.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';
lock table public.payment_items, public.payment_records, storage.objects in share row exclusive mode;

do $$
begin
  if not exists (
    select 1 from public.budget_workspaces
    where id = '017513c6-ce57-48af-b902-9552faeb83dd' and owner_id = 'ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'
      and workspace_type = 'personal' and status = 'active'
  ) or exists (select 1 from public.payment_items where id = '97eaee71-6a2e-4653-8eb5-ca0653f101fa')
    or exists (select 1 from storage.objects where bucket_id = 'payment-proofs' and starts_with(name, 'personal/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr3-proof/97eaee71-6a2e-4653-8eb5-ca0653f101fa/'))
    or exists (select 1 from public.payment_records where starts_with(proof_path, 'personal/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr3-proof/97eaee71-6a2e-4653-8eb5-ca0653f101fa/'))
  then raise exception 'FR3_PROOF_EXPECTED_EMPTY_STAGING_SCOPE'; end if;
end;
$$;

create policy fr3_personal_proof_server_insert on storage.objects as restrictive for insert to authenticated, anon
with check (bucket_id <> 'payment-proofs' or not starts_with(name, 'personal/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr3-proof/97eaee71-6a2e-4653-8eb5-ca0653f101fa/'));

create policy fr3_personal_proof_server_update on storage.objects as restrictive for update to authenticated, anon
using (bucket_id <> 'payment-proofs' or not starts_with(name, 'personal/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr3-proof/97eaee71-6a2e-4653-8eb5-ca0653f101fa/'))
with check (bucket_id <> 'payment-proofs' or not starts_with(name, 'personal/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr3-proof/97eaee71-6a2e-4653-8eb5-ca0653f101fa/'));

-- Existing permissive Storage policies still govern deletion. For this
-- namespace cleanup requires removal of the synthetic item and its records.
create policy fr3_personal_proof_unlinked_delete on storage.objects as restrictive for delete to authenticated, anon
using (bucket_id <> 'payment-proofs' or not starts_with(name, 'personal/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr3-proof/97eaee71-6a2e-4653-8eb5-ca0653f101fa/')
  or ((select auth.uid()) = 'ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and not exists (
    select 1 from public.payment_items i where i.id = '97eaee71-6a2e-4653-8eb5-ca0653f101fa'
  ) and not exists (select 1 from public.payment_records r where r.proof_path = objects.name)));

create function public.fr3_guard_personal_proof_link()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
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
    or substring(new.proof_path from length(prefix) + 1) !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}[.]png$'
    or new.proof_mime_type is distinct from 'image/png'
    or new.proof_size_bytes is null or new.proof_size_bytes not between 1 and 2097152
    or new.proof_name is null or length(new.proof_name) not between 1 and 160
    or right(new.proof_name, 4) <> '.png'
  then raise exception 'FR3_PROOF_VALIDATED_PNG_REQUIRED'; end if;
  select o.metadata into object_metadata from storage.objects o
    where o.bucket_id = 'payment-proofs' and o.name = new.proof_path for share;
  if not found or object_metadata->>'mimetype' is distinct from 'image/png'
    or coalesce(object_metadata->>'size', object_metadata->>'contentLength') is distinct from new.proof_size_bytes::text
  then raise exception 'FR3_PROOF_STORAGE_METADATA_MISMATCH'; end if;
  return new;
end;
$$;
revoke all on function public.fr3_guard_personal_proof_link() from public, anon, authenticated, service_role;
create trigger z_fr3_guard_personal_proof_link before insert or update on public.payment_records
for each row execute function public.fr3_guard_personal_proof_link();

create function public.fr3_personal_proof_gate_ready()
returns boolean language sql stable security invoker set search_path = pg_catalog
as $$
  select (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass)
    and exists (
      select 1 from public.payment_items i join public.budget_workspaces w on w.id = i.workspace_id
      where i.id = '97eaee71-6a2e-4653-8eb5-ca0653f101fa' and i.owner_id = 'ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'
        and i.visibility = 'personal' and i.family_id is null and i.status = 'active'
        and w.id = '017513c6-ce57-48af-b902-9552faeb83dd' and w.owner_id = i.owner_id and w.status = 'active' and w.workspace_type = 'personal'
    ) and exists (
      select 1 from pg_trigger where tgrelid = 'public.payment_records'::regclass
        and tgname = 'z_fr3_guard_personal_proof_link' and tgenabled = 'O' and tgtype = 23
        and tgfoid = 'public.fr3_guard_personal_proof_link()'::regprocedure
    ) and (
      select count(*) = 2 from pg_policy p
      cross join (values (
        '((bucket_id <> ''payment-proofs''::text) OR (NOT starts_with(name, ''personal/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr3-proof/97eaee71-6a2e-4653-8eb5-ca0653f101fa/''::text)))'
      )) expected(expr)
      where polrelid = 'storage.objects'::regclass and not polpermissive
        and polroles @> array[to_regrole('anon')::oid, to_regrole('authenticated')::oid]
        and pg_get_expr(polwithcheck, polrelid) = expected.expr
        and ((polname = 'fr3_personal_proof_server_insert' and polcmd = 'a' and polqual is null)
          or (polname = 'fr3_personal_proof_server_update' and polcmd = 'w' and pg_get_expr(polqual, polrelid) = expected.expr))
    );
$$;
revoke all on function public.fr3_personal_proof_gate_ready() from public, anon, authenticated;
grant execute on function public.fr3_personal_proof_gate_ready() to service_role;
notify pgrst, 'reload schema';
commit;
