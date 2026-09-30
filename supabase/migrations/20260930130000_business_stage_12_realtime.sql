begin;

-- Only a neutral change counter is published, never financial rows or receipts.
create table public.business_change_signals (
  workspace_id uuid primary key references public.budget_workspaces(id) on delete cascade,
  data_version bigint not null default 1 check(data_version>0),
  access_version bigint not null default 1 check(access_version>0),
  updated_at timestamptz not null default now()
);
alter table public.business_change_signals enable row level security;
alter table public.business_change_signals force row level security;
revoke all on public.business_change_signals from public,anon,authenticated;
grant select on public.business_change_signals to authenticated;
create function public.business_signal_member(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and not public.my_account_suspended() and exists(
    select 1 from public.workspace_members m join public.budget_workspaces w on w.id=m.workspace_id
    where m.workspace_id=p_workspace_id and m.user_id=auth.uid() and m.status='active'
      and w.workspace_type='business' and w.status<>'closed');
$$;
create policy business_signal_members_read on public.business_change_signals for select to authenticated
using(public.business_signal_member(workspace_id));

create function public.emit_business_change_signal(p_workspace_id uuid,p_access boolean default false)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.budget_workspaces where id=p_workspace_id and workspace_type='business') then return; end if;
  insert into public.business_change_signals(workspace_id) values(p_workspace_id)
  on conflict(workspace_id) do update set data_version=business_change_signals.data_version+1,
    access_version=business_change_signals.access_version+case when p_access then 1 else 0 end,updated_at=now();
end;
$$;
create function public.signal_business_row_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_workspace uuid;v_old uuid;v_access boolean:=tg_argv[0]='access';v_user uuid;
begin
  if tg_table_name='profiles' then
    for v_workspace in select distinct workspace_id from public.workspace_members where user_id=new.id and status='active'
      loop perform public.emit_business_change_signal(v_workspace,true); end loop;
  else
    if tg_op<>'DELETE' then v_workspace:=(to_jsonb(new)->>case when tg_table_name='budget_workspaces' then 'id' else 'workspace_id' end)::uuid; end if;
    if tg_op<>'INSERT' then v_old:=(to_jsonb(old)->>case when tg_table_name='budget_workspaces' then 'id' else 'workspace_id' end)::uuid; end if;
    perform public.emit_business_change_signal(coalesce(v_workspace,v_old),v_access);
    if v_old is not null and v_old is distinct from v_workspace and tg_op='UPDATE' then perform public.emit_business_change_signal(v_old,v_access); end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

insert into public.business_change_signals(workspace_id) select id from public.budget_workspaces where workspace_type='business';
do $$ declare t text;
begin
  foreach t in array array['budget_workspaces','workspace_subscriptions','workspace_members','workspace_settings',
    'business_profiles','business_role_permissions','business_member_permissions','business_member_scopes'] loop
    execute format('create trigger business_realtime_signal after insert or update or delete on public.%I for each row execute function public.signal_business_row_change(''access'')',t);
  end loop;
  foreach t in array array['workspace_invitations','business_categories','business_dimensions','business_documents',
    'business_setup_drafts','business_expense_claims','business_suppliers','business_bill_schedules','business_bills',
    'business_bill_payments','business_income_receipts','business_budgets','business_spending_requests','subscription_payments'] loop
    execute format('create trigger business_realtime_signal after insert or update or delete on public.%I for each row execute function public.signal_business_row_change(''data'')',t);
  end loop;
end $$;
create trigger business_realtime_account_signal after update of account_status on public.profiles
for each row when(old.account_status is distinct from new.account_status) execute function public.signal_business_row_change('access');

do $$ begin
  if not exists(select 1 from pg_publication where pubname='supabase_realtime') then raise exception 'SUPABASE_REALTIME_PUBLICATION_REQUIRED'; end if;
  if not exists(select 1 from pg_publication where pubname='supabase_realtime' and puballtables)
    and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='business_change_signals')
    then alter publication supabase_realtime add table public.business_change_signals; end if;
end $$;
revoke all on function public.business_signal_member(uuid),public.emit_business_change_signal(uuid,boolean),public.signal_business_row_change() from public,anon,authenticated;
grant execute on function public.business_signal_member(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
