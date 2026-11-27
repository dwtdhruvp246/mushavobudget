-- FR.2.2 controlled staging candidate; not an automatic migration.
-- Run only in STAGING dczlddwbtgvfdujgcitb after the reviewed handoff.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
lock table public.payment_records in share row exclusive mode;

do $guard$
declare
  v_columns text[];
begin
  if not exists (select 1 from pg_roles where rolname = current_user and (rolsuper or rolbypassrls)) then
    raise exception 'BINDING_REQUIRES_PRIVILEGED_SQL_EDITOR';
  end if;
  if current_setting('session_replication_role') <> 'origin' then
    raise exception 'BINDING_REQUIRES_ORIGIN_REPLICATION_ROLE';
  end if;
  if exists (
    select 1 from pg_event_trigger
    where evtenabled in ('O','A')
      and (evttags is null or 'CREATE TRIGGER' = any(evttags))
  ) then
    raise exception 'UNREVIEWED_TRIGGER_DDL_EVENT_HOOK';
  end if;
  if (select relkind from pg_class where oid = 'public.payment_records'::regclass) <> 'r' then
    raise exception 'UNREVIEWED_PAYMENT_RECORD_RELATION';
  end if;
  if (select count(*) from (values
      ('sync_payment_record_workspace', '8f568f342d4e928b4c27437ba7f544e5'),
      ('guard_workspace_finance_write', '783883ce4af23615f768a0990b6f2478')
    ) as e(name, body_md5)
    join pg_proc p on p.pronamespace = 'public'::regnamespace
      and p.proname = e.name and p.pronargs = 0 and p.prokind = 'f'
    join pg_language l on l.oid = p.prolang
    where l.lanname = 'plpgsql' and p.prorettype = 'trigger'::regtype
      and p.prosecdef
      and p.proconfig = array['search_path=public, pg_temp']::text[]
      and md5(replace(p.prosrc, E'\r\n', E'\n')) = e.body_md5
  ) <> 2 then
    raise exception 'UNREVIEWED_PAYMENT_BINDING_FUNCTION';
  end if;
  if not exists (
    select 1 from pg_trigger t
    where t.tgrelid = 'public.payment_records'::regclass
      and t.tgname = 'sync_payment_record_workspace_trigger'
      and t.tgfoid = 'public.sync_payment_record_workspace()'::regprocedure
      and t.tgtype = 23 and t.tgenabled = 'O'
      and not t.tgisinternal and t.tgparentid = 0
      and t.tgconstraint = 0 and not t.tgdeferrable and not t.tginitdeferred
      and t.tgnargs = 0 and t.tgqual is null
      and t.tgoldtable is null and t.tgnewtable is null
  ) then
    raise exception 'UNREVIEWED_PAYMENT_BINDING_TRIGGER';
  end if;
  select array_agg(a.attname::text order by a.attname)
    into v_columns from pg_trigger t join pg_attribute a
      on a.attrelid = t.tgrelid and a.attnum = any(t.tgattr::smallint[])
    where t.tgrelid = 'public.payment_records'::regclass
      and t.tgname = 'sync_payment_record_workspace_trigger';
  if v_columns is distinct from array['payment_item_id']::text[]
     and v_columns is distinct from array['payment_item_id','workspace_id']::text[] then
    raise exception 'UNREVIEWED_PAYMENT_BINDING_COLUMNS';
  end if;
  if not exists (
    select 1 from pg_trigger t
    where t.tgrelid = 'public.payment_records'::regclass
      and t.tgname = 'guard_payment_record_write_trigger'
      and t.tgfoid = 'public.guard_workspace_finance_write()'::regprocedure
      and t.tgtype = 31 and t.tgenabled = 'O'
      and not t.tgisinternal and t.tgparentid = 0 and t.tgconstraint = 0
      and t.tgnargs = 0 and t.tgqual is null
      and cardinality(t.tgattr::smallint[]) = 0
  ) then
    raise exception 'UNREVIEWED_PAYMENT_FINANCE_GUARD_TRIGGER';
  end if;
end;
$guard$;

create or replace trigger sync_payment_record_workspace_trigger
before insert or update of payment_item_id, workspace_id on public.payment_records
for each row execute function public.sync_payment_record_workspace();

commit;

select jsonb_build_object(
  'stage_step', 'FR.2.2',
  'result', 'PREVENTIVE_BINDING_TRIGGER_INSTALLED_METADATA_NOT_API_ACCEPTANCE',
  'target_project', 'dczlddwbtgvfdujgcitb',
  'project_selection_independently_verified', false,
  'workspace_update_column_present', exists (
    select 1 from pg_trigger t join pg_attribute a
      on a.attrelid = t.tgrelid and a.attnum = any(t.tgattr::smallint[])
    where t.tgrelid = 'public.payment_records'::regclass
      and t.tgname = 'sync_payment_record_workspace_trigger'
      and a.attname = 'workspace_id'
  ),
  'existing_rows_or_conversions_rewritten_by_this_script', false,
  'functions_policies_grants_accounts_or_factors_changed', false,
  'hosted_authorization_acceptance', false,
  'findings_closed', '[]'::jsonb
) as binding_installation;
