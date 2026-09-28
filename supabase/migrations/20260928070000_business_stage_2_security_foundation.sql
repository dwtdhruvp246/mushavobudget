begin;

-- ============================================================================
-- Business Stage 2: database and security foundation
--
-- This migration deliberately does not open Business purchases or workspace
-- provisioning. It establishes workspace-scoped identity, permissions,
-- dimensions, categories, private documents, audit history, protected RPCs,
-- and RLS for later Business stages.
-- ============================================================================

alter table public.workspace_members
  drop constraint if exists workspace_members_role_check,
  add constraint workspace_members_role_check check (role in (
    'owner', 'family_head', 'family_member', 'business_owner',
    'business_admin', 'finance_manager', 'team_manager', 'staff',
    'contributor', 'viewer'
  ));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.workspace_members'::regclass
      and conname = 'workspace_members_workspace_id_id_key'
  ) then
    alter table public.workspace_members
      add constraint workspace_members_workspace_id_id_key unique (workspace_id, id);
  end if;
end $$;

create table if not exists public.business_permission_definitions (
  permission_code text primary key check (permission_code ~ '^[a-z][a-z0-9_.]{2,79}$'),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 100),
  description text not null default '',
  permission_group text not null check (permission_group in (
    'workspace', 'finance', 'approvals', 'budgets', 'team',
    'settings', 'documents', 'reports', 'audit', 'subscription'
  )),
  sensitive boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.business_permission_definitions
  (permission_code, display_name, description, permission_group, sensitive)
values
  ('workspace.view', 'Open workspace', 'Open this Business workspace.', 'workspace', false),
  ('profile.manage', 'Manage business profile', 'Edit Business identity and profile details.', 'settings', true),
  ('settings.manage', 'Manage workspace settings', 'Edit Business currencies, timezone and period settings.', 'settings', true),
  ('dimensions.view', 'View business dimensions', 'View teams, projects, branches and cost centres.', 'workspace', false),
  ('dimensions.manage', 'Manage business dimensions', 'Create, edit and archive teams, projects, branches and cost centres.', 'settings', true),
  ('categories.view', 'View business categories', 'View Business income and expense categories.', 'workspace', false),
  ('categories.manage', 'Manage business categories', 'Create, edit and archive Business categories.', 'settings', true),
  ('team.view', 'View team access', 'View Business members, roles and scope assignments.', 'team', true),
  ('team.manage', 'Manage team access', 'Manage delegated Business team access. Billing and ownership remain Owner-only.', 'team', true),
  ('finance.view_all', 'View all finance', 'View company-wide financial records and totals.', 'finance', true),
  ('finance.create', 'Create financial records', 'Create permitted Business financial records.', 'finance', true),
  ('finance.record_payment', 'Record payments', 'Record company payments and reimbursements.', 'finance', true),
  ('approvals.view', 'View approvals', 'View permitted requests and approval states.', 'approvals', true),
  ('approvals.review', 'Review approvals', 'Approve, reject or request changes within the permitted scope.', 'approvals', true),
  ('budgets.view', 'View budgets', 'View permitted Business budgets.', 'budgets', true),
  ('budgets.manage', 'Manage budgets', 'Create and update permitted Business budgets.', 'budgets', true),
  ('reports.view', 'View reports', 'View permitted Business reports.', 'reports', true),
  ('reports.export', 'Export reports', 'Export permitted Business reports.', 'reports', true),
  ('documents.view', 'View documents', 'View permitted private Business documents.', 'documents', true),
  ('documents.create', 'Upload documents', 'Upload and register permitted private Business documents.', 'documents', true),
  ('documents.manage', 'Manage documents', 'Archive and manage private Business documents.', 'documents', true),
  ('audit.view', 'View audit history', 'View the immutable Business audit history.', 'audit', true),
  ('subscription.view', 'View subscription', 'View Business subscription and billing history.', 'subscription', true),
  ('subscription.manage', 'Manage subscription', 'Owner-only Business plan and billing authority.', 'subscription', true)
on conflict (permission_code) do update
set display_name = excluded.display_name,
    description = excluded.description,
    permission_group = excluded.permission_group,
    sensitive = excluded.sensitive;

