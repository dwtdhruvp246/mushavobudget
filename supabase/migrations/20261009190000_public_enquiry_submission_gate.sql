-- 2.2.2 candidate. Deploy/configure submit-enquiry before the staging cutover.
-- No production execution is requested. Existing staff SELECT/UPDATE is retained.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

create table public.enquiry_submission_limits (
  scope text not null check (scope in ('global_minute', 'global_hour', 'email_hour')),
  subject_hash text not null check (subject_hash = 'global' or subject_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  submissions integer not null check (submissions >= 0),
  primary key (scope, subject_hash, window_start)
);
alter table public.enquiry_submission_limits enable row level security;
alter table public.enquiry_submission_limits force row level security;
-- The function owner can maintain its own counters even under FORCE RLS.
create policy enquiry_gate_owner on public.enquiry_submission_limits
  for all to current_user using (true) with check (true);
revoke all on public.enquiry_submission_limits from public, anon, authenticated, service_role;

create function public.submit_verified_public_enquiry(p_submission jsonb, p_email_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set lock_timeout = '3s'
as $gate$
declare
  v_now timestamptz;
  v_limit record;
  v_count integer;
  v_field text;
  v_name text;
  v_email text;
  v_message text;
  v_country_name text;
  v_country_code text;
  v_type text;
begin
  if p_submission is null or pg_catalog.jsonb_typeof(p_submission) <> 'object' or
     p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid contact submission';
  end if;
  if exists (select 1 from pg_catalog.jsonb_object_keys(p_submission) k
             where k <> all (array['full_name','email','message','country_name','country_code','enquiry_type'])) then
    raise exception using errcode = '22023', message = 'Invalid contact fields';
  end if;
  foreach v_field in array array['full_name','email','message','country_name','country_code','enquiry_type'] loop
    if pg_catalog.jsonb_typeof(p_submission -> v_field) is distinct from 'string' then
      raise exception using errcode = '22023', message = 'Invalid contact fields';
    end if;
  end loop;
  v_name := pg_catalog.btrim(p_submission ->> 'full_name');
  v_email := pg_catalog.lower(pg_catalog.btrim(p_submission ->> 'email'));
  v_message := pg_catalog.btrim(p_submission ->> 'message');
  v_country_name := pg_catalog.btrim(p_submission ->> 'country_name');
  v_country_code := pg_catalog.upper(pg_catalog.btrim(p_submission ->> 'country_code'));
  v_type := p_submission ->> 'enquiry_type';
  if pg_catalog.char_length(v_name) not between 2 and 120 or
     pg_catalog.char_length(v_email) not between 5 and 254 or
     v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or
     pg_catalog.char_length(v_message) not between 10 and 5000 or
     pg_catalog.char_length(v_country_name) not between 2 and 100 or
     v_country_code !~ '^[A-Z]{2}$' or
     v_type <> all (array['support','sales','subscription_renewal','setup_help','country_availability','partnership']) then
    raise exception using errcode = '22023', message = 'Invalid contact values';
  end if;

  -- One dedicated transaction lock serializes the small contact queue. Every
  -- counter check/increment and the enquiry insert commit or roll back together.
  perform pg_catalog.pg_advisory_xact_lock(20261009, 2202);
  v_now := pg_catalog.clock_timestamp();
  delete from public.enquiry_submission_limits where window_start < v_now - interval '2 hours';
  for v_limit in
    select * from (values
      ('global_minute'::text, 'global'::text, pg_catalog.to_timestamp(pg_catalog.floor(pg_catalog.date_part('epoch', v_now) / 60) * 60), 60, 10),
      ('global_hour'::text, 'global'::text, pg_catalog.to_timestamp(pg_catalog.floor(pg_catalog.date_part('epoch', v_now) / 3600) * 3600), 3600, 60),
      ('email_hour'::text, p_email_hash, pg_catalog.to_timestamp(pg_catalog.floor(pg_catalog.date_part('epoch', v_now) / 3600) * 3600), 3600, 3)
    ) as limits(scope, subject_hash, window_start, seconds, maximum)
  loop
    select submissions into v_count from public.enquiry_submission_limits
      where scope = v_limit.scope and subject_hash = v_limit.subject_hash and window_start = v_limit.window_start;
    if coalesce(v_count, 0) >= v_limit.maximum then
      return pg_catalog.jsonb_build_object('accepted', false, 'retry_after_seconds',
        greatest(1, pg_catalog.ceil(pg_catalog.date_part('epoch',
          (v_limit.window_start + v_limit.seconds * interval '1 second' - v_now)))::integer));
    end if;
  end loop;
  insert into public.enquiry_submission_limits as existing(scope, subject_hash, window_start, submissions)
    values
      ('global_minute', 'global', pg_catalog.to_timestamp(pg_catalog.floor(pg_catalog.date_part('epoch', v_now) / 60) * 60), 1),
      ('global_hour', 'global', pg_catalog.to_timestamp(pg_catalog.floor(pg_catalog.date_part('epoch', v_now) / 3600) * 3600), 1),
      ('email_hour', p_email_hash, pg_catalog.to_timestamp(pg_catalog.floor(pg_catalog.date_part('epoch', v_now) / 3600) * 3600), 1)
    on conflict (scope, subject_hash, window_start) do update set submissions = existing.submissions + 1;
  insert into public.enquiries(full_name, email, message, country_name, country_code, enquiry_type,
                               status, source, user_id, handled_by, handled_at)
    values(v_name, v_email, v_message, v_country_name, v_country_code, v_type,
           'new', 'website', null, null, null);
  return pg_catalog.jsonb_build_object('accepted', true);
end;
$gate$;
revoke all on function public.submit_verified_public_enquiry(jsonb, text) from public, anon, authenticated;
grant execute on function public.submit_verified_public_enquiry(jsonb, text) to service_role;

-- Table-level REVOKE does not remove the six existing column INSERT grants.
revoke insert on public.enquiries from public, anon, authenticated;
do $revoke_columns$
declare v_columns text;
begin
  select pg_catalog.string_agg(pg_catalog.quote_ident(attname), ', ' order by attnum) into v_columns
    from pg_catalog.pg_attribute where attrelid = 'public.enquiries'::regclass and attnum > 0 and not attisdropped;
  execute pg_catalog.format('revoke insert (%s) on public.enquiries from public, anon, authenticated', v_columns);
end;
$revoke_columns$;
drop policy if exists "Public can submit enquiries" on public.enquiries;

do $check_gate$
declare v_role text;
begin
  foreach v_role in array array['anon','authenticated'] loop
    if pg_catalog.has_any_column_privilege(v_role, 'public.enquiries', 'INSERT') or
       pg_catalog.has_function_privilege(v_role, 'public.submit_verified_public_enquiry(jsonb,text)', 'EXECUTE') or
       pg_catalog.has_table_privilege(v_role, 'public.enquiry_submission_limits', 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'Contact gate effective permissions failed for %', v_role;
    end if;
  end loop;
  if not pg_catalog.has_function_privilege('service_role', 'public.submit_verified_public_enquiry(jsonb,text)', 'EXECUTE') then
    raise exception 'Contact gate service execution is missing';
  end if;
end;
$check_gate$;
notify pgrst, 'reload schema';
commit;
