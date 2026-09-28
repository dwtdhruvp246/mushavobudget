import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260928070000_business_stage_2_security_foundation.sql", import.meta.url),
  "utf8"
);
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const diagnostic = readFileSync(
  new URL("../supabase/diagnostics/business_stage_2_security_diagnostic.sql", import.meta.url),
  "utf8"
);
const launchLock = readFileSync(
  new URL("../supabase/migrations/20260927183000_business_stage_0_launch_lock.sql", import.meta.url),
  "utf8"
);

const scopedTables = [
  "business_profiles",
  "business_role_permissions",
  "business_member_permissions",
  "business_dimensions",
  "business_categories",
  "business_member_scopes",
  "business_documents",
  "business_audit_events"
];

test("Stage 2 creates the complete workspace-scoped Business foundation", () => {
  assert.match(migration, /create table if not exists public\.business_permission_definitions/);
  for (const table of scopedTables) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  }
  assert.match(migration, /dimension_type text not null check \(dimension_type in \('team', 'project', 'branch', 'cost_centre'\)\)/);
  assert.match(migration, /business_member_permissions_member_fk[\s\S]*?foreign key \(workspace_id, member_id\)/);
  assert.match(migration, /business_member_scopes_dimension_fk[\s\S]*?foreign key \(workspace_id, dimension_id\)/);
  assert.match(migration, /BUSINESS_WORKSPACE_IMMUTABLE/);
  assert.match(migration, /BUSINESS_WORKSPACE_REQUIRED/);
});

test("Business access requires real membership and explicit permissions", () => {
  const membership = migration.slice(
    migration.indexOf("create or replace function public.is_business_workspace_member"),
    migration.indexOf("create or replace function public.business_has_permission")
  );
  assert.match(membership, /members\.user_id = auth\.uid\(\)/);
  assert.match(membership, /members\.status = 'active'/);
  assert.match(membership, /workspaces\.workspace_type = 'business'/);
  assert.doesNotMatch(membership, /is_platform_staff/);

  const permission = migration.slice(
    migration.indexOf("create or replace function public.business_has_permission"),
    migration.indexOf("create or replace function public.business_effective_permissions")
  );
  assert.ok(permission.indexOf("select * into v_member") < permission.indexOf("owner_id = auth.uid()"));
  assert.ok(permission.indexOf("v_effect = 'deny'") < permission.indexOf("v_effect = 'allow'"));
  assert.match(permission, /business_role_permissions/);
  assert.doesNotMatch(permission, /is_platform_staff/);
  assert.match(migration, /Business membership requires active membership/);
  assert.match(migration, /Business membership inserts require protected RPC/);
  assert.match(migration, /Business membership updates require protected RPC/);
  assert.match(migration, /Business membership deletes require protected RPC/);
});

test("roles preserve the approved billing and finance boundaries", () => {
  assert.match(migration, /\('subscription\.manage', 'Manage subscription'/);
  assert.match(migration, /p_permission_code = 'subscription\.manage'/);
  assert.doesNotMatch(migration, /\('business_admin', 'subscription\.manage'\)/);
  assert.doesNotMatch(migration, /\('finance_manager', 'subscription\.manage'\)/);
  assert.doesNotMatch(migration, /\('staff', 'finance\.view_all'\)/);
  assert.doesNotMatch(migration, /\('business_admin', 'team\.manage'\)/);
  assert.doesNotMatch(migration, /\('viewer', 'audit\.view'\)/);
  assert.match(migration, /set_business_member_permission/);
  assert.match(migration, /effect text not null check \(effect in \('allow', 'deny'\)\)/);
});

test("Business writes are protected RPC-only operations", () => {
  for (const table of scopedTables) {
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`));
    assert.match(migration, new RegExp(`grant select on table public\\.${table} to authenticated`));
  }
  for (const rpc of [
    "save_business_profile",
    "save_business_dimension",
    "save_business_category",
    "set_business_role_permission",
    "set_business_member_permission",
    "assign_business_member_scope",
    "register_business_document",
    "archive_business_document"
  ]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${rpc}`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${rpc}`));
  }
  assert.match(migration, /revoke all on function public\.business_record_audit_event[\s\S]*?from public, anon, authenticated/);
  assert.match(migration, /if public\.my_account_suspended\(\) then raise exception 'ACCOUNT_SUSPENDED'/);
});

test("RLS, immutable audits, and private document storage are enforced", () => {
  for (const table of scopedTables) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(migration, /create trigger prevent_business_audit_mutation_trigger[\s\S]*?before update or delete/);
  assert.match(migration, /raise exception 'BUSINESS_AUDIT_IMMUTABLE'/);
  assert.match(migration, /'business-documents', 'business-documents', false, 10485760/);
  assert.match(migration, /Business members can read registered private documents/);
  assert.match(migration, /documents\.status = 'active'/);
  assert.match(migration, /p_storage_path not like \([\s\S]*?p_workspace_id::text[\s\S]*?auth\.uid\(\)::text/);
});

test("Stage 2 is included in the consolidated schema and keeps Stage 0 closed", () => {
  for (const marker of [
    "create table if not exists public.business_profiles",
    "create or replace function public.business_has_permission",
    "create trigger prevent_business_audit_mutation_trigger",
    "'business-documents', 'business-documents', false"
  ]) assert.match(schema, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.match(launchLock, /available_for_purchase = false/);
  assert.match(launchLock, /customer_purchase_enabled[\s\S]*?customer_workspace_creation_enabled[\s\S]*?values \('business', 'stage_0', false, false, now\(\)\)/i);
  assert.match(launchLock, /raise exception 'BUSINESS_COMING_SOON'/);
  assert.doesNotMatch(migration, /available_for_purchase = true/);
  assert.doesNotMatch(migration, /provisioning_enabled = true/);
});

test("the deployment diagnostic is silent, comprehensive, and non-mutating", () => {
  assert.match(diagnostic, /^-- Run after/);
  assert.match(diagnostic, /begin;/);
  assert.match(diagnostic, /BUSINESS_STAGE_2_MISSING_TABLES/);
  assert.match(diagnostic, /BUSINESS_STAGE_2_WORKSPACE_SCOPE_MISSING/);
  assert.match(diagnostic, /BUSINESS_STAGE_2_RLS_DISABLED/);
  assert.match(diagnostic, /BUSINESS_STAGE_2_DIRECT_WRITE_GRANT/);
  assert.match(diagnostic, /BUSINESS_STAGE_2_AUDIT_IMMUTABILITY_MISSING/);
  assert.match(diagnostic, /BUSINESS_STAGE_2_SHARED_MEMBERSHIP_ISOLATION_MISSING/);
  assert.match(diagnostic, /BUSINESS_STAGE_0_LAUNCH_LOCK_NOT_ACTIVE/);
  assert.match(diagnostic, /rollback;\s*$/);
  assert.doesNotMatch(diagnostic, /^select\s+/m);
});
