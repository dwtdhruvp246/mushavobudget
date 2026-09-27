-- Release 4.9.13: atomically record a completed one-time payment.
begin;

create or replace function public.create_completed_one_time_payment(
  p_workspace_id uuid,
  p_name text,
  p_category text,
  p_amount numeric,
  p_currency text,
  p_payment_date date,
  p_payment_method text,
  p_paid_by_member_id uuid,
  p_reference_number text,
  p_notes text,
  p_proof_path text,
  p_proof_name text,
  p_proof_mime_type text,
  p_proof_size_bytes bigint
)
returns table (payment_item_id uuid, payment_record_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace public.budget_workspaces;
  v_entitlement record;
  v_family_id uuid;
  v_family_owner_id uuid;
  v_visibility text;
  v_item_id uuid;
  v_record_id uuid;
  v_currency text := upper(btrim(coalesce(p_currency, '')));
  v_category text := coalesce(nullif(btrim(p_category), ''), 'Other');
  v_expected_proof_prefix text;
begin
  if v_user_id is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if public.my_account_suspended() then raise exception 'ACCOUNT_SUSPENDED'; end if;

  select workspaces.* into v_workspace
  from public.budget_workspaces as workspaces
  where workspaces.id = p_workspace_id
    and workspaces.status = 'active'
    and workspaces.workspace_type in ('personal', 'household')
    and (
      (workspaces.workspace_type = 'personal' and workspaces.owner_id = v_user_id)
      or
      (workspaces.workspace_type = 'household' and public.is_active_family_participant(workspaces.legacy_family_id))
    );
  if not found then raise exception 'COMPLETED_PAYMENT_WORKSPACE_REQUIRED'; end if;

  select * into v_entitlement
  from public.effective_workspace_entitlement(p_workspace_id);
  if v_entitlement.workspace_id is null then raise exception 'WORKSPACE_ACCESS_REQUIRED'; end if;
  if v_entitlement.read_only or v_entitlement.effective_status = 'suspended' then
    raise exception 'WORKSPACE_READ_ONLY';
  end if;

  if nullif(btrim(p_name), '') is null
     or length(btrim(p_name)) > 160
     or p_amount is null or round(p_amount, 2) <= 0
     or v_currency !~ '^[A-Z]{3}$'
     or p_payment_date is null or p_payment_date > current_date
     or length(v_category) > 80
     or length(coalesce(p_reference_number, '')) > 160
     or length(coalesce(p_notes, '')) > 1000
  then raise exception 'COMPLETED_PAYMENT_DETAILS_INVALID'; end if;
  if p_payment_method not in ('Cash', 'EFT', 'Card', 'Bank deposit', 'Other') then
    raise exception 'COMPLETED_PAYMENT_METHOD_INVALID';
  end if;

  if v_workspace.workspace_type = 'household' then
    v_visibility := 'family';
    v_family_id := v_workspace.legacy_family_id;
    select families.owner_id into v_family_owner_id from public.families where families.id = v_family_id;
    if p_paid_by_member_id is null or not exists (
      select 1 from public.family_members as members
      where members.id = p_paid_by_member_id
        and members.family_id = v_family_id
        and members.status = 'active'
    ) then raise exception 'PAID_BY_MEMBER_REQUIRED'; end if;
    v_expected_proof_prefix := 'families/' || v_family_id || '/' || v_family_owner_id || '/' || v_user_id || '/';
  else
    v_visibility := 'personal';
    v_family_id := null;
    if p_paid_by_member_id is not null then raise exception 'PAID_BY_MEMBER_REQUIRED'; end if;
    v_expected_proof_prefix := 'personal/' || v_user_id || '/';
  end if;

  if p_proof_path is null then
    if p_proof_name is not null or p_proof_mime_type is not null or p_proof_size_bytes is not null then
      raise exception 'COMPLETED_PAYMENT_DETAILS_INVALID';
    end if;
  elsif left(p_proof_path, length(v_expected_proof_prefix)) <> v_expected_proof_prefix
     or nullif(btrim(p_proof_name), '') is null
     or p_proof_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
     or p_proof_size_bytes is null or p_proof_size_bytes <= 0 or p_proof_size_bytes > 10485760
  then raise exception 'COMPLETED_PAYMENT_DETAILS_INVALID'; end if;

  insert into public.payment_items (
    workspace_id, family_id, owner_id, visibility, responsible_member_id, created_by,
    name, category, amount, currency, recurrence_type, recurrence_interval,
    due_day, start_date, reminder_days_before, status, notes
  ) values (
    p_workspace_id, v_family_id, v_user_id, v_visibility, null, v_user_id,
    btrim(p_name), v_category, round(p_amount, 2), v_currency, 'once', 1,
    extract(day from p_payment_date)::integer, p_payment_date, 0, 'active', nullif(btrim(p_notes), '')
  ) returning id into v_item_id;

  insert into public.payment_records (
    workspace_id, family_id, owner_id, visibility, payment_item_id,
    period_start, due_date, paid_by_member_id, amount, currency,
    payment_date, payment_method, reference_number, notes,
    proof_path, proof_name, proof_mime_type, proof_size_bytes, recorded_by
  ) values (
    p_workspace_id, v_family_id, v_user_id, v_visibility, v_item_id,
    date_trunc('month', p_payment_date)::date, p_payment_date, p_paid_by_member_id,
    round(p_amount, 2), v_currency, p_payment_date, p_payment_method,
    nullif(btrim(p_reference_number), ''), nullif(btrim(p_notes), ''),
    p_proof_path, p_proof_name, p_proof_mime_type, p_proof_size_bytes, v_user_id
  ) returning id into v_record_id;

  return query select v_item_id, v_record_id;
end;
$$;

revoke all on function public.create_completed_one_time_payment(
  uuid, text, text, numeric, text, date, text, uuid, text, text, text, text, text, bigint
) from public, anon, authenticated;
grant execute on function public.create_completed_one_time_payment(
  uuid, text, text, numeric, text, date, text, uuid, text, text, text, text, text, bigint
) to authenticated;

notify pgrst, 'reload schema';
commit;
