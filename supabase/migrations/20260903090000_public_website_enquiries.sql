-- Public website, dynamic plan catalogue, admin plan management, and enquiries.
-- This migration is also included in full in supabase/schema.sql.

alter table public.plans
  add column if not exists marketing_summary text not null default '',
  add column if not exists is_public boolean not null default false,
  add column if not exists is_featured boolean not null default false,
  add column if not exists available_for_purchase boolean not null default true,
  add column if not exists cta_label text not null default 'Choose plan';

update public.plans
set is_public = true,
    marketing_summary = case code
      when 'free' then 'Essential payment tracking for a personal workspace.'
      when 'personal' then 'Unlimited personal payment planning with complete reports.'
      when 'household' then 'Shared payment responsibility for a family, with additional places when needed.'
      when 'business' then 'Team payment control, approval features, and deeper history for a business workspace.'
      else coalesce(nullif(marketing_summary, ''), description)
    end,
    is_featured = code = 'household',
    cta_label = case code when 'free' then 'Start free' when 'household' then 'Start a Family plan' else 'Choose plan' end
where code in ('free', 'personal', 'household', 'business') and marketing_summary = '';

create or replace function public.get_public_plan_catalogue(p_currency text default 'USD')
returns table (plan_id uuid, code text, display_name text, description text, marketing_summary text, workspace_type text, is_featured boolean, available_for_purchase boolean, cta_label text, sort_order integer, included_member_seats integer, active_payment_limit integer, features jsonb, prices jsonb, available_currencies text[])
language sql stable security definer set search_path = public, pg_temp
as $$
  select plans.id, plans.code, plans.display_name, plans.description,
    coalesce(nullif(plans.marketing_summary, ''), plans.description), plans.workspace_type,
    plans.is_featured, plans.available_for_purchase, plans.cta_label, plans.sort_order,
    coalesce((select limit_value from public.plan_limits where plan_id = plans.id and limit_code = 'included_member_seats'), 1),
    (select limit_value from public.plan_limits where plan_id = plans.id and limit_code = 'active_planned_payments'),
    coalesce((select jsonb_agg(jsonb_build_object('code', feature_code, 'enabled', enabled) order by feature_code) from public.plan_features where plan_id = plans.id and enabled), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('billing_period', billing_period, 'currency', currency, 'amount', amount, 'extra_member_amount', extra_member_amount, 'effective_from', effective_from) order by billing_period) from public.plan_prices where plan_id = plans.id and currency = upper(coalesce(nullif(p_currency, ''), 'USD')) and is_active and effective_from <= now() and (effective_until is null or effective_until > now())), '[]'::jsonb),
    coalesce((select array_agg(distinct currency order by currency) from public.plan_prices where plan_id = plans.id and is_active and effective_from <= now() and (effective_until is null or effective_until > now())), array[]::text[])
  from public.plans where plans.is_active and plans.is_public order by plans.sort_order, plans.display_name;
$$;