create table if not exists public.business_profiles (
  workspace_id uuid primary key references public.budget_workspaces(id) on delete cascade,
  legal_name text,
  trading_name text,
  industry text,
  registration_country text check (registration_country is null or registration_country ~ '^[A-Z]{2}$'),
  registration_number text,
  tax_number text,
  contact_email text,
  contact_phone text,
  website text,
  address jsonb not null default '{}'::jsonb check (
    jsonb_typeof(address) = 'object' and octet_length(address::text) <= 5000
  ),
  logo_storage_path text,
  financial_year_start_month smallint not null default 1 check (financial_year_start_month between 1 and 12),
  period_start_day smallint not null default 1 check (period_start_day between 1 and 28),
  onboarding_status text not null default 'not_started' check (
    onboarding_status in ('not_started', 'in_progress', 'complete')
  ),
  version integer not null default 1 check (version > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_role_permissions (
  workspace_id uuid not null references public.budget_workspaces(id) on delete cascade,
  role text not null check (role in (
    'business_admin', 'finance_manager', 'team_manager', 'staff', 'contributor', 'viewer'
  )),
  permission_code text not null references public.business_permission_definitions(permission_code) on delete restrict,
  enabled boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, role, permission_code)
);

create table if not exists public.business_member_permissions (
  workspace_id uuid not null references public.budget_workspaces(id) on delete cascade,
  member_id uuid not null,
  permission_code text not null references public.business_permission_definitions(permission_code) on delete restrict,
  effect text not null check (effect in ('allow', 'deny')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, member_id, permission_code),
  constraint business_member_permissions_member_fk
    foreign key (workspace_id, member_id)
    references public.workspace_members(workspace_id, id) on delete cascade
);

create table if not exists public.business_dimensions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.budget_workspaces(id) on delete cascade,
  dimension_type text not null check (dimension_type in ('team', 'project', 'branch', 'cost_centre')),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  code text check (code is null or code ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$'),
  description text not null default '' check (char_length(description) <= 1000),
  parent_id uuid,
  status text not null default 'active' check (status in ('active', 'archived')),
  version integer not null default 1 check (version > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  constraint business_dimensions_parent_not_self check (parent_id is null or parent_id <> id),
  constraint business_dimensions_parent_fk
    foreign key (workspace_id, parent_id)
    references public.business_dimensions(workspace_id, id) on delete restrict
);

create unique index if not exists business_dimensions_active_name_idx
on public.business_dimensions(workspace_id, dimension_type, lower(name))
where status = 'active';

create unique index if not exists business_dimensions_active_code_idx
on public.business_dimensions(workspace_id, dimension_type, lower(code))
where status = 'active' and code is not null;

create table if not exists public.business_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.budget_workspaces(id) on delete cascade,
  category_type text not null check (category_type in ('income', 'expense', 'both')),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  code text check (code is null or code ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$'),
  description text not null default '' check (char_length(description) <= 1000),
  colour text check (colour is null or colour ~ '^#[0-9A-Fa-f]{6}$'),
  is_system_default boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived')),
  version integer not null default 1 check (version > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create unique index if not exists business_categories_active_name_idx
on public.business_categories(workspace_id, category_type, lower(name))
where status = 'active';

create unique index if not exists business_categories_active_code_idx
on public.business_categories(workspace_id, lower(code))
where status = 'active' and code is not null;

create table if not exists public.business_member_scopes (
  workspace_id uuid not null references public.budget_workspaces(id) on delete cascade,
  member_id uuid not null,
  dimension_id uuid not null,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, member_id, dimension_id),
  constraint business_member_scopes_member_fk
    foreign key (workspace_id, member_id)
    references public.workspace_members(workspace_id, id) on delete cascade,
  constraint business_member_scopes_dimension_fk
    foreign key (workspace_id, dimension_id)
    references public.business_dimensions(workspace_id, id) on delete cascade
);

create table if not exists public.business_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.budget_workspaces(id) on delete cascade,
  parent_type text not null check (parent_type in ('workspace', 'profile', 'dimension', 'category')),
  parent_id uuid not null,
  storage_path text not null unique,
  original_name text not null check (char_length(btrim(original_name)) between 1 and 255),
  mime_type text not null check (mime_type in (
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
    'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'active' check (status in ('active', 'archived')),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null
);

create index if not exists business_documents_parent_idx
on public.business_documents(workspace_id, parent_type, parent_id, created_at desc);

create table if not exists public.business_audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.budget_workspaces(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action ~ '^[a-z][a-z0-9_.]{2,119}$'),
  target_type text not null check (target_type ~ '^[a-z][a-z0-9_]{1,79}$'),
  target_id uuid,
  before_summary jsonb not null default '{}'::jsonb check (
    jsonb_typeof(before_summary) = 'object' and octet_length(before_summary::text) <= 20000
  ),
  after_summary jsonb not null default '{}'::jsonb check (
    jsonb_typeof(after_summary) = 'object' and octet_length(after_summary::text) <= 20000
  ),
  reason text check (reason is null or char_length(reason) <= 1000),
  request_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists business_audit_workspace_idx
on public.business_audit_events(workspace_id, created_at desc);

create unique index if not exists business_audit_request_action_idx
on public.business_audit_events(workspace_id, request_id, action)
where request_id is not null;

create or replace function public.business_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.business_touch_versioned_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

drop trigger if exists business_profiles_touch_updated_at on public.business_profiles;
create trigger business_profiles_touch_updated_at
before update on public.business_profiles
for each row execute function public.business_touch_versioned_updated_at();

drop trigger if exists business_role_permissions_touch_updated_at on public.business_role_permissions;
create trigger business_role_permissions_touch_updated_at
before update on public.business_role_permissions
for each row execute function public.business_touch_updated_at();

drop trigger if exists business_member_permissions_touch_updated_at on public.business_member_permissions;
create trigger business_member_permissions_touch_updated_at
before update on public.business_member_permissions
for each row execute function public.business_touch_updated_at();

drop trigger if exists business_dimensions_touch_updated_at on public.business_dimensions;
create trigger business_dimensions_touch_updated_at
before update on public.business_dimensions
for each row execute function public.business_touch_versioned_updated_at();

drop trigger if exists business_categories_touch_updated_at on public.business_categories;
create trigger business_categories_touch_updated_at
before update on public.business_categories
for each row execute function public.business_touch_versioned_updated_at();

create or replace function public.require_business_workspace_row()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
begin
  v_workspace_id := case when tg_op = 'DELETE' then old.workspace_id else new.workspace_id end;
  if tg_op = 'UPDATE' and old.workspace_id is distinct from new.workspace_id then
    raise exception 'BUSINESS_WORKSPACE_IMMUTABLE';
  end if;
  if not exists (
    select 1 from public.budget_workspaces
    where id = v_workspace_id and workspace_type = 'business' and status <> 'closed'
  ) then
    raise exception 'BUSINESS_WORKSPACE_REQUIRED';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'business_profiles', 'business_role_permissions', 'business_member_permissions',
    'business_dimensions', 'business_categories', 'business_member_scopes',
    'business_documents', 'business_audit_events'
  ] loop
    execute format('drop trigger if exists require_business_workspace_row_trigger on public.%I', v_table);
    execute format(
      'create trigger require_business_workspace_row_trigger before insert or update of workspace_id on public.%I for each row execute function public.require_business_workspace_row()',
      v_table
    );
  end loop;
end $$;

create or replace function public.enforce_business_member_role_compatibility()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_type text;
begin
  select workspace_type into v_workspace_type
  from public.budget_workspaces where id = new.workspace_id;
  if v_workspace_type = 'business' and new.role not in (
    'business_owner', 'business_admin', 'finance_manager',
    'team_manager', 'staff', 'contributor', 'viewer'
  ) then
    raise exception 'INVALID_BUSINESS_ROLE';
  elsif v_workspace_type = 'household' and new.role not in ('owner', 'family_head', 'family_member') then
    raise exception 'INVALID_HOUSEHOLD_ROLE';
  elsif v_workspace_type = 'personal' and new.role <> 'owner' then
    raise exception 'INVALID_PERSONAL_ROLE';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_business_member_role_compatibility_trigger on public.workspace_members;
create trigger enforce_business_member_role_compatibility_trigger
before insert or update of workspace_id, role on public.workspace_members
for each row execute function public.enforce_business_member_role_compatibility();

create or replace function public.validate_business_document_parent()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.parent_type in ('workspace', 'profile') then
    if new.parent_id <> new.workspace_id then raise exception 'BUSINESS_DOCUMENT_PARENT_MISMATCH'; end if;
  elsif new.parent_type = 'dimension' then
    if not exists (
      select 1 from public.business_dimensions
      where id = new.parent_id and workspace_id = new.workspace_id
    ) then raise exception 'BUSINESS_DOCUMENT_PARENT_MISMATCH'; end if;
  elsif new.parent_type = 'category' then
    if not exists (
      select 1 from public.business_categories
      where id = new.parent_id and workspace_id = new.workspace_id
    ) then raise exception 'BUSINESS_DOCUMENT_PARENT_MISMATCH'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_business_document_parent_trigger on public.business_documents;
create trigger validate_business_document_parent_trigger
before insert or update of workspace_id, parent_type, parent_id on public.business_documents
for each row execute function public.validate_business_document_parent();

create or replace function public.prevent_business_audit_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'BUSINESS_AUDIT_IMMUTABLE';
end;
$$;

drop trigger if exists prevent_business_audit_mutation_trigger on public.business_audit_events;
create trigger prevent_business_audit_mutation_trigger
before update or delete on public.business_audit_events
for each row execute function public.prevent_business_audit_mutation();

create or replace function public.is_business_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and not public.my_account_suspended()
    and exists (
      select 1
      from public.budget_workspaces as workspaces
      join public.workspace_members as members on members.workspace_id = workspaces.id
      where workspaces.id = p_workspace_id
        and workspaces.workspace_type = 'business'
        and workspaces.status = 'active'
        and members.user_id = auth.uid()
        and members.status = 'active'
    );
$$;

create or replace function public.business_has_permission(
  p_workspace_id uuid,
  p_permission_code text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.workspace_members%rowtype;
  v_effect text;
begin
  if auth.uid() is null or public.my_account_suspended() then return false; end if;
  if not exists (
    select 1 from public.business_permission_definitions
    where permission_code = p_permission_code
  ) then return false; end if;
  if not exists (
    select 1 from public.budget_workspaces
    where id = p_workspace_id and workspace_type = 'business' and status = 'active'
  ) then return false; end if;

  select * into v_member
  from public.workspace_members
  where workspace_id = p_workspace_id
    and user_id = auth.uid()
    and status = 'active';
  if not found then return false; end if;

  if exists (
    select 1 from public.budget_workspaces
    where id = p_workspace_id and owner_id = auth.uid()
  ) then return true; end if;

  select effect into v_effect
  from public.business_member_permissions
  where workspace_id = p_workspace_id
    and member_id = v_member.id
    and permission_code = p_permission_code;
  if v_effect = 'deny' then return false; end if;
  if v_effect = 'allow' then return true; end if;

  return exists (
    select 1 from public.business_role_permissions
    where workspace_id = p_workspace_id
      and role = v_member.role
      and permission_code = p_permission_code
      and enabled
  );
end;
$$;

create or replace function public.business_effective_permissions(p_workspace_id uuid)
returns table (permission_code text, allowed boolean, source text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with current_member as (
    select members.id, members.role
    from public.workspace_members as members
    where members.workspace_id = p_workspace_id
      and members.user_id = auth.uid()
      and members.status = 'active'
  ), permission_rows as (
    select definitions.permission_code,
      public.business_has_permission(p_workspace_id, definitions.permission_code) as allowed,
      case
        when exists (
          select 1 from public.budget_workspaces
          where id = p_workspace_id and owner_id = auth.uid()
        ) then 'owner'
        when exists (
          select 1 from current_member
          join public.business_member_permissions as overrides
            on overrides.workspace_id = p_workspace_id
           and overrides.member_id = current_member.id
           and overrides.permission_code = definitions.permission_code
        ) then 'member_override'
        else 'role'
      end as source
    from public.business_permission_definitions as definitions
  )
  select permission_rows.permission_code, permission_rows.allowed, permission_rows.source
  from permission_rows
  where public.is_business_workspace_member(p_workspace_id)
  order by permission_rows.permission_code;
$$;

create or replace function public.business_record_audit_event(
  p_workspace_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_before_summary jsonb default '{}'::jsonb,
  p_after_summary jsonb default '{}'::jsonb,
  p_reason text default null,
  p_request_id uuid default null,
  p_actor_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
begin
  insert into public.business_audit_events (
    workspace_id, actor_id, action, target_type, target_id,
    before_summary, after_summary, reason, request_id
  ) values (
    p_workspace_id, coalesce(p_actor_id, auth.uid()), p_action, p_target_type, p_target_id,
    coalesce(p_before_summary, '{}'::jsonb), coalesce(p_after_summary, '{}'::jsonb),
    nullif(btrim(p_reason), ''), p_request_id
  )
  on conflict (workspace_id, request_id, action) where request_id is not null
  do update set request_id = excluded.request_id
  returning id into v_event_id;
  return v_event_id;
end;
$$;

create or replace function public.seed_business_workspace_foundation(
  p_workspace_id uuid,
  p_actor_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace public.budget_workspaces%rowtype;
begin
  select * into v_workspace from public.budget_workspaces
  where id = p_workspace_id and workspace_type = 'business';
  if not found then raise exception 'BUSINESS_WORKSPACE_REQUIRED'; end if;

  insert into public.business_profiles (workspace_id, trading_name, created_by)
  values (p_workspace_id, v_workspace.name, coalesce(p_actor_id, v_workspace.owner_id))
  on conflict (workspace_id) do nothing;

  insert into public.business_role_permissions
    (workspace_id, role, permission_code, enabled, granted_by)
  select p_workspace_id, defaults.role, defaults.permission_code, true,
         coalesce(p_actor_id, v_workspace.owner_id)
  from (values
    ('business_admin', 'workspace.view'),
    ('business_admin', 'profile.manage'),
    ('business_admin', 'settings.manage'),
    ('business_admin', 'dimensions.view'),
    ('business_admin', 'dimensions.manage'),
    ('business_admin', 'categories.view'),
    ('business_admin', 'categories.manage'),
    ('business_admin', 'team.view'),
    ('business_admin', 'finance.view_all'),
    ('business_admin', 'finance.create'),
    ('business_admin', 'finance.record_payment'),
    ('business_admin', 'approvals.view'),
    ('business_admin', 'approvals.review'),
    ('business_admin', 'budgets.view'),
    ('business_admin', 'budgets.manage'),
    ('business_admin', 'reports.view'),
    ('business_admin', 'reports.export'),
    ('business_admin', 'documents.view'),
    ('business_admin', 'documents.create'),
    ('business_admin', 'documents.manage'),
    ('business_admin', 'audit.view'),
    ('business_admin', 'subscription.view'),
    ('finance_manager', 'workspace.view'),
    ('finance_manager', 'dimensions.view'),
    ('finance_manager', 'categories.view'),
    ('finance_manager', 'finance.view_all'),
    ('finance_manager', 'finance.create'),
    ('finance_manager', 'finance.record_payment'),
    ('finance_manager', 'approvals.view'),
    ('finance_manager', 'approvals.review'),
    ('finance_manager', 'budgets.view'),
    ('finance_manager', 'budgets.manage'),
    ('finance_manager', 'reports.view'),
    ('finance_manager', 'reports.export'),
    ('finance_manager', 'documents.view'),
    ('finance_manager', 'documents.create'),
    ('finance_manager', 'documents.manage'),
    ('finance_manager', 'audit.view'),
    ('finance_manager', 'subscription.view'),
    ('team_manager', 'workspace.view'),
    ('team_manager', 'dimensions.view'),
    ('team_manager', 'categories.view'),
    ('team_manager', 'finance.create'),
    ('team_manager', 'approvals.view'),
    ('team_manager', 'approvals.review'),
    ('team_manager', 'budgets.view'),
    ('team_manager', 'reports.view'),
    ('team_manager', 'documents.view'),
    ('team_manager', 'documents.create'),
    ('staff', 'workspace.view'),
    ('staff', 'dimensions.view'),
    ('staff', 'categories.view'),
    ('staff', 'finance.create'),
    ('staff', 'approvals.view'),
    ('staff', 'documents.view'),
    ('staff', 'documents.create'),
    ('contributor', 'workspace.view'),
    ('contributor', 'dimensions.view'),
    ('contributor', 'categories.view'),
    ('contributor', 'finance.create'),
    ('contributor', 'approvals.view'),
    ('contributor', 'documents.view'),
    ('contributor', 'documents.create'),
    ('viewer', 'workspace.view'),
    ('viewer', 'dimensions.view'),
    ('viewer', 'categories.view'),
    ('viewer', 'reports.view'),
    ('viewer', 'documents.view')
  ) as defaults(role, permission_code)
  on conflict (workspace_id, role, permission_code) do nothing;

  insert into public.business_categories (
    workspace_id, category_type, name, code, is_system_default, created_by
  )
  select p_workspace_id, defaults.category_type, defaults.name, defaults.code, true,
         coalesce(p_actor_id, v_workspace.owner_id)
  from (values
    ('income', 'Sales income', 'SALES'),
    ('income', 'Other income', 'OTHER_INCOME'),
    ('expense', 'Rent & premises', 'RENT'),
    ('expense', 'Utilities', 'UTILITIES'),
    ('expense', 'Transport', 'TRANSPORT'),
    ('expense', 'Supplies', 'SUPPLIES'),
    ('expense', 'Marketing', 'MARKETING'),
    ('expense', 'Professional services', 'PRO_SERVICES'),
    ('expense', 'Staff costs', 'STAFF_COSTS'),
    ('expense', 'Other expense', 'OTHER_EXPENSE')
  ) as defaults(category_type, name, code)
  where not exists (
    select 1 from public.business_categories as categories
    where categories.workspace_id = p_workspace_id
      and lower(categories.code) = lower(defaults.code)
  );

  if not exists (
    select 1 from public.business_audit_events
    where workspace_id = p_workspace_id
      and action = 'business.foundation_created'
      and target_id = p_workspace_id
  ) then
    perform public.business_record_audit_event(
      p_workspace_id, 'business.foundation_created', 'workspace', p_workspace_id,
      '{}'::jsonb, jsonb_build_object('stage', 2), null, null,
      coalesce(p_actor_id, v_workspace.owner_id)
    );
  end if;
end;
$$;

create or replace function public.initialize_business_workspace_foundation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.workspace_type = 'business' and (tg_op = 'INSERT' or old.workspace_type is distinct from new.workspace_type) then
    perform public.seed_business_workspace_foundation(new.id, new.owner_id);
  end if;
  return new;
end;
$$;

drop trigger if exists initialize_business_workspace_foundation_trigger on public.budget_workspaces;
create trigger initialize_business_workspace_foundation_trigger
after insert or update of workspace_type on public.budget_workspaces
for each row execute function public.initialize_business_workspace_foundation();

do $$
declare
  v_workspace_id uuid;
  v_owner_id uuid;
begin
  for v_workspace_id, v_owner_id in
    select id, owner_id from public.budget_workspaces where workspace_type = 'business'
  loop
    perform public.seed_business_workspace_foundation(v_workspace_id, v_owner_id);
  end loop;
end $$;

-- Platform staff are not automatically Business members. This restrictive
-- policy prevents the older generalized helper from exposing Business settings
-- while leaving Personal and Household behaviour unchanged.
drop policy if exists "Business settings require active membership" on public.workspace_settings;
create policy "Business settings require active membership"
on public.workspace_settings as restrictive for select to authenticated
using (
  not exists (
    select 1 from public.budget_workspaces
    where id = workspace_settings.workspace_id and workspace_type = 'business'
  )
  or public.is_business_workspace_member(workspace_id)
);

drop policy if exists "Business settings updates require active membership" on public.workspace_settings;
create policy "Business settings updates require active membership"
on public.workspace_settings as restrictive for update to authenticated
using (
  not exists (
    select 1 from public.budget_workspaces
    where id = workspace_settings.workspace_id and workspace_type = 'business'
  )
  or public.business_has_permission(workspace_id, 'settings.manage')
)
with check (
  not exists (
    select 1 from public.budget_workspaces
    where id = workspace_settings.workspace_id and workspace_type = 'business'
  )
  or public.business_has_permission(workspace_id, 'settings.manage')
);

-- The shared membership table predates Business and its generalized helper
-- deliberately lets platform staff support Personal and Family workspaces.
-- Business membership is operating data, so it requires actual membership.
drop policy if exists "Business membership requires active membership" on public.workspace_members;
create policy "Business membership requires active membership"
on public.workspace_members as restrictive for select to authenticated
using (
  not exists (
    select 1 from public.budget_workspaces
    where id = workspace_members.workspace_id and workspace_type = 'business'
  )
  or public.is_business_workspace_member(workspace_id)
);

-- Business membership changes will be exposed only through protected RPCs in
-- the team-provisioning stage. Existing Personal and Family writes are intact.
drop policy if exists "Business membership inserts require protected RPC" on public.workspace_members;
create policy "Business membership inserts require protected RPC"
on public.workspace_members as restrictive for insert to authenticated
with check (
  not exists (
    select 1 from public.budget_workspaces
    where id = workspace_members.workspace_id and workspace_type = 'business'
  )
);

drop policy if exists "Business membership updates require protected RPC" on public.workspace_members;
create policy "Business membership updates require protected RPC"
on public.workspace_members as restrictive for update to authenticated
using (
  not exists (
    select 1 from public.budget_workspaces
    where id = workspace_members.workspace_id and workspace_type = 'business'
  )
)
with check (
  not exists (
    select 1 from public.budget_workspaces
    where id = workspace_members.workspace_id and workspace_type = 'business'
  )
);

drop policy if exists "Business membership deletes require protected RPC" on public.workspace_members;
create policy "Business membership deletes require protected RPC"
on public.workspace_members as restrictive for delete to authenticated
using (
  not exists (
    select 1 from public.budget_workspaces
    where id = workspace_members.workspace_id and workspace_type = 'business'
  )
);

alter table public.business_permission_definitions enable row level security;
alter table public.business_profiles enable row level security;
alter table public.business_role_permissions enable row level security;
alter table public.business_member_permissions enable row level security;
alter table public.business_dimensions enable row level security;
alter table public.business_categories enable row level security;
alter table public.business_member_scopes enable row level security;
alter table public.business_documents enable row level security;
alter table public.business_audit_events enable row level security;

drop policy if exists "Authenticated users can read Business permission definitions" on public.business_permission_definitions;
create policy "Authenticated users can read Business permission definitions"
on public.business_permission_definitions for select to authenticated
using (not public.my_account_suspended());

drop policy if exists "Business members can read profile" on public.business_profiles;
create policy "Business members can read profile" on public.business_profiles for select to authenticated
using (public.business_has_permission(workspace_id, 'workspace.view'));

drop policy if exists "Business members can read role permissions" on public.business_role_permissions;
create policy "Business members can read role permissions" on public.business_role_permissions for select to authenticated
using (public.is_business_workspace_member(workspace_id));

drop policy if exists "Business members can read permitted member overrides" on public.business_member_permissions;
create policy "Business members can read permitted member overrides"
on public.business_member_permissions for select to authenticated
using (
  public.business_has_permission(workspace_id, 'team.view')
  or exists (
    select 1 from public.workspace_members
    where id = business_member_permissions.member_id
      and workspace_id = business_member_permissions.workspace_id
      and user_id = auth.uid()
      and status = 'active'
  )
);

drop policy if exists "Business members can read dimensions" on public.business_dimensions;
create policy "Business members can read dimensions" on public.business_dimensions for select to authenticated
using (public.business_has_permission(workspace_id, 'dimensions.view'));

drop policy if exists "Business members can read categories" on public.business_categories;
create policy "Business members can read categories" on public.business_categories for select to authenticated
using (public.business_has_permission(workspace_id, 'categories.view'));

drop policy if exists "Business members can read permitted scopes" on public.business_member_scopes;
create policy "Business members can read permitted scopes" on public.business_member_scopes for select to authenticated
using (
  public.business_has_permission(workspace_id, 'team.view')
  or exists (
    select 1 from public.workspace_members
    where id = business_member_scopes.member_id
      and workspace_id = business_member_scopes.workspace_id
      and user_id = auth.uid()
      and status = 'active'
  )
);

drop policy if exists "Business members can read documents" on public.business_documents;
create policy "Business members can read documents" on public.business_documents for select to authenticated
using (status = 'active' and public.business_has_permission(workspace_id, 'documents.view'));

drop policy if exists "Authorized Business members can read audit history" on public.business_audit_events;
create policy "Authorized Business members can read audit history"
on public.business_audit_events for select to authenticated
using (public.business_has_permission(workspace_id, 'audit.view'));

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'business_profiles', 'business_role_permissions', 'business_member_permissions',
    'business_dimensions', 'business_categories', 'business_member_scopes',
    'business_documents', 'business_audit_events'
  ] loop
    execute format('drop policy if exists "Account must be active" on public.%I', v_table);
    execute format(
      'create policy "Account must be active" on public.%I as restrictive for all to authenticated using (not public.my_account_suspended()) with check (not public.my_account_suspended())',
      v_table
    );
    execute format('drop trigger if exists guard_suspended_account_write_trigger on public.%I', v_table);
    execute format(
      'create trigger guard_suspended_account_write_trigger before insert or update or delete on public.%I for each row execute function public.guard_suspended_account_write()',
      v_table
    );
  end loop;
end $$;

revoke all on table public.business_permission_definitions from public, anon, authenticated;
revoke all on table public.business_profiles from public, anon, authenticated;
revoke all on table public.business_role_permissions from public, anon, authenticated;
revoke all on table public.business_member_permissions from public, anon, authenticated;
revoke all on table public.business_dimensions from public, anon, authenticated;
revoke all on table public.business_categories from public, anon, authenticated;
revoke all on table public.business_member_scopes from public, anon, authenticated;
revoke all on table public.business_documents from public, anon, authenticated;
revoke all on table public.business_audit_events from public, anon, authenticated;

grant select on table public.business_permission_definitions to authenticated;
grant select on table public.business_profiles to authenticated;
grant select on table public.business_role_permissions to authenticated;
grant select on table public.business_member_permissions to authenticated;
grant select on table public.business_dimensions to authenticated;
grant select on table public.business_categories to authenticated;
grant select on table public.business_member_scopes to authenticated;
grant select on table public.business_documents to authenticated;
grant select on table public.business_audit_events to authenticated;

create or replace function public.save_business_profile(
  p_workspace_id uuid,
  p_legal_name text,
  p_trading_name text,
  p_industry text,
  p_registration_country text,
  p_registration_number text,
  p_tax_number text,
  p_contact_email text,
  p_contact_phone text,
  p_website text,
  p_address jsonb,
  p_financial_year_start_month integer,
  p_period_start_day integer,
  p_onboarding_status text,
  p_expected_version integer
)
returns public.business_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.business_profiles%rowtype;
  v_result public.business_profiles%rowtype;
  v_trading_name text := nullif(btrim(p_trading_name), '');
begin
  if not public.business_has_permission(p_workspace_id, 'profile.manage') then
    raise exception 'BUSINESS_PROFILE_ACCESS_REQUIRED';
  end if;
  if v_trading_name is null or char_length(v_trading_name) > 120 then
    raise exception 'INVALID_BUSINESS_TRADING_NAME';
  end if;
  if p_financial_year_start_month not between 1 and 12
     or p_period_start_day not between 1 and 28
     or p_onboarding_status not in ('not_started', 'in_progress', 'complete') then
    raise exception 'INVALID_BUSINESS_PROFILE_SETTINGS';
  end if;
  if coalesce(jsonb_typeof(p_address), 'object') <> 'object'
     or octet_length(coalesce(p_address, '{}'::jsonb)::text) > 5000 then
    raise exception 'INVALID_BUSINESS_ADDRESS';
  end if;

  select * into v_before from public.business_profiles
  where workspace_id = p_workspace_id for update;
  if found and p_expected_version is not null and v_before.version <> p_expected_version then
    raise exception 'BUSINESS_PROFILE_CHANGED';
  end if;

  insert into public.business_profiles (
    workspace_id, legal_name, trading_name, industry, registration_country,
    registration_number, tax_number, contact_email, contact_phone, website,
    address, financial_year_start_month, period_start_day, onboarding_status,
    created_by
  ) values (
    p_workspace_id, nullif(btrim(p_legal_name), ''), v_trading_name,
    nullif(btrim(p_industry), ''), nullif(upper(btrim(p_registration_country)), ''),
    nullif(btrim(p_registration_number), ''), nullif(btrim(p_tax_number), ''),
    nullif(lower(btrim(p_contact_email)), ''), nullif(btrim(p_contact_phone), ''),
    nullif(btrim(p_website), ''), coalesce(p_address, '{}'::jsonb),
    p_financial_year_start_month, p_period_start_day, p_onboarding_status, auth.uid()
  )
  on conflict (workspace_id) do update
  set legal_name = excluded.legal_name,
      trading_name = excluded.trading_name,
      industry = excluded.industry,
      registration_country = excluded.registration_country,
      registration_number = excluded.registration_number,
      tax_number = excluded.tax_number,
      contact_email = excluded.contact_email,
      contact_phone = excluded.contact_phone,
      website = excluded.website,
      address = excluded.address,
      financial_year_start_month = excluded.financial_year_start_month,
      period_start_day = excluded.period_start_day,
      onboarding_status = excluded.onboarding_status
  returning * into v_result;

  update public.budget_workspaces
  set name = v_trading_name, updated_at = now()
  where id = p_workspace_id;

  perform public.business_record_audit_event(
    p_workspace_id, 'business.profile_saved', 'business_profile', p_workspace_id,
    case when v_before.workspace_id is null then '{}'::jsonb else jsonb_build_object(
      'trading_name', v_before.trading_name,
      'industry', v_before.industry,
      'financial_year_start_month', v_before.financial_year_start_month,
      'period_start_day', v_before.period_start_day,
      'onboarding_status', v_before.onboarding_status,
      'version', v_before.version
    ) end,
    jsonb_build_object(
      'trading_name', v_result.trading_name,
      'industry', v_result.industry,
      'financial_year_start_month', v_result.financial_year_start_month,
      'period_start_day', v_result.period_start_day,
      'onboarding_status', v_result.onboarding_status,
      'version', v_result.version
    )
  );
  return v_result;
end;
$$;

create or replace function public.save_business_dimension(
  p_workspace_id uuid,
  p_dimension_id uuid,
  p_dimension_type text,
  p_name text,
  p_code text,
  p_description text,
  p_parent_id uuid,
  p_status text,
  p_expected_version integer
)
returns public.business_dimensions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.business_dimensions%rowtype;
  v_result public.business_dimensions%rowtype;
begin
  if not public.business_has_permission(p_workspace_id, 'dimensions.manage') then
    raise exception 'BUSINESS_DIMENSIONS_ACCESS_REQUIRED';
  end if;
  if p_dimension_type not in ('team', 'project', 'branch', 'cost_centre')
     or p_status not in ('active', 'archived')
     or nullif(btrim(p_name), '') is null then
    raise exception 'INVALID_BUSINESS_DIMENSION';
  end if;
  if p_parent_id is not null and not exists (
    select 1 from public.business_dimensions
    where id = p_parent_id and workspace_id = p_workspace_id
      and dimension_type = p_dimension_type and status = 'active'
  ) then raise exception 'BUSINESS_DIMENSION_PARENT_MISMATCH'; end if;

  if p_dimension_id is null then
    insert into public.business_dimensions (
      workspace_id, dimension_type, name, code, description, parent_id, status, created_by
    ) values (
      p_workspace_id, p_dimension_type, btrim(p_name), nullif(upper(btrim(p_code)), ''),
      coalesce(btrim(p_description), ''), p_parent_id, p_status, auth.uid()
    ) returning * into v_result;
  else
    select * into v_before from public.business_dimensions
    where id = p_dimension_id and workspace_id = p_workspace_id for update;
    if not found then raise exception 'BUSINESS_DIMENSION_NOT_FOUND'; end if;
    if p_expected_version is not null and v_before.version <> p_expected_version then
      raise exception 'BUSINESS_DIMENSION_CHANGED';
    end if;
    update public.business_dimensions
    set dimension_type = p_dimension_type,
        name = btrim(p_name),
        code = nullif(upper(btrim(p_code)), ''),
        description = coalesce(btrim(p_description), ''),
        parent_id = p_parent_id,
        status = p_status
    where id = p_dimension_id and workspace_id = p_workspace_id
    returning * into v_result;
  end if;

  perform public.business_record_audit_event(
    p_workspace_id,
    case when p_dimension_id is null then 'business.dimension_created' else 'business.dimension_saved' end,
    'business_dimension', v_result.id,
    case when v_before.id is null then '{}'::jsonb else jsonb_build_object(
      'type', v_before.dimension_type, 'name', v_before.name, 'code', v_before.code,
      'parent_id', v_before.parent_id, 'status', v_before.status, 'version', v_before.version
    ) end,
    jsonb_build_object(
      'type', v_result.dimension_type, 'name', v_result.name, 'code', v_result.code,
      'parent_id', v_result.parent_id, 'status', v_result.status, 'version', v_result.version
    )
  );
  return v_result;
end;
$$;

create or replace function public.save_business_category(
  p_workspace_id uuid,
  p_category_id uuid,
  p_category_type text,
  p_name text,
  p_code text,
  p_description text,
  p_colour text,
  p_status text,
  p_expected_version integer
)
returns public.business_categories
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.business_categories%rowtype;
  v_result public.business_categories%rowtype;
begin
  if not public.business_has_permission(p_workspace_id, 'categories.manage') then
    raise exception 'BUSINESS_CATEGORIES_ACCESS_REQUIRED';
  end if;
  if p_category_type not in ('income', 'expense', 'both')
     or p_status not in ('active', 'archived')
     or nullif(btrim(p_name), '') is null then
    raise exception 'INVALID_BUSINESS_CATEGORY';
  end if;

  if p_category_id is null then
    insert into public.business_categories (
      workspace_id, category_type, name, code, description, colour, status, created_by
    ) values (
      p_workspace_id, p_category_type, btrim(p_name), nullif(upper(btrim(p_code)), ''),
      coalesce(btrim(p_description), ''), nullif(upper(btrim(p_colour)), ''), p_status, auth.uid()
    ) returning * into v_result;
  else
    select * into v_before from public.business_categories
    where id = p_category_id and workspace_id = p_workspace_id for update;
    if not found then raise exception 'BUSINESS_CATEGORY_NOT_FOUND'; end if;
    if p_expected_version is not null and v_before.version <> p_expected_version then
      raise exception 'BUSINESS_CATEGORY_CHANGED';
    end if;
    update public.business_categories
    set category_type = p_category_type,
        name = btrim(p_name),
        code = nullif(upper(btrim(p_code)), ''),
        description = coalesce(btrim(p_description), ''),
        colour = nullif(upper(btrim(p_colour)), ''),
        status = p_status
    where id = p_category_id and workspace_id = p_workspace_id
    returning * into v_result;
  end if;

  perform public.business_record_audit_event(
    p_workspace_id,
    case when p_category_id is null then 'business.category_created' else 'business.category_saved' end,
    'business_category', v_result.id,
    case when v_before.id is null then '{}'::jsonb else jsonb_build_object(
      'type', v_before.category_type, 'name', v_before.name, 'code', v_before.code,
      'status', v_before.status, 'version', v_before.version
    ) end,
    jsonb_build_object(
      'type', v_result.category_type, 'name', v_result.name, 'code', v_result.code,
      'status', v_result.status, 'version', v_result.version
    )
  );
  return v_result;
end;
$$;

create or replace function public.set_business_role_permission(
  p_workspace_id uuid,
  p_role text,
  p_permission_code text,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.my_account_suspended() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if not public.is_business_workspace_member(p_workspace_id) or not exists (
    select 1 from public.budget_workspaces
    where id = p_workspace_id and workspace_type = 'business'
      and status = 'active' and owner_id = auth.uid()
  ) then raise exception 'BUSINESS_OWNER_REQUIRED'; end if;
  if p_role not in ('business_admin', 'finance_manager', 'team_manager', 'staff', 'contributor', 'viewer')
     or not exists (
       select 1 from public.business_permission_definitions
       where permission_code = p_permission_code
     )
     or p_permission_code = 'subscription.manage' then
    raise exception 'INVALID_BUSINESS_ROLE_PERMISSION';
  end if;

  insert into public.business_role_permissions (
    workspace_id, role, permission_code, enabled, granted_by
  ) values (p_workspace_id, p_role, p_permission_code, coalesce(p_enabled, false), auth.uid())
  on conflict (workspace_id, role, permission_code) do update
  set enabled = excluded.enabled, granted_by = excluded.granted_by;

  perform public.business_record_audit_event(
    p_workspace_id, 'business.role_permission_changed', 'business_role_permission', null,
    '{}'::jsonb,
    jsonb_build_object('role', p_role, 'permission_code', p_permission_code, 'enabled', coalesce(p_enabled, false))
  );
end;
$$;

create or replace function public.set_business_member_permission(
  p_workspace_id uuid,
  p_member_id uuid,
  p_permission_code text,
  p_effect text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.workspace_members%rowtype;
begin
  if public.my_account_suspended() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if not public.is_business_workspace_member(p_workspace_id) or not exists (
    select 1 from public.budget_workspaces
    where id = p_workspace_id and workspace_type = 'business'
      and status = 'active' and owner_id = auth.uid()
  ) then raise exception 'BUSINESS_OWNER_REQUIRED'; end if;
  select * into v_member from public.workspace_members
  where id = p_member_id and workspace_id = p_workspace_id and status = 'active';
  if not found or v_member.role = 'business_owner' then raise exception 'INVALID_BUSINESS_MEMBER'; end if;
  if not exists (
    select 1 from public.business_permission_definitions
    where permission_code = p_permission_code
  ) or p_permission_code = 'subscription.manage' then
    raise exception 'INVALID_BUSINESS_PERMISSION';
  end if;

  if p_effect is null then
    delete from public.business_member_permissions
    where workspace_id = p_workspace_id and member_id = p_member_id
      and permission_code = p_permission_code;
  elsif p_effect in ('allow', 'deny') then
    insert into public.business_member_permissions (
      workspace_id, member_id, permission_code, effect, granted_by
    ) values (p_workspace_id, p_member_id, p_permission_code, p_effect, auth.uid())
    on conflict (workspace_id, member_id, permission_code) do update
    set effect = excluded.effect, granted_by = excluded.granted_by;
  else
    raise exception 'INVALID_BUSINESS_PERMISSION_EFFECT';
  end if;

  perform public.business_record_audit_event(
    p_workspace_id, 'business.member_permission_changed', 'workspace_member', p_member_id,
    '{}'::jsonb,
    jsonb_build_object('permission_code', p_permission_code, 'effect', p_effect)
  );
end;
$$;

create or replace function public.assign_business_member_scope(
  p_workspace_id uuid,
  p_member_id uuid,
  p_dimension_id uuid,
  p_assigned boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.business_has_permission(p_workspace_id, 'team.manage') then
    raise exception 'BUSINESS_TEAM_ACCESS_REQUIRED';
  end if;
  if not exists (
    select 1 from public.workspace_members
    where id = p_member_id and workspace_id = p_workspace_id and status = 'active'
  ) or not exists (
    select 1 from public.business_dimensions
    where id = p_dimension_id and workspace_id = p_workspace_id and status = 'active'
  ) then raise exception 'BUSINESS_SCOPE_MISMATCH'; end if;

  if coalesce(p_assigned, false) then
    insert into public.business_member_scopes (workspace_id, member_id, dimension_id, assigned_by)
    values (p_workspace_id, p_member_id, p_dimension_id, auth.uid())
    on conflict (workspace_id, member_id, dimension_id) do nothing;
  else
    delete from public.business_member_scopes
    where workspace_id = p_workspace_id and member_id = p_member_id
      and dimension_id = p_dimension_id;
  end if;

  perform public.business_record_audit_event(
    p_workspace_id, 'business.member_scope_changed', 'workspace_member', p_member_id,
    '{}'::jsonb,
    jsonb_build_object('dimension_id', p_dimension_id, 'assigned', coalesce(p_assigned, false))
  );
end;
$$;

create or replace function public.register_business_document(
  p_document_id uuid,
  p_workspace_id uuid,
  p_parent_type text,
  p_parent_id uuid,
  p_storage_path text,
  p_original_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_checksum_sha256 text default null
)
returns public.business_documents
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_result public.business_documents%rowtype;
  v_object_mime text;
  v_object_size bigint;
begin
  if not public.business_has_permission(p_workspace_id, 'documents.create') then
    raise exception 'BUSINESS_DOCUMENT_ACCESS_REQUIRED';
  end if;
  if p_document_id is null
     or p_storage_path is null
     or p_storage_path like '%..%'
     or p_storage_path not like (
       'workspaces/' || p_workspace_id::text || '/' || auth.uid()::text || '/' ||
       p_document_id::text || '/%'
     ) then
    raise exception 'INVALID_BUSINESS_DOCUMENT_PATH';
  end if;

  select metadata ->> 'mimetype', nullif(metadata ->> 'size', '')::bigint
  into v_object_mime, v_object_size
  from storage.objects
  where bucket_id = 'business-documents' and name = p_storage_path;
  if not found then raise exception 'BUSINESS_DOCUMENT_UPLOAD_NOT_FOUND'; end if;
  if coalesce(v_object_mime, p_mime_type) <> p_mime_type
     or coalesce(v_object_size, p_size_bytes) <> p_size_bytes then
    raise exception 'BUSINESS_DOCUMENT_METADATA_MISMATCH';
  end if;

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
    '{}'::jsonb,
    jsonb_build_object(
      'parent_type', v_result.parent_type,
      'parent_id', v_result.parent_id,
      'mime_type', v_result.mime_type,
      'size_bytes', v_result.size_bytes
    )
  );
  return v_result;
end;
$$;

create or replace function public.archive_business_document(
  p_workspace_id uuid,
  p_document_id uuid,
  p_reason text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_document public.business_documents%rowtype;
begin
  if not public.business_has_permission(p_workspace_id, 'documents.manage') then
    raise exception 'BUSINESS_DOCUMENT_MANAGE_REQUIRED';
  end if;
  update public.business_documents
  set status = 'archived', archived_at = now(), archived_by = auth.uid()
  where id = p_document_id and workspace_id = p_workspace_id and status = 'active'
  returning * into v_document;
  if not found then raise exception 'BUSINESS_DOCUMENT_NOT_FOUND'; end if;

  perform public.business_record_audit_event(
    p_workspace_id, 'business.document_archived', 'business_document', p_document_id,
    jsonb_build_object('status', 'active'), jsonb_build_object('status', 'archived'), p_reason
  );
  return v_document.storage_path;
end;
$$;

-- Business currency settings use the same workspace_settings table, but the
-- Business permission model replaces the old broad role-name shortcut.
create or replace function public.save_workspace_currency_settings(
  p_workspace_id uuid,
  p_default_payment_currency text,
  p_enabled_currencies text[],
  p_reporting_currency text,
  p_conversion_enabled boolean
)
returns public.workspace_settings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_default text := upper(btrim(p_default_payment_currency));
  v_reporting text := upper(btrim(p_reporting_currency));
  v_enabled text[];
  v_result public.workspace_settings%rowtype;
  v_can_manage boolean := false;
  v_workspace_type text;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select workspace_type into v_workspace_type
  from public.budget_workspaces where id = p_workspace_id;
  if v_workspace_type = 'business' then
    v_can_manage := public.business_has_permission(p_workspace_id, 'settings.manage');
  else
    select public.is_workspace_owner(p_workspace_id)
      or exists (
        select 1 from public.workspace_members
        where workspace_id = p_workspace_id and user_id = auth.uid() and status = 'active'
          and role in ('business_owner', 'business_admin', 'finance_manager')
      ) into v_can_manage;
  end if;
  if not v_can_manage then raise exception 'CURRENCY_SETTINGS_ACCESS_REQUIRED'; end if;

  select array_agg(distinct upper(btrim(code)) order by upper(btrim(code)))
  into v_enabled from unnest(coalesce(p_enabled_currencies, array[]::text[])) as code;
  if v_enabled is null or cardinality(v_enabled) = 0 or cardinality(v_enabled) > 160 then
    raise exception 'INVALID_ENABLED_CURRENCIES';
  end if;
  if not (v_default = any(v_enabled)) or not (v_reporting = any(v_enabled)) then
    raise exception 'DEFAULT_AND_REPORTING_CURRENCY_MUST_BE_ENABLED';
  end if;
  if exists (
    select 1 from unnest(v_enabled) as requested(code)
    left join public.supported_currencies
      on supported_currencies.code = requested.code and supported_currencies.is_active
    where supported_currencies.code is null
  ) then raise exception 'UNSUPPORTED_CURRENCY'; end if;

  insert into public.workspace_settings (
    workspace_id, base_currency, default_payment_currency, enabled_currencies,
    reporting_currency, conversion_enabled, updated_at
  ) values (
    p_workspace_id, v_reporting, v_default, v_enabled,
    v_reporting, coalesce(p_conversion_enabled, false), now()
  )
  on conflict (workspace_id) do update
  set base_currency = excluded.base_currency,
      default_payment_currency = excluded.default_payment_currency,
      enabled_currencies = excluded.enabled_currencies,
      reporting_currency = excluded.reporting_currency,
      conversion_enabled = excluded.conversion_enabled,
      updated_at = now()
  returning * into v_result;

  if v_workspace_type = 'business' then
    perform public.business_record_audit_event(
      p_workspace_id, 'business.currency_settings_saved', 'workspace_settings', p_workspace_id,
      '{}'::jsonb,
      jsonb_build_object(
        'default_payment_currency', v_result.default_payment_currency,
        'enabled_currencies', v_result.enabled_currencies,
        'reporting_currency', v_result.reporting_currency,
        'conversion_enabled', v_result.conversion_enabled
      )
    );
  end if;
  return v_result;
end;
$$;

create or replace function public.business_storage_workspace_id(p_name text)
returns uuid
language sql
immutable
set search_path = public, storage, pg_temp
as $$
  select case
    when (storage.foldername(p_name))[1] = 'workspaces'
     and (storage.foldername(p_name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then ((storage.foldername(p_name))[2])::uuid
    else null
  end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-documents', 'business-documents', false, 10485760,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
    'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Business members can upload private documents" on storage.objects;
create policy "Business members can upload private documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'business-documents'
  and public.business_storage_workspace_id(name) is not null
  and (storage.foldername(name))[3] = auth.uid()::text
  and public.business_has_permission(
    public.business_storage_workspace_id(name), 'documents.create'
  )
);

drop policy if exists "Business members can read registered private documents" on storage.objects;
create policy "Business members can read registered private documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'business-documents'
  and exists (
    select 1 from public.business_documents as documents
    where documents.storage_path = storage.objects.name
      and documents.workspace_id = public.business_storage_workspace_id(storage.objects.name)
      and documents.status = 'active'
      and public.business_has_permission(documents.workspace_id, 'documents.view')
  )
);

drop policy if exists "Business members can delete archived or unregistered private documents" on storage.objects;
create policy "Business members can delete archived or unregistered private documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'business-documents'
  and public.business_storage_workspace_id(name) is not null
  and (
    (
      public.business_has_permission(
        public.business_storage_workspace_id(name), 'documents.manage'
      )
      and not exists (
        select 1 from public.business_documents
        where business_documents.storage_path = storage.objects.name
          and business_documents.status = 'active'
      )
    )
    or (
      (storage.foldername(name))[3] = auth.uid()::text
      and public.business_has_permission(
        public.business_storage_workspace_id(name), 'documents.create'
      )
      and not exists (
        select 1 from public.business_documents
        where business_documents.storage_path = storage.objects.name
      )
    )
  )
);

revoke all on function public.is_business_workspace_member(uuid) from public, anon;
revoke all on function public.business_has_permission(uuid, text) from public, anon;
revoke all on function public.business_effective_permissions(uuid) from public, anon;
revoke all on function public.business_storage_workspace_id(text) from public, anon;
revoke all on function public.save_business_profile(uuid, text, text, text, text, text, text, text, text, text, jsonb, integer, integer, text, integer) from public, anon;
revoke all on function public.save_business_dimension(uuid, uuid, text, text, text, text, uuid, text, integer) from public, anon;
revoke all on function public.save_business_category(uuid, uuid, text, text, text, text, text, text, integer) from public, anon;
revoke all on function public.set_business_role_permission(uuid, text, text, boolean) from public, anon;
revoke all on function public.set_business_member_permission(uuid, uuid, text, text) from public, anon;
revoke all on function public.assign_business_member_scope(uuid, uuid, uuid, boolean) from public, anon;
revoke all on function public.register_business_document(uuid, uuid, text, uuid, text, text, text, bigint, text) from public, anon;
revoke all on function public.archive_business_document(uuid, uuid, text) from public, anon;

grant execute on function public.is_business_workspace_member(uuid) to authenticated;
grant execute on function public.business_has_permission(uuid, text) to authenticated;
grant execute on function public.business_effective_permissions(uuid) to authenticated;
grant execute on function public.business_storage_workspace_id(text) to authenticated;
grant execute on function public.save_business_profile(uuid, text, text, text, text, text, text, text, text, text, jsonb, integer, integer, text, integer) to authenticated;
grant execute on function public.save_business_dimension(uuid, uuid, text, text, text, text, uuid, text, integer) to authenticated;
grant execute on function public.save_business_category(uuid, uuid, text, text, text, text, text, text, integer) to authenticated;
grant execute on function public.set_business_role_permission(uuid, text, text, boolean) to authenticated;
grant execute on function public.set_business_member_permission(uuid, uuid, text, text) to authenticated;
grant execute on function public.assign_business_member_scope(uuid, uuid, uuid, boolean) to authenticated;
grant execute on function public.register_business_document(uuid, uuid, text, uuid, text, text, text, bigint, text) to authenticated;
grant execute on function public.archive_business_document(uuid, uuid, text) to authenticated;

revoke all on function public.business_record_audit_event(uuid, text, text, uuid, jsonb, jsonb, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.seed_business_workspace_foundation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.initialize_business_workspace_foundation() from public, anon, authenticated;
revoke all on function public.require_business_workspace_row() from public, anon, authenticated;
revoke all on function public.validate_business_document_parent() from public, anon, authenticated;
revoke all on function public.prevent_business_audit_mutation() from public, anon, authenticated;
revoke all on function public.business_touch_updated_at() from public, anon, authenticated;
revoke all on function public.business_touch_versioned_updated_at() from public, anon, authenticated;

do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables = true
     ) then
    foreach v_table in array array[
      'business_profiles', 'business_role_permissions', 'business_member_permissions',
      'business_dimensions', 'business_categories', 'business_member_scopes'
    ] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public' and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
