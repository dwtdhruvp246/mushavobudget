-- Stage 0 follow-up: owner-supplied diagnostic 08 found anonymous SELECT on
-- these seven private tables. Run in SQL Editor as the administrative role.
-- This changes only SELECT grants. Existing rows, RLS, RPCs, write privileges,
-- public pricing/signup lookups and contact submission remain unchanged.
-- Existing effective authenticated/service_role reads are preserved, including
-- column-only grants. No new authenticated columns are made readable.
begin;

do $$
declare
  v_name text;
  v_table oid;
  v_saved jsonb;
  v_access jsonb;
begin
  if not exists(select 1 from pg_roles where rolname='anon')
    or not exists(select 1 from pg_roles where rolname='authenticated') then
    raise exception 'SECURITY_STAGE_0_API_ROLES_MISSING';
  end if;

  foreach v_name in array array['app_admins','payment_records','payments','profiles',
    'workspace_invitations','workspace_members','workspace_subscriptions'] loop
    select oid into v_table from pg_class where relnamespace=to_regnamespace('public')
      and relname=v_name and relkind in ('r','p') and relrowsecurity;
    if v_table is null then
      raise exception 'SECURITY_STAGE_0_TABLE_MISSING_OR_RLS_DISABLED: %',v_name;
    end if;

    -- PUBLIC may be the source of a valid signed-in/server read. Capture that
    -- effective access before revoking it; never grant beyond this snapshot.
    select jsonb_agg(jsonb_build_object('role',r.rolname,
      'table_select',has_table_privilege(r.oid,v_table,'SELECT'),
      'columns',(select string_agg(format('%I',a.attname),',' order by a.attnum)
        from pg_attribute a where a.attrelid=v_table and a.attnum>0 and not a.attisdropped
          and has_column_privilege(r.oid,v_table,a.attnum,'SELECT')))) into v_saved
    from pg_roles r where r.rolname in ('authenticated','service_role');

    -- RESTRICT (the default) avoids cascading into dependent grants. PostgreSQL
    -- also removes column SELECT grants for these grantees on table REVOKE.
    execute format('revoke select on table public.%I from public,anon restrict',v_name);
    for v_access in select value from jsonb_array_elements(v_saved) loop
      if (v_access->>'table_select')::boolean then
        execute format('grant select on table public.%I to %I',v_name,v_access->>'role');
      elsif v_access->>'columns' is not null then
        execute format('grant select (%s) on table public.%I to %I',
          v_access->>'columns',v_name,v_access->>'role');
      end if;
    end loop;

    -- A separate inherited role can still grant access. Abort the entire
    -- migration rather than changing role membership or claiming success.
    if has_any_column_privilege('anon',v_table,'SELECT') then
      raise exception 'SECURITY_STAGE_0_ANON_SELECT_STILL_INHERITED: %',v_name;
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
commit;