create or replace function public.save_plan_definition(p_plan_id uuid, p_code text, p_display_name text, p_description text, p_marketing_summary text, p_workspace_type text, p_included_member_seats integer, p_active_payment_limit integer, p_is_active boolean, p_is_public boolean, p_is_featured boolean, p_available_for_purchase boolean, p_cta_label text, p_sort_order integer, p_feature_codes text[] default array[]::text[])
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_plan_id uuid; v_code text := lower(btrim(p_code)); v_name text := nullif(btrim(p_display_name), '');
begin
  if not public.is_platform_staff(array['super_admin', 'admin_staff']) then raise exception 'PLAN_MANAGEMENT_ACCESS_REQUIRED'; end if;
  if v_code !~ '^[a-z][a-z0-9_]*$' then raise exception 'INVALID_PLAN_CODE'; end if;
  if v_name is null or char_length(v_name) > 80 then raise exception 'INVALID_PLAN_NAME'; end if;
  if p_workspace_type not in ('personal', 'household', 'business') then raise exception 'INVALID_WORKSPACE_TYPE'; end if;
  if p_included_member_seats is null or p_included_member_seats < 1 or p_included_member_seats > 100 then raise exception 'INVALID_INCLUDED_MEMBER_SEATS'; end if;
  if p_active_payment_limit is not null and (p_active_payment_limit < 1 or p_active_payment_limit > 100000) then raise exception 'INVALID_PAYMENT_LIMIT'; end if;
  if char_length(coalesce(p_description, '')) > 500 or char_length(coalesce(p_marketing_summary, '')) > 500 then raise exception 'PLAN_DESCRIPTION_TOO_LONG'; end if;
  if char_length(coalesce(p_cta_label, '')) > 60 then raise exception 'PLAN_CTA_TOO_LONG'; end if;
  if p_plan_id is null then
    insert into public.plans (code, display_name, description, marketing_summary, workspace_type, is_active, is_public, is_featured, available_for_purchase, cta_label, sort_order)
    values (v_code, v_name, coalesce(btrim(p_description), ''), coalesce(btrim(p_marketing_summary), ''), p_workspace_type, coalesce(p_is_active, true), coalesce(p_is_public, false), coalesce(p_is_featured, false), coalesce(p_available_for_purchase, true), coalesce(nullif(btrim(p_cta_label), ''), 'Choose plan'), coalesce(p_sort_order, 0)) returning id into v_plan_id;
  else
    select id into v_plan_id from public.plans where id = p_plan_id for update;
    if v_plan_id is null then raise exception 'PLAN_NOT_FOUND'; end if;
    if exists (select 1 from public.plans where id = v_plan_id and code <> v_code) then raise exception 'PLAN_CODE_CANNOT_CHANGE'; end if;
    update public.plans set display_name = v_name, description = coalesce(btrim(p_description), ''), marketing_summary = coalesce(btrim(p_marketing_summary), ''), workspace_type = p_workspace_type, is_active = coalesce(p_is_active, true), is_public = coalesce(p_is_public, false), is_featured = coalesce(p_is_featured, false), available_for_purchase = coalesce(p_available_for_purchase, true), cta_label = coalesce(nullif(btrim(p_cta_label), ''), 'Choose plan'), sort_order = coalesce(p_sort_order, 0), updated_at = now() where id = v_plan_id;
  end if;
  if coalesce(p_is_featured, false) then update public.plans set is_featured = false, updated_at = now() where workspace_type = p_workspace_type and id <> v_plan_id and is_featured; end if;
  insert into public.plan_limits (plan_id, limit_code, limit_value) values (v_plan_id, 'included_member_seats', p_included_member_seats) on conflict (plan_id, limit_code) do update set limit_value = excluded.limit_value;
  if p_active_payment_limit is null then delete from public.plan_limits where plan_id = v_plan_id and limit_code = 'active_planned_payments'; else insert into public.plan_limits (plan_id, limit_code, limit_value) values (v_plan_id, 'active_planned_payments', p_active_payment_limit) on conflict (plan_id, limit_code) do update set limit_value = excluded.limit_value; end if;
  update public.plan_features set enabled = false where plan_id = v_plan_id;
  insert into public.plan_features (plan_id, feature_code, enabled) select v_plan_id, selected.feature_code, true from unnest(coalesce(p_feature_codes, array[]::text[])) as selected(feature_code) where selected.feature_code ~ '^[a-z][a-z0-9_.-]*$' on conflict (plan_id, feature_code) do update set enabled = true;
  insert into public.subscription_audit_events (actor_id, action, target_type, target_id, safe_details) values (auth.uid(), 'plan.definition_saved', 'plan', v_plan_id, jsonb_build_object('plan_code', v_code));
  return v_plan_id;
end; $$;

create table if not exists public.public_enquiries (
  id uuid primary key default gen_random_uuid(), reference_number text not null unique, user_id uuid references auth.users(id) on delete set null,
  full_name text not null check (char_length(full_name) between 2 and 120), email text not null check (char_length(email) between 5 and 254),
  phone text check (phone is null or char_length(phone) <= 40), organisation text check (organisation is null or char_length(organisation) <= 160),
  category text not null check (category in ('general', 'personal_plan', 'family_plan', 'business_plan', 'pricing', 'account', 'payment', 'technical', 'partnership')),
  subject text not null check (char_length(subject) between 3 and 180), message text not null check (char_length(message) between 10 and 5000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'waiting_for_customer', 'resolved', 'spam', 'archived')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')), assigned_to uuid references auth.users(id) on delete set null,
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 5000), source_page text check (source_page is null or char_length(source_page) <= 500),
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), resolved_at timestamptz, archived_at timestamptz
);
create index if not exists public_enquiries_status_created_idx on public.public_enquiries(status, created_at desc);
create index if not exists public_enquiries_email_created_idx on public.public_enquiries(lower(email), created_at desc);
create index if not exists public_enquiries_assigned_idx on public.public_enquiries(assigned_to, status, created_at desc);

