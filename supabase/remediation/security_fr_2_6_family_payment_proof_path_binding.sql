begin;

-- Correlate the Family lookup to the Storage object's path. An unqualified
-- name inside this subquery resolves to families.name, not objects.name.
alter policy "Users can upload permitted payment proofs"
on storage.objects
with check (
  bucket_id = 'payment-proofs'
  and (
    ((storage.foldername(objects.name))[1] = 'personal'
      and (storage.foldername(objects.name))[2] = (select auth.uid())::text)
    or
    ((storage.foldername(objects.name))[1] = 'families'
      and (storage.foldername(objects.name))[4] = (select auth.uid())::text
      and exists (
        select 1 from public.families as proof_family
        where proof_family.id = ((storage.foldername(objects.name))[2])::uuid
          and proof_family.owner_id::text = (storage.foldername(objects.name))[3]
          and public.is_active_family_participant(proof_family.id)
      ))
  )
);

notify pgrst, 'reload schema';
commit;
