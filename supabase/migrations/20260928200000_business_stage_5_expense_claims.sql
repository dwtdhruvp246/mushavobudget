begin;

-- Stage 5: one complete expense and reimbursement workflow.
create table public.business_expense_claims (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.budget_workspaces(id) on delete restrict,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  kind text not null check (kind in ('company_expense', 'reimbursement')),
  title text not null check (char_length(btrim(title)) between 2 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  category_id uuid not null,
  dimension_id uuid,
  amount numeric(18,4) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  reporting_currency text not null check (reporting_currency ~ '^[A-Z]{3}$'),
  reporting_amount numeric(18,4) not null check (reporting_amount > 0),
  exchange_rate numeric(30,12) not null check (exchange_rate > 0),
  rate_effective_at timestamptz not null,
  rate_provider text not null check (rate_provider in ('identity', 'currencyapi')),
  expense_date date not null,
  status text not null default 'draft' check (status in
    ('draft', 'submitted', 'changes_requested', 'approved', 'rejected', 'paid')),
  version integer not null default 1 check (version > 0),
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_reason text check (review_reason is null or char_length(review_reason) <= 1000),
  paid_by uuid references auth.users(id) on delete set null,
  paid_at timestamptz,
  payment_reference text check (payment_reference is null or char_length(payment_reference) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  constraint business_claim_category_fk foreign key (workspace_id, category_id)
    references public.business_categories(workspace_id, id) on delete restrict,
  constraint business_claim_dimension_fk foreign key (workspace_id, dimension_id)
    references public.business_dimensions(workspace_id, id) on delete restrict
);
create index business_claims_workspace_date_idx on public.business_expense_claims(workspace_id, expense_date desc);
create index business_claims_submitter_idx on public.business_expense_claims(workspace_id, submitted_by, created_at desc);
create index business_claims_queue_idx on public.business_expense_claims(workspace_id, status, submitted_at);

create function public.lock_business_claim_reporting_currency()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.reporting_currency is distinct from old.reporting_currency
    and exists (select 1 from public.business_expense_claims where workspace_id = old.workspace_id)
    then raise exception 'BUSINESS_REPORTING_CURRENCY_LOCKED'; end if;
  return new;
end;
$$;
create trigger lock_business_claim_reporting_currency_trigger
before update of reporting_currency on public.workspace_settings
for each row execute function public.lock_business_claim_reporting_currency();

alter table public.business_documents drop constraint if exists business_documents_parent_type_check;
alter table public.business_documents add constraint business_documents_parent_type_check
  check (parent_type in ('workspace', 'profile', 'dimension', 'category', 'expense_claim'));

create or replace function public.validate_business_document_parent()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.parent_type in ('workspace', 'profile') then
    if new.parent_id <> new.workspace_id then raise exception 'BUSINESS_DOCUMENT_PARENT_MISMATCH'; end if;
  elsif new.parent_type = 'dimension' then
    if not exists (select 1 from public.business_dimensions where id = new.parent_id and workspace_id = new.workspace_id)
      then raise exception 'BUSINESS_DOCUMENT_PARENT_MISMATCH'; end if;
  elsif new.parent_type = 'category' then
    if not exists (select 1 from public.business_categories where id = new.parent_id and workspace_id = new.workspace_id)
      then raise exception 'BUSINESS_DOCUMENT_PARENT_MISMATCH'; end if;
  elsif new.parent_type = 'expense_claim' then
    if not exists (select 1 from public.business_expense_claims where id = new.parent_id and workspace_id = new.workspace_id)
      then raise exception 'BUSINESS_DOCUMENT_PARENT_MISMATCH'; end if;
  end if;
  return new;
end;
$$;

-- All financial actions use this gate, including direct storage reads.
create function public.business_claims_active(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_business_workspace_member(p_workspace_id)
    and exists (select 1 from public.workspace_subscriptions
      where workspace_id = p_workspace_id and status = 'active' and paid_through_at > now());
$$;

create function public.business_claim_in_scope(p_workspace_id uuid, p_dimension_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = auth.uid() and m.status = 'active'
      and (
        m.role = 'business_owner'
        or not exists (select 1 from public.business_member_scopes s
          where s.workspace_id = p_workspace_id and s.member_id = m.id)
        or exists (select 1 from public.business_member_scopes s
          where s.workspace_id = p_workspace_id and s.member_id = m.id
            and s.dimension_id = p_dimension_id)
      )
  );
$$;

create function public.business_can_view_claim(p_workspace_id uuid, p_claim_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.business_claims_active(p_workspace_id) and exists (
    select 1 from public.business_expense_claims c
    where c.workspace_id = p_workspace_id and c.id = p_claim_id
      and (c.submitted_by = auth.uid()
        or (public.business_claim_in_scope(p_workspace_id, c.dimension_id)
          and (public.business_has_permission(p_workspace_id, 'finance.view_all')
            or public.business_has_permission(p_workspace_id, 'approvals.review'))))
  );
$$;

-- Direct writes remain forbidden; each transition is an atomic RPC.
alter table public.business_expense_claims enable row level security;
alter table public.business_expense_claims force row level security;
create policy "Business claims visible to submitter or scoped reviewers"
on public.business_expense_claims for select to authenticated
using (public.business_can_view_claim(workspace_id, id));
create policy "Active account required for claims" on public.business_expense_claims as restrictive
for all to authenticated using (not public.my_account_suspended())
with check (not public.my_account_suspended());
create trigger guard_suspended_account_write_trigger
before insert or update or delete on public.business_expense_claims
for each row execute function public.guard_suspended_account_write();
revoke all on public.business_expense_claims from public, anon, authenticated;
grant select on public.business_expense_claims to authenticated;

-- Existing document rules were workspace-wide. Receipts now inherit claim visibility.
drop policy if exists "Business members can read documents" on public.business_documents;
create policy "Business members can read documents" on public.business_documents for select to authenticated
using (
  status = 'active' and public.business_claims_active(workspace_id)
  and public.business_has_permission(workspace_id, 'documents.view')
  and (parent_type <> 'expense_claim' or public.business_can_view_claim(workspace_id, parent_id))
);
drop policy if exists "Business members can read registered private documents" on storage.objects;
create policy "Business members can read registered private documents" on storage.objects for select to authenticated
using (
  bucket_id = 'business-documents' and exists (
    select 1 from public.business_documents d
    where d.storage_path = storage.objects.name and d.status = 'active'
      and d.workspace_id = public.business_storage_workspace_id(storage.objects.name)
      and public.business_claims_active(d.workspace_id)
      and public.business_has_permission(d.workspace_id, 'documents.view')
      and (d.parent_type <> 'expense_claim' or public.business_can_view_claim(d.workspace_id, d.parent_id))
  )
);
drop policy if exists "Business members can upload private documents" on storage.objects;
create policy "Business members can upload private documents" on storage.objects for insert to authenticated
with check (
  bucket_id = 'business-documents'
  and public.business_storage_workspace_id(name) is not null
  and (storage.foldername(name))[3] = auth.uid()::text
  and public.business_claims_active(public.business_storage_workspace_id(name))
  and public.business_has_permission(public.business_storage_workspace_id(name), 'documents.create')
);
drop policy if exists "Business members can delete archived or unregistered private documents" on storage.objects;
create policy "Business members can delete archived or unregistered private documents"
on storage.objects for delete to authenticated using (
  bucket_id = 'business-documents'
  and public.business_storage_workspace_id(name) is not null
  and public.business_claims_active(public.business_storage_workspace_id(name))
  and (
    (public.business_has_permission(public.business_storage_workspace_id(name), 'documents.manage')
      and not exists (select 1 from public.business_documents d
        where d.storage_path = storage.objects.name and d.status = 'active'))
    or ((storage.foldername(name))[3] = auth.uid()::text
      and public.business_has_permission(public.business_storage_workspace_id(name), 'documents.create')
      and not exists (select 1 from public.business_documents d
        where d.storage_path = storage.objects.name))
  )
);

create or replace function public.register_business_document(
  p_document_id uuid, p_workspace_id uuid, p_parent_type text, p_parent_id uuid,
  p_storage_path text, p_original_name text, p_mime_type text,
  p_size_bytes bigint, p_checksum_sha256 text default null
)
returns public.business_documents language plpgsql security definer
set search_path = public, storage, pg_temp as $$
declare
  v_result public.business_documents%rowtype;
  v_object_mime text;
  v_object_size bigint;
begin
  if not public.business_claims_active(p_workspace_id)
    or not public.business_has_permission(p_workspace_id, 'documents.create')
    then raise exception 'BUSINESS_DOCUMENT_ACCESS_REQUIRED'; end if;
  if p_parent_type = 'expense_claim' and not exists (
    select 1 from public.business_expense_claims
    where id = p_parent_id and workspace_id = p_workspace_id
      and submitted_by = auth.uid() and status in ('draft', 'changes_requested')
  ) then raise exception 'BUSINESS_CLAIM_RECEIPT_ACCESS_REQUIRED'; end if;
  if p_document_id is null or p_storage_path is null or p_storage_path like '%..%'
    or p_storage_path not like ('workspaces/' || p_workspace_id::text || '/'
      || auth.uid()::text || '/' || p_document_id::text || '/%')
    then raise exception 'INVALID_BUSINESS_DOCUMENT_PATH'; end if;
  select metadata ->> 'mimetype', nullif(metadata ->> 'size', '')::bigint
    into v_object_mime, v_object_size
    from storage.objects where bucket_id = 'business-documents' and name = p_storage_path;
  if not found then raise exception 'BUSINESS_DOCUMENT_UPLOAD_NOT_FOUND'; end if;
  if coalesce(v_object_mime, p_mime_type) <> p_mime_type
    or coalesce(v_object_size, p_size_bytes) <> p_size_bytes
    then raise exception 'BUSINESS_DOCUMENT_METADATA_MISMATCH'; end if;
  insert into public.business_documents (
    id, workspace_id, parent_type, parent_id, storage_path, original_name,
    mime_type, size_bytes, checksum_sha256, uploaded_by
  ) values (
    p_document_id, p_workspace_id, p_parent_type, p_parent_id, p_storage_path,
    btrim(p_original_name), p_mime_type, p_size_bytes,
    nullif(lower(btrim(p_checksum_sha256)), ''), auth.uid()
  ) returning * into v_result;
  perform public.business_record_audit_event(
    p_workspace_id, 'business.document_registered', 'business_document', v_result.id,
    '{}'::jsonb, jsonb_build_object('parent_type', v_result.parent_type,
      'parent_id', v_result.parent_id, 'mime_type', v_result.mime_type,
      'size_bytes', v_result.size_bytes)
  );
  return v_result;
end;
$$;

create or replace function public.archive_business_document(
  p_workspace_id uuid, p_document_id uuid, p_reason text default null
)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v_document public.business_documents%rowtype;
begin
  if not public.business_claims_active(p_workspace_id)
    or not public.business_has_permission(p_workspace_id, 'documents.manage')
    then raise exception 'BUSINESS_DOCUMENT_MANAGE_REQUIRED'; end if;
  select * into v_document from public.business_documents
    where id = p_document_id and workspace_id = p_workspace_id and status = 'active'
    for update;
  if not found then raise exception 'BUSINESS_DOCUMENT_NOT_FOUND'; end if;
  if v_document.parent_type = 'expense_claim' and exists (
    select 1 from public.business_expense_claims
    where workspace_id = p_workspace_id and id = v_document.parent_id
      and status not in ('draft', 'changes_requested')
  ) then raise exception 'BUSINESS_SUBMITTED_RECEIPT_LOCKED'; end if;
  update public.business_documents
    set status = 'archived', archived_at = now(), archived_by = auth.uid()
    where id = p_document_id;
  perform public.business_record_audit_event(p_workspace_id,
    'business.document_archived', 'business_document', p_document_id,
    jsonb_build_object('status', 'active'), jsonb_build_object('status', 'archived'), p_reason);
  return v_document.storage_path;
end;
$$;

create function public.create_business_claim(
  p_workspace_id uuid, p_kind text, p_title text, p_description text,
  p_category_id uuid, p_dimension_id uuid, p_amount numeric,
  p_currency text, p_expense_date date
)
returns public.business_expense_claims language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_claim public.business_expense_claims%rowtype;
  v_reporting text;
  v_rate record;
  v_currency text := upper(btrim(coalesce(p_currency, '')));
begin
  if not public.business_claims_active(p_workspace_id)
    or not public.business_has_permission(p_workspace_id, 'finance.create')
    then raise exception 'BUSINESS_CLAIM_ACCESS_REQUIRED'; end if;
  if p_kind not in ('company_expense', 'reimbursement')
    or p_amount is null or p_amount <= 0 or p_amount > 99999999999999
    or char_length(btrim(coalesce(p_title, ''))) not between 2 and 160
    or char_length(coalesce(p_description, '')) > 2000
    or p_expense_date is null or p_expense_date > current_date + 1
    then raise exception 'INVALID_BUSINESS_CLAIM'; end if;
  if not exists (select 1 from public.business_categories
    where workspace_id = p_workspace_id and id = p_category_id
      and category_type in ('expense', 'both') and status = 'active')
    then raise exception 'BUSINESS_EXPENSE_CATEGORY_REQUIRED'; end if;
  if p_dimension_id is not null and not exists (
    select 1 from public.business_dimensions where workspace_id = p_workspace_id
      and id = p_dimension_id and status = 'active'
  ) then raise exception 'BUSINESS_DIMENSION_REQUIRED'; end if;
  if not public.business_claim_in_scope(p_workspace_id, p_dimension_id)
    then raise exception 'BUSINESS_SCOPE_ACCESS_REQUIRED'; end if;
  select reporting_currency into v_reporting from public.workspace_settings
    where workspace_id = p_workspace_id and v_currency = any(enabled_currencies);
  if v_reporting is null then raise exception 'BUSINESS_CURRENCY_NOT_ENABLED'; end if;
  select * into v_rate from public.latest_exchange_rate(v_currency, v_reporting, now());
  if v_rate.exchange_rate is null then raise exception 'BUSINESS_EXCHANGE_RATE_UNAVAILABLE'; end if;
  insert into public.business_expense_claims (
    workspace_id, submitted_by, kind, title, description, category_id,
    dimension_id, amount, currency, reporting_currency, reporting_amount,
    exchange_rate, rate_effective_at, rate_provider, expense_date
  ) values (
    p_workspace_id, auth.uid(), p_kind, btrim(p_title), coalesce(p_description, ''),
    p_category_id, p_dimension_id, p_amount, v_currency, v_reporting,
    round(p_amount * v_rate.exchange_rate, 4), v_rate.exchange_rate,
    v_rate.rate_effective_at, v_rate.provider, p_expense_date
  ) returning * into v_claim;
  perform public.business_record_audit_event(p_workspace_id, 'expense.created',
    'business_expense_claim', v_claim.id, '{}'::jsonb,
    jsonb_build_object('kind', v_claim.kind, 'amount', v_claim.amount,
      'currency', v_claim.currency, 'reporting_amount', v_claim.reporting_amount));
  return v_claim;
end;
$$;

create function public.save_business_claim_draft(
  p_workspace_id uuid, p_claim_id uuid, p_expected_version integer,
  p_title text, p_description text, p_category_id uuid, p_dimension_id uuid,
  p_amount numeric, p_currency text, p_expense_date date
)
returns public.business_expense_claims language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_claim public.business_expense_claims%rowtype;
  v_before jsonb;
  v_reporting text;
  v_rate record;
  v_currency text := upper(btrim(coalesce(p_currency, '')));
begin
  if not public.business_claims_active(p_workspace_id)
    or not public.business_has_permission(p_workspace_id, 'finance.create')
    then raise exception 'BUSINESS_CLAIM_ACCESS_REQUIRED'; end if;
  select * into v_claim from public.business_expense_claims
    where workspace_id = p_workspace_id and id = p_claim_id for update;
  if not found or v_claim.submitted_by <> auth.uid()
    or v_claim.version <> p_expected_version
    or v_claim.status not in ('draft', 'changes_requested')
    then raise exception 'BUSINESS_CLAIM_CHANGED'; end if;
  v_before := jsonb_build_object('amount', v_claim.amount,
    'currency', v_claim.currency, 'title', v_claim.title);
  if p_amount is null or p_amount <= 0 or p_amount > 99999999999999
    or char_length(btrim(coalesce(p_title, ''))) not between 2 and 160
    or char_length(coalesce(p_description, '')) > 2000
    or p_expense_date is null or p_expense_date > current_date + 1
    then raise exception 'INVALID_BUSINESS_CLAIM'; end if;
  if not exists (select 1 from public.business_categories
    where workspace_id = p_workspace_id and id = p_category_id
      and category_type in ('expense', 'both') and status = 'active')
    then raise exception 'BUSINESS_EXPENSE_CATEGORY_REQUIRED'; end if;
  if p_dimension_id is not null and not exists (
    select 1 from public.business_dimensions where workspace_id = p_workspace_id
      and id = p_dimension_id and status = 'active'
  ) then raise exception 'BUSINESS_DIMENSION_REQUIRED'; end if;
  if not public.business_claim_in_scope(p_workspace_id, p_dimension_id)
    then raise exception 'BUSINESS_SCOPE_ACCESS_REQUIRED'; end if;
  select reporting_currency into v_reporting from public.workspace_settings
    where workspace_id = p_workspace_id and v_currency = any(enabled_currencies);
  if v_reporting is null then raise exception 'BUSINESS_CURRENCY_NOT_ENABLED'; end if;
  select * into v_rate from public.latest_exchange_rate(v_currency, v_reporting, now());
  if v_rate.exchange_rate is null then raise exception 'BUSINESS_EXCHANGE_RATE_UNAVAILABLE'; end if;
  update public.business_expense_claims
    set title = btrim(p_title), description = coalesce(p_description, ''),
      category_id = p_category_id, dimension_id = p_dimension_id,
      amount = p_amount, currency = v_currency, reporting_currency = v_reporting,
      reporting_amount = round(p_amount * v_rate.exchange_rate, 4),
      exchange_rate = v_rate.exchange_rate, rate_effective_at = v_rate.rate_effective_at,
      rate_provider = v_rate.provider, expense_date = p_expense_date,
      version = version + 1, updated_at = now()
    where id = p_claim_id returning * into v_claim;
  perform public.business_record_audit_event(p_workspace_id, 'expense.draft_edited',
    'business_expense_claim', p_claim_id,
    v_before,
    jsonb_build_object('amount', v_claim.amount, 'currency', v_claim.currency,
      'title', v_claim.title));
  return v_claim;
end;
$$;

create function public.submit_business_claim(p_workspace_id uuid, p_claim_id uuid, p_expected_version integer)
returns public.business_expense_claims language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_claim public.business_expense_claims%rowtype;
  v_owner uuid;
begin
  if not public.business_claims_active(p_workspace_id)
    then raise exception 'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED'; end if;
  select * into v_claim from public.business_expense_claims
    where workspace_id = p_workspace_id and id = p_claim_id for update;
  if not found or v_claim.submitted_by <> auth.uid() or v_claim.version <> p_expected_version
    or v_claim.status not in ('draft', 'changes_requested')
    then raise exception 'BUSINESS_CLAIM_CHANGED'; end if;
  if not exists (select 1 from public.business_documents
    where workspace_id = p_workspace_id and parent_type = 'expense_claim'
      and parent_id = p_claim_id and status = 'active')
    then raise exception 'BUSINESS_RECEIPT_REQUIRED'; end if;
  select owner_id into v_owner from public.budget_workspaces where id = p_workspace_id;
  -- An Owner can record a company expense directly. This is a distinct
  -- entry flow, never an approval of the Owner's own claim.
  update public.business_expense_claims
    set status = case when v_claim.kind = 'company_expense' and v_claim.submitted_by = v_owner
      then 'approved' else 'submitted' end,
      submitted_at = now(), reviewed_by = null, reviewed_at = null,
      review_reason = null, version = version + 1, updated_at = now()
    where id = p_claim_id returning * into v_claim;
  perform public.business_record_audit_event(p_workspace_id,
    case when v_claim.status = 'approved' then 'expense.owner_recorded' else 'expense.submitted' end,
    'business_expense_claim', p_claim_id, '{}'::jsonb,
    jsonb_build_object('status', v_claim.status));
  if v_claim.status = 'submitted' and v_owner <> auth.uid() then
    insert into public.notifications(user_id, created_by, type, title, body)
      values (v_owner, auth.uid(), 'business_claim', 'Business expense needs review',
        'A new Business expense or reimbursement claim is awaiting review.');
  end if;
  return v_claim;
end;
$$;

create function public.review_business_claim(
  p_workspace_id uuid, p_claim_id uuid, p_expected_version integer,
  p_decision text, p_reason text default null
)
returns public.business_expense_claims language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_claim public.business_expense_claims%rowtype;
begin
  if not public.business_claims_active(p_workspace_id)
    or not public.business_has_permission(p_workspace_id, 'approvals.review')
    then raise exception 'BUSINESS_REVIEW_ACCESS_REQUIRED'; end if;
  if p_decision not in ('approved', 'rejected', 'changes_requested')
    or (p_decision <> 'approved' and char_length(btrim(coalesce(p_reason, ''))) < 3)
    or char_length(coalesce(p_reason, '')) > 1000
    then raise exception 'BUSINESS_REVIEW_REASON_REQUIRED'; end if;
  select * into v_claim from public.business_expense_claims
    where workspace_id = p_workspace_id and id = p_claim_id for update;
  if not found or v_claim.status <> 'submitted' or v_claim.version <> p_expected_version
    then raise exception 'BUSINESS_CLAIM_CHANGED'; end if;
  if v_claim.submitted_by = auth.uid() then raise exception 'BUSINESS_SELF_APPROVAL_FORBIDDEN'; end if;
  if not public.business_claim_in_scope(p_workspace_id, v_claim.dimension_id)
    then raise exception 'BUSINESS_SCOPE_ACCESS_REQUIRED'; end if;
  update public.business_expense_claims
    set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(),
      review_reason = nullif(btrim(p_reason), ''), version = version + 1, updated_at = now()
    where id = p_claim_id returning * into v_claim;
  perform public.business_record_audit_event(p_workspace_id, 'expense.reviewed',
    'business_expense_claim', p_claim_id,
    jsonb_build_object('status', 'submitted'),
    jsonb_build_object('status', v_claim.status, 'reviewer', auth.uid()),
    v_claim.review_reason);
  insert into public.notifications(user_id, created_by, type, title, body)
    values (v_claim.submitted_by, auth.uid(), 'business_claim', 'Business claim reviewed',
      'Your expense or reimbursement claim was ' || replace(v_claim.status, '_', ' ') || '.');
  return v_claim;
end;
$$;

create function public.record_business_claim_payment(
  p_workspace_id uuid, p_claim_id uuid, p_expected_version integer,
  p_paid_at timestamptz, p_payment_reference text
)
returns public.business_expense_claims language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_claim public.business_expense_claims%rowtype;
begin
  if not public.business_claims_active(p_workspace_id)
    or not public.business_has_permission(p_workspace_id, 'finance.record_payment')
    then raise exception 'BUSINESS_PAYMENT_ACCESS_REQUIRED'; end if;
  select * into v_claim from public.business_expense_claims
    where workspace_id = p_workspace_id and id = p_claim_id for update;
  if not found or v_claim.status <> 'approved' or v_claim.version <> p_expected_version
    then raise exception 'BUSINESS_CLAIM_CHANGED'; end if;
  if not public.business_claim_in_scope(p_workspace_id, v_claim.dimension_id)
    then raise exception 'BUSINESS_SCOPE_ACCESS_REQUIRED'; end if;
  if p_paid_at is null or p_paid_at > now() + interval '5 minutes'
    or char_length(btrim(coalesce(p_payment_reference, ''))) not between 2 and 160
    then raise exception 'INVALID_BUSINESS_PAYMENT'; end if;
  update public.business_expense_claims
    set status = 'paid', paid_by = auth.uid(), paid_at = p_paid_at,
      payment_reference = btrim(p_payment_reference), version = version + 1,
      updated_at = now()
    where id = p_claim_id returning * into v_claim;
  perform public.business_record_audit_event(p_workspace_id, 'expense.paid',
    'business_expense_claim', p_claim_id,
    jsonb_build_object('status', 'approved'),
    jsonb_build_object('status', 'paid', 'paid_at', v_claim.paid_at,
      'payment_reference', v_claim.payment_reference));
  if v_claim.submitted_by <> auth.uid() then
    insert into public.notifications(user_id, created_by, type, title, body)
      values (v_claim.submitted_by, auth.uid(), 'business_claim',
        'Business claim payment recorded', 'The company has recorded payment for your claim.');
  end if;
  return v_claim;
end;
$$;

-- Private audit history for each claim, including staff who cannot see all
-- workspace audit events. Only claim-related events are returned.
create function public.business_claim_history(p_workspace_id uuid, p_claim_id uuid)
returns table(action text, actor_id uuid, reason text, created_at timestamptz,
  before_summary jsonb, after_summary jsonb)
language sql stable security definer set search_path = public, pg_temp as $$
  select e.action, e.actor_id, e.reason, e.created_at, e.before_summary, e.after_summary
  from public.business_audit_events e
  where e.workspace_id = p_workspace_id and e.target_id = p_claim_id
    and e.target_type = 'business_expense_claim'
    and public.business_can_view_claim(p_workspace_id, p_claim_id)
  order by e.created_at, e.id;
$$;

create function public.business_claim_summary(p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_summary record;
  v_currency text;
  v_finance boolean;
begin
  if not public.business_claims_active(p_workspace_id)
    then raise exception 'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED'; end if;
  v_finance := public.business_has_permission(p_workspace_id, 'finance.view_all');
  select reporting_currency into v_currency from public.workspace_settings
    where workspace_id = p_workspace_id;
  select
    coalesce(sum(c.reporting_amount) filter (where c.status = 'paid'), 0) as paid_amount,
    coalesce(sum(c.reporting_amount) filter (where c.status = 'approved'), 0) as committed_amount,
    count(*) filter (where c.status = 'paid') as paid_count,
    count(*) filter (where c.status = 'submitted') as pending_count,
    count(*) filter (where c.status = 'submitted' and c.submitted_by <> auth.uid()) as review_count
  into v_summary
  from public.business_expense_claims c
  where c.workspace_id = p_workspace_id
    and public.business_can_view_claim(p_workspace_id, c.id);
  return jsonb_build_object(
    'reporting_currency', v_currency, 'finance_visible', v_finance,
    'paid_amount', case when v_finance then v_summary.paid_amount else null end,
    'committed_amount', case when v_finance then v_summary.committed_amount else null end,
    'paid_count', case when v_finance then v_summary.paid_count else null end,
    'pending_count', case when v_finance then v_summary.pending_count else null end,
    'review_count', case when public.business_has_permission(p_workspace_id, 'approvals.review')
      then v_summary.review_count else 0 end
  );
end;
$$;

revoke all on function public.business_claims_active(uuid) from public, anon;
revoke all on function public.business_claim_in_scope(uuid,uuid) from public, anon;
revoke all on function public.business_can_view_claim(uuid,uuid) from public, anon;
grant execute on function public.business_claims_active(uuid) to authenticated;
grant execute on function public.business_claim_in_scope(uuid,uuid) to authenticated;
grant execute on function public.business_can_view_claim(uuid,uuid) to authenticated;
revoke all on function public.create_business_claim(uuid,text,text,text,uuid,uuid,numeric,text,date) from public, anon;
revoke all on function public.save_business_claim_draft(uuid,uuid,integer,text,text,uuid,uuid,numeric,text,date) from public, anon;
revoke all on function public.submit_business_claim(uuid,uuid,integer) from public, anon;
revoke all on function public.review_business_claim(uuid,uuid,integer,text,text) from public, anon;
revoke all on function public.record_business_claim_payment(uuid,uuid,integer,timestamptz,text) from public, anon;
revoke all on function public.business_claim_history(uuid,uuid) from public, anon;
revoke all on function public.business_claim_summary(uuid) from public, anon;
revoke all on function public.lock_business_claim_reporting_currency() from public, anon, authenticated;
grant execute on function public.create_business_claim(uuid,text,text,text,uuid,uuid,numeric,text,date) to authenticated;
grant execute on function public.save_business_claim_draft(uuid,uuid,integer,text,text,uuid,uuid,numeric,text,date) to authenticated;
grant execute on function public.submit_business_claim(uuid,uuid,integer) to authenticated;
grant execute on function public.review_business_claim(uuid,uuid,integer,text,text) to authenticated;
grant execute on function public.record_business_claim_payment(uuid,uuid,integer,timestamptz,text) to authenticated;
grant execute on function public.business_claim_history(uuid,uuid) to authenticated;
grant execute on function public.business_claim_summary(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