create table if not exists public.public_enquiry_events (
  id uuid primary key default gen_random_uuid(), enquiry_id uuid not null references public.public_enquiries(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('created', 'status_changed', 'priority_changed', 'assignment_changed', 'notes_updated', 'updated')),
  safe_details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists public_enquiry_events_enquiry_idx on public.public_enquiry_events(enquiry_id, created_at desc);
create or replace function public.record_public_enquiry_event() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_event_type text := 'updated';
begin
  if tg_op = 'INSERT' then v_event_type := 'created';
  elsif old.status is distinct from new.status then v_event_type := 'status_changed';
  elsif old.priority is distinct from new.priority then v_event_type := 'priority_changed';
  elsif old.assigned_to is distinct from new.assigned_to then v_event_type := 'assignment_changed';
  elsif old.internal_notes is distinct from new.internal_notes then v_event_type := 'notes_updated'; end if;
  insert into public.public_enquiry_events (enquiry_id, actor_id, event_type, safe_details)
  values (new.id, auth.uid(), v_event_type, jsonb_strip_nulls(jsonb_build_object('status', new.status, 'previous_status', case when tg_op = 'UPDATE' then old.status else null end, 'priority', new.priority, 'previous_priority', case when tg_op = 'UPDATE' then old.priority else null end, 'assigned', new.assigned_to is not null)));
  return new;
end; $$;
drop trigger if exists record_public_enquiry_event_trigger on public.public_enquiries;
create trigger record_public_enquiry_event_trigger after insert or update on public.public_enquiries for each row execute function public.record_public_enquiry_event();

create or replace function public.touch_public_enquiry() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at := now(); if new.status = 'resolved' and old.status is distinct from 'resolved' then new.resolved_at := now(); end if; if new.status <> 'resolved' then new.resolved_at := null; end if; if new.status = 'archived' and old.status is distinct from 'archived' then new.archived_at := now(); end if; if new.status <> 'archived' then new.archived_at := null; end if; return new; end; $$;
drop trigger if exists touch_public_enquiry_trigger on public.public_enquiries;
create trigger touch_public_enquiry_trigger before update on public.public_enquiries for each row execute function public.touch_public_enquiry();
alter table public.public_enquiries enable row level security;
alter table public.public_enquiry_events enable row level security;
drop policy if exists "Support staff can read public enquiries" on public.public_enquiries;
create policy "Support staff can read public enquiries" on public.public_enquiries for select to authenticated using (public.is_platform_staff(array['super_admin', 'admin_staff', 'support_staff']));
drop policy if exists "Support staff can update public enquiries" on public.public_enquiries;
create policy "Support staff can update public enquiries" on public.public_enquiries for update to authenticated using (public.is_platform_staff(array['super_admin', 'admin_staff', 'support_staff'])) with check (public.is_platform_staff(array['super_admin', 'admin_staff', 'support_staff']));
drop policy if exists "Support staff can read public enquiry events" on public.public_enquiry_events;
create policy "Support staff can read public enquiry events" on public.public_enquiry_events for select to authenticated using (public.is_platform_staff(array['super_admin', 'admin_staff', 'support_staff']));
revoke all on public.public_enquiries from anon, authenticated;
revoke all on public.public_enquiry_events from anon, authenticated;
grant select, update on public.public_enquiries to authenticated;
grant select on public.public_enquiry_events to authenticated;
revoke all on function public.get_public_plan_catalogue(text) from public;
grant execute on function public.get_public_plan_catalogue(text) to anon, authenticated;
revoke all on function public.save_plan_definition(uuid, text, text, text, text, text, integer, integer, boolean, boolean, boolean, boolean, text, integer, text[]) from public;
grant execute on function public.save_plan_definition(uuid, text, text, text, text, text, integer, integer, boolean, boolean, boolean, boolean, text, integer, text[]) to authenticated;
do $$ begin if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables = true) and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'public_enquiries') then alter publication supabase_realtime add table public.public_enquiries; end if; end $$;
