import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../business.html", import.meta.url), "utf8");
const business = readFileSync(new URL("../business.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../business.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const launchLock = readFileSync(new URL("../supabase/migrations/20260927183000_business_stage_0_launch_lock.sql", import.meta.url), "utf8");

test("Stage 1 has a dedicated Business application and all approved sections", () => {
  assert.match(page, /business\.css\?v=13/);
  assert.match(page, /business\.js\?v=17/);
  assert.match(page, /Version 4\.9\.39/);
  for (const section of [
    "overview", "activity", "bills", "approvals", "budgets", "reports", "team", "settings", "subscription"
  ]) {
    assert.match(page, new RegExp(`data-business-panel="${section}"`));
    assert.match(business, new RegExp(`\"${section}\"`));
  }
  for (const label of [
    "Activity &amp; Transactions", "Bills &amp; Recurring", "Requests &amp; Approvals",
    "Budgets", "Reports", "Team", "Settings", "Subscription &amp; Billing"
  ]) assert.match(page, new RegExp(label));
  assert.match(styles, /\.business-sidebar/);
  assert.match(styles, /@media \(max-width: 760px\)/);
});

test("mobile Business navigation is Overview, Activity, Add, Approvals, and Menu", () => {
  const mobileNav = page.slice(page.indexOf('<nav class="mobile-bottom-nav"'), page.indexOf("</nav>", page.indexOf('<nav class="mobile-bottom-nav"')));
  for (const label of ["Overview", "Activity", "Add", "Approvals", "Menu"]) {
    assert.match(mobileNav, new RegExp(`>${label}<`));
  }
  assert.equal((mobileNav.match(/<small>/g) || []).length, 5);
});

test("Business access loads only authorized Business workspaces", () => {
  assert.match(business, /from\("budget_workspaces"\)[\s\S]*?eq\("workspace_type", "business"\)/);
  assert.match(business, /authorizedBusinessWorkspaces/);
  assert.match(business, /workspace\.owner_id === userId \|\| activeWorkspaceIds\.has\(workspace\.id\)/);
  assert.match(business, /mushavo-budget:selected-business-workspace:/);
  assert.match(business, /new URL\(window\.location\.href\)\.searchParams\.get\("workspace"\)/);
});

test("Business never reads Personal, Family, payments, or Cashbook data", () => {
  for (const table of [
    "families", "family_members", "family_invitations", "payment_items", "payment_records",
    "cashbook_accounts", "cashbook_entries", "cashbook_account_balances"
  ]) {
    assert.doesNotMatch(business, new RegExp(`from\\(\"${table}\"\\)`));
  }
  assert.doesNotMatch(business, /supabase\.from\("[^"]+"\)\.(insert|update|delete|upsert)\(/);
  assert.match(page, /not included in financial totals yet/);
});

test("workspace switching clears all company collections and rejects stale responses", () => {
  const clearStart = business.indexOf("function clearBusinessWorkspaceState()");
  const clearEnd = business.indexOf("function roleForWorkspace", clearStart);
  const clearSource = business.slice(clearStart, clearEnd);
  for (const collection of ["transactions", "bills", "requests", "budgets", "documents", "auditEvents"]) {
    assert.match(clearSource, new RegExp(`state\\.${collection} = \\[\\]`));
  }
  const switchStart = business.indexOf("async function selectBusinessWorkspace");
  const switchEnd = business.indexOf("async function loadBusinessAccess", switchStart);
  const switchSource = business.slice(switchStart, switchEnd);
  assert.ok(switchSource.indexOf("clearBusinessWorkspaceState()") < switchSource.indexOf("state.workspace = workspace"));
  assert.match(switchSource, /requestSequence !== workspaceLoadSequence/);
  assert.match(switchSource, /state\.workspace\?\.id !== workspace\.id/);
});

test("Personal and Family app clears financial state before opening Business", () => {
  const clearStart = app.indexOf("function clearBudgetDataBeforeBusinessNavigation()");
  const clearEnd = app.indexOf("function openBusinessWorkspace", clearStart);
  const clearSource = app.slice(clearStart, clearEnd);
  for (const collection of ["members", "paymentItems", "paymentRecords", "cashbookAccounts", "cashbookEntries", "paymentConversions"]) {
    assert.match(clearSource, new RegExp(`state\\.${collection} = \\[\\]`));
  }
  const openStart = app.indexOf("function openBusinessWorkspace");
  const openEnd = app.indexOf("async function selectFamily", openStart);
  const openSource = app.slice(openStart, openEnd);
  assert.ok(openSource.indexOf("clearBudgetDataBeforeBusinessNavigation()") < openSource.indexOf("window.location.assign"));
  assert.match(app, /`business:\$\{workspace\.id\}`/);
  assert.match(app, /business\.html/);
});

test("expired Business access follows Owner-only renewal rule", () => {
  assert.match(business, /state\.lockOwner=businessBillingOwner\(\)/);
  assert.match(business, /Only the Business Owner can view billing/);
  assert.match(business, /This Business subscription has expired. Contact the Business Owner./);
  assert.match(business, /state\.tab='subscription'/);
});

test("Stage 1 preserves the Stage 0 purchase and provisioning lock", () => {
  assert.match(launchLock, /available_for_purchase = false/);
  assert.match(launchLock, /raise exception 'BUSINESS_COMING_SOON'/);
  assert.match(page, /Purchases remain closed/);
  assert.doesNotMatch(business, /subscription_renewal_requests/);
  assert.doesNotMatch(business, /provision.*business/i);
});
