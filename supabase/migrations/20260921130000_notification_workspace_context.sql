-- Stage 3: attach every relevant notification to its workspace and preserve
-- that context through privacy-aware Web Push and safe click routes.

begin;

alter table public.notifications
  add column if not exists workspace_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_workspace_id_fkey'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_workspace_id_fkey
      foreign key (workspace_id) references public.budget_workspaces(id) on delete set null;
  end if;
end;
$$;

create index if not exists notifications_workspace_created_idx
on public.notifications(workspace_id, created_at desc);

create or replace function public.set_notification_workspace_context()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment_item_id uuid;
begin
  if new.workspace_id is null and new.family_id is not null then
    select workspaces.id into new.workspace_id
    from public.budget_workspaces as workspaces
    where workspaces.legacy_family_id = new.family_id;
  end if;

  if new.workspace_id is null
     and coalesce(new.url, '') ~ 'payment_item=[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
  then
    v_payment_item_id := substring(new.url from 'payment_item=([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})')::uuid;
    select items.workspace_id into new.workspace_id
    from public.payment_items as items
    where items.id = v_payment_item_id;
  end if;

  -- Subscription review notifications are inserted immediately after their
  -- review row in the same transaction. Resolve the reviewed payment without
  -- exposing a client-controlled workspace identifier.
  if new.workspace_id is null
     and new.type = 'subscription'
     and new.user_id is not null
     and new.created_by is not null
  then
    select payments.workspace_id into new.workspace_id
    from public.subscription_payment_reviews as reviews
    join public.subscription_payments as payments on payments.id = reviews.payment_id
    join public.budget_workspaces as workspaces
      on workspaces.id = payments.workspace_id
     and workspaces.owner_id = new.user_id
    where reviews.reviewer_id = new.created_by
      and reviews.xmin::text = pg_current_xact_id()::text
    order by reviews.created_at desc
    limit 1;
  end if;

  if new.workspace_id is not null and new.url is not null then
    if new.url like '#family/%' then
      new.url := format('/app.html?workspace=%s%s', new.workspace_id, new.url);
    elsif new.url ~ '^/app[.]html[?]source=push&payment_item='
          and new.url !~ '[?&]workspace=' then
      new.url := regexp_replace(
        new.url,
        '^/app[.]html[?]source=push&',
        format('/app.html?source=push&workspace=%s&', new.workspace_id)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists set_notification_workspace_context_trigger
on public.notifications;
create trigger set_notification_workspace_context_trigger
before insert or update of workspace_id, family_id, type, url
on public.notifications
for each row execute function public.set_notification_workspace_context();

update public.notifications as notifications
set workspace_id = workspaces.id
from public.budget_workspaces as workspaces
where notifications.workspace_id is null
  and notifications.family_id is not null
  and workspaces.legacy_family_id = notifications.family_id;

update public.notifications as notifications
set workspace_id = items.workspace_id
from public.payment_items as items
where notifications.workspace_id is null
  and coalesce(notifications.url, '') ~ 'payment_item=[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
  and items.id = substring(notifications.url from 'payment_item=([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})')::uuid;

update public.notifications as notifications
set workspace_id = (
  select payments.workspace_id
  from public.subscription_payment_reviews as reviews
  join public.subscription_payments as payments on payments.id = reviews.payment_id
  join public.budget_workspaces as workspaces
    on workspaces.id = payments.workspace_id
   and workspaces.owner_id = notifications.user_id
  where reviews.reviewer_id = notifications.created_by
    and abs(extract(epoch from (reviews.created_at - notifications.created_at))) <= 300
  order by abs(extract(epoch from (reviews.created_at - notifications.created_at)))
  limit 1
)
where notifications.workspace_id is null
  and notifications.type = 'subscription'
  and notifications.user_id is not null
  and notifications.created_by is not null;

update public.notifications
set url = format('/app.html?workspace=%s%s', workspace_id, url)
where workspace_id is not null
  and url like '#family/%';

update public.notifications
set url = regexp_replace(
  url,
  '^/app[.]html[?]source=push&',
  format('/app.html?source=push&workspace=%s&', workspace_id)
)
where workspace_id is not null
  and url ~ '^/app[.]html[?]source=push&payment_item='
  and url !~ '[?&]workspace=';

alter table public.notification_outbox
  drop constraint if exists notification_outbox_target_url_check;

create or replace function public.set_payment_outbox_workspace_context()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_type text;
  v_workspace_name text;
  v_detailed_previews boolean := false;
begin
  if new.source_type <> 'payment' then return new; end if;

  select workspaces.workspace_type, workspaces.name,
         coalesce(settings.detailed_notification_previews, false)
  into v_workspace_type, v_workspace_name, v_detailed_previews
  from public.budget_workspaces as workspaces
  left join public.workspace_settings as settings
    on settings.workspace_id = workspaces.id
  where workspaces.id = new.workspace_id;

  new.target_url := format(
    '/app.html?source=push&workspace=%s&payment_item=%s#family/payments',
    new.workspace_id,
    new.source_id
  );
  new.title := case
    when v_detailed_previews then left(
      case v_workspace_type
        when 'household' then 'Family'
        when 'business' then 'Business'
        else 'Personal'
      end || ' · ' || coalesce(nullif(btrim(v_workspace_name), ''), 'Workspace'),
      80
    )
    else 'Mushavo Budget'
  end;
  return new;
end;
$$;

drop trigger if exists set_payment_outbox_workspace_context_trigger
on public.notification_outbox;
create trigger set_payment_outbox_workspace_context_trigger
before insert or update of workspace_id, source_type, source_id, target_url, title
on public.notification_outbox
for each row execute function public.set_payment_outbox_workspace_context();

update public.notification_outbox as outbox
set
  target_url = format(
    '/app.html?source=push&workspace=%s&payment_item=%s#family/payments',
    outbox.workspace_id,
    outbox.source_id
  ),
  title = case
    when coalesce(settings.detailed_notification_previews, false) then left(
      case workspaces.workspace_type
        when 'household' then 'Family'
        when 'business' then 'Business'
        else 'Personal'
      end || ' · ' || coalesce(nullif(btrim(workspaces.name), ''), 'Workspace'),
      80
    )
    else 'Mushavo Budget'
  end
from public.budget_workspaces as workspaces
left join public.workspace_settings as settings
  on settings.workspace_id = workspaces.id
where outbox.workspace_id = workspaces.id
  and outbox.source_type = 'payment';

alter table public.notification_outbox
  add constraint notification_outbox_target_url_check
  check (
    char_length(target_url) between 1 and 500
    and target_url ~ '^/app[.]html[?]source=push&workspace=[0-9a-fA-F-]{36}&payment_item=[0-9a-fA-F-]{36}#family/payments$'
  );

alter table public.admin_notification_outbox
  drop constraint if exists admin_notification_outbox_target_url_check;

create or replace function public.set_admin_notification_workspace_context()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
begin
  if new.source_type <> 'subscription_payment_submitted' then return new; end if;

  select payments.workspace_id into v_workspace_id
  from public.subscription_payments as payments
  where payments.id = new.source_id;
  if v_workspace_id is null then return new; end if;

  new.target_url := format(
    '/app.html?source=push&notification_id=%s&workspace=%s&subscription_payment=%s#admin/finance',
    new.notification_id,
    v_workspace_id,
    new.source_id
  );
  return new;
end;
$$;

drop trigger if exists set_admin_notification_workspace_context_before_trigger
on public.admin_notification_outbox;
create trigger set_admin_notification_workspace_context_before_trigger
before insert or update of source_type, source_id, target_url
on public.admin_notification_outbox
for each row execute function public.set_admin_notification_workspace_context();

create or replace function public.link_admin_notification_workspace_context()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
begin
  if new.source_type <> 'subscription_payment_submitted' then return new; end if;
  select payments.workspace_id into v_workspace_id
  from public.subscription_payments as payments
  where payments.id = new.source_id;
  if v_workspace_id is null then return new; end if;

  update public.notifications
  set
    workspace_id = v_workspace_id,
    url = format(
      '/app.html?notification_id=%s&workspace=%s&subscription_payment=%s#admin/finance',
      new.notification_id,
      v_workspace_id,
      new.source_id
    )
  where id = new.notification_id;
  return new;
end;
$$;

drop trigger if exists link_admin_notification_workspace_context_trigger
on public.admin_notification_outbox;
create trigger link_admin_notification_workspace_context_trigger
after insert or update of source_type, source_id, notification_id
on public.admin_notification_outbox
for each row execute function public.link_admin_notification_workspace_context();

update public.admin_notification_outbox as outbox
set target_url = format(
  '/app.html?source=push&notification_id=%s&workspace=%s&subscription_payment=%s#admin/finance',
  outbox.notification_id,
  payments.workspace_id,
  outbox.source_id
)
from public.subscription_payments as payments
where outbox.source_type = 'subscription_payment_submitted'
  and payments.id = outbox.source_id;

update public.notifications as notifications
set
  workspace_id = payments.workspace_id,
  url = format(
    '/app.html?notification_id=%s&workspace=%s&subscription_payment=%s#admin/finance',
    notifications.id,
    payments.workspace_id,
    outbox.source_id
  )
from public.admin_notification_outbox as outbox
join public.subscription_payments as payments on payments.id = outbox.source_id
where outbox.notification_id = notifications.id
  and outbox.source_type = 'subscription_payment_submitted';

alter table public.admin_notification_outbox
  add constraint admin_notification_outbox_target_url_check
  check (
    target_url ~ '^/app[.]html[?]source=push&notification_id=[0-9a-fA-F-]{36}(&workspace=[0-9a-fA-F-]{36}&subscription_payment=[0-9a-fA-F-]{36})?#admin/(finance|support|enquiries)$'
  );

revoke all on function public.set_notification_workspace_context()
from public, anon, authenticated;
revoke all on function public.set_payment_outbox_workspace_context()
from public, anon, authenticated;
revoke all on function public.set_admin_notification_workspace_context()
from public, anon, authenticated;
revoke all on function public.link_admin_notification_workspace_context()
from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
