-- Staging only. Reserve the validator's namespace on the existing synthetic Personal workspace.
begin;
set local search_path = pg_catalog;
set local lock_timeout = '3s';
set local statement_timeout = '20s';
select pg_advisory_xact_lock(20261017, 2411);
lock table public.plans, public.subscription_payment_proofs, storage.objects in share row exclusive mode;

do $preflight$
begin
  if not exists (
    select 1 from mushavo_email_install.rollout_control
    where singleton and target_project = 'dczlddwbtgvfdujgcitb' and mode = 'ACTIVE'
      and catalog_sha256 = 'c0c3fff907241a6bbcde1ab2be13d3879869338a869a37a08e6012f70c2ab8fd' and catalog_sha256 = mushavo_email_install.catalog_identity()
  ) or exists (select 1 from public.plans where id = '21a10bd8-46c8-4b2c-9f04-783164611fa1' or code = 'audit_fr3_subscription_proof')
    or exists (select 1 from public.subscription_payment_proofs where starts_with(storage_path, 'workspaces/017513c6-ce57-48af-b902-9552faeb83dd/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr3-subscription-proof/'))
    or exists (select 1 from storage.objects where bucket_id = 'subscription-proofs' and starts_with(name, 'workspaces/017513c6-ce57-48af-b902-9552faeb83dd/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr3-subscription-proof/'))
  then raise exception 'FR3_SUBSCRIPTION_EMPTY_STAGING_SCOPE_REQUIRED'; end if;
end;
$preflight$;

create policy fr3_subscription_server_insert on storage.objects as restrictive for insert to authenticated, anon
with check (bucket_id <> 'subscription-proofs' or not starts_with(name, 'workspaces/017513c6-ce57-48af-b902-9552faeb83dd/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr3-subscription-proof/'));
create policy fr3_subscription_server_update on storage.objects as restrictive for update to authenticated, anon
using (bucket_id <> 'subscription-proofs' or not starts_with(name, 'workspaces/017513c6-ce57-48af-b902-9552faeb83dd/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr3-subscription-proof/')) with check (bucket_id <> 'subscription-proofs' or not starts_with(name, 'workspaces/017513c6-ce57-48af-b902-9552faeb83dd/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr3-subscription-proof/'));

create function public.fr3_guard_subscription_proof()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $guard$
declare
  fixture constant text := 'workspaces/017513c6-ce57-48af-b902-9552faeb83dd/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr3-subscription-proof/';
  parent public.subscription_payments%rowtype;
  request_plan uuid;
  file_metadata jsonb;
begin
  if tg_op = 'UPDATE' and starts_with(old.storage_path, fixture)
    and (new.payment_id,new.storage_path,new.mime_type,new.size_bytes,new.uploaded_by) is distinct from
        (old.payment_id,old.storage_path,old.mime_type,old.size_bytes,old.uploaded_by)
  then raise exception 'FR3_SUBSCRIPTION_PROOF_IMMUTABLE'; end if;
  if not starts_with(new.storage_path, fixture) and new.uploaded_by is distinct from 'ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'::uuid then return new; end if;
  select * into parent from public.subscription_payments where id = new.payment_id;
  if parent.workspace_id = '017513c6-ce57-48af-b902-9552faeb83dd' then
    select requested_plan_id into request_plan from public.subscription_renewal_requests where id = parent.renewal_request_id;
  end if;
  if not starts_with(new.storage_path, fixture) and request_plan is distinct from '21a10bd8-46c8-4b2c-9f04-783164611fa1'::uuid then return new; end if;
  if parent.workspace_id is distinct from '017513c6-ce57-48af-b902-9552faeb83dd'::uuid
    or request_plan is distinct from '21a10bd8-46c8-4b2c-9f04-783164611fa1'::uuid
    or parent.submitted_by is distinct from 'ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'::uuid or new.uploaded_by is distinct from parent.submitted_by
    or auth.uid() is distinct from parent.submitted_by
    or not starts_with(new.storage_path, fixture)
    or substring(new.storage_path from length(fixture) + 1) !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}[.](png|pdf)$'
    or new.mime_type is distinct from (case when right(new.storage_path, 4) = '.pdf' then 'application/pdf' else 'image/png' end)
    or new.size_bytes is null or new.size_bytes not between 1 and 2097152
  then raise exception 'FR3_SUBSCRIPTION_PROOF_SCOPE_REQUIRED'; end if;
  select o.metadata into file_metadata from storage.objects o
    where o.bucket_id = 'subscription-proofs' and o.name = new.storage_path for share;
  if not found or file_metadata->>'mimetype' is distinct from new.mime_type
    or coalesce(file_metadata->>'size',file_metadata->>'contentLength') is distinct from new.size_bytes::text
  then raise exception 'FR3_SUBSCRIPTION_STORAGE_METADATA_MISMATCH'; end if;
  return new;
end;
$guard$;
revoke all on function public.fr3_guard_subscription_proof() from public, anon, authenticated, service_role;
create trigger z_fr3_guard_subscription_proof before insert or update on public.subscription_payment_proofs
for each row execute function public.fr3_guard_subscription_proof();

create function public.fr3_subscription_proof_gate_ready()
returns boolean language sql stable security invoker set search_path = pg_catalog
as $ready$
  select (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass)
    and exists (select 1 from public.plans where id = '21a10bd8-46c8-4b2c-9f04-783164611fa1'
      and code = 'audit_fr3_subscription_proof' and not is_active and not is_public and not available_for_purchase)
    and exists (select 1 from public.budget_workspaces where id = '017513c6-ce57-48af-b902-9552faeb83dd' and owner_id = 'ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'
      and workspace_type = 'personal' and status = 'active')
    and exists (select 1 from pg_trigger where tgrelid = 'public.subscription_payment_proofs'::regclass
      and tgname = 'z_fr3_guard_subscription_proof' and tgenabled = 'O' and tgtype = 23
      and tgfoid = 'public.fr3_guard_subscription_proof()'::regprocedure)
    and (
      select count(*) = 2 from pg_policy p
      cross join (values (
        '((bucket_id <> ''subscription-proofs''::text) OR (NOT starts_with(name, ''workspaces/017513c6-ce57-48af-b902-9552faeb83dd/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr3-subscription-proof/''::text)))'
      )) expected(expr)
      where polrelid = 'storage.objects'::regclass and not polpermissive
        and polroles @> array[to_regrole('anon')::oid, to_regrole('authenticated')::oid]
        and pg_get_expr(polwithcheck, polrelid) = expected.expr
        and ((polname = 'fr3_subscription_server_insert' and polcmd = 'a' and polqual is null)
          or (polname = 'fr3_subscription_server_update' and polcmd = 'w' and pg_get_expr(polqual, polrelid) = expected.expr))
    );
$ready$;
revoke all on function public.fr3_subscription_proof_gate_ready() from public, anon, authenticated;
grant execute on function public.fr3_subscription_proof_gate_ready() to service_role;

do $stamp$
begin
  update mushavo_email_install.rollout_control set
    catalog_sha256 = mushavo_email_install.catalog_identity(), changed_at = clock_timestamp()
  where singleton and target_project = 'dczlddwbtgvfdujgcitb' and mode = 'ACTIVE' and catalog_sha256 = 'c0c3fff907241a6bbcde1ab2be13d3879869338a869a37a08e6012f70c2ab8fd';
  if not found then raise exception 'FR3_SUBSCRIPTION_CATALOG_CHANGED'; end if;
end;
$stamp$;
notify pgrst, 'reload schema';
commit;
