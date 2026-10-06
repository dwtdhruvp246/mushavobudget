-- Read-only metadata/invariants; no function bodies, auth identities or tokens returned.
with checks(check_no, check_name, passed) as (
  select 1, 'Business invitation notification foreign key', exists (
    select 1 from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey)
    where c.conrelid='public.notifications'::regclass and c.confrelid='public.workspace_invitations'::regclass
      and c.contype='f' and c.confdeltype='c' and a.attname='business_invitation_id')
  union all select 2, 'One notification per Business invitation', exists (
    select 1 from pg_index i join pg_class c on c.oid=i.indexrelid
    where c.relname='notifications_business_invitation_unique' and i.indrelid='public.notifications'::regclass
      and i.indisunique and i.indisvalid and pg_get_expr(i.indpred,i.indrelid) ~* 'business_invitation_id IS NOT NULL')
  union all select 3, 'Server notification writer has protected definition', exists (
    select 1 from pg_proc where oid=to_regprocedure('public.sync_business_invitation_notification()')
      and prosecdef and 'search_path=public, pg_temp'=any(proconfig))
  union all select 4, 'Client metadata guard retains caller authority', exists (
    select 1 from pg_proc where oid=to_regprocedure('public.guard_business_invitation_notification()')
      and not prosecdef and 'search_path=public, pg_temp'=any(proconfig))
  union all select 5, 'Both invitation notification triggers are enabled', (
    select count(*)=2 from pg_trigger where not tgisinternal and tgenabled in ('O','A')
      and ((tgrelid='public.workspace_invitations'::regclass and tgname='sync_business_invitation_notification_trigger'
            and tgfoid=to_regprocedure('public.sync_business_invitation_notification()'))
        or (tgrelid='public.notifications'::regclass and tgname='guard_business_invitation_notification_trigger'
            and tgfoid=to_regprocedure('public.guard_business_invitation_notification()'))))
  union all select 6, 'Anonymous and signed-in direct helper execution is disabled', coalesce((
    select bool_and(not has_function_privilege(r.role_name,p.oid,'EXECUTE'))
    from pg_proc p cross join (values('anon'),('authenticated')) r(role_name)
    where p.oid in (to_regprocedure('public.sync_business_invitation_notification()'),
      to_regprocedure('public.guard_business_invitation_notification()'))),false)
    and to_regprocedure('public.sync_business_invitation_notification()') is not null
    and to_regprocedure('public.guard_business_invitation_notification()') is not null
  union all select 7, 'Every active pending Business request has its recipient notification', not exists (
    select 1 from public.workspace_invitations i join public.budget_workspaces w on w.id=i.workspace_id
    where w.workspace_type='business' and i.status='pending' and (i.expires_at is null or i.expires_at>now())
      and not exists (select 1 from public.notifications n where n.business_invitation_id=i.id
        and n.workspace_id=i.workspace_id and lower(n.email)=lower(i.invitee_email)))
  union all select 8, 'Resolved requests have no actionable notification link', not exists (
    select 1 from public.notifications n join public.workspace_invitations i on i.id=n.business_invitation_id
    where i.status<>'pending' and n.url is not null)
)
select lpad(check_no::text,2,'0') || ' ' || check_name as check_name,
  case when passed then 'PASS' else 'FAIL' end as status
from checks order by check_no;
