-- Align Mushavo Budget enquiries with the established public-to-admin workflow.
-- Existing enquiry records are preserved while the public table is renamed.

begin;

create table if not exists public.countries (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{2}$'),
  name text not null check (char_length(name) between 2 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.enquiries') is null and to_regclass('public.public_enquiries') is not null then
    alter table public.public_enquiries rename to enquiries;
  end if;
end $$;

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) between 5 and 254),
  country_name text,
  country_code text,
  country_id uuid references public.countries(id) on delete set null,
  enquiry_type text,
  message text not null check (char_length(message) between 10 and 5000),
  status text not null default 'new',
  source text not null default 'website',
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists record_public_enquiry_event_trigger on public.enquiries;
drop trigger if exists touch_public_enquiry_trigger on public.enquiries;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'enquiries' and column_name = 'category'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'enquiries' and column_name = 'enquiry_type'
  ) then
    alter table public.enquiries rename column category to enquiry_type;
  end if;
end $$;

alter table public.enquiries add column if not exists country_name text;
alter table public.enquiries add column if not exists country_code text;
alter table public.enquiries add column if not exists country_id uuid references public.countries(id) on delete set null;
alter table public.enquiries add column if not exists enquiry_type text;
alter table public.enquiries add column if not exists source text default 'website';
alter table public.enquiries add column if not exists handled_by uuid references auth.users(id) on delete set null;
alter table public.enquiries add column if not exists handled_at timestamptz;
alter table public.enquiries add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'enquiries' and column_name = 'reference_number'
  ) then
    alter table public.enquiries alter column reference_number drop not null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'enquiries' and column_name = 'subject'
  ) then
    alter table public.enquiries alter column subject drop not null;
  end if;
end $$;

update public.enquiries
set enquiry_type = case enquiry_type
  when 'personal_plan' then 'sales'
  when 'family_plan' then 'sales'
  when 'business_plan' then 'sales'
  when 'pricing' then 'sales'
  when 'payment' then 'subscription_renewal'
  when 'account' then 'support'
  when 'technical' then 'support'
  when 'general' then 'support'
  else enquiry_type
end;

update public.enquiries
set status = case status
  when 'waiting_for_customer' then 'in_progress'
  when 'spam' then 'archived'
  else status
end;

update public.enquiries
set country_name = coalesce(nullif(trim(country_name), ''), 'Not provided'),
    country_code = coalesce(nullif(upper(trim(country_code)), ''), 'ZZ'),
    source = coalesce(nullif(trim(source), ''), 'website'),
    updated_at = coalesce(updated_at, created_at, now());

do $$
declare constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.enquiries'::regclass
      and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%status%' or pg_get_constraintdef(oid) ilike '%enquiry_type%')
  loop
    execute format('alter table public.enquiries drop constraint %I', constraint_row.conname);
  end loop;
end $$;

alter table public.enquiries alter column country_name set not null;
alter table public.enquiries alter column country_code set not null;
alter table public.enquiries alter column enquiry_type set not null;
alter table public.enquiries alter column source set not null;
alter table public.enquiries alter column source set default 'website';
alter table public.enquiries alter column updated_at set not null;
alter table public.enquiries alter column updated_at set default now();

alter table public.enquiries
  add constraint enquiries_country_name_check check (char_length(country_name) between 2 and 100),
  add constraint enquiries_country_code_check check (country_code ~ '^[A-Z]{2}$'),
  add constraint enquiries_type_check check (enquiry_type in ('support', 'sales', 'subscription_renewal', 'setup_help', 'country_availability', 'partnership')),
  add constraint enquiries_status_check check (status in ('new', 'in_progress', 'resolved', 'archived')),
  add constraint enquiries_source_check check (source in ('website', 'admin'));

create index if not exists enquiries_status_created_idx on public.enquiries(status, created_at desc);
create index if not exists enquiries_email_created_idx on public.enquiries(lower(email), created_at desc);
create index if not exists enquiries_country_created_idx on public.enquiries(country_id, created_at desc);

create or replace function public.normalize_enquiry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.full_name := trim(new.full_name);
  new.email := lower(trim(new.email));
  new.country_code := upper(trim(new.country_code));
  new.country_name := trim(new.country_name);
  new.message := trim(new.message);
  new.updated_at := now();

  if new.country_id is null then
    select id into new.country_id from public.countries where code = new.country_code limit 1;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    new.handled_by := auth.uid();
    if new.status in ('resolved', 'archived') then
      new.handled_at := now();
    else
      new.handled_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_enquiry_trigger on public.enquiries;
create trigger normalize_enquiry_trigger
before insert or update on public.enquiries
for each row execute function public.normalize_enquiry();

alter table public.countries enable row level security;
alter table public.enquiries enable row level security;

drop policy if exists "Support staff can read public enquiries" on public.enquiries;
drop policy if exists "Support staff can update public enquiries" on public.enquiries;
drop policy if exists "Staff can read countries" on public.countries;
drop policy if exists "Staff can read enquiries" on public.enquiries;
drop policy if exists "Staff can update enquiries" on public.enquiries;
drop policy if exists "Public can submit enquiries" on public.enquiries;

create policy "Public can submit enquiries" on public.enquiries
for insert to anon, authenticated
with check (
  status = 'new'
  and source = 'website'
  and handled_by is null
  and handled_at is null
  and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  and country_code = any (string_to_array('AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW', ' '))
);

create policy "Staff can read countries" on public.countries
for select to authenticated
using (public.is_platform_staff(array['super_admin', 'admin_staff', 'support_staff']));

create policy "Staff can read enquiries" on public.enquiries
for select to authenticated
using (public.is_platform_staff(array['super_admin', 'admin_staff', 'support_staff']));

create policy "Staff can update enquiries" on public.enquiries
for update to authenticated
using (public.is_platform_staff(array['super_admin', 'admin_staff', 'support_staff']))
with check (public.is_platform_staff(array['super_admin', 'admin_staff', 'support_staff']));

revoke all on public.countries from anon, authenticated;
revoke all on public.enquiries from anon, authenticated;
grant select on public.countries to authenticated;
grant select, update on public.enquiries to authenticated;
grant insert (full_name, email, country_name, country_code, enquiry_type, message)
on public.enquiries to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables = true)
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'enquiries'
     )
  then
    alter publication supabase_realtime add table public.enquiries;
  end if;
end $$;

commit;
