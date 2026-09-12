import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, source, styles] = await Promise.all([
  readFile(new URL("../app.html", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8")
]);

test("every authenticated logo routes to its correct dashboard", () => {
  assert.equal((html.match(/data-go-dashboard/g) || []).length, 4);
  assert.match(source, /const dashboardBrand = event\.target\.closest\("\[data-go-dashboard\]"\)/);
  assert.match(source, /state\.isAdmin[\s\S]*setRoute\("admin", "dashboard"\)[\s\S]*setRoute\("family", "dashboard"\)/);
});

test("admin dashboard reports platform subscriptions rather than customer bills", () => {
  for (const id of ["adminRegisteredUsers", "adminActiveSubscriptions", "adminExpiringSubscriptions", "adminPendingReviews", "adminFamilyCount", "adminRevenueTotal"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(html, /id="adminDueTotal"|id="adminOverdueCount"/);
  const summary = source.slice(source.indexOf("function renderAdminSummary"), source.indexOf("function adminWorkspaceTypeLabel"));
  assert.doesNotMatch(summary, /generateOccurrences|adminPaymentItems|adminPaymentRecords/);
  assert.match(summary, /paid_through_at/);
  assert.match(summary, /pending_review/);
});

test("recent platform finance combines subscription and legacy payment activity", () => {
  const recent = source.slice(source.indexOf("function renderRecentPlatformPayments"), source.indexOf("function renderPlatformPayments"));
  assert.match(recent, /state\.adminSubscriptionPayments/);
  assert.match(recent, /state\.payments/);
  assert.match(recent, /sort\(\(left, right\) => new Date\(right\.at/);
});

test("workspaces are grouped by owner and expandable workspace type", () => {
  assert.match(source, /const ownerGroups = new Map\(\)/);
  assert.match(source, /admin-owner-group/);
  assert.match(source, /admin-workspace-type-group/);
  assert.match(source, /const typeOrder = \["personal", "household", "business"\]/);
});

test("users, plan editors, finance settings, and enquiries are compact disclosures", () => {
  assert.match(source, /document\.createElement\("details"\)[\s\S]*article\.className = "admin-user-row"/);
  assert.match(html, /class="admin-disclosure plan-definition-panel"/);
  assert.match(html, /class="admin-disclosure admin-finance-settings"/);
  assert.match(html, /class="record-list enquiry-list"/);
  assert.match(source, /article\.className = "record-card enquiry-card"/);
});

test("admin cards retain dense responsive two-column minimum where space allows", () => {
  assert.match(styles, /\.admin-dashboard-stats[\s\S]*grid-template-columns: repeat\(3,/);
  assert.match(styles, /@media \(max-width: 1180px\)[\s\S]*\.admin-dashboard-stats[\s\S]*repeat\(2,/);
  assert.match(styles, /\.enquiry-stats,[\s\S]*\.support-stats[\s\S]*repeat\(2,/);
  assert.match(styles, /@media \(max-width: 380px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
});

test("admin plan catalogue remains complete and precedes collapsed editors", () => {
  const catalogueAt = html.indexOf('id="adminPlanList"');
  const editorAt = html.indexOf('id="planDefinitionForm"');
  assert.ok(catalogueAt > 0 && editorAt > catalogueAt);
  assert.match(source, /state\.adminPlans\.forEach\(\(plan\) =>/);
  assert.match(styles, /\.admin-plan-grid \{ grid-template-columns: repeat\(3,/);
});
