import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const migration = readFileSync(new URL("../supabase/migrations/20260928130000_business_stage_3_onboarding.sql", import.meta.url), "utf8");
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const diagnostic = readFileSync(new URL("../supabase/diagnostics/business_stage_3_onboarding_diagnostic.sql", import.meta.url), "utf8");
const html = readFileSync(new URL("../business.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../business.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../business.css", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");

test("Stage 3 migration follows the launch lock and mirrors the consolidated schema", () => {
  assert.ok(schema.endsWith(migration));
  assert.match(migration, /BUSINESS_SETTINGS_RPC_REQUIRED/);
  assert.match(migration, /public\.business_has_permission[\s\S]*?paid_through_at > now\(\)/);
  assert.match(migration, /revoke execute on function public\.save_business_profile/);
  assert.match(migration, /Business settings updates require protected RPC/);
  assert.match(migration, /Business workspace updates require protected RPC/);
  assert.doesNotMatch(migration, /available_for_purchase\s*=\s*true/);
});

test("a first item is an owner-only draft with same-workspace category and tag links", () => {
  assert.match(migration, /create table if not exists public\.business_setup_drafts/);
  assert.match(migration, /workspace_id uuid not null unique/);
  assert.match(migration, /foreign key \(workspace_id, category_id\)/);
  assert.match(migration, /foreign key \(workspace_id, dimension_id\)/);
  assert.match(migration, /require_business_workspace_row_trigger/);
  assert.match(migration, /Business Owner reads setup drafts/);
  assert.match(migration, /owner_id = auth\.uid\(\)/);
  assert.match(migration, /p_expected_version is distinct from v_previous\.version/);
  assert.match(migration, /where id = p_workspace_id for update;/);
  assert.match(migration, /category_type in \([\s\S]*?case when p_kind = 'income'/);
  assert.match(migration, /v_currency = any\(enabled_currencies\)/);
  assert.match(migration, /'included_in_financial_totals', false/);
  for (const table of ["payment_items", "payment_records", "subscription_invoices", "subscription_payments"]) {
    assert.doesNotMatch(migration, new RegExp(`insert into public\\.${table}`));
  }
});

test("owner setup validates supported currencies, timezone and optimistic edits", () => {
  const start = migration.indexOf("create or replace function public.save_business_setup(");
  const end = migration.indexOf("create or replace function public.save_business_setup_draft(", start);
  const setup = migration.slice(start, end);
  assert.match(setup, /public\.business_setup_owner_required\(p_workspace_id\)/);
  assert.match(setup, /public\.supported_currencies/);
  assert.match(setup, /pg_timezone_names/);
  assert.match(setup, /p_expected_profile_version is distinct from v_profile\.version/);
  assert.match(setup, /p_expected_settings_updated_at is distinct from v_settings\.updated_at/);
  assert.match(setup, /update public\.business_profiles/);
  assert.match(setup, /update public\.workspace_settings/);
  assert.match(setup, /update public\.budget_workspaces/);
  assert.match(migration, /v_profile\.onboarding_status = 'not_started'/);
  assert.match(migration, /grant execute on function public\.complete_business_onboarding/);
});

test("owner can finish without staff or a draft; unfinished access opens setup", () => {
  const finish = migration.slice(
    migration.indexOf("create or replace function public.complete_business_onboarding("),
    migration.indexOf("create or replace function public.business_has_permission(")
  );
  assert.doesNotMatch(finish, /workspace_members/);
  assert.doesNotMatch(finish, /business_setup_drafts/);
  for (const step of ["basics", "categories", "tags", "first"]) {
    assert.match(html, new RegExp(`data-setup-pane="${step}"`));
  }
  assert.match(script, /state\.businessProfile\?\.onboarding_status !== "complete" \|\| setupOpen/);
  assert.match(script, /if \(!state\.locked\) renderBusinessSetup\(\)/);
  assert.match(html, /not included in financial totals yet/);
  assert.match(script, /renderSetupDraft/);
  assert.match(styles, /\.currency-choices/);
  assert.match(styles, /@media \(max-width: 760px\)/);
});

test("workspace switch hides old Business data before asynchronous loads", () => {
  const begin = script.indexOf("async function selectBusinessWorkspace(");
  const end = script.indexOf("async function loadBusinessAccess()", begin);
  const select = script.slice(begin, end);
  assert.ok(select.indexOf("clearBusinessWorkspaceState();") < select.indexOf('showOnly("businessLoading")'));
  assert.ok(select.indexOf('showOnly("businessLoading")') < select.indexOf("await Promise.all"));
  assert.match(select, /requestSequence !== workspaceLoadSequence/);
  assert.match(select, /state\.workspace\?\.id !== workspace\.id/);
  assert.match(workflow, /cp about\.html app-entry\.html app\.html business\.html/);
  assert.match(workflow, /cp app-entry\.js app\.js business\.js/);
  assert.match(workflow, /cp business\.css/);
});

test("every Business setup control referenced by the script is present", () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const setupIds = [...script.matchAll(/\$\("#(setup[^"]+|businessBasicsForm|businessCategoryForm|businessTagForm|businessDraftForm|businessOnboarding|onboardingMessage|onboardingProgress|finishBusinessSetup|editBusinessSetup)"\)/g)];
  for (const match of setupIds) assert.ok(ids.has(match[1]), `Missing Business form control: ${match[1]}`);
});

test("reopening saved setup shows the actual stored base currency", () => {
  const start = script.indexOf("function renderBusinessSetup()");
  const end = script.indexOf("function showSetupStep(", start);
  const nodes = Object.fromEntries(
    ["setupBusinessName", "setupTimezone", "setupPeriodDay", "setupFinancialMonth",
      "setupDraftKind", "setupDraftDescription", "setupDraftAmount", "setupDraftDate",
      "setupDraftDue", "setupBaseCurrency", "editBusinessSetup"].map((id) => [
      `#${id}`, { value: "USD", classList: { toggle() {} } }
    ])
  );
  const context = {
    $, // assigned below
    state: {
      businessProfile: { trading_name: "Company", financial_year_start_month: 7, period_start_day: 1 },
      workspaceSettings: { base_currency: "ZAR", enabled_currencies: ["USD", "ZAR"], timezone: "Africa/Harare" },
      workspace: { name: "Company" },
      setupDraft: null
    },
    chosenCurrencies: new Set(),
    renderCurrencyChoices() {},
    renderBaseCurrencyChoice() { nodes["#setupBaseCurrency"].value = "USD"; },
    renderSetupLists() {},
    renderDraftSelectors() {},
    renderSetupDraft() {},
    roleForWorkspace() { return "business_owner"; },
    Set, Date, String
  };
  function $(selector) { return nodes[selector]; }
  const render = runInNewContext(`${script.slice(start, end)}; renderBusinessSetup`, context);
  render();
  assert.equal(nodes["#setupBaseCurrency"].value, "ZAR");
});

test("deployment diagnostic checks DB isolation without changing live data", () => {
  assert.match(diagnostic, /^begin;/m);
  assert.match(diagnostic, /relrowsecurity/);
  assert.match(diagnostic, /business_setup_draft_category_fk/);
  assert.match(diagnostic, /Business workspace updates require protected RPC/);
  assert.match(diagnostic, /BUSINESS_PUBLIC_PURCHASE_LOCK_OPEN/);
  assert.match(diagnostic, /rollback;\s*$/);
});
