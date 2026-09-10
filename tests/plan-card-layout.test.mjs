import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [appHtml, appSource, appStyles, pricingHtml, publicSource, publicStyles] = await Promise.all([
  readFile(new URL("../app.html", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../pricing.html", import.meta.url), "utf8"),
  readFile(new URL("../site.js", import.meta.url), "utf8"),
  readFile(new URL("../site.css", import.meta.url), "utf8")
]);

test("public pricing uses a compact responsive three-two-one plan grid", () => {
  assert.match(publicStyles, /\.public-plan-catalogue\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(publicStyles, /@media \(max-width:\s*980px\)[\s\S]*?\.public-plan-catalogue\s*\{\s*grid-template-columns:\s*repeat\(2,/);
  assert.match(publicStyles, /@media \(max-width:\s*680px\)[\s\S]*?\.public-plan-catalogue\s*\{\s*grid-template-columns:\s*1fr/);
  assert.doesNotMatch(publicStyles, /\.public-plan-card\s*\{[^}]*min-height:\s*500px/s);
  assert.match(publicStyles, /\.public-plan-card:last-child:nth-child\(3n \+ 1\)\s*\{\s*grid-column:\s*2/);
});

test("logged-in Subscription provides matching billing and currency controls", () => {
  assert.match(appHtml, /class="workspace-plan-controls"/);
  assert.match(appHtml, /data-workspace-plan-period="monthly"/);
  assert.match(appHtml, /data-workspace-plan-period="annual"/);
  assert.match(appHtml, /id="workspacePlanCurrency"/);
  assert.match(appSource, /workspacePlanBillingPeriod/);
  assert.match(appSource, /workspacePlanCurrency/);
});

test("logged-in plan cards use live catalogue features, prices, and limits", () => {
  assert.match(appSource, /from\("plan_features"\)\.select\("\*"\)\.eq\("enabled", true\)/);
  assert.match(appSource, /featureLabelsForPlan\(plan\)/);
  assert.match(appSource, /activePaymentLimitForPlan\(plan\)/);
  assert.match(appSource, /activePriceFor\(plan\.id, state\.workspacePlanBillingPeriod, state\.workspacePlanCurrency\)/);
  assert.match(publicSource, /get_public_plan_catalogue/);
  assert.match(pricingHtml, /id="publicPlanCatalogue"/);
});

test("selected workspace controls which plan types are compared", () => {
  assert.match(appSource, /workspaceType === "personal"[\s\S]*plan\.workspace_type === "personal" \|\| plan\.workspace_type === "household"/);
  assert.match(appSource, /plan\.workspace_type === workspaceType/);
  assert.match(appSource, /Creates a separate Family workspace with its own plan/);
});

test("current and pending plans have distinct non-shifting states", () => {
  assert.match(appSource, /Current plan<\/span>/);
  assert.match(appSource, /Awaiting approval<\/span>/);
  assert.match(appSource, /workspace-plan-card\$\{current \? " current"/);
  assert.match(appStyles, /\.workspace-plan-card\.current\s*\{[^}]*box-shadow:\s*inset/s);
  assert.match(appStyles, /\.workspace-plan-card\.pending\s*\{/);
});

test("logged-in cards adapt from three columns to two and one", () => {
  assert.match(appStyles, /\.workspace-plan-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,/s);
  assert.match(appStyles, /\.workspace-plan-card:last-child:nth-child\(3n \+ 1\)\s*\{\s*grid-column:\s*2/);
  assert.match(appStyles, /@container workspace-plan-list \(max-width:\s*920px\)[\s\S]*?repeat\(2,/);
  assert.match(appStyles, /@container workspace-plan-list \(max-width:\s*570px\)[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test("choosing a card carries its billing period and currency into payment review", () => {
  assert.match(appSource, /\$\("#renewalPeriod"\)\.value = state\.workspacePlanBillingPeriod/);
  assert.match(appSource, /\$\("#renewalCurrency"\)\.value = state\.workspacePlanCurrency/);
  assert.match(appSource, /data-select-renewal-plan/);
});
